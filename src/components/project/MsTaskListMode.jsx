import { useState, useCallback, useRef } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { countTasksRecursive } from '../../utils/milestoneTree'

const S = COLOR

/* ═══════════════════════════════════════════════════════
   MsTaskListMode — 프로젝트 '전체 할일' 단일 목록
   좌우 분할 없음. MS = 그룹 헤더, 할일 = 행.
   ═══════════════════════════════════════════════════════ */

export default function MsTaskListMode({
  tree, projectTasks, backlogTasks, projectId, pkmId, color,
  toggleDone, openDetail, addMilestone, updateMilestone, deleteMilestone, openConfirmDialog,
}) {
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)

  const [collapsedMs, setCollapsedMs] = useState(new Set())
  const [editingMsId, setEditingMsId] = useState(null)
  const [addingTaskMsId, setAddingTaskMsId] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)

  const toggleMs = useCallback((id) => {
    setCollapsedMs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAddChildMs = useCallback(async (parentId) => {
    if (!pkmId) return
    const data = await addMilestone(projectId, pkmId, '', parentId)
    if (data) setEditingMsId(data.id)
  }, [pkmId, projectId, addMilestone])

  const handleDeleteMs = useCallback((nodeId, title) => {
    openConfirmDialog({
      title: '마일스톤 삭제',
      message: `"${title || '제목 없음'}"을(를) 삭제하시겠습니까?\n하위 마일스톤도 모두 삭제됩니다.`,
      confirmText: '삭제',
      onConfirm: () => deleteMilestone(nodeId),
    })
  }, [deleteMilestone, openConfirmDialog])

  const handleMsEditFinish = useCallback((msId, value) => {
    setEditingMsId(null)
    if (value !== null && value !== undefined) {
      updateMilestone(msId, { title: value })
    }
  }, [updateMilestone])

  const handleTaskEditFinish = useCallback((taskId, value) => {
    setEditingTaskId(null)
    if (value && value.trim()) {
      updateTask(taskId, { text: value.trim() })
    }
  }, [updateTask])

  const handleAddTaskSubmit = useCallback(async (msId, text) => {
    if (!text.trim()) { setAddingTaskMsId(null); return }
    await addTask({
      text: text.trim(),
      projectId,
      keyMilestoneId: msId,
      category: 'backlog',
    })
  }, [addTask, projectId])

  // Recursive render
  function renderNodes(nodes, depth) {
    return nodes.map(node => {
      const isCollapsed = collapsedMs.has(node.id)
      const childMs = node.children?.filter(c => c.type === 'milestone' || c.children) || []
      const leafTasks = projectTasks.filter(t => t.keyMilestoneId === node.id && !t.deletedAt)
      const isLeaf = childMs.length === 0
      const taskCount = countTasksRecursive(node, projectTasks)
      const isEditing = editingMsId === node.id
      const indent = depth * 20

      return (
        <div key={node.id}>
          {/* MS header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: `8px 16px 8px ${16 + indent}px`,
              background: depth === 0 ? '#fafaf8' : '#fff',
              borderBottom: `0.5px solid ${S.border}`,
              cursor: isLeaf && leafTasks.length > 0 ? 'pointer' : 'default',
            }}
            onMouseEnter={e => e.currentTarget.querySelector('.ms-hover')?.style.setProperty('opacity', '1')}
            onMouseLeave={e => e.currentTarget.querySelector('.ms-hover')?.style.setProperty('opacity', '0')}
          >
            {/* Collapse arrow */}
            {(isLeaf ? leafTasks.length > 0 : true) ? (
              <span
                onClick={() => isLeaf ? leafTasks.length > 0 && toggleMs(node.id) : toggleMs(node.id)}
                style={{ fontSize: 9, color: S.textTertiary, width: 12, textAlign: 'center', cursor: 'pointer',
                  transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
              >▾</span>
            ) : <span style={{ width: 12 }} />}

            {/* Color dot */}
            <div style={{
              width: depth === 0 ? 8 : 7, height: depth === 0 ? 8 : 7,
              borderRadius: '50%', background: color?.dot || '#888', flexShrink: 0,
            }} />

            {/* Title — inline editable */}
            {isEditing ? (
              <input
                autoFocus
                defaultValue={node.title}
                onBlur={(e) => handleMsEditFinish(node.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleMsEditFinish(node.id, e.target.value) }
                  if (e.key === 'Escape') { e.preventDefault(); handleMsEditFinish(node.id, null) }
                }}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  flex: 1, fontSize: depth === 0 ? 13 : 12.5, fontWeight: depth === 0 ? 700 : 600,
                  border: 'none', outline: 'none', background: 'transparent',
                  color: S.textPrimary, fontFamily: 'inherit', padding: 0,
                }}
              />
            ) : (
              <span
                onDoubleClick={() => setEditingMsId(node.id)}
                style={{
                  flex: 1, fontSize: depth === 0 ? 13 : 12.5,
                  fontWeight: depth === 0 ? 700 : 600,
                  color: S.textPrimary, lineHeight: 1.4, cursor: 'text',
                }}
              >
                {node.title || '(제목 없음)'}
              </span>
            )}

            {/* Progress */}
            {taskCount.total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{ width: 32, height: 3, borderRadius: 2, background: '#e8e6df' }}>
                  <div style={{ width: `${taskCount.done / taskCount.total * 100}%`, height: 3, borderRadius: 2, background: color?.dot || '#888', transition: 'width 0.2s' }} />
                </div>
                <span style={{ fontSize: 10, color: S.textTertiary, fontWeight: 500 }}>{taskCount.done}/{taskCount.total}</span>
              </div>
            )}

            {/* Hover actions */}
            <div className="ms-hover" style={{ display: 'flex', gap: 6, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
              <span
                onClick={(e) => { e.stopPropagation(); handleAddChildMs(node.id) }}
                style={{ fontSize: 10, color: color?.dot || '#888', cursor: 'pointer', fontWeight: 500 }}
              >+ 하위</span>
              <span
                onClick={(e) => { e.stopPropagation(); handleDeleteMs(node.id, node.title) }}
                style={{ fontSize: 10, color: '#ccc', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = '#c53030'}
                onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
              >삭제</span>
            </div>
          </div>

          {/* Children */}
          {!isCollapsed && (
            <>
              {/* Child milestones */}
              {childMs.length > 0 && renderNodes(childMs, depth + 1)}

              {/* Leaf tasks */}
              {isLeaf && leafTasks.filter(t => !t.done).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  indent={indent + 20}
                  color={color}
                  isEditing={editingTaskId === task.id}
                  onStartEdit={() => setEditingTaskId(task.id)}
                  onFinishEdit={handleTaskEditFinish}
                  onToggle={() => toggleDone(task.id)}
                  onDetail={() => openDetail(task)}
                />
              ))}

              {/* Done tasks (collapsed) */}
              {isLeaf && (() => {
                const doneTasks = leafTasks.filter(t => t.done)
                if (doneTasks.length === 0) return null
                return <DoneTasksGroup tasks={doneTasks} indent={indent + 20} color={color} onToggle={toggleDone} onDetail={openDetail} />
              })()}

              {/* + 추가 */}
              {isLeaf && (
                addingTaskMsId === node.id ? (
                  <InlineAddRow
                    indent={indent + 20}
                    onSubmit={(text) => handleAddTaskSubmit(node.id, text)}
                    onDone={() => setAddingTaskMsId(null)}
                  />
                ) : (
                  <div
                    onClick={() => setAddingTaskMsId(node.id)}
                    style={{
                      padding: `5px 16px 5px ${16 + indent + 20 + 24}px`,
                      fontSize: 12, color: '#d0d0d0', cursor: 'pointer',
                      borderBottom: `0.5px solid ${S.border}`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = S.textTertiary}
                    onMouseLeave={e => e.currentTarget.style.color = '#d0d0d0'}
                  >+ 추가</div>
                )
              )}
            </>
          )}
        </div>
      )
    })
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 32px' }}>
        {/* MS sections */}
        {tree.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: S.textTertiary, fontSize: FONT.body }}>
            마일스톤이 없습니다
          </div>
        ) : renderNodes(tree, 0)}

        {/* + 마일스톤 추가 */}
        <div
          onClick={() => handleAddChildMs(null)}
          style={{ padding: '12px 16px', fontSize: 12, color: '#d0d0d0', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.color = S.textTertiary}
          onMouseLeave={e => e.currentTarget.style.color = '#d0d0d0'}
        >+ 마일스톤 추가</div>

        {/* Backlog */}
        {backlogTasks.length > 0 && (
          <BacklogSection tasks={backlogTasks} onToggle={toggleDone} onOpen={(t) => openDetail(t)} />
        )}
      </div>
    </div>
  )
}

/* ═══ Task Row ═══ */
function TaskRow({ task, indent, color, isEditing, onStartEdit, onFinishEdit, onToggle, onDetail }) {
  const [hover, setHover] = useState(false)
  const inputRef = useRef(null)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: `6px 16px 6px ${16 + indent}px`,
        borderBottom: `0.5px solid ${S.border}`,
        background: hover ? '#fafaf8' : '#fff',
        transition: 'background 0.1s',
        minHeight: 36,
      }}
    >
      {/* Drag handle */}
      <div style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hover ? 0.35 : 0, transition: 'opacity 0.15s', cursor: 'grab', flexShrink: 0 }}>
        <svg width="8" height="12" viewBox="0 0 8 12" fill="#999">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
          <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
        </svg>
      </div>

      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle?.() }}
        style={{
          width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer',
          border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
          background: task.done ? CHECKBOX.checkedBg : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>

      {/* Task text — inline edit on double click */}
      {isEditing ? (
        <input
          ref={inputRef}
          autoFocus
          defaultValue={task.text}
          onBlur={(e) => onFinishEdit(task.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onFinishEdit(task.id, e.target.value) }
            if (e.key === 'Escape') { e.preventDefault(); onFinishEdit(task.id, null) }
          }}
          onMouseDown={e => e.stopPropagation()}
          style={{
            flex: 1, fontSize: FONT.body, border: 'none', outline: 'none',
            background: 'transparent', color: S.textPrimary, fontFamily: 'inherit', padding: 0,
          }}
        />
      ) : (
        <span
          onDoubleClick={onStartEdit}
          style={{
            flex: 1, fontSize: FONT.body, color: task.done ? S.textTertiary : S.textPrimary,
            textDecoration: task.done ? 'line-through' : 'none',
            lineHeight: 1.4, cursor: 'text',
          }}
        >
          {task.text}
        </span>
      )}

      {/* Assignee */}
      {task.assigneeId && (
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: '#888', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, fontWeight: 600,
        }}>
          {(task.assigneeName || '?')[0].toUpperCase()}
        </div>
      )}

      {/* Due date */}
      {task.dueDate && <span style={{ fontSize: FONT.tiny, color: S.textTertiary, flexShrink: 0 }}>{task.dueDate}</span>}

      {/* Detail arrow */}
      <div
        onClick={onDetail}
        style={{
          width: 24, height: 24, borderRadius: 4, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: hover ? 0.5 : 0, transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f0efeb'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

/* ═══ Done Tasks Group (collapsed by default) ═══ */
function DoneTasksGroup({ tasks, indent, color, onToggle, onDetail }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: `4px 16px 4px ${16 + indent}px`,
          fontSize: 11, color: S.textTertiary, cursor: 'pointer',
          borderBottom: `0.5px solid ${S.border}`, background: '#fcfcfb',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{ fontSize: 8 }}>{open ? '▾' : '▸'}</span>
        <span>완료 {tasks.length}건</span>
      </div>
      {open && tasks.map(t => (
        <div
          key={t.id}
          onClick={() => onDetail(t)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: `4px 16px 4px ${16 + indent}px`,
            borderBottom: `0.5px solid ${S.border}`, cursor: 'pointer',
          }}
        >
          <div style={{ width: 14 }} />
          <div
            onClick={(e) => { e.stopPropagation(); onToggle(t.id) }}
            style={{
              width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius,
              background: CHECKBOX.checkedBg, flexShrink: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontSize: FONT.body, color: S.textTertiary, textDecoration: 'line-through', flex: 1 }}>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══ Inline Add Row ═══ */
function InlineAddRow({ indent, onSubmit, onDone }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  const submit = () => {
    const val = text.trim()
    if (val) {
      onSubmit(val)
      setText('')
      setTimeout(() => inputRef.current?.focus(), 30)
    } else {
      onDone()
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: `5px 16px 5px ${16 + indent}px`,
      borderBottom: `0.5px solid ${S.border}`,
    }}>
      <div style={{ width: 14 }} />
      <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: `1.5px solid #e8e6df`, flexShrink: 0 }} />
      <input
        ref={inputRef}
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { e.preventDefault(); onDone() }
        }}
        onBlur={submit}
        placeholder="할일 입력 후 Enter"
        style={{
          flex: 1, fontSize: FONT.body, border: 'none', outline: 'none',
          background: 'transparent', color: S.textPrimary, fontFamily: 'inherit', padding: 0,
        }}
      />
    </div>
  )
}

/* ═══ Backlog Section ═══ */
function BacklogSection({ tasks, onToggle, onOpen }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: `1.5px dashed ${S.border}`, marginTop: 8 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: FONT.label, color: S.textTertiary }}>⊙</span>
        <span style={{ fontSize: FONT.label, fontWeight: 500, color: S.textTertiary }}>백로그</span>
        <span style={{ fontSize: FONT.caption, color: S.textTertiary }}>{tasks.length}건</span>
        <span style={{ fontSize: 9, color: S.textTertiary, marginLeft: 'auto' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && tasks.map(t => (
        <div
          key={t.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 40px', borderBottom: `0.5px solid ${S.border}`, cursor: 'pointer' }}
          onClick={() => onOpen(t)}
        >
          <div
            onClick={(e) => { e.stopPropagation(); onToggle(t.id) }}
            style={{
              width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer',
              border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
              background: t.done ? CHECKBOX.checkedBg : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {t.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ flex: 1, fontSize: FONT.body, color: t.done ? S.textTertiary : S.textPrimary, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
