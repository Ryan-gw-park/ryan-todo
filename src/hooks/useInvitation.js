import { getDb } from '../utils/supabase'

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

function generateCode() {
  return Math.random().toString(36).slice(2, 10)
}

const useInvitation = {
  /** 초대 링크 생성 — teams.invite_code에 저장 + URL 반환 */
  async createInviteLink(teamId) {
    const d = db()
    if (!d) return null

    // 기존 invite_code 확인
    const { data: team } = await d.from('teams').select('invite_code').eq('id', teamId).single()
    let code = team?.invite_code

    if (!code) {
      code = generateCode()
      const { error } = await d.from('teams').update({ invite_code: code }).eq('id', teamId)
      if (error) { console.error('[Ryan Todo] createInviteLink:', error); return null }
    }

    return `${window.location.origin}/invite/${code}`
  },

  /** 이메일 초대 발송 — invite_code 확보 + Supabase Magic Link로 발송 */
  async sendEmailInvite(teamId, email) {
    const d = db()
    if (!d) return false
    const { data: { user } } = await d.auth.getUser()
    if (!user) return false

    // invite_code 확보 (없으면 생성)
    const { data: team } = await d.from('teams').select('invite_code').eq('id', teamId).single()
    let code = team?.invite_code
    if (!code) {
      code = generateCode()
      const { error } = await d.from('teams').update({ invite_code: code }).eq('id', teamId)
      if (error) { console.error('[Ryan Todo] sendEmailInvite invite_code:', error); return false }
    }

    // Magic Link 발송 — 인증 후 /invite/{code}로 리다이렉트
    const inviteUrl = `${window.location.origin}/invite/${code}`
    const { error: otpError } = await d.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: inviteUrl },
    })

    if (otpError) { console.error('[Ryan Todo] sendEmailInvite:', otpError); return false }
    return true
  },

  /** 초대 수락 — invite_code 또는 invitation token으로 팀 찾기 + 가입 */
  async acceptInvite(token, displayName) {
    const d = db()
    if (!d) return { success: false, error: '연결 실패' }
    const { data: { user } } = await d.auth.getUser()
    if (!user) return { success: false, error: '인증 필요' }

    // 1. invite_code로 팀 찾기 (초대 링크)
    let teamId = null
    let autoApprove = true

    const { data: teamByCode } = await d
      .from('teams')
      .select('id, auto_approve')
      .eq('invite_code', token)
      .single()

    if (teamByCode) {
      teamId = teamByCode.id
      autoApprove = teamByCode.auto_approve
    } else {
      // 2. invitation token으로 찾기 (이메일 초대)
      const { data: invitation } = await d
        .from('team_invitations')
        .select('id, team_id, status, teams(auto_approve)')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (!invitation) return { success: false, error: '유효하지 않은 초대입니다.' }

      teamId = invitation.team_id
      autoApprove = invitation.teams?.auto_approve ?? true

      // 초대 상태 업데이트
      await d.from('team_invitations').update({ status: 'accepted' }).eq('id', invitation.id)
    }

    // 3. 이미 멤버인지 확인
    const { data: existing } = await d
      .from('team_members')
      .select('id, status')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      if (existing.status === 'active') return { success: true, teamId, message: '이미 팀에 소속되어 있습니다.' }
      // pending → active
      if (autoApprove) {
        await d.from('team_members').update({ status: 'active', display_name: displayName || undefined }).eq('id', existing.id)
        return { success: true, teamId }
      }
      return { success: true, teamId, pending: true, message: '승인 대기 중입니다.' }
    }

    // 4. team_members INSERT
    const { error } = await d.from('team_members').insert({
      team_id: teamId,
      user_id: user.id,
      role: 'member',
      status: autoApprove ? 'active' : 'pending',
      display_name: displayName || user.email?.split('@')[0] || '',
      joined_at: new Date().toISOString(),
    })

    if (error) { console.error('[Ryan Todo] acceptInvite:', error); return { success: false, error: error.message } }

    if (!autoApprove) return { success: true, teamId, pending: true, message: '팀장의 승인을 기다리고 있습니다.' }
    return { success: true, teamId }
  },

  /** 초대 거절 */
  async declineInvite(token) {
    const d = db()
    if (!d) return false
    const { error } = await d.from('team_invitations').update({ status: 'declined' }).eq('token', token)
    if (error) { console.error('[Ryan Todo] declineInvite:', error); return false }
    return true
  },

  /** 승인 대기 목록 (owner만) */
  async getPendingRequests(teamId) {
    const d = db()
    if (!d) return []
    const { data, error } = await d
      .from('team_members')
      .select('id, user_id, display_name, joined_at, profiles!user_id(email, display_name)')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('joined_at')

    if (error) { console.error('[Ryan Todo] getPendingRequests:', error); return [] }
    return (data || []).map(tm => ({
      id: tm.id,
      userId: tm.user_id,
      displayName: tm.display_name || tm.profiles?.display_name || '',
      email: tm.profiles?.email || '',
      joinedAt: tm.joined_at,
    }))
  },

  /** 승인 (pending → active) */
  async approveRequest(memberId) {
    const d = db()
    if (!d) return false
    const { error } = await d.from('team_members').update({ status: 'active' }).eq('id', memberId)
    if (error) { console.error('[Ryan Todo] approveRequest:', error); return false }
    return true
  },

  /** 거절 */
  async rejectRequest(memberId) {
    const d = db()
    if (!d) return false
    const { error } = await d.from('team_members').delete().eq('id', memberId)
    if (error) { console.error('[Ryan Todo] rejectRequest:', error); return false }
    return true
  },

  /** 초대 링크로 팀 정보 조회 (미인증도 가능하도록 간단한 정보만) */
  async getTeamByInvite(token) {
    const d = db()
    if (!d) return null

    // invite_code로 시도
    const { data: teamByCode } = await d
      .from('teams')
      .select('id, name, description')
      .eq('invite_code', token)
      .single()

    if (teamByCode) return teamByCode

    // invitation token으로 시도
    const { data: invitation } = await d
      .from('team_invitations')
      .select('team_id, teams(id, name, description)')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    return invitation?.teams || null
  },
}

export default useInvitation
