# Diff-Plan Stage 1 — Loop-45: 백엔드 + 토큰 + Sidebar 가드

> **상위 입력**: `docs/plans/spec-personal-todo-focus.md` (확정)
> **커밋 범위**: Commits 1~7 (migration + store + tokens + hook + Sidebar)
> **머지 후 상태**: DB에 컬럼/인덱스 추가, store 확장, '즉시' 프로젝트 seed, 사이드바에서 '즉시' 최상단 표시 + DnD 비활성. **UI 기능 변화 0** (포커스 패널/새 리스트는 Stage 2/3).
> **롤백 용이성**: Stage 1만 머지해도 기능적으로 중립. Stage 3 이전까지 revert 가능.

---

## ⚠️ Commit 1 직후 필수 검증 (Supabase onConflict dry-run)

**R4 리스크**: Commit 4 seed는 `.upsert({...}, { onConflict: 'user_id,system_key' })` 를 사용. PostgreSQL이 column list → UNIQUE partial index 자동 매칭을 지원하는지 Commit 4 작성 **전** Claude Code가 직접 테스트:

```js
// Commit 1 머지 후, Supabase SQL Editor 또는 임시 테스트 코드
await d.from('projects').upsert(
  { id: 'test-123', user_id: '<my-uid>', system_key: 'instant', name: '테스트', color: '#888780' },
  { onConflict: 'user_id,system_key', ignoreDuplicates: true }
)
// 두 번 연속 실행 → 2번째에 duplicate 에러 없으면 OK
// 에러 발생 시 → `onConflict: 'idx_projects_user_system_key'` (index name) 로 대체 검증
```

성공 시 Commit 4 그대로 진행. 실패 시 Commit 4에서 `onConflict` 값만 교체 (로직 불변).

---

## 커밋 시퀀스 요약

| # | 파일 | 변경 규모 | 종류 |
|---|---|---|---|
| 1 | `supabase/migrations/20260425000000_focus_and_instant_project.sql` | 신규 전체 | Write |
| 2 | `src/hooks/useStore.js` | 4개 블록 (mapTask, taskToRow, mapProject, addProject upsert) | Edit ×4 |
| 3 | `src/hooks/useStore.js` | 2개 블록 (reorderFocusTasks 신설, sortProjectsLocally) | Edit ×2 |
| 4 | `src/hooks/useStore.js` | 1개 블록 (loadAll 내 seed 삽입) | Edit ×1 |
| 5 | `src/styles/designTokens.js` | 1개 블록 (LIST + OPACITY 추가) | Edit ×1 |
| 6 | `src/hooks/usePivotExpandState.js` | 1개 블록 (KEYS 확장) | Edit ×1 |
| 7 | `src/components/layout/Sidebar.jsx` | 3개 블록 (handleSidebarDragEnd + useSortable + ProjectItem archive 가드) + 1개 store guard | Edit ×4 |

**각 커밋 후 `npm run build` 필수 통과**.

---

# Commit 1 — migration

## 파일 (신규)

**경로**: `supabase/migrations/20260425000000_focus_and_instant_project.sql`

**전체 내용**:

```sql
-- ============================================================
-- Loop-45: 포커스 패널 + '즉시' 시스템 프로젝트
-- 추가 전용 (ADD COLUMN / CREATE INDEX) — 기존 컬럼/제약 변경 없음
-- ============================================================

-- ─── tasks 확장 ───
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_focus boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS focus_sort_order integer NOT NULL DEFAULT 0;

-- 포커스 카드 조회 (assignee_id 기준)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_focus
  ON tasks(assignee_id, is_focus)
  WHERE is_focus = true AND deleted_at IS NULL;

-- 포커스 카드 정렬 (focus_sort_order ASC)
CREATE INDEX IF NOT EXISTS idx_tasks_focus_sort
  ON tasks(assignee_id, focus_sort_order)
  WHERE is_focus = true AND deleted_at IS NULL;

-- ─── projects 확장 (system project 지원) ───
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS system_key text DEFAULT NULL;

-- 사용자당 system_key 중복 차단 (예: '즉시' 1개만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_system_key
  ON projects(user_id, system_key) WHERE system_key IS NOT NULL;
```

**커밋 메시지**:
```
feat(db): Loop-45 포커스 + 즉시 프로젝트 migration

- tasks.is_focus, tasks.focus_sort_order 추가 (NOT NULL DEFAULT)
- projects.is_system, projects.system_key 추가
- 3개 partial index: idx_tasks_assignee_focus, idx_tasks_focus_sort, idx_projects_user_system_key

추가 전용. 기존 valid_scope CHECK / 기존 인덱스 영향 없음.
```

---

# Commit 2 — Store: field mapping 확장

**파일**: `src/hooks/useStore.js`
**블록**: 4개 Edit

## 2.1 `taskToRow` 확장 (L132-L134 주변)

**old_string**:
```js
    // ↓ weekly-schedule ↓
    scheduled_date: t.scheduledDate || null,
  }
  if (_alarmColExists) row.alarm = t.alarm ?? null
```

**new_string**:
```js
    // ↓ weekly-schedule ↓
    scheduled_date: t.scheduledDate || null,
    // ↓ Loop-45: 포커스 ↓
    is_focus: t.isFocus === true,
    focus_sort_order: t.focusSortOrder ?? 0,
  }
  if (_alarmColExists) row.alarm = t.alarm ?? null
```

## 2.2 `mapTask` 확장 (L191-L193 주변)

**old_string**:
```js
    // ↓ weekly-schedule ↓
    scheduledDate: r.scheduled_date || null,
  }
}
```

**new_string**:
```js
    // ↓ weekly-schedule ↓
    scheduledDate: r.scheduled_date || null,
    // ↓ Loop-45: 포커스 ↓
    isFocus: r.is_focus === true,
    focusSortOrder: r.focus_sort_order ?? 0,
  }
}
```

## 2.3 `mapProject` 확장 (L163-L172)

**old_string**:
```js
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
```

**new_string**:
```js
function mapProject(r) {
  return {
    id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0,
    // ↓ Loop-20: 팀 관련 신규 필드 ↓
    teamId: r.team_id || null,
    userId: r.user_id || null,
    ownerId: r.owner_id || null,
    archivedAt: r.archived_at || null,
    // ↓ Loop-45: system project ↓
    isSystem: r.is_system === true,
    systemKey: r.system_key || null,
  }
}
```

## 2.4 `addProject` upsert payload 확장 (L737-L742)

**old_string**:
```js
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId, user_id: p.userId, owner_id: p.ownerId,
      description: p.description, start_date: p.start_date,
      due_date: p.due_date, status: p.status, created_by: p.created_by,
    })
    if (error) console.error('[Ryan Todo] addProject:', error)
```

**new_string**:
```js
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId, user_id: p.userId, owner_id: p.ownerId,
      description: p.description, start_date: p.start_date,
      due_date: p.due_date, status: p.status, created_by: p.created_by,
      // Loop-45: 기본값은 false/null — 기존 호출부 무영향
      is_system: p.isSystem === true,
      system_key: p.systemKey || null,
    })
    if (error) console.error('[Ryan Todo] addProject:', error)
```

**커밋 메시지**:
```
feat(store): mapTask/taskToRow/mapProject/addProject 필드 확장

- Task: isFocus (bool), focusSortOrder (int)
- Project: isSystem (bool), systemKey (string|null)
- addProject upsert payload 확장 (기본값 false/null, 기존 호출부 무영향)
```

---

# Commit 3 — Store: reorderFocusTasks + sortProjectsLocally

**파일**: `src/hooks/useStore.js`
**블록**: 2개 Edit

## 3.1 `reorderFocusTasks` 신설 (reorderTasks 직후 삽입, L714-L715 주변)

**old_string**:
```js
    for (const u of updates) {
      const t = get().tasks.find(x => x.id === u.id)
      if (!t) continue
      await safeUpsertTask(d, t)
    }
    set({ syncStatus: 'ok' })
  },

  // ─── Project CRUD ───
  addProject: async (name, color, projectScope) => {
```

**new_string**:
```js
    for (const u of updates) {
      const t = get().tasks.find(x => x.id === u.id)
      if (!t) continue
      await safeUpsertTask(d, t)
    }
    set({ syncStatus: 'ok' })
  },

  // ─── Reorder focus tasks (Loop-45) ───
  // reorderTasks와 동일 패턴, 필드만 focusSortOrder / focus_sort_order
  reorderFocusTasks: async (reorderedTasks) => {
    const updates = reorderedTasks.map((t, i) => ({ id: t.id, focusSortOrder: i }))
    set(s => ({
      tasks: s.tasks.map(t => {
        const u = updates.find(x => x.id === t.id)
        return u ? { ...t, focusSortOrder: u.focusSortOrder } : t
      })
    }))
    const d = db()
    if (!d) { set({ syncStatus: 'error' }); return }
    set({ syncStatus: 'syncing' })
    for (const u of updates) {
      const t = get().tasks.find(x => x.id === u.id)
      if (!t) continue
      await safeUpsertTask(d, t)
    }
    set({ syncStatus: 'ok' })
  },

  // ─── Project CRUD ───
  addProject: async (name, color, projectScope) => {
```

## 3.2 `sortProjectsLocally` — `isSystem` 우선 분기 (L1363-L1370)

**old_string**:
```js
  sortProjectsLocally: (projectList) => {
    const { localProjectOrder } = get()
    return [...projectList].sort((a, b) => {
      const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
      const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
      return orderA - orderB
    })
  },
```

**new_string**:
```js
  sortProjectsLocally: (projectList) => {
    const { localProjectOrder } = get()
    return [...projectList].sort((a, b) => {
      // Loop-45: system project 최상단 고정
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
      const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
      const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
      return orderA - orderB
    })
  },
```

**커밋 메시지**:
```
feat(store): reorderFocusTasks action + sortProjectsLocally isSystem priority

- reorderFocusTasks: reorderTasks 동일 패턴, focus_sort_order 필드만 갱신
- sortProjectsLocally: isSystem=true 프로젝트 최상단 고정 분기 추가
```

---

# Commit 4 — Store: '즉시' project idempotent seed

**파일**: `src/hooks/useStore.js`
**블록**: 1개 Edit (`loadAll` 내부, projects map 직후 L468-L470 영역)

## 4.1 seed 삽입

**old_string**:
```js
      const projects = pr.data.map(mapProject)
      const tasks = tr.data.map(mapTask)
      const memos = mr.error ? [] : mr.data.map(mapMemo)

      // 마일스톤: 프로젝트 ID 기반으로 한번에 로딩 (별도 렌더 사이클 방지)
```

**new_string**:
```js
      const projects = pr.data.map(mapProject)
      const tasks = tr.data.map(mapTask)
      const memos = mr.error ? [] : mr.data.map(mapMemo)

      // Loop-45: '즉시' system project idempotent seed (개인 모드에만 시드, user_id 기준)
      // UNIQUE partial index (user_id, system_key WHERE system_key IS NOT NULL)가 DB 단 중복 차단.
      // ignoreDuplicates: 동시 탭 레이스 안전.
      try {
        const seedUid = _cachedUserId || (await d.auth.getUser()).data?.user?.id
        if (seedUid) {
          const hasInstant = projects.some(p => p.userId === seedUid && p.systemKey === 'instant')
          if (!hasInstant) {
            const instantPayload = {
              id: uid(),
              name: '즉시',
              color: '#888780',
              user_id: seedUid,
              owner_id: seedUid,
              created_by: seedUid,
              team_id: null,
              is_system: true,
              system_key: 'instant',
              sort_order: 0,
              status: 'active',
              description: '',
            }
            const { error: seedErr } = await d.from('projects').upsert(instantPayload, {
              onConflict: 'user_id,system_key',
              ignoreDuplicates: true,
            })
            if (!seedErr) {
              projects.push(mapProject(instantPayload))
            } else {
              console.warn('[Ryan Todo] instant seed:', seedErr)
            }
          }
        }
      } catch (e) {
        console.warn('[Ryan Todo] instant seed exception:', e)
      }

      // 마일스톤: 프로젝트 ID 기반으로 한번에 로딩 (별도 렌더 사이클 방지)
```

**주의**:
- `mapProject(instantPayload)` 호출은 payload 필드명이 snake_case(`user_id, is_system, system_key`)이므로 정상 동작. `mapProject`는 `r.user_id / r.is_system / r.system_key`를 읽음 (Commit 2에서 확장된 매퍼가 이미 머지된 상태).
- seed 삽입 직후 `projects.push` 로 로컬 배열에 추가 → 이후 `isArrayEqual(current.projects, projects)` 비교에서 차이 발견 → `set({projects})` 실행 → 사이드바 즉시 반영.
- 실패 시 `console.warn` + 다음 loadAll에서 재시도 (try/catch로 다른 로직 영향 차단).

**커밋 메시지**:
```
feat(store): '즉시' project idempotent seed in loadAll

- loadAll 내 projects map 직후 seed 삽입
- DB: UNIQUE (user_id, system_key) 인덱스로 중복 차단
- App: hasInstant 체크로 1차 방어, ignoreDuplicates로 동시 탭 안전
- 실패 시 console.warn만 — 다른 로직 영향 없음

⚠ Commit 1 머지 후 Supabase upsert onConflict='user_id,system_key' dry-run
  성공 확인 후 이 커밋 진행.
```

---

# Commit 5 — designTokens: LIST + OPACITY 추가

**파일**: `src/styles/designTokens.js`
**블록**: 1개 Edit (L116-L119 영역)

## 5.1 LIST + OPACITY 삽입

**old_string**:
```js
// ─── 피벗 매트릭스 (Loop 42) ───
export const PIVOT = {
  msSubRowBg: '#FAFAF7',
  emptyCellColor: '#a09f99',
  emptyCellMarker: '·',
  emptyCellFontSize: 13,
  colWidthProject: 170,
  colWidthMember: 115,
  colWidthTotal: 55,
};

// ─── 유틸 함수 ───
export const isMobileWidth = () => window.innerWidth < 768;
```

**new_string**:
```js
// ─── 피벗 매트릭스 (Loop 42) ───
export const PIVOT = {
  msSubRowBg: '#FAFAF7',
  emptyCellColor: '#a09f99',
  emptyCellMarker: '·',
  emptyCellFontSize: 13,
  colWidthProject: 170,
  colWidthMember: 115,
  colWidthTotal: 55,
};

// ─── 개인 할일 리스트 (Loop-45) ───
export const LIST = {
  colWidthProject:   170,
  colWidthMilestone: 130,
  sectionGap:        24,
  projectRowGap:     12,
  taskRowGap:        6,
  etcLabel: { fontStyle: 'italic', color: '#a09f99' },
};

// ─── 투명도 (Loop-45) ───
export const OPACITY = {
  projectDimmed: 0.65,   // F-31: 포커스 이동 있는 프로젝트
  // draggingItem: 0.3 (TaskRow L61), sortableDragging: 0.4 (Sidebar L459)
  // → 범위 외 Hotfix에서 일원화 예정
};

// ─── 유틸 함수 ───
export const isMobileWidth = () => window.innerWidth < 768;
```

**커밋 메시지**:
```
feat(tokens): designTokens LIST + OPACITY 그룹 추가 (Loop-45)

- LIST: colWidthProject/Milestone, sectionGap, projectRowGap, taskRowGap, etcLabel
- OPACITY: projectDimmed (0.65)
- PIVOT 블록 직후, isMobileWidth 이전에 삽입
```

---

# Commit 6 — usePivotExpandState: personalSection KEY 추가

**파일**: `src/hooks/usePivotExpandState.js`
**블록**: 1개 Edit (L8-L11)

## 6.1 KEYS 확장

**old_string**:
```js
const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
}
```

**new_string**:
```js
const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
  personalSection: 'personalSectionExpanded',  // Loop-45 F-12: 다음/남은 섹션 접기 상태
}
```

**커밋 메시지**:
```
feat(hook): usePivotExpandState personalSection KEY 추가

- F-12: 백로그 "다음/남은" 섹션 접기 상태 localStorage 저장용
- 기존 team/personal KEYS 그대로 유지
```

---

# Commit 7 — Sidebar: system project DnD disabled + archive guard + ProjectItem 가드

**파일**: `src/components/layout/Sidebar.jsx`
**블록**: 3개 Edit + 1개 store guard (Edit)

## 7.1 `handleSidebarDragEnd` — system project 이동 거부 (L91-L106)

**old_string**:
```js
  const handleSidebarDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeSection = active.data.current?.section
    const overSection = over.data.current?.section
    if (activeSection !== overSection) return  // 섹션 경계 금지
    const activePid = active.data.current?.projectId
    const overPid = over.data.current?.projectId
    if (!activePid || !overPid) return
    const sectionList = activeSection === 'team' ? teamProjects : personalProjects
    const oldIdx = sectionList.findIndex(p => p.id === activePid)
    const newIdx = sectionList.findIndex(p => p.id === overPid)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(sectionList, oldIdx, newIdx)
    reorderProjects(reordered)
  }, [teamProjects, personalProjects, reorderProjects])
```

**new_string**:
```js
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
```

## 7.2 `SortableProjectItem` — `useSortable({ disabled })` (L450-L454)

**old_string**:
```js
function SortableProjectItem({ project, section, isActive, onClick, collapsed, indent, archiveFn }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-sidebar:${project.id}`,
    data: { section, projectId: project.id },
  })
```

**new_string**:
```js
function SortableProjectItem({ project, section, isActive, onClick, collapsed, indent, archiveFn }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-sidebar:${project.id}`,
    data: { section, projectId: project.id },
    disabled: project.isSystem === true,  // Loop-45 F-30
  })
```

## 7.3 `ProjectItem` — archive 버튼 가드 + neutral gray dot (L493-L525)

**old_string**:
```js
function ProjectItem({ project, isActive, onClick, collapsed, indent = 0, archiveFn }) {
  const [hovered, setHovered] = useState(false)
  const openModal = useStore(s => s.openModal)
  const color = getColor(project.color)
  return (
    <div
      onClick={onClick}
```

**new_string**:
```js
function ProjectItem({ project, isActive, onClick, collapsed, indent = 0, archiveFn }) {
  const [hovered, setHovered] = useState(false)
  const openModal = useStore(s => s.openModal)
  // Loop-45: system project는 neutral gray dot (#888780), 일반은 팔레트에서 조회
  const color = project.isSystem ? { dot: '#888780' } : getColor(project.color)
  return (
    <div
      onClick={onClick}
```

그리고 archive 버튼 guard (L531-L541 영역):

**old_string**:
```jsx
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
```

**new_string**:
```jsx
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
```

**효과**: system project에서는 hover 시 archive/설정 버튼 자체가 렌더되지 않음. 완전 차단.

**⚠ 주의**: `{hovered && !project.isSystem && (` 블록으로 설정(⚙) 버튼도 같이 가려진다. 시스템 프로젝트는 설정 변경 불가 — 의도된 동작.

## 7.4 Store: `archiveProject` 방어적 가드 (useStore.js L827-L829)

UI 레이어에서 버튼 자체를 안 보이지만 혹시 모를 코드 경로 차단 위해 store 레벨 방어 추가.

**파일**: `src/hooks/useStore.js`

**old_string**:
```js
  // ─── Archive / Unarchive ───
  archiveProject: async (id) => {
    const project = get().projects.find(p => p.id === id)
    if (!project) return

    // 권한 체크: 팀 프로젝트 → 팀 소속 전원, 개인 프로젝트 → 본인만
    if (project.teamId) {
```

**new_string**:
```js
  // ─── Archive / Unarchive ───
  archiveProject: async (id) => {
    const project = get().projects.find(p => p.id === id)
    if (!project) return
    // Loop-45 N-12: system project는 archive 불가
    if (project.isSystem) {
      get().showToast('시스템 프로젝트는 보관할 수 없습니다')
      return
    }

    // 권한 체크: 팀 프로젝트 → 팀 소속 전원, 개인 프로젝트 → 본인만
    if (project.teamId) {
```

**커밋 메시지**:
```
feat(sidebar): system project DnD disabled + archive guard + neutral gray dot

- handleSidebarDragEnd: isSystem 프로젝트 이동 거부 (방어적 2차 가드)
- SortableProjectItem useSortable: disabled: project.isSystem (1차)
- ProjectItem: isSystem일 때 hover archive/설정 버튼 숨김
- ProjectItem: isSystem dot은 #888780 (getColor 우회)
- useStore.archiveProject: isSystem → Toast + return (방어적 3차 가드)

F-27/F-29/F-30/N-12 대응.
```

---

## Stage 1 완료 후 빌드 검증

### 검증 항목

| # | 방법 | 합격 기준 |
|---|---|---|
| B-1 | `npm run build` (각 커밋 후 1회) | exit 0 |
| B-2 | DB migration 실제 적용 (Supabase CLI 또는 Studio) | 3개 컬럼 + 3개 인덱스 생성 확인 |
| B-3 | Commit 1 직후 onConflict dry-run (위 ⚠ 섹션) | 2번째 upsert 에러 없이 통과 |
| B-4 | 앱 새로고침 → 사이드바 개인 프로젝트 최상단 | "즉시" 1개 표시, neutral gray dot |
| B-5 | Supabase query `SELECT * FROM projects WHERE user_id='<me>' AND system_key='instant'` | 1행 |
| B-6 | '즉시' drag 시도 | drag 핸들 표시되지만 실제 이동 0 |
| B-7 | '즉시' hover | 📦/⚙ 버튼 숨김 |
| B-8 | 개인 모드에서 일반 project 생성(`addProject`) → isSystem=false DB 확인 | 기존 호출부 무영향 |

### 롤백 지침

Stage 1 머지 후 문제 발생 시:
- **코드만 revert**: Commits 7→6→5→4→3→2 역순 revert. migration(Commit 1)은 그대로 두되 컬럼 미사용 상태.
- **DB까지 revert**: 
  ```sql
  DROP INDEX IF EXISTS idx_projects_user_system_key;
  DROP INDEX IF EXISTS idx_tasks_focus_sort;
  DROP INDEX IF EXISTS idx_tasks_assignee_focus;
  ALTER TABLE projects DROP COLUMN IF EXISTS system_key;
  ALTER TABLE projects DROP COLUMN IF EXISTS is_system;
  ALTER TABLE tasks DROP COLUMN IF EXISTS focus_sort_order;
  ALTER TABLE tasks DROP COLUMN IF EXISTS is_focus;
  ```
  (단 '즉시' seed 프로젝트 row는 남음 — 필요 시 `DELETE FROM projects WHERE system_key='instant'`)

---

## Stage 2 착수 조건

Stage 1 커밋 1~7 + B-1~B-8 전부 통과 후 `diff-plan-personal-todo-focus-stage2.md` 작성.

Stage 2 범위: 신규 셀 7파일 작성 (모두 unused 상태, 빌드만 확인). UI 전환은 Stage 3에서.

---

## 크기

본 문서 약 18 KB — Claude Code 소비 한도 내.
