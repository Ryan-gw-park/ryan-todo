import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import MilestoneTaskChip from './MilestoneTaskChip'

const fmt = (d) => {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return ''
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
}

function MilestoneInlineAdd({ onAdd }) {
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const ref = useRef(null)
  const submit = () => { if (text.trim()) { onAdd(text.trim()); setText('') } else setActive(false) }
  if (!active) return (
    <button
      onClick={() => { setActive(true); setTimeout(() => ref.current?.focus(), 0) }}
      style={{ fontSize: 11, color: '#888780', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, border: '1px dashed #d8d6cf', background: '#fafaf8', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#a09f99'; e.currentTarget.style.color = '#5F5E5A' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#d8d6cf'; e.currentTarget.style.color = '#888780' }}
    >
      + 추가
    </button>
  )
  return (
    <input
      ref={ref} autoFocus value={text} placeholder="할일 입력 후 Enter"
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setText(''); setActive(false) } }}
      onBlur={submit}
      style={{ fontSize: 12, border: 'none', outline: 'none', background: '#f5f4f0', fontFamily: 'inherit', color: '#2C2C2A', padding: '3px 8px', borderRadius: 5, width: 150 }}
    />
  )
}

function InlineTitle({ title, onSave, isBacklog }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef(null)
  const measureRef = useRef(null)

  if (isBacklog) {
    return <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{title}</span>
  }

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setEditing(true); setValue(title); setTimeout(() => inputRef.current?.focus(), 0) }}
        style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, cursor: 'text', minWidth: 20, whiteSpace: 'nowrap' }}
        title="클릭하여 수정"
      >
        {title || '(제목 없음)'}
      </span>
    )
  }

  const submit = () => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed !== title) {
      onSave({ title: trimmed })
    }
  }

  // Measure text width for auto-sizing input
  const inputW = Math.max(60, (value || '').length * 8 + 24)

  return (
    <input
      ref={inputRef}
      autoFocus
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setValue(title); setEditing(false) } }}
      onBlur={submit}
      onClick={e => e.stopPropagation()}
      style={{
        fontSize: 13, fontWeight: 500, lineHeight: 1.3, fontFamily: 'inherit',
        border: 'none', outline: 'none', background: '#f5f4f0', color: '#2C2C2A',
        padding: '1px 6px', borderRadius: 4, width: inputW, maxWidth: '100%', minWidth: 60,
      }}
    />
  )
}

export default function CompactMilestoneRow({
  milestone, tasks, expanded, onToggleExpand, onTaskToggle,
  onAddTask, onTaskClick, isBacklog, deliverables,
  taskColW, onResizeStart, onUpdateMilestone, onOpenMilestoneDetail,
}) {
  const [hover, setHover] = useState(false)

  // Sortable for milestone reordering (not for backlog)
  const {
    attributes, listeners, setNodeRef: setSortRef, transform, transition,
  } = useSortable({
    id: milestone.id,
    data: { type: 'milestone' },
    disabled: isBacklog,
  })

  // Droppable for receiving tasks
  const { setNodeRef: setDropRef, isOver: isDragOver } = useDroppable({
    id: `milestone:${milestone.id}`,
    data: { type: 'milestone-drop', milestoneId: isBacklog ? null : milestone.id },
  })

  const doneCnt = tasks.filter(t => t.done).length
  const totalCnt = tasks.length
  const pct = totalCnt > 0 ? Math.round((doneCnt / totalCnt) * 100) : 0

  // Always show all tasks — flex-wrap handles layout based on available width

  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Click on non-title area toggles expand, drag on non-title area activates sortable
  const handleHeaderAreaClick = (e) => {
    // Only toggle if click is on the header area itself (not on title, chevron, etc.)
    if (e.target === e.currentTarget) {
      onToggleExpand(milestone.id)
    }
  }

  return (
    <div
      ref={(node) => { setSortRef(node); setDropRef(node) }}
      style={{
        ...sortStyle,
        display: 'flex', alignItems: 'stretch',
        borderBottom: '0.5px solid #f0efe8',
        background: isDragOver ? '#f0fdf4' : expanded ? '#fafaf8' : hover ? '#fdfcfa' : 'transparent',
        boxShadow: isDragOver ? 'inset 0 0 0 1.5px #1D9E75' : 'none',
        transition: 'background .1s, box-shadow .15s',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Left: milestone info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top line — non-title area is drag handle + click to expand */}
        <div
          onClick={handleHeaderAreaClick}
          {...(!isBacklog ? { ...attributes, ...listeners } : {})}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px 4px 0', minHeight: 34,
            cursor: isBacklog ? 'pointer' : 'grab',
          }}
        >
          {/* Drag grip indicator */}
          {!isBacklog ? (
            <div
              style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b4b2a9', fontSize: 10, flexShrink: 0, opacity: hover ? 0.8 : 0, transition: 'opacity .12s', userSelect: 'none' }}
            >
              ⠿
            </div>
          ) : (
            <div style={{ width: 22 }} />
          )}

          {/* Chevron */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(milestone.id) }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 3, border: 'none', background: 'none', cursor: 'pointer',
              color: '#a09f99', fontSize: 9, flexShrink: 0,
              transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform .15s',
            }}
          >
            ▾
          </button>

          {/* Color dot */}
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isBacklog ? '#b4b2a9' : (milestone.color || '#1D9E75'), flexShrink: 0 }} />

          {/* Title — click to edit, stopPropagation prevents drag/expand */}
          <div
            style={{ flexShrink: 1, minWidth: 0, maxWidth: 'fit-content' }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <InlineTitle
              title={milestone.title}
              isBacklog={isBacklog}
              onSave={(patch) => onUpdateMilestone(milestone.id, patch)}
            />
          </div>

          {/* Spacer — clickable/draggable area */}
          <div style={{ flex: 1 }} />

          {/* Progress badge */}
          {totalCnt > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginRight: 4 }}>
              <div style={{ width: 32, height: 3, background: '#eeeee6', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#1D9E75', borderRadius: 2, transition: 'width .3s' }} />
              </div>
              <span style={{ fontSize: 9.5, color: '#888780', fontVariantNumeric: 'tabular-nums' }}>{doneCnt}/{totalCnt}</span>
            </div>
          )}
          {/* Detail button */}
          {!isBacklog && onOpenMilestoneDetail && (
            <button
              onClick={e => { e.stopPropagation(); onOpenMilestoneDetail(milestone.id) }}
              onPointerDown={e => e.stopPropagation()}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#b4b2a9', padding: '0 4px', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#666'}
              onMouseLeave={e => e.currentTarget.style.color = '#b4b2a9'}
              title="상세"
            >
              ›
            </button>
          )}
        </div>

        {/* Expanded: dates → desc → deliverables */}
        {expanded && (
          <div style={{ padding: '0 12px 8px 46px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {!isBacklog && (milestone.start_date || milestone.end_date) && (
              <div style={{ fontSize: 10.5, color: '#a09f99', display: 'flex', alignItems: 'center', gap: 4 }}>
                {fmt(milestone.start_date)} <span style={{ color: '#c4c2ba' }}>→</span> {fmt(milestone.end_date)}
              </div>
            )}
            {milestone.description && (
              <div style={{ fontSize: 11.5, color: '#888780', lineHeight: 1.4 }}>{milestone.description}</div>
            )}
            {!isBacklog && deliverables && deliverables.length > 0 && (
              deliverables.map(d => (
                <div key={d.id} style={{ fontSize: 11, color: '#888780', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#b4b2a9' }} />
                  {d.title || '결과물'}
                </div>
              ))
            )}
            {!isBacklog && (
              <div
                style={{ fontSize: 11, color: '#a09f99', cursor: 'pointer', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => e.currentTarget.style.color = '#5F5E5A'}
                onMouseLeave={e => e.currentTarget.style.color = '#a09f99'}
              >
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#b4b2a9' }} />
                결과물 추가
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize bar */}
      <div
        onMouseDown={onResizeStart}
        style={{
          width: 5, cursor: 'col-resize', flexShrink: 0,
          background: 'transparent', position: 'relative', zIndex: 1,
          borderLeft: '0.5px solid #f0efe8',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#e0ddd6'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      />

      {/* Right: tasks area */}
      <div
        onClick={() => { if (!expanded) onToggleExpand(milestone.id) }}
        style={{
          width: taskColW, flexShrink: 0, padding: expanded ? '8px 12px' : '6px 12px',
          display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start',
          minHeight: expanded ? 44 : 34,
          cursor: expanded ? 'default' : 'pointer',
        }}
      >
        {expanded ? (
          <>
            {totalCnt === 0 && (
              <>
                <div style={{
                  border: '1.5px dashed #e0ddd6', borderRadius: 5, padding: '3px 8px',
                  fontSize: 10, color: '#c4c2ba', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', minHeight: 24, maxWidth: 130,
                  ...(isDragOver ? { borderColor: '#1D9E75', background: '#f0fdf4', color: '#1D9E75' } : {}),
                }}>
                  드래그하여 연결
                </div>
                <MilestoneInlineAdd onAdd={(text) => onAddTask(milestone.id, text)} />
              </>
            )}

            {tasks.map(task => (
              <MilestoneTaskChip
                key={task.id}
                task={task}
                milestoneId={isBacklog ? '__backlog__' : milestone.id}
                onToggle={onTaskToggle}
                onClick={onTaskClick}
              />
            ))}

            {totalCnt > 0 && (
              <MilestoneInlineAdd onAdd={(text) => onAddTask(milestone.id, text)} />
            )}
          </>
        ) : (
          /* Collapsed: show task chip preview (max 3) + "+N개" badge */
          <>
            {totalCnt === 0 ? (
              <>
                <div style={{
                  border: '1.5px dashed #e0ddd6', borderRadius: 5, padding: '3px 8px',
                  fontSize: 10, color: '#c4c2ba', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', minHeight: 22, maxWidth: 130,
                  ...(isDragOver ? { borderColor: '#1D9E75', background: '#f0fdf4', color: '#1D9E75' } : {}),
                }}>
                  드래그하여 연결
                </div>
                <MilestoneInlineAdd onAdd={(text) => onAddTask(milestone.id, text)} />
              </>
            ) : (
              <>
                {tasks.slice(0, 3).map(task => (
                  <MilestoneTaskChip
                    key={task.id}
                    task={task}
                    milestoneId={isBacklog ? '__backlog__' : milestone.id}
                    onToggle={onTaskToggle}
                    onClick={onTaskClick}
                  />
                ))}
                {totalCnt > 3 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleExpand(milestone.id) }}
                    style={{
                      fontSize: 10.5, color: '#888780', background: '#eeeee6',
                      border: 'none', borderRadius: 999, padding: '2px 8px',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    +{totalCnt - 3}개
                  </button>
                )}
                <MilestoneInlineAdd onAdd={(text) => onAddTask(milestone.id, text)} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
