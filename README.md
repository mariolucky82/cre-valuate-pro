# CRE Valuate Pro — Backend

This repo contains a demo Express backend (server.js) for the CRE Valuate Pro demo. The server includes:

- JWT demo auth (in-memory user store)
- Stripe Checkout session creation and webhook handling
- Server-side uploads to S3
- PDF generation with Puppeteer

This project is intended as a demo. Do not use defaults (in-memory users, public S3 ACL, weak secrets) in production.

Quick start
1. Copy `.env.example` to `.env` and fill in the values.
2. Install dependencies:

   npm install

3. Run locally:

   npm start

   For development with auto-reload:

   npm run dev

Health check
GET http://localhost:4242/

Login (demo user)
POST /login
Content-Type: application/json
Body: { "email":"test@example.com", "password":"password" }

Protected endpoints
- GET /me — returns user info
- POST /upload-logo — multipart/form-data: field `logo` (requires AWS creds & S3_BUCKET)
- POST /create-checkout-session — creates Stripe Checkout session
- POST /webhook — Stripe webhook endpoint (requires raw body; use Stripe CLI to forward events)
- GET /generate-pdf — generates a PDF (requires user to be marked as paid)

Testing Stripe webhooks locally
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run:

   stripe listen --forward-to localhost:4242/webhook

3. Trigger: `stripe trigger checkout.session.completed` (or create an actual Checkout session and complete it).

Notes & recommended production changes
- Replace the in-memory USERS map with a real database.
- Use strong JWT secrets and rotate them.
- Use presigned uploads or private S3 objects instead of public-read ACL.
- Validate and sanitize all user inputs and uploaded files.
- Add rate limiting, logging, monitoring, and proper error handling.

If you'd like, I can:
- Convert the upload flow to use pre-signed URLs
- Swap the in-memory user store for a small SQLite or Postgres example
- Add CI or a Dockerfile for deployment

