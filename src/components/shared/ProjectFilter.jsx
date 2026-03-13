import useStore from '../../hooks/useStore'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'team', label: '팀' },
  { key: 'personal', label: '개인' },
]

export default function ProjectFilter() {
  const teamId = useStore(s => s.currentTeamId)
  const filter = useStore(s => s.projectFilter)
  const setFilter = useStore(s => s.setProjectFilter)

  if (!teamId) return null

  return (
    <div style={{ display: 'inline-flex', gap: 2, background: '#f0f0f0', borderRadius: 6, padding: 2 }}>
      {FILTERS.map(f => {
        const active = filter === f.key
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: 'inherit',
              padding: '5px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: active ? 'white' : 'transparent',
              color: active ? '#37352f' : '#999',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
