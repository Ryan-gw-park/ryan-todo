import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useStore from './useStore'

const VIEW_TO_PATH = {
  memory:              '/notes',
  'team-matrix':       '/team/matrix',
  'team-timeline':     '/team/timeline',
  'team-weekly':       '/team/weekly',
  'team-weekly-schedule': '/team/weekly-schedule',
  'personal-matrix':   '/personal/matrix',
  'personal-timeline': '/personal/timeline',
  'personal-weekly':   '/personal/weekly',
  project:             '/projects',
}

// Legacy URL aliases — 북마크 호환 (구 URL → personal-matrix)
const LEGACY_PATHS = new Set(['/today', '/all-tasks'])

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

    // Legacy URL (/today, /all-tasks) 또는 알 수 없는 경로 → personal-matrix
    skipUrlUpdate.current = true
    setView('personal-matrix')
    initialized.current = true
    if (path === '/' || LEGACY_PATHS.has(path) || !view) {
      skipViewUpdate.current = true
      navigate('/personal/matrix', { replace: true })
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
      targetPath = VIEW_TO_PATH[currentView] || '/personal/matrix'
    }

    if (location.pathname !== targetPath) {
      skipViewUpdate.current = true
      navigate(targetPath)
    }
  }, [currentView, selectedProjectId])
}
