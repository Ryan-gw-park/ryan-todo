export default function MiniAvatar({ name, size = 22, color }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color || '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.42, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}
