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

  /** 초대 수락 — invite_code로 팀 찾기 + 가입 */
  async acceptInvite(token, displayName) {
    const d = db()
    if (!d) return { success: false, error: '연결 실패' }
    const { data: { user } } = await d.auth.getUser()
    if (!user) return { success: false, error: '인증 필요' }

    // 1. invite_code로 팀 찾기 (SECURITY DEFINER RPC — exact match)
    let teamId = null
    let autoApprove = true

    const { data: teamRows } = await d.rpc('get_team_by_invite', { p_code: token })
    const teamByCode = teamRows?.[0]

    if (!teamByCode) return { success: false, error: '유효하지 않은 초대입니다.' }

    teamId = teamByCode.id
    autoApprove = teamByCode.auto_approve

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

  /** 초대 거절 — 초대 링크 방식에서는 별도 거절 처리 불필요 (페이지 이탈로 처리) */
  async declineInvite() {
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

  /** 초대 링크로 팀 정보 조회 — SECURITY DEFINER RPC (exact match만) */
  async getTeamByInvite(token) {
    const d = db()
    if (!d) return null

    const { data: rows, error } = await d.rpc('get_team_by_invite', { p_code: token })
    if (error) { console.error('[Ryan Todo] getTeamByInvite:', error); return null }
    return rows?.[0] || null
  },
}

export default useInvitation
