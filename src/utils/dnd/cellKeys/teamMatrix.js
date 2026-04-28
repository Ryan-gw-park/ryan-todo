/* Team matrix cell key helpers — spec §5.3 v6, §12.3, §12.6
 *
 * cell key 차원: { projectId, msId, memberId }
 * (msId === null = 미분류, memberId === null = 미배정 컬럼)
 *
 * View별 namespace 보존 — 한 함수가 여러 뷰의 cellKey를 introspection 금지.
 * Personal matrix는 cellKey 차원이 다르므로 별도 모듈 (현재는 미사용).
 */

export function matchesCellKey(a, b) {
  return (a.projectId ?? null) === (b.projectId ?? null)
      && (a.msId ?? null) === (b.msId ?? null)
      && (a.memberId ?? null) === (b.memberId ?? null)
}

/**
 * Team matrix cell tasks — PivotMatrixTable + PivotTaskCell의 표시 필터를 그대로 인용.
 * spec §11.2 #5 검증 결과 반영.
 *
 * 입력 `tasks` = store의 전체 tasks 배열 (UnifiedGridView ctx.tasks).
 * PivotTaskCell이 받는 사전-필터된 tasks가 아님. 모든 필터를 본 함수 안에서 적용 (이중 필터 방지).
 *
 * Filter chain:
 *   (1) team scope (TeamMatrixGrid.jsx:14)
 *   (2) project + done + deletedAt (PivotMatrixTable.jsx:127)
 *   (3) keyMilestoneId (PivotMatrixTable.jsx:144,149,160,164)
 *   (4) memberId
 *       - 미배정 cell: PivotTaskCell.jsx:27 패턴 (assigneeId == null && secondaryAssigneeId == null && scope === 'team')
 *       - primary cell: assigneeId === cellKey.memberId
 *         (secondary는 reorder 대상 아님 — drag 비활성, §0.1)
 *
 * filter prop ('all' | 'unassigned' | 'assigned')은 PivotMatrixTable.jsx:52-62에서
 * 처리되어 표시 필터링 — drop 후 reorder 시에는 store의 모든 cell 멤버를 정렬해야
 * 하므로 여기서는 적용 안 함. (filter prop은 시각 필터, 데이터는 그대로)
 */
export function getCellTasks(tasks, cellKey, ctx) {
  const teamFiltered = tasks.filter(t => t.teamId === ctx.currentTeamId)

  const projFiltered = teamFiltered.filter(t =>
    t.projectId === cellKey.projectId &&
    !t.done &&
    !t.deletedAt
  )

  const msFiltered = projFiltered.filter(t => (t.keyMilestoneId ?? null) === (cellKey.msId ?? null))

  const cellTasks = cellKey.memberId == null
    ? msFiltered.filter(t =>
        t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team'
      )
    : msFiltered.filter(t => t.assigneeId === cellKey.memberId)

  return cellTasks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}
