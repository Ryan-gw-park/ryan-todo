import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { DndContext, DragOverlay, useDroppable, PointerSensor, TouchSensor, useSensors, useSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import useTeamMembers from '../../hooks/useTeamMembers'
import ProjectFilter from '../shared/ProjectFilter'
import useProjectFilter from '../../hooks/useProjectFilter'
import { useMilestonesByProjects } from '../../hooks/useMilestonesByProjects'
import TimelineFilters from '../timeline/TimelineFilters'
import { MilestoneBar } from '../timeline/MilestoneGanttRow'

/* ─── Date helpers ─── */
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6 }
function diffDays(a, b) { return Math.round((b - a) / 86400000) }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) }
function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function parseDate(s) { if (!s) return null; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d }
function getMonday(d) { const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.getFullYear(), d.getMonth(), diff) }

/* ─── Generate columns for each scale ─── */
function getColumns(baseDate, scale) {
  const cols = []
  if (scale === 'month') {
    const y = baseDate.getFullYear(), m = baseDate.getMonth()
    const n = daysInMonth(y, m)
    for (let i = 1; i <= n; i++) {
      const d = new Date(y, m, i)
      cols.push({ date: d, label: String(i), isWeekend: isWeekend(d) })
    }
  } else if (scale === 'quarter') {
    let weekIdx = 0
    let lastWeekNum = -1
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

function getMonthHeaders(baseDate, scale) {
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
  for (let m = 0; m < 12; m++) {
    const cols = getColumns(baseDate, 'year')
    const count = cols.filter(c => c.date.getMonth() === m && c.date.getFullYear() === y).length
    if (count > 0) headers.push({ label: `${m + 1}월`, span: count })
  }
  return headers
}

const COL_WIDTHS = { month: 36, quarter: 12, year: 18 }
const LEFT_PANEL = 220
const LEFT_PANEL_MOBILE = 130
const ASSIGNEE_W = 50
const SCALES = [
  { key: 'month', label: '월간' },
  { key: 'quarter', label: '분기' },
  { key: 'year', label: '연간' },
]

export default function TimelineView({ projectId = null }) {
  const isProjectMode = !!projectId
  const { projects, tasks, openDetail, updateTask, reorderTasks, moveTaskTo, collapseState, toggleCollapse: storeToggle, currentTeamId } = useStore()
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const isMobile = window.innerWidth < 768
  const panelW = isMobile ? LEFT_PANEL_MOBILE : LEFT_PANEL

  const today = useMemo(() => new Date(), [])
  const [baseDate, setBaseDate] = useState(() => startOfMonth(today))
  const [scale, setScale] = useState('month')
  const collapsed = collapseState.timeline || {}
  const gridRef = useRef(null)
  const [activeId, setActiveId] = useState(null)

  // ★ Loop-28: 뷰 깊이 + 필터 상태
  const [timelineDepth, setTimelineDepth] = useState(isProjectMode ? 'milestone' : 'project')  // 'project' | 'milestone' | 'task'
  const [selProjects, setSelProjects] = useState(null)  // null = 전체
  const [selMembers, setSelMembers] = useState(null)    // null = 전체
  const [showAssigneeOnBar, setShowAssigneeOnBar] = useState(false)

  // ★ Loop-28: 마일스톤 데이터 가져오기
  const projectIds = useMemo(() => filteredProjects.map(p => p.id), [filteredProjects])
  const { milestones: allMilestones } = useMilestonesByProjects(projectIds)

  // ★ Loop-21: 팀원 이름 조회 (팀 모드일 때)
  const [memberMap, setMemberMap] = useState({})
  const [memberList, setMemberList] = useState([])
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName })
      setMemberMap(map)
      setMemberList(members)
    })
  }, [currentTeamId])

  // DnD sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const colW = COL_WIDTHS[scale]
  const columns = useMemo(() => getColumns(baseDate, scale), [baseDate, scale])
  const monthHeaders = useMemo(() => getMonthHeaders(baseDate, scale), [baseDate, scale])
  const gridW = columns.length * colW

  /* ─── Navigate ─── */
  const navigate = (dir) => {
    if (scale === 'month') setBaseDate(d => addMonths(d, dir))
    else if (scale === 'quarter') setBaseDate(d => addMonths(d, dir * 3))
    else setBaseDate(d => new Date(d.getFullYear() + dir, 0, 1))
  }
  const goToday = () => {
    setBaseDate(startOfMonth(today))
    setTimeout(() => {
      if (!gridRef.current) return
      const idx = columns.findIndex(c => isSameDay(c.date, today))
      if (idx >= 0) gridRef.current.scrollLeft = idx * colW - 200
    }, 50)
  }

  /* Auto-scroll to today on mount / scale change */
  useEffect(() => {
    setTimeout(() => {
      if (!gridRef.current) return
      const idx = columns.findIndex(c => {
        if (scale === 'year') return c.date <= today && addDays(c.date, 7) > today
        return isSameDay(c.date, today)
      })
      if (idx >= 0) gridRef.current.scrollLeft = Math.max(0, idx * colW - 200)
    }, 100)
  }, [scale, baseDate])

  /* ─── Data ─── */
  // Loop-28: 필터 적용된 프로젝트
  const displayProjects = useMemo(() => {
    if (isProjectMode) return filteredProjects.filter(p => p.id === projectId)
    if (!selProjects) return filteredProjects
    return filteredProjects.filter(p => selProjects.includes(p.id))
  }, [filteredProjects, selProjects, isProjectMode, projectId])

  // Loop-28: 필터 적용된 할일
  const displayTasks = useMemo(() => {
    let result = filteredTasks.filter(t => !t.done && !t.deletedAt && t.category !== 'done')
    if (isProjectMode) {
      result = result.filter(t => t.projectId === projectId)
    } else if (selProjects) {
      result = result.filter(t => selProjects.includes(t.projectId))
    }
    if (selMembers) {
      result = result.filter(t => !t.assigneeId || selMembers.includes(t.assigneeId))
    }
    return result
  }, [filteredTasks, selProjects, selMembers, isProjectMode, projectId])

  const projectRows = useMemo(() => {
    return displayProjects.map(p => {
      const c = getColor(p.color)
      const projectTasks = displayTasks
        .filter(t => t.projectId === p.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const projectMilestones = allMilestones
        .filter(m => m.project_id === p.id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      return { project: p, color: c, tasks: projectTasks, milestones: projectMilestones }
    })
  }, [displayProjects, displayTasks, allMilestones])

  /* ─── DnD handlers ─── */
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  const handleDragStart = (e) => setActiveId(e.active.id)
  const handleDragEnd = (e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    const overId = over.id

    // Dropped on a project drop zone (project:projectId)
    if (typeof overId === 'string' && overId.startsWith('project:')) {
      const targetProjectId = overId.slice(8)
      if (task.projectId === targetProjectId) return
      moveTaskTo(active.id, targetProjectId, task.category)
      return
    }

    // Dropped on another task
    const overTask = tasks.find(t => t.id === overId)
    if (!overTask) return

    if (task.projectId === overTask.projectId) {
      // Same project: reorder
      const projectTasks = tasks
        .filter(t => t.projectId === task.projectId && t.category !== 'done')
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const oldIndex = projectTasks.findIndex(t => t.id === active.id)
      const newIndex = projectTasks.findIndex(t => t.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderTasks(arrayMove(projectTasks, oldIndex, newIndex))
      }
    } else {
      // Cross-project: move to target's project, keep category
      moveTaskTo(active.id, overTask.projectId, task.category)
    }
  }

  /* ─── Column index for a date ─── */
  const dateToCol = useCallback((dateStr) => {
    const d = parseDate(dateStr)
    if (!d) return -1
    if (scale === 'year') {
      for (let i = columns.length - 1; i >= 0; i--) {
        if (columns[i].date <= d) return i
      }
      return 0
    }
    return columns.findIndex(c => isSameDay(c.date, d))
  }, [columns, scale])

  /* ─── Today column index ─── */
  const todayCol = useMemo(() => {
    if (scale === 'year') {
      for (let i = columns.length - 1; i >= 0; i--) {
        if (columns[i].date <= today) return i
      }
      return -1
    }
    return columns.findIndex(c => isSameDay(c.date, today))
  }, [columns, today, scale])

  /* ─── Period label ─── */
  const periodLabel = useMemo(() => {
    if (scale === 'month') return `${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`
    if (scale === 'quarter') {
      const m1 = baseDate.getMonth() + 1, m3 = m1 + 2
      return `${baseDate.getFullYear()}년 ${m1}~${m3}월`
    }
    return `${baseDate.getFullYear()}년`
  }, [baseDate, scale])

  const prevLabel = scale === 'month' ? `${addMonths(baseDate, -1).getMonth() + 1}월` : scale === 'quarter' ? '이전' : `${baseDate.getFullYear() - 1}`
  const nextLabel = scale === 'month' ? `${addMonths(baseDate, 1).getMonth() + 1}월` : scale === 'quarter' ? '다음' : `${baseDate.getFullYear() + 1}`

  const ROW_H = 30

  return (
    <div style={{ padding: isProjectMode ? 0 : (isMobile ? '20px 0 100px' : '40px 48px'), height: isProjectMode ? '100%' : undefined, display: isProjectMode ? 'flex' : undefined, flexDirection: isProjectMode ? 'column' : undefined }}>
      <div style={{ maxWidth: isProjectMode ? undefined : 1400, margin: isProjectMode ? 0 : '0 auto', flex: isProjectMode ? 1 : undefined, display: isProjectMode ? 'flex' : undefined, flexDirection: isProjectMode ? 'column' : undefined }}>
        {/* ── Header (글로벌 모드만) ── */}
        {!isProjectMode && (
        <div style={{ marginBottom: 32, padding: isMobile ? '0 16px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 27, fontWeight: 700, color: '#37352f', margin: 0 }}>타임라인</h1>
              <p style={{ fontSize: 15, color: '#999', marginTop: 4 }}>{periodLabel}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ProjectFilter />
              <div style={{ display: 'flex', gap: 4 }}>
              {SCALES.map(s => (
                <button key={s.key} onClick={() => setScale(s.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.1s',
                    background: scale === s.key ? '#37352f' : 'white',
                    color: scale === s.key ? 'white' : '#666',
                    border: scale === s.key ? 'none' : '1px solid #e0e0e0',
                  }}
                >{s.label}</button>
              ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate(-1)} style={navBtnStyle}>◀ {prevLabel}</button>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: '#37352f', margin: 0, minWidth: 140, textAlign: 'center' }}>{periodLabel}</h2>
            <button onClick={() => navigate(1)} style={navBtnStyle}>{nextLabel} ▶</button>
            <button onClick={goToday} style={{ ...navBtnStyle, background: '#ef4444', color: 'white', border: 'none', fontWeight: 600 }}>오늘</button>
          </div>
        </div>
        )}

        {/* ── 프로젝트 모드: 간이 네비 + 스케일 바 ── */}
        {isProjectMode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderBottom: '0.5px solid #e8e6df',
            background: '#fafaf8', flexShrink: 0,
          }}>
            <button onClick={() => navigate(-1)} style={{ ...navBtnStyle, padding: '3px 8px', fontSize: 11 }}>◀</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#37352f', minWidth: 80, textAlign: 'center' }}>{periodLabel}</span>
            <button onClick={() => navigate(1)} style={{ ...navBtnStyle, padding: '3px 8px', fontSize: 11 }}>▶</button>
            <button onClick={goToday} style={{ ...navBtnStyle, padding: '3px 8px', fontSize: 11, background: '#ef4444', color: 'white', border: 'none', fontWeight: 600 }}>오늘</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              {SCALES.map(s => (
                <button key={s.key} onClick={() => setScale(s.key)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                  fontFamily: 'inherit', cursor: 'pointer',
                  background: scale === s.key ? '#37352f' : 'transparent',
                  color: scale === s.key ? 'white' : '#888',
                  border: 'none',
                }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loop-28: 뷰 깊이 + 필터 바 ── */}
        <TimelineFilters
          depth={timelineDepth}
          onDepthChange={setTimelineDepth}
          projects={filteredProjects}
          selProjects={selProjects}
          onProjectsChange={setSelProjects}
          members={memberList}
          selMembers={selMembers}
          onMembersChange={setSelMembers}
          projectId={projectId}
          showAssigneeOnBar={showAssigneeOnBar}
          onToggleAssigneeOnBar={currentTeamId ? () => setShowAssigneeOnBar(v => !v) : undefined}
        />

        {/* ── Timeline grid ── */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', overflow: 'hidden', background: 'white', flex: isProjectMode ? 1 : undefined }}>
            {/* Left panel */}
            <div style={{ width: panelW, flexShrink: 0, borderRight: '1px solid #f0f0f0', background: 'white', zIndex: 5 }}>
              {/* Month header spacer */}
              {scale !== 'month' && <div style={{ height: 24 }} />}
              {/* Date header spacer */}
              <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                <span style={{ fontSize: 12, color: '#999', fontWeight: 500, flex: 1, minWidth: 0 }}>프로젝트 / 할일</span>
                <span style={{ fontSize: 10, color: '#999', fontWeight: 500, width: ASSIGNEE_W, textAlign: 'left', flexShrink: 0, borderLeft: '1px solid #f0f0f0', paddingLeft: 8 }}>담당자</span>
              </div>
              {/* Project rows */}
              {projectRows.map(({ project, color, tasks: pts, milestones: pMs }) => {
                const isCollapsed = !isProjectMode && collapsed[project.id]
                // depth='project'일 때는 프로젝트 수준 할일만 표시 (기존 동작)
                // depth='milestone' 또는 'task'일 때는 마일스톤 그룹핑
                const showMilestones = timelineDepth !== 'project'
                const showTasks = timelineDepth === 'task'

                // 마일스톤별 할일 그룹핑
                const tasksByMs = {}
                const backlogTasks = []
                pts.forEach(t => {
                  if (t.keyMilestoneId) {
                    if (!tasksByMs[t.keyMilestoneId]) tasksByMs[t.keyMilestoneId] = []
                    tasksByMs[t.keyMilestoneId].push(t)
                  } else {
                    backlogTasks.push(t)
                  }
                })

                return (
                  <ProjectDropZone key={project.id} id={`project:${project.id}`} isOver={false}>
                    {/* Project header (글로벌 모드만) */}
                    {!isProjectMode && (
                    <div
                      onClick={() => storeToggle('timeline', project.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 4px', cursor: 'pointer', height: ROW_H, boxSizing: 'border-box', borderBottom: '1px solid #f0f0f0' }}
                    >
                      <span style={{ fontSize: 11, color: '#bbb', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>▾</span>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                    </div>
                    )}

                    {/* depth='project': 기존 방식 (프로젝트 바로 아래 할일) */}
                    {!isCollapsed && !showMilestones && (
                      <SortableContext items={pts.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {pts.map(task => (
                          <SortableTaskRow key={task.id} task={task} openDetail={openDetail} rowH={ROW_H} isDragging={activeId === task.id} assigneeName={currentTeamId && task.assigneeId ? memberMap[task.assigneeId] : null} />
                        ))}
                      </SortableContext>
                    )}

                    {/* depth='milestone' 또는 'task': 마일스톤 그룹핑 */}
                    {!isCollapsed && showMilestones && (
                      <>
                        {pMs.map(ms => {
                          const msTasks = tasksByMs[ms.id] || []
                          const msCollapsed = collapsed[ms.id]
                          const hasChildren = showTasks && msTasks.length > 0

                          return (
                            <div key={ms.id}>
                              {/* 마일스톤 헤더 */}
                              <div
                                onClick={() => hasChildren && storeToggle('timeline', ms.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '6px 4px 6px 20px',
                                  cursor: hasChildren ? 'pointer' : 'default',
                                  height: ROW_H, boxSizing: 'border-box',
                                  borderBottom: '1px solid #f0f0f0',
                                  background: '#fafafa',
                                }}
                              >
                                {hasChildren ? (
                                  <span style={{ fontSize: 9, color: '#a09f99', transform: msCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0, width: 10 }}>▾</span>
                                ) : (
                                  <span style={{ width: 10, flexShrink: 0 }} />
                                )}
                                <div style={{ width: 7, height: 7, borderRadius: 2, background: ms.color || '#1D9E75', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ms.title || '제목 없음'}</span>
                              </div>
                              {/* 마일스톤 할일 (depth='task') */}
                              {showTasks && !msCollapsed && msTasks.map(task => (
                                <SortableTaskRow key={task.id} task={task} openDetail={openDetail} rowH={ROW_H} isDragging={activeId === task.id} assigneeName={currentTeamId && task.assigneeId ? memberMap[task.assigneeId] : null} indent={2} />
                              ))}
                            </div>
                          )
                        })}

                        {/* 백로그 (마일스톤 미연결 할일) */}
                        {backlogTasks.length > 0 && (
                          <div>
                            <div
                              onClick={() => showTasks && storeToggle('timeline', `${project.id}__backlog`)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 4px 6px 20px',
                                cursor: showTasks ? 'pointer' : 'default',
                                height: ROW_H, boxSizing: 'border-box',
                                borderBottom: '1px solid #f0f0f0',
                                background: '#fafafa',
                              }}
                            >
                              {showTasks ? (
                                <span style={{ fontSize: 9, color: '#a09f99', transform: collapsed[`${project.id}__backlog`] ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0, width: 10 }}>▾</span>
                              ) : (
                                <span style={{ width: 10, flexShrink: 0 }} />
                              )}
                              <div style={{ width: 7, height: 7, borderRadius: 2, background: '#b4b2a9', flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#a09f99', fontStyle: 'italic' }}>백로그</span>
                            </div>
                            {showTasks && !collapsed[`${project.id}__backlog`] && backlogTasks.map(task => (
                              <SortableTaskRow key={task.id} task={task} openDetail={openDetail} rowH={ROW_H} isDragging={activeId === task.id} assigneeName={currentTeamId && task.assigneeId ? memberMap[task.assigneeId] : null} indent={2} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </ProjectDropZone>
                )
              })}
            </div>

            {/* Right grid (scrollable) */}
            <div ref={gridRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
              <div style={{ width: gridW, minHeight: 200 }}>
                {/* Month header row (quarter/year) */}
                {scale !== 'month' && (
                  <div style={{ display: 'flex', height: 24 }}>
                    {monthHeaders.map((mh, i) => (
                      <div key={i} style={{
                        width: mh.span * colW, fontSize: 11, fontWeight: 600, color: '#666',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent',
                      }}>
                        {mh.label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Date header row */}
                <div style={{ display: 'flex', height: 32, position: 'sticky', top: 0, background: 'white', zIndex: 3 }}>
                  {columns.map((col, i) => {
                    const isToday = todayCol === i
                    return (
                      <div key={i} style={{
                        width: colW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: scale === 'month' ? 12 : 10, fontWeight: isToday ? 700 : 400,
                        color: isToday ? '#ef4444' : col.isWeekend ? '#ccc' : '#999',
                        position: 'relative', overflow: 'visible',
                        background: scale !== 'month' && col.band === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                      }}>
                        {col.label && <span style={{ whiteSpace: 'nowrap', pointerEvents: 'none' }}>{col.label}</span>}
                        {isToday && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />}
                      </div>
                    )
                  })}
                </div>

                {/* Project task rows with blocks */}
                {projectRows.map(({ project, color, tasks: pts, milestones: pMs }) => {
                  const isCollapsed = !isProjectMode && collapsed[project.id]
                  const showMilestones = timelineDepth !== 'project'
                  const showTasks = timelineDepth === 'task'

                  // 마일스톤별 할일 그룹핑
                  const tasksByMs = {}
                  const backlogTasks = []
                  pts.forEach(t => {
                    if (t.keyMilestoneId) {
                      if (!tasksByMs[t.keyMilestoneId]) tasksByMs[t.keyMilestoneId] = []
                      tasksByMs[t.keyMilestoneId].push(t)
                    } else {
                      backlogTasks.push(t)
                    }
                  })

                  return (
                    <div key={project.id}>
                      {/* Project header row — empty in grid (글로벌 모드만) */}
                      {!isProjectMode && (
                      <div style={{ height: ROW_H, position: 'relative' }}>
                        <WeekendShading columns={columns} colW={colW} h={ROW_H} />
                        {todayCol >= 0 && (
                          <div style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: todayCol * colW + colW / 2 - 1,
                            width: 2, background: '#ef4444', zIndex: 1, pointerEvents: 'none', opacity: 0.35,
                          }} />
                        )}
                      </div>
                      )}

                      {/* depth='project': 기존 방식 */}
                      {!isCollapsed && !showMilestones && pts.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          color={color}
                          columns={columns}
                          colW={colW}
                          scale={scale}
                          todayCol={todayCol}
                          dateToCol={dateToCol}
                          rowH={ROW_H}
                          openDetail={openDetail}
                          updateTask={updateTask}
                          isDragging={activeId === task.id}
                          assigneeName={currentTeamId && task.assigneeId ? memberMap[task.assigneeId] : null}
                          showAssigneeOnBar={showAssigneeOnBar}
                        />
                      ))}

                      {/* depth='milestone' 또는 'task': 마일스톤 그룹핑 */}
                      {!isCollapsed && showMilestones && (
                        <>
                          {pMs.map(ms => {
                            const msTasks = tasksByMs[ms.id] || []
                            const msCollapsed = collapsed[ms.id]
                            const msColor = ms.color || '#1D9E75'

                            return (
                              <div key={ms.id}>
                                {/* 마일스톤 바 행 */}
                                <div style={{ height: ROW_H, position: 'relative', background: '#fafafa' }}>
                                  <WeekendShading columns={columns} colW={colW} h={ROW_H} />
                                  {todayCol >= 0 && (
                                    <div style={{
                                      position: 'absolute', top: 0, bottom: 0,
                                      left: todayCol * colW + colW / 2 - 1,
                                      width: 2, background: '#ef4444', zIndex: 1, pointerEvents: 'none', opacity: 0.35,
                                    }} />
                                  )}
                                  <MilestoneBar milestone={ms} columns={columns} colW={colW} dateToCol={dateToCol} rowH={ROW_H} />
                                </div>

                                {/* 마일스톤 할일 (depth='task') */}
                                {showTasks && !msCollapsed && msTasks.map(task => (
                                  <TaskRow
                                    key={task.id}
                                    task={task}
                                    color={{ ...color, header: `${msColor}20`, dot: msColor, text: '#555' }}
                                    columns={columns}
                                    colW={colW}
                                    scale={scale}
                                    todayCol={todayCol}
                                    dateToCol={dateToCol}
                                    rowH={ROW_H}
                                    openDetail={openDetail}
                                    updateTask={updateTask}
                                    isDragging={activeId === task.id}
                                    assigneeName={currentTeamId && task.assigneeId ? memberMap[task.assigneeId] : null}
                                    showAssigneeOnBar={showAssigneeOnBar}
                                  />
                                ))}
                              </div>
                            )
                          })}

                          {/* 백로그 행 */}
                          {backlogTasks.length > 0 && (
                            <div>
                              <div style={{ height: ROW_H, position: 'relative', background: '#fafafa' }}>
                                <WeekendShading columns={columns} colW={colW} h={ROW_H} />
                                {todayCol >= 0 && (
                                  <div style={{
                                    position: 'absolute', top: 0, bottom: 0,
                                    left: todayCol * colW + colW / 2 - 1,
                                    width: 2, background: '#ef4444', zIndex: 1, pointerEvents: 'none', opacity: 0.35,
                                  }} />
                                )}
                              </div>
                              {showTasks && !collapsed[`${project.id}__backlog`] && backlogTasks.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  color={color}
                                  columns={columns}
                                  colW={colW}
                                  scale={scale}
                                  todayCol={todayCol}
                                  dateToCol={dateToCol}
                                  rowH={ROW_H}
                                  openDetail={openDetail}
                                  updateTask={updateTask}
                                  isDragging={activeId === task.id}
                                  assigneeName={currentTeamId && task.assigneeId ? memberMap[task.assigneeId] : null}
                                  showAssigneeOnBar={showAssigneeOnBar}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}

              </div>
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeTask ? <TaskDragOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>

        {!projects.length && (
          <div style={{ padding: 60, textAlign: 'center', color: '#bbb', fontSize: 14 }}>프로젝트를 추가하면 타임라인이 표시됩니다</div>
        )}
        {projects.length > 0 && filteredProjects.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#bbb', fontSize: 14 }}>해당 필터에 맞는 프로젝트가 없습니다</div>
        )}
      </div>
    </div>
  )
}

/* ─── Project drop zone for cross-project DnD ─── */
function ProjectDropZone({ id, children }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} style={{
      transition: 'background 0.15s',
      background: isOver ? 'rgba(0,0,0,0.03)' : 'transparent',
      borderRadius: isOver ? 4 : 0,
    }}>
      {children}
    </div>
  )
}

/* ─── Sortable task row in left panel ─── */
function SortableTaskRow({ task, openDetail, rowH, isDragging, assigneeName, indent = 1 }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
  // indent: 1 = 기본 (프로젝트 하위), 2 = 마일스톤 하위
  const paddingLeft = indent === 2 ? 42 : 30
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: `0 10px 0 ${paddingLeft}px`,
    height: rowH,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'grab',
    boxSizing: 'border-box',
    opacity: isDragging ? 0.3 : 1,
    background: 'transparent',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={() => openDetail(task)}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(0,0,0,0.02)' }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{task.text}</span>
      <span style={{ fontSize: 10, color: '#aaa', fontWeight: 600, width: ASSIGNEE_W, textAlign: 'left', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: '1px solid #f0f0f0', paddingLeft: 8 }}>{assigneeName || ''}</span>
    </div>
  )
}

/* ─── Drag overlay for visual feedback ─── */
function TaskDragOverlay({ task }) {
  return (
    <div style={{
      padding: '0 10px 0 16px', height: 30, display: 'flex', alignItems: 'center',
      background: 'white', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      border: '1px solid #e0e0e0', cursor: 'grabbing', width: 160,
    }}>
      <span style={{ fontSize: 13, color: '#37352f', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.text}</span>
    </div>
  )
}

/* ─── Weekend shading + alternating band backgrounds ─── */
function WeekendShading({ columns, colW, h }) {
  return (
    <>
      {columns.map((col, i) => {
        const els = []
        if (col.isWeekend) {
          els.push(<div key={`w${i}`} style={{ position: 'absolute', left: i * colW, width: colW, height: h, background: 'rgba(0,0,0,0.025)', top: 0 }} />)
        }
        if (col.band === 1) {
          els.push(<div key={`b${i}`} style={{ position: 'absolute', left: i * colW, width: colW, height: h, background: 'rgba(0,0,0,0.02)', top: 0 }} />)
        }
        return els.length ? els : null
      })}
    </>
  )
}

/* ─── Task row: block rendering + drag/resize (right grid) ─── */
function TaskRow({ task, color, columns, colW, scale, todayCol, dateToCol, rowH, openDetail, updateTask, isDragging, assigneeName, showAssigneeOnBar }) {
  const rowRef = useRef(null)
  const [dragState, setDragState] = useState(null)

  const startCol = dateToCol(task.startDate)
  const endCol = dateToCol(task.dueDate)
  const hasStart = startCol >= 0
  const hasEnd = endCol >= 0
  const noDates = !hasStart && !hasEnd

  let blockLeft, blockWidth
  if (hasStart && hasEnd) {
    blockLeft = startCol * colW
    blockWidth = (endCol - startCol + 1) * colW
  } else if (hasStart) {
    blockLeft = startCol * colW
    blockWidth = colW
  } else if (hasEnd) {
    blockLeft = endCol * colW
    blockWidth = colW
  } else {
    blockLeft = todayCol >= 0 ? todayCol * colW : 0
    blockWidth = colW
  }

  if (dragState) {
    const dx = dragState.currentX - dragState.startX
    const colDelta = Math.round(dx / colW)

    if (dragState.type === 'move') {
      const baseCol = hasStart ? startCol : hasEnd ? endCol : (todayCol >= 0 ? todayCol : 0)
      blockLeft = baseCol * colW + colDelta * colW
    } else if (dragState.type === 'resizeL') {
      const baseStart = hasStart ? startCol : (todayCol >= 0 ? todayCol : 0)
      const baseEnd = hasEnd ? endCol : baseStart
      const newStartCol = baseStart + colDelta
      const clampedStart = Math.min(newStartCol, baseEnd)
      blockLeft = clampedStart * colW
      blockWidth = (baseEnd - clampedStart + 1) * colW
    } else if (dragState.type === 'resizeR') {
      const baseStart = hasStart ? startCol : (todayCol >= 0 ? todayCol : 0)
      const baseEnd = hasEnd ? endCol : baseStart
      const newEndCol = baseEnd + colDelta
      const clampedEnd = Math.max(newEndCol, baseStart)
      blockWidth = (clampedEnd - baseStart + 1) * colW
    }
  }

  const handleMouseDown = useCallback((e, type) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    setDragState({ type, startX, currentX: startX })

    const handleMouseMove = (ev) => {
      setDragState(prev => prev ? { ...prev, currentX: ev.clientX } : null)
    }
    const handleMouseUp = (ev) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      const dx = ev.clientX - startX
      const colDelta = Math.round(dx / colW)
      setDragState(null)

      if (Math.abs(dx) < 5) {
        openDetail(task)
        return
      }

      if (colDelta === 0) return

      const patch = {}
      if (type === 'move') {
        if (task.startDate) {
          patch.startDate = fmtDate(addDays(parseDate(task.startDate), colDelta))
        }
        if (task.dueDate) {
          patch.dueDate = fmtDate(addDays(parseDate(task.dueDate), colDelta))
        }
        if (!task.startDate && !task.dueDate && todayCol >= 0) {
          const targetDate = fmtDate(columns[Math.max(0, Math.min(todayCol + colDelta, columns.length - 1))].date)
          patch.startDate = targetDate
          patch.dueDate = targetDate
        }
      } else if (type === 'resizeL') {
        const baseDate = task.startDate ? parseDate(task.startDate) : (todayCol >= 0 ? columns[todayCol].date : null)
        const endDate = task.dueDate ? parseDate(task.dueDate) : baseDate
        if (!baseDate) return
        const newDate = addDays(baseDate, colDelta)
        if (endDate && newDate > endDate) return
        patch.startDate = fmtDate(newDate)
        if (!task.dueDate) patch.dueDate = fmtDate(endDate)
      } else if (type === 'resizeR') {
        const endDate = task.dueDate ? parseDate(task.dueDate) : (todayCol >= 0 ? columns[todayCol].date : null)
        const startDate = task.startDate ? parseDate(task.startDate) : endDate
        if (!endDate) return
        const newDate = addDays(endDate, colDelta)
        if (startDate && newDate < startDate) return
        patch.dueDate = fmtDate(newDate)
        if (!task.startDate) patch.startDate = fmtDate(startDate)
      }

      if (Object.keys(patch).length) updateTask(task.id, patch)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [task, colW, columns, todayCol, updateTask, openDetail])

  return (
    <div ref={rowRef} style={{ height: rowH, position: 'relative', opacity: isDragging ? 0.3 : 1 }}>
      <WeekendShading columns={columns} colW={colW} h={rowH} />

      {todayCol >= 0 && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: todayCol * colW + colW / 2 - 1,
          width: 2, background: '#ef4444', zIndex: 1, pointerEvents: 'none', opacity: 0.35,
        }} />
      )}

      <div
        style={{
          position: 'absolute', top: 3, left: Math.max(blockLeft, 0),
          width: Math.max(blockWidth, colW), height: 24,
          background: color.header, borderRadius: 4,
          border: `1px solid ${color.dot}40`,
          cursor: dragState ? 'grabbing' : 'grab',
          display: 'flex', alignItems: 'center', overflow: 'visible',
          boxShadow: dragState ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          opacity: dragState ? 0.85 : noDates ? 0.6 : 1,
          transition: dragState ? 'none' : 'box-shadow 0.15s, opacity 0.15s',
          zIndex: dragState ? 10 : 2,
          userSelect: 'none',
        }}
        onMouseDown={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const relX = e.clientX - rect.left
          if (relX <= 5) {
            handleMouseDown(e, 'resizeL')
          } else if (relX >= rect.width - 5) {
            handleMouseDown(e, 'resizeR')
          } else {
            handleMouseDown(e, 'move')
          }
        }}
        onMouseMove={e => {
          if (dragState) return
          const rect = e.currentTarget.getBoundingClientRect()
          const relX = e.clientX - rect.left
          if (relX <= 5 || relX >= rect.width - 5) {
            e.currentTarget.style.cursor = 'col-resize'
          } else {
            e.currentTarget.style.cursor = 'grab'
          }
        }}
        title={task.text}
      >
        <div style={{ width: 4, height: '100%', cursor: 'col-resize', flexShrink: 0 }} />
        <span style={{
          fontSize: 12, fontWeight: 500, color: color.text,
          padding: '0 4px',
          whiteSpace: 'nowrap', pointerEvents: 'none',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.text}
        </span>
        {showAssigneeOnBar && assigneeName && (
          <span style={{
            fontSize: 10, color: `${color.text}99`, fontWeight: 500,
            whiteSpace: 'nowrap', pointerEvents: 'none',
            padding: '0 4px', flexShrink: 0,
          }}>
            {assigneeName}
          </span>
        )}
        <div style={{ width: 4, height: '100%', cursor: 'col-resize', flexShrink: 0 }} />
      </div>
    </div>
  )
}

const navBtnStyle = {
  padding: '5px 12px', borderRadius: 6, border: '1px solid #e0e0e0',
  background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500,
  fontFamily: 'inherit', color: '#666', transition: 'all 0.1s',
}
