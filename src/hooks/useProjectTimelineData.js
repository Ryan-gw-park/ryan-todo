import { useState, useEffect, useMemo } from 'react'
import { getDb } from '../utils/supabase'
import useStore from './useStore'

export function useProjectTimelineData(projectId) {
  const [milestones, setMilestones] = useState([])
  const [deliverables, setDeliverables] = useState([])
  const [loading, setLoading] = useState(true)

  const allTasks = useStore(s => s.tasks)
  const tasks = useMemo(() =>
    allTasks.filter(t => t.projectId === projectId && !t.deletedAt),
    [allTasks, projectId]
  )

  useEffect(() => {
    if (!projectId) return
    load()
  }, [projectId])

  async function load() {
    setLoading(true)
    const db = getDb()
    if (!db) {
      setLoading(false)
      return
    }

    // 1. project_key_milestones 조회
    const { data: pkm } = await db
      .from('project_key_milestones')
      .select('id')
      .eq('project_id', projectId)
      .single()

    if (!pkm) {
      setLoading(false)
      return
    }

    // 2. milestones + deliverables 조회
    const [msResult, dvResult] = await Promise.all([
      db.from('key_milestones')
        .select('*')
        .eq('pkm_id', pkm.id)
        .order('sort_order'),
      db.from('key_deliverables')
        .select('*')
        .eq('pkm_id', pkm.id)
        .order('sort_order'),
    ])

    setMilestones(msResult.data || [])
    setDeliverables(dvResult.data || [])
    setLoading(false)
  }

  // 마일스톤별 결과물 그룹핑
  function getDeliverablesByMilestone(milestoneId) {
    return deliverables.filter(d => d.milestone_id === milestoneId)
  }

  // 마일스톤별 Task 조회 (v3: keyMilestoneId 사용)
  function getTasksByMilestone(milestoneId) {
    return tasks.filter(t => t.keyMilestoneId === milestoneId)
  }

  // 결과물별 Task 조회 (레거시 호환)
  function getTasksByDeliverable(deliverableId) {
    return tasks.filter(t => t.deliverableId === deliverableId)
  }

  // 미연결 Task (keyMilestoneId가 null인 프로젝트 Task)
  const unlinkedTasks = useMemo(() =>
    tasks.filter(t => !t.keyMilestoneId && t.category !== 'done'),
    [tasks]
  )

  // 미배정 마일스톤 수 (Task가 0인 마일스톤)
  const unassignedCount = useMemo(() =>
    milestones.filter(ms =>
      tasks.filter(t => t.keyMilestoneId === ms.id && !t.deletedAt).length === 0
    ).length,
    [milestones, tasks]
  )

  return {
    milestones, deliverables, tasks,
    loading, unlinkedTasks, unassignedCount,
    getDeliverablesByMilestone, getTasksByMilestone, getTasksByDeliverable,
    reload: load,
  }
}

export default useProjectTimelineData
