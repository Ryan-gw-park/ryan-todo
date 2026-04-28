import { useCallback, useMemo } from 'react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, rectIntersection, useDroppable,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { COLOR } from '../../../styles/designTokens'
import PersonalTodoListTable from './PersonalTodoListTable'
import FocusPanel from './FocusPanel'
import { canMoveTaskToProject } from './cells/PersonalTodoProjectGroup'

/* ═══════════════════════════════════════════════
   PersonalTodoShell (Loop-45 → Loop-47)
   2컬럼 오케스트레이터 (grid) — 백로그 : 포커스 = 1.5fr : 1fr
   Loop-47: FocusNotePanel 제거, 노트 편집은 FocusCard 인라인 확장으로 이관.

   ⚠ 중요 — DndContext 컨텍스트 등록 순서 (Loop-46 QA fix):
   useDroppable/useSortable 은 호출 시점의 nearest React Context 로 등록됨.
   Shell 함수 본체에서 직접 useDroppable 을 부르면 OUTER(UnifiedGridView) 에
   등록되어 inner(Shell) DndContext 의 드래그에 보이지 않음.
   → FocusColumn child 컴포넌트로 분리해 inner DndContext 내부에서 훅 호출.

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

      // ═══ 1.3) 같은 project + same section task-on-task reorder (Loop-50 R-03) ═══
      // 우선순위: focus drop 다음, project header 앞 (Q3 — task-on-task 우선)
      if (overId.startsWith('bl-task:') && overId !== activeIdStr) {
        // W2 (3차) 가드: dnd-kit v5+ useSortable 이 data.sortable = { containerId, index } 자동 병합
        // 본 codebase 첫 사용 패턴이라 안전 가드 — 미정의 시 무시
        const sourceContextId = active.data?.current?.sortableContextId
        const overContextId = over.data?.current?.sortable?.containerId
        // sameContext = 같은 project + same section. 다른 context 또는 undefined = 무시 (Spec C5)
        if (!sourceContextId || !overContextId || sourceContextId !== overContextId) return

        const sourceTask = active.data?.current?.task
        if (!sourceTask) return

        // ListTable 필터 chain 과 동기화된 5조건 (Spec R-02 검증):
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
        const overTaskId = overId.slice('bl-task:'.length)
        const oldIdx = cellTasks.findIndex(t => t.id === sourceTaskId)
        const newIdx = cellTasks.findIndex(t => t.id === overTaskId)
        if (oldIdx === -1 || newIdx === -1) return

        const reordered = arrayMove(cellTasks, oldIdx, newIdx)
        reorderTasks(reordered)
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
        if (!canMoveTaskToProject(task, targetProject)) return
        // applyTransitionRules R5: projectId 변경 → keyMilestoneId 자동 초기화
        // useStore.js:621 personal-target 가드 자동 적용 (private 보호)
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
  }, [focusTasks, projects, tasks, currentUserId, updateTask, reorderFocusTasks, reorderTasks, setExpanded])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(420px, 1.5fr) minmax(280px, 1fr)',
        gap: 20,
        width: '100%',
      }}>
        {/* Column 1: 백로그 3섹션 */}
        <div style={{ minWidth: 0 }}>
          <PersonalTodoListTable
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
