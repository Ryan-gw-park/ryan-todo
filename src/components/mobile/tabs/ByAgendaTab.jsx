import { useMemo } from 'react'
import { AGENDA_TYPES, AGENDA_LABELS } from '../../../utils/dnd/cellKeys/personalAgenda'
import MobileTaskListView from './MobileTaskListView'

export default function ByAgendaTab({ projects, tasks }) {
  const activeTasks = useMemo(() => tasks.filter(t => !t.done), [tasks])

  const sections = useMemo(() => AGENDA_TYPES.map(type => {
    const tasksInAgenda = activeTasks.filter(t => {
      const ag = t.agendas || []
      // 빈 agendas → 'personal' 버킷 (PersonalAgendaMatrixTable 의 getCellTasks 동일 동작)
      if (ag.length === 0) return type === 'personal'
      return ag.includes(type)
    })
    const subGroups = projects
      .map(p => ({
        key: p.id,
        title: p.name,
        tasks: tasksInAgenda
          .filter(t => t.projectId === p.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }))
      .filter(g => g.tasks.length > 0)
    return { key: type, title: AGENDA_LABELS[type], subGroups }
  }), [activeTasks, projects])

  return (
    <MobileTaskListView
      sections={sections}
      expandScope="personalAgenda"
      emptyStateText="아젠다가 없습니다"
    />
  )
}
