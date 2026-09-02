import { useState } from 'react'

export default function Home() {
  const [email, setEmail] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [error, setError] = useState(null)

  const onFileChange = (e) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const upload = async () => {
    if (!file) return alert('Pick a file first')
    setUploading(true)
    setError(null)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const imageBase64 = reader.result
        const res = await fetch('/api/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64 }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Upload failed')
        setLogoUrl(json.url)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const startCheckout = async () => {
    setError(null)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.url) {
        window.location = data.url
        return
      }
      if (data.id && window.Stripe) {
        const stripe = window.Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE)
        await stripe.redirectToCheckout({ sessionId: data.id })
        return
      }
      setError('No checkout url returned')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '48px auto' }}>
      <h1>CRE Valuate Pro — Demo</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>Upload logo</h2>
        <input type="file" accept="image/*" onChange={onFileChange} />
        <button onClick={upload} disabled={uploading} style={{ marginLeft: 8 }}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        {logoUrl && (
          <div style={{ marginTop: 12 }}>
            <p>Uploaded logo:</p>
            <img src={logoUrl} alt="logo" style={{ maxWidth: '100%', height: 'auto', border: '1px solid #eee' }} />
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Subscribe</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={startCheckout} style={{ marginLeft: 8 }}>Subscribe $29 / month</button>
      </section>

      {error && (
        <div style={{ color: 'crimson', marginTop: 16 }}>Error: {error}</div>
      )}

      <footer style={{ marginTop: 48, color: '#666' }}>
        <p>Use Stripe test card 4242 4242 4242 4242 (any date / cvc).</p>
      </footer>
    </div>
  )
}
