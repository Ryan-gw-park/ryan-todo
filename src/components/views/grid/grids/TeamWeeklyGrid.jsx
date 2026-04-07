import { useMemo } from 'react'
import { COLOR, FONT } from '../../../../styles/designTokens'
import { DAY_LABELS, fmtDate } from '../constants'
import DroppableCell from '../shared/DroppableCell'
import MiniAvatar from '../shared/MiniAvatar'
import CellContent from '../cells/CellContent'

/* ═══════════════════════════════════════════════════════
   Team Weekly — 행=팀원, 열=요일
   ═══════════════════════════════════════════════════════ */
export default function TeamWeeklyGrid({ projects, tasks, members, weekDays, weekDateStrs, todayStr, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, activeId, currentTeamId }) {
  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }

  const projectMap = useMemo(() => {
    const m = {}; projects.forEach(p => { m[p.id] = p }); return m
  }, [projects])

  return (
    <div style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Grid container */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(5, 1fr)' }}>
        <div style={{ padding: '8px 10px', fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: COLOR.bgSurface }}>팀원</div>
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
        {members.map(mem => [
          <div key={`m-${mem.id}`} style={{ padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 8, borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
            <MiniAvatar name={mem.displayName || mem.name} size={24} />
            <span style={{ fontSize: FONT.body, fontWeight: 600, color: COLOR.textPrimary }}>{mem.displayName || mem.name}</span>
          </div>,
          ...weekDays.map((d, di) => {
            const ds = fmtDate(d)
            const isToday = ds === todayStr
            const dayTasks = tasks.filter(t => {
              if (t.done || t.assigneeId !== mem.userId || t.teamId !== currentTeamId) return false
              if (t.dueDate === ds) return true
              if (!t.dueDate && t.category === 'today' && ds === todayStr) return true
              return false
            }).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            const dropId = `tw:${mem.userId}:${ds}`
            return (
              <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                <div style={{
                  padding: '5px 6px', minHeight: 48,
                  background: isToday ? 'rgba(229,62,62,0.02)' : 'transparent',
                }}>
                  <CellContent tasks={dayTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject projectMap={projectMap} />
                  {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
                </div>
              </DroppableCell>
            )
          })
        ])}
      </div>
    </div>
  )
}
