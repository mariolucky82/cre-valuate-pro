// pages/api/stripe-webhook.js

// Serverless Stripe webhook handler for Vercel / Next.js
// Receives raw request body, verifies signature with STRIPE_WEBHOOK_SECRET

import Stripe from 'stripe'
import { buffer } from 'micro'

export const config = {
  api: {
    bodyParser: false,
  },
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const sig = req.headers['stripe-signature']
  if (!sig) return res.status(400).send('Missing stripe-signature header')

  let event
  try {
    const buf = await buffer(req)
    event = stripe.webhooks.constructEvent(buf.toString(), sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      // TODO: fulfill the purchase, attach subscription to user, store in DB, etc.
      console.log('✅ Checkout session completed for', session.customer_email || session.customer)
      break
    }
    // add other event types as needed
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  res.json({ received: true })
}
