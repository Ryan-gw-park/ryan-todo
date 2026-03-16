import { useState, useEffect } from 'react'
import { getDb } from '../utils/supabase'
import { getCachedUserId } from '../utils/auth'

export function useKeyDeliverables(pkmId, projectId) {
  const [deliverables, setDeliverables] = useState([])

  useEffect(() => {
    if (!pkmId) return
    load()
  }, [pkmId])

  async function load() {
    const db = getDb()
    if (!db) return
    const { data, error } = await db
      .from('key_deliverables')
      .select('*')
      .eq('pkm_id', pkmId)
      .order('milestone_id', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[useKeyDeliverables] select failed:', error.message, error.details)
      return
    }
    setDeliverables(data || [])
  }

  async function add(milestoneId) {
    const db = getDb()
    if (!db) return null
    const userId = await getCachedUserId()
    const existing = deliverables.filter(d => d.milestone_id === milestoneId)
    const { data, error } = await db
      .from('key_deliverables')
      .insert({
        pkm_id: pkmId,
        project_id: projectId,
        milestone_id: milestoneId,
        title: '',
        sort_order: existing.length,
        created_by: userId,
      })
      .select()
      .single()
    if (error) {
      console.error('[useKeyDeliverables] insert failed:', error.message, error.details)
      return null
    }
    if (data) setDeliverables(prev => [...prev, data])
    return data
  }

  async function update(id, patch) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_deliverables')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[useKeyDeliverables] update failed:', error.message, error.details)
      return
    }
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
  }

  async function remove(id) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_deliverables').delete().eq('id', id)
    if (error) {
      console.error('[useKeyDeliverables] delete failed:', error.message, error.details)
      return
    }
    setDeliverables(prev => prev.filter(d => d.id !== id))
  }

  function getByMilestone(milestoneId) {
    return deliverables.filter(d => d.milestone_id === milestoneId)
  }

  return { deliverables, add, update, remove, reload: load, getByMilestone }
}
