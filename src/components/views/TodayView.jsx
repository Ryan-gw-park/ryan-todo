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

function findTodayCat(categories) {
  // 1) "오늘"이 포함된 카테고리 (오늘 끝내기, 오늘할일 등)
  const byName = categories.find(c =>
    c.name.includes('오늘') || c.name.toLowerCase().includes('today')
  )
  if (byName) return byName
  // 2) fallback: 첫 번째 카테고리
  return categories[0] || null
}

export default function TodayView() {
  const { projects, categories, tasks, toggleDone, openDetail, openModal } = useStore()
  const colorMap = getProjectColorMap(projects)

  const todayCat = findTodayCat(categories)

  const now = new Date()
  const dayNames = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일']
  const greeting = now.getHours() < 12 ? '좋은 아침이에요 ☀️' : now.getHours() < 18 ? '안녕하세요 👋' : '수고 많았어요 🌙'

  // DnD state for project card reorder
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [dropPos, setDropPos] = useState(null)
  const reorderProjects = useStore(s => s.reorderProjects)

  const handleDragStart = (e, projId) => {
    setDragId(projId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, projId) => {
    e.preventDefault()
    if (dragId === projId) return
    const rect = e.currentTarget.getBoundingClientRect()
    setOverId(projId)
    setDropPos(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below')
  }
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) { setOverId(null); setDropPos(null) }
  }
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
        <div className="py-1 px-0.5 pb-3">
          <div className="text-xl font-bold tracking-tight">{greeting}</div>
          <div className="text-xs text-[rgba(55,53,47,.4)] mt-[3px]">{now.getMonth()+1}월 {now.getDate()}일 {dayNames[now.getDay()]}</div>
        </div>
        <div className="p-12 text-center text-[rgba(55,53,47,.4)] leading-[2.2] text-[13px]">
          <div className="text-[26px] mb-1">📋</div>
          프로젝트와 구분을 추가하면<br/>오늘 할 일 목록이 여기 표시됩니다
        </div>
      </div>
    )
  }

  return (
    <div className="pt-10 px-6 md:px-12">
      <div className="py-1 px-0.5 pb-4">
        <div className="text-xl font-bold tracking-tight">{greeting}</div>
        <div className="text-xs text-[rgba(55,53,47,.4)] mt-[3px]">{now.getMonth()+1}월 {now.getDate()}일 {dayNames[now.getDay()]}</div>
      </div>
      <div className="flex flex-col gap-3 max-w-[760px]">
        {projects.map(proj => {
          const nc = colorMap[proj.id]
          const projTasks = tasks.filter(t => t.projectId === proj.id)
          // todayCat 기반 분류 — todayCat 없으면 전체를 today로 표시
          const todayTasks = todayCat
            ? projTasks.filter(t => t.categoryId === todayCat.id)
            : projTasks
          const remTasks = todayCat
            ? projTasks.filter(t => t.categoryId !== todayCat.id)
            : []
          const active = todayTasks.filter(t => !t.done).length
          const done = todayTasks.filter(t => t.done).length
          const defaultCatId = todayCat?.id || categories[0]?.id || ''

          return (
            <div
              key={proj.id}
              className={`rounded-lg border border-[rgba(55,53,47,.09)] overflow-visible transition-colors hover:border-[rgba(55,53,47,.16)] ${dragId === proj.id ? 'opacity-30' : ''} ${overId === proj.id && dropPos === 'above' ? 'border-t-2 border-t-[#2383e2]' : ''} ${overId === proj.id && dropPos === 'below' ? 'border-b-2 border-b-[#2383e2]' : ''}`}
              style={{ background: nc.colBg }}
              draggable
              onDragStart={e => handleDragStart(e, proj.id)}
              onDragEnd={handleDragEnd}
              onDragOver={e => handleDragOver(e, proj.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, proj.id)}
            >
              <div className="flex items-center gap-[9px] px-4 py-3 border-b border-[rgba(55,53,47,.09)] cursor-default rounded-t-lg">
                <div className="w-[3px] h-8 rounded-sm flex-none opacity-80" style={{ background: nc.dot }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: nc.pillText }}>{proj.name}</div>
                  <div className="text-[11px] text-[rgba(55,53,47,.4)] mt-[1px]">{active}개 남음{done ? ` · ${done}개 완료` : ''}</div>
                </div>
                <div className="flex flex-col gap-[2.5px] cursor-grab p-[5px] rounded opacity-0 hover:opacity-50 hover:bg-[rgba(55,53,47,.08)] transition-opacity">
                  <div className="w-[10px] h-[1.5px] bg-[rgba(55,53,47,.65)] rounded-sm" />
                  <div className="w-[10px] h-[1.5px] bg-[rgba(55,53,47,.65)] rounded-sm" />
                  <div className="w-[10px] h-[1.5px] bg-[rgba(55,53,47,.65)] rounded-sm" />
                </div>
                <button onClick={() => openModal({ projectId: proj.id, categoryId: defaultCatId })} className="px-[9px] py-1 text-[11px] border border-[rgba(55,53,47,.16)] rounded bg-transparent cursor-pointer text-[rgba(55,53,47,.65)] hover:bg-[rgba(55,53,47,.04)]">+ 추가</button>
              </div>
              <div className="p-3">
                {todayTasks.length ? todayTasks.map(t => (
                  <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t.id)} onOpen={() => openDetail(t.id)} />
                )) : (
                  <button onClick={() => openModal({ projectId: proj.id, categoryId: defaultCatId })} className="flex items-center gap-[7px] py-2 px-2 rounded w-full text-left border-none bg-transparent cursor-pointer text-[rgba(55,53,47,.4)] text-[13px] hover:bg-[rgba(55,53,47,.04)]">
                    <div className="w-4 h-4 flex items-center justify-center flex-none rounded-[3px] border-[1.5px] border-dashed border-[rgba(55,53,47,.16)] text-[14px]">+</div>
                    오늘 할 일 추가하기
                  </button>
                )}
                {remTasks.length > 0 && <RemainingSection tasks={remTasks} projId={proj.id} toggleDone={toggleDone} openDetail={openDetail} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onOpen, subdued = false }) {
  return (
    <div className={`flex items-center gap-[10px] py-[9px] px-2 rounded cursor-pointer transition-colors hover:bg-[rgba(55,53,47,.04)] ${task.done ? 'opacity-40' : ''}`} onClick={onOpen}>
      <Checkbox checked={task.done} onChange={onToggle} size={16} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-snug break-all ${task.done ? 'line-through' : ''} ${subdued ? 'text-[13px] text-[rgba(55,53,47,.65)]' : ''}`}>{task.text}</div>
        {task.dueDate && <div className={`text-[11px] mt-0.5 ${isOverdue(task.dueDate) ? 'text-red-600' : 'text-[rgba(55,53,47,.4)]'}`}>📅 {fmt(task.dueDate)}</div>}
      </div>
      <span className="text-[rgba(55,53,47,.4)] text-sm flex-none opacity-50">›</span>
    </div>
  )
}

function RemainingSection({ tasks, projId, toggleDone, openDetail }) {
  const [open, setOpen] = useState(false)
  const active = tasks.filter(t => !t.done).length

  return (
    <>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-[6px] py-[7px] px-2 pt-[5px] cursor-pointer border-none bg-transparent w-full text-left">
        <span className="text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider flex-1">남은 작업</span>
        <span className="text-[10px] text-[rgba(55,53,47,.4)] bg-[#f7f6f3] px-[6px] py-[2px] rounded-full">{active}</span>
        <span className={`text-[10px] text-[rgba(55,53,47,.4)] transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && tasks.map(t => (
        <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t.id)} onOpen={() => openDetail(t.id)} subdued />
      ))}
    </>
  )
}
