import DepthToggle from '../shared/DepthToggle'
import MultiSelectFilter from '../shared/MultiSelectFilter'

/**
 * 타임라인 뷰 필터 바
 * - 뷰 깊이 토글 (프로젝트 / +마일스톤 / +할일)
 * - 프로젝트 멀티셀렉트
 * - 담당자 멀티셀렉트
 */
export default function TimelineFilters({
  depth,
  onDepthChange,
  projects,
  selProjects,
  onProjectsChange,
  members,
  selMembers,
  onMembersChange,
  projectId = null,
  showAssigneeOnBar = false,
  onToggleAssigneeOnBar,
}) {
  const isProjectMode = !!projectId
  // projects를 MultiSelectFilter용 형식으로 변환
  const projectOptions = projects.map(p => ({
    id: p.id,
    name: p.title || p.name || '제목 없음',
    color: p.color,
  }))

  // members를 MultiSelectFilter용 형식으로 변환
  const memberOptions = members.map(m => ({
    id: m.userId || m.id,
    name: m.displayName || m.name || '이름 없음',
  }))

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 14px',
      borderBottom: '0.5px solid #e8e6df',
      background: '#fafaf8',
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      <DepthToggle value={depth} onChange={onDepthChange} />
      {!isProjectMode && (
        <MultiSelectFilter
          label="프로젝트"
          options={projectOptions}
          selected={selProjects}
          onChange={onProjectsChange}
        />
      )}
      <MultiSelectFilter
        label="담당자"
        options={memberOptions}
        selected={selMembers}
        onChange={onMembersChange}
      />
      {onToggleAssigneeOnBar && (
        <button
          onClick={onToggleAssigneeOnBar}
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 5,
            border: 'none',
            background: showAssigneeOnBar ? '#e8e6df' : 'transparent',
            color: showAssigneeOnBar ? '#2C2C2A' : '#888780',
            fontWeight: showAssigneeOnBar ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          바에 담당자
        </button>
      )}
    </div>
  )
}
