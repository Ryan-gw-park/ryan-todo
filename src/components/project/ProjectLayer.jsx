import useStore from '../../hooks/useStore'
import UnifiedProjectHeader from './UnifiedProjectHeader'
import UnifiedProjectView from './UnifiedProjectView'

export default function ProjectLayer() {
  const { selectedProjectId, projects } = useStore()

  const project = projects.find(p => p.id === selectedProjectId)
  if (!project) {
    return (
      <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>
        프로젝트를 선택하세요
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <UnifiedProjectHeader project={project} />

      {/* Loop-37: 단일 통합 뷰 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <UnifiedProjectView projectId={selectedProjectId} />
        </div>
      </div>
    </div>
  )
}
