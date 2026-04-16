import React, { useMemo } from 'react'
import useStore from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { COLOR, PIVOT } from '../../../styles/designTokens'
import PivotProjectRow from './cells/PivotProjectRow'
import PivotMsSubRow from './cells/PivotMsSubRow'
import PivotUngroupedSubRow from './cells/PivotUngroupedSubRow'
import PivotAddMsRow from './cells/PivotAddMsRow'

/* ═════════════════════════════════════════════
   PivotMatrixTable — 팀 매트릭스 피벗 테이블
   rows = 프로젝트, cols = 팀원 + 미배정 + 합계
   sticky 헤더 / 첫 컬럼, overflow-x
   펼침: localStorage (usePivotExpandState)
   자동 펼침: 직속 task 있는 프로젝트 (R27)
   ═════════════════════════════════════════════ */
export default function PivotMatrixTable({
  projects,
  members,
  tasks,
  milestones,
  filter = 'all',
}) {
  const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState('team')
  const setView = useStore(s => s.setView)

  const isExpanded = (pid) => {
    const explicit = pivotCollapsed[pid]
    if (explicit === true) return true
    if (explicit === false) return false
    // 자동: keyMilestoneId=null 직속 task가 있는 프로젝트
    return tasks.some(t =>
      t.projectId === pid && t.keyMilestoneId == null && !t.done && !t.deletedAt
    )
  }

  const toggleProject = (pid) => {
    setPivotCollapsed(pid, !isExpanded(pid))
  }

  const navigateToMembersView = (_userId) => {
    // MembersView는 내부 state로 멤버 선택. 현재는 view 전환만 수행.
    setView('team-members')
  }

  const handleProjectDrawer = (projectId) => {
    // R25 최소 이행: 기존 ProjectView로 이동
    useStore.getState().setView?.('project')
    useStore.getState().setSelectedProjectId?.(projectId)
  }

  const filteredTasks = useMemo(() => {
    if (filter === 'unassigned') {
      return tasks.filter(t =>
        t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team'
      )
    }
    if (filter === 'assigned') {
      return tasks.filter(t => t.assigneeId != null || t.secondaryAssigneeId != null)
    }
    return tasks
  }, [tasks, filter])

  const minWidth = PIVOT.colWidthProject + (members.length + 1) * PIVOT.colWidthMember + PIVOT.colWidthTotal

  return (
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '100%' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth,
          tableLayout: 'fixed',
          fontFamily: 'inherit',
        }}
      >
        <colgroup>
          <col style={{ width: PIVOT.colWidthProject }} />
          {members.map(m => <col key={m.userId} style={{ width: PIVOT.colWidthMember }} />)}
          <col style={{ width: PIVOT.colWidthMember }} />
          <col style={{ width: PIVOT.colWidthTotal }} />
        </colgroup>
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky', top: 0, left: 0, zIndex: 4,
                background: '#fff', padding: '8px 12px', textAlign: 'left',
                fontSize: 11, fontWeight: 600, color: COLOR.textSecondary,
                borderBottom: `1px solid ${COLOR.border}`,
              }}
            >프로젝트 · 마일스톤</th>
            {members.map(m => (
              <th
                key={m.userId}
                onClick={() => navigateToMembersView(m.userId)}
                style={{
                  position: 'sticky', top: 0, zIndex: 3, background: '#fff',
                  padding: '8px 6px', fontSize: 11, fontWeight: 600, color: COLOR.textSecondary,
                  borderBottom: `1px solid ${COLOR.border}`,
                  cursor: 'pointer',
                  wordBreak: 'keep-all',
                }}
              >
                {m.displayName || '?'}
              </th>
            ))}
            <th
              style={{
                position: 'sticky', top: 0, zIndex: 3, background: '#fff',
                padding: '8px 6px', fontSize: 11, fontWeight: 600, color: COLOR.textTertiary,
                borderBottom: `1px solid ${COLOR.border}`,
              }}
            >미배정</th>
            <th
              style={{
                position: 'sticky', top: 0, zIndex: 3, background: '#fff',
                padding: '8px 6px', fontSize: 11, fontWeight: 600, color: COLOR.textSecondary,
                borderBottom: `1px solid ${COLOR.border}`,
              }}
            >합계</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => {
            const projTasks = filteredTasks.filter(t =>
              t.projectId === p.id && !t.done && !t.deletedAt
            )
            const projMilestones = milestones.filter(m =>
              (m.project_id || m.projectId) === p.id
            )
            const ungrouped = projTasks.filter(t => t.keyMilestoneId == null)
            const expanded = isExpanded(p.id)
            return (
              <React.Fragment key={p.id}>
                <PivotProjectRow
                  project={p}
                  members={members}
                  tasks={projTasks}
                  isExpanded={expanded}
                  onToggle={() => toggleProject(p.id)}
                  onTotalClick={handleProjectDrawer}
                />
                {expanded && projMilestones.map(ms => (
                  <PivotMsSubRow
                    key={`ms-${ms.id}`}
                    milestone={ms}
                    members={members}
                    tasks={projTasks.filter(t => t.keyMilestoneId === ms.id)}
                  />
                ))}
                {expanded && (
                  <PivotAddMsRow
                    key={`add-ms-${p.id}`}
                    projectId={p.id}
                    colSpan={members.length + 3}
                  />
                )}
                {expanded && (
                  <PivotUngroupedSubRow
                    key={`ungr-${p.id}`}
                    project={p}
                    members={members}
                    tasks={ungrouped}
                  />
                )}
              </React.Fragment>
            )
          })}
          {projects.length === 0 && (
            <tr>
              <td colSpan={members.length + 3} style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: 13 }}>
                표시할 프로젝트가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
