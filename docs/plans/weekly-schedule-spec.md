# Weekly Schedule 뷰 — Spec

- **Phase**: weekly-schedule
- **Recon**: `docs/plans/weekly-schedule-recon.md`
- **상위 문서**: `docs/plans/weekly-schedule-recon-spec.md` (REQ-LOCK R1~R18)
- **목업**: `docs/plans/weekly-schedule-mockup.html`
- **Date**: 2026-04-21
- **Revision**: 4 (재리뷰 W1~W7 반영 — memberId=user_id 확정, T6 scope 정정, split(':',3) 통일, updateMilestone whitelist, R18 의미 명확화, groupByProjectId 명세, MS cascade teamProjectIds 필터)
- **원칙**: Don't Touch, Wrap It / R-ATOMIC / designTokens 우선

---

## 1. 배경

팀 위클리 미팅에서 화이트보드로 "이번주 누가 언제 뭐 하는지"를 협의 중. 기존 매트릭스/타임라인/팀원 뷰는 다음 이유로 이 워크플로우를 못 대체:
1. 태스크 1건 배치에 클릭이 과다
2. **"이번주 데드라인"** 개념이 없음 (start_date/end_date는 타임라인 전용)
3. MS/Task 혼재 배치 불가
4. 백로그 → 스케줄 풀 기반 배치 흐름 부재

**해결 접근**: 타임라인 필드와 완전 독립한 `scheduled_date` 필드를 신설하고, 백로그(좌) + 멤버×요일 그리드(우) 레이아웃에 DnD로 배치. 기존 뷰 0 LOC 수정.

---

## 2. 성공 기준

- [ ] 사이드바 팀 섹션 "주간 스케줄" 클릭 → `/team/weekly-schedule` 진입
- [ ] 백로그 task를 셀로 드래그 → DB `scheduled_date + assigneeId` 반영, 백로그에서 opacity 0.3 + 취소선
- [ ] 백로그 MS를 셀로 드래그 → MS + 하위 task 일괄 `scheduled_date` 반영
- [ ] 배치된 항목을 백로그로 되돌리기 → `scheduled_date = null`, MS의 경우 하위 task도 cascade
- [ ] 셀 "+" → 인라인 텍스트 + 프로젝트 선택 → Enter → 새 task 즉시 배치
- [ ] 프로젝트별/담당자별 토글, 검색 필터 작동
- [ ] 주간 네비게이션 (이전주/이번주/다음주)
- [ ] 오늘 열 amber 하이라이트
- [ ] 기존 `team-weekly` / `team-timeline` / `team-matrix` 뷰 무영향
- [ ] `npm run build` 성공

---

## 3. Scope

### 3-1. Hotfix-A와 달리 이 작업은 단일 phase로 묶어 ship (내부적으로 R-ATOMIC 커밋 분할)

### 3-2. 포함

| # | 항목 | 대상 |
|---|------|------|
| D1 | DB 마이그레이션 | `supabase/migrations/20260420_weekly_scheduled_date.sql` |
| D2 | 스토어 mapping + bulk action | `src/hooks/useStore.js` (mapTask, addMilestone SELECT, updateTasksBulk 신규) |
| D3 | Milestone hook SELECT 칼럼 | `src/hooks/useKeyMilestones.js`, `src/hooks/useMilestonesByProjects.js` |
| D4 | 라우팅 & 사이드바 | `src/App.jsx`, `src/hooks/useViewUrlSync.js`, `src/components/layout/Sidebar.jsx` |
| D5 | 신규 util | `src/utils/weekDate.js` |
| D6 | 신규 hook | `src/hooks/useWeeklySchedule.js` |
| D7 | 신규 뷰 + 하위 6개 컴포넌트 | `src/components/views/WeeklyScheduleView.jsx` + `src/components/views/weekly-schedule/` |

### 3-3. 제외 (후속)

- 주말(토/일) 배치 — Mon-Fri 5일만
- scheduled_date 반복 일정
- 타 뷰(매트릭스/타임라인)에 scheduled_date 표시 통합
- 배치 충돌 경고 (한 사람이 같은 날 10건 배치해도 경고 없음)
- 모바일 뷰 최적화 — 이번 구현은 데스크톱 미팅 기준

### 3-4. 수정 금지

| 파일 | 이유 |
|------|------|
| `src/components/shared/OutlinerEditor.jsx` | CLAUDE.md never modify |
| `src/components/views/UnifiedGridView.jsx`, `src/components/views/grid/grids/*.jsx` | 기존 team-weekly (타임라인 기반) 유지 |
| `src/components/views/MatrixView*.jsx`, `MembersView.jsx`, `TimelineView*.jsx` | 제약 §9 규칙 3 |
| `src/components/shared/InlineAdd.jsx` | wrap, don't modify |
| `updateTask(id, patch)` 시그니처 | §9 규칙 1 |

### 3-5. 엣지케이스 처리 (Rev 2 추가)

| # | 케이스 | 처리 |
|---|-------|------|
| **E1** | 한 셀에 10건 이상 배치 (overflow) | `max-height` 제한 **없음**. `min-height: 120px` 기준으로 내용이 넘치면 자연스럽게 세로 확장. 그리드 행 높이가 가장 높은 셀에 맞춰 전체 증가. 미팅 중 스크롤 회피 목적. |
| **E2** | 팀 멤버 0명 | 그리드 행 없는 상태 + 빈 상태 메시지 "팀 멤버가 없습니다. 먼저 팀 설정에서 멤버를 초대하세요." |
| **E3** | 백로그 0건 (모두 배치됨) | 백로그 스크롤 영역에 "모든 항목이 배치되었습니다" 빈 상태 메시지. 패널은 유지(접기 기능 없음) |
| **E4** | 다른 주 보는 중 백로그 드래그 | 보고 있는 주의 해당 셀 날짜로 `scheduledDate` 설정. **의도된 동작**. 툴바 주차 표시가 시각적 가드(이미 디자인에 반영) |

---

## 4. 확정 결정사항 (Ryan 승인)

### 4-1. Recon 6개 결정 — **권장안 그대로 채택**

| 결정 | 선택 | 핵심 |
|------|------|------|
| 1. 날짜 라이브러리 | **B** — native Date + `weekDate.js` util | 앱 일관성, 종속성 無 |
| 2. DragOverlay | **A** — 신규, UnifiedGridView 패턴 계승 | `DragOverlay dropAnimation={null} + pointerWithin` |
| 3. 백로그 토글 상태 | **A** — BacklogPanel 로컬 `useState` | 복잡도 최소 |
| 4. MS cascade | **A** — 스펙대로 + Supabase bulk update | 성능 + 정합성 |
| 5. 셀 인라인 생성 | **B** — 전용 `CellInlineAdd` | InlineAdd 부작용 회피. **projectId: 이번 뷰 세션에서 마지막 선택 기억 (i) + 드롭다운 (iii)** |
| 6. `bgSecondary` 토큰 | **B** — `COLOR.bgSurface`로 매핑 | §7 준수 |

### 4-2. 사전 확정 5가지 (Ryan 답변)

| # | 항목 | 확정 |
|---|------|------|
| 1 | **MS 드래그 되돌리기 cascade** | **예** — 셀→백로그 시 MS `scheduled_date=null` + 하위 task 일괄 `null`. 넣을 때/뺄 때 대칭 보장 |
| 2 | **`category` 불변 정책** | **불변** — scheduled_date는 "이번주 언제"의 배치, category(today/next/later)는 우선순위 분류로 독립. 매트릭스의 cross-cell 리셋(§9 #7)은 이 뷰에 해당 없음 |
| 3 | **`updateTasksBulk` 신규** | **예** — `updateTasksBulk(ids: string[], patch: object)` store action 신규 추가. 기존 `updateTask(id, patch)` **절대 불변** |
| 4 | **사이드바 아이콘** | **📅 이모지** — 기존 이모지 아이콘 관례와 통일 |
| 5 | **주차 표시** | **ISO 주차 (월요일 시작)** — 1월 4일 포함 주가 1주차 |

---

## 5. 요구사항 상세

### 5-1. DB 마이그레이션 (D1)

신규 파일: `supabase/migrations/20260420_weekly_scheduled_date.sql`

```sql
-- Weekly Schedule 뷰 — scheduled_date 칼럼 추가
-- tasks와 key_milestones 양쪽에 추가. nullable로 기본값 NULL (= 백로그 풀)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;
ALTER TABLE key_milestones ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;

-- 기존 RLS 정책은 '*' select 허용이므로 별도 정책 변경 불필요.
-- 기존 start_date / end_date / due_date 칼럼은 절대 변경 없음.
```

**검증**: Supabase 대시보드 Table Editor에서 양 테이블에 `scheduled_date date NULL` 확인.

### 5-2. 스토어 변경 (D2)

**`src/hooks/useStore.js`**

(a) `mapTask` (:171-190 영역)에 1줄 추가:
```js
scheduledDate: r.scheduled_date || null,
```

(a-2) **역매핑(store → DB) 반드시 동기 수정**: `safeUpsertTask` / `taskToRow`(또는 현 코드의 task 직렬화 경로)에 `scheduledDate` → `scheduled_date` 매핑 추가. mapTask만 수정하면 load 후엔 `scheduledDate`로 저장되지만 upsert 시 DB에 다시 기록되는 경로에서 필드가 누락됨. 커밋 2 내에 동시 반영.

(b) `addMilestone` SELECT 칼럼(:930-954 영역)에 `scheduled_date` 추가.

(c) **신규 store action `updateTasksBulk`**:
```js
updateTasksBulk: async (ids, patch) => {
  if (!Array.isArray(ids) || ids.length === 0) return
  // 로컬 먼저 반영 (낙관적)
  set(s => ({
    tasks: s.tasks.map(t => ids.includes(t.id)
      ? { ...t, ...patch, updatedAt: new Date().toISOString() }
      : t)
  }))
  const d = db()
  if (!d) { set({ syncStatus: 'error' }); return }
  set({ syncStatus: 'syncing' })
  // Supabase 단일 쿼리로 일괄 update
  const rowPatch = toRowPatch(patch) // camelCase → snake_case 매핑 (기존 taskToRow 로직 참조)
  rowPatch.updated_at = new Date().toISOString()
  const { error } = await d.from('tasks').update(rowPatch).in('id', ids)
  if (error) {
    console.error('[Ryan Todo] updateTasksBulk:', error)
    set({ syncStatus: 'error' })
    throw error
  }
  set({ syncStatus: 'ok' })
},
```

- **`toRowPatch(patch)`**: camelCase key → snake_case 매핑 헬퍼. 기존 `taskToRow`에서 필요한 부분만 발췌하여 로컬 헬퍼로 작성 (scheduled_date, assignee_id 두 필드만 필요한 범위).
- 기존 `updateTask(id, patch)` 시그니처 불변 (§9 #1 준수).
- `applyTransitionRules`는 bulk 경로엔 적용하지 않음 (scheduled_date는 전이 규칙 대상이 아니므로 단순 update).

(d) **신규 store action `updateMilestone(id, patch)`** (Rev 3 추가):

**배경**: 기존 `useKeyMilestones.update()`는 hook **로컬 state**(`useState([])`)만 갱신하고 Zustand `store.milestones`를 건드리지 않는다. `useWeeklySchedule`가 store에서 derive하는 `scheduledMilestones`에는 반영 안 됨 → 드롭한 MS가 다음 `loadAll()` 폴링(10초)까지 셀에 표시되지 않음. 미팅 중 UX로 치명적.

**해결**: `useStore`에 `updateMilestone(id, patch)` 신규 action 추가. `updateTask`와 대칭 패턴.

```js
// 허용 patch 키: { scheduled_date } 만. weekly-schedule 전용 — 범용 사용 금지.
// 다른 필드(title/status 등) 수정은 기존 useKeyMilestones.update() 사용.
// id/pkm_id/project_id 같은 PK/FK는 절대 patch에 포함 금지 (DB row 오염 위험).
updateMilestone: async (id, patch) => {
  // 낙관적: store.milestones 갱신 (snake_case 그대로 — mapMilestone 없음)
  set(s => ({
    milestones: s.milestones.map(m => m.id === id ? { ...m, ...patch } : m)
  }))
  const d = db()
  if (!d) { set({ syncStatus: 'error' }); return }
  set({ syncStatus: 'syncing' })
  const { error } = await d.from('key_milestones')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.error('[Ryan Todo] updateMilestone:', error)
    set({ syncStatus: 'error' })
    throw error
  }
  set({ syncStatus: 'ok' })
},
```

- patch는 **snake_case** (DB 칼럼명 그대로) — milestone은 store에서도 raw row로 저장되므로
- 기존 `useKeyMilestones.update()`는 그대로 유지(다른 뷰에서 사용 중). WeeklyScheduleView의 onDragEnd만 store action 사용.
- 삽입 위치: `useStore.js:585` (updateTask 뒤) 또는 `:954` (addMilestone 뒤) 중 store에서 동선상 milestone CRUD 근처가 적합 — diff-plan에서 확정.

### 5-3. Milestone Hook 칼럼 추가 (D3)

- `useKeyMilestones.js` SELECT 칼럼 리스트에 `scheduled_date` 추가.
- `useMilestonesByProjects.js` 동일.
- `update(id, patch)` 함수는 임의 patch 지원하므로 **로직 변경 불요** — `patch.scheduled_date` 그대로 통과.

### 5-4. 라우팅 & 사이드바 (D4)

**`src/App.jsx`**

`views` 객체 추가:
```jsx
'team-weekly-schedule': () => <WeeklyScheduleView />,
```

`VIEW_ORDER`에 `'team-weekly-schedule'` 삽입 (팀 섹션, `team-members` 또는 `team-timeline` 근처 — 사이드바 렌더 순서와 일관).

**`src/hooks/useViewUrlSync.js`**

`VIEW_TO_PATH`에 매핑 추가:
```js
'team-weekly-schedule': '/team/weekly-schedule',
```

**`src/components/layout/Sidebar.jsx`**

`TEAM_ONLY_VIEWS` (:40-42)에 추가:
```js
{ key: 'weekly-schedule', label: '주간 스케줄', icon: '📅' },
```

### 5-5. 날짜 유틸 (D5)

신규: `src/utils/weekDate.js`

```js
// 월요일로 정규화 — 기존 src/components/views/grid/constants.js의 getMonday re-export
export { getMonday } from '../components/views/grid/constants'

// [Mon, Tue, Wed, Thu, Fri] Date 5개 반환
export function getWeekDays(monday) { /* ... */ }

// ISO 주차 번호 (1-53). 1월 4일 포함 주 = 1주차
export function getISOWeekNumber(date) { /* ... */ }

// "4월 20일 ~ 24일 (17주차)" 형식
export function formatWeekRange(monday) { /* ... */ }

// "2026-04-22" ISO date string (scheduled_date 저장용)
export function toISODateString(date) { /* ... */ }
```

- `fmtDate`, `DAY_LABELS`는 `src/components/views/grid/constants.js`에서 import하여 재사용.
- **`getMonday` 재사용** (Rev 3): `grid/constants.js`에 이미 `getMonday(d)` 존재(recon Phase 1 확인). `weekDate.js`는 이를 re-export만 하고 별도 구현하지 않음. spec Rev 1의 `getMondayOf` 명칭은 **`getMonday`로 통일**.
- 토요일/일요일 제외는 getWeekDays가 담당.

### 5-6. 데이터 hook (D6)

신규: `src/hooks/useWeeklySchedule.js`

반환:
```js
{
  currentWeekStart,       // Date (Monday)
  weekDays,               // Date[5]
  goToPrevWeek,
  goToNextWeek,
  goToThisWeek,
  weekLabel,              // "4월 20일 ~ 24일 (17주차)"

  scheduledTasks,         // tasks with scheduled_date in week range
  scheduledMilestones,    // milestones with scheduled_date in week range
  backlogTasks,           // scheduled_date IS NULL AND done === false AND team 프로젝트
  backlogMilestones,      // scheduled_date IS NULL AND team 프로젝트
}
```

- 팀 프로젝트 필터: `useStore(s => s.projects).filter(p => p.team_id === currentTeamId)` → 그 프로젝트 id들에 속한 task/milestone만.
- `done === true` task는 백로그에서 제외 (R9).
- 모든 필터링은 클라이언트 측 — task 수 수백 규모 성능 OK.

### 5-7. WeeklyScheduleView (D7 orchestrator)

**책임**:
- 루트 `DndContext`  + `DragOverlay` 소유 (UnifiedGridView 패턴 계승)
- Sensor: `PointerSensor(activationConstraint: {distance: 5})` + `TouchSensor`
- Collision detection: `pointerWithin`
- `DragOverlay dropAnimation={null}` — 목업의 2deg rotate + shadow는 `DragPreview` 컴포넌트에서 렌더
- `onDragStart`, `onDragEnd` 핸들러 — 드롭 시 `updateTask` / `updateKeyMilestone` + `updateTasksBulk` 호출
- 레이아웃: 좌 230px `BacklogPanel` + 우 flex-1 `ScheduleGrid`

**드래그 아이템 ID 네이밍 규약**:
- Task: `task:${taskId}`
- Milestone: `ms:${msId}`
- 드롭 셀 ID: `cell:${memberId}:${dateISO}`
- 백로그 드롭존 ID: `backlog`

**`activeDrag` state 구조** (Rev 3):
```ts
activeDrag: null | {
  kind: 'task' | 'ms',
  id: string,
  title: string,           // DragPreview 표시
  projectColor: string | null, // Task는 project dot 색, MS는 null (자체 색 사용)
  assigneeId: string | null,    // R18 멤버 행 하이라이트용 (Task만, MS는 null)
}
```

**onDragStart 의사코드** (Rev 3 신규):
```
const { active } = event
const [kind, id] = active.id.split(':', 2) // edge 2 방어
if (kind === 'task') {
  const task = tasks.find(t => t.id === id)
  if (!task) return
  const project = projects.find(p => p.id === task.projectId)
  setActiveDrag({
    kind: 'task',
    id,
    title: task.text,
    projectColor: project?.color || null,
    assigneeId: task.assigneeId || null,
  })
  return
}
if (kind === 'ms') {
  const ms = milestones.find(m => m.id === id)
  if (!ms) return // null 가드 — milestone 미로드 케이스
  setActiveDrag({
    kind: 'ms',
    id,
    title: ms.title,
    projectColor: null, // MS는 DragPreview에서 자체 색(ms.color) 또는 보라 배지 스타일
    assigneeId: null,   // MS 드래그는 멤버 하이라이트 대상 아님
  })
}
```

**onDragEnd 의사코드** (Rev 4: `split(':', 2/3)` 방어 + milestone null 가드 + `updateMilestone` store action 사용 + **userId 확정**):

> ⚠ **ID 컨벤션** (W7 확정): 셀 드롭존 ID는 `cell:${member.userId}:${dateISO}`. `member.userId`는 `profiles.user_id` = `tasks.assignee_id`와 동일 uuid. `member.id`(team_members 테이블 PK)를 쓰면 assignee 매칭이 전부 어긋남.

```
const { active, over } = event
setActiveDrag(null) // always clear
if (!over) return
const [kind, id] = active.id.split(':', 2)

// ─── 분기 1: 셀 → 백로그 (미배정 되돌리기) ───
if (over.id === 'backlog') {
  // assignee 유지 — scheduledDate만 null
  if (kind === 'task') updateTask(id, { scheduledDate: null })
  if (kind === 'ms') {
    updateMilestone(id, { scheduled_date: null }) // Rev 3: store action (snake_case patch)
    // Rev 4 EC3: teamProjectIds 필터로 타팀 task 배제
    const childTaskIds = tasks
      .filter(t => t.keyMilestoneId === id && teamProjectIds.has(t.projectId))
      .map(t => t.id)
    if (childTaskIds.length > 0) updateTasksBulk(childTaskIds, { scheduledDate: null })
  }
  return
}

// ─── 분기 2: 셀 → 셀 (신규 배치 또는 요일/담당자 변경) ───
const [, userId, dateISO] = over.id.split(':', 3) // Rev 4: split limit 3, userId 변수명
// userId = profiles.user_id (tasks.assignee_id와 동일)

// No-op 가드: 같은 셀에 드롭
if (kind === 'task') {
  const task = tasks.find(t => t.id === id)
  if (task?.scheduledDate === dateISO && task?.assigneeId === userId) return
}
if (kind === 'ms') {
  const ms = milestones.find(m => m.id === id)
  if (ms?.scheduled_date === dateISO) return // MS는 assignee 불변이라 date만 비교
}

// 실제 업데이트
if (kind === 'task') updateTask(id, { scheduledDate: dateISO, assigneeId: userId })
if (kind === 'ms') {
  updateMilestone(id, { scheduled_date: dateISO }) // Rev 3: store action
  // Rev 4 EC3: 팀 전환 window 방어 — teamProjectIds 필터로 타팀 task 제외
  const children = tasks.filter(t => t.keyMilestoneId === id && teamProjectIds.has(t.projectId))
  if (children.length > 0) {
    // MS assignee는 변경 안 함. 하위 task는: assignee 있으면 유지, 없으면 userId
    const needDefault = children.filter(t => !t.assigneeId).map(t => t.id)
    const keepAssignee = children.filter(t => t.assigneeId).map(t => t.id)
    if (needDefault.length > 0) updateTasksBulk(needDefault, { scheduledDate: dateISO, assigneeId: userId })
    if (keepAssignee.length > 0) updateTasksBulk(keepAssignee, { scheduledDate: dateISO })
  }
}
```

**Patch key 컨벤션 명확화** (Rev 3 갱신):
- `useStore.updateTask(id, patch)` / `updateTasksBulk(ids, patch)` → **camelCase** (`scheduledDate`, `assigneeId`). store 내부에서 DB 직렬화 시 snake_case로 변환됨. `taskToRow`(또는 safeUpsertTask 내부 매핑)에 `scheduledDate → scheduled_date` 역매핑 누락 시 DB에 반영 안 됨 — §5-2 (a-2) 참조.
- `useStore.updateMilestone(id, patch)` → **snake_case** (`scheduled_date`). milestone은 store에서 raw row(snake_case)로 저장되므로 patch도 snake_case가 자연스럽다. store 내부에서 바로 DB에 pass-through.
- ~~`useKeyMilestones.update(id, patch)`~~ → Rev 3에서 **WeeklyScheduleView는 이 경로 사용 안 함**. hook 로컬 state만 갱신하여 `store.milestones`에 반영 안 되기 때문. 다른 뷰(ProjectView 등)는 계속 사용.

**category 불변 원칙**: 위 어느 경로에서도 `category`는 patch에 포함하지 않음. 매트릭스 뷰 cross-cell 리셋 규칙(§9 #7)은 이 뷰에 해당 없음.

### 5-8. BacklogPanel

- 너비 230px, 배경 `COLOR.bgSurface` (recon 결정 6)
- 구성: 헤더 → 그룹 토글 (로컬 `useState('project' | 'member')`) → 검색 input → 스크롤 영역
- **프로젝트별 모드** (기본): 팀 프로젝트 트리 → MS/Task 중첩
- **담당자별 모드**: 멤버(useTeamMembers) 트리 → 프로젝트 서브그룹 → MS/Task
- 검색: 실시간 부분 일치. Task는 `t.text + t.notes`, MS는 `m.title + (m.description || '')` 기준 substring case-insensitive
- 배치 완료 항목: `scheduledDate !== null` (task) / `scheduled_date !== null` (ms) → opacity 0.3 + `textDecoration: line-through`

**드롭존 등록** (Rev 3 추가):
```jsx
const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })
return <div ref={setNodeRef} style={{ ..., background: isOver ? 'rgba(49,130,206,0.08)' : COLOR.bgSurface }}>...</div>
```
- 패널 최외곽 div에 `useDroppable({ id: 'backlog' })` 등록. 없으면 onDragEnd의 `over.id === 'backlog'` 분기(셀→백로그 되돌리기, R13)가 영원히 발동 안 함.
- isOver 시 패널 전체 약한 파란 배경으로 시각 피드백.

### 5-9. ScheduleGrid + ScheduleCell

**Grid**:
- `gridTemplateColumns: '160px repeat(5, 1fr)'` (TeamWeeklyGrid 참조)
- 첫 열(멤버): `position: sticky; left: 0; z-index: 1`
- 헤더: 요일+날짜 ("월 4/20" — grid/constants.js의 DAY_LABELS 재사용)
- 오늘 열 헤더: `PILL.amber` 토큰 (background + text color)
- 오늘 열 셀: amber 배경 약하게 (rgba 투명도 0.15)

**Cell (`useDroppable` id = `cell:${member.userId}:${dateISO}`)** (Rev 4: `member.userId` 확정):
- 내용: (memberId, dateISO)로 필터된 task + milestone
- 프로젝트별 그룹핑: 같은 projectId끼리 묶어 프로젝트명 헤더 + 아이템 목록
- **렌더 순서 (둘 다 `updatedAt` desc)**:
  1. 프로젝트 그룹 순서: 해당 그룹 내 아이템 중 **최신 `updatedAt`** 기준 desc (가장 최근 배치된 프로젝트가 위)
  2. 그룹 내 MS/Task 순서: `updatedAt` desc (MS와 Task 혼재, 같은 updatedAt 기준)
  - 근거: 미팅 중 "방금 배치한 게 위에 보이는" 흐름이 자연스러움. 가나다순은 정보 가치 낮음.
- MS: 보라색 배지 (`#EEEDFE` bg, `#534AB7` text) — 인라인 스타일
- Task: 체크박스 + 텍스트
- Hover: 우측 하단에 "+" 버튼 → `CellInlineAdd` 활성화
- Drag over: 파란 dashed outline (`#3182CE`) + `rgba(49,130,206,0.08)` 배경
- **R18 멤버 행 하이라이트** (Rev 4 의미 명확화): 드래그 진행 중(`activeDrag !== null`) **& task 드래그** (`activeDrag.kind === 'task'`) **& 셀의 `member.userId === activeDrag.assigneeId`** (드래그 시작 task의 **현재** assignee == 셀의 멤버)일 때 약한 파란 배경(`rgba(49,130,206,0.05)`). **"해당 멤버"의 의미는 "드래그 중인 아이템의 현재 assignee"**이지 "드롭 목적지"가 아님. 목적지 행은 `isOver`(`rgba(49,130,206,0.08)`)로 별도 처리. MS 드래그는 assignee 개념 없음 → 이 하이라이트 미적용. `activeDrag`와 `member.userId`는 WeeklyScheduleView → ScheduleGrid → ScheduleCell로 prop drilling.
- **셀 최소 높이**: `min-height: 120px`. 아이템이 많으면 자연스럽게 세로로 늘어남 (max-height 제한 없음 — §3-3 "충돌 경고 없음" 전제 + 미팅 중 스크롤 회피). 그리드 행 높이는 셀 중 가장 높은 것에 맞춰짐.

**셀 내 아이템 "×" 되돌리기 버튼** (Rev 3 신규, spec §5-4 R13 미명세 보완):
- 각 셀 내 task/MS 아이템에 hover 시 우측에 작은 "×" 버튼 노출
- 클릭 시:
  - Task: `updateTask(id, { scheduledDate: null })` — assignee 유지
  - MS: `updateMilestone(id, { scheduled_date: null })` + **`teamProjectIds.has(t.projectId)` 필터된** 하위 task `updateTasksBulk(childIds, { scheduledDate: null })` cascade (Rev 4 EC3: onDragEnd 분기 1과 동일 방어)
- 드래그로 백로그에 끌어 넣는 방식과 동등한 효과. 미팅 중 "한 클릭에 취소" UX.
- 모바일 우클릭 메뉴는 부적합(W: §5-4 검토)이라 "×" 버튼으로 통일.
- 버튼 스타일: `color: '#ccc' → hover #e57373`, `fontSize: 12`, `padding: 2`, `stopPropagation()` 필수(드래그 활성 충돌 방지).

**그룹핑 헬퍼** (Rev 4 W6 명세):

`ScheduleCell` 내부 로컬 함수로 정의 (별도 util 파일 불요 — 이 뷰 전용):

```js
// tasksInCell, milestonesInCell 에서 _kind discriminator 부여 후 projectId로 그룹핑
// _kind는 useWeeklySchedule에서 주입하거나 ScheduleCell 진입 시 주입 (아래 주입 방식):
function groupByProjectId(tasksInCell, milestonesInCell, projects) {
  const taggedTasks = tasksInCell.map(t => ({ ...t, _kind: 'task', _updatedAt: t.updatedAt }))
  const taggedMS = milestonesInCell.map(m => ({ ...m, _kind: 'ms', _updatedAt: m.updated_at }))
  const all = [...taggedTasks, ...taggedMS]
  const groups = new Map()
  for (const item of all) {
    const pid = item._kind === 'task' ? item.projectId : item.project_id
    if (!groups.has(pid)) {
      const project = projects.find(p => p.id === pid)
      groups.set(pid, { projectId: pid, projectName: project?.name || '(프로젝트 없음)', color: project?.color || null, items: [] })
    }
    groups.get(pid).items.push(item)
  }
  return Array.from(groups.values())
}

function sortGroupsByNewestUpdate(groups) {
  // 각 그룹 내부 아이템을 _updatedAt desc 정렬
  groups.forEach(g => g.items.sort((a, b) => (b._updatedAt || '').localeCompare(a._updatedAt || '')))
  // 그룹 순서: 그룹 최신 updatedAt desc
  return groups.sort((a, b) => (b.items[0]?._updatedAt || '').localeCompare(a.items[0]?._updatedAt || ''))
}
```

`_kind` discriminator는 task/MS 통합 렌더 + onRemove 분기용. task는 `camelCase(projectId, updatedAt)`, MS는 `snake_case(project_id, updated_at)`이라 헬퍼가 차이를 흡수.

### 5-10. CellInlineAdd (결정 5-B)

**상태**:
- input text (빈 문자열 시작)
- 최근 선택 projectId (뷰 수명 동안 유지 — `WeeklyScheduleView` 상위 state로 lift해서 공유 OR BacklogPanel과 별개로 각 셀에서 동일 값 읽기)

**UI**:
```
[ 프로젝트 드롭다운 ▾ ]  [ 태스크 내용... ]
```
- 드롭다운: 팀 프로젝트 목록 (최근 선택 맨 위)
- Enter 동작 가드:
  ```js
  if (!selectedProjectId || !text.trim()) return // 프로젝트 미선택 또는 빈 텍스트 → no-op
  addTask({
    text: text.trim(),
    projectId: selectedProjectId,
    assigneeId: memberId,
    scheduledDate: dateISO,       // camelCase (updateTask와 동일 컨벤션)
    category: 'today',
    teamId: currentTeamId,
    scope: 'assigned',            // Rev 3: assigneeId 있는 task는 scope='assigned' (§9 규칙 4-3 scope 분류)
  })
  ```

**scope 값 결정 (Rev 4 확정)**: DB CHECK constraint `valid_scope`(`20260312000000_loop17_team_schema.sql:144-148`) 확인 완료 — `scope='assigned' ⇔ team_id NOT NULL AND assignee_id NOT NULL`. CellInlineAdd가 `assigneeId: userId`를 전달하므로 `scope: 'assigned'` 확정.

**⚠ 중요 (Rev 4 W5)**: `useStore.addTask`는 **`applyTransitionRules`를 호출하지 않는다** (`updateTask`만 호출). 따라서 CellInlineAdd가 전달하는 `scope`/`assigneeId` 조합은 호출자 책임. `scope='assigned'` + `assigneeId: userId` + `teamId: currentTeamId` 3개를 **함께** 전달해야 DB CHECK 통과. 하나라도 누락/잘못되면 INSERT 실패. 구현 시 주석 필수.
- Escape / blur (텍스트 비어있을 때): 취소
- 성공 후: input 비우고 유지 (연속 입력 가능), 프로젝트 selection 유지

**projectId 기본값 결정 로직**:
- 최초: dropdown placeholder ("프로젝트 선택")
- 이후: 이번 뷰 세션에서 마지막 선택된 projectId를 **`WeeklyScheduleView` 상위 state**에 저장(`useState(null)` + 자식 onSelect 콜백). 모든 셀의 CellInlineAdd가 같은 값 공유 → 다음 셀 "+"에서도 동일 projectId 기본 선택
- placeholder 상태(null)에서 Enter 차단 → 실수 방지 (§10 R9 완화)

### 5-11. DragPreview

`DragOverlay` 내부 렌더:
- `padding: 4px 10px`
- `border: 1px solid #3182CE`
- `borderRadius: 6`
- `transform: rotate(2deg)`
- `background: white`
- `boxShadow: 0 4px 12px rgba(0,0,0,0.15)`
- `z-index: 9999`
- 표시 텍스트: 드래그 중인 task/milestone의 title

`white-space: normal; word-break: break-word` — ellipsis 금지 원칙(§7).

---

## 6. 변경 파일 요약

| 파일 | 변경 | 예상 LOC |
|------|------|---------|
| `supabase/migrations/20260420_weekly_scheduled_date.sql` | 신규 | ~10 |
| `src/hooks/useStore.js` | mapTask 1줄 + taskToRow 1줄 + loadAll milestone SELECT 1줄 + addMilestone SELECT 1줄 + **`updateTasksBulk` 신규** + **`updateMilestone` 신규** (Rev 3) | +55 |
| `src/hooks/useMilestonesByProjects.js` | SELECT 칼럼 | +1 |
| `src/hooks/useKeyMilestones.js` | SELECT 칼럼 | +1 |
| `src/App.jsx` | views 객체 + VIEW_ORDER + import | +3 |
| `src/hooks/useViewUrlSync.js` | VIEW_TO_PATH | +1 |
| `src/components/layout/Sidebar.jsx` | TEAM_ONLY_VIEWS | +1 |
| `src/utils/weekDate.js` | 신규 | ~50 |
| `src/hooks/useWeeklySchedule.js` | 신규 | ~70 |
| `src/components/views/WeeklyScheduleView.jsx` | 신규 | ~140 |
| `src/components/views/weekly-schedule/BacklogPanel.jsx` | 신규 | ~150 |
| `src/components/views/weekly-schedule/BacklogItem.jsx` | 신규 | ~60 |
| `src/components/views/weekly-schedule/ScheduleGrid.jsx` | 신규 | ~100 |
| `src/components/views/weekly-schedule/ScheduleCell.jsx` | 신규 | ~90 |
| `src/components/views/weekly-schedule/CellInlineAdd.jsx` | 신규 | ~70 |
| `src/components/views/weekly-schedule/DragPreview.jsx` | 신규 | ~40 |
| **합계** | | **~850 LOC (신규 ~780, 수정 ~60)** (Rev 3: updateMilestone +20, 셀 × 버튼 +10) |

**기존 뷰 0 LOC 수정** (MatrixView, TimelineView, MembersView, UnifiedGridView 등).

---

## 7. 커밋 순서 (R-ATOMIC)

| # | Commit | 파일 | 검증 |
|---|--------|------|------|
| 1 | **DB migration** | `supabase/migrations/20260420_weekly_scheduled_date.sql` | Supabase 대시보드에서 `scheduled_date` 칼럼 존재 확인 |
| 2 | **스토어: mapTask + taskToRow + updateTasksBulk + updateMilestone** (Rev 3) | `useStore.js` | `npm run build` 성공, `useStore.getState().updateTasksBulk` 및 `updateMilestone` 함수 존재 |
| 3 | **Milestone hook 칼럼** | `useKeyMilestones.js`, `useMilestonesByProjects.js` | `npm run build` 성공 |
| 4 | **날짜 유틸** | `src/utils/weekDate.js` | 단위 테스트(수동): `getISOWeekNumber(new Date('2026-04-20')) === 17` |
| 5 | **데이터 hook** | `src/hooks/useWeeklySchedule.js` | Build 성공, 반환 필드 전부 defined |
| 6 | **WeeklyScheduleView 뼈대** | `WeeklyScheduleView.jsx` + BacklogPanel + ScheduleGrid 스켈레톤 | 라우트 진입 시 빈 레이아웃 렌더 |
| 7 | **BacklogPanel 완성** | `BacklogPanel.jsx`, `BacklogItem.jsx` | 토글/검색/트리 렌더 |
| 8 | **ScheduleGrid + Cell** | `ScheduleGrid.jsx`, `ScheduleCell.jsx` | 멤버×요일 그리드, sticky, amber 하이라이트 |
| 9 | **DnD 연결** (Rev 3: onDragStart + R18 하이라이트 + 셀 × 버튼 포함) | `WeeklyScheduleView` onDragStart/onDragEnd, `DragPreview.jsx`, `ScheduleCell.jsx` × 버튼, BacklogPanel useDroppable('backlog') | 백로그→셀 드롭, 셀→셀 이동, 셀→백로그 드롭, 셀 × 버튼 클릭 모두 작동. task 드래그 시 같은 assignee 행 약한 파란 하이라이트. MS cascade (store action 경로) |
| 10 | **CellInlineAdd** | `CellInlineAdd.jsx` | "+" 클릭 → 입력 → Enter → 새 task |
| 11 | **라우팅 + 사이드바** | `App.jsx`, `useViewUrlSync.js`, `Sidebar.jsx` | 사이드바에서 진입 가능, URL 동기화 |

**선택**: 커밋 6~10은 모두 신규 파일이라 실질적으로 작은 단위로 구분해 압축 merge해도 무방. PR 단위로 보면 하나의 feat PR.

---

## 8. 테스트 시나리오

| # | 시나리오 | 기대 |
|---|---------|------|
| T1 | 백로그 task 드래그 → 셀 드롭 | DB: `scheduled_date + assignee_id` 반영. UI: 백로그 해당 항목 opacity 0.3 + 취소선, 셀에 표시 |
| T2 | 백로그 MS 드래그 → 셀 드롭 | MS `scheduled_date` + 하위 task `scheduled_date` 일괄. Supabase bulk update 1회 쿼리. 하위 task 중 assignee 없던 항목만 셀 memberId로 설정, 있던 건 유지 |
| T3 | 셀→셀 이동 (요일/담당자 변경) | task: scheduledDate/assigneeId 모두 갱신. category 불변 |
| T3-1 | **같은 셀에 드롭 (no-op)** | update 호출 없음, DB 변화 없음 |
| T4 | 셀→백로그 (task) | `scheduledDate = null`, assignee 유지 |
| T5 | 셀→백로그 (MS) | MS + 하위 task 모두 `scheduled_date = null` cascade |
| T6 | 셀 "+" → 프로젝트 선택 → 텍스트 → Enter | 새 task: scheduledDate=셀.date, assigneeId=셀.userId, category='today', **scope='assigned'** (DB CHECK 통과), teamId=currentTeamId. 두 번째 "+" 사용 시 이전 projectId 기본 선택 |
| T6-1 | **셀 "+" → 프로젝트 미선택 상태에서 Enter** | no-op (addTask 호출 없음) |
| T7 | 주간 네비게이션 (이전/이번/다음) | weekDays 갱신, 오늘 하이라이트 위치 이동 (다른 주에선 하이라이트 없음) |
| T8 | 프로젝트별 ↔ 담당자별 토글 | 트리 재구성, 배치 완료 취소선 두 모드 모두 동기화 |
| T9 | 검색 "API" 입력 | title/notes 부분 일치 필터. 양 토글 모드에서 동일 결과 |
| T10 | 개인 프로젝트 task 백로그 노출? | **No** — 팀 프로젝트만 |
| T11 | `done=true` task 백로그 노출? | **No** |
| T12 | ISO 주차 계산 | 2026-04-20(월) → "17주차" 표시 |
| T13 | 기존 `/team/weekly` (타임라인 기반) 정상 동작 | 영향 없음 |
| T14 | 기존 `/team/matrix` 정상 동작 | 영향 없음 |
| **T15** | **E1: 한 셀에 10건 이상 배치** | 셀이 자연스럽게 세로로 늘어남(max-height 제한 없음). 해당 그리드 행 전체 높이 증가. 다른 셀은 빈 공간 생김 |
| **T16** | **E2: 팀 멤버 0명 상태 진입** | 그리드 헤더만 있고 행 없음 + "팀 멤버가 없습니다" 빈 상태 메시지 표시 |
| **T17** | **E3: 백로그 0건 (모두 배치됨)** | 백로그 스크롤 영역에 "모든 항목이 배치되었습니다" 빈 상태 메시지. 패널 자체는 유지(접기 안 함) |
| **T18** | **E4: 다른 주 보는 중 백로그 드래그** | 보고 있는 주의 해당 셀로 배치됨. 툴바의 주차 표시로 사용자 확인 가능. 의도된 동작 |
| T19 | 셀 내 여러 프로젝트 + MS/Task 혼재 시 정렬 | updatedAt desc. 방금 배치/수정한 항목이 위로. |
| **T20** (Rev 4) | **W7 회귀**: task를 자기 본인 assignee 셀에서 다른 날짜로만 이동 | no-op 가드 미작동(assigneeId 동일, date만 다름) → updateTask 호출. `tasks.assignee_id`(user_id)와 `cell:${userId}:...` 매칭 확인 |
| **T21** (Rev 4) | **R18 하이라이트**: 담당자별 모드에서 Ed의 task 드래그 시작 → Ed 행 전체 약한 파란, Ryan 행 배경 변화 없음 | 드래그 시작 task의 현재 assignee=Ed. 목적지 셀(Ryan의 Wed 등)은 isOver로 별도 진한 파란 |
| **T22** (Rev 4) | **EC3 회귀**: 팀 A → 팀 B 전환 직후 1초 이내 MS 드롭 → 이전 팀의 task가 cascade에 포함되지 않음 | teamProjectIds 필터로 배제 |

---

## 9. Out of Scope (재확인)

- 주말(토/일) 스케줄
- scheduled_date 반복 일정
- 타 뷰(matrix/timeline)에 scheduled_date 표시 통합
- 배치 충돌 감지/경고
- 모바일 최적화
- 드래그 중 자동 스크롤
- scheduled_date 기반 알림/Notification
- 주간 복사(이번주 스케줄 → 다음주 복제)
- Undo/Redo (실수로 잘못 배치한 경우 수동 되돌리기만)

---

## 10. 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| R1 | `updateTasksBulk`에 `applyTransitionRules` 미적용 — 특정 패치(done=true 등)에서 비일관 | 이 뷰에선 bulk에 `scheduled_date` + `assignee_id`만 전달 → `applyTransitionRules` 영향권 밖. bulk의 patch 필드 문서화로 오용 방지 |
| R2 | MS cascade 시 partial failure로 정합성 깨짐 | MS scheduled_date 업데이트(`key_milestones` 테이블, `useKeyMilestones.update`)와 하위 task bulk update(`tasks` 테이블, `updateTasksBulk`)는 **별개 쿼리 2회**. 각각은 단일 쿼리 내 all-or-nothing이지만 두 쿼리 간 partial failure 가능(MS 성공 + task 실패). 발생 확률 극히 낮고, 실패 시 catch에서 `syncStatus='error'` 설정 + 다음 `loadAll()`에서 서버 기준으로 정합성 복구. 완전 트랜잭션 보장은 후속 phase에서 Supabase RPC function으로 묶을 수 있음 |
| R3 | `scheduled_date` ISO 문자열 vs DB date 타입 왕복 오차 (timezone) | `toISODateString(date)`로 YYYY-MM-DD 포맷만 사용, timezone 정보 없음 → Postgres date 타입과 정확히 일치 |
| R4 | `team-weekly` vs `team-weekly-schedule` view key 유사로 라우팅 혼동 | VIEW_TO_PATH 매핑 정확히 구분, 사이드바 라벨 "주간 스케줄"로 명확화 |
| R5 | `useWeeklySchedule` 클라이언트 필터 성능 (task 수백~수천) | 현재 규모에선 문제 없음. 필요 시 후속 phase에서 서버 사이드 필터(RPC) 도입 |
| R6 | `mapTask` 변경이 global — 기존 뷰가 scheduledDate 참조 안 함 보장 | 신규 필드는 기본값 null. 기존 뷰는 이 필드 무지 → 영향 없음 |
| R7 | DragOverlay z-index가 모달/토스트 위로 | z-index 9999 + DragOverlay는 onDragStart~End 사이에만 렌더 |
| R8 | `@dnd-kit` activation distance 5px와 체크박스 클릭 충돌 | 체크박스는 `<button>` + `e.stopPropagation()`. UnifiedGridView 선례 따름 |
| R9 | CellInlineAdd의 마지막 projectId 기억이 다른 멤버 셀로 갈 때도 유지 → 잘못된 프로젝트로 생성 가능성 | projectId는 "세션 동안 마지막 선택"이고 각 생성마다 사용자가 확인/변경 가능. Enter 누르기 전 드롭다운 표시로 실수 예방 |
| R10 | MS 하위 task cascade가 "이번주 배정 안 한 프로젝트 전체"에 퍼질 수 있음 | MS 드래그 시 해당 MS의 직접 하위 task만. 프로젝트 전체가 아님 |
| R11 | ISO 주차 연 경계 (2026-12-31 → 2027-W01 가능) | `getISOWeekNumber`는 표준 알고리즘(목요일 기준). 1월 4일 포함 주가 1주차 |

---

## 11. 구현 노트

- **designTokens 사용**: 모든 색상/간격은 `COLOR`, `FONT`, `SPACE`에서. 함수 내부 참조만(§6 TDZ rule).
- **인라인 스타일 우선**: 새 CSS 파일 금지(CLAUDE.md §3-1). 기존 CSS도 수정 금지.
- **MS 배지 색**: `#EEEDFE` bg + `#534AB7` text (인라인, 스펙 §7 지정값).
- **gray 최소**: `#888780`보다 밝은 gray 금지 (§9 #9). 목업의 `--text-tertiary: #b4b2a9`는 너무 밝으므로 `COLOR.textTertiary` (#a09f99)로 교체.
- **ellipsis 금지**: `white-space: normal; word-break: break-word`(§7).
- **border-left 컬러바 금지**: 프로젝트 색은 dot(6~7px 원형/사각)으로만 표현(§7, §9 #8).

---

## 12. 다음 단계

1. **이 spec을 Claude Web에서 검토/상세화** (목업 상호작용, 엣지케이스, 비즈니스 룰, 예외 케이스 보강)
2. 상세화 완료 후 파일 업데이트
3. `/diff-plan weekly-schedule` 실행
4. `/execute weekly-schedule` 실행
