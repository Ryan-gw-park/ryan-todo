import { useState, useEffect, useMemo } from 'react'
import { getDb } from '../utils/supabase'

/**
 * 여러 프로젝트의 마일스톤을 한번에 가져오는 훅
 * @param {string[]} projectIds - 프로젝트 ID 배열
 * @returns {{ milestones: Array, loading: boolean, reload: () => void }}
 */
export function useMilestonesByProjects(projectIds) {
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(false)

  // projectIds 배열의 실제 변화만 감지하기 위한 memoized key
  const projectIdsKey = useMemo(() => {
    if (!projectIds?.length) return ''
    return [...projectIds].sort().join(',')
  }, [projectIds])

  useEffect(() => {
    if (!projectIdsKey) {
      setMilestones([])
      return
    }
    load()
  }, [projectIdsKey])

  async function load() {
    const db = getDb()
    if (!db) return

    setLoading(true)
    const { data, error } = await db
      .from('key_milestones')
      .select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by')
      .in('project_id', projectIds)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[useMilestonesByProjects] select failed:', error.message, error.details)
      setLoading(false)
      return
    }
    setMilestones(data || [])
    setLoading(false)
  }

  return { milestones, loading, reload: load }
}
