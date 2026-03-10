import { useState, useRef, useEffect } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { parseNotes, serializeNotes } from '../../utils/notes'
import { parseDateFromText } from '../../utils/dateParser'
import { SettingsIcon, PlusIcon, ChevronIcon, CheckIcon, UndoIcon, TrashIcon, IndentIcon, OutdentIcon } from '../shared/Icons'
import { getBulletStyle } from '../../utils/colors'

export default function ProjectView() {
  const { projects, tasks, setShowProjectMgr, toggleDone, updateTask, deleteTask, addTask, openDetail } = useStore()
  const isMobile = window.innerWidth < 768
  const [activeProject, setActiveProject] = useState(projects[0]?.id || '')
  const [expanded, setExpanded] = useState({})

  // Initialize expanded state for all tasks
  useEffect(() => {
    const exp = {}
    tasks.forEach(t => { if (expanded[t.id] === undefined) exp[t.id] = true })
    if (Object.keys(exp).length) setExpanded(p => ({ ...exp, ...p }))
  }, [tasks.length])

  const p = projects.find(pr => pr.id === activeProject) || projects[0]
  if (!p) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>프로젝트를 추가하세요</div>

  const c = getColor(p.color)
  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Project chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
          {projects.map(pr => {
            const pc = getColor(pr.color)
            const isAct = pr.id === activeProject
            return (
              <button key={pr.id} onClick={() => setActiveProject(pr.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: isAct ? `1.5px solid ${pc.dot}` : '1px solid #e8e8e8', background: isAct ? pc.header : 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: isAct ? 600 : 400, color: isAct ? pc.text : '#888', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: pc.dot }} />{pr.name}
              </button>
            )
          })}
          <button onClick={() => setShowProjectMgr(true)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e8e8e8', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#bbb' }}><SettingsIcon /></button>
        </div>

        {/* Project header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: c.dot }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#37352f', margin: 0 }}>{p.name}</h1>
        </div>
        <p style={{ fontSize: 13, color: '#bbb', marginBottom: 28, paddingLeft: 26 }}>클릭하여 편집 · Tab 레벨 조절 · 체크 시 완료로 자동 이동</p>

        {/* Category sections */}
        {CATEGORIES.map(cat => {
          const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key)
          const isDoneCat = cat.key === 'done'
          return (
            <div key={cat.key} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `2px solid ${isDoneCat ? '#e0e0e0' : c.dot}20`, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>{cat.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: isDoneCat ? '#999' : '#37352f' }}>{cat.label}</span>
                <span style={{ fontSize: 11, color: isDoneCat ? '#aaa' : c.dot, background: isDoneCat ? '#f0f0f0' : c.header, borderRadius: 8, padding: '1px 8px', fontWeight: 600 }}>{catTasks.length}</span>
              </div>
              <div style={{ paddingLeft: 4 }}>
                {catTasks.length === 0 && isDoneCat && <div style={{ fontSize: 12, color: '#ccc', padding: '4px 16px' }}>아직 완료된 항목이 없습니다</div>}
                {catTasks.map(task => (
                  <OutlinerTaskNode key={task.id} task={task} color={c} expanded={expanded} toggleExpand={toggleExpand} />
                ))}
                {!isDoneCat && <AddTaskButton projectId={p.id} category={cat.key} color={c} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OutlinerTaskNode({ task, color, expanded, toggleExpand }) {
  const { toggleDone, updateTask, deleteTask, openDetail } = useStore()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(task.text)
  const [addingChild, setAddingChild] = useState(false)
  const [childText, setChildText] = useState('')
  const editRef = useRef(null)
  const childRef = useRef(null)

  const noteNodes = parseNotes(task.notes)
  const isOpen = expanded[task.id] !== false
  const hasChildren = noteNodes.length > 0
  const isDone = task.category === 'done'

  useEffect(() => { setEditText(task.text) }, [task.text])
  useEffect(() => { if (editing && editRef.current) { editRef.current.focus(); editRef.current.select() } }, [editing])
  useEffect(() => { if (addingChild && childRef.current) childRef.current.focus() }, [addingChild])

  const saveText = () => { if (editText.trim() && editText !== task.text) updateTask(task.id, { text: editText.trim() }); setEditing(false) }

  const updateNoteNode = (i, t) => { const n = [...noteNodes]; n[i] = { ...n[i], text: t }; updateTask(task.id, { notes: serializeNotes(n) }) }
  const deleteNoteNode = (i) => updateTask(task.id, { notes: serializeNotes(noteNodes.filter((_, j) => j !== i)) })
  const changeNoteLevel = (i, d) => {
    const n = [...noteNodes]; const nl = Math.max(0, Math.min(3, n[i].level + d))
    if (d > 0 && i > 0 && nl > n[i-1].level + 1) return
    n[i] = { ...n[i], level: nl }; updateTask(task.id, { notes: serializeNotes(n) })
  }
  const addNoteAfter = (i, l) => { const n = [...noteNodes]; n.splice(i+1, 0, { text: '', level: l }); updateTask(task.id, { notes: serializeNotes(n) }) }
  const addChild = () => {
    if (!childText.trim()) { setAddingChild(false); return }
    updateTask(task.id, { notes: serializeNotes([...noteNodes, { text: childText.trim(), level: 0 }]) })
    setChildText('')
  }

  return (
    <div style={{ opacity: isDone ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '4px 0' }} className="outliner-row">
        <div onClick={() => hasChildren && toggleExpand(task.id)} style={{ cursor: hasChildren ? 'pointer' : 'default', padding: '2px 0', color: hasChildren ? '#999' : '#e0e0e0', width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <ChevronIcon open={isOpen && hasChildren} />
        </div>
        <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ marginTop: 2, flexShrink: 0 }}>
          {isDone ? <div style={{ width: 16, height: 16, borderRadius: 4, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#66bb6a' }}><UndoIcon /></div> : <CheckIcon checked={false} size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 6 }}>
          {editing && !isDone
            ? <input ref={editRef} value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveText(); if (e.key === 'Escape') { setEditText(task.text); setEditing(false) } }} onBlur={saveText}
                style={{ width: '100%', fontSize: 14, fontWeight: 500, border: 'none', borderBottom: `2px solid ${color.dot}`, outline: 'none', padding: '2px 0', fontFamily: 'inherit', background: 'transparent', color: '#37352f', boxSizing: 'border-box' }} />
            : <div onClick={() => !isDone ? setEditing(true) : openDetail(task)} style={{ fontSize: 14, fontWeight: 500, color: isDone ? '#bbb' : '#37352f', textDecoration: isDone ? 'line-through' : 'none', cursor: isDone ? 'pointer' : 'text', padding: '2px 0', lineHeight: '22px' }}>
                {task.text}{task.dueDate && <span style={{ fontSize: 11, color: '#ccc', marginLeft: 8, fontWeight: 400 }}>{task.dueDate}</span>}
              </div>
          }
        </div>
        <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0, marginTop: 2 }} className="outliner-actions">
          {!isDone && <button onClick={() => setAddingChild(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 3, display: 'flex' }}><PlusIcon size={13} /></button>}
          <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 3, display: 'flex' }}><TrashIcon /></button>
        </div>
      </div>

      {isOpen && hasChildren && (
        <div style={{ marginLeft: 26, borderLeft: '1px solid #f0f0f0', paddingLeft: 10 }}>
          {noteNodes.map((node, i) => (
            <OutlinerNoteNode key={i} node={node} idx={i} color={color} onUpdate={updateNoteNode} onDelete={deleteNoteNode} onChangeLevel={changeNoteLevel} onAddAfter={addNoteAfter} />
          ))}
        </div>
      )}

      {isOpen && addingChild && (
        <div style={{ marginLeft: 44, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color.dot }} />
          <input ref={childRef} value={childText} onChange={e => setChildText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && childText.trim()) addChild(); else if (e.key === 'Enter' || e.key === 'Escape') { setAddingChild(false); setChildText('') } }}
            onBlur={() => { if (childText.trim()) addChild(); setAddingChild(false) }}
            placeholder="하위 노트 입력..."
            style={{ flex: 1, fontSize: 13, border: 'none', borderBottom: `1.5px solid ${color.dot}40`, outline: 'none', padding: '2px 0', fontFamily: 'inherit', background: 'transparent', color: '#37352f' }} />
        </div>
      )}
    </div>
  )
}

function OutlinerNoteNode({ node, idx, color, onUpdate, onDelete, onChangeLevel, onAddAfter }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(node.text)
  const r = useRef(null)

  useEffect(() => { setText(node.text) }, [node.text])
  useEffect(() => { if (editing && r.current) { r.current.focus(); r.current.select() } }, [editing])

  const save = () => { if (text !== node.text) onUpdate(idx, text); setEditing(false) }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', minHeight: 26, marginLeft: node.level * 22 }} className="outliner-row">
      <div style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={getBulletStyle(node.level, color.dot)} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing
          ? <input ref={r} value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { save(); onAddAfter(idx, node.level) } if (e.key === 'Escape') { setText(node.text); setEditing(false) } if (e.key === 'Tab') { e.preventDefault(); onChangeLevel(idx, e.shiftKey ? -1 : 1) } }}
              onBlur={save}
              style={{ width: '100%', fontSize: 13, border: 'none', borderBottom: `1.5px solid ${color.dot}40`, outline: 'none', padding: '1px 0', fontFamily: 'inherit', background: 'transparent', color: '#37352f', boxSizing: 'border-box' }} />
          : <div onClick={() => setEditing(true)} style={{ fontSize: 13, color: '#555', cursor: 'text', padding: '1px 0', lineHeight: '20px' }}>
              {node.text || <span style={{ color: '#ccc' }}>빈 노트</span>}
            </div>
        }
      </div>
      <div style={{ display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }} className="outliner-actions">
        {node.level > 0 && <button onClick={() => onChangeLevel(idx, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}><OutdentIcon /></button>}
        {node.level < 3 && idx > 0 && <button onClick={() => onChangeLevel(idx, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}><IndentIcon /></button>}
        <button onClick={() => onDelete(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 2, display: 'flex' }}><TrashIcon /></button>
      </div>
    </div>
  )
}

function AddTaskButton({ projectId, category, color }) {
  const { addTask } = useStore()
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => { if (adding && ref.current) ref.current.focus() }, [adding])

  const handleAdd = () => {
    if (!text.trim()) { setAdding(false); return }
    const { startDate, dueDate } = parseDateFromText(text.trim())
    addTask({ text: text.trim(), projectId, category, startDate, dueDate })
    setText('')
  }

  if (!adding) {
    return (
      <button onClick={() => { setAdding(true); setText('') }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', marginLeft: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#c0c0c0', fontSize: 13, fontFamily: 'inherit', borderRadius: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = color.text}
        onMouseLeave={e => e.currentTarget.style.color = '#c0c0c0'}>
        <PlusIcon size={13} /> 할일 추가
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', marginLeft: 20 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color.dot }} />
      <input ref={ref} value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setText('') } }}
        onBlur={() => { if (text.trim()) handleAdd(); else setAdding(false) }}
        placeholder="새 할일 입력..."
        style={{ flex: 1, fontSize: 14, fontWeight: 500, border: 'none', borderBottom: `2px solid ${color.dot}`, outline: 'none', padding: '4px 0', fontFamily: 'inherit', background: 'transparent', color: '#37352f' }} />
    </div>
  )
}
