import { useState, useMemo, useCallback, useEffect } from 'react'
import useStore from './useStore'
import useTeamMembers from './useTeamMembers'
import { getMonday, getWeekDays, formatWeekRange, toISODateString } from '../utils/weekDate'

/**
 * 주간 스케줄 뷰용 데이터/네비게이션 hook.
 * - 팀 멤버 로드 (useTeamMembers.getMembers)
 * - 이번주 월~금 날짜 + ISO 주차 라벨
 * - scheduledTasks/scheduledMilestones: 이번주 범위 내 배치된 항목
 * - backlogTasks/backlogMilestones: scheduled_date IS NULL + 팀 프로젝트 + 미완료
 */
export default function useWeeklySchedule() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return getMonday(today)
  })

  const tasks = useStore(s => s.tasks)
  const milestones = useStore(s => s.milestones)
  const projects = useStore(s => s.projects)
  const currentTeamId = useStore(s => s.currentTeamId)

  // 팀 멤버 로드 (MembersView 패턴 재사용)
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) { setMembers([]); return }
    let cancelled = false
    useTeamMembers.getMembers(currentTeamId).then(m => { if (!cancelled) setMembers(m || []) })
    return () => { cancelled = true }
  }, [currentTeamId])

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart])
  const weekLabel = useMemo(() => formatWeekRange(currentWeekStart), [currentWeekStart])
  const weekDateSet = useMemo(() => new Set(weekDays.map(toISODateString)), [weekDays])

  const teamProjectIds = useMemo(() => new Set(
    projects.filter(p => p.teamId === currentTeamId).map(p => p.id)
  ), [projects, currentTeamId])

  // 이번주 셀 표시용 — task는 camelCase, milestone은 snake_case(raw row)
  const scheduledTasks = useMemo(() => tasks.filter(t =>
    t.scheduledDate && weekDateSet.has(t.scheduledDate) && teamProjectIds.has(t.projectId) && !t.deletedAt
  ), [tasks, weekDateSet, teamProjectIds])

  const scheduledMilestones = useMemo(() => milestones.filter(m =>
    m.scheduled_date && weekDateSet.has(m.scheduled_date) && teamProjectIds.has(m.project_id)
  ), [milestones, weekDateSet, teamProjectIds])

  // 백로그: scheduled_date IS NULL + 팀 프로젝트
  const backlogTasks = useMemo(() => tasks.filter(t =>
    !t.scheduledDate && !t.done && teamProjectIds.has(t.projectId) && !t.deletedAt
  ), [tasks, teamProjectIds])

  const backlogMilestones = useMemo(() => milestones.filter(m =>
    !m.scheduled_date && teamProjectIds.has(m.project_id)
  ), [milestones, teamProjectIds])

  const goToPrevWeek = useCallback(() => {
    setCurrentWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
  }, [])
  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
  }, [])
  const goToThisWeek = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setCurrentWeekStart(getMonday(today))
  }, [])

  return {
    members,
    currentWeekStart, weekDays, weekLabel,
    scheduledTasks, scheduledMilestones, backlogTasks, backlogMilestones,
    teamProjectIds,
    goToPrevWeek, goToNextWeek, goToThisWeek,
  }
}
