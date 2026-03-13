import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import useTeam from '../../hooks/useTeam'
import useInvitation from '../../hooks/useInvitation'

const T = {
  card: '#ffffff', cardBorder: '#e8e8e8', text: '#1a1a1a',
  textSub: '#888', textMuted: '#adb5bd', accent: '#2c5282',
}

const inputStyle = {
  width: '100%', padding: '10px 12px', border: `1px solid ${T.cardBorder}`,
  borderRadius: 6, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none',
}

const btnStyle = {
  padding: '12px', width: '100%', fontSize: 14, fontWeight: 500,
  borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { skipOnboarding, initTeamState, myTeams, setTeam } = useStore()
  const [step, setStep] = useState(0)
  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [allTeams, setAllTeams] = useState(myTeams || [])
  const [pendingInvite, setPendingInvite] = useState(null) // { token, teamName, teamDesc }

  // Refresh team list on mount (in case teams were loaded after initial render)
  useEffect(() => {
    useTeam.getMyTeams().then(teams => {
      if (teams.length > 0) setAllTeams(teams)
    })
  }, [])

  // Check for pending invite token
  useEffect(() => {
    const saved = localStorage.getItem('pendingInvite') || sessionStorage.getItem('pendingInvite')
    if (!saved) return
    const token = saved.split('/').pop()
    if (!token) return
    useInvitation.getTeamByInvite(token).then(info => {
      if (info) setPendingInvite({ token, name: info.name, description: info.description })
    })
  }, [])

  const handleSelectTeam = (teamId) => {
    setTeam(teamId)
    navigate('/', { replace: true })
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return
    setError('')
    setLoading(true)
    const team = await useTeam.createTeam(teamName.trim(), teamDesc.trim())
    if (team) {
      await initTeamState()
      navigate('/', { replace: true })
    } else {
      setError('팀 생성에 실패했습니다.')
    }
    setLoading(false)
  }

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) return
    setError('')
    // Extract token from URL or raw code
    const token = inviteCode.trim().split('/').pop()
    navigate(`/invite/${token}`, { replace: true })
  }

  const handleSkip = () => {
    skipOnboarding()
    navigate('/', { replace: true })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 24px' }}>
        {/* Step 0: 메인 선택 */}
        {step === 0 && (
          <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: '40px 32px', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: '#37352f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 22, fontWeight: 700, margin: '0 auto 12px',
            }}>R</div>

            {/* Pending invite: show invited team prominently */}
            {pendingInvite ? (
              <>
                <h2 style={{ margin: '12px 0 6px', fontSize: 22, fontWeight: 800, color: T.text }}>
                  팀에 초대되었습니다
                </h2>
                <p style={{ color: T.textSub, fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>
                  아래 팀에 참가하여 함께 시작하세요.
                </p>

                <div style={{
                  padding: '20px', borderRadius: 10, border: `2px solid ${T.text}`,
                  background: '#fafafa', marginBottom: 24,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: '#37352f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 18, fontWeight: 700, margin: '0 auto 10px',
                  }}>{(pendingInvite.name || 'T')[0].toUpperCase()}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{pendingInvite.name}</div>
                  {pendingInvite.description && (
                    <div style={{ fontSize: 13, color: T.textSub, marginTop: 4 }}>{pendingInvite.description}</div>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/invite/${pendingInvite.token}`, { replace: true })}
                  style={{ ...btnStyle, background: T.text, color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 16 }}
                >
                  {pendingInvite.name} 팀 참가하기
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{ ...btnStyle, background: 'transparent', color: T.textMuted, border: 'none', fontSize: 13, fontWeight: 400 }}
                  >
                    새 팀 만들기
                  </button>
                  <span
                    onClick={handleSkip}
                    style={{ fontSize: 12, color: T.textMuted, cursor: 'pointer', opacity: 0.7 }}
                  >
                    개인 할일만 사용할게요 →
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: '12px 0 6px', fontSize: 22, fontWeight: 800, color: T.text }}>
                  Ryan's Todo에 오신 걸 환영합니다
                </h2>
                <p style={{ color: T.textSub, fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>
                  팀과 함께 할일을 관리하거나, 개인 할일만 사용할 수 있어요.
                </p>
                {/* 기존 팀 목록 */}
                {allTeams.length > 0 && (
                  <div style={{ marginBottom: 20, textAlign: 'left' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>내 팀</span>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {allTeams.map(t => (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTeam(t.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 8,
                            border: `1px solid ${T.cardBorder}`, cursor: 'pointer',
                            background: '#fff', transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, background: '#37352f',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
                          }}>{(t.name || 'T')[0].toUpperCase()}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{t.name}</div>
                            {t.description && <div style={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                          </div>
                          <span style={{ fontSize: 12, color: T.textMuted }}>→</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{ ...btnStyle, background: T.text, color: '#fff' }}
                  >
                    새 팀 만들기
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    style={{ ...btnStyle, background: '#fff', color: T.text, border: `1px solid ${T.cardBorder}` }}
                  >
                    초대 코드로 팀 참가
                  </button>
                  <span
                    onClick={handleSkip}
                    style={{ marginTop: 8, fontSize: 13, color: T.textMuted, cursor: 'pointer' }}
                  >
                    개인 할일만 사용할게요 →
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 1: 팀 만들기 */}
        {step === 1 && (
          <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: 32 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: T.text }}>새 팀 만들기</h3>
            <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>팀 이름</label>
            <input
              placeholder="예: 법무팀"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
              style={{ ...inputStyle, marginTop: 4, marginBottom: 16 }}
            />
            <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>팀 설명 (선택)</label>
            <input
              placeholder="팀에 대한 간단한 설명"
              value={teamDesc}
              onChange={e => setTeamDesc(e.target.value)}
              style={{ ...inputStyle, marginTop: 4, marginBottom: 20 }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep(0); setError('') }} style={{ ...btnStyle, flex: 1, background: '#fff', color: T.text, border: `1px solid ${T.cardBorder}` }}>뒤로</button>
              <button
                onClick={handleCreateTeam}
                disabled={loading || !teamName.trim()}
                style={{ ...btnStyle, flex: 1, background: T.text, color: '#fff', opacity: (loading || !teamName.trim()) ? 0.6 : 1 }}
              >
                {loading ? '생성 중...' : '팀 생성'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 초대 코드로 참가 */}
        {step === 2 && (
          <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: 32 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: T.text }}>팀에 참가하기</h3>
            <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>초대 코드 또는 링크</label>
            <input
              placeholder="초대 코드를 입력하세요"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoinTeam()}
              style={{ ...inputStyle, marginTop: 4, marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep(0); setError('') }} style={{ ...btnStyle, flex: 1, background: '#fff', color: T.text, border: `1px solid ${T.cardBorder}` }}>뒤로</button>
              <button
                onClick={handleJoinTeam}
                disabled={!inviteCode.trim()}
                style={{ ...btnStyle, flex: 1, background: T.text, color: '#fff', opacity: !inviteCode.trim() ? 0.6 : 1 }}
              >
                참가 요청
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
