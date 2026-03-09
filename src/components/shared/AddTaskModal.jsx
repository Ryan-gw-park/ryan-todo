import { useState, useEffect, useRef } from 'react'
import useStore from '../../store/useStore'

export default function AddTaskModal() {
  const { modalOpen, modalDefaults, closeModal, addTask, projects, categories } = useStore()
  const [text, setText] = useState('')
  const [projId, setProjId] = useState('')
  const [catId, setCatId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const inputRef = useRef()

  useEffect(() => {
    if (modalOpen) {
      setText('')
      setProjId(modalDefaults.projectId || projects[0]?.id || '')
      setCatId(modalDefaults.categoryId || categories[0]?.id || '')
      setStartDate('')
      setDueDate('')
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [modalOpen, modalDefaults, projects, categories])

  const handleSave = () => {
    if (!text.trim()) { inputRef.current?.focus(); return }
    addTask({
      text: text.trim(),
      projectId: projId,
      categoryId: catId,
      startDate,
      dueDate,
    })
    closeModal()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleSave()
    }
  }

  if (!modalOpen) return null

  return (
    <div
      className="fixed inset-0 z-[300] bg-[rgba(15,15,15,.4)] backdrop-blur-sm flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) closeModal() }}
      onKeyDown={e => { if (e.key === 'Escape') closeModal() }}
    >
      <div className="w-full max-w-[520px] bg-white rounded-t-[14px] border-t border-[rgba(55,53,47,.09)] p-3.5 pb-[calc(30px+env(safe-area-inset-bottom))] animate-[slideUp_0.2s_cubic-bezier(.32,.72,0,1)] shadow-[0_-6px_28px_rgba(15,15,15,.1)]">
        <div className="w-[30px] h-1 rounded-sm bg-[#eeece9] mx-auto mb-3" />
        <div className="text-sm font-bold mb-3">새 할 일</div>

        <div className="mb-[9px]" onKeyDown={handleKeyDown}>
          <label className="block text-[10px] font-semibold text-[rgba(55,53,47,.65)] uppercase tracking-wide mb-1">할 일</label>
          <input
            ref={inputRef}
            className="w-full py-[9px] px-[10px] bg-white border border-[rgba(55,53,47,.16)] rounded text-[13px] transition-all focus:border-[#2383e2] focus:shadow-[0_0_0_2px_rgba(35,131,226,.08)] focus:outline-none"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="무엇을 해야 하나요?"
          />
        </div>

        <div className="grid grid-cols-2 gap-[9px] md:grid-cols-2" onKeyDown={handleKeyDown}>
          <div className="mb-[9px]">
            <label className="block text-[10px] font-semibold text-[rgba(55,53,47,.65)] uppercase tracking-wide mb-1">프로젝트</label>
            <select
              className="w-full py-[9px] px-[10px] bg-white border border-[rgba(55,53,47,.16)] rounded text-[13px] transition-all focus:border-[#2383e2] focus:outline-none appearance-none"
              value={projId}
              onChange={e => setProjId(e.target.value)}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="mb-[9px]">
            <label className="block text-[10px] font-semibold text-[rgba(55,53,47,.65)] uppercase tracking-wide mb-1">구분</label>
            <select
              className="w-full py-[9px] px-[10px] bg-white border border-[rgba(55,53,47,.16)] rounded text-[13px] transition-all focus:border-[#2383e2] focus:outline-none appearance-none"
              value={catId}
              onChange={e => setCatId(e.target.value)}
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[9px]" onKeyDown={handleKeyDown}>
          <div className="mb-[9px]">
            <label className="block text-[10px] font-semibold text-[rgba(55,53,47,.65)] uppercase tracking-wide mb-1">시작일</label>
            <input
              type="date"
              className="w-full py-[9px] px-[10px] bg-white border border-[rgba(55,53,47,.16)] rounded text-[13px] transition-all focus:border-[#2383e2] focus:outline-none"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="mb-[9px]">
            <label className="block text-[10px] font-semibold text-[rgba(55,53,47,.65)] uppercase tracking-wide mb-1">마감일</label>
            <input
              type="date"
              className="w-full py-[9px] px-[10px] bg-white border border-[rgba(55,53,47,.16)] rounded text-[13px] transition-all focus:border-[#2383e2] focus:outline-none"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={closeModal}
            className="flex-1 py-[10px] text-center rounded border-none bg-transparent text-[rgba(55,53,47,.65)] text-xs cursor-pointer hover:bg-[rgba(55,53,47,.08)]"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-[10px] text-center rounded border-none bg-[#2383e2] text-white text-[13px] font-semibold cursor-pointer hover:opacity-[.88]"
          >
            저장
          </button>
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%) } }`}</style>
    </div>
  )
}
