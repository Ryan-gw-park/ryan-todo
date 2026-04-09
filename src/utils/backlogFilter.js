/**
 * 백로그 task 필터 유틸
 */
export function isBacklogTask(task) {
  return !task.keyMilestoneId && !task.done && !task.deletedAt
}
