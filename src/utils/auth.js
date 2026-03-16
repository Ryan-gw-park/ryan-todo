// src/utils/auth.js
import { getDb } from './supabase'

let _cachedUserId = null

export async function getCachedUserId() {
  if (_cachedUserId) return _cachedUserId
  const db = getDb()
  if (!db) return null
  try {
    const { data: { user } } = await db.auth.getUser()
    _cachedUserId = user?.id || null
    return _cachedUserId
  } catch {
    return null
  }
}

export function clearCachedUserId() {
  _cachedUserId = null
}
