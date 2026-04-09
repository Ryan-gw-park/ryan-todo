import { useMemo } from 'react'
import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getColor } from '../../../../utils/colors'
import { DAY_LABELS, fmtDate } from '../constants'
import { getSpanTasksForDay } from '../../../../utils/weeklySpan'
import DroppableCell from '../shared/DroppableCell'
import CellContent from '../cells/CellContent'
import { SpanBar } from '../cells/TaskRow'

/* ═══════════════════════════════════════════════════════
   Personal Weekly — 행=프로젝트, 열=요일
   ═══════════════════════════════════════════════════════ */
export default function PersonalWeeklyGrid({ projects, myTasks, weekDays, weekDateStrs, todayStr, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId }) {
  const milestones = useStore(s => s.milestones)
  // 이번 주에 할일이 있는 프로젝트만
  const weekTasks = useMemo(() =>
    myTasks.filter(t => {
      if (t.done) return false
      const wStart = weekDateStrs[0], wEnd = weekDateStrs[weekDateStrs.length - 1]
      if (t.startDate && t.dueDate) return t.startDate <= wEnd && t.dueDate >= wStart
      if (t.startDate && !t.dueDate && weekDateStrs.includes(t.startDate)) return true
      if (t.dueDate && weekDateStrs.includes(t.dueDate)) return true
      if (!t.dueDate && !t.startDate && t.category === 'today' && weekDateStrs.includes(todayStr)) return true
      return false
    }),
    [myTasks, weekDateStrs, todayStr]
  )

  const projectsWithTasks = useMemo(() => {
    const ids = new Set(weekTasks.map(t => t.projectId))
    return projects.filter(p => ids.has(p.id))
  }, [projects, weekTasks])

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Grid container */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(5, 1fr)' }}>
        <div style={{ padding: '8px 10px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface }}>프로젝트</div>
        {weekDays.map((d, i) => {
          const ds = fmtDate(d)
          const isToday = ds === todayStr
          return (
            <div key={i} style={{
              padding: '8px 8px', fontSize: FONT.caption, fontWeight: isToday ? 700 : 500,
              color: isToday ? '#E53E3E' : COLOR.textTertiary, textAlign: 'center',
              borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
              background: isToday ? 'rgba(229,62,62,0.04)' : COLOR.bgSurface,
            }}>
              {DAY_LABELS[i]} {d.getMonth() + 1}/{d.getDate()}
              {isToday && <span style={{ fontSize: FONT.ganttMs, marginLeft: 3 }}>오늘</span>}
            </div>
          )
        })}
        {projectsWithTasks.map(proj => {
          const c = getColor(proj.color)
          return [
            <div key={`p-${proj.id}`} style={{ padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 5, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: c.dot, flexShrink: 0, marginTop: 3 }} />
              <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, whiteSpace: 'normal', wordBreak: 'break-word' }}>{proj.name}</span>
            </div>,
            ...weekDays.map((d, di) => {
              const ds = fmtDate(d)
              const isToday = ds === todayStr
              const spanItems = getSpanTasksForDay(weekTasks, ds, weekDateStrs, todayStr, t => t.projectId === proj.id)
              const normalTasks = spanItems.filter(s => s.spanPosition === 'single' || s.spanPosition === 'start').map(s => ({ ...s.task, _spanPosition: s.spanPosition }))
              const spanBars = spanItems.filter(s => s.spanPosition === 'middle' || s.spanPosition === 'end')
              const dropId = `pw:${proj.id}:${ds}`
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{
                    padding: '5px 6px', minHeight: 40,
                    background: isToday ? 'rgba(229,62,62,0.02)' : 'transparent',
                  }}>
                    {spanBars.map(s => <SpanBar key={`${s.task.id}:${ds}`} task={s.task} project={proj} spanPosition={s.spanPosition} />)}
                    <CellContent tasks={normalTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                    {spanItems.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
                  </div>
                </DroppableCell>
              )
            })
          ]
        })}
      </div>

      {projectsWithTasks.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>이번 주 예정된 할일이 없습니다</div>
      )}
    </div>
  )
}
