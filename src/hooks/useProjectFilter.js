import useStore from './useStore'

export default function useProjectFilter(projects, tasks) {
  const teamId = useStore(s => s.currentTeamId)
  const filter = useStore(s => s.projectFilter)
  const sectionOrder = useStore(s => s.projectSectionOrder)
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

  // 팀/개인 분리 후 로컬 순서 적용
  const teamPs = sortLocally(projects.filter(p => p.teamId === teamId))
  const personalPs = sortLocally(projects.filter(p => !p.teamId))
  const sections = { team: teamPs, personal: personalPs }

  // 섹션 순서대로 정렬된 전체 프로젝트
  const orderedProjects = [...(sections[sectionOrder[0]] || []), ...(sections[sectionOrder[1]] || [])]

  // 필터 적용
  let filteredProjects
  switch (filter) {
    case 'team':
      filteredProjects = orderedProjects.filter(p => p.teamId)
      break
    case 'personal':
      filteredProjects = orderedProjects.filter(p => !p.teamId)
      break
    default: // 'all'
      filteredProjects = orderedProjects
  }

  const projectIds = new Set(filteredProjects.map(p => p.id))
  const filteredTasks = tasks.filter(t => projectIds.has(t.projectId))

  return { filteredProjects, filteredTasks }
}
