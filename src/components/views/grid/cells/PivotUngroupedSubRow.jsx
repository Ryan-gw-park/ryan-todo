import { COLOR, PIVOT } from '../../../../styles/designTokens'
import PivotTaskCell from './PivotTaskCell'

/* ═════════════════════════════════════════════
   PivotUngroupedSubRow — keyMilestoneId=null task sub-row
   R24: 라벨 없음 (익명 sub-row). chevron/indent만.
   ═════════════════════════════════════════════ */
export default function PivotUngroupedSubRow({ project, members, tasks }) {
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
        {/* R24: 라벨 없음 — 시각 단서는 indent + 배경색 */}
        &nbsp;
      </td>
      {members.map(m => (
        <td key={m.userId} style={{ borderBottom: `1px solid ${COLOR.border}`, verticalAlign: 'top' }}>
          <PivotTaskCell
            tasks={tasks}
            memberId={m.userId}
            projectId={project.id}
            milestoneId={null}
          />
        </td>
      ))}
      <td style={{ borderBottom: `1px solid ${COLOR.border}`, verticalAlign: 'top' }}>
        <PivotTaskCell
          tasks={tasks}
          memberId={null}
          projectId={project.id}
          milestoneId={null}
        />
      </td>
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
