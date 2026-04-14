import { useState, useMemo } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getColorByIndex } from '../../../../utils/colors'
import ProjectLaneCard from '../../../shared/ProjectLaneCard'
import ProjectGridLayout from '../../../shared/ProjectGridLayout'

/* ═══ SortableLaneCard (12b) ═══ */
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
   TeamMatrixGrid v3 — 12f: ProjectLaneCard + ProjectGridLayout
   ═══════════════════════════════════════════════════════ */
export default function TeamMatrixGrid({
  projects, tasks, members, collapsed, toggleCollapse: toggleProjectCollapse,
  toggleDone, openDetail, activeId, currentTeamId,
  groupByOwner,
}) {
  const milestones = useStore(s => s.milestones)

  // 멤버 색상 매핑 (stable sort by userId)
  const sortedMembers = useMemo(() => [...members].sort((a, b) => (a.userId || '').localeCompare(b.userId || '')), [members])
  const memberColorMap = useMemo(() => {
    const map = {}
    sortedMembers.forEach((m, i) => { map[m.userId] = getColorByIndex(i) })
    return map
  }, [sortedMembers])

  const groupBy = groupByOwner ? 'owner' : 'milestone'

  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }

  return (
    <SortableContext items={projects.map(p => `project-lane:${p.id}`)} strategy={verticalListSortingStrategy}>
      <ProjectGridLayout
        projects={projects}
        renderCard={(proj, isExpanded, onToggleExpand) => {
          const section = proj.teamId ? 'team' : 'personal'
          const projTasks = tasks.filter(t => t.projectId === proj.id && t.teamId === currentTeamId && !t.done && !t.deletedAt)
          return (
            <SortableLaneCard key={proj.id} projId={proj.id} section={section}>
              {({ attributes, listeners }) => (
                <ProjectLaneCard
                  project={proj}
                  tasks={projTasks}
                  milestones={milestones}
                  members={members}
                  memberColorMap={memberColorMap}
                  mode="team"
                  groupBy={groupBy}
                  truncate={{ tasksPerGroup: 3 }}
                  expanded={isExpanded}
                  onToggleExpand={onToggleExpand}
                  collapsed={collapsed[proj.id]}
                  onToggleCollapse={() => toggleProjectCollapse(proj.id)}
                  dragHandleProps={{ ...attributes, ...listeners }}
                />
              )}
            </SortableLaneCard>
          )
        }}
      />
      {projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
      )}
    </SortableContext>
  )
}
