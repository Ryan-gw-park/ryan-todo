import { COLOR, PIVOT, SPACE } from '../../../../styles/designTokens'
import { TIME_COLUMNS } from '../personalPivotColumns'
import PersonalPivotTimeCell from './PersonalPivotTimeCell'

/* ═════════════════════════════════════════════
   PersonalPivotMsSubRow — 펼친 프로젝트 내 MS sub-row
   props.tasks는 이 MS에 해당하는 task로 이미 필터됨
   ═════════════════════════════════════════════ */
export default function PersonalPivotMsSubRow({ milestone, tasks, currentUserId }) {
  return (
    <tr style={{ background: PIVOT.msSubRowBg }}>
      <td
        style={{
          position: 'sticky',
          left: 0,
          background: PIVOT.msSubRowBg,
          zIndex: 2,
          paddingLeft: 24,
          paddingTop: SPACE.cellPadding.split(' ')[0],
          paddingBottom: SPACE.cellPadding.split(' ')[0],
          fontSize: 12,
          color: COLOR.textSecondary,
          borderBottom: `1px solid ${COLOR.border}`,
        }}
      >
        · {milestone.title}
      </td>
      {TIME_COLUMNS.map(col => (
        <td key={col.key} style={{ borderBottom: `1px solid ${COLOR.border}`, verticalAlign: 'top' }}>
          <PersonalPivotTimeCell
            tasks={tasks}
            timeCol={col}
            projectId={milestone.project_id || milestone.projectId}
            milestoneId={milestone.id}
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
