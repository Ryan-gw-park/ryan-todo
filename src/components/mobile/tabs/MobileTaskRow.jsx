import useStore from '../../../hooks/useStore'
import { COLOR } from '../../../styles/designTokens'

const CATEGORY_MAP = {
  today:   { label: '지금', bg: '#FAEEDA', fg: '#854F0B' },
  next:    { label: '다음', bg: '#E6F1FB', fg: '#0C447C' },
  backlog: { label: '남은', bg: '#F1EFE8', fg: '#6B6A66' },
}

function CategoryChip({ category }) {
  const meta = CATEGORY_MAP[category] || CATEGORY_MAP.backlog
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 10,
        background: meta.bg,
        color: meta.fg,
        alignSelf: 'flex-start',
        marginTop: 2,
      }}
    >
      {meta.label}
    </span>
  )
}

export default function MobileTaskRow({ task, indent = 36 }) {
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: `10px 16px 10px ${indent}px`,
        background: '#fff',
      }}
    >
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={() => toggleDone(task.id)}
        style={{ flexShrink: 0, width: 18, height: 18, marginTop: 1 }}
      />
      <span
        onClick={() => openDetail(task)}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
          textDecoration: task.done ? 'line-through' : 'none',
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
          lineHeight: 1.4,
          cursor: 'pointer',
        }}
      >
        {task.text}
      </span>
      <CategoryChip category={task.category} />
    </div>
  )
}
