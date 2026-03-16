import { useState, useEffect } from 'react'
import { getDb } from '../utils/supabase'
import { getCachedUserId } from '../utils/auth'

export function useKeyLinks(pkmId, projectId) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!pkmId) return
    load()
  }, [pkmId])

  async function load() {
    const db = getDb()
    if (!db) return
    const { data, error } = await db
      .from('key_links')
      .select('*')
      .eq('pkm_id', pkmId)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[useKeyLinks] select failed:', error.message, error.details)
      return
    }
    setItems(data || [])
  }

  async function add() {
    const db = getDb()
    if (!db) return null
    const userId = await getCachedUserId()
    const { data, error } = await db
      .from('key_links')
      .insert({
        pkm_id: pkmId,
        project_id: projectId,
        title: '',
        url: '',
        sort_order: items.length,
        created_by: userId,
      })
      .select()
      .single()
    if (error) {
      console.error('[useKeyLinks] insert failed:', error.message, error.details)
      return null
    }
    if (data) setItems(prev => [...prev, data])
    return data
  }

  async function update(id, patch) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_links')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[useKeyLinks] update failed:', error.message, error.details)
      return
    }
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  async function remove(id) {
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_links').delete().eq('id', id)
    if (error) {
      console.error('[useKeyLinks] delete failed:', error.message, error.details)
      return
    }
    setItems(prev => prev.filter(item => item.id !== id))
  }

  return { items, add, update, remove, reload: load }
}
