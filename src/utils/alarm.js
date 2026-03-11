/**
 * @typedef {Object} TaskAlarm
 * @property {boolean} enabled
 * @property {string} datetime  - ISO 8601, e.g. "2025-03-15T09:00:00"
 * @property {'none'|'daily'|'weekly'} repeat
 * @property {boolean} notified - 이미 발송된 알람인지
 */

/**
 * 다음 알람 발송 시각을 계산한다.
 * @param {TaskAlarm} alarm
 * @returns {Date|null}
 */
export function getNextAlarmTime(alarm) {
  if (!alarm?.enabled || !alarm.datetime) return null
  const base = new Date(alarm.datetime)
  const now = new Date()

  if (alarm.repeat === 'none') {
    return base > now ? base : null
  }
  if (alarm.repeat === 'daily') {
    const next = new Date(base)
    next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
    if (next <= now) next.setDate(next.getDate() + 1)
    return next
  }
  if (alarm.repeat === 'weekly') {
    const next = new Date(base)
    const diff = (base.getDay() - now.getDay() + 7) % 7
    next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    next.setHours(base.getHours(), base.getMinutes(), 0, 0)
    if (next <= now) next.setDate(next.getDate() + 7)
    return next
  }
  return null
}

/**
 * 알람이 지금 울려야 하는지 판단 (±60초 허용)
 * @param {TaskAlarm} alarm
 * @returns {boolean}
 */
export function shouldFireAlarm(alarm) {
  if (!alarm?.enabled || alarm.notified) return false
  const next = getNextAlarmTime(alarm)
  if (!next) return false
  const diff = Math.abs(next - new Date())
  return diff <= 60_000
}

/**
 * 알람 발송 후 다음 상태를 반환한다.
 * - none: disabled + notified
 * - daily: datetime을 내일 같은 시각으로 갱신, notified = false
 * - weekly: datetime을 다음 주 같은 요일/시각으로 갱신, notified = false
 * @param {TaskAlarm} alarm
 * @returns {TaskAlarm}
 */
export function advanceAlarm(alarm) {
  if (alarm.repeat === 'none') {
    return { ...alarm, enabled: false, notified: true }
  }

  const base = new Date(alarm.datetime)

  if (alarm.repeat === 'daily') {
    base.setDate(base.getDate() + 1)
  } else if (alarm.repeat === 'weekly') {
    base.setDate(base.getDate() + 7)
  }

  return {
    ...alarm,
    datetime: base.toISOString(),
    notified: false,
  }
}

/**
 * 알람을 snoozeMinutes분 후로 미룬다.
 * repeat은 유지, datetime만 갱신.
 * @param {TaskAlarm} alarm
 * @param {number} snoozeMinutes - 기본 10분
 * @returns {TaskAlarm}
 */
export function snoozeAlarm(alarm, snoozeMinutes = 10) {
  const next = new Date(Date.now() + snoozeMinutes * 60_000)
  return {
    ...alarm,
    datetime: next.toISOString(),
    notified: false,
    enabled: true,
  }
}

/**
 * Service Worker에 알람 발송 메시지를 보낸다.
 * SW가 없으면 Notification API 직접 호출 (fallback).
 * @param {string} taskText - 할일 제목
 * @param {string} taskId
 */
export async function fireNotification(taskText, taskId) {
  const title = '\u23F0 알람'
  const body = taskText

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration('/')
    if (reg?.active) {
      reg.active.postMessage({ type: 'FIRE_ALARM', title, body, taskId })
      return
    }
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png', tag: `alarm-${taskId}` })
  }
}
