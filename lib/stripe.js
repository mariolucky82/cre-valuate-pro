// lib/stripe.js

// Small helper wrapper around stripe usage. Import in API routes or server code.

import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })

export async function createCheckoutSession({ successUrl, cancelUrl, customerEmail, metadata = {} }) {
  if (!process.env.PRICE_ID) throw new Error('Missing PRICE_ID env var')

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.PRICE_ID, quantity: 1 }],
    subscription_data: {
      metadata,
    },
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return session
}

export default stripe
