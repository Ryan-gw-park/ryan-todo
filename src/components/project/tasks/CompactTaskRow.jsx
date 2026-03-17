import { useState, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import OutlinerEditor from '../../shared/OutlinerEditor'

const fmtDate = (d) => {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return ''
  const m = dt.getMonth() + 1
  const day = dt.getDate()
  return `${m}/${day}`
}

/**
 * CompactTaskRow - 1줄 높이의 컴팩트한 태스크 행
 * - 체크박스 + 제목(인라인 편집) + 마감일 + 담당자 + 상세아이콘
 * - 빈 영역 클릭 → 마일스톤 접기/펼치기
 * - 빈 영역 드래그 → 마일스톤 변경/순서 변경
 * - 펼침 시 OutlinerEditor로 노트 표시
 */
export default function CompactTaskRow({
  task,
  expanded,
  onToggleExpand,
  onToggleDone,
  onClickTask,
  onUpdateNote,
  onUpdateTitle,
  onToggleMilestone,
  milestoneId,
  milestoneColor,
  assigneeName,
}) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef(null)
  const hasNotes = task.notes && task.notes.trim().length > 0

  // Draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-drag-${task.id}`,
    data: { type: 'compact-task', taskId: task.id, sourceMsId: milestoneId },
  })

  const startEdit = (e) => {
    e.stopPropagation()
    setEditing(true)
    setEditValue(task.text)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const submitEdit = () => {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== task.text) {
      onUpdateTitle?.(task.id, trimmed)
    }
  }

  // Click on empty area → toggle milestone collapse
  const handleEmptyAreaClick = (e) => {
    if (e.target === e.currentTarget) {
      onToggleMilestone?.()
    }
  }

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Main row - 1 line */}
      <div
        onClick={handleEmptyAreaClick}
        {...attributes}
        {...listeners}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px 5px 0',
          height: 30,
          cursor: 'grab',
          background: hover ? '#fafaf8' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        {/* Indent + Checkbox */}
        <div
          style={{ width: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}
          onPointerDown={e => e.stopPropagation()}
        >
          <div
            onClick={(e) => { e.stopPropagation(); onToggleDone(task.id) }}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: task.done ? 'none' : '1.5px solid #c4c2ba',
              background: task.done ? '#1D9E75' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {task.done && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
          </div>
        </div>

        {/* Milestone color bar */}
        {milestoneColor && (
          <div style={{
            width: 3,
            height: 16,
            borderRadius: 1.5,
            background: milestoneColor,
            flexShrink: 0,
            opacity: 0.6,
          }} />
        )}

        {/* Title — click to inline edit */}
        <div
          style={{ flexShrink: 1, minWidth: 0, maxWidth: 'fit-content' }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {editing ? (
            <input
              ref={inputRef}
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitEdit()
                if (e.key === 'Escape') { setEditValue(task.text); setEditing(false) }
              }}
              onBlur={submitEdit}
              style={{
                fontSize: 13, fontWeight: 400, lineHeight: 1.3, fontFamily: 'inherit',
                border: 'none', outline: 'none', background: '#f5f4f0', color: '#2C2C2A',
                padding: '1px 6px', borderRadius: 4,
                width: Math.max(60, (editValue || '').length * 8 + 24), maxWidth: '100%', minWidth: 60,
              }}
            />
          ) : (
            <span
              onClick={startEdit}
              style={{
                fontSize: 13,
                color: task.done ? '#b4b2a9' : '#2C2C2A',
                textDecoration: task.done ? 'line-through' : 'none',
                cursor: 'text',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title="클릭하여 수정"
            >
              {task.text}
            </span>
          )}
        </div>

        {/* Spacer — empty area for click (toggle) / drag (move) */}
        <div style={{ flex: 1 }} />

        {/* Due date */}
        {task.dueDate && (
          <span
            style={{ fontSize: 11, color: '#a09f99', flexShrink: 0 }}
            onPointerDown={e => e.stopPropagation()}
          >
            {fmtDate(task.dueDate)}
          </span>
        )}

        {/* Assignee badge */}
        {assigneeName && (
          <span
            style={{
              fontSize: 10, color: '#888780', background: '#f0efe8',
              padding: '2px 6px', borderRadius: 4, flexShrink: 0,
              maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            onPointerDown={e => e.stopPropagation()}
          >
            {assigneeName}
          </span>
        )}

        {/* Note indicator / toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id) }}
          onPointerDown={e => e.stopPropagation()}
          style={{
            width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4,
            color: hasNotes ? '#888780' : '#d4d2ca', fontSize: 12, flexShrink: 0,
            opacity: hasNotes || hover ? 1 : 0, transition: 'opacity 0.1s',
          }}
          title={expanded ? '노트 접기' : '노트 펼치기'}
        >
          {expanded ? '▾' : '▸'}
        </button>

        {/* Detail panel icon */}
        <button
          onClick={(e) => { e.stopPropagation(); onClickTask?.(task) }}
          onPointerDown={e => e.stopPropagation()}
          style={{
            width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4,
            color: '#c4c2ba', fontSize: 13, flexShrink: 0,
            opacity: hover ? 1 : 0, transition: 'opacity 0.1s',
          }}
          title="상세 보기"
        >
          →
        </button>
      </div>

      {/* Expanded note area - lazy mount */}
      {expanded && (
        <div style={{
          padding: '0 12px 8px 48px',
          background: '#fafaf8',
          borderBottom: '1px solid #f0efe8',
        }}>
          <OutlinerEditor
            notes={task.notes || ''}
            onChange={(val) => onUpdateNote(task.id, val)}
            accentColor={milestoneColor || '#1D9E75'}
          />
        </div>
      )}
    </div>
  )
}
