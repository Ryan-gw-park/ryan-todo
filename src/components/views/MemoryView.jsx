import { useState, useRef, useEffect, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import { COLOR_OPTIONS } from '../../utils/colors'
import { PlusIcon, TrashIcon } from '../shared/Icons'
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#37352f', margin: 0 }}>메모</h1>
          <button onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #e8e8e8', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: '#37352f', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8f8f8' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
          >
            <PlusIcon size={13} /> 새 메모
          </button>
        </div>

        {/* Memo cards — 2-column grid like TodayView */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
          {memos.map(memo => (
            <MemoCard key={memo.id} memo={memo} />
          ))}

          {/* Add card button */}
          <button onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, borderRadius: 10, border: '2px dashed #e0e0e0', background: 'transparent', cursor: 'pointer', color: '#bbb', fontSize: 13, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s', minHeight: 100 }}
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
  const editorRef = useRef(null)

  useEffect(() => { setTitle(memo.title) }, [memo.title])

  // Auto-focus title on new empty memo
  useEffect(() => {
    if (!memo.title && titleRef.current) titleRef.current.focus()
  }, [])

  const saveTitle = () => {
    if (title !== memo.title) updateMemo(memo.id, { title })
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
      // Move cursor to bullet editor
      setTimeout(() => editorRef.current?.focusFirst(), 50)
    }
    if (e.key === 'Escape') { setTitle(memo.title); titleRef.current?.blur() }
  }

  const handleNotesChange = useCallback((newNotes) => {
    updateMemo(memo.id, { notes: newNotes })
  }, [memo.id, updateMemo])

  // When exiting up from the editor, focus back to title
  const handleEditorExitUp = useCallback(() => {
    setTimeout(() => {
      const el = titleRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, 30)
  }, [])

  const handleDelete = () => {
    if (memo.title || (memo.notes && memo.notes.trim())) {
      if (!confirm('이 메모를 삭제하시겠습니까?')) return
    }
    deleteMemo(memo.id)
  }

  const colorObj = COLOR_OPTIONS.find(c => c.id === memo.color) || COLOR_OPTIONS[0]

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div style={{ background: colorObj.card, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.04)' }}>
      {/* Header — like project card */}
      <div style={{ background: colorObj.header, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        {/* Color dot — click to open color picker */}
        <div
          onClick={() => setShowColorPicker(p => !p)}
          style={{ width: 10, height: 10, borderRadius: 3, background: colorObj.dot, cursor: 'pointer', flexShrink: 0 }}
        />
        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={handleTitleKeyDown}
          placeholder="메모 제목..."
          style={{ flex: 1, fontSize: 14, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: colorObj.text, fontFamily: 'inherit', padding: 0, minWidth: 0 }}
        />
        <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'flex', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
          onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
        >
          <TrashIcon />
        </button>

        {/* Color picker popup */}
        {showColorPicker && (
          <div style={{ position: 'absolute', left: 8, top: 40, background: 'white', border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, display: 'flex', gap: 4, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {COLOR_OPTIONS.map(c => (
              <div
                key={c.id}
                onClick={() => { updateMemo(memo.id, { color: c.id }); setShowColorPicker(false) }}
                style={{ width: 20, height: 20, borderRadius: 4, background: c.dot, cursor: 'pointer', border: memo.color === c.id ? '2px solid #37352f' : '2px solid transparent' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body — notes editor */}
      <div style={{ padding: '10px 16px 8px' }}>
        <OutlinerEditor
          ref={editorRef}
          notes={memo.notes}
          onChange={handleNotesChange}
          accentColor={colorObj.dot}
          onExitUp={handleEditorExitUp}
        />

        {/* Created date */}
        <div style={{ fontSize: 11, color: '#ccc', marginTop: 6, textAlign: 'right' }}>
          {formatDate(memo.createdAt)}
        </div>
      </div>
    </div>
  )
}
