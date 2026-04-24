import { useCallback, useMemo } from 'react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, rectIntersection,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import PersonalTodoListTable from './PersonalTodoListTable'
import FocusPanel from './FocusPanel'

/* ═══════════════════════════════════════════════
   PersonalTodoShell (Loop-45)
   2컬럼 오케스트레이터 — 좌측 백로그 (flex 3) + 우측 포커스 패널 (flex 2)

   자체 DndContext (nested inside UnifiedGridView의 outer context).
   @dnd-kit은 useSortable/useDroppable이 nearest DndContext로 register되므로,
   Shell 내부 드래그(bl-task:*, focus-card:*)는 outer와 완전 격리.

   DnD 시나리오 (spec §8.3):
     1) 백로그 task → 포커스 패널 (focus-panel:root 또는 focus-card:*) (F-23)
        → updateTask(id, { isFocus: true, focusSortOrder: max+1 })
     2) 포커스 카드 간 reorder (F-25)
        → reorderFocusTasks(reordered)
     3) 포커스 카드 → 패널 밖 drop (F-24)
        → updateTask(id, { isFocus: false }) — category 보존 (N-09)
   ═══════════════════════════════════════════════ */
export default function PersonalTodoShell({ projects, tasks, milestones }) {
  const currentUserId = getCachedUserId()
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)

  // Focus tasks — Shell 레벨에서도 계산 (DnD handler에서 max order / idx 조회용)
  const focusTasks = useMemo(() => {
    const mine = tasks.filter(t =>
      t.assigneeId === currentUserId &&
      t.isFocus === true &&
      !t.done &&
      !t.deletedAt
    )
    return mine.sort((a, b) => {
      const oa = a.focusSortOrder ?? 0
      const ob = b.focusSortOrder ?? 0
      if (oa !== ob) return oa - ob
      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
  }, [tasks, currentUserId])

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const handleDragEnd = useCallback((e) => {
    const { active, over } = e
    const activeIdStr = String(active?.id || '')

    // over 없음: focus-card → 완전히 바깥으로 드롭된 경우 해제
    if (!over) {
      if (activeIdStr.startsWith('focus-card:')) {
        const taskId = activeIdStr.slice('focus-card:'.length)
        updateTask(taskId, { isFocus: false })
      }
      return
    }

    const overId = String(over.id)

    // ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
    if (activeIdStr.startsWith('bl-task:')) {
      if (overId === 'focus-panel:root' || overId.startsWith('focus-card:')) {
        const taskId = activeIdStr.slice('bl-task:'.length)
        const maxOrder = focusTasks.reduce(
          (m, t) => Math.max(m, t.focusSortOrder ?? 0),
          0,
        )
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        return
      }
      return
    }

    // ═══ 2) 포커스 내부 reorder (F-25) ═══
    if (activeIdStr.startsWith('focus-card:') && overId.startsWith('focus-card:')) {
      const activeTaskId = activeIdStr.slice('focus-card:'.length)
      const overTaskId = overId.slice('focus-card:'.length)
      if (activeTaskId === overTaskId) return
      const oldIdx = focusTasks.findIndex(t => t.id === activeTaskId)
      const newIdx = focusTasks.findIndex(t => t.id === overTaskId)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(focusTasks, oldIdx, newIdx)
      reorderFocusTasks(reordered)
      return
    }

    // ═══ 3) 포커스 카드 → 포커스 영역 밖 (F-24) ═══
    if (activeIdStr.startsWith('focus-card:')) {
      if (!overId.startsWith('focus-')) {
        const taskId = activeIdStr.slice('focus-card:'.length)
        updateTask(taskId, { isFocus: false })
        return
      }
    }
  }, [focusTasks, updateTask, reorderFocusTasks])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: 'flex',
        gap: 24,
        width: '100%',
        alignItems: 'flex-start',
      }}>
        {/* Left: 백로그 3섹션 (flex 3) */}
        <div style={{ flex: 3, minWidth: 0 }}>
          <PersonalTodoListTable
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>

        {/* Right: 포커스 패널 (flex 2, sticky) */}
        <div style={{ flex: 2, minWidth: 280 }}>
          <FocusPanel
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>
      </div>
    </DndContext>
  )
}
