import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Cover, Empty, Section, Spinner } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

/**
 * An index of every theory board — one per book, including books
 * the club finished years ago. Nothing gets archived away.
 */
export default function Theories() {
  const navigate = useNavigate()
  const [books, setBooks] = useState(null)
  const [counts, setCounts] = useState({})

  useEffect(() => {
    ;(async () => {
      const [{ data: rows }, { data: threads }] = await Promise.all([
        supabase.from('books').select('*').order('created_at', { ascending: false }),
        supabase.from('theory_threads').select('book_id'),
      ])
      const tally = {}
      ;(threads ?? []).forEach((t) => { tally[t.book_id] = (tally[t.book_id] ?? 0) + 1 })
      setCounts(tally)
      setBooks(rows ?? [])
    })()
  }, [])

  if (!books) return <Spinner />

  const current = books.find((b) => b.status === 'current')
  const rest = books.filter((b) => b.id !== current?.id)

  return (
    <div className="page">
      <h1>Theory boards</h1>
      <p className="muted">Every book keeps its own board — categories, threads and all.</p>

      {books.length === 0 && (
        <Empty icon="thought" title="No boards yet" hint="Add a book in the Library and its board appears here." />
      )}

      {current && (
        <div className="hero" style={{ marginBottom: 8 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 15 }}>
            <Cover book={current} w={78} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="pill"><Icon name="bookopen" size={13} /> Reading now</span>
              <h2 style={{ margin: '7px 0 2px', fontSize: '1.2rem' }}>{current.title}</h2>
              <p className="tiny muted" style={{ margin: 0 }}>
                {counts[current.id] ?? 0} {counts[current.id] === 1 ? 'thread' : 'threads'}
              </p>
            </div>
          </div>
          <button
            className="btn-primary btn-block"
            style={{ marginTop: 14 }}
            onClick={() => navigate(`/book/${current.id}?tab=theories`)}
          >
            <Icon name="thought" size={16} /> Open the board
          </button>
        </div>
      )}

      {rest.length > 0 && (
        <>
          <Section icon="books" note={`${rest.length}`}>Past boards</Section>
          <div className="stack">
            {rest.map((b) => (
              <button
                key={b.id}
                className="card card-tight"
                style={{ textAlign: 'left', display: 'block', width: '100%' }}
                onClick={() => navigate(`/book/${b.id}?tab=theories`)}
              >
                <div className="row" style={{ gap: 13 }}>
                  <Cover book={b} w={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: '0.93rem' }}>{b.title}</b>
                    {b.author && <div className="tiny muted">{b.author}</div>}
                  </div>
                  <span className="pill pill-lilac">
                    <Icon name="thought" size={13} /> {counts[b.id] ?? 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
