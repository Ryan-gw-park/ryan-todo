import { useMemo } from 'react'
import MobileTaskListView from './MobileTaskListView'

export default function ByProjectTab({ projects, tasks }) {
  const activeTasks = useMemo(() => tasks.filter(t => !t.done), [tasks])
  const sections = useMemo(
    () => projects.map(p => ({
      key: p.id,
      title: p.name,
      tasks: activeTasks
        .filter(t => t.projectId === p.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    })),
    [projects, activeTasks]
  )
  return (
    <MobileTaskListView
      sections={sections}
      expandScope="personalProject"
      emptyStateText="표시할 프로젝트가 없습니다"
    />
  )
}
