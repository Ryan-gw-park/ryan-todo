/** @typedef {import('./types').SyncEvent} SyncEvent */

export default class RealtimeSyncProvider {
  /**
   * @param {string} teamId
   * @param {string[]} tables
   * @param {(event: SyncEvent) => void} onUpdate
   */
  subscribe(teamId, tables, onUpdate) {
    console.warn('[Sync] RealtimeSyncProvider not yet implemented. Use PollingSyncProvider.')
    // TODO: Supabase Realtime 채널 구독
    // this.channel = supabase.channel('team-' + teamId)
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, ...)
    //   .subscribe()
  }

  unsubscribe() {
    // TODO: 채널 해제
  }
}
