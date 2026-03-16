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
      style={{ fontSize: 11, color: '#c4c2ba', cursor: 'pointer', padding: '3px 6px', borderRadius: 4, border: 'none', background: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
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

export default function CompactMilestoneRow({
  milestone, tasks, expanded, onToggleExpand, onTaskToggle,
  onAddTask, onTaskClick, isBacklog, deliverables,
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

  const previewTasks = expanded ? tasks : tasks.slice(0, 2)
  const hiddenCount = expanded ? 0 : Math.max(0, tasks.length - 2)

  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '0.5px solid #f0efe8' }}>
        {/* Top line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 4px 0', minHeight: 34 }}>
          {/* Drag grip */}
          {!isBacklog ? (
            <div
              {...attributes} {...listeners}
              style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', color: '#d3d1c7', fontSize: 10, flexShrink: 0, opacity: hover ? 0.8 : 0, transition: 'opacity .12s', userSelect: 'none' }}
            >
              ⠿
            </div>
          ) : (
            <div style={{ width: 22 }} />
          )}

          {/* Chevron */}
          <button
            onClick={() => onToggleExpand(milestone.id)}
            style={{
              width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 3, border: 'none', background: 'none', cursor: 'pointer',
              color: '#c4c2ba', fontSize: 9, flexShrink: 0,
              transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform .15s',
            }}
          >
            ▾
          </button>

          {/* Color dot */}
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isBacklog ? '#b4b2a9' : (milestone.color || '#1D9E75'), flexShrink: 0 }} />

          {/* Title */}
          <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, flex: 1 }}>
            {milestone.title}
          </span>

          {/* Progress badge */}
          {totalCnt > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginRight: 4 }}>
              <div style={{ width: 32, height: 3, background: '#eeeee6', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#1D9E75', borderRadius: 2, transition: 'width .3s' }} />
              </div>
              <span style={{ fontSize: 9.5, color: '#b4b2a9', fontVariantNumeric: 'tabular-nums' }}>{doneCnt}/{totalCnt}</span>
            </div>
          )}
        </div>

        {/* Expanded: dates → desc → deliverables */}
        {expanded && (
          <div style={{ padding: '0 12px 8px 46px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {!isBacklog && (milestone.start_date || milestone.end_date) && (
              <div style={{ fontSize: 10.5, color: '#ccc9c0', display: 'flex', alignItems: 'center', gap: 4 }}>
                {fmt(milestone.start_date)} <span style={{ color: '#ddd9d0' }}>→</span> {fmt(milestone.end_date)}
              </div>
            )}
            {milestone.description && (
              <div style={{ fontSize: 11.5, color: '#a09f99', lineHeight: 1.4 }}>{milestone.description}</div>
            )}
            {!isBacklog && deliverables && deliverables.length > 0 && (
              deliverables.map(d => (
                <div key={d.id} style={{ fontSize: 11, color: '#a09f99', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d3d1c7' }} />
                  {d.title || '결과물'}
                </div>
              ))
            )}
            {!isBacklog && (
              <div style={{ fontSize: 11, color: '#c4c2ba', cursor: 'pointer', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d3d1c7' }} />
                결과물 추가
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: tasks area */}
      <div
        style={{
          width: 400, flexShrink: 0, padding: expanded ? '8px 12px' : '6px 12px',
          display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start',
          minHeight: expanded ? 44 : 34,
        }}
      >
        {totalCnt === 0 && (
          <>
            <div style={{
              border: '1.5px dashed #e0ddd6', borderRadius: 5, padding: '3px 8px',
              fontSize: 11, color: '#d3d1c7', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flex: 1, minHeight: 26,
              ...(isDragOver ? { borderColor: '#1D9E75', background: '#f0fdf4', color: '#1D9E75' } : {}),
            }}>
              할일을 드래그하여 연결
            </div>
            <MilestoneInlineAdd onAdd={(text) => onAddTask(milestone.id, text)} />
          </>
        )}

        {previewTasks.map(task => (
          <MilestoneTaskChip
            key={task.id}
            task={task}
            milestoneId={isBacklog ? '__backlog__' : milestone.id}
            onToggle={onTaskToggle}
            onClick={onTaskClick}
          />
        ))}

        {hiddenCount > 0 && (
          <button
            onClick={() => onToggleExpand(milestone.id)}
            style={{
              fontSize: 10.5, color: '#a09f99', background: '#eeeee6', border: 'none',
              borderRadius: 999, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            +{hiddenCount}개 더보기
          </button>
        )}

        {totalCnt > 0 && (
          <MilestoneInlineAdd onAdd={(text) => onAddTask(milestone.id, text)} />
        )}
      </div>
    </div>
  )
}
