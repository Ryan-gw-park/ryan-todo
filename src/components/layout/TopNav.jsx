import useStore from '../../hooks/useStore'
import { SettingsIcon, PlusIcon, ViewIcons } from '../shared/Icons'

const VIEWS = [
  { id: 'today', label: '오늘할일', icon: ViewIcons.today },
  { id: 'matrix', label: '매트릭스', icon: ViewIcons.matrix },
  { id: 'project', label: '프로젝트', icon: ViewIcons.project },
  { id: 'timeline', label: '타임라인', icon: ViewIcons.timeline },
  { id: 'memory', label: '노트', icon: ViewIcons.memory },
]

export default function TopNav() {
  const { currentView, setView, setShowProjectMgr, logout, userName } = useStore()

  return (
    <div style={{ borderBottom: '1px solid #f0f0f0', background: 'white', position: 'sticky', top: 0, zIndex: 50 }} className="desktop-nav">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', height: 52 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700, fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>{userName ? userName[0].toUpperCase() : 'R'}</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#37352f' }}>{userName ? `${userName}'s Todo` : 'Todo'}</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, background: currentView === v.id ? '#f0f0f0' : 'transparent', color: currentView === v.id ? '#37352f' : '#999', transition: 'all 0.1s' }}
              onMouseEnter={e => { if (currentView !== v.id) e.currentTarget.style.background = '#f8f8f8' }}
              onMouseLeave={e => { if (currentView !== v.id) e.currentTarget.style.background = 'transparent' }}
            >
              {v.icon}{v.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setShowProjectMgr(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid #e8e8e8', background: 'white', cursor: 'pointer', color: '#999', fontSize: 12, fontFamily: 'inherit' }}><SettingsIcon /></button>
          <button onClick={() => useStore.getState().setView('today')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', fontFamily: 'inherit', background: '#37352f', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}><PlusIcon /> 새 할일</button>
          <button onClick={logout} title="로그아웃"
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e8e8', background: '#f5f5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#999', fontFamily: 'inherit', marginLeft: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = '#eee'}
            onMouseLeave={e => e.currentTarget.style.background = '#f5f5f5'}
          >{userName ? userName[0].toUpperCase() : '?'}</button>
        </div>
      </div>
    </div>
  )
}
