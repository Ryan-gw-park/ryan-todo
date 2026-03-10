import { useEffect, useRef, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { parseDateFromText } from '../../utils/dateParser'
import OutlinerEditor from './OutlinerEditor'

export default function DetailPanel() {
  const { detailTask, closeDetail, tasks, projects, updateTask, deleteTask, toggleDone } = useStore()
  const isMobile = window.innerWidth < 768

  const task = detailTask ? tasks.find(t => t.id === detailTask.id) : null
  if (!task) return null

  const p = projects.find(pr => pr.id === task.projectId)
  const c = p ? getColor(p.color) : getColor('blue')

  const debounceRef = useRef(null)
  const handleNotesChange = useCallback((newNotes) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateTask(task.id, { notes: newNotes })
    }, 800)
    // Optimistic local update
    useStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === task.id ? { ...t, notes: newNotes } : t)
    }))
  }, [task.id, updateTask])

  return (
    <>
      <div onClick={closeDetail} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 90, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: isMobile ? '100%' : 480, background: 'white', zIndex: 100, boxShadow: '-4px 0 24px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#999', fontSize: 18, lineHeight: 1 }}>✕</button>
            <button onClick={() => deleteTask(task.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>삭제</button>
          </div>
          <input
            defaultValue={task.text}
            key={task.id + task.text}
            onBlur={e => {
              const v = e.target.value.trim()
              if (v && v !== task.text) {
                const { startDate, dueDate } = parseDateFromText(v)
                const patch = { text: v }
                if (startDate) patch.startDate = startDate
                if (dueDate) patch.dueDate = dueDate
                updateTask(task.id, patch)
              }
            }}
            style={{ width: '100%', fontSize: 20, fontWeight: 600, color: '#37352f', border: 'none', outline: 'none', padding: 0, fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box' }}
          />
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
          {/* Project */}
          <DetailRow label="프로젝트">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c.header, color: c.text, padding: '3px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.dot }} />
              {p?.name}
            </span>
          </DetailRow>

          {/* Category */}
          <DetailRow label="카테고리">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CATEGORIES.filter(ct => ct.key !== 'done').map(ct => (
                <button
                  key={ct.key}
                  onClick={() => updateTask(task.id, { category: ct.key, done: false, prevCategory: '' })}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, border: task.category === ct.key ? '1.5px solid #37352f' : '1px solid #e0e0e0', background: task.category === ct.key ? '#f7f7f7' : 'white', color: '#37352f' }}
                >
                  {ct.emoji} {ct.label}
                </button>
              ))}
              {task.category === 'done' && <span style={{ fontSize: 12, color: '#2e7d32', background: '#e8f5e9', padding: '4px 10px', borderRadius: 6, fontWeight: 500 }}>✅ 완료</span>}
            </div>
          </DetailRow>

          {/* Start Date */}
          <DetailRow label="시작일">
            <input
              type="date"
              defaultValue={task.startDate || ''}
              key={task.id + '-start-' + task.startDate}
              onChange={e => updateTask(task.id, { startDate: e.target.value })}
              style={{ fontSize: 13, border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', color: '#37352f', fontFamily: 'inherit' }}
            />
          </DetailRow>

          {/* Due Date */}
          <DetailRow label="마감일">
            <input
              type="date"
              defaultValue={task.dueDate || ''}
              key={task.id + '-due-' + task.dueDate}
              onChange={e => updateTask(task.id, { dueDate: e.target.value })}
              style={{ fontSize: 13, border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', color: '#37352f', fontFamily: 'inherit' }}
            />
          </DetailRow>

          {/* Status */}
          <DetailRow label="상태">
            {task.category === 'done'
              ? <button onClick={() => { toggleDone(task.id); closeDetail() }} style={{ fontSize: 12, color: '#f57c00', background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>↩ 되돌리기</button>
              : <button onClick={() => { toggleDone(task.id); closeDetail() }} style={{ fontSize: 12, color: '#2e7d32', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>✓ 완료 처리</button>
            }
          </DetailRow>

          {/* Notes */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>📝 노트</span>
              <span style={{ fontSize: 11, color: '#bbb' }}>프로젝트 뷰와 동기화</span>
            </div>
            <OutlinerEditor notes={task.notes} onChange={handleNotesChange} accentColor={c.dot} />
          </div>
        </div>
      </div>
    </>
  )
}

function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 36, marginBottom: 6 }}>
      <div style={{ width: 80, fontSize: 12, color: '#999', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}
