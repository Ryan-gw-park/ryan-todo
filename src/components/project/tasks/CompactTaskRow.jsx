import { useState } from 'react'
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
 * - 체크박스 + 제목 + 마감일 + 담당자 + 노트 토글
 * - 펼침 시 OutlinerEditor로 노트 표시
 */
export default function CompactTaskRow({
  task,
  expanded,
  onToggleExpand,
  onToggleDone,
  onClickTask,
  onUpdateNote,
  milestoneColor,
  assigneeName,
}) {
  const [hover, setHover] = useState(false)
  const hasNotes = task.notes && task.notes.trim().length > 0

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Main row - 1 line */}
      <div
        onClick={() => onClickTask?.(task)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px 5px 0',
          height: 30,
          cursor: 'pointer',
          background: hover ? '#fafaf8' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        {/* Indent + Checkbox */}
        <div style={{ width: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
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

        {/* Title */}
        <span style={{
          flex: 1,
          fontSize: 13,
          color: task.done ? '#b4b2a9' : '#2C2C2A',
          textDecoration: task.done ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {task.text}
        </span>

        {/* Due date */}
        {task.dueDate && (
          <span style={{
            fontSize: 11,
            color: '#a09f99',
            flexShrink: 0,
          }}>
            {fmtDate(task.dueDate)}
          </span>
        )}

        {/* Assignee badge */}
        {assigneeName && (
          <span style={{
            fontSize: 10,
            color: '#888780',
            background: '#f0efe8',
            padding: '2px 6px',
            borderRadius: 4,
            flexShrink: 0,
            maxWidth: 60,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {assigneeName}
          </span>
        )}

        {/* Note indicator / toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id) }}
          style={{
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 4,
            color: hasNotes ? '#888780' : '#d4d2ca',
            fontSize: 12,
            flexShrink: 0,
            opacity: hasNotes || hover ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
          title={expanded ? '노트 접기' : '노트 펼치기'}
        >
          {expanded ? '▾' : '▸'}
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
