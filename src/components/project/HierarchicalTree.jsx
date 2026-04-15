import { useState, useMemo, useCallback, useRef } from 'react'
import { DndContext, useSensor, useSensors, PointerSensor, TouchSensor, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../hooks/useStore'
// Loop 43: flattenTree/countTasksRecursive 제거 — L1 flat 인라인 구성

const COL_W_FIRST = 160
const COL_W_REST = 150

/* ═══ Sortable Tree Row ═══ */
function SortableTreeRow({ row, ri, isSelected, expanded, onSelectLeaf, onToggleExpand, tasks, rendered, onAddChild, onDelete, editingId, onStartEdit, onFinishEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.leafId + '-' + ri })
  const isMobile = window.innerWidth < 768

  const style = {
    display: 'flex', alignItems: 'stretch',
    background: isSelected ? `${row.color}0c` : 'transparent',
    borderRadius: 6, margin: '1px 4px', cursor: 'pointer',
    transition: transition || 'background 0.1s',
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    minHeight: isMobile ? 44 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(!isMobile ? listeners : undefined)}
      onClick={() => onSelectLeaf(row.leafId)}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f4f0' }}
      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? `${row.color}0c` : 'transparent' }}
    >
      {row.cells.map((cell, ci) => {
        if (!cell) return <div key={ci} style={{ width: ci === 0 ? COL_W_FIRST : COL_W_REST, flexShrink: 0 }} />

        // rowspan: 이미 렌더한 그룹 노드면 빈 칸
        if (rendered.current[cell.id] && !cell.isLeaf) {
          return <div key={ci} style={{ width: ci === 0 ? COL_W_FIRST : COL_W_REST, flexShrink: 0 }} />
        }
        if (!cell.isLeaf) rendered.current[cell.id] = true

        const isDepth0 = ci === 0
        // Loop 43: L1 flat — MS의 task 수만 계산
        const msTasks = tasks.filter(t => t.keyMilestoneId === cell.id && !t.deletedAt)
        const nodeCount = { total: msTasks.length, done: msTasks.filter(t => t.done).length }
        const hasChildren = false
        const isExpanded = expanded[cell.id] !== false

        return (
          <TreeCell
            key={ci}
            cell={cell}
            ci={ci}
            isDepth0={isDepth0}
            nodeCount={nodeCount}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            onAddChild={onAddChild}
            onDelete={onDelete}
            editingId={editingId}
            onStartEdit={onStartEdit}
            onFinishEdit={onFinishEdit}
          />
        )
      })}
    </div>
  )
}

/* ═══ Tree Cell ═══ */
function TreeCell({ cell, ci, isDepth0, nodeCount, hasChildren, isExpanded, onToggleExpand, onAddChild, onDelete, editingId, onStartEdit, onFinishEdit }) {
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef(null)

  const isEditing = editingId === cell.id

  return (
    <div
      style={{
        width: ci === 0 ? COL_W_FIRST : COL_W_REST, flexShrink: 0,
        padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 5,
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 트리 연결선 */}
      {ci > 0 && (
        <span style={{ color: `${cell.color}50`, fontSize: 11, marginRight: 1, flexShrink: 0, fontFamily: 'monospace' }}>╴</span>
      )}

      {/* 접기/펼치기 (그룹 노드만) */}
      {hasChildren && (
        <span
          onClick={(e) => { e.stopPropagation(); onToggleExpand(cell.id) }}
          style={{ fontSize: 9, color: '#a09f99', cursor: 'pointer', flexShrink: 0, userSelect: 'none', lineHeight: '16px' }}
        >
          {isExpanded ? '▾' : '▸'}
        </span>
      )}

      {/* 컬러 도트 */}
      <div style={{ width: isDepth0 ? 8 : 6, height: isDepth0 ? 8 : 6, borderRadius: '50%', background: cell.color, flexShrink: 0, marginTop: 3 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            autoFocus
            defaultValue={cell.title}
            onBlur={(e) => onFinishEdit(cell.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onFinishEdit(cell.id, e.target.value) }
              if (e.key === 'Escape') { e.preventDefault(); onFinishEdit(cell.id, null) }
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{
              width: '100%', fontSize: isDepth0 ? 12 : 11.5,
              fontWeight: isDepth0 ? 700 : ci === 1 ? 600 : 400,
              border: 'none', outline: 'none', background: 'transparent',
              color: '#37352f', fontFamily: 'inherit', padding: 0,
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(cell.id) }}
            style={{
              fontSize: isDepth0 ? 12 : 11.5,
              fontWeight: isDepth0 ? 700 : ci === 1 ? 600 : 400,
              color: '#37352f', lineHeight: 1.35, wordBreak: 'break-word',
            }}
          >
            {cell.title || '제목 없음'}
          </div>
        )}

        {/* 진행률 바 */}
        {nodeCount.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <div style={{ width: 28, height: 2.5, borderRadius: 2, background: '#e8e6df' }}>
              <div style={{ width: `${nodeCount.done / nodeCount.total * 100}%`, height: 2.5, borderRadius: 2, background: cell.color }} />
            </div>
            <span style={{ fontSize: 9.5, color: '#a09f99' }}>{nodeCount.done}/{nodeCount.total}</span>
          </div>
        )}
      </div>

      {/* hover 시 + 추가 / 삭제 */}
      {hovered && !isEditing && (
        <div style={{ position: 'absolute', right: 4, top: 6, display: 'flex', gap: 4 }}>
          <span
            onClick={(e) => { e.stopPropagation(); onAddChild(cell.id, hasChildren) }}
            style={{ fontSize: 10, color: '#a09f99', cursor: 'pointer', background: '#f5f4f0', borderRadius: 4, padding: '1px 5px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
            onMouseLeave={e => e.currentTarget.style.color = '#a09f99'}
          >
            {hasChildren ? '+ 하위' : '+ 할일'}
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); onDelete(cell.id, cell.title) }}
            style={{ fontSize: 10, color: '#a09f99', cursor: 'pointer', background: '#f5f4f0', borderRadius: 4, padding: '1px 5px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c53030'}
            onMouseLeave={e => e.currentTarget.style.color = '#a09f99'}
          >
            삭제
          </span>
        </div>
      )}
    </div>
  )
}

/* ═══ Main: HierarchicalTree ═══ */
export default function HierarchicalTree({
  tree, expanded, selectedLeafId, onSelectLeaf, onToggleExpand,
  onExpandAll, onCollapseAll, tasks, projectId, pkmId, color,
}) {
  const addMilestone = useStore(s => s.addMilestone)
  const updateMilestone = useStore(s => s.updateMilestone)
  const deleteMilestone = useStore(s => s.deleteMilestone)
  const reorderMilestones = useStore(s => s.reorderMilestones)
  const addTask = useStore(s => s.addTask)
  const openDetail = useStore(s => s.openDetail)
  const openConfirmDialog = useStore(s => s.openConfirmDialog)

  const [editingId, setEditingId] = useState(null)
  const [addingTaskLeafId, setAddingTaskLeafId] = useState(null)
  const rendered = useRef({})

  // DnD 센서 — B3 표준 설정
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const { rows, maxDepth } = useMemo(() => {
    // Loop 43: L1 flat — 모든 MS가 leaf. 각 행 1개 cell.
    const c = color?.dot || '#888'
    const rows = tree.map(n => ({
      leafId: n.id,
      cells: [{ id: n.id, title: n.title, color: n.color || c, isLeaf: true, _node: n }],
      color: n.color || c,
      node: n,
    }))
    return { rows, maxDepth: 1 }
  }, [tree, color])

  // rowspan 리셋 (매 렌더마다)
  rendered.current = {}

  const sortableIds = useMemo(() => rows.map((r, i) => r.leafId + '-' + i), [rows])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sortableIds.indexOf(active.id)
    const newIdx = sortableIds.indexOf(over.id)
    if (oldIdx === -1 || newIdx === -1) return

    // 같은 부모 내 순서 변경만 지원 (부모 변경은 별도 moveMilestone)
    const oldRow = rows[oldIdx]
    const newRow = rows[newIdx]
    if (oldRow && newRow) {
      // 리프 노드의 실제 milestone을 찾아서 reorder
      const leafCell = oldRow.cells.find(c => c?.isLeaf)
      const targetCell = newRow.cells.find(c => c?.isLeaf)
      if (!leafCell || !targetCell) return

      const leafNode = leafCell._node
      const targetNode = targetCell._node
      if (leafNode && targetNode && leafNode.parent_id === targetNode.parent_id) {
        const parentId = leafNode.parent_id
        // 같은 parent_id를 가진 형제 노드들 수집
        const collectSiblings = (nodes) => {
          const result = []
          nodes.forEach(n => {
            if (parentId === null || parentId === undefined) {
              if (!n.parent_id) result.push(n)
            } else {
              if (n.parent_id === parentId) result.push(n)
            }
            if (n.children) result.push(...collectSiblings(n.children))
          })
          return result
        }
        const siblings = collectSiblings(tree).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        const siblingOldIdx = siblings.findIndex(s => s.id === leafNode.id)
        const siblingNewIdx = siblings.findIndex(s => s.id === targetNode.id)
        if (siblingOldIdx !== -1 && siblingNewIdx !== -1) {
          const reordered = arrayMove(siblings, siblingOldIdx, siblingNewIdx)
          reorderMilestones(reordered)
        }
      }
    }
  }, [sortableIds, rows, tree, reorderMilestones])

  const handleDelete = useCallback((nodeId, title) => {
    openConfirmDialog({
      title: '마일스톤 삭제',
      message: `"${title || '제목 없음'}"을(를) 삭제하시겠습니까?\n하위 마일스톤도 모두 삭제됩니다.`,
      confirmText: '삭제',
      onConfirm: () => deleteMilestone(nodeId),
    })
  }, [deleteMilestone, openConfirmDialog])

  const handleAddChild = useCallback(async (nodeId, hasChildren) => {
    if (!pkmId) return
    if (hasChildren) {
      // 그룹 노드 → 하위 MS 추가
      const data = await addMilestone(projectId, pkmId, '', nodeId)
      if (data) setEditingId(data.id)
    } else {
      // 리프 노드 → 할일 추가 모드
      setAddingTaskLeafId(nodeId)
      onSelectLeaf(nodeId)
    }
  }, [pkmId, projectId, addMilestone, onSelectLeaf])

  const handleAddRootMs = useCallback(async () => {
    if (!pkmId) return
    const data = await addMilestone(projectId, pkmId, '', null)
    if (data) setEditingId(data.id)
  }, [pkmId, projectId, addMilestone])

  const handleStartEdit = useCallback((id) => { setEditingId(id) }, [])

  const handleFinishEdit = useCallback((id, value) => {
    setEditingId(null)
    if (value !== null && value !== undefined) {
      updateMilestone(id, { title: value })
    }
  }, [updateMilestone])

  return (
    <div>
      {/* 트리 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginBottom: 2 }}>
        <button
          onClick={onExpandAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#a09f99', padding: '2px 6px', borderRadius: 4 }}
          onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
          onMouseLeave={e => e.currentTarget.style.color = '#a09f99'}
        >
          전체 펼치기
        </button>
        <button
          onClick={onCollapseAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#a09f99', padding: '2px 6px', borderRadius: 4 }}
          onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
          onMouseLeave={e => e.currentTarget.style.color = '#a09f99'}
        >
          전체 접기
        </button>
      </div>

      {/* 트리 행 — DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {rows.map((row, ri) => (
            <SortableTreeRow
              key={row.leafId + '-' + ri}
              row={row}
              ri={ri}
              isSelected={selectedLeafId === row.leafId}
              expanded={expanded}
              onSelectLeaf={onSelectLeaf}
              onToggleExpand={onToggleExpand}
              tasks={tasks}
              rendered={rendered}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
              editingId={editingId}
              onStartEdit={handleStartEdit}
              onFinishEdit={handleFinishEdit}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* + 마일스톤 추가 */}
      <div style={{ padding: '8px 12px' }}>
        <span
          onClick={handleAddRootMs}
          style={{ fontSize: 11, color: '#a09f99', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
          onMouseLeave={e => e.currentTarget.style.color = '#a09f99'}
        >
          + 마일스톤 추가
        </span>
      </div>
    </div>
  )
}
