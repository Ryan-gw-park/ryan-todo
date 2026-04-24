import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../../../hooks/useStore'
import { COLOR, FONT, CHECKBOX, SPACE } from '../../../../styles/designTokens'

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
  const openDetail = useStore(s => s.openDetail)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `focus-card:${task.id}`,
  })

  const [hover, setHover] = useState(false)

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
      style={{
        ...sortableStyle,
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: SPACE.cardPadding,
        background: '#fff',
        border: `1px solid ${COLOR.border}`,
        borderRadius: 6,
        marginBottom: 6,
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
          onClick={() => openDetail(task)}
          style={{
            fontSize: FONT.body,
            color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
            textDecoration: task.done ? 'line-through' : 'none',
            lineHeight: 1.4, cursor: 'pointer',
            wordBreak: 'break-word',
          }}
        >
          {task.text}
        </div>
        {(projectLabel || milestone?.title) && (
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
          </div>
        )}
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
