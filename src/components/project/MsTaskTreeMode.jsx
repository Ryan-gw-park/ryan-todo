import { useState, useCallback, useRef, useEffect } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'


/* ═══════════════════════════════════════════════════════
   MsTaskTreeMode v5 — 프로젝트 '전체 할일' 들여쓰기 트리
   좌: 들여쓰기 MS 트리 (340px) / 우: 연결된 할일
   DnD: 할일→MS 이동, MS→하위/순서 변경, Ctrl+Z 되돌리기
   ═══════════════════════════════════════════════════════ */

const TREE_W = 340

export default function MsTaskTreeMode({
  tree, projectTasks, backlogTasks, projectId, pkmId, color,
  toggleDone, openDetail, addMilestone, updateMilestone, deleteMilestone, openConfirmDialog,
  externalCollapsed, onToggleNode, onExpandAll, onCollapseAll,
}) {
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)
  const reorderTasks = useStore(s => s.reorderTasks)
  const moveMilestone = useStore(s => s.moveMilestone)
  const reorderMilestones = useStore(s => s.reorderMilestones)
  const milestones = useStore(s => s.milestones)
  const currentTeamId = useStore(s => s.currentTeamId)

  // ─── Member map (assigneeId → displayName) ───
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName || m.name || '?' })
      setMemberMap(map)
    })
  }, [currentTeamId])

  const [internalCollapsed, setInternalCollapsed] = useState(new Set())
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed
  const [hoverId, setHoverId] = useState(null)
  const [editingMsId, setEditingMsId] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [addingTaskMsId, setAddingTaskMsId] = useState(null)
  const [dragState, setDragState] = useState(null) // { type: 'task'|'ms', id }
  const [toast, setToast] = useState(null)
  const dotColor = color?.dot || '#888'

  // ─── Undo ───
  const undoStack = useRef([])
  const pushUndo = useCallback((action) => {
    undoStack.current.push(action)
    if (undoStack.current.length > 20) undoStack.current.shift()
  }, [])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const action = undoStack.current.pop()
    action.undo()
    setToast({ msg: `되돌림: ${action.label}`, canUndo: undoStack.current.length > 0 })
    setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  const showToast = (msg) => {
    setToast({ msg, canUndo: true })
    setTimeout(() => setToast(null), 4000)
  }

  // ─── Collapse/Expand ───
  const toggleNode = useCallback((id) => {
    if (onToggleNode) { onToggleNode(id); return }
    setInternalCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [onToggleNode])

  const expandAll = useCallback(() => {
    if (onExpandAll) { onExpandAll(); return }
    setInternalCollapsed(new Set())
  }, [onExpandAll])

  const collapseAll = useCallback(() => {
    if (onCollapseAll) { onCollapseAll(); return }
    const ids = new Set()
    const walk = (nodes) => nodes.forEach(n => { if ((n.children || []).length > 0) { ids.add(n.id); walk(n.children) } })
    walk(tree)
    setInternalCollapsed(ids)
  }, [onCollapseAll, tree])

  // ─── MS CRUD ───
  const handleAddChildMs = useCallback(async (parentId) => {
    if (!pkmId) return
    const data = await addMilestone(projectId, pkmId, '', parentId)
    if (data) {
      setEditingMsId(data.id)
      // 부모 펼치기
      if (parentId) setCollapsed(prev => { const n = new Set(prev); n.delete(parentId); return n })
    }
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
    if (value && value.trim()) updateTask(taskId, { text: value.trim() })
  }, [updateTask])

  const handleAddTaskSubmit = useCallback(async (msId, text) => {
    if (!text.trim()) { setAddingTaskMsId(null); return }
    await addTask({ text: text.trim(), projectId, keyMilestoneId: msId, category: 'backlog' })
  }, [addTask, projectId])

  // ─── DnD: Task → MS ───
  const handleTaskDrop = useCallback((taskId, fromMsId, toMsId) => {
    setDragState(null)
    if (fromMsId === toMsId) return
    const fromMs = milestones.find(m => m.id === fromMsId)
    const toMs = milestones.find(m => m.id === toMsId)
    pushUndo({ label: `할일 이동`, undo: () => updateTask(taskId, { keyMilestoneId: fromMsId }) })
    updateTask(taskId, { keyMilestoneId: toMsId })
    showToast(`할일을 "${fromMs?.title || '?'}" → "${toMs?.title || '?'}"로 이동`)
  }, [milestones, updateTask, pushUndo])

  // ─── DnD: MS → 하위 이동 ───
  const handleMsDropChild = useCallback((msId, targetId) => {
    setDragState(null)
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const oldParentId = ms?.parent_id || null
    pushUndo({ label: `MS 하위 이동`, undo: () => moveMilestone(msId, oldParentId) })
    moveMilestone(msId, targetId)
    const target = milestones.find(m => m.id === targetId)
    showToast(`"${ms?.title || '?'}"을 "${target?.title || '?'}" 하위로 이동`)
    // 대상 펼치기
    setCollapsed(prev => { const n = new Set(prev); n.delete(targetId); return n })
  }, [milestones, moveMilestone, pushUndo])

  // ─── DnD: MS → 순서 변경 ───
  const handleMsReorder = useCallback((msId, targetId, position) => {
    setDragState(null)
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const target = milestones.find(m => m.id === targetId)
    if (!ms || !target) return

    // 같은 부모의 siblings 중에서 순서 변경
    const oldParentId = ms.parent_id || null
    const targetParentId = target.parent_id || null

    // 부모가 다르면 먼저 이동
    if (oldParentId !== targetParentId) {
      pushUndo({ label: `MS 이동+순서`, undo: () => moveMilestone(msId, oldParentId) })
      moveMilestone(msId, targetParentId)
    }

    // siblings 재정렬
    setTimeout(() => {
      const siblings = milestones
        .filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId && m.id !== msId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const idx = siblings.findIndex(s => s.id === targetId)
      if (idx === -1) return
      const insertIdx = position === 'above' ? idx : idx + 1
      const reordered = [...siblings]
      reordered.splice(insertIdx, 0, milestones.find(m => m.id === msId))
      reorderMilestones(reordered)

      if (oldParentId === targetParentId) {
        pushUndo({ label: `MS 순서 변경`, undo: () => {
          const original = milestones
            .filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          reorderMilestones(original)
        }})
      }
    }, 100)

    showToast(`"${ms?.title || '?'}" 순서 변경`)
  }, [milestones, moveMilestone, reorderMilestones, pushUndo])

  const handleDragEnd = useCallback(() => setDragState(null), [])

  // ─── Count ───
  const countAll = useCallback((n) => {
    let c = projectTasks.filter(t => t.keyMilestoneId === n.id && !t.done && !t.deletedAt).length
    ;(n.children || []).forEach(ch => { c += countAll(ch) })
    return c
  }, [projectTasks])

  return (
    <div style={{ flex: 1, overflow: 'auto' }} onDragEnd={handleDragEnd}>
      <div style={{ padding: '0 20px' }}>

        {/* Toolbar */}
        {!externalCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: `1px solid ${COLOR.border}`, position: 'sticky', top: 0, zIndex: 4, background: '#fff' }}>
            <button onClick={expandAll} style={{ border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer', background: COLOR.bgHover, color: COLOR.textSecondary, fontWeight: 500 }}>모두 펼치기</button>
            <button onClick={collapseAll} style={{ border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer', background: COLOR.bgHover, color: COLOR.textSecondary, fontWeight: 500 }}>모두 접기</button>
          </div>
        )}

        {/* Grid */}
        <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
          {/* Header */}
          <div style={{ display: 'flex', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}` }}>
            <div style={{ width: TREE_W, flexShrink: 0, padding: '6px 8px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}` }}>
              마일스톤
            </div>
            <div style={{ flex: 1, padding: '6px 8px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary }}>
              연결된 할일
            </div>
          </div>

          {/* Tree rows */}
          {tree.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>마일스톤이 없습니다</div>
          )}
          {tree.map(node => (
            <MsNode
              key={node.id} node={node} depth={0} dotColor={dotColor}
              collapsed={collapsed} toggleNode={toggleNode}
              hoverId={hoverId} setHoverId={setHoverId}
              editingMsId={editingMsId} setEditingMsId={setEditingMsId}
              editingTaskId={editingTaskId} setEditingTaskId={setEditingTaskId}
              addingTaskMsId={addingTaskMsId} setAddingTaskMsId={setAddingTaskMsId}
              onMsEditFinish={handleMsEditFinish} onAddChildMs={handleAddChildMs} onDeleteMs={handleDeleteMs}
              onTaskEditFinish={handleTaskEditFinish} onAddTaskSubmit={handleAddTaskSubmit}
              toggleDone={toggleDone} openDetail={openDetail}
              projectTasks={projectTasks} countAll={countAll}
              dragState={dragState} setDragState={setDragState}
              onTaskDrop={handleTaskDrop} onMsDropChild={handleMsDropChild} onMsReorder={handleMsReorder}
            />
          ))}

          {/* Root + 마일스톤 추가 */}
          <HoverAdd onClick={() => handleAddChildMs(null)} indent={8 + 12 + 5} />
        </div>

        {/* Backlog */}
        {backlogTasks.length > 0 && (
          <BacklogSection tasks={backlogTasks} onToggle={toggleDone} onOpen={openDetail} />
        )}
      </div>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} canUndo={toast.canUndo} onUndo={undo} onClose={() => setToast(null)} />}
    </div>
  )
}

/* ═══ MsNode — 재귀 트리 노드 ═══ */
function MsNode({ node, depth, dotColor, collapsed, toggleNode, hoverId, setHoverId,
  editingMsId, setEditingMsId, editingTaskId, setEditingTaskId,
  addingTaskMsId, setAddingTaskMsId,
  onMsEditFinish, onAddChildMs, onDeleteMs,
  onTaskEditFinish, onAddTaskSubmit,
  toggleDone, openDetail, projectTasks, countAll,
  dragState, setDragState, onTaskDrop, onMsDropChild, onMsReorder,
  memberMap,
}) {
  const hasChildren = (node.children || []).length > 0
  const isCollapsed = collapsed.has(node.id)
  const isHover = hoverId === node.id
  const isEditing = editingMsId === node.id

  const allTasks = projectTasks.filter(t => t.keyMilestoneId === node.id && !t.deletedAt)
  const activeTasks = allTasks.filter(t => !t.done).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const doneTasks = allTasks.filter(t => t.done)
  const total = countAll(node)

  const [dropTarget, setDropTarget] = useState(null) // 'task-zone' | 'ms-child' | 'ms-above' | 'ms-below'
  const [expandedDone, setExpandedDone] = useState(false)

  const handleDragOver = (e, zone) => { e.preventDefault(); e.stopPropagation(); setDropTarget(zone) }
  const handleDragLeave = () => setDropTarget(null)

  const handleDrop = (e, zone) => {
    e.preventDefault(); e.stopPropagation(); setDropTarget(null)
    const type = e.dataTransfer.getData('type')
    if (type === 'task' && zone === 'task-zone') {
      const taskId = e.dataTransfer.getData('taskId')
      const fromMsId = e.dataTransfer.getData('fromMsId')
      if (fromMsId !== node.id) onTaskDrop(taskId, fromMsId, node.id)
    }
    if (type === 'ms') {
      const msId = e.dataTransfer.getData('msId')
      if (msId === node.id) return
      if (zone === 'ms-child') onMsDropChild(msId, node.id)
      if (zone === 'ms-above') onMsReorder(msId, node.id, 'above')
      if (zone === 'ms-below') onMsReorder(msId, node.id, 'below')
    }
  }

  const hasContent = activeTasks.length > 0 || doneTasks.length > 0

  return (
    <>
      {dropTarget === 'ms-above' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

      <div
        onMouseEnter={() => setHoverId(node.id)}
        onMouseLeave={() => setHoverId(null)}
        style={{
          display: 'flex', alignItems: 'stretch',
          borderBottom: `1px solid ${COLOR.border}`,
          background: dropTarget === 'ms-child' ? 'rgba(49,130,206,0.08)' : 'transparent',
          outline: dropTarget === 'ms-child' ? '2px dashed #3182CE' : 'none',
          outlineOffset: -2,
        }}
      >
        {/* Left: MS name */}
        <div
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('type', 'ms')
            e.dataTransfer.setData('msId', node.id)
            setDragState({ type: 'ms', id: node.id })
          }}
          onDragOver={e => {
            if (dragState?.type === 'ms') {
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              const zone = y < rect.height * 0.25 ? 'ms-above' : y > rect.height * 0.75 ? 'ms-below' : 'ms-child'
              handleDragOver(e, zone)
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={e => { if (dragState?.type === 'ms') handleDrop(e, dropTarget || 'ms-child') }}
          style={{
            width: TREE_W, flexShrink: 0, padding: '5px 8px', paddingLeft: 8 + depth * 22,
            display: 'flex', alignItems: 'center', gap: 5,
            borderRight: `1px solid ${COLOR.border}`, cursor: 'grab',
          }}
        >
          {hasChildren ? (
            <span onClick={ev => { ev.stopPropagation(); ev.preventDefault(); toggleNode(node.id) }}
              style={{ fontSize: 11, color: COLOR.textSecondary, width: 12, textAlign: 'center', cursor: 'pointer',
                transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
          ) : <span style={{ width: 12, flexShrink: 0 }} />}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />

          {isEditing ? (
            <input autoFocus defaultValue={node.title}
              onBlur={e => onMsEditFinish(node.id, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onMsEditFinish(node.id, e.target.value) } if (e.key === 'Escape') setEditingMsId(null) }}
              onMouseDown={e => e.stopPropagation()}
              style={{ flex: 1, fontSize: FONT.label, fontWeight: depth === 0 ? 600 : 500, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0, minWidth: 0 }}
            />
          ) : (
            <span onDoubleClick={() => setEditingMsId(node.id)} style={{
              fontSize: FONT.label, fontWeight: depth === 0 ? 600 : 500, color: COLOR.textPrimary,
              flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35, cursor: 'text',
            }}>{node.title || '(제목 없음)'}</span>
          )}

          {total > 0 && <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, flexShrink: 0 }}>{total}</span>}

          {isHover && !isEditing && !dragState && (
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              <span onClick={e => { e.stopPropagation(); onAddChildMs(node.id) }}
                style={{ fontSize: 9, color: COLOR.textTertiary, cursor: 'pointer', padding: '0 3px' }}>+하위</span>
              <span onClick={e => { e.stopPropagation(); onDeleteMs(node.id, node.title) }}
                style={{ fontSize: 9, color: '#ef4444', cursor: 'pointer', padding: '0 3px' }}>삭제</span>
            </div>
          )}
        </div>

        {/* Right: tasks (drop zone) */}
        <div
          onDragOver={e => { if (dragState?.type === 'task') handleDragOver(e, 'task-zone') }}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, 'task-zone')}
          style={{
            flex: 1, padding: hasContent ? '3px 8px' : '5px 8px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            background: dropTarget === 'task-zone' ? 'rgba(49,130,206,0.08)' : 'transparent',
            outline: dropTarget === 'task-zone' ? '2px dashed #3182CE' : 'none',
            outlineOffset: -2,
          }}
        >
          {/* Empty state */}
          {!hasContent && !hasChildren && (
            <span style={{ fontSize: FONT.tiny, color: '#ddd' }}>
              {isHover ? (
                addingTaskMsId === node.id ? (
                  <InlineAddRow onSubmit={text => onAddTaskSubmit(node.id, text)} onDone={() => setAddingTaskMsId(null)} />
                ) : (
                  <span onClick={() => setAddingTaskMsId(node.id)} style={{ color: COLOR.textTertiary, cursor: 'pointer' }}>+ 추가</span>
                )
              ) : '—'}
            </span>
          )}

          {/* Active tasks */}
          {activeTasks.map((t, i) => (
            <DragTask key={t.id} task={t} msId={node.id}
              isEditing={editingTaskId === t.id}
              onStartEdit={() => setEditingTaskId(t.id)}
              onFinishEdit={(val) => onTaskEditFinish(t.id, val)}
              onToggle={() => toggleDone(t.id)}
              onDetail={() => openDetail(t)}
              setDragState={setDragState}
              isLast={i === activeTasks.length - 1}
              showAddOnLast={isHover}
              onAddClick={() => setAddingTaskMsId(node.id)}
              memberMap={memberMap}
            />
          ))}

          {/* Done summary */}
          {doneTasks.length > 0 && (
            <span onClick={() => setExpandedDone(!expandedDone)}
              style={{ fontSize: 9, color: COLOR.textTertiary, paddingLeft: CHECKBOX.size + 5, cursor: 'pointer' }}>
              {expandedDone ? '▾' : '▸'} 완료 {doneTasks.length}건
            </span>
          )}
          {expandedDone && doneTasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 4px', paddingLeft: CHECKBOX.size + 5 }}>
              <div onClick={() => toggleDone(t.id)} style={{
                width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, background: CHECKBOX.checkedBg, flexShrink: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <span onClick={() => openDetail(t)} style={{ fontSize: FONT.body, color: COLOR.textTertiary, textDecoration: 'line-through', cursor: 'pointer', lineHeight: 1.3 }}>{t.text}</span>
            </div>
          ))}

          {/* Inline add (when active tasks exist) */}
          {addingTaskMsId === node.id && hasContent && (
            <div style={{ paddingLeft: CHECKBOX.size + 5 }}>
              <InlineAddRow onSubmit={text => onAddTaskSubmit(node.id, text)} onDone={() => setAddingTaskMsId(null)} />
            </div>
          )}

          {/* + 추가 on hover (when has content but not adding) */}
          {hasContent && isHover && addingTaskMsId !== node.id && (
            <span onClick={() => setAddingTaskMsId(node.id)}
              style={{ fontSize: 9, color: '#ccc', cursor: 'pointer', paddingLeft: CHECKBOX.size + 5, lineHeight: 1 }}>+ 추가</span>
          )}
        </div>
      </div>

      {dropTarget === 'ms-below' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

      {/* Children (recursive) */}
      {hasChildren && !isCollapsed && (
        <>
          {node.children.map(child => (
            <MsNode
              key={child.id} node={child} depth={depth + 1} dotColor={dotColor}
              collapsed={collapsed} toggleNode={toggleNode}
              hoverId={hoverId} setHoverId={setHoverId}
              editingMsId={editingMsId} setEditingMsId={setEditingMsId}
              editingTaskId={editingTaskId} setEditingTaskId={setEditingTaskId}
              addingTaskMsId={addingTaskMsId} setAddingTaskMsId={setAddingTaskMsId}
              onMsEditFinish={onMsEditFinish} onAddChildMs={onAddChildMs} onDeleteMs={onDeleteMs}
              onTaskEditFinish={onTaskEditFinish} onAddTaskSubmit={onAddTaskSubmit}
              toggleDone={toggleDone} openDetail={openDetail}
              projectTasks={projectTasks} countAll={countAll}
              dragState={dragState} setDragState={setDragState}
              onTaskDrop={onTaskDrop} onMsDropChild={onMsDropChild} onMsReorder={onMsReorder}
              memberMap={memberMap}
            />
          ))}
          {/* + 마일스톤 추가 (hover only) */}
          <HoverAdd onClick={() => onAddChildMs(node.id)} indent={8 + (depth + 1) * 22 + 14 + 5} />
        </>
      )}
    </>
  )
}

/* ═══ DragTask ═══ */
function DragTask({ task, msId, isEditing, onStartEdit, onFinishEdit, onToggle, onDetail, setDragState, isLast, showAddOnLast, onAddClick, memberMap }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      draggable={!isEditing}
      onDragStart={e => {
        e.dataTransfer.setData('type', 'task')
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.setData('fromMsId', msId)
        setDragState({ type: 'task', id: task.id })
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '2px 4px',
        borderRadius: 4, cursor: isEditing ? 'text' : 'grab', transition: 'background 0.08s',
        background: hover ? COLOR.bgHover : 'transparent',
      }}
    >
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggle() }} style={{
        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer',
        border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
        background: task.done ? CHECKBOX.checkedBg : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>

      {/* Title */}
      {isEditing ? (
        <input autoFocus defaultValue={task.text}
          onBlur={e => onFinishEdit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFinishEdit(e.target.value) } if (e.key === 'Escape') onFinishEdit(null) }}
          onMouseDown={e => e.stopPropagation()}
          style={{ flex: 1, fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
        />
      ) : (
        <span onDoubleClick={onStartEdit} style={{
          flex: 1, fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary, lineHeight: 1.35,
          whiteSpace: 'normal', wordBreak: 'break-word',
          textDecoration: task.done ? 'line-through' : 'none', cursor: 'text',
        }}>{task.text}</span>
      )}

      {/* Assignee avatar */}
      {task.assigneeId && memberMap?.[task.assigneeId] && (
        <div style={{
          width: 16, height: 16, borderRadius: '50%', background: '#888',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 7, fontWeight: 600, flexShrink: 0,
        }}>{(memberMap[task.assigneeId] || '?')[0].toUpperCase()}</div>
      )}

      {/* Due date */}
      {task.dueDate && <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}

      {/* + on last task hover */}
      {isLast && showAddOnLast && hover && (
        <span onClick={e => { e.stopPropagation(); onAddClick() }}
          style={{ fontSize: 9, color: COLOR.textTertiary, cursor: 'pointer', flexShrink: 0 }}>+</span>
      )}

      {/* Detail arrow */}
      <div onClick={onDetail} style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', opacity: hover ? 0.4 : 0, transition: 'opacity 0.12s',
      }}>
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </div>
  )
}

/* ═══ InlineAddRow ═══ */
function InlineAddRow({ onSubmit, onDone }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const submit = () => {
    const val = text.trim()
    if (val) { onSubmit(val); setText(''); setTimeout(() => inputRef.current?.focus(), 30) }
    else onDone()
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: `1.5px solid ${COLOR.border}`, flexShrink: 0 }} />
      <input ref={inputRef} autoFocus value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } if (e.key === 'Escape') onDone() }}
        onBlur={submit} placeholder="할일 입력 후 Enter"
        style={{ flex: 1, fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
      />
    </div>
  )
}

/* ═══ HoverAdd ═══ */
function HoverAdd({ onClick, indent }) {
  const [hover, setHover] = useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: '4px 8px', paddingLeft: indent, minHeight: hover ? 22 : 6, transition: 'min-height 0.15s', borderBottom: hover ? `1px solid ${COLOR.border}` : 'none' }}>
      {hover && <span onClick={onClick} style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, cursor: 'pointer' }}>+ 마일스톤 추가</span>}
    </div>
  )
}

/* ═══ BacklogSection ═══ */
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
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 40px', borderBottom: `1px solid ${COLOR.border}`, cursor: 'pointer' }} onClick={() => onOpen(t)}>
          <div onClick={e => { e.stopPropagation(); onToggle(t.id) }} style={{
            width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer',
            border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`, background: t.done ? CHECKBOX.checkedBg : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {t.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ flex: 1, fontSize: FONT.body, color: t.done ? COLOR.textTertiary : COLOR.textPrimary, textDecoration: t.done ? 'line-through' : 'none', whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══ Toast ═══ */
function Toast({ msg, canUndo, onUndo, onClose }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', color: '#fff', padding: '8px 16px', borderRadius: 8,
      fontSize: FONT.label, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 100,
    }}>
      {msg}
      {canUndo && (
        <button onClick={onUndo} style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff', borderRadius: 4, padding: '2px 10px', fontSize: FONT.caption,
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
        }}>되돌리기 (Ctrl+Z)</button>
      )}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✕</button>
    </div>
  )
}
