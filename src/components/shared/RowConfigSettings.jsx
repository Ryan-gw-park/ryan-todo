import { useState, useEffect, useCallback, useRef } from 'react'
import useMatrixConfig from '../../hooks/useMatrixConfig'
import useStore, { getCachedUserId } from '../../hooks/useStore'
import { COLOR_OPTIONS, getColor } from '../../utils/colors'
import { PlusIcon, GripIcon, EditIcon, TrashIcon } from './Icons'

const T = {
  card: '#ffffff', cardBorder: '#e8e8e8', text: '#1a1a1a',
  textSub: '#888', textMuted: '#adb5bd', accent: '#2c5282',
  border: '#f0f0f0',
}

const ROW_TYPE_LABELS = {
  section_header: '섹션',
  task_row: '태스크',
  member_row: '팀원(자동)',
  remaining: '남은 할일',
  completed: '완료',
}

const ROW_TYPE_ICONS = {
  section_header: '📁',
  task_row: '☰',
  member_row: '👤',
  remaining: '📋',
  completed: '✅',
}

// 삭제 불가능한 시스템 섹션
const SYSTEM_SECTIONS = ['me', 'team', 'bottom']

/* ── 프로젝트 섹션 (팀/개인 분리) ── */
function ProjectSection({ title, projects, sectionKey, onReorder, editingId, setEditingId, editName, setEditName, editColor, setEditColor, confirmDelete, setConfirmDelete, startEdit, saveEdit }) {
  const { updateProject, deleteProject, currentTeamId, myRole } = useStore()
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const editRef = useRef(null)

  useEffect(() => { if (editingId && editRef.current) editRef.current.focus() }, [editingId])

  const handleDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== idx) {
      const n = [...projects]; const [item] = n.splice(dragIdx, 1); n.splice(idx, 0, item)
      onReorder(sectionKey, n)
    }
    setDragIdx(null); setDragOverIdx(null)
  }
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null) }

  if (projects.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      {projects.map((p, idx) => {
        const c = getColor(p.color)
        const isEditing = editingId === p.id
        const isDragOver = dragOverIdx === idx && dragIdx !== idx
        return (
          <div key={p.id} draggable={!isEditing} onDragStart={e => handleDragStart(e, idx)} onDragOver={e => handleDragOver(e, idx)} onDrop={e => handleDrop(e, idx)} onDragEnd={handleDragEnd}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 4, background: isEditing ? '#f8f8f8' : isDragOver ? '#f0f4ff' : 'white', border: isDragOver ? '1.5px dashed #3b82f6' : '1px solid #f0f0f0', opacity: dragIdx === idx ? 0.4 : 1, cursor: isEditing ? 'default' : 'grab', transition: 'all 0.15s' }}>
            {!isEditing && <div style={{ color: '#d0d0d0', flexShrink: 0, cursor: 'grab' }}><GripIcon /></div>}
            {isEditing ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input ref={editRef} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                  style={{ width: '100%', fontSize: 14, fontWeight: 500, border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {COLOR_OPTIONS.map(co => (
                    <button key={co.id} onClick={() => setEditColor(co.id)} style={{ width: 24, height: 24, borderRadius: 6, background: co.dot, border: editColor === co.id ? '2.5px solid #37352f' : '2px solid transparent', cursor: 'pointer', transition: 'border 0.1s' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveEdit} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#37352f', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>저장</button>
                  <button onClick={() => setEditingId(null)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#37352f' }}>{p.name}</span>
                <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 4, display: 'flex' }}><EditIcon /></button>
                {(() => {
                  const canDelete = p.teamId ? myRole === 'owner' : (!currentTeamId || p.userId === getCachedUserId())
                  if (!canDelete) return null
                  return confirmDelete === p.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { deleteProject(p.id); setConfirmDelete(null) }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #ddd', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 4, display: 'flex' }}><TrashIcon /></button>
                  )
                })()}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Inline project management (embedded in 프로젝트 tab) ── */
function ProjectTabContent() {
  const { projects, addProject, updateProject, reorderProjects, currentTeamId } = useStore()

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('blue')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [newScope, setNewScope] = useState('team')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const addRef = useRef(null)

  useEffect(() => { if (adding && addRef.current) addRef.current.focus() }, [adding])

  const startEdit = (p) => { setEditingId(p.id); setEditName(p.name); setEditColor(p.color) }
  const saveEdit = () => { if (editName.trim()) updateProject(editingId, { name: editName.trim(), color: editColor }); setEditingId(null) }
  const handleAdd = () => {
    if (newName.trim()) {
      addProject(newName.trim(), newColor, currentTeamId ? newScope : undefined)
      setNewName(''); setNewColor('blue'); setNewScope('team'); setAdding(false)
    }
  }

  const localProjectOrder = useStore(s => s.localProjectOrder)
  const sortLocally = (list) => [...list].sort((a, b) => {
    const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
    const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
    return orderA - orderB
  })
  const allProjects = sortLocally(projects)

  return (
    <div>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10 }}>드래그하여 순서 변경 · 클릭하여 편집</div>
      <ProjectSection
        title="프로젝트"
        projects={allProjects}
        sectionKey="all"
        onReorder={(_, list) => reorderProjects(list)}
        editingId={editingId} setEditingId={setEditingId}
        editName={editName} setEditName={setEditName}
        editColor={editColor} setEditColor={setEditColor}
        confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
        startEdit={startEdit} saveEdit={saveEdit}
      />
      {adding ? (
        <div style={{ padding: 12, border: '1.5px dashed #3b82f6', borderRadius: 8, marginTop: 8 }}>
          <input ref={addRef} value={newName} onChange={e => setNewName(e.target.value)} placeholder="프로젝트 이름..."
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
            style={{ width: '100%', fontSize: 14, fontWeight: 500, border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {COLOR_OPTIONS.map(co => (
              <button key={co.id} onClick={() => setNewColor(co.id)} style={{ width: 24, height: 24, borderRadius: 6, background: co.dot, border: newColor === co.id ? '2.5px solid #37352f' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
          {currentTeamId && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <button onClick={() => setNewScope('team')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, border: newScope === 'team' ? '1.5px solid #1e7e34' : '1px solid #ddd', background: newScope === 'team' ? '#e6f4ea' : 'white', color: newScope === 'team' ? '#1e7e34' : '#888' }}>팀 프로젝트</button>
              <button onClick={() => setNewScope('personal')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, border: newScope === 'personal' ? '1.5px solid #7c3aed' : '1px solid #ddd', background: newScope === 'personal' ? '#f3e8fd' : 'white', color: newScope === 'personal' ? '#7c3aed' : '#888' }}>개인 프로젝트</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleAdd} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#37352f', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>추가</button>
            <button onClick={() => { setAdding(false); setNewName('') }} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', width: '100%', border: '1px dashed #ddd', borderRadius: 8, background: 'none', cursor: 'pointer', color: '#999', fontSize: 13, fontFamily: 'inherit', marginTop: 8, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#999'; e.currentTarget.style.color = '#666' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#999' }}>
          <PlusIcon size={14} /> 새 프로젝트 추가
        </button>
      )}
    </div>
  )
}

export default function RowConfigSettings({ userId, teamId, onClose, showProjectMgr, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'rows')
  const [config, setConfig] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  const loadConfig = useCallback(async () => {
    const data = await useMatrixConfig.getConfig(userId, teamId)
    setConfig(data.sort((a, b) => a.sort_order - b.sort_order))
    setLoading(false)
  }, [userId, teamId])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleRename = async (id) => {
    if (!editLabel.trim()) { setEditingId(null); return }
    await useMatrixConfig.renameRow(id, editLabel.trim())
    setEditingId(null)
    await loadConfig()
  }

  const handleRemove = async (id) => {
    if (!confirm('이 행을 삭제하시겠습니까?')) return
    await useMatrixConfig.removeRow(id)
    await loadConfig()
  }

  const handleMoveUp = async (index) => {
    if (index <= 0) return
    const newConfig = [...config]
    ;[newConfig[index - 1], newConfig[index]] = [newConfig[index], newConfig[index - 1]]
    setConfig(newConfig)
    await useMatrixConfig.updateOrder(newConfig)
  }

  const handleMoveDown = async (index) => {
    if (index >= config.length - 1) return
    const newConfig = [...config]
    ;[newConfig[index], newConfig[index + 1]] = [newConfig[index + 1], newConfig[index]]
    setConfig(newConfig)
    await useMatrixConfig.updateOrder(newConfig)
  }

  const handleAddSection = async () => {
    const label = prompt('새 섹션 이름:')
    if (!label?.trim()) return
    const maxOrder = Math.max(0, ...config.map(r => r.sort_order))
    await useMatrixConfig.addRow(userId, teamId, {
      section: `custom_${Date.now()}`,
      label: label.trim(),
      row_type: 'section_header',
      sort_order: maxOrder + 1,
    })
    await loadConfig()
  }

  const handleAddTaskRow = async (parentSection) => {
    const label = prompt('새 항목 이름:')
    if (!label?.trim()) return
    const maxOrder = Math.max(0, ...config.map(r => r.sort_order))
    await useMatrixConfig.addRow(userId, teamId, {
      section: `task_${Date.now()}`,
      label: label.trim(),
      row_type: 'task_row',
      parent_section: parentSection,
      mapped_user_id: userId,
      sort_order: maxOrder + 1,
    })
    await loadConfig()
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 14 }}>로딩 중...</div>
    )
  }

  // Group by parent sections
  const sections = config.filter(r => r.row_type === 'section_header')
  const otherRows = config.filter(r => r.row_type !== 'section_header')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, maxWidth: 480, width: '100%',
          maxHeight: '80vh', overflow: 'auto', padding: '24px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>⚙ 뷰 관리</h2>
          <span onClick={onClose} style={{ fontSize: 18, cursor: 'pointer', color: T.textMuted }}>✕</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${T.border}` }}>
          {[{ key: 'rows', label: '행 구성' }, { key: 'projects', label: '프로젝트' }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? T.text : T.textSub,
              background: 'none', border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${T.text}` : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Project tab — inline project management */}
        {activeTab === 'projects' && <ProjectTabContent />}

        {activeTab === 'rows' && (() => {
          // 섹션별로 그룹화
          const sectionHeaders = config.filter(r => r.row_type === 'section_header')
          const childRows = config.filter(r => r.row_type !== 'section_header')

          // 섹션 + 자식 순서대로 렌더링
          const renderRow = (row, isChild = false) => {
            const isMemberRow = row.row_type === 'member_row'
            const isSection = row.row_type === 'section_header'
            const isEditing = editingId === row.id
            const isSystemSection = isSection && SYSTEM_SECTIONS.includes(row.section)
            const canDelete = !isMemberRow && !isSystemSection && !['remaining', 'completed'].includes(row.row_type)

            return (
              <div key={row.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 0',
                paddingLeft: isChild ? 20 : 0,
                borderBottom: `1px solid ${T.border}`,
              }}>
                {/* Icon */}
                <span style={{ fontSize: 14, flexShrink: 0 }}>{ROW_TYPE_ICONS[row.row_type] || '·'}</span>

                {/* Label */}
                {isEditing ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onBlur={() => handleRename(row.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(row.id); if (e.key === 'Escape') setEditingId(null) }}
                    style={{
                      flex: 1, fontSize: 13, padding: '4px 8px',
                      border: `1px solid ${T.accent}`, borderRadius: 4,
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <span style={{
                    flex: 1, fontSize: 13,
                    fontWeight: isSection ? 700 : 500,
                    color: isSection ? T.text : '#555',
                  }}>{row.label}</span>
                )}

                {/* Type badge */}
                {isMemberRow && (
                  <span style={{
                    fontSize: 10, color: T.accent, background: '#E8F0FE',
                    padding: '1px 6px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap',
                  }}>자동</span>
                )}

                {/* Move buttons */}
                <button onClick={() => handleMoveUp(config.indexOf(row))} disabled={config.indexOf(row) === 0}
                  style={{ border: 'none', background: 'none', cursor: config.indexOf(row) > 0 ? 'pointer' : 'default', fontSize: 12, color: config.indexOf(row) > 0 ? T.textSub : '#ddd', padding: '2px 4px' }}>▲</button>
                <button onClick={() => handleMoveDown(config.indexOf(row))} disabled={config.indexOf(row) === config.length - 1}
                  style={{ border: 'none', background: 'none', cursor: config.indexOf(row) < config.length - 1 ? 'pointer' : 'default', fontSize: 12, color: config.indexOf(row) < config.length - 1 ? T.textSub : '#ddd', padding: '2px 4px' }}>▼</button>

                {/* Actions */}
                {!isMemberRow && !isSystemSection && (
                  <span
                    onClick={() => { setEditingId(row.id); setEditLabel(row.label) }}
                    style={{ fontSize: 11, color: T.textSub, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >이름변경</span>
                )}
                {canDelete && (
                  <span
                    onClick={() => handleRemove(row.id)}
                    style={{ fontSize: 11, color: '#c0392b', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >삭제</span>
                )}
                {isMemberRow && (
                  <span style={{ fontSize: 10, color: T.textMuted }}>팀 설정에서 관리</span>
                )}
              </div>
            )
          }

          // 섹션 순서대로 렌더링 (섹션 + 해당 자식들)
          const rendered = sectionHeaders.map((section) => {
            const children = childRows.filter(r => r.parent_section === section.section)
            return (
              <div key={section.id}>
                {renderRow(section, false)}
                {children.map((child) => renderRow(child, true))}
              </div>
            )
          })

          // parent_section 없는 고아 행 (기존 데이터 호환)
          const orphanRows = childRows.filter(r => !r.parent_section)
          if (orphanRows.length > 0) {
            rendered.push(
              <div key="orphan-section">
                {orphanRows.map((row) => renderRow(row, false))}
              </div>
            )
          }

          return rendered
        })()}

        {/* Add buttons (rows tab only) */}
        {activeTab === 'rows' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={handleAddSection} style={{
              flex: 1, padding: '10px', fontSize: 13, fontWeight: 500,
              borderRadius: 6, border: `1px solid ${T.cardBorder}`, background: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', color: T.textSub,
            }}>+ 섹션 추가</button>
            {sections.length > 0 && (
              <button onClick={() => handleAddTaskRow(sections[0]?.section)} style={{
                flex: 1, padding: '10px', fontSize: 13, fontWeight: 500,
                borderRadius: 6, border: `1px solid ${T.cardBorder}`, background: '#fff',
                cursor: 'pointer', fontFamily: 'inherit', color: T.textSub,
              }}>+ 항목 추가</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
