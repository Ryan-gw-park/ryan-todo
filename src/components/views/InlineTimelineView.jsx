import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { COLOR, FONT, SPACE } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import useProjectFilter from '../../hooks/useProjectFilter'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getColor } from '../../utils/colors'

/* ═══════════════════════════════════════════════════════
   InlineTimelineView — 통합 인라인 타임라인
   한 행 = 텍스트 + 아바타 + 간트 바 (좌우 분리 없음)
   ═══════════════════════════════════════════════════════ */

// ─── Date helpers ───
function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function fmtWeek(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weeksBetween(d1, d2) {
  return (d2 - d1) / (7 * 24 * 60 * 60 * 1000)
}

// Generate week columns: -4 weeks ~ +12 weeks from today
function generateWeekColumns() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = getMonday(today)
  start.setDate(start.getDate() - 4 * 7) // 4 weeks before
  const cols = []
  for (let i = 0; i < 20; i++) { // 20 weeks total
    const d = new Date(start)
    d.setDate(d.getDate() + i * 7)
    cols.push(d)
  }
  return { cols, startDate: cols[0], todayIdx: 4 }
}

const COL_W = 72 // px per week column

// ─── Depth styles ───
const MS_DEPTH = {
  0: { indent: 0, barH: 22, barOp: 0.25, fontSize: 12, fontWeight: 700, bg: true },
  1: { indent: 20, barH: 20, barOp: 0.40, fontSize: 11, fontWeight: 600, bg: false },
  2: { indent: 40, barH: 18, barOp: 0.65, fontSize: 10.5, fontWeight: 500, bg: false },
}

export default function InlineTimelineView({ scope, projectId }) {
  const isProjectMode = !!projectId
  const { projects, tasks, openDetail, updateTask } = useStore()
  const currentTeamId = useStore(s => s.currentTeamId)
  const milestones = useStore(s => s.milestones)
  const { filteredProjects } = useProjectFilter(projects, tasks)
  const userId = getCachedUserId()
  const gridRef = useRef(null)

  // ─── Depth filter ───
  const [depth, setDepth] = useState('ms+task') // 'project' | 'ms' | 'ms+task'
  const [collapsed, setCollapsed] = useState(new Set())

  const toggle = useCallback((id) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ─── Team members ───
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName || m.email?.split('@')[0] || '?' })
      setMemberMap(map)
    })
  }, [currentTeamId])

  // ─── Week columns ───
  const { cols: weekCols, startDate, todayIdx } = useMemo(() => generateWeekColumns(), [])

  // ─── Build display data ───
  const displayProjects = useMemo(() => {
    let base = scope === 'personal' ? projects : filteredProjects
    if (isProjectMode) {
      return base.filter(p => p.id === projectId)
    }
    return base
  }, [projects, filteredProjects, scope, isProjectMode, projectId])

  // ─── Build hierarchical tree: project → MS tree → tasks ───
  const visibleRows = useMemo(() => {
    const rows = []

    displayProjects.forEach(p => {
      const projMs = milestones.filter(m => m.project_id === p.id)
      const projTasks = tasks.filter(t => t.projectId === p.id && !t.deletedAt)

      // Personal scope: filter to my MS/tasks only
      if (scope === 'personal') {
        const myTaskIds = new Set(projTasks.filter(t => t.assigneeId === userId || t.createdBy === userId).map(t => t.id))
        const myMsIds = new Set()
        projTasks.forEach(t => {
          if (myTaskIds.has(t.id) && t.keyMilestoneId) myMsIds.add(t.keyMilestoneId)
        })
        projMs.forEach(ms => {
          if (ms.owner_id === userId) myMsIds.add(ms.id)
        })
        // Also include parent MS of any visible MS
        const allMsIds = new Set(myMsIds)
        myMsIds.forEach(msId => {
          let current = projMs.find(m => m.id === msId)
          while (current && current.parent_id) {
            allMsIds.add(current.parent_id)
            current = projMs.find(m => m.id === current.parent_id)
          }
        })
        if (allMsIds.size === 0 && myTaskIds.size === 0) return // skip project entirely
      }

      // Compute project span from MS/tasks
      const allDates = []
      projMs.forEach(ms => {
        if (ms.start_date) allDates.push(new Date(ms.start_date))
        if (ms.end_date) allDates.push(new Date(ms.end_date))
      })
      projTasks.forEach(t => {
        if (t.startDate) allDates.push(new Date(t.startDate))
        if (t.dueDate) allDates.push(new Date(t.dueDate))
      })

      const projStart = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : null
      const projEnd = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null

      // Project row — skip in project mode (already shown in project header)
      if (!isProjectMode) {
        rows.push({
          rowType: 'project', id: p.id, name: p.name, color: getColor(p.color).dot,
          projectColor: getColor(p.color).dot,
          startDate: projStart, endDate: projEnd,
          hasChildren: projMs.length > 0 || projTasks.length > 0,
        })

        if (collapsed.has(p.id)) return
        if (depth === 'project') return
      }

      // Build MS tree
      const rootMs = projMs.filter(m => !m.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

      function traverseMs(msList, parentDepth) {
        msList.forEach(ms => {
          const d = ms.depth ?? parentDepth
          const childMs = projMs.filter(m => m.parent_id === ms.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          const msTasks = projTasks.filter(t => t.keyMilestoneId === ms.id && !t.done)
          const msDoneTasks = projTasks.filter(t => t.keyMilestoneId === ms.id && t.done)
          const hasChildMs = childMs.length > 0

          // Personal scope filter
          if (scope === 'personal') {
            const hasMyTask = [...msTasks, ...msDoneTasks].some(t => t.assigneeId === userId || t.createdBy === userId)
            const isMyMs = ms.owner_id === userId
            if (!hasMyTask && !isMyMs && !hasChildMs) return
          }

          // Compute MS span
          let msStart = ms.start_date ? new Date(ms.start_date) : null
          let msEnd = ms.end_date ? new Date(ms.end_date) : null
          if (!msStart || !msEnd) {
            const tDates = []
            ;[...msTasks, ...msDoneTasks].forEach(t => {
              if (t.startDate) tDates.push(new Date(t.startDate))
              if (t.dueDate) tDates.push(new Date(t.dueDate))
            })
            if (tDates.length > 0) {
              if (!msStart) msStart = new Date(Math.min(...tDates.map(dd => dd.getTime())))
              if (!msEnd) msEnd = new Date(Math.max(...tDates.map(dd => dd.getTime())))
            }
          }

          const ownerName = ms.owner_id ? (memberMap[ms.owner_id] || '?') : null
          const taskCount = msTasks.length + msDoneTasks.length

          rows.push({
            rowType: 'ms', id: ms.id, name: ms.title || '(제목 없음)',
            depth: d, color: getColor(p.color).dot, projectColor: getColor(p.color).dot,
            startDate: msStart, endDate: msEnd,
            ownerName, taskCount,
            hasChildren: hasChildMs || msTasks.length > 0,
            hasChildMs,
            isEmpty: !hasChildMs && taskCount === 0,
          })

          if (collapsed.has(ms.id)) return

          if (hasChildMs) {
            traverseMs(childMs, d + 1)
          } else if (depth === 'ms+task') {
            // Leaf MS → show tasks
            const filteredTasks = scope === 'personal'
              ? msTasks.filter(t => t.assigneeId === userId || t.createdBy === userId)
              : msTasks
            filteredTasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).forEach(t => {
              const tOwner = t.assigneeId ? (memberMap[t.assigneeId] || '?') : null
              rows.push({
                rowType: 'task', id: t.id, text: t.text,
                projectColor: getColor(p.color).dot,
                startDate: t.startDate ? new Date(t.startDate) : null,
                endDate: t.dueDate ? new Date(t.dueDate) : null,
                ownerName: tOwner, done: t.done, raw: t,
              })
            })
            rows.push({ rowType: 'addTask', id: `add-${ms.id}`, projectColor: getColor(p.color).dot })
          }
        })
      }

      traverseMs(rootMs, 0)

      // Unlinked tasks (no MS)
      if (depth === 'ms+task') {
        const unlinked = projTasks.filter(t => !t.keyMilestoneId && !t.done)
        const filteredUnlinked = scope === 'personal'
          ? unlinked.filter(t => t.assigneeId === userId || t.createdBy === userId)
          : unlinked
        if (filteredUnlinked.length > 0) {
          rows.push({
            rowType: 'ms', id: `unlinked-${p.id}`, name: '미배정 할일',
            depth: 0, color: '#a09f99', projectColor: getColor(p.color).dot,
            startDate: null, endDate: null,
            ownerName: null, taskCount: filteredUnlinked.length,
            hasChildren: true, hasChildMs: false, isEmpty: false,
          })
          if (!collapsed.has(`unlinked-${p.id}`)) {
            filteredUnlinked.forEach(t => {
              const tOwner = t.assigneeId ? (memberMap[t.assigneeId] || '?') : null
              rows.push({
                rowType: 'task', id: t.id, text: t.text,
                projectColor: getColor(p.color).dot,
                startDate: t.startDate ? new Date(t.startDate) : null,
                endDate: t.dueDate ? new Date(t.dueDate) : null,
                ownerName: tOwner, done: t.done, raw: t,
              })
            })
          }
        }
      }
    })

    return rows
  }, [displayProjects, milestones, tasks, depth, collapsed, scope, userId, memberMap])

  // ─── Auto-scroll to today on mount ───
  useEffect(() => {
    if (!gridRef.current) return
    setTimeout(() => {
      if (gridRef.current) gridRef.current.scrollLeft = Math.max(0, todayIdx * COL_W - 120)
    }, 100)
  }, [])

  // ─── Date label ───
  const today = new Date()
  const monthLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월`

  const LEFT_W = isProjectMode ? 300 : 260

  return (
    <div data-view="timeline" style={{ padding: isProjectMode ? 0 : SPACE.viewPadding, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: isProjectMode ? undefined : 1400, margin: isProjectMode ? 0 : '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ─── Header (global mode only) ─── */}
        {!isProjectMode && (
          <div style={{ marginBottom: 16, flexShrink: 0 }}>
            <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0 }}>
              {scope === 'personal' ? '개인 타임라인' : '타임라인'}
            </h1>
            <p style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary, marginTop: 4 }}>{monthLabel}</p>
          </div>
        )}

        {/* ─── Toolbar ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: COLOR.textTertiary }}>깊이:</span>
          {[
            ...(!isProjectMode ? [{ k: 'project', l: '프로젝트' }] : []),
            { k: 'ms', l: '마일스톤' },
            { k: 'ms+task', l: '마일스톤+할일' },
          ].map(d => (
            <button key={d.k} onClick={() => setDepth(d.k)} style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: depth === d.k ? '#1e293b' : COLOR.bgSurface,
              color: depth === d.k ? '#fff' : COLOR.textTertiary,
              fontWeight: depth === d.k ? 600 : 400,
            }}>{d.l}</button>
          ))}
          {scope === 'personal' && (
            <div style={{ marginLeft: 12, padding: '3px 10px', background: '#fef3c7', borderRadius: 5, fontSize: 10, color: '#92400e', fontWeight: 600 }}>
              내 담당 MS/할일만 표시
            </div>
          )}
        </div>

        {/* ─── Grid ─── */}
        <div ref={gridRef} style={{ flex: 1, overflow: 'auto', border: `1px solid ${COLOR.border}`, borderRadius: 8 }}>
          <div style={{ minWidth: LEFT_W + weekCols.length * COL_W }}>

            {/* Date header */}
            <div style={{ display: 'flex', height: 32, borderBottom: `1px solid ${COLOR.border}`, position: 'sticky', top: 0, background: '#fff', zIndex: 4 }}>
              <div style={{ width: LEFT_W, flexShrink: 0, padding: '0 12px', display: 'flex', alignItems: 'center', position: 'sticky', left: 0, background: '#fff', zIndex: 5 }}>
                <span style={{ fontSize: FONT.label, color: COLOR.textTertiary, fontWeight: 500 }}>
                  {isProjectMode ? '마일스톤 / 할일' : '프로젝트 / MS / 할일'}
                </span>
              </div>
              {weekCols.map((d, i) => (
                <div key={i} style={{
                  width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: i === todayIdx ? 700 : 400,
                  color: i === todayIdx ? '#ef4444' : COLOR.textTertiary,
                  borderLeft: '0.5px solid #f0f0f0',
                }}>{fmtWeek(d)}</div>
              ))}
            </div>

            {/* Rows */}
            {visibleRows.map(row => {
              const color = row.projectColor || row.color

              // ─── Project row ───
              if (row.rowType === 'project') {
                const isCol = collapsed.has(row.id)
                const barPos = getBarPos(row.startDate, row.endDate, startDate)
                return (
                  <div key={row.id} onClick={() => toggle(row.id)} style={{
                    display: 'flex', height: 34, borderBottom: `0.5px solid ${COLOR.border}`,
                    background: '#fafaf8', cursor: 'pointer',
                  }}>
                    <div style={{ width: LEFT_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', position: 'sticky', left: 0, background: '#fafaf8', zIndex: 3 }}>
                      <span style={{ fontSize: 9, color: COLOR.textTertiary, width: 12, textAlign: 'center' }}>{isCol ? '▸' : '▾'}</span>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLOR.textPrimary }}>{row.name}</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 34 }}>
                      {barPos && <GanttBar left={barPos.left} width={barPos.width} color={color} height={24} opacity={0.2} label={row.name} />}
                      <TodayLine idx={todayIdx} />
                    </div>
                  </div>
                )
              }

              // ─── MS row ───
              if (row.rowType === 'ms') {
                const d = Math.min(row.depth || 0, 2)
                const ds = MS_DEPTH[d] || MS_DEPTH[2]
                const isCol = collapsed.has(row.id)
                const indent = 24 + ds.indent
                const barPos = getBarPos(row.startDate, row.endDate, startDate)

                return (
                  <div key={row.id} onClick={() => row.hasChildren && toggle(row.id)} style={{
                    display: 'flex', height: d === 0 ? 30 : 28,
                    borderBottom: `0.5px solid ${d === 0 ? COLOR.border : '#f0f0f0'}`,
                    background: ds.bg ? '#fafaf8' : 'transparent',
                    cursor: row.hasChildren ? 'pointer' : 'default',
                  }}>
                    <div style={{ width: LEFT_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: `0 12px 0 ${indent}px`, position: 'sticky', left: 0, background: ds.bg ? '#fafaf8' : '#fff', zIndex: 3 }}>
                      {row.hasChildren ? (
                        <span style={{ fontSize: 8, color: COLOR.textTertiary, width: 10, textAlign: 'center' }}>{isCol ? '▸' : '▾'}</span>
                      ) : <span style={{ width: 10 }} />}
                      <div style={{ width: d === 0 ? 7 : 6, height: d === 0 ? 7 : 6, borderRadius: '50%', background: color, flexShrink: 0, opacity: d === 0 ? 1 : 0.7 }} />
                      {row.ownerName && <MiniAvatar name={row.ownerName} size={d === 0 ? 16 : 14} />}
                      <span style={{
                        fontSize: ds.fontSize, fontWeight: ds.fontWeight,
                        color: d === 0 ? COLOR.textPrimary : COLOR.textSecondary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>{row.name}</span>
                      {row.taskCount > 0 && <span style={{ fontSize: 9, color: COLOR.textTertiary }}>{row.taskCount}건</span>}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: d === 0 ? 30 : 28 }}>
                      {barPos && <GanttBar
                        left={barPos.left} width={barPos.width}
                        color={color} height={ds.barH} opacity={ds.barOp}
                        label={d <= 1 ? row.name : ''}
                        dashed={row.isEmpty}
                      />}
                      <TodayLine idx={todayIdx} />
                    </div>
                  </div>
                )
              }

              // ─── Task row ───
              if (row.rowType === 'task') {
                const barPos = getBarPos(row.startDate, row.endDate, startDate)
                return (
                  <div key={row.id} onClick={() => row.raw && openDetail(row.raw)} style={{
                    display: 'flex', height: 26, borderBottom: '0.5px solid #f8f8f6', cursor: 'pointer',
                  }}>
                    <div style={{ width: LEFT_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px 0 64px', position: 'sticky', left: 0, background: '#fff', zIndex: 3 }}>
                      <div style={{
                        width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                        border: row.done ? 'none' : `1.5px solid ${COLOR.textTertiary}`,
                        background: row.done ? '#22c55e' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {row.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      {row.ownerName && <MiniAvatar name={row.ownerName} size={14} />}
                      <span style={{
                        fontSize: FONT.body, color: row.done ? COLOR.textTertiary : COLOR.textPrimary, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: row.done ? 'line-through' : 'none',
                      }}>{row.text}</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 26 }}>
                      {barPos && <GanttBar left={barPos.left} width={barPos.width} color={row.done ? '#ccc' : color} height={16} opacity={row.done ? 0.4 : 0.85} />}
                    </div>
                  </div>
                )
              }

              // ─── Add task ───
              if (row.rowType === 'addTask') {
                return (
                  <div key={row.id} style={{ display: 'flex', height: 22, borderBottom: '0.5px solid #f8f8f6' }}>
                    <div style={{ width: LEFT_W, flexShrink: 0, padding: '0 12px 0 64px', display: 'flex', alignItems: 'center', position: 'sticky', left: 0, background: '#fff', zIndex: 3 }}>
                      <span style={{ fontSize: 10, color: '#d0d0d0', cursor: 'pointer' }}>+ 할일 추가</span>
                    </div>
                  </div>
                )
              }

              return null
            })}

            {visibleRows.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
                표시할 항목이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bar position calculator ───
function getBarPos(startDate, endDate, timelineStart) {
  if (!startDate && !endDate) return null
  const s = startDate || endDate
  const e = endDate || startDate
  const leftWeeks = weeksBetween(timelineStart, s)
  const widthWeeks = Math.max(weeksBetween(s, e), 0.5)
  return {
    left: leftWeeks * COL_W + 2,
    width: Math.max(widthWeeks * COL_W - 4, 8),
  }
}

// ─── Gantt bar ───
function GanttBar({ left, width, color, height = 20, opacity = 1, label, dashed }) {
  return (
    <div style={{
      position: 'absolute', left, width, height,
      top: '50%', transform: 'translateY(-50%)',
      background: dashed ? 'transparent' : color,
      border: dashed ? `1.5px dashed ${color}` : 'none',
      borderRadius: 4, opacity, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', paddingLeft: 4, overflow: 'hidden',
    }}>
      {label && <span style={{ fontSize: 9, color: dashed ? color : '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
    </div>
  )
}

// ─── Today line ───
function TodayLine({ idx }) {
  return <div style={{ position: 'absolute', left: idx * COL_W + COL_W / 2, top: 0, bottom: 0, width: 2, background: '#ef4444', opacity: 0.3, zIndex: 1 }} />
}

// ─── Mini avatar ───
function MiniAvatar({ name, size = 16 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.42, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}
