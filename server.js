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
const PORT = Number(process.env.PORT || 4242);

const normalizeOrigin = (value) => {
  if (!value) return null;
  return value.trim().replace(/\/$/, '');
};

const CLIENT_URL = normalizeOrigin(process.env.CLIENT_URL || 'http://localhost:3000');
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const ALLOWED_ORIGINS = Array.from(new Set([CLIENT_URL, ...EXTRA_ORIGINS, 'http://localhost:3000', 'http://localhost:4173']));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = !origin || ALLOWED_ORIGINS.includes(origin) || /localhost:\d+$/.test(origin || '') || /\.vercel\.app$/.test(origin || '') || /\.onrender\.com$/.test(origin || '');

  if (allowed) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Stripe-Signature');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.raw({ type: 'application/json' }));

app.use(express.static(path.join(__dirname, 'public')));

db.ensureDemoUser();

const stripe = stripeLib(process.env.STRIPE_SECRET_KEY || 'sk_test_PLACEHOLDER');
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-change-me';
const PRICE_ID = process.env.PRICE_ID || 'price_xxx';

const S3_BUCKET = process.env.S3_BUCKET || '';
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 5 } });

function validateEnv() {
  const warnings = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'demo-secret-key-change-me') {
    warnings.push('JWT_SECRET is not set or still using the demo secret.');
  }

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
    warnings.push('STRIPE_SECRET_KEY is not configured. Checkout and webhook features will fail until you add real keys.');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.includes('PLACEHOLDER')) {
    warnings.push('STRIPE_WEBHOOK_SECRET is not configured. Stripe webhooks will not verify.');
  }

  if (!process.env.S3_BUCKET) {
    warnings.push('S3_BUCKET is not set. Logo uploads will fail until AWS credentials and a bucket are configured.');
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    warnings.push('AWS credentials are not configured. Logo uploads will fail until AWS access is configured.');
  }

  if (!process.env.CLIENT_URL) {
    warnings.push('CLIENT_URL is not set; defaulting to http://localhost:3000 for local development.');
  }

  return warnings;
}

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth token' });

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'Invalid user' });

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

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CRE Valuate Pro',
    timestamp: new Date().toISOString(),
    mode: process.env.NODE_ENV || 'development'
  });
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (db.getUserByEmail(email)) return res.status(409).json({ error: 'User already exists' });

  try {
    const hashed = bcrypt.hashSync(password, 10);
    let customer = null;
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
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

app.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/me', requireAuth, async (req, res) => {
  const { id, email, paid, logoKey } = req.user;
  let logoUrl = null;

  if (logoKey && S3_BUCKET) {
    try {
      const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: logoKey });
      logoUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 60 * 60 });
    } catch (err) {
      console.warn('Failed to generate signed logo URL', err.message);
    }
  }

  res.json({ id, email, paid, logoUrl });
});

app.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    let customerId = req.user.stripeCustomerId;
    if (!customerId && process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
      const customer = await stripe.customers.create({ email: req.user.email });
      db.setUserStripeCustomerId(req.user.id, customer.id);
      customerId = customer.id;
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
      return res.status(400).json({ error: 'Stripe is not configured. Add Stripe keys to .env.' });
    }

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${CLIENT_URL || 'http://localhost:3000'}?checkoutSuccess=true`,
      cancel_url: `${CLIENT_URL || 'http://localhost:3000'}?checkoutCanceled=true`,
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

app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_PLACEHOLDER';
  let event;

  try {
    const rawBody = req.body; // already raw because /webhook uses express.raw
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.warn('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const clientRef = session.client_reference_id;
      const customer = session.customer || session.customer_details?.id;
      const subscription = session.subscription;

      if (clientRef) {
        if (subscription) db.setUserSubscription(Number(clientRef), subscription, 'active');
        if (customer) db.setUserStripeCustomerId(Number(clientRef), customer);
        db.setUserPaid(Number(clientRef), true);
        console.log(`User ${clientRef} marked as paid via checkout.session.completed.`);
      } else if (customer) {
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          if (subscription) db.setUserSubscription(user.id, subscription, 'active');
          db.setUserPaid(user.id, true);
          console.log(`User ${user.id} marked as paid via webhook (customer).`);
        }
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const customer = invoice.customer;
      if (customer) {
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          db.setUserPaid(user.id, true);
        }
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const subscription = event.data.object;
      const customer = subscription.customer;
      const status = subscription.status;
      if (customer) {
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          db.setUserSubscription(user.id, subscription.id, status);
          db.setUserPaid(user.id, status === 'active' || status === 'trialing');
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customer = subscription.customer;
      if (customer) {
        const user = db.getUserByStripeCustomerId(customer);
        if (user) {
          db.setUserSubscription(user.id, subscription.id, 'canceled');
          db.setUserPaid(user.id, false);
        }
      }
    }
  } catch (err) {
    console.error('Error handling webhook event', err);
  }

  res.json({ received: true });
});

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
    db.setUserLogoKey(req.user.id, key);

    const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const url = await getSignedUrl(s3Client, getCmd, { expiresIn: 60 * 60 });
    res.json({ url });
  } catch (err) {
    console.error('S3 upload error', err);
    res.status(500).json({ error: 'Failed to upload to S3' });
  }
});

app.get('/generate-pdf', requireAuth, async (req, res) => {
  if (!req.user.paid) return res.status(403).json({ error: 'Subscription required to export PDF' });

  const logoUrl = req.user.logoKey && S3_BUCKET ? `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${req.user.logoKey}` : null;
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const startupWarnings = validateEnv();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  if (startupWarnings.length) {
    console.warn('Startup warnings:');
    startupWarnings.forEach((warning) => console.warn(`- ${warning}`));
  }
});

module.exports = app;
