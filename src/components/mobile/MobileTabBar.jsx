const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'project', label: '프로젝트별' },
  { key: 'agenda', label: '아젠다별' },
  { key: 'mention', label: '담당자별' },
]

export default function MobileTabBar({ tab, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#fff',
        borderBottom: '1px solid #ececec',
      }}
    >
      {TABS.map(t => {
        const active = t.key === tab
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? '#37352f' : '#888780',
              background: 'transparent',
              border: 'none',
              borderBottom: active ? '2px solid #37352f' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
