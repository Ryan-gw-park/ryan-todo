import { useState, useCallback, useRef } from 'react'
import {
  ROW_HEIGHTS, BAR_HEIGHTS, getBarStyles, getBarPosition,
  getTooltipData, fmtDate, addDays, parseDate, dateToColIndex, isSameDay,
} from '../../utils/timelineUtils'
import TimelineTooltip from './TimelineTooltip'

/**
 * Loop-34: 타임라인 우측 그리드
 * 헤더 + 간트바 + 오늘 라인 + 주말 음영 + DnD drag/resize
 */
export default function TimelineGrid({
  rows,
  columns,
  colW,
  scale,
  monthHeaders,
  todayCol,
  gridRef,
  activeId,
  updateTask,
  openDetail,
  showAssigneeOnBar,
  memberMap,
}) {
  const gridW = columns.length * colW
  const [tooltip, setTooltip] = useState({ visible: false, data: null, x: 0, y: 0 })

  return (
    <div ref={gridRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
      <div style={{ width: gridW, minHeight: 200 }}>
        {/* Month header row (quarter/year only) */}
        {scale !== 'month' && (
          <div style={{ display: 'flex', height: 24 }}>
            {monthHeaders.map((mh, i) => (
              <div key={i} style={{
                width: mh.span * colW, fontSize: 11, fontWeight: 600, color: '#666',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {mh.label}
              </div>
            ))}
          </div>
        )}

        {/* Date header row */}
        <div style={{ display: 'flex', height: 32, position: 'sticky', top: 0, background: 'white', zIndex: 3 }}>
          {columns.map((col, i) => {
            const isToday = todayCol === i
            return (
              <div key={i} style={{
                width: colW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: scale === 'month' ? 12 : 10, fontWeight: isToday ? 700 : 400,
                color: isToday ? '#ef4444' : col.isWeekend ? '#ccc' : '#999',
                position: 'relative', overflow: 'visible',
                background: scale !== 'month' && col.band === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
              }}>
                {col.label && <span style={{ whiteSpace: 'nowrap', pointerEvents: 'none' }}>{col.label}</span>}
                {isToday && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />}
              </div>
            )
          })}
        </div>

        {/* Data rows */}
        {rows.map(node => (
          <BarRow
            key={node.id}
            node={node}
            columns={columns}
            colW={colW}
            scale={scale}
            todayCol={todayCol}
            isDragging={activeId === node.id}
            updateTask={updateTask}
            openDetail={openDetail}
            showAssigneeOnBar={showAssigneeOnBar}
            memberMap={memberMap}
            onTooltipShow={(data, x, y) => setTooltip({ visible: true, data, x, y })}
            onTooltipHide={() => setTooltip(t => t.visible ? { ...t, visible: false } : t)}
            onTooltipMove={(x, y) => setTooltip(t => t.visible ? { ...t, x, y } : t)}
          />
        ))}
      </div>

      <TimelineTooltip data={tooltip.data} x={tooltip.x} y={tooltip.y} visible={tooltip.visible} />
    </div>
  )
}

/* ── Single bar row ── */
function BarRow({
  node, columns, colW, scale, todayCol, isDragging,
  updateTask, openDetail, showAssigneeOnBar, memberMap,
  onTooltipShow, onTooltipHide, onTooltipMove,
}) {
  const rowH = ROW_HEIGHTS[node.type]
  const barH = BAR_HEIGHTS[node.type]
  const barTop = Math.round((rowH - barH) / 2)
  const isTask = node.type === 'task'
  const barStyle = getBarStyles(node)
  const pos = getBarPosition(node, columns, colW, scale, todayCol)

  const [dragState, setDragState] = useState(null)

  // Drag/resize for tasks
  const handleMouseDown = useCallback((e, type) => {
    if (!isTask) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    setDragState({ type, startX, currentX: startX })

    const handleMouseMove = (ev) => {
      setDragState(prev => prev ? { ...prev, currentX: ev.clientX } : null)
    }
    const handleMouseUp = (ev) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      const dx = ev.clientX - startX
      const colDelta = Math.round(dx / colW)
      setDragState(null)

      if (Math.abs(dx) < 5) {
        openDetail(node.raw)
        return
      }
      if (colDelta === 0) return

      const task = node.raw
      const patch = {}
      if (type === 'move') {
        if (task.startDate) patch.startDate = fmtDate(addDays(parseDate(task.startDate), colDelta))
        if (task.dueDate) patch.dueDate = fmtDate(addDays(parseDate(task.dueDate), colDelta))
        if (!task.startDate && !task.dueDate && todayCol >= 0) {
          const targetDate = fmtDate(columns[Math.max(0, Math.min(todayCol + colDelta, columns.length - 1))].date)
          patch.startDate = targetDate
          patch.dueDate = targetDate
        }
      } else if (type === 'resizeL') {
        const baseDate = task.startDate ? parseDate(task.startDate) : (todayCol >= 0 ? columns[todayCol].date : null)
        const endDate = task.dueDate ? parseDate(task.dueDate) : baseDate
        if (!baseDate) return
        const newDate = addDays(baseDate, colDelta)
        if (endDate && newDate > endDate) return
        patch.startDate = fmtDate(newDate)
        if (!task.dueDate) patch.dueDate = fmtDate(endDate)
      } else if (type === 'resizeR') {
        const endDate = task.dueDate ? parseDate(task.dueDate) : (todayCol >= 0 ? columns[todayCol].date : null)
        const startDate = task.startDate ? parseDate(task.startDate) : endDate
        if (!endDate) return
        const newDate = addDays(endDate, colDelta)
        if (startDate && newDate < startDate) return
        patch.dueDate = fmtDate(newDate)
        if (!task.startDate) patch.startDate = fmtDate(startDate)
      }

      if (Object.keys(patch).length) updateTask(task.id, patch)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [node, colW, columns, todayCol, updateTask, openDetail, isTask])

  // Compute dragged position
  let blockLeft = pos?.left ?? (todayCol >= 0 ? todayCol * colW : 0)
  let blockWidth = pos?.width ?? colW
  const noDates = !node.startDate && !node.dueDate

  if (dragState && pos) {
    const dx = dragState.currentX - dragState.startX
    const colDelta = Math.round(dx / colW)
    const startCol = pos.left / colW
    const endCol = startCol + pos.width / colW - 1

    if (dragState.type === 'move') {
      blockLeft = pos.left + colDelta * colW
    } else if (dragState.type === 'resizeL') {
      const newStart = startCol + colDelta
      const clampedStart = Math.min(newStart, endCol)
      blockLeft = clampedStart * colW
      blockWidth = (endCol - clampedStart + 1) * colW
    } else if (dragState.type === 'resizeR') {
      const newEnd = endCol + colDelta
      const clampedEnd = Math.max(newEnd, startCol)
      blockWidth = (clampedEnd - startCol + 1) * colW
    }
  }

  const tooltipData = getTooltipData(node)

  return (
    <div style={{
      height: rowH, position: 'relative', opacity: isDragging ? 0.3 : 1,
      background: node.type === 'project' ? '#f9f9f7' : node.type === 'milestone' ? '#fafafa' : 'transparent',
    }}>
      {/* Weekend shading */}
      {columns.map((col, i) => {
        if (col.isWeekend) return <div key={`w${i}`} style={{ position: 'absolute', left: i * colW, width: colW, height: rowH, background: 'rgba(0,0,0,0.025)', top: 0 }} />
        if (col.band === 1) return <div key={`b${i}`} style={{ position: 'absolute', left: i * colW, width: colW, height: rowH, background: 'rgba(0,0,0,0.02)', top: 0 }} />
        return null
      })}

      {/* Today line */}
      {todayCol >= 0 && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: todayCol * colW + colW / 2 - 1,
          width: 2, background: '#ef4444', zIndex: 1, pointerEvents: 'none', opacity: 0.35,
        }} />
      )}

      {/* Bar */}
      {(pos || noDates) && (
        <div
          style={{
            position: 'absolute',
            top: barTop,
            left: Math.max(blockLeft, 0),
            width: Math.max(blockWidth, colW * 0.5),
            height: barH,
            background: barStyle.fill,
            border: barStyle.border,
            borderRadius: node.type === 'project' ? 5 : 4,
            cursor: isTask ? (dragState ? 'grabbing' : 'grab') : 'default',
            display: 'flex', alignItems: 'center', overflow: 'visible',
            boxShadow: dragState ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            opacity: dragState ? 0.85 : noDates ? 0.4 : 1,
            transition: dragState ? 'none' : 'box-shadow 0.15s, opacity 0.15s',
            zIndex: dragState ? 10 : 2,
            userSelect: 'none',
          }}
          onMouseDown={isTask ? (e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const relX = e.clientX - rect.left
            if (relX <= 5) handleMouseDown(e, 'resizeL')
            else if (relX >= rect.width - 5) handleMouseDown(e, 'resizeR')
            else handleMouseDown(e, 'move')
          } : undefined}
          onMouseMove={isTask && !dragState ? (e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const relX = e.clientX - rect.left
            e.currentTarget.style.cursor = (relX <= 5 || relX >= rect.width - 5) ? 'col-resize' : 'grab'
          } : undefined}
          onMouseEnter={(e) => onTooltipShow(tooltipData, e.clientX, e.clientY)}
          onMouseLeave={() => onTooltipHide()}
          onMouseMoveCapture={!dragState ? (e) => onTooltipMove(e.clientX, e.clientY) : undefined}
        >
          {/* Progress fill (project/milestone) */}
          {node.progress > 0 && barStyle.progressFill !== 'none' && (
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${node.progress}%`,
              background: barStyle.progressFill,
              opacity: barStyle.progressOpacity || 0.3,
              borderRadius: 'inherit',
            }} />
          )}

          {/* Resize handle (left) */}
          {isTask && <div style={{ width: 4, height: '100%', cursor: 'col-resize', flexShrink: 0 }} />}

          {/* Label — always show full text (overflow visible) */}
          <span style={{
            fontSize: node.type === 'project' ? 12 : node.type === 'milestone' ? 11 : 11,
            fontWeight: node.type === 'project' ? 600 : 500,
            color: barStyle.textColor,
            padding: '0 4px',
            whiteSpace: 'nowrap', pointerEvents: 'none',
            textDecoration: barStyle.strikethrough ? 'line-through' : 'none',
            position: 'relative', zIndex: 1,
          }}>
            {node.name}
          </span>

          {/* Assignee on bar */}
          {showAssigneeOnBar && isTask && node.ownerName && node.ownerName !== '미배정' && (
            <span style={{
              fontSize: 10, color: `${barStyle.textColor}99`, fontWeight: 500,
              whiteSpace: 'nowrap', pointerEvents: 'none', padding: '0 4px', flexShrink: 0,
              position: 'relative', zIndex: 1,
            }}>
              {node.ownerName}
            </span>
          )}

          {/* Resize handle (right) */}
          {isTask && <div style={{ width: 4, height: '100%', cursor: 'col-resize', flexShrink: 0 }} />}
        </div>
      )}
    </div>
  )
}
