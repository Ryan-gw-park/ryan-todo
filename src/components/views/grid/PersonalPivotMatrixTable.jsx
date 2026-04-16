import React, { useMemo, useCallback } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { COLOR, PIVOT } from '../../../styles/designTokens'
import { TIME_COLUMNS } from './personalPivotColumns'
import PersonalPivotProjectRow from './cells/PersonalPivotProjectRow'
import PersonalPivotMsSubRow from './cells/PersonalPivotMsSubRow'
import PersonalPivotUngroupedSubRow from './cells/PersonalPivotUngroupedSubRow'

/* ═════════════════════════════════════════════
   PersonalPivotMatrixTable — 개인 매트릭스 시간 피벗 (Loop 44)
   rows = 프로젝트 (팀 + 개인 전체)
   cols = 시간 카테고리 (지금 / 다음 / 남은) + 합계
   sticky 헤더/첫 컬럼, overflow-x
   펼침: localStorage (usePivotExpandState('personal'))
   자동 펼침: 직속 task 있는 프로젝트 (R18)
   ═════════════════════════════════════════════ */
export default function PersonalPivotMatrixTable({ projects, tasks, milestones }) {
  const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState('personal')
  const currentUserId = getCachedUserId()

  // tasks는 이미 UnifiedGridView에서 myTasks로 사전 필터됨 (assigneeId 기준).
  // 여기선 미완료/미삭제 추가 필터만 적용. assigneeId 재필터는 idempotent.
  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigneeId === currentUserId && !t.done && !t.deletedAt),
    [tasks, currentUserId]
  )

  const isExpanded = useCallback((pid) => {
    const explicit = pivotCollapsed[pid]
    if (explicit === true) return true
    if (explicit === false) return false
    // 자동: keyMilestoneId=null 직속 task가 있는 프로젝트
    return myTasks.some(t => t.projectId === pid && t.keyMilestoneId == null)
  }, [pivotCollapsed, myTasks])

  const toggleProject = useCallback((pid) => {
    setPivotCollapsed(pid, !isExpanded(pid))
  }, [isExpanded, setPivotCollapsed])

  const minWidth = PIVOT.colWidthProject + TIME_COLUMNS.length * PIVOT.colWidthMember + PIVOT.colWidthTotal

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
          {TIME_COLUMNS.map(c => <col key={c.key} style={{ width: PIVOT.colWidthMember }} />)}
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
            {TIME_COLUMNS.map(c => (
              <th
                key={c.key}
                style={{
                  position: 'sticky', top: 0, zIndex: 3, background: '#fff',
                  padding: '8px 6px', fontSize: 11, fontWeight: 600, color: COLOR.textSecondary,
                  borderBottom: `1px solid ${COLOR.border}`,
                  wordBreak: 'keep-all',
                }}
              >{c.label}</th>
            ))}
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
            const projTasks = myTasks.filter(t => t.projectId === p.id)
            const projMilestones = milestones.filter(m =>
              (m.project_id || m.projectId) === p.id
            )
            const ungrouped = projTasks.filter(t => t.keyMilestoneId == null)
            const expanded = isExpanded(p.id)
            return (
              <React.Fragment key={p.id}>
                <PersonalPivotProjectRow
                  project={p}
                  tasks={projTasks}
                  isExpanded={expanded}
                  onToggle={() => toggleProject(p.id)}
                />
                {expanded && projMilestones.map(ms => (
                  <PersonalPivotMsSubRow
                    key={`ms-${ms.id}`}
                    milestone={ms}
                    tasks={projTasks.filter(t => t.keyMilestoneId === ms.id)}
                    currentUserId={currentUserId}
                  />
                ))}
                {expanded && ungrouped.length > 0 && (
                  <PersonalPivotUngroupedSubRow
                    key={`ungr-${p.id}`}
                    project={p}
                    tasks={ungrouped}
                    currentUserId={currentUserId}
                  />
                )}
              </React.Fragment>
            )
          })}
          {projects.length === 0 && (
            <tr>
              <td colSpan={TIME_COLUMNS.length + 2} style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: 13 }}>
                표시할 프로젝트가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
