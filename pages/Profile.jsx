import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { Avatar, MONTHS, Section, Spinner, monthYear, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { ACCENTS, MODES, applyTheme } from '../lib/theme.js'

const BLANK = {
  full_name: '', phone: '', bio: '',
  fav_book: '', fav_author: '', fav_genre: '',
  birth_month: '', birth_day: '',
}

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
    if (!profile) return
    setForm({
      ...BLANK,
      ...Object.fromEntries(
        Object.keys(BLANK).map((k) => [k, profile[k] ?? BLANK[k]])
      ),
    })
  }, [profile])

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
        bio: form.bio.trim() || null,
        fav_book: form.fav_book.trim() || null,
        fav_author: form.fav_author.trim() || null,
        fav_genre: form.fav_genre.trim() || null,
        birth_month: form.birth_month ? Number(form.birth_month) : null,
        birth_day: form.birth_day ? Number(form.birth_day) : null,
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

  async function removeAvatar() {
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    await refreshProfile()
    showToast('Photo removed')
  }

  if (!form) return <Spinner />

  // Days that actually exist in the chosen month (ignoring leap years —
  // February gets 29 so nobody born on the 29th is turned away).
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const maxDay = form.birth_month ? daysInMonth[Number(form.birth_month) - 1] : 31

  return (
    <div className="page">
      {toast}
      <div className="between">
        <h1 style={{ margin: 0 }}>My profile</h1>
        <Link to={`/member/${user.id}`} className="btn btn-ghost btn-sm">
          <Icon name="users" size={15} /> How others see it
        </Link>
      </div>
      <p className="hand">member since {monthYear(profile?.created_at)}</p>

      <div className="card" style={{ marginTop: 14 }}>
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
            {profile?.avatar_url && (
              <button className="btn-ghost btn-sm" style={{ marginTop: 2 }} onClick={removeAvatar}>
                Remove
              </button>
            )}
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
            <input value={form.phone} onChange={set('phone')} type="tel" placeholder="Optional" />
            <p className="muted tiny" style={{ marginTop: 5 }}>The club can see this.</p>
          </div>

          <div className="field">
            <label>About me</label>
            <textarea
              value={form.bio}
              onChange={set('bio')}
              placeholder="A line or two about you and what you like reading."
              style={{ minHeight: 70 }}
            />
          </div>

          <Section icon="star">My favourites</Section>

          <div className="field">
            <label>Favourite book or series</label>
            <input value={form.fav_book} onChange={set('fav_book')} placeholder="The one you push on everyone" />
          </div>
          <div className="field">
            <label>Favourite author</label>
            <input value={form.fav_author} onChange={set('fav_author')} />
          </div>
          <div className="field">
            <label>Favourite genre</label>
            <input value={form.fav_genre} onChange={set('fav_genre')} placeholder="Romantasy, literary, horror…" />
          </div>

          <Section icon="calendar">My birthday</Section>
          <p className="muted tiny" style={{ marginTop: -4 }}>
            Month and day only — no year, so nobody knows your age. It shows up on the club calendar.
          </p>

          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Month</label>
              <select value={form.birth_month} onChange={set('birth_month')}>
                <option value="">—</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Day</label>
              <select value={form.birth_day} onChange={set('birth_day')} disabled={!form.birth_month}>
                <option value="">—</option>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="btn-primary btn-block" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <Section icon="sliders">How it looks</Section>
      <ThemePicker profile={profile} userId={user.id} onSaved={refreshProfile} notify={showToast} />

      <Section icon="lock">My email</Section>
      <div className="card card-tight">
        <b style={{ fontSize: '0.95rem' }}>{user?.email}</b>
        <div className="private-note" style={{ marginTop: 10 }}>
          <Icon name="lock" size={16} />
          Only you can see this. It isn't stored in the club's records at all.
        </div>
      </div>

      <Section icon="sparkle">My stats</Section>
      <div className="grid-3">
        <div className="stat"><b>{stats.finished}</b><span>books finished</span></div>
        <div className="stat"><b>{stats.rated}</b><span>books reviewed</span></div>
        <div className="stat"><b>{stats.theories}</b><span>threads started</span></div>
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <Link to="/members" className="btn btn-soft btn-block">
          <Icon name="users" size={16} /> See all members
        </Link>
        <button className="btn-ghost" onClick={signOut}>
          <Icon name="exit" size={16} /> Sign out
        </button>
      </div>
    </div>
  )
}

/* ---------------- colours ---------------- */
function ThemePicker({ profile, userId, onSaved, notify }) {
  const [accent, setAccent] = useState(profile?.theme ?? 'pink')
  const [mode, setMode] = useState(profile?.dark_mode ?? 'system')
  const [busy, setBusy] = useState(false)

  // Preview instantly, then remember it. Nobody wants to press Save to
  // find out whether they like a colour.
  async function choose(next) {
    const chosen = { accent, mode, ...next }
    setAccent(chosen.accent)
    setMode(chosen.mode)
    applyTheme(chosen)

    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ theme: chosen.accent, dark_mode: chosen.mode })
      .eq('id', userId)
    setBusy(false)
    if (error) return notify(error.message)
    await onSaved()
  }

  return (
    <div className="card">
      <label>Colour</label>
      <div className="swatches">
        {ACCENTS.map((a) => (
          <button
            key={a.key}
            className={`swatch${accent === a.key ? ' on' : ''}`}
            onClick={() => choose({ accent: a.key })}
            disabled={busy}
            aria-label={a.label}
            aria-pressed={accent === a.key}
          >
            <span className="chip" style={{ background: a.swatch }}>
              {accent === a.key && <Icon name="check" size={16} />}
            </span>
            {a.label}
          </button>
        ))}
      </div>

      <label style={{ marginTop: 16 }}>Light or dark</label>
      <div className="row" style={{ gap: 7 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            className={mode === m.key ? 'btn-primary btn-sm' : 'btn-soft btn-sm'}
            style={{ flex: 1 }}
            onClick={() => choose({ mode: m.key })}
            disabled={busy}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="muted tiny" style={{ margin: '11px 0 0' }}>
        Only you see this — everyone in the club picks their own. It follows you
        to your other devices too.
      </p>
    </div>
  )
}
