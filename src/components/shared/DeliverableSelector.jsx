// src/components/shared/DeliverableSelector.jsx
import { useState, useEffect, useRef } from 'react'
import { getDb } from '../../utils/supabase'

export default function DeliverableSelector({ projectId, value, onChange, style }) {
  const [deliverables, setDeliverables] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // 프로젝트의 결과물 목록 로드
  useEffect(() => {
    if (!projectId) {
      setDeliverables([])
      return
    }
    loadDeliverables()
  }, [projectId])

  async function loadDeliverables() {
    setLoading(true)
    const db = getDb()
    if (!db) {
      setLoading(false)
      return
    }
    const { data, error } = await db
      .from('key_deliverables')
      .select('id, title, milestone_id')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[DeliverableSelector] load failed:', error.message)
      setLoading(false)
      return
    }
    setDeliverables(data || [])
    setLoading(false)
  }

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = deliverables.find(d => d.id === value)

  // 프로젝트가 없거나 결과물이 0개면 렌더링하지 않음
  if (!projectId) return null
  if (!loading && deliverables.length === 0) return null

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', border: '1px solid #e8e6df', borderRadius: 6,
          background: 'transparent', cursor: 'pointer', fontSize: 12,
          color: selected ? '#2C2C2A' : '#a09f99', fontFamily: 'inherit',
          width: '100%', textAlign: 'left',
        }}
      >
        <span style={{ color: '#1D9E75', fontSize: 10 }}>◆</span>
        {loading ? '로딩...' : (selected ? selected.title || '(제목 없음)' : '결과물 연결')}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #e8e6df', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 100,
          maxHeight: 200, overflowY: 'auto', marginTop: 4,
        }}>
          {/* 연결 해제 옵션 */}
          {value && (
            <div
              onClick={() => { onChange(null); setOpen(false) }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                color: '#a09f99', borderBottom: '1px solid #f0efe8',
              }}
            >
              연결 해제
            </div>
          )}

          {deliverables.map(d => (
            <div
              key={d.id}
              onClick={() => { onChange(d.id); setOpen(false) }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                background: d.id === value ? '#f6f5f0' : 'transparent',
                color: '#2C2C2A',
              }}
              onMouseEnter={e => { if (d.id !== value) e.currentTarget.style.background = '#fafaf7' }}
              onMouseLeave={e => { if (d.id !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {d.title || '(제목 없음)'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
