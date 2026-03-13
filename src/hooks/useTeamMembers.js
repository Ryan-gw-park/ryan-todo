import { getDb } from '../utils/supabase'

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

const useTeamMembers = {
  /** 팀원 목록 조회 — COALESCE(tm.display_name, p.display_name) */
  async getMembers(teamId) {
    const d = db()
    if (!d) return []

    const { data, error } = await d
      .from('team_members')
      .select('id, team_id, user_id, role, status, display_name, joined_at, profiles!user_id(display_name, email, avatar_url)')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .order('joined_at')

    if (error) {
      console.error('[Ryan Todo] getMembers:', error)
      return []
    }

    return (data || []).map(tm => ({
      id: tm.id,
      teamId: tm.team_id,
      userId: tm.user_id,
      role: tm.role,
      status: tm.status,
      displayName: tm.display_name || tm.profiles?.display_name || '',
      email: tm.profiles?.email || '',
      avatarUrl: tm.profiles?.avatar_url || '',
      joinedAt: tm.joined_at,
    }))
  },

  /** 팀장 권한 부여 (member → owner) */
  async grantOwner(teamId, userId) {
    const d = db()
    if (!d) return false
    const { error } = await d
      .from('team_members')
      .update({ role: 'owner' })
      .eq('team_id', teamId)
      .eq('user_id', userId)
    if (error) { console.error('[Ryan Todo] grantOwner:', error); return false }
    return true
  },

  /** 팀장 권한 해제 (owner → member, 마지막 1명이면 거부) */
  async revokeOwner(teamId, userId) {
    const d = db()
    if (!d) return false

    // 최소 1명 owner 검증
    const { data: owners } = await d
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('role', 'owner')
      .eq('status', 'active')

    if (!owners || owners.length <= 1) {
      console.warn('[Ryan Todo] revokeOwner: 마지막 팀장은 해제할 수 없습니다')
      return false
    }

    const { error } = await d
      .from('team_members')
      .update({ role: 'member' })
      .eq('team_id', teamId)
      .eq('user_id', userId)
    if (error) { console.error('[Ryan Todo] revokeOwner:', error); return false }
    return true
  },

  /** 팀원 내보내기 — 배정 할일을 미배정으로 전환 */
  async removeMember(teamId, userId) {
    const d = db()
    if (!d) return false

    // 배정 할일 → scope='team', assignee_id=NULL
    await d
      .from('tasks')
      .update({ scope: 'team', assignee_id: null })
      .eq('team_id', teamId)
      .eq('assignee_id', userId)
      .eq('scope', 'assigned')

    // team_members 삭제
    const { error } = await d
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)

    if (error) { console.error('[Ryan Todo] removeMember:', error); return false }
    return true
  },

  /** 자발적 탈퇴 (동일 처리) */
  async leaveTeam(teamId) {
    const d = db()
    if (!d) return false
    const { data: { user } } = await d.auth.getUser()
    if (!user) return false
    return useTeamMembers.removeMember(teamId, user.id)
  },
}

export default useTeamMembers
