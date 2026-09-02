// pages/api/upload-logo.js

// Accepts JSON: { imageBase64: 'data:image/png;base64,...' }
// Returns { url, public_id }

import { uploadBase64Image } from '../../lib/upload-cloudinary'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' })

    const result = await uploadBase64Image(imageBase64, 'cre-valuate-logos')
    return res.status(200).json(result)
  } catch (err) {
    console.error('upload-logo error', err)
    return res.status(500).json({ error: err.message })
  }
}
