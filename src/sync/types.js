/**
 * @typedef {Object} SyncEvent
 * @property {'tasks'|'comments'|'notifications'} table
 * @property {'INSERT'|'UPDATE'|'DELETE'} eventType
 * @property {Object} [row] - 변경된 행 데이터
 */

/**
 * @typedef {Object} SyncProvider
 * @property {(teamId: string, tables: string[], onUpdate: function) => void} subscribe
 * @property {() => void} unsubscribe
 */
