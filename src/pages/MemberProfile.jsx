import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  Avatar, Cover, Empty, Section, Spinner, Stars, birthdayLabel, monthYear,
} from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

/** Anyone's profile, as the rest of the club sees it. */
export default function MemberProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [person, setPerson] = useState(null)
  const [missing, setMissing] = useState(false)
  const [stats, setStats] = useState({ finished: 0, reviewed: 0, threads: 0 })
  const [reviews, setReviews] = useState([])

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    if (!data) return setMissing(true)
    setPerson(data)

    const [fin, rev, th, recent] = await Promise.all([
      supabase.from('reading_progress').select('id', { count: 'exact', head: true })
        .eq('user_id', id).eq('finished', true),
      supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('theory_threads').select('id', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('ratings')
        .select('id, rating, summary, book_id')
        .eq('user_id', id)
        .order('updated_at', { ascending: false })
        .limit(3),
    ])

    setStats({ finished: fin.count ?? 0, reviewed: rev.count ?? 0, threads: th.count ?? 0 })

    const rows = (recent.data ?? []).map((r) => ({ ...r, rating: Number(r.rating) }))
    if (rows.length) {
      const { data: books } = await supabase
        .from('books')
        .select('id, title, author, cover_url')
        .in('id', rows.map((r) => r.book_id))
      const byId = Object.fromEntries((books ?? []).map((b) => [b.id, b]))
      setReviews(rows.map((r) => ({ ...r, book: byId[r.book_id] ?? null })))
    } else {
      setReviews([])
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (missing) {
    return (
      <div className="page">
        <Empty icon="users" title="No one here" hint="That member may have left the club." />
        <button className="btn-soft btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/members')}>
          Back to the club
        </button>
      </div>
    )
  }

  if (!person) return <Spinner />

  const isMe = person.id === user?.id
  const birthday = birthdayLabel(person.birth_month, person.birth_day)

  const facts = [
    ['bookopen', 'Favourite book', person.fav_book],
    ['pencil',   'Favourite author', person.fav_author],
    ['tag',      'Favourite genre', person.fav_genre],
    ['calendar', 'Birthday', birthday],
    ['phone',    'Phone', person.phone],
  ].filter(([, , value]) => value)

  return (
    <div className="page">
      <button className="btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 10 }}>
        <Icon name="back" size={16} /> Back
      </button>

      <div className="hero">
        <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
          <Avatar profile={person} size={86} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{person.full_name}</h1>
            <p className="hand" style={{ margin: '2px 0 0' }}>
              member since {monthYear(person.created_at)}
            </p>
            {isMe && (
              <Link to="/profile" className="btn btn-soft btn-sm" style={{ marginTop: 10 }}>
                <Icon name="pencil" size={14} /> Edit my profile
              </Link>
            )}
          </div>
        </div>

        {person.bio && (
          <p style={{ margin: '15px 0 0', fontSize: '0.93rem', lineHeight: 1.6 }}>{person.bio}</p>
        )}
      </div>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="stat"><b>{stats.finished}</b><span>books finished</span></div>
        <div className="stat"><b>{stats.reviewed}</b><span>books reviewed</span></div>
        <div className="stat"><b>{stats.threads}</b><span>threads started</span></div>
      </div>

      {facts.length > 0 && (
        <>
          <Section icon="star">A bit about {person.full_name.split(' ')[0]}</Section>
          <div className="facts">
            {facts.map(([icon, label, value]) => (
              <div className="fact" key={label}>
                <Icon name={icon} size={17} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{label}</b>
                  <span>{value}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {reviews.length > 0 && (
        <>
          <Section icon="chat">Recent reviews</Section>
          <div className="stack">
            {reviews.map((r) => (
              <Link
                key={r.id}
                to={`/book/${r.book_id}?tab=reviews`}
                className="card card-tight"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="row" style={{ gap: 12 }}>
                  <Cover book={r.book} w={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: '0.92rem' }}>{r.book?.title ?? 'A book'}</b>
                    <div style={{ marginTop: 2 }}><Stars value={r.rating} size={13} /></div>
                    {r.summary && (
                      <p className="muted tiny" style={{ margin: '4px 0 0' }}>“{r.summary}”</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {facts.length === 0 && reviews.length === 0 && (
        <div style={{ marginTop: 18 }}>
          <Empty
            icon="sparkle"
            title="Not much here yet"
            hint={isMe
              ? 'Add your favourites and birthday on your profile.'
              : `${person.full_name.split(' ')[0]} hasn't filled in their favourites yet.`}
          />
        </div>
      )}
    </div>
  )
}
