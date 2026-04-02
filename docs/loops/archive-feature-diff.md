# 프로젝트 아카이브 기능 — 구현 Diff

## REQ-LOCK 요구사항

| # | 요구사항 | 출처 |
|---|---------|------|
| R1 | `projects` 테이블에 `archived_at` 컬럼 추가 (timestamptz, nullable) | 설계 확정 |
| R2 | 사이드바: 팀 프로젝트 아래 "팀 아카이브", 개인 프로젝트 아래 "개인 아카이브" 접힌 섹션 | 설계 확정 |
| R3 | 아카이브된 프로젝트는 매트릭스·타임라인·오늘·전체 할일 등 모든 뷰에서 제외 | 설계 확정 |
| R4 | 아카이브 해제(복원) 가능 | 설계 확정 |
| R5 | 권한: 팀 프로젝트 → 팀 소속 전원, 개인 프로젝트 → 본인만 | 설계 확정 |
| R6 | store 액션: `archiveProject(id)`, `unarchiveProject(id)` | 설계 확정 |

---

## Commit 1: DB 마이그레이션

Supabase SQL Editor에서 실행:

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
```

---

## Commit 2: Store + Filter + Sidebar

### Diff A — `src/hooks/useStore.js` : PROJECT_COLUMNS에 archived_at 추가

```
FILE: src/hooks/useStore.js
```

**str_replace #1** — PROJECT_COLUMNS

```javascript
<<<<<<< OLD
const PROJECT_COLUMNS = 'id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by'
=======
const PROJECT_COLUMNS = 'id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by, archived_at'
>>>>>>> NEW
```

### Diff B — `src/hooks/useStore.js` : mapProject에 archivedAt 추가

**str_replace #2** — mapProject

```javascript
<<<<<<< OLD
function mapProject(r) {
  return {
    id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0,
    // ↓ Loop-20: 팀 관련 신규 필드 ↓
    teamId: r.team_id || null,
    userId: r.user_id || null,
    ownerId: r.owner_id || null,
  }
}
=======
function mapProject(r) {
  return {
    id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0,
    // ↓ Loop-20: 팀 관련 신규 필드 ↓
    teamId: r.team_id || null,
    userId: r.user_id || null,
    ownerId: r.owner_id || null,
    archivedAt: r.archived_at || null,
  }
}
>>>>>>> NEW
```

### Diff C — `src/hooks/useStore.js` : updateProject upsert에 archived_at 포함

**str_replace #3** — updateProject upsert 블록

```javascript
<<<<<<< OLD
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId || null, user_id: p.userId || null, owner_id: p.ownerId || null,
      description: p.description ?? '', start_date: p.start_date || null,
      due_date: p.due_date || null, status: p.status || 'active',
      created_by: p.created_by || null,
    })
    if (error) console.error('[Ryan Todo] updateProject:', error)
  },
=======
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId || null, user_id: p.userId || null, owner_id: p.ownerId || null,
      description: p.description ?? '', start_date: p.start_date || null,
      due_date: p.due_date || null, status: p.status || 'active',
      created_by: p.created_by || null,
      archived_at: p.archivedAt || null,
    })
    if (error) console.error('[Ryan Todo] updateProject:', error)
  },
>>>>>>> NEW
```

### Diff D — `src/hooks/useStore.js` : archiveProject / unarchiveProject 액션 추가

`deleteProject` 함수 끝 (`get().showToast('프로젝트가 삭제됐습니다')` 다음 줄의 `},`) 바로 뒤에 삽입:

**str_replace #4** — deleteProject 끝 뒤에 삽입

```javascript
<<<<<<< OLD
    get().showToast('프로젝트가 삭제됐습니다')
  },

  reorderProjects: async (newList) => {
=======
    get().showToast('프로젝트가 삭제됐습니다')
  },

  // ─── Archive / Unarchive ───
  archiveProject: async (id) => {
    const project = get().projects.find(p => p.id === id)
    if (!project) return

    // 권한 체크: 팀 프로젝트 → 팀 소속 전원, 개인 프로젝트 → 본인만
    if (project.teamId) {
      const teamId = get().currentTeamId
      if (project.teamId !== teamId) {
        get().showToast('이 팀 프로젝트에 대한 권한이 없습니다')
        return
      }
    } else {
      const userId = _cachedUserId || (await getCurrentUserId())
      if (project.userId && project.userId !== userId) {
        get().showToast('다른 사용자의 개인 프로젝트는 아카이브할 수 없습니다')
        return
      }
    }

    const now = new Date().toISOString()
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, archivedAt: now } : p) }))
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').update({ archived_at: now }).eq('id', id)
    if (error) console.error('[Ryan Todo] archiveProject:', error)
    get().showToast('프로젝트가 아카이브됐습니다')
  },

  unarchiveProject: async (id) => {
    const project = get().projects.find(p => p.id === id)
    if (!project) return

    // 권한 체크: 팀 프로젝트 → 팀 소속 전원, 개인 프로젝트 → 본인만
    if (project.teamId) {
      const teamId = get().currentTeamId
      if (project.teamId !== teamId) {
        get().showToast('이 팀 프로젝트에 대한 권한이 없습니다')
        return
      }
    } else {
      const userId = _cachedUserId || (await getCurrentUserId())
      if (project.userId && project.userId !== userId) {
        get().showToast('다른 사용자의 개인 프로젝트는 복원할 수 없습니다')
        return
      }
    }

    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, archivedAt: null } : p) }))
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').update({ archived_at: null }).eq('id', id)
    if (error) console.error('[Ryan Todo] unarchiveProject:', error)
    get().showToast('프로젝트가 복원됐습니다')
  },

  reorderProjects: async (newList) => {
>>>>>>> NEW
```

---

### Diff E — `src/hooks/useProjectFilter.js` : 아카이브 프로젝트 필터링

이 한 줄 추가로 TodayView, AllTasksView, UnifiedGridView, InlineTimelineView 모든 뷰에서 아카이브 프로젝트가 자동 제외됩니다.

**str_replace #5**

```javascript
<<<<<<< OLD
export default function useProjectFilter(projects, tasks) {
  const teamId = useStore(s => s.currentTeamId)
  // Loop-39: projectFilter UI removed — scope is now determined by sidebar navigation.
  // Always use 'all' to prevent stale localStorage values from filtering out projects.
  const filter = 'all'
=======
export default function useProjectFilter(projects, tasks) {
  const teamId = useStore(s => s.currentTeamId)
  // Loop-39: projectFilter UI removed — scope is now determined by sidebar navigation.
  // Always use 'all' to prevent stale localStorage values from filtering out projects.
  const filter = 'all'

  // 아카이브된 프로젝트는 모든 뷰에서 제외
  projects = projects.filter(p => !p.archivedAt)
>>>>>>> NEW
```

---

### Diff F — `src/components/layout/Sidebar.jsx` : store에서 archiveProject, unarchiveProject 가져오기

**str_replace #6**

```javascript
<<<<<<< OLD
  const {
    currentView, setView,
    projects, currentTeamId, myTeams,
    toggleNotificationPanel,
    userName, addProject,
    sidebarCollapsed, toggleSidebar,
    selectedProjectId, enterProjectLayer,
  } = useStore()
=======
  const {
    currentView, setView,
    projects, currentTeamId, myTeams,
    toggleNotificationPanel,
    userName, addProject,
    sidebarCollapsed, toggleSidebar,
    selectedProjectId, enterProjectLayer,
    archiveProject, unarchiveProject,
  } = useStore()
>>>>>>> NEW
```

### Diff G — `src/components/layout/Sidebar.jsx` : 프로젝트 분리 로직에 아카이브 필터 추가

**str_replace #7**

```javascript
<<<<<<< OLD
  // 프로젝트 분리: 팀 / 개인
  const sortProjectsLocally = useStore(s => s.sortProjectsLocally)
  const teamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId))
  const personalProjects = sortProjectsLocally(projects.filter(p => !p.teamId))
=======
  // 프로젝트 분리: 팀 / 개인 (활성 + 아카이브)
  const sortProjectsLocally = useStore(s => s.sortProjectsLocally)
  const teamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId && !p.archivedAt))
  const personalProjects = sortProjectsLocally(projects.filter(p => !p.teamId && !p.archivedAt))
  const archivedTeamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId && p.archivedAt))
  const archivedPersonalProjects = sortProjectsLocally(projects.filter(p => !p.teamId && p.archivedAt))
>>>>>>> NEW
```

### Diff H — `src/components/layout/Sidebar.jsx` : 팀 프로젝트 섹션 뒤에 팀 아카이브 삽입

**str_replace #8**

```javascript
<<<<<<< OLD
        {/* 개인 프로젝트 */}
        {!collapsed && <SubSectionHeader label="개인 프로젝트" collapsed={sectionCollapsed.projPersonal} onClick={() => toggleSection('projPersonal')} onAdd={() => { setAddProjectScope('personal'); setShowAddProject(true) }} />}
        {!sectionCollapsed.projPersonal && personalProjects.map(p => (
          <ProjectItem key={p.id} project={p} isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} />
        ))}
=======
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
          <ProjectItem key={p.id} project={p} isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} />
        ))}

        {/* 개인 아카이브 */}
        {archivedPersonalProjects.length > 0 && !collapsed && (
          <>
            <SubSectionHeader label="개인 아카이브" collapsed={sectionCollapsed.archivePersonal !== false} onClick={() => toggleSection('archivePersonal')} />
            {sectionCollapsed.archivePersonal === false && archivedPersonalProjects.map(p => (
              <ArchiveProjectItem key={p.id} project={p} onRestore={() => unarchiveProject(p.id)} collapsed={collapsed} />
            ))}
          </>
        )}
>>>>>>> NEW
```

> **참고**: 아카이브 섹션의 collapsed 기본값이 `!== false` (기본 접힘)입니다. `sectionCollapsed`의 초기값이 `{}`이므로 `sectionCollapsed.archiveTeam`은 `undefined` → `undefined !== false`는 `true` → 기본 접힘.

### Diff I — `src/components/layout/Sidebar.jsx` : ProjectItem에 아카이브 hover 버튼 추가

기존 ProjectItem의 hover 영역에 ⚙ 옆에 📦 아카이브 버튼 추가:

**str_replace #9**

```javascript
<<<<<<< OLD
          {hovered && (
            <span
              onClick={e => { e.stopPropagation(); openModal({ type: 'projectSettings', projectId: project.id }) }}
              style={{ fontSize: 15, color: '#b4b2a9', padding: '0 4px', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#666'}
              onMouseLeave={e => e.currentTarget.style.color = '#b4b2a9'}
            >
              ⚙
            </span>
          )}
=======
          {hovered && (
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
>>>>>>> NEW
```

### Diff J — `src/components/layout/Sidebar.jsx` : ProjectItem 함수 시그니처에 archiveFn prop 추가

**str_replace #10**

```javascript
<<<<<<< OLD
function ProjectItem({ project, isActive, onClick, collapsed, indent = 0 }) {
  const [hovered, setHovered] = useState(false)
  const openModal = useStore(s => s.openModal)
=======
function ProjectItem({ project, isActive, onClick, collapsed, indent = 0, archiveFn }) {
  const [hovered, setHovered] = useState(false)
  const openModal = useStore(s => s.openModal)
>>>>>>> NEW
```

### Diff K — `src/components/layout/Sidebar.jsx` : ProjectItem 사용부에 archiveFn prop 전달

**str_replace #11** — 팀 프로젝트 ProjectItem

```javascript
<<<<<<< OLD
            {!sectionCollapsed.projTeam && teamProjects.map(p => (
              <ProjectItem key={p.id} project={p} isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} />
            ))}
=======
            {!sectionCollapsed.projTeam && teamProjects.map(p => (
              <ProjectItem key={p.id} project={p} isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} archiveFn={archiveProject} />
            ))}
>>>>>>> NEW
```

**str_replace #12** — 개인 프로젝트 ProjectItem

```javascript
<<<<<<< OLD
        {!sectionCollapsed.projPersonal && personalProjects.map(p => (
          <ProjectItem key={p.id} project={p} isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} />
        ))}
=======
        {!sectionCollapsed.projPersonal && personalProjects.map(p => (
          <ProjectItem key={p.id} project={p} isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} archiveFn={archiveProject} />
        ))}
>>>>>>> NEW
```

### Diff L — `src/components/layout/Sidebar.jsx` : ArchiveProjectItem 컴포넌트 추가

파일 맨 끝 (`AddProjectModal` 함수 닫는 `}` 뒤)에 추가:

**str_replace #13** — 파일 끝에 ArchiveProjectItem 삽입

```javascript
<<<<<<< OLD
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
=======
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
>>>>>>> NEW
```

---

## REQ-LOCK 검증

| # | 요구사항 | Diff | 처리 |
|---|---------|------|------|
| R1 | `archived_at` 컬럼 추가 | SQL + Diff A,B | ✅ |
| R2 | 팀/개인 아카이브 섹션 | Diff G,H | ✅ |
| R3 | 모든 뷰 제외 | Diff E (useProjectFilter) | ✅ |
| R4 | 복원 기능 | Diff D (unarchiveProject), Diff H,L (복원 UI) | ✅ |
| R5 | 팀=전원, 개인=본인 | Diff D (권한 체크) | ✅ |
| R6 | store 액션 | Diff D | ✅ |

## DELETE-5 검증 (이번은 추가 전용, 삭제 없음)

이번 diff는 기존 코드를 삭제하지 않고 추가만 하므로 DELETE-5 대상 없음.

### 신규 식별자 의존성 확인

| 신규 식별자 | 사용처 | 의존성 |
|------------|--------|--------|
| `archivedAt` (mapProject) | useProjectFilter, Sidebar 분리 로직 | `archived_at` DB 컬럼 |
| `archiveProject` (store) | Sidebar ProjectItem hover 버튼 | `_cachedUserId`, `getCurrentUserId`, `db`, `showToast` (모두 기존) |
| `unarchiveProject` (store) | Sidebar ArchiveProjectItem 복원 버튼 | 동일 |
| `ArchiveProjectItem` (Sidebar) | Sidebar 아카이브 섹션 | `getColor`, `S`, `useState` (모두 기존) |
| `archiveFn` (ProjectItem prop) | ProjectItem 내부 📦 버튼 | `archiveProject` from store |

### 잔여 import 검증
- [x] 기존 import에 변경 없음
- [x] 새 import 추가 없음 (모든 신규 식별자는 기존 import/store 내부)
- [x] unused import 0건

---

## Claude Code 프롬프트

```
아래 diff 문서의 str_replace를 순서대로 적용하라.

적용 순서:
1. src/hooks/useStore.js — str_replace #1~#4
2. src/hooks/useProjectFilter.js — str_replace #5
3. src/components/layout/Sidebar.jsx — str_replace #6~#13

각 str_replace 적용 후 파일 저장.
모든 적용 완료 후:
  npm run build
  빌드 성공 시: git add -A && git commit -m "feat: project archive/unarchive with team/personal separation" && git push origin main
  빌드 실패 시: 에러 내용 보고 (수정 금지)
```
