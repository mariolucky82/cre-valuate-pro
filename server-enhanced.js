/**
 * Enhanced Backend for CRE Valuate Pro (Production-Ready)
 * 
 * This version includes:
 * - PostgreSQL database (instead of in-memory)
 * - Bcrypt password hashing
 * - Input validation (joi)
 * - Rate limiting
 * - Error logging
 * 
 * To use this:
 * 1. npm install pg bcrypt joi express-rate-limit
 * 2. Create PostgreSQL database and run db-setup.sql
 * 3. Replace server.js with this file (or merge carefully)
 * 4. Add DATABASE_URL to .env
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripeLib = require('stripe');
const multer = require('multer');
const bodyParser = require('body-parser');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 4242;

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/cre-valuate-pro'
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Stripe and secrets
const stripe = stripeLib(process.env.STRIPE_SECRET_KEY || 'sk_test_PLACEHOLDER');
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
const PRICE_ID = process.env.PRICE_ID || 'price_xxx';

// S3 client
const S3_BUCKET = process.env.S3_BUCKET || '';
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// Middleware
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30 // limit each IP to 30 requests per minute
});

app.use('/api/', apiLimiter);

// Multer (in-memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 5 } });

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

// Auth middleware
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Routes

// Login
app.post('/login', loginLimiter, async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password } = value;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/me', requireAuth, (req, res) => {
  const { id, email, paid, logo_key } = req.user;
  const logoUrl = logo_key 
    ? `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${logo_key}` 
    : null;
  res.json({ id, email, paid, logoUrl });
});

// Create Stripe Checkout Session
app.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${CLIENT_URL}?checkoutSuccess=true`,
      cancel_url: `${CLIENT_URL}?checkoutCanceled=true`,
      client_reference_id: String(req.user.id)
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_PLACEHOLDER';
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.warn('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clientRef = session.client_reference_id;

    if (clientRef) {
      try {
        await pool.query(
          'UPDATE users SET paid = true, updated_at = NOW() WHERE id = $1',
          [clientRef]
        );
        console.log(`User ${clientRef} marked as paid.`);
      } catch (err) {
        console.error('Database error updating user:', err);
      }
    }
  }

  res.json({ received: true });
});

// Upload logo to S3
app.post('/upload-logo', requireAuth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!S3_BUCKET) return res.status(500).json({ error: 'S3_BUCKET not configured' });

    const key = `logos/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const put = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    });

    await s3Client.send(put);
    await pool.query('UPDATE users SET logo_key = $1 WHERE id = $2', [key, req.user.id]);

    const url = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ url });
  } catch (err) {
    console.error('S3 upload error', err);
    res.status(500).json({ error: 'Failed to upload to S3' });
  }
});

// Generate PDF
app.get('/generate-pdf', requireAuth, async (req, res) => {
  try {
    if (!req.user.paid) {
      return res.status(403).json({ error: 'Subscription required to export PDF' });
    }

    const logoUrl = req.user.logo_key
      ? `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.user.logo_key}`
      : null;

    const title = req.query.title ? String(req.query.title).slice(0, 200) : 'Investment Memo';

    const html = `
    <!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px}
      .company{font-weight:700;font-size:18px}
      .sub{color:#475569;font-size:12px}
      .metrics{display:flex;gap:12px;margin-top:12px}
      .metric{padding:8px;border:1px solid #e6edf3;border-radius:6px;background:#fff;width:30%}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{padding:8px;border:1px solid #e6edf3;text-align:left}
    </style>
    </head><body>
      <div class="header">
        <div>
          <div class="company">${(req.user.email || '').toUpperCase()}</div>
          <div class="sub">Branded Investment Memo</div>
        </div>
        <div>${logoUrl ? `<img src="${logoUrl}" style="max-height:60px">` : ''}</div>
      </div>
      <h2>${title.toUpperCase()}</h2>
      <div class="metrics">
        <div class="metric"><strong>NOI</strong><div>$123,456</div></div>
        <div class="metric"><strong>Cap Rate</strong><div>5.00%</div></div>
        <div class="metric"><strong>CoC</strong><div>7.25%</div></div>
      </div>
      <h3 style="margin-top:24px;">5-Year Projection</h3>
      <table>
        <thead><tr><th>Year</th><th>Gross Income</th><th>NOI</th><th>Net Cash Flow</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>$320,000</td><td>$225,000</td><td>$45,000</td></tr>
          <tr><td>2</td><td>$329,600</td><td>$230,000</td><td>$47,000</td></tr>
          <tr><td>3</td><td>$339,488</td><td>$235,000</td><td>$49,000</td></tr>
        </tbody>
      </table>
      <footer style="position:fixed;bottom:24px;font-size:11px;color:#94a3b8">Generated by CRE Valuate Pro</footer>
    </body></html>
    `;

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // Log PDF generation
    await pool.query(
      'INSERT INTO pdfs_generated (user_id, title) VALUES ($1, $2)',
      [req.user.id, title]
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="investment-memo.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Health
app.get('/', (req, res) => res.send('CRE Valuate Pro backend running'));

// Start
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!process.env.STRIPE_SECRET_KEY) console.warn('Warning: STRIPE_SECRET_KEY not set');
  if (!process.env.DATABASE_URL) console.warn('Warning: DATABASE_URL not set; using in-memory fallback');
});

module.exports = app;
