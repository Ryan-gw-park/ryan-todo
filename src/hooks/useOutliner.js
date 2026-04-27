import { useRef, useCallback, useEffect, useLayoutEffect } from 'react'

const MAX_LEVEL = 9
const MAX_UNDO = 50

/**
 * Shared outliner keyboard/focus logic.
 *
 * Features:
 * - Arrow / Enter / Backspace navigation
 * - Tab / Shift+Tab indent (with children follow)
 * - Shift+Arrow block selection + bulk indent
 * - Ctrl+Z undo
 * - Alt+Shift+Arrow reorder
 * - Paste multi-line
 */
export default function useOutliner(nodes, setNodes, { onExitUp, onExitDown, visibleIndices } = {}) {
  const refs = useRef([])
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const exitUpRef = useRef(onExitUp)
  exitUpRef.current = onExitUp
  const exitDownRef = useRef(onExitDown)
  exitDownRef.current = onExitDown
  const visibleRef = useRef(visibleIndices)
  visibleRef.current = visibleIndices

  // Selection state: [anchorIdx, focusIdx] or null
  const selectionRef = useRef(null)
  const onSelectionChange = useRef(null) // set by OutlinerEditor

  // Undo stack
  const undoStack = useRef([])
  const lastUndoTime = useRef(0)
  const trailingTimer = useRef(null)

  const pushUndoImmediate = useCallback(() => {
    const snap = JSON.stringify(nodesRef.current)
    const stack = undoStack.current
    if (stack.length > 0 && stack[stack.length - 1] === snap) return
    stack.push(snap)
    if (stack.length > MAX_UNDO) stack.shift()
  }, [])

  // Leading + trailing 500ms throttle — 입력 시작 직전 + 입력 종료 직후 양쪽 보존
  // W-NEW-2: trailing 콜백에서 lastUndoTime 갱신 금지 — leading 억제 방지 (R-03 #2 보호)
  const pushUndoThrottled = useCallback(() => {
    const now = Date.now()
    clearTimeout(trailingTimer.current)
    if (now - lastUndoTime.current >= 500) {
      lastUndoTime.current = now
      pushUndoImmediate()  // leading edge — lastUndoTime 갱신
    }
    trailingTimer.current = setTimeout(() => {
      pushUndoImmediate()  // trailing edge — lastUndoTime 갱신 안 함 (W-NEW-2)
    }, 500)
  }, [pushUndoImmediate])

  // 기존 pushUndo 시그니처 보존 — discrete 작업 (Tab/Enter/Backspace/Swap/Paste/Undo) 은 immediate
  const pushUndo = pushUndoImmediate

  // unmount 시 trailingTimer cleanup
  useEffect(() => () => clearTimeout(trailingTimer.current), [])

  /* ── Focus helper — hybrid (useLayoutEffect + rAF fallback) ── */
  const pendingFocus = useRef(null)

  // applyFocus: pendingFocus.current 직접 읽기 (no-arg)
  const applyFocus = useCallback(() => {
    if (!pendingFocus.current) return
    const { idx, pos } = pendingFocus.current
    pendingFocus.current = null
    const el = refs.current[idx]
    if (!el) return
    el.focus()
    const p = pos === 'end' ? el.value.length : (typeof pos === 'number' ? pos : 0)
    el.setSelectionRange(p, p)
  }, [])

  // rAF wrapper — DOMHighResTimeStamp 인자 무시
  const rafApplyFocus = useCallback(() => { applyFocus() }, [applyFocus])

  const focus = useCallback((idx, pos = 'end') => {
    pendingFocus.current = { idx, pos }
    // Fallback: setNodes/setState 미동반 경로 (arrow nav, imperative) 용
    // setNodes 동반 경로는 useLayoutEffect 가 commit 직후 처리하여 pendingFocus null 로 만듦
    requestAnimationFrame(rafApplyFocus)
  }, [rafApplyFocus])

  // useLayoutEffect: 매 commit 후 pendingFocus 처리 (no-dep, null 체크로 cost 무시)
  // ESLint react-hooks/exhaustive-deps 경고 회피 위해 화살표 함수로 래핑
  useLayoutEffect(() => { applyFocus() })

  /* ── Selection helpers ── */
  const getSelection = () => selectionRef.current
  const setSelection = (sel) => {
    selectionRef.current = sel
    if (onSelectionChange.current) onSelectionChange.current(sel)
  }
  const clearSelection = () => setSelection(null)

  const getSelectedRange = () => {
    const sel = selectionRef.current
    if (!sel) return null
    const [a, b] = sel
    return [Math.min(a, b), Math.max(a, b)]
  }

  /* ── Get children range of a node (for subtree operations) ── */
  const getChildrenEnd = (nodes, idx) => {
    const parentLevel = nodes[idx].level
    let end = idx
    for (let j = idx + 1; j < nodes.length; j++) {
      if (nodes[j].level > parentLevel) end = j
      else break
    }
    return end
  }

  /* ── Keyboard handler ── */
  const handleKeyDown = useCallback((e, idx) => {
    const nodes = nodesRef.current

    // Ctrl+Z — undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      const stack = undoStack.current
      if (stack.length === 0) return
      const prev = JSON.parse(stack.pop())
      setNodes(prev)
      focus(Math.min(idx, prev.length - 1))
      return
    }

    // Shift+Arrow — block selection
    if (e.shiftKey && !e.altKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const sel = getSelection()
      if (!sel) {
        // Start selection from current
        const nextIdx = e.key === 'ArrowUp' ? Math.max(0, idx - 1) : Math.min(nodes.length - 1, idx + 1)
        if (nextIdx !== idx) {
          setSelection([idx, nextIdx])
          focus(nextIdx)
        }
      } else {
        // Extend selection
        const [anchor, foc] = sel
        const nextFoc = e.key === 'ArrowUp' ? Math.max(0, foc - 1) : Math.min(nodes.length - 1, foc + 1)
        if (anchor === nextFoc) {
          clearSelection()
        } else {
          setSelection([anchor, nextFoc])
        }
        focus(nextFoc)
      }
      return
    }

    // Tab / Shift+Tab — indent/outdent (with selection or subtree support)
    if (e.key === 'Tab') {
      e.preventDefault()
      pushUndo()
      const d = e.shiftKey ? -1 : 1
      const sel = getSelectedRange()

      if (sel) {
        // Bulk indent selected range
        const [start, end] = sel
        const n = [...nodes]
        let changed = false
        for (let i = start; i <= end; i++) {
          const nl = Math.max(0, Math.min(MAX_LEVEL, n[i].level + d))
          if (d > 0 && i > 0 && nl > n[i - 1].level + 1) continue
          if (nl !== n[i].level) { n[i] = { ...n[i], level: nl }; changed = true }
        }
        if (changed) setNodes(n)
        return
      }

      // Single node: move with children
      const childEnd = getChildrenEnd(nodes, idx)
      const n = [...nodes]
      let changed = false
      for (let i = idx; i <= childEnd; i++) {
        const nl = Math.max(0, Math.min(MAX_LEVEL, n[i].level + d))
        if (d > 0 && i === idx && idx > 0 && nl > n[idx - 1].level + 1) return
        if (nl !== n[i].level) { n[i] = { ...n[i], level: nl }; changed = true }
      }
      if (changed) setNodes(n)
      return
    }

    // Clear selection on non-shift/non-ctrl key
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && e.key !== 'Tab') {
      if (getSelection()) clearSelection()
    }

    // Alt+Shift+↑ — swap with above (including children, Option β: parent-boundary outdent)
    if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx === 0) return
      const childEnd = getChildrenEnd(nodes, idx)
      const block = nodes.slice(idx, childEnd + 1)
      const myLevel = nodes[idx].level
      // 위쪽으로 traverse — 같은 level 또는 더 작은 level 노드 찾기
      let insertAt = -1
      for (let j = idx - 1; j >= 0; j--) {
        if (nodes[j].level <= myLevel) { insertAt = j; break }
      }
      if (insertAt === -1) return
      pushUndo()
      // Option β level 보정: 매치된 노드가 더 낮은 level 이면 block 전체 outdent (자식 간 상대 level 차 보존)
      const targetLevel = nodes[insertAt].level
      const delta = targetLevel - myLevel
      const adjustedBlock = delta === 0 ? block : block.map(n => ({ ...n, level: n.level + delta }))
      const n = [...nodes]
      n.splice(idx, block.length)
      n.splice(insertAt, 0, ...adjustedBlock)
      setNodes(n)
      focus(insertAt)
      return
    }
    // Alt+Shift+↓ — swap with below (including children, Option β: sibling-boundary outdent)
    if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault()
      const childEnd = getChildrenEnd(nodes, idx)
      if (childEnd >= nodes.length - 1) return
      const myLevel = nodes[idx].level
      // 다음 형제(같은 level 또는 더 작은 level)의 subtree 끝 찾기
      let nextStart = -1
      for (let j = childEnd + 1; j < nodes.length; j++) {
        if (nodes[j].level <= myLevel) { nextStart = j; break }
      }
      if (nextStart === -1) return
      const nextEnd = getChildrenEnd(nodes, nextStart)
      pushUndo()
      const block = nodes.slice(idx, childEnd + 1)
      // Option β level 보정: nextStart 가 더 낮은 level 이면 block 전체 outdent
      const targetLevel = nodes[nextStart].level
      const delta = targetLevel - myLevel
      const adjustedBlock = delta === 0 ? block : block.map(n => ({ ...n, level: n.level + delta }))
      const n = [...nodes]
      n.splice(idx, block.length)
      // block 제거 후 nextEnd 의 실 위치 = nextEnd - block.length, 그 다음 위치 = +1
      const insertAt = nextEnd - block.length + 1
      n.splice(insertAt, 0, ...adjustedBlock)
      setNodes(n)
      focus(insertAt)
      return
    }
    // Enter — split at cursor / delete empty
    if (e.key === 'Enter') {
      e.preventDefault()
      pushUndo()
      const cursor = e.target.selectionStart
      const before = nodes[idx].text.slice(0, cursor)
      const after = nodes[idx].text.slice(cursor)

      if (!before && !after) {
        if (nodes.length <= 1) return
        setNodes(nodes.filter((_, j) => j !== idx))
        if (idx > 0) focus(idx - 1)
        return
      }
      const n = [...nodes]
      n[idx] = { ...n[idx], text: before }
      n.splice(idx + 1, 0, { text: after, level: nodes[idx].level })
      setNodes(n)
      focus(idx + 1, 'start')
      return
    }
    // Backspace on empty — delete + focus previous
    if (e.key === 'Backspace' && nodes[idx].text === '') {
      e.preventDefault()
      if (nodes.length <= 1) return
      pushUndo()
      setNodes(nodes.filter((_, j) => j !== idx))
      focus(Math.max(0, idx - 1))
      return
    }
    // ↑ — start → prev bullet end → prev bullet start → exit
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const el = e.target
      if (el.selectionStart !== 0) {
        el.setSelectionRange(0, 0)
        return
      }
      const vis = visibleRef.current
      if (vis) {
        const vPos = vis.indexOf(idx)
        if (vPos > 0) { focus(vis[vPos - 1], 'end'); return }
      } else if (idx > 0) { focus(idx - 1, 'end'); return }
      if (exitUpRef.current) exitUpRef.current()
      return
    }
    // ↓ — end → next bullet start → next bullet end → exit
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const el = e.target
      if (el.selectionStart !== el.value.length) {
        const len = el.value.length
        el.setSelectionRange(len, len)
        return
      }
      const vis = visibleRef.current
      if (vis) {
        const vPos = vis.indexOf(idx)
        if (vPos >= 0 && vPos < vis.length - 1) { focus(vis[vPos + 1], 'start'); return }
      } else if (idx < nodes.length - 1) { focus(idx + 1, 'start'); return }
      if (exitDownRef.current) exitDownRef.current()
      return
    }

    // Any other character input → push undo (leading + trailing throttled)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      pushUndoThrottled()
    }
  }, [setNodes, focus, pushUndo, pushUndoThrottled])

  /* ── Paste handler — split multi-line text into separate nodes ── */
  const handlePaste = useCallback((e, idx) => {
    const text = e.clipboardData?.getData('text/plain')
    if (!text || !text.includes('\n')) return // single-line → default behavior

    e.preventDefault()
    pushUndo()
    const nodes = nodesRef.current
    const cursor = e.target.selectionStart
    const selEnd = e.target.selectionEnd
    const before = nodes[idx].text.slice(0, cursor)
    const after = nodes[idx].text.slice(selEnd)

    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
    if (lines.length === 0) return

    const n = [...nodes]
    const newNodes = [{ ...n[idx], text: before + lines[0] }]
    for (let i = 1; i < lines.length; i++) {
      newNodes.push({ text: lines[i], level: n[idx].level })
    }
    newNodes[newNodes.length - 1] = {
      ...newNodes[newNodes.length - 1],
      text: newNodes[newNodes.length - 1].text + after
    }

    n.splice(idx, 1, ...newNodes)
    setNodes(n)
    const lastIdx = idx + newNodes.length - 1
    const lastPos = newNodes[newNodes.length - 1].text.length - after.length
    focus(lastIdx, lastPos)
  }, [setNodes, focus, pushUndo])

  return { refs, handleKeyDown, handlePaste, focus, selectionRef, onSelectionChange, clearSelection, pushUndo, pushUndoThrottled }
}
