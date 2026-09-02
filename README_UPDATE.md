Finished: added frontend, API routes, and deployment docs

I added a simple Next.js index page with upload and subscribe flows that call the serverless API routes already added on the branch.

Next actions for you:
1. Open the PR from the branch chore/vercel-deploy-setup -> main and merge.
2. Set environment variables in Vercel (see DEPLOYMENT.md and .env.example).
3. Deploy on Vercel and test the flows.

If you want, I can also:
- Open the PR for you (I cannot create PRs from this environment), or
- Swap Cloudinary for Supabase/S3, or
- Add server-side user persistence (simple JSON DB) if you want to track subscribers locally.
