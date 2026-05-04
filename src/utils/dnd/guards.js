/* DnD guards — view-neutral. spec §12.3
 *
 * task → targetProject 이동 가능 여부.
 * - 자기 project → false (V5 self-target 가드)
 * - System 프로젝트(즉시 등) 경유 시 cross-boundary 허용 (hotfix-focus-and-dnd v2):
 *     · target.isSystem → 어떤 task든 즉시로 이동 가능 (team→system 포함)
 *     · sourceProject.isSystem → 즉시 안의 어떤 task든 어디로든 이동 가능
 *   useStore.updateTask가 personal/system project로 이동 시 scope=private 자동 보정.
 * - 그 외:
 *     · Private task (!teamId) → personal/system project (!targetProject.teamId)
 *     · Team task (teamId) → 같은 팀 project (teamId 일치)
 *
 * 이전: src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx
 * 이전 사유: view-neutral. team matrix DnD에서도 import 필요 (Loop-50 후속).
 */
export function canMoveTaskToProject(task, targetProject, sourceProject) {
  if (!task || !targetProject) return false
  if (task.projectId === targetProject.id) return false
  // hotfix-focus-and-dnd v2: 시스템 프로젝트(즉시)는 cross-boundary 자유 이동 허용.
  if (targetProject.isSystem || sourceProject?.isSystem) return true
  if (!task.teamId) return !targetProject.teamId
  return task.teamId === targetProject.teamId
}
