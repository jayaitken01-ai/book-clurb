import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Avatar, Empty, Spinner, birthdayLabel } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Members() {
  const navigate = useNavigate()
  const [members, setMembers] = useState(null)
  const [counts, setCounts] = useState({})

  useEffect(() => {
    ;(async () => {
      const [{ data: people }, { data: done }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: true }),
        supabase.from('reading_progress').select('user_id').eq('finished', true),
      ])

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
        <button className="btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <Icon name="back" size={15} /> Back
        </button>
      </div>
      <p className="hand">{members.length} {members.length === 1 ? 'member' : 'members'} — tap anyone to see their profile</p>

      {members.length === 0 ? (
        <Empty icon="users" title="No one here yet" hint="Share the link with your friends!" />
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {members.map((m) => {
            const birthday = birthdayLabel(m.birth_month, m.birth_day)
            return (
              <Link to={`/member/${m.id}`} key={m.id} className="card card-tight member-card"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div className="member-row">
                  <Avatar profile={m} size={52} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{m.full_name}</b>
                    {m.bio && (
                      <div className="muted tiny" style={{ marginTop: 2 }}>
                        {m.bio.length > 70 ? `${m.bio.slice(0, 70)}…` : m.bio}
                      </div>
                    )}
                    <div className="row-wrap tiny muted" style={{ marginTop: 5, gap: 11 }}>
                      {m.phone && (
                        <span>
                          <Icon name="phone" size={12} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {m.phone}
                        </span>
                      )}
                      {birthday && (
                        <span>
                          <Icon name="calendar" size={12} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {birthday}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="pill pill-lilac">
                    <Icon name="books" size={13} /> {counts[m.id] ?? 0}
                  </span>
                  <Icon name="forward" size={16} className="icon chev" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
