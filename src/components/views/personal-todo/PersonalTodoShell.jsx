import { useCallback } from 'react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import PersonalAgendaMatrixTable from '../grid/PersonalAgendaMatrixTable'
import { dispatch as dispatchDrop, registerHandler } from '../../../utils/dnd/dispatcher'
import {
  handleAgendaMatrixTaskDrop,
  handleAgendaMatrixRowDrop,
} from '../grid/dnd/personalAgendaHandlers'

// Hotfix r5: inner DndContext용 dispatcher 등록 (import 시점 1회).
// 매트릭스 cell/row drop은 PersonalTodoShell의 inner DndContext로 흘러옴.
//   - 'agenda-matrix-task'       : cell ↔ cell drag
//   - 'agenda-matrix-row'        : task → row 헤더 drop
//   - 'agenda-matrix-row-reorder': row 헤더 → row 헤더 drop (project 순서 변경)
registerHandler('agenda-matrix-task', handleAgendaMatrixTaskDrop)
registerHandler('agenda-matrix-row', handleAgendaMatrixRowDrop)
registerHandler('agenda-matrix-row-reorder', handleAgendaMatrixRowDrop)

/* ═══════════════════════════════════════════════
   PersonalTodoShell (Hotfix r5 — Focus 섹션 제거)
   매트릭스 full width 단일 컬럼.
   Inner DndContext만 유지하여 매트릭스 cell/row drag 처리.
   ═══════════════════════════════════════════════ */
export default function PersonalTodoShell({ projects, tasks, milestones }) {
  const currentUserId = getCachedUserId()
  const updateTask = useStore(s => s.updateTask)
  const reorderTasks = useStore(s => s.reorderTasks)
  const reorderProjects = useStore(s => s.reorderProjects)

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const handleDragEnd = useCallback((e) => {
    const { over } = e
    if (!over) return
    const dispatchCtx = {
      tasks, projects, milestones, currentUserId,
      updateTask, reorderTasks, reorderProjects,
    }
    dispatchDrop(e, dispatchCtx)
  }, [tasks, projects, milestones, currentUserId, updateTask, reorderTasks, reorderProjects])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div style={{ width: '100%', minWidth: 0 }}>
        <PersonalAgendaMatrixTable
          projects={projects}
          tasks={tasks}
          milestones={milestones}
        />
      </div>
    </DndContext>
  )
}
