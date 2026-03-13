import { useState, useEffect, useRef, useMemo } from 'react'
import useStore from '../../hooks/useStore'
import { parseDateFromText } from '../../utils/dateParser'

export default function MobileAddSheet({ onClose }) {
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState('')
  const projects = useStore(s => s.projects)
  const localProjectOrder = useStore(s => s.localProjectOrder)
  const addTask = useStore(s => s.addTask)
  const inputRef = useRef(null)

  // 프로젝트 순서 정렬 (뷰 관리 순서 적용)
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
      const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
      return orderA - orderB
    })
  }, [projects, localProjectOrder])

  // 첫 번째 프로젝트를 기본 선택
  useEffect(() => {
    if (sortedProjects.length > 0 && !projectId) {
      setProjectId(sortedProjects[0].id)
    }
  }, [sortedProjects])

  // 자동 포커스
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleAdd = () => {
    if (!text.trim()) return
    const { startDate, dueDate } = parseDateFromText(text.trim())
    addTask({ text: text.trim(), projectId: projectId || sortedProjects[0]?.id, startDate, dueDate })
    setText('')
    onClose()
  }

  return (
    <>
      {/* 배경 오버레이 */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 300,
      }} />

      {/* 중앙 모달 */}
      <div style={{
        position: 'fixed',
        top: '25vh',
        left: 16,
        right: 16,
        background: '#fff',
        borderRadius: 16,
        padding: 20,
        zIndex: 301,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        animation: 'fadeScaleIn 0.2s ease',
      }}>
        {/* 프로젝트 선택 */}
        <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>프로젝트</label>
        <select
          data-modal-input
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #e5e5e5', fontSize: 14, fontFamily: 'inherit',
            marginBottom: 12, background: '#fafafa', color: '#37352f',
          }}
        >
          {sortedProjects.map(p => (
            <option key={p.id} value={p.id}>
              {p.teamId ? '📁 ' : '📂 '}{p.name}
            </option>
          ))}
        </select>

        {/* 할일 입력 + 추가 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            data-modal-input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="할 일을 입력하세요"
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              border: '1px solid #e5e5e5', fontSize: 13, fontFamily: 'inherit',
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
              border: 'none', fontSize: 13, fontWeight: 600,
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
