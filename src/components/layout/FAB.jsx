import { useState } from 'react'
import MobileAddSheet from './MobileAddSheet'

export default function FAB() {
  const [showAddSheet, setShowAddSheet] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowAddSheet(true)}
        className="mobile-fab"
        style={{
          position: 'fixed', bottom: 80, right: 20,
          width: 52, height: 52, borderRadius: 16,
          background: '#37352f', color: 'white', border: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', cursor: 'pointer',
          zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 300,
        }}
      >
        +
      </button>

      {showAddSheet && <MobileAddSheet onClose={() => setShowAddSheet(false)} />}
    </>
  )
}
