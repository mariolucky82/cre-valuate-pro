# CRE Valuate Pro — Production Launch Guide

Complete step-by-step guide to get your app production-ready and live.

---

## Phase 1: Set Up External Services

### 1.1 Stripe Setup

**Create a Stripe Account:**
1. Go to [stripe.com](https://stripe.com)
2. Sign up and verify your account
3. Navigate to **Dashboard → Developers → API Keys**
4. Copy your **Secret Key** (starts with `sk_`)
   - For testing: use `sk_test_...`
   - For production: use `sk_live_...` (only after going live)

**Create a Product & Price:**
1. Go to **Products** (left sidebar)
2. Click **+ Add product**
3. Set details:
   - **Name:** "CRE Valuate Pro Subscription"
   - **Type:** Service
   - **Billing period:** Monthly
   - **Price:** $29 (or your desired amount)
4. Copy the **Price ID** (starts with `price_`)

**Set Up Webhook:**
1. Go to **Developers → Webhooks**
2. Click **+ Add endpoint**
3. Fill in:
   - **URL:** `https://<your-render-backend-url>/webhook`
     - Example: `https://cre-valuate-pro.onrender.com/webhook`
   - **Events to send:** Select `checkout.session.completed`
   - **API version:** Default is fine
4. Click **Add endpoint**
5. Click the new endpoint, then **Reveal signing secret**
6. Copy the **Webhook Secret** (starts with `whsec_`)

---

### 1.2 AWS S3 Setup

**Create AWS Account & S3 Bucket:**
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Sign up with email and credit card
3. Go to **S3 Console**
4. Click **+ Create bucket**
5. Fill in:
   - **Bucket name:** `cre-valuate-pro-logos` (must be globally unique; add a random suffix like `-abc123`)
   - **Region:** `us-east-1` (or your preferred region)
   - **Block Public Access settings:** Uncheck "Block all public access"
     - You'll need this for public-read ACL on logo uploads
6. Click **Create bucket**

**Create IAM User (for secure credentials):**
1. Go to **IAM Console → Users**
2. Click **Create user**
3. **User name:** `cre-valuate-pro-app`
4. Click **Next**
5. Click **Attach policies directly**
6. Search for and select: **AmazonS3FullAccess**
   - ⚠️ For production, create a custom policy limiting to your specific bucket
7. Click **Next** → **Create user**
8. Click the new user, then **Security credentials** tab
9. Click **Create access key**
10. Select **Application running outside AWS**
11. Click **Next** → **Create access key**
12. **Save these credentials** (you'll use them below):
    - Access Key ID
    - Secret Access Key

---

### 1.3 Environment Variables Checklist

Collect all these values:

```
# Stripe
STRIPE_SECRET_KEY=sk_test_...                    # From Stripe Dashboard
PRICE_ID=price_...                                # From Product → Price
STRIPE_WEBHOOK_SECRET=whsec_...                  # From Webhook settings

# JWT & Client
JWT_SECRET=<generate-a-strong-random-secret>     # Use: openssl rand -hex 32
CLIENT_URL=https://your-frontend.vercel.app      # Set after Vercel deploy

# AWS S3
AWS_REGION=us-east-1                             # Or your chosen region
AWS_ACCESS_KEY_ID=AKIA...                        # From IAM user
AWS_SECRET_ACCESS_KEY=...                        # From IAM user
S3_BUCKET=cre-valuate-pro-logos                  # Your bucket name

# Server
PORT=4242                                         # Default port
```

---

## Phase 2: Deploy Backend to Render

**Create Render Account & Deploy:**
1. Go to [render.com](https://render.com)
2. Sign up (link your GitHub account)
3. Click **+ New** → **Web Service**
4. Connect your GitHub repo `mariolucky82/cre-valuate-pro`
5. Fill in:
   - **Name:** `cre-valuate-pro-backend`
   - **Environment:** `Node`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free or Paid (Puppeteer needs 0.5GB+ RAM; Free tier has 0.5GB)

**Add Environment Variables:**
1. Scroll down to **Environment**
2. Click **Add Environment Variable** and paste all from **Phase 1.3** above:
   ```
   STRIPE_SECRET_KEY
   PRICE_ID
   STRIPE_WEBHOOK_SECRET
   JWT_SECRET
   CLIENT_URL (leave blank for now)
   AWS_REGION
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   S3_BUCKET
   PORT=4242
   ```

**Deploy:**
1. Click **Create Web Service**
2. Wait for build/deploy (5–10 min)
3. Copy your backend URL: `https://cre-valuate-pro-backend.onrender.com`
4. Keep this handy for the next phase

---

## Phase 3: Deploy Frontend to Vercel

**Create Vercel Account & Deploy:**
1. Go to [vercel.com](https://vercel.com)
2. Sign up (link your GitHub account)
3. Click **Add New...** → **Project**
4. Import your repo `mariolucky82/cre-valuate-pro`
5. Fill in:
   - **Project name:** `cre-valuate-pro-frontend`
   - **Root directory:** `public`

**Add Environment Variables:**
1. Before deploying, go to **Settings → Environment Variables**
2. Add:
   - **Name:** `NEXT_PUBLIC_API_BASE`
   - **Value:** `https://cre-valuate-pro-backend.onrender.com` (your Render backend URL)

**Deploy:**
1. Click **Deploy**
2. Wait for build (1–2 min)
3. Copy your frontend URL: `https://cre-valuate-pro-frontend.vercel.app`

**Update Backend Environment:**
1. Go back to **Render Dashboard**
2. Select your backend service
3. Click **Environment**
4. Update `CLIENT_URL` to your Vercel URL:
   ```
   CLIENT_URL=https://cre-valuate-pro-frontend.vercel.app
   ```
5. Click **Save** (redeploy happens automatically)

---

## Phase 4: Test the Full Flow

### Local Testing (Before Production)

**1. Start Backend Locally:**
```bash
# In repo root
npm install
# Create .env with all variables from Phase 1.3
cp .env.example .env
# Fill in .env with your Stripe test keys
npm start
# Should see: "Server listening on port 4242"
```

**2. Start Frontend Locally:**
```bash
# In another terminal
npx serve public -l 3000
# Frontend: http://localhost:3000
# Backend API: http://localhost:4242
```

**3. Test the Flow:**
- [ ] Login with `test@example.com` / `password`
- [ ] See "Paid: No" in user info
- [ ] Upload a logo (PNG/JPG under 5MB)
  - Should see it displayed
  - Check S3 bucket for file (takes 30 sec)
- [ ] Click **Unlock White-Label Export (Subscribe)**
  - Stripe Checkout opens
  - Use test card: `4242 4242 4242 4242` (any future date, any CVC)
  - Complete checkout
- [ ] You should see "Paid: Yes" on frontend
- [ ] Click **Export Branded Investment Memo (PDF)**
  - PDF downloads with your logo

### Production Testing (On Vercel + Render)

**1. Verify Stripe Webhook:**
```bash
# In terminal with Stripe CLI installed
stripe listen --forward-to https://<your-render-url>/webhook
# Keep this open during testing
```

**2. Test via Vercel URL:**
- Go to `https://cre-valuate-pro-frontend.vercel.app`
- Repeat the flow above
- Check Render logs: `Dashboard → Backend → Logs`
  - Should see: "User 1 marked as paid."

---

## Phase 5: Prepare for Production Data

### Replace In-Memory Store with Database

⚠️ **CRITICAL:** The demo uses `USERS` object in memory. Replace before going live.

**Option A: PostgreSQL (Recommended)**
1. Create a free PostgreSQL DB:
   - [Render PostgreSQL](https://render.com) (free tier available)
   - Or [Supabase](https://supabase.com) (includes auth)
2. Update `server.js`:
   ```javascript
   // Replace USERS object with database queries
   const { Pool } = require('pg');
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL
   });
   ```
3. Create tables:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email VARCHAR(255) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     paid BOOLEAN DEFAULT false,
     logo_key VARCHAR(255),
     created_at TIMESTAMP DEFAULT now()
   );
   ```
4. Add environment variable to Render:
   ```
   DATABASE_URL=postgres://user:pass@host:5432/dbname
   ```

**Option B: MongoDB (Simpler)**
1. Create free MongoDB cluster: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a user and get connection string
3. Add to `.env`:
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
   ```

---

## Phase 6: Security Hardening

Before going fully live with real payment processing:

### 1. Update CORS
In `server.js` line 28:
```javascript
app.use(cors({ 
  origin: process.env.CLIENT_URL  // Only allow your frontend
}));
```

### 2. Hash Passwords
```bash
npm install bcrypt
```
Update login/signup:
```javascript
const bcrypt = require('bcrypt');
// On signup: const hash = await bcrypt.hash(password, 10);
// On login: const valid = await bcrypt.compare(password, user.password_hash);
```

### 3. Switch S3 to Signed URLs (Private)
In `server.js`, replace `ACL: 'public-read'` with signed URL generation:
```javascript
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const url = await getSignedUrl(s3Client, new GetObjectCommand({
  Bucket: S3_BUCKET,
  Key: key
}), { expiresIn: 3600 }); // 1 hour
```

### 4. Input Validation
```bash
npm install joi
```
Validate all `/login`, `/upload-logo`, `/create-checkout-session` requests.

### 5. Rate Limiting
```bash
npm install express-rate-limit
```

### 6. Switch Stripe to Production Keys
Once tested thoroughly:
1. In Stripe Dashboard, get `sk_live_...` key
2. Update `STRIPE_SECRET_KEY` in Render
3. Update `PRICE_ID` to production price

---

## Phase 7: Go Live Checklist

- [ ] Database migrated (not in-memory)
- [ ] Passwords hashed (bcrypt)
- [ ] S3 configured with signed URLs or proper ACL
- [ ] Input validation in place
- [ ] Rate limiting enabled
- [ ] CORS locked to your frontend origin
- [ ] Stripe webhook tested and monitored
- [ ] Backend logs configured (Render provides built-in logging)
- [ ] Error handling: no sensitive data in responses
- [ ] HTTPS enforced (automatic on Render/Vercel)
- [ ] Email verification (optional but recommended)
- [ ] Payment receipts sent to users (optional)
- [ ] Support email configured

---

## Phase 8: Monitoring & Maintenance

### Render Dashboard
- **Logs**: Real-time server logs
- **Metrics**: CPU, memory, requests
- **Alerts**: Set up email alerts for crashes

### Stripe Dashboard
- **Payments**: View all transactions
- **Webhooks**: Monitor webhook delivery (Logs tab)
- **Customers**: Track subscriptions

### Vercel Dashboard
- **Deployments**: See all releases
- **Analytics**: Page views, performance
- **Edge Network**: Monitor CDN

### Recommended Tools
- **Sentry** (error tracking): `npm install @sentry/node`
- **Datadog** or **New Relic** (APM)
- **LogDNA** or **Papertrail** (log aggregation)

---

## Troubleshooting

### Webhook Not Firing
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- Check Render logs for 400 errors
- In Stripe Dashboard, go to Webhooks → your endpoint → view failed deliveries

### S3 Upload Fails
- Verify bucket name matches `S3_BUCKET`
- Check IAM user has `s3:PutObject` permission
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct

### PDF Generation Fails
- Render needs 0.5GB+ RAM (not available on free tier)
- Check browser output in logs: `console.error('PDF generation error'...)`
- Verify Puppeteer deps are installed (included in `package.json`)

### Frontend Can't Reach Backend
- Verify `CLIENT_URL` is set correctly on backend
- Verify `API_BASE` in `public/index.html` points to your Render URL
- Check browser console for CORS errors
- Whitelist Vercel domain in backend CORS

### Login Not Working
- Demo credentials: `test@example.com` / `password`
- These are hardcoded in memory; won't persist after restart
- Migrate to database to add user registration

---

## Support & Next Steps

- **Stripe Docs**: [stripe.com/docs](https://stripe.com/docs)
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **AWS S3 Docs**: [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3)

---

**Good luck launching! 🚀**
