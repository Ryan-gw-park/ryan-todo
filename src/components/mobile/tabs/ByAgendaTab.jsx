import { useLayoutEffect } from 'react'
import PersonalAgendaMatrixTable from '../../views/grid/PersonalAgendaMatrixTable'

const COLUMN_MODE_KEY = 'agendaMatrixColumnMode'

export default function ByAgendaTab({ projects, tasks }) {
  // remount 시점에 PersonalAgendaMatrixTable 가 useState 초기화자에서
  // localStorage 를 읽기 전에 강제로 'agenda' 로 설정 (useLayoutEffect 는 mount 직후 동기 실행).
  // 실제로는 부모 MobilePersonalPage 의 handleTabChange 에서 이미 setItem 을 했지만,
  // 페이지 직접 진입 등 모서리 케이스 방어용 백업.
  useLayoutEffect(() => {
    try { localStorage.setItem(COLUMN_MODE_KEY, 'agenda') } catch { /* noop */ }
  }, [])

  return <PersonalAgendaMatrixTable projects={projects} tasks={tasks} />
}
