# Pull request: chore: add Vercel deployment helpers (stripe webhook, cloudinary upload)

This PR adds serverless helpers and documentation to make deploying the project to Vercel quick and easy.

What changed:
- pages/api/stripe-webhook.js  — Stripe webhook handler (verifies signature)
- lib/stripe.js               — helper to create Checkout sessions
- lib/upload-cloudinary.js    — Cloudinary upload helper
- vercel.json                 — Vercel functions config
- DEPLOYMENT.md               — Vercel deployment checklist
- README_VERCEL.md            — Vercel notes

How to test:
1. Import the repo into Vercel and set env vars listed in DEPLOYMENT.md
2. Configure Stripe webhook to point to /api/stripe-webhook
3. Deploy and test checkout / upload flows in test mode

Note: secrets should be set in Vercel UI — do NOT commit them to the repository.
