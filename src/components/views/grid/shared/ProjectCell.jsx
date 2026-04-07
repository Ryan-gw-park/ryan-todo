import { COLOR, FONT } from '../../../../styles/designTokens'

export default function ProjectCell({ proj, color, count, isCollapsed, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      padding: '8px 10px',
      display: 'flex', alignItems: isCollapsed ? 'center' : 'flex-start', gap: 5,
      borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`,
      cursor: 'pointer', background: `${color.dot}04`,
    }}>
      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
      <div style={{ width: 7, height: 7, borderRadius: 2, background: color.dot, flexShrink: 0, marginTop: isCollapsed ? 0 : 2 }} />
      <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>{proj.name}</span>
      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{count}건</span>
    </div>
  )
}
