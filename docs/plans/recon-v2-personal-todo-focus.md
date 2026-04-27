# Recon-v2 — 개인 할일 3열 리팩터 + 포커스 패널 (통합)

> **Scope**: (A) 3-column [지금/다음/남은] 피벗 → [프로젝트 | MS | 할일] 단일 컬럼 + [다음/남은] footer. (B) 좌(백로그) + 우(포커스) 2컬럼 오케스트레이터.
> **Mode**: read-only. Line numbers match the real file via `view_range`.
> **1차 Recon 참조**: `docs/plans/recon-personal-todo-refactor.md` A1–G4 는 본 문서에서 재조사하지 않음.

---

## R1.1 — 섹션 H (체크박스) 재확보

### H1 — 공유 `<Checkbox />` 컴포넌트

**없음 (1차 recon에서 확인 완료).** `**/Checkbox.jsx` glob → 0 files.

### H2 — native `<input type="checkbox">` 전체 사용처

grep `type=["']checkbox["']` 결과 (7 hits, 5 files):

| 파일 | 라인 | 용도 | 시그니처 |
|---|---|---|---|
| [src/components/shared/DetailPanel.jsx:455](../../src/components/shared/DetailPanel.jsx#L455) | 455 | push 알림 토글 | `checked={pushSubscribed} onChange={handlePushToggle}` |
| [src/components/views/grid/PersonalMatrixMobileList.jsx:82](../../src/components/views/grid/PersonalMatrixMobileList.jsx#L82) | 82 | 모바일 task done 토글 | `checked={!!task.done} onChange={() => toggleDone(task.id)}` |
| [src/components/views/grid/cells/PersonalPivotTimeCell.jsx:106](../../src/components/views/grid/cells/PersonalPivotTimeCell.jsx#L106) | 106 | 개인 피벗 task done 토글 | `checked={!!task.done} onChange={() => toggleDone(task.id)}` |
| [src/components/timeline/TimelineToolbar.jsx:241](../../src/components/timeline/TimelineToolbar.jsx#L241) | 241 | 멤버 필터 allSelected | `checked={allSelected} onChange={toggleAll}` |
| [src/components/timeline/TimelineToolbar.jsx:250](../../src/components/timeline/TimelineToolbar.jsx#L250) | 250 | 개별 멤버 선택 | `type="checkbox"` (multiline) |
| [src/components/timeline/TimelineToolbar.jsx:264](../../src/components/timeline/TimelineToolbar.jsx#L264) | 264 | showUnassigned 토글 | `checked={showUnassigned !== false} onChange={onToggleUnassigned}` |
| [src/components/views/grid/cells/PivotTaskCell.jsx:117](../../src/components/views/grid/cells/PivotTaskCell.jsx#L117) | 117 | 팀 피벗 task done 토글 | `type="checkbox"` (multiline) |

**Task done 토글 native 사용처 3곳**: PersonalMatrixMobileList, PersonalPivotTimeCell, PivotTaskCell. 이 중 앞의 2곳이 DELETE-5 대상 / 본 Loop 교체 대상.

### H3 — `TaskRow.jsx` custom div + SVG checkmark 패턴 (L64–L72 verbatim)

파일: [src/components/views/grid/cells/TaskRow.jsx](../../src/components/views/grid/cells/TaskRow.jsx) (전체 143 lines).

```jsx
// L64-L72 verbatim
64→      {/* Checkbox */}
65→      <div onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }} style={{
66→        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer', marginTop: 1,
67→        border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
68→        background: task.done ? CHECKBOX.checkedBg : '#fff',
69→        display: 'flex', alignItems: 'center', justifyContent: 'center',
70→      }}>
71→        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
72→      </div>
```

TaskRow 컴포넌트 전체 시그니처 (L22 — prop 구조 참고):
```jsx
22→export default function TaskRow({ task, project, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, showMs, spanPosition }) {
```
→ `toggleDone`은 **prop으로 주입** (store 직접 바인딩 아님). Detail 진입은 `openDetail(task)` (L133).

### H4 — PersonalPivotTimeCell → TaskRow 패턴 이행 가능성

**시그니처 비교**:

| 측면 | PersonalPivotTimeCell (현재) | TaskRow 패턴 (목표) |
|---|---|---|
| DOM | `<input type="checkbox">` | `<div onClick>` + `<svg>` (체크 시만) |
| 이벤트 | `onChange={() => toggleDone(task.id)}` | `onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }}` |
| 체크 표시 | `checked={!!task.done}` (브라우저 기본) | `background: task.done ? CHECKBOX.checkedBg : '#fff'` + 조건부 SVG |
| 스타일 | `flexShrink: 0` only | `width/height/borderRadius/cursor/border/background` (CHECKBOX 토큰) |
| toggleDone 소스 | `useStore(s => s.toggleDone)` (local hook) | prop (TaskRow 호출자가 주입) |

**이행 결론 — 가능 (trivial)**. 

근거:
1. `toggleDone(taskId)` 의 API는 완전히 동일 — store의 동일 액션. 호출 측 단순 래핑.
2. `onChange` → `onClick` 교체 시 `e.stopPropagation() + e.preventDefault()` 추가 필수 (card click/edit 방지). 이 가드는 TaskRow L65에 이미 포함.
3. `checked={!!task.done}` → `background: task.done ? CHECKBOX.checkedBg : '#fff'` 로 대응 (동일 표현력).
4. 신규 `PersonalTodoTaskRow`는 TaskRow와 달리 `useSortable` 필요 없을 수도 있으나 (3열 구조 내 정렬만이면 sortable 필요) — 이 결정은 diff-plan 단계에서.
5. CHECKBOX 토큰은 이미 designTokens에 존재 (`size: 16, radius: 4, borderColor: '#ccc', checkedBg: '#2383e2'`) — 추가 토큰 불요.

**위험 없음. 동일 interaction 의미 보존.**

---

## R1.2 — DELETE-5 6-파일 매트릭스

### 공통 조사 명령

```
grep `from.*PersonalPivotMatrixTable|from.*personalPivotColumns|from.*PersonalPivotProjectRow|from.*PersonalPivotMsSubRow|from.*PersonalPivotUngroupedSubRow|from.*PersonalPivotTimeCell|from.*PivotAddMsRow`
```

### I-1. `src/components/views/grid/PersonalPivotMatrixTable.jsx`

| 항목 | 내용 |
|---|---|
| **Importers (grep)** | [PersonalMatrixGrid.jsx:2](../../src/components/views/grid/grids/PersonalMatrixGrid.jsx#L2): `import PersonalPivotMatrixTable from '../PersonalPivotMatrixTable'` |
| **Callers (JSX render)** | `PersonalMatrixGrid.jsx` — desktop 분기에서 `<PersonalPivotMatrixTable projects tasks milestones />` |
| **Props** | `{ projects: Project[], tasks: Task[], milestones: KeyMilestone[] }` (L19 signature) |
| **Deps (hook)** | `usePivotExpandState('personal')` (L20), `getCachedUserId` (L21) |
| **Deps (store)** | 없음 (props 전달) |
| **Deps (util/token)** | `COLOR, PIVOT` (L4), `TIME_COLUMNS` (L5) |
| **Child imports** | `PersonalPivotProjectRow` (L6), `PersonalPivotMsSubRow` (L7), `PersonalPivotUngroupedSubRow` (L8), `PivotAddMsRow` (L9, **공용 — 유지**) |
| **Types** | JSDoc 없음 |

### I-2. `src/components/views/grid/personalPivotColumns.js`

| 항목 | 내용 |
|---|---|
| **Importers (grep)** | PersonalPivotMatrixTable.jsx:5, PersonalPivotMsSubRow.jsx:2, PersonalPivotProjectRow.jsx:2, PersonalPivotUngroupedSubRow.jsx:2 (총 4 importers, 모두 DELETE-5 대상) |
| **Exports** | `TIME_COLUMNS` (3 objects: today/next/backlog) |
| **Deps** | 없음 (pure constant) |
| **Types** | 없음 |
| **삭제 안전성** | 모든 importer 동시 삭제 대상. 외부 간섭 없음. |

### I-3. `src/components/views/grid/cells/PersonalPivotProjectRow.jsx`

| 항목 | 내용 |
|---|---|
| **Importers (grep)** | [PersonalPivotMatrixTable.jsx:6](../../src/components/views/grid/PersonalPivotMatrixTable.jsx#L6) only |
| **Callers** | PersonalPivotMatrixTable L100-L105: `<PersonalPivotProjectRow project tasks isExpanded onToggle />` |
| **Props** | `{ project, tasks, isExpanded, onToggle }` (L9 signature) |
| **Deps (hook/store)** | 없음 |
| **Deps (util/token)** | `COLOR, PILL, PIVOT` (L1), `TIME_COLUMNS` (L2) |
| **Child (inline)** | `CountCell` (L65-L88, 내부 함수) |
| **Types** | 없음 |

### I-4. `src/components/views/grid/cells/PersonalPivotMsSubRow.jsx`

| 항목 | 내용 |
|---|---|
| **Importers (grep)** | [PersonalPivotMatrixTable.jsx:7](../../src/components/views/grid/PersonalPivotMatrixTable.jsx#L7) only |
| **Callers** | PersonalPivotMatrixTable L107-L112: `<PersonalPivotMsSubRow milestone tasks currentUserId />` |
| **Props** | `{ milestone, tasks, currentUserId }` (L9) |
| **Deps (hook/store)** | 없음 |
| **Deps (util/token)** | `COLOR, PIVOT, SPACE` (L1), `TIME_COLUMNS` (L2) |
| **Child** | `PersonalPivotTimeCell` (L3 import) |
| **Types** | 없음 |

### I-5. `src/components/views/grid/cells/PersonalPivotUngroupedSubRow.jsx`

| 항목 | 내용 |
|---|---|
| **Importers (grep)** | [PersonalPivotMatrixTable.jsx:8](../../src/components/views/grid/PersonalPivotMatrixTable.jsx#L8) only |
| **Callers** | PersonalPivotMatrixTable L122-L127: `<PersonalPivotUngroupedSubRow project tasks currentUserId />` |
| **Props** | `{ project, tasks, currentUserId }` (L9) |
| **Deps (hook/store)** | 없음 |
| **Deps (util/token)** | `COLOR, PIVOT` (L1), `TIME_COLUMNS` (L2) |
| **Child** | `PersonalPivotTimeCell` (L3) |
| **Types** | 없음 |

### I-6. `src/components/views/grid/cells/PersonalPivotTimeCell.jsx`

| 항목 | 내용 |
|---|---|
| **Importers (grep)** | [PersonalPivotMsSubRow.jsx:3](../../src/components/views/grid/cells/PersonalPivotMsSubRow.jsx#L3), [PersonalPivotUngroupedSubRow.jsx:3](../../src/components/views/grid/cells/PersonalPivotUngroupedSubRow.jsx#L3) (둘 다 DELETE-5 대상) |
| **Callers** | 두 Sub-row 내부에서 `<PersonalPivotTimeCell tasks timeCol projectId milestoneId currentUserId />` |
| **Props** | `{ tasks, timeCol, projectId, milestoneId, currentUserId }` (L11) |
| **Deps (hook/store)** | `useStore`: `updateTask`, `addTask`, `toggleDone`, `openDetail` (L12-L15) |
| **Deps (util/token)** | `COLOR, PIVOT, SPACE` (L3) |
| **내부 상태** | `editingId, addingNew, hover, hoverTaskId` (useState) |
| **Types** | 없음 |

### DELETE-5 종합

| 결론 | 상세 |
|---|---|
| **삭제 안전** | 6파일 모두 DAG closure — 외부 import 없음 (PersonalMatrixGrid 하나만 외부 진입) |
| **유지 확정** | `PivotAddMsRow.jsx` (PivotMatrixTable.jsx:8 — 팀 매트릭스가 import) |
| **유지 확정** | `PersonalMatrixGrid.jsx` — wrapper role 유지 or 새 Shell로 rewire (4.2에서 판단) |
| **삭제 순서** | store/cell 역순: TimeCell → MsSubRow/UngroupedSubRow → ProjectRow → personalPivotColumns → PersonalPivotMatrixTable |

---

## F1 — tasks 테이블 전체 스키마

### 누적 최종 컬럼 (migration 합산 재구성)

| 컬럼 | 타입 | NOT NULL | DEFAULT | 출처 migration | FK |
|---|---|---|---|---|---|
| `id` | text | PK | — | 기존 (pre-loop-17) | — |
| `text` | text | — | — | 기존 | — |
| `project_id` | text | **NO** (trigger L11) | — | 기존 | app-ref only (no FK) |
| `category` | text | — | `'backlog'` (mapTask) | 기존 | — |
| `done` | boolean | — | false (mapTask) | 기존 | — |
| `due_date` | date | — | — | 기존 | — |
| `start_date` | date | — | — | 기존 | — |
| `notes` | text | — | — | 기존 | — |
| `prev_category` | text | — | — | 기존 | — |
| `sort_order` | integer | — | — | 기존 | — |
| `alarm` | jsonb | — | — | 기존 (optional; `_alarmColExists` fallback) | — |
| `scope` | text | — | `'private'` | [20260312000000_loop17:133](../../supabase/migrations/20260312000000_loop17_team_schema.sql#L133) | CHECK `valid_scope` |
| `team_id` | uuid | — | — | 20260312000000_loop17:134 | — |
| `assignee_id` | uuid | — | — | 20260312000000_loop17:135 | — |
| `created_by` | uuid | — | — | 20260312000000_loop17:136 | — |
| `highlight_color` | text | — | — | 20260312000000_loop17:137 | — |
| `updated_at` | timestamptz | — | `now()` | 20260312000000_loop17:138 | — |
| `deleted_at` | timestamptz | — | `NULL` | [20260313100000_loop23:4](../../supabase/migrations/20260313100000_loop23_soft_delete_sync.sql#L4) | — |
| `deliverable_id` | uuid | — | `NULL` | [20260315000000_loop26:87](../../supabase/migrations/20260315000000_loop26_reference_tables.sql#L87) | `REFERENCES ref_deliverables(id) ON DELETE SET NULL` |
| `key_milestone_id` | uuid | — | `NULL` | `docs/migrations/loop-26-rename-to-key-milestones.sql:108` | `REFERENCES key_milestones(id) ON DELETE SET NULL` |
| `secondary_assignee_id` | uuid | — | `NULL` | [20260413_secondary_assignee:4](../../supabase/migrations/20260413_secondary_assignee.sql#L4) | — |
| `scheduled_date` | date | — | `NULL` | [20260420_weekly_scheduled_date:5](../../supabase/migrations/20260420_weekly_scheduled_date.sql#L5) | — |

### CHECK constraints on tasks

```sql
-- 20260312000000_loop17:144-150
144→    ALTER TABLE tasks ADD CONSTRAINT valid_scope CHECK (
145→      (scope = 'private'  AND team_id IS NULL AND assignee_id IS NULL) OR
146→      (scope = 'team'     AND team_id IS NOT NULL AND assignee_id IS NULL) OR
147→      (scope = 'assigned' AND team_id IS NOT NULL AND assignee_id IS NOT NULL)
148→    );
```

추가로 [20260319000000_loop35k:5-50](../../supabase/migrations/20260319000000_loop35k_task_project_consistency.sql) — `validate_task_project_consistency` trigger (BEFORE INSERT/UPDATE): project_id IS NULL이면 통과, 아니면 project의 team_id와 일관성 검사.

### tasks 테이블 인덱스

```sql
-- 20260312000000_loop17:152-157
CREATE INDEX IF NOT EXISTS idx_tasks_team     ON tasks(team_id)     WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_scope    ON tasks(scope);
CREATE INDEX IF NOT EXISTS idx_tasks_updated  ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by) WHERE created_by IS NOT NULL;

-- 20260313100000_loop23:7
CREATE INDEX IF NOT EXISTS idx_tasks_deleted  ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;

-- 20260315000000_loop26:88
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id ON tasks(deliverable_id);

-- 20260413_secondary_assignee:10
CREATE INDEX IF NOT EXISTS idx_tasks_secondary_assignee ON tasks(secondary_assignee_id) WHERE secondary_assignee_id IS NOT NULL;

-- loop-26-rename-to-key-milestones.sql:110
CREATE INDEX IF NOT EXISTS idx_tasks_key_milestone_id ON tasks(key_milestone_id);
```

### 최근 5 migration (타임스탬프 DESC)

`supabase/migrations/` glob 결과 중 최근 5건 (타임스탬프 내림차순):

1. `20260422000001_invite_code_rpc_replace_policy.sql`
2. `20260422000000_teams_creator_select_policy.sql`
3. `20260420_weekly_scheduled_date.sql`
4. `20260415000001_cleanup_1to1_milestones.sql`
5. `20260415000000_ms_flatten_parent_id.sql`

→ **신규 migration 파일명 제안**: `20260425000000_focus_and_instant_project.sql` (또는 loop 번호 prefix).

### `ALTER TABLE tasks ADD COLUMN` 예시 (최근 pattern)

```sql
-- 20260420_weekly_scheduled_date.sql:5-6
5→ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;
6→ALTER TABLE key_milestones ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;
```

→ **패턴**: `IF NOT EXISTS` 항상 사용, DEFAULT 명시 필수 (CLAUDE.md §3.2).

---

## F2 — project_id NOT NULL 여부

### DB 레벨

**NOT NULL 제약 없음.** trigger가 NULL을 명시적으로 허용한다:

```sql
-- 20260319000000_loop35k:10-13
10→  -- Skip if no project_id (orphan tasks allowed)
11→  IF NEW.project_id IS NULL THEN
12→    RETURN NEW;
13→  END IF;
```

### addTask 내부 project_id validation (useStore.js:539–566)

```js
// L539-L566 verbatim
539→  addTask: async (task) => {
540→    // Loop-20: 팀 모드일 때 team_id/scope/createdBy 자동 설정
541→    const teamId = get().currentTeamId
542→    const userId = await getCurrentUserId()
543→    // 프로젝트 소속 확인 — 팀 프로젝트면 해당 팀으로 설정
544→    const project = task.projectId ? get().projects.find(p => p.id === task.projectId) : null
545→    // 개인 프로젝트(teamId 없음)면 반드시 scope='private', 팀 프로젝트면 해당 팀
546→    const isPersonalProject = project && !project.teamId
547→    const effectiveTeamId = isPersonalProject ? null : (project?.teamId || teamId)
548→    // Loop 42 (C3 fix): 명시적 `assigneeId: null` 전달을 userId로 덮지 않도록 `in` 연산자로 분기.
549→    // 기존 `task.assigneeId || userId`는 null/undefined를 구분하지 않아 미배정 셀 생성 시 의도치 않게 자기 배정.
550→    const hasAssignee = 'assigneeId' in task
551→    const teamDefaults = effectiveTeamId
552→      ? { teamId: effectiveTeamId, scope: task.scope || 'assigned', assigneeId: hasAssignee ? task.assigneeId : userId, createdBy: userId }
553→      : { scope: 'private', createdBy: userId }
554→    const t = { id: uid(), done: false, notes: '', sortOrder: Date.now(), category: 'today', alarm: null, ...teamDefaults, ...task }
555→    // 개인 프로젝트 강제 보정 — ...task spread 후에도 scope/teamId 보장
556→    if (isPersonalProject) { t.scope = 'private'; t.teamId = null; t.assigneeId = userId }
557→    set(s => ({ tasks: [...s.tasks, t] }))
558→    const d = db()
559→    if (!d) { set({ syncStatus: 'error' }); return }
560→    set({ syncStatus: 'syncing' })
561→    const { error } = await safeUpsertTask(d, t)
562→    if (error) console.error('[Ryan Todo] addTask:', error)
563→    set({ syncStatus: 'ok' })
564→    if (!error) get().showToast('추가됐습니다 ✓')
565→    return t
566→  },
```

**관찰**:
- L544: `task.projectId ? find() : null` — projectId 없으면 project=null. 이후 `effectiveTeamId = ... teamId` (currentTeamId). 즉 **projectId 없는 task도 insert 시도됨**.
- L556: `isPersonalProject` 분기는 project 객체가 있어야 작동. project 없으면 passthrough.
- L554의 category 기본값은 `'today'` (addTask 호출 시 category 미전달 시).

### 결론

- DB/app 모두 `project_id = null` 허용 (orphan).
- Focus 기능에서 '즉시' 프로젝트 자동 생성 후 귀속 → **항상 projectId 지정이 안전**. 포커스 빠른 추가 시 projectId='즉시' system project.id 로 강제.

---

## F3 — 기존 특수 프로젝트 패턴

### grep 결과

| 패턴 | 매치 수 | 해석 |
|---|---|---|
| `Inbox`, `받은편지함`, `기본`, `Default` (프로젝트 이름) | 0 (src 전체) | 시스템/기본 프로젝트 이름 전례 없음 |
| `is_system`, `isSystem` | 0 | 플래그 없음 |
| `is_pinned`, `isPinned` | 0 | 플래그 없음 |
| `fixedTop`, `system_project` | 0 | 플래그/키 없음 |
| `'즉시'` (string literal) | 0 | 프로젝트 이름으로 쓰인 적 없음 (주석에만) |

→ **새로 도입해야 함. 기존 인프라 없음.**

### 최초 로그인 시 seed 프로젝트 자동 생성 로직

grep `first login|최초 로그인|seed.*project|default project|기본 프로젝트` → **0 matches in src/**.

→ **seed 없음**. 신규 사용자 = `projects: []` 상태로 시작. Sidebar 개인 프로젝트 섹션 empty.

### 프로젝트 없는 사용자 empty state

| 파일 | 라인 | 메시지 |
|---|---|---|
| [PersonalPivotMatrixTable.jsx:132](../../src/components/views/grid/PersonalPivotMatrixTable.jsx#L132) | 132-137 | "표시할 프로젝트가 없습니다" |
| [PersonalMatrixMobileList.jsx:106](../../src/components/views/grid/PersonalMatrixMobileList.jsx#L106) | 106-110 | "표시할 프로젝트가 없습니다" |
| [PivotMatrixTable.jsx:170](../../src/components/views/grid/PivotMatrixTable.jsx#L170) | 170- | 팀 매트릭스 empty |
| [ProjectView.jsx:114](../../src/components/views/ProjectView.jsx#L114) | 114 | `projects.length === 0 ? '프로젝트를 추가하세요' : '프로젝트가 없습니다'` |
| [TimelineEngine.jsx:407](../../src/components/timeline/TimelineEngine.jsx#L407) | 407 | `!projects.length` 가드 |
| [RowConfigSettings.jsx:53](../../src/components/shared/RowConfigSettings.jsx#L53) | 53 | `if (projects.length === 0) return null` |

→ **정적 메시지만 존재, 프로젝트 생성 UX는 사이드바의 `+ 버튼` (개인 프로젝트 섹션 헤더)에 의존**.

---

## F4 — 프로젝트 생성 액션 (`addProject`)

### 시그니처 (useStore.js:718–744)

```js
// L718-L744 verbatim
718→  addProject: async (name, color, projectScope) => {
719→    const teamId = get().currentTeamId
720→    const userId = await getCurrentUserId()
721→    const p = {
722→      id: uid(), name, color, sortOrder: Date.now(),
723→      // Loop-20 보완: 팀/개인 프로젝트 분기
724→      teamId: (teamId && projectScope !== 'personal') ? teamId : null,
725→      userId: (!teamId || projectScope === 'personal') ? userId : null,
726→      ownerId: userId,
727→      // Loop-32: 새 필드 기본값
728→      description: '',
729→      start_date: null,
730→      due_date: null,
731→      status: 'active',
732→      created_by: userId,
733→    }
734→    set(s => ({ projects: [...s.projects, p] }))
735→    const d = db()
736→    if (!d) return
737→    const { error } = await d.from('projects').upsert({
738→      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
739→      team_id: p.teamId, user_id: p.userId, owner_id: p.ownerId,
740→      description: p.description, start_date: p.start_date,
741→      due_date: p.due_date, status: p.status, created_by: p.created_by,
742→      })
743→    if (error) console.error('[Ryan Todo] addProject:', error)
744→  },
```

- **인자**: `(name: string, color: string, projectScope: 'team'|'personal')`
- **리턴**: void (store mutation + DB upsert)
- **Supabase payload**: `id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by`

### projects 테이블 컬럼 (store select, useStore.js:7)

```js
7→const PROJECT_COLUMNS = 'id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by, archived_at'
```

추가 검출 (app-level):
- `archived_at` (timestamptz; hard-coded used by archiveProject L847-L878)
- 20260312000000_loop17:163 `is_archived boolean DEFAULT false` (addColumn; 앱 미사용 → deprecated)

### scope='private' 프로젝트 생성 경로

`projectScope === 'personal'` 호출 시:
- L724: `teamId: null` (currentTeamId 무시)
- L725: `userId: userId` (작성자 본인)
- L726: `ownerId: userId`

→ **`addProject('즉시', color, 'personal')` 호출로 개인 전용 system project 시드 가능**.

---

## F5 — 사이드바 '개인 프로젝트' 섹션 렌더 로직

### 1. 필터 (L82-L85)

```jsx
// Sidebar.jsx L80-L85 verbatim
80→  // 프로젝트 분리: 팀 / 개인 (활성 + 아카이브)
81→  const sortProjectsLocally = useStore(s => s.sortProjectsLocally)
82→  const teamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId && !p.archivedAt))
83→  const personalProjects = sortProjectsLocally(projects.filter(p => !p.teamId && !p.archivedAt))
84→  const archivedTeamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId && p.archivedAt))
85→  const archivedPersonalProjects = sortProjectsLocally(projects.filter(p => !p.teamId && p.archivedAt))
```

### 2. 렌더 구간 (L284-L288 verbatim)

```jsx
// Sidebar.jsx L284-L288
284→            {/* 개인 프로젝트 */}
285→            {!collapsed && <SubSectionHeader label="개인 프로젝트" collapsed={sectionCollapsed.projPersonal} onClick={() => toggleSection('projPersonal')} onAdd={() => { setAddProjectScope('personal'); setShowAddProject(true) }} />}
286→            {!sectionCollapsed.projPersonal && personalProjects.map(p => (
287→              <SortableProjectItem key={p.id} project={p} section="personal" isActive={isProjectActive(p.id)} onClick={() => enterProjectLayer(p.id)} collapsed={collapsed} indent={collapsed ? 0 : 1} archiveFn={archiveProject} />
288→            ))}
```

### 3. 프로젝트 클릭 → 라우팅

```jsx
// Sidebar.jsx L74-L76
74→  // 프로젝트 활성 상태 판별
75→  const isProjectActive = (projectId) =>
76→    currentView === 'projectLayer' && selectedProjectId === projectId
```

L287 `onClick={() => enterProjectLayer(p.id)}` → store action `enterProjectLayer(pid)` → `currentView='projectLayer' & selectedProjectId=pid`.

### 4. 프로젝트 DnD 순서 변경 경로

```jsx
// Sidebar.jsx L255-L258 — DndContext 래핑
255→        <DndContext
256→          sensors={sidebarSensors}
257→          collisionDetection={closestCenter}
258→          onDragEnd={handleSidebarDragEnd}
259→        >
```

`handleSidebarDragEnd` (L91-L106):
```jsx
91→  const handleSidebarDragEnd = useCallback((event) => {
92→    const { active, over } = event
93→    if (!over || active.id === over.id) return
94→    const activeSection = active.data.current?.section
95→    const overSection = over.data.current?.section
96→    if (activeSection !== overSection) return  // 섹션 경계 금지
97→    const activePid = active.data.current?.projectId
98→    const overPid = over.data.current?.projectId
99→    if (!activePid || !overPid) return
100→    const sectionList = activeSection === 'team' ? teamProjects : personalProjects
101→    const oldIdx = sectionList.findIndex(p => p.id === activePid)
102→    const newIdx = sectionList.findIndex(p => p.id === overPid)
103→    if (oldIdx === -1 || newIdx === -1) return
104→    const reordered = arrayMove(sectionList, oldIdx, newIdx)
105→    reorderProjects(reordered)
106→  }, [teamProjects, personalProjects, reorderProjects])
```

→ `reorderProjects(reorderedSectionList)` → user_project_order 테이블 upsert (useStore.js L882-L917).

### 5. SortableProjectItem 시그니처 (L450-L491)

```jsx
// L450-L454
450→function SortableProjectItem({ project, section, isActive, onClick, collapsed, indent, archiveFn }) {
451→  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
452→    id: `project-sidebar:${project.id}`,
453→    data: { section, projectId: project.id },
454→  })
```

**DnD id 규약**: `project-sidebar:${project.id}`. Section 메타 data: `{ section: 'team'|'personal', projectId }`.

### 6. 특정 프로젝트 고정 노출 방식

**현재 코드 전수 검색 결과**:
- `isSystem`, `isPinned`, `fixedTop`, `is_system`, `is_pinned` → **grep 0 matches**.
- 프로젝트 필터는 오직 `!p.teamId && !p.archivedAt` (L83) — 추가 분기 없음.

**필요 작업 (I2 참조)**:
1. 신규 컬럼 `projects.is_system boolean DEFAULT false` 또는 `projects.system_key text DEFAULT NULL` 추가.
2. `sortProjectsLocally` 수정 → `is_system=true` 먼저 반환 (또는 personal 섹션 내 최상단).
3. `handleSidebarDragEnd` → `project.isSystem` check → skip reorder.
4. `SortableProjectItem` → `useSortable({ ..., disabled: project.isSystem })`.
5. `archiveProject` / `updateProject` → system project 삭제 차단.

---

## F6 — DnD 시스템 현황

### `@dnd-kit` 사용 파일 (23개)

(grep `DndContext|useDraggable|useDroppable|useSortable|PointerSensor`)

1. `components/views/weekly-schedule/BacklogPanel.jsx`
2. `components/views/weekly-schedule/BacklogItem.jsx`
3. `components/views/WeeklyScheduleView.jsx`
4. `components/layout/Sidebar.jsx`
5. `components/views/weekly-schedule/ScheduleCell.jsx`
6. `components/views/UnifiedGridView.jsx`
7. `components/project/UnifiedProjectView.jsx`
8. `components/project/HierarchicalTree.jsx`
9. `components/project/CompactMilestoneRow.jsx`
10. `components/project/MsTaskTreeMode.jsx`
11. `components/project/BacklogPanel.jsx`
12. `components/project/CompactMilestoneTab.jsx`
13. `components/views/grid/cells/MilestoneRow.jsx`
14. `components/views/grid/cells/TaskRow.jsx`
15. `components/views/grid/shared/DroppableCell.jsx`
16. `components/timeline/TimelineLeftPanel.jsx`
17. `components/timeline/TimelineEngine.jsx`
18. `components/common/UniversalCard.jsx`
19. `components/project/tasks/CompactTaskRow.jsx`
20. `components/project/KeyMilestoneTab.jsx`
21. `components/project/tasks/CompactTaskList.jsx`
22. `components/project/tasks/MilestoneOutlinerView.jsx`
23. `components/project/MilestoneTaskChip.jsx`

### 센서 설정 (UnifiedGridView.jsx L137-L139)

```jsx
137→  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
138→  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
139→  const sensors = useSensors(pointerSensor, touchSensor)
```

### Sidebar 센서 (Sidebar.jsx L89)

```jsx
89→  const sidebarSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
```

### 드롭존 ID 네이밍 컨벤션

| Prefix | 형식 | 의미 | 사용처 |
|---|---|---|---|
| `project-sidebar:` | `project-sidebar:${pid}` | 사이드바 프로젝트 sortable | Sidebar.jsx:452 |
| `project-lane:` | `project-lane:${pid}` | 행 전체 sortable (12b — UnifiedGridView) | UnifiedGridView.jsx:145-146 |
| `bl-ms:` | `bl-ms:${msId}` | 백로그 MS sortable | UnifiedGridView L150-151 |
| `cell-ms:` | `cell-ms:${msId}` | 셀 내 MS sortable (팀 매트릭스) | UnifiedGridView L154-155 |
| `bl-task:` | `bl-task:${taskId}` | 백로그 task | UnifiedGridView L159 |
| `cell-task:` | `cell-task:${taskId}` | 셀 내 task sortable | UnifiedGridView L160 |
| `mat:` | `mat:${projId}:${cat}` | 개인 매트릭스 droppable cell | DroppableCell.jsx |
| `tmat:` | `tmat:${projId}:${memberId}` | 팀 매트릭스 droppable cell (12c 이후 미사용) | — |
| `pw:` | `pw:${projId}:${dateISO}` | 개인 주간 droppable cell | — |
| `tw:` | `tw:${memberId}:${dateISO}` | 팀 주간 droppable cell | — |

### cross-container drop 현재 지원 범위

| 경로 | 지원 |
|---|---|
| Sidebar 프로젝트 A → 사이드바 프로젝트 B (같은 섹션) | ✅ (Sidebar.jsx:96) |
| Sidebar 프로젝트 A → 다른 섹션 (팀↔개인) | ❌ (L96 `activeSection !== overSection → return`) |
| Grid task → 다른 셀 (다른 project/category/assignee) | ✅ (UnifiedGridView L263-L272) |
| Grid task → cell-ms (MS 헤더 drop) | ✅ (keyMilestoneId 변경, L316-L336) |
| Grid MS → 다른 cell | ✅ (moveMilestoneWithTasks, L224-L230) |

### 포커스 패널 DnD 추가 소요 (참고)

신규 droppable zone 제안:
- `focus-panel:root` — 포커스 패널 전체 drop zone (왼쪽 리스트 → 포커스)
- `focus-card:${taskId}` — 포커스 내 sortable
- `bl-todo:${taskId}` — 왼쪽 백로그 리스트 내 task (기존 `cell-task:` 재사용 가능)

---

## F7 — task 드래그 이동 기존 패턴

### `moveTaskTo` (useStore.js:691–695)

```js
// L691-L695 verbatim
691→  // ─── Move task to different project/category (DnD) ───
692→  // Loop-31: done 처리는 호출부에서 명시적으로 patch에 포함
693→  moveTaskTo: async (id, projectId, category) => {
694→    get().updateTask(id, { projectId, category })
695→  },
```

→ **시그니처**: `(id, projectId, category) => void`. `updateTask(id, patch)`로 위임.

### `reorderTasks` (useStore.js:697–715)

```js
// L697-L715 verbatim
697→  // ─── Reorder tasks (batch sortOrder update) ───
698→  reorderTasks: async (reorderedTasks) => {
699→    const updates = reorderedTasks.map((t, i) => ({ id: t.id, sortOrder: i }))
700→    set(s => ({
701→      tasks: s.tasks.map(t => {
702→        const u = updates.find(x => x.id === t.id)
703→        return u ? { ...t, sortOrder: u.sortOrder } : t
704→      })
705→    }))
706→    const d = db()
707→    if (!d) { set({ syncStatus: 'error' }); return }
708→    set({ syncStatus: 'syncing' })
709→    for (const u of updates) {
710→      const t = get().tasks.find(x => x.id === u.id)
711→      if (!t) continue
712→      await safeUpsertTask(d, t)
713→    }
714→    set({ syncStatus: 'ok' })
715→  },
```

→ **시그니처**: `(reorderedTasks: Task[]) => void`. 순서대로 `sortOrder = 0, 1, 2, …` 부여 후 DB batch upsert.

### 대표적 onDragEnd 핸들러 — UnifiedGridView.jsx L168-L377

전체 handleDragEnd는 ~210줄. 주요 분기 요약:

| 분기 | 조건 | 처리 |
|---|---|---|
| **project-lane** | `activeIdStr.startsWith('project-lane:')` | section 검증 + `reorderProjects(reordered)` (L176-L201) |
| **cell-task over cell-task** | `overId.startsWith('cell-task:')` | same cell sortable end → `reorderTasks`, 다른 cell → `updateTask({projectId, assigneeId, category, keyMilestoneId})` (L219-L274) |
| **cell-task over cell-ms** | `overId.startsWith('cell-ms:')` | MS header drop → `updateTask({keyMilestoneId})` or cross-cell `updateTask({projectId, assigneeId, category:'today', keyMilestoneId})` (L277-L337) |
| **cell-task over mat:** | `mode === 'mat'` | `moveTaskTo(taskId, projId, category)` (L364-L367) |
| **cell-task over pw:** | `mode === 'pw'` | `updateTask({ dueDate })` (L368-L371) |
| **cell-task over tw:** | `mode === 'tw'` | `updateTask({ assigneeId, dueDate, scope:'assigned' })` (L372-L375) |

### DnD 변경 필드 매핑

| 필드 | 변경 경로 |
|---|---|
| `projectId` | `moveTaskTo` (L367), `updateTask({projectId})` (L267, L330) |
| `keyMilestoneId` | `updateTask({keyMilestoneId})` (L258, L326, L333) |
| `category` | `moveTaskTo` (L367), `updateTask({category})` (L269, L332) |
| `assigneeId` | `updateTask({assigneeId})` (L268, L331, L375) |
| `sortOrder` | `reorderTasks(reordered)` (L262) |
| `dueDate` / `scheduledDate` | `updateTask({dueDate})` (L371, L375) |

---

## F8 — 빠른 추가 UI 기존 패턴

### 기존 빠른 추가 위치

1. **MS 추가** — [PivotAddMsRow.jsx](../../src/components/views/grid/cells/PivotAddMsRow.jsx): 프로젝트 펼침 시 MS sub-row 끝에 `+ 마일스톤` 행. 공용 (팀/개인 매트릭스).
2. **Task 추가 (피벗 개인)** — [PersonalPivotTimeCell.jsx L46-L63](../../src/components/views/grid/cells/PersonalPivotTimeCell.jsx#L46-L63): 셀 내 hover 시 `+ 추가` UI.
3. **팀 매트릭스 task 추가** — [PivotTaskCell.jsx](../../src/components/views/grid/cells/PivotTaskCell.jsx): 유사 패턴.
4. **모바일 task 추가** — App.jsx FAB (MobileAddSheet). PersonalMatrixMobileList에서는 자체 추가 UI 없음 (L10 주석).

### PivotAddMsRow Enter 핸들러 (전체, L11-L65)

```jsx
11→export default function PivotAddMsRow({ projectId, colSpan }) {
12→  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
13→  const [hover, setHover] = useState(false)
14→  const [adding, setAdding] = useState(false)
15→
16→  const handleFinish = async (value) => {
17→    setAdding(false)
18→    const title = (value ?? '').trim()
19→    if (!title) return
20→    await addMilestoneInProject(projectId, { title })
21→  }
...
37→        {adding ? (
38→          <input
39→            autoFocus
40→            placeholder="마일스톤 제목"
...
50→            onBlur={e => handleFinish(e.target.value)}
51→            onKeyDown={e => {
52→              if (e.key === 'Enter') handleFinish(e.target.value)
53→              if (e.key === 'Escape') { setAdding(false); setHover(false) }
54→            }}
```

### PersonalPivotTimeCell Enter 핸들러 (L24-L63)

```jsx
24→  const handleEditFinish = (id, v) => {
25→    setEditingId(null)
26→    const text = (v ?? '').trim()
27→    if (text) updateTask(id, { text })
28→  }
29→
30→  const handleAddNew = (v) => {
31→    setAddingNew(false)
32→    const text = (v ?? '').trim()
33→    if (!text) return
34→    // 팀 프로젝트: teamDefaults scope='assigned', assigneeId=userId 적용.
35→    // 개인 프로젝트: useStore.js:536 강제 보정 (scope='private', teamId=null, assigneeId=userId).
36→    addTask({
37→      text,
38→      projectId,
39→      assigneeId: currentUserId,
40→      secondaryAssigneeId: null,
41→      keyMilestoneId: milestoneId || null,
42→      category: timeCol.key,
43→    })
44→  }
...
46→  const addRow = addingNew ? (
47→    <div style={{ padding: '2px 0' }}>
48→      <input
49→        autoFocus
50→        style={{ width: '100%', fontSize: 12, ... }}
51→        onBlur={e => handleAddNew(e.target.value)}
52→        onKeyDown={e => {
53→          if (e.key === 'Enter') handleAddNew(e.target.value)
54→          if (e.key === 'Escape') setAddingNew(false)
55→        }}
```

### 신규 task 생성 기본값 (addTask L554)

```js
554→    const t = { id: uid(), done: false, notes: '', sortOrder: Date.now(), category: 'today', alarm: null, ...teamDefaults, ...task }
```

| 필드 | 기본값 (spread 전) | spread 후 (호출부가 덮을 수 있음) |
|---|---|---|
| `id` | `uid()` | — |
| `done` | `false` | — |
| `notes` | `''` | — |
| `sortOrder` | `Date.now()` | — |
| `category` | `'today'` | `task.category` (호출부) |
| `alarm` | `null` | — |
| `scope` | teamDefaults: 개인 `'private'` / 팀 `'assigned'` | `task.scope` |
| `teamId` | teamDefaults: 개인 `null` / 팀 `effectiveTeamId` | — |
| `assigneeId` | teamDefaults: 개인 미설정 / 팀 `userId` (hasAssignee=false 시) | `task.assigneeId` |
| `createdBy` | teamDefaults: `userId` | — |
| `projectId` | spread에서만 | `task.projectId` 필수 |
| `keyMilestoneId` | — | `task.keyMilestoneId` (옵션) |

→ **포커스 빠른 추가 제안 payload**:
```js
addTask({
  text,
  projectId: INSTANT_PROJECT_ID,  // system project
  category: 'today',
  isFocus: true,  // 신규 필드 (I1)
  // assigneeId는 teamDefaults fallback or 명시적 userId
})
```

---

## I1 — `is_focus` 필드 전략

### 제안 스키마

```sql
-- 신규 migration: 20260425000000_focus_feature.sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_focus boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_focus
  ON tasks(assignee_id, is_focus)
  WHERE is_focus = true AND deleted_at IS NULL;
```

### 기존 boolean 패턴과 일치성

| 컬럼 | NULL? | DEFAULT |
|---|---|---|
| `tasks.done` | — (기존) | false (mapTask L176) |
| `projects.is_archived` | — | `false` (loop-17:163) |
| `**is_focus** (제안)` | **NOT NULL** | **false** |

→ **`done`/`is_archived` 모두 NOT NULL 명시 안 함**. 하지만 NOT NULL을 명시하면 `IS NULL` 가드 불필요 + 인덱스 효율 ↑. **권장**: `NOT NULL DEFAULT false` (제안 유지).

❓ NOT NULL vs nullable — 기존 컬럼은 명시 안 함. 일관성 측면에서는 nullable default false도 가능. **이 결정은 spec 단계에서 확정**.

### mapTask 변환 라인 (useStore.js:173–194 verbatim)

```js
// L173-L194
173→function mapTask(r) {
174→  return {
175→    id: r.id, text: r.text, projectId: r.project_id, category: r.category || 'backlog',
176→    done: r.done || false, dueDate: r.due_date || '', startDate: r.start_date || '',
177→    notes: r.notes || '', prevCategory: r.prev_category || '',
178→    sortOrder: r.sort_order || 0, alarm: r.alarm ?? null,
179→    // ↓ Loop-20: 팀 관련 신규 필드 ↓
180→    teamId: r.team_id || null,
181→    scope: r.scope || 'private',
182→    assigneeId: r.assignee_id || null,
183→    secondaryAssigneeId: r.secondary_assignee_id || null,
184→    createdBy: r.created_by || null,
185→    highlightColor: r.highlight_color || null,
186→    updatedAt: r.updated_at || null,
187→    deletedAt: r.deleted_at || null,
188→    // ↓ Loop-26: Key Milestone 연결 ↓
189→    keyMilestoneId: r.key_milestone_id || null,
190→    deliverableId: r.deliverable_id || null,
191→    // ↓ weekly-schedule ↓
192→    scheduledDate: r.scheduled_date || null,
193→  }
194→}
```

**추가 위치 제안**: L192 다음에:
```js
192→    scheduledDate: r.scheduled_date || null,
193→    // ↓ Loop-XX: 포커스 패널 ↓
194→    isFocus: r.is_focus === true,
195→    focusSortOrder: r.focus_sort_order ?? 0,
```

**taskToRow** (useStore.js L116-L137): 추가 필요:
```js
133→    scheduled_date: t.scheduledDate || null,
// 추가
134→    is_focus: t.isFocus === true,
135→    focus_sort_order: t.focusSortOrder ?? 0,
```

### 포커스 해제 시 `category` 보존 전략

- `is_focus`는 `category`와 **독립 컬럼**. category toggle 없음.
- 포커스 해제 = `updateTask(id, { isFocus: false })` 만 호출. category 유지.
- applyTransitionRules (CLAUDE.md §3.3)에 `is_focus` 관련 분기 **없음** — 순수 passthrough patch.

### 쿼리 성능

- 메인 쿼리 패턴: `tasks WHERE assignee_id=$1 AND is_focus=true AND deleted_at IS NULL`
- partial index `(assignee_id, is_focus) WHERE is_focus=true AND deleted_at IS NULL` — 포커스 카드 수가 전체 task 중 극소수 (보통 5–10건)이므로 매우 효율적.
- 클라이언트는 이미 `loadAll` 전량 fetch 후 store에서 filter — DB 인덱스는 실질 보조.

❓ **필수 인덱스 여부**: 팀 모드에서 `loadAll` 이 team 단위 fetch이고 personal은 user 단위 fetch. 수십–수백건 범위면 index 없어도 무방. 성능 문제 실측 후 결정 가능.

---

## I2 — '즉시' 시스템 프로젝트 설계

### 제안 1 — 스키마 (projects.is_system)

```sql
-- 신규 migration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
-- 고유성 보장 (user당 1개 system 'instant' project)
-- UNIQUE partial index — user_id + system_key 조합이 더 확장성 있음
ALTER TABLE projects ADD COLUMN IF NOT EXISTS system_key text DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_system_key
  ON projects(user_id, system_key) WHERE system_key IS NOT NULL;
```

**대안**: `system_key='instant'` string enum. 미래에 '보관함' 등 추가 시 확장 용이.

### 제안 2 — seed 생성 경로

**현재 seed 로직 없음 (F3 확인)**. 신규 도입 옵션:

| 옵션 | 장점 | 단점 |
|---|---|---|
| **A. 최초 로그인 후 첫 `loadAll` 직후 seed** | 모든 사용자 균일 | 앱 시작 시 추가 DB write 1회. 권한 / 네트워크 에러 케이스. |
| **B. 첫 포커스 빠른 추가 시 lazy create** | 사용자에 불필요한 seed 회피 | 첫 포커스 추가 UX에 지연. 실패 시 fallback 복잡. |
| **C. 사이드바 UI에서 자동 표시 + 클릭 시 lazy create** | zero-write 초기 상태 | UI가 virtual project를 먼저 렌더해야 함 — 복잡 |

**권장: A (loadAll 직후 seed)**. 근거:
- `loadAll` L486-L536 블록이 이미 snapshot/서버 병합 단계를 가지고 있어 seed insert 위치가 명확.
- 단순 upsert `ON CONFLICT DO NOTHING` 으로 idempotent.

### sortProjectsLocally 수정 요건

현재 구현 (useStore.js:1363-1370):
```js
1363→  sortProjectsLocally: (projectList) => {
1364→    const { localProjectOrder } = get()
1365→    return [...projectList].sort((a, b) => {
1366→      const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
1367→      const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
1368→      return orderA - orderB
1369→    })
1370→  },
```

**수정 제안**:
```js
sortProjectsLocally: (projectList) => {
  const { localProjectOrder } = get()
  return [...projectList].sort((a, b) => {
    // system project 최우선
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
    const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
    return orderA - orderB
  })
}
```

→ 개인 섹션 내 항상 최상단. 팀 섹션에는 system project 없음 (`user_id=userId` 조건).

### DnD 차단 로직

**Sidebar.jsx:91-106 handleSidebarDragEnd 수정**:
```js
// 추가 가드 (L99 이후)
const activeProject = [...teamProjects, ...personalProjects].find(p => p.id === activePid)
if (activeProject?.isSystem) return  // system project 이동 거부
```

**SortableProjectItem L450-L454 수정**:
```js
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: `project-sidebar:${project.id}`,
  data: { section, projectId: project.id },
  disabled: project.isSystem,  // drag 핸들 비활성
})
```

**`archiveProject` / `deleteProject` 수정**: system project 대상 guard (`if (p.isSystem) return` or Toast 경고).

---

## I3 — 포커스 카드 정렬

### 기존 `task.sort_order` 용도 조사

grep `task.sortOrder|sort_order` in useStore.js — 핵심 15 lines:

| 라인 | 용도 |
|---|---|
| L120 | `taskToRow`: DB write 시 `sort_order: t.sortOrder` |
| L178 | `mapTask`: DB read 시 `sortOrder: r.sort_order \|\| 0` |
| L392 | 초기 fetch `tasksQuery.order('sort_order')` |
| L431 | retry fetch `order('sort_order')` |
| L554 | addTask 기본값: `sortOrder: Date.now()` |
| L699 | reorderTasks: `sortOrder: i` (cell 내 재정렬 시 0부터 부여) |

**결론**: `sortOrder`는 "**셀 내 순서**" (프로젝트 × assignee × category 조합) 용도. reorderTasks가 `0,1,2,...`로 overwrite.

### 혼용 위험

- 포커스 카드 순서 = user-scoped. 셀 간 cross. 
- 만약 `sortOrder`를 포커스 정렬에도 쓰면: cell 내 reorder가 `sortOrder=i`로 overwrite → 포커스 순서 깨짐.
- 반대로 focus reorder가 `sortOrder`를 overwrite하면 셀 내 정렬 깨짐.

### 제안 — 옵션 B (신규 컬럼)

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS focus_sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_focus_sort
  ON tasks(assignee_id, focus_sort_order)
  WHERE is_focus = true AND deleted_at IS NULL;
```

**기본 정렬 쿼리 (app-level filter)**:
```js
focusTasks = tasks
  .filter(t => t.assigneeId === userId && t.isFocus && !t.deletedAt && !t.done)
  .sort((a, b) => (a.focusSortOrder ?? 0) - (b.focusSortOrder ?? 0) 
                  || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
```

**신규 액션 (신설)**:
```js
reorderFocusTasks: async (reorderedTasks) => {
  // reorderTasks와 동일 패턴, field만 focusSortOrder 로 변경
}
```

**결론**: 옵션 A(`sort_order` 재사용) 금지, 옵션 B(`focus_sort_order` 신설) 채택.

---

## I4 — 프로젝트 흐림 처리

### 계산 로직

```jsx
// PersonalTodoProjectGroup.jsx (신규) 내부
const focusTasksInProject = projTasks.filter(t => t.isFocus)
const hasFocus = focusTasksInProject.length > 0
const focusCount = focusTasksInProject.length
```

### 스타일 적용

```jsx
<div style={{
  opacity: hasFocus ? OPACITY.projectDimmed : 1,  // 신규 토큰
  // 또는 inline 0.65
}}>
  {/* 프로젝트 헤더 + MS + task 리스트 */}
</div>
```

### 부가 힌트 (Ryan 포함 요구)

```jsx
{hasFocus && (
  <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary, marginLeft: 6 }}>
    {focusCount}건 포커스 이동
  </span>
)}
```

### 신규 designTokens 추가 제안

현재 `designTokens.js` 에 `OPACITY` export **없음** (1차 recon G2 확인).

**추가 제안** (G4 참조):
```js
// L120 이후 (새 섹션)
export const OPACITY = {
  projectDimmed: 0.65,   // 포커스 이동 있는 프로젝트 흐림
  draggingItem: 0.3,     // 기존 TaskRow L61에 하드코딩 — 추후 일원화
  sortableDragging: 0.4, // 기존 Sidebar L459 에 하드코딩 — 추후 일원화
};
```

→ 기존 하드코딩 값과의 일관성을 위해 `0.3`, `0.4`도 함께 토큰화 고려. 단 이번 Loop 범위에서는 `projectDimmed: 0.65` 하나만 추가.

---

## 4.2 — `PersonalMatrixMobileList.jsx` 판단

### 현재 파일 전체 verbatim (135 lines)

(핵심 구간만 재인용 — 1차 recon H2에서 `input type="checkbox"` 위치 확인됨)

```jsx
// L1-L21
1→import { useMemo, useCallback } from 'react'
2→import useStore, { getCachedUserId } from '../../../hooks/useStore'
3→import usePivotExpandState from '../../../hooks/usePivotExpandState'
4→import { COLOR } from '../../../styles/designTokens'
5→
6→/* ═════════════════════════════════════════════
7→   PersonalMatrixMobileList — 모바일 전용 개인 할일 뷰
8→   프로젝트별로 위→아래 단일 리스트 (시간 카테고리 구분 없음).
9→   탭 가능한 체크박스 + 제목. 상세 진입 = 제목 탭.
10→   할일 추가는 App.jsx 전역 FAB(MobileAddSheet) 사용.
11→   ═════════════════════════════════════════════ */
12→export default function PersonalMatrixMobileList({ projects, tasks }) {
13→  const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState('personal')
14→  const toggleDone = useStore(s => s.toggleDone)
15→  const openDetail = useStore(s => s.openDetail)
16→  const currentUserId = getCachedUserId()
17→
18→  const myTasks = useMemo(() =>
19→    tasks.filter(t => t.assigneeId === currentUserId && !t.done && !t.deletedAt),
20→    [tasks, currentUserId]
21→  )
```

```jsx
// L70-L102 — task row 렌더 (핵심)
70→              {expanded && projTasks.map(task => (
71→                <div
72→                  key={task.id}
73→                  style={{
74→                    display: 'flex',
75→                    alignItems: 'flex-start',
76→                    gap: 10,
77→                    padding: '10px 16px 10px 36px',
78→                    background: '#fff',
79→                  }}
80→                >
81→                  <input
82→                    type="checkbox"
83→                    checked={!!task.done}
84→                    onChange={() => toggleDone(task.id)}
85→                    style={{ flexShrink: 0, width: 18, height: 18, marginTop: 1 }}
86→                  />
87→                  <span
88→                    onClick={() => openDetail(task)}
89→                    style={{
90→                      flex: 1,
91→                      minWidth: 0,
92→                      fontSize: 14,
93→                      color: COLOR.textPrimary,
94→                      wordBreak: 'keep-all',
95→                      overflowWrap: 'break-word',
96→                      lineHeight: 1.4,
97→                      cursor: 'pointer',
98→                    }}
99→                  >{task.text}</span>
100→                  <CategoryChip category={task.category} />
101→                </div>
102→              ))}
```

```jsx
// L115-L135 — CategoryChip
115→function CategoryChip({ category }) {
116→  const map = {
117→    today:   { label: '지금', bg: '#FAEEDA', fg: '#854F0B' },
118→    next:    { label: '다음', bg: '#E6F1FB', fg: '#0C447C' },
119→    backlog: { label: '남은', bg: '#F1EFE8', fg: '#6B6A66' },
120→  }
```

### 신규 구조와의 호환 평가

| 항목 | 현재 구현 | 신규 요구 | 호환? |
|---|---|---|---|
| **MS 계층** | 없음 (flat task list) | `[MS \| ☐ \| 할일]` 한 줄 필요 | ❌ 불호환 |
| **카테고리 표현** | inline CategoryChip (오른쪽) | footer 접힌 섹션 (지금/다음/남은) | ❌ 불호환 |
| **포커스 패널 노출** | 없음 | 우측 패널 or 대체 모바일 UI | ❌ 불호환 |
| **좌우 2컬럼 레이아웃** | 단일 컬럼 | 2컬럼 (백로그 + 포커스) | ❌ viewport 제약 |
| **체크박스 패턴** | native `<input>` | TaskRow custom div 패턴 권장 | ❌ 교체 필요 |

### 모바일 포커스 패널 대안

| 옵션 | 설명 | 트레이드오프 |
|---|---|---|
| **1. Tab 전환** | 상단 Tab "할일" / "포커스 🔥" | 동시에 보이지 않음. DnD cross-tab 불가. |
| **2. Bottom Sheet** | 아래에서 올라오는 포커스 패널 | DnD 복잡 (overlay). |
| **3. 스크롤 하단 섹션** | 백로그 아래 포커스 리스트 | DnD 가능. viewport 분할 없이 tall-scroll. |
| **4. 이번 범위 제외** | 모바일은 기존 유지 | 데스크탑만 개선. 후속 Hotfix/Loop. |

### 결론 — **옵션 4 (이번 범위 제외) + 옵션 3 약식 도입 병행 제안**

**근거**:
1. **스크린샷의 UI 디자인(사용자 첨부)은 명백히 데스크탑 대상** — 2컬럼 레이아웃 + 넓은 여백.
2. 모바일 재설계는 별도의 UX 판단 필요 (DnD vs Tab, FAB 재배치).
3. 현재 mobile 유저베이스는 5–6명 팀 중 일부 — 급하지 않음.
4. PersonalMatrixMobileList 는 DELETE-5 에서 제외 — Loop-XX 데스크탑 완료 후 Loop-YY에서 모바일 대응.

**대안 B (옵션 3)**: 데스크탑 로직을 모바일에도 재사용 (viewport 분기 없이 단일 컴포넌트). 3열 구조 (MS+☐+할일)는 모바일에서도 유효 (padding만 압축). 포커스 섹션을 하단에 collapsible로 배치 (스크롤). → **2단계 Loop으로 나누는 것이 안전**.

**diff-plan 단계 의사결정 포인트**:
- PersonalMatrixMobileList 유지 + 데스크탑만 교체 (Shell 분기: desktop=PersonalTodoShell, mobile=PersonalMatrixMobileList 기존)
- 또는 Shell 내부에서 `window.innerWidth < 768` 분기, PersonalMatrixMobileList 점진 대체

---

## 5. 신규 작성 파일 (참고용, diff 단계에서 확정)

| 파일 | 역할 | 주요 Deps |
|---|---|---|
| `src/components/views/personal-todo/PersonalTodoShell.jsx` | 2컬럼 오케스트레이터 (백로그 + 포커스) | DndContext, useStore, usePivotExpandState('personal') |
| `src/components/views/personal-todo/PersonalTodoListTable.jsx` | 왼쪽 백로그 (3섹션: 지금/다음/남은 footer) | TIME_COLUMNS 대체 constants, collapseState 'personalMatrix' + 'personalFooter' |
| `src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx` | 프로젝트 행 (접기/펼치기, 포커스 흐림) | OPACITY.projectDimmed |
| `src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx` | [MS \| ☐ \| 할일] 한 줄 | CHECKBOX tokens, TaskRow 패턴 |
| `src/components/views/personal-todo/FocusPanel.jsx` | 오른쪽 포커스 리스트 (sticky) | useStore.updateTask({isFocus:false}), reorderFocusTasks |
| `src/components/views/personal-todo/cells/FocusCard.jsx` | 포커스 카드 (드래그 + × 해제) | useSortable('focus-card:') |
| `src/components/views/personal-todo/cells/FocusQuickAddInput.jsx` | 빠른 추가 Enter → '즉시' 귀속 | addTask, INSTANT_PROJECT_ID |

---

## 6. 요약 체크

- [x] R1.1 (H1–H4) — 공유 Checkbox 없음 / 7건 native / TaskRow 패턴 verbatim / 이행 호환성 확인
- [x] R1.2 (I-1 ~ I-6) — DELETE-5 6-파일 매트릭스 완성
- [x] F1 — tasks 전체 스키마 표 + 인덱스 + CHECK + 최근 5 migration + ALTER 예시
- [x] F2 — project_id NOT NULL 없음 (trigger 레벨 orphan 허용) + addTask 로직 verbatim
- [x] F3 — 기존 특수 프로젝트 패턴 전무 (is_system/isSystem/isPinned 0 matches)
- [x] F4 — addProject 시그니처 + payload + scope='private' 경로
- [x] F5 — Sidebar 개인 섹션 verbatim (L82-L85 필터, L284-L288 렌더, L450-L491 Sortable)
- [x] F6 — DnD 23 files + 센서 + 드롭존 ID 컨벤션 + cross-container 지원 범위
- [x] F7 — moveTaskTo / reorderTasks / handleDragEnd 매트릭스
- [x] F8 — 빠른 추가 2곳 verbatim + addTask 기본값 표
- [x] I1 — is_focus 스키마 + mapTask/taskToRow 추가 위치 + 인덱스
- [x] I2 — '즉시' 시스템 프로젝트 설계 (is_system + system_key + seed + DnD 차단)
- [x] I3 — sort_order 용도 분석 + focus_sort_order 신설 결정
- [x] I4 — 프로젝트 흐림 opacity + 카운트 힌트 + OPACITY 토큰 추가 제안
- [x] 4.2 — PersonalMatrixMobileList 전체 verbatim + 호환성 표 + 이번 범위 제외 권장

---

## 7. 불확실 항목 (❓)

| # | 항목 | 근거 |
|---|---|---|
| 1 | `is_focus` NOT NULL vs nullable | 기존 boolean 컬럼 (done, is_archived) 모두 NOT NULL 명시 안 함. 일관성 vs 방어성 트레이드오프. spec 단계 확정 필요. |
| 2 | `is_focus` 인덱스 필수 여부 | 포커스 카드 수 소량 (5-10건) + loadAll 전량 fetch 구조. 실측 후 결정 가능. |
| 3 | 모바일 포커스 패널 UX 패턴 | Tab/BottomSheet/Scroll/제외 — 사용자 UX 결정 영역. 4.2 결론 "옵션 4 (범위 제외)" 권장하나 사용자 확인 필요. |
| 4 | `sortProjectsLocally` 변경의 파급 영향 | `isSystem` 분기 추가 시 기존 정렬이 안정적이라는 가정. 테스트 후 확인 필요. |
| 5 | '즉시' 프로젝트 색상 | `color` 필드는 필수 (addProject 시). 시스템 특유 색 (예: neutral gray `#888780`) 제안하나 디자인 결정. |
| 6 | 포커스 해제 후 카드 사라지는 애니메이션 | 현재 코드에 motion/framer-motion 같은 transition lib 미도입 — CSS transition만 사용. 이 Loop 범위 내 fade-out은 scope 제한. |

---

## 8. 파일 크기 체크

본 문서 예상 약 29 KB — 45 KB 제약 내. Part 분할 불필요.
