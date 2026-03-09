import { useState, useEffect, useRef, useCallback } from 'react'
import useStore from '../../store/useStore'

const BULLETS = ['•', '◦', '▸', '–', '·']

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export default function TaskDetailPanel() {
  const { detailTaskId, closeDetail, tasks, projects, categories, updateTask, deleteTask, showToast } = useStore()
  const task = tasks.find(t => t.id === detailTaskId)

  const [title, setTitle] = useState('')
  const [done, setDone] = useState(false)
  const [projId, setProjId] = useState('')
  const [catId, setCatId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState([])
  const noteRefs = useRef([])

  useEffect(() => {
    if (task) {
      setTitle(task.text)
      setDone(task.done)
      setProjId(task.projectId)
      setCatId(task.categoryId)
      setStartDate(task.startDate || '')
      setDueDate(task.dueDate || '')
      setNotes(
        task.notes && task.notes.length
          ? JSON.parse(JSON.stringify(task.notes))
          : [{ id: uid(), text: '', level: 0 }]
      )
    }
  }, [task])

  const handleSave = useCallback(() => {
    if (!task) return
    updateTask(task.id, {
      text: title.trim() || task.text,
      done,
      projectId: projId,
      categoryId: catId,
      startDate,
      dueDate,
      notes: notes.filter(n => n.text.trim()),
    })
    closeDetail()
    showToast('저장됐습니다 ✓')
  }, [task, title, done, projId, catId, startDate, dueDate, notes, updateTask, closeDetail, showToast])

  const handleDelete = () => {
    if (!task || !confirm('이 할 일을 삭제할까요?')) return
    deleteTask(task.id)
    closeDetail()
  }

  const handleNoteChange = (noteId, text) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, text } : n))
  }

  const handleNoteKey = (e, noteId, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const note = notes.find(n => n.id === noteId)
      const newNote = { id: uid(), text: '', level: note.level }
      setNotes(prev => {
        const next = [...prev]
        next.splice(idx + 1, 0, newNote)
        return next
      })
      setTimeout(() => noteRefs.current[idx + 1]?.focus(), 50)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setNotes(prev => prev.map(n =>
        n.id === noteId
          ? { ...n, level: e.shiftKey ? Math.max(0, n.level - 1) : Math.min(4, n.level + 1) }
          : n
      ))
    } else if (e.key === 'Backspace' && !e.target.value && notes.length > 1) {
      e.preventDefault()
      setNotes(prev => prev.filter(n => n.id !== noteId))
      setTimeout(() => {
        const prevIdx = Math.max(0, idx - 1)
        const inp = noteRefs.current[prevIdx]
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length) }
      }, 50)
    } else if (e.key === 'ArrowUp' && noteRefs.current[idx - 1]) {
      e.preventDefault(); noteRefs.current[idx - 1].focus()
    } else if (e.key === 'ArrowDown' && noteRefs.current[idx + 1]) {
      e.preventDefault(); noteRefs.current[idx + 1].focus()
    }
  }

  const isOpen = !!detailTaskId

  return (
    <>
      <div
        className={`fixed inset-0 bg-[rgba(15,15,15,.4)] backdrop-blur-[2px] z-[200] transition-opacity ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeDetail}
      />
      <div
        className={`fixed right-0 top-0 bottom-0 w-[min(560px,100vw)] bg-white border-l border-[rgba(55,53,47,.09)] shadow-[-6px_0_28px_rgba(15,15,15,.08)] z-[201] flex flex-col transition-transform duration-[240ms] ease-[cubic-bezier(.32,.72,0,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {task && (
          <>
            <div className="flex items-center gap-[6px] px-[11px] py-[9px] border-b border-[rgba(55,53,47,.09)] flex-none min-h-[43px]">
              <button onClick={closeDetail} className="w-[27px] h-[27px] rounded-sm border-none bg-transparent cursor-pointer text-[rgba(55,53,47,.65)] text-[17px] flex items-center justify-center hover:bg-[rgba(55,53,47,.08)]">←</button>
              <div
                onClick={() => setDone(d => !d)}
                className="w-[17px] h-[17px] flex-none rounded border-2 cursor-pointer flex items-center justify-center transition-all"
                style={{
                  background: done ? '#0f7b6c' : 'transparent',
                  borderColor: done ? '#0f7b6c' : 'rgba(55,53,47,.16)',
                }}
              >
                {done && <span className="text-[10px] text-white font-bold">✓</span>}
              </div>
              <input
                className="flex-1 border-none bg-transparent text-[15px] font-semibold text-[rgb(55,53,47)] py-[2px] px-1 rounded-sm hover:bg-[rgba(55,53,47,.04)] focus:bg-[rgba(55,53,47,.08)] focus:outline-none"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="할 일"
              />
              <button onClick={handleDelete} className="px-[7px] py-1 rounded border-none bg-transparent cursor-pointer text-xs text-[rgba(55,53,47,.65)] hover:bg-[rgba(224,62,62,.08)] hover:text-red-600">삭제</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5">
              <div className="mb-[18px] flex flex-col">
                <MetaRow label="프로젝트">
                  <select className="border-none bg-transparent text-xs p-[2px_4px] rounded cursor-pointer flex-1 focus:bg-[rgba(55,53,47,.08)] focus:outline-none" value={projId} onChange={e => setProjId(e.target.value)}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </MetaRow>
                <MetaRow label="구분">
                  <select className="border-none bg-transparent text-xs p-[2px_4px] rounded cursor-pointer flex-1 focus:bg-[rgba(55,53,47,.08)] focus:outline-none" value={catId} onChange={e => setCatId(e.target.value)}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </MetaRow>
                <MetaRow label="시작일">
                  <input type="date" className="border-none bg-transparent text-xs p-[2px_4px] rounded cursor-pointer flex-1 focus:bg-[rgba(55,53,47,.08)] focus:outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </MetaRow>
                <MetaRow label="마감일">
                  <input type="date" className="border-none bg-transparent text-xs p-[2px_4px] rounded cursor-pointer flex-1 focus:bg-[rgba(55,53,47,.08)] focus:outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </MetaRow>
              </div>

              <div className="text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider mb-[7px] px-[5px]">노트</div>
              <div className="flex flex-col">
                {notes.map((note, idx) => (
                  <div key={note.id} className="flex items-start rounded-sm hover:bg-[rgba(55,53,47,.04)] min-h-[28px]" style={{ paddingLeft: note.level * 20 }}>
                    <div className="w-5 h-7 flex-none flex items-center justify-center text-[rgba(55,53,47,.4)] text-[11px] select-none">
                      {BULLETS[Math.min(note.level, BULLETS.length - 1)]}
                    </div>
                    <input
                      ref={el => noteRefs.current[idx] = el}
                      className="flex-1 border-none bg-transparent text-[13px] text-[rgb(55,53,47)] py-1 leading-normal min-w-0 focus:outline-none placeholder:text-[rgba(55,53,47,.4)]"
                      value={note.text}
                      onChange={e => handleNoteChange(note.id, e.target.value)}
                      onKeyDown={e => handleNoteKey(e, note.id, idx)}
                      placeholder={idx === 0 ? '노트 입력 (Tab: 들여쓰기, Enter: 새 줄)' : ''}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3.5 py-[9px] border-t border-[rgba(55,53,47,.09)] flex gap-2 flex-none">
              <button onClick={closeDetail} className="flex-1 py-[7px] text-center rounded border-none bg-transparent cursor-pointer text-xs text-[rgba(55,53,47,.65)] hover:bg-[rgba(55,53,47,.08)]">닫기</button>
              <button onClick={handleSave} className="flex-1 py-[9px] text-center rounded border-none bg-[#2383e2] text-white text-[13px] font-semibold cursor-pointer hover:opacity-[.88]">저장</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-center py-[5px] px-[5px] rounded-sm hover:bg-[rgba(55,53,47,.04)] gap-[9px] min-h-[34px]">
      <span className="text-xs text-[rgba(55,53,47,.65)] w-[60px] flex-none">{label}</span>
      {children}
    </div>
  )
}
