/* Personal Agenda Matrix cellKey utility — Spec r2 R-DND-2 / C4b
 *
 * cellKey 구조: { msId: uuid|null, agendaType: string }
 *   - msId = null  → inbox 행 (keyMilestoneId IS NULL)
 *   - msId = uuid  → 특정 key_milestone 행
 *
 * droppable id 규칙:
 *   - `agenda-cell:{msId|inbox}:{agendaType}`           — cell drop 영역
 *   - `agenda-cell-sortable:{msId|inbox}:{agendaType}`  — SortableContext
 *   - `agenda-row:{msId|inbox}`                          — row 헤더 drop 영역
 *
 * 행 = key_milestone (Spec r2 D5+ — milestone sub-row 평탄화, 행 자체가 milestone)
 */

export const AGENDA_TYPES = ['weekly_jason', 'weekly_planning', 'decision_needed', 'personal']

export const AGENDA_LABELS = {
  weekly_jason:    'Jason 위클리',
  weekly_planning: 'Planning 위클리',
  decision_needed: '의사결정 필요',
  personal:        '내 개인 할일',
}

// designTokens.AGENDA key 매핑
export const AGENDA_TOKEN_KEYS = {
  weekly_jason:    'jasonWeekly',
  weekly_planning: 'planningWeekly',
  decision_needed: 'decisionNeeded',
  personal:        'personal',
}

export function makeCellKey(msId, agendaType) {
  return { msId: msId ?? null, agendaType }
}

export function makeCellId(msId, agendaType) {
  return `agenda-cell:${msId || 'inbox'}:${agendaType}`
}

export function makeSortableId(msId, agendaType) {
  return `agenda-cell-sortable:${msId || 'inbox'}:${agendaType}`
}

export function makeRowId(msId) {
  return `agenda-row:${msId || 'inbox'}`
}

export function parseCellId(idStr) {
  const s = String(idStr || '')
  const m = /^agenda-cell(?:-sortable)?:([^:]+):(.+)$/.exec(s)
  if (!m) return null
  return { msId: m[1] === 'inbox' ? null : m[1], agendaType: m[2] }
}

export function parseRowId(idStr) {
  const m = /^agenda-row:(.+)$/.exec(String(idStr || ''))
  if (!m) return null
  return { msId: m[1] === 'inbox' ? null : m[1] }
}

export function sameCellKey(a, b) {
  return !!a && !!b && a.msId === b.msId && a.agendaType === b.agendaType
}

/* 셀 한 칸의 task 목록 + 정렬
 *   - assigneeId === currentUserId (Spec r2 D10)
 *   - keyMilestoneId match (msId=null → IS NULL)
 *   - agendas 배열에 agendaType 포함
 *   - hideDone 옵션
 */
export function getCellTasks(tasks, cellKey, ctx) {
  const { currentUserId, hideDone } = ctx || {}
  return tasks
    .filter(t =>
      t.assigneeId === currentUserId &&
      !t.deletedAt &&
      (hideDone ? !t.done : true) &&
      (cellKey.msId === null
        ? t.keyMilestoneId == null
        : t.keyMilestoneId === cellKey.msId) &&
      Array.isArray(t.agendas) && t.agendas.includes(cellKey.agendaType)
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

/* 매트릭스 행으로 표시할 milestone 목록
 *   - 현재 사용자에게 할당된 미완료 task가 ≥1개 있는 milestone (변동 행 수)
 *   - 정렬: 상위 project sortOrder → milestone sort_order
 */
export function getVisibleMilestones(milestones, tasks, projects, currentUserId) {
  const myMs = new Set(
    tasks
      .filter(t => t.assigneeId === currentUserId && !t.done && !t.deletedAt && t.keyMilestoneId)
      .map(t => t.keyMilestoneId)
  )
  const projectOrder = new Map(
    (projects || []).map((p, idx) => [p.id, p.sortOrder ?? idx])
  )
  return (milestones || [])
    .filter(m => myMs.has(m.id))
    .sort((a, b) => {
      const pa = projectOrder.get(a.project_id) ?? 9999
      const pb = projectOrder.get(b.project_id) ?? 9999
      if (pa !== pb) return pa - pb
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
}
