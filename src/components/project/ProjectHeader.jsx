import { useMemo } from 'react'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import OwnerDropdown from './OwnerDropdown'

export default function ProjectHeader({ project, currentTab, onTabChange }) {
  const color = getColor(project.color)
  const allTasks = useStore(s => s.tasks)
  const currentTeamId = useStore(s => s.currentTeamId)
  const updateProject = useStore(s => s.updateProject)
  const openModal = useStore(s => s.openModal)
  const userName = useStore(s => s.userName)
  const ownerName = userName || '나'
  const taskCount = useMemo(() => {
    return allTasks.filter(t => t.projectId === project.id && !t.deletedAt && !t.done).length
  }, [allTasks, project.id])

  // TODO: 26.3 이후 미배정 결과물 수 계산
  const unassignedCount = 0

  const TABS = [
    { key: 'milestone', label: '마일스톤' },
    { key: 'tasks', label: '할일', badge: String(taskCount) },
    { key: 'ptimeline', label: '타임라인', badgeWarn: unassignedCount > 0 ? `미배정 ${unassignedCount}` : null },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: 48, padding: '0 20px',
      background: '#fff', borderBottom: '0.5px solid #e8e6df', flexShrink: 0,
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color.dot }} />
      <span style={{ fontSize: 15, fontWeight: 600 }}>{project.name}</span>
      <span style={{ fontSize: 11, color: '#a09f99' }}>
        {project.teamId ? 'SCD팀' : '개인'}
        {currentTeamId && (
          <>
            {' · 오너 : '}
            {project.teamId ? (
              <OwnerDropdown
                projectId={project.id}
                ownerId={project.ownerId}
                onChangeOwner={(newOwnerId) => updateProject(project.id, { ownerId: newOwnerId })}
              />
            ) : (
              <span style={{ fontSize: 11, color: '#2C2C2A', fontWeight: 500 }}>{ownerName}</span>
            )}
          </>
        )}
      </span>
      <span
        onClick={() => openModal({ type: 'projectSettings', projectId: project.id })}
        style={{ fontSize: 17, color: '#b4b2a9', cursor: 'pointer', padding: '0 4px' }}
        onMouseEnter={e => e.currentTarget.style.color = '#666'}
        onMouseLeave={e => e.currentTarget.style.color = '#b4b2a9'}
        title="프로젝트 설정"
      >
        ⚙
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            style={{
              fontSize: 12, padding: '5px 14px', borderRadius: 7,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              fontWeight: currentTab === t.key ? 600 : 500,
              background: currentTab === t.key ? '#f0efe8' : 'transparent',
              color: currentTab === t.key ? '#2C2C2A' : '#a09f99',
            }}
          >
            {t.label}
            {t.badge && <span style={{ fontSize: 10, background: '#e8e6df', borderRadius: 999, padding: '1px 7px', marginLeft: 4, color: '#a09f99' }}>{t.badge}</span>}
            {t.badgeWarn && <span style={{ fontSize: 10, background: '#FAEEDA', borderRadius: 999, padding: '1px 7px', marginLeft: 4, color: '#854F0B' }}>{t.badgeWarn}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
