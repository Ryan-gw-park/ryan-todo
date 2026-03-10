import useStore from '../../hooks/useStore'

export default function Toast() {
  const toastMsg = useStore(s => s.toastMsg)
  if (!toastMsg) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#37352f', color: 'white', padding: '8px 20px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    }}>
      {toastMsg}
    </div>
  )
}
