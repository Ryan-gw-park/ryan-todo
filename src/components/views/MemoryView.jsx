import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import useStore from '../../hooks/useStore'
import { COLOR_OPTIONS } from '../../utils/colors'
import { PlusIcon, TrashIcon, ChevronIcon } from '../shared/Icons'
import OutlinerEditor from '../shared/OutlinerEditor'

const MemoCard = forwardRef(function MemoCard({ memo, onExitDown, onExitUp, bodyCollapsed, onToggleBody, allTopCollapsed, onToggleAllTop, onOpenFullscreen }, ref) {
  const { updateMemo, deleteMemo } = useStore()
  const [title, setTitle] = useState(memo.title)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const titleRef = useRef(null)
  const editorRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focusTitle() {
      const el = titleRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    },
    focusLast() {
      if (bodyCollapsed) {
        const el = titleRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      } else {
        editorRef.current?.focusLast()
      }
    }
  }))

  useEffect(() => { setTitle(memo.title) }, [memo.title])

  // Auto-focus title on new empty memo
  useEffect(() => {
    if (!memo.title && titleRef.current) titleRef.current.focus()
  }, [])

  const saveTitle = () => {
    if (title !== memo.title) updateMemo(memo.id, { title })
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      saveTitle()
      if (bodyCollapsed) {
        onExitDown?.()
      } else {
        setTimeout(() => editorRef.current?.focusFirst(), 50)
      }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      saveTitle()
      onExitUp?.()
    }
    if (e.key === 'Escape') { setTitle(memo.title); titleRef.current?.blur() }
  }

  const handleNotesChange = useCallback((newNotes) => {
    updateMemo(memo.id, { notes: newNotes })
  }, [memo.id, updateMemo])

  const handleEditorExitUp = useCallback(() => {
    setTimeout(() => {
      const el = titleRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, 30)
  }, [])

  const handleEditorExitDown = useCallback(() => {
    onExitDown?.()
  }, [onExitDown])

  const handleDelete = () => {
    if (memo.title || (memo.notes && memo.notes.trim())) {
      if (!confirm('이 노트를 삭제하시겠습니까?')) return
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
    <div style={{ background: colorObj.card, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.04)', breakInside: 'avoid', marginBottom: 16 }}>
      {/* Header — 클릭 시 전체화면 진입 (input/button 제외) */}
      <div
        onClick={(e) => {
          const tag = e.target.tagName?.toLowerCase()
          if (tag === 'input' || tag === 'button' || e.target.closest('button')) return
          onOpenFullscreen?.()
        }}
        style={{ background: colorObj.header, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative', cursor: 'pointer' }}
      >
        {/* Collapse body toggle */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggleBody() }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: colorObj.text, opacity: 0.5 }}
        >
          <ChevronIcon open={!bodyCollapsed} />
        </div>
        {/* Color dot */}
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
          placeholder="노트 제목..."
          style={{ flex: 1, fontSize: 14, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: colorObj.text, fontFamily: 'inherit', padding: 0, minWidth: 0 }}
        />
        {/* Collapse all top-level nodes toggle */}
        {!bodyCollapsed && (
          <button
            onClick={onToggleAllTop}
            title={allTopCollapsed ? '모든 항목 펼치기' : '모든 항목 접기'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'flex', flexShrink: 0, fontSize: 11 }}
            onMouseEnter={e => e.currentTarget.style.color = colorObj.text}
            onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {allTopCollapsed ? (
                <>
                  <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M10 5l2-2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              ) : (
                <>
                  <path d="M2 3h10M2 7h6M2 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M12 7l-2 2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              )}
            </svg>
          </button>
        )}
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

      {/* Body — notes editor (collapsible) */}
      {!bodyCollapsed && (
        <div style={{ padding: '10px 16px 8px' }}>
          <OutlinerEditor
            ref={editorRef}
            notes={memo.notes}
            onChange={handleNotesChange}
            accentColor={colorObj.dot}
            onExitUp={handleEditorExitUp}
            onExitDown={handleEditorExitDown}
            allTopCollapsed={allTopCollapsed}
          />

          {/* Created date */}
          <div style={{ fontSize: 11, color: '#ccc', marginTop: 6, textAlign: 'right' }}>
            {formatDate(memo.createdAt)}
          </div>
        </div>
      )}
    </div>
  )
})

/* ═══ Fullscreen title — blur-save pattern (Agent 04 B5) ═══ */
function FullscreenTitle({ memo, colorObj, updateMemo }) {
  const [title, setTitle] = useState(memo.title)
  const ref = useRef(null)

  useEffect(() => { setTitle(memo.title) }, [memo.title])

  const save = () => {
    if (title !== memo.title) updateMemo(memo.id, { title })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); ref.current?.blur() }
    if (e.key === 'Escape') { setTitle(memo.title); ref.current?.blur() }
  }

  return (
    <input
      ref={ref}
      value={title}
      onChange={e => setTitle(e.target.value)}
      onBlur={save}
      onKeyDown={handleKeyDown}
      placeholder="노트 제목..."
      style={{ flex: 1, fontSize: 20, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: colorObj.text, fontFamily: 'inherit', padding: 0, minWidth: 0 }}
    />
  )
}

export default function MemoryView() {
  const { memos, addMemo, updateMemo, collapseState, toggleCollapse } = useStore()
  const isMobile = window.innerWidth < 768
  const cardRefs = useRef({})
  const [fullscreenMemoId, setFullscreenMemoId] = useState(null)
  const fullscreenMemo = fullscreenMemoId ? memos.find(m => m.id === fullscreenMemoId) : null

  const memoCollapsed = collapseState.memo || {}
  const toggleMemoBody = useCallback((memoId) => {
    toggleCollapse('memo', memoId)
  }, [toggleCollapse])

  const allTopState = collapseState.memoAllTop || {}
  const toggleAllTop = useCallback((memoId) => {
    toggleCollapse('memoAllTop', memoId)
  }, [toggleCollapse])

  const handleAdd = useCallback(() => {
    const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].id
    addMemo({ title: '', notes: '', color: randomColor })
  }, [addMemo])

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

  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        if (memos.length > 0) {
          cardRefs.current[memos[0].id]?.focusTitle()
        }
      }, 50)
    }
    window.addEventListener('view-focus', handler)
    return () => window.removeEventListener('view-focus', handler)
  }, [memos])

  const handleExitDown = useCallback((idx) => {
    if (idx + 1 < memos.length) {
      setTimeout(() => cardRefs.current[memos[idx + 1].id]?.focusTitle(), 30)
    }
  }, [memos])

  const handleExitUp = useCallback((idx) => {
    if (idx > 0) {
      setTimeout(() => cardRefs.current[memos[idx - 1].id]?.focusLast(), 30)
    }
  }, [memos])

  // ── 전체화면: Escape 키로 목록 복귀 ──
  useEffect(() => {
    if (!fullscreenMemoId) return
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setFullscreenMemoId(null) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [fullscreenMemoId])

  // ── 전체화면 편집 모드 ──
  if (fullscreenMemo) {
    const colorObj = COLOR_OPTIONS.find(c => c.id === fullscreenMemo.color) || COLOR_OPTIONS[0]
    return (
      <div data-view="memory" style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* 헤더: 뒤로가기 + 컬러 + 제목 + 삭제 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => setFullscreenMemoId(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18, padding: '4px 8px', display: 'flex', borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
              onMouseLeave={e => e.currentTarget.style.color = '#888'}
            >
              ←
            </button>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: colorObj.dot, flexShrink: 0 }} />
            <FullscreenTitle
              memo={fullscreenMemo}
              colorObj={colorObj}
              updateMemo={updateMemo}
            />
          </div>

          {/* 노트 본문 — OutlinerEditor 전체 높이 */}
          <div style={{ background: colorObj.card, borderRadius: 10, padding: isMobile ? '12px 12px' : '16px 20px', border: '1px solid rgba(0,0,0,0.04)', minHeight: 300 }}>
            <OutlinerEditor
              notes={fullscreenMemo.notes}
              onChange={(newNotes) => updateMemo(fullscreenMemo.id, { notes: newNotes })}
              accentColor={colorObj.dot}
            />
          </div>

          {/* 하단: 생성/수정 시간 */}
          <div style={{ marginTop: 16, fontSize: 12, color: '#a09f99', textAlign: 'right' }}>
            {fullscreenMemo.updatedAt && new Date(fullscreenMemo.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-view="memory" style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0 }}>노트</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>Alt+N 새 노트</p>
          </div>
          <button onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #e8e8e8', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: '#37352f', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8f8f8' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
          >
            <PlusIcon size={13} /> 새 노트
          </button>
        </div>

        {/* Memo cards — masonry 2-column layout */}
        <div style={{ columnCount: isMobile ? 1 : 2, columnGap: 16 }}>
          {memos.map((memo, idx) => (
            <MemoCard
              key={memo.id}
              ref={el => { cardRefs.current[memo.id] = el }}
              memo={memo}
              onExitDown={() => handleExitDown(idx)}
              onExitUp={() => handleExitUp(idx)}
              bodyCollapsed={!!memoCollapsed[memo.id]}
              onToggleBody={() => toggleMemoBody(memo.id)}
              allTopCollapsed={!!allTopState[memo.id]}
              onToggleAllTop={() => toggleAllTop(memo.id)}
              onOpenFullscreen={() => setFullscreenMemoId(memo.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
