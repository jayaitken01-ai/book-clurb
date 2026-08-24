// The emoji scale for chapter updates.
// Add, remove or rename freely — `key` is what gets stored in the database,
// so if you change a key, old updates will just show the fallback face.
export const MOODS = [
  { key: 'swoon',     emoji: '🥰', label: 'Swooning' },
  { key: 'sob',       emoji: '😭', label: 'Sobbing' },
  { key: 'shook',     emoji: '😱', label: 'Shook' },
  { key: 'mindblown', emoji: '🤯', label: 'Mind blown' },
  { key: 'wrecked',   emoji: '💔', label: 'Wrecked' },
  { key: 'furious',   emoji: '😡', label: 'Furious' },
  { key: 'laughing',  emoji: '😂', label: 'Laughing' },
  { key: 'sus',       emoji: '🤔', label: 'Suspicious' },
  { key: 'calledit',  emoji: '😏', label: 'Called it' },
  { key: 'dragging',  emoji: '😴', label: 'Dragging' },
]

export const moodOf = (key) => MOODS.find((m) => m.key === key) ?? null
