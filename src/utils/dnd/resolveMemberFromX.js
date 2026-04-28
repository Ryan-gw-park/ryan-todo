/* resolveMemberFromX — 밴드/헤더 drop 시 포인터 X로 멤버 컬럼 해석 (spec §5.4)
 *
 * 그리드 구조 (PivotMatrixTable.jsx:77-82):
 *   col 0: 라벨 거터 (130px = PIVOT.colWidthLabelGutter)
 *   col 1..N: 멤버 컬럼 (members.length개)
 *   col N+1: 미배정 컬럼
 *   col N+2: 합계 컬럼 (commit 14에서 제거 예정)
 *
 * 따라서 드롭 가능한 컬럼 = members.length + 1 (미배정 포함).
 * 합계 컬럼은 drop target 아님 (rect.width 계산에서 자동 제외 — over.rect는 droppable 영역만).
 *
 * 단, MS 밴드와 프로젝트 헤더는 합계 컬럼까지 colSpan으로 덮음 → over.rect.width는 전체 폭.
 * relX 계산 시 합계 컬럼 영역은 추가 처리 필요할 수 있으나, MVP는 단순 N+1 균등 분할 가정.
 *
 * 반환:
 *   '__GUTTER__' — 라벨 거터 영역 (drop 거부, E-11)
 *   null — 미배정 컬럼
 *   userId(string) — 특정 멤버 컬럼
 */
const LABEL_GUTTER = 130

export function resolveMemberFromX(rect, event, members) {
  const dropX = (event.activatorEvent?.clientX ?? 0) + (event.delta?.x ?? 0)
  const relX = dropX - rect.left - LABEL_GUTTER
  if (relX < 0) return '__GUTTER__'

  // 멤버 컬럼 + 미배정 컬럼 = members.length + 1
  const totalCols = members.length + 1
  if (totalCols <= 0) return '__GUTTER__'

  const colWidth = (rect.width - LABEL_GUTTER) / totalCols
  if (colWidth <= 0) return '__GUTTER__'

  const idx = Math.floor(relX / colWidth)
  if (idx < 0) return '__GUTTER__'
  if (idx >= members.length) return null  // 미배정 컬럼

  return members[idx]?.userId ?? null
}
