import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { Avatar, Countdown, Cover, Empty, Section, Spinner } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import ChapterFeed from '../components/ChapterFeed.jsx'
import Meetings from '../components/Meetings.jsx'

export default function Home() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [book, setBook] = useState(null)
  const [poll, setPoll] = useState(null)
  const [stats, setStats] = useState({ finished: 0, members: 0, tbr: 0 })

  const load = useCallback(async () => {
    // Move along any poll whose clock has run out — this is what makes
    // a finished vote turn into the new current book on its own.
    await supabase.rpc('settle_polls')

    const { data: current } = await supabase
      .from('books')
      .select('*')
      .eq('status', 'current')
      .order('started_on', { ascending: false })
      .limit(1)
      .maybeSingle()
    setBook(current ?? null)

    const { data: openPolls } = await supabase
      .from('polls')
      .select('*, poll_options(id, title), poll_votes(option_id)')
      .neq('phase', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
    setPoll(openPolls?.[0] ?? null)

    const [{ count: finished }, { count: members }, { count: tbr }] = await Promise.all([
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('status', 'tbr'),
    ])
    setStats({ finished: finished ?? 0, members: members ?? 0, tbr: tbr ?? 0 })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />

  return (
    <div className="page">
      <div className="between" style={{ marginBottom: 14 }}>
        <div>
          <p className="hand" style={{ margin: '0 0 2px' }}>
            hi {profile?.full_name?.split(' ')[0] || 'there'}
          </p>
          <h1 style={{ margin: 0 }}>Currently reading</h1>
        </div>
        <Link to="/profile"><Avatar profile={profile} size={42} /></Link>
      </div>

      {!book ? (
        <Empty
          icon="bookopen"
          title="No book picked yet"
          hint="Start a poll, or add one straight to the library."
        />
      ) : (
        <>
          <div className="hero">
            <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <Cover book={book} w={104} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="pill"><Icon name="bookopen" size={13} /> In progress</span>
                <h2 style={{ margin: '8px 0 2px' }}>{book.title}</h2>
                {book.author && <p className="muted" style={{ margin: 0 }}>by {book.author}</p>}
                {book.started_on && (
                  <p className="muted tiny" style={{ margin: '6px 0 0' }}>
                    Started {new Date(book.started_on).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {book.genres?.length > 0 && (
              <div className="row-wrap" style={{ gap: 6, marginTop: 13 }}>
                {book.genres.map((g) => (
                  <span className="genre-tag" key={g}><Icon name="tag" size={12} /> {g}</span>
                ))}
              </div>
            )}

            {book.description && (
              <p style={{ marginTop: 14, marginBottom: 0, fontSize: '0.92rem' }}>{book.description}</p>
            )}

            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              <button
                className="btn-soft btn-sm"
                style={{ flex: 1 }}
                onClick={() => navigate(`/book/${book.id}?tab=theories`)}
              >
                <Icon name="thought" size={15} /> Theories
              </button>
              <button
                className="btn-soft btn-sm"
                style={{ flex: 1 }}
                onClick={() => navigate(`/book/${book.id}?tab=reviews`)}
              >
                <Icon name="star" size={15} /> Reviews
              </button>
            </div>
          </div>

        </>
      )}

      {/* ---------- meetings board ---------- */}
      <Meetings userId={user.id} currentBook={book} />

      {/* ---------- chapter updates ---------- */}
      {book && (
        <>
          <div className="section-title">
            <Icon name="pin" size={19} />
            Chapter updates
            <span className="spacer" />
            <Link to={`/book/${book.id}?tab=updates`} className="tiny" style={{ fontWeight: 800 }}>
              See all
            </Link>
          </div>

          <ChapterFeed book={book} userId={user.id} limit={4} />
        </>
      )}

      {/* ---------- next-book poll ---------- */}
      <Section icon="ballot">What's next?</Section>
      {poll ? <PollPreview poll={poll} /> : (
        <Empty
          icon="ballot"
          title="No poll running"
          hint="Anyone can start one — everybody gets a suggestion."
        />
      )}

      {/* ---------- club stats ---------- */}
      <Section icon="heart">Our club</Section>
      <div className="grid-3">
        <div className="stat"><b>{stats.finished}</b><span>books finished</span></div>
        <div className="stat"><b>{stats.members}</b><span>members</span></div>
        <div className="stat"><b>{stats.tbr}</b><span>on the TBR</span></div>
      </div>
    </div>
  )
}

/* ---------------- poll preview ---------------- */
function PollPreview({ poll }) {
  const options = poll.poll_options ?? []
  const votes = poll.poll_votes ?? []
  const collecting = poll.phase === 'collecting'

  const tally = {}
  votes.forEach((v) => { tally[v.option_id] = (tally[v.option_id] ?? 0) + 1 })
  const leader = [...options].sort((a, b) => (tally[b.id] ?? 0) - (tally[a.id] ?? 0))[0]

  return (
    <Link to="/polls" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card">
        <div className="between">
          <b>{poll.question}</b>
          <Countdown until={collecting ? poll.suggest_until : poll.vote_until} />
        </div>

        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.88rem' }}>
          {collecting
            ? `${options.length} ${options.length === 1 ? 'suggestion' : 'suggestions'} so far — add yours before it closes`
            : leader
              ? <>Leading: <b>{leader.title}</b> with {tally[leader.id] ?? 0}</>
              : 'Voting is open, nobody has voted yet'}
        </p>

        <p className="tiny" style={{ margin: '10px 0 0', color: 'var(--pink-600)', fontWeight: 800 }}>
          {collecting ? 'Tap to suggest' : 'Tap to vote'}
        </p>
      </div>
    </Link>
  )
}
