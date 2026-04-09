import { useState, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT, CHECKBOX } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'
import useStore from '../../../../hooks/useStore'

/* ─── Span Bar (middle/end segment — no sortable to avoid id collision) ─── */
export function SpanBar({ task, project, spanPosition }) {
  const barColor = project ? getColor(project.color).dot : '#888'
  return (
    <div style={{
      height: 24, marginBottom: 1,
      background: `${barColor}1F`,
      borderRadius: spanPosition === 'end' ? '0 4px 4px 0' : 0,
    }} />
  )
}

/* ─── Task Card (draggable, click-to-edit) ─── */
export default function TaskRow({ task, project, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, showMs, spanPosition }) {
  const milestones = useStore(s => s.milestones)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cell-task:${task.id}`,
  })
  const [hover, setHover] = useState(false)
  const isEditing = editingId === task.id

  // Find MS title for this task
  const msTitle = useMemo(() => {
    if (!showMs || !task.keyMilestoneId) return null
    return milestones.find(m => m.id === task.keyMilestoneId)?.title
  }, [showMs, task.keyMilestoneId, milestones])

  const effectiveSpan = spanPosition || task._spanPosition
  const isSpanStart = effectiveSpan === 'start'
  const isSpanActive = effectiveSpan && effectiveSpan !== 'single'
  const barColor = project ? getColor(project.color).dot : '#888'

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 4px', marginBottom: 1,
        borderRadius: isSpanStart ? '4px 0 0 4px' : 4,
        cursor: isEditing ? 'text' : 'grab',
        transition: sortableStyle.transition || 'background 0.08s',
        background: hover && !isEditing ? COLOR.bgHover : (isSpanActive ? `${barColor}1F` : 'transparent'),
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }} style={{
        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer', marginTop: 1,
        border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
        background: task.done ? CHECKBOX.checkedBg : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            autoFocus defaultValue={task.text}
            onBlur={e => handleEditFinish(task.id, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleEditFinish(task.id, e.target.value) }
              if (e.key === 'Escape') setEditingId(null)
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{ width: '100%', fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
          />
        ) : (
          <span
            onClick={e => { e.stopPropagation(); e.preventDefault(); setEditingId(task.id) }}
            style={{
              fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
              lineHeight: 1.4, cursor: 'text', display: 'block',
              whiteSpace: 'normal', wordBreak: 'break-word',
              textDecoration: task.done ? 'line-through' : 'none',
            }}
          >{task.text}</span>
        )}
        {/* Meta: project + MS */}
        {(showProject || msTitle) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            {showProject && project && (
              <>
                <div style={{ width: 5, height: 5, borderRadius: 1, background: getColor(project.color).dot, flexShrink: 0 }} />
                <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary }}>{project.name}</span>
              </>
            )}
            {msTitle && <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary }}>{showProject ? '·' : ''} {msTitle}</span>}
          </div>
        )}
      </div>

      {/* Due date badge */}
      {task.dueDate && !showProject && (
        <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
      )}

      {/* Detail arrow */}
      {hover && !isEditing && (
        <div onClick={e => { e.stopPropagation(); e.preventDefault(); openDetail(task) }} style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: 0.4,
        }}>
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
    </div>
  )
}
