import { useState } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import { COLOR } from '../../../styles/designTokens'

/* ═════════════════════════════════════════════
   QuickAddFab — 모바일 전용. 하단 고정 FAB + bottom sheet
   프로젝트 선택 + 제목 + 시간 카테고리 입력하여 빠르게 task 생성.
   ═════════════════════════════════════════════ */
const TIME_OPTIONS = [
  { key: 'today',   label: '지금' },
  { key: 'next',    label: '다음' },
  { key: 'backlog', label: '남은' },
]

export default function QuickAddFab({ projects }) {
  const addTask = useStore(s => s.addTask)
  const currentUserId = getCachedUserId()

  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [text, setText] = useState('')
  const [category, setCategory] = useState('today')

  const handleSubmit = async () => {
    const v = text.trim()
    if (!v || !projectId) return
    await addTask({
      text: v,
      projectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category,
    })
    setText('')
    setOpen(false)
  }

  const handleCancel = () => {
    setText('')
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => {
          if (!projectId && projects[0]) setProjectId(projects[0].id)
          setOpen(true)
        }}
        aria-label="새 할일 추가"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#37352f',
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          fontSize: 28,
          lineHeight: 1,
          cursor: 'pointer',
          zIndex: 900,
          fontFamily: 'inherit',
        }}
      >+</button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={handleCancel}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 950,
            }}
          />
          {/* Bottom sheet */}
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              background: '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: '20px 16px 24px',
              zIndex: 951,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: COLOR.textPrimary }}>새 할일</span>
              <div style={{ flex: 1 }} />
              <button onClick={handleCancel} style={{ border: 'none', background: 'transparent', fontSize: 18, color: COLOR.textTertiary, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            {/* 프로젝트 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLOR.textSecondary, marginBottom: 4, fontWeight: 500 }}>프로젝트</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 14,
                  border: `1px solid ${COLOR.border}`,
                  borderRadius: 8,
                  background: '#fff',
                  fontFamily: 'inherit',
                  color: COLOR.textPrimary,
                  boxSizing: 'border-box',
                }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 제목 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLOR.textSecondary, marginBottom: 4, fontWeight: 500 }}>제목</label>
              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="할일 내용을 입력하세요"
                rows={2}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 14,
                  border: `1px solid ${COLOR.border}`,
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  color: COLOR.textPrimary,
                  boxSizing: 'border-box',
                  resize: 'none',
                  lineHeight: 1.4,
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
                }}
              />
            </div>

            {/* 시간 카테고리 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLOR.textSecondary, marginBottom: 6, fontWeight: 500 }}>언제</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setCategory(opt.key)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 500,
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: category === opt.key ? '#37352f' : COLOR.bgHover,
                      color: category === opt.key ? '#fff' : COLOR.textSecondary,
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 500,
                  border: `1px solid ${COLOR.border}`,
                  borderRadius: 8,
                  background: '#fff',
                  color: COLOR.textSecondary,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >취소</button>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || !projectId}
                style={{
                  flex: 2,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 8,
                  background: text.trim() && projectId ? '#37352f' : COLOR.bgHover,
                  color: text.trim() && projectId ? '#fff' : COLOR.textTertiary,
                  cursor: text.trim() && projectId ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >추가</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
