/* ═════════════════════════════════════════════
   PivotProjectHeaderRow — 프로젝트 헤더 행
   spec §3.2 L-02 / L-05 (commit 5/7에서 본문 작성)

   책임:
     - L-02: 멤버별 카운트 셀 인라인 (별도 카운트 행 없음)
     - L-05: hover 시 우측 끝에 `+ 마일스톤` dashed-border pill (commit 7)

   props:
     - project: { id, name, ... }
     - members: Array<{ userId, displayName }>
     - tasks: 해당 프로젝트의 task 배열 (사전 필터됨)
     - isExpanded: boolean
     - onToggle: () => void
     - onTotalClick?: (projectId) => void  (DELETE 후보 — 합계 컬럼과 함께 삭제)
   ═════════════════════════════════════════════ */
export default function PivotProjectHeaderRow({ project, members, tasks, isExpanded, onToggle, onTotalClick }) {
  // commit 3: 빈 골격. commit 5에서 본문 작성.
  return null
}
