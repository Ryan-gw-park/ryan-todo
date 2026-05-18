import { useMemo } from 'react'
import { MENTION_PALETTE_SIZE } from '../utils/mentions'

/* useMentionColorMap — Hotfix r7
 *
 * 담당자별로 영구 고유 색상 인덱스를 부여한다.
 *
 * 규칙:
 *   - 새 mention 등장 → 미사용 인덱스 중 가장 낮은 번호 부여
 *   - 한 번 부여된 색은 localStorage에 저장되어 영구 유지 (같은 사람 = 같은 색)
 *   - 모든 인덱스(16)가 사용 중이면 wraparound (이름 길이 기반 fallback)
 *
 * 반환: { [name]: paletteIndex } plain object
 */
const STORAGE_KEY = 'agendaMentionColorMap'

function readLS() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function writeLS(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)) }
  catch { /* localStorage 비활성 환경 무시 */ }
}

export default function useMentionColorMap(mentions) {
  return useMemo(() => {
    const existing = readLS()
    const next = { ...existing }
    const used = new Set(Object.values(next).filter(v => typeof v === 'number'))
    let changed = false

    for (const item of mentions || []) {
      const name = item && item.name
      if (!name || next[name] !== undefined) continue

      // 미사용 인덱스 중 가장 낮은 번호 부여
      let idx = 0
      while (used.has(idx) && idx < MENTION_PALETTE_SIZE) idx++

      if (idx >= MENTION_PALETTE_SIZE) {
        // 모든 색 사용 중 — 이름 길이 기반 fallback (안정적)
        idx = name.length % MENTION_PALETTE_SIZE
      }

      next[name] = idx
      used.add(idx)
      changed = true
    }

    if (changed) writeLS(next)
    return next
  }, [mentions])
}
