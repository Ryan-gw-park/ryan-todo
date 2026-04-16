import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR, PIVOT, SPACE } from '../../../../styles/designTokens'

/* ═════════════════════════════════════════════
   PersonalPivotTimeCell — 한 셀(MS × time category) 내 task 리스트
   - tasks는 이미 해당 MS로 필터됨
   - timeCol.key로 category 매칭
   - inline 편집 + 체크박스 done 토글 + 빈 셀 hover + 버튼
   ═════════════════════════════════════════════ */
export default function PersonalPivotTimeCell({ tasks, timeCol, projectId, milestoneId, currentUserId }) {
  const updateTask = useStore(s => s.updateTask)
  const addTask = useStore(s => s.addTask)
  const toggleDone = useStore(s => s.toggleDone)

  const [editingId, setEditingId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [hover, setHover] = useState(false)

  const cellTasks = tasks.filter(t => t.category === timeCol.key)

  const handleEditFinish = (id, v) => {
    setEditingId(null)
    const text = (v ?? '').trim()
    if (text) updateTask(id, { text })
  }

  const handleAddNew = (v) => {
    setAddingNew(false)
    const text = (v ?? '').trim()
    if (!text) return
    // 팀 프로젝트: teamDefaults scope='assigned', assigneeId=userId 적용.
    // 개인 프로젝트: useStore.js:536 강제 보정 (scope='private', teamId=null, assigneeId=userId).
    addTask({
      text,
      projectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: milestoneId || null,
      category: timeCol.key,
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
        const isEditing = editingId === task.id
        return (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
              fontSize: 12,
              padding: '2px 0',
              color: COLOR.textPrimary,
              fontWeight: 500,
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
          </div>
        )
      })}
    </div>
  )
}
