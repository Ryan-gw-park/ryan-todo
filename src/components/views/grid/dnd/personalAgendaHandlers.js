/* Personal agenda matrix DnD handlers — Spec r2 C8 / C9
 *
 * Dispatcher types (PersonalTodoShell 모듈 최상단에서 registerHandler 호출):
 *   - 'agenda-matrix-task' : task 카드 → 셀 또는 다른 task 카드 (cross-cell / same-cell)
 *   - 'agenda-matrix-row'  : task 카드 → row 헤더 (milestone 재할당)
 *
 * 행 = key_milestone (Spec r2 D5+). cross-cell 시 keyMilestoneId만 변경.
 *
 * B-2 결정: cross-project milestone drag 금지 (silent return).
 *   - 시나리오: ABI Korea의 task → SAP 산하 milestone 행에 drag
 *   - 처리: task.projectId !== dstMs.project_id 이면 no-op
 *   - 이유: 데이터 무결성 (project_id ↔ milestone.project_id 불일치 방지)
 *   - 사용자는 detail panel에서 명시적으로 project를 먼저 이동해야 cross-project 가능
 */
import { arrayMove } from '@dnd-kit/sortable'
import { getCellTasks, sameCellKey } from '../../../../utils/dnd/cellKeys/personalAgenda'

/* C8 — cell→cell drag (agenda 추가 모드 + 행 이동 시 milestone 변경) */
export function handleAgendaMatrixTaskDrop(e, ctx) {
  const task = e.active.data?.current?.task
  if (!task) return

  const srcCellKey = e.active.data?.current?.cellKey
  const dstCellKey = e.over.data?.current?.cellKey
  if (!srcCellKey || !dstCellKey) return

  const cellCtx = { currentUserId: ctx.currentUserId, hideDone: false }

  // Same cell reorder
  if (sameCellKey(srcCellKey, dstCellKey)) {
    const cellTasks = getCellTasks(ctx.tasks, srcCellKey, cellCtx)
    const oldIdx = cellTasks.findIndex(t => t.id === task.id)
    const overTask = e.over.data?.current?.task
    const newIdx = overTask
      ? cellTasks.findIndex(t => t.id === overTask.id)
      : cellTasks.length - 1
    if (oldIdx === -1 || newIdx === -1) return
    if (oldIdx === newIdx) return
    ctx.reorderTasks(arrayMove(cellTasks, oldIdx, newIdx))
    return
  }

  // Cross-cell move
  applyAgendaCrossCell(task, srcCellKey, dstCellKey, ctx)
}

/* C9 — task → row 헤더 drag (milestone 재할당, agendas는 유지) */
export function handleAgendaMatrixRowDrop(e, ctx) {
  const task = e.active.data?.current?.task
  if (!task) return

  const dstMsId = e.over.data?.current?.msId ?? null  // null = inbox
  if ((task.keyMilestoneId ?? null) === dstMsId) return  // no-op

  // B-2 guard: cross-project 금지
  if (dstMsId) {
    const dstMs = (ctx.milestones || []).find(m => m.id === dstMsId)
    if (!dstMs) return
    const dstProjectId = dstMs.project_id
    if (task.projectId && dstProjectId && task.projectId !== dstProjectId) {
      // 다른 프로젝트의 milestone — 데이터 무결성 보호, no-op
      return
    }
  }

  ctx.updateTask(task.id, { keyMilestoneId: dstMsId })
}

/* 공통 cross-cell 처리 (셀↔셀):
 *   - 도착 agendaType을 task.agendas에 추가 (R-DND-4 추가 모드)
 *   - 다른 milestone 행이면 keyMilestoneId 변경 (R-DND-5)
 *   - cross-project milestone 이동 금지 (B-2)
 *   - 행=key_milestone이라 projectId 변경 없음 → R5 우회 불필요
 */
function applyAgendaCrossCell(task, srcCellKey, dstCellKey, ctx) {
  const patch = {}

  // 도착 agendaType 추가 (기존 태그 유지)
  const currentAgendas = Array.isArray(task.agendas) ? task.agendas : []
  if (!currentAgendas.includes(dstCellKey.agendaType)) {
    patch.agendas = [...currentAgendas, dstCellKey.agendaType]
  }

  // 행 이동: keyMilestoneId 변경
  if (srcCellKey.msId !== dstCellKey.msId) {
    // B-2 guard: cross-project milestone 금지
    if (dstCellKey.msId) {
      const dstMs = (ctx.milestones || []).find(m => m.id === dstCellKey.msId)
      if (!dstMs) return
      if (task.projectId && dstMs.project_id && task.projectId !== dstMs.project_id) {
        return  // 데이터 무결성 보호 — silent no-op
      }
    }
    patch.keyMilestoneId = dstCellKey.msId  // null = inbox
  }

  if (Object.keys(patch).length === 0) return
  ctx.updateTask(task.id, patch)
}
