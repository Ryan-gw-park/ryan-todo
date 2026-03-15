import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import useStore from '../../../hooks/useStore'
import { parseDateFromText } from '../../../utils/dateParser'
import { PlusIcon } from '../../shared/Icons'

/* ── Add task button ── */
const AddTaskButton = forwardRef(function AddTaskButton({ projectId, category, color, onExitDown, onExitUp }, ref) {
  const { addTask } = useStore()
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const isMobile = window.innerWidth < 768
  // 할일 제목: 데스크탑 14px, 모바일 13px
  const taskFontSize = isMobile ? 13 : 14

  useImperativeHandle(ref, () => ({
    activate: () => {
      setAdding(true)
      setText('')
      setTimeout(() => inputRef.current?.focus(), 40)
    },
  }))

  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus() }, [adding])

  const handleAdd = () => {
    if (!text.trim()) { setAdding(false); return }
    const { startDate, dueDate } = parseDateFromText(text.trim())
    addTask({ text: text.trim(), projectId, category, startDate, dueDate })
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setAdding(false); setText('') }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!text.trim() && onExitDown?.()) setAdding(false) }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!text.trim()) { setAdding(false); onExitUp?.() } }
  }

  if (!adding) {
    return (
      <button onClick={() => { setAdding(true); setText('') }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', marginLeft: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#c0c0c0', fontSize: 13, fontFamily: 'inherit', borderRadius: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = color.text}
        onMouseLeave={e => e.currentTarget.style.color = '#c0c0c0'}>
        <PlusIcon size={13} /> 할일 추가
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', marginLeft: 20 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color.dot }} />
      <input ref={inputRef} data-task-title value={text} onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (text.trim()) handleAdd(); else setAdding(false) }}
        placeholder="새 할일 입력..."
        style={{ flex: 1, fontSize: taskFontSize, fontWeight: 600, border: 'none', borderBottom: `2px solid ${color.dot}`, outline: 'none', padding: '4px 0', fontFamily: 'inherit', background: 'transparent', color: '#37352f' }} />
    </div>
  )
})

export default AddTaskButton
