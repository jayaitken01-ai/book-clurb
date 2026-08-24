import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { Avatar, Empty, MONTHS, Section, Spinner, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { holidayMap } from '../lib/holidays.js'
import { MeetingCard, MeetingForm } from '../components/Meetings.jsx'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const pad = (n) => String(n).padStart(2, '0')
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function Calendar() {
  const { user } = useAuth()
  const today = new Date()

  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(dayKey(today))
  const [meetings, setMeetings] = useState(null)
  const [people, setPeople] = useState([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [toast, showToast] = useToast()

  const load = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('meetings')
      .select('*')
      .order('starts_at', { ascending: true })

    if (error) {
      setLoadError(error.message)
      setMeetings([])
      return
    }
    setLoadError(null)

    const [{ data: profiles }, { data: rsvps }] = await Promise.all([
      supabase.from('profiles').select('*'),
      (rows ?? []).length
        ? supabase.from('meeting_rsvps').select('*').in('meeting_id', rows.map((r) => r.id))
        : Promise.resolve({ data: [] }),
    ])

    const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
    setPeople(profiles ?? [])
    setMeetings(
      (rows ?? []).map((m) => ({
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
      .channel('calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_rsvps' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  // Holidays for this year and its neighbours, so paging never runs dry.
  const holidays = useMemo(
    () => holidayMap([year - 1, year, year + 1]),
    [year]
  )

  // Everything that happens, grouped by date.
  const byDate = useMemo(() => {
    const map = {}
    const push = (date, item) => {
      map[date] = map[date] ?? []
      map[date].push(item)
    }

    ;(meetings ?? []).forEach((m) => {
      push(dayKey(new Date(m.starts_at)), { kind: 'meeting', meeting: m })
    })

    // Birthdays repeat, so they're placed in whichever year is on screen.
    people.forEach((p) => {
      if (!p.birth_month || !p.birth_day) return
      ;[year - 1, year, year + 1].forEach((y) => {
        push(`${y}-${pad(p.birth_month)}-${pad(p.birth_day)}`, { kind: 'birthday', person: p })
      })
    })

    Object.entries(holidays).forEach(([date, list]) => {
      list.forEach((h) => push(date, { kind: 'holiday', holiday: h }))
    })

    return map
  }, [meetings, people, holidays, year])

  if (!meetings) return <Spinner />

  // Build the grid: leading blanks, then every day of the month.
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const todayKey = dayKey(today)
  const selectedEvents = byDate[selected] ?? []
  const selectedDate = new Date(`${selected}T12:00`)

  const step = (by) => setCursor(new Date(year, month + by, 1))
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelected(todayKey)
  }

  // The next few things coming up, from today onwards.
  const upcoming = Object.entries(byDate)
    .filter(([date]) => date >= todayKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6)

  return (
    <div className="page">
      {toast}

      <div className="between">
        <h1 style={{ margin: 0 }}>Calendar</h1>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Meeting
        </button>
      </div>
      <p className="hand">meetings, birthdays and days off</p>

      {loadError && <div className="error-box" style={{ marginTop: 12 }}>Couldn’t load: {loadError}</div>}

      {/* ---------- month ---------- */}
      <div className="cal">
        <div className="cal-head">
          <button className="btn-ghost btn-sm" onClick={() => step(-1)} aria-label="Previous month">
            <Icon name="back" size={17} />
          </button>
          <div className="cal-title">
            <b>{MONTHS[month]}</b> <span>{year}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => step(1)} aria-label="Next month">
            <Icon name="forward" size={17} />
          </button>
        </div>

        <div className="cal-grid cal-days">
          {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>

        <div className="cal-grid">
          {cells.map((day, i) => {
            if (!day) return <span key={`b${i}`} />
            const key = `${year}-${pad(month + 1)}-${pad(day)}`
            const events = byDate[key] ?? []
            const kinds = [...new Set(events.map((e) => e.kind))]
            return (
              <button
                key={key}
                className={
                  'cal-day' +
                  (key === selected ? ' sel' : '') +
                  (key === todayKey ? ' today' : '')
                }
                onClick={() => setSelected(key)}
              >
                <span className="n">{day}</span>
                {kinds.length > 0 && (
                  <span className="dots">
                    {kinds.map((k) => <i key={k} className={`dot ${k}`} />)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="cal-foot">
          <span className="legend"><i className="dot meeting" /> Meeting</span>
          <span className="legend"><i className="dot birthday" /> Birthday</span>
          <span className="legend"><i className="dot holiday" /> Holiday</span>
          <span className="spacer" />
          <button className="btn-ghost btn-sm" onClick={goToday}>Today</button>
        </div>
      </div>

      {/* ---------- the chosen day ---------- */}
      <Section icon="calendar">
        {selectedDate.toLocaleDateString(undefined, {
          weekday: 'long', day: 'numeric', month: 'long',
        })}
      </Section>

      {selectedEvents.length === 0 ? (
        <div className="no-meeting">
          <Icon name="calendar" size={22} />
          <div>
            <b>Nothing on this day</b>
            <p className="hand" style={{ margin: '2px 0 0' }}>tap below to put something in</p>
          </div>
        </div>
      ) : (
        <div className="stack">
          {selectedEvents.map((e, i) => {
            if (e.kind === 'meeting') {
              return (
                <MeetingCard
                  key={e.meeting.id}
                  meeting={e.meeting}
                  userId={user.id}
                  onChange={load}
                  onEdit={() => setEditing(e.meeting)}
                  notify={showToast}
                />
              )
            }
            if (e.kind === 'birthday') {
              return (
                <div className="card card-tight day-item birthday" key={`b${e.person.id}${i}`}>
                  <Avatar profile={e.person} size={40} />
                  <div>
                    <b>{e.person.full_name}'s birthday</b>
                    <p className="hand" style={{ margin: 0 }}>say something nice</p>
                  </div>
                </div>
              )
            }
            return (
              <div className="card card-tight day-item holiday" key={`h${i}`}>
                <span className="holiday-mark"><Icon name="sparkle" size={18} /></span>
                <div>
                  <b>{e.holiday.name}</b>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    {e.holiday.stat ? 'Statutory holiday in Ontario' : 'Not a day off, but worth knowing'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        className="btn-soft btn-block"
        style={{ marginTop: 12 }}
        onClick={() => setAdding(true)}
      >
        <Icon name="plus" size={16} /> Add a meeting on this day
      </button>

      {/* ---------- what's coming ---------- */}
      {upcoming.length > 0 && (
        <>
          <Section icon="clock">Coming up</Section>
          <div className="stack" style={{ gap: 8 }}>
            {upcoming.map(([date, events]) => {
              const d = new Date(`${date}T12:00`)
              return (
                <button
                  key={date}
                  className="card card-tight upcoming-row"
                  onClick={() => {
                    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
                    setSelected(date)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <div className="datechip small">
                    <span className="mon">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                    <span className="day">{d.getDate()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    {events.map((e, i) => (
                      <div key={i} className="tiny" style={{ fontWeight: 700, lineHeight: 1.5 }}>
                        {e.kind === 'meeting' && <>📍 {e.meeting.title}</>}
                        {e.kind === 'birthday' && <>{e.person.full_name}'s birthday</>}
                        {e.kind === 'holiday' && <>{e.holiday.name}</>}
                      </div>
                    ))}
                  </div>
                  <Icon name="forward" size={15} className="icon chev" />
                </button>
              )
            })}
          </div>
        </>
      )}

      {(adding || editing) && (
        <MeetingForm
          userId={user.id}
          existing={editing}
          onDay={editing ? null : selected}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={async () => {
            setAdding(false)
            setEditing(null)
            await load()
            showToast('Saved to the calendar')
          }}
        />
      )}
    </div>
  )
}
