import { useState, useRef } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'

/* ═══════════════════════════════════════════════════════
   TimelineShared — 글로벌/프로젝트 타임라인 공용 컴포넌트
   ═══════════════════════════════════════════════════════ */

// ─── Date helpers ───
export function parseDate(s) { return s ? new Date(s + 'T00:00:00') : null }
export function daysBetween(a, b) { return Math.round((b - a) / 86400000) }
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
export function fmtISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export function formatWeek(d) { return `${d.getMonth() + 1}/${d.getDate()}` }
export function formatMonth(d) { return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}` }
export function formatQuarter(d) { return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}` }
export function startOfWeek(d) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r }
export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
export function startOfQuarter(d) { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1) }

// ─── Timeline range from dates ───
export function getTimelineRange(allDates) {
  const valid = allDates.filter(d => d && !isNaN(d))
  let minD = valid.length > 0 ? new Date(Math.min(...valid)) : new Date()
  let maxD = valid.length > 0 ? new Date(Math.max(...valid)) : addDays(new Date(), 90)
  return { minD: addDays(minD, -14), maxD: addDays(maxD, 14) }
}

// ─── Columns ───
export function getColumns(minD, maxD, scale) {
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

export function getColWidth(scale) { return scale === 'week' ? 56 : scale === 'month' ? 80 : 100 }
export function getDayWidth(colW, scale) { return scale === 'week' ? colW / 7 : scale === 'month' ? colW / 30 : colW / 90 }

export function xToDate(x, minD, colW, scale) {
  return addDays(minD, Math.round(x / getDayWidth(colW, scale)))
}

export function getBarStyle(startStr, endStr, minD, colW, scale, barColor, opacity) {
  const s = parseDate(startStr), e = parseDate(endStr)
  if (!s || !e) return null
  const dayW = getDayWidth(colW, scale)
  const left = daysBetween(minD, s) * dayW
  const width = Math.max(daysBetween(s, e) * dayW, colW * 0.4)
  return { position: 'absolute', left, width, top: '50%', transform: 'translateY(-50%)', height: 16, borderRadius: 4, background: barColor, opacity }
}

export function getTodayLabel(scale) {
  const today = new Date()
  return scale === 'week' ? formatWeek(startOfWeek(today)) : scale === 'month' ? formatMonth(today) : formatQuarter(today)
}

// ─── Column Grid Lines ───
export function ColumnGrid({ columns, colW, todayLabel, height }) {
  return (
    <div style={{ display: 'flex', height: height || '100%' }}>
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
  )
}

// ─── Column Header ───
export function ColumnHeader({ columns, colW, todayLabel }) {
  return (
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
  )
}

// ─── ScalePill ───
export function ScalePill({ scale, onChange }) {
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

// ─── Toast ───
export function Toast({ msg, canUndo, onUndo, onClose }) {
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

// ─── MiniAvatar ───
export function MiniAvatar({ name, size = 16 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.42, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

// ─── DraggableBar — Gantt 바 드래그 (전체 이동 + 좌우 리사이즈) ───
export function DraggableBar({ type, id, startStr, endStr, minD, colW, scale, barColor, opacity, height, onDragEnd }) {
  const s = parseDate(startStr), e = parseDate(endStr)
  if (!s || !e) return null

  const dayW = getDayWidth(colW, scale)
  const left = daysBetween(minD, s) * dayW
  const width = Math.max(daysBetween(s, e) * dayW, colW * 0.4)

  const dragRef = useRef(null)
  const [dragMode, setDragMode] = useState(null)
  const dragStartX = useRef(0)
  const origLeft = useRef(left)
  const origWidth = useRef(width)
  const HANDLE_W = 6

  const handleMouseDown = (ev, mode) => {
    ev.preventDefault()
    ev.stopPropagation()
    setDragMode(mode)
    dragStartX.current = ev.clientX
    origLeft.current = left
    origWidth.current = width

    const handleMove = (e) => {
      const delta = e.clientX - dragStartX.current
      const bar = dragRef.current
      if (!bar) return
      if (mode === 'move') {
        bar.style.left = `${origLeft.current + delta}px`
      } else if (mode === 'resize-left') {
        const nw = origWidth.current - delta
        if (nw > colW * 0.3) { bar.style.left = `${origLeft.current + delta}px`; bar.style.width = `${nw}px` }
      } else if (mode === 'resize-right') {
        const nw = origWidth.current + delta
        if (nw > colW * 0.3) bar.style.width = `${nw}px`
      }
    }
    const handleUp = (e) => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      setDragMode(null)
      const delta = e.clientX - dragStartX.current
      if (Math.abs(delta) < 3) return
      let newStart, newEnd
      if (mode === 'move') {
        const nl = origLeft.current + delta
        newStart = fmtISO(xToDate(nl, minD, colW, scale))
        newEnd = fmtISO(xToDate(nl + origWidth.current, minD, colW, scale))
      } else if (mode === 'resize-left') {
        newStart = fmtISO(xToDate(origLeft.current + delta, minD, colW, scale))
        newEnd = endStr
      } else if (mode === 'resize-right') {
        newStart = startStr
        newEnd = fmtISO(xToDate(origLeft.current + origWidth.current + delta, minD, colW, scale))
      }
      if (newStart && newEnd && onDragEnd) onDragEnd(type, id, newStart, newEnd)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <div ref={dragRef} onMouseDown={e => handleMouseDown(e, 'move')} style={{
      position: 'absolute', left, width, top: '50%', transform: 'translateY(-50%)',
      height, borderRadius: 4, background: barColor, opacity,
      cursor: dragMode === 'move' ? 'grabbing' : 'grab',
      display: 'flex', alignItems: 'center', userSelect: 'none',
    }}>
      <div onMouseDown={e => handleMouseDown(e, 'resize-left')} style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: HANDLE_W, cursor: 'col-resize', borderRadius: '4px 0 0 4px',
      }} />
      <div onMouseDown={e => handleMouseDown(e, 'resize-right')} style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: HANDLE_W, cursor: 'col-resize', borderRadius: '0 4px 4px 0',
      }} />
    </div>
  )
}

/* ═══ TimelineMsRow — 좌측 트리 + 우측 Gantt (공용 재귀 노드) ═══ */
export function TimelineMsRow({ node, depth, dotColor, treeW, collapsed, toggleNode,
  timelineCtx, projectTasks, toggleDone,
  dragState, setDragState, onTaskDrop, onMsDropChild, onMsReorder, onBarDragEnd,
}) {
  const hasChildren = (node.children || []).length > 0
  const isCollapsed = collapsed.has(node.id)
  const [hover, setHover] = useState(false)
  const [dropTarget, setDropTarget] = useState(null)

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
      if (fromMsId !== node.id && onTaskDrop) onTaskDrop(taskId, fromMsId, node.id)
    }
    if (type === 'ms') {
      const msId = e.dataTransfer.getData('msId')
      if (msId === node.id) return
      if (zone === 'ms-child' && onMsDropChild) onMsDropChild(msId, node.id)
      if (zone === 'ms-above' && onMsReorder) onMsReorder(msId, node.id, 'above')
      if (zone === 'ms-below' && onMsReorder) onMsReorder(msId, node.id, 'below')
    }
  }

  return (
    <>
      {dropTarget === 'ms-above' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

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
            e.dataTransfer.setData('type', 'ms'); e.dataTransfer.setData('msId', node.id)
            if (setDragState) setDragState({ type: 'ms', id: node.id })
          }}
          onDragOver={e => {
            if (dragState?.type === 'ms') {
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              handleDragOver(e, y < rect.height * 0.25 ? 'ms-above' : y > rect.height * 0.75 ? 'ms-below' : 'ms-child')
            }
            if (dragState?.type === 'task') handleDragOver(e, 'task-zone')
          }}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, dropTarget || 'ms-child')}
          style={{
            width: treeW, flexShrink: 0, padding: '4px 8px', paddingLeft: 8 + depth * 22,
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
          <ColumnGrid columns={columns} colW={colW} todayLabel={todayLabel} />
          {node.start_date && node.end_date && (
            <DraggableBar type="ms" id={node.id}
              startStr={node.start_date} endStr={node.end_date}
              minD={minD} colW={colW} scale={scale}
              barColor={dotColor} opacity={hasChildren ? 0.25 : 0.5} height={16}
              onDragEnd={onBarDragEnd}
            />
          )}
        </div>
      </div>

      {dropTarget === 'ms-below' && <div style={{ height: 2, background: '#3182CE', margin: '0 10px', borderRadius: 1 }} />}

      {/* Task rows */}
      {!isCollapsed && activeTasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${COLOR.border}`, minHeight: 26 }}>
          <div
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('type', 'task'); e.dataTransfer.setData('taskId', t.id); e.dataTransfer.setData('fromMsId', node.id)
              if (setDragState) setDragState({ type: 'task', id: t.id })
            }}
            style={{
              width: treeW, flexShrink: 0, padding: '3px 8px', paddingLeft: 8 + (depth + 1) * 22 + 14,
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
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <ColumnGrid columns={columns} colW={colW} todayLabel={todayLabel} />
            {t.startDate && t.dueDate && (
              <DraggableBar type="task" id={t.id}
                startStr={t.startDate} endStr={t.dueDate}
                minD={minD} colW={colW} scale={scale}
                barColor={dotColor} opacity={0.4} height={12}
                onDragEnd={onBarDragEnd}
              />
            )}
          </div>
        </div>
      ))}

      {/* Children */}
      {hasChildren && !isCollapsed && node.children.map(child => (
        <TimelineMsRow
          key={child.id} node={child} depth={depth + 1} dotColor={dotColor} treeW={treeW}
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
