import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
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

export default function TodayView() {
  const { projects, tasks, moveTaskTo, reorderTasks } = useStore()
  const isMobile = window.innerWidth < 768

  const [activeId, setActiveId] = useState(null)

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const greetingEmoji = () => { const h = new Date().getHours(); return h < 12 ? '☀️' : h < 18 ? '🌤' : '🌙' }
  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일 ${['일','월','화','수','목','금','토'][dd.getDay()]}요일`

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
          .filter(t => t.projectId === targetProjectId && t.category === 'today')
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
        .filter(t => t.projectId === task.projectId && t.category === 'today')
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
        .filter(t => t.projectId === targetProjectId && t.category === 'today')
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const overIndex = targetTasks.findIndex(t => t.id === overId)
      moveTaskTo(active.id, targetProjectId, 'today')
      const newList = [...targetTasks]
      newList.splice(overIndex, 0, { ...task, projectId: targetProjectId })
      reorderTasks(newList)
    }
  }

  return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#37352f', margin: 0 }}>{greetingEmoji()} 좋은 하루 되세요, Ryan</h1>
          <p style={{ fontSize: 14, color: '#999', marginTop: 6 }}>{dateStr}</p>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {projects.map(p => {
              const c = getColor(p.color)
              const todayTasks = tasks
                .filter(t => t.projectId === p.id && t.category === 'today')
                .sort((a, b) => a.sortOrder - b.sortOrder)
              return (
                <ProjectCard key={p.id} project={p} color={c} todayTasks={todayTasks} activeId={activeId} />
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

/* ─── Project card with drop zone + keyboard navigation ─── */
function ProjectCard({ project, color, todayTasks, activeId }) {
  const { addTask, updateTask, deleteTask, reorderTasks } = useStore()
  const { isOver, setNodeRef } = useDroppable({ id: `project:${project.id}` })
  const showHighlight = isOver && activeId

  const taskRefs = useRef({})
  const pendingFocusRef = useRef(null)

  /* Focus a newly created task after re-render */
  useEffect(() => {
    if (pendingFocusRef.current) {
      const { idx, pos } = pendingFocusRef.current
      pendingFocusRef.current = null
      const task = todayTasks[idx]
      if (task) {
        setTimeout(() => taskRefs.current[task.id]?.focusTitle(pos), 40)
      }
    }
  })

  const handleSwap = useCallback((i, dir) => {
    const j = i + dir
    if (j < 0 || j >= todayTasks.length) return
    const a = todayTasks[i], b = todayTasks[j]
    const aOrder = a.sortOrder, bOrder = b.sortOrder
    updateTask(a.id, { sortOrder: bOrder })
    updateTask(b.id, { sortOrder: aOrder })
    setTimeout(() => taskRefs.current[a.id]?.focusTitle('end'), 50)
  }, [todayTasks, updateTask])

  const handleTitleEnter = useCallback((i, afterText) => {
    const task = todayTasks[i]
    const nextTask = todayTasks[i + 1]
    const sortOrder = nextTask
      ? (task.sortOrder + nextTask.sortOrder) / 2
      : task.sortOrder + 1
    addTask({ text: afterText, projectId: project.id, category: 'today', sortOrder })
    pendingFocusRef.current = { idx: i + 1, pos: 'start' }
  }, [todayTasks, addTask, project.id])

  const handleTitleBackspace = useCallback((i) => {
    const task = todayTasks[i]
    if (!task.text && todayTasks.length <= 1) return
    deleteTask(task.id)
    if (i > 0) {
      setTimeout(() => taskRefs.current[todayTasks[i - 1].id]?.focusTitle('end'), 40)
    }
  }, [todayTasks, deleteTask])

  return (
    <div ref={setNodeRef} style={{
      background: color.card, borderRadius: 10, overflow: 'hidden',
      border: showHighlight ? `2px dashed ${color.dot}` : '1px solid rgba(0,0,0,0.04)',
      transition: 'border 0.15s, background 0.15s',
      ...(showHighlight ? { background: color.header } : {}),
    }}>
      <div style={{ background: color.header, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: color.dot }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: color.text }}>{project.name}</span>
        <span style={{ fontSize: 11, color: color.text, background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '2px 8px', fontWeight: 600, marginLeft: 'auto' }}>{todayTasks.length}</span>
      </div>
      <div style={{ padding: '10px 16px' }}>
        {todayTasks.length === 0 ? (
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#bbb', marginBottom: 8 }}>오늘 할 일이 없습니다</div>
            <InlineAddSimple projectId={project.id} color={color} />
          </div>
        ) : (
          <SortableContext items={todayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {todayTasks.map((tk, i) => (
              <SortableTaskItem
                key={tk.id}
                ref={el => taskRefs.current[tk.id] = el}
                task={tk}
                color={color}
                onMoveUp={() => {
                  if (i > 0) taskRefs.current[todayTasks[i - 1].id]?.focusTitle('end')
                }}
                onMoveDown={() => {
                  if (i < todayTasks.length - 1) taskRefs.current[todayTasks[i + 1].id]?.focusTitle('start')
                }}
                onSwapUp={() => handleSwap(i, -1)}
                onSwapDown={() => handleSwap(i, 1)}
                onTitleEnter={(afterText) => handleTitleEnter(i, afterText)}
                onTitleBackspace={() => handleTitleBackspace(i)}
              />
            ))}
            <InlineAddSimple projectId={project.id} color={color} />
          </SortableContext>
        )}
      </div>
    </div>
  )
}

/* ─── Sortable + editable task item ─── */
const SortableTaskItem = forwardRef(function SortableTaskItem(
  { task, color, onMoveUp, onMoveDown, onSwapUp, onSwapDown, onTitleEnter, onTitleBackspace },
  ref
) {
  const { toggleDone, updateTask } = useStore()
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id })

  const titleRef = useRef(null)
  const [titleText, setTitleText] = useState(task.text)

  useEffect(() => { setTitleText(task.text) }, [task.text])

  useImperativeHandle(ref, () => ({
    focusTitle: (pos = 'end') => {
      setTimeout(() => {
        const el = titleRef.current
        if (!el) return
        el.focus()
        const p = pos === 'start' ? 0 : (typeof pos === 'number' ? pos : el.value.length)
        el.setSelectionRange(p, p)
      }, 30)
    },
  }))

  const saveTitle = useCallback(() => {
    const trimmed = titleText.trim()
    if (trimmed && trimmed !== task.text) {
      const { startDate, dueDate } = parseDateFromText(trimmed)
      const patch = { text: trimmed }
      if (startDate) patch.startDate = startDate
      if (dueDate) patch.dueDate = dueDate
      updateTask(task.id, patch)
    }
    if (!trimmed) setTitleText(task.text)
  }, [titleText, task.text, task.id, updateTask])

  const handleKeyDown = (e) => {
    // Alt+Shift+↑↓ — reorder
    if (e.altKey && e.shiftKey && e.key === 'ArrowUp') { e.preventDefault(); onSwapUp?.(); return }
    if (e.altKey && e.shiftKey && e.key === 'ArrowDown') { e.preventDefault(); onSwapDown?.(); return }

    // Enter — save + split + new task
    if (e.key === 'Enter') {
      e.preventDefault()
      const cursor = e.target.selectionStart
      const before = titleText.slice(0, cursor)
      const after = titleText.slice(cursor)
      if (!before && !after) { onTitleBackspace?.(); return }
      const saveBefore = before || titleText
      setTitleText(saveBefore)
      if (saveBefore !== task.text) updateTask(task.id, { text: saveBefore })
      onTitleEnter?.(after)
      return
    }

    // Backspace on empty
    if (e.key === 'Backspace' && titleText === '') { e.preventDefault(); onTitleBackspace?.(); return }

    // ↑↓ — navigate
    if (e.key === 'ArrowUp') { e.preventDefault(); saveTitle(); onMoveUp?.(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); saveTitle(); onMoveDown?.(); return }

    // Escape — revert and blur
    if (e.key === 'Escape') { setTitleText(task.text); e.target.blur() }
  }

  const rowStyle = {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '5px 4px', borderRadius: 6,
    transition: transition || 'background 0.1s',
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    background: isDragging ? 'rgba(0,0,0,0.02)' : 'transparent',
  }

  return (
    <div ref={setNodeRef} style={rowStyle} {...listeners} {...attributes}>
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ paddingTop: 1, flexShrink: 0, cursor: 'pointer' }}>
        <CheckIcon checked={false} />
      </div>
      {/* Editable title */}
      <input
        ref={titleRef}
        value={titleText}
        onChange={e => setTitleText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={saveTitle}
        placeholder="할일 입력..."
        style={{
          flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500,
          border: 'none', outline: 'none', padding: '2px 0',
          fontFamily: 'inherit', background: 'transparent',
          color: '#37352f', lineHeight: '19px', boxSizing: 'border-box',
        }}
      />
      {task.dueDate && <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0, marginTop: 3 }}>{task.dueDate}</span>}
    </div>
  )
})

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
