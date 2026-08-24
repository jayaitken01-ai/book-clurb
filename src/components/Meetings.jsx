import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Avatar, AvatarLink, Modal, NameLink, Spinner, useConfirm, useToast } from './ui.jsx'
import Icon from './Icon.jsx'

/**
 * The meetings board on the homepage.
 *
 * Anyone can post one — when, where, and what we're doing — and everyone
 * answers with one of two buttons. A meeting drops off the board four
 * hours after it starts, so nobody has to tidy up after themselves.
 */
export default function Meetings({ userId, currentBook }) {
  const [meetings, setMeetings] = useState(null)
  const [posting, setPosting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, showToast] = useToast()

  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 4 * 3600 * 1000).toISOString()

    // Fetched as three plain queries rather than one nested join. Nested
    // embeds fail as a whole if any single relationship can't be resolved,
    // and that failure looks exactly like "there are no meetings".
    const { data: rows, error } = await supabase
      .from('meetings')
      .select('*')
      .gte('starts_at', since)
      .order('starts_at', { ascending: true })
      .limit(5)

    if (error) {
      setLoadError(error.message)
      setMeetings([])
      return
    }
    setLoadError(null)

    if (!rows?.length) {
      setMeetings([])
      return
    }

    const [{ data: people }, { data: rsvps }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('meeting_rsvps').select('*').in('meeting_id', rows.map((r) => r.id)),
    ])

    const byId = Object.fromEntries((people ?? []).map((p) => [p.id, p]))

    setMeetings(
      rows.map((m) => ({
        ...m,
        profiles: byId[m.created_by] ?? null,
        meeting_rsvps: (rsvps ?? [])
          .filter((r) => r.meeting_id === m.id)
          .map((r) => ({ ...r, profiles: byId[r.user_id] ?? null })),
      }))
    )
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase
      .channel('meetings-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_rsvps' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  if (!meetings) return <Spinner />

  return (
    <>
      {toast}

      <div className="section-title">
        <Icon name="calendar" size={19} />
        Meetings
        <span className="spacer" />
        <Link to="/calendar" className="tiny" style={{ fontWeight: 800, marginRight: 4 }}>
          Calendar
        </Link>
        <button className="btn-soft btn-sm" onClick={() => setPosting(true)}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>

      {loadError && (
        <div className="error-box">
          Couldn’t load meetings: {loadError}
          <br />
          <span style={{ fontWeight: 600 }}>
            If this says the table is missing, re-run <code>schema.sql</code> in Supabase.
          </span>
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="no-meeting">
          <Icon name="calendar" size={22} />
          <div>
            <b>Nothing in the diary</b>
            <p className="hand" style={{ margin: '2px 0 0' }}>post one and see who can make it</p>
          </div>
        </div>
      ) : (
        <div className="stack">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              userId={userId}
              onChange={load}
              onEdit={() => setEditing(m)}
              notify={showToast}
            />
          ))}
        </div>
      )}

      {(posting || editing) && (
        <MeetingForm
          userId={userId}
          currentBook={currentBook}
          existing={editing}
          onClose={() => { setPosting(false); setEditing(null) }}
          onSaved={async () => {
            setPosting(false)
            setEditing(null)
            await load()
            showToast('Meeting posted')
          }}
        />
      )}
    </>
  )
}

/* ---------------- one meeting ---------------- */
export function MeetingCard({ meeting, userId, onChange, onEdit, notify }) {
  const [busy, setBusy] = useState(false)
  const [confirmNode, askDelete] = useConfirm()

  const rsvps = meeting.meeting_rsvps ?? []
  const going = rsvps.filter((r) => r.response === 'going')
  const cant = rsvps.filter((r) => r.response === 'cant')
  const mine = rsvps.find((r) => r.user_id === userId)
  const isMine = meeting.created_by === userId

  const when = new Date(meeting.starts_at)
  const today = new Date()
  const isToday = when.toDateString() === today.toDateString()
  const isTomorrow =
    when.toDateString() === new Date(today.getTime() + 86400000).toDateString()

  async function answer(response) {
    if (busy) return
    setBusy(true)
    if (mine?.response === response) {
      // tapping the same answer again clears it
      await supabase.from('meeting_rsvps').delete()
        .eq('meeting_id', meeting.id).eq('user_id', userId)
    } else {
      await supabase.from('meeting_rsvps').upsert(
        {
          meeting_id: meeting.id,
          user_id: userId,
          response,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'meeting_id,user_id' }
      )
    }
    setBusy(false)
    onChange()
  }

  function confirmRemove() {
    askDelete({
      title: 'Remove this meeting?',
      body: `\u201c${meeting.title}\u201d and everyone\u2019s answers will be removed from the board. This can\u2019t be undone.`,
      confirmLabel: 'Remove',
      run: async () => {
        await supabase.from('meetings').delete().eq('id', meeting.id)
        onChange()
        notify('Meeting removed')
      },
    })
  }

  return (
    <div className="card meeting">
      {confirmNode}
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <div className="datechip">
          <span className="mon">{when.toLocaleDateString(undefined, { month: 'short' })}</span>
          <span className="day">{when.getDate()}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px' }}>{meeting.title}</h3>

          <div className="row-wrap tiny muted" style={{ gap: 12 }}>
            <span className="row" style={{ gap: 5 }}>
              <Icon name="clock" size={13} />
              {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : when.toLocaleDateString(undefined, { weekday: 'long' })}
              {' · '}
              {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </span>
            {meeting.location && (
              <span className="row" style={{ gap: 5 }}>
                <Icon name="pin" size={13} /> {meeting.location}
              </span>
            )}
          </div>

          {meeting.agenda && (
            <p style={{ margin: '9px 0 0', fontSize: '0.89rem', lineHeight: 1.55 }}>
              {meeting.agenda}
            </p>
          )}
        </div>
      </div>

      <div className="rsvp">
        <button
          className={`rsvp-btn yes${mine?.response === 'going' ? ' on' : ''}`}
          onClick={() => answer('going')}
          disabled={busy}
        >
          <Icon name="check" size={16} />
          I'll be there
          {going.length > 0 && <b>{going.length}</b>}
        </button>
        <button
          className={`rsvp-btn no${mine?.response === 'cant' ? ' on' : ''}`}
          onClick={() => answer('cant')}
          disabled={busy}
        >
          <Icon name="cross" size={16} />
          Can't make it
          {cant.length > 0 && <b>{cant.length}</b>}
        </button>
      </div>

      {(going.length > 0 || cant.length > 0) && (
        <div className="row-wrap" style={{ gap: 12, marginTop: 11 }}>
          {going.length > 0 && (
            <div className="row" style={{ gap: 5 }}>
              <span className="tiny muted" style={{ fontWeight: 800 }}>Going</span>
              <span className="faces">
                {going.map((r) => (
                  <span key={r.user_id} title={r.profiles?.full_name}>
                    <AvatarLink profile={r.profiles} size={24} />
                  </span>
                ))}
              </span>
            </div>
          )}
          {cant.length > 0 && (
            <span className="tiny muted">
              {cant.map((r) => r.profiles?.full_name?.split(' ')[0]).join(', ')} can't
            </span>
          )}
        </div>
      )}

      {isMine && (
        <div className="row" style={{ gap: 6, marginTop: 11 }}>
          <button className="btn-ghost btn-sm" onClick={onEdit}>
            <Icon name="pencil" size={14} /> Edit
          </button>
          <button className="btn-ghost btn-sm" onClick={confirmRemove} disabled={busy}>
            <Icon name="trash" size={14} /> Remove
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------------- post / edit a meeting ---------------- */
// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso, fallbackDay) {
  const d = iso ? new Date(iso) : (fallbackDay ? new Date(`${fallbackDay}T19:00`) : new Date(Date.now() + 7 * 86400000))
  if (!iso && !fallbackDay) d.setHours(19, 0, 0, 0)   // default: a week from now, 7pm
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MeetingForm({ userId, currentBook, existing, onDay, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: existing?.title ?? 'Book club',
    location: existing?.location ?? '',
    agenda: existing?.agenda ?? '',
    when: toLocalInput(existing?.starts_at, onDay),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.when) return setError('When is it?')

    // A meeting more than four hours old never appears on the board, so
    // saving one would look like it silently vanished. Say so instead.
    const when = new Date(form.when)
    if (Number.isNaN(when.getTime())) return setError('That date didn’t make sense — try again.')
    if (when.getTime() < Date.now() - 4 * 3600 * 1000) {
      return setError('That’s in the past. The board only shows meetings up to four hours after they start.')
    }

    setBusy(true)
    setError(null)

    const row = {
      title: form.title.trim() || 'Book club',
      location: form.location.trim() || null,
      agenda: form.agenda.trim() || null,
      starts_at: when.toISOString(),
    }

    const { error } = existing
      ? await supabase.from('meetings').update(row).eq('id', existing.id)
      : await supabase.from('meetings').insert({
          ...row,
          created_by: userId,
          book_id: currentBook?.id ?? null,
        })

    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal title={existing ? 'Edit meeting' : 'New meeting'} onClose={onClose}>
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>What is it?</label>
        <input value={form.title} onChange={set('title')} placeholder="Book club" maxLength={80} />
      </div>

      <div className="field">
        <label>When</label>
        <input type="datetime-local" value={form.when} onChange={set('when')} />
      </div>

      <div className="field">
        <label>Where</label>
        <input
          value={form.location}
          onChange={set('location')}
          placeholder="Maya's place / the café on Bloor / video call"
          maxLength={120}
        />
      </div>

      <div className="field">
        <label>What we'll be doing</label>
        <textarea
          value={form.agenda}
          onChange={set('agenda')}
          placeholder={
            currentBook
              ? `Chapters 1–15 of ${currentBook.title}. Snacks. Someone bring the good candles.`
              : 'Chapters 1–15, snacks, and picking our next read.'
          }
          style={{ minHeight: 88 }}
        />
      </div>

      <button className="btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : existing ? 'Save changes' : 'Post it'}
      </button>
    </Modal>
  )
}
