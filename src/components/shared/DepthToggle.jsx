const DEPTH_OPTIONS = [
  { key: 'project', label: '프로젝트' },
  { key: 'milestone', label: '+ 마일스톤' },
  { key: 'task', label: '+ 할일' },
]

export default function DepthToggle({ value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 1,
      background: '#f0efe8',
      borderRadius: 6,
      padding: 2,
    }}>
      {DEPTH_OPTIONS.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 5,
            border: 'none',
            background: value === o.key ? '#fff' : 'transparent',
            color: value === o.key ? '#2C2C2A' : '#888780',
            fontWeight: value === o.key ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
