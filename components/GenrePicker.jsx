import { useState } from 'react'

// Tap-to-toggle suggestions. Anything not on this list can be typed in.
export const SUGGESTED = [
  'Romantasy', 'Fantasy', 'Romance', 'Thriller', 'Mystery', 'Sci-fi',
  'Horror', 'Historical', 'Literary', 'Contemporary', 'YA', 'Dark academia',
  'Memoir', 'Non-fiction', 'Poetry', 'Classic',
]

export default function GenrePicker({ value = [], onChange }) {
  const [custom, setCustom] = useState('')

  const toggle = (g) =>
    onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g])

  function addCustom() {
    const g = custom.trim()
    if (!g) return
    if (!value.some((v) => v.toLowerCase() === g.toLowerCase())) onChange([...value, g])
    setCustom('')
  }

  const extras = value.filter((v) => !SUGGESTED.includes(v))

  return (
    <>
      <div className="row-wrap" style={{ gap: 6, marginBottom: 10 }}>
        {SUGGESTED.map((g) => (
          <button
            key={g}
            type="button"
            className={`genre${value.includes(g) ? ' on' : ''}`}
            onClick={() => toggle(g)}
          >
            {g}
          </button>
        ))}
        {extras.map((g) => (
          <button key={g} type="button" className="genre on" onClick={() => toggle(g)}>
            {g} ✕
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 7 }}>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addCustom() }
          }}
          placeholder="Add your own…"
          maxLength={30}
        />
        <button type="button" className="btn-soft btn-sm" onClick={addCustom}>Add</button>
      </div>
    </>
  )
}
