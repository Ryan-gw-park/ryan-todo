import useStore from './useStore'

export default function useProjectFilter(projects, tasks) {
  const teamId = useStore(s => s.currentTeamId)
  const filter = useStore(s => s.projectFilter)

  // 팀 모드가 아니면 필터 무시 — 전체 반환
  if (!teamId) return { filteredProjects: projects, filteredTasks: tasks }

  let filteredProjects
  switch (filter) {
    case 'team':
      filteredProjects = projects.filter(p => p.teamId)
      break
    case 'personal':
      filteredProjects = projects.filter(p => !p.teamId)
      break
    default: // 'all'
      filteredProjects = projects
  }

  const projectIds = new Set(filteredProjects.map(p => p.id))
  const filteredTasks = tasks.filter(t => projectIds.has(t.projectId))

  return { filteredProjects, filteredTasks }
}
