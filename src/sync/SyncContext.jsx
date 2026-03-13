import { createContext, useEffect, useRef, useState } from 'react'
import useStore from '../hooks/useStore'
import { getDb } from '../utils/supabase'
import PollingSyncProvider from './PollingSyncProvider'

const SyncContext = createContext(null)

const SYNC_TABLES = ['tasks', 'notifications']

export function SyncProviderWrapper({ children }) {
  const teamId = useStore(s => s.currentTeamId)
  const providerRef = useRef(null)
  const [userId, setUserId] = useState(null)

  // Resolve userId once
  useEffect(() => {
    const supabase = getDb()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id)
    })
  }, [])

  // 팀 모드에서만 폴링 시작
  useEffect(() => {
    if (!teamId || !userId) return

    const supabase = getDb()
    if (!supabase) return

    const provider = new PollingSyncProvider(supabase)
    providerRef.current = provider

    provider.subscribe(teamId, SYNC_TABLES, (event) => {
      useStore.getState().mergeSyncUpdate(event)
    }, userId)

    return () => {
      provider.unsubscribe()
      providerRef.current = null
    }
  }, [teamId, userId])

  // 비활성 탭 감지: 숨김 시 폴링 중지, 복귀 시 loadAll + 폴링 재시작
  useEffect(() => {
    const handleVisibility = () => {
      if (!teamId || !userId) return

      if (document.hidden) {
        if (providerRef.current) {
          providerRef.current.unsubscribe()
        }
      } else {
        // 탭 복귀: 전체 리프레시 + 폴링 재시작
        useStore.getState().loadAll()

        const supabase = getDb()
        if (!supabase) return

        if (providerRef.current) {
          providerRef.current.unsubscribe()
        }

        const provider = new PollingSyncProvider(supabase)
        providerRef.current = provider

        provider.subscribe(teamId, SYNC_TABLES, (event) => {
          useStore.getState().mergeSyncUpdate(event)
        }, userId)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [teamId, userId])

  return (
    <SyncContext.Provider value={providerRef}>
      {children}
    </SyncContext.Provider>
  )
}

export default SyncContext
