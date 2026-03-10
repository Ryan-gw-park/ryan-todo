import { useRef, useCallback } from 'react'

/**
 * Shared outliner keyboard/focus logic.
 *
 * @param {Array} nodes - current [{text, level}, ...]
 * @param {Function} setNodes - state setter (accepts new array)
 * @param {Object} opts - { onExitUp, onExitDown } boundary callbacks
 * @returns {{ refs, handleKeyDown, focus }}
 */
export default function useOutliner(nodes, setNodes, { onExitUp, onExitDown } = {}) {
  const refs = useRef([])
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const exitUpRef = useRef(onExitUp)
  exitUpRef.current = onExitUp
  const exitDownRef = useRef(onExitDown)
  exitDownRef.current = onExitDown

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
    // ↑ — focus previous or exit
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx > 0) { focus(idx - 1); return }
      if (exitUpRef.current) exitUpRef.current()
      return
    }
    // ↓ — focus next or exit
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (idx < nodes.length - 1) { focus(idx + 1); return }
      if (exitDownRef.current) exitDownRef.current()
      return
    }
  }, [setNodes, focus])

  return { refs, handleKeyDown, focus }
}
