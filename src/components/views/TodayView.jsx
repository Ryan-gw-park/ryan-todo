import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext, DragOverlay, useDroppable,
  PointerSensor, TouchSensor, useSensors, useSensor, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import { CheckIcon } from '../shared/Icons'
import { parseDateFromText } from '../../utils/dateParser'
import { getNextAlarmTime } from '../../utils/alarm'
import ProjectFilter from '../shared/ProjectFilter'
import useProjectFilter from '../../hooks/useProjectFilter'
import UniversalCard from '../common/UniversalCard'

const HIGHLIGHT_COLORS = {
  red:    { bg: '#E53E3E' },
  orange: { bg: '#DD6B20' },
  yellow: { bg: '#D69E2E' },
  blue:   { bg: '#3182CE' },
  green:  { bg: '#38A169' },
  purple: { bg: '#805AD5' },
}

export default function TodayView() {
  const { projects, tasks, moveTaskTo, reorderTasks, collapseState, toggleCollapse, setCollapseGroup } = useStore()
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const isMobile = window.innerWidth < 768

  const [activeId, setActiveId] = useState(null)
  const collapsed = collapseState.today || {}
  const allCollapsed = filteredProjects.every(p => collapsed[p.id])

  const toggleAll = () => {
    const newState = {}
    filteredProjects.forEach(p => { newState[p.id] = !allCollapsed })
    setCollapseGroup('today', newState)
  }
  const toggleProject = (pid) => toggleCollapse('today', pid)

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  /* Auto-focus first input on keyboard tab switch */
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        const el = document.querySelector('[data-view="today"] input[type="text"], [data-view="today"] input:not([type])')
        el?.focus()
      }, 50)
    }
    window.addEventListener('view-focus', handler)
    return () => window.removeEventListener('view-focus', handler)
  }, [])

  const greetingEmoji = () => { const h = new Date().getHours(); return h < 12 ? '☀️' : h < 18 ? '🌤' : '🌙' }
  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일 ${['일','월','화','수','목','금','토'][dd.getDay()]}요일`

  const todayAlarms = useMemo(() => {
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    return tasks
      .filter((t) => {
        if (!t.alarm?.enabled) return false
        const next = getNextAlarmTime(t.alarm)
        return next && next <= todayEnd
      })
      .sort((a, b) => {
        const ta = getNextAlarmTime(a.alarm)
        const tb = getNextAlarmTime(b.alarm)
        return ta - tb
      })
  }, [tasks])

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  const handleDragStart = (e) => setActiveId(e.active.id)

  const handleDragEnd = (e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    const overId = over.id

    // Dropped on a project drop zone
    if (typeof overId === 'string' && overId.startsWith('project:')) {
      const targetProjectId = overId.replace('project:', '')
      if (task.projectId !== targetProjectId) {
        const targetTasks = tasks
          .filter(t => t.projectId === targetProjectId && t.category === 'today' && !t.done)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        const newOrder = targetTasks.length > 0 ? targetTasks[targetTasks.length - 1].sortOrder + 1 : Date.now()
        moveTaskTo(active.id, targetProjectId, 'today')
        useStore.getState().updateTask(active.id, { sortOrder: newOrder })
      }
      return
    }

    // Dropped on another task
    const overTask = tasks.find(t => t.id === overId)
    if (!overTask) return

    if (task.projectId === overTask.projectId) {
      // Same project: reorder
      const projectTasks = tasks
        .filter(t => t.projectId === task.projectId && t.category === 'today' && !t.done)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const oldIndex = projectTasks.findIndex(t => t.id === active.id)
      const newIndex = projectTasks.findIndex(t => t.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderTasks(arrayMove(projectTasks, oldIndex, newIndex))
      }
    } else {
      // Cross-project move
      const targetProjectId = overTask.projectId
      const targetTasks = tasks
        .filter(t => t.projectId === targetProjectId && t.category === 'today' && !t.done)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const overIndex = targetTasks.findIndex(t => t.id === overId)
      moveTaskTo(active.id, targetProjectId, 'today')
      const newList = [...targetTasks]
      newList.splice(overIndex, 0, { ...task, projectId: targetProjectId })
      reorderTasks(newList)
    }
  }

  return (
    <div data-view="today" style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="today-header" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="today-greeting">
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0 }}>{greetingEmoji()} 좋은 하루 되세요, Ryan</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{dateStr}</p>
          </div>
          <div className="today-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProjectFilter />
            <button
            onClick={toggleAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999', fontFamily: 'inherit', padding: '4px 0', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
            onMouseLeave={e => e.currentTarget.style.color = '#999'}
          >
            {allCollapsed ? '전체 펼치기' : '전체 접기'}
          </button>
          </div>
        </div>
        {todayAlarms.length > 0 && (
          <div style={{ marginBottom: 20, padding: '14px 16px', background: '#fffdf5', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#37352f', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔔</span> 오늘 예정된 알람
            </div>
            {todayAlarms.map((task) => {
              const next = getNextAlarmTime(task.alarm)
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: '#e8a735', fontWeight: 600, fontSize: 12, minWidth: 52 }}>
                    {next.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: '#37352f' }}>{task.text}</span>
                </div>
              )
            })}
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {filteredProjects.map(p => {
              const c = getColor(p.color)
              const todayTasks = tasks
                .filter(t => t.projectId === p.id && t.category === 'today' && !t.done)
                .sort((a, b) => a.sortOrder - b.sortOrder)
              return (
                <ProjectCard key={p.id} project={p} color={c} todayTasks={todayTasks} activeId={activeId} isCollapsed={collapsed[p.id]} onToggleCollapse={() => toggleProject(p.id)} />
              )
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? <TaskOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

/* ─── Project card with drop zone ─── */
function ProjectCard({ project, color, todayTasks, activeId, isCollapsed, onToggleCollapse }) {
  const { isOver, setNodeRef } = useDroppable({ id: `project:${project.id}` })
  const showHighlight = isOver && activeId
  const isMobile = window.innerWidth < 768

  const [expandedIds, setExpandedIds] = useState(new Set())
  const toggleExpand = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  return (
    <div ref={setNodeRef} style={{
      background: color.card, borderRadius: 10, overflow: 'hidden',
      border: showHighlight ? `2px dashed ${color.dot}` : '1px solid rgba(0,0,0,0.04)',
      transition: 'border 0.15s, background 0.15s',
      ...(showHighlight ? { background: color.header } : {}),
    }}>
      <div style={{ background: color.header, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={onToggleCollapse}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: color.dot }} />
        <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: color.text }}>{project.name}</span>
        <span style={{ fontSize: 11, color: color.text, background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '2px 8px', fontWeight: 600, marginLeft: 'auto' }}>{todayTasks.length}</span>
        <span style={{ color: color.text, opacity: 0.5, fontSize: 12, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
      </div>
      {!isCollapsed && (
        <div style={{ padding: '10px 16px' }}>
          {todayTasks.length === 0 ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#bbb', marginBottom: 8 }}>오늘 할 일이 없습니다</div>
              <InlineAddSimple projectId={project.id} color={color} />
            </div>
          ) : (
            <SortableContext items={todayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {todayTasks.map(tk => (
                <SortableTaskItem
                  key={tk.id}
                  task={tk}
                  expanded={expandedIds.has(tk.id)}
                  onToggleExpand={() => toggleExpand(tk.id)}
                />
              ))}
              <InlineAddSimple projectId={project.id} color={color} />
            </SortableContext>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Sortable task item using UniversalCard ─── */
function SortableTaskItem({ task, expanded, onToggleExpand }) {
  const { toggleDone, updateTask, openDetail } = useStore()
  const isMobile = window.innerWidth < 768
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id })

  // ★ Loop-21: Highlight color
  const hlColorKey = useStore.getState().getHighlightColor(task.id)
  const hlColor = hlColorKey && HIGHLIGHT_COLORS[hlColorKey]

  const handleTitleSave = useCallback((text) => {
    const { startDate, dueDate } = parseDateFromText(text)
    const patch = { text }
    if (startDate) patch.startDate = startDate
    if (dueDate) patch.dueDate = dueDate
    updateTask(task.id, patch)
  }, [task.id, updateTask])

  return (
    <UniversalCard
      type="task"
      data={{ id: task.id, name: task.text, done: false }}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onTitleSave={handleTitleSave}
      onStatusToggle={() => toggleDone(task.id)}
      onDetailOpen={() => openDetail(task)}
      dragRef={setNodeRef}
      dragStyle={{
        transition: transition || undefined,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      dragListeners={!isMobile ? listeners : undefined}
      dragAttributes={attributes}
      isDragging={isDragging}
      style={{
        marginBottom: 1, borderRadius: 6,
        ...(hlColor ? { background: hlColor.bg, color: '#fff' } : {}),
      }}
      renderExpanded={task.notes ? () => (
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>
          {task.notes.length > 100 ? task.notes.slice(0, 100) + '…' : task.notes}
        </div>
      ) : undefined}
    />
  )
}

/* ─── Inline add (simplified for Today view) ─── */
function InlineAddSimple({ projectId, color }) {
  const { addTask } = useStore()
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => { if (active && ref.current) ref.current.focus() }, [active])

  const handleAdd = () => {
    if (!text.trim()) return
    const { startDate, dueDate } = parseDateFromText(text.trim())
    addTask({ text: text.trim(), projectId, category: 'today', startDate, dueDate })
    setText('')
  }

  if (!active) {
    return (
      <button
        onClick={() => { setActive(true); setText('') }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#c8c8c8', fontSize: 12, width: '100%', borderRadius: 4, transition: 'all 0.15s', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.color = color.text; e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#c8c8c8'; e.currentTarget.style.background = 'none' }}
      >
        + 추가
      </button>
    )
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <input
        ref={ref} value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setActive(false) }}
        onBlur={() => { if (!text.trim()) setActive(false) }}
        placeholder="할일을 입력하세요..."
        style={{ width: '100%', padding: '6px 8px', fontSize: 13, border: `1.5px solid ${color.dot}`, borderRadius: 6, outline: 'none', background: 'white', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  )
}

/* ─── Mobile context menu ─── */
/* ─── Drag overlay card ─── */
function TaskOverlay({ task }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '8px 12px', borderRadius: 8, background: 'white',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.06)',
      transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 350,
    }}>
      <div style={{ paddingTop: 1, flexShrink: 0 }}>
        <CheckIcon checked={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: '19px', color: '#37352f' }}>{task.text}</div>
        {task.dueDate && <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>{task.dueDate}</div>}
      </div>
    </div>
  )
}
