import { useState, useMemo, useCallback, useRef } from 'react'
import { COLOR, FONT, SPACE, GANTT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { getColor } from '../../utils/colors'
import { buildTree, flattenTreeWithTasks, countTasksRecursive } from '../../utils/milestoneTree'
import { toX, getWeekDates, getTimelineStart, formatWeekLabel, getTodayX, getBarWidth } from '../../utils/ganttHelpers'
import InlineTimelineView from '../views/InlineTimelineView'
import MsTaskTreeMode from './MsTaskTreeMode'

const S = COLOR

const ROW_H = 30
const COL_W_DEFAULT = [155, 140, 140, 140, 140]
const WEEK_W = 50 // Width per week in timeline mode
const WEEK_COUNT = 24 // Show 24 weeks (6 months)

/* ═══ Check component ═══ */
function Check({ done, onClick }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      style={{
        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer',
        border: done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
        background: done ? CHECKBOX.checkedBg : '#fff',
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
            border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 10px', minHeight: ROW_H }}>
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
          flex: 1, fontSize: FONT.body, border: 'none', outline: 'none',
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
  const msWidthRaw = msStartX !== null && msEndX !== null ? msEndX - msStartX : 0
  const msWidth = msWidthRaw > 0 ? Math.max(msWidthRaw, weekW * 0.6) : 0

  // Task bar — thicker, solid color
  const taskStartX = toX(task?.startDate || task?.dueDate, timelineStart, weekW)
  const taskEndX = toX(task?.dueDate || task?.startDate, timelineStart, weekW)
  const taskWidthRaw = taskStartX !== null && taskEndX !== null
    ? taskEndX - taskStartX
    : 0
  const taskWidth = taskWidthRaw > 0 || (task?.dueDate)
    ? Math.max(taskWidthRaw, weekW * 0.5) // minimum half-week width
    : 0

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

      {/* MS bar (first sub-row only) — semi-transparent with label */}
      {isFirstSubRow && msStartX !== null && msWidth > 0 && (
        <div
          title={`${leafNode?.title || ''}: ${leafNode?.start_date} ~ ${leafNode?.end_date}`}
          style={{
            position: 'absolute',
            left: Math.max(msStartX, 0),
            top: (rowH - GANTT.msBarHeight) / 2,
            height: GANTT.msBarHeight,
            width: msWidth,
            borderRadius: GANTT.barRadius,
            background: `${barColor}30`,
            border: `1px solid ${barColor}45`,
            fontSize: FONT.ganttMs, color: barColor, paddingLeft: 4,
            overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: `${GANTT.msBarHeight}px`,
          }}
        >
          {msWidth > 20 ? (leafNode?.title?.length > 20 ? leafNode.title.slice(0, 20) + '…' : leafNode?.title || '') : ''}
        </div>
      )}

      {/* Task bar — solid with label */}
      {task && taskStartX !== null && (
        <div
          title={`${task.text}: ${task.startDate || task.dueDate} ~ ${task.dueDate || task.startDate}`}
          style={{
            position: 'absolute',
            left: Math.max(taskStartX, 0),
            top: (rowH - GANTT.taskBarHeight) / 2,
            height: task.done ? GANTT.taskBarDoneHeight : GANTT.taskBarHeight,
            width: taskWidth,
            borderRadius: GANTT.barRadius,
            background: task.done ? S.textTertiary : `${barColor}cc`,
            opacity: task.done ? 0.4 : 1,
            fontSize: FONT.ganttTask, color: '#fff', paddingLeft: 4,
            overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: `${GANTT.taskBarHeight}px`,
            cursor: 'grab',
          }}
        >
          {!task.done && taskWidth > 20 ? (task.text?.length > 18 ? task.text.slice(0, 18) + '…' : task.text || '') : ''}
        </div>
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
            background: COLOR.todayLine,
            opacity: GANTT.todayLineOpacity,
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

  // Timeline mode state — auto-calculate range from project data
  const { timelineStart, weekCount } = useMemo(() => {
    const projectMs = milestones.filter(m => m.project_id === projectId)
    const allDates = [
      ...projectMs.flatMap(m => [m.start_date, m.end_date || m.due_date]),
      ...projectTasks.flatMap(t => [t.startDate, t.dueDate]),
    ].filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d))

    if (allDates.length === 0) return { timelineStart: getTimelineStart(), weekCount: WEEK_COUNT }

    const minDate = new Date(Math.min(...allDates))
    const maxDate = new Date(Math.max(...allDates))

    // 2주 여백 추가 (앞뒤)
    const start = new Date(minDate)
    start.setDate(start.getDate() - 14)
    // 월요일로 정렬
    const dow = start.getDay()
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

    const end = new Date(maxDate)
    end.setDate(end.getDate() + 14)
    const diffWeeks = Math.ceil((end - start) / (7 * 864e5))
    return { timelineStart: start, weekCount: Math.max(diffWeeks, 12) }
  }, [milestones, projectTasks, projectId])

  const weekDates = useMemo(() => getWeekDates(timelineStart, weekCount), [timelineStart, weekCount])
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
      <div style={{ padding: 40, color: S.textTertiary, textAlign: 'center', fontSize: FONT.body }}>
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
        <span style={{ fontSize: FONT.projectTitle, fontWeight: 700 }}>{project.name}</span>
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
        {/* Timeline mode → full InlineTimelineView */}
        {rightMode === '타임라인' && (
          <InlineTimelineView projectId={projectId} />
        )}

        {/* Task list mode → MS-grouped single list */}
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
      </div>
    </div>
  )
}
