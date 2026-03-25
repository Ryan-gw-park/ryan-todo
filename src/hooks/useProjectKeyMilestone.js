import { useState, useEffect } from 'react'
import { getDb } from '../utils/supabase'
import { getCachedUserId } from '../utils/auth'

export function useProjectKeyMilestone(projectId) {
  const [pkm, setPkm] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    init(projectId)
  }, [projectId])

  async function init(pid) {
    setLoading(true)
    try {
      const db = getDb()
      if (!db) { setLoading(false); return }

      // 1. 조회
      const { data, error } = await db
        .from('project_key_milestones')
        .select('*')
        .eq('project_id', pid)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (정상적인 "없음" 상태)
        console.error('[useProjectKeyMilestone] select failed:', error.message, error.details)
        setLoading(false)
        return
      }

      // 2. 없으면 자동 생성
      if (!data) {
        const userId = await getCachedUserId()
        const { data: created, error: insertError } = await db
          .from('project_key_milestones')
          .insert({ project_id: pid, created_by: userId })
          .select()
          .single()

        if (insertError) {
          console.error('[useProjectKeyMilestone] insert failed:', insertError.message, insertError.details)
          setLoading(false)
          return
        }
        setPkm(created)
      } else {
        setPkm(data)
      }
      setLoading(false)
    } catch (e) {
      if (e?.name === 'AbortError') {
        console.warn('[useProjectKeyMilestone] AbortError — 기본값으로 진행')
      } else {
        console.error('[useProjectKeyMilestone] unexpected error:', e)
      }
      setLoading(false)
    }
  }

  return { pkm, loading }
}
