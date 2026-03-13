const SCOPE_STYLES = {
  team:     { label: '팀',   bg: '#e6f4ea', color: '#1e7e34', border: '#b7dfc3' },
  assigned: { label: '배정', bg: '#e8f0fe', color: '#1a73e8', border: '#b4d0f7' },
  private:  { label: '개인', bg: '#f3e8fd', color: '#7c3aed', border: '#d8b4fe' },
}

export default function ScopeLabel({ scope }) {
  const s = SCOPE_STYLES[scope]
  if (!s) return null
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 600,
      padding: '1px 7px', borderRadius: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      lineHeight: '16px', whiteSpace: 'nowrap', verticalAlign: 'middle',
    }}>
      {s.label}
    </span>
  )
}
