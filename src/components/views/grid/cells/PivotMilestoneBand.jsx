import { useDroppable } from '@dnd-kit/core'
import { COLOR, PIVOT, FONT, OPACITY } from '../../../../styles/designTokens'

/* ═════════════════════════════════════════════
   PivotMilestoneBand — 풀폭 MS 가로 밴드 (spec §3.2 L-03 / L-04 / D-06)

   props:
     - milestone: { id, title, ... } | null  (null = 미분류 밴드)
     - count: number
     - colSpan: number  (caller가 직접 주입)
     - dim: boolean  (미분류일 때 true → OPACITY.projectDimmed)
     - projectId: string
     - members: Array<{ userId, displayName }>  (commit 11: resolveMemberFromX 입력)

   commit 11: useDroppable 등록 → dispatcher가 type='team-matrix-band'로 분기.
   ═════════════════════════════════════════════ */
export default function PivotMilestoneBand({ milestone, count, colSpan, dim = false, projectId, members }) {
  const msId = milestone?.id ?? null
  const label = milestone ? milestone.title : '미분류'
  const opacity = dim ? OPACITY.projectDimmed : 1

  const { setNodeRef, isOver } = useDroppable({
    id: `team-matrix-band:${projectId}:${msId ?? 'null'}`,
    data: {
      type: 'team-matrix-band',
      projectId,
      msId,
      members,
    },
  })

  return (
    <tr style={{ background: PIVOT.msSubRowBg }}>
      <td
        ref={setNodeRef}
        colSpan={colSpan}
        style={{
          paddingLeft: 24,
          paddingRight: 12,
          paddingTop: 4,
          paddingBottom: 4,
          fontSize: FONT.body,
          color: COLOR.textSecondary,
          borderBottom: `1px solid ${COLOR.border}`,
          opacity,
          background: isOver ? COLOR.dropTargetTint : undefined,
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>{label}</span>
          <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>{count}건</span>
        </div>
      </td>
    </tr>
  )
}
