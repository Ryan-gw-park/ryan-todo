/* ═════════════════════════════════════════════
   PivotMilestoneBand — 풀폭 MS 가로 밴드
   spec §3.2 L-03 / L-04 (commit 4에서 본문 작성)

   props:
     - milestone: { id, title } | null  (null = 미분류 밴드)
     - count: number  (밴드 우측 표시)
     - colSpan: number  (caller가 직접 주입 — members.length + N)
     - dim: boolean  (미분류일 때 true → OPACITY.projectDimmed)
     - projectId: string  (commit 11에서 droppable 등록 시 사용)
   ═════════════════════════════════════════════ */
export default function PivotMilestoneBand({ milestone, count, colSpan, dim = false, projectId }) {
  // commit 3: 빈 골격. commit 4에서 본문 작성.
  return null
}
