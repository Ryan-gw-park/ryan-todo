import { useState, useRef, useEffect } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import ProjectFilter from '../shared/ProjectFilter'
import useProjectFilter from '../../hooks/useProjectFilter'
import useTeamMembers from '../../hooks/useTeamMembers'
import { CategorySection } from '../project/tasks'

const NON_DONE_CATS = CATEGORIES.filter(c => c.key !== 'done')

export default function ProjectView() {
  const { projects, tasks, collapseState, setCollapseValue, currentTeamId } = useStore()
  const { filteredProjects } = useProjectFilter(projects, tasks)
  const isMobile = window.innerWidth < 768
  const [activeProject, setActiveProject] = useState(filteredProjects[0]?.id || '')

  // ★ Loop-21: 팀원 이름 조회 (팀 모드일 때)
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
  const pendingFocusProject = useRef(null)

  // 뷰 진입 시 항상 가장 왼쪽 프로젝트 선택 (화면 렌더링 순서 기준: 팀 → 개인)
  useEffect(() => {
    if (filteredProjects.length > 0) {
      const teamPs = currentTeamId ? filteredProjects.filter(pr => pr.teamId === currentTeamId) : filteredProjects
      const personalPs = currentTeamId ? filteredProjects.filter(pr => !pr.teamId) : []
      const leftmost = teamPs[0] || personalPs[0]
      if (leftmost) setActiveProject(leftmost.id)
    }
  }, []) // 마운트 시에만 실행

  // Auto-switch active tab when hidden by filter
  useEffect(() => {
    if (filteredProjects.length > 0 && !filteredProjects.find(pr => pr.id === activeProject)) {
      setActiveProject(filteredProjects[0].id)
    }
  }, [filteredProjects, activeProject])

  useEffect(() => {
    const newExp = {}
    tasks.forEach(t => { if (expanded[t.id] === undefined) newExp[t.id] = true })
    if (Object.keys(newExp).length) {
      for (const [k, v] of Object.entries(newExp)) setCollapseValue('projectExpanded', k, v)
    }
  }, [tasks.length])

  /* Focus first task after project switch */
  useEffect(() => {
    if (pendingFocusProject.current === activeProject) {
      pendingFocusProject.current = null
      // Try to focus first non-done category that has tasks, or activate its add button
      setTimeout(() => {
        for (const cat of NON_DONE_CATS) {
          const ref = categoryRefs.current[cat.key]
          if (ref?.focusFirst?.()) return // returns true if focused
        }
      }, 60)
    }
  }, [activeProject])

  /* Auto-focus on tab switch */
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        for (const cat of NON_DONE_CATS) {
          const ref = categoryRefs.current[cat.key]
          if (ref?.focusFirst?.()) return
        }
      }, 60)
    }
    window.addEventListener('view-focus', handler)
    return () => window.removeEventListener('view-focus', handler)
  }, [])

  /* Ctrl+←/→ to switch projects */
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const idx = filteredProjects.findIndex(pr => pr.id === activeProject)
        if (idx === -1) return
        const next = e.key === 'ArrowLeft'
          ? (idx - 1 + filteredProjects.length) % filteredProjects.length
          : (idx + 1) % filteredProjects.length
        pendingFocusProject.current = filteredProjects[next].id
        setActiveProject(filteredProjects[next].id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeProject, filteredProjects])

  const p = filteredProjects.find(pr => pr.id === activeProject) || filteredProjects[0]

  // No projects match current filter — show structure with filter so user can navigate back
  if (!p) return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0 }}>프로젝트</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>↑↓ 이동 · Enter 새 항목 · Tab 레벨 · Ctrl+←/→ 프로젝트 이동</p>
          </div>
          <ProjectFilter />
        </div>
        <div style={{ padding: 60, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
          {projects.length === 0 ? '프로젝트를 추가하세요' : '해당 필터에 맞는 프로젝트가 없습니다'}
        </div>
      </div>
    </div>
  )

  const c = getColor(p.color)
  const toggleExpand = (id) => setCollapseValue('projectExpanded', id, !(expanded[id] !== false))

  /* Cross-category navigation: exit down from one → enter next. Returns true if focus moved. */
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

  return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div className="today-header" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="today-greeting">
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0 }}>프로젝트</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>↑↓ 이동 · Enter 새 항목 · Tab 레벨 · Ctrl+←/→ 프로젝트 이동</p>
          </div>
          <div className="today-toolbar">
            <ProjectFilter />
          </div>
        </div>

        {/* Project chips */}
        <div className="project-tab-bar" style={{ display: 'flex', gap: 6, marginBottom: 28, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
          {(() => {
            const teamPs = currentTeamId ? filteredProjects.filter(pr => pr.teamId === currentTeamId) : filteredProjects
            const personalPs = currentTeamId ? filteredProjects.filter(pr => !pr.teamId) : []
            const showDivider = currentTeamId && teamPs.length > 0 && personalPs.length > 0
            return (
              <>
                {teamPs.map(pr => {
                  const pc = getColor(pr.color)
                  const isAct = pr.id === activeProject
                  return (
                    <button key={pr.id} onClick={() => setActiveProject(pr.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: isAct ? `1.5px solid ${pc.dot}` : '1px solid #e8e8e8', background: isAct ? pc.header : 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: isAct ? 600 : 400, color: isAct ? pc.text : '#888', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: pc.dot }} />{pr.name}
                    </button>
                  )
                })}
                {showDivider && (
                  <>
                    <div style={{ width: 1, height: 24, background: '#e0e0e0', flexShrink: 0, margin: '0 2px' }} />
                    <span style={{ fontSize: 10, color: '#aaa', fontWeight: 600, flexShrink: 0 }}>개인</span>
                  </>
                )}
                {personalPs.map(pr => {
                  const pc = getColor(pr.color)
                  const isAct = pr.id === activeProject
                  return (
                    <button key={pr.id} onClick={() => setActiveProject(pr.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: isAct ? `1.5px solid ${pc.dot}` : '1px solid #e8e8e8', background: isAct ? pc.header : 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: isAct ? 600 : 400, color: isAct ? pc.text : '#888', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: pc.dot }} />{pr.name}
                    </button>
                  )
                })}
              </>
            )
          })()}
        </div>

        {/* Project header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: c.dot }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#37352f', margin: 0 }}>{p.name}</h1>
        </div>

        {/* Category sections */}
        {CATEGORIES.map((cat, ci) => {
          const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key).sort((a, b) => a.sortOrder - b.sortOrder)
          return (
            <CategorySection
              key={cat.key}
              ref={el => categoryRefs.current[cat.key] = el}
              cat={cat}
              catTasks={catTasks}
              projectId={p.id}
              color={c}
              expanded={expanded}
              toggleExpand={toggleExpand}
              memberMap={memberMap}
              onExitSectionDown={() => handleExitSectionDown(ci)}
              onExitSectionUp={() => handleExitSectionUp(ci)}
            />
          )
        })}
      </div>
    </div>
  )
}
