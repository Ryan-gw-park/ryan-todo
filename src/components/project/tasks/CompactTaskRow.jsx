import { useDraggable } from '@dnd-kit/core'
import OutlinerEditor from '../../shared/OutlinerEditor'
import UniversalCard from '../../common/UniversalCard'

const fmtDate = (d) => {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return ''
  const m = dt.getMonth() + 1
  const day = dt.getDate()
  return `${m}/${day}`
}

/**
 * CompactTaskRow - UniversalCard 기반 컴팩트 태스크 행
 */
export default function CompactTaskRow({
  task,
  expanded,
  onToggleExpand,
  onToggleDone,
  onClickTask,
  onUpdateNote,
  onUpdateTitle,
  onToggleMilestone,
  milestoneId,
  milestoneColor,
  assigneeName,
}) {
  // Draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-drag-${task.id}`,
    data: { type: 'compact-task', taskId: task.id, sourceMsId: milestoneId },
  })

  return (
    <div style={{ opacity: isDragging ? 0.4 : 1 }}>
      <UniversalCard
        type="task"
        data={{ id: task.id, name: task.text, done: task.done }}
        expanded={expanded}
        onToggleExpand={() => onToggleExpand(task.id)}
        onTitleSave={(text) => onUpdateTitle?.(task.id, text)}
        onStatusToggle={() => onToggleDone(task.id)}
        onDetailOpen={() => onClickTask?.(task)}
        compact
        dragRef={setNodeRef}
        dragListeners={listeners}
        dragAttributes={attributes}
        isDragging={isDragging}
        renderMeta={() => (
          <>
            {task.dueDate && (
              <span style={{ fontSize: 11, color: '#a09f99' }}>{fmtDate(task.dueDate)}</span>
            )}
            {assigneeName && (
              <span style={{
                fontSize: 10, color: '#888780', background: '#f0efe8',
                padding: '2px 6px', borderRadius: 4,
                maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {assigneeName}
              </span>
            )}
          </>
        )}
        renderExpanded={() => (
          <div style={{
            padding: '0 0 4px 4px',
            background: '#fafaf8',
          }}>
            <OutlinerEditor
              notes={task.notes || ''}
              onChange={(val) => onUpdateNote(task.id, val)}
              accentColor={milestoneColor || '#1D9E75'}
            />
          </div>
        )}
      />
    </div>
  )
}
