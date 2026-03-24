import { useState, useMemo, useCallback } from 'react'
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import { getColor } from '../../utils/colors'

/* ═══════════════════════════════════════════════════════
   PersonalWeeklyView — 개인 주간 플래너
   행=프로젝트, 열=월~금
   scope="personal" — 내 할일만
   ═══════════════════════════════════════════════════════ */

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function PersonalWeeklyView() {
  const { projects, tasks, updateTask, openDetail, sortProjectsLocally } = useStore()
  const showToast = useStore(s => s.showToast)
  const userId = getCachedUserId()
  const isMobile = window.innerWidth < 768

  // Week state
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const weekDays = useMemo(() => [0, 1, 2, 3, 4].map(i => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  }), [weekStart])
  const weekDateStrs = useMemo(() => weekDays.map(fmtDate), [weekDays])
  const todayStr = fmtDate(new Date())

  const prevWeek = () => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() - 7); return d })
  const nextWeek = () => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() + 7); return d })
  const goThisWeek = () => setWeekStart(getMonday(new Date()))

  // 내 할일만 필터
  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigneeId === userId || t.createdBy === userId),
    [tasks, userId]
  )

  // 이번 주에 dueDate가 있는 할일
  const weekTasks = useMemo(() =>
    myTasks.filter(t => !t.done && t.dueDate && weekDateStrs.includes(t.dueDate)),
    [myTasks, weekDateStrs]
  )

  // 백로그: dueDate 없는 할일
  const backlogTasks = useMemo(() =>
    myTasks.filter(t => !t.done && !t.dueDate),
    [myTasks]
  )

  // 내 할일이 있는 프로젝트
  const allProjects = sortProjectsLocally(projects)
  const projectsWithTasks = useMemo(() => {
    const ids = new Set([...weekTasks, ...backlogTasks].map(t => t.projectId))
    return allProjects.filter(p => ids.has(p.id))
  }, [allProjects, weekTasks, backlogTasks])

  const projectMap = useMemo(() => {
    const m = {}
    projects.forEach(p => { m[p.id] = p })
    return m
  }, [projects])

  // DnD
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)
  const [activeId, setActiveId] = useState(null)
  const activeTask = activeId ? myTasks.find(t => t.id === activeId) : null

  const handleDragEnd = useCallback((e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const task = myTasks.find(t => t.id === active.id)
    if (!task) return
    const overId = String(over.id)
    // Drop on day cell: `day:${dateStr}`
    if (overId.startsWith('day:')) {
      const newDate = overId.split(':')[1]
      if (task.dueDate === newDate) return
      updateTask(task.id, { dueDate: newDate })
    }
    // Drop on backlog: `backlog`
    if (overId === 'backlog') {
      if (!task.dueDate) return
      updateTask(task.id, { dueDate: null })
    }
  }, [myTasks, updateTask])

  const weekNum = (() => {
    const oneJan = new Date(weekStart.getFullYear(), 0, 1)
    return Math.ceil(((weekStart - oneJan) / 86400000 + oneJan.getDay() + 1) / 7)
  })()

  return (
    <div data-view="personal-weekly" style={{ padding: isMobile ? '20px 0 100px' : '40px 48px' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Main grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0, letterSpacing: '-0.02em' }}>개인 주간 플래너</h1>
              <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>
                {weekStart.getFullYear()}년 {weekStart.getMonth() + 1}월 — {weekNum}주차
              </p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={prevWeek} style={navBtnStyle}>◀</button>
              <button onClick={goThisWeek} style={{ ...navBtnStyle, padding: '4px 10px', fontSize: 11 }}>이번 주</button>
              <button onClick={nextWeek} style={navBtnStyle}>▶</button>
            </div>
          </div>

          <DndContext sensors={sensors} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: `130px repeat(5, 1fr)`, gap: 0, border: '0.5px solid #e8e6df', borderRadius: 10, overflow: 'hidden' }}>
              {/* Day headers */}
              <div style={{ padding: '8px 10px', background: '#fafaf8', borderBottom: '1px solid #e8e6df', borderRight: '0.5px solid #e8e6df', fontSize: 10, fontWeight: 600, color: '#a09f99' }}>
                프로젝트
              </div>
              {weekDays.map((d, i) => {
                const ds = fmtDate(d)
                const isToday = ds === todayStr
                return (
                  <div key={i} style={{
                    padding: '8px 8px', background: isToday ? '#fef9ec' : '#fafaf8',
                    borderBottom: '1px solid #e8e6df', borderRight: '0.5px solid #e8e6df',
                    fontSize: 11, fontWeight: isToday ? 700 : 500,
                    color: isToday ? '#d97706' : '#a09f99',
                  }}>
                    {DAY_LABELS[i]} {d.getMonth() + 1}/{d.getDate()}
                    {isToday && <span style={{ fontSize: 9, marginLeft: 4 }}>오늘</span>}
                  </div>
                )
              })}

              {/* Project rows */}
              {projectsWithTasks.map(proj => {
                const c = getColor(proj.color)
                return [
                  <div key={`p-${proj.id}`} style={{
                    padding: '8px 10px', borderBottom: '0.5px solid #e8e6df', borderRight: '0.5px solid #e8e6df',
                    display: 'flex', alignItems: 'flex-start', gap: 5, background: `${c.dot}04`,
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 3 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#37352f' }}>{proj.name}</span>
                  </div>,
                  ...weekDays.map((d, di) => {
                    const ds = fmtDate(d)
                    const isToday = ds === todayStr
                    const dayTasks = weekTasks.filter(t => t.projectId === proj.id && t.dueDate === ds)
                    return (
                      <DayCellDrop key={`${proj.id}-${di}`} id={`day:${ds}`}>
                        <div style={{
                          padding: '4px 4px', borderBottom: '0.5px solid #e8e6df', borderRight: '0.5px solid #e8e6df',
                          minHeight: 50, background: isToday ? '#fffbeb' : 'transparent',
                        }}>
                          {dayTasks.map(t => (
                            <DraggableWeekTask key={t.id} task={t} />
                          ))}
                          {dayTasks.length === 0 && (
                            <div style={{ padding: '8px 4px', fontSize: 10, color: '#e0e0e0', textAlign: 'center' }}>—</div>
                          )}
                        </div>
                      </DayCellDrop>
                    )
                  })
                ]
              })}

              {projectsWithTasks.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
                  이번 주 예정된 할일이 없습니다.
                </div>
              )}
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeTask && (
                <div style={{ background: '#fff', borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 8px', fontSize: 11, color: '#37352f', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeTask.text}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Backlog sidebar (desktop) */}
        {!isMobile && (
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#37352f', marginBottom: 8, marginTop: 76 }}>
              백로그 <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{backlogTasks.length}</span>
            </div>
            <BacklogDropZone id="backlog">
              <div style={{ background: '#fafaf8', borderRadius: 8, border: '0.5px solid #e8e6df', padding: 4, minHeight: 100 }}>
                {backlogTasks.map(t => {
                  const p = projectMap[t.projectId]
                  const c = p ? getColor(p.color) : null
                  return (
                    <DraggableWeekTask key={t.id} task={t} projectDot={c?.dot} />
                  )
                })}
                {backlogTasks.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 10, color: '#ccc' }}>없음</div>
                )}
              </div>
            </BacklogDropZone>
          </div>
        )}
      </div>
    </div>
  )
}

const navBtnStyle = {
  border: '1px solid #e0e0e0', background: '#fff', borderRadius: 6,
  padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#666', fontFamily: 'inherit',
}

function DayCellDrop({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} style={{ background: isOver ? '#f0efeb' : 'transparent', transition: 'background 0.1s' }}>{children}</div>
}

function BacklogDropZone({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} style={{ background: isOver ? '#f0efeb' : 'transparent', borderRadius: 8, transition: 'background 0.1s' }}>{children}</div>
}

function DraggableWeekTask({ task, projectDot }) {
  const { openDetail } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      onClick={() => openDetail(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', marginBottom: 2,
        background: '#fff', borderRadius: 5, border: '0.5px solid #e8e6df',
        cursor: 'grab', fontSize: 10.5, color: '#37352f',
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.borderColor = '#ccc' }}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e6df'}
    >
      {projectDot && <div style={{ width: 5, height: 5, borderRadius: '50%', background: projectDot, flexShrink: 0 }} />}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.text}</span>
    </div>
  )
}
