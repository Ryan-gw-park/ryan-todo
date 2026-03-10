import { useState, useRef, useEffect } from 'react'
import { parseNotes, serializeNotes } from '../../utils/notes'
import { getBulletStyle } from '../../utils/colors'
import { PlusIcon, TrashIcon, IndentIcon, OutdentIcon } from './Icons'

export default function BulletNoteEditor({ notes, onChange, accentColor }) {
  const nodes = parseNotes(notes)
  const [focusIdx, setFocusIdx] = useState(null)
  const rowRefs = useRef([])

  const focusRow = (i) => {
    setTimeout(() => {
      const el = rowRefs.current[i]
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    }, 20)
  }

  const updateNode = (i, t) => {
    const n = [...nodes]; n[i] = { ...n[i], text: t }; onChange(serializeNotes(n))
  }

  const changeLevel = (i, d) => {
    const n = [...nodes]
    const nl = Math.max(0, Math.min(3, n[i].level + d))
    if (d > 0 && i > 0 && nl > n[i-1].level + 1) return
    n[i] = { ...n[i], level: nl }
    onChange(serializeNotes(n))
  }

  const handleKeyDown = (e, i) => {
    if (e.key === 'Tab') { e.preventDefault(); changeLevel(i, e.shiftKey ? -1 : 1) }
    else if (e.key === 'Enter') { e.preventDefault(); const n = [...nodes]; n.splice(i+1, 0, { text: '', level: nodes[i].level }); onChange(serializeNotes(n)); setFocusIdx(i+1) }
    else if (e.key === 'Backspace' && nodes[i].text === '') { e.preventDefault(); if (nodes.length <= 1) return; onChange(serializeNotes(nodes.filter((_, j) => j !== i))); setFocusIdx(Math.max(0, i-1)) }
    else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); focusRow(i-1) }
    else if (e.key === 'ArrowDown' && i < nodes.length-1) { e.preventDefault(); focusRow(i+1) }
  }

  useEffect(() => { if (focusIdx !== null) { focusRow(focusIdx); setFocusIdx(null) } }, [focusIdx, nodes.length])

  // If empty, show one empty row
  const displayNodes = nodes.length === 0 ? [{ text: '', level: 0 }] : nodes

  return (
    <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 6px', minHeight: 80 }}>
      {displayNodes.map((node, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0, paddingLeft: node.level * 22, minHeight: 30 }} className="bullet-row">
          <div style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={getBulletStyle(node.level, accentColor)} />
          </div>
          <input
            ref={el => rowRefs.current[i] = el}
            value={node.text}
            onChange={e => {
              if (nodes.length === 0) onChange(e.target.value)
              else updateNode(i, e.target.value)
            }}
            onKeyDown={e => handleKeyDown(e, i)}
            placeholder={i === 0 && displayNodes.length === 1 ? '노트를 입력하세요...' : ''}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, lineHeight: '22px', padding: '3px 4px', fontFamily: 'inherit', color: '#37352f', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }} className="bullet-actions">
            {node.level > 0 && <button onClick={() => changeLevel(i, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}><OutdentIcon /></button>}
            {node.level < 3 && i > 0 && <button onClick={() => changeLevel(i, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}><IndentIcon /></button>}
            <button onClick={() => onChange(serializeNotes(nodes.filter((_, j) => j !== i)))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 2, display: 'flex' }}><TrashIcon /></button>
          </div>
        </div>
      ))}
      <button
        onClick={() => { const n = [...nodes, { text: '', level: 0 }]; onChange(serializeNotes(n)); setFocusIdx(n.length - 1) }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#c8c8c8', fontSize: 12, fontFamily: 'inherit', marginTop: 2 }}
        onMouseEnter={e => e.currentTarget.style.color = accentColor}
        onMouseLeave={e => e.currentTarget.style.color = '#c8c8c8'}
      >
        <PlusIcon size={12} /> 추가
      </button>
      <div style={{ fontSize: 10, color: '#c8c8c8', padding: '2px 20px 0' }}>Tab 들여쓰기 · Shift+Tab 내어쓰기 · Enter 새 줄</div>
    </div>
  )
}
