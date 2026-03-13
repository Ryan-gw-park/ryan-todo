import { getDb } from '../utils/supabase'

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

const useMatrixConfig = {
  /** matrix_row_config 조회 */
  async getConfig(userId, teamId) {
    const d = db()
    if (!d) return []
    let query = d.from('matrix_row_config').select('*').eq('user_id', userId).order('sort_order')
    if (teamId) {
      query = query.eq('team_id', teamId)
    } else {
      query = query.is('team_id', null)
    }
    const { data, error } = await query
    if (error) { console.error('[Ryan Todo] getConfig:', error); return [] }
    return data || []
  },

  /** 최초 접근 시 기본 설정 생성 (seed) */
  async initConfig(userId, teamId, teamMembers = []) {
    const d = db()
    if (!d) return []

    // 이미 config가 있으면 skip
    const existing = await useMatrixConfig.getConfig(userId, teamId)
    if (existing.length > 0) return existing

    const rows = []
    let order = 0

    // 나 섹션
    rows.push({ user_id: userId, team_id: teamId, section: 'me', label: '나', row_type: 'section_header', sort_order: order++ })
    rows.push({ user_id: userId, team_id: teamId, section: 'me_today', label: '오늘 할일', row_type: 'task_row', parent_section: 'me', mapped_user_id: userId, sort_order: order++ })
    rows.push({ user_id: userId, team_id: teamId, section: 'me_next', label: '다음 할일', row_type: 'task_row', parent_section: 'me', mapped_user_id: userId, sort_order: order++ })

    // 팀 섹션
    rows.push({ user_id: userId, team_id: teamId, section: 'team', label: '팀', row_type: 'section_header', sort_order: order++ })
    for (const member of teamMembers) {
      if (member.userId === userId) continue // 본인 제외
      rows.push({
        user_id: userId, team_id: teamId,
        section: `member_${member.userId}`,
        label: member.displayName || member.email || '팀원',
        row_type: 'member_row',
        parent_section: 'team',
        mapped_user_id: member.userId,
        sort_order: order++,
      })
    }

    // 남은 할일 + 완료
    rows.push({ user_id: userId, team_id: teamId, section: 'remaining', label: '남은 할일', row_type: 'remaining', sort_order: order++ })
    rows.push({ user_id: userId, team_id: teamId, section: 'completed', label: '완료', row_type: 'completed', sort_order: order++ })

    const { data, error } = await d.from('matrix_row_config').insert(rows).select()
    if (error) { console.error('[Ryan Todo] initConfig:', error); return [] }
    return data || []
  },

  /** 순서 변경 (배열 upsert) */
  async updateOrder(configs) {
    const d = db()
    if (!d) return false
    const rows = configs.map((c, i) => ({ id: c.id, sort_order: i }))
    for (const row of rows) {
      const { error } = await d.from('matrix_row_config').update({ sort_order: row.sort_order }).eq('id', row.id)
      if (error) { console.error('[Ryan Todo] updateOrder:', error); return false }
    }
    return true
  },

  /** 접기/펼치기 토글 */
  async toggleCollapse(configId, currentValue) {
    const d = db()
    if (!d) return false
    const { error } = await d.from('matrix_row_config').update({ is_collapsed: !currentValue }).eq('id', configId)
    if (error) { console.error('[Ryan Todo] toggleCollapse:', error); return false }
    return true
  },

  /** 행 추가 */
  async addRow(userId, teamId, row) {
    const d = db()
    if (!d) return null
    const { data, error } = await d.from('matrix_row_config').insert({
      user_id: userId, team_id: teamId, ...row,
    }).select().single()
    if (error) { console.error('[Ryan Todo] addRow:', error); return null }
    return data
  },

  /** 행 삭제 */
  async removeRow(configId) {
    const d = db()
    if (!d) return false
    const { error } = await d.from('matrix_row_config').delete().eq('id', configId)
    if (error) { console.error('[Ryan Todo] removeRow:', error); return false }
    return true
  },

  /** 행 이름 변경 */
  async renameRow(configId, newLabel) {
    const d = db()
    if (!d) return false
    const { error } = await d.from('matrix_row_config').update({ label: newLabel }).eq('id', configId)
    if (error) { console.error('[Ryan Todo] renameRow:', error); return false }
    return true
  },

  /** 팀원 행 동기화 — team_members 변경 감지 → member_row 자동 추가/삭제 */
  async syncMembers(userId, teamId, teamMembers) {
    const d = db()
    if (!d) return

    const config = await useMatrixConfig.getConfig(userId, teamId)
    const existingMemberRows = config.filter(r => r.row_type === 'member_row')
    const existingMemberIds = new Set(existingMemberRows.map(r => r.mapped_user_id))
    const currentMemberIds = new Set(teamMembers.filter(m => m.userId !== userId).map(m => m.userId))

    // 새 팀원 추가
    const maxOrder = Math.max(0, ...config.map(r => r.sort_order))
    let order = maxOrder + 1
    for (const member of teamMembers) {
      if (member.userId === userId) continue
      if (!existingMemberIds.has(member.userId)) {
        await useMatrixConfig.addRow(userId, teamId, {
          section: `member_${member.userId}`,
          label: member.displayName || '팀원',
          row_type: 'member_row',
          parent_section: 'team',
          mapped_user_id: member.userId,
          sort_order: order++,
        })
      }
    }

    // 삭제된 팀원 제거
    for (const row of existingMemberRows) {
      if (!currentMemberIds.has(row.mapped_user_id)) {
        await useMatrixConfig.removeRow(row.id)
      }
    }
  },
}

export default useMatrixConfig
