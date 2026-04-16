/**
 * Loop-34: Timeline utility functions
 * - buildTimelineTree: flat data → hierarchical tree
 * - applyDateInheritance: bottom-up date propagation
 * - getBarStyles: color ramp–based bar styling
 * - flattenVisibleRows: tree → flat row array for rendering
 * - getScaleConfig: time scale column generation
 * - getBarPosition: bar left/width from dates
 * - Date helpers
 */

/* ═══ Date helpers ═══ */
export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
export function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
export function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
export function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
export function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6 }
export function diffDays(a, b) { return Math.round((b - a) / 86400000) }
export function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) }
export function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export function parseDate(s) { if (!s) return null; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d }
function getMonday(d) { const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.getFullYear(), d.getMonth(), diff) }

/* ═══ Column generation (ported from existing TimelineView) ═══ */
export function getColumns(baseDate, scale) {
  const cols = []
  if (scale === 'month') {
    const y = baseDate.getFullYear(), m = baseDate.getMonth()
    const n = daysInMonth(y, m)
    for (let i = 1; i <= n; i++) {
      const d = new Date(y, m, i)
      cols.push({ date: d, label: String(i), isWeekend: isWeekend(d) })
    }
  } else if (scale === 'quarter') {
    let weekIdx = 0, lastWeekNum = -1
    for (let mo = 0; mo < 3; mo++) {
      const mDate = addMonths(baseDate, mo)
      const y = mDate.getFullYear(), m = mDate.getMonth()
      const n = daysInMonth(y, m)
      for (let i = 1; i <= n; i++) {
        const d = new Date(y, m, i)
        const dayOfYear = Math.floor((d - new Date(y, 0, 1)) / 86400000) + 1
        const wn = Math.ceil((dayOfYear + new Date(y, 0, 1).getDay()) / 7)
        if (wn !== lastWeekNum) { weekIdx++; lastWeekNum = wn }
        cols.push({ date: d, label: '', isWeekend: false, monthStart: i === 1, band: weekIdx % 2, weekGroup: weekIdx })
      }
    }
    const weekGroups = {}
    cols.forEach((col, i) => {
      if (!weekGroups[col.weekGroup]) weekGroups[col.weekGroup] = { start: i, end: i }
      else weekGroups[col.weekGroup].end = i
    })
    Object.values(weekGroups).forEach(({ start, end }) => {
      const mid = Math.floor((start + end) / 2)
      const sd = cols[start].date, ed = cols[end].date
      cols[mid].label = `${sd.getMonth() + 1}/${sd.getDate()}~${ed.getMonth() + 1}/${ed.getDate()}`
    })
  } else {
    const y = baseDate.getFullYear()
    let cur = getMonday(new Date(y, 0, 1))
    if (cur.getFullYear() < y) cur = addDays(cur, 7)
    let lastMonth = -1, monthIdx = 0
    while (cur.getFullYear() <= y) {
      const m = cur.getMonth()
      if (m !== lastMonth) { monthIdx++; lastMonth = m }
      const monthStart = cur.getDate() <= 7 && cur.getMonth() !== (cols.length > 0 ? cols[cols.length - 1].date.getMonth() : -1)
      cols.push({ date: new Date(cur), label: '', isWeekend: false, weekStart: true, monthStart, band: monthIdx % 2 })
      cur = addDays(cur, 7)
      if (cur.getFullYear() > y && cur.getMonth() > 0) break
    }
  }
  return cols
}

export function getMonthHeaders(baseDate, scale) {
  if (scale === 'month') {
    return [{ label: `${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`, span: daysInMonth(baseDate.getFullYear(), baseDate.getMonth()) }]
  }
  if (scale === 'quarter') {
    return [0, 1, 2].map(i => {
      const d = addMonths(baseDate, i)
      return { label: `${d.getMonth() + 1}월`, span: daysInMonth(d.getFullYear(), d.getMonth()), band: i % 2 }
    })
  }
  const y = baseDate.getFullYear()
  const headers = []
  const cols = getColumns(baseDate, 'year')
  for (let m = 0; m < 12; m++) {
    const count = cols.filter(c => c.date.getMonth() === m && c.date.getFullYear() === y).length
    if (count > 0) headers.push({ label: `${m + 1}월`, span: count })
  }
  return headers
}

export function dateToColIndex(dateStr, columns, scale) {
  const d = parseDate(dateStr)
  if (!d) return -1
  if (scale === 'year') {
    for (let i = columns.length - 1; i >= 0; i--) {
      if (columns[i].date <= d) return i
    }
    return 0
  }
  return columns.findIndex(c => isSameDay(c.date, d))
}

/* ═══ Color Ramp System ═══ */
const COLOR_ID_TO_RAMP = {
  blue: 'blue', red: 'red', yellow: 'amber', orange: 'amber',
  green: 'teal', teal: 'teal', purple: 'purple', pink: 'pink',
}

const RAMP_STOPS = {
  blue:   { 50: '#E6F1FB', 100: '#B5D4F4', 200: '#85B7EB', 400: '#378ADD', 600: '#185FA5', 800: '#0C447C' },
  red:    { 50: '#FCEBEB', 100: '#F7C1C1', 200: '#F09595', 400: '#E24B4A', 600: '#A32D2D', 800: '#791F1F' },
  amber:  { 50: '#FAEEDA', 100: '#FAC775', 200: '#EF9F27', 400: '#BA7517', 600: '#854F0B', 800: '#633806' },
  teal:   { 50: '#E1F5EE', 100: '#9FE1CB', 200: '#5DCAA5', 400: '#1D9E75', 600: '#0F6E56', 800: '#085041' },
  purple: { 50: '#EEEDFE', 100: '#CECBF6', 200: '#AFA9EC', 400: '#7F77DD', 600: '#534AB7', 800: '#3C3489' },
  pink:   { 50: '#FBEAF0', 100: '#F4C0D1', 200: '#ED93B1', 400: '#D4537E', 600: '#993556', 800: '#72243E' },
  gray:   { 50: '#F1EFE8', 100: '#D3D1C7', 200: '#B4B2A9', 400: '#888780', 600: '#5F5E5A', 800: '#444441' },
}

function getRamp(colorId) {
  const rampName = COLOR_ID_TO_RAMP[colorId] || 'gray'
  return { name: rampName, stops: RAMP_STOPS[rampName] || RAMP_STOPS.gray }
}

export function getBarStyles(node) {
  // Completed task → gray
  if (node.type === 'task' && node.done) {
    return {
      fill: RAMP_STOPS.gray[100],
      border: 'none',
      progressFill: 'none',
      progressOpacity: 0,
      textColor: RAMP_STOPS.gray[400],
      strikethrough: true,
    }
  }

  const ramp = getRamp(node.color)

  if (node.type === 'project') {
    return {
      fill: ramp.stops[50],
      border: `0.5px solid ${ramp.stops[600]}`,
      progressFill: ramp.stops[400],
      progressOpacity: 0.3,
      textColor: ramp.stops[800],
    }
  }

  if (node.type === 'milestone') {
    // MS with own color → use its ramp; otherwise project ramp
    const msRamp = node.color !== node.projectColor ? getRamp(node.color) : ramp
    return {
      fill: msRamp.stops[50],
      border: `0.5px ${node.inherited ? 'dashed' : 'solid'} ${msRamp.stops[200]}`,
      progressFill: msRamp.stops[400],
      progressOpacity: 0.3,
      textColor: msRamp.stops[800],
    }
  }

  // Task: 400 fill + white text for high contrast
  return {
    fill: ramp.stops[400],
    border: 'none',
    progressFill: 'none',
    progressOpacity: 0,
    textColor: '#fff',
  }
}

/* ═══ Row Height / Indent ═══ */
export const ROW_HEIGHTS = { project: 36, milestone: 30, task: 26 }
export const BAR_HEIGHTS = { project: 22, milestone: 18, task: 14 }
export const INDENTS = { 0: 0, 1: 16, 2: 32 }

/* ═══ Build Timeline Tree ═══ */
export function buildTimelineTree({ projects, milestones, tasks, members, rootLevel, projectId }) {
  const memberMap = {}
  if (members) members.forEach(m => { memberMap[m.userId || m.id] = m.displayName || m.name || '—' })

  const targetProjects = projectId
    ? projects.filter(p => p.id === projectId)
    : projects

  const tree = targetProjects.map(project => {
    const projMilestones = milestones
      .filter(m => m.project_id === project.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    const projTasks = tasks.filter(t => t.projectId === project.id)

    const msNodes = projMilestones.map(ms => {
      const msTasks = projTasks
        .filter(t => t.keyMilestoneId === ms.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

      const taskNodes = msTasks.map(t => ({
        id: t.id,
        type: 'task',
        name: t.text,
        color: project.color,
        projectColor: project.color,
        ownerId: t.assigneeId,
        ownerName: t.assigneeId ? memberMap[t.assigneeId] || '—' : '미배정',
        startDate: parseDate(t.startDate),
        dueDate: parseDate(t.dueDate),
        inherited: false,
        progress: 0,
        done: t.done,
        category: t.category,
        depth: rootLevel === 'project' ? 2 : 1,
        children: [],
        expanded: false,
        visible: true,
        raw: t,
      }))

      const doneTasks = msTasks.filter(t => t.done).length

      return {
        id: ms.id,
        type: 'milestone',
        name: ms.title || '(제목 없음)',
        color: ms.color ? _colorHexToId(ms.color) : project.color,
        projectColor: project.color,
        ownerId: ms.owner_id,
        ownerName: ms.owner_id ? memberMap[ms.owner_id] || '—' : '—',
        startDate: parseDate(ms.start_date),
        dueDate: parseDate(ms.end_date),
        inherited: false,
        progress: msTasks.length > 0 ? Math.round((doneTasks / msTasks.length) * 100) : 0,
        done: false,
        category: '',
        depth: rootLevel === 'project' ? 1 : 0,
        children: taskNodes,
        expanded: true,
        visible: true,
        raw: ms,
      }
    })

    // Unlinked tasks (no milestone)
    const unlinkedTasks = projTasks
      .filter(t => !t.keyMilestoneId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

    const unlinkedTaskNodes = unlinkedTasks.map(t => ({
      id: t.id,
      type: 'task',
      name: t.text,
      color: project.color,
      projectColor: project.color,
      ownerId: t.assigneeId,
      ownerName: t.assigneeId ? memberMap[t.assigneeId] || '—' : '미배정',
      startDate: parseDate(t.startDate),
      dueDate: parseDate(t.dueDate),
      inherited: false,
      progress: 0,
      done: t.done,
      category: t.category,
      depth: rootLevel === 'project' ? 1 : 0,
      children: [],
      expanded: false,
      visible: true,
      raw: t,
    }))

    const allChildren = [...msNodes, ...unlinkedTaskNodes]
    const completedMs = projMilestones.filter(m => m.status === 'completed').length

    return {
      id: project.id,
      type: 'project',
      name: project.name,
      color: project.color,
      projectColor: project.color,
      ownerId: project.ownerId,
      ownerName: project.ownerId ? memberMap[project.ownerId] || '—' : '—',
      startDate: parseDate(project.start_date),
      dueDate: parseDate(project.due_date),
      inherited: false,
      progress: projMilestones.length > 0 ? Math.round((completedMs / projMilestones.length) * 100) : 0,
      done: false,
      category: '',
      depth: 0,
      children: allChildren,
      expanded: true,
      visible: true,
      raw: project,
    }
  })

  // Apply date inheritance bottom-up
  applyDateInheritance(tree)

  // rootLevel='milestone' → unwrap project node
  if (rootLevel === 'milestone' && tree.length === 1) {
    const projNode = tree[0]
    return projNode.children.map(c => ({
      ...c,
      depth: c.type === 'milestone' ? 0 : 0,
      children: c.children.map(gc => ({ ...gc, depth: 1 })),
    }))
  }

  return tree
}

/* ═══ Date Inheritance (bottom-up) ═══ */
export function applyDateInheritance(nodes) {
  for (const node of nodes) {
    if (node.children.length > 0) {
      applyDateInheritance(node.children)
    }

    if (node.startDate && node.dueDate) {
      node.inherited = false
      continue
    }

    const childDates = node.children
      .filter(c => c.startDate || c.dueDate)
      .flatMap(c => [c.startDate, c.dueDate].filter(Boolean))

    if (childDates.length === 0) continue

    const allTimes = childDates.map(d => d.getTime())

    if (!node.startDate) {
      node.startDate = new Date(Math.min(...allTimes))
      node.inherited = true
    }
    if (!node.dueDate) {
      node.dueDate = new Date(Math.max(...allTimes))
      node.inherited = true
    }
  }
}

/* ═══ Flatten visible rows ═══ */
export function flattenVisibleRows(tree, depthFilter, expandedIds) {
  const maxDepth = depthFilter === 'project' ? 0 : depthFilter === 'milestone' ? 1 : 2
  const rows = []

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.depth > maxDepth) continue
      if (!node.visible) continue
      rows.push(node)
      if (expandedIds.has(node.id) && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }

  traverse(tree)
  return rows
}

/* ═══ Bar Position ═══ */
export function getBarPosition(node, columns, colW, scale, todayCol) {
  if (!node.startDate && !node.dueDate) return null

  const startCol = node.startDate ? dateToColIndex(fmtDate(node.startDate), columns, scale) : -1
  const endCol = node.dueDate ? dateToColIndex(fmtDate(node.dueDate), columns, scale) : -1
  const hasStart = startCol >= 0
  const hasEnd = endCol >= 0

  let left, width
  if (hasStart && hasEnd) {
    left = startCol
    width = endCol - startCol + 1
  } else if (hasStart) {
    left = startCol
    width = 1
  } else if (hasEnd) {
    left = endCol
    width = 1
  } else {
    return null
  }

  // Clamp to visible range
  const clampedStart = Math.max(0, left)
  const clampedEnd = Math.min(columns.length - 1, left + width - 1)
  if (clampedEnd < 0 || clampedStart >= columns.length) return null

  const span = clampedEnd - clampedStart + 1

  return {
    left: clampedStart * colW,
    width: span * colW,
    clippedLeft: left < 0,
    clippedRight: left + width - 1 >= columns.length,
  }
}

/* ═══ Tooltip data ═══ */
export function getTooltipData(node) {
  const durationDays = node.startDate && node.dueDate
    ? diffDays(node.startDate, node.dueDate) + 1
    : null
  const dateRange = node.startDate && node.dueDate
    ? `${fmtDate(node.startDate).slice(5)} ~ ${fmtDate(node.dueDate).slice(5)}`
    : node.startDate ? `${fmtDate(node.startDate).slice(5)} ~`
    : node.dueDate ? `~ ${fmtDate(node.dueDate).slice(5)}`
    : null

  if (node.type === 'project') {
    return {
      title: node.name,
      lines: [
        dateRange && `기간: ${dateRange}${durationDays ? ` (${durationDays}일)` : ''}${node.inherited ? ' [상속됨]' : ''}`,
        node.ownerName && node.ownerName !== '—' && `오너: ${node.ownerName}`,
        `진행률: ${node.progress}%`,
      ].filter(Boolean),
    }
  }
  if (node.type === 'milestone') {
    return {
      title: node.name,
      lines: [
        dateRange && `기간: ${dateRange}${durationDays ? ` (${durationDays}일)` : ''}${node.inherited ? ' [상속됨]' : ''}`,
        node.ownerName && node.ownerName !== '—' && `담당자: ${node.ownerName}`,
        `진행률: ${node.progress}%`,
      ].filter(Boolean),
    }
  }
  // task
  const catLabel = { today: '지금 할일', next: '다음 할일', backlog: '남은 할일' }
  return {
    title: node.name,
    lines: [
      dateRange && `기간: ${dateRange}${durationDays ? ` (${durationDays}일)` : ''}`,
      node.ownerName && `담당자: ${node.ownerName}`,
      node.category && catLabel[node.category] && `상태: ${catLabel[node.category]}`,
    ].filter(Boolean),
  }
}

/* ═══ Helper: milestone hex color → color ID ═══ */
// Milestones may store hex colors directly. Map known ones back to IDs.
const HEX_TO_ID = {
  '#1D9E75': 'teal', '#E24B4A': 'red', '#378ADD': 'blue',
  '#EF9F27': 'orange', '#7F77DD': 'purple', '#D4537E': 'pink',
  '#888780': 'gray', '#d4a039': 'yellow', '#cb7161': 'pink',
  '#5b9a6a': 'green', '#5b8fd4': 'blue', '#8e6ebf': 'purple',
  '#d48a3f': 'orange', '#4a9e8e': 'teal', '#c46060': 'red',
}
function _colorHexToId(hex) {
  if (!hex) return 'gray'
  // If it's already an ID like 'blue', return as-is
  if (COLOR_ID_TO_RAMP[hex]) return hex
  return HEX_TO_ID[hex] || HEX_TO_ID[hex.toUpperCase()] || 'teal'
}

/* ═══ Scale constants ═══ */
export const COL_WIDTHS = { month: 36, quarter: 12, year: 18 }
export const SCALES = [
  { key: 'month', label: '월간' },
  { key: 'quarter', label: '분기' },
  { key: 'year', label: '연간' },
]
