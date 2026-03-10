import useStore from '../../hooks/useStore'

export default function FAB() {
  const setView = useStore(s => s.setView)

  return (
    <button
      onClick={() => setView('today')}
      className="mobile-fab"
      style={{ position: 'fixed', bottom: 76, right: 20, width: 52, height: 52, borderRadius: 16, background: '#37352f', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', cursor: 'pointer', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 300 }}
    >
      +
    </button>
  )
}
