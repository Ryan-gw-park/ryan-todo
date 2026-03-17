import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { DndContext, DragOverlay, useDroppable, useSensor, useSensors, PointerSensor, TouchSensor, pointerWithin } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { useKeyMilestones } from '../../hooks/useKeyMilestones'
import { useKeyDeliverables } from '../../hooks/useKeyDeliverables'
import { useKeyLinks } from '../../hooks/useKeyLinks'
import { useKeyPolicies } from '../../hooks/useKeyPolicies'
import CompactMilestoneRow from './CompactMilestoneRow'
import MilestoneTaskChip from './MilestoneTaskChip'

const DEFAULT_TASK_W = 400
const TASK_COL_W_KEY = 'milestoneTaskColW'
const SPLIT_MIN_PCT = 0.30 // each side must be at least 30% of container

export default function CompactMilestoneTab({ projectId }) {
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)
  const { milestones, add: addMilestone, update: updateMilestone, reorder: reorderMilestones } = useKeyMilestones(pkm?.id, projectId)
  const { deliverables, getByMilestone } = useKeyDeliverables(pkm?.id, projectId)
  const { items: links } = useKeyLinks(pkm?.id, projectId)
  const { items: policies } = useKeyPolicies(pkm?.id, projectId)

  const tasks = useStore(s => s.tasks)
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const openModal = useStore(s => s.openModal)

  const [expandedMs, setExpandedMs] = useState(new Set())
  const [activeTask, setActiveTask] = useState(null)
  const [activeMilestone, setActiveMilestone] = useState(null)
  const containerRef = useRef(null)
  const [taskColW, setTaskColW] = useState(() => {
    const saved = localStorage.getItem(TASK_COL_W_KEY)
    return saved ? Number(saved) || DEFAULT_TASK_W : DEFAULT_TASK_W
  })

  // Track latest value for resize handler closure
  const taskColWRef = useRef(taskColW)
  useEffect(() => {
    taskColWRef.current = taskColW
    localStorage.setItem(TASK_COL_W_KEY, String(taskColW))
  }, [taskColW])

  // Sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  // Project tasks
  const projectTasks = useMemo(() =>
    tasks.filter(t => t.projectId === projectId && !t.deletedAt),
    [tasks, projectId]
  )

  const getTasksForMilestone = useCallback((msId) =>
    projectTasks.filter(t => t.keyMilestoneId === msId && !t.done)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [projectTasks]
  )

  const backlogTasks = useMemo(() =>
    projectTasks.filter(t => !t.keyMilestoneId && !t.done)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [projectTasks]
  )

  // Expand/collapse
  const allMsIds = useMemo(() => [...milestones.map(m => m.id), '__backlog__'], [milestones])
  const allExpanded = expandedMs.size >= allMsIds.length

  const toggleExpandAll = useCallback(() => {
    if (allExpanded) setExpandedMs(new Set())
    else setExpandedMs(new Set(allMsIds))
  }, [allExpanded, allMsIds])

  const toggleExpand = useCallback((id) => {
    setExpandedMs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  // DnD handlers
  const handleDragStart = useCallback((event) => {
    const data = event.active.data.current
    if (data?.type === 'task') {
      const task = projectTasks.find(t => t.id === data.taskId)
      if (task) setActiveTask(task)
    } else if (data?.type === 'milestone') {
      const ms = milestones.find(m => m.id === event.active.id)
      if (ms) setActiveMilestone(ms)
    }
  }, [projectTasks, milestones])

  const handleDragEnd = useCallback((event) => {
    setActiveTask(null)
    setActiveMilestone(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // Case 1: milestone reorder
    if (activeData?.type === 'milestone' && overData?.type === 'milestone') {
      if (active.id !== over.id) {
        const oldIndex = milestones.findIndex(m => m.id === active.id)
        const newIndex = milestones.findIndex(m => m.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderMilestones(arrayMove([...milestones], oldIndex, newIndex))
        }
      }
      return
    }

    // Case 2: task moved to different milestone
    if (activeData?.type === 'task') {
      let targetMsId = null

      if (overData?.type === 'milestone-drop') {
        targetMsId = overData.milestoneId
      } else if (overData?.type === 'task') {
        targetMsId = overData.sourceMsId
      } else if (overData?.type === 'milestone') {
        targetMsId = over.id
      }

      if (targetMsId !== undefined) {
        const newKeyMilestoneId = (targetMsId === '__backlog__' || targetMsId === null) ? null : targetMsId
        const currentMsId = activeData.sourceMsId === '__backlog__' ? null : activeData.sourceMsId
        if (currentMsId !== newKeyMilestoneId) {
          updateTask(activeData.taskId, { keyMilestoneId: newKeyMilestoneId })
        }
      }
      return
    }
  }, [milestones, reorderMilestones, updateTask, projectTasks])

  const handleDragCancel = useCallback(() => { setActiveTask(null); setActiveMilestone(null) }, [])

  // Add task to milestone
  const handleAddTask = useCallback((msId, text) => {
    const keyMilestoneId = (msId === '__backlog__' || msId === null) ? null : msId
    addTask({ text, projectId, category: 'today', keyMilestoneId })
  }, [addTask, projectId])

  // Add milestone
  const handleAddMilestone = useCallback(async () => {
    const newMs = await addMilestone()
    if (newMs) {
      setExpandedMs(prev => new Set([...prev, newMs.id]))
    }
  }, [addMilestone])

  // Update milestone title
  const handleUpdateMilestone = useCallback((msId, patch) => {
    updateMilestone(msId, patch)
  }, [updateMilestone])

  // Resize bar handler — uses ref to avoid stale closure
  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = taskColWRef.current
    const containerW = containerRef.current?.offsetWidth || 1200
    const minW = Math.round(containerW * SPLIT_MIN_PCT)
    const maxW = Math.round(containerW * (1 - SPLIT_MIN_PCT))
    const onMove = (ev) => {
      const newW = Math.max(minW, Math.min(maxW, startW + (startX - ev.clientX)))
      setTaskColW(newW)
      taskColWRef.current = newW
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Ensure final value is persisted
      localStorage.setItem(TASK_COL_W_KEY, String(taskColWRef.current))
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  if (pkmLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#b4b2a9', fontSize: 13 }}>로딩 중...</div>
  }

  const BACKLOG_MS = { id: '__backlog__', title: '백로그' }

  return (
    <div ref={containerRef}>
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 30, padding: '0 12px',
        background: '#fafaf8', borderBottom: '0.5px solid #e8e6df',
        fontSize: 10.5, color: '#888780', fontWeight: 600, letterSpacing: '.03em',
        position: 'sticky', top: 0, zIndex: 2,
      }}>
        <button
          onClick={toggleExpandAll}
          style={{
            border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 10, color: '#a09f99', padding: '2px 6px', borderRadius: 3,
            marginRight: 4, display: 'flex', alignItems: 'center', gap: 3,
          }}
          title={allExpanded ? '전체 접기' : '전체 펼치기'}
        >
          <span style={{ fontSize: 8, transform: allExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', display: 'inline-block' }}>▾</span>
          {allExpanded ? '접기' : '펼치기'}
        </button>
        <div style={{ flex: 1, paddingLeft: 22 }}>마일스톤</div>
        {/* Resize handle in header */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            width: 5, alignSelf: 'stretch', cursor: 'col-resize',
            background: 'transparent', flexShrink: 0, position: 'relative', zIndex: 3,
          }}
        />
        <div style={{ width: taskColW, flexShrink: 0, paddingLeft: 12 }}>연결된 할일</div>
      </div>

      {/* Milestone rows */}
      <SortableContext items={milestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
        {milestones.map(ms => (
          <CompactMilestoneRow
            key={ms.id}
            milestone={ms}
            tasks={getTasksForMilestone(ms.id)}
            expanded={expandedMs.has(ms.id)}
            onToggleExpand={toggleExpand}
            onTaskToggle={toggleDone}
            onAddTask={handleAddTask}
            onTaskClick={openDetail}
            isBacklog={false}
            deliverables={getByMilestone ? getByMilestone(ms.id) : []}
            taskColW={taskColW}
            onResizeStart={handleResizeStart}
            onUpdateMilestone={handleUpdateMilestone}
            onOpenMilestoneDetail={(milestoneId) => openModal({ type: 'milestoneDetail', milestoneId, returnTo: null })}
          />
        ))}
      </SortableContext>

      {/* Add milestone button */}
      <div
        onClick={handleAddMilestone}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px 7px 46px', color: '#a09f99', fontSize: 12,
          cursor: 'pointer', borderBottom: '0.5px solid #f0efe8',
          transition: 'background .1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#fdfcfa'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        + 마일스톤 추가
      </div>

      {/* Backlog */}
      <div style={{ borderTop: '1.5px dashed #e8e6df' }}>
        <CompactMilestoneRow
          milestone={BACKLOG_MS}
          tasks={backlogTasks}
          expanded={expandedMs.has('__backlog__')}
          onToggleExpand={toggleExpand}
          onTaskToggle={toggleDone}
          onAddTask={handleAddTask}
          onTaskClick={openDetail}
          isBacklog={true}
          deliverables={[]}
          taskColW={taskColW}
          onResizeStart={handleResizeStart}
          onUpdateMilestone={handleUpdateMilestone}
        />
      </div>

      {/* Footer sections */}
      <FooterSection icon="📎" label="참조 문서" count={links.length}>
        {links.map(l => (
          <div key={l.id} style={{ fontSize: 12, color: '#6b6a66', padding: '3px 0' }}>
            {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2c5282', textDecoration: 'none' }}>{l.title || l.url}</a> : (l.title || '—')}
          </div>
        ))}
      </FooterSection>
      <FooterSection icon="✓" label="합의된 정책" count={policies.length}>
        {policies.map(p => (
          <div key={p.id} style={{ fontSize: 12, color: '#6b6a66', padding: '3px 0' }}>
            {p.title || '—'}
            {p.description && <div style={{ fontSize: 11, color: '#a09f99' }}>{p.description}</div>}
          </div>
        ))}
      </FooterSection>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskChipOverlay task={activeTask} /> : null}
        {activeMilestone ? <MilestoneOverlay milestone={activeMilestone} /> : null}
      </DragOverlay>
    </DndContext>
    </div>
  )
}

function TaskChipOverlay({ task }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
      background: '#e8f5e9', borderRadius: 5, fontSize: 12,
      border: '1px dashed #1D9E75', boxShadow: '0 2px 8px rgba(0,0,0,.12)',
      cursor: 'grabbing', userSelect: 'none', whiteSpace: 'nowrap',
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        border: task.done ? 'none' : '1.5px solid #1D9E75',
        background: task.done ? '#1D9E75' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 8,
      }}>
        {task.done && '✓'}
      </div>
      <span style={{ color: '#2C2C2A' }}>{task.text}</span>
    </div>
  )
}

function MilestoneOverlay({ milestone }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      background: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500,
      border: '1px solid #e0ddd6', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
      cursor: 'grabbing', userSelect: 'none', whiteSpace: 'nowrap',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: milestone.color || '#1D9E75', flexShrink: 0,
      }} />
      <span style={{ color: '#2C2C2A' }}>{milestone.title || '(제목 없음)'}</span>
    </div>
  )
}

function FooterSection({ icon, label, count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '0.5px solid #f0efe8' }}>
      <div onClick={() => setOpen(!open)} style={{ fontSize: 11, color: '#a09f99', cursor: 'pointer', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label} <span style={{ fontSize: 9.5, background: '#eeeee6', borderRadius: 999, padding: '0 5px' }}>{count}</span>
      </div>
      {open && <div style={{ padding: '0 16px 8px' }}>{children}</div>}
    </div>
  )
}
