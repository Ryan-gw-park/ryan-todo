import { useCallback, useMemo } from 'react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, rectIntersection, useDroppable,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import { COLOR } from '../../../styles/designTokens'
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

  // Loop-45: focus-panel:root droppable을 Shell 우측 wrapper 전체로 확장.
  // FocusPanel 내부 droppable 대신 여기에 두어 우측 column 전체가 drop target.
  const { setNodeRef: focusDropRef, isOver: focusIsOver } = useDroppable({
    id: 'focus-panel:root',
  })

  const handleDragEnd = useCallback((e) => {
    const { active, over } = e
    const activeIdStr = String(active?.id || '')

    // Loop-45 revised: F-24 철회 — 포커스 해제는 FocusCard × 버튼만 가능.
    // drag-out으로 해제 안 함 (no-op).
    if (!over) return

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

    // focus-card → focus-panel:root 또는 외부: no-op (× 버튼으로만 해제)
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
        // alignItems 기본값(stretch)으로 우측 column이 container 높이만큼 stretch
        // → focus-panel:root droppable이 우측 전체 영역 커버
      }}>
        {/* Left: 백로그 3섹션 (flex 3) */}
        <div style={{ flex: 3, minWidth: 0 }}>
          <PersonalTodoListTable
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>

        {/* Right: 포커스 드롭존 + 패널 (flex 2, 영역 전체가 drop target) */}
        <div
          ref={focusDropRef}
          style={{
            flex: 2,
            minWidth: 280,
            background: focusIsOver ? COLOR.bgHover : 'transparent',
            transition: 'background 0.15s',
            borderRadius: 6,
          }}
        >
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
