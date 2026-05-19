import { useState, useEffect, useRef, useMemo } from 'react'
import useStore from '../../hooks/useStore'
import { parseDateFromText } from '../../utils/dateParser'

export default function MobileInputPage({ onGoPersonal }) {
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState('')
  const [savedHint, setSavedHint] = useState(false)
  const projects = useStore(s => s.projects)
  const localProjectOrder = useStore(s => s.localProjectOrder)
  const addTask = useStore(s => s.addTask)
  const inputRef = useRef(null)

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
      const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
      return orderA - orderB
    })
  }, [projects, localProjectOrder])

  useEffect(() => {
    if (sortedProjects.length > 0 && !projectId) {
      setProjectId(sortedProjects[0].id)
    }
  }, [sortedProjects])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [])

  const handleAdd = () => {
    if (!text.trim()) return
    const { startDate, dueDate } = parseDateFromText(text.trim())
    addTask({ text: text.trim(), projectId: projectId || sortedProjects[0]?.id, startDate, dueDate })
    setText('')
    setSavedHint(true)
    setTimeout(() => setSavedHint(false), 1200)
    inputRef.current?.focus()
  }

  const GoPersonalButton = (
    <button
      onClick={onGoPersonal}
      style={{
        width: '100%',
        padding: '14px 16px',
        borderRadius: 10,
        background: '#fff',
        color: '#37352f',
        border: '1px solid #e5e5e5',
        fontSize: 15,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      개인 할일 보기 <span style={{ opacity: 0.5 }}>→</span>
    </button>
  )

  return (
    <div
      className="mobile-app"
      style={{
        minHeight: '100vh',
        background: '#fafaf8',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 16px 16px',
        gap: 14,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 4 }}>
        새 할일
      </div>

      {GoPersonalButton}

      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          border: '1px solid #efeee9',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <label style={{ fontSize: 11, color: '#999', display: 'block' }}>프로젝트</label>
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #e5e5e5',
            fontSize: 16,
            fontFamily: 'inherit',
            background: '#fafafa',
            color: '#37352f',
          }}
        >
          {sortedProjects.map(p => (
            <option key={p.id} value={p.id}>
              {p.teamId ? '📁 ' : '📂 '}{p.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="할 일을 입력하세요"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              fontSize: 16,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!text.trim()}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              background: text.trim() ? '#37352f' : '#e5e5e5',
              color: text.trim() ? '#fff' : '#bbb',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: text.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            추가
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: savedHint ? '#2383e2' : 'transparent',
            transition: 'color 0.2s',
            textAlign: 'right',
            minHeight: 14,
          }}
        >
          저장되었습니다
        </div>
      </div>

      {GoPersonalButton}
    </div>
  )
}
