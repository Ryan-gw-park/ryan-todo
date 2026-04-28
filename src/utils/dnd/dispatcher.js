/* DnD dispatcher — spec §2.4, §12.1, §12.2
 *
 * 원칙:
 *   - id는 unique opaque string. 의미는 data.current.type + payload에.
 *   - handler는 over.data.current?.type 으로 분기. id.startsWith(...) 금지.
 *
 * 사용:
 *   import { registerHandler, dispatch } from '@/utils/dnd/dispatcher'
 *
 *   registerHandler('team-matrix-task', handleTeamMatrixTaskDrop)
 *   ...
 *
 *   // DndContext의 onDragEnd에서:
 *   const handleDragEnd = (e) => {
 *     const ctx = { tasks, projects, ... }
 *     const handled = dispatch(e, ctx)
 *     if (handled) return
 *     // fallback: 기존 string-prefix 분기 (점진 마이그레이션 단계)
 *   }
 *
 * 반환값 규약 (W-3 정정):
 *   true  = 처리 완료 (handler 실행 또는 E-01/E-02 가드 통과)
 *   false = type 미등록 → caller가 fallback 분기 실행 가능
 */

const HANDLERS = {}

export function registerHandler(type, handler) {
  HANDLERS[type] = handler
}

export function dispatch(e, ctx) {
  if (!e.over) return true                                    // E-01: drop 영역 밖 = 처리됨 (no-op)
  if (e.active?.id && e.active.id === e.over.id) return true  // E-02: source = over

  const type = e.over.data?.current?.type ?? e.active.data?.current?.type
  if (!type) return false  // type 미등록 → fallback

  const handler = HANDLERS[type]
  if (!handler) return false  // type은 있는데 handler 등록 안 됨 → fallback (방어)

  handler(e, ctx)
  return true
}
