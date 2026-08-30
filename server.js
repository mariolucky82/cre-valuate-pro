/**
 * Backend for CRE Valuate Pro demo (Render-ready).
 * - JWT demo auth
 * - Stripe Checkout session creation (subscription)
 * - Stripe webhook verification -> mark user as paid
 * - Upload logos to S3 (server-side) and return S3 URL
 * - Generate PDF via Puppeteer (protected by subscription check)
 *
 * WARNING: Demo uses in-memory user store. Replace with a database for production.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripeLib = require('stripe');
const multer = require('multer');
const bodyParser = require('body-parser');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 4242;

// CORS — restrict to actual frontend origin in production
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// In-memory demo user store
const USERS = {
  1: { id: 1, email: 'test@example.com', password: 'password', paid: false, logoKey: null }
};

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

// Simple auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = USERS[payload.userId];
    if (!user) return res.status(401).json({ error: 'Invalid user' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Routes

// Demo login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = Object.values(USERS).find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Get user
app.get('/me', requireAuth, (req, res) => {
  const { id, email, paid, logoKey } = req.user;
  const logoUrl = logoKey ? `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${logoKey}` : null;
  res.json({ id, email, paid, logoUrl });
});

// Create Stripe Checkout Session (link client_reference_id to user)
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
    // Modern Stripe returns a url you can redirect to
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook - raw body required
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_PLACEHOLDER';
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.warn('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clientRef = session.client_reference_id;
    if (clientRef && USERS[clientRef]) {
      USERS[clientRef].paid = true;
      console.log(`User ${clientRef} marked as paid.`);
    } else {
      console.log('checkout.session.completed received but no matching user.');
    }
  }

  // Optionally handle other events (invoice.payment_failed, customer.subscription.deleted, etc.)
  res.json({ received: true });
});

// Upload logo to S3 (server-side). Returns public URL (ACL: public-read).
app.post('/upload-logo', requireAuth, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!S3_BUCKET) return res.status(500).json({ error: 'S3_BUCKET not configured' });

  try {
    const key = `logos/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const put = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read' // NOTE: public-read makes object publicly accessible. Consider signed URLs for privacy.
    });
    await s3Client.send(put);
    req.user.logoKey = key;
    const url = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ url });
  } catch (err) {
    console.error('S3 upload error', err);
    res.status(500).json({ error: 'Failed to upload to S3' });
  }
});

// Generate PDF (protected & checks subscription). Renders minimal branded HTML including S3 logo URL.
app.get('/generate-pdf', requireAuth, async (req, res) => {
  if (!req.user.paid) return res.status(403).json({ error: 'Subscription required to export PDF' });

  const logoUrl = req.user.logoKey ? `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.user.logoKey}` : null;
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

// Health
app.get('/', (req, res) => res.send('CRE Valuate Pro backend running'));

// Start
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!process.env.STRIPE_SECRET_KEY) console.warn('Warning: STRIPE_SECRET_KEY not set');
  if (!process.env.S3_BUCKET) console.warn('Warning: S3_BUCKET not set; uploads will fail');
});
