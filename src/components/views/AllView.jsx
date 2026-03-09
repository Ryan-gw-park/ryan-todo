import { useState } from 'react'
import useStore from '../../store/useStore'
import { getProjectColorMap } from '../../lib/colors'
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

export default function AllView() {
  const { projects, categories, tasks, toggleDone, openDetail, openModal, reorderProjects } = useStore()
  const colorMap = getProjectColorMap(projects)

  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [dropPos, setDropPos] = useState(null)

  const handleDragStart = (e, projId) => { setDragId(projId); e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e, projId) => {
    e.preventDefault()
    if (dragId === projId) return
    const rect = e.currentTarget.getBoundingClientRect()
    setOverId(projId)
    setDropPos(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below')
  }
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setOverId(null); setDropPos(null) } }
  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) return
    const ids = projects.map(p => p.id)
    const srcIdx = ids.indexOf(dragId)
    const tgtIdx = ids.indexOf(targetId)
    ids.splice(srcIdx, 1)
    const insertAt = dropPos === 'above' ? (srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx) : (srcIdx < tgtIdx ? tgtIdx : tgtIdx + 1)
    ids.splice(Math.max(0, insertAt), 0, dragId)
    reorderProjects(ids)
    setDragId(null); setOverId(null); setDropPos(null)
  }
  const handleDragEnd = () => { setDragId(null); setOverId(null); setDropPos(null) }

  if (!projects.length) {
    return (
      <div className="pt-10 px-6 md:px-12">
        <div className="p-12 text-center text-[rgba(55,53,47,.4)] text-[13px] leading-[2.2]">
          <div className="text-[26px] mb-1">📋</div>프로젝트를 추가해주세요
        </div>
      </div>
    )
  }

  return (
    <div className="pt-10 px-6 md:px-12">
      <div className="flex flex-col gap-2 max-w-[760px]">
        {projects.map(proj => {
          const projTasks = tasks.filter(t => t.projectId === proj.id)
          const active = projTasks.filter(t => !t.done).length
          const nc = colorMap[proj.id]

          return (
            <div
              key={proj.id}
              className={`bg-white rounded-md border border-[rgba(55,53,47,.09)] overflow-visible transition-colors hover:border-[rgba(55,53,47,.16)] ${dragId === proj.id ? 'opacity-30' : ''} ${overId === proj.id && dropPos === 'above' ? 'border-t-2 border-t-[#2383e2]' : ''} ${overId === proj.id && dropPos === 'below' ? 'border-b-2 border-b-[#2383e2]' : ''}`}
              draggable
              onDragStart={e => handleDragStart(e, proj.id)}
              onDragEnd={handleDragEnd}
              onDragOver={e => handleDragOver(e, proj.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, proj.id)}
            >
              <div className="flex items-center gap-[9px] px-3.5 py-[10px] border-b border-[rgba(55,53,47,.09)] cursor-default rounded-t-md">
                <div className="w-[3px] h-8 rounded-sm flex-none opacity-80" style={{ background: nc.dot }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">{proj.name}</div>
                  <div className="text-[11px] text-[rgba(55,53,47,.4)] mt-[1px]">전체 {projTasks.length}개 · {active}개 진행 중</div>
                </div>
                <div className="flex flex-col gap-[2.5px] cursor-grab p-[5px] rounded opacity-0 hover:opacity-100 transition-opacity">
                  <div className="w-[10px] h-[1.5px] bg-[rgba(55,53,47,.65)] rounded-sm" />
                  <div className="w-[10px] h-[1.5px] bg-[rgba(55,53,47,.65)] rounded-sm" />
                  <div className="w-[10px] h-[1.5px] bg-[rgba(55,53,47,.65)] rounded-sm" />
                </div>
                <button onClick={() => openModal({ projectId: proj.id })} className="px-[9px] py-1 text-[11px] border border-[rgba(55,53,47,.16)] rounded bg-transparent cursor-pointer text-[rgba(55,53,47,.65)] hover:bg-[rgba(55,53,47,.04)]">+ 추가</button>
              </div>
              <div>
                {!projTasks.length ? (
                  <div className="py-3 px-3.5 text-xs text-[rgba(55,53,47,.4)]">할 일이 없습니다</div>
                ) : categories.map(cat => {
                  const catTasks = projTasks.filter(t => t.categoryId === cat.id)
                  if (!catTasks.length) return null
                  const catActive = catTasks.filter(t => !t.done).length
                  return (
                    <div key={cat.id} className="border-b border-[rgba(55,53,47,.09)] last:border-b-0">
                      <div className="flex items-center gap-[7px] px-3.5 py-2 pt-[6px]">
                        <div className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: cat.color }} />
                        <span className="text-xs font-semibold text-[rgba(55,53,47,.65)]">{cat.name}</span>
                        <span className="text-[11px] text-[rgba(55,53,47,.4)] ml-auto">{catActive}/{catTasks.length}</span>
                      </div>
                      <div className="px-2 pb-[6px]">
                        {catTasks.map(t => (
                          <div
                            key={t.id}
                            className={`flex items-center gap-[9px] py-2 px-[6px] rounded cursor-pointer transition-colors hover:bg-[rgba(55,53,47,.04)] ${t.done ? 'opacity-40' : ''}`}
                            onClick={() => openDetail(t.id)}
                          >
                            <Checkbox checked={t.done} onChange={() => toggleDone(t.id)} size={15} />
                            <span className={`text-[13px] flex-1 min-w-0 break-all leading-snug ${t.done ? 'line-through' : ''}`}>{t.text}</span>
                            {t.dueDate && <span className={`text-[11px] whitespace-nowrap ${isOverdue(t.dueDate) ? 'text-red-600' : 'text-[rgba(55,53,47,.4)]'}`}>📅 {fmt(t.dueDate)}</span>}
                            <span className="text-[rgba(55,53,47,.4)] text-[13px] flex-none opacity-50">›</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
