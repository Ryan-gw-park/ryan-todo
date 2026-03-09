import { useState } from 'react'
import useStore from '../../store/useStore'
import { getColor } from '../../lib/colors'
import Checkbox from '../shared/Checkbox'

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

export default function BoardView() {
  const { projects, categories, tasks, toggleDone, openDetail, openModal, moveTask } = useStore()

  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  const handleDragStart = (e, taskId) => {
    setDragId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }
  const handleDragOver = (e, projId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverCol(projId)
  }
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null)
  }
  const handleDrop = (e, projId) => {
    e.preventDefault()
    setOverCol(null)
    const taskId = dragId || e.dataTransfer.getData('text/plain')
    const t = tasks.find(x => x.id === taskId)
    if (!t || t.projectId === projId) return
    moveTask(taskId, projId, t.categoryId)
    setDragId(null)
  }

  return (
    <div className="p-3 md:p-4">
      <div className="flex gap-3 overflow-x-auto pb-4 items-start" style={{ WebkitOverflowScrolling: 'touch' }}>
        {projects.map(p => {
          const pt = tasks.filter(t => t.projectId === p.id)
          const ac = pt.filter(t => !t.done).length
          const nc = getColor(p.color)

          return (
            <div
              key={p.id}
              className={`flex-none w-64 rounded-md overflow-hidden ${overCol === p.id ? 'outline-dashed outline-2 outline-[#2383e2] -outline-offset-1' : ''}`}
              style={{ background: nc.colBg }}
              onDragOver={e => handleDragOver(e, p.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, p.id)}
            >
              <div className="px-3 pt-[10px] pb-2 flex items-center gap-[7px]">
                <span className="text-[13px] font-semibold px-[9px] py-[3px] rounded-md" style={{ background: nc.pillBg, color: nc.pillText }}>{p.name}</span>
                <span className="text-[13px] font-normal ml-1" style={{ color: nc.pillText }}>{ac}</span>
              </div>
              <div className="px-2 pb-2 flex flex-col gap-1 min-h-[8px]">
                {pt.map(t => {
                  const cat = categories.find(c => c.id === t.categoryId) || { name: '?', color: '#999', bg: 'rgba(0,0,0,.05)' }
                  return (
                    <div
                      key={t.id}
                      className={`bg-white rounded border border-[rgba(55,53,47,.09)] px-3 py-[10px] cursor-pointer flex flex-col gap-[6px] select-none hover:border-[rgba(55,53,47,.2)] hover:shadow-[rgba(15,15,15,.06)_0_1px_4px] transition-all ${t.done ? 'opacity-40' : ''} ${dragId === t.id ? 'opacity-20' : ''}`}
                      draggable
                      onDragStart={e => handleDragStart(e, t.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => openDetail(t.id)}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox checked={t.done} onChange={() => toggleDone(t.id)} size={13} />
                        <span className="text-sm font-normal leading-snug flex-1 break-all">{t.text}</span>
                      </div>
                      <div className="flex items-center gap-[6px] flex-wrap">
                        <span className="inline-flex items-center px-[7px] py-[2px] rounded-[3px] text-[11px] font-medium whitespace-nowrap" style={{ background: cat.bg || `${cat.color}10`, color: cat.color }}>{cat.name}</span>
                        {t.dueDate && <span className={`text-[11px] ${isOverdue(t.dueDate) ? 'text-red-600' : 'text-[rgba(55,53,47,.4)]'}`}>📅 {fmt(t.dueDate)}</span>}
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={() => openModal({ projectId: p.id })}
                  className="w-full py-[6px] px-[5px] bg-transparent border-none rounded text-[13px] font-normal cursor-pointer text-left flex items-center gap-[5px] mt-[2px] hover:bg-[rgba(55,53,47,.05)] transition-colors"
                  style={{ color: nc.pillText }}
                >
                  + 추가
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
