// 매트릭스/주간 플래너 공통 상수 + 순수 헬퍼
// React 의존성 없음 — 어디서든 import 가능

export const CATS = [
  { key: 'today', label: '지금 할일', color: '#E53E3E' },
  { key: 'next', label: '다음', color: '#D69E2E' },
  { key: 'later', label: '나중', color: '#3182CE' },
]

export const DAY_LABELS = ['월', '화', '수', '목', '금']

export const EMPTY_OBJ = {}

export function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  date.setHours(0, 0, 0, 0)
  return date
}

export function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getWeekNumber(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7)
}
