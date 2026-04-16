import useStore from '../../../../hooks/useStore'
import PersonalPivotMatrixTable from '../PersonalPivotMatrixTable'

/* ═════════════════════════════════════════════
   PersonalMatrixGrid — Loop 44: PersonalPivotMatrixTable Wrapper
   외부 props 시그니처 유지 (UnifiedGridView 호환성).
   내부는 시간 피벗 테이블로 전면 교체.
   todayFilter / SortableContext / ProjectLaneCard 폐기.
   사용 안 하는 props (collapsed, toggleCollapse, toggleDone, openDetail,
     activeId, matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
     matrixDoneCollapsed, toggleMatrixDoneCollapse): PersonalPivotMatrixTable이
     store 직접 구독하므로 무시.
   ═════════════════════════════════════════════ */
export default function PersonalMatrixGrid({ projects, myTasks }) {
  const milestones = useStore(s => s.milestones)
  return (
    <PersonalPivotMatrixTable
      projects={projects}
      tasks={myTasks}
      milestones={milestones}
    />
  )
}
