import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { parseNotes, serializeNotes } from '../../utils/notes'
import useOutliner from '../../hooks/useOutliner'
import OutlinerRow from './OutlinerRow'
import { PlusIcon } from './Icons'

const MAX_LEVEL = 9

/**
 * Shared bullet-note editor used by DetailPanel, MemoryView, and ProjectView.
 * Manages its own node state; syncs with parent via notes/onChange props.
 *
 * Exposes via ref: { focusFirst(), focusLast() } for cross-component navigation.
 */
const OutlinerEditor = forwardRef(function OutlinerEditor({ notes, onChange, accentColor, onExitUp, onExitDown, allTopCollapsed }, ref) {
  const [nodes, setNodes] = useState(() => {
    const parsed = parseNotes(notes)
    return parsed.length ? parsed : [{ text: '', level: 0 }]
  })
  const lastEmitted = useRef(notes || '')
  const pendingAdd = useRef(false)
  const [collapsed, setCollapsed] = useState({}) // { [nodeIndex]: true }
  const [selectedSet, setSelectedSet] = useState(new Set())

  /* ── Sync from parent (external edits) ── */
  useEffect(() => {
    if (notes !== lastEmitted.current) {
      const parsed = parseNotes(notes)
      setNodes(parsed.length ? parsed : [{ text: '', level: 0 }])
      lastEmitted.current = notes || ''
    }
  }, [notes])

  /* ── Emit local changes to parent ── */
  useEffect(() => {
    const serialized = serializeNotes(nodes)
    if (serialized !== lastEmitted.current) {
      lastEmitted.current = serialized
      onChange(serialized)
    }
  }, [nodes, onChange])

  /* ── Apply allTopCollapsed from parent ── */
  useEffect(() => {
    if (allTopCollapsed === undefined) return
    const next = {}
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].level === 0 && i + 1 < nodes.length && nodes[i + 1].level > 0) {
        next[i] = allTopCollapsed
      }
    }
    setCollapsed(prev => {
      const merged = { ...prev }
      for (const k of Object.keys(next)) {
        merged[k] = next[k]
      }
      return merged
    })
  }, [allTopCollapsed])

  /* ── Determine which nodes have children and which are hidden ── */
  const hasChildren = (idx) => {
    return idx + 1 < nodes.length && nodes[idx + 1].level > nodes[idx].level
  }

  const visibleIndices = []
  const hiddenSet = new Set()
  for (let i = 0; i < nodes.length; i++) {
    if (hiddenSet.has(i)) continue
    visibleIndices.push(i)
    if (collapsed[i] && hasChildren(i)) {
      const parentLevel = nodes[i].level
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].level > parentLevel) hiddenSet.add(j)
        else break
      }
    }
  }

  /* ── Outliner keyboard / focus ── */
  const { refs, handleKeyDown, handlePaste, focus, selectionRef, onSelectionChange, clearSelection } = useOutliner(nodes, setNodes, { onExitUp, onExitDown, visibleIndices })

  /* ── Wire selection change callback ── */
  useEffect(() => {
    onSelectionChange.current = (sel) => {
      if (!sel) { setSelectedSet(new Set()); return }
      const [a, b] = sel
      const min = Math.min(a, b), max = Math.max(a, b)
      const s = new Set()
      for (let i = min; i <= max; i++) s.add(i)
      setSelectedSet(s)
    }
  }, [onSelectionChange])

  /* ── Expose focusFirst/focusLast for parent navigation ── */
  useImperativeHandle(ref, () => ({
    focusFirst: () => focus(0, 'end'),
    focusLast: () => focus(nodes.length - 1, 'end'),
  }))

  /* ── Focus newly added node ── */
  useEffect(() => {
    if (pendingAdd.current) {
      pendingAdd.current = false
      focus(nodes.length - 1, 'start')
    }
  }, [nodes.length, focus])

  /* ── Text change (per-keystroke) ── */
  const handleTextChange = useCallback((idx, text) => {
    setNodes(prev => {
      const n = [...prev]
      n[idx] = { ...n[idx], text }
      return n
    })
  }, [])

  /* ── Button handlers ── */
  const handleDelete = useCallback((idx) => {
    setNodes(prev => prev.filter((_, j) => j !== idx))
  }, [])

  const handleChangeLevel = useCallback((idx, d) => {
    setNodes(prev => {
      const n = [...prev]
      const nl = Math.max(0, Math.min(MAX_LEVEL, n[idx].level + d))
      if (d > 0 && idx > 0 && nl > n[idx - 1].level + 1) return prev
      n[idx] = { ...n[idx], level: nl }
      return n
    })
  }, [])

  const addNode = useCallback(() => {
    pendingAdd.current = true
    setNodes(prev => [...prev, { text: '', level: 0 }])
  }, [])

  const toggleCollapse = useCallback((idx) => {
    setCollapsed(prev => ({ ...prev, [idx]: !prev[idx] }))
  }, [])

  /* ── Mouse selection ── */
  const handleRowMouseDown = useCallback((e, idx) => {
    if (e.shiftKey) {
      e.preventDefault()
      const sel = selectionRef.current
      const anchor = sel ? sel[0] : idx
      if (anchor === idx) {
        clearSelection()
      } else {
        const min = Math.min(anchor, idx), max = Math.max(anchor, idx)
        const s = new Set()
        for (let i = min; i <= max; i++) s.add(i)
        selectionRef.current = [anchor, idx]
        setSelectedSet(s)
      }
    } else {
      if (selectedSet.size > 0) {
        clearSelection()
      }
    }
  }, [selectedSet, clearSelection, selectionRef])

  return (
    <div style={{ padding: '4px 0', minHeight: 40 }}>
      {visibleIndices.map(i => (
        <OutlinerRow
          key={i}
          node={nodes[i]}
          idx={i}
          accentColor={accentColor}
          inputRef={el => refs.current[i] = el}
          onTextChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDelete={handleDelete}
          onChangeLevel={handleChangeLevel}
          showPlaceholder={false}
          hasChildren={hasChildren(i)}
          isCollapsed={!!collapsed[i]}
          onToggleCollapse={() => toggleCollapse(i)}
          selected={selectedSet.has(i)}
          onMouseDown={(e) => handleRowMouseDown(e, i)}
        />
      ))}
      <button
        onClick={addNode}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#c8c8c8', fontSize: 12, fontFamily: 'inherit', marginTop: 2 }}
        onMouseEnter={e => e.currentTarget.style.color = accentColor}
        onMouseLeave={e => e.currentTarget.style.color = '#c8c8c8'}
      >
        <PlusIcon size={12} /> 추가
      </button>
    </div>
  )
})

export default OutlinerEditor
