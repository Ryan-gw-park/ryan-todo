/**
 * Parse dates from quoted text in task input.
 * Only parses dates inside "..." (double quotes).
 *
 * @param {string} text - Full task text
 * @returns {{ startDate: string|null, dueDate: string|null }}
 */
export function parseDateFromText(text) {
  if (!text) return { startDate: null, dueDate: null }

  // Extract first quoted segment
  const m = text.match(/"([^"]+)"/)
  if (!m) return { startDate: null, dueDate: null }

  const quoted = m[1].trim()

  // Check for range separators: ~, -, –, →
  const rangeSep = /[~\-–→]/
  if (rangeSep.test(quoted)) {
    return parseRange(quoted)
  }

  // Single date → due date only
  const d = parseSingleDate(quoted)
  return { startDate: null, dueDate: d }
}

function parseRange(str) {
  // Split by range separator
  const parts = str.split(/[~\-–→]/).map(s => s.trim()).filter(Boolean)
  if (parts.length < 2) {
    const d = parseSingleDate(str.replace(/[~\-–→]/g, '').trim())
    return { startDate: null, dueDate: d }
  }

  const startInfo = extractDateParts(parts[0])
  const endInfo = extractDateParts(parts[1])

  if (!startInfo) return { startDate: null, dueDate: parseSingleDate(parts[1]) }

  // If end date is missing month, inherit from start
  if (endInfo && endInfo.month === null && startInfo.month !== null) {
    endInfo.month = startInfo.month
  }
  // If end date is missing year, inherit from start
  if (endInfo && endInfo.year === null && startInfo.year !== null) {
    endInfo.year = startInfo.year
  }

  const startDate = formatDateInfo(startInfo)
  const dueDate = endInfo ? formatDateInfo(endInfo) : null

  return { startDate, dueDate }
}

function parseSingleDate(str) {
  // Remove suffixes like 까지, 마감, 기한
  const cleaned = str.replace(/까지|마감|기한/g, '').trim()
  const info = extractDateParts(cleaned)
  return info ? formatDateInfo(info) : null
}

/**
 * Extract year/month/day from a date string.
 * Patterns:
 *   "26년 3월 18일" → { year: 2026, month: 3, day: 18 }
 *   "3월 18일"       → { year: null, month: 3, day: 18 }
 *   "3/18"           → { year: null, month: 3, day: 18 }
 *   "20일"           → { year: null, month: null, day: 20 }
 *   "20"             → { year: null, month: null, day: 20 }
 */
function extractDateParts(str) {
  let year = null, month = null, day = null

  // Pattern: YY년 M월 D일
  const fullKr = str.match(/(\d{2,4})년\s*(\d{1,2})월\s*(\d{1,2})일?/)
  if (fullKr) {
    year = parseInt(fullKr[1])
    month = parseInt(fullKr[2])
    day = parseInt(fullKr[3])
    if (year < 100) year += 2000
    return { year, month, day }
  }

  // Pattern: M월 D일
  const monthDayKr = str.match(/(\d{1,2})월\s*(\d{1,2})일?/)
  if (monthDayKr) {
    month = parseInt(monthDayKr[1])
    day = parseInt(monthDayKr[2])
    return { year, month, day }
  }

  // Pattern: M/D  (but not confused with range separators)
  const slash = str.match(/(\d{1,2})\/(\d{1,2})/)
  if (slash) {
    month = parseInt(slash[1])
    day = parseInt(slash[2])
    return { year, month, day }
  }

  // Pattern: D일 (day only)
  const dayOnly = str.match(/(\d{1,2})일/)
  if (dayOnly) {
    day = parseInt(dayOnly[1])
    return { year, month, day }
  }

  // Pattern: bare number (day only, for range end like "18~20")
  const bareNum = str.match(/^\s*(\d{1,2})\s*$/)
  if (bareNum) {
    day = parseInt(bareNum[1])
    return { year, month, day }
  }

  return null
}

function formatDateInfo(info) {
  if (!info || info.day === null) return null

  const now = new Date()
  let y = info.year ?? now.getFullYear()
  let m = info.month ?? (now.getMonth() + 1)
  let d = info.day

  // If year was not specified and the date has already passed, use next year
  if (info.year === null) {
    const candidate = new Date(y, m - 1, d)
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      y += 1
    }
  }

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
