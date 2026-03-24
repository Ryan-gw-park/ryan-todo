import TimelineEngine from '../timeline/TimelineEngine'

/**
 * PersonalTimelineView — 개인 타임라인
 * scope="personal" — 내가 담당하는 MS/할일만 표시
 * TimelineEngine에 scope prop을 전달하여 내부에서 필터링
 */
export default function PersonalTimelineView() {
  return (
    <TimelineEngine
      rootLevel="project"
      projectId={null}
      initialScale="month"
      initialDepth="task"
      scope="personal"
    />
  )
}
