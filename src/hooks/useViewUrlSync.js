import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useStore from './useStore'

const VIEW_TO_PATH = {
  today:               '/today',
  allTasks:            '/all-tasks',
  memory:              '/notes',
  'team-matrix':       '/team/matrix',
  'team-timeline':     '/team/timeline',
  'team-weekly':       '/team/weekly',
  'personal-matrix':   '/personal/matrix',
  'personal-timeline': '/personal/timeline',
  'personal-weekly':   '/personal/weekly',
  project:             '/projects',
}

const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([v, p]) => [p, v])
)

export default function useViewUrlSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentView = useStore(s => s.currentView)
  const selectedProjectId = useStore(s => s.selectedProjectId)
  const setView = useStore(s => s.setView)
  const enterProjectLayer = useStore(s => s.enterProjectLayer)

  const skipUrlUpdate = useRef(false)
  const skipViewUpdate = useRef(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (skipViewUpdate.current) {
      skipViewUpdate.current = false
      return
    }

    const path = location.pathname

    const ignorePaths = ['/profile', '/team/settings', '/onboarding', '/mode-select', '/invite', '/help']
    if (ignorePaths.some(p => path.startsWith(p))) return

    const projectMatch = path.match(/^\/project\/(.+)$/)
    if (projectMatch) {
      skipUrlUpdate.current = true
      enterProjectLayer(projectMatch[1])
      initialized.current = true
      return
    }

    const view = PATH_TO_VIEW[path]
    if (view) {
      skipUrlUpdate.current = true
      setView(view)
      initialized.current = true
      return
    }

    skipUrlUpdate.current = true
    setView('today')
    initialized.current = true
    if (path === '/' || !view) {
      skipViewUpdate.current = true
      navigate('/today', { replace: true })
    }
  }, [location.pathname])

  useEffect(() => {
    if (!initialized.current) return
    if (skipUrlUpdate.current) {
      skipUrlUpdate.current = false
      return
    }

    let targetPath
    if (currentView === 'projectLayer' && selectedProjectId) {
      targetPath = `/project/${selectedProjectId}`
    } else {
      targetPath = VIEW_TO_PATH[currentView] || '/today'
    }

    if (location.pathname !== targetPath) {
      skipViewUpdate.current = true
      navigate(targetPath)
    }
  }, [currentView, selectedProjectId])
}
