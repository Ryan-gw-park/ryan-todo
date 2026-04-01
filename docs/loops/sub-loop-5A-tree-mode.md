# Sub-Loop 5-A: 프로젝트 '전체 할일' → 트리 그리드 뷰 교체

아래 명령을 순서대로 실행하라. 코드를 자의적으로 해석하거나 추가 수정하지 마라.

---

## Step 1: 새 파일 생성 — src/components/project/MsTaskTreeMode.jsx

아래 내용으로 새 파일을 생성하라.

```jsx
import { useState, useCallback, useRef, useMemo } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import { countTasksRecursive } from '../../utils/milestoneTree'

const S = COLOR

/* ═══════════════════════════════════════════════════════
   MsTaskTreeMode — 프로젝트 '전체 할일' 트리 그리드
   좌: 계층형 MS 컬럼 (depth별) / 우: 연결된 할일
   ═══════════════════════════════════════════════════════ */

export default function MsTaskTreeMode({
  tree, projectTasks, backlogTasks, projectId, pkmId, color,
  toggleDone, openDetail, addMilestone, updateMilestone, deleteMilestone, openConfirmDialog,
}) {
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)

  const [collapsed, setCollapsed] = useState(new Set())
  const [expandedDone, setExpandedDone] = useState(new Set())
  const [editingMsId, setEditingMsId] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [addingTaskMsId, setAddingTaskMsId] = useState(null)
  const [hoverMsId, setHoverMsId] = useState(null)

  // ─── Collapse/Expand ───
  const toggleNode = useCallback((id) => {
    setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])

  const collapseAll = useCallback(() => {
    const ids = new Set()
    function collect(nodes) { nodes.forEach(n => { if ((n.children || []).length > 0) { ids.add(n.id); collect(n.children) } }) }
    collect(tree)
    setCollapsed(ids)
  }, [tree])

  const expandAll = useCallback(() => { setCollapsed(new Set()) }, [])

  // ─── MS CRUD ───
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
    if (value !== null && value !== undefined && value.trim()) {
      updateMilestone(msId, { title: value.trim() })
    }
  }, [updateMilestone])

  // ─── Task CRUD ───
  const handleTaskEditFinish = useCallback((taskId, value) => {
    setEditingTaskId(null)
    if (value && value.trim()) {
      updateTask(taskId, { text: value.trim() })
    }
  }, [updateTask])

  const handleAddTaskSubmit = useCallback(async (msId, text) => {
    if (!text.trim()) { setAddingTaskMsId(null); return }
    await addTask({ text: text.trim(), projectId, keyMilestoneId: msId, category: 'backlog' })
  }, [addTask, projectId])

  // ─── Compute max depth ───
  function getMaxDepth(nodes, d = 0) {
    let max = d
    nodes.forEach(n => { if ((n.children || []).length > 0) max = Math.max(max, getMaxDepth(n.children, d + 1)) })
    return max
  }
  const maxDepth = useMemo(() => getMaxDepth(tree) + 1, [tree])
  const COL_W = 180
  const TASK_MIN_W = 360

  // ─── Build visible rows ───
  const visibleRows = useMemo(() => {
    const rows = []
    function build(nodes, depth) {
      nodes.forEach(node => {
        const childMs = (node.children || []).filter(c => c.id)
        const isLeaf = childMs.length === 0
        const isCollapsed = collapsed.has(node.id)

        if (isLeaf) {
          const allTasks = projectTasks.filter(t => t.keyMilestoneId === node.id && !t.deletedAt)
          const undone = allTasks.filter(t => !t.done).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          const doneT = allTasks.filter(t => t.done)

          // First row: MS title + first task
          rows.push({ type: 'leaf', node, depth, task: undone[0] || null, isFirst: true })
          // Additional tasks
          undone.slice(1).forEach(t => rows.push({ type: 'leaf-task', node, depth, task: t }))
          // Done summary
          if (doneT.length > 0) {
            const isExp = expandedDone.has(node.id)
            rows.push({ type: 'done-summary', node, depth, doneCount: doneT.length, isExpanded: isExp })
            if (isExp) doneT.forEach(t => rows.push({ type: 'done-task', node, depth, task: t }))
          }
          // Add task row
          rows.push({ type: 'add-task', node, depth })
        } else {
          rows.push({ type: 'group', node, depth, isCollapsed })
          if (!isCollapsed) {
            build(childMs, depth + 1)
            rows.push({ type: 'add-child-ms', node, depth: depth + 1 })
          }
        }
      })
    }
    build(tree, 0)
    return rows
  }, [tree, projectTasks, collapsed, expandedDone])

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ minWidth: maxDepth * COL_W + TASK_MIN_W, padding: '0 24px' }}>

        {/* ─── Toolbar: 모두 접기/펼치기 ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: `1px solid ${S.border}`, background: '#fff', position: 'sticky', top: 0, zIndex: 4 }}>
          <button onClick={expandAll} style={toolBtnStyle}>모두 펼치기</button>
          <button onClick={collapseAll} style={toolBtnStyle}>모두 접기</button>
        </div>

        {/* ─── Column headers ─── */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, background: S.bgSurface, position: 'sticky', top: 34, zIndex: 3 }}>
          {Array.from({ length: maxDepth }, (_, i) => (
            <div key={i} style={{
              width: COL_W, flexShrink: 0, padding: '6px 10px',
              fontSize: FONT.caption, fontWeight: 600, color: S.textTertiary,
              borderRight: `0.5px solid ${S.border}`,
            }}>
              {i === 0 ? '마일스톤' : `하위 ${i}`}
            </div>
          ))}
          <div style={{ flex: 1, padding: '6px 10px', fontSize: FONT.caption, fontWeight: 600, color: S.textTertiary, minWidth: TASK_MIN_W }}>
            연결된 할일
          </div>
        </div>

        {/* ─── Rows ─── */}
        {visibleRows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: S.textTertiary, fontSize: FONT.body }}>마일스톤이 없습니다</div>
        )}

        {visibleRows.map((row, ri) => {
          const dotColor = color?.dot || '#888'

          // ═══ Group MS (has children) ═══
          if (row.type === 'group') {
            const isHover = hoverMsId === row.node.id
            const isEditing = editingMsId === row.node.id
            return (
              <div key={`g-${row.node.id}`}
                onMouseEnter={() => setHoverMsId(row.node.id)}
                onMouseLeave={() => setHoverMsId(null)}
                style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, background: row.depth === 0 ? S.bgSurface : '#fff', minHeight: 32 }}
              >
                {/* Empty cols before */}
                {Array.from({ length: row.depth }, (_, i) => (
                  <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                {/* MS cell */}
                <div style={{ width: COL_W, flexShrink: 0, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, borderRight: `0.5px solid ${S.border}` }}>
                  <span onClick={() => toggleNode(row.node.id)} style={{ fontSize: 9, color: S.textTertiary, cursor: 'pointer', flexShrink: 0, width: 10, textAlign: 'center', transition: 'transform 0.15s', transform: row.isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>▾</span>
                  <div style={{ width: row.depth === 0 ? 8 : 7, height: row.depth === 0 ? 8 : 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  {isEditing ? (
                    <input autoFocus defaultValue={row.node.title}
                      onBlur={e => handleMsEditFinish(row.node.id, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMsEditFinish(row.node.id, e.target.value) } if (e.key === 'Escape') setEditingMsId(null) }}
                      onMouseDown={e => e.stopPropagation()}
                      style={{ flex: 1, fontSize: row.depth === 0 ? 13 : 12, fontWeight: row.depth === 0 ? 700 : 600, border: 'none', outline: 'none', background: 'transparent', color: S.textPrimary, fontFamily: 'inherit', padding: 0, minWidth: 0 }}
                    />
                  ) : (
                    <span onDoubleClick={() => setEditingMsId(row.node.id)} style={{ fontSize: row.depth === 0 ? 13 : 12, fontWeight: row.depth === 0 ? 700 : 600, color: S.textPrimary, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }} title={row.node.title}>
                      {row.node.title || '(제목 없음)'}
                    </span>
                  )}
                  {isHover && !isEditing && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <span onClick={e => { e.stopPropagation(); handleAddChildMs(row.node.id) }} style={{ fontSize: 10, color: dotColor, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>+하위</span>
                      <span onClick={e => { e.stopPropagation(); handleDeleteMs(row.node.id, row.node.title) }} style={{ fontSize: 10, color: '#ccc', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#c53030'}
                        onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
                      >삭제</span>
                    </div>
                  )}
                </div>
                {/* Empty remaining cols + task area */}
                {Array.from({ length: maxDepth - row.depth - 1 }, (_, i) => (
                  <div key={`e${i}`} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <div style={{ flex: 1, minWidth: TASK_MIN_W }} />
              </div>
            )
          }

          // ═══ Leaf MS (first row: MS title + first task) ═══
          if (row.type === 'leaf') {
            const isHover = hoverMsId === row.node.id
            const isEditing = editingMsId === row.node.id
            return (
              <div key={`l-${row.node.id}`}
                onMouseEnter={() => setHoverMsId(row.node.id)}
                onMouseLeave={() => setHoverMsId(null)}
                style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, minHeight: 32 }}
              >
                {Array.from({ length: row.depth }, (_, i) => (
                  <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <div style={{ width: COL_W, flexShrink: 0, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, borderRight: `0.5px solid ${S.border}` }}>
                  <span style={{ width: 10, flexShrink: 0 }} />
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  {isEditing ? (
                    <input autoFocus defaultValue={row.node.title}
                      onBlur={e => handleMsEditFinish(row.node.id, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMsEditFinish(row.node.id, e.target.value) } if (e.key === 'Escape') setEditingMsId(null) }}
                      onMouseDown={e => e.stopPropagation()}
                      style={{ flex: 1, fontSize: 12, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: S.textPrimary, fontFamily: 'inherit', padding: 0, minWidth: 0 }}
                    />
                  ) : (
                    <span onDoubleClick={() => setEditingMsId(row.node.id)} style={{ fontSize: 12, fontWeight: 600, color: S.textPrimary, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }} title={row.node.title}>
                      {row.node.title || '(제목 없음)'}
                    </span>
                  )}
                  {isHover && !isEditing && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <span onClick={e => { e.stopPropagation(); handleAddChildMs(row.node.id) }} style={{ fontSize: 10, color: dotColor, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>+하위</span>
                      <span onClick={e => { e.stopPropagation(); handleDeleteMs(row.node.id, row.node.title) }} style={{ fontSize: 10, color: '#ccc', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#c53030'}
                        onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
                      >삭제</span>
                    </div>
                  )}
                </div>
                {Array.from({ length: maxDepth - row.depth - 1 }, (_, i) => (
                  <div key={`e${i}`} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <TaskCell task={row.task} editingTaskId={editingTaskId} onStartEdit={setEditingTaskId} onFinishEdit={handleTaskEditFinish} onToggle={toggleDone} onDetail={openDetail} minW={TASK_MIN_W} />
              </div>
            )
          }

          // ═══ Additional task row ═══
          if (row.type === 'leaf-task') {
            return (
              <div key={`lt-${row.task?.id || ri}`} style={{ display: 'flex', borderBottom: '0.5px solid #f8f8f6', minHeight: 30 }}>
                {Array.from({ length: maxDepth }, (_, i) => (
                  <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <TaskCell task={row.task} editingTaskId={editingTaskId} onStartEdit={setEditingTaskId} onFinishEdit={handleTaskEditFinish} onToggle={toggleDone} onDetail={openDetail} minW={TASK_MIN_W} />
              </div>
            )
          }

          // ═══ Done summary ═══
          if (row.type === 'done-summary') {
            return (
              <div key={`ds-${row.node.id}`}
                onClick={() => setExpandedDone(prev => { const n = new Set(prev); if (n.has(row.node.id)) n.delete(row.node.id); else n.add(row.node.id); return n })}
                style={{ display: 'flex', borderBottom: '0.5px solid #f8f8f6', minHeight: 24, cursor: 'pointer' }}
              >
                {Array.from({ length: maxDepth }, (_, i) => (
                  <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <div style={{ flex: 1, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 4, minWidth: TASK_MIN_W }}>
                  <span style={{ fontSize: 8, color: S.textTertiary }}>{row.isExpanded ? '▾' : '▸'}</span>
                  <span style={{ fontSize: 11, color: S.textTertiary }}>완료 {row.doneCount}건</span>
                </div>
              </div>
            )
          }

          // ═══ Done task ═══
          if (row.type === 'done-task') {
            return (
              <div key={`dt-${row.task.id}`} style={{ display: 'flex', borderBottom: '0.5px solid #f8f8f6', minHeight: 26 }}>
                {Array.from({ length: maxDepth }, (_, i) => (
                  <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <div style={{ flex: 1, padding: '3px 12px 3px 40px', display: 'flex', alignItems: 'center', gap: 8, minWidth: TASK_MIN_W }}>
                  <div onClick={e => { e.stopPropagation(); toggleDone(row.task.id) }} style={{
                    width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius,
                    background: CHECKBOX.checkedBg, flexShrink: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <span onClick={() => openDetail(row.task)} style={{ fontSize: FONT.body, color: S.textTertiary, textDecoration: 'line-through', flex: 1, cursor: 'pointer' }}>{row.task.text}</span>
                </div>
              </div>
            )
          }

          // ═══ Add task row ═══
          if (row.type === 'add-task') {
            return (
              <div key={`at-${row.node.id}`} style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, minHeight: 24 }}>
                {Array.from({ length: maxDepth }, (_, i) => (
                  <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <div style={{ flex: 1, padding: '3px 12px', minWidth: TASK_MIN_W }}>
                  {addingTaskMsId === row.node.id ? (
                    <InlineAddRow
                      onSubmit={text => handleAddTaskSubmit(row.node.id, text)}
                      onDone={() => setAddingTaskMsId(null)}
                    />
                  ) : (
                    <span onClick={() => setAddingTaskMsId(row.node.id)}
                      style={{ fontSize: 11, color: '#d0d0d0', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.color = S.textTertiary}
                      onMouseLeave={e => e.currentTarget.style.color = '#d0d0d0'}
                    >+ 추가</span>
                  )}
                </div>
              </div>
            )
          }

          // ═══ Add child MS row ═══
          if (row.type === 'add-child-ms') {
            return (
              <div key={`ac-${row.node.id}`} style={{ display: 'flex', borderBottom: '0.5px solid #f0f0f0', minHeight: 24 }}>
                {Array.from({ length: row.depth }, (_, i) => (
                  <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <div style={{ width: COL_W, flexShrink: 0, padding: '3px 10px', borderRight: '0.5px solid #f0f0f0' }}>
                  <span onClick={() => handleAddChildMs(row.node.id)}
                    style={{ fontSize: 11, color: '#d0d0d0', cursor: 'pointer', paddingLeft: 15 }}
                    onMouseEnter={e => e.currentTarget.style.color = color?.dot || '#888'}
                    onMouseLeave={e => e.currentTarget.style.color = '#d0d0d0'}
                  >+ 마일스톤 추가</span>
                </div>
                {Array.from({ length: maxDepth - row.depth - 1 }, (_, i) => (
                  <div key={`e${i}`} style={{ width: COL_W, flexShrink: 0, borderRight: '0.5px solid #f0f0f0' }} />
                ))}
                <div style={{ flex: 1, minWidth: TASK_MIN_W }} />
              </div>
            )
          }

          return null
        })}

        {/* Root + 마일스톤 추가 */}
        <div style={{ padding: '10px 10px', fontSize: 12, color: '#d0d0d0', cursor: 'pointer' }}
          onClick={() => handleAddChildMs(null)}
          onMouseEnter={e => e.currentTarget.style.color = S.textTertiary}
          onMouseLeave={e => e.currentTarget.style.color = '#d0d0d0'}
        >+ 마일스톤 추가</div>

        {/* Backlog */}
        {backlogTasks.length > 0 && (
          <BacklogSection tasks={backlogTasks} onToggle={toggleDone} onOpen={t => openDetail(t)} />
        )}
      </div>
    </div>
  )
}

/* ═══ Task Cell ═══ */
function TaskCell({ task, editingTaskId, onStartEdit, onFinishEdit, onToggle, onDetail, minW }) {
  const [hover, setHover] = useState(false)
  if (!task) return <div style={{ flex: 1, minWidth: minW }} />

  const isEditing = editingTaskId === task.id

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', minWidth: minW,
        background: hover ? '#fafaf8' : 'transparent', transition: 'background 0.1s',
      }}
    >
      {/* Drag handle (visual only for now — DnD in Sub-Loop 5-B) */}
      <div style={{ width: 12, opacity: hover ? 0.35 : 0, transition: 'opacity 0.15s', cursor: 'grab', flexShrink: 0 }}>
        <svg width="8" height="12" viewBox="0 0 8 12" fill="#999">
          <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
          <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
        </svg>
      </div>

      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggle(task.id) }} style={{
        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer',
        border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
        background: task.done ? CHECKBOX.checkedBg : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>

      {/* Title — click to edit */}
      {isEditing ? (
        <input autoFocus defaultValue={task.text}
          onBlur={e => onFinishEdit(task.id, e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onFinishEdit(task.id, e.target.value) }
            if (e.key === 'Escape') onFinishEdit(task.id, null)
          }}
          onMouseDown={e => e.stopPropagation()}
          style={{ flex: 1, fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
        />
      ) : (
        <span onDoubleClick={() => onStartEdit(task.id)} style={{
          flex: 1, fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
          textDecoration: task.done ? 'line-through' : 'none', lineHeight: 1.4, cursor: 'text',
        }}>{task.text}</span>
      )}

      {/* Due date */}
      {task.dueDate && <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate}</span>}

      {/* Detail arrow */}
      <div onClick={() => onDetail(task)} style={{
        width: 22, height: 22, borderRadius: 4, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', opacity: hover ? 0.5 : 0, transition: 'opacity 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#f0efeb'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

/* ═══ Inline Add Row ═══ */
function InlineAddRow({ onSubmit, onDone }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const submit = () => {
    const val = text.trim()
    if (val) { onSubmit(val); setText(''); setTimeout(() => inputRef.current?.focus(), 30) }
    else onDone()
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: '1.5px solid #e8e6df', flexShrink: 0 }} />
      <input ref={inputRef} autoFocus value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } if (e.key === 'Escape') onDone() }}
        onBlur={submit} placeholder="할일 입력 후 Enter"
        style={{ flex: 1, fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
      />
    </div>
  )
}

/* ═══ Backlog Section ═══ */
function BacklogSection({ tasks, onToggle, onOpen }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: `1.5px dashed ${COLOR.border}`, marginTop: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer' }}>
        <span style={{ fontSize: FONT.label, color: COLOR.textTertiary }}>⊙</span>
        <span style={{ fontSize: FONT.label, fontWeight: 500, color: COLOR.textTertiary }}>백로그</span>
        <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>{tasks.length}건</span>
        <span style={{ fontSize: 9, color: COLOR.textTertiary, marginLeft: 'auto' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && tasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 40px', borderBottom: `0.5px solid ${COLOR.border}`, cursor: 'pointer' }} onClick={() => onOpen(t)}>
          <div onClick={e => { e.stopPropagation(); onToggle(t.id) }} style={{
            width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer',
            border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`, background: t.done ? CHECKBOX.checkedBg : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {t.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ flex: 1, fontSize: FONT.body, color: t.done ? COLOR.textTertiary : COLOR.textPrimary, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══ Toolbar button style ═══ */
const toolBtnStyle = {
  border: 'none', borderRadius: 5, padding: '3px 10px',
  fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
  background: '#f5f4f0', color: '#a09f99', fontWeight: 500,
}
```

---

## Step 2: UnifiedProjectView.jsx — import 교체

old_str:
```
import InlineTimelineView from '../views/InlineTimelineView'
```

new_str:
```
import InlineTimelineView from '../views/InlineTimelineView'
import MsTaskTreeMode from './MsTaskTreeMode'
```

---

## Step 3: UnifiedProjectView.jsx — '전체 할일' 블록을 MsTaskTreeMode로 교체

old_str:
```
        {/* Task list mode → existing tree + task rows */}
        {rightMode === '전체 할일' && <>
        {/* Column headers */}
        <div style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, background: '#fafaf8', flexShrink: 0 }}>
          {/* Left: tree column headers */}
          <div style={{ width: totalTreeWidth, flexShrink: 0, display: 'flex', position: 'sticky', left: 0, zIndex: 4, background: '#fafaf8' }}>
```

new_str:
```
        {/* Task list mode → tree grid */}
        {rightMode === '전체 할일' && (
          <MsTaskTreeMode
            tree={tree}
            projectTasks={projectTasks}
            backlogTasks={backlogTasks}
            projectId={projectId}
            pkmId={pkmId}
            color={color}
            toggleDone={toggleDone}
            openDetail={openDetail}
            addMilestone={addMilestone}
            updateMilestone={updateMilestone}
            deleteMilestone={deleteMilestone}
            openConfirmDialog={openConfirmDialog}
          />
        )}

        {/* ═══ OLD LAYOUT — disabled ═══ */}
        {false && <>
        {/* Column headers */}
        <div style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, background: '#fafaf8', flexShrink: 0 }}>
          {/* Left: tree column headers */}
          <div style={{ width: totalTreeWidth, flexShrink: 0, display: 'flex', position: 'sticky', left: 0, zIndex: 4, background: '#fafaf8' }}>
```

---

## Step 4: 빌드 후 dead code 정리

빌드 성공 확인 후:

```bash
# OLD LAYOUT 시작 줄 확인
grep -n "OLD LAYOUT" src/components/project/UnifiedProjectView.jsx
# </>} 끝 줄 확인
grep -n "</>\}" src/components/project/UnifiedProjectView.jsx
```

해당 범위(`{false && <>` ~ `</>}`) 전체를 삭제하라.
기존 `BacklogSection` 함수 정의도 삭제 (MsTaskTreeMode에 자체 포함).

---

## 검증

```bash
npm run build
```

- [ ] 정기주총 → '전체 할일' → 트리 그리드 렌더 (좌: MS 컬럼 / 우: 할일)
- [ ] ABI 코리아 → 3~4단 계층 MS가 depth별 컬럼에 표시
- [ ] "모두 접기" 버튼 → 모든 그룹 MS 접힘
- [ ] "모두 펼치기" 버튼 → 모든 그룹 MS 펼침
- [ ] 개별 MS ▾ 클릭 → 해당 노드만 접기/펼치기
- [ ] MS 더블클릭 → 인라인 제목 편집 (Enter 저장, Escape 취소)
- [ ] MS hover → "+하위" / "삭제" 버튼 표시
- [ ] 그룹 MS 펼침 시 하단에 "+ 마일스톤 추가" 행 표시
- [ ] 할일 더블클릭 → 인라인 텍스트 편집
- [ ] 할일 ▸ 클릭 → openDetail 호출 (상세 패널 열림)
- [ ] 할일 체크박스 → 완료 토글
- [ ] 완료 할일 → "완료 N건" 접힌 그룹 표시, 클릭으로 펼침
- [ ] "+ 추가" → 인라인 할일 입력 → Enter → 생성
- [ ] 백로그 섹션 동작
- [ ] '타임라인' 모드 전환 여전히 정상
- [ ] npm run build 성공

git push origin main
