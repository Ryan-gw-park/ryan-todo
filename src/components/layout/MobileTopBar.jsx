import useStore from '../../hooks/useStore'
import { SettingsIcon } from '../shared/Icons'

export default function MobileTopBar() {
  const { setShowProjectMgr, userName } = useStore()

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="mobile-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700, fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>{userName ? userName[0].toUpperCase() : 'R'}</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#37352f' }}>{userName ? `${userName}'s Todo` : 'Todo'}</span>
      </div>
      <button onClick={() => setShowProjectMgr(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex' }}><SettingsIcon /></button>
    </div>
  )
}
