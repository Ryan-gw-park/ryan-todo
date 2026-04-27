import { useState, useCallback } from 'react'

// Loop 42: 피벗 매트릭스 펼침 상태 — localStorage 전용.
// Loop 44: scope 파라미터 추가 (team / personal 분리 저장).
// useStore.collapseState(= ui_state 단일 row)는 per-project 상태 누적 시 cross-device 충돌 위험
// 있어 분리 저장. 사용자 로컬 UI 상태이므로 서버 동기화 불필요.

const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
  personalSection: 'personalSectionExpanded',  // Loop-45 F-12: 다음/남은 섹션 접기 상태
  focusCardExpanded: 'focusCardExpanded',       // Loop-47 E-09: 포커스 카드 인라인 펼침 상태
}

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') }
  catch { return {} }
}

function writeLS(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)) } catch {}
}

export default function usePivotExpandState(scope = 'team') {
  const KEY = KEYS[scope] || KEYS.team
  const [pivotCollapsed, setState] = useState(() => readLS(KEY))
  const setPivotCollapsed = useCallback((pid, value) => {
    setState(prev => {
      const next = { ...prev, [pid]: value }
      writeLS(KEY, next)
      return next
    })
  }, [KEY])
  return { pivotCollapsed, setPivotCollapsed }
}
