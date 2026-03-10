import { useEffect, useState } from 'react'
import useStore from './hooks/useStore'
import { hasCreds, getDb } from './utils/supabase'
import './styles/global.css'

import SetupScreen from './components/shared/SetupScreen'
import LoginScreen from './components/shared/LoginScreen'
import TopNav from './components/layout/TopNav'
import MobileTopBar from './components/layout/MobileTopBar'
import BottomNav from './components/layout/BottomNav'
import FAB from './components/layout/FAB'
import TodayView from './components/views/TodayView'
import MatrixView from './components/views/MatrixView'
import ProjectView from './components/views/ProjectView'
import TimelineView from './components/views/TimelineView'
import MemoryView from './components/views/MemoryView'
import DetailPanel from './components/shared/DetailPanel'
import ProjectManager from './components/shared/ProjectManager'
import Toast from './components/shared/Toast'

function isMobile() { return window.innerWidth < 768 }

export default function App() {
  const [connected, setConnected] = useState(hasCreds())
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { currentView, setView, loadAll, closeDetail, detailTask, showProjectMgr } = useStore()
  const [mobile, setMobile] = useState(isMobile())

  useEffect(() => {
    const handler = () => setMobile(isMobile())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Auth state management
  useEffect(() => {
    if (!connected) { setAuthLoading(false); return }
    const supabase = getDb()
    if (!supabase) { setAuthLoading(false); return }

    // Check current session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setAuthLoading(false)
    })

    // Subscribe to auth changes (magic link callback, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s)
      }
    )

    return () => subscription.unsubscribe()
  }, [connected])

  // Load data when authenticated
  useEffect(() => {
    if (connected && session) {
      setView(mobile ? 'today' : 'matrix')
      loadAll()
      const interval = setInterval(loadAll, 60000)
      return () => clearInterval(interval)
    }
  }, [connected, session])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { closeDetail() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Step 1: Supabase connection setup
  if (!connected) {
    return <SetupScreen onConnect={() => setConnected(true)} />
  }

  // Step 2: Auth loading
  if (authLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#37352f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>R</div>
          <span style={{ fontSize: 14, color: '#999' }}>로딩 중...</span>
        </div>
      </div>
    )
  }

  // Step 3: Login required
  if (!session) {
    return <LoginScreen />
  }

  // Step 4: Main app
  const views = { today: TodayView, matrix: MatrixView, project: ProjectView, timeline: TimelineView, memory: MemoryView }
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
