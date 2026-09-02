// lib/upload-cloudinary.js

// Simple Cloudinary upload helper. Works with CLOUDINARY_URL env var.
// Example usage: const result = await uploadBase64Image(base64string, 'uploads/logos')

import cloudinary from 'cloudinary'

cloudinary.v2.config(process.env.CLOUDINARY_URL ? { cloudinary_url: process.env.CLOUDINARY_URL } : {})

export async function uploadBase64Image(base64, folder = 'cre-valuate-logos') {
  if (!base64 || !base64.startsWith('data:')) {
    throw new Error('base64 image expected with data: prefix')
  }

  const result = await cloudinary.v2.uploader.upload(base64, {
    folder,
    resource_type: 'image',
    overwrite: true,
  })

  return {
    url: result.secure_url,
    public_id: result.public_id,
  }
}

export default cloudinary.v2
