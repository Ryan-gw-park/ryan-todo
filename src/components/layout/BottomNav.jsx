import useStore from '../../hooks/useStore'
import { ViewIcons } from '../shared/Icons'

const TABS = [
  { id: 'today', label: '오늘할일', icon: ViewIcons.today },
  { id: 'matrix', label: '매트릭스', icon: ViewIcons.matrix },
  { id: 'project', label: '프로젝트', icon: ViewIcons.project },
  { id: 'timeline', label: '타임라인', icon: ViewIcons.timeline },
  { id: 'memory', label: '메모', icon: ViewIcons.memory },
]

export default function BottomNav() {
  const { currentView, setView } = useStore()

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #f0f0f0', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom, 8px)' }} className="mobile-bottomnav">
      {TABS.map(v => (
        <button key={v.id} onClick={() => setView(v.id)}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: currentView === v.id ? '#37352f' : '#c0c0c0', transition: 'color 0.15s' }}>
          <div style={{ opacity: currentView === v.id ? 1 : 0.5 }}>{v.icon}</div>
          <span style={{ fontSize: 10, fontWeight: currentView === v.id ? 600 : 400 }}>{v.label}</span>
        </button>
      ))}
    </div>
  )
}
