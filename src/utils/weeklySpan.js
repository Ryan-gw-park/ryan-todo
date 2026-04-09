/**
 * 주간 플래너 multi-day span 유틸
 */

// 주말(토/일)이면 다음 월요일로 올림
function snapToWeekday(dateStr, direction) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() // 0=일, 6=토
  if (direction === 'forward') {
    if (dow === 6) d.setDate(d.getDate() + 2) // 토→월
    else if (dow === 0) d.setDate(d.getDate() + 1) // 일→월
  } else {
    if (dow === 6) d.setDate(d.getDate() - 1) // 토→금
    else if (dow === 0) d.setDate(d.getDate() - 2) // 일→금
  }
  return d.toISOString().slice(0, 10)
}

/**
 * getSpanTasksForDay — 특정 날짜에 표시할 span task 목록 반환
 *
 * @param {Array} allTasks — 필터링 대상 task 배열
 * @param {string} ds — 대상 날짜 (YYYY-MM-DD)
 * @param {string[]} weekDateStrs — 이번 주 날짜 배열 (월~금)
 * @param {string} todayStr — 오늘 날짜
 * @param {Function} filterFn — 추가 필터 (project, member 등)
 * @returns {Array<{ task, spanPosition: 'single'|'start'|'middle'|'end' }>}
 */
export function getSpanTasksForDay(allTasks, ds, weekDateStrs, todayStr, filterFn) {
  if (!weekDateStrs || weekDateStrs.length === 0) return []

  const result = []
  const weekStart = weekDateStrs[0]
  const weekEnd = weekDateStrs[weekDateStrs.length - 1]

  for (const t of allTasks) {
    if (t.done) continue
    if (filterFn && !filterFn(t)) continue

    const hasStart = !!t.startDate
    const hasDue = !!t.dueDate

    // Case 1: startDate + dueDate → span
    if (hasStart && hasDue && t.startDate <= t.dueDate) {
      // 주말 보정: startDate가 토/일이면 다음 월요일, dueDate가 토/일이면 이전 금요일
      const adjStart = snapToWeekday(t.startDate, 'forward')
      const adjEnd = snapToWeekday(t.dueDate, 'backward')

      if (adjStart > adjEnd) continue // 보정 후 역전되면 건너뜀
      if (adjStart <= ds && ds <= adjEnd) {
        const effectiveStart = adjStart < weekStart ? weekStart : adjStart
        const effectiveEnd = adjEnd > weekEnd ? weekEnd : adjEnd

        const isStart = ds === effectiveStart
        const isEnd = ds === effectiveEnd

        let pos
        if (isStart && isEnd) pos = 'single'
        else if (isStart) pos = 'start'
        else if (isEnd) pos = 'end'
        else pos = 'middle'

        result.push({ task: t, spanPosition: pos })
      }
      continue
    }

    // Case 2: startDate만 → startDate 셀에만
    if (hasStart && !hasDue) {
      const adj = snapToWeekday(t.startDate, 'forward')
      if (adj === ds) {
        result.push({ task: t, spanPosition: 'single' })
      }
      continue
    }

    // Case 3: dueDate만 → dueDate 셀에만
    if (!hasStart && hasDue) {
      if (t.dueDate === ds) {
        result.push({ task: t, spanPosition: 'single' })
      }
      continue
    }

    // Case 4: 둘 다 없음 → category today
    if (!hasStart && !hasDue) {
      if (t.category === 'today' && ds === todayStr) {
        result.push({ task: t, spanPosition: 'single' })
      }
    }
  }

  return result.sort((a, b) => (a.task.sortOrder || 0) - (b.task.sortOrder || 0))
}
