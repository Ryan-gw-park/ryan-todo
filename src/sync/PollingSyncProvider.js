/** @typedef {import('./types').SyncEvent} SyncEvent */

const POLL_INTERVAL_MS = 10_000

export default class PollingSyncProvider {
  constructor(supabase) {
    this.supabase = supabase
    this.intervalId = null
    this.lastSync = {}
  }

  /**
   * @param {string} teamId
   * @param {string[]} tables
   * @param {(event: SyncEvent) => void} onUpdate
   * @param {string} [userId]
   */
  subscribe(teamId, tables, onUpdate, userId) {
    const now = new Date().toISOString()
    tables.forEach(t => { this.lastSync[t] = now })

    this.teamId = teamId
    this.userId = userId
    this.tables = tables
    this.onUpdate = onUpdate

    this.intervalId = setInterval(() => this._poll(), POLL_INTERVAL_MS)
  }

  unsubscribe() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async _poll() {
    for (const table of this.tables) {
      try {
        // notifications uses created_at (no updated_at column)
        const timeCol = table === 'notifications' ? 'created_at' : 'updated_at'

        let query = this.supabase
          .from(table)
          .select('*')
          .gt(timeCol, this.lastSync[table])
          .order(timeCol, { ascending: true })

        // tasks: 팀 tasks + own private tasks (deleted_at 필터 걸지 않음 — soft delete 감지 위해)
        if (table === 'tasks') {
          query = query.or(
            `team_id.eq.${this.teamId},and(scope.eq.private,created_by.eq.${this.userId})`
          )
        }
        // notifications: filter by user (own notifications only)
        if (table === 'notifications') {
          query = query.eq('user_id', this.userId)
        }

        const { data, error } = await query

        if (error) {
          console.warn(`[Sync] fetch error (${table}):`, error.message)
          continue
        }

        if (data && data.length > 0) {
          data.forEach(row => {
            this.onUpdate({
              table,
              eventType: row.deleted_at ? 'DELETE' : 'UPDATE',
              row,
            })
          })
          this.lastSync[table] = data[data.length - 1][timeCol]
        }
      } catch (err) {
        console.warn(`[Sync] error (${table}):`, err.message)
      }
    }
  }
}
