import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import useInvitation from '../../hooks/useInvitation'
import useTeam from '../../hooks/useTeam'
import { getDb } from '../../utils/supabase'
import AuthForm from '../auth/AuthForm'

const T = {
  card: '#ffffff', cardBorder: '#e8e8e8', text: '#1a1a1a',
  textSub: '#888', textMuted: '#adb5bd', accent: '#2c5282',
}

const btnStyle = {
  padding: '12px', width: '100%', fontSize: 14, fontWeight: 500,
  borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
}

export default function InviteAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { userName, initTeamState } = useStore()

  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [teamInfo, setTeamInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [result, setResult] = useState(null)
  const [displayName, setDisplayName] = useState('')

  // Track auth state
  useEffect(() => {
    const supabase = getDb()
    if (!supabase) { setAuthReady(true); return }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load team info — only when logged in (anon can't read teams due to RLS)
  useEffect(() => {
    if (!token || !authReady) return
    if (!session) {
      setLoading(false)
      return
    }
    setLoading(true)
    useInvitation.getTeamByInvite(token).then(info => {
      setTeamInfo(info)
      setLoading(false)
    })
  }, [token, session, authReady])

  // Timeout fallback — prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) setLoading(false)
    }, 10000)
    return () => clearTimeout(timeout)
  }, [loading])

  // Pre-fill display name
  useEffect(() => {
    if (userName) setDisplayName(userName)
  }, [userName])

  // Auto-accept when session becomes available and team info is loaded
  useEffect(() => {
    if (session && teamInfo && !result && !accepting) {
      // Pre-fill from session user if not set
      if (!displayName) {
        const meta = session.user?.user_metadata
        const name = meta?.full_name || meta?.name || session.user?.email?.split('@')[0] || ''
        if (name) setDisplayName(name)
      }
    }
  }, [session, teamInfo])

  const handleAccept = async () => {
    setAccepting(true)
    const res = await useInvitation.acceptInvite(token, displayName.trim() || undefined)
    setResult(res)
    if (res.success) {
      await useTeam.createInitialPersonalData()
      await initTeamState()
      if (res.teamId) {
        useStore.getState().setTeam(res.teamId)
      }
    }
    setAccepting(false)
  }

  const handleDecline = async () => {
    await useInvitation.declineInvite(token)
    navigate('/', { replace: true })
  }

  const handleGoHome = () => navigate('/', { replace: true })

  const pageStyle = {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'white',
    fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
  }

  const cardStyle = {
    background: T.card, borderRadius: 12, border: `1px solid ${T.cardBorder}`,
    padding: '40px 32px', textAlign: 'center',
  }

  // Loading
  if (loading || !authReady) {
    return (
      <div style={pageStyle}>
        <span style={{ fontSize: 14, color: '#999' }}>초대 정보를 확인하는 중...</span>
      </div>
    )
  }

  // Not logged in — show auth form (no team query, RLS blocks anon)
  if (!session) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 400, width: '100%', padding: '0 24px' }}>
          <div style={cardStyle}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: '#37352f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 22, fontWeight: 700, margin: '0 auto 16px',
            }}>R</div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: T.text }}>초대 링크가 확인되었습니다</h3>
            <p style={{ color: T.textSub, fontSize: 13, margin: '0 0 20px' }}>
              팀에 참가하려면 로그인이 필요합니다
            </p>

            <AuthForm
              redirectTo={window.location.href}
            />
          </div>
        </div>
      </div>
    )
  }

  // Invalid token (logged in but team not found)
  if (!teamInfo) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 400, width: '100%', padding: '0 24px' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>😕</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: T.text }}>유효하지 않은 초대</h3>
            <p style={{ color: T.textSub, fontSize: 14, margin: '0 0 24px' }}>초대 링크가 만료되었거나 유효하지 않습니다.</p>
            <button onClick={handleGoHome} style={{ ...btnStyle, background: T.text, color: '#fff' }}>홈으로</button>
          </div>
        </div>
      </div>
    )
  }

  // Result screen
  if (result) {
    const isPending = result.pending
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 400, width: '100%', padding: '0 24px' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{result.success ? (isPending ? '⏳' : '🎉') : '❌'}</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: T.text }}>
              {result.success
                ? (isPending ? '승인 대기 중' : '팀에 참가했습니다!')
                : '참가 실패'}
            </h3>
            <p style={{ color: T.textSub, fontSize: 14, margin: '0 0 24px' }}>
              {result.message || (result.success ? `${teamInfo.name} 팀에 참가했습니다.` : result.error)}
            </p>
            <button onClick={handleGoHome} style={{ ...btnStyle, background: T.text, color: '#fff' }}>
              {result.success && !isPending ? '시작하기' : '홈으로'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Logged in — accept screen
  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 24px' }}>
        <div style={cardStyle}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: '#37352f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 22, fontWeight: 700, margin: '0 auto 16px',
          }}>{(teamInfo.name || 'T')[0].toUpperCase()}</div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: T.text }}>{teamInfo.name}</h3>
          {teamInfo.description && <p style={{ color: T.textSub, fontSize: 13, margin: '0 0 20px' }}>{teamInfo.description}</p>}
          {!teamInfo.description && <div style={{ marginBottom: 20 }} />}

          <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600, textAlign: 'left', display: 'block', marginBottom: 4 }}>표시 이름</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="팀에서 사용할 이름"
            style={{
              width: '100%', padding: '10px 12px', border: `1px solid ${T.cardBorder}`,
              borderRadius: 6, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
              outline: 'none', marginBottom: 20, textAlign: 'center',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={handleAccept} disabled={accepting} style={{ ...btnStyle, background: T.text, color: '#fff', opacity: accepting ? 0.6 : 1 }}>
              {accepting ? '참가 중...' : '팀 참가하기'}
            </button>
            <button onClick={handleDecline} style={{ ...btnStyle, background: '#fff', color: T.text, border: `1px solid ${T.cardBorder}` }}>
              거절
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
