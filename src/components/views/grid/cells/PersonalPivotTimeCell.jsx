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
  const openDetail = useStore(s => s.openDetail)

  const [editingId, setEditingId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [hover, setHover] = useState(false)
  const [hoverTaskId, setHoverTaskId] = useState(null)

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

  const addRow = addingNew ? (
    <div style={{ padding: '2px 0' }}>
      <input
        autoFocus
        style={{ width: '100%', fontSize: 12, border: `1px solid ${COLOR.border}`, borderRadius: 4, padding: '2px 4px', fontFamily: 'inherit', boxSizing: 'border-box' }}
        onBlur={e => handleAddNew(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleAddNew(e.target.value)
          if (e.key === 'Escape') setAddingNew(false)
        }}
      />
    </div>
  ) : hover ? (
    <div
      onClick={() => setAddingNew(true)}
      style={{ padding: '2px 0', cursor: 'pointer', fontSize: 11, color: COLOR.textTertiary, textAlign: 'center' }}
    >+ 추가</div>
  ) : null

  if (cellTasks.length === 0) {
    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ padding: SPACE.cellPadding, minHeight: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        {addingNew
          ? addRow
          : hover
            ? addRow
            : <span style={{ color: PIVOT.emptyCellColor, fontSize: PIVOT.emptyCellFontSize }}>{PIVOT.emptyCellMarker}</span>}
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: SPACE.cellPadding }}
    >
      {cellTasks.map(task => {
        const isEditing = editingId === task.id
        return (
          <div
            key={task.id}
            onMouseEnter={() => setHoverTaskId(task.id)}
            onMouseLeave={() => setHoverTaskId(null)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 4,
              fontSize: 12,
              padding: '2px 0',
              minWidth: 0,
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
                <textarea
                  autoFocus
                  defaultValue={task.text}
                  rows={Math.max(1, Math.ceil((task.text || '').length / 12))}
                  style={{ flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box', fontSize: 12, border: `1px solid ${COLOR.border}`, borderRadius: 4, padding: '1px 4px', fontFamily: 'inherit', resize: 'none', lineHeight: 1.4, overflow: 'hidden' }}
                  onBlur={e => handleEditFinish(task.id, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditFinish(task.id, e.target.value) }
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                />
              )
              : (
                <span
                  onClick={() => setEditingId(task.id)}
                  style={{ cursor: 'pointer', flex: 1, minWidth: 0, wordBreak: 'keep-all', overflowWrap: 'break-word' }}
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
      {addRow}
    </div>
  )
}
