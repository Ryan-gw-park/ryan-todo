import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import useStore from '../../../hooks/useStore'
import { parseDateFromText } from '../../../utils/dateParser'
import { ChevronIcon, CheckIcon, UndoIcon, TrashIcon } from '../../shared/Icons'
import OutlinerEditor from '../../shared/OutlinerEditor'

/* ── Task node — always-editable title + outliner notes ── */
const OutlinerTaskNode = forwardRef(function OutlinerTaskNode(
  { task, color, expanded, toggleExpand, memberMap, sectionCollapsed, onExitUp, onExitDown, onTitleEnter, onTitleBackspace, onSwapUp, onSwapDown },
  ref
) {
  const { toggleDone, updateTask, deleteTask, openDetail, collapseState: cs, setCollapseValue: setCV, currentTeamId: teamId } = useStore()
  const assigneeName = teamId && task.assigneeId ? memberMap[task.assigneeId] : null
  const isMobile = window.innerWidth < 768
  // 할일 제목: 데스크탑 14px, 모바일 13px
  const taskFontSize = isMobile ? 13 : 14
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
          <div onClick={() => openDetail(task)} style={{ flex: 1, minWidth: 0, fontSize: taskFontSize, fontWeight: 600, color: '#bbb', textDecoration: 'line-through', cursor: 'pointer', padding: '2px 6px', lineHeight: '22px' }}>
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
          data-task-title
          value={titleText}
          onChange={e => setTitleText(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          onBlur={saveTitle}
          placeholder="할일 입력..."
          style={{ flex: 1, minWidth: 0, fontSize: taskFontSize, fontWeight: 600, border: 'none', outline: 'none', padding: '2px 6px', fontFamily: 'inherit', background: 'transparent', color: '#37352f', lineHeight: '22px', boxSizing: 'border-box' }}
        />
        {assigneeName && <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500, flexShrink: 0 }}>{assigneeName}</span>}
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

export default OutlinerTaskNode
