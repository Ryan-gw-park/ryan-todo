# 마일스톤 뷰 개편 진단 보고서

생성일: 2026-03-16
대상 커밋: bfedf2550c9facd3a01aa251a2244f1195d8337f

---

## 영역 1: 프로젝트 마일스톤 뷰 현재 구현 상태

### 진입 경로
1. Sidebar.jsx → `enterProjectLayer(p.id)` 클릭
2. useStore.js (line 859-863): `currentView: 'projectLayer'`, `selectedProjectId: projectId`, `projectLayerTab: 'milestone'` 설정
3. App.jsx (line 82): `views.projectLayer = ProjectLayer` → ProjectLayer 렌더링
4. ProjectLayer.jsx (lines 48-55): `tab` 값에 따라 KeyMilestoneTab / TasksTab / GanttMode|DetailMode 렌더링

### 컴포넌트 트리
```
ProjectLayer
├── ProjectHeader (탭 전환, 프로젝트 메타)
├── ModeBar (ptimeline 탭일 때만)
└── Tab Content
    ├── tab='milestone' → KeyMilestoneTab
    │   ├── MilestoneRows (DndContext — 마일스톤 순서 DnD)
    │   │   ├── SortableMilestoneRow → MilestoneRow
    │   │   │   ├── MilestoneHeader (제목, 설명, 날짜, 색상)
    │   │   │   ├── DeliverableArea → DeliverableLine + AddButton
    │   │   │   └── TaskPanel (DndContext — 할일 순서 DnD)
    │   │   │       ├── SortableTaskRow (체크, 인라인편집, 드래그)
    │   │   │       └── AddButton (+ Task 추가)
    │   │   ├── AddButton (+ 마일스톤 추가)
    │   │   └── UnlinkedTasksSection (미배정 할일)
    │   └── CollapsibleSection ×2 (참조문서, 합의된 정책)
    ├── tab='tasks' → TasksTab → MilestoneOutlinerView
    └── tab='ptimeline' → GanttMode / DetailMode
```

### 마일스톤 CRUD 흐름

| 훅 | 파일 | 반환값 |
|----|------|--------|
| `useProjectKeyMilestone(projectId)` | useProjectKeyMilestone.js | `{ pkm, loading }` — 없으면 자동생성 |
| `useKeyMilestones(pkmId, projectId)` | useKeyMilestones.js | `{ milestones, add, update, remove, reorder, reload }` |
| `useKeyDeliverables(pkmId, projectId)` | useKeyDeliverables.js | `{ deliverables, add, update, remove, reload, getByMilestone }` |
| `useKeyLinks(pkmId, projectId)` | useKeyLinks.js | `{ items, add, update, remove, reload }` |
| `useKeyPolicies(pkmId, projectId)` | useKeyPolicies.js | `{ items, add, update, remove, reload }` |

### 할일-마일스톤 연결 방식

**직접 연결**: `tasks.key_milestone_id` (uuid FK → key_milestones.id)
- Loop-26 migration에서 추가 (loop-26-rename-to-key-milestones.sql line 108)
- `deliverable_id`는 Loop-26에서 DROP됨
- 코드 내 camelCase: `keyMilestoneId` (useStore.js mapTask, lines 125-126)

### 미배정 할일 표시 방식

**KeyMilestoneTab.jsx (lines 72-75):**
```javascript
const unlinkedTasks = useMemo(() =>
  tasks.filter(t => !t.keyMilestoneId && t.category !== 'done'),
  [tasks]
)
```

**UnlinkedTasksSection (lines 801-842):** 마일스톤 목록 하단에 "미배정 할일 N" 헤더 + 클릭 가능 할일 목록. 클릭 시 `openDetail(task)` 호출.

### TaskPanel (오른쪽 패널)

**KeyMilestoneTab.jsx (lines 514-578):**
- 빈 상태: "Task 없음" + "+ Task 추가" 버튼
- DndContext로 할일 순서 DnD (closestCenter)
- SortableTaskRow: 드래그핸들 + 체크박스 + 인라인편집 + 상세버튼(→)
- "+ Task 추가" 클릭 → addTask({ keyMilestoneId: milestoneId, category: 'today' }) → DetailPanel 열기

### 탭 전환 로직

**ProjectHeader.jsx (lines 31-35):**
```javascript
const TABS = [
  { key: 'milestone', label: '마일스톤' },
  { key: 'tasks', label: '할일', badge: String(taskCount) },
  { key: 'ptimeline', label: '타임라인', badgeWarn: unassignedCount > 0 ? `미배정 ${unassignedCount}` : null },
]
```
- `onTabChange(t.key)` → store `setProjectLayerTab(tab)` (line 865)

### ProjectHeader 구조

**Props:** `{ project, currentTab, onTabChange }`
- 색상 dot + 프로젝트명 + "SCD팀 · 오너 : {ownerName || '미지정'}" + 탭 버튼들
- 할일 뱃지: `tasks.filter(t.projectId === project.id && !t.deletedAt && !t.done).length`
- 오너명: `useTeamMembers.getMembers(currentTeamId)` → `ownerId` 매칭
- `unassignedCount = 0` (TODO: 미구현, 하드코딩)

---

## 영역 2: 매트릭스 뷰 할일 인터랙션 패턴

### 인라인 할일 입력

**컴포넌트:** `InlineAdd.jsx` (src/components/shared/InlineAdd.jsx)
```javascript
const handleAdd = () => {
  if (!text.trim()) return
  const { startDate, dueDate } = parseDateFromText(text.trim())
  addTask({ text: text.trim(), projectId, category, startDate, dueDate, ...extraFields })
  setText('')
}
// Enter → handleAdd(), Escape → setActive(false)
```

### 인라인 수정

**컴포넌트:** MatrixCard (MatrixView.jsx, lines 247-369)
1. 클릭 → `setEditing(true)` (line 341, isDragging이 아닐 때)
2. useEffect: 자동 포커스 + textarea 높이 조절
3. Blur/Enter → `saveText()`: `updateTask(task.id, { text: trimmed })`
4. Escape → 원본 텍스트 복원

### 상세패널 진입

```javascript
// useStore.js line 255
openDetail: (task) => set({ detailTask: task, showNotificationPanel: false })
```
- MatrixCard 호버 시 → 버튼 → `openDetail(task)`
- KeyMilestoneTab TaskPanel → "→" 버튼 → `openDetail(task)`

### 완료 토글

```javascript
// useStore.js lines 429-443
toggleDone: async (id) => {
  const t = get().tasks.find(x => x.id === id)
  if (!t.done) {
    get().updateTask(id, { done: true, category: 'done', prevCategory: t.category })
    // 토스트 + 되돌리기 제공
  } else {
    const dest = t.prevCategory || 'backlog'
    get().updateTask(id, { done: false, category: dest, prevCategory: '' })
  }
}
```

### DnD 설정

**센서 (MatrixView.jsx lines 23-25):**
```javascript
const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
```

**SortableContext:** `verticalListSortingStrategy`, items = `catTasks.map(t => t.id)`
**useSortable:** MatrixCard에서 `useSortable({ id: task.id })`

### 카테고리 간 DnD (cross-container)

**onDragEnd (MatrixView.jsx lines 33-68):**
```javascript
// 드롭존 ID 형식: "${projectId}:${category}"
if (typeof overId === 'string' && overId.includes(':')) {
  const [targetProjectId, targetCategory] = overId.split(':')
  moveTaskTo(active.id, targetProjectId, targetCategory)
  return
}
// 같은 셀 → reorderTasks(arrayMove(...))
// 다른 셀 → moveTaskTo(active.id, overTask.projectId, overTask.category)
```

**moveTaskTo (useStore.js lines 458-470):**
```javascript
moveTaskTo: async (id, projectId, category) => {
  const patch = { projectId, category }
  if (category === 'done' && !t.done) { patch.done = true; patch.prevCategory = t.category }
  else if (category !== 'done' && t.done) { patch.done = false }
  get().updateTask(id, patch)
}
```

---

## 영역 3: dnd-kit 현재 사용 현황

### 사용 파일 목록 (6개)

| 파일 | DndContext 수 | 충돌 감지 알고리즘 |
|------|--------------|-------------------|
| MatrixView.jsx | 1 | default (closestCenter) |
| TeamMatrixView.jsx | 1 | custom `matrixCollision` (pointerWithin + rectIntersection) |
| TimelineView.jsx | 1 | default (closestCenter) |
| TodayView.jsx | 1 | closestCenter |
| KeyMilestoneTab.jsx | 2 (마일스톤 순서 + 할일 순서) | closestCenter |
| MilestoneOutlinerView.jsx | 2 (마일스톤 그룹 + 할일) | closestCenter |

**총 DndContext: 8개, 중첩 없음** (각각 독립적 스코프)

### 키보드 접근성

**미구현.** `@dnd-kit/accessibility` 패키지 설치되어 있으나 코드에서 사용하지 않음.
`sortableKeyboardCoordinates` 사용처 없음.

### Cross-container 드래그 처리 패턴

| 뷰 | 드롭존 ID 형식 | 처리 방식 |
|----|---------------|----------|
| MatrixView | `${projectId}:${category}` | moveTaskTo |
| TeamMatrixView | `${projectId}:${category}:${assigneeId}` | moveTaskTo + assignee |
| TimelineView | `project:${projectId}` | moveTaskTo |
| TodayView | `project:${projectId}` | moveTaskTo |
| KeyMilestoneTab | 없음 (같은 마일스톤 내 순서만) | reorder만 |

---

## 영역 4: tasks 테이블 스키마 및 마일스톤 연결

### 주요 컬럼 (migration 파일 기반)

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | text | 프론트엔드 생성 |
| text | text | 할일 제목 |
| notes | text | 설명 |
| done | boolean | 완료 여부 |
| category | text | today/next/backlog/done |
| project_id | text | 프로젝트 FK |
| sort_order | integer | 정렬 순서 |
| due_date | text | 마감일 |
| start_date | text | 시작일 |
| prev_category | text | 완료 전 카테고리 (되돌리기용) |
| scope | text | private/team/assigned |
| team_id | uuid | 팀 FK |
| assignee_id | uuid | 담당자 |
| created_by | uuid | 생성자 |
| highlight_color | text | 강조색 |
| updated_at | timestamptz | 동기화용 |
| deleted_at | timestamptz | 소프트 삭제 (Loop-23) |
| alarm | jsonb | 알림 설정 |
| **key_milestone_id** | **uuid FK** | **key_milestones(id) ON DELETE SET NULL** |

### 마일스톤 연결

- **직접 연결**: `key_milestone_id` (uuid) → `key_milestones.id`
- `deliverable_id`는 Loop-26에서 DROP됨
- 미배정 할일 조건: `!t.keyMilestoneId && t.category !== 'done'`

### key_milestones 테이블 스키마

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | gen_random_uuid() |
| pkm_id | uuid FK | project_key_milestones(id) ON DELETE CASCADE |
| project_id | text | 프로젝트 ID |
| title | text | 마일스톤 제목 |
| description | text | 설명 |
| start_date | date | 시작일 |
| end_date | date | 종료일 |
| color | text | 기본값 '#1D9E75' |
| sort_order | integer | 정렬 순서 |
| created_by | uuid | 생성자 |
| created_at, updated_at | timestamptz | 타임스탬프 |

---

## 영역 5: projects 테이블 및 오너 관련

### owner_id 컬럼

**존재함.** Migration: `20260316000000_add_project_owner.sql`
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE projects SET owner_id = user_id WHERE owner_id IS NULL AND user_id IS NOT NULL;
```

### 프로젝트 생성 시 owner_id 설정

**useStore.js addProject (lines 493-511):**
```javascript
const p = {
  id: uid(), name, color, sortOrder: Date.now(),
  teamId: (teamId && projectScope !== 'personal') ? teamId : null,
  userId: (!teamId || projectScope === 'personal') ? userId : null,
  ownerId: userId,  // 항상 현재 사용자로 설정
}
```

### 프로젝트 헤더 오너 표시

**ProjectHeader.jsx (lines 14-26):**
- `project.ownerId` → `useTeamMembers.getMembers(currentTeamId)` → 매칭 → `ownerName`
- 표시: `오너 : {ownerName || '미지정'}`
- **오너 변경 UI는 미구현** — 현재 표시만 하고 변경 드롭다운 없음

### 팀원 목록 훅

**useTeamMembers.js (lines 9-38):**
```javascript
useTeamMembers.getMembers(teamId)
// 반환: [{ userId, displayName, role, email, ... }]
// displayName = COALESCE(tm.display_name, profiles.display_name)
```

---

## 영역 6: Zustand store 할일 관련 액션

| 액션 | 시그니처 | keyMilestoneId 지원 | 비고 |
|------|---------|---------------------|------|
| `addTask` | `(task: object)` | ✅ | `{ text, projectId, category, keyMilestoneId, ... }` |
| `updateTask` | `(id, patch)` | ✅ | patch에 keyMilestoneId 포함 가능 |
| `toggleDone` | `(id)` | N/A | done/category 자동 전환 + toast |
| `deleteTask` | `(id)` | N/A | soft delete (deleted_at), fallback hard delete |
| `moveTaskTo` | `(id, projectId, category)` | N/A | 프로젝트+카테고리 이동 |
| `reorderTasks` | `(reorderedTasks[])` | N/A | sortOrder 일괄 갱신 |
| `openDetail` | `(task)` | N/A | detailTask 설정 |

### mapTask (DB→프론트 매핑, lines 110-128)

```javascript
keyMilestoneId: r.key_milestone_id || null,
deliverableId: r.deliverable_id || null,
```

### taskToRow (프론트→DB 매핑, lines 69-71)

```javascript
key_milestone_id: t.keyMilestoneId || null,
deliverable_id: t.deliverableId || null,
```

### 초기 로딩

`select('*')` — 모든 컬럼 포함, `key_milestone_id` 자동 로드됨.

---

## 영역 7: 프로젝트 뷰의 기존 할일 표시 방식

### 할일 필터링 로직

**MilestoneOutlinerView.jsx (lines 80-99):**
```javascript
const tasks = useMemo(() =>
  allTasks.filter(t => t.projectId === projectId && !t.deletedAt && !t.done),
  [allTasks, projectId]
)

const milestoneTaskGroups = useMemo(() =>
  milestones.map(ms => ({
    milestone: ms,
    tasks: tasks.filter(t => t.keyMilestoneId === ms.id).sort(...)
  })), [milestones, tasks])

const unlinkedTasks = useMemo(() =>
  tasks.filter(t => !t.keyMilestoneId && t.category !== 'done').sort(...),
  [tasks])
```

### 카테고리별 그룹핑

프로젝트 뷰에서는 카테고리(오늘/다음/남은) 그룹핑 없음.
**마일스톤별 그룹핑** 사용: 각 마일스톤 아래 해당 할일 나열.

### 렌더링 컴포넌트

| 탭 | 할일 렌더링 컴포넌트 | 레이아웃 |
|----|---------------------|---------|
| 마일스톤 (KeyMilestoneTab) | SortableTaskRow (TaskPanel 내) | 좌우 분할: 왼쪽=마일스톤+결과물, 오른쪽=할일 |
| 할일 (TasksTab) | OutlinerTaskNode (MilestoneOutlinerView) | 세로 리스트: 마일스톤 헤더 아래 할일 |

**같은 컴포넌트가 아닌 별개 컴포넌트.** KeyMilestoneTab은 자체 SortableTaskRow, MilestoneOutlinerView는 OutlinerTaskNode 사용.

---

## 영역 8: 상세패널(DetailPanel) 마일스톤 연결

### MilestoneSelector 존재 및 구현

**DetailPanel.jsx (lines 131-140):**
```jsx
{task.projectId && (
  <DetailRow label="마일스톤">
    <MilestoneSelector
      projectId={task.projectId}
      value={task.keyMilestoneId}
      onChange={(keyMilestoneId) => canEdit && updateTask(task.id, { keyMilestoneId })}
    />
  </DetailRow>
)}
```

**MilestoneSelector.jsx (lines 5-127):**
- DB에서 마일스톤 목록 조회 (`key_milestones` WHERE `pkm_id`)
- 드롭다운: 마일스톤 선택 → `onChange(milestoneId)` 또는 "연결 해제" → `onChange(null)`
- 현재 선택된 마일스톤 제목 + 색상 dot 표시

### 변경 가능 여부

✅ **DetailPanel에서 keyMilestoneId 변경 가능** — `updateTask(task.id, { keyMilestoneId })` 호출

---

## 종합 소견

### 구현 가능성 판단

| # | 요구사항 | 판단 | 근거 |
|---|---------|------|------|
| 1 | 백로그 가상 섹션 | 소규모 수정 | UnlinkedTasksSection 이미 존재, 이름/UI만 변경 |
| 2 | 할일 마일스톤 간 DnD | **신규 구현** | 현재 KeyMilestoneTab의 DnD는 같은 마일스톤 내 순서만. cross-container DnD 필요 |
| 3 | 마일스톤 항목 순서 DnD | **이미 구현됨** | KeyMilestoneTab MilestoneRows에 DndContext + SortableContext 존재 |
| 4 | 매트릭스 수준 할일 인터랙션 | 소규모 수정 | InlineAdd, 인라인편집, openDetail, toggleDone 패턴 재활용 가능 |
| 5 | 글로벌 뷰 ↔ 프로젝트 뷰 동기화 | **이미 구현됨** | Zustand store 단일 tasks 배열 → 모든 뷰 자동 반영 |
| 6 | 프로젝트 오너 지정 UI | 소규모 수정 | owner_id 컬럼 존재, useTeamMembers 훅 존재, 드롭다운 UI만 추가 |
| 7 | 백로그 최하단 고정 | 소규모 수정 | 렌더링 순서 조정만 필요 |
| 8 | 마일스톤별 할일 개수/진행률 | 소규모 수정 | tasks 배열에서 필터+카운트 |
| 9 | 마일스톤 접기/펼치기 | 소규모 수정 | MilestoneOutlinerView에 allNotesCollapsed 패턴 이미 존재 |
| 10 | 빈 마일스톤 드랍 유도 UI | 소규모 수정 | useDroppable + 힌트 텍스트 추가 |
| 11 | D-day/날짜 표시 강화 | 소규모 수정 | daysUntil() 유틸 이미 존재 (KeyMilestoneTab line 14-21) |
| 12 | owner_id 단일 필드 | **이미 구현됨** | projects.owner_id uuid 컬럼 존재 |

### DB 스키마 변경 필요 여부

- `tasks.key_milestone_id`: ✅ 이미 존재
- `projects.owner_id`: ✅ 이미 존재
- `project_key_milestones` UNIQUE 제약: ✅ 방금 추가 완료
- **추가 DDL 불필요**

### dnd-kit 확장 난이도

**핵심 과제: 마일스톤 간 cross-container DnD**

현재 KeyMilestoneTab의 TaskPanel은 각 마일스톤마다 독립된 DndContext를 가짐.
마일스톤 간 할일 이동을 위해서는:

1. **옵션 A (권장)**: 단일 DndContext로 통합 + 마일스톤별 useDroppable 존 설정.
   드롭존 ID: `milestone:${milestoneId}` / `backlog` 형식.
   MatrixView의 `${projectId}:${category}` 패턴과 동일 방식.
   충돌 가능성 낮음 (DndContext 중첩 없이 교체).

2. **옵션 B**: 각 TaskPanel DndContext 유지 + 외부 DndContext 래퍼.
   dnd-kit은 중첩 DndContext를 공식 지원하지 않아 충돌 위험.

### 위험 요소

| 영역 | 위험도 | 설명 |
|------|--------|------|
| KeyMilestoneTab DnD 재구성 | 🟡 중 | 현재 2개 독립 DndContext → 1개 통합 시 기존 마일스톤 순서 DnD 동작 검증 필요 |
| TaskPanel 컴포넌트 변경 | 🟡 중 | 인라인입력/편집/완료토글 추가 시 기존 SortableTaskRow 구조 변경 |
| 글로벌 뷰 동기화 | 🟢 낮 | Zustand 단일 store 사용 중 → updateTask만 호출하면 자동 반영 |
| 프로젝트 오너 드롭다운 | 🟢 낮 | 독립적 UI 추가, 기존 코드 영향 없음 |
| MilestoneOutlinerView (할일 탭) | 🟡 중 | TasksTab과 KeyMilestoneTab이 별개 컴포넌트 → 양쪽 모두 수정 필요 |
| CLAUDE.md 규칙: 기존 컴포넌트 수정 금지 | 🔴 높 | KeyMilestoneTab 대폭 수정 불가피 — 래퍼 패턴으로는 한계. 사전 합의 필요 |
