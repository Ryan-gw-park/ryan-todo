import { getDb } from '../utils/supabase'

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

const useComments = {
  /** 댓글 목록 조회 — 시간순 (오래된 것 위) */
  async getComments(taskId, teamId) {
    const d = db()
    if (!d) return []

    const { data, error } = await d
      .from('comments')
      .select('id, task_id, author_id, content, created_at, updated_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Ryan Todo] getComments:', error)
      return []
    }

    // author 정보 조회: COALESCE(tm.display_name, p.display_name)
    if (!data || data.length === 0) return []

    const authorIds = [...new Set(data.map(c => c.author_id))]
    const { data: profiles } = await d
      .from('profiles')
      .select('id, display_name')
      .in('id', authorIds)

    let memberMap = {}
    if (teamId) {
      const { data: members } = await d
        .from('team_members')
        .select('user_id, display_name')
        .eq('team_id', teamId)
        .in('user_id', authorIds)
      if (members) {
        members.forEach(m => { if (m.display_name) memberMap[m.user_id] = m.display_name })
      }
    }

    const profileMap = {}
    if (profiles) profiles.forEach(p => { profileMap[p.id] = p.display_name })

    return data.map(c => ({
      id: c.id,
      taskId: c.task_id,
      authorId: c.author_id,
      authorName: memberMap[c.author_id] || profileMap[c.author_id] || '알 수 없음',
      content: c.content,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))
  },

  /** 댓글 생성 */
  async addComment(taskId, content) {
    const d = db()
    if (!d) return null

    const { data: { user } } = await d.auth.getUser()
    if (!user) return null

    const { data, error } = await d
      .from('comments')
      .insert({ task_id: taskId, author_id: user.id, content })
      .select()
      .single()

    if (error) {
      console.error('[Ryan Todo] addComment:', error)
      return null
    }
    return data
  },

  /** 댓글 수정 (본인만) */
  async updateComment(commentId, content) {
    const d = db()
    if (!d) return false

    const { error } = await d
      .from('comments')
      .update({ content })
      .eq('id', commentId)

    if (error) {
      console.error('[Ryan Todo] updateComment:', error)
      return false
    }
    return true
  },

  /** 댓글 삭제 (본인 + 팀장) */
  async deleteComment(commentId) {
    const d = db()
    if (!d) return false

    const { error } = await d
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('[Ryan Todo] deleteComment:', error)
      return false
    }
    return true
  },
}

export default useComments
