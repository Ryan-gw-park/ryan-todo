export const COLOR_OPTIONS = [
  { id: 'yellow', label: '노랑', card: '#faf8f3', header: '#f7e8c5', text: '#9a6c2a', dot: '#d4a039' },
  { id: 'pink',   label: '핑크', card: '#faf5f4', header: '#f5ddd8', text: '#944a3b', dot: '#cb7161' },
  { id: 'green',  label: '초록', card: '#f3f8f4', header: '#d6ecda', text: '#3a7248', dot: '#5b9a6a' },
  { id: 'blue',   label: '파랑', card: '#f4f7fa', header: '#d5e3f5', text: '#3868a1', dot: '#5b8fd4' },
  { id: 'purple', label: '보라', card: '#f6f4fa', header: '#e0d5f0', text: '#6a4b9a', dot: '#8e6ebf' },
  { id: 'orange', label: '주황', card: '#faf6f1', header: '#f5dcc5', text: '#9a5e2a', dot: '#d48a3f' },
  { id: 'teal',   label: '청록', card: '#f1f8f7', header: '#cce8e3', text: '#2e6b5e', dot: '#4a9e8e' },
  { id: 'red',    label: '빨강', card: '#faf4f4', header: '#f0d0d0', text: '#8b3a3a', dot: '#c46060' },
]

export function getColor(id) {
  return COLOR_OPTIONS.find(c => c.id === id) || COLOR_OPTIONS[0]
}

export function getColorByIndex(index) {
  return COLOR_OPTIONS[index % COLOR_OPTIONS.length]
}

export const CATEGORIES = [
  { key: 'today',   label: '오늘 할일', shortLabel: '오늘', emoji: '🎯' },
  { key: 'next',    label: '다음 할일', shortLabel: '다음', emoji: '📌' },
  { key: 'backlog', label: '남은 할일', shortLabel: '남은', emoji: '📋' },
  { key: 'done',    label: '완료',      shortLabel: '완료', emoji: '✅' },
]

export const BULLET_STYLES = [
  (c) => ({ width: 6, height: 6, borderRadius: '50%', background: c || '#bbb' }),
  (c) => ({ width: 6, height: 6, borderRadius: '50%', border: `1.5px solid ${c || '#bbb'}`, background: 'transparent' }),
  (c) => ({ width: 5, height: 5, borderRadius: 1, background: c || '#ccc' }),
  (c) => ({ width: 5, height: 5, borderRadius: 1, border: `1.5px solid ${c || '#ccc'}`, background: 'transparent' }),
]

// Level 5+ returns null → OutlinerRow renders "-" text instead
export function getBulletStyle(level, color) {
  if (level >= 4) return null
  return BULLET_STYLES[level](color)
}
