import { useState } from 'react'
import useStore from '../../hooks/useStore'
import useWeeklySchedule from '../../hooks/useWeeklySchedule'
import BacklogPanel from './weekly-schedule/BacklogPanel'
import ScheduleGrid from './weekly-schedule/ScheduleGrid'
import { COLOR } from '../../styles/designTokens'

/**
 * Weekly Schedule View — 팀 위클리 미팅용 백로그+그리드 DnD 뷰.
 * 좌측 230px 백로그 + 우측 flex 멤버×요일 그리드.
 *
 * Commit 6 — 뼈대: 레이아웃 + hook 연결 + 하위 컴포넌트 스텁.
 * Commit 7~10에서 BacklogPanel/ScheduleGrid 확장 + DnD + CellInlineAdd.
 */
export default function WeeklyScheduleView() {
  const {
    members, weekDays, weekLabel,
    scheduledTasks, scheduledMilestones, backlogTasks, backlogMilestones,
    teamProjectIds,
    goToPrevWeek, goToNextWeek, goToThisWeek,
  } = useWeeklySchedule()

  const tasks = useStore(s => s.tasks)
  const milestones = useStore(s => s.milestones)
  const projects = useStore(s => s.projects)
  const currentTeamId = useStore(s => s.currentTeamId)
  // eslint-disable-next-line no-unused-vars
  const { updateTask, updateTasksBulk, updateMilestone, addTask } = useStore()

  // 드래그 중인 아이템 메타 (commit 9 DnD 연결에서 활용)
  // eslint-disable-next-line no-unused-vars
  const [activeDrag, setActiveDrag] = useState(null)
  // CellInlineAdd가 공유하는 마지막 선택 projectId (commit 10 활용)
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  // 멤버 0명 빈 상태 (spec E2)
  if (!currentTeamId) {
    return (
      <div style={{ padding: 32, color: COLOR.textSecondary }}>
        팀을 선택하세요.
      </div>
    )
  }

  return (
    <div data-view="team-weekly-schedule" style={{
      display: 'flex',
      height: '100%',
      background: COLOR.bgSurface,
    }}>
      <BacklogPanel
        backlogTasks={backlogTasks}
        backlogMilestones={backlogMilestones}
        tasks={tasks}
        milestones={milestones}
        projects={projects}
        members={members}
      />
      <ScheduleGrid
        members={members}
        weekDays={weekDays}
        weekLabel={weekLabel}
        scheduledTasks={scheduledTasks}
        scheduledMilestones={scheduledMilestones}
        tasks={tasks}
        projects={projects}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        currentTeamId={currentTeamId}
        addTask={addTask}
        activeDrag={activeDrag}
        goToPrevWeek={goToPrevWeek}
        goToNextWeek={goToNextWeek}
        goToThisWeek={goToThisWeek}
      />
    </div>
  )
}
