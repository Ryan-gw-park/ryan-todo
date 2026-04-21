import { useState, useRef, useEffect } from 'react'
import { COLOR } from '../../../styles/designTokens'

/**
 * 셀 내 "+" 클릭 시 활성화되는 인라인 태스크 생성 폼.
 * - 프로젝트 드롭다운 + 텍스트 input
 * - Enter: 생성 (projectId 미선택 or 빈 텍스트 시 no-op)
 * - Escape / blur(빈 텍스트): 취소
 * - 성공 후 input 비우고 유지 (연속 입력 가능), selectedProjectId는 상위 state로 유지
 *
 * ⚠ 중요 (W5): useStore.addTask는 applyTransitionRules를 호출하지 않는다.
 * 따라서 scope/assigneeId/teamId 3개 조합은 호출자 책임.
 * DB valid_scope CHECK: scope='assigned' ↔ team_id NOT NULL AND assignee_id NOT NULL.
 */
export default function CellInlineAdd({
  userId,               // profiles.user_id = tasks.assignee_id (W7)
  dateISO,
  projects = [],
  selectedProjectId,
  setSelectedProjectId,
  currentTeamId,
  addTask,
  onClose,
}) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleEnter = () => {
    if (!selectedProjectId || !text.trim()) return // 가드 (T6-1)
    addTask({
      text: text.trim(),
      projectId: selectedProjectId,
      assigneeId: userId,              // tasks.assignee_id 저장 (user_id)
      scheduledDate: dateISO,           // camelCase (mapTask/taskToRow 컨벤션)
      category: 'today',
      teamId: currentTeamId,
      scope: 'assigned',                 // DB CHECK: assigned ↔ team_id & assignee_id 둘 다 NOT NULL
    })
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEnter()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
    }
  }

  const handleBlur = () => {
    // 빈 텍스트 상태에서 blur 시 닫기
    if (!text.trim()) onClose?.()
  }

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: 4,
        marginTop: 4,
        background: 'white',
        border: `0.5px solid ${COLOR.border}`,
        borderRadius: 4,
      }}
    >
      <select
        value={selectedProjectId || ''}
        onChange={e => setSelectedProjectId(e.target.value || null)}
        style={{
          fontSize: 11,
          padding: '2px 4px',
          border: `0.5px solid ${COLOR.border}`,
          borderRadius: 3,
          outline: 'none',
          fontFamily: 'inherit',
          color: selectedProjectId ? COLOR.textPrimary : COLOR.textTertiary,
        }}
      >
        <option value="">프로젝트 선택</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="태스크 내용..."
        style={{
          fontSize: 11,
          padding: '3px 5px',
          border: `0.5px solid ${COLOR.border}`,
          borderRadius: 3,
          outline: 'none',
          fontFamily: 'inherit',
          color: COLOR.textPrimary,
        }}
      />
    </div>
  )
}
