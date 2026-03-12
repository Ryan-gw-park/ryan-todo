import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { parseDateFromText } from '../../utils/dateParser'
import { SettingsIcon, PlusIcon, ChevronIcon, CheckIcon, UndoIcon, TrashIcon } from '../shared/Icons'
import OutlinerEditor from '../shared/OutlinerEditor'

const NON_DONE_CATS = CATEGORIES.filter(c => c.key !== 'done')

export default function ProjectView() {
  const { projects, tasks, setShowProjectMgr, collapseState, setCollapseValue } = useStore()
  const isMobile = window.innerWidth < 768
  const [activeProject, setActiveProject] = useState(projects[0]?.id || '')
  const expanded = collapseState.projectExpanded || {}
  const categoryRefs = useRef({})
  const pendingFocusProject = useRef(null)

  useEffect(() => {
    const newExp = {}
    tasks.forEach(t => { if (expanded[t.id] === undefined) newExp[t.id] = true })
    if (Object.keys(newExp).length) {
      for (const [k, v] of Object.entries(newExp)) setCollapseValue('projectExpanded', k, v)
    }
  }, [tasks.length])

  /* Focus first task after project switch */
  useEffect(() => {
    if (pendingFocusProject.current === activeProject) {
      pendingFocusProject.current = null
      // Try to focus first non-done category that has tasks, or activate its add button
      setTimeout(() => {
        for (const cat of NON_DONE_CATS) {
          const ref = categoryRefs.current[cat.key]
          if (ref?.focusFirst?.()) return // returns true if focused
        }
      }, 60)
    }
  }, [activeProject])

  /* Auto-focus on tab switch */
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        for (const cat of NON_DONE_CATS) {
          const ref = categoryRefs.current[cat.key]
          if (ref?.focusFirst?.()) return
        }
      }, 60)
    }
    window.addEventListener('view-focus', handler)
    return () => window.removeEventListener('view-focus', handler)
  }, [])

  /* Ctrl+←/→ to switch projects */
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const idx = projects.findIndex(pr => pr.id === activeProject)
        if (idx === -1) return
        const next = e.key === 'ArrowLeft'
          ? (idx - 1 + projects.length) % projects.length
          : (idx + 1) % projects.length
        pendingFocusProject.current = projects[next].id
        setActiveProject(projects[next].id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeProject, projects])

  const p = projects.find(pr => pr.id === activeProject) || projects[0]
  if (!p) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>프로젝트를 추가하세요</div>

  const c = getColor(p.color)
  const toggleExpand = (id) => setCollapseValue('projectExpanded', id, !(expanded[id] !== false))

  /* Cross-category navigation: exit down from one → enter next. Returns true if focus moved. */
  const handleExitSectionDown = (catIndex) => {
    for (let i = catIndex + 1; i < CATEGORIES.length; i++) {
      const ref = categoryRefs.current[CATEGORIES[i].key]
      if (ref?.focusFirst?.()) return true
    }
    return false
  }

  const handleExitSectionUp = (catIndex) => {
    for (let i = catIndex - 1; i >= 0; i--) {
      const ref = categoryRefs.current[CATEGORIES[i].key]
      if (ref?.focusLast?.()) return true
    }
    return false
  }

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
        <p style={{ fontSize: 13, color: '#bbb', marginBottom: 28, paddingLeft: 26 }}>↑↓ 자유 이동 · Enter 새 항목/분리 · Tab 레벨 · Alt+Shift+↑↓ 순서 이동 · Ctrl+←/→ 프로젝트 이동</p>

        {/* Category sections */}
        {CATEGORIES.map((cat, ci) => {
          const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key).sort((a, b) => a.sortOrder - b.sortOrder)
          return (
            <CategorySection
              key={cat.key}
              ref={el => categoryRefs.current[cat.key] = el}
              cat={cat}
              catTasks={catTasks}
              projectId={p.id}
              color={c}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onExitSectionDown={() => handleExitSectionDown(ci)}
              onExitSectionUp={() => handleExitSectionUp(ci)}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ── Category section — manages inter-task navigation ── */
const CategorySection = forwardRef(function CategorySection({ cat, catTasks, projectId, color, expanded, toggleExpand, onExitSectionDown, onExitSectionUp }, ref) {
  const { addTask, updateTask, deleteTask, collapseState, toggleCollapse } = useStore()
  const taskRefs = useRef({})
  const addBtnRef = useRef(null)
  const pendingFocusRef = useRef(null)
  const isDoneCat = cat.key === 'done'
  const sectionKey = `${projectId}:${cat.key}`
  const sectionCollapsed = collapseState.projectSection?.[sectionKey]

  /* Expose focusFirst / focusLast to parent for cross-category nav */
  useImperativeHandle(ref, () => ({
    focusFirst: () => {
      if (isDoneCat) return false
      if (catTasks.length > 0) {
        taskRefs.current[catTasks[0].id]?.focusTitle('start')
        return true
      }
      // No tasks → activate add button
      if (addBtnRef.current?.activate) {
        addBtnRef.current.activate()
        return true
      }
      return false
    },
    focusLast: () => {
      if (isDoneCat) return false
      if (catTasks.length > 0) {
        taskRefs.current[catTasks[catTasks.length - 1].id]?.focusLast()
        return true
      }
      if (addBtnRef.current?.activate) {
        addBtnRef.current.activate()
        return true
      }
      return false
    },
  }))

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

  /* Handle exit down from last task — go to add button, then next section */
  const handleTaskExitDown = useCallback((i) => {
    if (i < catTasks.length - 1) {
      taskRefs.current[catTasks[i + 1].id]?.focusTitle('start')
    } else if (!isDoneCat && addBtnRef.current?.activate) {
      addBtnRef.current.activate()
    } else {
      onExitSectionDown?.()
    }
  }, [catTasks, isDoneCat, onExitSectionDown])

  const handleTaskExitUp = useCallback((i) => {
    if (i > 0) {
      taskRefs.current[catTasks[i - 1].id]?.focusLast()
    } else {
      onExitSectionUp?.()
    }
  }, [catTasks, onExitSectionUp])

  /* Handle add button down arrow → next section. Returns true if focus moved. */
  const handleAddExitDown = useCallback(() => {
    return onExitSectionDown?.() || false
  }, [onExitSectionDown])

  /* Handle add button up arrow → last task in this section, or previous section */
  const handleAddExitUp = useCallback(() => {
    if (catTasks.length > 0) {
      taskRefs.current[catTasks[catTasks.length - 1].id]?.focusLast()
      return true
    }
    return onExitSectionUp?.() || false
  }, [catTasks, onExitSectionUp])

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `2px solid ${isDoneCat ? '#e0e0e0' : color.dot}20`, marginBottom: 8 }}>
        <span style={{ fontSize: 15 }}>{cat.emoji}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: isDoneCat ? '#999' : '#37352f' }}>{cat.label}</span>
        <span style={{ fontSize: 11, color: isDoneCat ? '#aaa' : color.dot, background: isDoneCat ? '#f0f0f0' : color.header, borderRadius: 8, padding: '1px 8px', fontWeight: 600 }}>{catTasks.length}</span>
        {!isDoneCat && catTasks.length > 0 && (
          <button
            onClick={() => toggleCollapse('projectSection', sectionKey)}
            title={sectionCollapsed ? '모든 노트 펼치기' : '모든 노트 접기'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2, display: 'flex', marginLeft: 'auto' }}
            onMouseEnter={e => e.currentTarget.style.color = color.dot}
            onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              {sectionCollapsed ? (
                <>
                  <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M10 5l2-2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              ) : (
                <>
                  <path d="M2 3h10M2 7h6M2 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M12 7l-2 2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              )}
            </svg>
          </button>
        )}
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
            sectionCollapsed={sectionCollapsed}
            onExitUp={() => handleTaskExitUp(i)}
            onExitDown={() => handleTaskExitDown(i)}
            onTitleEnter={(afterText) => handleTitleEnter(i, afterText)}
            onTitleBackspace={() => handleTitleBackspace(i)}
            onSwapUp={() => handleSwap(i, -1)}
            onSwapDown={() => handleSwap(i, 1)}
          />
        ))}
        {!isDoneCat && <AddTaskButton ref={addBtnRef} projectId={projectId} category={cat.key} color={color} onExitDown={handleAddExitDown} onExitUp={handleAddExitUp} />}
      </div>
    </div>
  )
})

/* ── Task node — always-editable title + outliner notes ── */
const OutlinerTaskNode = forwardRef(function OutlinerTaskNode(
  { task, color, expanded, toggleExpand, sectionCollapsed, onExitUp, onExitDown, onTitleEnter, onTitleBackspace, onSwapUp, onSwapDown },
  ref
) {
  const { toggleDone, updateTask, deleteTask, openDetail, collapseState: cs, setCollapseValue: setCV } = useStore()
  const titleRef = useRef(null)
  const editorRef = useRef(null)
  const [titleText, setTitleText] = useState(task.text)
  const allTopCollapsed = cs.projectAllTop?.[task.id]

  // Sync section-level collapse to per-task allTopCollapsed
  useEffect(() => {
    if (sectionCollapsed !== undefined) setCV('projectAllTop', task.id, sectionCollapsed)
  }, [sectionCollapsed])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }} className="outliner-row">
          <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0, color: '#e0e0e0' }}>
            <ChevronIcon open={false} />
          </div>
          <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ flexShrink: 0, display: 'flex' }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#66bb6a' }}><UndoIcon /></div>
          </div>
          <div onClick={() => openDetail(task)} style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: '#bbb', textDecoration: 'line-through', cursor: 'pointer', padding: '2px 6px', lineHeight: '22px' }}>
            {task.text}{task.dueDate && <span style={{ fontSize: 11, color: '#ccc', marginLeft: 8, fontWeight: 400 }}>{task.dueDate}</span>}
          </div>
          <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }} className="outliner-actions">
            <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 3, display: 'flex' }}><TrashIcon /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Task title row — always editable (auto-edit mode) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }} className="outliner-row">
        <div onClick={() => toggleExpand(task.id)} style={{ cursor: 'pointer', color: hasNotes ? '#999' : '#e0e0e0', width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronIcon open={isOpen && hasNotes} />
        </div>
        <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ flexShrink: 0, display: 'flex' }}>
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
        {task.dueDate && <span style={{ fontSize: 11, color: '#ccc', fontWeight: 400, flexShrink: 0 }}>{task.dueDate}</span>}
        <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }} className="outliner-actions">
          <button
            onClick={() => setCV('projectAllTop', task.id, !allTopCollapsed)}
            title={allTopCollapsed ? '모든 항목 펼치기' : '모든 항목 접기'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 3, display: 'flex' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              {allTopCollapsed ? (
                <>
                  <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M10 5l2-2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              ) : (
                <>
                  <path d="M2 3h10M2 7h6M2 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M12 7l-2 2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              )}
            </svg>
          </button>
          <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 3, display: 'flex' }}><TrashIcon /></button>
        </div>
      </div>

      {/* Notes — shared OutlinerEditor with exit callbacks */}
      {isOpen && (
        <div style={{ marginLeft: 26, paddingLeft: 10, borderLeft: '1px solid #f0f0f0', marginTop: -2 }}>
          <OutlinerEditor
            ref={editorRef}
            notes={task.notes}
            onChange={handleNotesChange}
            accentColor={color.dot}
            onExitUp={handleNotesExitUp}
            onExitDown={handleNotesExitDown}
            allTopCollapsed={allTopCollapsed}
          />
        </div>
      )}
    </div>
  )
})

/* ── Add task button ── */
const AddTaskButton = forwardRef(function AddTaskButton({ projectId, category, color, onExitDown, onExitUp }, ref) {
  const { addTask } = useStore()
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    activate: () => {
      setAdding(true)
      setText('')
      setTimeout(() => inputRef.current?.focus(), 40)
    },
  }))

  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus() }, [adding])

  const handleAdd = () => {
    if (!text.trim()) { setAdding(false); return }
    const { startDate, dueDate } = parseDateFromText(text.trim())
    addTask({ text: text.trim(), projectId, category, startDate, dueDate })
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setAdding(false); setText('') }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!text.trim() && onExitDown?.()) setAdding(false) }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!text.trim()) { setAdding(false); onExitUp?.() } }
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
      <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (text.trim()) handleAdd(); else setAdding(false) }}
        placeholder="새 할일 입력..."
        style={{ flex: 1, fontSize: 14, fontWeight: 500, border: 'none', borderBottom: `2px solid ${color.dot}`, outline: 'none', padding: '4px 0', fontFamily: 'inherit', background: 'transparent', color: '#37352f' }} />
    </div>
  )
})
