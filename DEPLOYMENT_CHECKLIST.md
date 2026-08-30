# CRE Valuate Pro — Deployment Checklist

Complete this checklist to go from code to production.

---

## Pre-Deployment (Local Setup)

- [ ] Clone repo locally
- [ ] Run `npm install`
- [ ] Copy `.env.example` to `.env`
- [ ] Test locally:
  - [ ] `npm start` (backend on port 4242)
  - [ ] `npx serve public -l 3000` (frontend)
  - [ ] Login with `test@example.com` / `password`
  - [ ] Upload logo
  - [ ] Create checkout session (test card: 4242 4242 4242 4242)
  - [ ] Generate PDF

---

## External Service Setup

### Stripe
- [ ] Create Stripe account at [stripe.com](https://stripe.com)
- [ ] Create Product in Stripe Dashboard
- [ ] Create Price for the product
- [ ] Copy **Secret Key** (starts with `sk_test_`)
- [ ] Create Webhook endpoint (don't set URL yet, you'll know it after Render deploy)
- [ ] Copy **Webhook Secret** (starts with `whsec_`)

### AWS S3
- [ ] Create AWS account at [aws.amazon.com](https://aws.amazon.com)
- [ ] Create S3 bucket (name must be globally unique, e.g., `cre-valuate-pro-logos-xyz`)
- [ ] **Uncheck** "Block Public Access" (for public-read ACL)
- [ ] Create IAM User:
  - [ ] Username: `cre-valuate-pro-app`
  - [ ] Attach: `AmazonS3FullAccess` (or custom policy for your bucket)
  - [ ] Generate Access Key
  - [ ] Copy **Access Key ID** and **Secret Access Key**

### Generate Secrets
- [ ] Generate JWT Secret: `openssl rand -hex 32` (save the output)
- [ ] Save all credentials in a secure location

---

## Backend Deployment (Render)

- [ ] Create account at [render.com](https://render.com)
- [ ] Connect GitHub account
- [ ] Create **Web Service**:
  - [ ] Link `mariolucky82/cre-valuate-pro` repo
  - [ ] **Name:** `cre-valuate-pro-backend`
  - [ ] **Environment:** `Node`
  - [ ] **Build command:** `npm install`
  - [ ] **Start command:** `npm start`
  - [ ] **Plan:** Paid (Puppeteer requires 0.5GB+ RAM)
- [ ] Add **Environment Variables:**
  - [ ] `PORT=4242`
  - [ ] `STRIPE_SECRET_KEY=sk_test_...`
  - [ ] `PRICE_ID=price_...`
  - [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` (temp placeholder, update after Vercel deploy)
  - [ ] `JWT_SECRET=<your-random-hex>`
  - [ ] `CLIENT_URL=http://localhost:3000` (temp, update after Vercel deploy)
  - [ ] `AWS_REGION=us-east-1`
  - [ ] `AWS_ACCESS_KEY_ID=AKIA...`
  - [ ] `AWS_SECRET_ACCESS_KEY=...`
  - [ ] `S3_BUCKET=cre-valuate-pro-logos-xyz`
- [ ] Click **Create Web Service**
- [ ] Wait for deployment (5–10 min)
- [ ] **Copy backend URL** (e.g., `https://cre-valuate-pro-backend.onrender.com`)
- [ ] **Update Stripe webhook:**
  - [ ] Go to Stripe Dashboard → Webhooks → your endpoint
  - [ ] Change URL to `https://<your-render-url>/webhook`

---

## Frontend Deployment (Vercel)

- [ ] Create account at [vercel.com](https://vercel.com)
- [ ] Connect GitHub account
- [ ] **Add New Project:**
  - [ ] Import `mariolucky82/cre-valuate-pro`
  - [ ] **Root Directory:** `public`
  - [ ] **Environment Variables:**
    - [ ] `NEXT_PUBLIC_API_BASE=https://cre-valuate-pro-backend.onrender.com`
- [ ] Click **Deploy**
- [ ] Wait for deployment (1–2 min)
- [ ] **Copy frontend URL** (e.g., `https://cre-valuate-pro-frontend.vercel.app`)
- [ ] **Update backend environment:**
  - [ ] Go to Render Dashboard
  - [ ] Select backend service
  - [ ] **Environment Variables** → Edit `CLIENT_URL`
  - [ ] Set to your Vercel URL
  - [ ] Save (triggers auto-redeploy)

---

## Post-Deployment Testing

- [ ] **Test Frontend URL:**
  - [ ] Navigate to `https://<your-vercel-url>`
  - [ ] Login with `test@example.com` / `password`
  - [ ] See "Paid: No" status
  - [ ] Upload logo
  - [ ] Check S3 bucket for uploaded file
  - [ ] Click **Subscribe**
  - [ ] Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
  - [ ] Complete checkout
  - [ ] See "Paid: Yes" on frontend
  - [ ] Click **Export PDF**
  - [ ] Verify PDF downloads with your logo

- [ ] **Test Webhook:**
  - [ ] Install Stripe CLI: [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
  - [ ] Run: `stripe listen --forward-to https://<your-render-url>/webhook`
  - [ ] Trigger test event: `stripe trigger checkout.session.completed`
  - [ ] Check Render logs for "User X marked as paid"

- [ ] **Check Render Logs:**
  - [ ] Go to [Render Dashboard](https://dashboard.render.com)
  - [ ] Select backend service
  - [ ] Click **Logs**
  - [ ] Verify no error messages

---

## Production Hardening (Before Going Live)

- [ ] Replace in-memory user store with database:
  - [ ] Add PostgreSQL to Render (free tier available)
  - [ ] Run `db-setup.sql` on database
  - [ ] Switch to `server-enhanced.js` (or merge with `server.js`)
  - [ ] Add `DATABASE_URL` to environment variables
  - [ ] Test login/subscribe flow
  
- [ ] Hash passwords:
  - [ ] Update user registration/login to use bcrypt
  - [ ] Hash any existing demo passwords

- [ ] Enable input validation:
  - [ ] `npm install joi`
  - [ ] Validate all POST requests

- [ ] Add rate limiting:
  - [ ] `npm install express-rate-limit`
  - [ ] Limit login attempts
  - [ ] Limit API calls

- [ ] Secure S3 storage:
  - [ ] Replace `public-read` ACL with signed URLs
  - [ ] Only allow authenticated users to access logos

- [ ] Lock CORS:
  - [ ] In `server.js`, verify `CLIENT_URL` matches your frontend

- [ ] Switch Stripe to Production:
  - [ ] Get `sk_live_...` key from Stripe Dashboard
  - [ ] Update `STRIPE_SECRET_KEY` in Render
  - [ ] Update `PRICE_ID` to production price
  - [ ] Update webhook secret if needed

- [ ] Enable logging/monitoring:
  - [ ] `npm install @sentry/node` (error tracking)
  - [ ] Or use Datadog/New Relic
  - [ ] Set up email alerts in Render/Vercel

---

## Go Live

- [ ] All checklist items above are complete
- [ ] Tested with real payment flow (test mode)
- [ ] Database is persistent (not in-memory)
- [ ] Error handling is robust
- [ ] Support email is set up
- [ ] Have a backup plan/runbook for issues
- [ ] **Switch Stripe to production mode** ← **THIS ENABLES REAL PAYMENTS**

---

## Monitoring (Ongoing)

- [ ] Check Render logs daily for errors
- [ ] Monitor Stripe Dashboard for failed payments
- [ ] Track S3 storage usage
- [ ] Check Vercel analytics for frontend performance
- [ ] Set up PagerDuty/Slack alerts for critical errors

---

## Rollback Plan

If something breaks in production:

1. **Frontend:** 
   - Go to Vercel Dashboard → Deployments
   - Click the previous green deployment → **Promote to Production**
   - Takes 1–2 seconds

2. **Backend:**
   - Go to Render Dashboard → your service → Logs
   - Identify the bad commit
   - Push a fix or revert commit
   - Render auto-redeploys

3. **Database:**
   - Keep SQL backups of production data
   - Use AWS RDS snapshots if available

---

## Support

- **Render Docs:** [render.com/docs](https://render.com/docs)
- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Stripe Docs:** [stripe.com/docs](https://stripe.com/docs)
- **AWS S3 Docs:** [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3)

---

**Status:** ⏳ In Progress

Use this to track your launch!
