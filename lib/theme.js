/**
 * Theme handling.
 *
 * Two independent choices:
 *   accent — which colour the app is built out of
 *   mode   — light, dark, or follow whatever the phone is set to
 *
 * Both are saved to your profile so they follow you between devices, and
 * mirrored into this browser's storage so the right colours paint on the
 * very first frame instead of flashing pink and then correcting itself.
 */

export const ACCENTS = [
  { key: 'pink',      label: 'Pink',      swatch: '#f26aa4' },
  { key: 'purple',    label: 'Purple',    swatch: '#a06ae8' },
  { key: 'blue',      label: 'Blue',      swatch: '#5b8fe8' },
  { key: 'turquoise', label: 'Turquoise', swatch: '#4fc9c4' },
  { key: 'green',     label: 'Green',     swatch: '#54c47e' },
  { key: 'orange',    label: 'Orange',    swatch: '#f0954a' },
]

export const MODES = [
  { key: 'system', label: 'Match my phone' },
  { key: 'light',  label: 'Always light' },
  { key: 'dark',   label: 'Always dark' },
]

const KEY = 'abu-theme'

export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* private browsing, or storage disabled */ }
  return { accent: 'pink', mode: 'system' }
}

function store(theme) {
  try { localStorage.setItem(KEY, JSON.stringify(theme)) } catch (e) { /* fine */ }
}

/** Paint the theme onto the page. */
export function applyTheme({ accent = 'pink', mode = 'system' } = {}) {
  const root = document.documentElement
  const known = ACCENTS.some((a) => a.key === accent) ? accent : 'pink'

  // The pink theme is the default block, so it carries no attribute.
  if (known === 'pink') root.removeAttribute('data-accent')
  else root.setAttribute('data-accent', known)

  // "system" carries no attribute either — the media query takes over.
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-mode', mode)
  else root.removeAttribute('data-mode')

  // Keeps the phone's status bar in step with the app.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const bar = getComputedStyle(root).getPropertyValue('--accent-200').trim()
    if (bar) meta.setAttribute('content', bar)
  }

  store({ accent: known, mode })
}

/** Called before React mounts, so the first paint is already correct. */
export function applyStoredTheme() {
  applyTheme(readStoredTheme())
}
