Render deployment checklist for cre-valuate-pro

This file helps you deploy the backend to Render and configure Stripe webhooks.

1) Create a new Web Service on Render
   - Go to https://dashboard.render.com/new
   - Choose "Web Service"
   - Connect your GitHub repo and select: mariolucky82/cre-valuate-pro
   - Branch: chore/vercel-deploy-setup (or main if you prefer to deploy the original server.js)
   - Root: leave empty (repo root)
   - Environment: Node
   - Build Command: npm install
   - Start Command: npm start
   - Plan: Standard (recommended for Puppeteer); 1GB memory minimum for Chromium

2) Add Environment Variables (Settings → Environment)
   - STRIPE_SECRET_KEY = sk_test_...
   - PRICE_ID = price_...
   - STRIPE_WEBHOOK_SECRET = (set after you create webhook in Stripe)
   - JWT_SECRET = openssl rand -hex 32
   - CLOUDINARY_URL = cloudinary://<key>:<secret>@<cloud_name>
   - OPTIONAL (if using S3): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET

3) Configure Stripe webhook (Test mode)
   - In Stripe Dashboard → Developers → Webhooks → + Add endpoint
   - URL: https://<your-render-service>.onrender.com/api/stripe-webhook
   - Events to send: checkout.session.completed
   - After creating webhook, copy the Signing secret (whsec_...) and paste it into STRIPE_WEBHOOK_SECRET in Render Environment Variables.

4) Deploy & verify
   - Render auto-deploys after connecting the repo. If not, trigger a manual deploy.
   - Visit: https://<your-render-service>.onrender.com to test the app endpoints
   - Test upload (POST /api/upload-logo) and checkout (POST /api/create-checkout-session)

Notes on Puppeteer
   - If your app uses Puppeteer for PDF generation, Render's Standard instances are recommended.
   - If Puppeteer fails to launch Chromium, increase memory to 2GB and check build logs for Chromium download errors.

Local testing
   - You can run locally with: npm install && npm start
   - For testing Stripe webhooks locally, use a tunneling tool (ngrok) and add the ngrok URL to Stripe webhook settings.
