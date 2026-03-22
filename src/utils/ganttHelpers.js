/**
 * ganttHelpers.js — Gantt chart utility functions (Loop-37.3)
 * Pure frontend calculations, no network calls
 */

/**
 * Convert date string to X position in pixels
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @param {Date} startDate - Timeline start date
 * @param {number} colWidth - Width per week in pixels
 * @returns {number|null} X position or null if invalid date
 */
export const toX = (dateStr, startDate, colWidth) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const diffMs = date - startDate
  const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000)
  return diffWeeks * colWidth
}

/**
 * Generate array of week start dates
 * @param {Date} startDate - First week's start date
 * @param {number} count - Number of weeks to generate
 * @returns {Date[]} Array of Date objects
 */
export const getWeekDates = (startDate, count) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i * 7)
    return d
  })

/**
 * Calculate timeline start date (beginning of current month, aligned to Monday)
 * @returns {Date}
 */
export const getTimelineStart = () => {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  // Align to previous Monday
  const dayOfWeek = firstOfMonth.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  firstOfMonth.setDate(firstOfMonth.getDate() - diff)
  return firstOfMonth
}

/**
 * Format date for display (M/D format)
 * @param {Date} date
 * @returns {string}
 */
export const formatWeekLabel = (date) => {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/**
 * Get today's X position
 * @param {Date} startDate - Timeline start date
 * @param {number} colWidth - Width per week in pixels
 * @returns {number} X position
 */
export const getTodayX = (startDate, colWidth) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = today - startDate
  const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000)
  return diffWeeks * colWidth
}

/**
 * Get bar width from start to end date
 * @param {string} startStr - Start date string
 * @param {string} endStr - End date string
 * @param {number} colWidth - Width per week in pixels
 * @returns {number} Bar width in pixels
 */
export const getBarWidth = (startStr, endStr, colWidth) => {
  if (!startStr || !endStr) return 0
  const startDate = new Date(startStr)
  const endDate = new Date(endStr)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0
  const diffMs = endDate - startDate
  const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000)
  return Math.max(diffWeeks * colWidth, 4) // minimum 4px width
}
