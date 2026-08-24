import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { Cover, Empty, Modal, Section, Spinner, Stars, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import GenrePicker from '../components/GenrePicker.jsx'

export default function Library() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'tbr' ? 'tbr' : 'shelf'

  const [books, setBooks] = useState(null)
  const [adding, setAdding] = useState(false)
  const [toast, showToast] = useToast()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('books')
      .select('*, ratings(rating)')
      .order('created_at', { ascending: false })
    setBooks(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  if (!books) return <Spinner />

  const current  = books.filter((b) => b.status === 'current')
  const upcoming = books.filter((b) => b.status === 'upcoming')
  const finished = books.filter((b) => b.status === 'finished')
  const tbr      = books.filter((b) => b.status === 'tbr')
  const onShelf  = books.filter((b) => b.status !== 'tbr')

  const allRatings = books.flatMap((b) => b.ratings ?? [])
  const avgAll = allRatings.length
    ? (allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length).toFixed(1)
    : '—'

  const open = (b) => navigate(`/book/${b.id}`)

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
          onClick={() => setParams({}, { replace: true })}
        >
          Our shelf
        </button>
        <button
          className={`subtab${view === 'tbr' ? ' on' : ''}`}
          onClick={() => setParams({ view: 'tbr' }, { replace: true })}
        >
          TBR {tbr.length > 0 && `· ${tbr.length}`}
        </button>
      </div>

      {view === 'shelf' ? (
        <>
          <div className="grid-3" style={{ marginBottom: 6 }}>
            <div className="stat"><b>{finished.length}</b><span>books finished</span></div>
            <div className="stat"><b>{onShelf.length}</b><span>on the shelf</span></div>
            <div className="stat"><b>{avgAll}</b><span>avg rating</span></div>
          </div>

          {onShelf.length === 0 && (
            <Empty
              icon="books"
              title="The shelf is empty"
              hint="Add your first book to get the club going!"
            />
          )}

          <Shelf title="Reading now" icon="bookopen" books={current}  onOpen={open} />
          <Shelf title="Up next"     icon="bookmark" books={upcoming} onOpen={open} />
          <Shelf title="Finished"    icon="check"    books={finished} onOpen={open} />
        </>
      ) : (
        <>
          <p className="hand">books we've suggested but haven't read yet</p>

          {tbr.length === 0 ? (
            <Empty
              icon="bookmark"
              title="Nothing on the TBR yet"
              hint="Suggestions that don't win a poll land here, ready for the next one."
            />
          ) : (
            <>
              <div className="waiting" style={{ marginBottom: 16 }}>
                Any of these can be suggested again next time a poll opens.
              </div>
              <div className="shelf">
                {tbr.map((b) => <BookTile key={b.id} book={b} onOpen={open} />)}
              </div>
            </>
          )}
        </>
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

function Shelf({ title, icon, books, onOpen }) {
  if (!books.length) return null
  return (
    <>
      <Section icon={icon} note={`${books.length}`}>{title}</Section>
      <div className="shelf">
        {books.map((b) => <BookTile key={b.id} book={b} onOpen={onOpen} />)}
      </div>
    </>
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
