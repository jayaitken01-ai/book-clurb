import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { MOODS, moodOf } from '../lib/moods.js'
import { Avatar, AvatarLink, Empty, LikeButton, Modal, NameLink, Spinner, timeAgo, useConfirm } from './ui.jsx'
import Icon from './Icon.jsx'

/**
 * The chapter update feed for one book.
 *
 * Spoiler protection is enforced by the database: the "no spoilers ahead"
 * policy in schema.sql only ever returns updates for chapters you have
 * already reached, so there is nothing here for a curious person to
 * inspect their way around.
 */
export default function ChapterFeed({ book, userId, limit, onCountChange }) {
  const [updates, setUpdates] = useState(null)
  const [myChapter, setMyChapter] = useState(0)
  const [finished, setFinished] = useState(false)
  const [hidden, setHidden] = useState(0)
  const [composing, setComposing] = useState(false)
  const [movingChapter, setMovingChapter] = useState(false)

  const load = useCallback(async () => {
    const [{ data: rows }, { data: prog }, { data: locked }] = await Promise.all([
      supabase
        .from('chapter_updates')
        .select('*, profiles(*), chapter_update_likes(user_id)')
        .eq('book_id', book.id)
        .order('chapter', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('reading_progress')
        .select('current_chapter, finished')
        .eq('book_id', book.id)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.rpc('hidden_updates', { p_book: book.id }),
    ])

    setUpdates(rows ?? [])
    setMyChapter(prog?.current_chapter ?? 0)
    setFinished(prog?.finished ?? false)
    setHidden(locked ?? 0)
    onCountChange?.(rows?.length ?? 0)
  }, [book.id, userId, onCountChange])

  useEffect(() => { load() }, [load])

  async function moveTo(chapter, done = false) {
    await supabase.from('reading_progress').upsert(
      {
        book_id: book.id,
        user_id: userId,
        current_chapter: Number(chapter) || 0,
        finished: done,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'book_id,user_id' }
    )
    setMovingChapter(false)
    load()
  }

  if (!updates) return <Spinner />

  const shown = limit ? updates.slice(0, limit) : updates

  return (
    <>
      {/* where I am — this is the key that unlocks other people's updates */}
      <div className="card card-tight" style={{ marginBottom: 14 }}>
        <div className="between">
          <div>
            <div className="tiny muted">I'm on</div>
            <b style={{ fontSize: '1.05rem' }}>
              {finished ? 'Finished the book' : `Chapter ${myChapter}`}
            </b>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn-soft btn-sm" onClick={() => setMovingChapter(true)}>Change</button>
            <button className="btn-primary btn-sm" onClick={() => setComposing(true)}>
              <Icon name="plus" size={15} /> Update
            </button>
          </div>
        </div>
        <div className="bar" style={{ marginTop: 10, height: 7 }}>
          <i style={{ width: `${Math.min(100, ((finished ? book.total_chapters : myChapter) / (book.total_chapters || 1)) * 100)}%` }} />
        </div>
      </div>

      {hidden > 0 && (
        <div className="locked" style={{ marginBottom: 14 }}>
          <span className="big"><Icon name="lock" size={26} /></span>
          <b>{hidden} {hidden === 1 ? 'update is' : 'updates are'} waiting past chapter {myChapter}</b>
          <p className="hand" style={{ margin: '4px 0 0' }}>
            they unlock as you read — nobody can spoil you by accident
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty
          icon="pin"
          title="No updates you can see yet"
          hint="Post how the last chapter made you feel — you don't have to do every chapter."
        />
      ) : (
        <div className="stack">
          {shown.map((u) => (
            <UpdateCard key={u.id} update={u} userId={userId} onChange={load} />
          ))}
        </div>
      )}

      {composing && (
        <Composer
          book={book}
          userId={userId}
          startChapter={finished ? book.total_chapters : Math.min(myChapter + 1, book.total_chapters)}
          onClose={() => setComposing(false)}
          onPosted={() => { setComposing(false); load() }}
        />
      )}

      {movingChapter && (
        <ChapterPicker
          book={book}
          current={myChapter}
          finished={finished}
          onClose={() => setMovingChapter(false)}
          onSave={moveTo}
        />
      )}
    </>
  )
}

/* ---------------- one update ---------------- */
function UpdateCard({ update, userId, onChange }) {
  const [editing, setEditing] = useState(false)
  const [confirmNode, askDelete] = useConfirm()
  const mood = moodOf(update.mood)
  const likes = update.chapter_update_likes ?? []
  const liked = likes.some((l) => l.user_id === userId)

  async function toggleLike() {
    if (liked) {
      await supabase.from('chapter_update_likes').delete()
        .eq('update_id', update.id).eq('user_id', userId)
    } else {
      await supabase.from('chapter_update_likes').insert({ update_id: update.id, user_id: userId })
    }
    onChange()
  }

  function confirmRemove() {
    askDelete({
      title: 'Delete this update?',
      body: 'Your chapter update and its likes will be removed. This can\u2019t be undone.',
      run: async () => {
        await supabase.from('chapter_updates').delete().eq('id', update.id)
        onChange()
      },
    })
  }

  return (
    <div className="card card-tight">
      {confirmNode}
      <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
        <AvatarLink profile={update.profiles} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="between">
            <NameLink profile={update.profiles} style={{ fontSize: '0.92rem' }} />
            <span className="tiny muted">{timeAgo(update.created_at)}</span>
          </div>
          <div className="row-wrap" style={{ gap: 6, marginTop: 5 }}>
            <span className="pill">Chapter {update.chapter}</span>
            {mood && (
              <span className="mood-chip"><span className="face">{mood.emoji}</span>{mood.label}</span>
            )}
          </div>
          {update.comment && (
            <p style={{ margin: '9px 0 0', fontSize: '0.9rem', lineHeight: 1.55 }}>{update.comment}</p>
          )}
          <div className="row" style={{ gap: 6, marginTop: 9 }}>
            <LikeButton liked={liked} count={likes.length} onClick={toggleLike} />
            <span className="spacer" />
            {update.user_id === userId && (
              <>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(true)} aria-label="Edit update">
                  <Icon name="pencil" size={15} />
                </button>
                <button className="btn-ghost btn-sm" onClick={confirmRemove} aria-label="Delete update">
                  <Icon name="trash" size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditUpdate
          update={update}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChange() }}
        />
      )}
    </div>
  )
}

/* ---------------- edit an update you already posted ---------------- */
function EditUpdate({ update, onClose, onSaved }) {
  const [mood, setMood] = useState(update.mood ?? null)
  const [comment, setComment] = useState(update.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    if (!mood && !comment.trim()) return setError('Pick a mood or leave a comment.')
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('chapter_updates')
      .update({ mood, comment: comment.trim() || null })
      .eq('id', update.id)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal title={`Edit chapter ${update.chapter}`} onClose={onClose}>
      {error && <div className="error-box">{error}</div>}

      <label>How did it make you feel?</label>
      <div className="moods" style={{ marginBottom: 14 }}>
        {MOODS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`mood${mood === m.key ? ' on' : ''}`}
            onClick={() => setMood(mood === m.key ? null : m.key)}
          >
            <span className="face">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Your comment</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      </div>

      <button className="btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
      <p className="tiny muted center" style={{ margin: '9px 0 0' }}>
        The chapter number stays as it was, so nobody gets spoiled by an edit.
      </p>
    </Modal>
  )
}

/* ---------------- post an update ---------------- */
function Composer({ book, userId, startChapter, onClose, onPosted }) {
  const [chapter, setChapter] = useState(startChapter || 1)
  const [mood, setMood] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function post() {
    if (!mood && !comment.trim()) return setError('Pick a mood or leave a comment.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('chapter_updates').insert({
      book_id: book.id,
      user_id: userId,
      chapter: Number(chapter) || 0,
      mood,
      comment: comment.trim() || null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    onPosted()
  }

  return (
    <Modal title="Chapter update" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}
      <p className="muted" style={{ marginTop: -6 }}>{book.title}</p>

      <div className="field">
        <label>Which chapter?</label>
        <input
          type="number"
          min={0}
          max={book.total_chapters}
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
        />
        <p className="muted tiny" style={{ marginTop: 5 }}>
          of {book.total_chapters} · posting this means you've read this far
        </p>
      </div>

      <label>How did it make you feel?</label>
      <div className="moods" style={{ marginBottom: 14 }}>
        {MOODS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`mood${mood === m.key ? ' on' : ''}`}
            onClick={() => setMood(mood === m.key ? null : m.key)}
          >
            <span className="face">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Say more (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="I am not okay after that last page"
          maxLength={500}
        />
      </div>

      <button className="btn-primary btn-block" onClick={post} disabled={busy}>
        {busy ? 'Posting…' : 'Post update'}
      </button>
    </Modal>
  )
}

/* ---------------- move my bookmark ---------------- */
function ChapterPicker({ book, current, finished, onClose, onSave }) {
  const [chapter, setChapter] = useState(current)
  const [done, setDone] = useState(finished)

  return (
    <Modal title="Where are you?" onClose={onClose}>
      <p className="muted" style={{ marginTop: -6 }}>
        This is what unlocks other people's updates — you'll only ever see posts
        for chapters you've already read.
      </p>

      <div className="field">
        <label>I'm on chapter</label>
        <input
          type="number"
          min={0}
          max={book.total_chapters}
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          disabled={done}
        />
      </div>

      <label className="row" style={{ gap: 9, marginBottom: 16, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--accent-500)' }}
        />
        <span style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>
          I finished this book — show me everything
        </span>
      </label>

      <button className="btn-primary btn-block" onClick={() => onSave(chapter, done)}>
        Save
      </button>
    </Modal>
  )
}
