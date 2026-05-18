# Spec — 개인 할일 매트릭스 뷰 (프로젝트 × 아젠다)

| 항목 | 값 |
|---|---|
| 작성 단계 | Spec (REQ-LOCK 포맷) |
| 수신 | Claude Code |
| 입력 | `recon-personal-agenda-matrix.md`, `recon-report-personal-agenda-matrix.md`, mockup 4종 |
| 검증 | `spec-personal-agenda-matrix-validation.md` (BLOCK 3건/HIGH 3건 반영 후 갱신: 2026-05-18 r2) |
| 산출 | R-ATOMIC 커밋 13개 + DELETE-5 후속 PR 1개 |
| 빌드 통과 기준 | 각 커밋 후 `npm run build` 0 error, 회귀 없음 |

## Changelog r2 (2026-05-18, validation 반영)
- **B1**: C10 `PersonalTodoShell` 경로 정정 (`grid/grids/` → `personal-todo/`)
- **B2**: DndContext 중첩 대응 — 매트릭스 핸들러는 `PersonalTodoShell` 내부 dispatcher 등록(옵션 B)
- **B3**: 매트릭스 "행" = **키 마일스톤** 확정 (`useStore.milestones`). R5 우회 *불필요*
- **H1**: `gridTemplateColumns` 실제 minmax 값 반영
- **H2**: `mapTask` + `taskToRow` 모두 `agendas` 처리 명시
- **H3**: 의존성 그래프에 C3b→C4b, C2→C4b, C8/C9→C10 추가
- **M1-M5, L1-L3**: 모호 표현 정리, R 매핑 정정

---

## 0. 결정 사항 요약 (Frozen)

| # | 결정 | 채택안 |
|---|---|---|
| D1 | 아젠다 데이터 모델 | A안 — `tasks.agendas text[]` |
| D2 | 신규 할일 row 식별 | 별도 플래그 없음 — `keyMilestoneId IS NULL && !done && !deletedAt` |
| D3 | 기존 뷰 처분 | **외과적 교체** — `PersonalTodoShell` 내부에서 `PersonalTodoListTable` → `PersonalAgendaMatrixTable` swap, FocusPanel 유지 |
| D4 | grid 비율 | `1.5fr 1fr` → `2fr 1fr` (매트릭스 영역 확대) |
| D5 | MS 계층 | 매트릭스 평탄화 — milestone sub-row 없음. 행 자체가 key_milestone (D5+ 참조) |
| D5+ | 매트릭스 행 정의 | **행 = key_milestone** (uuid). `useStore.milestones`에서 가져옴. AgendaRowHeader 라벨 = `milestone.title`, 부가 = 소속 project name (color dot). 행 필터: 현재 사용자에게 할당된 미완료 task가 ≥1개인 milestone (변동 행 수) |
| D6 | 셀 간 드래그 의미 | "추가 모드" — 기존 아젠다 태그 유지, 도착 아젠다만 추가 |
| D7 | 아젠다 단일 제거 | 셀 내 X 버튼 또는 detail panel |
| D8 | `is_focus` 시각화 | 매트릭스 카드에 ⭐ 뱃지, 우측 FocusPanel은 그대로 |
| D9 | 카테고리 표시 | `category !== 'today'`인 task에만 칩(`다음/나중/백로그`) 표시 |
| D10 | 필터 | `assigneeId === currentUserId && !deletedAt && (hideDone ? !done : true)` (scope 무관) |
| D11 | 모바일 UX | 본 spec 범위 외 — 후속 sub-loop |
| D12 | DELETE PersonalTodoListTable | 본 spec 범위 외 — 별도 PR (DELETE-5 적용) |

---

## 1. REQ-LOCK 요구사항 목록

### 1.1 데이터 모델 (R-DATA)

| ID | 요구사항 |
|---|---|
| R-DATA-1 | `tasks.agendas text[] NOT NULL DEFAULT '{}'` 컬럼 추가 |
| R-DATA-2 | `valid_agendas CHECK (agendas <@ ARRAY['weekly_jason', 'weekly_planning', 'decision_needed', 'personal']::text[])` 제약 추가 |
| R-DATA-3 | `tasks_agendas_gin` GIN 인덱스 (`USING GIN (agendas)`) |
| R-DATA-4 | RLS 정책 변경 0건 — agendas는 tasks 본체 컬럼이므로 기존 정책 자동 적용 |
| R-DATA-5 | `updated_at` 트리거 그대로 — polling delta sync 호환 |

### 1.2 Zustand store (R-STORE)

| ID | 요구사항 |
|---|---|
| R-STORE-1 | `updateTask(id, patch)` 시그니처 절대 불변 — `agendas`는 patch 안 필드로만 전달 |
| R-STORE-2 | `mapTask`(Supabase row → JS) 에 `agendas: r.agendas \|\| []` 추가 (기존 패턴 일치) |
| R-STORE-3 | `taskToRow`(JS → Supabase row)에 `agendas: t.agendas \|\| []` 추가 — `addTask`/`updateTask` 양방향 동작 보장 |
| R-STORE-4 | `applyTransitionRules` 변경 없음 — R5 등 기존 7개 규칙에 영향 없음 |
| R-STORE-5 | `hoveredTaskId: string \| null` + `setHoveredTaskId(id)` 신규 추가 (store 최상위, 슬라이스 분리 불필요) |
| R-STORE-6 | `hoveredTaskId` 참조는 selector 패턴 필수 — `useStore(s => s.hoveredTaskId === task.id)` 식 |

### 1.3 디자인 토큰 (R-TOKEN)

| ID | 요구사항 |
|---|---|
| R-TOKEN-1 | `AGENDA` 객체 추가 — 4개 아젠다별 `{ dot, chipBg, chipText }` |
| R-TOKEN-2 | `HIGHLIGHT.crossCell` 객체 추가 — `{ bg: '#FAEEDA', outline: '#EF9F27', text: '#633806' }` |
| R-TOKEN-3 | `MATRIX` 객체 추가 — `{ inboxRowBg: '#FAF8F2', emptyCellPattern: ... }` (기존 PIVOT 유지) |
| R-TOKEN-4 | 모든 토큰은 함수 내부 또는 인라인 참조 — 모듈 레벨 `const X = COLOR.foo` 금지 (Vite TDZ) |
| R-TOKEN-5 | `#c4c2ba`, `#d3d1c7` 사용 0건 (secondary text 최소 `#888780`) |

`AGENDA` 토큰 값 확정:
```js
AGENDA = {
  jasonWeekly:    { dot: '#7F77DD', chipBg: '#EEEDFE', chipText: '#3C3489' }, // c-purple
  planningWeekly: { dot: '#1D9E75', chipBg: '#E1F5EE', chipText: '#085041' }, // c-teal
  decisionNeeded: { dot: '#D85A30', chipBg: '#FAECE7', chipText: '#712B13' }, // c-coral
  personal:       { dot: '#888780', chipBg: '#F1EFE8', chipText: '#444441' }, // c-gray
}
```

### 1.4 뷰 / 라우팅 (R-VIEW)

| ID | 요구사항 |
|---|---|
| R-VIEW-1 | `currentView='personal-matrix'` 키 그대로 유지 — `App.jsx` 라우팅 변경 0건 |
| R-VIEW-2 | `Sidebar.jsx` 변경 0건 |
| R-VIEW-3 | `PersonalTodoShell` 내부에서 `<PersonalTodoListTable />` → `<PersonalAgendaMatrixTable />` swap |
| R-VIEW-4 | `PersonalTodoShell`의 grid 비율 `1.5fr 1fr` → `2fr 1fr` |
| R-VIEW-5 | `FocusPanel` 변경 0건 — props/구조/위치 모두 그대로 |
| R-VIEW-6 | `PersonalTodoListTable` 파일은 본 spec에서 *유지* (dead code) — 후속 PR에서 DELETE-5 적용 |

### 1.5 신규 컴포넌트 (R-COMP)

| ID | 요구사항 |
|---|---|
| R-COMP-1 | `PersonalAgendaMatrixTable.jsx` — `src/components/views/grid/` |
| R-COMP-2 | `AgendaMatrixCell.jsx` — `src/components/views/grid/cells/` |
| R-COMP-3 | `AgendaInboxRow.jsx` — `src/components/views/grid/cells/` |
| R-COMP-4 | `AgendaColHeader.jsx` — `src/components/views/grid/cells/` |
| R-COMP-5 | `AgendaRowHeader.jsx` — `src/components/views/grid/cells/` |
| R-COMP-6 | `personalAgenda.js` (cellKey + getCellTasks) — `src/utils/dnd/cellKeys/` |
| R-COMP-7 | `personalAgendaHandlers.js` (drag handlers) — `src/components/views/grid/dnd/` |
| R-COMP-8 | `SortableTaskCard`, `DroppableCell`, `InlineAdd`, `DetailPanel`, `MilestoneSelector` — 모두 *수정 없이 재사용* |

### 1.6 dnd-kit / 드래그 (R-DND)

| ID | 요구사항 |
|---|---|
| R-DND-1 | dispatcher에 핸들러 2개 등록 (**위치: `PersonalTodoShell.jsx` 모듈 최상단** — inner DndContext에서 dispatch 호출되도록):<br>- `'agenda-matrix-task'` → `handleAgendaMatrixTaskDrop`<br>- `'agenda-matrix-row'` → `handleAgendaMatrixRowDrop`<br>**근거**: `PersonalAgendaMatrixTable`이 `PersonalTodoShell`의 inner DndContext 내부에 swap되므로, useDroppable/useSortable이 inner context에 등록됨. UnifiedGridView의 외부 dispatcher는 호출 안 됨 (검증: `PersonalTodoShell.jsx:18-23` 주석 참조). |
| R-DND-2 | droppable id 규칙 — `msId`는 key_milestone uuid, `'inbox'`는 keyMilestoneId IS NULL 행 식별자:<br>- cell SortableContext: `agenda-cell-sortable:{msId\|'inbox'}:{agendaType}`<br>- cell droppable: `agenda-cell:{msId\|'inbox'}:{agendaType}`<br>- row droppable: `agenda-row:{msId\|'inbox'}` |
| R-DND-3 | `over.data.current.type` 값: `'agenda-matrix-task'` / `'agenda-matrix-row'` |
| R-DND-4 | **cell↔cell 드래그 (같은 행)** — 도착 셀의 agendaType을 `agendas` 배열에 *추가*. 기존 태그 *유지*. |
| R-DND-5 | **cell↔cell 드래그 (다른 행)** — `keyMilestoneId = 도착 msId` + 도착 agendaType *추가*. **projectId는 변경하지 않음** (행=key_milestone, R5 우회 *불필요*). |
| R-DND-6 | **inbox→project 행 드래그** — `keyMilestoneId = 도착 msId` + 도착 agendaType *추가* (도착 행 헤더 drop 시) |
| R-DND-7 | **같은 셀 내 재정렬** — `reorderTasks(reordered)` 호출 (기존 store action 재사용, `sortOrder` 갱신) |
| R-DND-8 | inner-DndContext dispatcher 사용 — `PersonalTodoShell.handleDragEnd` 시작부에 `dispatchDrop(e, ctx)` 호출 추가 (외부 패턴 복사). 미등록 type은 기존 분기(`bl-task:` / `focus-card:`)로 fall-through |

### 1.7 인터랙션 / UX (R-UX)

| ID | 요구사항 |
|---|---|
| R-UX-1 | 빈 셀 클릭 → InlineAdd 활성화 (`extraFields={ agendas: [agendaType], keyMilestoneId: projectId\|null }`) |
| R-UX-2 | 4-zone 이벤트 규칙 유지:<br>- 타이틀 영역 = 인라인 편집<br>- 비-타이틀 = 드래그<br>- 체크박스 = `done` 토글<br>- 우측 화살표 = `openDetail(task)` |
| R-UX-3 | hover 시 동일 `task.id` 가진 모든 카드 강조 — `HIGHLIGHT.crossCell` 스타일 |
| R-UX-4 | 아젠다 칩 단일 제거 — 셀 내 task 카드 우측 X 버튼 또는 detail panel `agendas` 다중선택 |
| R-UX-5 | `is_focus === true` task → 카드 좌측에 ⭐ 뱃지 (`<i class="ti ti-star-filled">` 또는 동등 아이콘) |
| R-UX-6 | `category !== 'today'` task → 카드에 작은 카테고리 칩 (`다음/나중/백로그`). `today`는 무표시 |
| R-UX-7 | 빈 (프로젝트, 아젠다) 교차점 → 빗금 (`repeating-linear-gradient` 45도) |
| R-UX-8 | hideDone 토글 → 헤더에 [완료 숨김] 버튼 |

### 1.8 제약사항 (R-CONST)

| ID | 요구사항 |
|---|---|
| R-CONST-1 | `updateTask(id, patch)` 시그니처 불변 |
| R-CONST-2 | `tasks` 기존 컬럼 rename/modify 0건 — 신규 컬럼만 추가 |
| R-CONST-3 | 기존 뷰 컴포넌트(`TodayView`, `MatrixView`, `TimelineView`, `MemoryView`) 내부 수정 0건. **예외**: `PersonalTodoShell`은 D3(외과적 교체) 결정에 따라 (a) `<PersonalTodoListTable />` ↔ `<PersonalAgendaMatrixTable />` swap, (b) `gridTemplateColumns` 비율 변경, (c) `handleDragEnd` 시작부에 `dispatchDrop` 호출 추가 — 3개 변경만 허용. 그 외(FocusColumn/FocusPanel/handleDragEnd 본체/sensors) 수정 0건 |
| R-CONST-4 | `OutlinerEditor`, `OutlinerRow`, `useOutliner`, `notes.js` 수정 0건 |
| R-CONST-5 | `border-left` 사용 0건 |
| R-CONST-6 | `text-overflow: ellipsis` 사용 0건 — `white-space: normal; word-break: keep-all` |
| R-CONST-7 | 모듈 레벨 `const X = COLOR.foo` 0건 (Vite TDZ) |
| R-CONST-8 | Personal scope assignee 변경 차단 — 신규 매트릭스 드래그는 `keyMilestoneId`/`agendas`만 변경 |
| R-CONST-9 | 사이드바 3-section 구조 유지 — 변경 0건 |
| R-CONST-10 | 영문 식별자 (`weekly_jason`) / 한국어 UX (`Jason 위클리`) 분리 |

---

## 2. R-ATOMIC 커밋 정의

각 커밋: 변경 파일 · 변경 내용 · 의존성 · 검증 기준 · 충족 R 항목.

---

### C1 — `feat: add agendas column to tasks table`

**충족 R**: R-DATA-1, R-DATA-2, R-DATA-3, R-DATA-4, R-DATA-5

**변경 파일**:
- `supabase/migrations/20260518000000_personal_agenda_matrix_tasks_agendas.sql` (신규)

**변경 내용**:
```sql
BEGIN;

ALTER TABLE tasks
  ADD COLUMN agendas text[] NOT NULL DEFAULT '{}';

ALTER TABLE tasks
  ADD CONSTRAINT valid_agendas CHECK (
    agendas <@ ARRAY[
      'weekly_jason',
      'weekly_planning',
      'decision_needed',
      'personal'
    ]::text[]
  );

CREATE INDEX IF NOT EXISTS tasks_agendas_gin
  ON tasks USING GIN (agendas);

COMMIT;
```

**의존성**: 없음

**검증 기준**:
- Supabase 마이그레이션 적용 성공
- 기존 task 조회 시 `agendas: []` 반환
- 기존 update/insert 정상 동작

---

### C2 — `feat: add AGENDA, HIGHLIGHT.crossCell, MATRIX design tokens`

**충족 R**: R-TOKEN-1, R-TOKEN-2, R-TOKEN-3, R-TOKEN-4, R-TOKEN-5

**변경 파일**:
- `src/styles/designTokens.js`

**변경 내용**:
- `PILL` export 직후, `PIVOT` export 직전에 `AGENDA`, `HIGHLIGHT`, `MATRIX` 신규 export 추가
- 기존 `PIVOT` 객체 *유지* (수정 금지)
- `AGENDA` 객체: §1.3 색상값 그대로
- `HIGHLIGHT.crossCell`: `{ bg: '#FAEEDA', outline: '#EF9F27', text: '#633806' }`
- `MATRIX`: `{ inboxRowBg: '#FAF8F2', stripedPattern: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.015) 6px, rgba(0,0,0,0.015) 7px)' }`

**의존성**: 없음

**검증 기준**:
- 빌드 통과
- 기존 컴포넌트가 PILL/PIVOT 참조 시 정상 동작 (회귀 없음)
- 신규 토큰 import 후 정상 참조 확인 (별도 컴포넌트 작업 없이 console에서 확인 가능)

---

### C3a — `feat: add hoveredTaskId UI state with selector pattern`

**충족 R**: R-STORE-5, R-STORE-6

**변경 파일**:
- `src/hooks/useStore.js`

**변경 내용**:
- 기존 `detailTask`, `currentTeamId` 등 UI state 영역에 다음 추가:
  ```js
  hoveredTaskId: null,
  setHoveredTaskId: (id) => set({ hoveredTaskId: id }),
  ```
- 다른 슬라이스 / 함수 수정 0건

**의존성**: 없음 (C1과 독립)

**검증 기준**:
- 빌드 통과
- `useStore.getState().hoveredTaskId === null` 초기값
- `useStore.getState().setHoveredTaskId('xyz')` 후 값 변경 확인

---

### C3b — `feat: extend mapTask/loadAll/addTask to handle agendas field`

**충족 R**: R-STORE-1, R-STORE-2, R-STORE-3, R-STORE-4

**의존성**: C1 (DB 컬럼 선행 필요)

**변경 파일**:
- `src/hooks/useStore.js`

**변경 내용**:
- `mapTask` (`useStore.js:185`) 매핑에 `agendas: r.agendas || []` 추가 (기존 `|| default` 패턴 일치)
- `taskToRow` (`useStore.js:122` 부근) 매핑에 `agendas: t.agendas || []` 추가 — `addTask`/`updateTask` 시 DB write 보장
- `applyTransitionRules` 변경 0건 (현 7개 규칙은 agendas 영향 없음)
- `updateTask(id, patch)` 시그니처 변경 0건 — `patch.agendas`는 `taskToRow`를 통해 자동 흘러감

**검증 기준**:
- 빌드 통과
- 기존 task 조회 시 `task.agendas === []` (기본값)
- `updateTask(id, { agendas: ['weekly_jason'] })` 호출 후 DB 반영 확인 (Supabase 조회)
- `addTask({...})` 시 row에 `agendas: '{}'` 자동 INSERT 확인

---

### C4a — `feat: add PersonalAgendaMatrixTable skeleton (read-only, no tasks)`

**충족 R**: R-COMP-1, R-COMP-4, R-COMP-5, R-UX-7

**의존성**: C2

**변경 파일** (신규):
- `src/components/views/grid/PersonalAgendaMatrixTable.jsx`
- `src/components/views/grid/cells/AgendaColHeader.jsx`
- `src/components/views/grid/cells/AgendaRowHeader.jsx`

**변경 내용**:
- `PersonalAgendaMatrixTable` 구조:
  ```
  CSS grid: 200px repeat(4, 1fr)
  ├─ thead row: [라벨] + AgendaColHeader × 4
  ├─ tbody:
  │    └─ (key_milestone 별) row:
  │        ├─ AgendaRowHeader (milestone.title + 상위 project name/color dot, sticky-left)
  │        └─ 빈 셀 × 4 (빗금 background)
  ```
- **행 = key_milestone**. 데이터 소스: `useStore(s => s.milestones)` + `useStore(s => s.projects)` (프로젝트 컨텍스트 표시용)
- 행 필터: 현재 사용자에게 할당된 미완료 task가 ≥1개 있는 milestone만 표시 (변동 행 수). 필터 조건:
  ```js
  const myUncompletedTasks = tasks.filter(t =>
    t.assigneeId === currentUserId && !t.done && !t.deletedAt
  )
  const visibleMsIds = new Set(myUncompletedTasks.map(t => t.keyMilestoneId).filter(Boolean))
  const visibleMs = milestones.filter(m => visibleMsIds.has(m.id))
  ```
- 행 정렬: `milestone.project_id` 그룹핑(상위 프로젝트 순서) → 내부 `sort_order`
- task 렌더링 없음 (C4b에서)
- inbox row 없음 (C5에서)
- 빈 셀 = `background: MATRIX.stripedPattern`
- AgendaRowHeader 라벨 형식: `[color dot] {project.name} · {milestone.title}` (sticky-left)

**검증 기준**:
- 빌드 통과
- `<PersonalAgendaMatrixTable />` 임시 렌더 시 그리드 구조 + 빗금 셀 + 헤더 정상 표시
- `PersonalTodoShell`에는 아직 연결 X

---

### C4b — `feat: render task cards inside agenda matrix cells`

**충족 R**: R-COMP-2, R-COMP-6, R-COMP-8, R-UX-2, R-UX-5, R-UX-6

**의존성**: C3b, C4a

**변경 파일** (신규):
- `src/components/views/grid/cells/AgendaMatrixCell.jsx`
- `src/utils/dnd/cellKeys/personalAgenda.js`

**변경 내용**:
- `personalAgenda.js`:
  ```js
  // cellKey 구조: { msId: uuid|'inbox', agendaType: string }
  export function makeCellKey(msId, agendaType) {
    return { msId, agendaType }
  }
  export function makeCellId(msId, agendaType) {
    return `agenda-cell:${msId || 'inbox'}:${agendaType}`
  }
  export function parseCellId(idStr) {
    // 'agenda-cell:{msId|inbox}:{agendaType}' 또는 'agenda-cell-sortable:...' → { msId, agendaType }
    const m = /^agenda-cell(?:-sortable)?:([^:]+):(.+)$/.exec(idStr)
    if (!m) return null
    return { msId: m[1] === 'inbox' ? null : m[1], agendaType: m[2] }
  }
  export function sameCellKey(a, b) {
    return a && b && a.msId === b.msId && a.agendaType === b.agendaType
  }
  export function getCellTasks(tasks, cellKey, ctx) {
    const { currentUserId, hideDone } = ctx
    return tasks
      .filter(t =>
        t.assigneeId === currentUserId &&
        !t.deletedAt &&
        (hideDone ? !t.done : true) &&
        (cellKey.msId === null
          ? t.keyMilestoneId == null         // inbox 행
          : t.keyMilestoneId === cellKey.msId) &&
        Array.isArray(t.agendas) && t.agendas.includes(cellKey.agendaType)
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }
  ```
- `AgendaMatrixCell`:
  - `<DroppableCell>` wrap (droppable id: `agenda-cell:{msId|'inbox'}:{agendaType}`, data: `{ type: 'agenda-matrix-task', cellKey }`)
  - `<SortableContext>` (id: `agenda-cell-sortable:{msId|'inbox'}:{agendaType}`)
  - 각 task → `<SortableTaskCard>` (재사용, 수정 없음)
  - task가 0개일 때 빗금 background 노출 (C4a 그대로)
  - 카드 좌측: `is_focus === true` → ⭐ 아이콘 (designTokens.AGENDA 무관, 별도 icon color)
  - 카드 우측: `category !== 'today'` → 작은 카테고리 칩 (`PILL` 토큰 활용)
- `PersonalAgendaMatrixTable`의 빈 셀 자리에 `<AgendaMatrixCell>` 마운트

**검증 기준**:
- 빌드 통과
- agendas 컬럼에 값 넣은 task가 정상 셀에 표시 (수동 DB seed 또는 dev tool)
- `is_focus`, `category !== 'today'` 시각 요소 정상 표시
- 4-zone 이벤트 (체크박스, 화살표) 기존대로 동작

---

### C5 — `feat: add inbox row to PersonalAgendaMatrixTable`

**충족 R**: R-COMP-3

**의존성**: C4b

**변경 파일** (신규):
- `src/components/views/grid/cells/AgendaInboxRow.jsx`

**변경 내용**:
- `PersonalAgendaMatrixTable`의 tbody 최상단에 `<AgendaInboxRow>` 1행 고정
- `AgendaRowHeader`와 동일 구조이되 다음 차이:
  - 라벨: "신규 할일" + `<i class="ti ti-inbox">` 아이콘
  - 카운트: 미분류 task 수 (`assigneeId === me && keyMilestoneId === null && !done && !deletedAt`)
  - background: `MATRIX.inboxRowBg` (`#FAF8F2`)
- 4개 셀: 각각 `<AgendaMatrixCell>` 재사용, `cellKey = { msId: null, agendaType }`
- `personalAgenda.js`의 `getCellTasks`는 이미 `msId === null` 분기 처리 완료 (C4b 코드 참조) — 추가 작업 없음
- inbox row 표시 조건: 항상 (task가 0개여도 표시) — "캡처용" UX 컨테이너이므로

**검증 기준**:
- 빌드 통과
- `keyMilestoneId === null` task가 inbox row 셀에 정상 표시
- 다른 프로젝트 행은 정상 동작 (회귀 없음)

---

### C6 — `feat: enable cell click to create task at intersection`

**충족 R**: R-UX-1

**의존성**: C5

**변경 파일**:
- `src/components/views/grid/cells/AgendaMatrixCell.jsx` (수정)

**변경 내용**:
- 셀 내 task 0개일 때(빗금 영역) 또는 셀 빈 영역 클릭 시:
  - `<InlineAdd>` 컴포넌트 활성화 (기존 재사용)
  - props: `extraFields={ agendas: [cellKey.agendaType], keyMilestoneId: cellKey.msId /* null = inbox */, projectId: cellKey.msId ? (milestones.find(m=>m.id===cellKey.msId)?.project_id) : INSTANT_PROJECT_ID }`
    - milestone 행: 해당 milestone의 `project_id`를 자동 세팅
    - inbox 행: 시스템 instant 프로젝트의 id 사용 (`useStore.projects`에서 `systemKey === 'instant'` 찾기)
  - Enter → task 생성 후 input 닫힘
- InlineAdd가 활성화된 상태에서 ESC → 비활성화
- 활성화 상태 관리: 셀 컴포넌트 로컬 state (Zustand 추가 불필요)

**검증 기준**:
- 빌드 통과
- 빈 셀 클릭 → input 표시
- 텍스트 입력 + Enter → task 생성, 해당 셀에 즉시 표시
- 새 task가 의도한 (projectId, agenda) 교차점에 정확히 들어감

---

### C7 — `feat: enable cross-cell highlight on hover`

**충족 R**: R-UX-3

**의존성**: C3a, C4b

**변경 파일** (신규):
- `src/components/views/grid/cells/AgendaMatrixTaskCard.jsx` (매트릭스 전용 wrapper, R-COMP-8 보존)

**변경 내용**:
- 매트릭스 전용 wrapper `AgendaMatrixTaskCard` 신설 (R-COMP-8: `SortableTaskCard` 수정 0건):
  ```jsx
  const AgendaMatrixTaskCard = React.memo(({ task, ...props }) => {
    const isHovered = useStore(s => s.hoveredTaskId === task.id)
    const setHoveredTaskId = useStore(s => s.setHoveredTaskId)
    return (
      <div
        onMouseEnter={() => setHoveredTaskId(task.id)}
        onMouseLeave={() => setHoveredTaskId(null)}
        style={isHovered ? highlightStyle : undefined}
      >
        <SortableTaskCard task={task} {...props} />
      </div>
    )
  })
  ```
- highlightStyle: `HIGHLIGHT.crossCell` 토큰 적용 (bg + outline + text color)
- `useStore` selector로 본인 카드만 re-render 보장

**검증 기준**:
- 빌드 통과
- 동일 task가 3개 셀에 있을 때 한 카드 hover → 3개 모두 강조
- 다른 카드 hover 시 200개 중 ~3-4개만 re-render (React DevTools Profiler 확인)
- 모바일 (hover 이벤트 없음)에서는 강조 비활성 (touch 이벤트로는 setHoveredTaskId 호출 X)

---

### C8 — `feat: enable cell-to-cell drag to add agenda tag (inner-context dispatcher)`

**충족 R**: R-DND-1, R-DND-2, R-DND-3, R-DND-4, R-DND-5, R-DND-7, R-DND-8

**의존성**: C3b (task.agendas 필요), C4b (셀 droppable 마운트)

**변경 파일** (신규):
- `src/components/views/grid/dnd/personalAgendaHandlers.js`

**변경 파일** (수정 — `PersonalTodoShell.jsx`):
- `src/components/views/personal-todo/PersonalTodoShell.jsx`:
  1. import: `import { dispatch as dispatchDrop, registerHandler } from '../../../utils/dnd/dispatcher'`
  2. import: `import { handleAgendaMatrixTaskDrop } from '../grid/dnd/personalAgendaHandlers'`
  3. 모듈 최상단(import 직후): `registerHandler('agenda-matrix-task', handleAgendaMatrixTaskDrop)`
  4. `handleDragEnd` 시작부에 dispatch 호출 추가:
     ```js
     const handleDragEnd = useCallback((e) => {
       const { active, over } = e
       const activeIdStr = String(active?.id || '')
       if (!over) return
       const overId = String(over.id)

       // ═══ NEW: agenda-matrix dispatcher (B2 — inner context) ═══
       const ctx = { tasks, projects, milestones, currentUserId, updateTask, reorderTasks }
       if (dispatchDrop(e, ctx)) return

       // (기존 분기 그대로 유지: bl-task / focus-card / ...)
       ...
     ```
- ⚠ `dispatchDrop`은 외부 UnifiedGridView dispatcher map과 동일 모듈 (`utils/dnd/dispatcher`). `HANDLERS` map은 모듈 스코프 공유 → outer/inner 양쪽에서 같은 등록을 보지만, **type 값으로 분리됨** (`team-matrix-task` ≠ `agenda-matrix-task`). 충돌 없음.

**personalAgendaHandlers.js 본문**:
```js
import { parseCellId, sameCellKey } from '../../../../utils/dnd/cellKeys/personalAgenda'

export function handleAgendaMatrixTaskDrop(e, ctx) {
  const { active, over } = e
  if (!over) return false
  const type = over.data?.current?.type || active.data?.current?.type
  if (type !== 'agenda-matrix-task') return false

  const task = ctx.tasks.find(t => t.id === String(active.id).replace(/^cell-task:/, ''))
  if (!task) return true  // handled but no-op

  const srcCellKey = active.data?.current?.cellKey || parseCellId(String(active.id))
  const dstCellKey = over.data?.current?.cellKey || parseCellId(String(over.id))
  if (!srcCellKey || !dstCellKey) return true

  // 같은 셀 재정렬 → reorderTasks 위임
  if (sameCellKey(srcCellKey, dstCellKey)) {
    // ctx 내 cellTasks 재계산 후 arrayMove → reorderTasks(reordered)
    // (구현 디테일: getCellTasks(ctx.tasks, srcCellKey, ctx) → arrayMove → ctx.reorderTasks)
    return true  // 상세 구현은 diff-plan 단계
  }

  // 다른 셀로 이동 (추가 모드 — D6)
  const patch = {}
  patch.agendas = Array.from(new Set([
    ...(task.agendas || []),
    dstCellKey.agendaType,
  ]))

  // 다른 행이면 keyMilestoneId 변경 (행=key_milestone — R5 우회 불필요)
  if (srcCellKey.msId !== dstCellKey.msId) {
    patch.keyMilestoneId = dstCellKey.msId  // null=inbox
  }

  ctx.updateTask(task.id, patch)
  return true
}
```

**근거 (B2/B3 반영)**:
- `registerHandler`는 **PersonalTodoShell 모듈 import 시점에 등록** → inner DndContext에서 dispatchDrop 호출 시 매칭됨
- `projectId` 변경 *없음* — milestone 행 이동은 keyMilestoneId만 바뀜 → `applyTransitionRules` R5 발동 안 함

**검증 기준**:
- 빌드 통과
- 셀 A → 셀 B 드래그 (같은 행): B의 agendaType이 task.agendas에 추가, A의 태그 유지
- 같은 셀 내 카드 재정렬 → reorderTasks 호출 (sortOrder 갱신)
- 다른 milestone 행 셀로 드래그: `task.keyMilestoneId === 도착 msId`, `task.projectId` 변경 없음(unless 사이드 이펙트 의도), agendas 추가됨
- 회귀: 기존 team-matrix 드래그 정상 동작 (UnifiedGridView outer dispatcher 그대로)
- 회귀: 기존 bl-task / focus-card 드래그 정상 동작 (Shell 분기 그대로)

---

### C8.5 — `feat: enable agenda chip removal (single tag delete)`

**충족 R**: R-UX-4

**의존성**: C4b

**변경 파일**:
- `src/components/views/grid/cells/AgendaMatrixCell.jsx` (수정)

**변경 내용**:
- 셀 내 task 카드 hover 시 우측에 작은 X 버튼 노출
- X 클릭:
  - 그 셀의 agendaType을 `task.agendas`에서 *제거*만
  - `updateTask(task.id, { agendas: task.agendas.filter(a => a !== cellKey.agendaType) })`
- 카드의 4-zone 이벤트 분리 규칙은 그대로 유지 — X 버튼은 5번째 zone(별도 stopPropagation)
- 마지막 남은 agendaType 제거 시: detail panel 또는 confirmation 없이 그대로 진행 (task 자체는 유지, agendas만 빈 배열). 다음 매트릭스 렌더에서 어디에도 표시 안 됨 → 사용자가 detail panel에서 재태깅 가능

**검증 기준**:
- 빌드 통과
- 카드 hover → X 버튼 노출
- X 클릭 → 그 셀에서만 task 사라짐, 다른 셀의 같은 task는 유지
- 마지막 agenda 제거 후 task가 어디에도 안 보임 (detail panel에서 복구 가능)

---

### C9 — `feat: enable row-header drag to reassign milestone (inbox → milestone row)`

**충족 R**: R-DND-6

**의존성**: C8

**변경 파일**:
- `src/components/views/grid/dnd/personalAgendaHandlers.js` (확장 — `handleAgendaMatrixRowDrop` 추가)
- `src/components/views/personal-todo/PersonalTodoShell.jsx` — `registerHandler('agenda-matrix-row', handleAgendaMatrixRowDrop)` 추가 (B2 — inner context)
- `src/components/views/grid/cells/AgendaRowHeader.jsx` (수정) — useDroppable, id=`agenda-row:{msId}`, data: `{ type: 'agenda-matrix-row', msId }`
- `src/components/views/grid/cells/AgendaInboxRow.jsx` (수정) — useDroppable, id=`agenda-row:inbox`, data: `{ type: 'agenda-matrix-row', msId: null }`

**변경 내용**:
- `handleAgendaMatrixRowDrop(e, ctx)`:
  ```js
  const { active, over } = e
  if (!over) return false
  if (over.data?.current?.type !== 'agenda-matrix-row') return false

  const task = ctx.tasks.find(t => t.id === String(active.id).replace(/^cell-task:/, ''))
  if (!task) return true

  const dstMsId = over.data.current.msId  // null = inbox
  if (task.keyMilestoneId === dstMsId) return true  // no-op

  // 행 = key_milestone. projectId는 변경하지 않음 (행 이동만)
  ctx.updateTask(task.id, { keyMilestoneId: dstMsId })
  return true
  ```
- 셀 drop은 C8 핸들러가 처리(우선순위 높음 — `over.data.current.type === 'agenda-matrix-task'`), 행 헤더 drop만 C9 핸들러가 처리.

**검증 기준**:
- 빌드 통과
- inbox row의 task → milestone X 행 헤더 drop → `keyMilestoneId = X.id`, agendas 그대로
- milestone X의 task → milestone Y 행 헤더 drop → `keyMilestoneId = Y.id`, agendas 그대로
- milestone X의 task → inbox row 헤더 drop → `keyMilestoneId = null`, agendas 그대로
- 회귀: 셀 drop은 C8 동작 그대로 / 외부 team-matrix DnD 정상

---

### C10 — `feat: swap PersonalTodoListTable with PersonalAgendaMatrixTable in PersonalTodoShell`

**충족 R**: R-VIEW-1, R-VIEW-2, R-VIEW-3, R-VIEW-4, R-VIEW-5

**의존성**: C4a, C4b, C5, C6, C7, C8, C8.5, C9

**변경 파일** (정확한 실제 경로):
- `src/components/views/personal-todo/PersonalTodoShell.jsx`

**변경 내용** (3 + 0줄 — D3 외과적 교체):

1. import 1줄 교체:
   ```diff
   - import PersonalTodoListTable from './PersonalTodoListTable'
   + import PersonalAgendaMatrixTable from '../grid/PersonalAgendaMatrixTable'
   ```

2. JSX 1줄 교체 (`PersonalTodoShell.jsx:207`):
   ```diff
   - <PersonalTodoListTable
   -   projects={projects}
   -   tasks={tasks}
   -   milestones={milestones}
   - />
   + <PersonalAgendaMatrixTable
   +   projects={projects}
   +   tasks={tasks}
   +   milestones={milestones}
   + />
   ```

3. grid 비율 inline style 수정 (`PersonalTodoShell.jsx:201`):
   ```diff
   - gridTemplateColumns: 'minmax(420px, 1.5fr) minmax(280px, 1fr)',
   + gridTemplateColumns: 'minmax(420px, 2fr) minmax(280px, 1fr)',
   ```

**추가 변경 (C8/C9에서 이미 반영됨, 본 커밋에서는 중복 확인만)**:
- 모듈 최상단의 `registerHandler('agenda-matrix-task', ...)` / `registerHandler('agenda-matrix-row', ...)` 존재 확인
- `handleDragEnd` 시작부의 `if (dispatchDrop(e, ctx)) return` 존재 확인

**그 외 변경 0건**: FocusPanel import, props, FocusColumn, sensors, handleDragEnd 본체(dispatchDrop 이후 분기)

**검증 기준**:
- 빌드 통과
- 사이드바 "할일" 메뉴 클릭 → 매트릭스 정상 마운트
- 우측 FocusPanel 정상 동작 (회귀 없음 — 백로그→포커스 드래그, 포커스 내부 reorder 모두 동작)
- 모든 인터랙션 (C4b~C9) 통합 동작 확인

---

## 3. DELETE-5 후속 PR (별도)

**제목**: `chore: remove PersonalTodoListTable and dead dependencies`

**작성 시점**: C10 머지 + 사용자 검증 + 회귀 안정 (최소 1주) 이후

**삭제 대상 (1차 후보)**:
- `PersonalTodoListTable` 컴포넌트 본체
- 해당 컴포넌트에서만 사용하는 헬퍼 함수 / state

**DELETE-5 적용 체크리스트** (실제 작성 시 채울 표):

| 삭제 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| `PersonalTodoListTable` | (찾기) | C10에서 0건이어야 함 | 기존 prop 전수조사 | 내부 hook/util | TypeScript 없으면 N/A | (대기) |
| 관련 헬퍼 1 | … | … | … | … | … | … |
| 관련 헬퍼 2 | … | … | … | … | … | … |

**잔여 import 검증**:
- `grep -rn 'PersonalTodoListTable' src/` → 0건
- `npm run build` 통과

**작업 규칙**:
- 본 PR은 **순수 삭제만** — 신규 기능 0건
- DELETE-5 표를 PR 본문에 포함
- 한 번에 1개 컴포넌트씩 (R-ATOMIC)

---

## 4. 작업 순서 / 의존성 그래프 (r2 — H3 반영)

```
C1 (DB) ────────────────────► C3b (mapTask + taskToRow)
                                  │
C2 (tokens) ──┬─► C4a (skeleton)  │
              │      │            │
              └──────┴────────────┴─► C4b (cells, agendas 필터)
                                            │
                                            ├─► C5 (inbox row)
                                            │     │
                                            │     ├─► C6 (cell click + add)
                                            │     │
C3a (hoveredTaskId) ──────────────────────────────┼─► C7 (hover highlight)
                                            │     │
                                            │     ├─► C8 (cell↔cell drag)
                                            │     │     │
                                            │     ├─► C8.5 (chip X removal)
                                            │     │
                                            │     └─► C9 (row-header drag)
                                            │           │
                                            └───────────┴─► C10 (swap in Shell)
                                                                 │
                                                                 └─► [후속] DELETE-5 PR
```

**병렬 가능**: C1↔C2↔C3a, C8↔C8.5, 그 외 직렬.

**핵심 의존성 (B2/B3/H3)**:
- C3b → C4b: `task.agendas` 필드 필수
- C2 → C4b: AGENDA chip 색상 토큰 사용
- C8/C9 → C10: 셀/행 핸들러는 C10 swap 적용 *전에* 등록되어 있어야 inner DndContext에서 호출됨

---

## 5. REQ-LOCK 검증 매핑 표

각 R 항목이 어느 커밋에서 충족되는지 사전 매핑. 각 커밋의 diff 문서 작성 시 이 표를 verification table로 복제하여 ✓ 처리.

| R ID | 담당 커밋 | 검증 방법 |
|---|---|---|
| R-DATA-1 | C1 | 마이그레이션 SQL 적용 후 컬럼 확인 |
| R-DATA-2 | C1 | `INSERT ... VALUES(agendas='{bad}')` 시 CHECK violation |
| R-DATA-3 | C1 | `EXPLAIN ANALYZE` 시 GIN 인덱스 활용 확인 |
| R-DATA-4 | C1 | RLS 정책 diff 0줄 (변경 없음) |
| R-DATA-5 | C1 | UPDATE 시 `updated_at` 자동 갱신 확인 |
| R-STORE-1 | C3b | `updateTask` 시그니처 grep — 변경 0건 |
| R-STORE-2 | C3b | DB seed task 조회 시 `task.agendas` 배열 반환 |
| R-STORE-3 | C3b | `addTask({...})` 시 `agendas: []` 자동 |
| R-STORE-4 | C3b | `applyTransitionRules` 함수 본체 diff 0줄 |
| R-STORE-5 | C3a | `useStore.getState().hoveredTaskId` 존재 |
| R-STORE-6 | C7 | React DevTools — hover 시 re-render ~3-4개만 |
| R-TOKEN-1 | C2 | `import { AGENDA } from designTokens` 동작 |
| R-TOKEN-2 | C2 | `HIGHLIGHT.crossCell.bg === '#FAEEDA'` |
| R-TOKEN-3 | C2 | `MATRIX.inboxRowBg === '#FAF8F2'` |
| R-TOKEN-4 | C2,C4~C9 | grep `^const .* = COLOR\.` → 0건 |
| R-TOKEN-5 | C2 | grep `#c4c2ba\|#d3d1c7` → 0건 |
| R-VIEW-1~5 | C10 | `App.jsx`, `Sidebar.jsx` diff 0줄 |
| R-VIEW-6 | (deferred) | `PersonalTodoListTable.jsx` 파일 존재 확인 |
| R-COMP-1~7 | C4a, C4b, C5, C8, C9 | 신규 파일 존재 + import 정상 |
| R-COMP-8 | C4b, C5, C6, C8.5 | 기존 컴포넌트 diff 0줄 |
| R-DND-1~8 | C8, C9 | `PersonalTodoShell.jsx` 모듈 최상단에 `registerHandler('agenda-matrix-task',...)`, `registerHandler('agenda-matrix-row',...)` 2개 등록 확인. `handleDragEnd`에 `dispatchDrop(e, ctx)` 호출 확인 |
| R-UX-1 | C6 | 빈 셀 클릭 → input 표시 (수동) |
| R-UX-2 | C4b | 4-zone 이벤트 수동 검증 |
| R-UX-3 | C7 | hover 시 동일 task 셀 동시 강조 (수동) |
| R-UX-4 | C8.5 | X 버튼 클릭 → 단일 태그 제거 (수동) |
| R-UX-5 | C4b | `is_focus=true` task에 ⭐ 표시 (수동) |
| R-UX-6 | C4b | `category='later'` task에 칩 표시 (수동) |
| R-UX-7 | C4a | 빈 셀 빗금 표시 (수동) |
| R-UX-8 | C4a 또는 C10 | [완료 숨김] 버튼 동작 (수동) |
| R-CONST-1~10 | 전 커밋 | 각 diff 문서 verification 섹션 체크 |

---

## 6. 각 커밋의 diff 문서 양식

각 커밋의 diff 문서는 다음 구조 필수:

```markdown
# Diff: C{N} — {제목}

## REQ-LOCK 요구사항 (해당 커밋 충족 대상)
- R-XXX-N: ...
- R-XXX-N: ...

## str_replace / create_file 목록
1. {파일}: {요약}
2. {파일}: {요약}

## 변경 본문
(str_replace / create_file 블록)

## REQ-LOCK 검증 결과
| R ID | 충족 여부 | 근거 |
|---|---|---|
| R-XXX-N | ✓ | {파일}:{줄} |

## 빌드 / 회귀 검증
- [ ] `npm run build` 통과
- [ ] 기존 뷰 회귀 0건
- [ ] (해당 시) DELETE-5 표 첨부
```

---

## 7. Out of scope (본 spec에서 다루지 않음)

| 항목 | 처리 |
|---|---|
| 모바일 매트릭스 UX | 후속 sub-loop — 별도 mockup 라운드 + spec |
| `PersonalTodoListTable` 실제 삭제 | 별도 PR — DELETE-5 protocol |
| FocusPanel 매트릭스 통합 | 현 spec 외 — `is_focus` 뱃지로만 시각 연동 |
| 검색 / 필터 칩 | 후속 — 사용자 니즈 검증 후 |
| 카테고리 자동 설정 룰 (today/next 자동 판별) | 후속 — 현재 default `today`로만 |

---

**다음 단계**: Claude Code가 본 spec을 입력으로 받아 C1부터 순차 diff 문서 작성 → 검토 → 적용 → 커밋. 각 diff 문서는 §6 양식 준수.
