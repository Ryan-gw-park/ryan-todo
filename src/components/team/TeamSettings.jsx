import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import useTeam from '../../hooks/useTeam'
import useTeamMembers from '../../hooks/useTeamMembers'
import useInvitation from '../../hooks/useInvitation'

const T = {
  card: '#ffffff', cardBorder: '#e8e8e8', text: '#1a1a1a',
  textSub: '#888', textMuted: '#adb5bd', accent: '#2c5282',
  border: '#f0f0f0', danger: '#c0392b',
}

const inputStyle = {
  border: `1px solid ${T.cardBorder}`, borderRadius: 4,
  padding: '6px 10px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}

const sectionStyle = {
  background: T.card, borderRadius: 10,
  border: `1px solid ${T.cardBorder}`, padding: 20, marginBottom: 12,
}

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 10, display: 'block',
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

function Badge({ children, primary }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
      background: primary ? '#E8F0FE' : '#f0f0f0',
      color: primary ? T.accent : '#666',
    }}>
      {children}
    </span>
  )
}

export default function TeamSettings() {
  const navigate = useNavigate()
  const { currentTeamId, myTeams, myRole, initTeamState } = useStore()

  const team = myTeams.find(t => t.id === currentTeamId)
  const isOwner = myRole === 'owner'

  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [autoApprove, setAutoApprove] = useState(true)
  const [members, setMembers] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  // Init form values from team
  useEffect(() => {
    if (team) {
      setTeamName(team.name || '')
      setTeamDesc(team.description || '')
      setAutoApprove(team.autoApprove !== false)
    }
  }, [team])

  // Load members + pending
  const loadData = useCallback(async () => {
    if (!currentTeamId) return
    const [m, p] = await Promise.all([
      useTeamMembers.getMembers(currentTeamId),
      useInvitation.getPendingRequests(currentTeamId),
    ])
    setMembers(m)
    setPendingRequests(p)
  }, [currentTeamId])

  useEffect(() => { loadData() }, [loadData])

  // No team selected
  if (!team) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', fontFamily: "'Noto Sans KR', 'Inter', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: T.textSub, fontSize: 14 }}>선택된 팀이 없습니다.</p>
          <button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '8px 20px', border: `1px solid ${T.cardBorder}`, borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>홈으로</button>
        </div>
      </div>
    )
  }

  // Handlers
  const handleSaveInfo = async () => {
    if (!teamName.trim()) return
    setLoading(true)
    const ok = await useTeam.updateTeam(currentTeamId, { name: teamName.trim(), description: teamDesc.trim() })
    if (ok) { setMsg('저장되었습니다.'); await initTeamState() }
    else setMsg('저장에 실패했습니다.')
    setLoading(false)
    setTimeout(() => setMsg(''), 2000)
  }

  const handleToggleAutoApprove = async () => {
    const next = !autoApprove
    setAutoApprove(next)
    await useTeam.updateTeam(currentTeamId, { auto_approve: next })
    await initTeamState()
  }

  const handleGrantOwner = async (userId) => {
    if (!confirm('이 팀원에게 팀장 권한을 부여하시겠습니까?')) return
    await useTeamMembers.grantOwner(currentTeamId, userId)
    await loadData()
    await initTeamState()
  }

  const handleRevokeOwner = async (userId) => {
    const ok = await useTeamMembers.revokeOwner(currentTeamId, userId)
    if (!ok) { setMsg('팀장이 최소 1명 필요합니다.'); setTimeout(() => setMsg(''), 2000) }
    else { await loadData(); await initTeamState() }
  }

  const handleRemoveMember = async (userId) => {
    if (!confirm('이 팀원을 내보내시겠습니까?')) return
    await useTeamMembers.removeMember(currentTeamId, userId)
    await loadData()
  }

  const handleInviteEmail = async () => {
    if (!inviteEmail.trim()) return
    setLoading(true)
    const ok = await useInvitation.sendEmailInvite(currentTeamId, inviteEmail.trim())
    if (ok) { setMsg('초대를 보냈습니다.'); setInviteEmail('') }
    else setMsg('초대 실패')
    setLoading(false)
    setTimeout(() => setMsg(''), 2000)
  }

  const handleCopyLink = async () => {
    let link = inviteLink
    if (!link) {
      link = await useInvitation.createInviteLink(currentTeamId)
      if (link) setInviteLink(link)
    }
    if (link) {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleApprove = async (memberId) => {
    await useInvitation.approveRequest(memberId)
    await loadData()
  }

  const handleReject = async (memberId) => {
    await useInvitation.rejectRequest(memberId)
    await loadData()
  }

  const handleDeleteTeam = async () => {
    if (!confirm(`정말 "${team.name}" 팀을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return
    setLoading(true)
    const ok = await useTeam.deleteTeam(currentTeamId)
    if (ok) {
      await initTeamState()
      navigate('/', { replace: true })
    } else {
      setMsg('삭제 실패')
      setLoading(false)
      setTimeout(() => setMsg(''), 2000)
    }
  }

  const ownerCount = members.filter(m => m.role === 'owner').length

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#f9f9f9', overflow: 'auto',
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 24px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>팀 설정</h2>
          <button onClick={() => navigate('/')} style={{ border: 'none', background: 'none', fontSize: 18, color: T.textMuted, cursor: 'pointer' }}>✕</button>
        </div>

        {msg && <div style={{ padding: '8px 12px', borderRadius: 6, background: msg.includes('실패') ? '#fee' : '#efffef', color: msg.includes('실패') ? T.danger : '#2d7a2d', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

        {/* 팀 정보 */}
        <div style={sectionStyle}>
          <span style={labelStyle}>팀 정보</span>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '10px 12px', fontSize: 13, alignItems: 'center' }}>
            <span style={{ color: T.textSub }}>팀 이름</span>
            <input value={teamName} onChange={e => setTeamName(e.target.value)} disabled={!isOwner} style={{ ...inputStyle, width: '100%' }} />
            <span style={{ color: T.textSub }}>설명</span>
            <input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} disabled={!isOwner} style={{ ...inputStyle, width: '100%' }} />
          </div>
          {isOwner && (
            <button onClick={handleSaveInfo} disabled={loading || !teamName.trim()} style={{
              marginTop: 12, padding: '6px 16px', fontSize: 12, fontWeight: 500,
              borderRadius: 4, border: 'none', background: T.text, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', opacity: (loading || !teamName.trim()) ? 0.5 : 1,
            }}>저장</button>
          )}
        </div>

        {/* 팀원 목록 */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={labelStyle}>팀원 ({members.length}명)</span>
          </div>
          {members.map((m, i) => (
            <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < members.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <Avatar name={m.displayName} isOwner={m.role === 'owner'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{m.displayName}</div>
                {m.email && <div style={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
              </div>
              <Badge primary={m.role === 'owner'}>{m.role === 'owner' ? '팀장' : '팀원'}</Badge>
              {isOwner && m.role === 'owner' && ownerCount > 1 && (
                <span onClick={() => handleRevokeOwner(m.userId)} style={{ fontSize: 11, color: T.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' }}>권한 해제</span>
              )}
              {isOwner && m.role !== 'owner' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span onClick={() => handleGrantOwner(m.userId)} style={{ fontSize: 11, color: T.accent, cursor: 'pointer', whiteSpace: 'nowrap' }}>팀장 부여</span>
                  <span onClick={() => handleRemoveMember(m.userId)} style={{ fontSize: 11, color: T.danger, cursor: 'pointer', whiteSpace: 'nowrap' }}>내보내기</span>
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && <p style={{ fontSize: 13, color: T.textMuted }}>팀원이 없습니다.</p>}
        </div>

        {/* 초대 */}
        {isOwner && (
          <div style={sectionStyle}>
            <span style={labelStyle}>초대</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                placeholder="이메일 주소"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInviteEmail()}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={handleInviteEmail} disabled={loading || !inviteEmail.trim()} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 4,
                border: 'none', background: T.text, color: '#fff', cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: (loading || !inviteEmail.trim()) ? 0.5 : 1,
              }}>초대</button>
            </div>
            <button onClick={handleCopyLink} style={{
              padding: '6px 14px', fontSize: 12, borderRadius: 4,
              border: `1px solid ${T.cardBorder}`, background: '#fff', cursor: 'pointer',
              fontFamily: 'inherit', color: T.textSub,
            }}>{copied ? '복사됨!' : '초대 링크 복사'}</button>
          </div>
        )}

        {/* 승인 대기 */}
        {isOwner && !autoApprove && pendingRequests.length > 0 && (
          <div style={sectionStyle}>
            <span style={labelStyle}>승인 대기 ({pendingRequests.length}명)</span>
            {pendingRequests.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < pendingRequests.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <Avatar name={r.displayName} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.displayName}</div>
                  {r.email && <div style={{ fontSize: 11, color: T.textMuted }}>{r.email}</div>}
                </div>
                <span onClick={() => handleApprove(r.id)} style={{ fontSize: 12, color: T.accent, cursor: 'pointer', fontWeight: 500 }}>승인</span>
                <span onClick={() => handleReject(r.id)} style={{ fontSize: 12, color: T.danger, cursor: 'pointer' }}>거절</span>
              </div>
            ))}
          </div>
        )}

        {/* 설정 */}
        {isOwner && (
          <div style={sectionStyle}>
            <span style={labelStyle}>설정</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>가입 승인 모드</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>비활성화 시 초대 수락만으로 바로 가입</div>
              </div>
              <div
                onClick={handleToggleAutoApprove}
                style={{
                  width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative',
                  background: !autoApprove ? T.accent : '#ccc', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 2, transition: 'left 0.2s',
                  left: !autoApprove ? 18 : 2,
                }} />
              </div>
            </div>
          </div>
        )}

        {/* 팀 삭제 */}
        {isOwner && (
          <div style={{ ...sectionStyle, borderColor: '#f5d5d5' }}>
            <span style={{ ...labelStyle, color: T.danger }}>위험 구역</span>
            <button onClick={handleDeleteTeam} disabled={loading} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6,
              border: `1px solid ${T.danger}`, background: '#fff', color: T.danger,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>팀 삭제</button>
          </div>
        )}
      </div>
    </div>
  )
}
