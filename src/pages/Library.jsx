import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { Cover, Empty, Modal, Section, Spinner, Stars, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import GenrePicker from '../components/GenrePicker.jsx'

const SHELVES = [
  { key: 'current',  title: 'Reading now', icon: 'bookopen' },
  { key: 'upcoming', title: 'Up next',     icon: 'bookmark' },
  { key: 'finished', title: 'Finished',    icon: 'check' },
]

export default function Library() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'tbr' ? 'tbr' : 'shelf'

  const [books, setBooks] = useState(null)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('all')
  const [groupBy, setGroupBy] = useState('shelf')   // 'shelf' | 'genre'
  const [toast, showToast] = useToast()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('books')
      .select('*, ratings(rating)')
      .order('created_at', { ascending: false })
    setBooks(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  // Books in the current view, after the search box and genre filter.
  const shown = useMemo(() => {
    if (!books) return []
    const q = search.trim().toLowerCase()

    return books
      .filter((b) => (view === 'tbr' ? b.status === 'tbr' : b.status !== 'tbr'))
      .filter((b) => genre === 'all' || (b.genres ?? []).includes(genre))
      .filter((b) => {
        if (!q) return true
        return (
          b.title?.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q) ||
          (b.genres ?? []).some((g) => g.toLowerCase().includes(q))
        )
      })
  }, [books, view, search, genre])

  // Every genre actually in use, so the filter never offers an empty one.
  const genresInUse = useMemo(() => {
    if (!books) return []
    const pool = books.filter((b) => (view === 'tbr' ? b.status === 'tbr' : b.status !== 'tbr'))
    return [...new Set(pool.flatMap((b) => b.genres ?? []))].sort()
  }, [books, view])

  if (!books) return <Spinner />

  const tbrCount = books.filter((b) => b.status === 'tbr').length
  const finished = books.filter((b) => b.status === 'finished').length
  const onShelf  = books.filter((b) => b.status !== 'tbr').length
  const allRatings = books.flatMap((b) => b.ratings ?? [])
  const avgAll = allRatings.length
    ? (allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length).toFixed(1)
    : '—'

  const open = (b) => navigate(`/book/${b.id}`)
  const filtering = Boolean(search.trim()) || genre !== 'all'

  // How the results get grouped up.
  let groups = []
  if (groupBy === 'genre') {
    const byGenre = {}
    shown.forEach((b) => {
      const list = (b.genres ?? []).length ? b.genres : ['No genre yet']
      list.forEach((g) => {
        byGenre[g] = byGenre[g] ?? []
        byGenre[g].push(b)
      })
    })
    groups = Object.keys(byGenre).sort((a, b) =>
      a === 'No genre yet' ? 1 : b === 'No genre yet' ? -1 : a.localeCompare(b)
    ).map((g) => ({ title: g, icon: 'tag', books: byGenre[g] }))
  } else if (view === 'tbr') {
    groups = [{ title: null, books: shown }]
  } else {
    groups = SHELVES
      .map((s) => ({ ...s, books: shown.filter((b) => b.status === s.key) }))
      .filter((s) => s.books.length)
  }

  return (
    <div className="page">
      {toast}
      <div className="between">
        <h1 style={{ margin: 0 }}>Library</h1>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Add book
        </button>
      </div>

      <div className="subtabs">
        <button
          className={`subtab${view === 'shelf' ? ' on' : ''}`}
          onClick={() => { setParams({}, { replace: true }); setGenre('all') }}
        >
          Our shelf
        </button>
        <button
          className={`subtab${view === 'tbr' ? ' on' : ''}`}
          onClick={() => { setParams({ view: 'tbr' }, { replace: true }); setGenre('all') }}
        >
          TBR {tbrCount > 0 && `· ${tbrCount}`}
        </button>
      </div>

      {/* ---------- search ---------- */}
      <div className="searchbar">
        <Icon name="find" size={17} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, author or genre…"
          aria-label="Search the library"
        />
        {search && (
          <button className="btn-ghost btn-sm" onClick={() => setSearch('')} aria-label="Clear search">
            <Icon name="cross" size={15} />
          </button>
        )}
      </div>

      {/* ---------- genre filter ---------- */}
      {genresInUse.length > 0 && (
        <div className="cats" style={{ marginTop: 12 }}>
          <button className={`cat${genre === 'all' ? ' on' : ''}`} onClick={() => setGenre('all')}>
            All genres
          </button>
          {genresInUse.map((g) => (
            <button key={g} className={`cat${genre === g ? ' on' : ''}`} onClick={() => setGenre(g)}>
              {g}
            </button>
          ))}
        </div>
      )}

      {/* ---------- how to group ---------- */}
      {genresInUse.length > 0 && (
        <div className="between" style={{ margin: '2px 0 4px' }}>
          <span className="tiny muted" style={{ fontWeight: 800 }}>
            {shown.length} {shown.length === 1 ? 'book' : 'books'}
            {filtering && ' found'}
          </span>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setGroupBy((g) => (g === 'shelf' ? 'genre' : 'shelf'))}
          >
            <Icon name="sliders" size={14} />
            {groupBy === 'shelf' ? 'Group by genre' : 'Group by shelf'}
          </button>
        </div>
      )}

      {/* ---------- stats (only when you're not filtering) ---------- */}
      {view === 'shelf' && !filtering && (
        <div className="grid-3" style={{ marginBottom: 6 }}>
          <div className="stat"><b>{finished}</b><span>books finished</span></div>
          <div className="stat"><b>{onShelf}</b><span>on the shelf</span></div>
          <div className="stat"><b>{avgAll}</b><span>avg rating</span></div>
        </div>
      )}

      {view === 'tbr' && !filtering && tbrCount > 0 && (
        <div className="waiting" style={{ marginBottom: 16 }}>
          Any of these can be suggested again next time a poll opens.
        </div>
      )}

      {/* ---------- the books ---------- */}
      {shown.length === 0 ? (
        filtering ? (
          <Empty
            icon="find"
            title="Nothing matches"
            hint="Try a different word, or clear the genre filter."
          />
        ) : view === 'tbr' ? (
          <Empty
            icon="bookmark"
            title="Nothing on the TBR yet"
            hint="Suggestions that don't win a poll land here, ready for the next one."
          />
        ) : (
          <Empty
            icon="books"
            title="The shelf is empty"
            hint="Add your first book to get the club going!"
          />
        )
      ) : (
        groups.map((g) => (
          <div key={g.title ?? 'all'}>
            {g.title && <Section icon={g.icon} note={`${g.books.length}`}>{g.title}</Section>}
            <div className="shelf">
              {g.books.map((b) => <BookTile key={`${g.title}-${b.id}`} book={b} onOpen={open} />)}
            </div>
          </div>
        ))
      )}

      {adding && (
        <AddBook
          userId={user.id}
          onClose={() => setAdding(false)}
          onAdded={async () => { setAdding(false); await load(); showToast('Added to the library') }}
        />
      )}
    </div>
  )
}

function BookTile({ book, onOpen }) {
  const rs = book.ratings ?? []
  const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : null
  return (
    <button
      onClick={() => onOpen(book)}
      style={{ background: 'none', padding: 0, display: 'block', textAlign: 'left' }}
    >
      <Cover book={book} w="100%" />
      <b style={{ display: 'block', fontSize: '0.83rem', marginTop: 8, lineHeight: 1.3 }}>{book.title}</b>
      {book.author && <span className="tiny muted">{book.author}</span>}
      {avg && (
        <div className="row" style={{ gap: 4, marginTop: 3 }}>
          <Stars value={Math.round(avg)} size={11} />
          <span className="tiny" style={{ color: 'var(--pink-600)', fontWeight: 800 }}>{avg.toFixed(1)}</span>
        </div>
      )}
      {!book.cover_url && (
        <span className="tiny muted" style={{ display: 'block', marginTop: 2 }}>add a cover →</span>
      )}
    </button>
  )
}

/* ---------------- add a book ---------------- */
function AddBook({ userId, onClose, onAdded }) {
  const [form, setForm] = useState({
    title: '', author: '', description: '', total_chapters: 30, status: 'upcoming',
  })
  const [genres, setGenres] = useState([])
  const [coverUrl, setCoverUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function uploadCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('covers').upload(path, file, { upsert: true })
    if (upErr) { setUploading(false); return setError(upErr.message) }
    const { data } = supabase.storage.from('covers').getPublicUrl(path)
    setCoverUrl(data.publicUrl)
    setUploading(false)
  }

  async function add() {
    if (!form.title.trim()) return setError('A book needs a title!')
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('books').insert({
      title: form.title.trim(),
      author: form.author.trim() || null,
      description: form.description.trim() || null,
      genres,
      total_chapters: Number(form.total_chapters) || 1,
      status: form.status,
      cover_url: coverUrl,
      added_by: userId,
      started_on: form.status === 'current' ? new Date().toISOString().slice(0, 10) : null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    onAdded()
  }

  return (
    <Modal title="Add a book" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}

      <div className="row" style={{ gap: 14, marginBottom: 15 }}>
        <Cover book={{ cover_url: coverUrl }} w={72} />
        <div>
          <button className="btn-soft btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon name="camera" size={15} /> {uploading ? 'Uploading…' : 'Add cover'}
          </button>
          <p className="muted tiny" style={{ margin: '6px 0 0' }}>
            Optional — a photo of your copy works.
          </p>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadCover} style={{ display: 'none' }} />
        </div>
      </div>

      <div className="field">
        <label>Title</label>
        <input value={form.title} onChange={set('title')} placeholder="What's it called?" />
      </div>
      <div className="field">
        <label>Author</label>
        <input value={form.author} onChange={set('author')} placeholder="Who wrote it?" />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Chapters</label>
          <input type="number" min={1} value={form.total_chapters} onChange={set('total_chapters')} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            <option value="upcoming">Up next</option>
            <option value="current">Reading now</option>
            <option value="finished">Finished</option>
            <option value="tbr">TBR</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Genres</label>
        <GenrePicker value={genres} onChange={setGenres} />
      </div>
      <div className="field" style={{ marginTop: 13 }}>
        <label>Description</label>
        <textarea value={form.description} onChange={set('description')} placeholder="What's it about?" />
      </div>

      <button className="btn-primary btn-block" onClick={add} disabled={busy}>
        {busy ? 'Adding…' : 'Add to library'}
      </button>
    </Modal>
  )
}
