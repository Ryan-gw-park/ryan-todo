import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import useStore from './hooks/useStore'
import { useAlarmEngine } from './hooks/useAlarmEngine'
import { hasCreds, getDb } from './utils/supabase'
import './styles/global.css'

// 즉시 필요한 것만 정적 import
import SetupScreen from './components/shared/SetupScreen'
import LoginScreen from './components/shared/LoginScreen'
import MobileTopBar from './components/layout/MobileTopBar'
import FAB from './components/layout/FAB'
import Toast from './components/shared/Toast'
import UpdateToast from './components/shared/UpdateToast'
import { ViewSkeleton, LoadingSpinner } from './components/shared/Skeleton'
import { SyncProviderWrapper } from './sync/SyncContext'
import Sidebar from './components/layout/Sidebar'

// React.lazy 코드 스플리팅 — 뷰 컴포넌트 동적 import
const TodayView = lazy(() => import('./components/views/TodayView'))
const AllTasksView = lazy(() => import('./components/views/AllTasksView'))
// MatrixView removed — replaced by UnifiedGridView
const ProjectView = lazy(() => import('./components/views/ProjectView'))
const TimelineView = lazy(() => import('./components/views/TimelineView'))
const InlineTimelineView = lazy(() => import('./components/views/InlineTimelineView'))
const MemoryView = lazy(() => import('./components/views/MemoryView'))
const UnifiedGridView = lazy(() => import('./components/views/UnifiedGridView'))
// PersonalTimelineView replaced by InlineTimelineView with scope="personal"
const ProjectLayer = lazy(() => import('./components/project/ProjectLayer'))
const TeamSettings = lazy(() => import('./components/team/TeamSettings'))
const Onboarding = lazy(() => import('./components/team/Onboarding'))
const InviteAccept = lazy(() => import('./components/team/InviteAccept'))
const NotificationPanel = lazy(() => import('./components/shared/NotificationPanel'))
const DetailPanel = lazy(() => import('./components/shared/DetailPanel'))
const MyProfile = lazy(() => import('./components/shared/MyProfile'))
const ModeSelect = lazy(() => import('./components/team/ModeSelect'))
const ProjectManager = lazy(() => import('./components/shared/ProjectManager'))
const HelpPage = lazy(() => import('./components/shared/HelpPage'))
const ModalRouter = lazy(() => import('./components/modals/ModalRouter'))

function isMobile() { return window.innerWidth < 768 }

// Main app shell
function AppShell({ mobile }) {
  const { currentView, setView, closeDetail, detailTask, showProjectMgr } = useStore()
  const showNotificationPanel = useStore(s => s.showNotificationPanel)

  // 뷰 초기화 — 'today'는 데이터 로딩 전에도 안전하게 렌더 가능
  useEffect(() => {
    setView('today')
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
  const VIEW_ORDER = ['today', 'allTasks', 'team-matrix', 'team-timeline', 'team-weekly', 'personal-matrix', 'personal-timeline', 'personal-weekly', 'memory']
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

  // Loop-39: 3-section sidebar view routing — team views always use team components
  const views = {
    today: TodayView, allTasks: AllTasksView, memory: MemoryView,
    'team-matrix': () => <UnifiedGridView initialView="matrix" initialScope="team" />,
    'team-timeline': InlineTimelineView,
    'team-weekly': () => <UnifiedGridView initialView="weekly" initialScope="team" />,
    'personal-matrix': () => <UnifiedGridView initialView="matrix" initialScope="personal" />,
    'personal-timeline': () => <InlineTimelineView scope="personal" />,
    'personal-weekly': () => <UnifiedGridView initialView="weekly" initialScope="personal" />,
    project: ProjectView, projectLayer: ProjectLayer,
  }
  const ViewComponent = views[currentView] || TodayView

  // 모바일에서 team/personal scope 뷰 접근 시 today로 리다이렉트
  useEffect(() => {
    if (mobile && (currentView.startsWith('team-') || currentView.startsWith('personal-'))) {
      setView('today')
    }
  }, [currentView, mobile])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fff' }}>
      {/* 사이드바 (데스크탑만) */}
      {!mobile && <Sidebar />}

      {/* 메인 영역 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 모바일 상단바 */}
        {mobile && <MobileTopBar />}

        {/* 뷰 컨텐츠 */}
        <div style={{ flex: 1, overflow: 'auto', paddingBottom: mobile ? 100 : 0 }}>
          <Suspense fallback={<ViewSkeleton />}>
            <ViewComponent />
          </Suspense>
        </div>
      </div>

      {/* 모바일 FAB */}
      {mobile && <FAB />}

      {/* 오버레이 패널들 */}
      {detailTask && <Suspense fallback={null}><DetailPanel /></Suspense>}
      {showNotificationPanel && <Suspense fallback={null}><NotificationPanel /></Suspense>}
      {showProjectMgr && <Suspense fallback={null}><ProjectManager /></Suspense>}
      <Suspense fallback={null}><ModalRouter /></Suspense>
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
  const snapshotRestored = useStore(s => s.snapshotRestored)
  const [mobile, setMobile] = useState(isMobile())
  const location = useLocation()

  useEffect(() => {
    const handler = () => setMobile(isMobile())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── iOS PWA 콜드 스타트 최적화: 마운트 즉시 스냅샷 복원 (Auth 전) ──
  useEffect(() => {
    useStore.getState().restoreSnapshot()
  }, [])

  const [authError, setAuthError] = useState('')
  const sessionRef = useRef(null)

  // Auth state management
  useEffect(() => {
    if (!connected) { setAuthLoading(false); return }
    const supabase = getDb()
    if (!supabase) { setAuthLoading(false); return }

    // Check current session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      sessionRef.current = s
      if (s) {
        const meta = s.user.user_metadata
        setUserName(meta?.full_name || meta?.name || s.user.email?.split('@')[0] || '')
      }
      setAuthLoading(false)
    })

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        setAuthError('')
        // TOKEN_REFRESHED: 토큰 갱신은 세션 참조만 조용히 업데이트
        // Supabase 클라이언트가 내부적으로 토큰을 관리하므로 React state 변경 불필요
        if (event === 'TOKEN_REFRESHED') {
          sessionRef.current = s
          return
        }
        // SIGNED_IN, SIGNED_OUT, USER_UPDATED 등은 기존대로 처리
        setSession(s)
        sessionRef.current = s
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

  // Load team state + data when authenticated (스냅샷은 이미 복원됨 → 백그라운드 갱신)
  // boolean 비교로 TOKEN_REFRESHED 시 불필요한 재실행 방지
  const isAuthenticated = !!session
  useEffect(() => {
    if (connected && isAuthenticated) {
      initTeamState().then(() => {
        // 스냅샷의 teamId와 실제 teamId가 다르면 스냅샷 데이터 무효화
        const { snapshotTeamId, snapshotRestored } = useStore.getState()
        const actualTeamId = useStore.getState().currentTeamId
        if (snapshotRestored && snapshotTeamId !== null && snapshotTeamId !== actualTeamId) {
          // teamId 불일치 → 스냅샷 데이터 비우고 loadAll()에서 다시 채움
          useStore.getState().setTasks([])
          useStore.getState().setProjects([])
          useStore.getState().setMemos([])
        }
        // 최신 데이터 로딩
        useStore.getState().loadAll()
      }).catch(err => {
        console.warn('[App] initTeamState/loadAll 실패:', err?.message || err)
        // AbortError 등으로 실패해도 앱은 진행 — 스냅샷 데이터로 표시
      })
    }
  }, [connected, isAuthenticated])

  // Auth 실패 시 스냅샷 화면에서 로그인으로 전환
  useEffect(() => {
    if (!authLoading && !session && snapshotRestored) {
      useStore.getState().clearSnapshot()
    }
  }, [authLoading, session, snapshotRestored])

  // ★ Fast path: invite 경로는 렌더 함수 최상단 — 모든 초기화 대기 없이 즉시 렌더
  // InviteAccept 내부에서 getDb()로 직접 Supabase 클라이언트를 가져오므로 connected 상태 불필요
  if (location.pathname.startsWith('/invite/')) {
    return (
      <>
        <UpdateToast />
        <Suspense fallback={<LoadingSpinner />}>
          <InviteAccept />
        </Suspense>
      </>
    )
  }

  // Step 1: Supabase connection setup
  if (!connected) {
    return <SetupScreen onConnect={() => setConnected(true)} />
  }

  // Step 2: 스냅샷이 복원되어 있으면 Auth/Team 로딩 중에도 AppShell 표시 (iOS PWA 최적화)
  // Auth 실패 시 위 useEffect에서 clearSnapshot() 호출 → snapshotRestored=false → 로그인 화면
  if (snapshotRestored) {
    return (
      <>
        <UpdateToast />
        <Routes>
          <Route path="/onboarding" element={<Suspense fallback={<LoadingSpinner />}><Onboarding /></Suspense>} />
          <Route path="/mode-select" element={<Suspense fallback={<LoadingSpinner />}><ModeSelect /></Suspense>} />
          <Route path="/invite/:token" element={<Suspense fallback={<LoadingSpinner />}><InviteAccept /></Suspense>} />
          <Route path="/team/settings" element={<Suspense fallback={<LoadingSpinner />}><TeamSettings /></Suspense>} />
          <Route path="/profile" element={<Suspense fallback={<LoadingSpinner />}><MyProfile /></Suspense>} />
          <Route path="/help" element={<Suspense fallback={<LoadingSpinner />}><HelpPage /></Suspense>} />
          <Route path="/*" element={<SyncProviderWrapper><AppShell mobile={mobile} /></SyncProviderWrapper>} />
        </Routes>
      </>
    )
  }

  // Step 3: Auth loading (스냅샷 없는 경우)
  if (authLoading) {
    return <LoadingSpinner />
  }

  // Step 4: Login required
  if (!session) {
    return <LoginScreen authError={authError} />
  }

  // Step 5: After login, redirect to pending invite if exists
  const pendingInvite = sessionStorage.getItem('pendingInvite') || localStorage.getItem('pendingInvite')
  if (pendingInvite) {
    sessionStorage.removeItem('pendingInvite')
    localStorage.removeItem('pendingInvite')
    return <Navigate to={pendingInvite} replace />
  }

  // Step 6: Wait for team state to load
  if (teamLoading) {
    return <LoadingSpinner />
  }

  // Step 7: Onboarding — no teams and not skipped
  if (myTeams.length === 0 && !onboardingSkipped && !location.pathname.startsWith('/invite') && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // Step 8: Mode select — has teams but none selected
  const specialRoutes = ['/invite', '/onboarding', '/profile', '/team/settings', '/mode-select', '/help']
  const isSpecialRoute = specialRoutes.some(r => location.pathname.startsWith(r))
  if (myTeams.length > 0 && !currentTeamId && !modeSelected && !isSpecialRoute && location.pathname !== '/mode-select') {
    return <Navigate to="/mode-select" replace />
  }

  // Step 9: Authenticated routes (스냅샷 없는 정상 흐름)
  return (
    <>
      <UpdateToast />
      <Routes>
        <Route path="/onboarding" element={<Suspense fallback={<LoadingSpinner />}><Onboarding /></Suspense>} />
        <Route path="/mode-select" element={<Suspense fallback={<LoadingSpinner />}><ModeSelect /></Suspense>} />
        <Route path="/invite/:token" element={<Suspense fallback={<LoadingSpinner />}><InviteAccept /></Suspense>} />
        <Route path="/team/settings" element={<Suspense fallback={<LoadingSpinner />}><TeamSettings /></Suspense>} />
        <Route path="/profile" element={<Suspense fallback={<LoadingSpinner />}><MyProfile /></Suspense>} />
        <Route path="/help" element={<Suspense fallback={<LoadingSpinner />}><HelpPage /></Suspense>} />
        <Route path="/*" element={<SyncProviderWrapper><AppShell mobile={mobile} /></SyncProviderWrapper>} />
      </Routes>
    </>
  )
}
