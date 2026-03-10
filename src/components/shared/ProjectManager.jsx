import { useState, useRef, useEffect } from 'react'
import useStore from '../../hooks/useStore'
import { COLOR_OPTIONS, getColor } from '../../utils/colors'
import { PlusIcon, GripIcon, EditIcon, TrashIcon } from './Icons'

export default function ProjectManager() {
  const { projects, setShowProjectMgr, addProject, updateProject, deleteProject, reorderProjects } = useStore()
  const isMobile = window.innerWidth < 768

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('blue')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const editRef = useRef(null)
  const addRef = useRef(null)

  useEffect(() => { if (editingId && editRef.current) editRef.current.focus() }, [editingId])
  useEffect(() => { if (adding && addRef.current) addRef.current.focus() }, [adding])

  const startEdit = (p) => { setEditingId(p.id); setEditName(p.name); setEditColor(p.color) }
  const saveEdit = () => { if (editName.trim()) updateProject(editingId, { name: editName.trim(), color: editColor }); setEditingId(null) }
  const handleAdd = () => { if (newName.trim()) { addProject(newName.trim(), newColor); setNewName(''); setNewColor('blue'); setAdding(false) } }

  const handleDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== idx) {
      const n = [...projects]; const [item] = n.splice(dragIdx, 1); n.splice(idx, 0, item)
      reorderProjects(n)
    }
    setDragIdx(null); setDragOverIdx(null)
  }
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null) }

  return (
    <>
      <div onClick={() => setShowProjectMgr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: isMobile ? 'calc(100% - 32px)' : 460, maxHeight: '80vh', background: 'white', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', zIndex: 210, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#37352f', margin: 0 }}>프로젝트 관리</h2>
          <button onClick={() => setShowProjectMgr(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
          <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10 }}>드래그하여 순서 변경 · 클릭하여 편집</div>
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
                    {confirmDelete === p.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { deleteProject(p.id); setConfirmDelete(null) }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #ddd', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 4, display: 'flex' }}><TrashIcon /></button>
                    )}
                  </>
                )}
              </div>
            )
          })}

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
      </div>
    </>
  )
}
