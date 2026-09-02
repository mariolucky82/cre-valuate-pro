// pages/api/create-checkout-session.js

import { createCheckoutSession } from '../../lib/stripe'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const { email } = req.body || {}

    const host = process.env.NEXT_PUBLIC_API_BASE || `https://${req.headers.host}`
    const successUrl = `${host}/success`
    const cancelUrl = `${host}/cancel`

    const session = await createCheckoutSession({
      successUrl,
      cancelUrl,
      customerEmail: email,
    })

    // For Checkout, Stripe provides session.url in many setups. If not, return session.id
    return res.status(200).json({ url: session.url || null, id: session.id })
  } catch (err) {
    console.error('create-checkout-session error', err)
    return res.status(500).json({ error: err.message })
  }
}
