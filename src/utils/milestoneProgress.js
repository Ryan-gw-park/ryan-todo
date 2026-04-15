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

// Loop 41: MS L1 flat. 재귀 카운트는 단일 MS 카운트와 동일. 호출자(MsTaskTreeMode)는 Loop 43에서 정리 예정.
export function computeMilestoneCountRecursive(msId, _allMilestones, allTasks) {
  return computeMilestoneCount(msId, allTasks)
}
