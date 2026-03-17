import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import useStore from '../../hooks/useStore'
import { getDb } from '../../utils/supabase'
import useTeamMembers from '../../hooks/useTeamMembers'
import { COLOR_OPTIONS, getColor } from '../../utils/colors'

const STATUS_OPTIONS = [
  { key: 'active', label: '진행 중', bg: '#EAF3DE', text: '#27500A', border: '#97C459' },
  { key: 'on_hold', label: '보류', bg: '#FAEEDA', text: '#633806', border: '#FAC775' },
  { key: 'completed', label: '완료', bg: '#E1F5EE', text: '#085041', border: '#5DCAA5' },
  { key: 'archived', label: '보관', bg: '#F1EFE8', text: '#444441', border: '#B4B2A9' },
]

const MS_STATUS = [
  { key: 'not_started', label: '시작 전', bg: '#F1EFE8', text: '#444441', border: '#B4B2A9' },
  { key: 'in_progress', label: '진행 중', bg: '#E6F1FB', text: '#0C447C', border: '#85B7EB' },
  { key: 'completed', label: '완료', bg: '#E1F5EE', text: '#085041', border: '#5DCAA5' },
]

export default function ProjectSettingsModal() {
  const activeModal = useStore(s => s.activeModal)
  const projectId = activeModal?.projectId
  const project = useStore(s => s.projects.find(p => p.id === projectId))
  const allTasks = useStore(s => s.tasks)
  const tasks = useMemo(() => allTasks.filter(t => t.projectId === projectId), [allTasks, projectId])
  const updateProject = useStore(s => s.updateProject)
  const deleteProject = useStore(s => s.deleteProject)
  const closeModal = useStore(s => s.closeModal)
  const openModal = useStore(s => s.openModal)
  const openConfirmDialog = useStore(s => s.openConfirmDialog)
  const currentTeamId = useStore(s => s.currentTeamId)
  const userName = useStore(s => s.userName)

  // Milestones — direct fetch to avoid hook re-render loops
  const [milestones, setMilestones] = useState([])
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const db = getDb()
    if (!db) return

    ;(async () => {
      // 1. Get or create project_key_milestone
      let pkmId = null
      const { data: pkm, error: pkmErr } = await db
        .from('project_key_milestones')
        .select('id')
        .eq('project_id', projectId)
        .single()

      if (pkmErr && pkmErr.code !== 'PGRST116') {
        console.error('[ProjectSettingsModal] pkm fetch failed:', pkmErr.message)
        return
      }
      pkmId = pkm?.id || null

      if (!pkmId) return // no milestones for this project
      if (cancelled) return

      // 2. Fetch milestones
      const { data: ms, error: msErr } = await db
        .from('key_milestones')
        .select('*')
        .eq('pkm_id', pkmId)
        .order('sort_order', { ascending: true })

      if (msErr) {
        console.error('[ProjectSettingsModal] milestones fetch failed:', msErr.message)
        return
      }
      if (!cancelled) setMilestones(ms || [])
    })()

    return () => { cancelled = true }
  }, [projectId])

  // Team members for owner display
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(m => setMembers(m || []))
  }, [currentTeamId])

  // Debounced text fields
  const [localName, setLocalName] = useState('')
  const [localDesc, setLocalDesc] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => {
    if (project) {
      setLocalName(project.name || '')
      setLocalDesc(project.description || '')
    }
  }, [project?.id])

  const debouncedUpdate = useCallback((field, value) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateProject(projectId, { [field]: value })
    }, 300)
  }, [projectId, updateProject])

  const [showAll, setShowAll] = useState(false)

  if (!project) return null

  const color = getColor(project.color)
  const completedMs = milestones.filter(m => m.status === 'completed').length
  const progress = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0
  const visibleMs = showAll ? milestones : milestones.slice(0, 5)

  const handleMilestoneClick = (milestoneId) => {
    openModal({ type: 'milestoneDetail', milestoneId, returnTo: { type: 'projectSettings', projectId } })
  }

  const handleArchive = () => {
    updateProject(projectId, { is_archived: true })
    closeModal()
  }

  const handleDelete = () => {
    openConfirmDialog({
      target: 'project', targetId: projectId, targetName: project.name,
      meta: { milestoneCount: milestones.length, taskCount: tasks.length, returnTo: null }
    })
  }

  const getMemberName = (userId) => {
    const m = members.find(m => m.userId === userId)
    return m?.displayName || null
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{
      background: '#fff', borderRadius: 12, border: '0.5px solid #e8e6df',
      width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto',
      boxShadow: '0 8px 32px rgba(0,0,0,.12)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid #f0efe8' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2A' }}>프로젝트 설정</span>
        <button onClick={closeModal} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#a09f99', padding: 4 }}>✕</button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Name */}
        <label style={labelStyle}>이름</label>
        <input
          value={localName}
          onChange={e => { setLocalName(e.target.value); debouncedUpdate('name', e.target.value) }}
          style={inputStyle}
        />

        {/* Color */}
        <label style={{ ...labelStyle, marginTop: 14 }}>색상</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {COLOR_OPTIONS.map(c => (
            <div
              key={c.id}
              onClick={() => updateProject(projectId, { color: c.id })}
              style={{
                width: 22, height: 22, borderRadius: '50%', background: c.dot, cursor: 'pointer',
                border: project.color === c.id ? '2px solid #2C2C2A' : '2px solid transparent',
                transition: 'border .1s',
              }}
            />
          ))}
        </div>

        {/* Owner */}
        {currentTeamId && (
          <>
            <label style={{ ...labelStyle, marginTop: 14 }}>오너</label>
            {project.teamId ? (
              <MemberSelect
                value={project.ownerId}
                members={members}
                onChange={v => updateProject(projectId, { ownerId: v })}
              />
            ) : (
              <span style={{ fontSize: 13, color: '#2C2C2A', display: 'inline-block', marginTop: 4, padding: '4px 0' }}>
                {getMemberName(project.ownerId) || userName || '나'}
              </span>
            )}
          </>
        )}

        {/* Status */}
        <label style={{ ...labelStyle, marginTop: 14 }}>상태</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => updateProject(projectId, { status: s.key })}
              style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
                border: `1px solid ${s.border}`, fontFamily: 'inherit',
                background: (project.status || 'active') === s.key ? s.bg : '#fff',
                color: (project.status || 'active') === s.key ? s.text : '#888',
                fontWeight: (project.status || 'active') === s.key ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Dates */}
        <label style={{ ...labelStyle, marginTop: 14 }}>기간</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
          <input
            type="date"
            value={project.start_date || ''}
            onChange={e => updateProject(projectId, { start_date: e.target.value || null })}
            style={dateInputStyle}
          />
          <span style={{ color: '#a09f99', fontSize: 12 }}>~</span>
          <input
            type="date"
            value={project.due_date || ''}
            onChange={e => updateProject(projectId, { due_date: e.target.value || null })}
            style={dateInputStyle}
          />
        </div>

        {/* Progress */}
        {milestones.length > 0 && (
          <>
            <label style={{ ...labelStyle, marginTop: 14 }}>진행률</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f0efe8' }}>
                <div style={{ height: '100%', borderRadius: 3, background: color.dot, width: `${progress}%`, transition: 'width .2s' }} />
              </div>
              <span style={{ fontSize: 12, color: '#666', minWidth: 36 }}>{progress}%</span>
            </div>
          </>
        )}

        {/* Description */}
        <label style={{ ...labelStyle, marginTop: 14 }}>설명</label>
        <textarea
          value={localDesc}
          onChange={e => { setLocalDesc(e.target.value); debouncedUpdate('description', e.target.value) }}
          placeholder="프로젝트 설명..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
        />

        {/* Milestones */}
        {milestones.length > 0 && (
          <>
            <div style={{ ...labelStyle, marginTop: 18, marginBottom: 8 }}>마일스톤 ({milestones.length})</div>
            <div style={{ border: '1px solid #f0efe8', borderRadius: 8, overflow: 'hidden' }}>
              {visibleMs.map((ms, i) => {
                const msTasks = tasks.filter(t => t.keyMilestoneId === ms.id)
                const msDone = msTasks.filter(t => t.done).length
                const msProgress = msTasks.length > 0 ? Math.round((msDone / msTasks.length) * 100) : 0
                const msStatus = MS_STATUS.find(s => s.key === (ms.status || 'not_started'))
                return (
                  <div
                    key={ms.id}
                    onClick={() => handleMilestoneClick(ms.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                      borderBottom: i < visibleMs.length - 1 ? '1px solid #f0efe8' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ms.color || '#1D9E75', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, flex: 1, color: '#2C2C2A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ms.title || '제목 없음'}
                    </span>
                    {ms.owner_id && (
                      <span style={{ fontSize: 11, color: '#888' }}>{getMemberName(ms.owner_id) || ''}</span>
                    )}
                    {msStatus && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: msStatus.bg, color: msStatus.text, border: `1px solid ${msStatus.border}`, whiteSpace: 'nowrap' }}>
                        {msStatus.label}
                      </span>
                    )}
                    {msTasks.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#f0efe8' }}>
                          <div style={{ height: '100%', borderRadius: 2, background: ms.color || '#5DCAA5', width: `${msProgress}%` }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#a09f99' }}>{msProgress}%</span>
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: '#c4c2ba' }}>›</span>
                  </div>
                )
              })}
            </div>
            {milestones.length > 5 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                style={{ fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit' }}
              >
                + {milestones.length - 5}개 더 보기
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px 16px', borderTop: '1px solid #f0efe8' }}>
        <button onClick={handleArchive} style={footerBtnStyle}>보관</button>
        <button onClick={handleDelete} style={{ ...footerBtnStyle, color: '#c53030' }}>삭제</button>
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
        {selected?.displayName || '미지정'} ▾
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
            ✕ 미지정
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

const labelStyle = { display: 'block', fontSize: 12, color: '#888780', fontWeight: 500, marginBottom: 4 }

const inputStyle = {
  width: '100%', fontSize: 13, padding: '6px 10px', border: '1px solid #e8e6df',
  borderRadius: 6, fontFamily: 'inherit', outline: 'none', color: '#2C2C2A',
  boxSizing: 'border-box',
}

const dateInputStyle = {
  fontSize: 12, padding: '4px 8px', border: '1px solid #e8e6df',
  borderRadius: 6, fontFamily: 'inherit', color: '#2C2C2A', outline: 'none',
}

const footerBtnStyle = {
  fontSize: 12, padding: '6px 14px', border: '1px solid #e8e6df',
  borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#666',
}
