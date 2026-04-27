import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import usePivotExpandState from '../../../../hooks/usePivotExpandState'
import { COLOR, FONT } from '../../../../styles/designTokens'

/* ═══════════════════════════════════════════════
   FocusQuickAddInput (Loop-45)
   Enter → addTask({ text, projectId: INSTANT, isFocus: true, category: 'today' })
   F-21: 포커스 패널에만 즉시 표시 (assigneeId는 addTask 내부 기본값 사용)

   props.instantProjectId: '즉시' project id. 없으면 input 비활성 (대신 placeholder).
   ═══════════════════════════════════════════════ */
export default function FocusQuickAddInput({ instantProjectId, currentUserId }) {
  const addTask = useStore(s => s.addTask)
  const { setPivotCollapsed: setExpanded } = usePivotExpandState('focusCardExpanded')
  const [value, setValue] = useState('')

  const handleAdd = async () => {
    const text = value.trim()
    if (!text) return
    if (!instantProjectId) {
      // '즉시' 프로젝트 seed 실패 상태 — 호출 skip.
      return
    }
    const t = await addTask({
      text,
      projectId: instantProjectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: null,
      category: 'today',
      isFocus: true,
    })
    // E-10: 생성 직후 자동 펼침 (노트 바로 입력 가능)
    if (t?.id) setExpanded(t.id, true)
    setValue('')
  }

  const disabled = !instantProjectId

  return (
    <div style={{ marginBottom: 8 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
          if (e.key === 'Escape') setValue('')
        }}
        disabled={disabled}
        placeholder={disabled ? '준비 중…' : '+ 포커스 할일 추가 후 Enter'}
        style={{
          width: '100%', boxSizing: 'border-box',
          fontSize: FONT.body, fontFamily: 'inherit',
          padding: '6px 10px',
          border: `1px solid ${COLOR.border}`, borderRadius: 6,
          background: disabled ? COLOR.bgSurface : '#fff',
          color: COLOR.textPrimary,
          outline: 'none',
        }}
      />
    </div>
  )
}
