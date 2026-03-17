import { useState, useEffect, useRef } from 'react'

/**
 * TitleZone — 클릭 시 인라인 편집 모드 전환
 * @param {string} name - 현재 제목
 * @param {function} onSave - (newText) => void
 * @param {boolean} compact - 축소 모드
 */
export default function TitleZone({ name, onSave, compact }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef(null)

  // name prop 변경 시 draft 동기화
  useEffect(() => { setDraft(name) }, [name])

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

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          fontSize: compact ? 12 : 13,
          color: '#2C2C2A',
          border: 'none',
          borderBottom: '1.5px solid #85B7EB',
          background: 'transparent',
          outline: 'none',
          width: '100%',
          padding: 0,
          fontFamily: 'inherit',
        }}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        fontSize: compact ? 12 : 13,
        color: '#2C2C2A',
        cursor: 'text',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'inline-block',
        padding: '1px 4px',
        margin: '-1px -4px',
        borderRadius: 3,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {name || '제목 없음'}
    </span>
  )
}
