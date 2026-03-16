import useStore from './useStore'

export default function useProjectFilter(projects, tasks) {
  const teamId = useStore(s => s.currentTeamId)
  const filter = useStore(s => s.projectFilter)
  const localProjectOrder = useStore(s => s.localProjectOrder)

  // 로컬 순서 적용 정렬 함수 — 팀/개인 구분 없이 단일 리스트
  const sortLocally = (list) => [...list].sort((a, b) => {
    const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
    const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
    return orderA - orderB
  })

  // 개인 모드 — 전체 반환
  if (!teamId) {
    const sorted = sortLocally(projects)
    return { filteredProjects: sorted, filteredTasks: tasks }
  }

  // 팀 모드 — 로컬 순서 기준 정렬 (팀/개인 섹션 분리 없음)
  const allSorted = sortLocally(projects)

  // 필터 적용
  let filteredProjects
  switch (filter) {
    case 'team':
      filteredProjects = allSorted.filter(p => p.teamId)
      break
    case 'personal':
      filteredProjects = allSorted.filter(p => !p.teamId)
      break
    default: // 'all'
      filteredProjects = allSorted
  }

  const projectIds = new Set(filteredProjects.map(p => p.id))
  const filteredTasks = tasks.filter(t => projectIds.has(t.projectId))

  return { filteredProjects, filteredTasks }
}
