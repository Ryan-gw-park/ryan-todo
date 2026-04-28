import { useState, useMemo } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import useStore from '../../../../hooks/useStore'
import { COLOR, PIVOT, SPACE, OPACITY } from '../../../../styles/designTokens'
import SortableTaskCard from '../../../dnd/SortableTaskCard'

/* ═════════════════════════════════════════════
   PivotTaskCell — 한 셀(MS × Member) 내 task 리스트
   - Primary (assigneeId===memberId): 진하게 + drag 활성
   - Secondary (secondaryAssigneeId===memberId): 연하게 (R30 중복 표시) + drag 비활성 (§0.1)
   - Inline 편집, 체크박스 done 토글
   - 빈 셀 hover + 버튼 → inline task 생성
   - team-tasks-band-dnd commit 10:
     - cellTasks를 sortOrder ASC 정렬
     - 셀 단위 SortableContext 등록 (id = team-cell-sortable:{pid}:{msId}:{memberId})
     - primary/unassigned 카드는 SortableTaskCard 래핑 (cell-task:{task.id} + type='team-matrix-task')
     - secondary 카드는 일반 div (drag 비활성)
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

  // commit 10: cellTasks를 sortOrder ASC로 정렬 (reorderTasks가 sortOrder만 갱신,
  // store array 순서 미변경 → 컴포넌트가 직접 sort 필수. spec §5.5 / §5.3)
  const cellTasks = useMemo(() => {
    const filtered = tasks.filter(t =>
      isUnassignedCol
        ? (t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team')
        : (t.assigneeId === memberId || t.secondaryAssigneeId === memberId)
    )
    return [...filtered].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [tasks, memberId, isUnassignedCol])

  // SortableContext id — 셀 단위 (spec §3.2 D-01)
  const sortableContextId = `team-cell-sortable:${projectId}:${milestoneId ?? 'null'}:${memberId ?? 'null'}`

  // SortableContext items — primary/unassigned 카드만 (secondary는 drag 비활성, §0.1)
  const sortableTaskIds = useMemo(
    () => cellTasks
      .filter(t => isUnassignedCol || t.assigneeId === memberId)
      .map(t => `cell-task:${t.id}`),
    [cellTasks, memberId, isUnassignedCol]
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

  // 인라인 추가 행 (빈 셀 + 비어있지 않은 셀 공용)
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
      <SortableContext id={sortableContextId} items={sortableTaskIds} strategy={verticalListSortingStrategy}>
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
      </SortableContext>
    )
  }

  return (
    <SortableContext id={sortableContextId} items={sortableTaskIds} strategy={verticalListSortingStrategy}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ padding: SPACE.cellPadding }}
      >
        {cellTasks.map(task => {
          const isPrimary = isUnassignedCol ? true : task.assigneeId === memberId
          const isDraggable = isPrimary  // §0.1: secondary는 drag 비활성
          const style = isPrimary
            ? { color: COLOR.textPrimary, fontWeight: 500 }
            : { color: COLOR.textTertiary, fontWeight: 400 }
          const isEditing = editingId === task.id

          const cardContent = (
            <div
              onMouseEnter={() => setHoverTaskId(task.id)}
              onMouseLeave={() => setHoverTaskId(null)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 4,
                fontSize: 12,
                padding: '2px 0',
                minWidth: 0,
                ...style,
              }}
            >
              <input
                type="checkbox"
                checked={!!task.done}
                onChange={() => toggleDone(task.id)}
                onMouseDown={e => e.stopPropagation()}
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
                    onMouseDown={e => e.stopPropagation()}
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
                    onMouseDown={e => e.stopPropagation()}
                    style={{ cursor: 'pointer', flex: 1, minWidth: 0, wordBreak: 'keep-all', overflowWrap: 'break-word' }}
                  >{task.text}</span>
                )}
              {hoverTaskId === task.id && !isEditing && (
                <div
                  onClick={e => { e.stopPropagation(); openDetail(task) }}
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', opacity: 0.4,
                  }}>
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
            </div>
          )

          // §0.1: secondary 카드는 일반 div (drag 비활성)
          if (!isDraggable || isEditing) {
            return <div key={task.id}>{cardContent}</div>
          }

          // primary 카드는 SortableTaskCard로 래핑.
          // commit 11에서 dispatcher가 type === 'team-matrix-task' 분기로 처리.
          return (
            <SortableTaskCard
              key={task.id}
              id={`cell-task:${task.id}`}
              data={{
                type: 'team-matrix-task',
                task,
                cellKey: { projectId, msId: milestoneId ?? null, memberId },
              }}
              dragOpacity={OPACITY.projectDimmed}
            >
              {cardContent}
            </SortableTaskCard>
          )
        })}
        {addRow}
      </div>
    </SortableContext>
  )
}
