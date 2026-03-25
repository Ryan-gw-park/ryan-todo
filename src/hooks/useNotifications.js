import { getDb } from '../utils/supabase'

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

const LAST_SEEN_KEY = 'ryan-todo-noti-lastSeenAt'

const useNotifications = {
  /** 알림 목록 조회 — 최신순, expires_at 유효한 것만 */
  async getNotifications(teamId, limit = 50) {
    const d = db()
    if (!d || !teamId) return []

    const { data, error } = await d
      .from('notifications')
      .select('id, team_id, actor_id, target_user_id, task_id, event_type, message, created_at, expires_at')
      .eq('team_id', teamId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Ryan Todo] getNotifications:', error)
      return []
    }
    return (data || []).map(n => ({
      id: n.id,
      teamId: n.team_id,
      actorId: n.actor_id,
      targetUserId: n.target_user_id,
      taskId: n.task_id,
      eventType: n.event_type,
      message: n.message,
      createdAt: n.created_at,
      expiresAt: n.expires_at,
    }))
  },

  /** 읽지 않은 알림 수 — localStorage lastSeenAt 기준 */
  async getUnreadCount(teamId) {
    try {
      const d = db()
      if (!d || !teamId) return 0

      const lastSeenAt = localStorage.getItem(LAST_SEEN_KEY) || '1970-01-01T00:00:00Z'

      const { count, error } = await d
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .gt('created_at', lastSeenAt)
        .gte('expires_at', new Date().toISOString())

      if (error) {
        console.error('[Ryan Todo] getUnreadCount:', error)
        return 0
      }
      return count || 0
    } catch (e) {
      if (e?.name === 'AbortError') {
        console.warn('[Ryan Todo] getUnreadCount AbortError — returning 0')
      } else {
        console.error('[Ryan Todo] getUnreadCount unexpected:', e)
      }
      return 0
    }
  },

  /** 모두 읽음 처리 — lastSeenAt 갱신 */
  markAllRead() {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
  },
}

export default useNotifications
