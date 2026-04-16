import { COLOR, PILL, PIVOT } from '../../../../styles/designTokens'
import { TIME_COLUMNS } from '../personalPivotColumns'

/* ═════════════════════════════════════════════
   PersonalPivotProjectRow — 접힌/펼친 프로젝트 행
   - 카운트: 시간 카테고리별 집계
   - 5+ amber, 10+ coral pill
   ═════════════════════════════════════════════ */
export default function PersonalPivotProjectRow({ project, tasks, isExpanded, onToggle }) {
  const countByCol = TIME_COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => t.category === col.key).length
    return acc
  }, {})
  const total = tasks.length

  return (
    <tr
      onClick={onToggle}
      style={{
        cursor: 'pointer',
        borderBottom: `1px solid ${COLOR.border}`,
        background: '#fff',
      }}
    >
      <td
        style={{
          position: 'sticky',
          left: 0,
          background: '#fff',
          zIndex: 2,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 500,
          color: COLOR.textPrimary,
        }}
      >
        <span style={{ display: 'inline-block', width: 12, color: COLOR.textSecondary }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        {' '}
        {project.name}
        <span style={{ marginLeft: 8, color: COLOR.textTertiary, fontWeight: 400, fontSize: 11 }}>
          {total}건
        </span>
      </td>
      {TIME_COLUMNS.map(col => (
        <td key={col.key} style={{ textAlign: 'center' }}>
          <CountCell n={countByCol[col.key]} />
        </td>
      ))}
      <td
        style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: COLOR.textSecondary,
        }}
      >
        {total}
      </td>
    </tr>
  )
}

function CountCell({ n }) {
  if (n === 0 || n == null) {
    return <span style={{ color: PIVOT.emptyCellColor, fontSize: PIVOT.emptyCellFontSize }}>{PIVOT.emptyCellMarker}</span>
  }
  if (n >= 10) {
    return (
      <span style={{
        background: PILL.coral.bg, color: PILL.coral.fg,
        borderRadius: PILL.coral.borderRadius, padding: PILL.coral.padding,
        fontWeight: PILL.coral.fontWeight, fontSize: 11,
      }}>{n}</span>
    )
  }
  if (n >= 5) {
    return (
      <span style={{
        background: PILL.amber.bg, color: PILL.amber.fg,
        borderRadius: PILL.amber.borderRadius, padding: PILL.amber.padding,
        fontWeight: PILL.amber.fontWeight, fontSize: 11,
      }}>{n}</span>
    )
  }
  return <span style={{ fontSize: 12, color: COLOR.textPrimary }}>{n}</span>
}
