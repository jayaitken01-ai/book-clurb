/**
 * The app's icon set — hand-tuned inline SVG, drawn on a 24×24 grid with
 * rounded caps so it sits comfortably next to the rounded type.
 *
 * Emoji is reserved for things that are *content*: the mood scale on chapter
 * updates, and the icon a member picks for a theory category. Everything
 * structural — navigation, buttons, headings — uses these.
 *
 *   <Icon name="star" />            default 20px, inherits text colour
 *   <Icon name="star" size={14} />
 *   <Icon name="star" filled />     for ratings and likes
 */

const PATHS = {
  home:      <><path d="M3 10.2 12 3.5l9 6.7"/><path d="M5.5 9v10.5h13V9"/><path d="M9.75 19.5v-6h4.5v6"/></>,
  thought:   <><path d="M7.5 16.5h7a4.5 4.5 0 0 0 .8-8.93A5 5 0 0 0 6.2 8.6a3.95 3.95 0 0 0 1.3 7.9Z"/><circle cx="7" cy="20" r="1.4"/><circle cx="4" cy="22.2" r=".9"/></>,
  ballot:    <><rect x="4" y="9" width="16" height="11.5" rx="2.2"/><path d="M8.5 9V5.6A1.6 1.6 0 0 1 10.1 4h3.8a1.6 1.6 0 0 1 1.6 1.6V9"/><path d="M9.5 14.5l1.8 1.8 3.4-3.6"/></>,
  books:     <><path d="M4 5.2h5.2a2.4 2.4 0 0 1 2.4 2.4v11.6a2 2 0 0 0-2-2H4Z"/><path d="M20 5.2h-5.2a2.4 2.4 0 0 0-2.4 2.4v11.6a2 2 0 0 1 2-2H20Z"/></>,
  ribbon:    <><circle cx="12" cy="8.2" r="3.4"/><path d="M9.6 11.1 7.2 20l4.8-2.7 4.8 2.7-2.4-8.9"/></>,
  star:      <><path d="m12 3.6 2.6 5.5 5.9.82-4.3 4.25 1.05 6.05L12 17.3l-5.25 2.92L7.8 14.17 3.5 9.92l5.9-.82Z"/></>,
  heart:     <><path d="M12 20.3s-7.6-4.6-7.6-9.6a4.3 4.3 0 0 1 7.6-2.8 4.3 4.3 0 0 1 7.6 2.8c0 5-7.6 9.6-7.6 9.6Z"/></>,
  camera:    <><path d="M3.5 8.8h3.3l1.5-2.3h7.4l1.5 2.3h3.3v10.7H3.5Z"/><circle cx="12" cy="14" r="3.4"/></>,
  pencil:    <><path d="m15.6 4.4 4 4L8.9 19.1l-5 1 1-5Z"/><path d="m13.5 6.5 4 4"/></>,
  trash:     <><path d="M4.8 6.8h14.4"/><path d="M9.3 6.8V4.6h5.4v2.2"/><path d="M6.6 6.8 7.6 20h8.8l1-13.2"/><path d="M10.4 10.6v5.6M13.6 10.6v5.6"/></>,
  crown:     <><path d="M4 17.6h16"/><path d="m4 17.6-1.3-9 5 3.4L12 5l4.3 7 5-3.4-1.3 9Z"/></>,
  lock:      <><rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.4"/><path d="M8.2 10.4V7.9a3.8 3.8 0 0 1 7.6 0v2.5"/></>,
  eyeoff:    <><path d="M2.8 12s3.6-6 9.2-6c1.5 0 2.8.4 4 1"/><path d="M21.2 12s-3.6 6-9.2 6c-1.6 0-3-.4-4.2-1.1"/><circle cx="12" cy="12" r="2.8"/><path d="m4 20 16-16"/></>,
  plus:      <><path d="M12 5.5v13M5.5 12h13"/></>,
  check:     <><path d="m5 12.8 4.5 4.4L19 6.9"/></>,
  back:      <><path d="M14.5 5.5 8 12l6.5 6.5"/></>,
  forward:   <><path d="M9.5 5.5 16 12l-6.5 6.5"/></>,
  bookmark:  <><path d="M6.4 4.4h11.2v15.9L12 16.4l-5.6 3.9Z"/></>,
  bookopen:  <><path d="M12 7.3S10 5.4 4.2 5.4v12.4C10 17.8 12 19.7 12 19.7s2-1.9 7.8-1.9V5.4C14 5.4 12 7.3 12 7.3Z"/><path d="M12 7.3v12.4"/></>,
  clock:     <><circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3.1 2"/></>,
  users:     <><circle cx="9.2" cy="8.6" r="3.2"/><path d="M3.4 19.4c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4"/><path d="M16.4 6.1a3.2 3.2 0 0 1 0 6.2"/><path d="M17.2 14.4c2.1.5 3.4 2.4 3.4 4.6"/></>,
  chat:      <><path d="M20.2 15.2a2 2 0 0 1-2 2H8.4l-4 3.3V6.2a2 2 0 0 1 2-2h11.8a2 2 0 0 1 2 2Z"/></>,
  pin:       <><path d="M12 21s6.2-6.1 6.2-10.2a6.2 6.2 0 1 0-12.4 0C5.8 14.9 12 21 12 21Z"/><circle cx="12" cy="10.6" r="2.4"/></>,
  tag:       <><path d="M11.3 3.8H20v8.7l-8.4 8.4a1.6 1.6 0 0 1-2.3 0l-6.4-6.4a1.6 1.6 0 0 1 0-2.3Z"/><circle cx="16.3" cy="7.6" r="1.4"/></>,
  sparkle:   <><path d="M12 3.8 13.6 9 18.8 10.6 13.6 12.2 12 17.4 10.4 12.2 5.2 10.6 10.4 9Z"/><path d="M18.4 15.6 19.2 18l2.4.8-2.4.8-.8 2.4-.8-2.4L15.2 18.8l2.4-.8Z"/></>,
  sliders:   <><path d="M5 7.5h14M5 12h14M5 16.5h14"/><circle cx="9.5" cy="7.5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="16.5" r="2"/></>,
  exit:      <><path d="M14.5 4.8H6.2v14.4h8.3"/><path d="M18.8 12H10.4"/><path d="m15.6 8.8 3.2 3.2-3.2 3.2"/></>,
  mail:      <><rect x="3.4" y="5.8" width="17.2" height="12.4" rx="2.2"/><path d="m4.4 7.4 7.6 5.6 7.6-5.6"/></>,
  phone:     <><path d="M8.2 3.9h7.6v16.2H8.2Z"/><path d="M10.9 5.9h2.2"/><path d="M11.4 17.6h1.2"/></>,
  hourglass: <><path d="M7 4h10M7 20h10"/><path d="M7.6 4c0 4 4.4 5.4 4.4 8s-4.4 4-4.4 8"/><path d="M16.4 4c0 4-4.4 5.4-4.4 8s4.4 4 4.4 8"/></>,
}

export default function Icon({ name, size = 20, filled = false, style, ...rest }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.4 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', ...style }}
      {...rest}
    >
      {d}
    </svg>
  )
}
