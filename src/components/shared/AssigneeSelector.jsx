import { useState, useEffect, useRef } from 'react'
import useStore from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'

export default function AssigneeSelector({ task, onUpdate }) {
  const { currentTeamId } = useStore()
  const [members, setMembers] = useState([])
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(setMembers)
    import('../../utils/supabase').then(({ getDb }) => {
      const d = getDb()
      if (d) d.auth.getUser().then(({ data }) => setUserId(data?.user?.id))
    })
  }, [currentTeamId])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isAssigned = task.scope === 'assigned' && task.assigneeId
  const assignee = isAssigned ? members.find(m => m.userId === task.assigneeId) : null

  // Assign mode: scope=team, no assignee — 모든 역할에서 전체 팀원 드롭다운
  if (!isAssigned) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={btnStyle}>
          {open ? '취소' : '담당자 배정 ▾'}
        </button>
        {open && (
          <div style={dropdownStyle}>
            {members.map(m => (
              <button key={m.userId} onClick={() => {
                onUpdate({ scope: 'assigned', assigneeId: m.userId, assignee_id: m.userId })
                setOpen(false)
              }} style={dropItemStyle}>
                <MiniAvatar name={m.displayName} />
                <span>{m.displayName}</span>
                {m.role === 'owner' && <span style={{ fontSize: 9, color: '#aaa' }}>팀장</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Assigned mode: 재배정 드롭다운 + 반납 — 모든 역할에서 가능
  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
      <MiniAvatar name={assignee?.displayName || '?'} />
      <span style={{ fontSize: 13, color: '#37352f', fontWeight: 500 }}>
        {assignee?.displayName || '알 수 없음'}
      </span>
      <button onClick={() => {
        onUpdate({ scope: 'team', assigneeId: null, assignee_id: null })
      }} style={{ fontSize: 11, color: '#e57373', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px' }}>
        반납
      </button>
    </div>
  )
}

function MiniAvatar({ name }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%', background: '#888',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 9, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

const btnStyle = {
  fontSize: 12, color: '#3182CE', background: '#e8f0fe',
  border: '1px solid #b4d0f7', borderRadius: 6,
  padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
}

const dropdownStyle = {
  position: 'absolute', top: '100%', left: 0, marginTop: 4,
  background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '4px 0',
  zIndex: 200, minWidth: 160,
}

const dropItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '8px 12px', background: 'none',
  border: 'none', cursor: 'pointer', fontSize: 13, color: '#37352f',
  fontFamily: 'inherit',
}
