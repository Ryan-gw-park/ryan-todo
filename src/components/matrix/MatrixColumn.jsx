import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getColor } from '../../lib/colors'
import CategorySection from './CategorySection'
import useStore from '../../store/useStore'
import { useState, useRef } from 'react'

export default function MatrixColumn({ proj }) {
  const { categories, tasks, updateProject, deleteProject } = useStore()
  const nc = getColor(proj.color)
  const projTasks = tasks.filter(t => t.projectId === proj.id)
  const active = projTasks.filter(t => !t.done).length

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: proj.id,
    data: { type: 'column' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: nc.colBg,
    opacity: isDragging ? 0.35 : 1,
  }

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const inputRef = useRef()

  const startEdit = () => {
    setEditName(proj.name)
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
  }
  const saveEdit = () => {
    const n = editName.trim()
    if (n && n !== proj.name) updateProject(proj.id, { name: n })
    setEditing(false)
  }

  const handleDeleteProj = () => {
    const cnt = projTasks.length
    if (cnt > 0 && !confirm(`프로젝트 내 할 일 ${cnt}개도 삭제됩니다. 계속할까요?`)) return
    deleteProject(proj.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-none w-64 rounded-md flex flex-col max-h-[calc(100vh-100px)] overflow-hidden"
    >
      <div
        className="px-3 pt-3 pb-2 flex items-center gap-[7px] flex-none group"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        {...attributes}
        {...listeners}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="border-none border-b-[1.5px] border-b-[#2383e2] bg-transparent text-[13px] font-semibold text-[rgb(55,53,47)] py-[1px] px-[3px] outline-none min-w-[80px]"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => { if (e.key === 'Enter') inputRef.current?.blur(); if (e.key === 'Escape') setEditing(false) }}
          />
        ) : (
          <span
            className="text-[13px] font-semibold px-[9px] py-[3px] rounded-md cursor-pointer hover:opacity-85"
            style={{ background: nc.pillBg, color: nc.pillText }}
            onDoubleClick={startEdit}
          >
            {proj.name}
          </span>
        )}
        <span className="text-[13px] font-normal" style={{ color: nc.pillText, opacity: 0.65 }}>{active}</span>
        <div className="hidden group-hover:flex gap-[2px] ml-auto">
          <button onClick={handleDeleteProj} className="px-[5px] py-[2px] rounded border-none bg-transparent cursor-pointer text-[11px] text-[rgba(55,53,47,.65)] hover:bg-[rgba(224,62,62,.08)] hover:text-red-600">✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {categories.map(cat => {
          const catTasks = projTasks.filter(t => t.categoryId === cat.id)
          return <CategorySection key={cat.id} proj={proj} cat={cat} nc={nc} tasks={catTasks} />
        })}
      </div>
    </div>
  )
}
