import { COLOR, PIVOT, FONT, OPACITY } from '../../../../styles/designTokens'

/* ═════════════════════════════════════════════
   PivotMilestoneBand — 풀폭 MS 가로 밴드 (spec §3.2 L-03 / L-04)

   props:
     - milestone: { id, title, ... } | null  (null = 미분류 밴드)
     - count: number  (밴드 우측 표시)
     - colSpan: number  (caller가 직접 주입 — members.length + N)
     - dim: boolean  (미분류일 때 true → OPACITY.projectDimmed)
     - projectId: string  (commit 11에서 droppable 등록 시 사용 — 현재는 unused)
   ═════════════════════════════════════════════ */
export default function PivotMilestoneBand({ milestone, count, colSpan, dim = false, projectId }) {
  const label = milestone ? milestone.title : '미분류'
  const opacity = dim ? OPACITY.projectDimmed : 1
  return (
    <tr style={{ background: PIVOT.msSubRowBg }}>
      <td
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
