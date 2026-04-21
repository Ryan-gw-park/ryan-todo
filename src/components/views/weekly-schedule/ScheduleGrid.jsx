import { useMemo } from 'react'
import { COLOR, PILL } from '../../../styles/designTokens'
import { getColorByIndex } from '../../../utils/colors'
import MiniAvatar from '../grid/shared/MiniAvatar'
import { toISODateString } from '../../../utils/weekDate'
import ScheduleCell from './ScheduleCell'

const DAY_LABELS = ['월', '화', '수', '목', '금']

/**
 * 멤버 × 요일(월~금) 그리드.
 * - sticky left 멤버 열 (160px)
 * - 오늘 열 헤더: PILL.amber 배경
 * - 주간 네비 툴바
 * - MS 라우팅: owner_id 있으면 해당 user 행, 없으면 첫 번째 멤버 행 (D21)
 */
export default function ScheduleGrid({
  members = [],
  weekDays = [],
  weekLabel = '',
  scheduledTasks = [],
  scheduledMilestones = [],
  projects = [],
  activeDrag,
  selectedProjectId,
  setSelectedProjectId,
  currentTeamId,
  addTask,
  onUnscheduleTask,
  onUnscheduleMS,
  goToPrevWeek,
  goToNextWeek,
  goToThisWeek,
}) {
  const todayISO = useMemo(() => toISODateString(new Date()), [])
  const weekDayISOs = useMemo(() => weekDays.map(toISODateString), [weekDays])

  const memberColorMap = useMemo(() => {
    const map = {}
    const sorted = [...members].sort((a, b) => (a.userId || '').localeCompare(b.userId || ''))
    sorted.forEach((m, i) => { map[m.userId] = getColorByIndex(i) })
    return map
  }, [members])

  // MS를 멤버 행에 라우팅 (D21): owner_id 있으면 해당, 없으면 첫 번째 멤버
  // ⚠ 조기 return은 모든 hook 뒤에 둬야 함 (React Rules of Hooks — #310 방지)
  const firstMemberUserId = members[0]?.userId
  const msByRow = useMemo(() => {
    const map = new Map() // userId → Map<dateISO, MS[]>
    for (const m of scheduledMilestones) {
      const targetUserId = m.owner_id || firstMemberUserId
      if (!targetUserId) continue
      if (!map.has(targetUserId)) map.set(targetUserId, new Map())
      const inner = map.get(targetUserId)
      const date = m.scheduled_date
      if (!inner.has(date)) inner.set(date, [])
      inner.get(date).push(m)
    }
    return map
  }, [scheduledMilestones, firstMemberUserId])

  const tasksByRow = useMemo(() => {
    const map = new Map() // userId → Map<dateISO, task[]>
    for (const t of scheduledTasks) {
      const u = t.assigneeId
      if (!u) continue
      if (!map.has(u)) map.set(u, new Map())
      const inner = map.get(u)
      const date = t.scheduledDate
      if (!inner.has(date)) inner.set(date, [])
      inner.get(date).push(t)
    }
    return map
  }, [scheduledTasks])

  // 팀 멤버 0명 빈 상태 (E2) — hooks 모두 호출 후 return
  if (members.length === 0) {
    return (
      <div style={{ flex: 1, padding: 32, color: COLOR.textSecondary, fontSize: 13 }}>
        팀 멤버가 없습니다. 먼저 팀 설정에서 멤버를 초대하세요.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 주간 네비 툴바 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px',
        borderBottom: `0.5px solid ${COLOR.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: COLOR.textPrimary, flex: 1 }}>
          {weekLabel}
        </span>
        <button onClick={goToPrevWeek} style={navBtnStyle}>◀</button>
        <button onClick={goToThisWeek} style={{ ...navBtnStyle, padding: '4px 10px', fontSize: 11 }}>이번주</button>
        <button onClick={goToNextWeek} style={navBtnStyle}>▶</button>
      </div>

      {/* 그리드 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '160px repeat(5, 1fr)',
          minWidth: 900,
        }}>
          {/* 헤더 */}
          <div style={{
            position: 'sticky', left: 0, zIndex: 2,
            background: COLOR.bgSurface,
            borderBottom: `0.5px solid ${COLOR.border}`,
            borderRight: `0.5px solid ${COLOR.border}`,
            padding: '10px 12px',
            fontSize: 11,
            color: COLOR.textSecondary,
          }}>팀원</div>
          {weekDays.map((d, i) => {
            const iso = toISODateString(d)
            const isToday = iso === todayISO
            return (
              <div key={iso} style={{
                borderBottom: `0.5px solid ${COLOR.border}`,
                borderRight: `0.5px solid ${COLOR.border}`,
                padding: '10px 12px',
                fontSize: 11,
                background: isToday ? PILL.amber.bg : 'white',
                color: isToday ? PILL.amber.fg : COLOR.textSecondary,
                fontWeight: isToday ? PILL.amber.fontWeight : 400,
                textAlign: 'center',
              }}>
                {DAY_LABELS[i]} {d.getMonth() + 1}/{d.getDate()}
              </div>
            )
          })}

          {/* 행 (멤버별) */}
          {members.map(member => (
            <MemberRow
              key={member.userId}
              member={member}
              memberColor={memberColorMap[member.userId]?.dot || '#888'}
              weekDayISOs={weekDayISOs}
              weekDays={weekDays}
              todayISO={todayISO}
              tasksForMember={tasksByRow.get(member.userId) || new Map()}
              msForMember={msByRow.get(member.userId) || new Map()}
              projects={projects}
              activeDrag={activeDrag}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              currentTeamId={currentTeamId}
              addTask={addTask}
              onUnscheduleTask={onUnscheduleTask}
              onUnscheduleMS={onUnscheduleMS}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const navBtnStyle = {
  background: 'none',
  border: `0.5px solid ${COLOR.border}`,
  borderRadius: 4,
  cursor: 'pointer',
  padding: '4px 8px',
  fontSize: 10,
  color: COLOR.textSecondary,
  fontFamily: 'inherit',
}

function MemberRow({
  member, memberColor, weekDayISOs, weekDays, todayISO,
  tasksForMember, msForMember, projects,
  activeDrag, selectedProjectId, setSelectedProjectId,
  currentTeamId, addTask, onUnscheduleTask, onUnscheduleMS,
}) {
  return (
    <>
      {/* 멤버 열 (sticky) */}
      <div style={{
        position: 'sticky', left: 0, zIndex: 1,
        background: 'white',
        borderRight: `0.5px solid ${COLOR.border}`,
        borderBottom: `0.5px solid ${COLOR.border}`,
        padding: 8,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <MiniAvatar name={member.displayName} size={22} color={memberColor} />
        <span style={{ fontSize: 12, color: COLOR.textPrimary }}>{member.displayName}</span>
      </div>
      {/* 요일별 셀 */}
      {weekDays.map((day, i) => {
        const iso = weekDayISOs[i]
        const isToday = iso === todayISO
        return (
          <ScheduleCell
            key={`${member.userId}:${iso}`}
            userId={member.userId}
            dateISO={iso}
            isToday={isToday}
            tasksInCell={tasksForMember.get(iso) || []}
            milestonesInCell={msForMember.get(iso) || []}
            projects={projects}
            activeDrag={activeDrag}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            currentTeamId={currentTeamId}
            addTask={addTask}
            onUnscheduleTask={onUnscheduleTask}
            onUnscheduleMS={onUnscheduleMS}
          />
        )
      })}
    </>
  )
}
