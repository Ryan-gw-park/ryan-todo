import { useState, useEffect, useMemo } from 'react'
import useStore from '../../../hooks/useStore'
import useProjectTimelineData from '../../../hooks/useProjectTimelineData'
import useTeamMembers from '../../../hooks/useTeamMembers'
import CompactTaskRow from './CompactTaskRow'
import InlineAdd from '../../shared/InlineAdd'
import { getColor } from '../../../utils/colors'

/**
 * CompactTaskList - 마일스톤별 그룹핑된 컴팩트 태스크 목록
 * - 마일스톤 헤더 + 접기/펼치기
 * - 1줄 태스크 행 + 노트 인라인 확장
 * - InlineAdd로 마일스톤에 태스크 추가
 */
export default function CompactTaskList({ projectId }) {
  const { projects, currentTeamId, updateTask, toggleTask, collapseState, toggleCollapse, setCollapseGroup, setDetailPanel } = useStore()
  const { milestones, tasks, loading, unlinkedTasks, getTasksByMilestone } = useProjectTimelineData(projectId)

  // 프로젝트 색상
  const project = projects.find(p => p.id === projectId)
  const color = getColor(project?.color)

  // 팀원 맵 (assigneeId → displayName)
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName })
      setMemberMap(map)
    })
  }, [currentTeamId])

  // 마일스톤 접기 상태 (collapseState.compactTask)
  const collapsed = collapseState.compactTask || {}
  const toggleMilestone = (msId) => toggleCollapse('compactTask', msId)

  // 전체 접기/펼치기
  const allIds = useMemo(() => {
    const ids = milestones.map(ms => ms.id)
    if (unlinkedTasks.length > 0) ids.push('__backlog__')
    return ids
  }, [milestones, unlinkedTasks])

  const allCollapsed = allIds.length > 0 && allIds.every(id => collapsed[id])

  const toggleAll = () => {
    const newState = {}
    allIds.forEach(id => { newState[id] = !allCollapsed })
    setCollapseGroup('compactTask', newState)
  }

  // 태스크 노트 펼침 상태 (로컬)
  const [expandedTasks, setExpandedTasks] = useState({})
  const toggleTaskExpand = (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  // 태스크 완료 토글
  const handleToggleDone = (taskId) => {
    toggleTask(taskId)
  }

  // 태스크 클릭 → DetailPanel
  const handleClickTask = (task) => {
    setDetailPanel({ type: 'task', id: task.id })
  }

  // 노트 업데이트
  const handleUpdateNote = (taskId, notes) => {
    updateTask(taskId, { notes })
  }

  if (loading) {
    return (
      <div style={{ padding: 20, color: '#a09f99', fontSize: 13 }}>
        로딩 중...
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* 전체 접기/펼치기 툴바 */}
      {allIds.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px 12px',
          borderBottom: '1px solid #f0efe8',
        }}>
          <button
            onClick={toggleAll}
            style={{
              fontSize: 11,
              color: '#888780',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0efe8'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {allCollapsed ? '▸ 전체 펼치기' : '▾ 전체 접기'}
          </button>
        </div>
      )}

      {/* 마일스톤별 섹션 */}
      {milestones.map(ms => {
        const msTasks = getTasksByMilestone(ms.id)
        const isCollapsed = collapsed[ms.id]
        const doneCnt = msTasks.filter(t => t.done).length
        const totalCnt = msTasks.length

        return (
          <div key={ms.id} style={{ borderBottom: '1px solid #f0efe8' }}>
            {/* Milestone header */}
            <div
              onClick={() => toggleMilestone(ms.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                cursor: 'pointer',
                background: '#fafaf8',
              }}
            >
              {/* Chevron */}
              <span style={{
                fontSize: 10,
                color: '#a09f99',
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
                width: 12,
              }}>
                ▾
              </span>

              {/* Color dot */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: ms.color || '#1D9E75',
                flexShrink: 0,
              }} />

              {/* Title */}
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#2C2C2A',
                flex: 1,
              }}>
                {ms.title || '제목 없음'}
              </span>

              {/* Progress */}
              {totalCnt > 0 && (
                <span style={{
                  fontSize: 11,
                  color: '#a09f99',
                }}>
                  {doneCnt}/{totalCnt}
                </span>
              )}
            </div>

            {/* Tasks */}
            {!isCollapsed && (
              <div>
                {msTasks.length === 0 ? (
                  <div style={{
                    padding: '8px 12px 8px 48px',
                    fontSize: 12,
                    color: '#c4c2ba',
                    fontStyle: 'italic',
                  }}>
                    할일 없음
                  </div>
                ) : (
                  msTasks.map(task => (
                    <CompactTaskRow
                      key={task.id}
                      task={task}
                      expanded={expandedTasks[task.id]}
                      onToggleExpand={toggleTaskExpand}
                      onToggleDone={handleToggleDone}
                      onClickTask={handleClickTask}
                      onUpdateNote={handleUpdateNote}
                      milestoneColor={ms.color}
                      assigneeName={memberMap[task.assigneeId]}
                    />
                  ))
                )}

                {/* InlineAdd */}
                <div style={{ padding: '4px 12px 8px 36px' }}>
                  <InlineAdd
                    projectId={projectId}
                    category="backlog"
                    color={color}
                    extraFields={{ keyMilestoneId: ms.id }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* 백로그 (미연결 태스크) */}
      {unlinkedTasks.length > 0 && (
        <div style={{ borderBottom: '1px solid #f0efe8' }}>
          {/* Backlog header */}
          <div
            onClick={() => toggleMilestone('__backlog__')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              cursor: 'pointer',
              background: '#fafaf8',
            }}
          >
            <span style={{
              fontSize: 10,
              color: '#a09f99',
              transform: collapsed['__backlog__'] ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              width: 12,
            }}>
              ▾
            </span>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#b4b2a9',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#888780',
              fontStyle: 'italic',
              flex: 1,
            }}>
              백로그
            </span>
            <span style={{ fontSize: 11, color: '#a09f99' }}>
              {unlinkedTasks.length}
            </span>
          </div>

          {/* Backlog tasks */}
          {!collapsed['__backlog__'] && (
            <div>
              {unlinkedTasks.map(task => (
                <CompactTaskRow
                  key={task.id}
                  task={task}
                  expanded={expandedTasks[task.id]}
                  onToggleExpand={toggleTaskExpand}
                  onToggleDone={handleToggleDone}
                  onClickTask={handleClickTask}
                  onUpdateNote={handleUpdateNote}
                  milestoneColor={null}
                  assigneeName={memberMap[task.assigneeId]}
                />
              ))}

              <div style={{ padding: '4px 12px 8px 36px' }}>
                <InlineAdd
                  projectId={projectId}
                  category="backlog"
                  color={color}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 빈 상태 */}
      {milestones.length === 0 && unlinkedTasks.length === 0 && (
        <div style={{
          padding: 40,
          textAlign: 'center',
          color: '#a09f99',
          fontSize: 13,
        }}>
          마일스톤 또는 할일이 없습니다.
          <br />
          마일스톤 탭에서 마일스톤을 추가하세요.
        </div>
      )}
    </div>
  )
}
