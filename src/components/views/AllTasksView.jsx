import { useState, useEffect, useCallback, useMemo } from 'react'
import useStore from '../../hooks/useStore'
import useProjectFilter from '../../hooks/useProjectFilter'
import useTeamMembers from '../../hooks/useTeamMembers'
import ProjectFilter from '../shared/ProjectFilter'
import { getColor } from '../../utils/colors'
import ProgressBar from '../common/ProgressBar'
import MsDropdown from '../common/MsDropdown'

const CAT_LABEL = { today: '오늘', next: '다음', backlog: '남은', done: '완료' }

export default function AllTasksView() {
  const { tasks, projects, collapseState, toggleCollapse, setCollapseGroup, currentTeamId, updateTask, toggleDone, openDetail } = useStore()
  const { filteredProjects, filteredTasks } = useProjectFilter(projects, tasks)
  const collapsed = collapseState.allTasks || {}
  const isMobile = window.innerWidth < 768

  // 팀원 이름 조회 (팀 모드일 때)
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName })
      setMemberMap(map)
    })
  }, [currentTeamId])

  // 마일스톤 (store에서 loadAll 시 함께 로딩됨)
  const milestones = useStore(s => s.milestones)

  // 마일스톤 lookup map
  const msMap = useMemo(() => {
    const map = {}
    milestones.forEach(ms => { map[ms.id] = ms })
    return map
  }, [milestones])

  const allCollapsed = filteredProjects.every(p => collapsed[p.id])
  const toggleAll = () => {
    const newState = {}
    filteredProjects.forEach(p => { newState[p.id] = !allCollapsed })
    setCollapseGroup('allTasks', newState)
  }

  const totalActive = filteredTasks.filter(t => !t.done).length

  return (
    <div data-view="allTasks" style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* 상단 */}
        <div className="today-header" style={{ marginBottom: isMobile ? 16 : 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="today-greeting" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h1 style={{ fontSize: isMobile ? 18 : 26, fontWeight: 700, color: '#37352f', margin: 0 }}>전체 할일</h1>
            <span style={{ fontSize: 12, color: '#a09f99' }}>총 {totalActive}건</span>
          </div>
          <div className="today-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProjectFilter />
            <button
              onClick={toggleAll}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999', fontFamily: 'inherit', padding: '4px 0', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.color = '#37352f'}
              onMouseLeave={e => e.currentTarget.style.color = '#999'}
            >
              {allCollapsed ? '전체 펼치기' : '전체 접기'}
            </button>
          </div>
        </div>

        {/* 프로젝트별 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredProjects.map(p => {
            const projectTasks = filteredTasks.filter(t => t.projectId === p.id && !t.done)
            if (projectTasks.length === 0) return null

            const isCollapsed = collapsed[p.id]
            const color = getColor(p.color)
            const projectMs = milestones.filter(ms => ms.project_id === p.id)
            const linkedTasks = projectTasks.filter(t => t.keyMilestoneId)
            const unlinkedTasks = projectTasks.filter(t => !t.keyMilestoneId)

            return (
              <div key={p.id} style={{
                background: '#fff', borderRadius: 10, overflow: 'hidden',
                border: '0.5px solid #e8e6df',
              }}>
                {/* 프로젝트 헤더 */}
                <div
                  onClick={() => toggleCollapse('allTasks', p.id)}
                  style={{
                    background: color.card, padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: color.dot }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#37352f' }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: '#a09f99' }}>{projectTasks.length}건</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#a09f99' }}>{isCollapsed ? '▸' : '▾'}</span>
                </div>

                {/* 마일스톤 그룹 + 미연결 */}
                {!isCollapsed && (
                  <div style={{ padding: '4px 0' }}>
                    {projectMs.map(ms => {
                      const msTasks = linkedTasks
                        .filter(t => t.keyMilestoneId === ms.id)
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                      if (msTasks.length === 0) return null
                      const doneTasks = tasks.filter(t => t.projectId === p.id && t.keyMilestoneId === ms.id && t.done)
                      const msTotal = msTasks.length + doneTasks.length
                      const msDone = doneTasks.length

                      return (
                        <div key={ms.id} style={{ padding: '0 14px', marginBottom: 4 }}>
                          {/* MS 헤더 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 4px 0' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ms.color || '#22c55e', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#37352f' }}>{ms.title || '(제목 없음)'}</span>
                            <ProgressBar done={msDone} total={msTotal} color={ms.color || '#22c55e'} />
                            {ms.end_date && <span style={{ fontSize: 11, color: '#a09f99' }}>{ms.end_date}</span>}
                          </div>
                          {/* MS 소속 할일 */}
                          {msTasks.map(t => (
                            <TaskRow
                              key={t.id}
                              task={t}
                              memberMap={memberMap}
                              currentTeamId={currentTeamId}
                              onToggle={() => toggleDone(t.id)}
                              onDetail={() => openDetail(t)}
                            />
                          ))}
                        </div>
                      )
                    })}

                    {/* 미연결 섹션 */}
                    {unlinkedTasks.length > 0 && (
                      <div style={{ padding: '0 14px', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 4px 0' }}>
                          <span style={{ fontSize: 12, color: '#a09f99', fontStyle: 'italic' }}>미연결 ({unlinkedTasks.length})</span>
                        </div>
                        {unlinkedTasks
                          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                          .map(t => (
                            <TaskRow
                              key={t.id}
                              task={t}
                              memberMap={memberMap}
                              currentTeamId={currentTeamId}
                              onToggle={() => toggleDone(t.id)}
                              onDetail={() => openDetail(t)}
                              projectMs={projectMs}
                              onMsLink={(msId) => updateTask(t.id, { keyMilestoneId: msId })}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredProjects.every(p => filteredTasks.filter(t => t.projectId === p.id && !t.done).length === 0) && (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '40px 0', fontSize: 14 }}>
            할일이 없습니다
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 할일 행 ─── */
function TaskRow({ task, memberMap, currentTeamId, onToggle, onDetail, projectMs, onMsLink }) {
  const t = task
  const assigneeName = currentTeamId && t.assigneeId ? memberMap[t.assigneeId] : null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0 5px 14px', borderBottom: '0.5px solid #e8e6df',
    }}>
      {/* 체크박스 */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
          border: t.done ? 'none' : '1.5px solid #d0d0d0',
          background: t.done ? '#2383e2' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {t.done && (
          <svg width={10} height={10} viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* 할일 제목 */}
      <span style={{
        flex: 1, fontSize: 13, color: '#37352f', minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: t.done ? 'line-through' : undefined,
        opacity: t.done ? 0.5 : undefined,
      }}>
        {t.text}
      </span>

      {/* +MS 연결 (미연결 할일에만) */}
      {onMsLink && projectMs && projectMs.length > 0 && (
        <MsDropdown milestones={projectMs} onSelect={onMsLink} />
      )}

      {/* 담당자 */}
      {assigneeName && (
        <span style={{
          fontSize: 10, color: '#888', fontWeight: 500,
          background: '#f0efe8', padding: '2px 6px', borderRadius: 4, flexShrink: 0,
          maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {assigneeName}
        </span>
      )}

      {/* 카테고리 라벨 */}
      <span style={{
        fontSize: 11, color: '#a09f99', background: '#f5f4f0',
        borderRadius: 4, padding: '1px 6px', flexShrink: 0,
      }}>
        {CAT_LABEL[t.category] || t.category}
      </span>

      {/* ▶ 상세 */}
      <svg
        onClick={(e) => { e.stopPropagation(); onDetail() }}
        width="14" height="14" viewBox="0 0 16 16" fill="none"
        style={{ opacity: 0.3, cursor: 'pointer', flexShrink: 0 }}
      >
        <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}
