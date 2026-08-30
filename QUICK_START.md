# CRE Valuate Pro — Quick Start (5 Minutes)

Follow this if you just want to get everything deployed **right now**. For detailed instructions, see [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md).

---

## ⚡ Step 1: Collect Your Credentials (15 min)

### Stripe
1. Go to [stripe.com](https://stripe.com), sign up
2. **Dashboard → Developers → API Keys** → Copy `Secret Key` (starts with `sk_test_`)
3. **Products** → Create product → Set price → Copy `Price ID` (starts with `price_`)
4. **Developers → Webhooks** → Add endpoint:
   - URL: `https://<your-backend>.onrender.com/webhook` (you'll know this after step 2)
   - Events: `checkout.session.completed`
   - Copy `Webhook Secret` (starts with `whsec_`)

### AWS S3
1. Go to [aws.amazon.com](https://aws.amazon.com), sign up
2. **S3 → Create bucket** → Name: `cre-valuate-pro-logos-xyz` (make it unique) → Uncheck "Block Public Access"
3. **IAM → Users** → Create user `cre-valuate-pro-app` → Attach `AmazonS3FullAccess` → Create Access Key → **Save both keys**

### JWT Secret
```bash
openssl rand -hex 32
# Copy the output
```

**Keep these handy:**
```
STRIPE_SECRET_KEY = sk_test_...
PRICE_ID = price_...
STRIPE_WEBHOOK_SECRET = whsec_...
AWS_ACCESS_KEY_ID = AKIA...
AWS_SECRET_ACCESS_KEY = ...
S3_BUCKET = cre-valuate-pro-logos-xyz
JWT_SECRET = (your random hex)
CLIENT_URL = (you'll fill this after Vercel deploy)
```

---

## ⚡ Step 2: Deploy Backend to Render (5 min)

1. Go to [render.com](https://render.com), sign up, connect GitHub
2. **+ New → Web Service** → Select `mariolucky82/cre-valuate-pro`
3. Fill in:
   - **Name:** `cre-valuate-pro-backend`
   - **Environment:** `Node`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Plan:** Paid (Puppeteer needs resources)
4. **Environment Variables** → Add all from Step 1
5. Click **Create Web Service**
6. Wait 5–10 min for deploy
7. **Copy your backend URL** (e.g., `https://cre-valuate-pro-backend.onrender.com`)

---

## ⚡ Step 3: Deploy Frontend to Vercel (2 min)

1. Go to [vercel.com](https://vercel.com), sign up, connect GitHub
2. **Add New → Project** → Select `mariolucky82/cre-valuate-pro`
3. **Root Directory:** `public`
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_BASE` = `https://cre-valuate-pro-backend.onrender.com`
5. Click **Deploy**
6. Wait 1–2 min
7. **Copy your frontend URL** (e.g., `https://cre-valuate-pro-frontend.vercel.app`)

---

## ⚡ Step 4: Update Backend with Frontend URL (1 min)

1. Go back to [Render Dashboard](https://dashboard.render.com)
2. Select your backend service
3. **Environment** → Edit `CLIENT_URL`
4. Set to your Vercel URL (from Step 3)
5. Save (auto-redeploy)

---

## ⚡ Step 5: Test It (2 min)

Go to your Vercel frontend URL:
- Login: `test@example.com` / `password`
- Upload logo (PNG/JPG)
- Click **Subscribe** → Use test card `4242 4242 4242 4242`
- Click **Export PDF** → Should download with your logo

✅ **Done!**

---

## 🔗 Your Live Links

- **Frontend:** `https://your-vercel-url.vercel.app`
- **Backend:** `https://your-render-url.onrender.com`
- **Stripe Dashboard:** [dashboard.stripe.com](https://dashboard.stripe.com)
- **Render Logs:** [dashboard.render.com](https://dashboard.render.com)
- **Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)

---

## ⚠️ Next: Production Hardening (Optional but Recommended)

See [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md) **Phase 5 onwards** for:
- Replace in-memory user store with a database
- Hash passwords with bcrypt
- Enable rate limiting
- Use signed S3 URLs
- Switch to Stripe production keys

---

## 🆘 Troubleshooting

**Frontend can't reach backend:**
- Check `NEXT_PUBLIC_API_BASE` in Vercel env vars
- Verify Render backend is running (check logs)
- Check CORS in Render logs

**Stripe webhook not working:**
- Verify webhook endpoint URL matches your Render backend
- Check Stripe Dashboard → Webhooks → your endpoint → Logs

**PDF generation fails:**
- Render free tier has 0.5GB RAM (not enough for Puppeteer)
- Upgrade to Paid plan or use a different renderer

**S3 upload fails:**
- Check IAM user has `s3:PutObject` permission
- Verify bucket name in env var matches actual bucket
- Check AWS credentials are correct

---

**Questions?** See [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md) for full details.
