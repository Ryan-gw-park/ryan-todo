import useStore from '../../hooks/useStore'
import { CheckIcon, UndoIcon } from './Icons'

export default function TaskItem({ task, color, compact }) {
  const { openDetail, toggleDone } = useStore()
  const isDone = task.category === 'done'

  return (
    <div
      onClick={() => openDetail(task)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: compact ? '3px 4px' : '5px 4px', borderRadius: 4, cursor: 'pointer', transition: 'background 0.1s', opacity: isDone ? 0.45 : 1 }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ paddingTop: 1 }}>
        {isDone
          ? <div style={{ width: 18, height: 18, borderRadius: 4, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#66bb6a' }}><UndoIcon /></div>
          : <CheckIcon checked={false} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 13, lineHeight: '19px', color: isDone ? '#999' : '#37352f', textDecoration: isDone ? 'line-through' : 'none' }}>{task.text}</div>
        {!compact && task.dueDate && <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>{task.dueDate}</div>}
      </div>
    </div>
  )
}
