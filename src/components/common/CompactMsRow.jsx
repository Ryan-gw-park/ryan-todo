/**
 * CompactMsRow — 1-line compact milestone display (Loop-38)
 * Shows: [dot] [path >] [title] [task count] [avatar or 미배정]
 * Height: ~32px, no card borders, hover background
 */

import { getMsPath } from '../../utils/milestoneTree'

const S = {
  textPrimary: '#37352f',
  textSecondary: '#6b6a66',
  textTertiary: '#a09f99',
}

function Dot({ color, size = 6 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  )
}

function Avatar({ member, size = 16 }) {
  if (!member) return null
  const initial = (member.name || member.username || '?')[0].toUpperCase()
  const bg = member.color || '#888'
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: size * 0.45,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

/**
 * @param {Object} props
 * @param {Object} props.milestone - milestone object
 * @param {Array} props.milestones - all milestones (for path calculation)
 * @param {string} props.color - project dot color
 * @param {number} props.taskCount - number of tasks under this milestone
 * @param {Object} props.assignee - member object (or null for unassigned)
 * @param {boolean} props.showProject - show project name prefix
 * @param {Object} props.project - project object (for showProject)
 * @param {Function} props.onClick - click handler
 */
export default function CompactMsRow({
  milestone,
  milestones = [],
  color,
  taskCount = 0,
  assignee,
  showProject = false,
  project,
  onClick,
}) {
  const path = getMsPath(milestone.id, milestones)

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        marginBottom: 1,
        borderRadius: 5,
        cursor: 'grab',
        transition: 'background 0.1s',
        height: 28,
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <Dot color={color || project?.color || '#888'} size={6} />

      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        overflow: 'hidden',
      }}>
        {showProject && project && (
          <span style={{
            fontSize: 10,
            color: project.color || S.textSecondary,
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {project.name}
          </span>
        )}
        {showProject && path && (
          <span style={{ fontSize: 9, color: S.textTertiary, flexShrink: 0 }}>›</span>
        )}
        {path && !showProject && (
          <span style={{ fontSize: 10, color: S.textTertiary, flexShrink: 0 }}>
            {path} ›
          </span>
        )}
        <span style={{
          fontSize: 11.5,
          fontWeight: 500,
          color: S.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {milestone.title}
        </span>
      </div>

      {taskCount > 0 && (
        <span style={{ fontSize: 9.5, color: S.textTertiary, flexShrink: 0 }}>
          {taskCount}건
        </span>
      )}

      {assignee ? (
        <Avatar member={assignee} size={16} />
      ) : (
        <span style={{ fontSize: 9, color: S.textTertiary, flexShrink: 0 }}>
          미배정
        </span>
      )}
    </div>
  )
}
