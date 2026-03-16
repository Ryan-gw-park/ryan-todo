// src/components/shared/MilestoneSelector.jsx
import { useState, useEffect, useRef } from 'react'
import { getDb } from '../../utils/supabase'

export default function MilestoneSelector({ projectId, value, onChange, style }) {
  const [milestones, setMilestones] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // 프로젝트의 마일스톤 목록 로드
  useEffect(() => {
    if (!projectId) {
      setMilestones([])
      return
    }
    loadMilestones()
  }, [projectId])

  async function loadMilestones() {
    setLoading(true)
    const db = getDb()
    if (!db) {
      setLoading(false)
      return
    }
    // key_milestones → project_key_milestones로 프로젝트 연결
    const { data: pkm } = await db
      .from('project_key_milestones')
      .select('id')
      .eq('project_id', projectId)
      .single()

    if (!pkm) {
      setLoading(false)
      return
    }

    const { data, error } = await db
      .from('key_milestones')
      .select('id, title, color, end_date')
      .eq('pkm_id', pkm.id)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[MilestoneSelector] load failed:', error.message)
      setLoading(false)
      return
    }
    setMilestones(data || [])
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

  const selected = milestones.find(m => m.id === value)

  // 프로젝트가 없거나 마일스톤이 0개면 렌더링하지 않음
  if (!projectId) return null
  if (!loading && milestones.length === 0) return null

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
        <span style={{ color: selected?.color || '#1D9E75', fontSize: 10 }}>◆</span>
        {loading ? '로딩...' : (selected ? selected.title || '(제목 없음)' : '마일스톤 연결')}
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

          {milestones.map(m => (
            <div
              key={m.id}
              onClick={() => { onChange(m.id); setOpen(false) }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                background: m.id === value ? '#f6f5f0' : 'transparent',
                color: '#2C2C2A',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => { if (m.id !== value) e.currentTarget.style.background = '#fafaf7' }}
              onMouseLeave={e => { if (m.id !== value) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color || '#1D9E75', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{m.title || '(제목 없음)'}</span>
              {m.end_date && <span style={{ fontSize: 10, color: '#b4b2a9' }}>{m.end_date.slice(5)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
