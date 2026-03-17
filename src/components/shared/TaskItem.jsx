import useStore from '../../hooks/useStore'
import { CheckIcon, UndoIcon } from './Icons'

export default function TaskItem({ task, color, compact, hlColor }) {
  const { openDetail, toggleDone } = useStore()
  const isDone = !!task.done
  const isMobile = window.innerWidth < 768
  // 할일 제목: 데스크탑 14px, 모바일 13px
  const taskFontSize = isMobile ? 13 : 14
  // hlColor가 문자열이면 강조 모드
  const isHighlighted = !!hlColor
  // 강조 색상 적용 시 텍스트 색상
  const textColor = isHighlighted ? '#fff' : (isDone ? '#999' : '#37352f')

  return (
    <div
      onClick={() => openDetail(task)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: compact ? '3px 4px' : '5px 4px', borderRadius: 4, cursor: 'pointer', transition: 'background 0.1s', opacity: isDone ? 0.45 : 1 }}
      onMouseEnter={e => { if (!isHighlighted) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
      onMouseLeave={e => { if (!isHighlighted) e.currentTarget.style.background = 'transparent' }}
    >
      <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{ paddingTop: 1 }}>
        {isDone
          ? <div style={{ width: 18, height: 18, borderRadius: 4, background: isHighlighted ? 'rgba(255,255,255,0.3)' : '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isHighlighted ? '#fff' : '#66bb6a' }}><UndoIcon /></div>
          : <CheckIcon checked={false} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: taskFontSize, lineHeight: '19px', color: textColor, textDecoration: isDone ? 'line-through' : 'none' }}>
          {task.text}
          {task.alarm?.enabled && (
            <span title={`알람: ${new Date(task.alarm.datetime).toLocaleString('ko-KR')}`} style={{ fontSize: 12, opacity: 0.6, marginLeft: 4 }} aria-label="알람 설정됨">🔔</span>
          )}
        </div>
        {!compact && task.dueDate && <div style={{ fontSize: 11, color: isHighlighted ? 'rgba(255,255,255,0.7)' : '#bbb', marginTop: 1 }}>{task.dueDate}</div>}
      </div>
    </div>
  )
}
