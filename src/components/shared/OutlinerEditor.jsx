import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { parseNotes, serializeNotes } from '../../utils/notes'
import useOutliner from '../../hooks/useOutliner'
import OutlinerRow from './OutlinerRow'
import { PlusIcon } from './Icons'

/**
 * Shared bullet-note editor used by DetailPanel, MemoryView, and ProjectView.
 * Manages its own node state; syncs with parent via notes/onChange props.
 *
 * Exposes via ref: { focusFirst(), focusLast() } for cross-component navigation.
 */
const OutlinerEditor = forwardRef(function OutlinerEditor({ notes, onChange, accentColor, onExitUp, onExitDown }, ref) {
  const [nodes, setNodes] = useState(() => {
    const parsed = parseNotes(notes)
    return parsed.length ? parsed : [{ text: '', level: 0 }]
  })
  const lastEmitted = useRef(notes || '')
  const pendingAdd = useRef(false)

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

  /* ── Outliner keyboard / focus ── */
  const { refs, handleKeyDown, focus } = useOutliner(nodes, setNodes, { onExitUp, onExitDown })

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
      const nl = Math.max(0, Math.min(3, n[idx].level + d))
      if (d > 0 && idx > 0 && nl > n[idx - 1].level + 1) return prev
      n[idx] = { ...n[idx], level: nl }
      return n
    })
  }, [])

  const addNode = useCallback(() => {
    pendingAdd.current = true
    setNodes(prev => [...prev, { text: '', level: 0 }])
  }, [])

  return (
    <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 6px', minHeight: 80 }}>
      {nodes.map((node, i) => (
        <OutlinerRow
          key={i}
          node={node}
          idx={i}
          accentColor={accentColor}
          inputRef={el => refs.current[i] = el}
          onTextChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onDelete={handleDelete}
          onChangeLevel={handleChangeLevel}
          showPlaceholder={i === 0 && nodes.length === 1 && !nodes[0].text}
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
      <div style={{ fontSize: 10, color: '#c8c8c8', padding: '2px 20px 0' }}>
        Tab 들여쓰기 · Shift+Tab 내어쓰기 · Enter 새 줄/분리 · Alt+Shift+↑↓ 이동
      </div>
    </div>
  )
})

export default OutlinerEditor
