/* Personal agenda matrix DnD handlers — Hotfix r3 (row = project)
 *
 * Dispatcher types:
 *   - 'agenda-matrix-task'       : task 카드 → cell drop (cross-cell / same-cell reorder)
 *   - 'agenda-matrix-row'        : task 카드 → row 헤더 drop (projectId 재할당)
 *                                  (over.data.current.type='agenda-matrix-row-reorder'이지만
 *                                   active가 cell-task일 때 task-to-row로 분기 처리)
 *   - 'agenda-matrix-row-reorder': row 헤더 → row 헤더 drop (project 순서 변경)
 *
 * 행 = top-level project. cross-row drag = cross-project drag → R5 자연 발동
 * (keyMilestoneId 자동 nullify 수용 — milestone 정보가 매트릭스에 표시되지 않으므로 영향 없음).
 */
import { arrayMove } from '@dnd-kit/sortable'
import {
  getCellTasks,
  parseRowId,
  sameCellKey,
} from '../../../../utils/dnd/cellKeys/personalAgenda'

const TASK_ID_PREFIX = 'cell-task:'

function isTaskId(idStr) {
  return String(idStr || '').startsWith(TASK_ID_PREFIX)
}

function getTaskFromActive(active, ctx) {
  if (active.data?.current?.task) return active.data.current.task
  const idStr = String(active.id || '')
  if (!isTaskId(idStr)) return null
  const taskId = idStr.slice(TASK_ID_PREFIX.length)
  return ctx.tasks.find(t => t.id === taskId) || null
}

/* C8 — cell-to-cell drag (agenda 추가 모드 + 행 이동 시 projectId 재할당) */
export function handleAgendaMatrixTaskDrop(e, ctx) {
  const task = getTaskFromActive(e.active, ctx)
  if (!task) return

  const srcCellKey = e.active.data?.current?.cellKey
  const dstCellKey = e.over.data?.current?.cellKey
  if (!srcCellKey || !dstCellKey) return

  const cellCtx = { currentUserId: ctx.currentUserId, hideDone: false }

  // same-cell reorder
  if (sameCellKey(srcCellKey, dstCellKey)) {
    const cellTasks = getCellTasks(ctx.tasks, srcCellKey, cellCtx)
    const oldIdx = cellTasks.findIndex(t => t.id === task.id)
    const overTask = e.over.data?.current?.task
    const newIdx = overTask
      ? cellTasks.findIndex(t => t.id === overTask.id)
      : cellTasks.length - 1
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return
    ctx.reorderTasks(arrayMove(cellTasks, oldIdx, newIdx))
    return
  }

  applyAgendaCrossCell(task, srcCellKey, dstCellKey, ctx)
}

/* C9 / row drop:
 *   - active가 task 카드 (cell-task:...) → projectId 재할당
 *   - active가 row 헤더 (agenda-row:...) → row 순서 변경 (reorderProjects)
 *
 * dispatcher가 over.data.current.type === 'agenda-matrix-row-reorder' 매칭하여 본 핸들러 호출.
 */
export function handleAgendaMatrixRowDrop(e, ctx) {
  const activeIdStr = String(e.active.id || '')

  // 1) Row reorder (row → row)
  if (!isTaskId(activeIdStr) && activeIdStr.startsWith('agenda-row:')) {
    handleAgendaRowReorder(e, ctx)
    return
  }

  // 2) Task → row (projectId 재할당)
  const task = getTaskFromActive(e.active, ctx)
  if (!task) return

  const dstProjectId = e.over.data?.current?.projectId
    || e.over.data?.current?.rowProjectId
    || parseRowId(e.over.id)?.projectId
  if (!dstProjectId) return

  if (task.projectId === dstProjectId) return  // no-op

  // R5 자연 발동: projectId 변경 → keyMilestoneId 자동 nullify (의도된 동작)
  ctx.updateTask(task.id, { projectId: dstProjectId })
}

/* row 자체 reorder — project sort_order 갱신 */
function handleAgendaRowReorder(e, ctx) {
  const srcRow = parseRowId(e.active.id)
  const dstRow = parseRowId(e.over.id)
  if (!srcRow || !dstRow) return
  if (srcRow.projectId === dstRow.projectId) return

  const projects = ctx.projects || []
  const oldIdx = projects.findIndex(p => p.id === srcRow.projectId)
  const newIdx = projects.findIndex(p => p.id === dstRow.projectId)
  if (oldIdx === -1 || newIdx === -1) return

  const reordered = arrayMove(projects, oldIdx, newIdx)
  if (typeof ctx.reorderProjects === 'function') {
    ctx.reorderProjects(reordered)
  }
}

/* cross-cell 처리 (같은 행 다른 컬럼 or 다른 행):
 *   - 도착 agendaType을 task.agendas에 추가 (기존 태그 유지)
 *   - 다른 행이면 projectId 재할당 (R5는 자연 발동 — 매트릭스에 milestone 미표시이므로 영향 없음)
 */
function applyAgendaCrossCell(task, srcCellKey, dstCellKey, ctx) {
  const patch = {}

  const currentAgendas = Array.isArray(task.agendas) ? task.agendas : []
  if (!currentAgendas.includes(dstCellKey.agendaType)) {
    patch.agendas = [...currentAgendas, dstCellKey.agendaType]
  }

  if (srcCellKey.projectId !== dstCellKey.projectId) {
    patch.projectId = dstCellKey.projectId
    // R5 자연 발동 허용 — keyMilestoneId 자동 nullify (UX 영향 없음)
  }

  if (Object.keys(patch).length === 0) return
  ctx.updateTask(task.id, patch)
}
