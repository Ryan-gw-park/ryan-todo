import useStore from '../../../../hooks/useStore'
import PivotMatrixTable from '../PivotMatrixTable'

/* ═════════════════════════════════════════════
   TeamMatrixGrid — Loop 42: PivotMatrixTable Wrapper
   외부 props 시그니처 유지 (UnifiedGridView 호환성).
   내부는 피벗 테이블로 전면 교체. 기존 3×3 카드 그리드 폐기.
   groupByOwner, collapsed, toggleCollapse, toggleDone, openDetail, activeId:
     PivotMatrixTable이 store 직접 구독하므로 미사용.
   ═════════════════════════════════════════════ */
export default function TeamMatrixGrid({ projects, tasks, members, currentTeamId, filter = 'all' }) {
  const milestones = useStore(s => s.milestones)

  // 팀 스코프 제한: teamId 일치 task만
  const scopedTasks = tasks.filter(t => t.teamId === currentTeamId)

  return (
    <PivotMatrixTable
      projects={projects}
      members={members}
      tasks={scopedTasks}
      milestones={milestones}
      filter={filter}
    />
  )
}
