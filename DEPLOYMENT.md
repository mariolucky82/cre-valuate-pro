Vercel deployment checklist for cre-valuate-pro

This branch (chore/vercel-deploy-setup) adds serverless helpers so you can deploy the app on Vercel with minimal manual work.

Steps to deploy on Vercel

1) Import repo into Vercel
   - Go to https://vercel.com/new
   - Select GitHub and choose the repo: mariolucky82/cre-valuate-pro
   - Set Root Directory to: public

2) Add Environment Variables (Project Settings → Environment Variables)
   - STRIPE_SECRET_KEY = sk_test_...
   - PRICE_ID = price_...
   - STRIPE_WEBHOOK_SECRET = whsec_...
   - JWT_SECRET = (generate with: openssl rand -hex 32)
   - CLOUDINARY_URL = (from Cloudinary dashboard: cloudinary://...)
   - NEXT_PUBLIC_API_BASE = https://<your-vercel-url>
   - OPTIONAL: If you still use S3, add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET

3) Configure Stripe webhook
   - In Stripe Dashboard (Test mode) → Developers → Webhooks → + Add endpoint
   - URL: https://<your-vercel-url>/api/stripe-webhook
   - Events to send: checkout.session.completed
   - Copy the Signing secret and paste it to STRIPE_WEBHOOK_SECRET env var

4) Deploy
   - Trigger a deployment on Vercel (the import will deploy automatically)
   - After deploy completes, set NEXT_PUBLIC_API_BASE to the production URL if needed

What I added

- pages/api/stripe-webhook.js  — serverless webhook for Stripe signature verification
- lib/stripe.js               — helper to create Checkout sessions
- lib/upload-cloudinary.js    — helper for uploading base64 images to Cloudinary
- vercel.json                 — Vercel config for functions
- DEPLOYMENT.md               — this file

Notes

- I implemented Cloudinary because it's the simplest replacement for S3 for a small utility app. If you prefer Supabase or keeping S3, tell me and I will update the helpers.
- Do NOT commit secret keys to the repo. Add them in Vercel's Environment Variables UI only.
