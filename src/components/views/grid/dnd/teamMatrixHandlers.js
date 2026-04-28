/* Team matrix DnD handlers — spec §5.2 v6
 *
 * Dispatcher type:
 *   - 'team-matrix-task' : task 카드 → task 카드 (cell-task → cell-task)
 *   - 'team-matrix-band' : task 카드 → MS 밴드 (cell-task → matrix-band)
 *   - 'team-matrix-project-header' : task 카드 → 프로젝트 헤더 (cell-task → matrix-project-header)
 *
 * 모든 cross-cell drop은 patch에 category: 'today' 강제 (Round 1 Q2).
 * 이는 본 분기 내부에서만 적용 — personal matrix(별도 type)는 영향 없음 (E-12).
 */
import { arrayMove } from '@dnd-kit/sortable'
import { canMoveTaskToProject } from '../../../../utils/dnd/guards'
import { matchesCellKey, getCellTasks } from '../../../../utils/dnd/cellKeys/teamMatrix'
import { resolveMemberFromX } from '../../../../utils/dnd/resolveMemberFromX'

/* same-cell reorder 또는 cross-cell move 분기 */
export function handleTeamMatrixTaskDrop(e, ctx) {
  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = e.over.data.current.cellKey
  const task = e.active.data.current.task

  if (matchesCellKey(srcCellKey, dstCellKey)) {
    // same-cell reorder
    const cellTasks = getCellTasks(ctx.tasks, srcCellKey, ctx)
    const oldIdx = cellTasks.findIndex(t => t.id === task.id)
    const overTask = e.over.data.current.task
    const newIdx = overTask
      ? cellTasks.findIndex(t => t.id === overTask.id)
      : cellTasks.length - 1
    if (oldIdx === -1 || newIdx === -1) return
    if (oldIdx === newIdx) return
    ctx.reorderTasks(arrayMove(cellTasks, oldIdx, newIdx))
    return
  }

  applyCrossCell(task, srcCellKey, dstCellKey, ctx)
}

/* MS 밴드 drop (over.data.current.type === 'team-matrix-band') */
export function handleTeamMatrixBandDrop(e, ctx) {
  const memberId = resolveMemberFromX(e.over.rect, e, e.over.data.current.members)
  if (memberId === '__GUTTER__') return  // E-11

  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = {
    projectId: e.over.data.current.projectId,
    msId: e.over.data.current.msId,
    memberId,
  }
  if (matchesCellKey(srcCellKey, dstCellKey)) return  // E-13: 자체 cell drop

  applyCrossCell(e.active.data.current.task, srcCellKey, dstCellKey, ctx)
}

/* 프로젝트 헤더 drop (over.data.current.type === 'team-matrix-project-header') */
export function handleTeamMatrixProjectHeaderDrop(e, ctx) {
  const memberId = resolveMemberFromX(e.over.rect, e, e.over.data.current.members)
  if (memberId === '__GUTTER__') return

  const srcCellKey = e.active.data.current.cellKey
  const dstCellKey = {
    projectId: e.over.data.current.projectId,
    msId: null,  // 가상 backlog
    memberId,
  }
  if (matchesCellKey(srcCellKey, dstCellKey)) return  // E-13

  applyCrossCell(e.active.data.current.task, srcCellKey, dstCellKey, ctx)
}

/* 공통 cross-cell 처리.
 * - cross-project 시 canMoveTaskToProject 가드 (D-09).
 * - patch 구성 후 updateTask + dst/src 양쪽 reorderTasks (Round 2 Q1: dst 전체 + src 갭 압축).
 * - applyTransitionRules R5/R7 자동 처리 (spec §5.6).
 */
function applyCrossCell(task, srcCellKey, dstCellKey, ctx) {
  const patch = { category: 'today' }  // team matrix only

  if (srcCellKey.projectId !== dstCellKey.projectId) {
    const dstProject = ctx.projects.find(p => p.id === dstCellKey.projectId)
    if (!canMoveTaskToProject(task, dstProject)) return  // D-09
    patch.projectId = dstCellKey.projectId
    patch.keyMilestoneId = dstCellKey.msId  // R5 차단용 명시 보존
  }

  if ((task.keyMilestoneId ?? null) !== (dstCellKey.msId ?? null)) {
    patch.keyMilestoneId = dstCellKey.msId
  }
  if ((task.assigneeId ?? null) !== (dstCellKey.memberId ?? null)) {
    patch.assigneeId = dstCellKey.memberId
  }

  ctx.updateTask(task.id, patch)

  // Dst 전체 + Src 갭 압축 (Round 2 Q1)
  // 주: ctx.tasks는 patch 전 store 스냅샷 → dst tasks는 moved task 미포함 상태.
  //     reorderTasks 호출 시 moved task를 명시적으로 dst 끝에 추가해야 함.
  const dstTasks = getCellTasks(ctx.tasks, dstCellKey, ctx)
  const srcTasks = getCellTasks(ctx.tasks, srcCellKey, ctx).filter(t => t.id !== task.id)

  ctx.reorderTasks([...dstTasks, task])  // dst 끝에 삽입
  ctx.reorderTasks(srcTasks)             // src 갭 압축
}
