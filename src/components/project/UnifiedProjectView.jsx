import { useState, useMemo, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { getColor } from '../../utils/colors'
import { buildTree, expandAll } from '../../utils/milestoneTree'
import HierarchicalTree from './HierarchicalTree'
import ProjectTaskPanel from './ProjectTaskPanel'

export default function UnifiedProjectView({ projectId }) {
  const project = useStore(s => s.projects.find(p => p.id === projectId))
  const milestones = useStore(s => s.milestones)
  const tasks = useStore(s => s.tasks)
  const { pkm, loading: pkmLoading } = useProjectKeyMilestone(projectId)

  const tree = useMemo(() => buildTree(milestones, projectId), [milestones, projectId])
  const [expanded, setExpanded] = useState(() => expandAll(tree))
  const [selectedLeafId, setSelectedLeafId] = useState(null)
  const [rightMode, setRightMode] = useState('전체') // '전체' | '선택' | '타임라인'

  const isMobile = window.innerWidth < 768

  // 리프 선택 시 우측을 '선택' 모드로 전환
  const handleSelectLeaf = useCallback((leafId) => {
    setSelectedLeafId(leafId)
    setRightMode('선택')
  }, [])

  const toggleExpand = useCallback((nodeId) => {
    setExpanded(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))
  }, [])

  const expandAllNodes = useCallback(() => {
    setExpanded(expandAll(tree))
  }, [tree])

  const collapseAll = useCallback(() => {
    setExpanded({})
  }, [])

  // 프로젝트 할일 (이 프로젝트에 연결된 할일만)
  const projectTasks = useMemo(() => {
    return tasks.filter(t => t.projectId === projectId && !t.deletedAt)
  }, [tasks, projectId])

  if (!project) return null

  const color = getColor(project.color)
  const pkmId = pkm?.id || null

  if (pkmLoading) {
    return (
      <div style={{ padding: 40, color: '#a09f99', textAlign: 'center', fontSize: 13 }}>
        로딩 중...
      </div>
    )
  }

  // 모바일: 세로 스택
  if (isMobile) {
    return (
      <div data-view="unified-project" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
        <div style={{ padding: '12px 16px 0' }}>
          <HierarchicalTree
            tree={tree}
            expanded={expanded}
            selectedLeafId={selectedLeafId}
            onSelectLeaf={handleSelectLeaf}
            onToggleExpand={toggleExpand}
            onExpandAll={expandAllNodes}
            onCollapseAll={collapseAll}
            tasks={projectTasks}
            projectId={projectId}
            pkmId={pkmId}
            color={color}
          />
        </div>
        <div style={{ flex: 1, minHeight: 200 }}>
          <ProjectTaskPanel
            tree={tree}
            milestones={milestones}
            tasks={projectTasks}
            selectedLeafId={selectedLeafId}
            rightMode={rightMode}
            onModeChange={setRightMode}
            projectId={projectId}
            pkmId={pkmId}
            color={color}
          />
        </div>
      </div>
    )
  }

  // 데스크톱: 좌우 분할
  return (
    <div data-view="unified-project" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 좌측: 트리 */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', borderRight: '0.5px solid #e8e6df', flexShrink: 0, padding: '8px 0', minWidth: 200, maxWidth: '55%' }}>
        <HierarchicalTree
          tree={tree}
          expanded={expanded}
          selectedLeafId={selectedLeafId}
          onSelectLeaf={handleSelectLeaf}
          onToggleExpand={toggleExpand}
          onExpandAll={expandAllNodes}
          onCollapseAll={collapseAll}
          tasks={projectTasks}
          projectId={projectId}
          pkmId={pkmId}
          color={color}
        />
      </div>

      {/* 우측: 할일 패널 */}
      <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ProjectTaskPanel
          tree={tree}
          milestones={milestones}
          tasks={projectTasks}
          selectedLeafId={selectedLeafId}
          rightMode={rightMode}
          onModeChange={setRightMode}
          projectId={projectId}
          pkmId={pkmId}
          color={color}
        />
      </div>
    </div>
  )
}
