import useStore from '../../hooks/useStore'
import ProjectHeader from './ProjectHeader'
import CompactMilestoneTab from './CompactMilestoneTab'
import TasksTab from './TasksTab'
import TimelineView from '../views/TimelineView'

export default function ProjectLayer() {
  const {
    selectedProjectId, projects,
    projectLayerTab, setProjectLayerTab,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ProjectHeader
        project={project}
        currentTab={tab}
        onTabChange={setProjectLayerTab}
      />

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {tab === 'milestone' && <CompactMilestoneTab projectId={selectedProjectId} />}
        {tab === 'tasks' && <TasksTab projectId={selectedProjectId} />}
        {/* Loop-30: 통합 TimelineView 사용 */}
        {tab === 'ptimeline' && <TimelineView projectId={selectedProjectId} />}
      </div>
    </div>
  )
}
