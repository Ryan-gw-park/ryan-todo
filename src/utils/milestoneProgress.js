/**
 * MS 카운트 계산 — alive/total 방식
 * alive = 미완료 task (워크로드 인디케이터)
 * total = 전체 task (deleted 제외)
 */
export function computeMilestoneCount(milestoneId, allTasks) {
  const tasks = allTasks.filter(t =>
    t.keyMilestoneId === milestoneId && !t.deletedAt
  )
  const total = tasks.length
  const alive = tasks.filter(t => !t.done).length
  return { alive, total }
}

/**
 * 재귀 카운트 — MS + 하위 MS의 모든 task
 */
export function computeMilestoneCountRecursive(msId, allMilestones, allTasks) {
  let alive = 0, total = 0
  const { alive: a, total: t } = computeMilestoneCount(msId, allTasks)
  alive += a; total += t
  const children = allMilestones.filter(m => m.parent_id === msId)
  for (const child of children) {
    const r = computeMilestoneCountRecursive(child.id, allMilestones, allTasks)
    alive += r.alive; total += r.total
  }
  return { alive, total }
}
