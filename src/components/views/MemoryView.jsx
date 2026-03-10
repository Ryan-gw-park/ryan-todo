import { useState, useRef, useEffect, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import { COLOR_OPTIONS } from '../../utils/colors'
import { PlusIcon, TrashIcon, GripIcon } from '../shared/Icons'
import OutlinerEditor from '../shared/OutlinerEditor'

export default function MemoryView() {
  const { memos, addMemo } = useStore()
  const isMobile = window.innerWidth < 768

  const handleAdd = () => {
    addMemo({ title: '', notes: '' })
  }

  return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#37352f', margin: 0 }}>메모리</h1>
          <button onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #e8e8e8', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: '#37352f', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8f8f8' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
          >
            <PlusIcon size={13} /> 새 메모
          </button>
        </div>

        {/* Memo cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memos.map(memo => (
            <MemoCard key={memo.id} memo={memo} />
          ))}

          {/* Add card button */}
          <button onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, borderRadius: 10, border: '2px dashed #e0e0e0', background: 'transparent', cursor: 'pointer', color: '#bbb', fontSize: 13, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ccc'; e.currentTarget.style.color = '#999' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#bbb' }}
          >
            <PlusIcon size={14} /> 새 메모 추가
          </button>
        </div>
      </div>
    </div>
  )
}

function MemoCard({ memo }) {
  const { updateMemo, deleteMemo } = useStore()
  const [title, setTitle] = useState(memo.title)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => { setTitle(memo.title) }, [memo.title])

  // Auto-focus title on new empty memo
  useEffect(() => {
    if (!memo.title && titleRef.current) titleRef.current.focus()
  }, [])

  const saveTitle = () => {
    if (title !== memo.title) updateMemo(memo.id, { title })
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle(); titleRef.current?.blur() }
    if (e.key === 'Escape') { setTitle(memo.title); titleRef.current?.blur() }
  }

  const handleNotesChange = useCallback((newNotes) => {
    updateMemo(memo.id, { notes: newNotes })
  }, [memo.id, updateMemo])

  const handleDelete = () => {
    if (memo.title || (memo.notes && memo.notes.trim())) {
      if (!confirm('이 메모를 삭제하시겠습니까?')) return
    }
    deleteMemo(memo.id)
  }

  const colorObj = COLOR_OPTIONS.find(c => c.key === memo.color) || COLOR_OPTIONS[0]
  const accentColor = colorObj.dot

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div style={{ position: 'relative', background: 'white', border: '1px solid #e8e8e8', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Color bar */}
      <div
        onClick={() => setShowColorPicker(p => !p)}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accentColor, cursor: 'pointer', borderRadius: '10px 0 0 10px' }}
      />

      {/* Color picker popup */}
      {showColorPicker && (
        <div style={{ position: 'absolute', left: 12, top: 8, background: 'white', border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, display: 'flex', gap: 4, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {COLOR_OPTIONS.map(c => (
            <div
              key={c.key}
              onClick={() => { updateMemo(memo.id, { color: c.key }); setShowColorPicker(false) }}
              style={{ width: 20, height: 20, borderRadius: 4, background: c.dot, cursor: 'pointer', border: memo.color === c.key ? '2px solid #37352f' : '2px solid transparent' }}
            />
          ))}
        </div>
      )}

      <div style={{ padding: '16px 20px 12px 20px', marginLeft: 4 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={handleTitleKeyDown}
            placeholder="메모 제목..."
            style={{ flex: 1, fontSize: 16, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: '#37352f', fontFamily: 'inherit', padding: 0 }}
          />
          <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'flex', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
            onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
          >
            <TrashIcon />
          </button>
        </div>

        {/* Notes — OutlinerEditor */}
        <OutlinerEditor notes={memo.notes} onChange={handleNotesChange} accentColor={accentColor} />

        {/* Created date */}
        <div style={{ fontSize: 11, color: '#ccc', marginTop: 8, textAlign: 'right' }}>
          {formatDate(memo.createdAt)}
        </div>
      </div>
    </div>
  )
}
