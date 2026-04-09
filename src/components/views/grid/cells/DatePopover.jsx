import { useState, useRef, useEffect } from 'react'

export default function DatePopover({ task, onUpdate, onClose }) {
  const ref = useRef(null)
  const [startDate, setStartDate] = useState(task.startDate || '')
  const [dueDate, setDueDate] = useState(task.dueDate || '')

  // click-outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleStartChange = (e) => {
    const val = e.target.value
    setStartDate(val)
    onUpdate(task.id, { startDate: val || null })
  }

  const handleDueChange = (e) => {
    const val = e.target.value
    setDueDate(val)
    onUpdate(task.id, { dueDate: val || null })
  }

  return (
    <div
      ref={ref}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute', top: '100%', right: 0, zIndex: 100,
        background: '#fff', border: '1px solid #e8e6df', borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 10px',
        marginTop: 2, width: 200,
      }}
    >
      <div style={{ fontSize: 11, color: '#a09f99', fontWeight: 500, marginBottom: 6 }}>기간 설정</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, color: '#6b6a66' }}>
          시작일
          <input
            type="date"
            value={startDate}
            onChange={handleStartChange}
            style={{ display: 'block', width: '100%', fontSize: 12, border: '1px solid #e0e0e0', borderRadius: 5, padding: '4px 6px', fontFamily: 'inherit', color: '#37352f', marginTop: 2, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ fontSize: 11, color: '#6b6a66' }}>
          마감일
          <input
            type="date"
            value={dueDate}
            onChange={handleDueChange}
            style={{ display: 'block', width: '100%', fontSize: 12, border: '1px solid #e0e0e0', borderRadius: 5, padding: '4px 6px', fontFamily: 'inherit', color: '#37352f', marginTop: 2, boxSizing: 'border-box' }}
          />
        </label>
      </div>
      {startDate && dueDate && startDate > dueDate && (
        <div style={{ fontSize: 10, color: '#E53E3E', marginTop: 4 }}>시작일이 마감일보다 늦습니다</div>
      )}
    </div>
  )
}
