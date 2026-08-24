import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  Avatar, AvatarLink, Cover, Empty, Modal, NameLink, RecommendPill, Section, Spinner, Stars, timeAgo, useConfirm, useToast,
} from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import TheoryBoard from '../components/TheoryBoard.jsx'
import ChapterFeed from '../components/ChapterFeed.jsx'
import GenrePicker from '../components/GenrePicker.jsx'

const TABS = [
  { key: 'reviews',  label: 'Reviews' },
  { key: 'theories', label: 'Theories' },
  { key: 'updates',  label: 'Updates' },
]

const STATUS = {
  current:  { label: 'Reading now', icon: 'bookopen' },
  finished: { label: 'Finished',    icon: 'check' },
  upcoming: { label: 'Up next',     icon: 'bookmark' },
  tbr:      { label: 'On the TBR',  icon: 'clock' },
}

export default function BookPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'reviews'

  const [book, setBook] = useState(null)
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('books').select('*').eq('id', id).maybeSingle()
    if (!data) return setMissing(true)
    setBook(data)
  }, [id])

  useEffect(() => { load() }, [load])

  if (missing) {
    return (
      <div className="page">
        <Empty icon="eyeoff" title="That book isn't here" hint="It may have been removed from the library." />
        <button className="btn-soft btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/library')}>
          Back to the library
        </button>
      </div>
    )
  }

  if (!book) return <Spinner />

  const status = STATUS[book.status] ?? STATUS.upcoming

  return (
    <div className="page">
      <button className="btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 6 }}>
        <Icon name="back" size={16} /> Back
      </button>

      <div className="row" style={{ alignItems: 'flex-start', gap: 15 }}>
        <Cover book={book} w={94} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="pill"><Icon name={status.icon} size={13} /> {status.label}</span>
          <h1 style={{ margin: '8px 0 2px', fontSize: '1.5rem' }}>{book.title}</h1>
          {book.author && <p className="muted" style={{ margin: 0 }}>by {book.author}</p>}
          <p className="tiny muted" style={{ margin: '7px 0 0' }}>
            {book.total_chapters} chapters
            {book.finished_on && ` · finished ${new Date(book.finished_on).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
          </p>
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
        <p style={{ marginTop: 14, fontSize: '0.92rem' }}>{book.description}</p>
      )}

      <div className="subtabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`subtab${tab === t.key ? ' on' : ''}`}
            onClick={() => setParams({ tab: t.key }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reviews'  && <ReviewsTab  book={book} userId={user.id} onBookChange={load} />}
      {tab === 'theories' && <TheoryBoard book={book} userId={user.id} />}
      {tab === 'updates'  && <ChapterFeed book={book} userId={user.id} />}
    </div>
  )
}

/* ============================================================
   REVIEWS — the club's combined verdict + everyone's write-ups
   ============================================================ */
function ReviewsTab({ book, userId, onBookChange }) {
  const [reviews, setReviews] = useState(null)
  const [writing, setWriting] = useState(false)
  const [managing, setManaging] = useState(false)
  const [toast, showToast] = useToast()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ratings')
      .select('*, profiles(*)')
      .eq('book_id', book.id)
      .order('updated_at', { ascending: false })
    setReviews(data ?? [])
  }, [book.id])

  useEffect(() => { load() }, [load])

  if (!reviews) return <Spinner />

  const mine = reviews.find((r) => r.user_id === userId)
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null
  const spread = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }))
  const yes = reviews.filter((r) => r.recommend === 'yes').length
  const answered = reviews.filter((r) => r.recommend).length

  return (
    <>
      {toast}

      {avg !== null ? (
        <div className="card">
          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            <div className="center" style={{ flex: 'none' }}>
              <div className="big-score">{avg.toFixed(1)}</div>
              <Stars value={Math.round(avg)} size={14} />
              <div className="tiny muted" style={{ marginTop: 3 }}>
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </div>
            </div>
            <div className="breakdown" style={{ flex: 1 }}>
              {spread.map((s) => (
                <div className="line" key={s.n}>
                  <span>{s.n} ★</span>
                  <span className="bar" style={{ height: 8 }}>
                    <i style={{ width: `${reviews.length ? (s.count / reviews.length) * 100 : 0}%` }} />
                  </span>
                  <span>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          {answered > 0 && (
            <p className="tiny muted center" style={{ margin: '13px 0 0' }}>
              {yes} of {answered} would recommend it
            </p>
          )}
        </div>
      ) : (
        <Empty icon="star" title="No reviews yet" hint="Finished it? You get the first word." />
      )}

      <button
        className="btn-primary btn-block"
        style={{ marginTop: 14 }}
        onClick={() => setWriting(true)}
      >
        <Icon name={mine ? 'pencil' : 'star'} size={16} />
        {mine ? 'Edit my review' : 'Write my review'}
      </button>

      {reviews.length > 0 && (
        <>
          <Section icon="chat">Everyone's reviews</Section>
          <div className="stack">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} isMine={r.user_id === userId} />
            ))}
          </div>
        </>
      )}

      <Section icon="sliders">This book</Section>
      <button className="btn-soft btn-block btn-sm" onClick={() => setManaging((m) => !m)}>
        {managing ? 'Hide options' : 'Edit details, move it, or take it off the shelf'}
      </button>

      {managing && (
        <BookControls
          book={book}
          userId={userId}
          onDone={async (msg) => { await onBookChange(); showToast(msg) }}
        />
      )}

      {writing && (
        <ReviewForm
          book={book}
          userId={userId}
          existing={mine}
          onClose={() => setWriting(false)}
          onSaved={async () => { setWriting(false); await load(); showToast('Review saved') }}
        />
      )}
    </>
  )
}

/* ---------------- one review ---------------- */
function ReviewCard({ review, isMine }) {
  const bits = [
    ['What I loved',         review.liked],
    ['What I did not enjoy', review.disliked],
    ['Favourite character',  review.fav_character],
  ].filter(([, v]) => v)

  return (
    <div className="card">
      <div className="row" style={{ gap: 11, marginBottom: 9 }}>
        <AvatarLink profile={review.profiles} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="between">
            <span>
              <NameLink profile={review.profiles} />
              {isMine && <span className="muted tiny"> · you</span>}
            </span>
            <span className="tiny muted">{timeAgo(review.updated_at ?? review.created_at)}</span>
          </div>
          <div className="row" style={{ gap: 7, marginTop: 3 }}>
            <Stars value={review.rating} size={14} />
            <span className="tiny muted">{review.rating}/5</span>
          </div>
        </div>
      </div>

      {review.summary && (
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '0.95rem' }}>“{review.summary}”</p>
      )}
      {review.review && (
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{review.review}</p>
      )}

      {bits.map(([label, value]) => (
        <div className="qa" key={label}>
          <b>{label}</b>
          <p>{value}</p>
        </div>
      ))}

      {review.fav_quote && <p className="quote">“{review.fav_quote}”</p>}

      {review.recommend && (
        <div style={{ marginTop: 11 }}><RecommendPill value={review.recommend} /></div>
      )}
    </div>
  )
}

/* ---------------- the review template ---------------- */
const BLANK = {
  rating: 0, summary: '', review: '', liked: '', disliked: '',
  fav_character: '', fav_quote: '', recommend: '',
}

function ReviewForm({ book, userId, existing, onClose, onSaved }) {
  const [confirmNode, askDelete] = useConfirm()
  const [form, setForm] = useState(() => ({
    ...BLANK,
    ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, existing?.[k] ?? BLANK[k]])),
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.rating) return setError('Pick a star rating first.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('ratings').upsert(
      {
        book_id: book.id,
        user_id: userId,
        rating: form.rating,
        summary: form.summary.trim() || null,
        review: form.review.trim() || null,
        liked: form.liked.trim() || null,
        disliked: form.disliked.trim() || null,
        fav_character: form.fav_character.trim() || null,
        fav_quote: form.fav_quote.trim() || null,
        recommend: form.recommend || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'book_id,user_id' }
    )
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  function confirmRemove() {
    askDelete({
      title: 'Delete my review?',
      body: 'Your rating and everything you wrote about this book will be removed, and the club average will change. This can\u2019t be undone.',
      run: async () => {
        await supabase.from('ratings').delete().eq('book_id', book.id).eq('user_id', userId)
        onSaved()
      },
    })
  }

  return (
    <Modal title={existing ? 'Edit my review' : 'My review'} onClose={onClose}>
      {confirmNode}
      {error && <div className="error-box">{error}</div>}
      <p className="muted" style={{ marginTop: -6 }}>
        {book.title} · only the stars are required, skip anything you don't feel like.
      </p>

      <label>Overall</label>
      <div style={{ marginBottom: 15 }}>
        <Stars value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} size={32} />
      </div>

      <div className="field">
        <label>In one line</label>
        <input value={form.summary} onChange={set('summary')} placeholder="Gorgeous, devastating, would suffer again" maxLength={120} />
      </div>

      <div className="field">
        <label>The full review</label>
        <textarea value={form.review} onChange={set('review')} placeholder="What did you actually think?" style={{ minHeight: 120 }} />
      </div>

      <div className="field">
        <label>What I loved</label>
        <textarea value={form.liked} onChange={set('liked')} placeholder="The banter. The world. That one scene." style={{ minHeight: 66 }} />
      </div>

      <div className="field">
        <label>What I did not enjoy</label>
        <textarea value={form.disliked} onChange={set('disliked')} placeholder="The middle dragged a little…" style={{ minHeight: 66 }} />
      </div>

      <div className="field">
        <label>Favourite character</label>
        <input value={form.fav_character} onChange={set('fav_character')} placeholder="and why they own me" />
      </div>

      <div className="field">
        <label>Favourite quote</label>
        <textarea value={form.fav_quote} onChange={set('fav_quote')} placeholder="The line you screenshotted" style={{ minHeight: 66 }} />
      </div>

      <label>Would you recommend it?</label>
      <div className="row" style={{ gap: 7, marginBottom: 18 }}>
        {[['yes', 'Yes'], ['maybe', 'Depends'], ['no', 'No']].map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={form.recommend === v ? 'btn-primary btn-sm' : 'btn-soft btn-sm'}
            style={{ flex: 1 }}
            onClick={() => setForm((f) => ({ ...f, recommend: f.recommend === v ? '' : v }))}
          >
            {label}
          </button>
        ))}
      </div>

      <button className="btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : existing ? 'Update my review' : 'Post my review'}
      </button>

      {existing && (
        <button className="btn-ghost btn-block btn-sm" onClick={confirmRemove} style={{ marginTop: 8 }}>
          Delete my review
        </button>
      )}
    </Modal>
  )
}

/* ---------------- move / remove a book ---------------- */
function BookControls({ book, userId, onDone }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmNode, askDelete] = useConfirm()

  async function setStatus(status) {
    setBusy(true)
    const patch = { status }
    if (status === 'current')  patch.started_on  = new Date().toISOString().slice(0, 10)
    if (status === 'finished') patch.finished_on = new Date().toISOString().slice(0, 10)
    await supabase.from('books').update(patch).eq('id', book.id)
    setBusy(false)
    onDone(status === 'current' ? 'Now reading!' : 'Library updated')
  }

  function confirmRemove() {
    askDelete({
      title: `Delete \u201c${book.title}\u201d?`,
      body: 'This also removes its theory board, every chapter update, and everyone\u2019s reviews of it. That can\u2019t be undone \u2014 if you just want it off the shelf, move it to TBR instead.',
      confirmLabel: 'Delete everything',
      run: async () => {
        await supabase.from('books').delete().eq('id', book.id)
        navigate('/library')
      },
    })
  }

  return (
    <div className="card card-tight" style={{ marginTop: 10 }}>
      {confirmNode}
      <p className="tiny muted" style={{ marginTop: 0 }}>
        Making this the current book files the old one under Finished. Its theory
        board and chapter updates stay exactly where they are.
      </p>
      <div className="row-wrap">
        <button className="btn-soft btn-sm" onClick={() => setEditing(true)}>
          <Icon name="pencil" size={15} /> Edit details
        </button>
        {book.status !== 'current'  && <button className="btn-soft btn-sm"  onClick={() => setStatus('current')}  disabled={busy}><Icon name="bookopen" size={15} /> Read this now</button>}
        {book.status !== 'finished' && <button className="btn-lilac btn-sm" onClick={() => setStatus('finished')} disabled={busy}><Icon name="check" size={15} /> Mark finished</button>}
        {book.status !== 'upcoming' && <button className="btn-ghost btn-sm" onClick={() => setStatus('upcoming')} disabled={busy}><Icon name="bookmark" size={15} /> Up next</button>}
        {book.status !== 'tbr'      && <button className="btn-ghost btn-sm" onClick={() => setStatus('tbr')}      disabled={busy}><Icon name="clock" size={15} /> Move to TBR</button>}
        {book.added_by === userId   && <button className="btn-danger btn-sm" onClick={confirmRemove} disabled={busy}><Icon name="trash" size={15} /> Delete</button>}
      </div>

      {editing && (
        <EditBook
          book={book}
          userId={userId}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onDone('Book updated') }}
        />
      )}
    </div>
  )
}

/* ---------------- edit a book's details (incl. its cover) ---------------- */
function EditBook({ book, userId, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: book.title ?? '',
    author: book.author ?? '',
    description: book.description ?? '',
    total_chapters: book.total_chapters ?? 1,
  })
  const [genres, setGenres] = useState(book.genres ?? [])
  const [coverUrl, setCoverUrl] = useState(book.cover_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function uploadCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) return setError('That image is over 8 MB — try a smaller one.')
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

  async function save() {
    if (!form.title.trim()) return setError('A book needs a title!')
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('books')
      .update({
        title: form.title.trim(),
        author: form.author.trim() || null,
        description: form.description.trim() || null,
        total_chapters: Number(form.total_chapters) || 1,
        cover_url: coverUrl,
        genres,
      })
      .eq('id', book.id)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal title="Edit details" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}

      <div className="row" style={{ gap: 14, marginBottom: 16 }}>
        <Cover book={{ cover_url: coverUrl, title: form.title }} w={78} />
        <div>
          <button className="btn-soft btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon name="camera" size={15} />
            {uploading ? 'Uploading…' : coverUrl ? 'Replace cover' : 'Add a cover'}
          </button>
          <p className="muted tiny" style={{ margin: '6px 0 0' }}>
            A photo of your copy is perfect.
          </p>
          {coverUrl && (
            <button
              className="btn-ghost btn-sm"
              style={{ marginTop: 4 }}
              onClick={() => setCoverUrl(null)}
            >
              Remove
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadCover} style={{ display: 'none' }} />
        </div>
      </div>

      <div className="field">
        <label>Title</label>
        <input value={form.title} onChange={set('title')} />
      </div>
      <div className="field">
        <label>Author</label>
        <input value={form.author} onChange={set('author')} />
      </div>
      <div className="field">
        <label>Chapters</label>
        <input type="number" min={1} value={form.total_chapters} onChange={set('total_chapters')} />
      </div>
      <div className="field">
        <label>Genres</label>
        <GenrePicker value={genres} onChange={setGenres} />
      </div>
      <div className="field" style={{ marginTop: 13 }}>
        <label>Description</label>
        <textarea value={form.description} onChange={set('description')} />
      </div>

      <button className="btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save details'}
      </button>
    </Modal>
  )
}
