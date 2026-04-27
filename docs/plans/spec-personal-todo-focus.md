# Spec — 개인 할일 리팩터 + 포커스 패널 (통합 REQ-LOCK + R-ATOMIC)

> **목적**: 개인 할일 뷰를 [프로젝트 | MS | 할일] 단일 컬럼 + [다음/남은] footer 3섹션으로 리팩터하고, 우측에 포커스 패널(양방향 DnD + '즉시' 시스템 프로젝트 자동 시드)을 도입한다.
> **상위 입력**: `docs/plans/recon-v2-personal-todo-focus.md` (검증 완료, 라인 번호 일치)
> **적용 범위**: 데스크탑(≥768px)만. 모바일(<768px)은 기존 `PersonalMatrixMobileList` 유지.

---

## 0. 불확실 항목 확정

recon-v2의 6건 ❓을 다음과 같이 확정한다 — 이후 모든 섹션의 기준.

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | `is_focus` NOT NULL? | **NOT NULL DEFAULT false** | 가드 단순화, partial index 효율 |
| 2 | 인덱스 필수? | **추가 (partial, `WHERE is_focus=true AND deleted_at IS NULL`)** | 구현 비용 낮고 확장성 대비 |
| 3 | 모바일 UX | **이번 범위 제외** (Shell = desktop-only) | 별도 Loop 분리 |
| 4 | `sortProjectsLocally` 파급 | **단일 `isSystem` 우선 분기만 추가** | 기존 정렬 안정, 모든 consumer에 균일 적용 |
| 5 | '즉시' 프로젝트 색상 | **`#888780`** (neutral gray, `COLOR.textSecondary` 계열) | system 성격 표현, 사용자 색과 구분 |
| 6 | fade-out 애니메이션 | **CSS `transition: opacity 0.2s`만** | framer-motion 미도입 |

---

## 1. REQ-LOCK

### 1.1 기능 — 왼쪽 백로그 (3섹션)

| ID | 요구사항 | 검증 기준 |
|---|---|---|
| F-01 | 상단 "지금 할일" 섹션: `category='today' && !isFocus && !done && !deletedAt` | DOM 존재 + 카운트 일치 |
| F-02 | 하단 "다음/남은" 섹션은 기본 접힘 (category='next' / 'backlog') | 초기 caret-right (`▶`) |
| F-03 | 섹션 내부 3열 grid `[프로젝트(170px) \| MS(130px) \| 할일(1fr)]` | DevTools `grid-template-columns` |
| F-04 | 프로젝트 순서 = `sortProjectsLocally` 기준 (`isSystem` 최상단 + 기존 순서) | Sidebar 순서와 1:1 일치 |
| F-05 | 프로젝트별 접기/펼치기, `usePivotExpandState('personal')` 저장 | reload 후 상태 유지 |
| F-06 | `keyMilestoneId == null` task → "기타" 라벨 (italic, `COLOR.textTertiary`) | DOM class / style |
| F-07 | 동일 MS 연속 task는 2번째 행부터 MS 열 공백 | 렌더 |
| F-08 | 체크박스 = TaskRow 패턴 (custom `<div>` + SVG, `CHECKBOX.*` 토큰) | 신규 7파일 내 `<input type="checkbox"` grep = 0 |
| F-09 | 섹션 헤더 + 프로젝트 헤더에 건수 표시 | `filter.length`와 일치 |
| F-10 | 기본 필터 `assigneeId === userId && !done && !deletedAt` 유지 | 기존 `myTasks` 로직 보존 |
| F-11 | 섹션에 task 0건인 프로젝트는 렌더 skip (프로젝트 헤더 미표시) | DOM 없음 |
| F-12 | 다음/남은 섹션 접기 상태 저장: `usePivotExpandState('personalSection')` | reload 후 상태 유지 |
| F-13 | "지금 할일" 섹션 헤더 우측 `+ 새 할일` 버튼 → 인라인 입력 → `addTask` | Enter 시 새 task |

### 1.2 기능 — 오른쪽 포커스 패널

| ID | 요구사항 | 검증 기준 |
|---|---|---|
| F-14 | 우측 sticky 패널 (좌측 flex 3 : 우측 flex 2) | `position: sticky; top: 0` |
| F-15 | 필터 `assigneeId === userId && isFocus === true && !done && !deletedAt` | 기존 myTasks 확장 |
| F-16 | 카드 순서 = `focusSortOrder ASC`, tiebreak `updatedAt DESC` | sort 로직 |
| F-17 | 카드 구성: `⋮⋮ ☐ 텍스트 / 프로젝트·MS 메타 ×` | DOM |
| F-18 | × 버튼 → `updateTask(id, { isFocus: false })` — category 보존 | 해제 후 task.category 이전 값 유지 |
| F-19 | 체크박스 → `toggleDone(id)` → 좌/우 양쪽에서 사라짐 | DOM 제거 |
| F-20 | 카드 내 DnD 재정렬 → `reorderFocusTasks(reorderedTasks)` | `focus_sort_order` 0,1,2,… |
| F-21 | 빠른 추가 input + Enter → `addTask({text, projectId: INSTANT_PROJECT_ID, isFocus: true, category: 'today'})` | 포커스 패널에만 즉시 표시 |
| F-22 | 프로젝트 미지정 메타 표시: "프로젝트 미지정" (italic) — 시각 전용 힌트 | 데이터는 `projectId=INSTANT`, UI는 "미지정" |

### 1.3 기능 — 양방향 DnD

| ID | 요구사항 | 검증 기준 |
|---|---|---|
| F-23 | 백로그 task → 포커스 패널 drop → `updateTask(id, { isFocus: true, focusSortOrder: max+1 })` | 카드 생성, 백로그에서 제거 |
| F-24 | 포커스 카드 → 포커스 영역 밖 drop → `updateTask(id, { isFocus: false })` | 원 projectId/category/keyMilestoneId 보존 |
| F-25 | 포커스 내부 sortable → `reorderFocusTasks` | 순서 갱신 |
| F-26 | 드롭존 ID 규약: `focus-panel:root` (전체 droppable), `focus-card:${id}` (sortable) | 기존 prefix와 충돌 없음 |

### 1.4 기능 — '즉시' 시스템 프로젝트

| ID | 요구사항 | 검증 기준 |
|---|---|---|
| F-27 | `projects.is_system=true, system_key='instant', user_id=userId, team_id=null` 1행 seed | Supabase query로 1행 확인 |
| F-28 | `loadAll` 직후 idempotent seed (UNIQUE partial index 활용) | 중복 생성 0 |
| F-29 | 사이드바 개인 섹션 **최상단** 고정 (`sortProjectsLocally` isSystem priority) | 첫 항목 "즉시" |
| F-30 | DnD 비활성: `useSortable({ disabled: project.isSystem })` + archive 가드 | drag 시도 시 no-op, archive Toast 경고 |

### 1.5 기능 — 프로젝트 흐림 처리

| ID | 요구사항 | 검증 기준 |
|---|---|---|
| F-31 | 프로젝트 내 isFocus task 있으면 `opacity: OPACITY.projectDimmed` (0.65) | inline style |
| F-32 | 프로젝트 헤더 우측에 "N건 포커스 이동" 카운트 | DOM 존재 |
| F-33 | 포커스 해제 시 흐림 즉시 복원 (CSS `transition: opacity 0.2s`) | React 리렌더 |

### 1.6 비기능

| ID | 요구사항 |
|---|---|
| N-01 | 모든 스타일은 `designTokens` 참조, 하드코딩 금지 (신규 파일) |
| N-02 | Vite TDZ 방지: 모듈 레벨 `const`/`let`이 import된 토큰을 직접 참조하지 않음 |
| N-03 | `updateTask(id, patch)` 시그니처 유지 — 객체 spread 금지 (CLAUDE.md §3.3) |
| N-04 | tasks 기존 컬럼 schema 변경 금지 (추가만: `is_focus`, `focus_sort_order`) |
| N-05 | 신규 store action은 `reorderFocusTasks` 하나만 |
| N-06 | Gray text floor `#888780` 준수 (`#a09f99`까지만 허용, 더 옅은 회색 금지) |
| N-07 | `border-left` color bar 금지 (CLAUDE.md banned #4), ellipsis 금지 |
| N-08 | 체크박스 = TaskRow custom `<div>` + SVG 패턴 — **신규 7파일**에서 native `<input type="checkbox">` 금지. 기존 파일(`PersonalMatrixMobileList`, `TimelineToolbar`, `DetailPanel`, `PivotTaskCell`)는 범위 외 |
| N-09 | `category` 토글 금지 — `isFocus` 변경 시 `category` 보존 |
| N-10 | `applyTransitionRules`에 `isFocus` 분기 없음 (순수 passthrough) |
| N-11 | 모바일 분기 유지 — `PersonalMatrixGrid` 내 `window.innerWidth < 768`은 기존 `PersonalMatrixMobileList` 렌더 |
| N-12 | system project archive/delete 시도 차단 (Toast 경고 + early return) |

### 1.7 DELETE-5 (구 피벗 6파일 삭제)

| 파일 | Importer | Caller | Props | Deps | Types |
|---|---|---|---|---|---|
| `src/components/views/grid/PersonalPivotMatrixTable.jsx` | `PersonalMatrixGrid.jsx:2` | PersonalMatrixGrid desktop 분기 | `projects, tasks, milestones` | `usePivotExpandState, getCachedUserId, COLOR, PIVOT, TIME_COLUMNS, 4 sub-rows, PivotAddMsRow` | none |
| `src/components/views/grid/personalPivotColumns.js` | 4곳 (모두 DELETE-5 대상) | constant | — | — | — |
| `src/components/views/grid/cells/PersonalPivotProjectRow.jsx` | PPMT:L6 | PPMT L100-L105 | `project, tasks, isExpanded, onToggle` | `COLOR, PILL, PIVOT, TIME_COLUMNS`, `CountCell` 내부 | none |
| `src/components/views/grid/cells/PersonalPivotMsSubRow.jsx` | PPMT:L7 | PPMT L107-L112 | `milestone, tasks, currentUserId` | `COLOR, PIVOT, SPACE, TIME_COLUMNS, PersonalPivotTimeCell` | none |
| `src/components/views/grid/cells/PersonalPivotUngroupedSubRow.jsx` | PPMT:L8 | PPMT L122-L127 | `project, tasks, currentUserId` | `COLOR, PIVOT, TIME_COLUMNS, PersonalPivotTimeCell` | none |
| `src/components/views/grid/cells/PersonalPivotTimeCell.jsx` | PPMS:L3, PPUS:L3 (모두 삭제 대상) | 2 sub-rows | `tasks, timeCol, projectId, milestoneId, currentUserId` | `useStore(updateTask/addTask/toggleDone/openDetail), COLOR, PIVOT, SPACE` | none |

**유지 (삭제 제외)**:
- `src/components/views/grid/cells/PivotAddMsRow.jsx` — 팀 매트릭스(`PivotMatrixTable.jsx:8`) 공용
- `src/components/views/grid/PersonalMatrixMobileList.jsx` — 모바일 유지 (N-11)
- `src/hooks/usePivotExpandState.js` — KEYS 확장 후 재사용

---

## 2. DB Migration

**파일**: `supabase/migrations/20260425000000_focus_and_instant_project.sql`

```sql
-- ============================================================
-- Loop-XX: 포커스 패널 + '즉시' 시스템 프로젝트
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

**참고** (CLAUDE.md §3.2 / recon F1 ALTER 예시 패턴 준수):
- `IF NOT EXISTS` 항상 명시 (재실행 안전)
- DEFAULT 필수 (기존 데이터 보호)
- 기존 `valid_scope` CHECK / `idx_tasks_*` 인덱스 영향 없음
- `validate_task_project_consistency` trigger (loop-35k)는 `is_focus`와 무관

---

## 3. 신규 파일 (7개)

| 파일 | 역할 | 주요 Deps |
|---|---|---|
| `src/components/views/personal-todo/PersonalTodoShell.jsx` | 2컬럼 오케스트레이터 + `DndContext` + 자체 `handleDragEnd` | `useStore`, `getCachedUserId`, `DndContext`, `PointerSensor`/`TouchSensor` |
| `src/components/views/personal-todo/PersonalTodoListTable.jsx` | 왼쪽 백로그 (3섹션: 지금 / [다음+남은 접힘 footer]) | `usePivotExpandState('personal')`, `usePivotExpandState('personalSection')` |
| `src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx` | 프로젝트 행 (접기/펼치기, 흐림, 카운트) | `OPACITY.projectDimmed`, `COLOR`, `LIST` |
| `src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx` | `[MS \| ☐ \| text]` 한 줄 + `useSortable('bl-task:${id}')` | `CHECKBOX` 토큰, `useStore(toggleDone)`, TaskRow 체크박스 패턴 |
| `src/components/views/personal-todo/FocusPanel.jsx` | sticky 포커스 패널 + `useDroppable('focus-panel:root')` | `useStore(updateTask, reorderFocusTasks, addTask)` |
| `src/components/views/personal-todo/cells/FocusCard.jsx` | `⋮⋮ ☐ text meta ×` + `useSortable('focus-card:${id}')` | `useStore(toggleDone, updateTask)`, `CHECKBOX` |
| `src/components/views/personal-todo/cells/FocusQuickAddInput.jsx` | Enter → `addTask({... isFocus: true, projectId: INSTANT})` | `useStore(addTask)` |

**데이터 흐름**:
```
UnifiedGridView (기존, 유지) → PersonalMatrixGrid (기존, 수정) →
  desktop: PersonalTodoShell (신규) → PersonalTodoListTable + FocusPanel
  mobile:  PersonalMatrixMobileList (기존, 유지)
```

`PersonalMatrixGrid.jsx:10-25`의 기존 mobile/desktop 분기를 유지하되 desktop 쪽만 `PersonalTodoShell`로 교체 (Commit 13).

---

## 4. designTokens 추가

**파일**: `src/styles/designTokens.js`

기존 `PIVOT` export(L108-L116) 이후, `isMobileWidth`(L119) 이전에 신규 export 추가.

```js
// L116 이후 (PIVOT 종료 다음) 추가
// ─── 개인 할일 리스트 (Loop-XX) ───
export const LIST = {
  colWidthProject:   170,
  colWidthMilestone: 130,
  sectionGap:        24,
  projectRowGap:     12,
  taskRowGap:        6,
  etcLabel: { fontStyle: 'italic', color: '#a09f99' },
};

// ─── 투명도 (Loop-XX) ───
export const OPACITY = {
  projectDimmed: 0.65,   // F-31: 포커스 이동 있는 프로젝트
  // draggingItem: 0.3 (TaskRow L61), sortableDragging: 0.4 (Sidebar L459)
  // → 범위 외 Hotfix에서 일원화
};
```

**`usePivotExpandState.js` KEYS 확장**:

```js
// 기존 L8-L11
const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
  personalSection: 'personalSectionExpanded',  // 신규 — F-12
}
```

---

## 5. Store 변경 (useStore.js 추가만, 삭제/변경 없음)

### 5.1 `mapTask` 확장 (L173-L194)

기존 `mapTask` 내 L192(`scheduledDate: r.scheduled_date || null,`) 다음에 2줄 추가:

```js
// 추가
// ↓ Loop-XX: 포커스 ↓
isFocus: r.is_focus === true,
focusSortOrder: r.focus_sort_order ?? 0,
```

### 5.2 `taskToRow` 확장 (L116-L137)

기존 `taskToRow` 내 L133(`scheduled_date: t.scheduledDate || null,`) 다음에 2줄 추가:

```js
// 추가
is_focus: t.isFocus === true,
focus_sort_order: t.focusSortOrder ?? 0,
```

### 5.3 `mapProject` 확장 (L163-L172)

기존 `mapProject` L170(`archivedAt: r.archived_at || null,`) 다음에 2줄 추가:

```js
// 추가
isSystem: r.is_system === true,
systemKey: r.system_key || null,
```

### 5.4 `addProject` upsert payload 확장 (L737-L742)

기존 upsert payload에 `is_system, system_key` 필드 추가. 일반 사용자 호출(`addProject('My Project', 'blue', 'personal')`)에서는 `isSystem=false, systemKey=null` — 기본값이므로 기존 호출부는 영향 없음.

```js
// addProject 내부
const { error } = await d.from('projects').upsert({
  id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
  team_id: p.teamId, user_id: p.userId, owner_id: p.ownerId,
  description: p.description, start_date: p.start_date,
  due_date: p.due_date, status: p.status, created_by: p.created_by,
  // 추가
  is_system: p.isSystem === true,
  system_key: p.systemKey || null,
})
```

### 5.5 `sortProjectsLocally` — `isSystem` 우선 분기

기존(L1363-L1370)에 1줄 가드만 선두 추가:

```js
sortProjectsLocally: (projectList) => {
  const { localProjectOrder } = get()
  return [...projectList].sort((a, b) => {
    // 신규: system project 최상단
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
    const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
    return orderA - orderB
  })
},
```

### 5.6 신규 action `reorderFocusTasks`

기존 `reorderTasks`(L697-L715)와 동일 패턴. 필드만 `focusSortOrder` / `focus_sort_order`.

```js
// ─── Reorder focus tasks (Loop-XX) ───
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
```

### 5.7 '즉시' project seed (loadAll 내부)

`loadAll`의 projects fetch 직후(L470 근처, milestones 로드 **이전**) seed 삽입:

```js
// loadAll 내부 — projects 확정 후, milestones 로드 전에 삽입
const userId = _cachedUserId || (await d.auth.getUser()).data?.user?.id
if (userId) {
  const hasInstant = projects.some(p =>
    (p.user_id || p.userId) === userId &&
    (p.system_key || p.systemKey) === 'instant'
  )
  if (!hasInstant) {
    const instantPayload = {
      id: uid(),
      name: '즉시',
      color: '#888780',
      user_id: userId,
      owner_id: userId,
      created_by: userId,
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
      projects.push(instantPayload)  // 로컬 projects 배열에 추가 후 mapProject 적용
    } else {
      console.warn('[Ryan Todo] instant seed:', seedErr)
    }
  }
}
```

**idempotency 보장**:
- DB: `idx_projects_user_system_key` UNIQUE partial index → `(user_id, system_key)` 중복 차단
- App: `hasInstant` 체크 → 1차 방어
- 동시 탭 레이스: `ignoreDuplicates: true` 로 무시

### 5.8 Sidebar — system project DnD / archive 가드

`src/components/layout/Sidebar.jsx` 수정 (추가만):

1. **`handleSidebarDragEnd`** (L91-L106) 내 L99 이후에 가드 1줄 추가:
```js
const activeProject = [...teamProjects, ...personalProjects].find(p => p.id === activePid)
if (activeProject?.isSystem) return  // system project 이동 거부
```

2. **`SortableProjectItem`** (L450-L491) `useSortable` 호출부에 `disabled` 추가:
```js
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: `project-sidebar:${project.id}`,
  data: { section, projectId: project.id },
  disabled: project.isSystem,  // 신규 — F-30
})
```

3. **archive 가드** — `ProjectItem`의 archive 버튼 클릭 핸들러에 `if (project.isSystem) { showToast('시스템 프로젝트는 보관할 수 없습니다'); return }`. (`archiveFn` prop 래핑 또는 직접 guard — 구현은 diff 단계에서 확정)

---

## 6. R-ATOMIC 커밋 분할 (14 commits)

각 커밋 후 **`npm run build` 반드시 통과**. Commit 13을 QA 전체 검증 포인트로 둠.

### Stage 1: 백엔드 + 토큰 (1~7)

| # | Commit 메시지 | 변경 파일 | 빌드 상태 |
|---|---|---|---|
| 1 | `feat(db): Loop-XX 포커스 + 즉시 프로젝트 migration` | `supabase/migrations/20260425000000_focus_and_instant_project.sql` (신규) | DB only |
| 2 | `feat(store): mapTask/taskToRow/mapProject/addProject에 isFocus, focusSortOrder, isSystem, systemKey 필드 추가` | `useStore.js` | ✅ |
| 3 | `feat(store): reorderFocusTasks action + sortProjectsLocally isSystem priority` | `useStore.js` | ✅ |
| 4 | `feat(store): '즉시' project idempotent seed (loadAll 직후)` | `useStore.js` | ✅ (seed 검증) |
| 5 | `feat(tokens): designTokens LIST + OPACITY 그룹 추가` | `designTokens.js` | ✅ (미사용) |
| 6 | `feat(hook): usePivotExpandState personalSection KEY 추가` | `usePivotExpandState.js` | ✅ |
| 7 | `feat(sidebar): system project DnD disabled + archive guard + neutral gray 표시` | `Sidebar.jsx` | ✅ |

### Stage 2: 신규 셀 (8~11) — 모두 unused 상태, 빌드만 확인

| # | Commit 메시지 | 변경 파일 | 빌드 상태 |
|---|---|---|---|
| 8 | `feat(cells): PersonalTodoTaskRow + PersonalTodoProjectGroup (TaskRow checkbox 패턴)` | `cells/PersonalTodoTaskRow.jsx`, `cells/PersonalTodoProjectGroup.jsx` (신규 2) | ✅ (미사용) |
| 9 | `feat(list): PersonalTodoListTable (백로그 3섹션)` | `PersonalTodoListTable.jsx` (신규 1) | ✅ (미사용) |
| 10 | `feat(cells): FocusCard + FocusQuickAddInput` | `cells/FocusCard.jsx`, `cells/FocusQuickAddInput.jsx` (신규 2) | ✅ (미사용) |
| 11 | `feat(panel): FocusPanel (sticky, useDroppable)` | `FocusPanel.jsx` (신규 1) | ✅ (미사용) |

### Stage 3: Shell + 전환 + 삭제 (12~14) — 라이브 전환

| # | Commit 메시지 | 변경 파일 | 빌드 상태 |
|---|---|---|---|
| 12 | `feat(shell): PersonalTodoShell (2컬럼 오케스트레이터 + DnD handlers: focus-panel:root / focus-card / bl-task)` | `PersonalTodoShell.jsx` (신규 1) | ✅ (미사용) |
| 13 | `feat(grid): PersonalMatrixGrid desktop 분기를 PersonalTodoShell로 교체` | `PersonalMatrixGrid.jsx` (2줄 수정) | ✅ **→ QA 전체 검증 포인트** |
| 14 | `fix(DELETE-5): 구 피벗 테이블 6파일 제거` | `PersonalPivotMatrixTable.jsx`, `personalPivotColumns.js`, `cells/PersonalPivotProjectRow.jsx`, `cells/PersonalPivotMsSubRow.jsx`, `cells/PersonalPivotUngroupedSubRow.jsx`, `cells/PersonalPivotTimeCell.jsx` (6 삭제) | ✅ |

**Stage 단위 머지 권장**: 1~7 PR → 8~11 PR → 12~14 PR. 각 Stage 빌드 확인 후 다음 Stage 진행.

---

## 7. QA 체크리스트 (Commit 13 이후 전수 검증)

### 7.1 백로그 (3섹션)

| 요구 | 검증 방법 | 합격 기준 |
|---|---|---|
| F-03 | DevTools Elements → grid row style | `grid-template-columns: 170px 130px 1fr` |
| F-05 | 프로젝트 접기 → reload | 상태 유지 (localStorage `personalMatrixPivotExpanded`) |
| F-06 | `keyMilestoneId=null` task 1건 | "기타" italic, `color: #a09f99` |
| F-07 | 동일 MS 연속 3건 | 2, 3번째 행의 MS 열 공백 |
| F-08 | 신규 7파일 내 `grep "<input type=\"checkbox\""` | 0 matches |
| F-11 | '즉시' 프로젝트에 포커스 task만 있을 때 | 백로그 섹션에서 '즉시' 헤더 미렌더 |
| F-12 | 다음/남은 토글 → reload | 상태 유지 (localStorage `personalSectionExpanded`) |
| F-13 | "지금 할일" 헤더 `+ 새 할일` → Enter | 신규 task 생성, `assigneeId=userId, category='today', isFocus=false` |

### 7.2 포커스 패널

| 요구 | 검증 방법 | 합격 기준 |
|---|---|---|
| F-14 | 좌측 오래 스크롤 | 우측 패널 상단 고정 |
| F-16 | 3건 reorder 후 reload | 순서 유지 (focus_sort_order 0,1,2 DB 저장) |
| F-18 | × 클릭 | 우측 제거, 좌측 복귀, `task.category` 이전 값 유지 |
| F-19 | 체크박스 → done | 좌/우 모두에서 사라짐 |
| F-21 | 빠른 추가 Enter → "구글 미팅" | DB: `projects.system_key='instant'` projectId에 귀속, 포커스 패널에만 즉시 표시 |
| F-22 | 해당 카드 메타 | "프로젝트 미지정" (italic) — UI only |

### 7.3 DnD 양방향

| 요구 | 검증 방법 | 합격 기준 |
|---|---|---|
| F-23 | 백로그 task → 포커스 패널 drop | `updateTask({isFocus:true, focusSortOrder: max+1})` 호출, 양쪽 상태 즉시 반영 |
| F-24 | 포커스 카드 → 포커스 영역 밖 drop | `updateTask({isFocus:false})`, category 보존 |
| F-25 | 포커스 내 reorder | `focus_sort_order` 0,1,2,… 갱신 |

### 7.4 시스템 프로젝트

| 요구 | 검증 방법 | 합격 기준 |
|---|---|---|
| F-27 | Supabase query `SELECT * FROM projects WHERE user_id='<userId>' AND system_key='instant'` | 1행, `is_system=true, name='즉시', color='#888780'` |
| F-28 | loadAll 2회 연속 호출 (예: 탭 포커스 재진입) | 추가 insert 0 (UNIQUE index 차단) |
| F-29 | 사이드바 "개인 프로젝트" 섹션 첫 번째 | 항상 '즉시' |
| F-30 | '즉시' drag 시도 | no-op (drag 핸들 비활성 + handleSidebarDragEnd 가드) |
| N-12 | '즉시' archive 시도 | Toast "시스템 프로젝트는 보관할 수 없습니다" + return |

### 7.5 흐림 처리

| 요구 | 검증 방법 | 합격 기준 |
|---|---|---|
| F-31 | "26년 NDR"에 1건 포커스 이동 | 해당 프로젝트 그룹 `opacity: 0.65` |
| F-32 | 같은 프로젝트 헤더 | "1건 포커스 이동" 텍스트 렌더 |
| F-33 | × 눌러 포커스 해제 | opacity 1 복원 (transition 0.2s) |

### 7.6 비기능

| 요구 | 검증 방법 | 합격 기준 |
|---|---|---|
| N-02 | 신규 7파일에서 `grep -E "^const .*= [A-Z]+\."` (TDZ 위험 패턴) | 0 |
| N-03 | 신규/수정 파일에서 `grep "updateTask\({\s*\.\.\."` (spread 변칙) | 0 |
| N-04 | migration git diff | `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` 외 0 |
| N-08 | 신규 7파일에서 `grep "<input type=\"checkbox\""` | 0 |
| N-09 | F-24 후 해당 task.category | isFocus 토글 전 값 동일 |
| N-11 | 브라우저 리사이즈 `<768px` | `PersonalMatrixMobileList` 렌더, 좌우 2컬럼 사라짐 |

---

## 8. DnD handleDragEnd 설계 (Shell 내부)

`PersonalTodoShell`은 자체 `DndContext`를 가진다 — 기존 `UnifiedGridView`의 DnD 핸들러와 **격리**. 개인 할일 뷰는 UnifiedGridView를 벗어나 Shell로 이관됨.

### 8.1 sensor 설정 (UnifiedGridView 패턴 재사용)

```js
const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
const sensors = useSensors(pointerSensor, touchSensor)
```

### 8.2 ID prefix 규약 (기존과 충돌 없음)

| Prefix | 출처 | 용도 |
|---|---|---|
| `bl-task:${taskId}` | **기존 재사용** (UnifiedGridView) | 백로그 task sortable |
| `focus-panel:root` | **신규** | 포커스 패널 전체 droppable |
| `focus-card:${taskId}` | **신규** | 포커스 카드 sortable |

### 8.3 handleDragEnd 분기 (의사코드)

```js
const handleDragEnd = useCallback((e) => {
  const { active, over } = e
  if (!over) return
  const activeIdStr = String(active.id)
  const overId = String(over.id)

  // ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
  if (overId === 'focus-panel:root' && activeIdStr.startsWith('bl-task:')) {
    const taskId = activeIdStr.slice('bl-task:'.length)
    const maxOrder = Math.max(0, ...focusTasks.map(t => t.focusSortOrder ?? 0))
    updateTask(taskId, { isFocus: true, focusSortOrder: maxOrder + 1 })
    return
  }

  // ═══ 2) 포커스 내부 reorder (F-25) ═══
  if (activeIdStr.startsWith('focus-card:') && overId.startsWith('focus-card:')) {
    const activeTaskId = activeIdStr.slice('focus-card:'.length)
    const overTaskId = overId.slice('focus-card:'.length)
    if (activeTaskId === overTaskId) return
    const oldIdx = focusTasks.findIndex(t => t.id === activeTaskId)
    const newIdx = focusTasks.findIndex(t => t.id === overTaskId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(focusTasks, oldIdx, newIdx)
    reorderFocusTasks(reordered)
    return
  }

  // ═══ 3) 포커스 → 포커스 영역 밖 drop (F-24) ═══
  if (activeIdStr.startsWith('focus-card:')) {
    // over가 focus-* 가 아니면 패널 밖으로 이동
    if (!overId.startsWith('focus-')) {
      const taskId = activeIdStr.slice('focus-card:'.length)
      updateTask(taskId, { isFocus: false })
      return
    }
  }
}, [focusTasks, updateTask, reorderFocusTasks])
```

**주의 사항**:
- `focus-panel:root`은 `useDroppable({ id: 'focus-panel:root' })` 로 FocusPanel 전체를 drop target으로 설정
- 개별 `focus-card:${id}`는 `useSortable` — 둘의 id 스페이스 충돌 없음
- `bl-task:` prefix는 recon F6에서 확인된 기존 네이밍 — UnifiedGridView handler가 이미 사용하나, **Shell은 독립 DndContext**이므로 bubble-up 없음

---

## 9. 리스크 / 남은 확인 사항

### 9.1 기술 리스크

| # | 리스크 | 완화책 |
|---|---|---|
| R1 | loadAll seed가 네트워크 실패 시 무한 재시도 | `console.warn` + skip. 다음 loadAll에서 재시도 (idempotent) |
| R2 | 동시 탭에서 seed 레이스 → 중복 insert 시도 | UNIQUE partial index + `ignoreDuplicates: true` |
| R3 | '즉시' project archive 시도 UX | `archiveProject` 진입 전 Toast + early return (N-12) |
| R4 | Supabase upsert `onConflict: 'user_id,system_key'` 지원 여부 | PostgreSQL은 column list → UNIQUE INDEX 자동 매칭. 실측 필요 |
| R5 | 기존 사용자 기존 시드 데이터 | 신규 컬럼 default=false/0/null이라 기존 rows에 영향 없음 |
| R6 | is_focus=true이면서 done=true인 레거시 (수동 DB 수정 등) | 필터 `isFocus && !done` 로 자연스럽게 배제 |

### 9.2 확인 요청 (diff 작성 전)

| # | 사항 | 기본값 / 제안 |
|---|---|---|
| Q1 | Loop 번호 (문서 파일명/제목에 반영) | **Loop-XX → 사용자 지정** (현재 플레이스홀더) |
| Q2 | Migration 파일명 접두 | `20260425000000_focus_and_instant_project.sql` |
| Q3 | '즉시' 프로젝트 색상 | `#888780` (확정 — §0 #5) |
| Q4 | Migration 적용 타이밍 (ADD COLUMN only → online 안전) | Commit 1에서 바로 적용 |
| Q5 | Commit 13 머지 전 수동 QA (사용자 직접) | **필수** — F-01 ~ F-33 전수 |
| Q6 | DELETE-5 (커밋 14)를 별도 PR로 분리? | 같은 Loop 포함 권장 (일관성) |

Q1 ~ Q6 확답 후 `docs/plans/diff-plan-personal-todo-focus.md`로 str_replace diff 시퀀스 작성 착수.

---

## 10. 문서 크기

본 spec 약 26 KB — Claude Code 문서 소비 한도 내. Part 분할 불필요.
