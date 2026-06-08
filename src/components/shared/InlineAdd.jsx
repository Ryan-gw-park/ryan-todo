import { useState, useRef, useEffect } from 'react'
import useStore from '../../hooks/useStore'
import { PlusIcon } from './Icons'
import { parseDateFromText } from '../../utils/dateParser'
import { parseMentions } from '../../utils/mentions'

export default function InlineAdd({ projectId, category, color, extraFields, mention }) {
  const { addTask } = useStore()
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => { if (active && ref.current) ref.current.focus() }, [active])

  const handleAdd = () => {
    if (!text.trim()) return
    let finalText = text.trim()
    // 담당자(mention) 모드: 셀의 @담당자를 텍스트에 자동 태깅 → 해당 컬럼에 노출.
    // 이미 같은 멘션이 입력돼 있으면 중복 방지.
    if (mention && !parseMentions(finalText).includes(mention)) {
      finalText = `${finalText} @${mention}`
    }
    const { startDate, dueDate } = parseDateFromText(finalText)
    addTask({ text: finalText, projectId, category, startDate, dueDate, ...extraFields })
    setText('')
  }

  if (!active) {
    return (
      <button
        onClick={() => { setActive(true); setText('') }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 4px', background: 'none', border: 'none', cursor: 'pointer', color: '#c8c8c8', fontSize: 12, width: '100%', borderRadius: 4, transition: 'all 0.15s', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.color = color.text; e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#c8c8c8'; e.currentTarget.style.background = 'none' }}
      >
        <PlusIcon /> 추가
      </button>
    )
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <input
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setActive(false) }}
        onBlur={() => { if (!text.trim()) setActive(false) }}
        placeholder="할일을 입력하세요..."
        style={{ width: '100%', padding: '6px 8px', fontSize: 13, border: `1.5px solid ${color.dot}`, borderRadius: 6, outline: 'none', background: 'white', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  )
}
