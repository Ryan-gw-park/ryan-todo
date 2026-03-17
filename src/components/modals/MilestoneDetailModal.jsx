import { useState, useEffect, useRef, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import useTeamMembers from '../../hooks/useTeamMembers'
import { getDb } from '../../utils/supabase'
import { getColor, COLOR_OPTIONS } from '../../utils/colors'

const MS_STATUS = [
  { key: 'not_started', label: '시작 전', bg: '#F1EFE8', text: '#444441', border: '#B4B2A9' },
  { key: 'in_progress', label: '진행 중', bg: '#E6F1FB', text: '#0C447C', border: '#85B7EB' },
  { key: 'completed', label: '완료', bg: '#E1F5EE', text: '#085041', border: '#5DCAA5' },
]

const CAT_CHIP = {
  today: { bg: '#FAEEDA', text: '#633806', label: '오늘' },
  next: { bg: '#E6F1FB', text: '#0C447C', label: '다음' },
  backlog: { bg: '#F1EFE8', text: '#444441', label: '남은' },
}

// Milestone color options (subset)
const MS_COLORS = ['#1D9E75', '#5b8fd4', '#cb7161', '#d4a039', '#8e6ebf', '#d48a3f', '#4a9e8e', '#c46060']

export default function MilestoneDetailModal() {
  const activeModal = useStore(s => s.activeModal)
  const milestoneId = activeModal?.milestoneId
  const tasks = useStore(s => s.tasks)
  const projects = useStore(s => s.projects)
  const toggleDone = useStore(s => s.toggleDone)
  const addTask = useStore(s => s.addTask)
  const openDetail = useStore(s => s.openDetail)
  const openModal = useStore(s => s.openModal)
  const closeModal = useStore(s => s.closeModal)
  const openConfirmDialog = useStore(s => s.openConfirmDialog)
  const currentTeamId = useStore(s => s.currentTeamId)

  // Load milestone from DB
  const [milestone, setMilestone] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!milestoneId) return
    loadMilestone()
  }, [milestoneId])

  async function loadMilestone() {
    setLoading(true)
    const db = getDb()
    if (!db) { setLoading(false); return }
    const { data, error } = await db.from('key_milestones').select('*').eq('id', milestoneId).single()
    if (error) { console.error('[MilestoneDetailModal] load:', error); setLoading(false); return }
    setMilestone(data)
    setLoading(false)
  }

  // Team members
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(m => setMembers(m || []))
  }, [currentTeamId])

  // Local editable fields
  const [localTitle, setLocalTitle] = useState('')
  const [localDesc, setLocalDesc] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => {
    if (milestone) {
      setLocalTitle(milestone.title || '')
      setLocalDesc(milestone.description || '')
    }
  }, [milestone?.id])

  const updateMilestone = useCallback(async (patch) => {
    if (!milestone) return
    // Optimistic local update
    setMilestone(prev => ({ ...prev, ...patch }))
    const db = getDb()
    if (!db) return
    const { error } = await db.from('key_milestones')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', milestoneId)
    if (error) console.error('[MilestoneDetailModal] update:', error)
  }, [milestone, milestoneId])

  const debouncedUpdate = useCallback((field, value) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateMilestone({ [field]: value })
    }, 300)
  }, [updateMilestone])

  // Derived
  const project = milestone ? projects.find(p => p.id === milestone.project_id) : null
  const linkedTasks = milestone ? tasks.filter(t => t.keyMilestoneId === milestoneId) : []
  const doneTasks = linkedTasks.filter(t => t.done).length
  const progress = linkedTasks.length > 0 ? Math.round((doneTasks / linkedTasks.length) * 100) : 0
  const projectColor = project ? getColor(project.color) : null

  const handleBack = () => {
    if (activeModal.returnTo) {
      openModal(activeModal.returnTo)
    } else {
      closeModal()
    }
  }

  const handleTaskClick = (task) => {
    closeModal()
    openDetail(task)
  }

  const handleAddTask = () => {
    if (!milestone) return
    const p = projects.find(p => p.id === milestone.project_id)
    addTask({
      projectId: milestone.project_id,
      keyMilestoneId: milestoneId,
      category: 'backlog',
      text: '',
      ...(p?.teamId ? { teamId: p.teamId, scope: 'team' } : { scope: 'private' }),
    })
  }

  const handleDelete = () => {
    openConfirmDialog({
      target: 'milestone', targetId: milestoneId,
      targetName: milestone?.title || '제목 없음',
      meta: { taskCount: linkedTasks.length, returnTo: activeModal.returnTo }
    })
  }

  const getMemberName = (userId) => {
    const m = members.find(m => m.userId === userId)
    return m?.displayName || null
  }

  if (loading) return <div onClick={e => e.stopPropagation()} style={{ ...containerStyle, padding: 40, textAlign: 'center', color: '#a09f99' }}>로딩 중...</div>
  if (!milestone) return null

  return (
    <div onClick={e => e.stopPropagation()} style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid #f0efe8' }}>
        <button onClick={handleBack} style={iconBtnStyle}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2A', flex: 1 }}>마일스톤 상세</span>
        {project && (
          <span
            onClick={() => openModal({ type: 'projectSettings', projectId: project.id })}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: projectColor?.header || '#f0efe8', color: projectColor?.text || '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: projectColor?.dot || '#999' }} />
            {project.name}
          </span>
        )}
        <button onClick={handleDelete} style={{ ...iconBtnStyle, color: '#c53030', fontSize: 12 }}>삭제</button>
        <button onClick={closeModal} style={iconBtnStyle}>✕</button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Title */}
        <input
          value={localTitle}
          onChange={e => { setLocalTitle(e.target.value); debouncedUpdate('title', e.target.value) }}
          placeholder="마일스톤 제목"
          style={{ width: '100%', fontSize: 18, fontWeight: 600, border: 'none', outline: 'none', color: '#2C2C2A', padding: 0, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />

        {/* Color */}
        <label style={{ ...labelStyle, marginTop: 14 }}>색상</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {MS_COLORS.map(c => (
            <div
              key={c}
              onClick={() => updateMilestone({ color: c })}
              style={{
                width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                border: (milestone.color || '#1D9E75') === c ? '2px solid #2C2C2A' : '2px solid transparent',
              }}
            />
          ))}
        </div>

        {/* Owner */}
        {currentTeamId && (
          <>
            <label style={{ ...labelStyle, marginTop: 14 }}>담당자</label>
            <MemberSelect value={milestone.owner_id} members={members} onChange={v => updateMilestone({ owner_id: v })} />
          </>
        )}

        {/* Status */}
        <label style={{ ...labelStyle, marginTop: 14 }}>상태</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {MS_STATUS.map(s => (
            <button
              key={s.key}
              onClick={() => updateMilestone({ status: s.key })}
              style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
                border: `1px solid ${s.border}`, fontFamily: 'inherit',
                background: (milestone.status || 'not_started') === s.key ? s.bg : '#fff',
                color: (milestone.status || 'not_started') === s.key ? s.text : '#888',
                fontWeight: (milestone.status || 'not_started') === s.key ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Dates */}
        <label style={{ ...labelStyle, marginTop: 14 }}>기간</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
          <input type="date" value={milestone.start_date || ''} onChange={e => updateMilestone({ start_date: e.target.value || null })} style={dateInputStyle} />
          <span style={{ color: '#a09f99', fontSize: 12 }}>~</span>
          <input type="date" value={milestone.end_date || ''} onChange={e => updateMilestone({ end_date: e.target.value || null })} style={dateInputStyle} />
        </div>

        {/* Progress */}
        {linkedTasks.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 14 }}>진행률</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f0efe8' }}>
                <div style={{ height: '100%', borderRadius: 3, background: milestone.color || '#5DCAA5', width: `${progress}%`, transition: 'width .2s' }} />
              </div>
              <span style={{ fontSize: 12, color: '#666' }}>{progress}% ({doneTasks}/{linkedTasks.length})</span>
            </div>
          </>
        )}

        {/* Description */}
        <label style={{ ...labelStyle, marginTop: 14 }}>설명</label>
        <textarea
          value={localDesc}
          onChange={e => { setLocalDesc(e.target.value); debouncedUpdate('description', e.target.value) }}
          placeholder="설명..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
        />

        {/* Linked Tasks */}
        <div style={{ ...labelStyle, marginTop: 18, marginBottom: 8 }}>연결된 할일 ({linkedTasks.length})</div>
        <div style={{ border: linkedTasks.length > 0 ? '1px solid #f0efe8' : 'none', borderRadius: 8, overflow: 'hidden' }}>
          {linkedTasks.map((task, i) => {
            const cat = CAT_CHIP[task.category] || CAT_CHIP.backlog
            return (
              <div
                key={task.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                  borderBottom: i < linkedTasks.length - 1 ? '1px solid #f0efe8' : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafaf8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Checkbox */}
                <div
                  onClick={e => { e.stopPropagation(); toggleDone(task.id) }}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: task.done ? 'none' : '1.5px solid #1D9E75',
                    background: task.done ? '#1D9E75' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9,
                  }}
                >
                  {task.done && '✓'}
                </div>
                {/* Task name */}
                <span
                  onClick={() => handleTaskClick(task)}
                  style={{
                    fontSize: 13, flex: 1, color: task.done ? '#a09f99' : '#2C2C2A',
                    textDecoration: task.done ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {task.text || '제목 없음'}
                </span>
                {/* Category chip */}
                {!task.done && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: cat.bg, color: cat.text, whiteSpace: 'nowrap' }}>
                    {cat.label}
                  </span>
                )}
                {/* Assignee */}
                {task.assigneeId && (
                  <span style={{ fontSize: 11, color: '#888' }}>{getMemberName(task.assigneeId) || ''}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Add task */}
        <button onClick={handleAddTask} style={{ fontSize: 12, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit' }}>
          + 할일 추가
        </button>
      </div>
    </div>
  )
}

function MemberSelect({ value, members, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = members.find(m => m.userId === value)

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
      <button onClick={() => setOpen(!open)} style={{
        fontSize: 13, color: selected ? '#2C2C2A' : '#a09f99', cursor: 'pointer',
        border: '1px solid #e8e6df', background: '#fff', fontFamily: 'inherit',
        padding: '4px 10px', borderRadius: 6,
      }}>
        {selected?.displayName || '미배정'} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, background: '#fff',
          border: '0.5px solid #e8e6df', borderRadius: 8, padding: '4px 0',
          boxShadow: '0 4px 16px rgba(0,0,0,.1)', zIndex: 10, minWidth: 140,
        }}>
          <div onClick={() => { onChange(null); setOpen(false) }}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#a09f99' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ✕ 미배정
          </div>
          {members.map(m => (
            <div key={m.userId} onClick={() => { onChange(m.userId); setOpen(false) }}
              style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: m.userId === value ? 600 : 400, background: m.userId === value ? '#f0efe8' : 'transparent' }}
              onMouseEnter={e => { if (m.userId !== value) e.currentTarget.style.background = '#f5f4f0' }}
              onMouseLeave={e => { if (m.userId !== value) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#1D9E75', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 }}>
                {(m.displayName || '?')[0].toUpperCase()}
              </span>
              {m.displayName}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

const containerStyle = {
  background: '#fff', borderRadius: 12, border: '0.5px solid #e8e6df',
  width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,.12)',
}

const iconBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#a09f99', padding: 4 }
const labelStyle = { display: 'block', fontSize: 12, color: '#888780', fontWeight: 500, marginBottom: 4 }

const inputStyle = {
  width: '100%', fontSize: 13, padding: '6px 10px', border: '1px solid #e8e6df',
  borderRadius: 6, fontFamily: 'inherit', outline: 'none', color: '#2C2C2A', boxSizing: 'border-box',
}

const dateInputStyle = {
  fontSize: 12, padding: '4px 8px', border: '1px solid #e8e6df',
  borderRadius: 6, fontFamily: 'inherit', color: '#2C2C2A', outline: 'none',
}
