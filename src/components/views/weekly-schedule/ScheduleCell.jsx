import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { COLOR } from '../../../styles/designTokens'
import { getColor } from '../../../utils/colors'
import CellInlineAdd from './CellInlineAdd'

/**
 * 개별 셀 — useDroppable + 내용 렌더 + × 버튼 + R18 하이라이트.
 * 드롭존 id: `cell:${userId}:${dateISO}` (userId = profiles.user_id = tasks.assignee_id)
 *
 * R18 하이라이트: activeDrag.kind==='task' && activeDrag.assigneeId===userId일 때
 *   약한 파란(`rgba(49,130,206,0.05)`). 드래그 시작 task의 현재 assignee 행을 도드라지게.
 *   목적지 하이라이트는 isOver로 별도 (진한 파랑).
 */

// ScheduleCell 내부 로컬 헬퍼 (spec §5-9 W6)
// _kind discriminator + _updatedAt 혼재 정렬용
function groupByProjectId(tasksInCell, milestonesInCell, projects) {
  const taggedTasks = tasksInCell.map(t => ({ ...t, _kind: 'task', _updatedAt: t.updatedAt || '' }))
  const taggedMS = milestonesInCell.map(m => ({ ...m, _kind: 'ms', _updatedAt: m.updated_at || '' }))
  const all = [...taggedTasks, ...taggedMS]
  const groups = new Map()
  for (const item of all) {
    const pid = item._kind === 'task' ? item.projectId : item.project_id
    if (!groups.has(pid)) {
      const project = projects.find(p => p.id === pid)
      groups.set(pid, {
        projectId: pid,
        projectName: project?.name || '(프로젝트 없음)',
        color: project?.color || null,
        items: [],
      })
    }
    groups.get(pid).items.push(item)
  }
  return Array.from(groups.values())
}

function sortGroupsByNewestUpdate(groups) {
  // 각 그룹 내부 아이템을 _updatedAt desc 정렬
  groups.forEach(g => g.items.sort((a, b) => (b._updatedAt || '').localeCompare(a._updatedAt || '')))
  // 그룹 순서: 각 그룹의 최신 updatedAt desc
  return groups.sort((a, b) => (b.items[0]?._updatedAt || '').localeCompare(a.items[0]?._updatedAt || ''))
}

function CellItem({ item, onRemove }) {
  const [hover, setHover] = useState(false)
  const isMS = item._kind === 'ms'
  const title = isMS ? item.title : item.text

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 4px',
        marginLeft: isMS ? 4 : 10,
        fontSize: 11,
        color: isMS ? '#534AB7' : COLOR.textPrimary,
        background: isMS ? '#EEEDFE' : 'transparent',
        borderRadius: isMS ? 3 : 0,
        fontWeight: isMS ? 500 : 400,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      <span style={{ flex: 1 }}>{title}</span>
      {hover && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#ccc',
            padding: 2,
            fontSize: 12,
            lineHeight: 1,
            flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
          onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
          aria-label="미배정으로 되돌리기"
        >×</button>
      )}
    </div>
  )
}

export default function ScheduleCell({
  userId,             // profiles.user_id = tasks.assignee_id (W7)
  dateISO,
  isToday,
  tasksInCell = [],
  milestonesInCell = [],
  projects = [],
  activeDrag,
  onUnscheduleTask,
  onUnscheduleMS,
  selectedProjectId,
  setSelectedProjectId,
  currentTeamId,
  addTask,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${userId}:${dateISO}`,
    data: { userId, dateISO },
  })
  const [showInlineAdd, setShowInlineAdd] = useState(false)
  const [hover, setHover] = useState(false)

  // R18: 드래그 중인 task의 현재 assignee와 일치하는 행 하이라이트
  const rowHighlight = activeDrag?.kind === 'task' && activeDrag.assigneeId === userId

  const todayBg = isToday ? 'rgba(250,238,218,0.25)' : 'transparent'
  const dragBg = isOver
    ? 'rgba(49,130,206,0.08)'
    : (rowHighlight ? 'rgba(49,130,206,0.05)' : todayBg)

  const groups = sortGroupsByNewestUpdate(
    groupByProjectId(tasksInCell, milestonesInCell, projects)
  )

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minHeight: 120,
        background: dragBg,
        outline: isOver ? '1.5px dashed #3182CE' : 'none',
        borderRight: `0.5px solid ${COLOR.border}`,
        borderBottom: `0.5px solid ${COLOR.border}`,
        padding: 6,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {groups.map(group => (
        <div key={group.projectId}>
          <div style={{
            fontSize: 10,
            color: COLOR.textSecondary,
            display: 'flex', alignItems: 'center', gap: 4,
            paddingLeft: 2, marginBottom: 2,
          }}>
            {group.color && (
              <span style={{
                width: 6, height: 6, borderRadius: 2,
                background: getColor(group.color).dot,
                flexShrink: 0,
              }} />
            )}
            <span>{group.projectName}</span>
          </div>
          {group.items.map(item => (
            <CellItem
              key={`${item._kind}:${item.id}`}
              item={item}
              onRemove={() => {
                if (item._kind === 'task') onUnscheduleTask(item.id)
                else onUnscheduleMS(item.id)
              }}
            />
          ))}
        </div>
      ))}

      {/* + 버튼 (hover 시) */}
      {hover && !showInlineAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowInlineAdd(true) }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 20, height: 20,
            background: 'none',
            border: `0.5px solid ${COLOR.border}`,
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            color: COLOR.textTertiary,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
          }}
          aria-label="태스크 추가"
        >＋</button>
      )}

      {/* CellInlineAdd */}
      {showInlineAdd && (
        <CellInlineAdd
          userId={userId}
          dateISO={dateISO}
          projects={projects.filter(p => p.teamId === currentTeamId)}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          currentTeamId={currentTeamId}
          addTask={addTask}
          onClose={() => setShowInlineAdd(false)}
        />
      )}
    </div>
  )
}
