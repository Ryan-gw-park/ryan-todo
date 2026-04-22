import { getDb } from '../utils/supabase'
import useStore from './useStore'

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// 목업 팀 프로젝트 데이터
const MOCK_TEAM_PROJECTS = [
  { name: '마케팅 캠페인', color: 'blue', tasks: ['SNS 콘텐츠 기획', '광고 소재 제작', '성과 분석 리포트'] },
  { name: '제품 개발', color: 'green', tasks: ['기능 명세서 작성', 'UI 디자인 검토', '테스트 케이스 작성'] },
  { name: '운영 관리', color: 'orange', tasks: ['주간 회의 준비', '일정 조율', '문서 정리'] },
]

// 목업 개인 프로젝트 데이터
const MOCK_PERSONAL_PROJECT = {
  name: '개인 프로젝트',
  color: 'purple',
  tasks: ['개인 할일 1', '개인 할일 2', '개인 할일 3'],
}

// 초대된 신규 사용자용 개인 프로젝트
const NEW_USER_PROJECT = {
  name: '개인 프로젝트',
  color: 'purple',
  tasks: ['개인 할일 1', '개인 할일 2'],
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

  /** 신규 사용자용 개인 프로젝트 + 할일 생성 (초대로 참가한 사용자) */
  async createInitialPersonalData() {
    const d = db()
    if (!d) return false
    const { data: { user } } = await d.auth.getUser()
    if (!user) return false

    // 이미 개인 프로젝트가 있는지 확인
    const { data: existing } = await d
      .from('projects')
      .select('id')
      .eq('user_id', user.id)
      .is('team_id', null)
      .limit(1)

    if (existing && existing.length > 0) return true // 이미 있으면 스킵

    // 개인 프로젝트 생성
    const projectId = uid()
    const { error: pErr } = await d.from('projects').insert({
      id: projectId,
      name: NEW_USER_PROJECT.name,
      color: NEW_USER_PROJECT.color,
      user_id: user.id,
      team_id: null,
      sort_order: 0,
    })
    if (pErr) {
      console.error('[Ryan Todo] createInitialPersonalData project:', pErr)
      return false
    }

    // 할일 생성
    const tasks = NEW_USER_PROJECT.tasks.map((text, i) => ({
      id: uid(),
      text,
      project_id: projectId,
      category: 'today',
      scope: 'private',
      created_by: user.id,
      sort_order: i,
    }))
    const { error: tErr } = await d.from('tasks').insert(tasks)
    if (tErr) console.error('[Ryan Todo] createInitialPersonalData tasks:', tErr)

    return true
  },

  /** 팀 생성자용 목업 데이터 생성 (팀 프로젝트 3개 + 개인 프로젝트 1개, 각 할일 3개) */
  async createInitialTeamOwnerData(teamId) {
    const d = db()
    if (!d) return false
    const { data: { user } } = await d.auth.getUser()
    if (!user) return false

    const allProjects = []
    const allTasks = []

    // 팀 프로젝트 3개 생성
    MOCK_TEAM_PROJECTS.forEach((proj, pi) => {
      const projectId = uid()
      allProjects.push({
        id: projectId,
        name: proj.name,
        color: proj.color,
        user_id: null,
        team_id: teamId,
        sort_order: pi,
      })

      proj.tasks.forEach((text, ti) => {
        allTasks.push({
          id: uid(),
          text,
          project_id: projectId,
          category: 'today',
          scope: 'team',
          team_id: teamId,
          created_by: user.id,
          sort_order: ti,
        })
      })
    })

    // 개인 프로젝트 1개 생성
    const personalProjectId = uid()
    allProjects.push({
      id: personalProjectId,
      name: MOCK_PERSONAL_PROJECT.name,
      color: MOCK_PERSONAL_PROJECT.color,
      user_id: user.id,
      team_id: null,
      sort_order: MOCK_TEAM_PROJECTS.length,
    })

    MOCK_PERSONAL_PROJECT.tasks.forEach((text, ti) => {
      allTasks.push({
        id: uid(),
        text,
        project_id: personalProjectId,
        category: 'today',
        scope: 'private',
        created_by: user.id,
        sort_order: ti,
      })
    })

    // DB에 저장
    const { error: pErr } = await d.from('projects').insert(allProjects)
    if (pErr) {
      console.error('[Ryan Todo] createInitialTeamOwnerData projects:', pErr)
      return false
    }

    const { error: tErr } = await d.from('tasks').insert(allTasks)
    if (tErr) console.error('[Ryan Todo] createInitialTeamOwnerData tasks:', tErr)

    return true
  },
}

export default useTeam
