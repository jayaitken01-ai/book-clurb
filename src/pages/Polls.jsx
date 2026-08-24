import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  Avatar, AvatarLink, Countdown, Cover, Empty, Modal, NameLink, Section,
  Spinner, monthYear, timeAgo, useConfirm, useToast,
} from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import GenrePicker from '../components/GenrePicker.jsx'

/**
 * Picking the next book happens in two phases:
 *
 *   1. Collecting — someone starts a poll, then for 24 hours every member
 *      can add one suggestion of their own (title, author, genres).
 *   2. Voting — suggestions lock, everyone votes for 24 or 48 hours.
 *
 * When the clock runs out the database settles it: the winner becomes the
 * book we're reading, and every other suggestion lands on the TBR shelf.
 * Nobody has to press anything.
 */
export default function Polls() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [polls, setPolls] = useState(null)
  const [tbr, setTbr] = useState([])
  const [creating, setCreating] = useState(false)
  const [toast, showToast] = useToast()

  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    // Let the database move any polls whose clock has run out.
    await supabase.rpc('settle_polls')

    // Fetched as separate queries rather than one nested join.
    // `polls` and `poll_options` are linked twice — once by which poll an
    // option belongs to, and once by which option won — so asking for them
    // together is ambiguous and fails the whole query. Keeping them apart
    // sidesteps that entirely, and means one broken piece can't blank the page.
    const { data: rows, error } = await supabase
      .from('polls')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError(error.message)
      setPolls([])
      return
    }
    setLoadError(null)

    const ids = (rows ?? []).map((p) => p.id)
    const [{ data: people }, { data: options }, { data: votes }, { data: shelf }] =
      await Promise.all([
        supabase.from('profiles').select('*'),
        ids.length
          ? supabase.from('poll_options').select('*').in('poll_id', ids).order('created_at')
          : Promise.resolve({ data: [] }),
        ids.length
          ? supabase.from('poll_votes').select('*').in('poll_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('books').select('*').eq('status', 'tbr').order('created_at'),
      ])

    const byId = Object.fromEntries((people ?? []).map((p) => [p.id, p]))

    setPolls(
      (rows ?? []).map((p) => ({
        ...p,
        profiles: byId[p.created_by] ?? null,
        poll_options: (options ?? [])
          .filter((o) => o.poll_id === p.id)
          .map((o) => ({ ...o, profiles: byId[o.suggested_by] ?? null })),
        poll_votes: (votes ?? []).filter((v) => v.poll_id === p.id),
      }))
    )
    setTbr(shelf ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  // Arriving from the "Start a poll" button on the homepage opens the
  // sheet straight away, so it takes one tap rather than three.
  useEffect(() => {
    if (params.get('new') === '1' && polls && !polls.some((p) => p.phase !== 'closed')) {
      setCreating(true)
      setParams({}, { replace: true })
    }
  }, [params, polls, setParams])

  useEffect(() => {
    const ch = supabase
      .channel('poll-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  if (!polls) return <Spinner />

  const live = polls.filter((p) => p.phase !== 'closed')
  const done = polls.filter((p) => p.phase === 'closed')
  const somethingRunning = live.length > 0

  return (
    <div className="page">
      {toast}
      <div className="between">
        <h1 style={{ margin: 0 }}>Polls</h1>
        {!somethingRunning && (
          <button className="btn-primary btn-sm" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New poll
          </button>
        )}
      </div>
      <p className="hand">everyone gets one suggestion and one vote</p>

      {loadError && (
        <div className="error-box">Couldn’t load polls: {loadError}</div>
      )}

      {polls.length === 0 && (
        <Empty
          icon="ballot"
          title="No polls yet"
          hint="Start one and the club has a day to throw in suggestions."
        />
      )}

      {live.map((p) => (
        <PollCard key={p.id} poll={p} userId={user.id} tbr={tbr} onChange={load} notify={showToast} />
      ))}

      {somethingRunning && (
        <p className="muted tiny center" style={{ marginTop: 14 }}>
          One poll at a time keeps things simple — start the next once this one closes.
        </p>
      )}

      {done.length > 0 && (
        <>
          <Section icon="books" note={`${done.length}`}>Poll archive</Section>
          <p className="muted tiny" style={{ margin: '-6px 0 12px' }}>
            Every poll we've ever run, newest first. Results stay on the homepage
            for 48 hours, then land here.
          </p>
          {done.map((p) => (
            <PollCard key={p.id} poll={p} userId={user.id} tbr={tbr} onChange={load} notify={showToast} />
          ))}
        </>
      )}

      {creating && (
        <NewPoll
          userId={user.id}
          tbr={tbr}
          onClose={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await load(); showToast('Poll is open for suggestions') }}
        />
      )}
    </div>
  )
}

/* ============================================================
   ONE POLL
   ============================================================ */
function PollCard({ poll, userId, tbr, onChange, notify }) {
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [editingPoll, setEditingPoll] = useState(false)
  const [confirmNode, askDelete] = useConfirm()

  const options = poll.poll_options ?? []
  const votes = poll.poll_votes ?? []
  const myVote = votes.find((v) => v.user_id === userId)
  const mySuggestion = options.find((o) => o.suggested_by === userId)
  const isMine = poll.created_by === userId

  const tally = {}
  votes.forEach((v) => { tally[v.option_id] = (tally[v.option_id] ?? 0) + 1 })
  const totalVotes = votes.length
  const winner = options.find((o) => o.id === poll.winner_option_id)

  async function vote(optionId) {
    if (poll.phase !== 'voting' || busy) return
    setBusy(true)
    if (myVote?.option_id === optionId) {
      await supabase.from('poll_votes').delete().eq('id', myVote.id)
    } else {
      await supabase.from('poll_votes').upsert(
        { poll_id: poll.id, option_id: optionId, user_id: userId, voted_at: new Date().toISOString() },
        { onConflict: 'poll_id,user_id' }
      )
    }
    setBusy(false)
    onChange()
  }

  async function withdraw() {
    setBusy(true)
    await supabase.from('poll_options').delete().eq('id', mySuggestion.id)
    setBusy(false)
    onChange()
    notify('Suggestion withdrawn')
  }

  function confirmRemove() {
    askDelete({
      title: 'Cancel this poll?',
      body: `The poll and all ${options.length} ${options.length === 1 ? 'suggestion' : 'suggestions'} will be removed. Nothing goes to the TBR shelf. This can\u2019t be undone.`,
      confirmLabel: 'Cancel poll',
      run: async () => {
        await supabase.from('polls').delete().eq('id', poll.id)
        onChange()
        notify('Poll cancelled')
      },
    })
  }

  /* ---- phase banner ---- */
  const banner = {
    collecting: {
      cls: 'phase-collect', icon: 'plus',
      text: 'Adding suggestions — everyone gets one',
      until: poll.suggest_until,
    },
    voting: {
      cls: 'phase-vote', icon: 'ballot',
      text: 'Voting is open',
      until: poll.vote_until,
    },
    closed: {
      cls: 'phase-closed', icon: 'check',
      text: winner ? `${winner.title} won` : 'Closed with no votes',
      until: null,
    },
  }[poll.phase]

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {confirmNode}
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{poll.question}</h3>
          <div className="row tiny muted" style={{ gap: 7, marginTop: 6 }}>
            <AvatarLink profile={poll.profiles} size={20} />
            <span>
              started by <NameLink profile={poll.profiles} style={{ fontSize: 'inherit' }} />
              {' · '}{timeAgo(poll.created_at)}
              {poll.phase === 'closed' && poll.closed_at && ` · closed ${timeAgo(poll.closed_at)}`}
            </span>
          </div>
        </div>
      </div>

      <div className={`phase ${banner.cls}`} style={{ marginTop: 13 }}>
        <Icon name={banner.icon} size={18} />
        <span style={{ flex: 1 }}>{banner.text}</span>
        {banner.until && <Countdown until={banner.until} />}
      </div>

      {/* ---------------- COLLECTING ---------------- */}
      {poll.phase === 'collecting' && (
        <>
          <div className="stack" style={{ gap: 9 }}>
            {options.map((o) => (
              <div className={`suggestion${o.suggested_by === userId ? ' mine' : ''}`} key={o.id}>
                <Cover book={o} w={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: '0.9rem' }}>{o.title}</b>
                  {o.author && <div className="tiny muted">{o.author}</div>}
                  {o.genres?.length > 0 && (
                    <div className="row-wrap" style={{ gap: 5, marginTop: 5 }}>
                      {o.genres.map((g) => <span className="genre-tag" key={g}>{g}</span>)}
                    </div>
                  )}
                  <div className="tiny muted" style={{ marginTop: 5 }}>
                    from {o.suggested_by === userId
                      ? 'you'
                      : <NameLink profile={o.profiles} style={{ fontSize: 'inherit' }} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {options.length === 0 && (
            <div className="waiting">Nothing suggested yet — go first!</div>
          )}

          <div style={{ marginTop: 12 }}>
            {mySuggestion ? (
              <div className="row" style={{ gap: 8 }}>
                <span className="pill pill-mint" style={{ flex: 1, justifyContent: 'center', padding: '9px' }}>
                  <Icon name="check" size={14} /> Your suggestion is in
                </span>
                <button className="btn-ghost btn-sm" onClick={withdraw} disabled={busy}>Change it</button>
              </div>
            ) : (
              <button className="btn-primary btn-block" onClick={() => setSuggesting(true)}>
                <Icon name="plus" size={16} /> Add my suggestion
              </button>
            )}
          </div>

          <p className="tiny muted center" style={{ margin: '11px 0 0' }}>
            When the clock runs out, voting opens for {poll.vote_hours} hours.
          </p>
        </>
      )}

      {/* ---------------- VOTING / CLOSED ---------------- */}
      {poll.phase !== 'collecting' && (
        <>
          {options.length === 0 ? (
            <div className="waiting">Nobody suggested anything in time.</div>
          ) : (
            <div className="stack" style={{ gap: 9 }}>
              {options.map((o) => {
                const count = tally[o.id] ?? 0
                const pct = totalVotes ? (count / totalVotes) * 100 : 0
                const picked = myVote?.option_id === o.id
                const won = poll.winner_option_id === o.id
                return (
                  <button
                    key={o.id}
                    className={`option${picked ? ' picked' : ''}`}
                    onClick={() => vote(o.id)}
                    disabled={busy || poll.phase !== 'voting'}
                  >
                    <span className="fill" style={{ width: `${pct}%` }} />
                    <span className="inner">
                      <Cover book={o} w={34} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'block' }}>
                          {won && <Icon name="crown" size={15} style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: 5, color: 'var(--gold)' }} />}
                          {o.title}
                        </b>
                        {o.author && <span className="tiny muted">{o.author}</span>}
                        {o.genres?.length > 0 && (
                          <span className="tiny muted" style={{ display: 'block' }}>{o.genres.join(' · ')}</span>
                        )}
                      </span>
                      <b style={{ color: 'var(--pink-600)' }}>{count}</b>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <p className="tiny muted center" style={{ margin: '11px 0 0' }}>
            {poll.phase === 'voting'
              ? `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'} so far · the winner becomes our next read automatically`
              : 'Everything that did not win is on the TBR shelf.'}
          </p>
        </>
      )}

      {isMine && poll.phase !== 'closed' && (
        <>
          <hr className="divider" />
          <div className="row-wrap">
            {poll.phase === 'collecting' && (
              <button className="btn-soft btn-sm" onClick={() => setEditingPoll(true)} disabled={busy}>
                <Icon name="pencil" size={15} /> Edit poll
              </button>
            )}
            <button className="btn-danger btn-sm" onClick={confirmRemove} disabled={busy}>
              <Icon name="trash" size={15} /> Cancel this poll
            </button>
          </div>
        </>
      )}

      {editingPoll && (
        <EditPoll
          poll={poll}
          onClose={() => setEditingPoll(false)}
          onSaved={async () => { setEditingPoll(false); await onChange(); notify('Poll updated') }}
        />
      )}

      {suggesting && (
        <SuggestBook
          poll={poll}
          userId={userId}
          tbr={tbr}
          onClose={() => setSuggesting(false)}
          onAdded={async () => { setSuggesting(false); await onChange(); notify('Suggestion added') }}
        />
      )}
    </div>
  )
}

/* ============================================================
   EDIT A POLL (creator only, while suggestions are still open)
   ============================================================ */
function EditPoll({ poll, onClose, onSaved }) {
  const [question, setQuestion] = useState(poll.question)
  const [voteHours, setVoteHours] = useState(poll.vote_hours)
  const [extraHours, setExtraHours] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    setBusy(true)
    setError(null)

    const patch = {
      question: question.trim() || 'What should we read next?',
      vote_hours: Number(voteHours),
    }
    if (Number(extraHours) > 0) {
      patch.suggest_until = new Date(
        new Date(poll.suggest_until).getTime() + Number(extraHours) * 3600 * 1000
      ).toISOString()
    }

    const { error } = await supabase.from('polls').update(patch).eq('id', poll.id)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Modal title="Edit poll" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Question</label>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>

      <div className="field">
        <label>Voting will run for</label>
        <select value={voteHours} onChange={(e) => setVoteHours(e.target.value)}>
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
        </select>
      </div>

      <div className="field">
        <label>Give people longer to suggest?</label>
        <select value={extraHours} onChange={(e) => setExtraHours(e.target.value)}>
          <option value={0}>No, leave it as it is</option>
          <option value={6}>Add 6 hours</option>
          <option value={12}>Add 12 hours</option>
          <option value={24}>Add another day</option>
        </select>
        <p className="muted tiny" style={{ marginTop: 5 }}>
          Suggestions can only be extended, never cut short — nobody loses their chance.
        </p>
      </div>

      <button className="btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </Modal>
  )
}

/* ============================================================
   ADD A SUGGESTION
   ============================================================ */
function SuggestBook({ poll, userId, tbr, onClose, onAdded }) {
  const [mode, setMode] = useState(tbr.length ? 'tbr' : 'new')
  const [pick, setPick] = useState(null)
  const [form, setForm] = useState({ title: '', author: '', blurb: '' })
  const [genres, setGenres] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function add() {
    setError(null)
    let row

    if (mode === 'tbr') {
      if (!pick) return setError('Pick a book from the shelf, or add a new one.')
      const b = tbr.find((x) => x.id === pick)
      row = {
        poll_id: poll.id, suggested_by: userId, book_id: b.id,
        title: b.title, author: b.author, genres: b.genres ?? [],
        cover_url: b.cover_url, blurb: b.description,
      }
    } else {
      if (!form.title.trim()) return setError('What is the book called?')
      row = {
        poll_id: poll.id, suggested_by: userId,
        title: form.title.trim(),
        author: form.author.trim() || null,
        genres,
        blurb: form.blurb.trim() || null,
      }
    }

    setBusy(true)
    const { error } = await supabase.from('poll_options').insert(row)
    setBusy(false)
    if (error) return setError(error.message)
    onAdded()
  }

  return (
    <Modal title="My suggestion" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}

      {tbr.length > 0 && (
        <div className="subtabs">
          <button className={`subtab${mode === 'tbr' ? ' on' : ''}`} onClick={() => setMode('tbr')}>
            From the TBR shelf
          </button>
          <button className={`subtab${mode === 'new' ? ' on' : ''}`} onClick={() => setMode('new')}>
            Something new
          </button>
        </div>
      )}

      {mode === 'tbr' ? (
        <div className="stack" style={{ gap: 9 }}>
          {tbr.map((b) => (
            <button
              key={b.id}
              className={`suggestion${pick === b.id ? ' mine' : ''}`}
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => setPick(b.id)}
            >
              <Cover book={b} w={38} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: '0.9rem' }}>{b.title}</b>
                {b.author && <span className="tiny muted">{b.author}</span>}
              </span>
              {pick === b.id && <Icon name="check" size={18} style={{ color: 'var(--pink-500)' }} />}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={set('title')} placeholder="What's it called?" />
          </div>
          <div className="field">
            <label>Author</label>
            <input value={form.author} onChange={set('author')} placeholder="Who wrote it?" />
          </div>
          <div className="field">
            <label>Genres</label>
            <GenrePicker value={genres} onChange={setGenres} />
          </div>
          <div className="field" style={{ marginTop: 13 }}>
            <label>Why this one? (optional)</label>
            <textarea value={form.blurb} onChange={set('blurb')} style={{ minHeight: 70 }} />
          </div>
        </>
      )}

      <button className="btn-primary btn-block" onClick={add} disabled={busy} style={{ marginTop: 14 }}>
        {busy ? 'Adding…' : 'Add my suggestion'}
      </button>
      <p className="tiny muted center" style={{ margin: '9px 0 0' }}>
        You can swap it out any time before suggestions close. Covers can be added later,
        once the book is in the library.
      </p>
    </Modal>
  )
}

/* ============================================================
   START A POLL
   ============================================================ */
function NewPoll({ userId, tbr, onClose, onCreated }) {
  const [question, setQuestion] = useState('What should we read next?')
  const [suggestHours, setSuggestHours] = useState(24)
  const [voteHours, setVoteHours] = useState(48)
  const [form, setForm] = useState({ title: '', author: '', blurb: '' })
  const [genres, setGenres] = useState([])
  const [fromTbr, setFromTbr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function create() {
    const usingTbr = Boolean(fromTbr)
    if (!usingTbr && !form.title.trim()) {
      return setError('Add your own suggestion to get things started.')
    }
    setBusy(true)
    setError(null)

    const { data: poll, error: pErr } = await supabase
      .from('polls')
      .insert({
        question: question.trim() || 'What should we read next?',
        created_by: userId,
        suggest_hours: suggestHours,
        suggest_until: new Date(Date.now() + suggestHours * 3600 * 1000).toISOString(),
        vote_hours: voteHours,
      })
      .select()
      .single()

    if (pErr) { setBusy(false); return setError(pErr.message) }

    const b = usingTbr ? tbr.find((x) => x.id === fromTbr) : null
    const { error: oErr } = await supabase.from('poll_options').insert(
      b
        ? {
            poll_id: poll.id, suggested_by: userId, book_id: b.id,
            title: b.title, author: b.author, genres: b.genres ?? [],
            cover_url: b.cover_url, blurb: b.description,
          }
        : {
            poll_id: poll.id, suggested_by: userId,
            title: form.title.trim(),
            author: form.author.trim() || null,
            genres,
            blurb: form.blurb.trim() || null,
          }
    )

    setBusy(false)
    if (oErr) return setError(oErr.message)
    onCreated()
  }

  return (
    <Modal title="Start a poll" onClose={onClose}>
      {error && <div className="error-box">{error}</div>}

      <p className="muted" style={{ marginTop: -6 }}>
        You add the first suggestion. Everyone else has {suggestHours} hours to add theirs,
        then voting runs for {voteHours}.
      </p>

      <div className="field">
        <label>Question</label>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Suggestions open for</label>
          <select value={suggestHours} onChange={(e) => setSuggestHours(Number(e.target.value))}>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
          </select>
        </div>
        <div className="field">
          <label>Then voting for</label>
          <select value={voteHours} onChange={(e) => setVoteHours(Number(e.target.value))}>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
          </select>
        </div>
      </div>

      <hr className="divider" />
      <label>Your suggestion</label>

      {tbr.length > 0 && (
        <div className="field">
          <select value={fromTbr} onChange={(e) => setFromTbr(e.target.value)}>
            <option value="">Add something new…</option>
            {tbr.map((b) => (
              <option key={b.id} value={b.id}>From TBR — {b.title}</option>
            ))}
          </select>
        </div>
      )}

      {!fromTbr && (
        <>
          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={set('title')} placeholder="What's it called?" />
          </div>
          <div className="field">
            <label>Author</label>
            <input value={form.author} onChange={set('author')} placeholder="Who wrote it?" />
          </div>
          <div className="field">
            <label>Genres</label>
            <GenrePicker value={genres} onChange={setGenres} />
          </div>
          <div className="field" style={{ marginTop: 13 }}>
            <label>Why this one? (optional)</label>
            <textarea value={form.blurb} onChange={set('blurb')} style={{ minHeight: 66 }} />
          </div>
        </>
      )}

      <button className="btn-primary btn-block" onClick={create} disabled={busy}>
        {busy ? 'Starting…' : 'Open for suggestions'}
      </button>
    </Modal>
  )
}
