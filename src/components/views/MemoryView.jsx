import { useState, useRef, useEffect, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import { COLOR_OPTIONS } from '../../utils/colors'
import { PlusIcon, TrashIcon } from '../shared/Icons'
import OutlinerEditor from '../shared/OutlinerEditor'

/* ═══════════════════════════════════════════════════════
   MemoryView v2 — 1열 리스트(좌측) + 우측 상세 패널
   ═══════════════════════════════════════════════════════ */

/* ─── 좌측 리스트 항목 ─── */
function MemoListItem({ memo, isSelected, onSelect, onDelete }) {
  const [hover, setHover] = useState(false)
  const colorObj = COLOR_OPTIONS.find(c => c.id === memo.color) || COLOR_OPTIONS[0]

  return (
    <div
      onClick={() => onSelect(memo.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', cursor: 'pointer',
        background: isSelected ? colorObj.card : (hover ? '#f5f4f0' : 'transparent'),
        borderBottom: '0.5px solid #f0efe8',
        borderLeft: isSelected ? `3px solid ${colorObj.dot}` : '3px solid transparent',
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 2, background: colorObj.dot, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 13, fontWeight: isSelected ? 600 : 400,
        color: isSelected ? '#2C2C2A' : '#6b6a66',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {memo.title || '제목 없음'}
      </span>
      {hover && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(memo) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2, display: 'flex', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
          onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  )
}

/* ─── 우측 상세 패널 ─── */
function MemoDetailPane({ memo, onBack, isMobile }) {
  const { updateMemo, deleteMemo } = useStore()
  const [title, setTitle] = useState(memo.title)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const titleRef = useRef(null)
  const editorRef = useRef(null)
  const colorPickerRef = useRef(null)

  const colorObj = COLOR_OPTIONS.find(c => c.id === memo.color) || COLOR_OPTIONS[0]

  useEffect(() => { setTitle(memo.title) }, [memo.id, memo.title])

  // Auto-focus title on new empty memo
  useEffect(() => {
    if (!memo.title && titleRef.current) titleRef.current.focus()
  }, [memo.id])

  // Click-outside for color picker
  useEffect(() => {
    if (!showColorPicker) return
    const handler = (e) => { if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) setShowColorPicker(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColorPicker])

  const saveTitle = () => {
    if (title !== memo.title) updateMemo(memo.id, { title })
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
      setTimeout(() => editorRef.current?.focusFirst(), 50)
    }
    if (e.key === 'Escape') { setTitle(memo.title); titleRef.current?.blur() }
  }

  const handleDelete = () => {
    if (memo.title || (memo.notes && memo.notes.trim())) {
      if (!confirm('이 노트를 삭제하시겠습니까?')) return
    }
    deleteMemo(memo.id)
    onBack?.()
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0efe8', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {isMobile && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18, padding: '2px 6px', borderRadius: 6 }}>←</button>
        )}
        {/* Color dot (clickable) */}
        <div style={{ position: 'relative' }} ref={colorPickerRef}>
          <div
            onClick={() => setShowColorPicker(p => !p)}
            style={{ width: 12, height: 12, borderRadius: 3, background: colorObj.dot, cursor: 'pointer', flexShrink: 0 }}
          />
          {showColorPicker && (
            <div style={{ position: 'absolute', left: 0, top: 20, background: 'white', border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, display: 'flex', gap: 4, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
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
        {/* Title */}
        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={handleTitleKeyDown}
          placeholder="노트 제목..."
          style={{ flex: 1, fontSize: 18, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: '#37352f', fontFamily: 'inherit', padding: 0, minWidth: 0 }}
        />
        {/* Delete */}
        <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'flex', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
          onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
        >
          <TrashIcon />
        </button>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ background: colorObj.card, borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.04)', minHeight: 300 }}>
          <OutlinerEditor
            ref={editorRef}
            notes={memo.notes}
            onChange={(newNotes) => updateMemo(memo.id, { notes: newNotes })}
            accentColor={colorObj.dot}
          />
        </div>
        {/* 타임스탬프 */}
        <div style={{ marginTop: 12, fontSize: 12, color: '#a09f99', textAlign: 'right' }}>
          {formatDate(memo.updatedAt || memo.createdAt)}
        </div>
      </div>
    </div>
  )
}

/* ─── 메인 뷰 ─── */
export default function MemoryView() {
  const { memos, addMemo, deleteMemo } = useStore()
  const isMobile = window.innerWidth < 768
  const [selectedId, setSelectedId] = useState(null)
  const selectedMemo = selectedId ? memos.find(m => m.id === selectedId) : null

  // 선택된 메모가 삭제되면 해제
  useEffect(() => {
    if (selectedId && !memos.find(m => m.id === selectedId)) {
      setSelectedId(memos.length > 0 ? memos[0].id : null)
    }
  }, [memos, selectedId])

  const handleAdd = useCallback(() => {
    const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].id
    const newMemo = addMemo({ title: '', notes: '', color: randomColor })
    if (newMemo) setSelectedId(newMemo.id)
  }, [addMemo])

  const handleDelete = useCallback((memo) => {
    if (memo.title || (memo.notes && memo.notes.trim())) {
      if (!confirm('이 노트를 삭제하시겠습니까?')) return
    }
    deleteMemo(memo.id)
  }, [deleteMemo])

  // Alt+N to add new memo
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        handleAdd()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleAdd])

  // 키보드: ArrowUp/Down으로 리스트 내비게이션
  useEffect(() => {
    const handler = (e) => {
      if (!selectedId) return
      const idx = memos.findIndex(m => m.id === selectedId)
      if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault()
        if (idx > 0) setSelectedId(memos[idx - 1].id)
      }
      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault()
        if (idx < memos.length - 1) setSelectedId(memos[idx + 1].id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedId, memos])

  // 모바일: 선택 시 상세만 표시
  if (isMobile && selectedMemo) {
    return (
      <div data-view="memory" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <MemoDetailPane memo={selectedMemo} onBack={() => setSelectedId(null)} isMobile />
      </div>
    )
  }

  return (
    <div data-view="memory" style={{ height: '100%', display: 'flex' }}>
      {/* 좌측 리스트 */}
      <div style={{
        width: isMobile ? '100%' : 300, flexShrink: 0,
        borderRight: isMobile ? 'none' : '1px solid #e8e6df',
        display: 'flex', flexDirection: 'column', height: '100%',
        background: '#fafaf8',
      }}>
        {/* 리스트 헤더 */}
        <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid #e8e6df', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#37352f' }}>노트</span>
          <button onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #e8e8e8', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: '#6b6a66' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <PlusIcon size={11} /> 새 노트
          </button>
        </div>

        {/* 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {memos.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#a09f99', fontSize: 13 }}>
              노트가 없습니다<br /><span style={{ fontSize: 11 }}>Alt+N으로 새 노트 추가</span>
            </div>
          )}
          {memos.map(memo => (
            <MemoListItem
              key={memo.id}
              memo={memo}
              isSelected={selectedId === memo.id}
              onSelect={setSelectedId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {/* 우측 상세 패널 */}
      {!isMobile && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {selectedMemo ? (
            <MemoDetailPane memo={selectedMemo} isMobile={false} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a09f99', fontSize: 14 }}>
              노트를 선택하세요
            </div>
          )}
        </div>
      )}
    </div>
  )
}
