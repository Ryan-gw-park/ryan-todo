import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT, CHECKBOX, LIST } from '../../../../styles/designTokens'

/* ═══════════════════════════════════════════════
   PersonalTodoTaskRow (Loop-45)
   한 task = 2 grid children: [MS col | task col]
   부모는 display:grid, grid-template-columns: projectCol msCol taskCol
   프로젝트 col은 ProjectGroup의 header cell(span)이 담당.

   - msLabel: 동일 MS 연속 2번째부터 '' (부모에서 dedup 후 전달)
   - '기타': keyMilestoneId==null → LIST.etcLabel 적용
   - useDraggable id = `bl-task:${task.id}` (Shell DnD handleDragEnd 가 처리)
     · 백로그 내 reorder 스펙 없으므로 useSortable 불필요
     · useSortable은 SortableContext 필수 전제인데 backlog는 미포함 → useDraggable이 정답
   - 체크박스 = TaskRow 패턴 (custom div + SVG)
   ═══════════════════════════════════════════════ */
export default function PersonalTodoTaskRow({ task, msLabel, isEtc }) {
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)
  const openDetail = useStore(s => s.openDetail)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bl-task:${task.id}`,
  })

  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)

  const dragStyle = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  }

  const finishEdit = (v) => {
    setEditing(false)
    const text = (v ?? '').trim()
    if (text && text !== task.text) updateTask(task.id, { text })
  }

  const msStyle = isEtc
    ? { fontStyle: LIST.etcLabel.fontStyle, color: LIST.etcLabel.color }
    : { color: COLOR.textSecondary }

  return (
    <>
      {/* col 2: MS label */}
      <div
        style={{
          padding: '4px 8px',
          fontSize: FONT.body,
          minWidth: 0,
          overflowWrap: 'break-word',
          wordBreak: 'keep-all',
          alignSelf: 'start',
          ...msStyle,
        }}
      >
        {msLabel || ''}
      </div>

      {/* col 3: checkbox + task text */}
      <div
        ref={setNodeRef}
        {...(editing ? {} : { ...attributes, ...listeners })}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...dragStyle,
          display: 'flex', alignItems: 'flex-start', gap: 6,
          padding: '4px 8px',
          cursor: editing ? 'text' : 'grab',
          background: hover && !editing ? COLOR.bgHover : 'transparent',
          borderRadius: 4,
          minWidth: 0,
        }}
      >
        {/* Checkbox (TaskRow 패턴, CHECKBOX 토큰) */}
        <div
          onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }}
          style={{
            width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius,
            flexShrink: 0, cursor: 'pointer', marginTop: 2,
            border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
            background: task.done ? CHECKBOX.checkedBg : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {task.done && (
            <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Text / inline edit */}
        {editing ? (
          <input
            autoFocus
            defaultValue={task.text}
            onBlur={e => finishEdit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); finishEdit(e.target.value) }
              if (e.key === 'Escape') setEditing(false)
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{
              flex: 1, fontSize: FONT.body, border: 'none', outline: 'none',
              background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0,
            }}
          />
        ) : (
          <span
            onClick={e => { e.stopPropagation(); e.preventDefault(); setEditing(true) }}
            style={{
              flex: 1, fontSize: FONT.body,
              color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
              textDecoration: task.done ? 'line-through' : 'none',
              lineHeight: 1.4, cursor: 'text',
              minWidth: 0, wordBreak: 'break-word', whiteSpace: 'normal',
            }}
          >{task.text}</span>
        )}

        {/* Detail arrow (hover only) */}
        {hover && !editing && (
          <div
            onClick={e => { e.stopPropagation(); e.preventDefault(); openDetail(task) }}
            style={{
              width: 16, height: 16, borderRadius: 3, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: 0.4,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </>
  )
}
