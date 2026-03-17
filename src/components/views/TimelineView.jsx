import TimelineEngine from '../timeline/TimelineEngine'

/**
 * Loop-34: TimelineView — thin wrapper around TimelineEngine
 *
 * 글로벌 타임라인: projectId=null → rootLevel='project'
 * 프로젝트 타임라인: projectId=값 → rootLevel='milestone'
 */
export default function TimelineView({ projectId = null }) {
  return (
    <TimelineEngine
      rootLevel={projectId ? 'milestone' : 'project'}
      projectId={projectId}
      initialScale="month"
      initialDepth={projectId ? 'task' : 'task'}
    />
  )
}
