import { useMemo } from 'react'
import MobileTaskListView from './MobileTaskListView'

/* Today 마커가 켜진 미완료 본인 할일만 프로젝트별로 모아 노출.
   - 필터: !done && isToday === true
   - 그룹: 프로젝트 (flat, ByProjectTab 동일 패턴)
   - task 0건인 프로젝트는 섹션 자체를 미렌더 (Today 는 의도된 task 만 노출되는 단축 뷰) */
export default function ByTodayTab({ projects, tasks }) {
  const todayTasks = useMemo(
    () => tasks.filter(t => !t.done && t.isToday === true),
    [tasks]
  )
  const sections = useMemo(
    () => projects
      .map(p => ({
        key: p.id,
        title: p.name,
        tasks: todayTasks
          .filter(t => t.projectId === p.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }))
      .filter(s => s.tasks.length > 0),
    [projects, todayTasks]
  )
  return (
    <MobileTaskListView
      sections={sections}
      expandScope="personalToday"
      emptyStateText="Today 로 표시된 할일이 없습니다"
    />
  )
}
