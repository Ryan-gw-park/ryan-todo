import { useEffect, useRef } from 'react'
import useStore from '../../store/useStore'
import { getProjectColorMap } from '../../lib/colors'
import Checkbox from '../shared/Checkbox'

const DW = 26

function toD(s) { if (!s) return null; const d = new Date(s); d.setHours(0,0,0,0); return d }
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6 }

export default function GanttView() {
  const { projects, tasks, toggleDone, openDetail } = useStore()
  const colorMap = getProjectColorMap(projects)
  const scrollRef = useRef()

  const TODAY = new Date(); TODAY.setHours(0,0,0,0)
  const TODAYSTR = TODAY.toISOString().slice(0, 10)

  const hasDates = tasks.filter(t => t.startDate || t.dueDate)

  useEffect(() => {
    if (scrollRef.current && hasDates.length) {
      const todayX = xi(TODAYSTR) * DW + DW / 2
      scrollRef.current.scrollLeft = Math.max(0, todayX - scrollRef.current.clientWidth / 3)
    }
  }, [hasDates.length])

  if (!hasDates.length) {
    return (
      <div className="pt-10 px-6 md:px-12">
        <div className="p-12 text-center text-[rgba(55,53,47,.4)] text-[13px] leading-[2.2]">
          <div className="text-[26px] mb-1">📅</div>
          시작일 또는 마감일을 설정하면 표시됩니다
        </div>
      </div>
    )
  }

  const vals = []
  hasDates.forEach(t => {
    if (t.startDate) vals.push(toD(t.startDate).getTime())
    if (t.dueDate) vals.push(toD(t.dueDate).getTime())
  })
  vals.push(TODAY.getTime())

  const mn = new Date(Math.min(...vals)); mn.setDate(mn.getDate() - 3)
  const mx = new Date(Math.max(...vals)); mx.setDate(mx.getDate() + 7)

  const days = []
  for (let d = new Date(mn); d <= mx; d.setDate(d.getDate() + 1)) days.push(new Date(d))
  const TW = days.length * DW

  function xi(s) { const d = toD(s); return Math.round((d.getTime() - mn.getTime()) / 86400000) }
  const todayX = xi(TODAYSTR) * DW + DW / 2

  // Months
  const months = []
  days.forEach(d => {
    const lbl = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    const last = months[months.length - 1]
    if (!last || last.lbl !== lbl) months.push({ lbl, cnt: 1 })
    else last.cnt++
  })

  return (
    <div className="pt-10 px-6 md:px-12">
      <div ref={scrollRef} className="rounded-lg border border-[rgba(55,53,47,.09)] bg-white overflow-auto max-h-[calc(100vh-130px)] shadow-[rgba(15,15,15,.05)_0_1px_2px,rgba(15,15,15,.05)_0_0_0_1px]">
        <div style={{ minWidth: 'max-content' }}>
          {/* Header */}
          <div className="flex sticky top-0 z-10 bg-white border-b border-[rgba(55,53,47,.09)]">
            <div className="flex-none w-[200px] min-w-[200px] sticky left-0 z-[11] bg-[#f7f6f3] border-r border-[rgba(55,53,47,.09)] flex flex-col">
              <div className="h-[26px] px-[13px] flex items-center text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider border-b border-[rgba(55,53,47,.09)]">할 일</div>
              <div className="h-6" />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: TW }}>
              <div className="flex h-[26px] border-b border-[rgba(55,53,47,.09)]">
                {months.map((m, i) => (
                  <div key={i} className="flex items-center px-[9px] border-r border-[rgba(55,53,47,.09)] text-[11px] font-semibold text-[rgba(55,53,47,.65)] whitespace-nowrap overflow-hidden flex-shrink-0" style={{ minWidth: m.cnt * DW, flex: `0 0 ${m.cnt * DW}px` }}>{m.lbl}</div>
                ))}
              </div>
              <div className="flex h-6">
                {days.map((d, i) => {
                  const wk = isWeekend(d)
                  const sat = d.getDay() === 6
                  const sun = d.getDay() === 0
                  const isT = d.getTime() === TODAY.getTime()
                  return (
                    <div key={i} className={`flex-none flex items-center justify-center text-[10px] border-r border-[rgba(55,53,47,.09)] ${wk ? 'bg-[rgba(55,53,47,.025)]' : ''} ${sat ? 'text-blue-500' : sun ? 'text-red-500' : 'text-[rgba(55,53,47,.4)]'} ${isT ? 'text-red-600 font-bold' : ''}`} style={{ width: DW }}>
                      {isT ? (
                        <div className="w-[17px] h-[17px] rounded-full bg-red-500 text-white flex items-center justify-center text-[9px] font-bold">{d.getDate()}</div>
                      ) : d.getDate()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="flex">
            <div>
              {projects.map(proj => {
                const pt = tasks.filter(t => t.projectId === proj.id)
                if (!pt.length) return null
                const nc = colorMap[proj.id]
                return (
                  <div key={proj.id}>
                    <div className="flex border-b border-[rgba(55,53,47,.09)] min-h-[30px] items-stretch">
                      <div className="flex-none w-[200px] min-w-[200px] sticky left-0 z-[3] border-r border-[rgba(55,53,47,.09)] flex items-center gap-[6px] px-[13px]" style={{ background: `${nc.dot}18` }}>
                        <div className="w-[7px] h-[7px] rounded-sm flex-none" style={{ background: nc.dot }} />
                        <span className="text-xs font-bold">{proj.name}</span>
                      </div>
                    </div>
                    {pt.map(t => (
                      <div key={t.id} className="flex border-b border-[rgba(55,53,47,.09)] min-h-[34px] items-stretch">
                        <div className="flex-none w-[200px] min-w-[200px] sticky left-0 z-[3] bg-white border-r border-[rgba(55,53,47,.09)] flex items-center gap-[7px] px-[13px]">
                          <Checkbox checked={t.done} onChange={() => toggleDone(t.id)} size={13} />
                          <span className="text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer hover:text-[#2383e2]" onClick={() => openDetail(t.id)}>{t.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            <div>
              {projects.map(proj => {
                const pt = tasks.filter(t => t.projectId === proj.id)
                if (!pt.length) return null
                const nc = colorMap[proj.id]
                const gridLines = days.map((d, i) => (
                  <div key={i} className={`absolute top-0 bottom-0 border-r border-[rgba(55,53,47,.09)] ${isWeekend(d) ? 'bg-[rgba(55,53,47,.02)]' : ''}`} style={{ left: i * DW, width: DW }} />
                ))
                const todayLine = <div className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 opacity-45 z-[2] pointer-events-none" style={{ left: todayX }} />
                return (
                  <div key={proj.id}>
                    <div className="border-b border-[rgba(55,53,47,.09)] min-h-[30px] relative" style={{ width: TW, background: `${nc.dot}07` }}>
                      {gridLines}{todayLine}
                    </div>
                    {pt.map(t => {
                      let bar = null
                      if (t.startDate || t.dueDate) {
                        const s = t.startDate || t.dueDate
                        const e = t.dueDate || t.startDate
                        const si = xi(s)
                        const ei = xi(e)
                        const bL = si * DW
                        const bW = Math.max((ei - si + 1) * DW, DW)
                        bar = (
                          <div
                            className="absolute top-[5px] h-[21px] rounded-[3px] flex items-center px-[7px] text-[10px] font-medium cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap z-[1] hover:opacity-80 text-white"
                            style={{ left: bL, width: bW, background: nc.dot, opacity: t.done ? 0.35 : 1 }}
                            onClick={() => openDetail(t.id)}
                          >
                            {t.text}
                          </div>
                        )
                      }
                      return (
                        <div key={t.id} className="border-b border-[rgba(55,53,47,.09)] min-h-[34px] relative" style={{ width: TW }}>
                          {gridLines}{todayLine}{bar}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
