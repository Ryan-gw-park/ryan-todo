import { useState, useCallback, useMemo } from 'react'
import { DndContext, useDroppable, useSensor, useSensors, PointerSensor, TouchSensor, pointerWithin } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { useKeyMilestones } from '../../hooks/useKeyMilestones'
import { useKeyDeliverables } from '../../hooks/useKeyDeliverables'
import { useKeyLinks } from '../../hooks/useKeyLinks'
import { useKeyPolicies } from '../../hooks/useKeyPolicies'
import CompactMilestoneRow from './CompactMilestoneRow'

export default function CompactMilestoneTab({ projectId }) {
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)
  const { milestones, add: addMilestone, reorder: reorderMilestones } = useKeyMilestones(pkm?.id, projectId)
  const { deliverables, getByMilestone } = useKeyDeliverables(pkm?.id, projectId)
  const { items: links } = useKeyLinks(pkm?.id, projectId)
  const { items: policies } = useKeyPolicies(pkm?.id, projectId)

  const tasks = useStore(s => s.tasks)
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)

  const [expandedMs, setExpandedMs] = useState(new Set())

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

  // DnD handler
  const handleDragEnd = useCallback((event) => {
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
  }, [milestones, reorderMilestones, updateTask])

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

  if (pkmLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#b4b2a9', fontSize: 13 }}>로딩 중...</div>
  }

  const BACKLOG_MS = { id: '__backlog__', title: '백로그' }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 30, padding: '0 12px',
        background: '#fafaf8', borderBottom: '0.5px solid #e8e6df',
        fontSize: 10.5, color: '#b4b2a9', fontWeight: 600, letterSpacing: '.03em',
        position: 'sticky', top: 0, zIndex: 2,
      }}>
        <button
          onClick={toggleExpandAll}
          style={{
            border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 10, color: '#c4c2ba', padding: '2px 6px', borderRadius: 3,
            marginRight: 4, display: 'flex', alignItems: 'center', gap: 3,
          }}
          title={allExpanded ? '전체 접기' : '전체 펼치기'}
        >
          <span style={{ fontSize: 8, transform: allExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', display: 'inline-block' }}>▾</span>
          {allExpanded ? '접기' : '펼치기'}
        </button>
        <div style={{ flex: 1, paddingLeft: 22 }}>마일스톤</div>
        <div style={{ width: 400, flexShrink: 0, paddingLeft: 12 }}>연결된 할일</div>
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
          />
        ))}
      </SortableContext>

      {/* Add milestone button */}
      <div
        onClick={handleAddMilestone}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px 7px 46px', color: '#c4c2ba', fontSize: 12,
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
    </DndContext>
  )
}

function FooterSection({ icon, label, count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '0.5px solid #f0efe8' }}>
      <div onClick={() => setOpen(!open)} style={{ fontSize: 11, color: '#c4c2ba', cursor: 'pointer', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label} <span style={{ fontSize: 9.5, background: '#eeeee6', borderRadius: 999, padding: '0 5px' }}>{count}</span>
      </div>
      {open && <div style={{ padding: '0 16px 8px' }}>{children}</div>}
    </div>
  )
}
