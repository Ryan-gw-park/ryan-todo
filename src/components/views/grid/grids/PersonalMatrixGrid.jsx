import useStore from '../../../../hooks/useStore'
import PersonalPivotMatrixTable from '../PersonalPivotMatrixTable'
import PersonalMatrixMobileList from '../PersonalMatrixMobileList'

/* ═════════════════════════════════════════════
   PersonalMatrixGrid — Loop 44 + mobile optimization
   Desktop (≥768px): PersonalPivotMatrixTable (피벗 테이블)
   Mobile (<768px): PersonalMatrixMobileList (단일 리스트 + FAB)
   ═════════════════════════════════════════════ */
export default function PersonalMatrixGrid({ projects, myTasks }) {
  const milestones = useStore(s => s.milestones)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return <PersonalMatrixMobileList projects={projects} tasks={myTasks} />
  }

  return (
    <PersonalPivotMatrixTable
      projects={projects}
      tasks={myTasks}
      milestones={milestones}
    />
  )
}
