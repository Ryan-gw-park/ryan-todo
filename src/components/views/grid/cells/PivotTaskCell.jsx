import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR, PIVOT, SPACE } from '../../../../styles/designTokens'

/* ═════════════════════════════════════════════
   PivotTaskCell — 한 셀(MS × Member) 내 task 리스트
   - Primary (assigneeId===memberId): 진하게
   - Secondary (secondaryAssigneeId===memberId): 연하게 (R30 중복 표시)
   - Inline 편집, 체크박스 done 토글
   - 빈 셀 hover + 버튼 → inline task 생성
   memberId === null: 미배정 컬럼
   ═════════════════════════════════════════════ */
export default function PivotTaskCell({ tasks, memberId, projectId, milestoneId }) {
  const updateTask = useStore(s => s.updateTask)
  const addTask = useStore(s => s.addTask)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const currentTeamId = useStore(s => s.currentTeamId)

  const [editingId, setEditingId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [hover, setHover] = useState(false)
  const [hoverTaskId, setHoverTaskId] = useState(null)

  const isUnassignedCol = memberId == null
  const cellTasks = tasks.filter(t =>
    isUnassignedCol
      ? (t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team')
      : (t.assigneeId === memberId || t.secondaryAssigneeId === memberId)
  )

  const handleEditFinish = (taskId, value) => {
    setEditingId(null)
    const v = (value ?? '').trim()
    if (v) updateTask(taskId, { text: v })
  }

  const handleAddNew = (text) => {
    setAddingNew(false)
    const v = (text ?? '').trim()
    if (!v) return
    addTask({
      text: v,
      projectId,
      assigneeId: isUnassignedCol ? null : memberId,
      secondaryAssigneeId: null,
      keyMilestoneId: milestoneId || null,
      teamId: currentTeamId,
      scope: isUnassignedCol ? 'team' : 'assigned',
    })
  }

  if (cellTasks.length === 0) {
    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ textAlign: 'center', padding: SPACE.cellPadding, minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {addingNew
          ? (
            <input
              autoFocus
              style={{ width: '100%', fontSize: 12, border: `1px solid ${COLOR.border}`, borderRadius: 4, padding: '2px 4px', fontFamily: 'inherit' }}
              onBlur={e => handleAddNew(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddNew(e.target.value)
                if (e.key === 'Escape') setAddingNew(false)
              }}
            />
          )
          : hover
            ? (
              <button
                onClick={() => setAddingNew(true)}
                style={{ fontSize: 13, border: 'none', background: 'transparent', color: COLOR.textSecondary, cursor: 'pointer', padding: '0 4px' }}
                aria-label="할일 추가"
              >+</button>
            )
            : <span style={{ color: PIVOT.emptyCellColor, fontSize: PIVOT.emptyCellFontSize }}>{PIVOT.emptyCellMarker}</span>}
      </div>
    )
  }

  return (
    <div style={{ padding: SPACE.cellPadding }}>
      {cellTasks.map(task => {
        const isPrimary = isUnassignedCol ? true : task.assigneeId === memberId
        const style = isPrimary
          ? { color: COLOR.textPrimary, fontWeight: 500 }
          : { color: COLOR.textTertiary, fontWeight: 400 }
        const isEditing = editingId === task.id
        return (
          <div
            key={task.id}
            onMouseEnter={() => setHoverTaskId(task.id)}
            onMouseLeave={() => setHoverTaskId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
              fontSize: 12,
              padding: '2px 0',
              ...style,
            }}
          >
            <input
              type="checkbox"
              checked={!!task.done}
              onChange={() => toggleDone(task.id)}
              style={{ flexShrink: 0 }}
            />
            {isEditing
              ? (
                <input
                  autoFocus
                  defaultValue={task.text}
                  style={{ flex: 1, fontSize: 12, border: `1px solid ${COLOR.border}`, borderRadius: 4, padding: '1px 4px', fontFamily: 'inherit' }}
                  onBlur={e => handleEditFinish(task.id, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEditFinish(task.id, e.target.value)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              )
              : (
                <span
                  onClick={() => setEditingId(task.id)}
                  style={{ cursor: 'pointer', flex: 1 }}
                >{task.text}</span>
              )}
            {hoverTaskId === task.id && !isEditing && (
              <div onClick={e => { e.stopPropagation(); openDetail(task) }} style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', opacity: 0.4,
              }}>
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
