import { COLOR, PIVOT } from '../../../../styles/designTokens'
import { TIME_COLUMNS } from '../personalPivotColumns'
import PersonalPivotTimeCell from './PersonalPivotTimeCell'

/* ═════════════════════════════════════════════
   PersonalPivotUngroupedSubRow — keyMilestoneId=null task sub-row
   R22: 라벨 없음 (익명 sub-row)
   ═════════════════════════════════════════════ */
export default function PersonalPivotUngroupedSubRow({ project, tasks, currentUserId }) {
  return (
    <tr style={{ background: PIVOT.msSubRowBg }}>
      <td
        style={{
          position: 'sticky',
          left: 0,
          background: PIVOT.msSubRowBg,
          zIndex: 2,
          paddingLeft: 24,
          borderBottom: `1px solid ${COLOR.border}`,
        }}
        aria-label="프로젝트 직속 task"
      >
        {/* R22: 라벨 없음 — 시각 단서는 indent + 배경색 */}
        &nbsp;
      </td>
      {TIME_COLUMNS.map(col => (
        <td key={col.key} style={{ borderBottom: `1px solid ${COLOR.border}`, verticalAlign: 'top' }}>
          <PersonalPivotTimeCell
            tasks={tasks}
            timeCol={col}
            projectId={project.id}
            milestoneId={null}
            currentUserId={currentUserId}
          />
        </td>
      ))}
      <td
        style={{
          textAlign: 'center',
          fontSize: 11,
          color: COLOR.textTertiary,
          borderBottom: `1px solid ${COLOR.border}`,
        }}
      >
        {tasks.length}
      </td>
    </tr>
  )
}
