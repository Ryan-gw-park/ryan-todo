/* Personal Agenda Matrix cellKey utility — Hotfix r3 (row = project)
 *
 * 변경 사유 (사용자 피드백 — 2026-05-18):
 *   - 사용자는 매트릭스에 모든 프로젝트가 행으로 보이길 원함 (이전: milestone 행, task ≥1인 milestone만)
 *   - 행 간 상하 reorder 가능해야 함 (project sort_order)
 *   - keyMilestoneId IS NULL task는 "내 개인할일" 컬럼에 자동 분류
 *
 * 변경 결과:
 *   - 행 = top-level project (`tasks.project_id`)
 *   - inbox 행 폐지 (모든 task는 어떤 project에 속함)
 *   - agendas가 비어있는 task → 'personal' 컬럼에 가상 표시 (DB 변경 없음)
 *
 * cellKey 구조: { projectId: string, agendaType: string }
 *
 * droppable id:
 *   - `agenda-cell:{projectId}:{agendaType}`           — cell drop 영역
 *   - `agenda-cell-sortable:{projectId}:{agendaType}`  — SortableContext
 *   - `agenda-row:{projectId}`                          — row 헤더 drop + sortable
 */

export const AGENDA_TYPES = ['weekly_jason', 'weekly_planning', 'decision_needed', 'personal']

export const AGENDA_LABELS = {
  weekly_jason:    'Jason 위클리',
  weekly_planning: 'Planning 위클리',
  decision_needed: '의사결정 필요',
  personal:        '내 개인 할일',
}

export const AGENDA_TOKEN_KEYS = {
  weekly_jason:    'jasonWeekly',
  weekly_planning: 'planningWeekly',
  decision_needed: 'decisionNeeded',
  personal:        'personal',
}

export function makeCellKey(projectId, agendaType) {
  return { projectId, agendaType }
}

export function makeCellId(projectId, agendaType) {
  return `agenda-cell:${projectId}:${agendaType}`
}

export function makeSortableId(projectId, agendaType) {
  return `agenda-cell-sortable:${projectId}:${agendaType}`
}

export function makeRowId(projectId) {
  return `agenda-row:${projectId}`
}

export function parseCellId(idStr) {
  const s = String(idStr || '')
  const m = /^agenda-cell(?:-sortable)?:([^:]+):(.+)$/.exec(s)
  if (!m) return null
  return { projectId: m[1], agendaType: m[2] }
}

export function parseRowId(idStr) {
  const m = /^agenda-row:(.+)$/.exec(String(idStr || ''))
  if (!m) return null
  return { projectId: m[1] }
}

export function sameCellKey(a, b) {
  return !!a && !!b && a.projectId === b.projectId && a.agendaType === b.agendaType
}

/* 셀 한 칸의 task 목록 + 정렬
 *
 * 필터:
 *   - assigneeId === currentUserId (D10)
 *   - !deletedAt
 *   - hideDone ? !done : true
 *   - t.projectId === cellKey.projectId
 *   - agenda 매칭:
 *       (a) agendas 배열에 agendaType이 명시되어 있거나
 *       (b) cellKey.agendaType === 'personal' AND task.agendas가 비어있음 (가상 fallback)
 */
export function getCellTasks(tasks, cellKey, ctx) {
  const { currentUserId, hideDone } = ctx || {}
  return tasks
    .filter(t => {
      if (t.assigneeId !== currentUserId) return false
      if (t.deletedAt) return false
      if (hideDone && t.done) return false
      if (t.projectId !== cellKey.projectId) return false
      const agendas = Array.isArray(t.agendas) ? t.agendas : []
      if (agendas.includes(cellKey.agendaType)) return true
      // 가상 분류: agendas 미지정 task → 'personal' 컬럼에 표시
      if (cellKey.agendaType === 'personal' && agendas.length === 0) return true
      return false
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

/* 매트릭스 행으로 표시할 project 목록
 *
 * 사용자 피드백: "모든 프로젝트가 표시되어야 한다."
 * → 본인이 보는 모든 프로젝트(displayProjects)를 행으로 표시. task 0건 프로젝트도 표시.
 *
 * 정렬: localProjectOrder ?? sortOrder (store.reorderProjects가 갱신하는 값)
 */
export function getVisibleProjects(projects, localProjectOrder) {
  const order = localProjectOrder || {}
  return (projects || [])
    .filter(p => !p.archivedAt)
    .sort((a, b) => {
      const oA = order[a.id] !== undefined ? order[a.id] : (a.sortOrder ?? 0)
      const oB = order[b.id] !== undefined ? order[b.id] : (b.sortOrder ?? 0)
      return oA - oB
    })
}
