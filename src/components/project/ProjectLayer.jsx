import useStore from '../../hooks/useStore'
import ProjectHeader from './ProjectHeader'
import CompactMilestoneTab from './CompactMilestoneTab'
import TasksTab from './TasksTab'
import GanttMode from './timeline/GanttMode'
import DetailMode from './timeline/DetailMode'

export default function ProjectLayer() {
  const {
    selectedProjectId, projects,
    projectLayerTab, setProjectLayerTab,
    projectTimelineMode, setProjectTimelineMode,
  } = useStore()

  const project = projects.find(p => p.id === selectedProjectId)
  if (!project) {
    return (
      <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>
        프로젝트를 선택하세요
      </div>
    )
  }

  const tab = projectLayerTab
  const timelineMode = projectTimelineMode

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ProjectHeader
        project={project}
        currentTab={tab}
        onTabChange={setProjectLayerTab}
      />

      {/* 모드 바: Loop-28에서 숨김 (GanttMode가 마일스톤+할일 통합 표시) */}
      {/* ModeBar는 추후 정리 Loop에서 완전 제거 예정 */}
      {false && tab === 'ptimeline' && (
        <ModeBar
          modes={[
            { key: 'gantt', label: '타임라인' },
            { key: 'detail', label: '결과물 + Task' },
          ]}
          current={timelineMode}
          onChange={setProjectTimelineMode}
        />
      )}

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        {tab === 'milestone' && <CompactMilestoneTab projectId={selectedProjectId} />}
        {tab === 'tasks' && <TasksTab projectId={selectedProjectId} />}
        {/* Loop-28: 항상 GanttMode 사용 (마일스톤+할일 통합) */}
        {tab === 'ptimeline' && <GanttMode projectId={selectedProjectId} />}
      </div>
    </div>
  )
}

function ModeBar({ modes, current, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 1,
      padding: '6px 20px', background: '#fafaf8',
      borderBottom: '0.5px solid #e8e6df', flexShrink: 0,
    }}>
      {modes.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 5,
            cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            fontWeight: current === m.key ? 600 : 500,
            background: current === m.key ? '#e8e6df' : 'transparent',
            color: current === m.key ? '#2C2C2A' : '#a09f99',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
