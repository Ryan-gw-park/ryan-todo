import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { getColor } from '../../utils/colors'
import { buildTree } from '../../utils/milestoneTree'
import MsTaskTreeMode from './MsTaskTreeMode'

/* ═══════════════════════════════════════════════════════
   UnifiedProjectView v5 — 전체 할일 + 타임라인 통합
   좌측 트리 공유, 접기/펼치기 동기화, 주간/월간/분기 스케일
   ═══════════════════════════════════════════════════════ */

const TREE_W = 340

// ─── Date helpers ───
function parseDate(s) { return s ? new Date(s + 'T00:00:00') : null }
function daysBetween(a, b) { return Math.round((b - a) / 86400000) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function formatWeek(d) { return `${d.getMonth() + 1}/${d.getDate()}` }
function formatMonth(d) { return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}` }
function formatQuarter(d) { return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}` }
function startOfWeek(d) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function startOfQuarter(d) { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1) }

function getTimelineRange(milestones, tasks, projectId) {
  const dates = []
  milestones.filter(m => m.project_id === projectId).forEach(m => {
    if (m.start_date) dates.push(new Date(m.start_date))
    if (m.end_date) dates.push(new Date(m.end_date))
  })
  tasks.filter(t => t.projectId === projectId && !t.deletedAt).forEach(t => {
    if (t.startDate) dates.push(new Date(t.startDate))
    if (t.dueDate) dates.push(new Date(t.dueDate))
  })
  const valid = dates.filter(d => !isNaN(d))
  let minD = valid.length > 0 ? new Date(Math.min(...valid)) : new Date()
  let maxD = valid.length > 0 ? new Date(Math.max(...valid)) : addDays(new Date(), 90)
  return { minD: addDays(minD, -14), maxD: addDays(maxD, 14) }
}

function getColumns(minD, maxD, scale) {
  const cols = []
  if (scale === 'week') {
    let cur = startOfWeek(minD)
    while (cur <= maxD) { cols.push({ start: new Date(cur), label: formatWeek(cur) }); cur = addDays(cur, 7) }
  } else if (scale === 'month') {
    let cur = startOfMonth(minD)
    while (cur <= maxD) { cols.push({ start: new Date(cur), label: formatMonth(cur) }); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1) }
  } else {
    let cur = startOfQuarter(minD)
    while (cur <= maxD) { cols.push({ start: new Date(cur), label: formatQuarter(cur) }); cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1) }
  }
  return cols
}

function getColWidth(scale) { return scale === 'week' ? 56 : scale === 'month' ? 80 : 100 }

function getBarStyle(startStr, endStr, minD, colW, scale, barColor, opacity) {
  const s = parseDate(startStr), e = parseDate(endStr)
  if (!s || !e) return null
  const dayW = scale === 'week' ? colW / 7 : scale === 'month' ? colW / 30 : colW / 90
  const left = daysBetween(minD, s) * dayW
  const width = Math.max(daysBetween(s, e) * dayW, colW * 0.4)
  return { position: 'absolute', left, width, top: '50%', transform: 'translateY(-50%)', height: 16, borderRadius: 4, background: barColor, opacity }
}

// ─── x ↔ date conversion ───
function getDayWidth(colW, scale) { return scale === 'week' ? colW / 7 : scale === 'month' ? colW / 30 : colW / 90 }
function fmtISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function xToDate(x, minD, colW, scale) { return addDays(minD, Math.round(x / getDayWidth(colW, scale))) }

// ─── Pill ───
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

// ─── Scale Pill ───
function ScalePill({ scale, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: COLOR.bgHover, borderRadius: 6, padding: 2 }}>
      {[{ k: 'week', l: '주간' }, { k: 'month', l: '월간' }, { k: 'quarter', l: '분기' }].map(it => (
        <button key={it.k} onClick={() => onChange(it.k)} style={{
          border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: FONT.tiny, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: scale === it.k ? 600 : 400,
          background: scale === it.k ? '#fff' : 'transparent',
          color: scale === it.k ? COLOR.textPrimary : COLOR.textTertiary,
          boxShadow: scale === it.k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.l}</button>
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

  const [rightMode, setRightMode] = useState('전체 할일')
  const [scale, setScale] = useState('week')
  const [dragState, setDragState] = useState(null) // { type: 'task'|'ms', id }

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
  const showToast = (msg) => { setToast({ msg, canUndo: true }); setTimeout(() => setToast(null), 4000) }

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

  // ─── Timeline context ───
  const { minD, maxD } = useMemo(() => getTimelineRange(milestones, tasks, projectId), [milestones, tasks, projectId])
  const columns = useMemo(() => getColumns(minD, maxD, scale), [minD, maxD, scale])
  const colW = getColWidth(scale)
  const today = new Date()
  const todayLabel = scale === 'week' ? formatWeek(startOfWeek(today)) : scale === 'month' ? formatMonth(today) : formatQuarter(today)
  const timelineCtx = { columns, colW, minD, scale, todayLabel }

  // ─── Project tasks ───
  const projectTasks = useMemo(() => tasks.filter(t => t.projectId === projectId && !t.deletedAt), [tasks, projectId])
  const backlogTasks = useMemo(() => projectTasks.filter(t => !t.keyMilestoneId), [projectTasks])

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
          <button onClick={expandAll} style={toolBtnStyle}>모두 펼치기</button>
          <button onClick={collapseAll} style={toolBtnStyle}>모두 접기</button>
          {rightMode === '타임라인' && (
            <>
              <div style={{ width: 1, height: 16, background: COLOR.border, margin: '0 4px' }} />
              <ScalePill scale={scale} onChange={setScale} />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

      {/* Toast */}
      {toast && <Toast msg={toast.msg} canUndo={toast.canUndo} onUndo={undo} onClose={() => setToast(null)} />}
    </div>
  )
}

/* ═══ Toast ═══ */
function Toast({ msg, canUndo, onUndo, onClose }) {
  if (!msg) return null
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
        }}>Ctrl+Z</button>
      )}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✕</button>
    </div>
  )
}

/* ═══ TimelineMsRow — 타임라인 모드 재귀 노드 (좌측 트리 DnD + Gantt 바 DnD) ═══ */
function TimelineMsRow({ node, depth, dotColor, collapsed, toggleNode, timelineCtx, projectTasks, toggleDone,
  dragState, setDragState, onTaskDrop, onMsDropChild, onMsReorder, onBarDragEnd,
}) {
  const hasChildren = (node.children || []).length > 0
  const isCollapsed = collapsed.has(node.id)
  const [hover, setHover] = useState(false)
  const [dropTarget, setDropTarget] = useState(null) // 'task-zone' | 'ms-child' | 'ms-above' | 'ms-below'

  const allTasks = projectTasks.filter(t => t.keyMilestoneId === node.id && !t.deletedAt)
  const activeTasks = allTasks.filter(t => !t.done).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const { columns, colW, minD, scale, todayLabel } = timelineCtx

  const handleDragOver = (e, zone) => { e.preventDefault(); e.stopPropagation(); setDropTarget(zone) }
  const handleDragLeave = () => setDropTarget(null)
  const handleDrop = (e, zone) => {
    e.preventDefault(); e.stopPropagation(); setDropTarget(null)
    const type = e.dataTransfer.getData('type')
    if (type === 'task' && (zone === 'task-zone' || zone === 'ms-child')) {
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

  return (
    <>
      {dropTarget === 'ms-above' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

      {/* MS row */}
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 30,
          background: dropTarget === 'ms-child' ? 'rgba(49,130,206,0.08)' : 'transparent',
          outline: dropTarget === 'ms-child' ? '2px dashed #3182CE' : 'none', outlineOffset: -2,
        }}
      >
        {/* Left tree — draggable MS */}
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
            if (dragState?.type === 'task') handleDragOver(e, 'task-zone')
          }}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, dropTarget || 'ms-child')}
          style={{
            width: TREE_W, flexShrink: 0, padding: '4px 8px', paddingLeft: 8 + depth * 22,
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
          <span style={{
            fontSize: FONT.label, fontWeight: depth === 0 ? 600 : 500, color: COLOR.textPrimary,
            flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
          }}>{node.title || '(제목 없음)'}</span>
        </div>

        {/* Right: Gantt */}
        <div
          onDragOver={e => { if (dragState?.type === 'task') handleDragOver(e, 'task-zone') }}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, 'task-zone')}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: dropTarget === 'task-zone' ? 'rgba(49,130,206,0.06)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', height: '100%' }}>
            {columns.map((col, i) => {
              const isToday = col.label === todayLabel
              return (
                <div key={i} style={{
                  width: colW, flexShrink: 0,
                  borderRight: `1px solid ${isToday ? '#E53E3E' : COLOR.border}`,
                  background: isToday ? 'rgba(229,62,62,0.03)' : 'transparent',
                }} />
              )
            })}
          </div>
          {/* MS bar — draggable */}
          {node.start_date && node.end_date && (
            <DraggableBar
              type="ms" id={node.id}
              startStr={node.start_date} endStr={node.end_date}
              minD={minD} colW={colW} scale={scale}
              barColor={dotColor} opacity={hasChildren ? 0.25 : 0.5}
              height={16}
              onDragEnd={onBarDragEnd}
            />
          )}
        </div>
      </div>

      {dropTarget === 'ms-below' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

      {/* Task rows (only when expanded) */}
      {!isCollapsed && activeTasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 26 }}>
          {/* Left: task row — draggable */}
          <div
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('type', 'task')
              e.dataTransfer.setData('taskId', t.id)
              e.dataTransfer.setData('fromMsId', node.id)
              setDragState({ type: 'task', id: t.id })
            }}
            style={{
              width: TREE_W, flexShrink: 0, padding: '3px 8px', paddingLeft: 8 + (depth + 1) * 22 + 14,
              display: 'flex', alignItems: 'center', gap: 5,
              borderRight: `1px solid ${COLOR.border}`, cursor: 'grab',
            }}
          >
            <div onClick={ev => { ev.stopPropagation(); toggleDone(t.id) }} style={{
              width: 12, height: 12, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
              border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
              background: t.done ? CHECKBOX.checkedBg : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.done && <svg width={7} height={7} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <span style={{
              fontSize: FONT.caption, color: COLOR.textPrimary, flex: 1,
              whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
            }}>{t.text}</span>
          </div>
          {/* Right: task Gantt bar — draggable */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: '100%' }}>
              {columns.map((col, i) => (
                <div key={i} style={{ width: colW, flexShrink: 0, borderRight: `1px solid ${COLOR.border}` }} />
              ))}
            </div>
            {t.startDate && t.dueDate && (
              <DraggableBar
                type="task" id={t.id}
                startStr={t.startDate} endStr={t.dueDate}
                minD={minD} colW={colW} scale={scale}
                barColor={dotColor} opacity={0.4}
                height={12}
                onDragEnd={onBarDragEnd}
              />
            )}
          </div>
        </div>
      ))}

      {/* Children */}
      {hasChildren && !isCollapsed && node.children.map(child => (
        <TimelineMsRow
          key={child.id} node={child} depth={depth + 1} dotColor={dotColor}
          collapsed={collapsed} toggleNode={toggleNode}
          timelineCtx={timelineCtx} projectTasks={projectTasks} toggleDone={toggleDone}
          dragState={dragState} setDragState={setDragState}
          onTaskDrop={onTaskDrop} onMsDropChild={onMsDropChild} onMsReorder={onMsReorder}
          onBarDragEnd={onBarDragEnd}
        />
      ))}
    </>
  )
}

/* ═══ DraggableBar — Gantt 바 드래그 (전체 이동 + 좌우 리사이즈) ═══ */
function DraggableBar({ type, id, startStr, endStr, minD, colW, scale, barColor, opacity, height, onDragEnd }) {
  const s = parseDate(startStr), e = parseDate(endStr)
  if (!s || !e) return null

  const dayW = getDayWidth(colW, scale)
  const left = daysBetween(minD, s) * dayW
  const width = Math.max(daysBetween(s, e) * dayW, colW * 0.4)

  const dragRef = useRef(null)
  const [dragMode, setDragMode] = useState(null) // 'move' | 'resize-left' | 'resize-right'
  const dragStartX = useRef(0)
  const origLeft = useRef(left)
  const origWidth = useRef(width)

  const handleMouseDown = (ev, mode) => {
    ev.preventDefault()
    ev.stopPropagation()
    setDragMode(mode)
    dragStartX.current = ev.clientX
    origLeft.current = left
    origWidth.current = width

    const handleMove = (mv) => {
      const delta = mv.clientX - dragStartX.current
      const bar = dragRef.current
      if (!bar) return

      if (mode === 'move') {
        bar.style.left = `${origLeft.current + delta}px`
      } else if (mode === 'resize-left') {
        const newLeft = origLeft.current + delta
        const newWidth = origWidth.current - delta
        if (newWidth > colW * 0.3) {
          bar.style.left = `${newLeft}px`
          bar.style.width = `${newWidth}px`
        }
      } else if (mode === 'resize-right') {
        const newWidth = origWidth.current + delta
        if (newWidth > colW * 0.3) {
          bar.style.width = `${newWidth}px`
        }
      }
    }

    const handleUp = (up) => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      setDragMode(null)

      const delta = up.clientX - dragStartX.current
      if (Math.abs(delta) < 3) return // ignore tiny movements

      let newStart, newEnd
      if (mode === 'move') {
        const newLeft = origLeft.current + delta
        newStart = fmtISO(xToDate(newLeft, minD, colW, scale))
        newEnd = fmtISO(xToDate(newLeft + origWidth.current, minD, colW, scale))
      } else if (mode === 'resize-left') {
        const newLeft = origLeft.current + delta
        newStart = fmtISO(xToDate(newLeft, minD, colW, scale))
        newEnd = endStr
      } else if (mode === 'resize-right') {
        newStart = startStr
        const newRight = origLeft.current + origWidth.current + delta
        newEnd = fmtISO(xToDate(newRight, minD, colW, scale))
      }

      if (newStart && newEnd) onDragEnd(type, id, newStart, newEnd)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const HANDLE_W = 6

  return (
    <div
      ref={dragRef}
      style={{
        position: 'absolute', left, width, top: '50%', transform: 'translateY(-50%)',
        height, borderRadius: 4, background: barColor, opacity,
        cursor: dragMode === 'move' ? 'grabbing' : 'grab',
        display: 'flex', alignItems: 'center',
        userSelect: 'none',
      }}
      onMouseDown={ev => handleMouseDown(ev, 'move')}
    >
      {/* Left resize handle */}
      <div
        onMouseDown={ev => handleMouseDown(ev, 'resize-left')}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: HANDLE_W,
          cursor: 'col-resize', borderRadius: '4px 0 0 4px',
        }}
      />
      {/* Right resize handle */}
      <div
        onMouseDown={ev => handleMouseDown(ev, 'resize-right')}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: HANDLE_W,
          cursor: 'col-resize', borderRadius: '0 4px 4px 0',
        }}
      />
    </div>
  )
}

/* ═══ Toolbar button style ═══ */
const toolBtnStyle = {
  border: 'none', borderRadius: 5, padding: '3px 10px',
  fontSize: FONT.tiny, fontFamily: 'inherit', cursor: 'pointer',
  background: COLOR.bgHover, color: COLOR.textSecondary, fontWeight: 500,
}
