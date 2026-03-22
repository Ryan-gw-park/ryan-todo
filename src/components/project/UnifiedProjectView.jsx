import { useState, useMemo, useCallback, useRef } from 'react'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { getColor } from '../../utils/colors'
import { buildTree, flattenTreeWithTasks, countTasksRecursive } from '../../utils/milestoneTree'
import { toX, getWeekDates, getTimelineStart, formatWeekLabel, getTodayX, getBarWidth } from '../../utils/ganttHelpers'

const S = {
  textPrimary: '#37352f',
  textSecondary: '#6b6a66',
  textTertiary: '#a09f99',
  border: '#e8e6df',
}

const ROW_H = 34
const COL_W_DEFAULT = [155, 140, 140, 140, 140]
const WEEK_W = 50 // Width per week in timeline mode
const WEEK_COUNT = 24 // Show 24 weeks (6 months)

/* ═══ Check component ═══ */
function Check({ done, onClick }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
        border: done ? 'none' : '1.5px solid #ccc',
        background: done ? '#2383e2' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {done && (
        <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

/* ═══ Pill toggle ═══ */
function Pill({ items, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: '#f5f4f0', borderRadius: 7, padding: 2 }}>
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          style={{
            border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer',
            fontWeight: active === it.key ? 600 : 400,
            background: active === it.key ? '#fff' : 'transparent',
            color: active === it.key ? S.textPrimary : S.textTertiary,
            boxShadow: active === it.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ═══ Inline task add ═══ */
function InlineAddTask({ msId, projectId, onDone }) {
  const addTask = useStore(s => s.addTask)
  const inputRef = useRef(null)
  const [text, setText] = useState('')

  const submit = useCallback(async () => {
    const val = text.trim()
    if (!val) { onDone?.(); return }
    await addTask({
      text: val,
      projectId,
      keyMilestoneId: msId,
      category: 'backlog',
    })
    setText('')
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [text, addTask, projectId, msId, onDone])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 12px', minHeight: ROW_H }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid #e8e6df', flexShrink: 0 }} />
      <input
        ref={inputRef}
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { e.preventDefault(); onDone?.() }
        }}
        onBlur={submit}
        onMouseDown={e => e.stopPropagation()}
        placeholder="할일 입력..."
        style={{
          flex: 1, fontSize: 12, border: 'none', outline: 'none',
          background: 'transparent', color: S.textPrimary, fontFamily: 'inherit', padding: 0,
        }}
      />
    </div>
  )
}

/* ═══ Gantt row for timeline mode ═══ */
function GanttRow({ row, timelineStart, todayX, weekCount, weekW, rowH }) {
  const leafNode = row.leafNode
  const task = row.task
  const isFirstSubRow = row.isFirstSubRow
  const barColor = row.color

  // MS bar (first sub-row only) — thin, semi-transparent, at top of row
  const msStartX = toX(leafNode?.start_date, timelineStart, weekW)
  const msEndX = toX(leafNode?.end_date, timelineStart, weekW)
  const msWidth = msStartX !== null && msEndX !== null ? msEndX - msStartX : 0

  // Task bar — thicker, solid color
  const taskStartX = toX(task?.startDate || task?.dueDate, timelineStart, weekW)
  const taskEndX = toX(task?.dueDate || task?.startDate, timelineStart, weekW)
  const taskWidth = taskStartX !== null && taskEndX !== null
    ? Math.max(taskEndX - taskStartX, 8) // minimum 8px for single-day tasks
    : (task?.dueDate ? 8 : 0)

  return (
    <div style={{
      position: 'relative',
      minWidth: weekCount * weekW,
      height: rowH,
      flexShrink: 0,
    }}>
      {/* Week grid lines */}
      {Array.from({ length: weekCount }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: i * weekW,
            top: 0,
            bottom: 0,
            width: 1,
            background: i === 0 ? 'transparent' : S.border,
            opacity: 0.5,
          }}
        />
      ))}

      {/* MS bar (first sub-row only) — thin, semi-transparent, at top */}
      {isFirstSubRow && msStartX !== null && msWidth > 0 && (
        <div
          title={`${leafNode?.title || ''}: ${leafNode?.start_date} ~ ${leafNode?.end_date}`}
          style={{
            position: 'absolute',
            left: Math.max(msStartX, 0),
            top: 4,
            height: 5,
            width: msWidth,
            borderRadius: 2,
            background: barColor,
            opacity: 0.35,
          }}
        />
      )}

      {/* Task bar — thicker, solid */}
      {task && taskStartX !== null && (
        <div
          title={`${task.text}: ${task.startDate || task.dueDate} ~ ${task.dueDate || task.startDate}`}
          style={{
            position: 'absolute',
            left: Math.max(taskStartX, 0),
            top: isFirstSubRow ? 12 : 8,
            height: task.done ? 6 : 10,
            width: taskWidth,
            borderRadius: 3,
            background: task.done ? S.textTertiary : barColor,
            opacity: task.done ? 0.4 : 0.85,
          }}
        />
      )}

      {/* Today red line */}
      {todayX >= 0 && todayX <= weekCount * weekW && (
        <div
          style={{
            position: 'absolute',
            left: todayX,
            top: 0,
            bottom: 0,
            width: 1.5,
            background: '#e53935',
            opacity: 0.4,
            zIndex: 1,
          }}
        />
      )}
    </div>
  )
}

/* ═══ Main: UnifiedProjectView ═══ */
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
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)

  const tree = useMemo(() => buildTree(milestones, projectId), [milestones, projectId])
  const [rightMode, setRightMode] = useState('전체 할일')
  const [addingTaskLeafId, setAddingTaskLeafId] = useState(null)
  const [editingMsId, setEditingMsId] = useState(null)

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState(COL_W_DEFAULT)
  const dragCol = useRef(null)
  const dragStartX = useRef(0)
  const dragStartW = useRef(0)

  // Main divider
  const [extraTreeWidth, setExtraTreeWidth] = useState(0)

  const isMobile = window.innerWidth < 768

  // Flatten tree with tasks
  const color = project ? getColor(project.color) : null
  const pkmId = pkm?.id || null

  const { rows, maxDepth } = useMemo(() => {
    if (!project) return { rows: [], maxDepth: 1 }
    return flattenTreeWithTasks(tree, tasks, projectId, color?.dot || '#888')
  }, [tree, tasks, projectId, project, color])

  // rowspan tracking
  const rendered = useRef({})

  // Total tree width
  const totalTreeWidth = useMemo(() => {
    return colWidths.slice(0, maxDepth).reduce((a, b) => a + b, 0) + extraTreeWidth
  }, [colWidths, maxDepth, extraTreeWidth])

  // Project tasks for backlog
  const projectTasks = useMemo(() => {
    return tasks.filter(t => t.projectId === projectId && !t.deletedAt)
  }, [tasks, projectId])

  const backlogTasks = useMemo(() => {
    return projectTasks.filter(t => !t.keyMilestoneId)
  }, [projectTasks])

  // Timeline mode state
  const timelineStart = useMemo(() => getTimelineStart(), [])
  const weekDates = useMemo(() => getWeekDates(timelineStart, WEEK_COUNT), [timelineStart])
  const todayX = useMemo(() => getTodayX(timelineStart, WEEK_W), [timelineStart])

  // Column resize handler
  const handleColResizeStart = useCallback((colIdx, e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCol.current = colIdx
    dragStartX.current = e.clientX
    dragStartW.current = colWidths[colIdx]

    const handleMove = (ev) => {
      const delta = ev.clientX - dragStartX.current
      setColWidths(prev => {
        const next = [...prev]
        next[dragCol.current] = Math.max(80, Math.min(300, dragStartW.current + delta))
        return next
      })
    }
    const handleUp = () => {
      dragCol.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [colWidths])

  // Main divider resize
  const handleDividerStart = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startExtra = extraTreeWidth
    const handleMove = (ev) => {
      setExtraTreeWidth(Math.max(-100, Math.min(200, startExtra + (ev.clientX - startX))))
    }
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [extraTreeWidth])

  // CRUD handlers
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

  if (!project) return null

  if (pkmLoading) {
    return (
      <div style={{ padding: 40, color: S.textTertiary, textAlign: 'center', fontSize: 13 }}>
        로딩 중...
      </div>
    )
  }

  // Reset rendered tracking each render
  rendered.current = {}

  // Mobile layout
  if (isMobile) {
    return (
      <div data-view="unified-project" style={{ padding: '12px 16px', fontFamily: "'Noto Sans KR','Inter',-apple-system,sans-serif" }}>
        <div style={{ fontSize: 12, color: S.textTertiary, textAlign: 'center' }}>
          모바일에서는 간략 보기만 지원됩니다
        </div>
      </div>
    )
  }

  return (
    <div data-view="unified-project" style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans KR','Inter',-apple-system,sans-serif", color: S.textPrimary }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 12px', borderBottom: `0.5px solid ${S.border}`, flexShrink: 0 }}>
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: color?.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 17, fontWeight: 700 }}>{project.name}</span>
        <div style={{ marginLeft: 'auto' }}>
          <Pill
            items={[{ key: '전체 할일', label: '전체 할일' }, { key: '타임라인', label: '타임라인' }]}
            active={rightMode}
            onChange={setRightMode}
          />
        </div>
      </div>

      {/* Main container */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Column headers */}
        <div style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, background: '#fafaf8', flexShrink: 0 }}>
          {/* Left: tree column headers */}
          <div style={{ width: totalTreeWidth, flexShrink: 0, display: 'flex', position: 'sticky', left: 0, zIndex: 4, background: '#fafaf8' }}>
            {colWidths.slice(0, maxDepth).map((w, ci) => (
              <div key={ci} style={{ width: w, flexShrink: 0, padding: '7px 8px', fontSize: 10.5, fontWeight: 600, color: S.textTertiary, position: 'relative', userSelect: 'none' }}>
                {ci === 0 ? '마일스톤' : `하위 ${ci}`}
                {/* Resize handle */}
                <div
                  onMouseDown={(e) => handleColResizeStart(ci, e)}
                  style={{ position: 'absolute', right: -2, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 2 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div
            onMouseDown={handleDividerStart}
            style={{ width: 5, flexShrink: 0, cursor: 'col-resize', position: 'relative', background: 'transparent', zIndex: 3 }}
            onMouseEnter={e => e.currentTarget.style.background = '#e0e0e0'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ position: 'absolute', top: '50%', left: 1, width: 3, height: 24, marginTop: -12, borderRadius: 2, background: '#ccc', opacity: 0.4 }} />
          </div>

          {/* Right header */}
          {rightMode === '전체 할일' ? (
            <div style={{ flex: 1, padding: '7px 12px', fontSize: 10.5, fontWeight: 600, color: S.textTertiary, minWidth: 280 }}>
              연결된 할일
            </div>
          ) : (
            <div style={{ display: 'flex', minWidth: WEEK_COUNT * WEEK_W }}>
              {weekDates.map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: WEEK_W, flexShrink: 0, textAlign: 'center',
                    fontSize: 9.5, fontWeight: 500, color: S.textTertiary,
                    padding: '6px 0', borderLeft: i > 0 ? `0.5px solid ${S.border}` : 'none',
                  }}
                >
                  {formatWeekLabel(d)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          {rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: S.textTertiary, fontSize: 12 }}>
              마일스톤이 없습니다
            </div>
          ) : (
            rows.map((row, ri) => {
              const cells = row.cells.slice(0, maxDepth)
              const isAdding = addingTaskLeafId === row.leafId && !row.task && row.isFirstSubRow

              return (
                <div key={row.leafId + '-' + row.taskIndex} style={{ display: 'flex', minHeight: ROW_H, borderBottom: `0.5px solid ${S.border}` }}>
                  {/* LEFT: sticky tree */}
                  <div style={{
                    width: totalTreeWidth, flexShrink: 0, display: 'flex', alignItems: 'stretch',
                    position: 'sticky', left: 0, zIndex: 2, background: '#fff',
                  }}>
                    {cells.map((cell, ci) => {
                      const w = colWidths[ci] || 140
                      if (!cell) return <div key={ci} style={{ width: w, flexShrink: 0 }} />
                      if (rendered.current[cell.id] && !cell.isLeaf) return <div key={ci} style={{ width: w, flexShrink: 0 }} />
                      if (!cell.isLeaf) rendered.current[cell.id] = true

                      const isD0 = ci === 0
                      const nodeCount = countTasksRecursive(cell._node || { children: [] }, projectTasks)
                      const isEditing = editingMsId === cell.id

                      return (
                        <div
                          key={ci}
                          style={{
                            width: w, flexShrink: 0, padding: '5px 8px',
                            display: 'flex', alignItems: 'flex-start', gap: 4, position: 'relative',
                          }}
                          onMouseEnter={e => { if (!isEditing) e.currentTarget.querySelector('.hover-actions')?.style.setProperty('opacity', '1') }}
                          onMouseLeave={e => { e.currentTarget.querySelector('.hover-actions')?.style.setProperty('opacity', '0') }}
                        >
                          {ci > 0 && <span style={{ color: `${cell.color}40`, fontSize: 10, flexShrink: 0, marginTop: 2 }}>─</span>}
                          <div style={{ width: isD0 ? 8 : 6, height: isD0 ? 8 : 6, borderRadius: '50%', background: cell.color, flexShrink: 0, marginTop: 3 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {isEditing ? (
                              <input
                                autoFocus
                                defaultValue={cell.title}
                                onBlur={(e) => handleMsEditFinish(cell.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); handleMsEditFinish(cell.id, e.target.value) }
                                  if (e.key === 'Escape') { e.preventDefault(); handleMsEditFinish(cell.id, null) }
                                }}
                                onMouseDown={e => e.stopPropagation()}
                                style={{
                                  width: '100%', fontSize: isD0 ? 12 : 11.5, fontWeight: isD0 ? 700 : ci === 1 ? 600 : 400,
                                  border: 'none', outline: 'none', background: 'transparent', color: S.textPrimary, fontFamily: 'inherit', padding: 0,
                                }}
                              />
                            ) : (
                              <div
                                onDoubleClick={(e) => { e.stopPropagation(); setEditingMsId(cell.id) }}
                                style={{ fontSize: isD0 ? 12 : 11.5, fontWeight: isD0 ? 700 : ci === 1 ? 600 : 400, color: S.textPrimary, lineHeight: 1.3, wordBreak: 'break-word' }}
                              >
                                {cell.title || '제목 없음'}
                              </div>
                            )}
                            {nodeCount.total > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                                <div style={{ width: 22, height: 2.5, borderRadius: 2, background: '#e8e6df' }}>
                                  <div style={{ width: `${nodeCount.done / nodeCount.total * 100}%`, height: 2.5, borderRadius: 2, background: cell.color }} />
                                </div>
                                <span style={{ fontSize: 9, color: S.textTertiary }}>{nodeCount.done}/{nodeCount.total}</span>
                              </div>
                            )}
                            {/* Hover actions */}
                            <div
                              className="hover-actions"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, opacity: 0, transition: 'opacity 0.15s' }}
                            >
                              <span
                                onClick={(e) => { e.stopPropagation(); handleAddChildMs(cell.id) }}
                                style={{ fontSize: 10, color: cell.color, cursor: 'pointer', fontWeight: 500 }}
                              >
                                + 하위 추가
                              </span>
                              <span
                                onClick={(e) => { e.stopPropagation(); handleDeleteMs(cell.id, cell.title) }}
                                style={{ fontSize: 10, color: '#ccc', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#c53030'}
                                onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
                              >
                                삭제
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {/* Sticky shadow */}
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 1, background: S.border }} />
                  </div>

                  {/* Divider space */}
                  <div style={{ width: 5, flexShrink: 0 }} />

                  {/* RIGHT: task row */}
                  {rightMode === '전체 할일' ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '3px 12px', minWidth: 280 }}>
                      {isAdding ? (
                        <InlineAddTask msId={row.leafId} projectId={projectId} onDone={() => setAddingTaskLeafId(null)} />
                      ) : row.task ? (
                        <>
                          <Check done={row.task.done} onClick={() => toggleDone(row.task.id)} />
                          <span
                            onClick={() => openDetail(row.task.id)}
                            style={{
                              flex: 1, fontSize: 12, color: row.task.done ? S.textTertiary : S.textPrimary,
                              lineHeight: 1.3, cursor: 'pointer',
                              textDecoration: row.task.done ? 'line-through' : 'none',
                            }}
                          >
                            {row.task.text}
                          </span>
                          {row.task.dueDate && <span style={{ fontSize: 10, color: S.textTertiary, flexShrink: 0 }}>{row.task.dueDate}</span>}
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.2, flexShrink: 0, cursor: 'pointer' }} onClick={() => openDetail(row.task.id)}>
                            <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </>
                      ) : row.isFirstSubRow ? (
                        <span
                          onClick={() => setAddingTaskLeafId(row.leafId)}
                          style={{ fontSize: 11, color: S.textTertiary, cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.color = S.textPrimary}
                          onMouseLeave={e => e.currentTarget.style.color = S.textTertiary}
                        >
                          + 추가
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <GanttRow
                      row={row}
                      timelineStart={timelineStart}
                      todayX={todayX}
                      weekCount={WEEK_COUNT}
                      weekW={WEEK_W}
                      rowH={ROW_H}
                    />
                  )}
                </div>
              )
            })
          )}

          {/* + 마일스톤 추가 */}
          <div style={{ display: 'flex', minHeight: 32 }}>
            <div style={{ width: totalTreeWidth, flexShrink: 0, padding: '8px 10px', position: 'sticky', left: 0, background: '#fff' }}>
              <span
                onClick={() => handleAddChildMs(null)}
                style={{ fontSize: 11, color: S.textTertiary, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = S.textPrimary}
                onMouseLeave={e => e.currentTarget.style.color = S.textTertiary}
              >
                + 마일스톤 추가
              </span>
            </div>
          </div>
        </div>

        {/* Backlog */}
        {backlogTasks.length > 0 && (
          <BacklogSection tasks={backlogTasks} onToggle={toggleDone} onOpen={openDetail} />
        )}
      </div>
    </div>
  )
}

/* ═══ Backlog section ═══ */
function BacklogSection({ tasks, onToggle, onOpen }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderTop: `1.5px dashed ${S.border}`, flexShrink: 0 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 12, color: S.textTertiary }}>⊙</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: S.textTertiary }}>백로그</span>
        <span style={{ fontSize: 11, color: S.textTertiary }}>{tasks.length}건</span>
        <span style={{ fontSize: 9, color: S.textTertiary, marginLeft: 'auto' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && tasks.map(t => (
        <div
          key={t.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 6px 28px', borderBottom: `0.5px solid ${S.border}`, cursor: 'pointer' }}
          onClick={() => onOpen(t.id)}
        >
          <Check done={t.done} onClick={() => onToggle(t.id)} />
          <span style={{ flex: 1, fontSize: 12, color: t.done ? S.textTertiary : S.textPrimary, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
