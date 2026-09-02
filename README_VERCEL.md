# Vercel-friendly deployment (branch: chore/vercel-deploy-setup)

This branch adapts the project to be easy to deploy on Vercel using Next.js API routes for backend pieces (Stripe webhook, uploads).

Quick start

1. Create a Cloudinary account (optional but recommended for uploads)
2. Set the environment variables listed in DEPLOYMENT.md in your Vercel project
3. Deploy the project on Vercel and configure Stripe webhook to point to /api/stripe-webhook

If anything fails during deploy or you want Supabase/S3 instead of Cloudinary, reply and I'll update the branch.
