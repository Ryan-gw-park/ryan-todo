import { useState, useCallback } from 'react'

// Loop 42: 피벗 매트릭스 펼침 상태 — localStorage 전용.
// useStore.collapseState(= ui_state 단일 row)는 per-project 상태 누적 시 cross-device 충돌 위험
// 있어 분리 저장. 사용자 로컬 UI 상태이므로 서버 동기화 불필요.

const KEY = 'matrixPivotExpanded'

function readLS() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') }
  catch { return {} }
}

function writeLS(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)) } catch {}
}

export default function usePivotExpandState() {
  const [pivotCollapsed, setState] = useState(readLS)
  const setPivotCollapsed = useCallback((pid, value) => {
    setState(prev => {
      const next = { ...prev, [pid]: value }
      writeLS(next)
      return next
    })
  }, [])
  return { pivotCollapsed, setPivotCollapsed }
}
