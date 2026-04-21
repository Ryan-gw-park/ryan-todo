import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor, useSensor, useSensors,
  pointerWithin,
} from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import useWeeklySchedule from '../../hooks/useWeeklySchedule'
import BacklogPanel from './weekly-schedule/BacklogPanel'
import ScheduleGrid from './weekly-schedule/ScheduleGrid'
import DragPreview from './weekly-schedule/DragPreview'
import { COLOR } from '../../styles/designTokens'
import { getColor } from '../../utils/colors'

/**
 * Weekly Schedule View — 팀 위클리 미팅용 백로그+그리드 DnD 뷰.
 * DndContext + DragOverlay 소유. onDragStart/onDragEnd 핸들링.
 *
 * ID 컨벤션 (W7):
 * - 드래그 가능: `task:${taskId}` / `ms:${msId}`
 * - 드롭 타겟: `cell:${userId}:${dateISO}` (userId=profiles.user_id=tasks.assignee_id)
 *             또는 `backlog`
 */
export default function WeeklyScheduleView() {
  const {
    members, weekDays, weekLabel,
    scheduledTasks, scheduledMilestones, backlogTasks, backlogMilestones,
    teamProjectIds,
    goToPrevWeek, goToNextWeek, goToThisWeek,
  } = useWeeklySchedule()

  const tasks = useStore(s => s.tasks)
  const milestones = useStore(s => s.milestones)
  const projects = useStore(s => s.projects)
  const currentTeamId = useStore(s => s.currentTeamId)
  const updateTask = useStore(s => s.updateTask)
  const updateTasksBulk = useStore(s => s.updateTasksBulk)
  const updateMilestone = useStore(s => s.updateMilestone)
  const addTask = useStore(s => s.addTask)

  const [activeDrag, setActiveDrag] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragStart = useCallback((event) => {
    const { active } = event
    const activeIdStr = typeof active.id === 'string' ? active.id : ''
    const [kind, id] = activeIdStr.split(':', 2) // edge 2 방어
    if (kind === 'task') {
      const task = tasks.find(t => t.id === id)
      if (!task) return
      const project = projects.find(p => p.id === task.projectId)
      const projectColor = project ? getColor(project.color).dot : null
      setActiveDrag({
        kind: 'task',
        id,
        title: task.text,
        projectColor,
        assigneeId: task.assigneeId || null,
      })
      return
    }
    if (kind === 'ms') {
      const ms = milestones.find(m => m.id === id)
      if (!ms) return
      setActiveDrag({
        kind: 'ms',
        id,
        title: ms.title,
        projectColor: null,
        assigneeId: null,
      })
    }
  }, [tasks, milestones, projects])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    setActiveDrag(null)
    if (!over) return
    const activeIdStr = typeof active.id === 'string' ? active.id : ''
    const [kind, id] = activeIdStr.split(':', 2)

    // ─── 분기 1: 셀 → 백로그 (미배정 되돌리기) ───
    if (over.id === 'backlog') {
      if (kind === 'task') {
        updateTask(id, { scheduledDate: null }).catch(e => console.error('[weekly] unschedule task:', e))
      }
      if (kind === 'ms') {
        updateMilestone(id, { scheduled_date: null }).catch(e => console.error('[weekly] unschedule ms:', e))
        // EC3: teamProjectIds 필터로 타팀 task 배제
        const childIds = tasks
          .filter(t => t.keyMilestoneId === id && teamProjectIds.has(t.projectId))
          .map(t => t.id)
        if (childIds.length > 0) {
          updateTasksBulk(childIds, { scheduledDate: null }).catch(e => console.error('[weekly] cascade null:', e))
        }
      }
      return
    }

    // ─── 분기 2: 셀 → 셀 ───
    const overIdStr = typeof over.id === 'string' ? over.id : ''
    if (!overIdStr.startsWith('cell:')) return
    const [, userId, dateISO] = overIdStr.split(':', 3) // W7: userId = profiles.user_id

    if (kind === 'task') {
      const task = tasks.find(t => t.id === id)
      if (!task) return
      // No-op 가드
      if (task.scheduledDate === dateISO && task.assigneeId === userId) return
      updateTask(id, { scheduledDate: dateISO, assigneeId: userId })
        .catch(e => console.error('[weekly] schedule task:', e))
      return
    }
    if (kind === 'ms') {
      const ms = milestones.find(m => m.id === id)
      if (!ms) return
      if (ms.scheduled_date === dateISO) return
      updateMilestone(id, { scheduled_date: dateISO }).catch(e => console.error('[weekly] schedule ms:', e))
      // EC3: teamProjectIds 필터
      const children = tasks.filter(t => t.keyMilestoneId === id && teamProjectIds.has(t.projectId))
      if (children.length > 0) {
        const needDefault = children.filter(t => !t.assigneeId).map(t => t.id)
        const keepAssignee = children.filter(t => t.assigneeId).map(t => t.id)
        if (needDefault.length > 0) {
          updateTasksBulk(needDefault, { scheduledDate: dateISO, assigneeId: userId })
            .catch(e => console.error('[weekly] cascade needDefault:', e))
        }
        if (keepAssignee.length > 0) {
          updateTasksBulk(keepAssignee, { scheduledDate: dateISO })
            .catch(e => console.error('[weekly] cascade keepAssignee:', e))
        }
      }
    }
  }, [tasks, milestones, teamProjectIds, updateTask, updateTasksBulk, updateMilestone])

  const handleDragCancel = useCallback(() => setActiveDrag(null), [])

  // × 버튼 핸들러
  const handleUnscheduleTask = useCallback((taskId) => {
    updateTask(taskId, { scheduledDate: null }).catch(e => console.error('[weekly] × task:', e))
  }, [updateTask])

  const handleUnscheduleMS = useCallback((msId) => {
    updateMilestone(msId, { scheduled_date: null }).catch(e => console.error('[weekly] × ms:', e))
    const childIds = tasks
      .filter(t => t.keyMilestoneId === msId && teamProjectIds.has(t.projectId))
      .map(t => t.id)
    if (childIds.length > 0) {
      updateTasksBulk(childIds, { scheduledDate: null }).catch(e => console.error('[weekly] × cascade:', e))
    }
  }, [tasks, teamProjectIds, updateMilestone, updateTasksBulk])

  if (!currentTeamId) {
    return (
      <div style={{ padding: 32, color: COLOR.textSecondary }}>
        팀을 선택하세요.
      </div>
    )
  }

  return (
    <div data-view="team-weekly-schedule" style={{
      display: 'flex',
      height: '100%',
      background: COLOR.bgSurface,
    }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <BacklogPanel
          backlogTasks={backlogTasks}
          backlogMilestones={backlogMilestones}
          tasks={tasks}
          milestones={milestones}
          projects={projects}
          members={members}
          teamProjectIds={teamProjectIds}
        />
        <ScheduleGrid
          members={members}
          weekDays={weekDays}
          weekLabel={weekLabel}
          scheduledTasks={scheduledTasks}
          scheduledMilestones={scheduledMilestones}
          tasks={tasks}
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          currentTeamId={currentTeamId}
          addTask={addTask}
          activeDrag={activeDrag}
          onUnscheduleTask={handleUnscheduleTask}
          onUnscheduleMS={handleUnscheduleMS}
          goToPrevWeek={goToPrevWeek}
          goToNextWeek={goToNextWeek}
          goToThisWeek={goToThisWeek}
        />
        <DragOverlay dropAnimation={null} style={{ zIndex: 9999 }}>
          {activeDrag ? <DragPreview item={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
