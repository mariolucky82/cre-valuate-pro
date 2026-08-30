# CRE Valuate Pro — Render + Vercel demo (S3 storage)

This repository contains a demo backend and static frontend to support:
- Stripe Checkout (monthly subscription) to unlock white-labeled PDF exports
- S3 logo uploads (server uploads to S3)
- Puppeteer server-side PDF generation (protected by subscription)

Important: This is a demo scaffold. Replace the in-memory user store with a real DB before production.

## Repo layout
- /server (root files shown here)
  - server.js
  - package.json
- /public
  - index.html (static client)

## Setup (local / quick test)
1. Install:
   npm install

2. Copy `.env.example` to `.env` and fill in values:
   - STRIPE_SECRET_KEY (test)
   - PRICE_ID (create a Product + Price in Stripe)
   - STRIPE_WEBHOOK_SECRET (set after creating webhook)
   - JWT_SECRET
   - AWS credentials and S3_BUCKET (create bucket and allow PutObject + GetObject; demo uses public-read ACL)

3. Start server:
   npm start
   Server listens on port specified by PORT (default 4242).

4. Serve client (public) locally:
   npx serve public -l 3000
   Set CLIENT_URL to http://localhost:3000 in .env for local dev.

## Deploy (recommended)
We recommend:
- Backend: Render (or Railway) — handles long-running processes and Puppeteer well.
- Frontend: Vercel — static hosting.

### Backend (Render)
- Create a Web Service on Render from this repo, set root to `/` or `/server` depending on structure.
- Build command: `npm install`
- Start command: `npm start`
- Set env vars in Render dashboard (all keys from `.env.example`).
- Deploy.

### Frontend (Vercel)
- Create a new project in Vercel from this repo, set Root Directory = `public`.
- Set environment variable `NEXT_PUBLIC_API_BASE` or update client code to point to the backend URL if needed.
- Deploy.

### Stripe webhook
- In Stripe Dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://<your-backend-url>/webhook`
  - Events: `checkout.session.completed`
- Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET` on Render.

## Testing with Stripe CLI
- Install Stripe CLI
- Forward events to your backend:
  stripe listen --forward-to https://<your-backend-url>/webhook
- Trigger a test event:
  stripe trigger checkout.session.completed

## Demo credentials
- Email: test@example.com
- Password: password

## Production notes & security
- Replace in-memory USERS with a real database and persist subscription state.
- For logos, consider signed GET URLs (private S3 + CloudFront) instead of public-read ACL.
- Verify webhook signatures (already implemented).
- Limit CORS to your frontend origin.
- Add input validation, rate limiting, logging, and monitoring.
- Use HTTPS everywhere (Render/Vercel provide HTTPS by default).
