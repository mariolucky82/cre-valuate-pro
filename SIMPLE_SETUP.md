# ⚡ Ultra-Simple Setup Guide (Copy-Paste Ready)

Follow these exact steps. It takes **15 minutes**.

---

## 🔴 STEP 1: Stripe Setup (5 min)

### Click here to start:
https://dashboard.stripe.com/register

### What to do:
1. **Email:** Enter your email
2. **Password:** Create a password
3. **Name:** Enter your name
4. Click **Create account**
5. Verify email (check inbox)

### After you're logged in:
1. Left sidebar → Click **Developers**
2. Click **API Keys**
3. You'll see a box that says "Secret Key"
4. Click **Reveal test key** (blue button)
5. **Copy** the long code (starts with `sk_test_`)
6. **Paste it here for now:**

```
YOUR STRIPE SECRET KEY:
________________________
```

---

## Create a Product (2 min)

Still in Stripe Dashboard:

1. Left sidebar → Click **Products**
2. Click **+ Add product** (blue button)
3. **Name:** Type: `CRE Valuate Pro`
4. **Type:** Select "Service"
5. Scroll down → **Price:** Type: `29`
6. **Recurring:** Select "Monthly"
7. Click **Add product**
8. Wait for page to load
9. Copy the **Price ID** (starts with `price_`)

```
YOUR PRICE ID:
________________________
```

---

## Create Webhook (1 min)

1. Left sidebar → Click **Developers**
2. Click **Webhooks**
3. Click **+ Add endpoint** (blue button)
4. **URL:** Type: `https://example.com/webhook`
   - (Don't worry, we'll fix this later)
5. Under "Events to send," search for and select: `checkout.session.completed`
6. Click **Add endpoint**
7. On the next page, click **Reveal** (next to "Signing secret")
8. Copy the secret (starts with `whsec_`)

```
YOUR WEBHOOK SECRET:
________________________
```

---

## ✅ You're Done with Stripe!

**Save these 3 things somewhere safe:**
```
STRIPE_SECRET_KEY = sk_test_...
PRICE_ID = price_...
STRIPE_WEBHOOK_SECRET = whsec_...
```

**Reply: "Stripe done" → I'll guide you to AWS**

---

## 🟠 STEP 2: AWS S3 Setup (5 min)

### Click here to start:
https://console.aws.amazon.com/console/home

### What to do:
1. Click **Create a new AWS account**
2. **Email:** Enter your email
3. **Password:** Create password
4. **AWS account name:** Type: `cre-valuate-pro`
5. Agree to terms
6. Click **Continue**
7. Add credit card (required, won't charge yet)
8. Verify phone number (they'll call)

### After logged in:

1. Search box at top → Type: `S3`
2. Click **S3** (first result)
3. Click **Create bucket** (orange button)
4. **Bucket name:** Type: `cre-valuate-logos` (must be unique globally, so add your name or random numbers)
   - Example: `cre-valuate-logos-mario123`
5. **Region:** Select `us-east-1`
6. Scroll down → Find **Block Public Access**
7. **Uncheck** all boxes (we need public upload)
8. Click **Create bucket**

### Create AWS User for the App:

1. Search box → Type: `IAM`
2. Click **IAM** (Identity and Access Management)
3. Left sidebar → Click **Users**
4. Click **Create user** (button)
5. **Username:** Type: `cre-valuate-app`
6. Click **Next**
7. Click **Attach policies directly**
8. Search: `AmazonS3FullAccess`
9. Check the box next to it
10. Click **Next** → **Create user**
11. Click your new user name
12. Click **Security credentials** tab
13. Click **Create access key**
14. Select **Application running outside AWS**
15. Click **Next**
16. Click **Create access key**
17. **Copy both:**

```
ACCESS KEY ID:
________________________

SECRET ACCESS KEY:
________________________
```

---

## ✅ You're Done with AWS!

**Save these:**
```
AWS_ACCESS_KEY_ID = AKIA...
AWS_SECRET_ACCESS_KEY = ...
S3_BUCKET = cre-valuate-logos-yourname
AWS_REGION = us-east-1
```

**Reply: "AWS done" → I'll guide you to Render**

---

## 🔵 STEP 3: Render Setup (3 min)

### Click here to start:
https://dashboard.render.com

### What to do:
1. Click **Sign up**
2. Click **Continue with GitHub**
3. Authorize Render to access your GitHub
4. Verify email

### After logged in:

1. Click **+ New**
2. Click **Web Service**
3. Select your repo: `mariolucky82/cre-valuate-pro`
4. Fill in:
   - **Name:** `cre-valuate-pro-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Select "Paid" (Puppeteer needs resources)

### Add Environment Variables:

Scroll down to **Environment Variables**

Click **Add Environment Variable** and add these one by one:

```
PORT = 4242
STRIPE_SECRET_KEY = sk_test_... (paste from Stripe)
PRICE_ID = price_... (paste from Stripe)
STRIPE_WEBHOOK_SECRET = whsec_... (paste from Stripe)
JWT_SECRET = (we'll generate this - use: openssl rand -hex 32)
CLIENT_URL = https://localhost:3000 (temporary, we'll update later)
AWS_REGION = us-east-1
AWS_ACCESS_KEY_ID = AKIA... (paste from AWS)
AWS_SECRET_ACCESS_KEY = ... (paste from AWS)
S3_BUCKET = cre-valuate-logos-yourname (paste from AWS)
```

5. Click **Create Web Service**
6. Wait 5-10 minutes for deployment
7. Copy the URL (looks like: `https://cre-valuate-pro-backend.onrender.com`)

```
YOUR RENDER BACKEND URL:
________________________
```

---

## ✅ You're Done with Render!

**Reply: "Render done" → I'll guide you to Vercel**

---

## 💚 STEP 4: Vercel Setup (2 min)

### Click here to start:
https://vercel.com

### What to do:
1. Click **Sign Up**
2. Click **Continue with GitHub**
3. Authorize Vercel
4. Verify email

### After logged in:

1. Click **Add New**
2. Click **Project**
3. Select your repo: `mariolucky82/cre-valuate-pro`
4. **Root Directory:** Change from `.` to `public`
5. Click **Environment Variables**
6. Add:
   - **Name:** `NEXT_PUBLIC_API_BASE`
   - **Value:** `https://cre-valuate-pro-backend.onrender.com` (your Render URL from above)
7. Click **Deploy**
8. Wait 1-2 minutes
9. Copy your Vercel URL (looks like: `https://cre-valuate-pro-frontend.vercel.app`)

```
YOUR VERCEL FRONTEND URL:
________________________
```

---

## ✅ You're Done with Vercel!

---

## 🔧 FINAL STEP: Link Everything Together (2 min)

1. Go back to **Render Dashboard**
2. Click your backend service
3. Click **Environment** (settings)
4. Find `CLIENT_URL`
5. Change it to your Vercel URL (from above)
6. Click **Save**
7. Render will auto-redeploy

---

## ✅ YOU'RE LIVE!

Go to your Vercel URL and test:

1. Login: `test@example.com` / `password`
2. Upload a logo
3. Click **Subscribe**
4. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
5. Click **Export PDF**

If it works, **you're officially live!** 🎉

---

## 🆘 Stuck?

Reply with:
- What step you're on
- What error you see
- I'll help you fix it

**Let's go!** 🚀
