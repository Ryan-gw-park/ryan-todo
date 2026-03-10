export const COLOR_OPTIONS = [
  { id: 'yellow', label: '노랑', card: '#fef9ec', header: '#fef3c7', text: '#92400e', dot: '#d97706' },
  { id: 'pink',   label: '핑크', card: '#fdf2f0', header: '#fce7e4', text: '#9b2c2c', dot: '#e05252' },
  { id: 'green',  label: '초록', card: '#f0faf5', header: '#d1fae5', text: '#166534', dot: '#22c55e' },
  { id: 'blue',   label: '파랑', card: '#eff6ff', header: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  { id: 'purple', label: '보라', card: '#f5f3ff', header: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  { id: 'orange', label: '주황', card: '#fff7ed', header: '#fed7aa', text: '#9a3412', dot: '#f97316' },
  { id: 'teal',   label: '청록', card: '#f0fdfa', header: '#ccfbf1', text: '#134e4a', dot: '#14b8a6' },
  { id: 'red',    label: '빨강', card: '#fff5f5', header: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
]

export function getColor(id) {
  return COLOR_OPTIONS.find(c => c.id === id) || COLOR_OPTIONS[0]
}

export function getColorByIndex(index) {
  return COLOR_OPTIONS[index % COLOR_OPTIONS.length]
}

export const CATEGORIES = [
  { key: 'today',   label: '오늘 할일', emoji: '🎯' },
  { key: 'next',    label: '다음 할일', emoji: '📌' },
  { key: 'backlog', label: '남은 할일', emoji: '📋' },
  { key: 'done',    label: '완료',      emoji: '✅' },
]

export const BULLET_STYLES = [
  (c) => ({ width: 6, height: 6, borderRadius: '50%', background: c || '#bbb' }),
  (c) => ({ width: 6, height: 6, borderRadius: '50%', border: `1.5px solid ${c || '#bbb'}`, background: 'transparent' }),
  (c) => ({ width: 5, height: 5, borderRadius: 1, background: c || '#ccc' }),
  (c) => ({ width: 5, height: 5, borderRadius: 1, border: `1.5px solid ${c || '#ccc'}`, background: 'transparent' }),
]

export function getBulletStyle(level, color) {
  return BULLET_STYLES[level % BULLET_STYLES.length](color)
}
