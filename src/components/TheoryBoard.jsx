import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Avatar, Empty, LikeButton, Modal, Spinner, timeAgo } from './ui.jsx'
import Icon from './Icon.jsx'

const EMOJI_CHOICES = ['💭', '🔮', '👥', '💬', '💔', '🔥', '🕵️', '👑', '🌙', '⚔️', '🎭', '📌']

/** The theory board for one book: categories → threads → replies. */
export default function TheoryBoard({ book, userId }) {
  const [categories, setCategories] = useState(null)
  const [threads, setThreads] = useState([])
  const [myChapter, setMyChapter] = useState(0)
  const [active, setActive] = useState('all')
  const [newCategory, setNewCategory] = useState(false)
  const [newThread, setNewThread] = useState(false)

  const load = useCallback(async () => {
    const [{ data: cats }, { data: rows }, { data: prog }] = await Promise.all([
      supabase.from('theory_categories').select('*').eq('book_id', book.id).order('created_at'),
      supabase
        .from('theory_threads')
        .select('*, profiles(*), thread_replies(*, profiles(*)), thread_likes(user_id)')
        .eq('book_id', book.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('reading_progress')
        .select('current_chapter, finished')
        .eq('book_id', book.id)
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    setCategories(cats ?? [])
    setThreads(rows ?? [])
    setMyChapter(prog?.finished ? Number.MAX_SAFE_INTEGER : prog?.current_chapter ?? 0)
  }, [book.id, userId])

  useEffect(() => { load() }, [load])

  if (!categories) return <Spinner />

  const visible = active === 'all' ? threads : threads.filter((t) => t.category_id === active)
  const countFor = (id) => threads.filter((t) => t.category_id === id).length

  return (
    <>
      <div className="cats">
        <button className={`cat${active === 'all' ? ' on' : ''}`} onClick={() => setActive('all')}>
          All · {threads.length}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`cat${active === c.id ? ' on' : ''}`}
            onClick={() => setActive(c.id)}
          >
            {c.emoji} {c.name} · {countFor(c.id)}
          </button>
        ))}
        <button className="cat" onClick={() => setNewCategory(true)}>
          <Icon name="plus" size={14} /> Category
        </button>
      </div>

      <button className="btn-primary btn-block" onClick={() => setNewThread(true)} style={{ marginBottom: 16 }}>
        <Icon name="pencil" size={16} /> Start a discussion
      </button>

      {visible.length === 0 ? (
        <Empty
          icon="thought"
          title="Nothing here yet"
          hint="Start the first thread — no take too unhinged."
        />
      ) : (
        <div className="stack">
          {visible.map((t) => (
            <Thread
              key={t.id}
              thread={t}
              category={categories.find((c) => c.id === t.category_id)}
              myChapter={myChapter}
              userId={userId}
              onChange={load}
            />
          ))}
        </div>
      )}

      {newCategory && (
        <NewCategory
          bookId={book.id}
          userId={userId}
          onClose={() => setNewCategory(false)}
          onCreated={() => { setNewCategory(false); load() }}
        />
      )}

      {newThread && (
        <NewThread
          book={book}
          userId={userId}
          categories={categories}
          preselect={active === 'all' ? categories[0]?.id : active}
          defaultChapter={myChapter === Number.MAX_SAFE_INTEGER ? book.total_chapters : myChapter}
          onClose={() => setNewThread(false)}
          onCreated={() => { setNewThread(false); load() }}
        />
      )}
    </>
  )
}

/* ---------------- one thread ---------------- */
function Thread({ thread, category, myChapter, userId, onChange }) {
  const isSpoiler = thread.chapter_marker > myChapter
  const [revealed, setRevealed] = useState(!isSpoiler)
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const likes = thread.thread_likes ?? []
  const liked = likes.some((l) => l.user_id === userId)
  const replies = [...(thread.thread_replies ?? [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  async function toggleLike() {
    if (liked) {
      await supabase.from('thread_likes').delete()
        .eq('thread_id', thread.id).eq('user_id', userId)
    } else {
      await supabase.from('thread_likes').insert({ thread_id: thread.id, user_id: userId })
    }
    onChange()
  }

  async function send() {
    if (!reply.trim()) return
    setBusy(true)
    await supabase.from('thread_replies').insert({
      thread_id: thread.id,
      user_id: userId,
      body: reply.trim(),
    })
    setReply('')
    setBusy(false)
    onChange()
  }

  async function remove() {
    await supabase.from('theory_threads').delete().eq('id', thread.id)
    onChange()
  }

  return (
    <div className="card">
      <div className="row" style={{ gap: 11, marginBottom: 10 }}>
        <Avatar profile={thread.profiles} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{thread.profiles?.full_name ?? 'Someone'}</b>
          <div className="tiny muted">{timeAgo(thread.created_at)}</div>
        </div>
        {category && <span className="pill pill-lilac">{category.emoji} {category.name}</span>}
      </div>

      <div className={`spoiler${revealed ? '' : ' hidden'}`}>
        <div className="body">
          <h3 style={{ marginBottom: 6 }}>{thread.title}</h3>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.6 }}>
            {thread.body}
          </p>
        </div>
        {!revealed && (
          <div className="veil" onClick={() => setRevealed(true)}>
            <Icon name="eyeoff" size={24} />
            <span>Spoilers past chapter {thread.chapter_marker}</span>
            <span className="tiny">You're on chapter {myChapter} — tap to read anyway</span>
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 13 }}>
        <LikeButton liked={liked} count={likes.length} onClick={toggleLike} />
        <button className="btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
          <Icon name="chat" size={15} /> {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </button>
        <span className="spacer" />
        {thread.chapter_marker > 0 && <span className="pill pill-gold">ch. {thread.chapter_marker}+</span>}
        {thread.user_id === userId && (
          <button className="btn-ghost btn-sm" onClick={remove} aria-label="Delete thread">
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>

      {open && (
        <>
          <hr className="divider" />
          <div className="stack" style={{ gap: 11 }}>
            {replies.map((r) => (
              <div className="row" key={r.id} style={{ alignItems: 'flex-start', gap: 9 }}>
                <Avatar profile={r.profiles} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="tiny">
                    <b>{r.profiles?.full_name ?? 'Someone'}</b>{' '}
                    <span className="muted">{timeAgo(r.created_at)}</span>
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.88rem', lineHeight: 1.5 }}>{r.body}</p>
                </div>
              </div>
            ))}
            <div className="row" style={{ gap: 7 }}>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Add your take…"
              />
              <button className="btn-primary btn-sm" onClick={send} disabled={busy}>Send</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- new category ---------------- */
function NewCategory({ bookId, userId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💭')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function create() {
    if (!name.trim()) return setError('Give the category a name.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('theory_categories').insert({
      book_id: bookId, name: name.trim(), emoji, created_by: userId,
    })
    setBusy(false)
    if (error) return setError(error.message)
    onCreated()
  }

  return (
    <Modal title="New category" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}
      <p className="muted" style={{ marginTop: -6 }}>
        Categories keep the board tidy — things like “Ending predictions” or “Romance watch”.
      </p>

      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ending predictions" />
      </div>

      <label>Icon</label>
      <div className="row-wrap" style={{ gap: 6, marginBottom: 16 }}>
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            className={emoji === e ? 'btn-soft btn-sm' : 'btn-ghost btn-sm'}
            style={{ fontSize: '1.1rem', padding: '6px 10px' }}
            onClick={() => setEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>

      <button className="btn-primary btn-block" onClick={create} disabled={busy}>
        {busy ? 'Creating…' : 'Add category'}
      </button>
    </Modal>
  )
}

/* ---------------- new thread ---------------- */
function NewThread({ book, userId, categories, preselect, defaultChapter, onClose, onCreated }) {
  const [categoryId, setCategoryId] = useState(preselect ?? categories[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [chapter, setChapter] = useState(defaultChapter || 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function post() {
    if (!title.trim() || !body.trim()) return setError('Add a title and your thoughts!')
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('theory_threads').insert({
      book_id: book.id,
      category_id: categoryId || null,
      user_id: userId,
      title: title.trim(),
      body: body.trim(),
      chapter_marker: Number(chapter) || 0,
    })
    setBusy(false)
    if (error) return setError(error.message)
    onCreated()
  }

  return (
    <Modal title="Start a discussion" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}
      <p className="muted" style={{ marginTop: -6 }}>{book.title}</p>

      <div className="field">
        <label>Category</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The brother is definitely the villain"
        />
      </div>

      <div className="field">
        <label>Your thoughts</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Okay hear me out…"
          style={{ minHeight: 130 }}
        />
      </div>

      <div className="field">
        <label>Spoilers up to chapter</label>
        <input
          type="number"
          min={0}
          max={book.total_chapters}
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
        />
        <p className="muted tiny" style={{ marginTop: 5 }}>
          Anyone reading behind this sees a blur first. Set 0 for no spoilers.
        </p>
      </div>

      <button className="btn-primary btn-block" onClick={post} disabled={busy}>
        {busy ? 'Posting…' : 'Post it'}
      </button>
    </Modal>
  )
}
