import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'

export default function MilestoneTaskChip({ task, milestoneId, onToggle, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', taskId: task.id, sourceMsId: milestoneId },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(task)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
        background: isDragging ? '#e8f5e9' : '#f5f4f0', borderRadius: 5, fontSize: 12,
        cursor: 'grab', transition: 'all .12s', userSelect: 'none',
        border: isDragging ? '1px dashed #1D9E75' : '1px solid transparent',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(task.id) }}
        style={{
          width: 14, height: 14, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          border: task.done ? 'none' : '1.5px solid #c4c2ba',
          background: task.done ? '#1D9E75' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 8,
        }}
      >
        {task.done && '✓'}
      </div>
      <span style={{ textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#c4c2ba' : '#2C2C2A', whiteSpace: 'nowrap' }}>
        {task.text}
      </span>
    </div>
  )
}
