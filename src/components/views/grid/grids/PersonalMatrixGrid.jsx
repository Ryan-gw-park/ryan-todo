import useStore from '../../../../hooks/useStore'
import PersonalTodoShell from '../../personal-todo/PersonalTodoShell'
import PersonalMatrixMobileList from '../PersonalMatrixMobileList'

/* ═════════════════════════════════════════════
   PersonalMatrixGrid — Loop 44 + Loop-45
   Desktop (≥768px): PersonalTodoShell (백로그 3섹션 + 포커스 패널)
   Mobile (<768px): PersonalMatrixMobileList (기존 유지, N-11)
   ═════════════════════════════════════════════ */
export default function PersonalMatrixGrid({ projects, myTasks }) {
  const milestones = useStore(s => s.milestones)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return <PersonalMatrixMobileList projects={projects} tasks={myTasks} />
  }

  return (
    <PersonalTodoShell
      projects={projects}
      tasks={myTasks}
      milestones={milestones}
    />
  )
}
