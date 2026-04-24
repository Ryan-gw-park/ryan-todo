import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT, CHECKBOX, SPACE } from '../../../../styles/designTokens'
import { isEmptyNotes } from '../../../../utils/notes'

/* ═══════════════════════════════════════════════
   FocusCard (Loop-45)
   우측 포커스 패널의 한 카드 = [⋮⋮ ☐ text / project·ms meta ×]

   - useSortable id = `focus-card:${task.id}` (F-26)
   - × → updateTask({ isFocus: false }) — category 보존 (F-18, N-09)
   - 체크박스 → toggleDone (F-19, 양쪽에서 사라짐)
   - 프로젝트가 isSystem이면 "프로젝트 미지정" (F-22)
   ═══════════════════════════════════════════════ */
export default function FocusCard({ task, project, milestone }) {
  const toggleDone = useStore(s => s.toggleDone)
  const updateTask = useStore(s => s.updateTask)
  const setSelectedFocusTaskId = useStore(s => s.setSelectedFocusTaskId)
  const selectedFocusTaskId = useStore(s => s.selectedFocusTaskId)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `focus-card:${task.id}`,
  })

  const [hover, setHover] = useState(false)
  const isSelected = selectedFocusTaskId === task.id
  const hasNotes = !isEmptyNotes(task.notes)

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const handleUnfocus = (e) => {
    e.stopPropagation()
    e.preventDefault()
    updateTask(task.id, { isFocus: false })
  }

  const projectLabel = project?.isSystem ? '프로젝트 미지정' : (project?.name || '')
  const projectLabelStyle = project?.isSystem
    ? { fontStyle: 'italic', color: COLOR.textTertiary }
    : { color: COLOR.textTertiary }

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setSelectedFocusTaskId(task.id)}
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: SPACE.cardPadding,
        background: '#fff',
        border: `1px solid ${isSelected ? COLOR.accent : COLOR.border}`,
        borderRadius: 6,
        marginBottom: 6,
        cursor: 'pointer',
      }}
    >
      {/* Drag handle ⋮⋮ */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab', color: COLOR.textTertiary,
          fontSize: 14, lineHeight: 1, userSelect: 'none',
          padding: '2px 2px', flexShrink: 0, marginTop: 1,
        }}
        title="드래그하여 이동"
      >⋮⋮</div>

      {/* Checkbox */}
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

      {/* Text + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: FONT.body,
            color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
            textDecoration: task.done ? 'line-through' : 'none',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {task.text}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 2, fontSize: FONT.ganttMs,
        }}>
          {projectLabel && (
            <span style={projectLabelStyle}>{projectLabel}</span>
          )}
          {milestone?.title && (
            <span style={{ color: COLOR.textTertiary }}>
              {projectLabel ? '·' : ''} {milestone.title}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {/* F-37: 노트 아이콘 (hasNotes → accent, 빈 노트 → 옅은 회색) */}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            style={{ color: hasNotes ? COLOR.accent : '#d3d1c7', flexShrink: 0 }}
            aria-label={hasNotes ? '노트 있음' : '노트 없음'}
          >
            <path
              d="M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5"
              stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" fill="none"
            />
          </svg>
        </div>
      </div>

      {/* × (포커스 해제) */}
      <div
        onClick={handleUnfocus}
        style={{
          width: 20, height: 20, borderRadius: 3, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: COLOR.textTertiary,
          fontSize: 14, lineHeight: 1,
          opacity: hover ? 1 : 0.4,
          transition: 'opacity 0.15s',
        }}
        title="포커스 해제"
      >
        ×
      </div>
    </div>
  )
}
