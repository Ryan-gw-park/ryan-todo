import { useEffect, useState } from 'react'
import useStore from './hooks/useStore'
import { hasCreds } from './utils/supabase'
import './styles/global.css'

import SetupScreen from './components/shared/SetupScreen'
import TopNav from './components/layout/TopNav'
import MobileTopBar from './components/layout/MobileTopBar'
import BottomNav from './components/layout/BottomNav'
import FAB from './components/layout/FAB'
import TodayView from './components/views/TodayView'
import MatrixView from './components/views/MatrixView'
import ProjectView from './components/views/ProjectView'
import TimelineView from './components/views/TimelineView'
import DetailPanel from './components/shared/DetailPanel'
import ProjectManager from './components/shared/ProjectManager'
import Toast from './components/shared/Toast'

function isMobile() { return window.innerWidth < 768 }

export default function App() {
  const [connected, setConnected] = useState(hasCreds())
  const { currentView, setView, loadAll, closeDetail, detailTask, showProjectMgr } = useStore()
  const [mobile, setMobile] = useState(isMobile())

  useEffect(() => {
    const handler = () => setMobile(isMobile())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (connected) {
      setView(mobile ? 'today' : 'matrix')
      loadAll()
      const interval = setInterval(loadAll, 60000)
      return () => clearInterval(interval)
    }
  }, [connected])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { closeDetail() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (!connected) {
    return <SetupScreen onConnect={() => setConnected(true)} />
  }

  const views = { today: TodayView, matrix: MatrixView, project: ProjectView, timeline: TimelineView }
  const ViewComponent = views[currentView] || TodayView

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <TopNav />
      <MobileTopBar />

      <div style={{ paddingBottom: mobile ? 100 : 0 }}>
        <ViewComponent />
      </div>

      <BottomNav />
      <FAB />

      {detailTask && <DetailPanel />}
      {showProjectMgr && <ProjectManager />}
      <Toast />
    </div>
  )
}
