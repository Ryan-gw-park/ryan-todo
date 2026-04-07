import { COLOR, FONT } from '../../../../styles/designTokens'

export default function Pill({ items, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 1, background: COLOR.bgHover, borderRadius: 7, padding: 2 }}>
      {items.map(it => (
        <button key={it.k} onClick={() => onChange(it.k)} style={{
          border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
          fontWeight: active === it.k ? 600 : 400,
          background: active === it.k ? '#fff' : 'transparent',
          color: active === it.k ? COLOR.textPrimary : COLOR.textTertiary,
          boxShadow: active === it.k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>{it.l}</button>
      ))}
    </div>
  )
}
