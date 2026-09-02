// pages/cancel.js

import Link from 'next/link'

export default function CancelPage() {
  return (
    <div style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'sans-serif' }}>
      <h1>Payment canceled</h1>
      <p>Your payment was canceled. You can try again when ready.</p>
      <p>
        <Link href="/">
          <a>Back to app</a>
        </Link>
      </p>
    </div>
  )
}
