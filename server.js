/**
 * Backend for CRE Valuate Pro demo (Render-ready).
 * - JWT auth backed by SQLite
 * - Stripe Checkout session creation (subscription)
 * - Stripe webhook verification -> mark user as paid (persisted)
 * - Upload logos to S3 (server-side) and return presigned S3 GET URL
 * - Generate PDF via Puppeteer (protected by subscription check)
 * - Serve static frontend from /public
 *
 * WARNING: Demo uses a local SQLite DB. For production use a managed DB.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripeLib = require('stripe');
const multer = require('multer');
const bodyParser = require('body-parser');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const puppeteer = require('puppeteer');
const bcrypt = require('bcryptjs');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4242;

// CORS — restrict to actual frontend origin in production
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB demo user
db.ensureDemoUser();

// Stripe and secrets
const stripe = stripeLib(process.env.STRIPE_SECRET_KEY || 'sk_test_PLACEHOLDER');
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
const PRICE_ID = process.env.PRICE_ID || 'price_xxx';

// S3 client (requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET in env)
const S3_BUCKET = process.env.S3_BUCKET || '';
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// Multer (in-memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 5 } }); // 5MB

// Simple auth middleware (checks token + loads user from DB)
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'Invalid user' });
    // Normalize fields
    req.user = {
      id: user.id,
      email: user.email,
      paid: Boolean(user.paid),
      logoKey: user.logoKey,
      stripeCustomerId: user.stripeCustomerId
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Routes

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (db.getUserByEmail(email)) return res.status(409).json({ error: 'User already exists' });

  try {
    const hashed = bcrypt.hashSync(password, 10);
    // Create Stripe customer
    let customer = null;
    if (process.env.STRIPE_SECRET_KEY) {
      customer = await stripe.customers.create({ email });
    }
    const user = db.createUser(email, hashed, customer ? customer.id : null);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// Demo login (now supports hashed passwords)
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Get user
app.get('/me', requireAuth, async (req, res) => {
  const { id, email, paid, logoKey } = req.user;
  let logoUrl = null;
  if (logoKey && S3_BUCKET) {
    try {
      const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: logoKey });
      logoUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 60 * 60 }); // 1 hour
    } catch (err) {
      console.warn('Failed to generate signed logo URL', err.message);
    }
  }
  res.json({ id, email, paid, logoUrl });
});

// Create Stripe Checkout Session (link customer to user)
app.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    // Ensure user has a Stripe customer
    let customerId = req.user.stripeCustomerId;
    if (!customerId && process.env.STRIPE_SECRET_KEY) {
      const customer = await stripe.customers.create({ email: req.user.email });
      db.setUserStripeCustomerId(req.user.id, customer.id);
      customerId = customer.id;
    }

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${CLIENT_URL}?checkoutSuccess=true`,
      cancel_url: `${CLIENT_URL}?checkoutCanceled=true`,
      client_reference_id: String(req.user.id)
    };
    if (customerId) sessionParams.customer = customerId;

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook - raw body required
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

  try {
    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const clientRef = session.client_reference_id;
      const customer = session.customer || session.customer_details?.id;
      const subscription = session.subscription;

      if (clientRef) {
        // Update user's subscription info
        if (subscription) db.setUserSubscription(Number(clientRef), subscription, 'active');
        if (customer) db.setUserStripeCustomerId(Number(clientRef), customer);
        db.setUserPaid(Number(clientRef), true);
        console.log(`User ${clientRef} marked as paid via checkout.session.completed.`);
      } else if (customer) {
        // Try to look up user by Stripe customer id
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          if (subscription) db.setUserSubscription(user.id, subscription, 'active');
          db.setUserPaid(user.id, true);
          console.log(`User ${user.id} marked as paid via webhook (customer).`);
        }
      }
    }

    // invoice.payment_succeeded -> mark paid
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const customer = invoice.customer;
      if (customer) {
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          db.setUserPaid(user.id, true);
          console.log(`User ${user.id} marked as paid via invoice.payment_succeeded.`);
        }
      }
    }

    // customer.subscription.updated
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const subscription = event.data.object;
      const customer = subscription.customer;
      const status = subscription.status;
      if (customer) {
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          db.setUserSubscription(user.id, subscription.id, status);
          db.setUserPaid(user.id, status === 'active' || status === 'trialing');
          console.log(`User ${user.id} subscription updated: ${status}`);
        }
      }
    }

    // customer.subscription.deleted
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customer = subscription.customer;
      if (customer) {
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          db.setUserSubscription(user.id, subscription.id, 'canceled');
          db.setUserPaid(user.id, false);
          console.log(`User ${user.id} subscription canceled.`);
        }
      }
    }
  } catch (err) {
    console.error('Error handling webhook event', err);
    // Do not fail the webhook entirely; acknowledge to avoid retries if we've partially handled
  }

  res.json({ received: true });
});

// Upload logo to S3 (server-side). Stores key in DB and returns presigned GET URL.
app.post('/upload-logo', requireAuth, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!S3_BUCKET) return res.status(500).json({ error: 'S3_BUCKET not configured' });

  try {
    const key = `logos/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const put = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    });
    await s3Client.send(put);
    // Persist key for user
    db.setUserLogoKey(req.user.id, key);
    // Return a signed GET URL
    const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const url = await getSignedUrl(s3Client, getCmd, { expiresIn: 60 * 60 });
    res.json({ url });
  } catch (err) {
    console.error('S3 upload error', err);
    res.status(500).json({ error: 'Failed to upload to S3' });
  }
});

// Generate PDF (protected & checks subscription). Renders minimal branded HTML including S3 logo URL.
app.get('/generate-pdf', requireAuth, async (req, res) => {
  if (!req.user.paid) return res.status(403).json({ error: 'Subscription required to export PDF' });

  const logoUrl = req.user.logoKey && S3_BUCKET ? `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.user.logoKey}` : null;
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

  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

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

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check (optional, before fallback)
// app.get('/', (req, res) => res.send('CRE Valuate Pro backend running'));

// Start
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!process.env.STRIPE_SECRET_KEY) console.warn('Warning: STRIPE_SECRET_KEY not set');
  if (!process.env.S3_BUCKET) console.warn('Warning: S3_BUCKET not set; uploads will fail');
});
