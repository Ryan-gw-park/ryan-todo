import { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import useStore from '../../hooks/useStore'
import TaskAssigneeChip from './TaskAssigneeChip'
import InlineAdd from '../shared/InlineAdd'
import MiniAvatar from '../views/grid/shared/MiniAvatar'

function getBadgeStyle(count) {
  if (count >= 16) return { background: '#FCEBEB', color: '#A32D2D' }
  if (count >= 6) return { background: '#FAEEDA', color: '#854F0B' }
  return { background: '#f0efe8', color: '#888780' }
}

function SectionHeader({ label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 4px', color: '#888780', fontSize: 11 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 0.5, background: '#e8e6df' }} />
      <span>{count}</span>
    </div>
  )
}

function BacklogTaskRow({ task, members, currentTeamId, onToggle, onOpen, onChangeAssignee, sortMode }) {
  const [hover, setHover] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bl-task:${task.id}`,
    data: { type: 'task', taskId: task.id, fromMsId: null },
  })

  // dueDate D-3 판정
  const isDueSoon = (() => {
    if (!task.dueDate) return false
    const now = new Date()
    const d3 = new Date(now.getTime() + 3 * 86400000)
    return task.dueDate <= d3.toISOString().slice(0, 10)
  })()

  // 7일 미수정 판정 (오래된순 정렬 시만)
  const isStale = sortMode === 'oldest' && task.updatedAt && (() => {
    const diff = Date.now() - new Date(task.updatedAt).getTime()
    return diff > 7 * 86400000
  })()

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => { if (!isDragging) onOpen(task) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px', minHeight: 28, cursor: 'grab',
        background: hover ? '#f5f4f0' : 'transparent',
        borderBottom: '0.5px solid #f0efe8',
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {isStale && <span style={{ fontSize: 10, flexShrink: 0 }}>🕒</span>}

      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggle(task.id) }} style={{
        width: 12, height: 12, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
        border: '1.5px solid #ccc', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} />

      {/* Text */}
      <span style={{ flex: 1, fontSize: 12, color: '#2C2C2A', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>
        {task.text || '(제목 없음)'}
      </span>

      {/* DueDate */}
      {task.dueDate && (
        isDueSoon ? (
          <span style={{ fontSize: 10, background: '#FCEBEB', color: '#A32D2D', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
            {task.dueDate.slice(5)}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: '#888780', flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
        )
      )}

      {/* Assignee avatar */}
      {currentTeamId && (
        <TaskAssigneeChip
          taskId={task.id}
          assigneeId={task.assigneeId}
          members={members}
          onChangeAssignee={(userId) => onChangeAssignee(task.id, userId)}
          size={14}
        />
      )}
    </div>
  )
}

export default function BacklogPanel({
  projectId,
  projectTasks,
  members,
  currentTeamId,
  color,
  hidden,
}) {
  const userId = useStore(s => s.userId)
  const updateTask = useStore(s => s.updateTask)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterChip, setFilterChip] = useState(null) // null | 'mine' | 'unassigned' | 'dueSoon'
  const [sortMode, setSortMode] = useState('default') // 'default' | 'recent' | 'oldest'

  // Loop 43: "백로그" 개념 폐기. 프로젝트 직속 task (MS 미지정, 미완료, 미삭제)
  const backlogAll = useMemo(() =>
    projectTasks.filter(t => !t.keyMilestoneId && !t.done && !t.deletedAt),
    [projectTasks])

  const backlogTasks = useMemo(() => {
    let tasks = [...backlogAll]

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      tasks = tasks.filter(t => (t.text || '').toLowerCase().includes(q))
    }

    // 필터 chip
    if (filterChip === 'mine') tasks = tasks.filter(t => t.assigneeId === userId)
    else if (filterChip === 'unassigned') tasks = tasks.filter(t => !t.assigneeId)
    else if (filterChip === 'dueSoon') {
      const now = new Date()
      const d3 = new Date(now.getTime() + 3 * 86400000)
      const d3Str = d3.toISOString().slice(0, 10)
      tasks = tasks.filter(t => t.dueDate && t.dueDate <= d3Str)
    }

    // 정렬
    if (sortMode === 'recent') tasks.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    else if (sortMode === 'oldest') tasks.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''))
    else tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

    return tasks
  }, [backlogAll, searchQuery, filterChip, sortMode, userId])

  const unassigned = backlogTasks.filter(t => !t.assigneeId)
  const assigned = backlogTasks.filter(t => !!t.assigneeId)
  const totalCount = backlogAll.length
  const filteredCount = unassigned.length + assigned.length
  const hasActiveFilter = searchQuery.trim() || filterChip

  const handleChangeAssignee = (taskId, userId) => {
    updateTask(taskId, { assigneeId: userId })
  }

  return (
    <div style={{
      width: 280, flexShrink: 0, borderLeft: '1px solid #e8e6df',
      background: '#fafaf8', display: hidden ? 'none' : 'flex',
      flexDirection: 'column', height: '100%',
    }}>
      {/* 헤더 */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '0.5px solid #e8e6df' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {/* Loop 43 R01: 라벨 없음 — 카운트 배지만 노출 */}
          <span style={{ ...getBadgeStyle(totalCount), fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>{totalCount}</span>
          <div style={{ flex: 1 }} />
          <select value={sortMode} onChange={e => setSortMode(e.target.value)}
            style={{ border: 'none', background: 'none', fontSize: 10, color: '#888780', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="default">기본순</option>
            <option value="recent">최근순</option>
            <option value="oldest">오래된순</option>
          </select>
        </div>
        {/* 검색 */}
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="검색…" style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid #e8e6df', borderRadius: 5, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
        {/* 필터 chips */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {[{ key: 'mine', label: '내 것만' }, { key: 'unassigned', label: '미배정' }, { key: 'dueSoon', label: '기한 임박' }].map(c => (
            <button key={c.key} onClick={() => setFilterChip(prev => prev === c.key ? null : c.key)}
              style={{ border: '1px solid', borderColor: filterChip === c.key ? '#2C2C2A' : '#e8e6df', borderRadius: 12,
                padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                background: filterChip === c.key ? '#2C2C2A' : '#fff',
                color: filterChip === c.key ? '#fff' : '#888780' }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 빈 상태 — 진짜 비어있음 */}
      {totalCount === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#085041' }}>
          <span style={{ fontSize: 20, marginBottom: 4 }}>✓</span>
          <span style={{ fontSize: 12 }}>직속 할일이 없습니다</span>
        </div>
      )}

      {/* 빈 상태 — 필터/검색 결과 없음 */}
      {totalCount > 0 && filteredCount === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888780', fontSize: 12 }}>
          검색 결과 없음
        </div>
      )}

      {/* Task 목록 (스크롤) */}
      {filteredCount > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {unassigned.length > 0 && (
            <>
              <SectionHeader label="미배정" count={unassigned.length} />
              {unassigned.map(t => (
                <BacklogTaskRow key={t.id} task={t} members={members} currentTeamId={currentTeamId}
                  onToggle={toggleDone} onOpen={openDetail}
                  onChangeAssignee={handleChangeAssignee}
                  sortMode={sortMode} />
              ))}
            </>
          )}
          {assigned.length > 0 && (
            <>
              <SectionHeader label="배정됨" count={assigned.length} />
              {assigned.map(t => (
                <BacklogTaskRow key={t.id} task={t} members={members} currentTeamId={currentTeamId}
                  onToggle={toggleDone} onOpen={openDetail}
                  onChangeAssignee={handleChangeAssignee}
                  sortMode={sortMode} />
              ))}
            </>
          )}
        </div>
      )}

      {/* 인라인 추가 */}
      <div style={{ padding: '4px 8px', borderTop: '0.5px solid #e8e6df' }}>
        <InlineAdd projectId={projectId} category="backlog" color={color || { dot: '#888', text: '#888' }}
          extraFields={{ keyMilestoneId: null, assigneeId: null }} />
      </div>
    </div>
  )
}
