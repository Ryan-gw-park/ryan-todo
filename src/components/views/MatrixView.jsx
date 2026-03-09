import { useState, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../store/useStore'
import MatrixColumn from '../matrix/MatrixColumn'
import TaskCard from '../matrix/TaskCard'

export default function MatrixView() {
  const { projects, tasks, reorderProjects, moveTask, addProject } = useStore()
  const [activeItem, setActiveItem] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragStart = (event) => {
    const { active } = event
    if (active.data.current?.type === 'column') {
      setActiveItem({ type: 'column', id: active.id })
    } else if (active.data.current?.type === 'task') {
      setActiveItem({ type: 'task', task: active.data.current.task })
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveItem(null)
    if (!over) return

    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      const oldIdx = projects.findIndex(p => p.id === active.id)
      const newIdx = projects.findIndex(p => p.id === over.id)
      if (oldIdx !== newIdx) {
        const newOrder = arrayMove(projects.map(p => p.id), oldIdx, newIdx)
        reorderProjects(newOrder)
      }
    } else if (active.data.current?.type === 'task') {
      const overData = over.data.current
      if (overData?.type === 'category') {
        moveTask(active.id, overData.projectId, overData.categoryId)
      } else if (overData?.type === 'task') {
        const overTask = tasks.find(t => t.id === over.id)
        if (overTask) {
          moveTask(active.id, overTask.projectId, overTask.categoryId)
        }
      }
    }
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over || active.data.current?.type !== 'task') return
    // Allow task to move between categories via droppable zones
  }

  // Add project inline
  const [addingProj, setAddingProj] = useState(false)
  const addProjRef = useRef()
  const startAddProj = () => {
    setAddingProj(true)
    setTimeout(() => addProjRef.current?.focus(), 50)
  }
  const saveNewProj = () => {
    const name = addProjRef.current?.value.trim()
    if (name) addProject(name)
    setAddingProj(false)
  }

  return (
    <div className="p-3 md:p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={projects.map(p => p.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 overflow-x-auto pb-4 items-start" style={{ WebkitOverflowScrolling: 'touch' }}>
            {projects.map(proj => (
              <MatrixColumn key={proj.id} proj={proj} />
            ))}

            {addingProj ? (
              <div className="flex-none self-start">
                <input
                  ref={addProjRef}
                  className="border-none border-b-[1.5px] border-b-[#2383e2] bg-transparent text-[13px] font-semibold text-[rgb(55,53,47)] py-[1px] px-[3px] outline-none min-w-[110px]"
                  placeholder="프로젝트명"
                  onBlur={saveNewProj}
                  onKeyDown={e => { if (e.key === 'Enter') addProjRef.current?.blur(); if (e.key === 'Escape') setAddingProj(false) }}
                />
              </div>
            ) : (
              <button
                onClick={startAddProj}
                className="flex-none flex items-center gap-[6px] px-3.5 py-[9px] bg-transparent border-[1.5px] border-dashed border-[rgba(55,53,47,.15)] rounded-md h-10 self-start cursor-pointer text-[rgba(55,53,47,.4)] text-[13px] font-normal whitespace-nowrap hover:bg-[rgba(55,53,47,.04)] hover:border-[rgba(55,53,47,.25)] hover:text-[rgba(55,53,47,.65)] transition-all"
              >
                + 프로젝트 추가
              </button>
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem?.type === 'task' && activeItem.task && (
            <div className="bg-white border border-[rgba(55,53,47,.16)] rounded px-[11px] py-[7px] text-xs shadow-[rgba(15,15,15,.1)_0_4px_16px] max-w-[170px] whitespace-nowrap overflow-hidden text-ellipsis opacity-90 rotate-2">
              {activeItem.task.text}
            </div>
          )}
          {activeItem?.type === 'column' && (
            <div className="bg-white border border-[rgba(55,53,47,.16)] rounded px-[11px] py-[7px] text-xs shadow-[rgba(15,15,15,.1)_0_4px_16px] max-w-[170px] whitespace-nowrap overflow-hidden text-ellipsis opacity-90 rotate-2">
              {projects.find(p => p.id === activeItem.id)?.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
