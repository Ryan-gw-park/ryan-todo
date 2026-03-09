import { useState, useRef, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, pointerWithin, rectIntersection,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import useStore from '../../store/useStore'
import { getProjectColorMap } from '../../lib/colors'
import MatrixColumn from '../matrix/MatrixColumn'

// Custom collision detection: prioritize droppable category zones, then fallback
function customCollision(args) {
  // First try pointerWithin — works well for droppable areas
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) {
    // Prioritize 'category' droppable zones over 'task' sortable items
    const categoryHit = pointerCollisions.find(
      c => c.data?.droppableContainer?.data?.current?.type === 'category'
    )
    if (categoryHit) return [categoryHit]
    return pointerCollisions
  }
  // Fallback to rect intersection
  return rectIntersection(args)
}

export default function MatrixView() {
  const { projects, tasks, reorderProjects, moveTask, addProject } = useStore()
  const colorMap = getProjectColorMap(projects)
  const [activeItem, setActiveItem] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragStart = useCallback((event) => {
    const { active } = event
    if (active.data.current?.type === 'column') {
      setActiveItem({ type: 'column', id: active.id })
    } else if (active.data.current?.type === 'task') {
      setActiveItem({ type: 'task', task: active.data.current.task })
    }
  }, [])

  const handleDragEnd = useCallback((event) => {
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
      const activeTask = tasks.find(t => t.id === active.id)
      const overData = over.data.current
      if (overData?.type === 'category') {
        // Dropped on a category droppable zone
        const isSameSpot = activeTask &&
          activeTask.projectId === overData.projectId &&
          activeTask.categoryId === overData.categoryId
        if (!isSameSpot) {
          moveTask(active.id, overData.projectId, overData.categoryId)
        }
      } else if (overData?.type === 'task') {
        // Dropped on another task — move to that task's location
        const overTask = tasks.find(t => t.id === over.id)
        if (overTask && activeTask) {
          const isSameSpot = activeTask.projectId === overTask.projectId &&
            activeTask.categoryId === overTask.categoryId
          if (!isSameSpot) {
            moveTask(active.id, overTask.projectId, overTask.categoryId)
          }
        }
      }
    }
  }, [projects, tasks, reorderProjects, moveTask])

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

  const isDraggingTask = activeItem?.type === 'task'

  return (
    <div className="pt-10 px-6 md:px-12">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={projects.map(p => p.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start" style={{ WebkitOverflowScrolling: 'touch' }}>
            {projects.map(proj => (
              <MatrixColumn key={proj.id} proj={proj} nc={colorMap[proj.id]} isDraggingTask={isDraggingTask} />
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
