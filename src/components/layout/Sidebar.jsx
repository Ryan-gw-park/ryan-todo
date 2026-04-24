import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../../hooks/useStore'
import { getColor, COLOR_OPTIONS } from '../../utils/colors'
import TeamSwitcher from '../team/TeamSwitcher'
import useNotifications from '../../hooks/useNotifications'

/* ═══════════════════════════════════════════════════
   Unified spacing — single source of truth
   All items (NavItem, ProjectItem, FooterItem, Profile)
   share the same horizontal grid:
     [itemMx] [itemPx] [iconW] [gap] [text…]
   ═══════════════════════════════════════════════════ */
const S = {
  sidebarW:     210,
  collapsedW:   52,
  outerPx:      14,         // sidebar outer horizontal padding (logo, section labels)
  itemMx:       6,          // item horizontal margin
  itemPx:       14,         // item inner horizontal padding
  itemPy:       7,          // item vertical padding
  gap:          10,         // icon-to-text gap (all items)
  radius:       7,          // item border-radius (all items)
  iconW:        18,         // icon column width (all icons/dots centered in this)
  sectionPt:    14,         // section label top padding
  sectionPb:    4,          // section label bottom padding
  dividerMy:    6,          // divider vertical margin
  fontNav:      13,         // nav / project item font
  fontFooter:   12,         // footer item font (slightly smaller)
  fontSection:  10,         // section label font
}

// 개인/팀 공용 뷰
const COMMON_VIEWS = [
  { key: 'matrix',   label: '할일',       icon: '⊞' },
  { key: 'timeline', label: '타임라인',   icon: '▤' },
]
// 팀 전용 뷰
const TEAM_ONLY_VIEWS = [
  { key: 'members',  label: '팀원',       icon: '👥' },
  { key: 'weekly-schedule', label: '주간 스케줄', icon: '📅' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const {
    currentView, setView,
    projects, currentTeamId, myTeams,
    toggleNotificationPanel,
    userName, addProject,
    sidebarCollapsed, toggleSidebar,
    selectedProjectId, enterProjectLayer,
    archiveProject, unarchiveProject,
  } = useStore()

  const [showTeamSwitcher, setShowTeamSwitcher] = useState(false)
  const [showAddProject, setShowAddProject] = useState(false)
  const [addProjectScope, setAddProjectScope] = useState('team') // 'team' or 'personal'
  const [sectionCollapsed, setSectionCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebarSections') || '{}') } catch { return {} }
  })
  const toggleSection = (key) => {
    setSectionCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('sidebarSections', JSON.stringify(next))
      return next
    })
  }
  const currentTeam = myTeams?.find(t => t.id === currentTeamId)
  const teamName = currentTeam?.name || '개인 모드'

  // 프로젝트 활성 상태 판별
  const isProjectActive = (projectId) =>
    currentView === 'projectLayer' && selectedProjectId === projectId

  const [sidebarHovered, setSidebarHovered] = useState(false)

  // 프로젝트 분리: 팀 / 개인 (활성 + 아카이브)
  const sortProjectsLocally = useStore(s => s.sortProjectsLocally)
  const teamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId && !p.archivedAt))
  const personalProjects = sortProjectsLocally(projects.filter(p => !p.teamId && !p.archivedAt))
  const archivedTeamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId && p.archivedAt))
  const archivedPersonalProjects = sortProjectsLocally(projects.filter(p => !p.teamId && p.archivedAt))

  // 12b: 프로젝트 순서 DnD
  const reorderProjects = useStore(s => s.reorderProjects)
  const sidebarSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const allSortableProjects = useMemo(() => [...teamProjects, ...personalProjects], [teamProjects, personalProjects])
  const handleSidebarDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeSection = active.data.current?.section
    const overSection = over.data.current?.section
    if (activeSection !== overSection) return  // 섹션 경계 금지
    const activePid = active.data.current?.projectId
    const overPid = over.data.current?.projectId
    if (!activePid || !overPid) return
    // Loop-45 F-30: system project 이동 거부 (방어적 2차 가드 — SortableProjectItem disabled가 1차)
    const activeProject = [...teamProjects, ...personalProjects].find(p => p.id === activePid)
    if (activeProject?.isSystem) return
    const sectionList = activeSection === 'team' ? teamProjects : personalProjects
    const oldIdx = sectionList.findIndex(p => p.id === activePid)
    const newIdx = sectionList.findIndex(p => p.id === overPid)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(sectionList, oldIdx, newIdx)
    reorderProjects(reordered)
  }, [teamProjects, personalProjects, reorderProjects])

  // 알림 뱃지
  const refreshTrigger = useStore(s => s.notificationRefreshTrigger)
  const showNotificationPanel = useStore(s => s.showNotificationPanel)
  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    if (!currentTeamId) { setUnreadCount(0); return }
    let cancelled = false
    useNotifications.getUnreadCount(currentTeamId).then(c => { if (!cancelled) setUnreadCount(c) })
    return () => { cancelled = true }
  }, [currentTeamId, showNotificationPanel, refreshTrigger])

  // 이메일
  const [email, setEmail] = useState('')
  useEffect(() => {
    import('../../utils/supabase').then(({ getDb }) => {
      const db = getDb()
      if (db) db.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ''))
    })
  }, [])

  const collapsed = sidebarCollapsed

  return (
    <div
      onMouseEnter={() => setSidebarHovered(true)}
      onMouseLeave={() => setSidebarHovered(false)}
      style={{
        width: collapsed ? S.collapsedW : S.sidebarW,
        background: '#fff',
        borderRight: '0.5px solid #e8e6df',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
        height: '100%',
        transition: 'width .2s ease',
        position: 'relative',
      }}
    >
      {/* ── Collapse toggle ── */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleSidebar() }}
        style={{
          position: 'absolute', right: -12, top: 20,
          width: 24, height: 24, borderRadius: '50%',
          background: '#fff', border: '1px solid #e8e6df',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          opacity: sidebarHovered ? 1 : 0,
          transition: 'opacity .15s ease',
          pointerEvents: sidebarHovered ? 'auto' : 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M7.5 2.5L4 6L7.5 9.5" stroke="#6b6a66" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Top: Unified Team Selector ── */}
      <div style={{
        padding: `${S.outerPx}px ${collapsed ? S.itemMx + 4 : S.outerPx}px 0`,
        display: 'flex', flexDirection: 'column',
      }}>
        <div
          onClick={() => collapsed ? toggleSidebar() : setShowTeamSwitcher(!showTeamSwitcher)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f6f5f0'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <img
            src="/favicon.ico"
            alt=""
            style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }}
            onError={e => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextSibling.style.display = 'flex'
            }}
          />
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: '#1D9E75', display: 'none',
            alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 12, fontWeight: 500, flexShrink: 0,
          }}>
            R
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#2C2C2A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {teamName}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 5l3 3 3-3" stroke="#a09f99" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </div>
        {!collapsed && (
          <div style={{ position: 'relative' }}>
            <TeamSwitcher controlled open={showTeamSwitcher} onClose={() => setShowTeamSwitcher(false)} />
          </div>
        )}
        {!collapsed && <div style={{ height: 1, background: '#f0efe8', margin: '8px 0 4px' }} />}
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${S.dividerMy}px 0` }}>
        {/* ─── Section 1: 개인 ─── */}
        {!collapsed && <SectionLabel label="개인" />}
        {COMMON_VIEWS.map(v => (
          <NavItem key={`personal-${v.key}`} icon={v.icon} label={v.label}
            isActive={currentView === `personal-${v.key}`}
            onClick={() => setView(`personal-${v.key}`)}
            collapsed={collapsed}
          />
        ))}
        <NavItem icon="✎" label="노트" isActive={currentView === 'memory'} onClick={() => setView('memory')} collapsed={collapsed} />

        {/* ─── Section 2: 팀 (currentTeamId 있을 때만) ─── */}
        {currentTeamId && (
          <>
            <Divider />
            {!collapsed && <SectionLabel label="팀" />}
            {[...COMMON_VIEWS, ...TEAM_ONLY_VIEWS].map(v => (
              <NavItem key={`team-${v.key}`} icon={v.icon} label={v.label}
                isActive={currentView === `team-${v.key}`}
                onClick={() => setView(`team-${v.key}`)}
                collapsed={collapsed}
              />
            ))}
          </>
        )}

        <Divider />

        {/* ─── Section 3: 프로젝트 ─── */}
        {!collapsed && <SectionLabel label="프로젝트" />}

        <DndContext
          sensors={sidebarSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSidebarDragEnd}
        >
          <SortableContext
            items={allSortableProjects.map(p => `project-sidebar:${p.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {/* 팀 프로젝트 */}
            {currentTeamId && (
              <>
                {!collapsed && <SubSectionHeader label="팀 프로젝트" collapsed={sectionCollapsed.projTeam} onClick={() => toggleSection('projTeam')} onAdd={() => { setAddProjectScope('team'); setShowAddProject(true) }} />}
                {!sectionCollapsed.projTeam && teamProjects.map(p => (
                  <SortableProjectItem key={p.id} project={p} section="team" isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} archiveFn={archiveProject} />
                ))}
              </>
            )}

            {/* 팀 아카이브 */}
            {currentTeamId && archivedTeamProjects.length > 0 && !collapsed && (
              <>
                <SubSectionHeader label="팀 아카이브" collapsed={sectionCollapsed.archiveTeam !== false} onClick={() => toggleSection('archiveTeam')} />
                {sectionCollapsed.archiveTeam === false && archivedTeamProjects.map(p => (
                  <ArchiveProjectItem key={p.id} project={p} onRestore={() => unarchiveProject(p.id)} collapsed={collapsed} />
                ))}
              </>
            )}

            {/* 개인 프로젝트 */}
            {!collapsed && <SubSectionHeader label="개인 프로젝트" collapsed={sectionCollapsed.projPersonal} onClick={() => toggleSection('projPersonal')} onAdd={() => { setAddProjectScope('personal'); setShowAddProject(true) }} />}
            {!sectionCollapsed.projPersonal && personalProjects.map(p => (
              <SortableProjectItem key={p.id} project={p} section="personal" isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} archiveFn={archiveProject} />
            ))}
          </SortableContext>
        </DndContext>

        {/* 개인 아카이브 */}
        {archivedPersonalProjects.length > 0 && !collapsed && (
          <>
            <SubSectionHeader label="개인 아카이브" collapsed={sectionCollapsed.archivePersonal !== false} onClick={() => toggleSection('archivePersonal')} />
            {sectionCollapsed.archivePersonal === false && archivedPersonalProjects.map(p => (
              <ArchiveProjectItem key={p.id} project={p} onRestore={() => unarchiveProject(p.id)} collapsed={collapsed} />
            ))}
          </>
        )}
      </div>

      {/* ── Footer — same padding/margin rhythm as nav items ── */}
      <div style={{
        borderTop: '0.5px solid #e8e6df',
        padding: `${S.dividerMy}px 0`,
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }}>
        {currentTeamId && (
          <FooterItem icon="🔔" label="알림" badge={unreadCount > 0 ? unreadCount : null} onClick={toggleNotificationPanel} collapsed={collapsed} />
        )}
        <FooterItem icon="?" label="도움말" onClick={() => navigate('/help')} collapsed={collapsed} />

        {!collapsed && <div style={{ height: '0.5px', background: '#e8e6df', margin: `${S.dividerMy - 2}px ${S.outerPx}px` }} />}

        {/* Profile — same item grid */}
        <div
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: S.gap,
            padding: `${S.itemPy}px ${S.itemPx}px`,
            margin: `1px ${S.itemMx}px`,
            borderRadius: S.radius,
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: S.iconW + 4, height: S.iconW + 4, borderRadius: '50%',
            background: '#1D9E75',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, fontWeight: 600, flexShrink: 0,
          }}>
            {(userName || 'U')[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: S.fontFooter, fontWeight: 500, color: '#2C2C2A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName || 'User'}</div>
              <div style={{ fontSize: S.fontSection, color: '#b4b2a9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email || ''}</div>
            </div>
          )}
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddProject && (
        <AddProjectModal
          scope={addProjectScope}
          currentTeamId={currentTeamId}
          addProject={addProject}
          onClose={() => setShowAddProject(false)}
        />
      )}
    </div>
  )
}

/* ═══ Sub-components — all use S constants for consistent alignment ═══ */

function SectionLabel({ label, onAdd }) {
  // Left-aligned with item text: itemMx + itemPx = 20px from sidebar edge
  return (
    <div style={{
      padding: `${S.sectionPt}px ${S.itemMx + S.itemPx}px ${S.sectionPb}px`,
      fontSize: S.fontSection,
      color: '#a09f99',
      fontWeight: 600,
      letterSpacing: '.05em',
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {label}
      {onAdd && (
        <span
          onClick={onAdd}
          style={{ fontSize: 14, color: '#b4b2a9', cursor: 'pointer', fontWeight: 400, lineHeight: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = '#6b6a66'}
          onMouseLeave={e => e.currentTarget.style.color = '#b4b2a9'}
        >+</span>
      )}
    </div>
  )
}

function SubSectionHeader({ label, collapsed, onClick, onAdd }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: `6px ${S.itemMx + S.itemPx}px 2px ${S.itemMx + S.itemPx + 4}px`,
        fontSize: 11, fontWeight: 500, color: '#a09f99',
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      <span onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <span style={{ fontSize: 9, width: 12 }}>{collapsed ? '▸' : '▾'}</span>
        <span>{label}</span>
      </span>
      {onAdd && (
        <span
          onClick={e => { e.stopPropagation(); onAdd() }}
          style={{ fontSize: 14, color: '#b4b2a9', cursor: 'pointer', fontWeight: 400, lineHeight: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = '#6b6a66'}
          onMouseLeave={e => e.currentTarget.style.color = '#b4b2a9'}
        >+</span>
      )}
    </div>
  )
}

function NavItem({ icon, label, isActive, onClick, collapsed, indent = 0 }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: S.gap,
        padding: collapsed ? `${S.itemPy}px 0` : `${S.itemPy}px ${S.itemPx}px ${S.itemPy}px ${S.itemPx + indent * 12}px`,
        margin: `1px ${S.itemMx}px`,
        borderRadius: S.radius,
        cursor: 'pointer',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontSize: S.fontNav,
        color: isActive ? '#2C2C2A' : '#6b6a66',
        background: isActive ? '#f0efe8' : hovered ? '#f5f4f0' : 'transparent',
        fontWeight: isActive ? 500 : 400,
        transition: 'background .12s',
      }}
    >
      <span style={{
        width: S.iconW, textAlign: 'center',
        fontSize: collapsed ? 18 : S.fontNav,
        flexShrink: 0, lineHeight: 1,
        opacity: isActive ? 0.85 : 0.55,
      }}>{icon}</span>
      {!collapsed && label}
    </div>
  )
}

// 12b: Sortable wrapper (ProjectItem은 수정하지 않고 감싸기만)
function SortableProjectItem({ project, section, isActive, onClick, collapsed, indent, archiveFn }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-sidebar:${project.id}`,
    data: { section, projectId: project.id },
    disabled: project.isSystem === true,  // Loop-45 F-30
  })
  const [hover, setHover] = useState(false)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && !collapsed && (
        <div
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            cursor: 'grab', color: '#b4b2a9', fontSize: 11, fontWeight: 700,
            padding: '4px 2px', lineHeight: 1, zIndex: 2, userSelect: 'none',
          }}
        >≡</div>
      )}
      <ProjectItem
        project={project}
        isActive={isActive}
        onClick={onClick}
        collapsed={collapsed}
        indent={indent}
        archiveFn={archiveFn}
      />
    </div>
  )
}

function ProjectItem({ project, isActive, onClick, collapsed, indent = 0, archiveFn }) {
  const [hovered, setHovered] = useState(false)
  const openModal = useStore(s => s.openModal)
  // Loop-45: system project는 neutral gray dot (#888780), 일반은 팔레트에서 조회
  const color = project.isSystem ? { dot: '#888780' } : getColor(project.color)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? project.name : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: S.gap,
        padding: collapsed ? `${S.itemPy}px 0` : `${S.itemPy}px ${S.itemPx}px ${S.itemPy}px ${S.itemPx + indent * 12}px`,
        margin: `1px ${S.itemMx}px`,
        borderRadius: S.radius,
        cursor: 'pointer',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontSize: S.fontNav,
        color: isActive ? '#2C2C2A' : '#6b6a66',
        background: isActive ? '#f0efe8' : hovered ? '#f5f4f0' : 'transparent',
        fontWeight: isActive ? 500 : 400,
        transition: 'background .12s',
      }}
    >
      {/* Dot centered in same iconW column as nav icons */}
      <div style={{
        width: S.iconW, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{
          width: collapsed ? 10 : 8, height: collapsed ? 10 : 8,
          borderRadius: '50%', background: color.dot,
        }} />
      </div>
      {!collapsed && (
        <>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {project.name}
          </span>
          {hovered && !project.isSystem && (
            <>
              <span
                title="아카이브"
                onClick={e => { e.stopPropagation(); archiveFn && archiveFn(project.id) }}
                style={{ fontSize: 13, color: '#b4b2a9', padding: '0 2px', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#666'}
                onMouseLeave={e => e.currentTarget.style.color = '#b4b2a9'}
              >
                📦
              </span>
              <span
                onClick={e => { e.stopPropagation(); openModal({ type: 'projectSettings', projectId: project.id }) }}
                style={{ fontSize: 15, color: '#b4b2a9', padding: '0 4px', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#666'}
                onMouseLeave={e => e.currentTarget.style.color = '#b4b2a9'}
              >
                ⚙
              </span>
            </>
          )}
        </>
      )}
    </div>
  )
}

function FooterItem({ icon, label, badge, onClick, collapsed }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: S.gap,
        padding: collapsed ? `${S.itemPy}px 0` : `${S.itemPy}px ${S.itemPx}px`,
        margin: `1px ${S.itemMx}px`,
        borderRadius: S.radius,
        cursor: 'pointer',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontSize: S.fontFooter,
        color: hovered ? '#6b6a66' : '#a09f99',
        background: hovered ? '#f5f4f0' : 'transparent',
        transition: 'background .12s',
        position: 'relative',
      }}
    >
      <span style={{
        width: S.iconW, textAlign: 'center',
        fontSize: collapsed ? 16 : S.fontFooter,
        flexShrink: 0, lineHeight: 1,
      }}>{icon}</span>
      {!collapsed && label}
      {badge && (
        <span style={{
          marginLeft: collapsed ? 0 : 'auto',
          position: collapsed ? 'absolute' : 'static',
          top: collapsed ? 2 : undefined,
          right: collapsed ? 4 : undefined,
          fontSize: 10, fontWeight: 600,
          background: '#ef4444', color: '#fff',
          borderRadius: 999, padding: '1px 6px',
          minWidth: collapsed ? 14 : undefined,
          textAlign: 'center', lineHeight: '16px',
        }}>{badge}</span>
      )}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '0.5px', background: '#e8e6df', margin: `${S.dividerMy}px ${S.outerPx}px` }} />
}

function AddProjectModal({ scope, currentTeamId, addProject, onClose }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('blue')
  const inputRef = useRef(null)

  useEffect(() => { if (inputRef.current) inputRef.current.focus() }, [])

  const handleAdd = () => {
    if (!name.trim()) return
    const projectScope = currentTeamId ? scope : undefined
    addProject(name.trim(), color, projectScope)
    onClose()
  }

  const scopeLabel = scope === 'team' ? '팀 프로젝트' : '개인 프로젝트'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 360, background: 'white', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', zIndex: 210, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#37352f', margin: 0 }}>새 프로젝트 추가</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px 20px' }}>
          {currentTeamId && (
            <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>소속: {scopeLabel}</div>
          )}
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose() }}
            placeholder="프로젝트 이름..."
            style={{ width: '100%', fontSize: 14, fontWeight: 500, border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
            {COLOR_OPTIONS.map(co => (
              <button key={co.id} onClick={() => setColor(co.id)} style={{ width: 24, height: 24, borderRadius: 6, background: co.dot, border: color === co.id ? '2.5px solid #37352f' : '2px solid transparent', cursor: 'pointer', transition: 'border 0.1s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={!name.trim()} style={{ fontSize: 13, padding: '6px 16px', borderRadius: 6, border: 'none', background: '#37352f', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: name.trim() ? 1 : 0.5 }}>추가</button>
            <button onClick={onClose} style={{ fontSize: 13, padding: '6px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          </div>
        </div>
      </div>
    </>
  )
}

function ArchiveProjectItem({ project, onRestore, collapsed }) {
  const [hovered, setHovered] = useState(false)
  const color = getColor(project.color)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: S.gap,
        padding: `${S.itemPy}px ${S.itemPx}px ${S.itemPy}px ${S.itemPx + 12}px`,
        margin: `1px ${S.itemMx}px`,
        borderRadius: S.radius,
        fontSize: S.fontNav,
        color: '#a09f99',
        background: hovered ? '#f5f4f0' : 'transparent',
        transition: 'background .12s',
      }}
    >
      <div style={{
        width: S.iconW, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color.dot, opacity: 0.45,
        }} />
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontStyle: 'italic' }}>
        {project.name}
      </span>
      {hovered && (
        <span
          title="복원"
          onClick={e => { e.stopPropagation(); onRestore() }}
          style={{ fontSize: 12, color: '#1D9E75', padding: '0 4px', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          복원
        </span>
      )}
    </div>
  )
}
