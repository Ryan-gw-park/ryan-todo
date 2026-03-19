import { useState, useMemo, useEffect, useCallback } from 'react'
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'
import useProjectFilter from '../../hooks/useProjectFilter'
import { getColor } from '../../utils/colors'
import ProjectFilter from '../shared/ProjectFilter'
import ProgressBar from '../common/ProgressBar'

/* ═══════════════════════════════════════════════════════
   WeeklyPlannerView — 주간 플래너
   행=담당자, 열=월~금, 우측=백로그 사이드바
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

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekNumber(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d - oneJan) / 86400000)
  return Math.ceil((days + oneJan.getDay() + 1) / 7)
}

const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function WeeklyPlannerView() {
  const { projects, tasks, updateTask, openDetail } = useStore()
  const currentTeamId = useStore(s => s.currentTeamId)
  const userName = useStore(s => s.userName) || '나'
  const showToast = useStore(s => s.showToast)
  const userId = getCachedUserId()

  // ─── Week state ───
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const weekDays = useMemo(() => [0, 1, 2, 3, 4].map(i => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  }), [weekStart])
  const weekDateStrs = useMemo(() => weekDays.map(fmtDate), [weekDays])
  const todayStr = fmtDate(new Date())

  // ─── Members ───
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) return
    let cancelled = false
    useTeamMembers.getMembers(currentTeamId).then(m => {
      if (!cancelled) setMembers(m)
    })
    return () => { cancelled = true }
  }, [currentTeamId])

  const memberRows = useMemo(() => {
    if (!currentTeamId || members.length === 0) {
      return [{ id: '_me', name: userName, userId: userId }]
    }
    return members.map(m => ({
      id: m.id,
      name: m.displayName || m.email?.split('@')[0] || '?',
      userId: m.userId,
    }))
  }, [currentTeamId, members, userName, userId])

  // ─── Project filter ───
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const projectMap = useMemo(() => {
    const m = {}
    projects.forEach(p => { m[p.id] = p })
    return m
  }, [projects])

  // ─── Milestones (store에서 loadAll 시 함께 로딩됨) ───
  const milestones = useStore(s => s.milestones)

  // ─── Grid data: tasks in this week ───
  const weekTasksByCell = useMemo(() => {
    const map = {} // key: `${memberId}__${dateStr}`
    filteredTasks.forEach(t => {
      if (t.done) return
      if (!t.dueDate || !weekDateStrs.includes(t.dueDate)) return
      // Determine member
      let memId = '_me'
      if (currentTeamId) {
        if (t.assigneeId) {
          const row = memberRows.find(m => m.userId === t.assigneeId)
          memId = row ? row.id : '_unassigned'
        } else {
          memId = '_unassigned'
        }
      }
      const key = `${memId}__${t.dueDate}`
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [filteredTasks, weekDateStrs, currentTeamId, memberRows])

  // ─── Backlog state ───
  const [backlogProject, setBacklogProject] = useState('all')
  const [backlogCat, setBacklogCat] = useState('all')
  const [backlogTab, setBacklogTab] = useState('tasks') // 'tasks' | 'milestones'

  const backlogTasks = useMemo(() => {
    return filteredTasks.filter(t => {
      if (t.done) return false
      if (t.dueDate && weekDateStrs.includes(t.dueDate)) return false
      if (backlogProject !== 'all' && t.projectId !== backlogProject) return false
      if (backlogCat === 'backlog') return t.category === 'backlog'
      if (backlogCat === 'next') return t.category === 'next'
      return true
    })
  }, [filteredTasks, weekDateStrs, backlogProject, backlogCat])

  const backlogByProject = useMemo(() => {
    const map = {}
    backlogTasks.forEach(t => {
      const pid = t.projectId || '_none'
      if (!map[pid]) map[pid] = []
      map[pid].push(t)
    })
    return map
  }, [backlogTasks])

  // Milestones for backlog sidebar
  const backlogMilestones = useMemo(() => {
    if (backlogProject === 'all') return milestones
    return milestones.filter(ms => ms.project_id === backlogProject)
  }, [milestones, backlogProject])

  const msTaskStats = useMemo(() => {
    const stats = {}
    milestones.forEach(ms => { stats[ms.id] = { total: 0, done: 0 } })
    tasks.forEach(t => {
      if (!t.keyMilestoneId || !stats[t.keyMilestoneId]) return
      stats[t.keyMilestoneId].total += 1
      if (t.done) stats[t.keyMilestoneId].done += 1
    })
    return stats
  }, [milestones, tasks])

  // ─── DnD ───
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)
  const [activeId, setActiveId] = useState(null)
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback((event) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || !active) return

    const taskId = active.id
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const targetData = over.data?.current
    if (!targetData) return

    // Drop on backlog
    if (targetData.type === 'backlog') {
      updateTask(taskId, { dueDate: null, category: 'backlog' })
      return
    }

    // Drop on day cell
    if (targetData.type === 'day-cell') {
      const { date: targetDate, memberId: targetMemberId } = targetData
      const project = projectMap[task.projectId]

      // Personal project → can't assign to others
      if (project && !project.teamId && targetMemberId && targetMemberId !== userId) {
        showToast('개인 프로젝트 할일은 본인에게만 배정 가능합니다')
        return
      }

      const patch = { dueDate: targetDate, category: 'today' }

      // Resolve assigneeId from member row
      if (targetMemberId && currentTeamId) {
        const targetRow = memberRows.find(m => m.id === targetMemberId)
        if (targetRow && targetRow.userId !== task.assigneeId) {
          patch.assigneeId = targetRow.userId
        }
      }

      updateTask(taskId, patch)
    }
  }, [tasks, projectMap, userId, currentTeamId, memberRows, updateTask, showToast])

  // ─── Week navigation ───
  const goThisWeek = () => setWeekStart(getMonday(new Date()))
  const goPrev = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
  const goNext = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 4)
    const ys = weekStart.getFullYear()
    const ms = String(weekStart.getMonth() + 1).padStart(2, '0')
    const ds = String(weekStart.getDate()).padStart(2, '0')
    const me = String(end.getMonth() + 1).padStart(2, '0')
    const de = String(end.getDate()).padStart(2, '0')
    return `${ys}.${ms}.${ds} ~ ${me}.${de} (${getWeekNumber(weekStart)}주차)`
  }, [weekStart])

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div data-view="weekly" style={{ padding: '40px 48px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* ─── Header ─── */}
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <WeekNav onPrev={goPrev} onThis={goThisWeek} onNext={goNext} />
              <span style={{ fontSize: 13, color: '#6b6a66' }}>{weekLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <ProjectFilter />
            </div>
          </div>

          {/* ─── Body: Grid + Backlog ─── */}
          <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>

            {/* ─── Main Grid ─── */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `100px repeat(5, minmax(140px, 1fr))`,
                gap: 1,
                minWidth: 100 + 5 * 140,
              }}>
                {/* Header row */}
                <div style={{ padding: 8 }} />
                {weekDays.map((d, i) => {
                  const dateStr = fmtDate(d)
                  const isToday = dateStr === todayStr
                  return (
                    <div key={i} style={{
                      padding: '8px 10px', textAlign: 'center',
                      background: isToday ? '#fef9ec' : '#fafaf8',
                      borderRadius: '8px 8px 0 0',
                      borderBottom: '1px solid #e8e6df',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? '#92400e' : '#37352f' }}>
                        {DAY_LABELS[i]} {d.getMonth() + 1}/{d.getDate()}
                      </div>
                    </div>
                  )
                })}

                {/* Member rows */}
                {memberRows.map(mem => [
                  <div key={`label-${mem.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: 8,
                    borderBottom: '0.5px solid #e8e6df',
                  }}>
                    <MemberAvatar name={mem.name} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#37352f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mem.name.split(' ')[0]}
                    </span>
                  </div>,
                  ...weekDays.map((d, di) => {
                    const dateStr = fmtDate(d)
                    const isToday = dateStr === todayStr
                    const cellKey = `${mem.id}__${dateStr}`
                    const cellTasks = weekTasksByCell[cellKey] || []
                    return (
                      <DayCell
                        key={`cell-${mem.id}-${di}`}
                        cellId={cellKey}
                        memberId={mem.id}
                        date={dateStr}
                        isToday={isToday}
                        tasks={cellTasks}
                        projectMap={projectMap}
                        onOpenDetail={openDetail}
                      />
                    )
                  }),
                ])}
              </div>
            </div>

            {/* ─── Backlog Sidebar ─── */}
            <BacklogSidebar
              backlogProject={backlogProject}
              setBacklogProject={setBacklogProject}
              backlogCat={backlogCat}
              setBacklogCat={setBacklogCat}
              backlogTab={backlogTab}
              setBacklogTab={setBacklogTab}
              backlogTasks={backlogTasks}
              backlogByProject={backlogByProject}
              backlogMilestones={backlogMilestones}
              msTaskStats={msTaskStats}
              filteredProjects={filteredProjects}
              projectMap={projectMap}
              onOpenDetail={openDetail}
            />
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskOverlayCard task={activeTask} project={projectMap[activeTask.projectId]} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

/* ═══ Week Navigation ═══ */
function WeekNav({ onPrev, onThis, onNext }) {
  const btnStyle = {
    border: 'none', background: '#fafaf8', borderRadius: 4,
    padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#37352f',
    fontFamily: 'inherit',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={onPrev} style={btnStyle}>◀</button>
      <button onClick={onThis} style={{ ...btnStyle, fontWeight: 600, padding: '4px 12px' }}>이번주</button>
      <button onClick={onNext} style={btnStyle}>▶</button>
    </div>
  )
}

/* ═══ Day Cell (droppable) ═══ */
function DayCell({ cellId, memberId, date, isToday, tasks, projectMap, onOpenDetail }) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { type: 'day-cell', memberId, date },
  })

  return (
    <div ref={setNodeRef} style={{
      padding: 6, minHeight: 80,
      background: isOver ? 'rgba(35, 131, 226, 0.06)' : isToday ? '#fefcf5' : '#fff',
      borderBottom: '0.5px solid #e8e6df',
      transition: 'background 0.15s',
    }}>
      {tasks.length === 0 && !isOver && (
        <span style={{ fontSize: 11, color: '#a09f99' }}>—</span>
      )}
      {tasks.map(t => (
        <DraggableTaskCard key={t.id} task={t} project={projectMap[t.projectId]} onOpenDetail={onOpenDetail} />
      ))}
    </div>
  )
}

/* ═══ Draggable Task Card (grid) ═══ */
function DraggableTaskCard({ task, project, onOpenDetail }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', taskId: task.id, source: 'grid' },
  })
  const c = project ? getColor(project.color) : null

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpenDetail(task)}
      style={{
        background: c ? c.card : '#fff',
        borderRadius: 6, padding: '5px 7px', marginBottom: 4,
        border: `0.5px solid ${c ? c.header : '#e8e6df'}`,
        cursor: 'grab', fontSize: 12, color: '#37352f',
        opacity: isDragging ? 0.3 : 1,
        lineHeight: '17px',
      }}
    >
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
        {task.text}
      </div>
      {project && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c?.dot || '#bbb', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: c?.text || '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </span>
        </div>
      )}
    </div>
  )
}

/* ═══ Task Overlay Card (drag preview) ═══ */
function TaskOverlayCard({ task, project }) {
  const c = project ? getColor(project.color) : null
  return (
    <div style={{
      background: c ? c.card : '#fff', borderRadius: 6, padding: '5px 7px',
      border: `0.5px solid ${c ? c.header : '#e8e6df'}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 200,
      fontSize: 12, color: '#37352f',
    }}>
      <div style={{ fontWeight: 500 }}>{task.text}</div>
      {project && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c?.dot || '#bbb' }} />
          <span style={{ fontSize: 10, color: c?.text || '#888' }}>{project.name}</span>
        </div>
      )}
    </div>
  )
}

/* ═══ Backlog Sidebar ═══ */
function BacklogSidebar({
  backlogProject, setBacklogProject, backlogCat, setBacklogCat,
  backlogTab, setBacklogTab, backlogTasks, backlogByProject,
  backlogMilestones, msTaskStats, filteredProjects, projectMap, onOpenDetail,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'backlog-drop',
    data: { type: 'backlog' },
  })

  const pillStyle = (active) => ({
    border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11,
    fontFamily: 'inherit', cursor: 'pointer', fontWeight: active ? 600 : 400,
    background: active ? '#fff' : 'transparent',
    color: active ? '#37352f' : '#a09f99',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
  })

  return (
    <div ref={setNodeRef} style={{
      width: 260, flexShrink: 0, borderLeft: '1px solid #e8e6df',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: isOver ? 'rgba(35,131,226,0.04)' : '#fafaf8',
      transition: 'background 0.15s',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #e8e6df' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#37352f', marginBottom: 8 }}>백로그</div>

        {/* Project dropdown */}
        <select
          value={backlogProject}
          onChange={e => setBacklogProject(e.target.value)}
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 6,
            border: '1px solid #e8e6df', fontSize: 12, fontFamily: 'inherit',
            color: '#37352f', background: '#fff', marginBottom: 6, cursor: 'pointer',
          }}
        >
          <option value="all">전체 프로젝트</option>
          {filteredProjects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 6 }}>
          {[{ key: 'all', label: '전체' }, { key: 'backlog', label: '남은' }, { key: 'next', label: '다음' }].map(it => (
            <button key={it.key} onClick={() => setBacklogCat(it.key)} style={pillStyle(backlogCat === it.key)}>
              {it.label}
            </button>
          ))}
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2 }}>
          {[{ key: 'tasks', label: '할일' }, { key: 'milestones', label: '마일스톤' }].map(it => (
            <button key={it.key} onClick={() => setBacklogTab(it.key)} style={pillStyle(backlogTab === it.key)}>
              {it.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {backlogTab === 'tasks' ? (
          // Tasks list grouped by project
          Object.entries(backlogByProject).map(([pid, pTasks]) => {
            const p = projectMap[pid]
            const c = p ? getColor(p.color) : null
            return (
              <div key={pid} style={{ marginBottom: 10 }}>
                {p && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0', marginBottom: 2 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c?.dot || '#bbb' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: c?.text || '#888' }}>{p.name}</span>
                  </div>
                )}
                {pTasks.map(t => (
                  <BacklogTaskRow key={t.id} task={t} onOpenDetail={onOpenDetail} />
                ))}
              </div>
            )
          })
        ) : (
          // Milestones list
          backlogMilestones.map(ms => {
            const stats = msTaskStats[ms.id] || { total: 0, done: 0 }
            return (
              <div key={ms.id} style={{
                background: '#fff', borderRadius: 6, padding: '6px 8px', marginBottom: 4,
                border: '0.5px solid #e8e6df',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ms.color || '#22c55e', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#37352f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ms.title || '(제목 없음)'}
                  </span>
                </div>
                <ProgressBar done={stats.done} total={stats.total} color={ms.color || '#22c55e'} width={40} />
              </div>
            )
          })
        )}

        {backlogTab === 'tasks' && backlogTasks.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a09f99', fontSize: 12, padding: 20 }}>
            백로그에 할일이 없습니다
          </div>
        )}
        {backlogTab === 'milestones' && backlogMilestones.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a09f99', fontSize: 12, padding: 20 }}>
            마일스톤이 없습니다
          </div>
        )}
      </div>

      {/* Hint */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #e8e6df', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#a09f99' }}>← 요일 셀로 드래그</span>
      </div>
    </div>
  )
}

/* ═══ Backlog Task Row (draggable) ═══ */
function BacklogTaskRow({ task, onOpenDetail }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', taskId: task.id, source: 'backlog' },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpenDetail(task)}
      style={{
        padding: '4px 6px', borderRadius: 4, marginBottom: 2,
        cursor: 'grab', fontSize: 12, color: '#37352f',
        opacity: isDragging ? 0.3 : 1,
        background: isDragging ? 'rgba(35,131,226,0.06)' : 'transparent',
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = '#f5f4f0' }}
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.text}
      </div>
    </div>
  )
}

/* ═══ Member Avatar ═══ */
function MemberAvatar({ name, size = 22 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.45, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}
