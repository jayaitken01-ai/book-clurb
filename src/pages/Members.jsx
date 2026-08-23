import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Avatar, Empty, Spinner } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Members() {
  const [members, setMembers] = useState(null)
  const [counts, setCounts] = useState({})

  useEffect(() => {
    ;(async () => {
      const { data: people } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })

      const { data: done } = await supabase
        .from('reading_progress')
        .select('user_id')
        .eq('finished', true)

      const tally = {}
      ;(done ?? []).forEach((r) => {
        tally[r.user_id] = (tally[r.user_id] ?? 0) + 1
      })

      setCounts(tally)
      setMembers(people ?? [])
    })()
  }, [])

  if (!members) return <Spinner />

  return (
    <div className="page">
      <div className="between">
        <h1 style={{ margin: 0 }}>The club</h1>
        <Link to="/profile" className="btn btn-ghost btn-sm"><Icon name="back" size={15} /> Back</Link>
      </div>
      <p className="muted">{members.length} {members.length === 1 ? 'member' : 'members'} so far</p>

      {members.length === 0 ? (
        <Empty icon="users" title="No one here yet" hint="Share the link with your friends!" />
      ) : (
        <div className="stack">
          {members.map((m) => (
            <div className="card card-tight" key={m.id}>
              <div className="row" style={{ gap: 13 }}>
                <Avatar profile={m} size={52} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{m.full_name}</b>
                  {m.bio && <div className="muted tiny" style={{ marginTop: 2 }}>{m.bio}</div>}
                  <div className="row-wrap tiny muted" style={{ marginTop: 5, gap: 12 }}>
                    {m.email && <span><Icon name="mail" size={12} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {m.email}</span>}
                    {m.phone && <span><Icon name="phone" size={12} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {m.phone}</span>}
                  </div>
                </div>
                <span className="pill pill-lilac"><Icon name="books" size={13} /> {counts[m.id] ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
