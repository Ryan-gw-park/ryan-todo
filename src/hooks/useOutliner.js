import { useRef, useCallback } from 'react'

/**
 * Shared outliner keyboard/focus logic.
 *
 * @param {Array} nodes - current [{text, level}, ...]
 * @param {Function} setNodes - state setter (accepts new array)
 * @param {Object} opts - { onExitUp, onExitDown } boundary callbacks
 * @returns {{ refs, handleKeyDown, focus }}
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

  /* ── Focus helper (runs after React commit) ── */
  const focus = useCallback((idx, pos = 'end') => {
    setTimeout(() => {
      const el = refs.current[idx]
      if (!el) return
      el.focus()
      const p = pos === 'end' ? el.value.length : (typeof pos === 'number' ? pos : 0)
      el.setSelectionRange(p, p)
    }, 30)
  }, [])

  /* ── Keyboard handler ── */
  const handleKeyDown = useCallback((e, idx) => {
    const nodes = nodesRef.current

    // Alt+Shift+↑ — swap with above
    if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx === 0) return
      const n = [...nodes]
      ;[n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]
      setNodes(n)
      focus(idx - 1)
      return
    }
    // Alt+Shift+↓ — swap with below
    if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault()
      if (idx >= nodes.length - 1) return
      const n = [...nodes]
      ;[n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]
      setNodes(n)
      focus(idx + 1)
      return
    }
    // Enter — split at cursor / delete empty
    if (e.key === 'Enter') {
      e.preventDefault()
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
    // Tab / Shift+Tab — indent / outdent
    if (e.key === 'Tab') {
      e.preventDefault()
      const d = e.shiftKey ? -1 : 1
      const nl = Math.max(0, Math.min(3, nodes[idx].level + d))
      if (d > 0 && idx > 0 && nl > nodes[idx - 1].level + 1) return
      const n = [...nodes]
      n[idx] = { ...n[idx], level: nl }
      setNodes(n)
      return
    }
    // Backspace on empty — delete + focus previous
    if (e.key === 'Backspace' && nodes[idx].text === '') {
      e.preventDefault()
      if (nodes.length <= 1) return
      setNodes(nodes.filter((_, j) => j !== idx))
      focus(Math.max(0, idx - 1))
      return
    }
    // ↑ — start → prev bullet end → prev bullet start → exit
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const el = e.target
      if (el.selectionStart !== 0) {
        // 현재 불릿 시작점으로 이동
        el.setSelectionRange(0, 0)
        return
      }
      // 이미 시작점 → 이전 불릿 끝점으로 이동
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
        // 현재 불릿 끝점으로 이동
        const len = el.value.length
        el.setSelectionRange(len, len)
        return
      }
      // 이미 끝점 → 다음 불릿 시작점으로 이동
      const vis = visibleRef.current
      if (vis) {
        const vPos = vis.indexOf(idx)
        if (vPos >= 0 && vPos < vis.length - 1) { focus(vis[vPos + 1], 'start'); return }
      } else if (idx < nodes.length - 1) { focus(idx + 1, 'start'); return }
      if (exitDownRef.current) exitDownRef.current()
      return
    }
  }, [setNodes, focus])

  /* ── Paste handler — split multi-line text into separate nodes ── */
  const handlePaste = useCallback((e, idx) => {
    const text = e.clipboardData?.getData('text/plain')
    if (!text || !text.includes('\n')) return // single-line → default behavior

    e.preventDefault()
    const nodes = nodesRef.current
    const cursor = e.target.selectionStart
    const selEnd = e.target.selectionEnd
    const before = nodes[idx].text.slice(0, cursor)
    const after = nodes[idx].text.slice(selEnd)

    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
    if (lines.length === 0) return

    const n = [...nodes]
    // First line merges with text before cursor
    const newNodes = [{ ...n[idx], text: before + lines[0] }]
    // Middle lines become new nodes at same level
    for (let i = 1; i < lines.length; i++) {
      newNodes.push({ text: lines[i], level: n[idx].level })
    }
    // Last new node gets the text after cursor appended
    newNodes[newNodes.length - 1] = {
      ...newNodes[newNodes.length - 1],
      text: newNodes[newNodes.length - 1].text + after
    }

    n.splice(idx, 1, ...newNodes)
    setNodes(n)
    // Focus last pasted line, cursor at end of pasted text (before 'after')
    const lastIdx = idx + newNodes.length - 1
    const lastPos = newNodes[newNodes.length - 1].text.length - after.length
    focus(lastIdx, lastPos)
  }, [setNodes, focus])

  return { refs, handleKeyDown, handlePaste, focus }
}
