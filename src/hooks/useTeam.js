import { getDb } from '../utils/supabase'
import useStore from './useStore'

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

const useTeam = {
  /** 내가 소속된 팀 목록 조회 */
  async getMyTeams() {
    const d = db()
    if (!d) return []
    const { data: { user } } = await d.auth.getUser()
    if (!user) return []

    const { data, error } = await d
      .from('team_members')
      .select('team_id, role, status, display_name, teams(id, name, description, invite_code, auto_approve, created_by)')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (error) {
      console.error('[Ryan Todo] getMyTeams:', error)
      return []
    }

    return (data || []).map(tm => ({
      id: tm.teams.id,
      name: tm.teams.name,
      description: tm.teams.description,
      inviteCode: tm.teams.invite_code,
      autoApprove: tm.teams.auto_approve,
      createdBy: tm.teams.created_by,
      myRole: tm.role,
      myDisplayName: tm.display_name,
    }))
  },

  /** 팀 생성 + 생성자를 owner로 등록 */
  async createTeam(name, description = '') {
    const d = db()
    if (!d) return null
    const { data: { user } } = await d.auth.getUser()
    if (!user) return null

    // 1. teams INSERT
    const { data: team, error: teamError } = await d
      .from('teams')
      .insert({ name, description, created_by: user.id, auto_approve: true })
      .select()
      .single()

    if (teamError) {
      console.error('[Ryan Todo] createTeam:', teamError)
      return null
    }

    // 2. team_members INSERT (owner)
    const { data: profile } = await d
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    const { error: memberError } = await d
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        display_name: profile?.display_name || user.email?.split('@')[0] || '',
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('[Ryan Todo] createTeam member:', memberError)
    }

    return team
  },

  /** 팀 설정 변경 (owner만) */
  async updateTeam(teamId, patch) {
    const d = db()
    if (!d) return false
    const updates = {}
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.description !== undefined) updates.description = patch.description
    if (patch.auto_approve !== undefined) updates.auto_approve = patch.auto_approve

    const { error } = await d.from('teams').update(updates).eq('id', teamId)
    if (error) {
      console.error('[Ryan Todo] updateTeam:', error)
      return false
    }
    return true
  },

  /** 팀 삭제 (owner만) */
  async deleteTeam(teamId) {
    const d = db()
    if (!d) return false

    // Delete members first, then team
    await d.from('team_members').delete().eq('team_id', teamId)
    await d.from('team_invitations').delete().eq('team_id', teamId)
    const { error } = await d.from('teams').delete().eq('id', teamId)
    if (error) {
      console.error('[Ryan Todo] deleteTeam:', error)
      return false
    }
    return true
  },
}

export default useTeam
