// Weekly Schedule 뷰용 날짜 유틸. getMonday는 grid/constants.js 재사용.
export { getMonday } from '../components/views/grid/constants'

// 월요일 기준 주 5일 [Mon, Tue, Wed, Thu, Fri] Date 배열
export function getWeekDays(monday) {
  const result = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    d.setHours(0, 0, 0, 0)
    result.push(d)
  }
  return result
}

// ISO 주차 번호 (1-53). 1월 4일 포함 주 = 1주차.
// 알고리즘: 해당 날짜가 속한 주의 목요일을 구한 뒤, 그 해 1월 1일 기준 몇 번째 주인지.
export function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// "4월 20일 ~ 24일 (17주차)" 형식. 월 경계 케이스 처리.
export function formatWeekRange(monday) {
  const days = getWeekDays(monday)
  const friday = days[4]
  const wk = getISOWeekNumber(monday)
  const m1 = monday.getMonth() + 1
  const d1 = monday.getDate()
  const m2 = friday.getMonth() + 1
  const d2 = friday.getDate()
  if (m1 === m2) return `${m1}월 ${d1}일 ~ ${d2}일 (${wk}주차)`
  return `${m1}월 ${d1}일 ~ ${m2}월 ${d2}일 (${wk}주차)`
}

// YYYY-MM-DD ISO date string (scheduled_date 저장용, timezone-free)
export function toISODateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
