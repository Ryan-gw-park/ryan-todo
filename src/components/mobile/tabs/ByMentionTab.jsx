import { useLayoutEffect } from 'react'
import PersonalAgendaMatrixTable from '../../views/grid/PersonalAgendaMatrixTable'

const COLUMN_MODE_KEY = 'agendaMatrixColumnMode'

export default function ByMentionTab({ projects, tasks }) {
  useLayoutEffect(() => {
    try { localStorage.setItem(COLUMN_MODE_KEY, 'mention') } catch { /* noop */ }
  }, [])

  return <PersonalAgendaMatrixTable projects={projects} tasks={tasks} />
}
