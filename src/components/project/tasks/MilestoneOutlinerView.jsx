import { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../hooks/useStore'
import { useProjectKeyMilestone } from '../../../hooks/useProjectKeyMilestone'
import { useKeyMilestones } from '../../../hooks/useKeyMilestones'
import { getColor } from '../../../utils/colors'
import useTeamMembers from '../../../hooks/useTeamMembers'
import OutlinerTaskNode from './OutlinerTaskNode'
import { getDb } from '../../../utils/supabase'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

function formatShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}`
}

export default function MilestoneOutlinerView({ projectId }) {
  const { pkm, loading } = useProjectKeyMilestone(projectId)
  const { milestones } = useKeyMilestones(pkm?.id, projectId)
  const { projects, tasks: allTasks, collapseState, setCollapseValue, currentTeamId, reorderTasks } = useStore()

  const project = projects.find(p => p.id === projectId)
  const color = project ? getColor(project.color) : getColor()

  // Team member names
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName })
      setMemberMap(map)
    })
  }, [currentTeamId])

  // Deliverable names for displaying next to tasks
  const [deliverableMap, setDeliverableMap] = useState({})
  useEffect(() => {
    if (!projectId) return
    const db = getDb()
    if (!db) return
    db.from('key_deliverables')
      .select('id, title')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[MilestoneOutlinerView] deliverables load failed:', error.message)
          return
        }
        const map = {}
        ;(data || []).forEach(d => { map[d.id] = d.title })
        setDeliverableMap(map)
      })
  }, [projectId])

  const tasks = useMemo(() =>
    allTasks.filter(t => t.projectId === projectId && !t.deletedAt),
    [allTasks, projectId]
  )

  const expanded = collapseState.projectExpanded || {}
  const toggleExpand = (id) => setCollapseValue('projectExpanded', id, !(expanded[id] !== false))

  // Refs for cross-section navigation
  const sectionRefs = useRef({})

  // milestoneTaskGroups sorted by milestone sort_order
  const milestoneTaskGroups = useMemo(() => {
    return milestones.map(ms => ({
      milestone: ms,
      tasks: tasks
        .filter(t => t.keyMilestoneId === ms.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    }))
  }, [milestones, tasks])

  // Unlinked tasks (keyMilestoneId is null)
  const unlinkedTasks = useMemo(() =>
    tasks
      .filter(t => !t.keyMilestoneId && t.category !== 'done')
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [tasks]
  )

  // Cross-section navigation
  const allSectionKeys = useMemo(() => {
    const keys = milestoneTaskGroups.map(g => g.milestone.id)
    if (unlinkedTasks.length > 0 || milestones.length === 0) keys.push('unlinked')
    return keys
  }, [milestoneTaskGroups, milestones.length, unlinkedTasks.length])

  const handleExitSectionDown = useCallback((sectionKey) => {
    const idx = allSectionKeys.indexOf(sectionKey)
    for (let i = idx + 1; i < allSectionKeys.length; i++) {
      const ref = sectionRefs.current[allSectionKeys[i]]
      if (ref?.focusFirst?.()) return true
    }
    return false
  }, [allSectionKeys])

  const handleExitSectionUp = useCallback((sectionKey) => {
    const idx = allSectionKeys.indexOf(sectionKey)
    for (let i = idx - 1; i >= 0; i--) {
      const ref = sectionRefs.current[allSectionKeys[i]]
      if (ref?.focusLast?.()) return true
    }
    return false
  }, [allSectionKeys])

  if (loading) {
    return <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>Loading...</div>
  }

  if (loading) {
    // already handled above
  }

  // 마일스톤 0개 + Task 0개 → 안내 메시지
  if ((!pkm || milestones.length === 0) && tasks.length === 0) {
    return (
      <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>
        Key Milestone 탭에서 마일스톤을 추가하거나, 아래에서 할일을 생성하세요
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px', overflow: 'auto' }}>
      {milestoneTaskGroups.map(({ milestone, tasks: msTasks }) => (
        <MilestoneSection
          key={milestone.id}
          ref={el => sectionRefs.current[milestone.id] = el}
          milestone={milestone}
          tasks={msTasks}
          projectId={projectId}
          color={color}
          expanded={expanded}
          toggleExpand={toggleExpand}
          memberMap={memberMap}
          deliverableMap={deliverableMap}
          reorderTasks={reorderTasks}
          onExitSectionDown={() => handleExitSectionDown(milestone.id)}
          onExitSectionUp={() => handleExitSectionUp(milestone.id)}
        />
      ))}

      {(unlinkedTasks.length > 0 || milestones.length === 0) && (
        <UnlinkedSection
          ref={el => sectionRefs.current['unlinked'] = el}
          tasks={unlinkedTasks}
          projectId={projectId}
          color={color}
          expanded={expanded}
          toggleExpand={toggleExpand}
          memberMap={memberMap}
          deliverableMap={deliverableMap}
          reorderTasks={reorderTasks}
          showHeader={milestones.length > 0}
          onExitSectionDown={() => handleExitSectionDown('unlinked')}
          onExitSectionUp={() => handleExitSectionUp('unlinked')}
        />
      )}
    </div>
  )
}

const MilestoneSection = forwardRef(function MilestoneSection({
  milestone, tasks, projectId, color, expanded, toggleExpand, memberMap, deliverableMap, reorderTasks,
  onExitSectionDown, onExitSectionUp,
}, ref) {
  const [collapsed, setCollapsed] = useState(false)
  const { addTask, openDetail } = useStore()
  const taskRefs = useRef({})

  const daysLeft = daysUntil(milestone.end_date)
  const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0

  useImperativeHandle(ref, () => ({
    focusFirst: () => {
      if (collapsed || tasks.length === 0) return false
      const first = tasks[0]
      const taskRef = taskRefs.current[first.id]
      if (taskRef?.focusTitle) {
        taskRef.focusTitle('start')
        return true
      }
      return false
    },
    focusLast: () => {
      if (collapsed || tasks.length === 0) return false
      const last = tasks[tasks.length - 1]
      const taskRef = taskRefs.current[last.id]
      if (taskRef?.focusLast) {
        taskRef.focusLast()
        return true
      }
      return false
    },
  }))

  const handleAddTask = () => {
    const taskId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    addTask({
      id: taskId,
      text: '',
      projectId,
      keyMilestoneId: milestone.id,
      category: 'today',
      sortOrder: Date.now(),
    })
    setTimeout(() => {
      const created = useStore.getState().tasks.find(t => t.id === taskId)
      if (created) openDetail(created)
    }, 50)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)
    reorderTasks(reordered.map((t, i) => ({ ...t, sortOrder: i })))
  }

  // Navigation within section
  const handleExitTaskDown = (taskIndex) => {
    if (taskIndex < tasks.length - 1) {
      const nextTask = tasks[taskIndex + 1]
      const nextRef = taskRefs.current[nextTask.id]
      if (nextRef?.focusTitle) {
        nextRef.focusTitle('start')
        return true
      }
    }
    return onExitSectionDown?.()
  }

  const handleExitTaskUp = (taskIndex) => {
    if (taskIndex > 0) {
      const prevTask = tasks[taskIndex - 1]
      const prevRef = taskRefs.current[prevTask.id]
      if (prevRef?.focusLast) {
        prevRef.focusLast()
        return true
      }
    }
    return onExitSectionUp?.()
  }

  return (
    <div style={{ borderBottom: '0.5px solid #eeedea' }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 20px 8px', cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: milestone.color || '#1D9E75', flexShrink: 0,
        }} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
          {milestone.title}
        </span>
        {milestone.start_date && (
          <span style={{ fontSize: 11, color: '#a09f99' }}>
            {formatShort(milestone.start_date)} → {formatShort(milestone.end_date)}
          </span>
        )}
        {daysLeft !== null && (
          <span style={{
            fontSize: 10, fontWeight: 500,
            color: isUrgent ? '#BA7517' : '#b4b2a9',
          }}>
            D{daysLeft >= 0 ? `-${daysLeft}` : `+${Math.abs(daysLeft)}`}
          </span>
        )}
        <span style={{ fontSize: 12, color: '#b4b2a9', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>
          ▾
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '0 20px 12px 38px' }}>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task, idx) => (
                <SortableOutlinerTask
                  key={task.id}
                  task={task}
                  ref={el => taskRefs.current[task.id] = el}
                  color={color}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                  memberMap={memberMap}
                  deliverableMap={deliverableMap}
                  onExitUp={() => handleExitTaskUp(idx)}
                  onExitDown={() => handleExitTaskDown(idx)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div
            onClick={handleAddTask}
            style={{ padding: '6px 0', fontSize: 12, color: '#b4b2a9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            + 할일 추가
          </div>
        </div>
      )}
    </div>
  )
})

const UnlinkedSection = forwardRef(function UnlinkedSection({
  tasks, projectId, color, expanded, toggleExpand, memberMap, deliverableMap, reorderTasks,
  showHeader = true, onExitSectionDown, onExitSectionUp,
}, ref) {
  const [collapsed, setCollapsed] = useState(false)
  const { addTask, openDetail } = useStore()
  const taskRefs = useRef({})

  useImperativeHandle(ref, () => ({
    focusFirst: () => {
      if (collapsed || tasks.length === 0) return false
      const first = tasks[0]
      const taskRef = taskRefs.current[first.id]
      if (taskRef?.focusTitle) {
        taskRef.focusTitle('start')
        return true
      }
      return false
    },
    focusLast: () => {
      if (collapsed || tasks.length === 0) return false
      const last = tasks[tasks.length - 1]
      const taskRef = taskRefs.current[last.id]
      if (taskRef?.focusLast) {
        taskRef.focusLast()
        return true
      }
      return false
    },
  }))

  const handleAddTask = () => {
    const taskId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    addTask({
      id: taskId,
      text: '',
      projectId,
      keyMilestoneId: null,
      category: 'today',
      sortOrder: Date.now(),
    })
    setTimeout(() => {
      const created = useStore.getState().tasks.find(t => t.id === taskId)
      if (created) openDetail(created)
    }, 50)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)
    reorderTasks(reordered.map((t, i) => ({ ...t, sortOrder: i })))
  }

  const handleExitTaskDown = (taskIndex) => {
    if (taskIndex < tasks.length - 1) {
      const nextTask = tasks[taskIndex + 1]
      const nextRef = taskRefs.current[nextTask.id]
      if (nextRef?.focusTitle) {
        nextRef.focusTitle('start')
        return true
      }
    }
    return onExitSectionDown?.()
  }

  const handleExitTaskUp = (taskIndex) => {
    if (taskIndex > 0) {
      const prevTask = tasks[taskIndex - 1]
      const prevRef = taskRefs.current[prevTask.id]
      if (prevRef?.focusLast) {
        prevRef.focusLast()
        return true
      }
    }
    return onExitSectionUp?.()
  }

  return (
    <div style={{ borderBottom: '0.5px solid #eeedea' }}>
      {showHeader && (
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 20px 8px', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 13 }}>--</span>
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>기타 할일</span>
          <span style={{ fontSize: 11, color: '#b4b2a9' }}>{tasks.length}건</span>
          <span style={{ fontSize: 12, color: '#b4b2a9', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>▾</span>
        </div>
      )}

      {(!showHeader || !collapsed) && (
        <div style={{ padding: showHeader ? '0 20px 12px 38px' : '0 20px 12px' }}>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task, idx) => (
                <SortableOutlinerTask
                  key={task.id}
                  task={task}
                  ref={el => taskRefs.current[task.id] = el}
                  color={color}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                  memberMap={memberMap}
                  deliverableMap={deliverableMap}
                  onExitUp={() => handleExitTaskUp(idx)}
                  onExitDown={() => handleExitTaskDown(idx)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div
            onClick={handleAddTask}
            style={{ padding: '6px 0', fontSize: 12, color: '#b4b2a9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            + 할일 추가
          </div>
        </div>
      )}
    </div>
  )
})

const SortableOutlinerTask = forwardRef(function SortableOutlinerTask(
  { task, color, expanded, toggleExpand, memberMap, deliverableMap, onExitUp, onExitDown },
  ref
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const nodeRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focusTitle: (pos) => nodeRef.current?.focusTitle?.(pos),
    focusLast: () => nodeRef.current?.focusLast?.(),
  }))

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const deliverableTitle = task.deliverableId && deliverableMap
    ? deliverableMap[task.deliverableId]
    : null

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'flex-start' }}>
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: '#c2c0b6', fontSize: 10, flexShrink: 0, padding: '6px 4px 0 0' }}
      >
        ⠿
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <OutlinerTaskNode
              ref={nodeRef}
              task={task}
              color={color}
              expanded={expanded}
              toggleExpand={toggleExpand}
              memberMap={memberMap}
              onExitUp={onExitUp}
              onExitDown={onExitDown}
            />
          </div>
          {deliverableTitle && (
            <span style={{
              fontSize: 10, color: '#a09f99', marginLeft: 4,
              background: '#f6f5f0', padding: '1px 6px', borderRadius: 4,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {deliverableTitle}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
