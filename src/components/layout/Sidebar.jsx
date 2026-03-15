import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import TeamSwitcher from '../team/TeamSwitcher'

const GLOBAL_VIEWS = [
  { key: 'today',    label: '오늘 할일',  icon: '📋' },
  { key: 'allTasks', label: '전체 할일',  icon: '📑' },
  { key: 'matrix',   label: '매트릭스',   icon: '⊞' },
  { key: 'timeline', label: '타임라인',   icon: '▤' },
  { key: 'memory',   label: '노트',       icon: '✎' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const {
    currentView, setView,
    projects, currentTeamId,
    showNotificationPanel, toggleNotificationPanel,
    userName, setShowProjectMgr,
    selectedProjectId, enterProjectLayer,
    sidebarCollapsed, toggleSidebar,
  } = useStore()

  // 사이드바 호버 상태 (토글 버튼 표시용)
  const [sidebarHovered, setSidebarHovered] = useState(false)

  // 프로젝트 분리: 팀 / 개인
  const sortProjectsLocally = useStore(s => s.sortProjectsLocally)
  const teamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId))
  const personalProjects = sortProjectsLocally(projects.filter(p => !p.teamId))

  // 읽지 않은 알림 수 (간단 구현 — 추후 useNotifications 연동)
  const [unreadCount, setUnreadCount] = useState(0)

  // 프로젝트 클릭 → 프로젝트 레이어 진입
  function handleProjectClick(projectId) {
    enterProjectLayer(projectId)
  }

  // 프로젝트 활성 상태 판별
  const isProjectActive = (projectId) =>
    currentView === 'projectLayer' && selectedProjectId === projectId

  // 이메일 가져오기 (간단 구현)
  const [email, setEmail] = useState('')
  useEffect(() => {
    import('../../utils/supabase').then(({ getDb }) => {
      const db = getDb()
      if (db) {
        db.auth.getUser().then(({ data }) => {
          setEmail(data?.user?.email || '')
        })
      }
    })
  }, [])

  const collapsed = sidebarCollapsed

  return (
    <div
      onMouseEnter={() => setSidebarHovered(true)}
      onMouseLeave={() => setSidebarHovered(false)}
      onClick={(e) => {
        // 빈 영역 클릭 시 사이드바 토글 (버튼이나 링크가 아닌 경우)
        if (e.target === e.currentTarget) toggleSidebar()
      }}
      style={{
        width: collapsed ? 52 : 210,
        background: '#fff',
        borderRight: '0.5px solid #e8e6df',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
        height: '100%',
        transition: 'width .2s ease',
        position: 'relative',
        cursor: 'default',
      }}>
      {/* Collapse Toggle Button - 호버시에만 표시 */}
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
          <path d="M7.5 2.5L4 6L7.5 9.5" stroke="#6b6a66" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Top: Logo + Team Switcher */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) toggleSidebar() }}
        style={{ padding: collapsed ? '14px 10px 0' : '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, letterSpacing: '-.01em', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: '#1D9E75',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700,
            flexShrink: 0,
          }}>R</div>
          {!collapsed && "Ryan's Todo"}
        </div>
        {!collapsed && <TeamSwitcher />}
      </div>

      {/* Scroll Area */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) toggleSidebar() }}
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Global Views */}
        {!collapsed && <SectionLabel label="글로벌 뷰" />}
        {GLOBAL_VIEWS.map(v => (
          <NavItem
            key={v.key}
            icon={v.icon}
            label={v.label}
            isActive={currentView === v.key}
            onClick={() => setView(v.key)}
            collapsed={collapsed}
          />
        ))}

        <Divider />

        {/* Team Projects */}
        {currentTeamId && (
          <>
            {!collapsed && <SectionLabel label="팀 프로젝트" onAdd={() => setShowProjectMgr(true)} />}
            {teamProjects.map(p => (
              <ProjectItem
                key={p.id}
                project={p}
                isActive={isProjectActive(p.id)}
                onClick={() => handleProjectClick(p.id)}
                collapsed={collapsed}
              />
            ))}
            <Divider />
          </>
        )}

        {/* Personal Projects */}
        {!collapsed && <SectionLabel label="개인 프로젝트" onAdd={() => setShowProjectMgr(true)} />}
        {personalProjects.map(p => (
          <ProjectItem
            key={p.id}
            project={p}
            isActive={isProjectActive(p.id)}
            onClick={() => handleProjectClick(p.id)}
            collapsed={collapsed}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) toggleSidebar() }}
        style={{
          borderTop: '0.5px solid #e8e6df',
          padding: collapsed ? '8px 6px' : '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0,
        }}>
        {/* Notifications */}
        <FooterItem
          icon="🔔"
          label="알림"
          badge={unreadCount > 0 ? unreadCount : null}
          onClick={() => toggleNotificationPanel()}
          collapsed={collapsed}
        />

        {/* Help */}
        <FooterItem
          icon="?"
          label="도움말"
          onClick={() => navigate('/help')}
          collapsed={collapsed}
        />

        {!collapsed && <div style={{ height: '0.5px', background: '#e8e6df', margin: '2px 0' }} />}

        {/* Profile */}
        <div
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: '#1D9E75',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, fontWeight: 600, flexShrink: 0,
          }}>
            {userName ? userName.slice(0, 2).toUpperCase() : 'U'}
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#2C2C2A' }}>{userName || 'User'}</div>
              <div style={{ fontSize: 10, color: '#b4b2a9' }}>{email || ''}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ label, onAdd }) {
  return (
    <div style={{
      padding: '12px 14px 4px',
      fontSize: 10,
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

function NavItem({ icon, label, isActive, onClick, collapsed }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: collapsed ? '7px 0' : '7px 12px',
        cursor: 'pointer', borderRadius: 7,
        margin: collapsed ? '1px 4px' : '1px 6px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontSize: 13,
        color: isActive ? '#2C2C2A' : '#6b6a66',
        background: isActive ? '#f0efe8' : hovered ? '#f5f4f0' : 'transparent',
        fontWeight: isActive ? 500 : 400,
        transition: 'all .12s',
      }}
    >
      <span style={{ width: collapsed ? 20 : 16, textAlign: 'center', fontSize: collapsed ? 18 : 13, flexShrink: 0, opacity: collapsed ? 0.8 : 0.6 }}>{icon}</span>
      {!collapsed && label}
    </div>
  )
}

function ProjectItem({ project, isActive, onClick, collapsed }) {
  const [hovered, setHovered] = useState(false)
  const color = getColor(project.color)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? project.name : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: collapsed ? '7px 0' : '7px 12px',
        cursor: 'pointer', borderRadius: 7,
        margin: collapsed ? '1px 4px' : '1px 6px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontSize: 13,
        color: isActive ? '#2C2C2A' : '#6b6a66',
        background: isActive ? '#e8e6df' : hovered ? '#f5f4f0' : 'transparent',
        fontWeight: isActive ? 600 : 400,
        transition: 'all .12s',
      }}
    >
      <div style={{
        width: collapsed ? 12 : 8, height: collapsed ? 12 : 8, borderRadius: '50%',
        background: color.dot, flexShrink: 0,
      }} />
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
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
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
        fontSize: 12, color: hovered ? '#6b6a66' : '#a09f99',
        background: hovered ? '#f5f4f0' : 'transparent',
        justifyContent: collapsed ? 'center' : 'flex-start',
        position: 'relative',
      }}
    >
      <span style={{ fontSize: collapsed ? 16 : 12 }}>{icon}</span>
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
          textAlign: 'center',
        }}>{badge}</span>
      )}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '0.5px', background: '#e8e6df', margin: '6px 14px' }} />
}
