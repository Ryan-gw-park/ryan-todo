import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Checkbox from '../shared/Checkbox'
import useStore from '../../store/useStore'

function fmt(s) {
  if (!s) return ''
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(s); d.setHours(0,0,0,0)
  const diff = Math.floor((d - today) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  if (diff < 0) return `${Math.abs(diff)}일 초과`
  return `${d.getMonth()+1}/${d.getDate()}`
}
function isOverdue(s) {
  if (!s) return false
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(s); d.setHours(0,0,0,0)
  return d < today
}

export default function TaskCard({ task }) {
  const { toggleDone, openDetail } = useStore()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : task.done ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded border border-[rgba(55,53,47,.09)] px-[10px] py-2 cursor-pointer flex items-start gap-2 select-none group transition-all hover:border-[rgba(55,53,47,.2)] hover:shadow-[rgba(15,15,15,.06)_0_1px_4px] ${task.done ? 'line-through' : ''}`}
      onClick={() => openDetail(task.id)}
    >
      <Checkbox checked={task.done} onChange={() => toggleDone(task.id)} size={13} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-normal leading-snug break-all ${task.done ? 'line-through' : ''}`}>{task.text}</div>
        {task.dueDate && (
          <div className={`text-[11px] mt-[3px] ${isOverdue(task.dueDate) ? 'text-red-600' : 'text-[rgba(55,53,47,.4)]'}`}>
            📅 {fmt(task.dueDate)}
          </div>
        )}
      </div>
      <div {...attributes} {...listeners} className="flex flex-col gap-[2px] cursor-grab opacity-0 group-hover:opacity-[.45] p-[2px] flex-none mt-[2px]">
        <div className="w-[9px] h-[1.5px] bg-[rgba(55,53,47,.3)] rounded-sm" />
        <div className="w-[9px] h-[1.5px] bg-[rgba(55,53,47,.3)] rounded-sm" />
      </div>
    </div>
  )
}
