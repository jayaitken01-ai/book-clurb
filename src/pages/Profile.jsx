import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { Avatar, Section, Spinner, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ finished: 0, rated: 0, theories: 0 })
  const fileRef = useRef(null)
  const [toast, showToast] = useToast()

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || user?.email || '',
        bio: profile.bio || '',
      })
    }
  }, [profile, user])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [fin, rat, th] = await Promise.all([
        supabase.from('reading_progress').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('finished', true),
        supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('theory_threads').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])
      setStats({ finished: fin.count ?? 0, rated: rat.count ?? 0, theories: th.count ?? 0 })
    })()
  }, [user])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        bio: form.bio.trim() || null,
      })
      .eq('id', user.id)
    setBusy(false)
    if (error) return setError(error.message)
    await refreshProfile()
    showToast('Saved')
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('That picture is over 5 MB — try a smaller one.')
      return
    }
    setUploading(true)
    setError(null)

    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (upErr) {
      setUploading(false)
      return setError(upErr.message)
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('id', user.id)

    setUploading(false)
    if (dbErr) return setError(dbErr.message)
    await refreshProfile()
    showToast('New photo saved')
  }

  if (!form) return <Spinner />

  return (
    <div className="page">
      {toast}
      <h1>My profile</h1>

      <div className="card">
        <div className="row" style={{ gap: 16, marginBottom: 18 }}>
          <Avatar profile={profile} size={84} />
          <div>
            <button
              className="btn-soft btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Icon name="camera" size={15} /> {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <p className="muted tiny" style={{ margin: '7px 0 0' }}>JPG or PNG, under 5 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={save}>
          <div className="field">
            <label>Name</label>
            <input value={form.full_name} onChange={set('full_name')} required />
          </div>
          <div className="field">
            <label>Phone number</label>
            <input value={form.phone} onChange={set('phone')} type="tel" placeholder="(647) 555-0123" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} type="email" />
          </div>
          <div className="field">
            <label>About me</label>
            <textarea
              value={form.bio}
              onChange={set('bio')}
              placeholder="Fantasy girlie. Will cry at chapter 30."
              style={{ minHeight: 70 }}
            />
          </div>
          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <Section icon="sparkle">My stats</Section>
      <div className="grid-3">
        <div className="stat"><b>{stats.finished}</b><span>books finished</span></div>
        <div className="stat"><b>{stats.rated}</b><span>books reviewed</span></div>
        <div className="stat"><b>{stats.theories}</b><span>threads started</span></div>
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <Link to="/members" className="btn btn-soft btn-block"><Icon name="users" size={16} /> See all members</Link>
        <button className="btn-ghost" onClick={signOut}><Icon name="exit" size={16} /> Sign out</button>
      </div>
    </div>
  )
}
