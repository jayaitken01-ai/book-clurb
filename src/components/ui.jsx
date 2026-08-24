import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

/* ---------- Avatar ---------- */
export function Avatar({ profile, size = 40 }) {
  const initials = (profile?.full_name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  const style = { width: size, height: size, fontSize: size * 0.38 }

  if (profile?.avatar_url) {
    return <img className="avatar" style={style} src={profile.avatar_url} alt={profile.full_name} />
  }
  return <span className="avatar" style={style}>{initials}</span>
}

/* ---------- Book cover ---------- */
export function Cover({ book, w = 96 }) {
  // `w` can be a number (px) or a CSS width like '100%'.
  const style =
    typeof w === 'number'
      ? { width: w, height: w * 1.5 }
      : { width: w, aspectRatio: '2 / 3' }

  if (book?.cover_url) {
    return <img className="cover" style={style} src={book.cover_url} alt={book.title} />
  }
  return (
    <span className="cover" style={style}>
      <Icon name="bookopen" size={typeof w === 'number' ? Math.max(18, w * 0.3) : 26} />
    </span>
  )
}

/* ---------- Star rating ---------- */
export function Stars({ value = 0, onChange, size = 20 }) {
  const readonly = !onChange
  return (
    <span className={`stars${readonly ? ' readonly' : ''}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star${n <= value ? ' on' : ''}`}
          onClick={readonly ? undefined : () => onChange(n)}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          tabIndex={readonly ? -1 : 0}
        >
          <Icon name="star" size={size} filled={n <= value} />
        </button>
      ))}
    </span>
  )
}

/* ---------- Like button ---------- */
export function LikeButton({ liked, count, onClick }) {
  return (
    <button className={`like${liked ? ' on' : ''}`} onClick={onClick}>
      <Icon name="heart" size={16} filled={liked} />
      {count}
    </button>
  )
}

/* ---------- Recommend badge ---------- */
const RECOMMEND = {
  yes:   { label: 'Recommends it',       cls: 'pill-mint',  icon: 'check' },
  maybe: { label: 'Depends on you',      cls: 'pill-gold',  icon: 'sliders' },
  no:    { label: 'Would not recommend', cls: 'pill-lilac', icon: 'eyeoff' },
}

export function RecommendPill({ value }) {
  const r = RECOMMEND[value]
  if (!r) return null
  return <span className={`pill ${r.cls}`}><Icon name={r.icon} size={13} /> {r.label}</span>
}

/* ---------- Bottom-sheet modal ---------- */
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header stays put; only the body below it scrolls, so the title
            and close button can never end up off the top of the screen. */}
        <div className="modal-head">
          <div className="grabber" />
          <div className="between">
            <h2 style={{ margin: 0 }}>{title}</h2>
            <button className="btn-ghost" onClick={onClose} aria-label="Close">
              <Icon name="cross" size={18} />
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Empty state ---------- */
export function Empty({ icon = 'sparkle', title, hint }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <b>{title}</b>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" />
}

/* ---------- Section heading ---------- */
export function Section({ icon, children, note }) {
  return (
    <div className="section-title">
      {icon && <Icon name={icon} size={19} />}
      {children}
      {note && <small>{note}</small>}
    </div>
  )
}

/* ---------- Toast ---------- */
export function useToast() {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? <div className="toast">{msg}</div> : null
  return [node, setMsg]
}

/* ---------- helpers ---------- */
export function timeAgo(iso) {
  if (!iso) return ''
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** "1d 4h left" / "22 minutes left" / "any moment now" */
export function timeLeft(iso) {
  if (!iso) return ''
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000)
  if (secs <= 0) return 'any moment now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} left`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m left`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h left`
}

/** Live-updating countdown pill. */
export function Countdown({ until, icon = 'clock' }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="pill pill-gold">
      <Icon name={icon} size={13} /> {timeLeft(until)}
    </span>
  )
}
