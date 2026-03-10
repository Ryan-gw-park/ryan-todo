import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { parseDateFromText } from '../../utils/dateParser'
import { SettingsIcon, PlusIcon, ChevronIcon, CheckIcon, UndoIcon, TrashIcon } from '../shared/Icons'
import OutlinerEditor from '../shared/OutlinerEditor'

export default function ProjectView() {
  const { projects, tasks, setShowProjectMgr } = useStore()
  const isMobile = window.innerWidth < 768
  const [activeProject, setActiveProject] = useState(projects[0]?.id || '')
  const [expanded, setExpanded] = useState({})

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
        <p style={{ fontSize: 13, color: '#bbb', marginBottom: 28, paddingLeft: 26 }}>↑↓ 자유 이동 · Enter 새 항목/분리 · Tab 레벨 · Alt+Shift+↑↓ 순서 이동</p>

        {/* Category sections */}
        {CATEGORIES.map(cat => {
          const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key).sort((a, b) => a.sortOrder - b.sortOrder)
          return (
            <CategorySection
              key={cat.key}
              cat={cat}
              catTasks={catTasks}
              projectId={p.id}
              color={c}
              expanded={expanded}
              toggleExpand={toggleExpand}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ── Category section — manages inter-task navigation ── */
function CategorySection({ cat, catTasks, projectId, color, expanded, toggleExpand }) {
  const { addTask, updateTask, deleteTask } = useStore()
  const taskRefs = useRef({})
  const pendingFocusRef = useRef(null)
  const isDoneCat = cat.key === 'done'

  /* Focus a newly created task after re-render */
  useEffect(() => {
    if (pendingFocusRef.current) {
      const { idx, pos } = pendingFocusRef.current
      pendingFocusRef.current = null
      const task = catTasks[idx]
      if (task) {
        setTimeout(() => taskRefs.current[task.id]?.focusTitle(pos), 40)
      }
    }
  })

  const handleSwap = useCallback((i, dir) => {
    const j = i + dir
    if (j < 0 || j >= catTasks.length) return
    const a = catTasks[i], b = catTasks[j]
    const aOrder = a.sortOrder, bOrder = b.sortOrder
    updateTask(a.id, { sortOrder: bOrder })
    updateTask(b.id, { sortOrder: aOrder })
    setTimeout(() => taskRefs.current[a.id]?.focusTitle('end'), 50)
  }, [catTasks, updateTask])

  const handleTitleEnter = useCallback((i, afterText) => {
    const task = catTasks[i]
    const nextTask = catTasks[i + 1]
    const sortOrder = nextTask
      ? (task.sortOrder + nextTask.sortOrder) / 2
      : task.sortOrder + 1
    addTask({ text: afterText, projectId, category: cat.key, sortOrder })
    pendingFocusRef.current = { idx: i + 1, pos: 'start' }
  }, [catTasks, addTask, projectId, cat.key])

  const handleTitleBackspace = useCallback((i) => {
    const task = catTasks[i]
    if (!task.text && catTasks.length <= 1) return
    deleteTask(task.id)
    if (i > 0) {
      setTimeout(() => taskRefs.current[catTasks[i - 1].id]?.focusTitle('end'), 40)
    }
  }, [catTasks, deleteTask])

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `2px solid ${isDoneCat ? '#e0e0e0' : color.dot}20`, marginBottom: 8 }}>
        <span style={{ fontSize: 15 }}>{cat.emoji}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: isDoneCat ? '#999' : '#37352f' }}>{cat.label}</span>
        <span style={{ fontSize: 11, color: isDoneCat ? '#aaa' : color.dot, background: isDoneCat ? '#f0f0f0' : color.header, borderRadius: 8, padding: '1px 8px', fontWeight: 600 }}>{catTasks.length}</span>
      </div>
      <div style={{ paddingLeft: 4 }}>
        {catTasks.length === 0 && isDoneCat && <div style={{ fontSize: 12, color: '#ccc', padding: '4px 16px' }}>아직 완료된 항목이 없습니다</div>}
        {catTasks.map((task, i) => (
          <OutlinerTaskNode
            key={task.id}
            ref={el => taskRefs.current[task.id] = el}
            task={task}
            color={color}
            expanded={expanded}
            toggleExpand={toggleExpand}
            onExitUp={() => {
              if (i > 0) taskRefs.current[catTasks[i - 1].id]?.focusLast()
            }}
            onExitDown={() => {
              if (i < catTasks.length - 1) taskRefs.current[catTasks[i + 1].id]?.focusTitle('start')
            }}
            onTitleEnter={(afterText) => handleTitleEnter(i, afterText)}
            onTitleBackspace={() => handleTitleBackspace(i)}
            onSwapUp={() => handleSwap(i, -1)}
            onSwapDown={() => handleSwap(i, 1)}
          />
        ))}
        {!isDoneCat && <AddTaskButton projectId={projectId} category={cat.key} color={color} />}
      </div>
    </div>
  )
}

/* ── Task node — always-editable title + outliner notes ── */
const OutlinerTaskNode = forwardRef(function OutlinerTaskNode(
  { task, color, expanded, toggleExpand, onExitUp, onExitDown, onTitleEnter, onTitleBackspace, onSwapUp, onSwapDown },
  ref
) {
  const { toggleDone, updateTask, deleteTask, openDetail } = useStore()
  const titleRef = useRef(null)
  const editorRef = useRef(null)
  const [titleText, setTitleText] = useState(task.text)

  const hasNotes = !!(task.notes && task.notes.trim())
  const isOpen = expanded[task.id] !== false
  const isDone = task.category === 'done'

  useEffect(() => { setTitleText(task.text) }, [task.text])

  /* ── Expose to parent for inter-task navigation ── */
  useImperativeHandle(ref, () => ({
    focusTitle: (pos = 'end') => {
      setTimeout(() => {
        const el = titleRef.current
        if (!el) return
        el.focus()
        const p = pos === 'start' ? 0 : (typeof pos === 'number' ? pos : el.value.length)
        el.setSelectionRange(p, p)
      }, 30)
    },
    focusLast: () => {
      if (isOpen && hasNotes && editorRef.current) {
        editorRef.current.focusLast()
      } else {
        setTimeout(() => {
          const el = titleRef.current
          if (!el) return
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }, 30)
      }
    },
  }))

  const saveTitle = useCallback(() => {
    const trimmed = titleText.trim()
    if (trimmed && trimmed !== task.text) {
      const { startDate, dueDate } = parseDateFromText(trimmed)
      const patch = { text: trimmed }
      if (startDate) patch.startDate = startDate
      if (dueDate) patch.dueDate = dueDate
      updateTask(task.id, patch)
    }
    if (!trimmed) setTitleText(task.text)
  }, [titleText, task.text, task.id, updateTask])

  const handleTitleKeyDown = (e) => {
    // Alt+Shift+↑↓ — reorder tasks
    if (e.altKey && e.shiftKey && e.key === 'ArrowUp') { e.preventDefault(); onSwapUp?.(); return }
    if (e.altKey && e.shiftKey && e.key === 'ArrowDown') { e.preventDefault(); onSwapDown?.(); return }

    // Enter — text split + new task
    if (e.key === 'Enter') {
      e.preventDefault()
      const cursor = e.target.selectionStart
      const before = titleText.slice(0, cursor)
      const after = titleText.slice(cursor)

      if (!before && !after) {
        onTitleBackspace?.()
        return
      }
      // Update current title to "before" text
      const saveBefore = before || titleText
      setTitleText(saveBefore)
      if (saveBefore !== task.text) updateTask(task.id, { text: saveBefore })
      // Create new task with "after" text
      onTitleEnter?.(after)
      return
    }

    // Backspace on empty
    if (e.key === 'Backspace' && titleText === '') { e.preventDefault(); onTitleBackspace?.(); return }

    // ↑ — save and exit up
    if (e.key === 'ArrowUp') { e.preventDefault(); saveTitle(); onExitUp?.(); return }

    // ↓ — go to notes (if expanded) or exit down
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      saveTitle()
      if (isOpen && editorRef.current) editorRef.current.focusFirst()
      else onExitDown?.()
      return
    }

    // Escape — revert and blur
    if (e.key === 'Escape') { setTitleText(task.text); e.target.blur() }
  }

  const handleNotesChange = useCallback((newNotes) => {
    updateTask(task.id, { notes: newNotes })
  }, [task.id, updateTask])

  const handleNotesExitUp = useCallback(() => {
    setTimeout(() => {
      const el = titleRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, 30)
  }, [])

  const handleNotesExitDown = useCallback(() => {
    onExitDown?.()
  }, [onExitDown])

  /* Done tasks: read-only display */
  if (isDone) {
    return (
      <div style={{ opacity: 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '4px 0' }} className="outliner-row">
          <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0, marginTop: 1, padding: '2px 0', color: '#e0e0e0' }}>
            <ChevronIcon open={false} />
          </div>
          <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ marginTop: 2, flexShrink: 0 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#66bb6a' }}><UndoIcon /></div>
          </div>
          <div onClick={() => openDetail(task)} style={{ flex: 1, minWidth: 0, paddingLeft: 6, fontSize: 14, fontWeight: 500, color: '#bbb', textDecoration: 'line-through', cursor: 'pointer', padding: '2px 6px', lineHeight: '22px' }}>
            {task.text}{task.dueDate && <span style={{ fontSize: 11, color: '#ccc', marginLeft: 8, fontWeight: 400 }}>{task.dueDate}</span>}
          </div>
          <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0, marginTop: 2 }} className="outliner-actions">
            <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 3, display: 'flex' }}><TrashIcon /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Task title row — always editable (auto-edit mode) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '4px 0' }} className="outliner-row">
        <div onClick={() => toggleExpand(task.id)} style={{ cursor: 'pointer', padding: '2px 0', color: hasNotes ? '#999' : '#e0e0e0', width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <ChevronIcon open={isOpen && hasNotes} />
        </div>
        <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ marginTop: 2, flexShrink: 0 }}>
          <CheckIcon checked={false} size={16} />
        </div>
        <input
          ref={titleRef}
          value={titleText}
          onChange={e => setTitleText(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          onBlur={saveTitle}
          placeholder="할일 입력..."
          style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, border: 'none', outline: 'none', padding: '2px 6px', fontFamily: 'inherit', background: 'transparent', color: '#37352f', lineHeight: '22px', boxSizing: 'border-box' }}
        />
        {task.dueDate && <span style={{ fontSize: 11, color: '#ccc', fontWeight: 400, flexShrink: 0, marginTop: 4 }}>{task.dueDate}</span>}
        <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0, marginTop: 2 }} className="outliner-actions">
          <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 3, display: 'flex' }}><TrashIcon /></button>
        </div>
      </div>

      {/* Notes — shared OutlinerEditor with exit callbacks */}
      {isOpen && (
        <div style={{ marginLeft: 26, paddingLeft: 10, borderLeft: '1px solid #f0f0f0' }}>
          <OutlinerEditor
            ref={editorRef}
            notes={task.notes}
            onChange={handleNotesChange}
            accentColor={color.dot}
            onExitUp={handleNotesExitUp}
            onExitDown={handleNotesExitDown}
          />
        </div>
      )}
    </div>
  )
})

/* ── Add task button ── */
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
