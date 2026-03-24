import useStore from './useStore'

export default function useProjectFilter(projects, tasks) {
  const teamId = useStore(s => s.currentTeamId)
  // Loop-39: projectFilter UI removed — scope is now determined by sidebar navigation.
  // Always use 'all' to prevent stale localStorage values from filtering out projects.
  const filter = 'all'
  const localProjectOrder = useStore(s => s.localProjectOrder)

  // 로컬 순서 적용 정렬 함수
  const sortLocally = (list) => [...list].sort((a, b) => {
    const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
    const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
    return orderA - orderB
  })

  // 팀 모드가 아니면 필터 무시 — 전체 반환 (로컬 순서 기준 정렬)
  if (!teamId) {
    const sorted = sortLocally(projects)
    return { filteredProjects: sorted, filteredTasks: tasks }
  }

  // 로컬 순서로 단일 정렬 (팀/개인 섹션 분리 없이)
  const sorted = sortLocally(projects)

  // 필터 적용
  let filteredProjects
  switch (filter) {
    case 'team':
      filteredProjects = sorted.filter(p => p.teamId)
      break
    case 'personal':
      filteredProjects = sorted.filter(p => !p.teamId)
      break
    default: // 'all'
      filteredProjects = sorted
  }

  const projectIds = new Set(filteredProjects.map(p => p.id))
  const filteredTasks = tasks.filter(t => projectIds.has(t.projectId))

  return { filteredProjects, filteredTasks }
}
