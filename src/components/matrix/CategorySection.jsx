import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'
import useStore from '../../store/useStore'

export default function CategorySection({ proj, cat, nc, tasks: catTasks, isDraggingTask }) {
  const { openModal } = useStore()
  const droppableId = `${proj.id}::${cat.id}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'category', projectId: proj.id, categoryId: cat.id },
  })

  const active = catTasks.filter(t => !t.done).length

  return (
    <div className="mb-2">
      <div className="flex items-center gap-[5px] py-1 px-[2px] text-[11px] text-[rgba(55,53,47,.4)] font-medium">
        <div className="w-[6px] h-[6px] rounded-full flex-none" style={{ background: cat.color }} />
        <span className="text-[11px] font-semibold text-[rgba(55,53,47,.4)] whitespace-nowrap">{cat.name}</span>
        <div className="flex-1 h-[1px] bg-[rgba(55,53,47,.1)] mx-1" />
        <span className="text-[11px] text-[rgba(55,53,47,.4)] whitespace-nowrap">{active}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-1 transition-all rounded ${
          isOver
            ? 'outline-dashed outline-2 outline-[#2383e2] outline-offset-1 bg-[rgba(35,131,226,.04)] min-h-[40px]'
            : isDraggingTask
              ? 'min-h-[32px] border border-dashed border-[rgba(55,53,47,.12)] bg-[rgba(55,53,47,.015)]'
              : 'min-h-[4px]'
        }`}
      >
        <SortableContext items={catTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {catTasks.map(t => (
            <TaskCard key={t.id} task={t} />
          ))}
        </SortableContext>
        {isDraggingTask && catTasks.length === 0 && !isOver && (
          <div className="flex items-center justify-center py-2 text-[10px] text-[rgba(55,53,47,.25)]">
            여기에 놓기
          </div>
        )}
      </div>
      <button
        onClick={() => openModal({ projectId: proj.id, categoryId: cat.id })}
        className="flex items-center gap-[5px] py-[6px] px-1 rounded w-full text-left border-none bg-transparent cursor-pointer text-[13px] font-normal hover:bg-[rgba(55,53,47,.05)] transition-colors"
        style={{ color: nc.pillText }}
      >
        + 추가
      </button>
    </div>
  )
}
