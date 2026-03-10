import useStore from '../../hooks/useStore'
import { SettingsIcon } from '../shared/Icons'

export default function MobileTopBar() {
  const { setShowProjectMgr } = useStore()

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="mobile-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#37352f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>R</div>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#37352f' }}>Ryan Todo</span>
      </div>
      <button onClick={() => setShowProjectMgr(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex' }}><SettingsIcon /></button>
    </div>
  )
}
