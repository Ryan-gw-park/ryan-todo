import { useState, useEffect } from 'react'
import { getDb } from '../utils/supabase'
import { getCachedUserId } from '../utils/auth'

export function useKeyMilestones(pkmId, projectId) {
  const [milestones, setMilestones] = useState([])

  useEffect(() => {
    if (!pkmId) return
    load()
  }, [pkmId])

  async function load() {
    const db = getDb()
    if (!db) return
    const { data, error } = await db
      .from('key_milestones')
      .select('*')
      .eq('pkm_id', pkmId)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[useKeyMilestones] select failed:', error.message, error.details)
      return
    }
    setMilestones(data || [])
  }

  async function add() {
    const db = getDb()
    if (!db) return null
    const userId = await getCachedUserId()
    const { data, error } = await db
      .from('key_milestones')
      .insert({
        pkm_id: pkmId,
        project_id: projectId,
        title: '',
        sort_order: milestones.length,
        created_by: userId,
        // Loop-32: 새 필드 기본값
        owner_id: null,
        status: 'not_started',
      })
      .select()
      .single()
    if (error) {
      console.error('[useKeyMilestones] insert failed:', error.message, error.details)
      return null
    }
    if (data) setMilestones(prev => [...prev, data])
    return data
  }

  async function update(id, patch) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_milestones')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[useKeyMilestones] update failed:', error.message, error.details)
      return
    }
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  async function remove(id) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_milestones').delete().eq('id', id)
    if (error) {
      console.error('[useKeyMilestones] delete failed:', error.message, error.details)
      return
    }
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  async function reorder(reorderedMilestones) {
    const db = getDb()
    if (!db) return
    // Optimistic UI update
    setMilestones(reorderedMilestones)
    // DB batch update
    for (let i = 0; i < reorderedMilestones.length; i++) {
      const { error } = await db.from('key_milestones')
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq('id', reorderedMilestones[i].id)
      if (error) {
        console.error('[useKeyMilestones] reorder update failed:', error.message, error.details)
      }
    }
  }

  return { milestones, add, update, remove, reorder, reload: load }
}
