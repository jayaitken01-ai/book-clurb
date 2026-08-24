import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Auth() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { full_name: form.full_name.trim(), phone: form.phone.trim() },
          },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Check your email for a confirmation link, then come back and sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        })
        if (error) throw error
      }
    } catch (err) {
      // Supabase's wording for this one confuses people, so say it plainly.
      const already = /already registered|already exists|User already/i.test(err.message)
      setError(
        already
          ? 'That email already has an account — switch to Sign in instead. (Forgotten the password? Ask whoever set the club up to reset it in Supabase.)'
          : err.message
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420, paddingTop: 48 }}>
      <div className="center" style={{ marginBottom: 22 }}>
        <div style={{ fontSize: '3.2rem', lineHeight: 1 }}>📚💕</div>
        <h1 style={{ marginTop: 10, marginBottom: 4 }}>All Booked Up</h1>
        <p className="hand" style={{ fontSize: '1.32rem' }}>
          our little corner for books, theories &amp; chaos
        </p>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 16, gap: 6 }}>
          <button
            className={mode === 'signin' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            style={{ flex: 1 }}
            onClick={() => { setMode('signin'); setError(null) }}
          >
            Sign in
          </button>
          <button
            className={mode === 'signup' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            style={{ flex: 1 }}
            onClick={() => { setMode('signup'); setError(null) }}
          >
            Join the club
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}
        {notice && <div className="pill pill-mint" style={{ marginBottom: 12 }}>{notice}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>Your name</label>
                <input value={form.full_name} onChange={set('full_name')} placeholder="Your name" required />
              </div>
              <div className="field">
                <label>Phone number</label>
                <input value={form.phone} onChange={set('phone')} placeholder="(647) 555-0123" type="tel" />
              </div>
            </>
          )}

          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} type="email" placeholder="you@email.com" required />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              value={form.password}
              onChange={set('password')}
              type="password"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button className="btn-primary btn-block" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? 'One sec…' : mode === 'signup' ? 'Create my profile' : 'Let me in'}
          </button>
        </form>
      </div>

      <p className="muted tiny center" style={{ marginTop: 16 }}>
        You can add a profile picture right after you sign in.
      </p>
    </div>
  )
}
