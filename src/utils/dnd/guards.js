/* DnD guards — view-neutral. spec §12.3
 *
 * task → targetProject 이동 가능 여부.
 * - Private task (!teamId) → personal/system project (!targetProject.teamId)
 * - Team task (teamId) → 같은 팀 project (teamId 일치)
 * - 자기 project → false (V5 self-target 가드)
 *
 * 이전: src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx
 * 이전 사유: view-neutral. team matrix DnD에서도 import 필요 (Loop-50 후속).
 */
export function canMoveTaskToProject(task, targetProject) {
  if (!task || !targetProject) return false
  if (task.projectId === targetProject.id) return false
  if (!task.teamId) return !targetProject.teamId
  return task.teamId === targetProject.teamId
}
