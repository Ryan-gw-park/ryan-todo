import MiniAvatar from '../views/grid/shared/MiniAvatar'

export default function StackedAvatar({ primary, secondary, size = 16, showLabel = true, onClick }) {
  if (!primary) return null

  if (!secondary) {
    return (
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}>
        <MiniAvatar name={primary.name || '?'} size={size} color={primary.color} />
        {showLabel && <span style={{ fontSize: 11, color: '#6b6a66' }}>{primary.name}</span>}
      </div>
    )
  }

  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <MiniAvatar name={primary.name || '?'} size={size} color={primary.color} />
        <div style={{ marginLeft: -size * 0.35, border: '1.5px solid #fff', borderRadius: '50%' }}>
          <MiniAvatar name={secondary.name || '?'} size={size} color={secondary.color} />
        </div>
      </div>
      {showLabel && <span style={{ fontSize: 11, color: '#6b6a66' }}>{primary.name}</span>}
    </div>
  )
}
