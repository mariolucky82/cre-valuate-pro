// pages/success.js

import Link from 'next/link'

export default function SuccessPage() {
  return (
    <div style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'sans-serif' }}>
      <h1>Payment successful 🎉</h1>
      <p>Thank you for subscribing. Your subscription is now active.</p>
      <p>
        <Link href="/">
          <a>Back to app</a>
        </Link>
      </p>
    </div>
  )
}
