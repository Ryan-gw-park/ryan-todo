import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { COLOR, FONT, SPACE } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getCachedUserId } from '../../hooks/useStore'
import useProjectFilter from '../../hooks/useProjectFilter'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getColor } from '../../utils/colors'
import { buildTree } from '../../utils/milestoneTree'
import {
  getTimelineRange, getColumns, getColWidth, getTodayLabel,
  ColumnHeader, ScalePill, Toast, TimelineMsRow, DraggableBar, ColumnGrid,
  parseDate, addDays, fmtISO, getBarStyle,
} from '../timeline/TimelineShared'

/* ═══════════════════════════════════════════════════════
   InlineTimelineView v5 — 글로벌 타임라인
   프로젝트 → MS → 할일 계층, 스케일 전환, DnD, Ctrl+Z
   TimelineShared 컴포넌트 공유
   ═══════════════════════════════════════════════════════ */

const TREE_W = 300

export default function InlineTimelineView({ scope, projectId }) {
  const isProjectMode = !!projectId
  const { projects, tasks, openDetail, updateTask } = useStore()
  const currentTeamId = useStore(s => s.currentTeamId)
  const milestones = useStore(s => s.milestones)
  const moveMilestone = useStore(s => s.moveMilestone)
  const updateMilestone = useStore(s => s.updateMilestone)
  const reorderMilestones = useStore(s => s.reorderMilestones)
  const toggleDone = useStore(s => s.toggleDone)
  const { filteredProjects } = useProjectFilter(projects, tasks)
  const userId = getCachedUserId()
  const gridRef = useRef(null)

  const [scale, setScale] = useState('week')
  const [collapsed, setCollapsed] = useState(new Set())
  const [dragState, setDragState] = useState(null)
  const [toast, setToast] = useState(null)

  // ─── Team members ───
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName || m.name || '?' })
      setMemberMap(map)
    })
  }, [currentTeamId])

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

  // ─── Collapse ───
  const toggleNode = useCallback((id) => {
    setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])
  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseAll = useCallback(() => {
    const ids = new Set()
    displayProjects.forEach(p => {
      ids.add(p.id)
      const tree = buildTree(milestones, p.id)
      const walk = (nodes) => nodes.forEach(n => { if ((n.children || []).length > 0) { ids.add(n.id); walk(n.children) } })
      walk(tree)
    })
    setCollapsed(ids)
  }, [milestones])

  // ─── Projects ───
  const displayProjects = useMemo(() => {
    let base = scope === 'personal' ? projects : filteredProjects.filter(p => p.teamId === currentTeamId)
    if (isProjectMode) return base.filter(p => p.id === projectId)
    return base
  }, [projects, filteredProjects, scope, isProjectMode, projectId])

  // ─── Timeline range ───
  const allDates = useMemo(() => {
    const dates = []
    displayProjects.forEach(p => {
      milestones.filter(m => m.project_id === p.id).forEach(m => {
        if (m.start_date) dates.push(new Date(m.start_date))
        if (m.end_date) dates.push(new Date(m.end_date))
      })
      tasks.filter(t => t.projectId === p.id && !t.deletedAt).forEach(t => {
        if (t.startDate) dates.push(new Date(t.startDate))
        if (t.dueDate) dates.push(new Date(t.dueDate))
      })
    })
    return dates
  }, [displayProjects, milestones, tasks])

  const { minD, maxD } = useMemo(() => getTimelineRange(allDates), [allDates])
  const columns = useMemo(() => getColumns(minD, maxD, scale), [minD, maxD, scale])
  const colW = getColWidth(scale)
  const todayLabel = getTodayLabel(scale)
  const timelineCtx = { columns, colW, minD, scale, todayLabel }

  // ─── DnD handlers ───
  const handleTaskDrop = useCallback((taskId, fromMsId, toMsId) => {
    if (fromMsId === toMsId) return
    pushUndo({ label: '할일 이동', undo: () => updateTask(taskId, { keyMilestoneId: fromMsId }) })
    updateTask(taskId, { keyMilestoneId: toMsId })
    showToast('할일 이동 완료')
  }, [updateTask, pushUndo])

  const handleMsDropChild = useCallback((msId, targetId) => {
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const oldParentId = ms?.parent_id || null
    pushUndo({ label: 'MS 하위 이동', undo: () => moveMilestone(msId, oldParentId) })
    moveMilestone(msId, targetId)
    setCollapsed(prev => { const n = new Set(prev); n.delete(targetId); return n })
    showToast('MS 하위로 이동')
  }, [milestones, moveMilestone, pushUndo])

  const handleMsReorder = useCallback((msId, targetId, position) => {
    if (msId === targetId) return
    const ms = milestones.find(m => m.id === msId)
    const target = milestones.find(m => m.id === targetId)
    if (!ms || !target) return
    const targetParentId = target.parent_id || null
    const oldParentId = ms.parent_id || null
    if (oldParentId !== targetParentId) {
      pushUndo({ label: 'MS 이동', undo: () => moveMilestone(msId, oldParentId) })
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
        pushUndo({ label: 'MS 순서', undo: () => {
          const orig = milestones.filter(m => m.project_id === ms.project_id && (m.parent_id || null) === targetParentId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          reorderMilestones(orig)
        }})
      }
    }, 100)
    showToast('MS 순서 변경')
  }, [milestones, moveMilestone, reorderMilestones, pushUndo])

  const handleBarDragEnd = useCallback((type, id, newStart, newEnd) => {
    if (type === 'task') {
      const task = tasks.find(t => t.id === id)
      if (!task) return
      pushUndo({ label: '기간 변경', undo: () => updateTask(id, { startDate: task.startDate, dueDate: task.dueDate }) })
      updateTask(id, { startDate: newStart, dueDate: newEnd })
    } else if (type === 'ms') {
      const ms = milestones.find(m => m.id === id)
      if (!ms) return
      pushUndo({ label: 'MS 기간', undo: () => updateMilestone(id, { start_date: ms.start_date, end_date: ms.end_date }) })
      updateMilestone(id, { start_date: newStart, end_date: newEnd })
    }
    showToast('기간 변경 완료')
  }, [tasks, milestones, updateTask, updateMilestone, pushUndo])

  // ─── Auto-scroll to today (왼쪽 트리 영역 보존) ───
  useEffect(() => {
    if (!gridRef.current) return
    setTimeout(() => {
      if (gridRef.current) gridRef.current.scrollLeft = 0
    }, 100)
  }, [scale])

  // ─── Date label ───
  const today = new Date()
  const monthLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월`

  return (
    <div data-view="timeline" style={{ padding: isProjectMode ? 0 : SPACE.viewPadding, height: '100%', display: 'flex', flexDirection: 'column' }}
      onDragEnd={() => setDragState(null)}>
      <div style={{ maxWidth: isProjectMode ? undefined : 1400, margin: isProjectMode ? 0 : '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* Header (global only) */}
        {!isProjectMode && (
          <div style={{ marginBottom: 16, flexShrink: 0 }}>
            <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0 }}>
              {scope === 'personal' ? '개인 타임라인' : '타임라인'}
            </h1>
            <p style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary, marginTop: 4 }}>{monthLabel}</p>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={expandAll} style={toolBtnStyle}>모두 펼치기</button>
          <button onClick={collapseAll} style={toolBtnStyle}>모두 접기</button>
          <div style={{ width: 1, height: 16, background: COLOR.border, margin: '0 4px' }} />
          <ScalePill scale={scale} onChange={setScale} />
          {scope === 'personal' && (
            <div style={{ marginLeft: 12, padding: '3px 10px', background: '#fef3c7', borderRadius: 5, fontSize: FONT.tiny, color: '#92400e', fontWeight: 600 }}>
              내 담당 MS/할일만 표시
            </div>
          )}
        </div>

        {/* Grid */}
        <div ref={gridRef} style={{ flex: 1, overflow: 'auto', border: `1px solid ${COLOR.border}`, borderRadius: 10 }}>
          <div style={{ minWidth: TREE_W + columns.length * colW, display: 'inline-flex', flexDirection: 'column', minHeight: '100%' }}>

            {/* Column header */}
            <div style={{ display: 'flex', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, position: 'sticky', top: 0, zIndex: 4 }}>
              <div style={{ width: TREE_W, flexShrink: 0, padding: '6px 8px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}` }}>
                프로젝트 / MS / 할일
              </div>
              <ColumnHeader columns={columns} colW={colW} todayLabel={todayLabel} />
            </div>

            {/* Project groups */}
            {displayProjects.map(p => {
              const c = getColor(p.color)
              const dotColor = c.dot
              const tree = buildTree(milestones, p.id)
              const projTasks = tasks.filter(t => t.projectId === p.id && !t.deletedAt)
              const isCol = collapsed.has(p.id)

              // Project date range
              const projDates = []
              milestones.filter(m => m.project_id === p.id).forEach(m => {
                if (m.start_date) projDates.push(new Date(m.start_date))
                if (m.end_date) projDates.push(new Date(m.end_date))
              })
              projTasks.forEach(t => {
                if (t.startDate) projDates.push(new Date(t.startDate))
                if (t.dueDate) projDates.push(new Date(t.dueDate))
              })
              const projStart = projDates.length > 0 ? new Date(Math.min(...projDates)) : null
              const projEnd = projDates.length > 0 ? new Date(Math.max(...projDates)) : null

              return (
                <div key={p.id}>
                  {/* Project header row */}
                  <div onClick={() => toggleNode(p.id)} style={{
                    display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`,
                    background: COLOR.bgSurface, cursor: 'pointer', minHeight: 32,
                  }}>
                    <div style={{
                      width: TREE_W, flexShrink: 0, padding: '5px 8px',
                      display: 'flex', alignItems: 'center', gap: 6,
                      borderRight: `1px solid ${COLOR.border}`,
                    }}>
                      <span style={{ fontSize: 11, color: COLOR.textSecondary, width: 12, textAlign: 'center' }}>{isCol ? '▸' : '▾'}</span>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: dotColor, flexShrink: 0 }} />
                      <span style={{ fontSize: FONT.label, fontWeight: 700, color: COLOR.textPrimary }}>{p.name}</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                      <ColumnGrid columns={columns} colW={colW} todayLabel={todayLabel} />
                      {projStart && projEnd && (() => {
                        const startStr = fmtISO(projStart)
                        const endStr = fmtISO(projEnd)
                        const bs = getBarStyle(startStr, endStr, minD, colW, scale, dotColor, 0.2)
                        return bs ? <div style={bs} /> : null
                      })()}
                    </div>
                  </div>

                  {/* MS tree (expanded) */}
                  {!isCol && tree.map(node => (
                    <TimelineMsRow
                      key={node.id} node={node} depth={1} dotColor={dotColor} treeW={TREE_W}
                      collapsed={collapsed} toggleNode={toggleNode}
                      timelineCtx={timelineCtx} projectTasks={projTasks} toggleDone={toggleDone}
                      dragState={dragState} setDragState={setDragState}
                      onTaskDrop={handleTaskDrop} onMsDropChild={handleMsDropChild}
                      onMsReorder={handleMsReorder} onBarDragEnd={handleBarDragEnd}
                    />
                  ))}
                  {/* MS 미연결 할일 */}
                  {!isCol && (() => {
                    const unlinkedTasks = projTasks.filter(t => !t.keyMilestoneId && !t.done && !t.deletedAt)
                      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                    if (unlinkedTasks.length === 0) return null
                    return unlinkedTasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 26 }}>
                        <div style={{
                          width: TREE_W, flexShrink: 0, padding: '3px 8px', paddingLeft: 8 + 1 * 22 + 14,
                          display: 'flex', alignItems: 'center', gap: 5,
                          borderRight: `1px solid ${COLOR.border}`,
                        }}>
                          <div onClick={ev => { ev.stopPropagation(); toggleDone(t.id) }} style={{
                            width: 12, height: 12, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                            border: t.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
                            background: t.done ? CHECKBOX.checkedBg : '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {t.done && <svg width={7} height={7} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                          <span style={{
                            fontSize: FONT.caption, color: COLOR.textSecondary, flex: 1,
                            whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
                            fontStyle: 'italic',
                          }}>{t.text}</span>
                        </div>
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                          <ColumnGrid columns={columns} colW={colW} todayLabel={todayLabel} />
                          {t.startDate && t.dueDate && (
                            <DraggableBar type="task" id={t.id}
                              startStr={t.startDate} endStr={t.dueDate}
                              minD={minD} colW={colW} scale={scale}
                              barColor={dotColor} opacity={0.3} height={12}
                              onDragEnd={handleBarDragEnd}
                            />
                          )}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )
            })}

            {displayProjects.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
                표시할 항목이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} canUndo={toast.canUndo} onUndo={undo} onClose={() => setToast(null)} />}
    </div>
  )
}

const toolBtnStyle = {
  border: 'none', borderRadius: 5, padding: '3px 10px',
  fontSize: FONT.tiny, fontFamily: 'inherit', cursor: 'pointer',
  background: COLOR.bgHover, color: COLOR.textSecondary, fontWeight: 500,
}
