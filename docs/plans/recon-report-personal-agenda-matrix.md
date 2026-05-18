# Recon Report — 개인 할일 매트릭스 뷰 (프로젝트 × 아젠다)

> 입력 문서: [`recon-personal-agenda-matrix.md`](./recon-personal-agenda-matrix.md)
> 작성: 2026-05-18 / Claude Code (Opus 4.7)
> 산출 단계: Recon (조사) — 코드 수정 0건, DB 마이그레이션 0건

---

## 0. 요약 (Executive Summary)

1. **현재 "개인 매트릭스" 뷰는 이미 존재하지만 실제로는 매트릭스가 아님.** `App.jsx:104` → `UnifiedGridView(initialScope=personal)` → `PersonalMatrixGrid` → `PersonalTodoShell` 의 2컬럼(백로그+포커스 패널) 레이아웃이며, 1차원 카테고리(today/next/backlog) × 프로젝트 그룹핑이다.
2. **팀 매트릭스(`PivotMatrixTable`)는 진짜 2D 피벗(행=프로젝트, 열=멤버)이며 신규 개인 매트릭스의 참고 모델로 적합**하지만, props가 `members`로 하드코딩되어 차원을 일반화하지는 않았다. → 신규 `PersonalAgendaMatrixTable` 신설을 권장한다 (재사용 가능한 하위 컴포넌트 4개 동시 추출).
3. **데이터 모델은 `tasks.agendas text[]` (A안)을 강력히 권장.** `ref_deliverables.assignee_ids text[]` 선례가 있고 `updateTask(id, patch)` 시그니처 불변 규칙 ([CLAUDE.md §3-3](../../CLAUDE.md))과 잘 호환된다. 별도 N:M 테이블(B안)은 RLS 정책 2중화와 polling delta sync에 부담이 크다.
4. **신규 할일 inbox row는 별도 플래그 없이 `keyMilestoneId IS NULL && !done && !deletedAt` 식별로 충분**. 현재 `category='backlog'`와는 명확히 다른 축이므로 충돌 없다.
5. **DnD는 dispatcher 패턴이 잘 정착되어 있어** (`src/utils/dnd/dispatcher.js` + `registerHandler('xxx-task', ...)`), 신규 `agenda-matrix-task / agenda-matrix-row` 핸들러를 추가하는 식으로 R-ATOMIC 분리가 자연스럽다. 단, **R5 규칙(`applyTransitionRules` projectId 변경 시 keyMilestoneId 초기화)** 우회를 위해 patch에 `keyMilestoneId` 명시 보존 필수 — 기존 팀 매트릭스 핸들러가 이미 같은 패턴을 사용한다.
6. **제약 체크리스트 14개 모두 신규 매트릭스에서 위반 없이 충족 가능.** 다만 *Q9 droppable id 명명*과 *Q3 기존 뷰 처분*은 사용자 결정이 필요하다 (§4·§9 참조).

**권장 진행 방향**: A안(text[]) 채택 → §5의 R-ATOMIC 10개 커밋을 거의 그대로 진행. 단, C10 "라우팅" 커밋이 Q3(기존 뷰 토글/대체) 결정에 종속되므로 spec 단계에서 먼저 결정해야 함.

---

## 1. 2.1~2.7 조사 결과

### 2.1 기존 매트릭스 컴포넌트

**(a) 현재 상태**

```
UnifiedGridView (orchestrator, src/components/views/UnifiedGridView.jsx:41)
├─ DndContext (top-level, 단일 인스턴스)
├─ scope='personal' → PersonalMatrixGrid (src/components/views/grid/grids/PersonalMatrixGrid.jsx)
│   └─ isMobile? PersonalMatrixMobileList : PersonalTodoShell
│       └─ PersonalTodoShell.jsx:55 — 2컬럼 grid (백로그 1.5fr | 포커스 1fr)
│           ├─ PersonalTodoListTable (백로그 영역, 카테고리×프로젝트 1D 그룹)
│           └─ FocusPanel (포커스 카드 영역)
└─ scope='team' → TeamMatrixGrid (src/components/views/grid/grids/TeamMatrixGrid.jsx:18)
    └─ PivotMatrixTable (src/components/views/grid/PivotMatrixTable.jsx:61-210)
        ├─ thead: PivotProjectHeaderRow × projects (sticky)
        └─ tbody [project 반복]:
            ├─ PivotProjectHeaderRow (헤더 행)
            ├─ [milestone 반복]
            │   ├─ PivotMilestoneBand (MS 라벨 가로 밴드)
            │   └─ tr → PivotTaskCell × (members + 미배정 col)
            └─ 미분류 MS 동일 구조
```

**책임 한 줄 요약**:
| 컴포넌트 | 책임 |
|---|---|
| `UnifiedGridView` | DndContext 마운트 + scope/view 분기 |
| `PivotMatrixTable` | 팀 매트릭스 테이블 (colgroup, header sticky, MS band) |
| `PivotTaskCell` | 한 셀 안 task 리스트 + SortableContext |
| `PivotProjectHeaderRow` | 프로젝트 행 헤더 (카운트, 접기/펼치기) |
| `PivotMilestoneBand` | 마일스톤 가로 밴드 (colSpan) |
| `DroppableCell` (`shared/`) | 범용 droppable 셀 wrapper |
| `PersonalTodoShell` | 2컬럼(백로그 + 포커스) 레이아웃 (현재 "개인 매트릭스") |

**`matrix-unified-v3.jsx`** 추적: `docs/mockups/matrix-unified-v3.jsx`에 존재. 팀 매트릭스 v3 (행=프로젝트, 클릭 시 접기/펼치기) 디자인 목업으로, 현재 구현과 거의 일치한다. **`PersonalMatrix` 함수도 포함되어 있지만 현재 코드에는 직접 반영되어 있지 않다** (확인 필요 — Spec 단계에서 mockup 파일 재검토 권장).

**(b) 신규 매트릭스에 필요한 변경**

신규 "프로젝트 × 아젠다" 매트릭스는 `PivotMatrixTable`을 직접 재사용하지 못한다. 이유:
1. `members` prop이 열 차원으로 하드코딩되어 있음 (`PivotMatrixTable.jsx:72, 85-99`)
2. `PivotProjectHeaderRow`의 카운트 집계가 팀원별로 특화됨
3. `PivotTaskCell`의 필터 조건이 `assigneeId` 기반 (`PivotTaskCell.jsx:36-43`)

→ **`PersonalAgendaMatrixTable` 신설**, 하지만 다음 4개 하위 컴포넌트는 공통 추출 가능:
- `MatrixShell` (colgroup + header sticky + tbody scroll)
- `MatrixCell` (DroppableCell + SortableContext)
- `MatrixRowHeader` (프로젝트/inbox 행 헤더)
- `MatrixColHeader` (아젠다/멤버 열 헤더)

**(c) 재사용 가능 여부**

| 자원 | 재사용 방식 | 비율 |
|---|---|---|
| `DroppableCell` (`shared/`) | 그대로 | 100% |
| `SortableTaskCard` | 그대로 (셀 내 카드) | 100% |
| `PivotTaskCell` 필터링 로직 | 필터 조건만 교체해서 fork | 70% |
| `PivotMilestoneBand` | MS 평탄화(B안 확정)로 *미사용* | 0% |
| `PivotProjectHeaderRow` 카운트 | 카운트 함수만 외부화하여 재구현 | 30% |
| `DndContext` & dispatcher | `UnifiedGridView` 내부 그대로 | 100% |
| `getCellTasks` (`utils/dnd/cellKeys/teamMatrix.js`) | agenda용 신규 `personalAgenda.js` 작성 | (참조만) |

---

### 2.2 데이터 모델 / DB

**`tasks` 테이블 현재 컬럼** (`supabase/migrations/20260312000000_loop17_team_schema.sql` + 후속 변경 누적):

| # | 컬럼 | 타입 | NULL | 기본값 | 의미 |
|---|---|---|---|---|---|
| 1 | `id` | text | N | (FE 생성) | PK, 프론트엔드 생성 |
| 2 | `text` | text | N | - | 할일 제목 |
| 3 | `done` | boolean | N | false | 완료 여부 |
| 4 | `category` | text | N | 'backlog' | `today` / `next` / `later` / `backlog` |
| 5 | `alarm` | text/jsonb | Y | NULL | 알림 |
| 6 | `scope` | text | N | 'private' | `private` / `team` / `assigned` |
| 7 | `team_id` | uuid | Y | NULL | 팀 ID (개인=NULL) |
| 8 | `assignee_id` | uuid | Y | NULL | 1차 담당자 |
| 9 | `secondary_assignee_id` | uuid | Y | NULL | 2차 담당자 (`20260413_secondary_assignee.sql`) |
| 10 | `created_by` | uuid | Y | NULL | 생성자 |
| 11 | `highlight_color` | text | Y | NULL | 카드 강조색 |
| 12 | `key_milestone_id` | uuid | Y | NULL | KM 참조 |
| 13 | `updated_at` | timestamptz | N | now() | polling 키 |
| 14 | `deleted_at` | timestamptz | Y | NULL | 소프트 삭제 |
| 15 | `deliverable_id` | uuid | Y | NULL | (Loop-26) |
| 16 | `scheduled_date` | date | Y | NULL | 주간 배치 |
| 17 | `is_focus` | boolean | N | false | 포커스 카드 여부 (Loop-45/47) |
| 18 | `focus_sort_order` | integer | N | 0 | 포커스 정렬 |
| (신규) | `agendas` | text[] | N | '{}' | **추가 예정 (A안)** |

**Scope CHECK 제약** (`20260312000000_loop17_team_schema.sql:144-148`):
```sql
CONSTRAINT valid_scope CHECK (
  (scope='private'  AND team_id IS NULL AND assignee_id IS NULL) OR
  (scope='team'     AND team_id IS NOT NULL AND assignee_id IS NULL) OR
  (scope='assigned' AND team_id IS NOT NULL AND assignee_id IS NOT NULL)
)
```

**RLS 정책 예시** (`20260312000001_loop17_hotfix_compat.sql:124-140`):
```sql
CREATE POLICY private_tasks_owner ON tasks FOR ALL
  USING (scope = 'private' AND created_by = auth.uid())
  WITH CHECK (scope = 'private' AND created_by = auth.uid());
```

**마이그레이션 파일 명명 규칙**: `YYYYMMDDNNNNNN_description.sql` (예: `20260425000000_focus_and_instant_project.sql`). 일부 옛 파일은 NNNNNN 없이 `YYYYMMDD_description.sql` 형식 (예: `20260413_secondary_assignee.sql`).
→ **신규 파일 권장 이름**: `20260520000000_personal_agenda_matrix_tasks_agendas.sql` (또는 spec 단계 합의 후 결정)

**`text[]` 사용 선례**: `ref_deliverables.assignee_ids text[]` (`20260315000000_loop26_reference_tables.sql:42`) — Postgres array는 codebase 정착되어 있다.

---

### 2.3 라우팅 / 사이드바

**진입 흐름**:
```
Sidebar.jsx:36-44 (COMMON_VIEWS 배열)
  → 메뉴 클릭 → setView('matrix') 또는 setView('team-matrix') / setView('personal-matrix')
  → useStore.currentView 변경
  → App.jsx:97-108 views 맵 조회
  → 'personal-matrix' → <UnifiedGridView initialView="matrix" initialScope="personal" />
```

**신규 뷰 추가 시 변경 위치**:
| 파일 | 변경 |
|---|---|
| `App.jsx:97-108` | views 맵에 1줄 추가 (또는 기존 `'personal-matrix'`를 신규 컴포넌트로 교체) |
| `Sidebar.jsx:36-44` | 라벨 유지 시 변경 불필요 (Q3 결정에 따라 토글 추가 가능) |

**중요 발견**: `currentView` 명칭이 이미 `'personal-matrix'`이므로 *추가 없이* `App.jsx:104`의 매핑 우변만 바꾸면 신규 뷰가 사이드바 "할일" 메뉴에 그대로 연결된다 (Q3 A안 채택 시).

---

### 2.4 Zustand store

**파일**: `src/hooks/useStore.js` (단일 store)

**핵심 함수 시그니처** (변경 금지 [CLAUDE.md §3-3](../../CLAUDE.md)):
- `updateTask(id, patch)` — `useStore.js:669` (applyTransitionRules 자동 적용)
- `addTask(task)` — `useStore.js:639` (effectiveTeamId 자동 결정)
- `applyTransitionRules(task, patch)` — `useStore.js:36` (pure function, 7 규칙)

**UI 상태 패턴**:
- `currentView`, `detailTask`, `collapseState`, `currentTeamId` 등은 이미 store 최상위에 정의됨
- `collapseState`는 키별 obj (`collapseState.matrix`, `collapseState.matrixMs` 등)
- **`ui.hoveredTaskId` 추가 권장 위치**: 신규 슬라이스가 아니라 store 최상위에 `hoveredTaskId` + `setHoveredTaskId(id)` (기존 `detailTask` 패턴 모방). slice 분리 불필요. 단, **React.memo + selector** 패턴이 강제되어야 한다 (Q8 참조).

**`updateTask` patch에 신규 컬럼 추가 영향**:
- store의 `mapTask`/`loadAll`/`addTask`가 새 `agendas` 필드를 인식하도록 *추가*만 하면 됨 (rename 금지, [CLAUDE.md §3-1](../../CLAUDE.md))
- `applyTransitionRules`는 `agendas` 필드에 영향 없는 한 변경 불필요

---

### 2.5 dnd-kit 사용 현황

**아키텍처**: `src/utils/dnd/dispatcher.js`의 `HANDLERS` map + `registerHandler('type', fn)` + `dispatch(active, over)` 패턴.

**현재 등록 핸들러** (`UnifiedGridView.jsx:23-25`):
- `'team-matrix-task'` → `handleTeamMatrixTaskDrop`
- `'team-matrix-band'` → `handleTeamMatrixBandDrop`
- `'team-matrix-project-header'` → `handleTeamMatrixProjectHeaderDrop`

**droppable id 명명 패턴** (현재):
| 패턴 | 위치 | 사용처 |
|---|---|---|
| `cell-task:{taskId}` | `SortableTaskCard.jsx` | task 카드 자체 |
| `team-cell-sortable:{projectId}:{msId}:{memberId}` | `PivotTaskCell.jsx:46,197` | SortableContext id |
| `team-matrix-band:{projectId}:{msId\|null}` | `PivotMilestoneBand.jsx:23` | MS 가로 밴드 |
| `team-matrix-project-header:{projectId}` | `PivotProjectHeaderRow.jsx:25` | 프로젝트 헤더 |
| `focus-panel:root`, `focus-card:{id}` | `PersonalTodoShell.jsx` | 포커스 패널 |
| `cell:{userId}:{dateISO}` | `ScheduleCell.jsx:110` | 주간 스케줄 |

**`over.data.current.type` enum**: `'team-matrix-task'`, `'team-matrix-band'`, `'team-matrix-project-header'`, `'focus-card'`, `'bl-project'` 등.

**cellKey 구조** (`src/utils/dnd/cellKeys/teamMatrix.js`):
```js
cellKey = { projectId, msId, memberId }
getCellTasks(tasks, cellKey, ctx) // 5단계 필터
```

**R5 규칙 우회** (`teamMatrixHandlers.js:84`):
```javascript
if (srcCellKey.projectId !== dstCellKey.projectId) {
  patch.projectId = dstCellKey.projectId
  patch.keyMilestoneId = dstCellKey.msId  // R5 자동 초기화 방지 (필수)
}
```
→ 신규 매트릭스도 동일 패턴 따라야 한다 (recon §2.5의 메모 정확함).

**신규 명명 규칙 제안**:
- `'agenda-matrix-task'` → 셀 내 task 드래그
- `'agenda-matrix-row'` → inbox/프로젝트 행 헤더 (드래그 destination)
- 셀 SortableContext id: `agenda-cell-sortable:{projectId|'inbox'}:{agendaType}`
- 행 droppable id: `agenda-row:{projectId|'inbox'}`

`type` 값은 dispatcher map의 key이므로 `team-matrix-*`와 충돌하지 않게 prefix를 `agenda-matrix-*`로 분리.

---

### 2.6 백로그 / 카테고리

**`category` enum 값**: `today` / `next` / `later` / `backlog` (전체). `done`은 Loop-31에서 폐지 (`20260317000000_loop31_abolish_category_done.sql`).

**현재 백로그 노출**: `PersonalTodoListTable.jsx:42` — `myTasks.filter(t => t.category === 'backlog')`. 즉 **`category`와 `keyMilestoneId`는 독립 축**이다.

**recon 문서의 "신규 할일 inbox row" 정의**: `keyMilestoneId === null && done === false`.
- 이는 *카테고리와 무관*하므로 기존 백로그 UI(`category === 'backlog'`)와 *데이터 경계가 다르다*. 예: `category='today'` + `keyMilestoneId=null` 인 task는 백로그 탭에는 안 보이지만 신규 inbox row에는 보인다.
- → **별도 플래그 불필요. `keyMilestoneId IS NULL && !done && !deletedAt` 만으로 충분.** (Q2 답)
- 단, *사용자 멘탈모델 충돌*은 있을 수 있다 → spec 단계에서 "백로그" 용어를 "Inbox/신규" 명칭과 분리하거나 통합 결정 필요.

**"지금 할일" 라벨**: `PersonalTodoListTable.jsx`에서 `category === 'today'` 섹션의 한국어 노출명. 신규 매트릭스도 *카테고리 라벨*이 필요하면 동일 용어 유지 ([CLAUDE.md §6 #2](../../CLAUDE.md) 준수).

---

### 2.7 designTokens.js

**현재 export 트리** (`src/styles/designTokens.js`):
```
COLOR (textPrimary/Secondary/Tertiary, border, bgSurface/Hover/Active, divider, danger, accent, todayLine, dropIndicator, dropTargetTint)
FONT (9 scale: 26~9px)
SPACE (viewPadding, contentPadding, cellPadding, gaps)
ROW (heights 36~80)
GANTT (msBarHeight, taskBarHeight, ...)
VIEW_WIDTH (narrow 960 ... full 100%)
CHECKBOX
SIDEBAR (width 220)
PILL { amber, coral }
PIVOT (msSubRowBg, emptyCellColor, ...)
LIST (colWidth, sectionGap)
OPACITY (projectDim 0.65)
isMobileWidth() // util
```

**import 패턴**: 모든 컴포넌트가 ES `import { COLOR, PIVOT, SPACE } from '.../designTokens'` 후 *컴포넌트 함수 내부에서만 참조*. **모듈 레벨 `const X = COLOR.foo` 사용 0건** — Vite TDZ 규칙 100% 준수.

**신규 토큰 추가 위치 제안** (PILL 이후 ~ PIVOT 이전):

```js
AGENDA = {
  jasonWeekly:     { dot: '#FFD700', chipBg: '#FFF9E6', chipText: '#B8A000' },
  planningWeekly:  { dot: '#87CEEB', chipBg: '#E6F2FF', chipText: '#0066CC' },
  decisionNeeded:  { dot: '#FF6B6B', chipBg: '#FFE6E6', chipText: '#CC0000' },
  personal:        { dot: '#A0AEC0', chipBg: '#F7FAFC', chipText: '#2D3748' },
}
HIGHLIGHT = {
  crossCell: {
    bg:      '#FAEEDA',  // amber 50
    outline: '#EF9F27',  // amber 400
    text:    '#633806',  // amber 800
  }
}
// 기존 PIVOT 객체에 1줄 추가 또는 MATRIX 신규 객체:
MATRIX = { inboxRowBg: '#FAF8F2', ...PIVOT }
```

색상 값들이 모두 [CLAUDE.md §6 #5](../../CLAUDE.md) 금지 색상(`#c4c2ba`, `#d3d1c7`)을 사용하지 않는지 확인됨.

---

## 2. Q1~Q10 답변

### Q1. 아젠다 데이터 모델 — **A안 권장 (`tasks.agendas text[]`)**

**(a) 현재 상태**: agendas 컬럼 없음. tasks 테이블은 1:N 관계만 사용 (assignee, milestone).

**(b) A vs B**:
| 항목 | A안 (`text[]`) | B안 (별도 `task_agendas` 테이블) |
|---|---|---|
| RLS | 단일 정책 그대로 | 신규 정책 2개 추가 (select/insert/delete) |
| polling delta | `updated_at` 단일 키 | tasks join 필요 → polling SyncProvider 변경 |
| `updateTask(id, patch)` 호환 | patch에 `agendas: [...]` 그대로 전달 가능 | 별도 `setTaskAgendas(taskId, list)` action 필요 |
| 인덱싱 | GIN index 가능 (`agendas`) | 단순 b-tree |
| 향후 메타데이터 (예: 추가일) | 추가 불가 | 자연스러움 |

**(c) 권장 + 근거**: **A안**. 
- 폴링 sync ([CLAUDE.md §4-3](../../CLAUDE.md))와 호환성이 결정적
- `ref_deliverables.assignee_ids text[]` 선례 존재
- 4개 고정 아젠다는 향후 확장 가능성이 낮고, 메타데이터가 필요하면 그때 B안으로 마이그레이션 가능 (text[] → join table은 SQL `UNNEST + INSERT`로 단순)

**예상 SQL 초안** (§7 참고):
```sql
ALTER TABLE tasks ADD COLUMN agendas text[] NOT NULL DEFAULT '{}';
CREATE INDEX tasks_agendas_gin ON tasks USING GIN (agendas);
ALTER TABLE tasks ADD CONSTRAINT valid_agendas CHECK (
  agendas <@ ARRAY['weekly_jason', 'weekly_planning', 'decision_needed', 'personal']::text[]
);
```

---

### Q2. 신규 할일 Row 식별자 — **별도 플래그 불필요**

**(a)(b)(c)**:
- 현재 `keyMilestoneId === null && done === false && deletedAt === null` 식별로 충분
- 백로그(`category === 'backlog'`)와 데이터 경계가 다르며 충돌 없음 (§2.6)
- `is_inbox` boolean 추가는 동기화 부담 증가만 초래

**주의**: spec 단계에서 *사용자 멘탈모델 정리* — "백로그 탭"과 "신규 할일 row"의 차이를 UI 카피로 명확히.

---

### Q3. 기존 "개인 할일" 뷰 처분 — **사용자 결정 필요 (B안 잠정 권장)**

**(a) 현재 상태**: `PersonalTodoShell`은 사이드바 "할일" (`currentView='personal-matrix'`)에서만 마운트됨. 다른 곳에서 직접 import 없음 (단 1곳에서 사용).

**(b)**:
- A안: 신규 매트릭스가 `'personal-matrix'`를 완전 대체. `PersonalTodoShell`/`PersonalTodoListTable`/`FocusPanel` 등이 dead code화 (삭제는 별도 커밋).
- B안: 토글 (예: 사이드바 "할일" 하위에 [매트릭스 / 리스트] 또는 상단 토글). `currentView` 키 분리 (`'personal-matrix-v2'` 신규 키).

**(c) 권장 + 근거**: **잠정 B안 (토글 병존)**, 단 사용자가 명시 결정해야 함.
- 이유 1: 포커스 패널(`FocusPanel`)이 Loop-45/47에서 도입된 *상대적으로 신규 기능*이며 매트릭스에 그대로 통합되지 않는다 (recon 문서가 포커스 패널을 언급하지 않음).
- 이유 2: 매트릭스가 베타인 동안 리스트 뷰를 fallback으로 유지하면 회귀 위험 최소화.
- 이유 3: 추후 A안 전환은 `App.jsx:104` 1줄 수정만으로 가능.

**Open Question**: 포커스 패널의 운명 — 매트릭스에 통합? 별도 패널 유지? Spec 단계에서 별도 결정.

---

### Q4. 팀 매트릭스 재사용 — **부분 재사용 (하위 컴포넌트 추출 권장)**

**(a)**: `PivotMatrixTable`은 `members` prop으로 열 차원을 *받기는* 하지만, 컴포넌트 본체가 멤버 도메인에 강하게 결합되어 있다 (아바타, 미배정 컬럼, 카운트 집계). prop만 바꿔서 재사용 불가능.

**(b)(c)**:
- 별도 `PersonalAgendaMatrixTable` 신설 (~400~500줄 예상)
- 공통 추출 가능 하위:
  - `DroppableCell` (이미 분리됨, 그대로 재사용)
  - `SortableTaskCard` (그대로)
  - `MatrixCell` (PivotTaskCell의 필터를 콜백으로 외부화한 일반화 버전 — 신설)
  - `MatrixShell` (colgroup + header sticky 추출 — 신설, optional)
- `PivotMilestoneBand`는 MS 평탄화(§1.3) 결정으로 *미사용*

---

### Q5. 카테고리(`category === 'today'`)와 매트릭스 — **A안 (모든 미완료 task)**

**(a)(b)(c)**:
- 현재 `PersonalTodoListTable.jsx:40-42`는 카테고리별로 분리 표시 (today/next/backlog)
- 신규 매트릭스는 **카테고리 축이 아니라 아젠다 축**이므로, 카테고리 필터는 *매트릭스 본체에서 제거*하고 **모든 미완료 task 표시**가 자연스러움
- 단, 헤더에 "카테고리 필터" 칩 추가 옵션 검토 (Q1.1 spec 단계)
- `done` 토글로 완료 task 표시/숨김은 §1.1 헤더에 이미 명시됨

**필터 조건 확정**:
```js
matrixTasks = tasks.filter(t =>
  t.assigneeId === currentUserId &&
  !t.deletedAt &&
  (hideDone ? !t.done : true)
)
```

---

### Q6. Personal scope 필터 — **`assigneeId === me` 사용 (scope 무관)**

**(a)**: `PersonalTodoListTable.jsx:30-36`는 `assigneeId === currentUserId && !done && !deletedAt`로 필터. **scope를 보지 않음** (즉 `scope='assigned'`로 본인에게 할당된 팀 task도 개인 할일에 나타남).

**(b)(c)**: 동일 패턴 유지가 일관성 측면에서 정답. 매트릭스에는 본인이 담당자인 모든 미완료 task가 나타난다 (개인 + 팀 할당). 이는 사용자가 "내가 신경 써야 할 일 = 매트릭스에 보임" 모델과 부합한다.

**메모 "Personal scope blocks assignee/owner changes"**: 매트릭스 셀에서 드래그로 assigneeId 변경 시도 시 차단되어야 한다는 의미. 신규 매트릭스 드래그는 `keyMilestoneId`와 `agendas`만 변경하므로 *해당 제약과 무관*.

---

### Q7. DetailPanel MS 표시 — **이미 구현됨, 추가 불필요**

`DetailPanel.jsx:146-169` — `MilestoneSelector` + 상세 모달 링크 이미 존재. 매트릭스 셀의 task → arrow 클릭 → `openDetail(task)` 만 호출하면 자동 표시.

---

### Q8. 크로스셀 hover 성능 — **selector + React.memo 패턴 필수**

**(a)(b)(c)**:
- 셀 ~36개 × task ~3개 = ~100 카드. `hoveredTaskId`가 store에 있으면 *naive 구현 시 100개 모두 re-render*.
- 권장 구현:
  1. `hoveredTaskId`를 store에 둔다 (앞 §2.4)
  2. 각 task 카드 컴포넌트에서 `const isHovered = useStore(s => s.hoveredTaskId === task.id)` selector 사용 → 본인이 hover 대상이 될 때만 re-render
  3. task 카드를 `React.memo`로 wrap, props 비교 (`task`, `isHovered`)
  4. 컨테이너(셀, 행)는 hoveredTaskId 미참조

이 패턴은 [CLAUDE.md §6 #7](../../CLAUDE.md) "getState() in render 금지"와 정합. 100개 카드 hover 시 동시 강조 대상 카드 ~3-4개만 re-render → 성능 문제 없음.

---

### Q9. 드래그 droppable 설계 — **다음 명명 규칙 권장 (사용자 검토 필요)**

```
type: 'agenda-matrix-task'  // 셀 내 task 드래그
type: 'agenda-matrix-row'   // 행 헤더 drop (cross-row)

cell SortableContext id: `agenda-cell-sortable:{projectId|'inbox'}:{agendaType}`
row droppable id:        `agenda-row:{projectId|'inbox'}`
cell droppable id:       `agenda-cell:{projectId|'inbox'}:{agendaType}`
task draggable id:       `cell-task:{taskId}` (기존 그대로)
```

**중복 우려**: 현재 `team-matrix-*`와 `agenda-matrix-*`로 prefix 분리되므로 충돌 없음. `over.data.current.type` 분기 정상 동작.

**Open Question**: agendaType 값을 영문 식별자로 통일 (`weekly_jason / weekly_planning / decision_needed / personal`) — [CLAUDE.md §6](../../CLAUDE.md) "코드 식별자 영문" 준수. 한국어 라벨은 designTokens.AGENDA에 별도 또는 i18n 모듈에서 정의.

---

### Q10. 빠른 추가 input UX — **`InlineAdd` 재사용 가능**

`InlineAdd.jsx:6-19` — `{ projectId, category, color, extraFields }` props. `extraFields={ agendas: [agendaType], keyMilestoneId: projectId|null }`로 호출 가능. **수정 불필요, 그대로 재사용**.

단, "빈 셀 클릭 → 자동 input 활성화"는 InlineAdd 외부에서 상태 관리 (해당 셀에 input mode 토글) — 매트릭스 셀 컴포넌트의 신규 상태.

---

## 3. 제약사항 체크리스트 결과

| # | 제약 | 신규 매트릭스 준수 가능? | 비고 |
|---|---|---|---|
| 1 | `updateTask(id, patch)` 시그니처 불변 | ✅ | `updateTask(id, { agendas: [...] })` 형태 |
| 2 | `tasks` 기존 컬럼 rename/modify 금지 | ✅ | `agendas` 컬럼만 *추가* |
| 3 | 기존 뷰 컴포넌트(TodayView 등) 내부 수정 금지 | ✅ | 신규 `PersonalAgendaMatrixTable` 등 별도 신설 |
| 4 | OutlinerEditor/OutlinerRow/useOutliner/notes.js 미수정 | ✅ | 매트릭스와 무관 |
| 5 | Left color border 금지 | ✅ | designTokens.AGENDA dot/chip 사용 |
| 6 | Title ellipsis 금지, `white-space: normal + word-break: keep-all` | ✅ | 카드 스타일 신규 작성 시 준수 |
| 7 | Vite TDZ — 모듈 레벨 const 금지 | ✅ | 컴포넌트 내부 import 패턴 유지 |
| 8 | Personal scope assignee 변경 차단 | ✅ | 매트릭스 드래그는 `keyMilestoneId`/`agendas`만 변경 |
| 9 | 카테고리 라벨 "지금 할일" 유지 | ⚠ | 매트릭스에 카테고리 표시 안 하면 무관, spec에서 결정 |
| 10 | 색상 `#c4c2ba`, `#d3d1c7` 금지 (secondary 최소 `#888780`) | ✅ | designTokens 신규 토큰 모두 준수 |
| 11 | D-day badge 미사용 | ✅ | 셀 카드에 미배치 |
| 12 | 4-zone 이벤트 규칙 (title=편집, non-title=drag, checkbox=토글, arrow=detail) | ✅ | `SortableTaskCard` 그대로 재사용 |
| 13 | Highlight 카드 체크박스 흰 배경 | ✅ | 크로스셀 강조 적용 시 체크박스 별도 스타일 |
| 14 | 사이드바 3-section 구조 유지 | ✅ | 사이드바 변경 없음 (Q3 결정 시 토글만 추가) |
| 15 | 코드 식별자 영문 / UX 한국어 | ✅ | `weekly_jason` (DB) ↔ "Jason 위클리" (UI) |

---

## 4. 컴포넌트 트리 (현재 / 신규)

### 현재 (개인 매트릭스 뷰 `currentView='personal-matrix'`)
```
App.jsx:104 → UnifiedGridView(scope=personal)
  └─ PersonalMatrixGrid
      ├─ isMobile? PersonalMatrixMobileList
      └─ PersonalTodoShell
          ├─ PersonalTodoListTable (백로그: today/next/later/backlog × 프로젝트 1D 그룹)
          └─ FocusPanel (포커스 카드 영역)
```

### 신규 (개인 매트릭스 뷰 — A안 [완전 대체] 또는 B안 [토글])
```
App.jsx → UnifiedGridView(scope=personal) [또는 신규 currentView 분기]
  └─ PersonalAgendaMatrixGrid (신규, PersonalMatrixGrid 대체 또는 형제)
      ├─ isMobile? PersonalAgendaMatrixMobileList (신규)
      └─ PersonalAgendaMatrixTable (신규)
          ├─ ColumnHeader × 4 agendas
          ├─ InboxRow (keyMilestoneId IS NULL 행)
          │   └─ MatrixCell × 4 (각 셀: SortableTaskCard 목록 + InlineAdd)
          └─ ProjectRow × N
              └─ MatrixCell × 4 (각 셀: SortableTaskCard 목록 + InlineAdd / 빗금 빈 셀)
```

**기존 코드 보존**: `PersonalTodoShell`, `PersonalTodoListTable`, `FocusPanel` 등은 *수정 없음*. Q3 결정에 따라 routing만 분기.

---

## 5. 재사용 가능 / 신설 필요 컴포넌트

### 재사용 (수정 없음)
- `SortableTaskCard` (`src/components/dnd/SortableTaskCard.jsx`)
- `DroppableCell` (`src/components/views/grid/shared/DroppableCell.jsx`)
- `InlineAdd` (`src/components/shared/InlineAdd.jsx`)
- `DetailPanel` (`src/components/shared/DetailPanel.jsx`)
- `MilestoneSelector` (`src/components/shared/MilestoneSelector.jsx`)
- `dispatcher` (`src/utils/dnd/dispatcher.js`)
- `applyTransitionRules` (`src/hooks/useStore.js:36`)

### 신설
- `PersonalAgendaMatrixGrid.jsx` (`src/components/views/grid/grids/`)
- `PersonalAgendaMatrixTable.jsx` (`src/components/views/grid/`)
- `AgendaMatrixCell.jsx` (`src/components/views/grid/cells/`)
- `AgendaMatrixRow.jsx` (`src/components/views/grid/cells/`)
- `AgendaColHeader.jsx` (`src/components/views/grid/cells/`)
- `InboxRow.jsx` (`src/components/views/grid/cells/`) — `keyMilestoneId IS NULL` 행
- `personalAgendaHandlers.js` (`src/components/views/grid/dnd/`) — drag handlers
- `personalAgenda.js` (`src/utils/dnd/cellKeys/`) — cellKey + getCellTasks
- `PersonalAgendaMatrixMobileList.jsx` (모바일, optional)

### 확장 (추가만, rename 금지)
- `designTokens.js` — `AGENDA`, `HIGHLIGHT.crossCell`, `MATRIX.inboxRowBg` 추가
- `useStore.js` — `hoveredTaskId`, `setHoveredTaskId` 추가 / `mapTask`에 `agendas` 필드 추가
- `App.jsx:97-108` — views 맵에 항목 추가 (Q3 B안) 또는 1줄 교체 (A안)
- `Sidebar.jsx:36-44` — 토글 추가 (Q3 B안 채택 시)

---

## 6. DB 마이그레이션 SQL 초안

**파일**: `supabase/migrations/20260520000000_personal_agenda_matrix_tasks_agendas.sql`

```sql
-- Personal Agenda Matrix: agendas N:M as text[] on tasks
-- A안 (text[] 단일 컬럼) — 폴링 sync 및 updateTask(id, patch) 호환성 우선

BEGIN;

-- 1. agendas 컬럼 추가 (기존 데이터 보호: DEFAULT '{}')
ALTER TABLE tasks
  ADD COLUMN agendas text[] NOT NULL DEFAULT '{}';

-- 2. 값 범위 제약 (CLAUDE.md §3-2: CHECK는 immutable enum 강제)
ALTER TABLE tasks
  ADD CONSTRAINT valid_agendas CHECK (
    agendas <@ ARRAY[
      'weekly_jason',
      'weekly_planning',
      'decision_needed',
      'personal'
    ]::text[]
  );

-- 3. GIN 인덱스 (셀 필터 쿼리 대비)
CREATE INDEX IF NOT EXISTS tasks_agendas_gin
  ON tasks USING GIN (agendas);

-- 4. RLS 정책 변경 불필요 — agendas는 task 본체 컬럼이므로
--    기존 private_tasks_owner / team_tasks_select 정책 그대로 적용됨

-- 5. updated_at 자동 갱신 트리거는 이미 tasks 테이블에 적용되어 있음
--    (polling delta sync 호환)

COMMIT;
```

**rollback 시나리오** (별도 파일 또는 down 마이그레이션 없음 — Supabase 컨벤션):
- 일반: 사용 안 함, 신규 컬럼만 추가는 회귀 없음
- 만약 롤백 필요: `ALTER TABLE tasks DROP COLUMN agendas` (FE에서 unknown column 무시되도록 mapTask가 optional 처리해야 함)

---

## 7. R-ATOMIC 커밋 분할 검토

원안의 10개 커밋은 **대체로 적정**. 다음 조정 제안:

| # | 원안 | 검토 의견 |
|---|---|---|
| C1 | `feat: add agendas column to tasks table` | ✅ 적정. RLS 변경 불필요 (§6) → "RLS 업데이트" 문구 제거 |
| C2 | `feat: add AGENDA and HIGHLIGHT.crossCell design tokens` | ✅ 적정. `MATRIX.inboxRowBg`도 함께 |
| C3 | `feat: add ui.hoveredTaskId state and updateTaskAgendas action` | ⚠ **분리 권장**. `hoveredTaskId`는 UI, `mapTask`/`loadAll`에 `agendas` 필드 인식은 *별도 커밋*으로 |
| C3a | `feat: add hoveredTaskId UI state with selector pattern` | (분리 후 신규) |
| C3b | `feat: extend mapTask/loadAll/addTask to handle agendas field` | (분리 후 신규) C1 종속 |
| C4 | `feat: add PersonalAgendaMatrixTable read-only rendering` | ✅ 적정. **read-only 강조 좋음** — DnD 별도 커밋으로 |
| C5 | `feat: add inbox row to PersonalAgendaMatrixTable` | ✅ 적정 |
| C6 | `feat: enable cell click to create task at intersection` | ✅ 적정 |
| C7 | `feat: enable cross-cell highlight on hover` | ✅ 적정. C3a 종속 |
| C8 | `feat: enable cell-to-cell drag to retag agenda` | ✅ 적정. dispatcher `agenda-matrix-task` 핸들러 |
| C9 | `feat: enable row-to-row drag to reassign project` | ✅ 적정. R5 keyMilestoneId 명시 보존 패턴 적용 |
| C10 | `feat: route personal sidebar to PersonalAgendaMatrixView` | ⚠ **Q3 결정 종속**. A안=교체, B안=토글 추가 |

**추가 제안 커밋** (검토용):
- C11 (옵션): `chore: deprecate PersonalTodoShell from sidebar` (Q3 A안 채택 + 안정 검증 후 별도 PR)
- C12 (옵션): `test: add cellKey filter tests for personalAgenda` (테스트 인프라가 있다면)

각 커밋 빌드 통과 + 회귀 없음 기준은 [CLAUDE.md §5](../../CLAUDE.md) 워크플로우 준수.

---

## 8. 위험 요소 / 모호점

| # | 위험/모호점 | 영향 | 대응 |
|---|---|---|---|
| R1 | 포커스 패널(`FocusPanel`)의 운명 | high | Q3 spec 단계 결정. 매트릭스 통합? 별도 패널? 삭제? |
| R2 | 카테고리(`today/next/backlog`)와 아젠다 동시 존재 시 UX 혼란 | medium | spec 단계: 카테고리 칩 표시 여부, 백로그 탭 별도 유지 여부 결정 |
| R3 | `is_focus` + `agendas`가 모두 있는 task 처리 | medium | 매트릭스 셀에 표시 + 포커스 강조 (별도 시각 요소) — spec 단계 합의 |
| R4 | 모바일 매트릭스 UX | medium | 4열 가로 스크롤 vs 아젠다별 탭 — Spec 단계 결정. 기존 `PersonalMatrixMobileList` 패턴 참고 가능 |
| R5 | `applyTransitionRules` R5 외 다른 규칙과 `agendas` 충돌 | low | R1-R7 전체 검토 필요 (`useStore.js:36-90` 부근) — spec 단계 |
| R6 | 같은 task가 4개 아젠다 모두 태깅 시 표시 위치 | low | 정의된 동작 (모든 셀에 표시) — recon §1.6 명시됨 |
| R7 | InlineAdd가 새 task 생성 시 `scope` 자동 결정 (`addTask`) 영향 | low | `extraFields`에 `agendas` 추가만으로 정상 동작 예상, 실제 테스트 필요 |
| R8 | hoveredTaskId가 모바일에서 의미 없음 (hover 이벤트 없음) | low | 모바일에서 selectedTaskId로 대체 또는 비활성 — spec 단계 |

---

## 9. Open Questions (Spec 단계 추가 결정 필요)

1. **Q3 최종 결정**: 기존 `PersonalTodoShell` 처분 — 토글(B안)인지 완전 대체(A안)인지?
2. **포커스 패널** — 신규 매트릭스와 어떻게 공존? (옵션: 상단 sticky 영역, 별도 사이드패널, 삭제)
3. **카테고리 표시** — 매트릭스 카드에 "지금/다음/나중" 라벨 표시할 것인지? 아니면 매트릭스에서는 카테고리 축 무시?
4. **백로그 탭**의 운명 — 신규 매트릭스의 inbox row가 백로그를 대체하는지, 별도 탭으로 유지하는지?
5. **모바일 매트릭스 UX** — 아젠다별 탭? 4열 가로 스크롤? 기존 `PersonalMatrixMobileList` 패턴 변형?
6. **아젠다 라벨/색상 최종 확정** — designTokens.AGENDA의 색상값 확정 (현재 추측치, 디자이너 확인 필요)
7. **다중 owner** — 같은 task가 여러 아젠다 셀에 보일 때 드래그 동작 (한 셀에서 빼면 그 아젠다만 해제? 전체 해제?)
8. **빈 셀 클릭의 정확한 동작** — InlineAdd 활성화 vs `addTask` 즉시 호출 (placeholder text 입력 후 Enter)?
9. **카테고리 자동 설정** — 신규 매트릭스에서 task 생성 시 default `category` (`today`? `backlog`?)
10. **검색/필터** — 헤더에 검색바 또는 필터 칩 필요한가?

---

## 10. 작업 규칙 준수 확인

- ✅ 코드 변경 0건
- ✅ DB 마이그레이션 실행 0건
- ✅ 모든 발견 사항에 파일:line 인용 또는 "확인 필요" 표시
- ✅ 영문 식별자 그대로 사용 (`PivotTaskCell`, `updateTask`, `keyMilestoneId` 등)
- ✅ 한국어 설명

---

**다음 단계**: 본 Recon Report 기반으로 Opus가 Spec 문서(REQ-LOCK 포맷)를 작성한다. 위 §9 Open Questions에 대한 사용자 결정을 우선 수렴.
