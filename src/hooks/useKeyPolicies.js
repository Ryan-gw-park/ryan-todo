import { useState, useEffect } from 'react'
import { getDb } from '../utils/supabase'
import { getCachedUserId } from '../utils/auth'

export function useKeyPolicies(pkmId, projectId) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!pkmId) return
    load()
  }, [pkmId])

  async function load() {
    const db = getDb()
    if (!db) return
    const { data, error } = await db
      .from('key_policies')
      .select('*')
      .eq('pkm_id', pkmId)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[useKeyPolicies] select failed:', error.message, error.details)
      return
    }
    setItems(data || [])
  }

  async function add() {
    const db = getDb()
    if (!db) return null
    const userId = await getCachedUserId()
    const { data, error } = await db
      .from('key_policies')
      .insert({
        pkm_id: pkmId,
        project_id: projectId,
        title: '',
        description: '',
        sort_order: items.length,
        created_by: userId,
      })
      .select()
      .single()
    if (error) {
      console.error('[useKeyPolicies] insert failed:', error.message, error.details)
      return null
    }
    if (data) setItems(prev => [...prev, data])
    return data
  }

  async function update(id, patch) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_policies')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[useKeyPolicies] update failed:', error.message, error.details)
      return
    }
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  async function remove(id) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_policies').delete().eq('id', id)
    if (error) {
      console.error('[useKeyPolicies] delete failed:', error.message, error.details)
      return
    }
    setItems(prev => prev.filter(item => item.id !== id))
  }

  return { items, add, update, remove, reload: load }
}
