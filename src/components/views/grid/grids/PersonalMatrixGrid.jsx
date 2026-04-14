import { useState, useMemo, useCallback } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore, { getCachedUserId } from '../../../../hooks/useStore'
import ProjectLaneCard from '../../../shared/ProjectLaneCard'
import ProjectGridLayout from '../../../shared/ProjectGridLayout'

/* ═══ SortableLaneCard ═══ */
function SortableLaneCard({ projId, section, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-lane:${projId}`,
    data: { section, projectId: projId, type: 'project-lane' },
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === 'function' ? children({ attributes, listeners }) : children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   PersonalMatrixGrid v3 — 12f: ProjectLaneCard + today 필터
   today/next/later 3컬럼 폐기, 집중 모드 폐기, pill bar 폐기
   ═══════════════════════════════════════════════════════ */
export default function PersonalMatrixGrid({
  projects, myTasks, collapsed, toggleCollapse,
  toggleDone, openDetail, activeId,
  matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete,
  matrixDoneCollapsed, toggleMatrixDoneCollapse,
}) {
  const milestones = useStore(s => s.milestones)
  const userId = getCachedUserId()

  // today 필터 (localStorage, 기본 ON)
  const [todayFilter, setTodayFilter] = useState(() =>
    localStorage.getItem('personalTodayFilter') !== 'false'
  )

  const toggleTodayFilter = useCallback(() => {
    setTodayFilter(prev => {
      const next = !prev
      localStorage.setItem('personalTodayFilter', String(next))
      return next
    })
  }, [])

  // 프로젝트별 필터된 task
  const getFilteredTasks = useCallback((projId) => {
    let tasks = myTasks.filter(t => t.projectId === projId && !t.done && !t.deletedAt)
    if (todayFilter) tasks = tasks.filter(t => t.category === 'today')
    return tasks
  }, [myTasks, todayFilter])

  const allFilteredCount = useMemo(() =>
    projects.reduce((sum, p) => sum + getFilteredTasks(p.id).length, 0),
    [projects, getFilteredTasks]
  )

  return (
    <div>
      {/* 헤더: today 필터 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 12 }}>
        <button onClick={toggleTodayFilter} style={{
          padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: todayFilter ? 'rgba(229,62,62,0.08)' : 'transparent',
          color: todayFilter ? '#991B1B' : '#888780',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        }}>
          ● today 필터 {todayFilter ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* today 필터 빈 상태 (I4) */}
      {todayFilter && allFilteredCount === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: '#888780' }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>오늘 할 일이 없습니다.</div>
          <button onClick={toggleTodayFilter} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #e8e6df',
            background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
          }}>모든 task 보기</button>
        </div>
      )}

      {/* 카드 grid */}
      {!(todayFilter && allFilteredCount === 0) && (
        <SortableContext items={projects.map(p => `project-lane:${p.id}`)} strategy={verticalListSortingStrategy}>
          <ProjectGridLayout
            projects={projects}
            renderCard={(proj, isExpanded, onToggleExpand) => (
              <SortableLaneCard projId={proj.id} section="personal">
                {({ attributes, listeners }) => (
                  <ProjectLaneCard
                    project={proj}
                    tasks={getFilteredTasks(proj.id)}
                    milestones={milestones}
                    members={[]}
                    memberColorMap={{}}
                    mode="personal"
                    groupBy="milestone"
                    filter={{ today: todayFilter }}
                    truncate={{ tasksPerGroup: 3 }}
                    expanded={isExpanded}
                    onToggleExpand={onToggleExpand}
                    collapsed={collapsed[proj.id]}
                    onToggleCollapse={() => toggleCollapse(proj.id)}
                    dragHandleProps={{ ...attributes, ...listeners }}
                  />
                )}
              </SortableLaneCard>
            )}
          />
        </SortableContext>
      )}

      {projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
      )}
    </div>
  )
}
