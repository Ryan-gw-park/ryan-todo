import { useState, useEffect, useRef } from 'react'
import useStore from '../../hooks/useStore'
import { parseDateFromText } from '../../utils/dateParser'

export default function MobileAddSheet({ onClose }) {
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState('')
  const projects = useStore(s => s.projects)
  const addTask = useStore(s => s.addTask)
  const inputRef = useRef(null)

  // 첫 번째 프로젝트를 기본 선택
  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id)
    }
  }, [projects])

  // 자동 포커스
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleAdd = () => {
    if (!text.trim()) return
    const { startDate, dueDate } = parseDateFromText(text.trim())
    addTask({ text: text.trim(), projectId: projectId || projects[0]?.id, startDate, dueDate })
    setText('')
    onClose()
  }

  return (
    <>
      {/* 배경 오버레이 */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
        zIndex: 300,
      }} />

      {/* 바텀 시트 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: '16px 20px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 301, boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        animation: 'slideUp 0.2s ease',
      }}>
        {/* 드래그 핸들 */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: '#ddd', margin: '0 auto 16px',
        }} />

        {/* 프로젝트 선택 */}
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #e5e5e5', fontSize: 14, fontFamily: 'inherit',
            marginBottom: 10, background: '#fafafa', color: '#37352f',
          }}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.teamId ? '📁 ' : '📂 '}{p.name}
            </option>
          ))}
        </select>

        {/* 할일 입력 + 추가 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="할 일을 입력하세요"
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              border: '1px solid #e5e5e5', fontSize: 14, fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!text.trim()}
            style={{
              padding: '10px 16px', borderRadius: 8,
              background: text.trim() ? '#37352f' : '#e5e5e5',
              color: text.trim() ? '#fff' : '#bbb',
              border: 'none', fontSize: 14, fontWeight: 600,
              cursor: text.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            추가
          </button>
        </div>
      </div>
    </>
  )
}
