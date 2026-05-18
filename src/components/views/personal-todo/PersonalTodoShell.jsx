import { useCallback, useMemo } from 'react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter, useDroppable,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { COLOR } from '../../../styles/designTokens'
import PersonalAgendaMatrixTable from '../grid/PersonalAgendaMatrixTable'
import FocusPanel from './FocusPanel'
import { canMoveTaskToProject } from '../../../utils/dnd/guards'
import { dispatch as dispatchDrop, registerHandler } from '../../../utils/dnd/dispatcher'
import {
  handleAgendaMatrixTaskDrop,
  handleAgendaMatrixRowDrop,
} from '../grid/dnd/personalAgendaHandlers'

// Spec r2 R-DND-1: inner DndContext용 dispatcher 등록 (import 시점 1회).
// useDroppable/useSortable은 nearest React Context에 등록되므로 PersonalTodoShell
// 모듈 최상단에서 등록해야 inner DndContext의 onDragEnd → dispatchDrop이 매칭함.
//
// Hotfix r3 — row reorder 신규 type 추가:
//   - 'agenda-matrix-task'       : cell ↔ cell drag (task)
//   - 'agenda-matrix-row'        : task → row 헤더 drop (projectId 재할당)
//   - 'agenda-matrix-row-reorder': row 헤더 → row 헤더 drop (project 순서 변경)
//   Row 헤더 useSortable의 data.type은 'agenda-matrix-row-reorder' 하나만 노출되지만
//   handler가 active.id 패턴으로 task/row를 분기 처리. dispatcher 측에서 두 type 모두
//   같은 handler에 매핑.
registerHandler('agenda-matrix-task', handleAgendaMatrixTaskDrop)
registerHandler('agenda-matrix-row', handleAgendaMatrixRowDrop)
registerHandler('agenda-matrix-row-reorder', handleAgendaMatrixRowDrop)

/* ═══════════════════════════════════════════════
   PersonalTodoShell (Loop-45 → Loop-47)
   2컬럼 오케스트레이터 (grid) — 백로그 : 포커스 = 1.5fr : 1fr
   Loop-47: FocusNotePanel 제거, 노트 편집은 FocusCard 인라인 확장으로 이관.

   ⚠ 중요 — DndContext 컨텍스트 등록 순서 (Loop-46 QA fix):
   useDroppable/useSortable 은 호출 시점의 nearest React Context 로 등록됨.
   Shell 함수 본체에서 직접 useDroppable 을 부르면 OUTER(UnifiedGridView) 에
   등록되어 inner(Shell) DndContext 의 드래그에 보이지 않음.
   → FocusColumn child 컴포넌트로 분리해 inner DndContext 내부에서 훅 호출.

   ⚠ collisionDetection: closestCenter (codebase convention).
   rectIntersection 사용 시 source project의 bl-project:*(자기 자신)이 항상 우승하여
   branch 1.5 self-target gate에서 silent return 발생 — cross-project drop 회귀 원인.

   DnD 시나리오:
     1) 백로그 task → 포커스 패널 (focus-panel:root 또는 focus-card:*) (F-23)
        → updateTask(id, { isFocus: true, focusSortOrder: max+1 })
     2) 포커스 카드 간 reorder (F-25) → reorderFocusTasks(reordered)
     3) focus-card → 패널 밖 drop: no-op (× 버튼만 해제)
     * Loop-47: 단일 active 선택 개념 철회. auto-expand 는 Commit 5 에서 추가.
   ═══════════════════════════════════════════════ */

// Inner DndContext 내부에서 useDroppable 호출하기 위한 wrapper child
function FocusColumn({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'focus-panel:root' })
  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 0,
        minHeight: 400,                 // 빈 focus 상태에도 충분한 drop 영역 확보
        background: isOver ? COLOR.bgHover : 'transparent',
        transition: 'background 0.15s',
        borderRadius: 6,
      }}
    >
      {children}
    </div>
  )
}

export default function PersonalTodoShell({ projects, tasks, milestones }) {
  const currentUserId = getCachedUserId()
  const updateTask = useStore(s => s.updateTask)
  const reorderFocusTasks = useStore(s => s.reorderFocusTasks)
  const reorderTasks = useStore(s => s.reorderTasks)
  const reorderProjects = useStore(s => s.reorderProjects)
  const { setPivotCollapsed: setExpanded } = usePivotExpandState('focusCardExpanded')

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

    if (!over) return  // F-24 revised: 포커스 해제는 × 버튼만

    const overId = String(over.id)

    // ═══ Spec r2 B2 + Hotfix r3: agenda matrix dispatcher (inner context) ═══
    // 매트릭스 cell/row drop은 dispatcher 패턴으로 처리. 미매칭이면 fallthrough.
    // Hotfix r3: row reorder를 위해 reorderProjects 포함.
    const dispatchCtx = {
      tasks, projects, milestones, currentUserId,
      updateTask, reorderTasks, reorderProjects,
    }
    if (dispatchDrop(e, dispatchCtx)) return

    // ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
    if (activeIdStr.startsWith('bl-task:')) {
      if (overId === 'focus-panel:root' || overId.startsWith('focus-card:')) {
        const taskId = activeIdStr.slice('bl-task:'.length)
        const maxOrder = focusTasks.reduce(
          (m, t) => Math.max(m, t.focusSortOrder ?? 0),
          0,
        )
        updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
        // E-11: 드롭 직후 자동 펼침 (노트 바로 입력 가능)
        setExpanded(taskId, true)
        return
      }

      // ═══ 1.3) task-on-task drop ═══
      // P0-2 hotfix: sameContext (sortableContextId) 가드 → task data 기반 비교로 변경.
      //   - Loop-50의 SortableContext per project가 cross-container drag와 호환 안 됨 →
      //     PersonalTodoTaskRow를 useDraggable로 복귀, sortableContextId 제거.
      //   - 같은-project + 같은-category → reorder (Loop-50 의도 보존, sortableContextId 없이 task data로 판정)
      //   - 다른 project → cross-project move (Loop-49 동작 복구. 이전엔 silently return으로 누락)
      //
      // ⚠ hotfix-focus-and-dnd: closestCenter + useDraggable 전용 환경에서는 over.id가
      //   'bl-task:'로 시작하지 않으므로 본 분기 진입 불가 (defensive dead code 보존).
      //   향후 PersonalTodoTaskRow에 useSortable 복귀 시 자동으로 same-project reorder 부활.
      if (overId.startsWith('bl-task:') && overId !== activeIdStr) {
        const overTaskId = overId.slice('bl-task:'.length)
        const overTask = tasks.find(t => t.id === overTaskId)
        if (!overTask) return

        const sourceTask = active.data?.current?.task
        if (!sourceTask) return

        // 같은 project + 같은 category → same-section reorder
        if (sourceTask.projectId === overTask.projectId && sourceTask.category === overTask.category) {
          // ListTable 필터 chain과 동기화된 5조건:
          // assigneeId === currentUserId && !done && !deletedAt && projectId 일치 && category 일치
          const cellTasks = tasks
            .filter(t =>
              t.assigneeId === currentUserId &&
              !t.done &&
              !t.deletedAt &&
              t.projectId === sourceTask.projectId &&
              t.category === sourceTask.category)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

          const sourceTaskId = activeIdStr.slice('bl-task:'.length)
          const oldIdx = cellTasks.findIndex(t => t.id === sourceTaskId)
          const newIdx = cellTasks.findIndex(t => t.id === overTaskId)
          if (oldIdx === -1 || newIdx === -1) return

          const reordered = arrayMove(cellTasks, oldIdx, newIdx)
          reorderTasks(reordered)
          return
        }

        // 다른 project → cross-project move (over task의 project로)
        const taskId = activeIdStr.slice('bl-task:'.length)
        const targetProject = projects.find(p => p.id === overTask.projectId)
        if (!targetProject) return
        const sourceProject = projects.find(p => p.id === sourceTask.projectId)
        if (!canMoveTaskToProject(sourceTask, targetProject, sourceProject)) return
        // applyTransitionRules R5: projectId 변경 → keyMilestoneId 자동 초기화
        updateTask(taskId, { projectId: overTask.projectId })
        return
      }

      // ═══ 1.5) 백로그 → 다른 프로젝트 (Loop-49 R-05) ═══
      if (overId.startsWith('bl-project:')) {
        const taskId = activeIdStr.slice('bl-task:'.length)
        const targetProjectId = overId.slice('bl-project:'.length)
        // R-06 으로 active.data 항상 첨부됨
        const task = active.data?.current?.task
        const targetProject = projects.find(p => p.id === targetProjectId)
        if (!task || !targetProject) return
        // same-type validation (Spec §4-2 매트릭스). self-target 도 false 처리
        // hotfix-focus-and-dnd v2: 시스템 프로젝트(즉시 등) 경유 시 cross-boundary 허용.
        const sourceProject = projects.find(p => p.id === task.projectId)
        if (!canMoveTaskToProject(task, targetProject, sourceProject)) return
        // applyTransitionRules R5: projectId 변경 → keyMilestoneId 자동 초기화
        // useStore.js:675 personal-target 가드 자동 적용 (team→personal/system 시 scope=private 자동 변환)
        updateTask(taskId, { projectId: targetProjectId })
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
  }, [focusTasks, projects, tasks, milestones, currentUserId, updateTask, reorderFocusTasks, reorderTasks, reorderProjects, setExpanded])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(420px, 2fr) minmax(280px, 1fr)',
        gap: 20,
        width: '100%',
      }}>
        {/* Column 1: 개인 할일 매트릭스 (Spec r2 D3 외과적 교체) */}
        <div style={{ minWidth: 0 }}>
          <PersonalAgendaMatrixTable
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </div>

        {/* Column 2: 포커스 드롭존 + 패널 (FocusColumn = inner context 내부에서 useDroppable) */}
        <FocusColumn>
          <FocusPanel
            projects={projects}
            tasks={tasks}
            milestones={milestones}
          />
        </FocusColumn>
      </div>
    </DndContext>
  )
}
