/* Personal Agenda Matrix cellKey utility — Hotfix r9 (column mode toggle)
 *
 * cellKey: { projectId, agendaType }
 *   - agendaType은 generic columnKey 역할.
 *     · columnMode='agenda': agendas enum 값 (weekly_jason / ...)
 *     · columnMode='mention': mention 이름 (Ethan / Ash / ...)
 *
 * droppable id:
 *   - `agenda-cell:{projectId}:{columnKey}`
 *   - `agenda-cell-sortable:{projectId}:{columnKey}`
 *   - `agenda-row:{projectId}`
 */
import { parseMentions } from '../../mentions'

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
 * ctx.columnMode:
 *   - 'agenda' (기본): cellKey.agendaType이 agendas 배열 중 하나
 *     · 가상 분류: agendaType='personal' && task.agendas 비어있음 → 표시
 *   - 'mention': cellKey.agendaType이 task.text의 @mention 이름과 일치
 *
 * 공통 필터:
 *   - assigneeId === currentUserId OR 개인 프로젝트 task (scope='private' → assigneeId=null)
 *   - !deletedAt
 *   - hideDone ? !done : true
 *   - t.projectId === cellKey.projectId
 */
export function getCellTasks(tasks, cellKey, ctx) {
  const { currentUserId, hideDone, columnMode } = ctx || {}
  const mode = columnMode || 'agenda'
  return tasks
    .filter(t => {
      // 개인 프로젝트 task는 assigneeId=null. RLS owner-only → 로컬에 들어왔다면 본인 소유.
      const isMine = t.assigneeId === currentUserId || (!t.teamId && !t.assigneeId)
      if (!isMine) return false
      if (t.deletedAt) return false
      if (hideDone && t.done) return false
      if (t.projectId !== cellKey.projectId) return false

      if (mode === 'mention') {
        const names = parseMentions(t.text || '')
        return names.includes(cellKey.agendaType)
      }

      // agenda 모드 (기본)
      const agendas = Array.isArray(t.agendas) ? t.agendas : []
      if (agendas.includes(cellKey.agendaType)) return true
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
