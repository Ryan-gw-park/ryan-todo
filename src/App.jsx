import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import useStore from './hooks/useStore'
import { useAlarmEngine } from './hooks/useAlarmEngine'
import { hasCreds, getDb } from './utils/supabase'
import './styles/global.css'

// 즉시 필요한 것만 정적 import
import SetupScreen from './components/shared/SetupScreen'
import LoginScreen from './components/shared/LoginScreen'
import TopNav from './components/layout/TopNav'
import MobileTopBar from './components/layout/MobileTopBar'
import FAB from './components/layout/FAB'
import Toast from './components/shared/Toast'
import { ViewSkeleton, LoadingSpinner } from './components/shared/Skeleton'
import { SyncProviderWrapper } from './sync/SyncContext'

// React.lazy 코드 스플리팅 — 뷰 컴포넌트 동적 import
const TodayView = lazy(() => import('./components/views/TodayView'))
const MatrixView = lazy(() => import('./components/views/MatrixView'))
const ProjectView = lazy(() => import('./components/views/ProjectView'))
const TimelineView = lazy(() => import('./components/views/TimelineView'))
const MemoryView = lazy(() => import('./components/views/MemoryView'))
const TeamMatrixView = lazy(() => import('./components/matrix/TeamMatrixView'))
const TeamSettings = lazy(() => import('./components/team/TeamSettings'))
const Onboarding = lazy(() => import('./components/team/Onboarding'))
const InviteAccept = lazy(() => import('./components/team/InviteAccept'))
const NotificationPanel = lazy(() => import('./components/shared/NotificationPanel'))
const DetailPanel = lazy(() => import('./components/shared/DetailPanel'))
const MyProfile = lazy(() => import('./components/shared/MyProfile'))
const ModeSelect = lazy(() => import('./components/team/ModeSelect'))
const ProjectManager = lazy(() => import('./components/shared/ProjectManager'))
const HelpPage = lazy(() => import('./components/shared/HelpPage'))

function isMobile() { return window.innerWidth < 768 }

// Main app shell
function AppShell({ mobile }) {
  const { currentView, setView, closeDetail, detailTask, showProjectMgr } = useStore()
  const showNotificationPanel = useStore(s => s.showNotificationPanel)

  // 뷰 초기화만 — loadAll은 App에서 이미 실행됨
  useEffect(() => {
    setView(mobile ? 'today' : 'matrix')
  }, [])

  // Idle 프리로드 — 첫 화면 후 유휴 시간에 다른 뷰 미리 로드
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000))
    idle(() => {
      import('./components/views/TodayView')
      import('./components/views/ProjectView')
      import('./components/views/TimelineView')
      import('./components/views/MemoryView')
    })
  }, [])

  // Keyboard shortcuts
  const VIEW_ORDER = ['today', 'matrix', 'project', 'timeline', 'memory']
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { closeDetail() }
      if (e.ctrlKey && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const idx = VIEW_ORDER.indexOf(currentView)
        if (idx === -1) return
        const next = e.key === 'ArrowLeft'
          ? (idx - 1 + VIEW_ORDER.length) % VIEW_ORDER.length
          : (idx + 1) % VIEW_ORDER.length
        setView(VIEW_ORDER[next])
        setTimeout(() => window.dispatchEvent(new Event('view-focus')), 100)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [currentView])

  // Loop-20: 팀 모드에서 매트릭스 뷰 분기
  const teamId = useStore(s => s.currentTeamId)
  const views = { today: TodayView, matrix: teamId ? TeamMatrixView : MatrixView, project: ProjectView, timeline: TimelineView, memory: MemoryView }
  const ViewComponent = views[currentView] || TodayView

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <TopNav />
      <MobileTopBar />

      <div style={{ paddingBottom: mobile ? 100 : 0 }}>
        <Suspense fallback={<ViewSkeleton />}>
          <ViewComponent />
        </Suspense>
      </div>

      <FAB />

      {detailTask && <Suspense fallback={null}><DetailPanel /></Suspense>}
      {showNotificationPanel && <Suspense fallback={null}><NotificationPanel /></Suspense>}
      {showProjectMgr && <Suspense fallback={null}><ProjectManager /></Suspense>}
      <Toast />
    </div>
  )
}

export default function App() {
  useAlarmEngine()
  const [connected, setConnected] = useState(hasCreds())
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { setUserName, userName, initTeamState, myTeams, currentTeamId, modeSelected, teamLoading, onboardingSkipped } = useStore()
  const [mobile, setMobile] = useState(isMobile())
  const location = useLocation()

  useEffect(() => {
    const handler = () => setMobile(isMobile())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const [authError, setAuthError] = useState('')

  // Auth state management
  useEffect(() => {
    if (!connected) { setAuthLoading(false); return }
    const supabase = getDb()
    if (!supabase) { setAuthLoading(false); return }

    // Check current session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) {
        const meta = s.user.user_metadata
        setUserName(meta?.full_name || meta?.name || s.user.email?.split('@')[0] || '')
      }
      setAuthLoading(false)
    })

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setAuthError('')
        setSession(s)
        if (s) {
          const meta = s.user.user_metadata
          setUserName(meta?.full_name || meta?.name || s.user.email?.split('@')[0] || '')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [connected])

  // Update browser tab title
  useEffect(() => {
    document.title = userName ? `${userName}'s Todo` : 'Todo'
  }, [userName])

  // Load team state + data when authenticated (병렬화: initTeamState 완료 후 loadAll)
  useEffect(() => {
    if (connected && session) {
      initTeamState().then(() => {
        useStore.getState().loadAll()
      })
    }
  }, [connected, session])

  // Step 1: Supabase connection setup
  if (!connected) {
    return <SetupScreen onConnect={() => setConnected(true)} />
  }

  // Step 2: Auth loading
  if (authLoading) {
    return <LoadingSpinner />
  }

  // Step 3: Login required — save invite path for post-login redirect
  if (!session) {
    if (location.pathname.startsWith('/invite/')) {
      sessionStorage.setItem('pendingInvite', location.pathname)
      localStorage.setItem('pendingInvite', location.pathname)
    }
    return <LoginScreen authError={authError} />
  }

  // Step 4: After login, redirect to pending invite if exists
  const pendingInvite = sessionStorage.getItem('pendingInvite') || localStorage.getItem('pendingInvite')
  if (pendingInvite) {
    sessionStorage.removeItem('pendingInvite')
    localStorage.removeItem('pendingInvite')
    return <Navigate to={pendingInvite} replace />
  }

  // Step 5: Wait for team state to load
  if (teamLoading) {
    return <LoadingSpinner />
  }

  // Step 6: Onboarding — no teams and not skipped
  if (myTeams.length === 0 && !onboardingSkipped && !location.pathname.startsWith('/invite') && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // Step 6.5: Mode select — has teams but none selected
  const specialRoutes = ['/invite', '/onboarding', '/profile', '/team/settings', '/mode-select', '/help']
  const isSpecialRoute = specialRoutes.some(r => location.pathname.startsWith(r))
  if (myTeams.length > 0 && !currentTeamId && !modeSelected && !isSpecialRoute && location.pathname !== '/mode-select') {
    return <Navigate to="/mode-select" replace />
  }

  // Step 7: Authenticated routes
  return (
    <Routes>
      <Route path="/onboarding" element={<Suspense fallback={<LoadingSpinner />}><Onboarding /></Suspense>} />
      <Route path="/mode-select" element={<Suspense fallback={<LoadingSpinner />}><ModeSelect /></Suspense>} />
      <Route path="/invite/:token" element={<Suspense fallback={<LoadingSpinner />}><InviteAccept /></Suspense>} />
      <Route path="/team/settings" element={<Suspense fallback={<LoadingSpinner />}><TeamSettings /></Suspense>} />
      <Route path="/profile" element={<Suspense fallback={<LoadingSpinner />}><MyProfile /></Suspense>} />
      <Route path="/help" element={<Suspense fallback={<LoadingSpinner />}><HelpPage /></Suspense>} />
      <Route path="/*" element={<SyncProviderWrapper><AppShell mobile={mobile} /></SyncProviderWrapper>} />
    </Routes>
  )
}
