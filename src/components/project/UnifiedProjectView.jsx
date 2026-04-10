import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { COLOR, FONT } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { getColor } from '../../utils/colors'
import { buildTree } from '../../utils/milestoneTree'
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor, pointerWithin } from '@dnd-kit/core'
import MsTaskTreeMode from './MsTaskTreeMode'
import BacklogPanel from './BacklogPanel'
import useTeamMembers from '../../hooks/useTeamMembers'
import {
  getTimelineRange, getColumns, getColWidth, getTodayLabel,
  ScalePill, Toast, TimelineMsRow,
} from '../timeline/TimelineShared'

/* ═══════════════════════════════════════════════════════
   UnifiedProjectView v5 — 전체 할일 + 타임라인 통합
   좌측 트리 공유, 접기/펼치기 동기화, 주간/월간/분기 스케일
   ═══════════════════════════════════════════════════════ */

const TREE_W = 340

// ─── Pill (local) ───
function Pill({ items, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: COLOR.bgHover, borderRadius: 7, padding: 2 }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onChange(it.key)} style={{
          border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: active === it.key ? 600 : 400,
          background: active === it.key ? '#fff' : 'transparent',
          color: active === it.key ? COLOR.textPrimary : COLOR.textTertiary,
          boxShadow: active === it.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.label}</button>
      ))}
    </div>
  )
}


/* ═══ Main ═══ */
export default function UnifiedProjectView({ projectId }) {
  const project = useStore(s => s.projects.find(p => p.id === projectId))
  const milestones = useStore(s => s.milestones)
  const tasks = useStore(s => s.tasks)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const addMilestone = useStore(s => s.addMilestone)
  const updateMilestone = useStore(s => s.updateMilestone)
  const deleteMilestone = useStore(s => s.deleteMilestone)
  const openConfirmDialog = useStore(s => s.openConfirmDialog)
  const updateTask = useStore(s => s.updateTask)
  const moveMilestone = useStore(s => s.moveMilestone)
  const reorderMilestones = useStore(s => s.reorderMilestones)
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)

  const tree = useMemo(() => buildTree(milestones, projectId), [milestones, projectId])
  const color = project ? getColor(project.color) : null
  const pkmId = pkm?.id || null
  const dotColor = color?.dot || '#888'

  const currentTeamId = useStore(s => s.currentTeamId)

  const [blMembers, setBlMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) { setBlMembers([]); return }
    useTeamMembers.getMembers(currentTeamId).then(setBlMembers)
  }, [currentTeamId])

  const [wideEnough, setWideEnough] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  useEffect(() => {
    const handler = () => setWideEnough(window.innerWidth >= 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ─── dnd-kit sensors ───
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const dndSensors = useSensors(pointerSensor, touchSensor)
  const [dndActiveTask, setDndActiveTask] = useState(null)
  const [dndActiveMs, setDndActiveMs] = useState(null)
  const lastPointerY = useRef(0)
  useEffect(() => {
    const handler = (e) => { lastPointerY.current = e.clientY }
    window.addEventListener('pointermove', handler)
    return () => window.removeEventListener('pointermove', handler)
  }, [])

  const [rightMode, setRightMode] = useState('전체 할일')
  const [scale, setScale] = useState('week')
  const [dragState, setDragState] = useState(null) // { type: 'task'|'ms', id } — Timeline용 유지

  const [toast, setToast] = useState(null)

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
    const handler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])
  function showToast(msg) { setToast({ msg, canUndo: true }); setTimeout(() => setToast(null), 4000) }

  // ─── Project tasks (must be before timelineDates/handlers that reference them) ───
  const projectTasks = useMemo(() => tasks.filter(t => t.projectId === projectId && !t.deletedAt), [tasks, projectId])
  const backlogTasks = useMemo(() => projectTasks.filter(t => !t.keyMilestoneId), [projectTasks])

  // ─── Shared collapsed state ───
  const [collapsed, setCollapsed] = useState(new Set())
  const toggleNode = useCallback((id) => {
    setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])
  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseAll = useCallback(() => {
    const ids = new Set()
    const walk = (nodes) => nodes.forEach(n => { if ((n.children || []).length > 0) { ids.add(n.id); walk(n.children) } })
    walk(tree)
    setCollapsed(ids)
  }, [tree])

  // ─── dnd-kit handlers (must be after collapsed/toggleNode declaration) ───
  const handleDndStart = useCallback((event) => {
    const data = event.active.data.current
    if (data?.type === 'task') {
      const task = tasks.find(t => t.id === data.taskId)
      if (task) setDndActiveTask(task)
    } else if (data?.type === 'ms') {
      const ms = milestones.find(m => m.id === data.msId)
      if (ms) setDndActiveMs(ms)
    }
  }, [tasks, milestones])

  const handleDndEnd = useCallback((event) => {
    setDndActiveTask(null)
    setDndActiveMs(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const activeData = active.data.current

    // Case 1: Task (tree or backlog) → MS task-zone
    if (activeData?.type === 'task' && overId.startsWith('tree-drop:')) {
      const toMsId = overId.slice(10)
      const taskId = activeData.taskId
      const fromMsId = activeData.fromMsId || null

      if (fromMsId !== toMsId) {
        const fromMs = milestones.find(m => m.id === fromMsId)
        const toMs = milestones.find(m => m.id === toMsId)
        pushUndo({ label: '할일 이동', undo: () => updateTask(taskId, { keyMilestoneId: fromMsId }) })
        updateTask(taskId, { keyMilestoneId: toMsId })
        if (fromMs) {
          showToast(`할일을 "${fromMs?.title || '?'}" → "${toMs?.title || '?'}"로 이동`)
        } else {
          showToast(`백로그에서 "${toMs?.title || '?'}"로 이동`)
        }
      }
      return
    }

    // Case 2: MS → MS zone (3-zone clientY 후처리)
    if (activeData?.type === 'ms' && overId.startsWith('tree-ms-zone:')) {
      const targetId = overId.slice(13)
      const msId = activeData.msId
      if (msId === targetId) return

      const overRect = over.rect
      if (overRect) {
        const clientY = lastPointerY.current
        const relY = clientY - overRect.top
        const zone = relY < overRect.height * 0.25 ? 'above' : relY > overRect.height * 0.75 ? 'below' : 'child'

        const ms = milestones.find(m => m.id === msId)
        if (zone === 'child') {
          const oldParentId = ms?.parent_id || null
          pushUndo({ label: 'MS 하위 이동', undo: () => moveMilestone(msId, oldParentId) })
          moveMilestone(msId, targetId)
          const target = milestones.find(m => m.id === targetId)
          showToast(`"${ms?.title || '?'}"을 "${target?.title || '?'}" 하위로 이동`)
          if (collapsed.has(targetId)) toggleNode(targetId)
        } else {
          const target = milestones.find(m => m.id === targetId)
          if (!ms || !target) return
          const oldParentId = ms.parent_id || null
          const targetParentId = target.parent_id || null
          if (oldParentId !== targetParentId) {
            pushUndo({ label: 'MS 이동+순서', undo: () => moveMilestone(msId, oldParentId) })
            moveMilestone(msId, targetParentId)
          }
          setTimeout(() => {
            const siblings = milestones
              .filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId && m.id !== msId)
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const idx = siblings.findIndex(s => s.id === targetId)
            if (idx === -1) return
            const insertIdx = zone === 'above' ? idx : idx + 1
            const reordered = [...siblings]
            reordered.splice(insertIdx, 0, milestones.find(m => m.id === msId))
            reorderMilestones(reordered)
            if (oldParentId === targetParentId) {
              pushUndo({ label: 'MS 순서 변경', undo: () => {
                const original = milestones
                  .filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId)
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                reorderMilestones(original)
              }})
            }
          }, 100)
          showToast(`"${ms?.title || '?'}" 순서 변경`)
        }
      }
      return
    }
  }, [tasks, milestones, pushUndo, updateTask, moveMilestone, reorderMilestones, collapsed, toggleNode])

  // ─── Timeline context ───
  const timelineDates = useMemo(() => {
    const dates = []
    milestones.filter(m => m.project_id === projectId).forEach(m => {
      if (m.start_date) dates.push(new Date(m.start_date))
      if (m.end_date) dates.push(new Date(m.end_date))
    })
    projectTasks.forEach(t => {
      if (t.startDate) dates.push(new Date(t.startDate))
      if (t.dueDate) dates.push(new Date(t.dueDate))
    })
    return dates
  }, [milestones, projectTasks, projectId])
  const { minD, maxD } = useMemo(() => getTimelineRange(timelineDates), [timelineDates])
  const columns = useMemo(() => getColumns(minD, maxD, scale), [minD, maxD, scale])
  const colW = getColWidth(scale)
  const todayLabel = getTodayLabel(scale)
  const timelineCtx = { columns, colW, minD, scale, todayLabel }

  // ─── Timeline DnD handlers ───
  const handleTimelineTaskDrop = useCallback((taskId, fromMsId, toMsId) => {
    if (fromMsId === toMsId) return
    const fromMs = milestones.find(m => m.id === fromMsId)
    const toMs = milestones.find(m => m.id === toMsId)
    pushUndo({ label: '할일 이동', undo: () => updateTask(taskId, { keyMilestoneId: fromMsId }) })
    updateTask(taskId, { keyMilestoneId: toMsId })
    showToast(`할일을 "${fromMs?.title || '?'}" → "${toMs?.title || '?'}"로 이동`)
  }, [milestones, updateTask, pushUndo])

  const handleTimelineMsDropChild = useCallback((msId, targetId) => {
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const oldParentId = ms?.parent_id || null
    pushUndo({ label: 'MS 하위 이동', undo: () => moveMilestone(msId, oldParentId) })
    moveMilestone(msId, targetId)
    setCollapsed(prev => { const n = new Set(prev); n.delete(targetId); return n })
    showToast(`"${ms?.title || '?'}" 하위로 이동`)
  }, [milestones, moveMilestone, pushUndo])

  const handleTimelineMsReorder = useCallback((msId, targetId, position) => {
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const target = milestones.find(m => m.id === targetId)
    if (!ms || !target) return
    const targetParentId = target.parent_id || null
    const oldParentId = ms.parent_id || null
    if (oldParentId !== targetParentId) {
      pushUndo({ label: 'MS 이동+순서', undo: () => moveMilestone(msId, oldParentId) })
      moveMilestone(msId, targetParentId)
    }
    setTimeout(() => {
      const siblings = milestones
        .filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId && m.id !== msId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const idx = siblings.findIndex(s => s.id === targetId)
      if (idx === -1) return
      const reordered = [...siblings]
      reordered.splice(position === 'above' ? idx : idx + 1, 0, milestones.find(m => m.id === msId))
      reorderMilestones(reordered)
      if (oldParentId === targetParentId) {
        pushUndo({ label: 'MS 순서 변경', undo: () => {
          const original = milestones.filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          reorderMilestones(original)
        }})
      }
    }, 100)
    showToast(`"${ms?.title || '?'}" 순서 변경`)
  }, [milestones, moveMilestone, reorderMilestones, pushUndo])

  // Gantt bar drag handler (called from DraggableBar)
  const handleBarDragEnd = useCallback((type, id, newStart, newEnd) => {
    if (type === 'task') {
      const task = projectTasks.find(t => t.id === id)
      if (!task) return
      const oldStart = task.startDate, oldEnd = task.dueDate
      pushUndo({ label: '할일 기간 변경', undo: () => updateTask(id, { startDate: oldStart, dueDate: oldEnd }) })
      updateTask(id, { startDate: newStart, dueDate: newEnd })
      showToast(`할일 기간: ${newStart} ~ ${newEnd}`)
    } else if (type === 'ms') {
      const ms = milestones.find(m => m.id === id)
      if (!ms) return
      const oldStart = ms.start_date, oldEnd = ms.end_date
      pushUndo({ label: 'MS 기간 변경', undo: () => updateMilestone(id, { start_date: oldStart, end_date: oldEnd }) })
      updateMilestone(id, { start_date: newStart, end_date: newEnd })
      showToast(`MS 기간: ${newStart} ~ ${newEnd}`)
    }
  }, [projectTasks, milestones, updateTask, updateMilestone, pushUndo])

  const isMobile = window.innerWidth < 768

  if (!project) return null
  if (pkmLoading) {
    return <div style={{ padding: 40, color: COLOR.textTertiary, textAlign: 'center', fontSize: FONT.body }}>로딩 중...</div>
  }
  if (isMobile) {
    return <div style={{ padding: 40, fontSize: FONT.label, color: COLOR.textTertiary, textAlign: 'center' }}>모바일에서는 간략 보기만 지원됩니다</div>
  }

  return (
    <div data-view="unified-project" style={{ height: '100%', display: 'flex', flexDirection: 'column', color: COLOR.textPrimary }}>
      {/* Header */}
      <div style={{ padding: '10px 20px 12px', borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: FONT.projectTitle, fontWeight: 700 }}>{project.name}</span>
          <div style={{ flex: 1 }} />
          <Pill
            items={[{ key: '전체 할일', label: '전체 할일' }, { key: '타임라인', label: '타임라인' }]}
            active={rightMode}
            onChange={setRightMode}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={expandAll} style={{ border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: FONT.tiny, fontFamily: 'inherit', cursor: 'pointer', background: COLOR.bgHover, color: COLOR.textSecondary, fontWeight: 500 }}>모두 펼치기</button>
          <button onClick={collapseAll} style={{ border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: FONT.tiny, fontFamily: 'inherit', cursor: 'pointer', background: COLOR.bgHover, color: COLOR.textSecondary, fontWeight: 500 }}>모두 접기</button>
          {rightMode === '타임라인' && (
            <>
              <div style={{ width: 1, height: 16, background: COLOR.border, margin: '0 4px' }} />
              <ScalePill scale={scale} onChange={setScale} />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <DndContext
        sensors={rightMode === '전체 할일' ? dndSensors : undefined}
        collisionDetection={pointerWithin}
        onDragStart={handleDndStart}
        onDragEnd={handleDndEnd}
      >
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* 메인 콘텐츠 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
              externalCollapsed={collapsed}
              onToggleNode={toggleNode}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
            />
          )}

          {rightMode === '타임라인' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }} onDragEnd={() => setDragState(null)}>
              <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden', display: 'inline-flex', flexDirection: 'column', minWidth: '100%' }}>
                {/* Column header */}
                <div style={{ display: 'flex', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
                  <div style={{ width: TREE_W, flexShrink: 0, padding: '6px 8px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}` }}>
                    마일스톤 / 할일
                  </div>
                  <div style={{ display: 'flex' }}>
                    {columns.map((col, i) => {
                      const isToday = col.label === todayLabel
                      return (
                        <div key={i} style={{
                          width: colW, flexShrink: 0, padding: '6px 4px', fontSize: FONT.tiny, fontWeight: isToday ? 700 : 500,
                          color: isToday ? '#E53E3E' : COLOR.textTertiary, textAlign: 'center',
                          borderRight: `1px solid ${isToday ? '#E53E3E' : COLOR.border}`,
                          background: isToday ? 'rgba(229,62,62,0.04)' : 'transparent',
                        }}>{col.label}</div>
                      )
                    })}
                  </div>
                </div>

                {/* Tree rows */}
                {tree.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>마일스톤이 없습니다</div>
                )}
                {tree.map(node => (
                  <TimelineMsRow
                    key={node.id} node={node} depth={0} dotColor={dotColor}
                    treeW={TREE_W}
                    collapsed={collapsed} toggleNode={toggleNode}
                    timelineCtx={timelineCtx}
                    projectTasks={projectTasks}
                    toggleDone={toggleDone}
                    dragState={dragState} setDragState={setDragState}
                    onTaskDrop={handleTimelineTaskDrop}
                    onMsDropChild={handleTimelineMsDropChild}
                    onMsReorder={handleTimelineMsReorder}
                    onBarDragEnd={handleBarDragEnd}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BacklogPanel */}
        <BacklogPanel
          projectId={projectId}
          projectTasks={projectTasks}
          members={blMembers}
          currentTeamId={currentTeamId}
          color={color}
          hidden={!wideEnough}
        />
      </div>
      <DragOverlay dropAnimation={null}>
        {dndActiveTask && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#e8f5e9', borderRadius: 5, fontSize: 12, border: '1px dashed #1D9E75', boxShadow: '0 2px 8px rgba(0,0,0,.12)', cursor: 'grabbing', userSelect: 'none', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#2C2C2A' }}>{dndActiveTask.text}</span>
          </div>
        )}
        {dndActiveMs && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500, border: '1px solid #e0ddd6', boxShadow: '0 4px 12px rgba(0,0,0,.12)', cursor: 'grabbing', userSelect: 'none', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#2C2C2A' }}>{dndActiveMs.title || '(제목 없음)'}</span>
          </div>
        )}
      </DragOverlay>
      </DndContext>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} canUndo={toast.canUndo} onUndo={undo} onClose={() => setToast(null)} />}
    </div>
  )
}
