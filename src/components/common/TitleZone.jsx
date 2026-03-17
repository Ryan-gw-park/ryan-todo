import { useState, useEffect, useRef } from 'react'

/**
 * TitleZone — 클릭 시 인라인 편집 모드 전환
 * @param {string} name - 현재 제목
 * @param {function} onSave - (newText) => void
 * @param {boolean} compact - 축소 모드
 * @param {string} textColor - 텍스트 색상 (기본: #2C2C2A)
 *
 * 글로벌 원칙:
 * - 인라인 편집 input 너비 = 텍스트 크기에 실시간 맞춤 (min 60px, max 100%)
 * - 제목 항상 전체 표시 — ellipsis 금지, 자동 줄바꿈
 */
export default function TitleZone({ name, onSave, compact, textColor = '#2C2C2A' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [inputWidth, setInputWidth] = useState(60)
  const inputRef = useRef(null)
  const measureRef = useRef(null)

  // name prop 변경 시 draft 동기화
  useEffect(() => { setDraft(name) }, [name])

  // draft 변경 시 input 너비 재계산
  useEffect(() => {
    if (editing && measureRef.current) {
      const width = measureRef.current.scrollWidth + 4
      setInputWidth(Math.max(60, width))
    }
  }, [draft, editing])

  const startEdit = (e) => {
    e.stopPropagation()
    setDraft(name)
    setEditing(true)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) {
      onSave(trimmed)
    }
    setEditing(false)
  }

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    else if (e.key === 'Escape') { cancel() }
  }

  const fontSize = compact ? 12 : 13

  if (editing) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%' }}>
        {/* 숨겨진 측정용 span */}
        <span
          ref={measureRef}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'pre',
            fontSize,
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          {draft || ' '}
        </span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            fontSize,
            color: textColor,
            border: 'none',
            borderBottom: '1.5px solid #85B7EB',
            background: 'transparent',
            outline: 'none',
            width: inputWidth,
            maxWidth: '100%',
            padding: 0,
            fontFamily: 'inherit',
          }}
        />
      </div>
    )
  }

  return (
    <span
      onClick={startEdit}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        fontSize,
        color: textColor,
        cursor: 'text',
        // 제목 항상 전체 표시 — ellipsis 금지
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflow: 'visible',
        // 호버 하이라이트용 패딩
        padding: '1px 4px',
        margin: '-1px -4px',
        borderRadius: 3,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        const hoverBg = textColor === '#fff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.04)'
        e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {name || '제목 없음'}
    </span>
  )
}
