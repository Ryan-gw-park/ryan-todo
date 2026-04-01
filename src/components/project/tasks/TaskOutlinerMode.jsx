import { useState, useRef, useEffect, useMemo } from 'react'
import useStore from '../../../hooks/useStore'
import { getColor, CATEGORIES } from '../../../utils/colors'
import useTeamMembers from '../../../hooks/useTeamMembers'
import { CategorySection } from './index'

export default function TaskOutlinerMode({ projectId }) {
  const NON_DONE_CATS = useMemo(() => CATEGORIES.filter(c => c.key !== 'done'), [])
  const { projects, tasks, collapseState, setCollapseValue, currentTeamId } = useStore()
  const allTasks = useMemo(() => tasks, [tasks])
  const isMobile = window.innerWidth < 768

  const project = projects.find(p => p.id === projectId)
  const color = project ? getColor(project.color) : getColor()

  // Team member names
  const [memberMap, setMemberMap] = useState({})
  useEffect(() => {
    if (!currentTeamId) return
    useTeamMembers.getMembers(currentTeamId).then(members => {
      const map = {}
      members.forEach(m => { map[m.userId] = m.displayName })
      setMemberMap(map)
    })
  }, [currentTeamId])

  const expanded = collapseState.projectExpanded || {}
  const categoryRefs = useRef({})

  useEffect(() => {
    const newExp = {}
    allTasks.forEach(t => { if (expanded[t.id] === undefined) newExp[t.id] = true })
    if (Object.keys(newExp).length) {
      for (const [k, v] of Object.entries(newExp)) setCollapseValue('projectExpanded', k, v)
    }
  }, [allTasks.length])

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => {
      for (const cat of NON_DONE_CATS) {
        const ref = categoryRefs.current[cat.key]
        if (ref?.focusFirst?.()) return
      }
    }, 60)
  }, [projectId])

  const toggleExpand = (id) => setCollapseValue('projectExpanded', id, !(expanded[id] !== false))

  // Cross-category navigation
  const handleExitSectionDown = (catIndex) => {
    for (let i = catIndex + 1; i < CATEGORIES.length; i++) {
      const ref = categoryRefs.current[CATEGORIES[i].key]
      if (ref?.focusFirst?.()) return true
    }
    return false
  }

  const handleExitSectionUp = (catIndex) => {
    for (let i = catIndex - 1; i >= 0; i--) {
      const ref = categoryRefs.current[CATEGORIES[i].key]
      if (ref?.focusLast?.()) return true
    }
    return false
  }

  if (!project) {
    return <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>프로젝트를 찾을 수 없습니다</div>
  }

  return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '24px 32px' }}>
      {CATEGORIES.map((cat, ci) => {
        const catTasks = allTasks.filter(t => t.projectId === projectId && t.category === cat.key && !t.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)
        return (
          <CategorySection
            key={cat.key}
            ref={el => categoryRefs.current[cat.key] = el}
            cat={cat}
            catTasks={catTasks}
            projectId={projectId}
            color={color}
            expanded={expanded}
            toggleExpand={toggleExpand}
            memberMap={memberMap}
            onExitSectionDown={() => handleExitSectionDown(ci)}
            onExitSectionUp={() => handleExitSectionUp(ci)}
          />
        )
      })}
    </div>
  )
}
