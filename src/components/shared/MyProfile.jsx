import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getDb } from '../../utils/supabase'

const T = {
  card: '#ffffff', cardBorder: '#e8e8e8', text: '#1a1a1a',
  textSub: '#888', textMuted: '#adb5bd', accent: '#2c5282',
  danger: '#c0392b',
}

const sectionStyle = {
  background: T.card, borderRadius: 10,
  border: `1px solid ${T.cardBorder}`, padding: 20, marginBottom: 12,
}

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 10, display: 'block',
}

const inputStyle = {
  border: `1px solid ${T.cardBorder}`, borderRadius: 4,
  padding: '6px 10px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}

function Avatar({ name, size = 30, isOwner }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: isOwner ? '#1a1a1a' : '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.4, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function RoleBadge({ role }) {
  const isOwner = role === 'owner'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
      background: isOwner ? '#E8F0FE' : '#f0f0f0',
      color: isOwner ? T.accent : '#666',
    }}>
      {isOwner ? '팀장' : '멤버'}
    </span>
  )
}

export default function MyProfile() {
  const navigate = useNavigate()
  const { userName, setUserName, logout } = useStore()
  const myTeams = useStore(s => s.myTeams)
  const [name, setName] = useState(userName || '')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [teamMembers, setTeamMembers] = useState({}) // { teamId: [members] }
  const [loadingTeams, setLoadingTeams] = useState(false)

  // 비밀번호 관련 상태
  const [hasGoogle, setHasGoogle] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    const d = getDb()
    if (!d) return
    d.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email)
      if (data?.user?.app_metadata) {
        const providers = data.user.app_metadata.providers || []
        setHasGoogle(providers.includes('google'))
        setHasPassword(providers.includes('email'))
      }
    })
  }, [])

  // Load members for all teams
  useEffect(() => {
    if (myTeams.length === 0) return
    setLoadingTeams(true)
    Promise.all(
      myTeams.map(async t => {
        const members = await useTeamMembers.getMembers(t.id)
        return [t.id, members]
      })
    ).then(results => {
      const map = {}
      results.forEach(([id, members]) => { map[id] = members })
      setTeamMembers(map)
      setLoadingTeams(false)
    })
  }, [myTeams])

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const d = getDb()
      if (d) {
        // Update Supabase auth user metadata
        await d.auth.updateUser({ data: { full_name: name.trim() } })
        // Update profiles table
        const { data: { user } } = await d.auth.getUser()
        if (user) {
          await d.from('profiles').update({ display_name: name.trim() }).eq('id', user.id)
        }
      }
      setUserName(name.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('[MyProfile] save error:', e)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSave = async () => {
    if (!newPw || newPw.length < 8) { setPwMsg('비밀번호는 최소 8자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { setPwMsg('비밀번호가 일치하지 않습니다.'); return }
    setPwSaving(true)
    setPwMsg('')
    const d = getDb()
    if (!d) { setPwSaving(false); return }
    const { error } = await d.auth.updateUser({ password: newPw })
    if (error) {
      setPwMsg('비밀번호 변경 실패: ' + error.message)
    } else {
      setPwMsg('비밀번호가 설정되었습니다.')
      setHasPassword(true)
      setShowPwForm(false)
      setNewPw('')
      setConfirmPw('')
    }
    setPwSaving(false)
    setTimeout(() => setPwMsg(''), 3000)
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header bar */}
      <div style={{ borderBottom: '1px solid #f0f0f0', background: 'white', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52 }}>
          <button onClick={() => navigate('/')} style={{ border: 'none', background: 'none', fontSize: 18, color: T.textMuted, cursor: 'pointer', padding: '4px 8px', marginRight: 8 }}>✕</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>내 정보</span>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
        {/* Profile section */}
        <div style={sectionStyle}>
          <label style={labelStyle}>프로필</label>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#1E293B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 700,
              fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
            }}>
              {name ? name[0].toUpperCase() : '?'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{name || '이름 없음'}</div>
              {email && <div style={{ fontSize: 13, color: T.textSub, marginTop: 2 }}>{email}</div>}
            </div>
          </div>

          {/* Name input */}
          <label style={{ ...labelStyle, marginBottom: 6 }}>이름</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="이름을 입력하세요"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name.trim() === userName}
              style={{
                padding: '6px 16px', borderRadius: 4, border: 'none',
                background: saved ? '#38A169' : '#37352f', color: '#fff',
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                cursor: saving || !name.trim() || name.trim() === userName ? 'not-allowed' : 'pointer',
                opacity: saving || !name.trim() || name.trim() === userName ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {saved ? '저장됨' : saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* Team section */}
        {myTeams.length > 0 && (
          <div style={sectionStyle}>
            <label style={labelStyle}>소속 팀</label>
            {loadingTeams ? (
              <div style={{ fontSize: 13, color: T.textMuted, padding: '8px 0' }}>로딩 중...</div>
            ) : (
              myTeams.map(team => {
                const members = teamMembers[team.id] || []
                const myMembership = members.find(m => m.email === email)
                const myRole = myMembership?.role || team.myRole || 'member'
                return (
                  <div key={team.id} style={{ marginBottom: myTeams.indexOf(team) < myTeams.length - 1 ? 16 : 0 }}>
                    {/* Team header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, background: '#37352f',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>
                        {team.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{team.name}</span>
                      <RoleBadge role={myRole} />
                    </div>

                    {/* Members list */}
                    <div style={{ background: '#fafafa', borderRadius: 6, padding: '6px 0' }}>
                      {members.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px' }}>
                          <Avatar name={m.displayName} size={24} isOwner={m.role === 'owner'} />
                          <span style={{ fontSize: 13, color: T.text, flex: 1 }}>{m.displayName}</span>
                          {m.role === 'owner' && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: T.accent, background: '#E8F0FE', padding: '1px 6px', borderRadius: 3 }}>팀장</span>
                          )}
                        </div>
                      ))}
                      {members.length === 0 && (
                        <div style={{ fontSize: 13, color: T.textMuted, padding: '6px 12px' }}>팀원 정보 없음</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* 보안 섹션 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>보안</label>

          {/* 로그인 방식 */}
          <div style={{ fontSize: 13, color: T.text, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: hasGoogle ? '#38A169' : T.textMuted }}>{hasGoogle ? '✓' : '✕'}</span>
              <span>Google 로그인</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: hasPassword ? '#38A169' : T.textMuted }}>{hasPassword ? '✓' : '✕'}</span>
              <span>이메일+비밀번호</span>
              {!hasPassword && <span style={{ fontSize: 11, color: T.danger }}>(미설정)</span>}
            </div>
          </div>

          {pwMsg && (
            <div style={{ padding: '6px 10px', borderRadius: 4, fontSize: 12, marginBottom: 10, background: pwMsg.includes('실패') ? '#fee' : '#efffef', color: pwMsg.includes('실패') ? T.danger : '#2d7a2d' }}>
              {pwMsg}
            </div>
          )}

          {!showPwForm ? (
            <button onClick={() => setShowPwForm(true)} style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 500, borderRadius: 4,
              border: `1px solid ${T.cardBorder}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: T.text,
            }}>
              {hasPassword ? '비밀번호 변경' : '비밀번호 설정'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="password" placeholder="새 비밀번호 (8자 이상)"
                value={newPw} onChange={e => setNewPw(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              />
              <input
                type="password" placeholder="비밀번호 확인"
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePasswordSave() }}
                style={{ ...inputStyle, width: '100%' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handlePasswordSave} disabled={pwSaving} style={{
                  padding: '6px 16px', fontSize: 12, fontWeight: 500, borderRadius: 4,
                  border: 'none', background: T.text, color: '#fff', cursor: 'pointer',
                  fontFamily: 'inherit', opacity: pwSaving ? 0.5 : 1,
                }}>{pwSaving ? '저장 중...' : '저장'}</button>
                <button onClick={() => { setShowPwForm(false); setNewPw(''); setConfirmPw(''); setPwMsg('') }} style={{
                  padding: '6px 16px', fontSize: 12, borderRadius: 4,
                  border: `1px solid ${T.cardBorder}`, background: '#fff', cursor: 'pointer',
                  fontFamily: 'inherit', color: T.textSub,
                }}>취소</button>
              </div>
            </div>
          )}
        </div>

        {/* Logout section */}
        <div style={sectionStyle}>
          <label style={labelStyle}>계정</label>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 20px', borderRadius: 6,
              border: `1px solid ${T.cardBorder}`, background: '#fff',
              cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              color: T.danger, fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = T.danger }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = T.cardBorder }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
