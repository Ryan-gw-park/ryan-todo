# Weekly Schedule — Diff Plan v2 (spec Rev 3 기준)

- **Phase**: weekly-schedule
- **Spec**: `docs/plans/weekly-schedule-spec.md` (Rev 3)
- **Recon**: `docs/plans/weekly-schedule-recon.md`
- **Date**: 2026-04-21
- **Revision**: 3 (spec Rev 4 반영 — W7 `member.userId` 확정, split(':',3), updateMilestone whitelist, R18 의미 명확화, groupByProjectId 로컬 헬퍼 명세, EC3 팀 전환 window 방어, T6 scope='assigned' 정정)
- **원칙**: R-ATOMIC — 11개 커밋, 각각 독립 컴파일 가능

---

## 0. 전체 요약

| 항목 | 값 |
|------|-----|
| 수정 파일 (기존) | 6개 — `useStore.js`, `useKeyMilestones.js`, `useMilestonesByProjects.js`, `App.jsx`, `useViewUrlSync.js`, `Sidebar.jsx` |
| 신규 파일 | 10개 — migration 1 + util 1 + hook 1 + 뷰+하위 컴포넌트 7개 |
| DB 마이그레이션 | **필수** — `tasks.scheduled_date`, `key_milestones.scheduled_date` 추가 |
| DB CHECK constraint | 확인 완료: `valid_scope` (`20260312000000_loop17_team_schema.sql:144-148`) → `scope='assigned' ⇔ team_id NOT NULL AND assignee_id NOT NULL`. CellInlineAdd는 `scope: 'assigned'` 확정 |
| API 변경 | 없음 (Supabase REST upsert payload에 `scheduled_date` 키만 포함) |
| 총 예상 LOC | ~850 (신규 ~780 + 수정 ~60) |
| 커밋 수 | 11 (spec §7) |
| 호출산 영향 | `updateTask`/`addTask` 시그니처 불변. 신규 store action 2개(`updateTasksBulk`, `updateMilestone`). 기존 호출처 0 수정 |

---

## 1. 변경 파일 목록

### 1-1. 수정 대상

| 파일 | 지점 (file:line) | 변경 | 요지 |
|------|------------------|------|------|
| `supabase/migrations/20260420_weekly_scheduled_date.sql` | 신규 | 추가 | `scheduled_date date DEFAULT NULL` × 2 |
| `src/hooks/useStore.js` | `:116-135` `taskToRow` | 수정 | `scheduled_date: t.scheduledDate \|\| null` 추가 |
| `src/hooks/useStore.js` | `:188-189` `mapTask` | 수정 | `scheduledDate: r.scheduled_date \|\| null` 추가 |
| `src/hooks/useStore.js` | `:473` loadAll milestone SELECT | 수정 | `scheduled_date` 칼럼 추가 |
| `src/hooks/useStore.js` | `:949` addMilestone SELECT | 수정 | `scheduled_date` 칼럼 추가 |
| `src/hooks/useStore.js` | `:585` 직후 | **신규 action 1** | `updateTasksBulk(ids, patch)` |
| `src/hooks/useStore.js` | `:586` 직후 (updateTasksBulk 뒤) | **신규 action 2** (Rev 3) | `updateMilestone(id, patch)` |
| `src/hooks/useKeyMilestones.js` | `:18` SELECT | 확인만 | `'*'` → 자동 포함 |
| `src/hooks/useMilestonesByProjects.js` | `:34` SELECT | 수정 | `scheduled_date` 칼럼 추가 |
| `src/App.jsx` | `:40` 근처 | 추가 | `WeeklyScheduleView` lazy import |
| `src/App.jsx` | `:64` `VIEW_ORDER` | 수정 | `'team-weekly-schedule'` 삽입 |
| `src/App.jsx` | `:84-94` `views` | 추가 | `'team-weekly-schedule': () => <WeeklyScheduleView />` |
| `src/hooks/useViewUrlSync.js` | `:5-14` `VIEW_TO_PATH` | 추가 | `'team-weekly-schedule': '/team/weekly-schedule'` |
| `src/components/layout/Sidebar.jsx` | `:41-43` `TEAM_ONLY_VIEWS` | 추가 | `{ key: 'weekly-schedule', label: '주간 스케줄', icon: '📅' }` |

### 1-2. 신규 파일

| 파일 | 책임 | 예상 LOC |
|------|------|---------|
| `supabase/migrations/20260420_weekly_scheduled_date.sql` | DB 마이그레이션 | ~10 |
| `src/utils/weekDate.js` | `getISOWeekNumber`, `formatWeekRange`, `toISODateString`, `getWeekDays` (`getMonday`는 re-export) | ~35 |
| `src/hooks/useWeeklySchedule.js` | 주간 네비 + 멤버 로드 + scheduled/backlog 필터 | ~90 (Rev 3: members 로드 로직 추가) |
| `src/components/views/WeeklyScheduleView.jsx` | DndContext + DragOverlay + orchestrator + onDragStart/End + activeDrag state + selectedProjectId lift | ~160 (Rev 3: onDragStart 추가) |
| `src/components/views/weekly-schedule/BacklogPanel.jsx` | 좌 패널 + 토글 + 검색 + 트리 + **useDroppable('backlog')** | ~160 (Rev 3: droppable +10) |
| `src/components/views/weekly-schedule/BacklogItem.jsx` | useDraggable item | ~60 |
| `src/components/views/weekly-schedule/ScheduleGrid.jsx` | 멤버×요일 그리드 + activeDrag prop 전달 | ~100 |
| `src/components/views/weekly-schedule/ScheduleCell.jsx` | useDroppable + 내용 렌더 + **× 버튼** + **R18 멤버 행 하이라이트** | ~120 (Rev 3: × 버튼 +15, 하이라이트 +5) |
| `src/components/views/weekly-schedule/CellInlineAdd.jsx` | "+" 인라인 task 생성 (`scope: 'assigned'`) | ~70 |
| `src/components/views/weekly-schedule/DragPreview.jsx` | DragOverlay 내용 (2deg rotate) | ~40 |

### 1-3. 수정 금지

spec Rev 3 §3-4 그대로 — OutlinerEditor, UnifiedGridView, Matrix/Members/Timeline, InlineAdd, `updateTask` 시그니처.

---

## 2. DB 마이그레이션 SQL

**신규 파일**: `supabase/migrations/20260420_weekly_scheduled_date.sql`

```sql
-- Weekly Schedule 뷰 — scheduled_date 칼럼 추가
-- tasks와 key_milestones 양쪽에 추가. nullable로 기본값 NULL (= 백로그 풀)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;
ALTER TABLE key_milestones ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;

-- 기존 RLS 정책은 '*' select 허용이므로 별도 정책 변경 불필요.
-- 기존 start_date / end_date / due_date 칼럼은 절대 변경 없음.
-- 기존 valid_scope CHECK constraint 영향 없음 (scheduled_date는 scope 판정에 미포함).
```

---

## 3. API 변경 — 없음

Supabase REST endpoint 불변. 단:
- `POST/PATCH /rest/v1/tasks` payload에 `scheduled_date` 필드 포함
- `PATCH /rest/v1/tasks?id=in.(...)` bulk update (updateTasksBulk)
- `PATCH /rest/v1/key_milestones?id=eq.X` update (updateMilestone, Rev 3 신규)

---

## 4. 파일별 상세 변경 (before → after)

### 4-1. `supabase/migrations/20260420_weekly_scheduled_date.sql` (신규)

위 §2 SQL 그대로. 커밋: **commit 1**.

### 4-2. `src/hooks/useStore.js`

#### S1. `taskToRow` (`:116-135`) — camelCase→snake_case 역매핑

**Before** (:131-134):
```js
    // ↓ Loop-26: Key Milestone 연결 ↓
    key_milestone_id: t.keyMilestoneId || null,
    deliverable_id: t.deliverableId || null,
  }
```

**After**:
```js
    // ↓ Loop-26: Key Milestone 연결 ↓
    key_milestone_id: t.keyMilestoneId || null,
    deliverable_id: t.deliverableId || null,
    // ↓ weekly-schedule ↓
    scheduled_date: t.scheduledDate || null,
  }
```

커밋: **commit 2**.

#### S2. `mapTask` (`:171-190`) — DB→store 매핑

**After** (마지막 칼럼 부근 추가):
```js
    scheduledDate: r.scheduled_date || null, // weekly-schedule
```

커밋: **commit 2**.

#### S3. `loadAll` 내 milestone SELECT (`:473`)

**After**:
```js
.select('id, pkm_id, project_id, title, color, sort_order, owner_id, secondary_owner_id, status, start_date, end_date, created_by, parent_id, depth, scheduled_date')
```

커밋: **commit 3**.

#### S4. `addMilestone` SELECT (`:949`)

**After**:
```js
.select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, parent_id, depth, scheduled_date')
```

커밋: **commit 3**.

#### S5. `updateTasksBulk` 신규 (`:585` 직후)

```js
  updateTasksBulk: async (ids, patch) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    // 로컬 먼저 반영 (낙관적). applyTransitionRules 미적용
    // — weekly-schedule에서는 scheduledDate + assigneeId만 전달하며 둘 다 전이 규칙 대상 아님
    set(s => ({
      tasks: s.tasks.map(t => ids.includes(t.id)
        ? { ...t, ...patch, updatedAt: new Date().toISOString() }
        : t)
    }))
    const d = db()
    if (!d) { set({ syncStatus: 'error' }); return }
    set({ syncStatus: 'syncing' })
    // camelCase → snake_case 직접 매핑 (whitelist: scheduled_date, assignee_id만)
    const rowPatch = {}
    if ('scheduledDate' in patch) rowPatch.scheduled_date = patch.scheduledDate || null
    if ('assigneeId' in patch) rowPatch.assignee_id = patch.assigneeId || null
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

커밋: **commit 2**.

#### S6. `updateMilestone` 신규 (`updateTasksBulk` 직후) — Rev 3

**배경**: `useKeyMilestones.update()`는 hook **로컬 state**만 갱신 → `store.milestones`에 반영 안 됨 → `useWeeklySchedule`의 derive 결과에 안 나타남 → 드롭한 MS가 다음 loadAll(10초)까지 셀에 표시 안 됨. 미팅 UX로 치명적.

**삽입 위치**: `updateTasksBulk` 바로 아래. `updateTask` 뒤라 가독성 좋음.

```js
  // 허용 patch 키: { scheduled_date } 만. weekly-schedule 전용 — 범용 사용 금지.
  // 다른 필드(title/status 등) 수정은 기존 useKeyMilestones.update() 사용.
  // id/pkm_id/project_id 같은 PK/FK는 절대 patch에 포함 금지.
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

- patch는 **snake_case**(`scheduled_date` 등) — milestone은 store에서도 raw row(snake_case)이므로 pass-through.
- 기존 `useKeyMilestones.update()`는 건드리지 않음 (다른 뷰 사용 중).

커밋: **commit 2**.

### 4-3. `src/hooks/useKeyMilestones.js`

변경 없음 (`.select('*')` 자동 포함). 커밋 3에서 "확인만" 기록.

### 4-4. `src/hooks/useMilestonesByProjects.js`

#### M1. SELECT (`:34`)

**After**:
```js
.select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, scheduled_date')
```

커밋: **commit 3**.

### 4-5. `src/App.jsx`

- `:40` 근처: `const WeeklyScheduleView = lazy(() => import('./components/views/WeeklyScheduleView'))`
- `:64` `VIEW_ORDER`: `team-weekly` 뒤, `team-timeline` 앞에 `'team-weekly-schedule'` 삽입
- `:84-94` `views`: `'team-members'` 뒤에 `'team-weekly-schedule': () => <WeeklyScheduleView />` 추가

커밋: **commit 11**.

### 4-6. `src/hooks/useViewUrlSync.js`

`:5-14` `VIEW_TO_PATH`에 `'team-weekly-schedule': '/team/weekly-schedule'` 추가. 커밋: **commit 11**.

### 4-7. `src/components/layout/Sidebar.jsx`

`:41-43` `TEAM_ONLY_VIEWS`에 `{ key: 'weekly-schedule', label: '주간 스케줄', icon: '📅' }` 추가. 커밋: **commit 11**.

### 4-8. `src/utils/weekDate.js` (신규)

```js
// Weekly Schedule 뷰용 날짜 유틸. getMonday는 grid/constants.js 재사용.
export { getMonday } from '../components/views/grid/constants'

// 월요일 기준 주 5일 [Mon, Tue, Wed, Thu, Fri] Date 배열
export function getWeekDays(monday) {
  const result = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    d.setHours(0, 0, 0, 0)
    result.push(d)
  }
  return result
}

// ISO 주차 번호 (1-53). 1월 4일 포함 주 = 1주차.
export function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // 그 주의 목요일
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// "4월 20일 ~ 24일 (17주차)" 형식. 월 경계 케이스 처리.
export function formatWeekRange(monday) {
  const days = getWeekDays(monday)
  const friday = days[4]
  const wk = getISOWeekNumber(monday)
  const m1 = monday.getMonth() + 1
  const d1 = monday.getDate()
  const m2 = friday.getMonth() + 1
  const d2 = friday.getDate()
  if (m1 === m2) return `${m1}월 ${d1}일 ~ ${d2}일 (${wk}주차)`
  return `${m1}월 ${d1}일 ~ ${m2}월 ${d2}일 (${wk}주차)` // 월 경계
}

// YYYY-MM-DD ISO date string (scheduled_date 저장용, timezone-free)
export function toISODateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

커밋: **commit 4**.

### 4-9. `src/hooks/useWeeklySchedule.js` (신규) — Rev 3 members 로드 추가

```js
import { useState, useMemo, useCallback, useEffect } from 'react'
import useStore from './useStore'
import useTeamMembers from './useTeamMembers'
import { getMonday, getWeekDays, formatWeekRange, toISODateString } from '../utils/weekDate'

export default function useWeeklySchedule() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return getMonday(today)
  })

  const tasks = useStore(s => s.tasks)
  const milestones = useStore(s => s.milestones)
  const projects = useStore(s => s.projects)
  const currentTeamId = useStore(s => s.currentTeamId)

  // 멤버 로드 (MembersView 패턴 재사용: useTeamMembers.getMembers(teamId))
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!currentTeamId) { setMembers([]); return }
    let cancelled = false
    useTeamMembers.getMembers(currentTeamId).then(m => { if (!cancelled) setMembers(m || []) })
    return () => { cancelled = true }
  }, [currentTeamId])

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart])
  const weekLabel = useMemo(() => formatWeekRange(currentWeekStart), [currentWeekStart])
  const weekDateSet = useMemo(() => new Set(weekDays.map(toISODateString)), [weekDays])

  const teamProjectIds = useMemo(() => new Set(
    projects.filter(p => p.teamId === currentTeamId).map(p => p.id)
  ), [projects, currentTeamId])

  const scheduledTasks = useMemo(() => tasks.filter(t =>
    t.scheduledDate && weekDateSet.has(t.scheduledDate) && teamProjectIds.has(t.projectId) && !t.deletedAt
  ), [tasks, weekDateSet, teamProjectIds])

  const scheduledMilestones = useMemo(() => milestones.filter(m =>
    m.scheduled_date && weekDateSet.has(m.scheduled_date) && teamProjectIds.has(m.project_id)
  ), [milestones, weekDateSet, teamProjectIds])

  const backlogTasks = useMemo(() => tasks.filter(t =>
    !t.scheduledDate && !t.done && teamProjectIds.has(t.projectId) && !t.deletedAt
  ), [tasks, teamProjectIds])

  const backlogMilestones = useMemo(() => milestones.filter(m =>
    !m.scheduled_date && teamProjectIds.has(m.project_id)
  ), [milestones, teamProjectIds])

  const goToPrevWeek = useCallback(() => {
    setCurrentWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
  }, [])
  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
  }, [])
  const goToThisWeek = useCallback(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    setCurrentWeekStart(getMonday(today))
  }, [])

  return {
    members,
    currentWeekStart, weekDays, weekLabel,
    scheduledTasks, scheduledMilestones, backlogTasks, backlogMilestones,
    goToPrevWeek, goToNextWeek, goToThisWeek,
  }
}
```

커밋: **commit 5**.

### 4-10. `src/components/views/WeeklyScheduleView.jsx` (신규) — Rev 3 onDragStart 포함

구조 핵심:
```jsx
const [activeDrag, setActiveDrag] = useState(null)
const [selectedProjectId, setSelectedProjectId] = useState(null) // CellInlineAdd 공유

const { members, weekDays, weekLabel, scheduledTasks, scheduledMilestones, backlogTasks, backlogMilestones, ...nav } = useWeeklySchedule()
const tasks = useStore(s => s.tasks)
const milestones = useStore(s => s.milestones)
const projects = useStore(s => s.projects)
const { updateTask, updateTasksBulk, updateMilestone, addTask } = useStore()
const currentTeamId = useStore(s => s.currentTeamId)

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
)

const handleDragStart = (event) => {
  const { active } = event
  const [kind, id] = active.id.split(':', 2) // edge 2 방어
  if (kind === 'task') {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const project = projects.find(p => p.id === task.projectId)
    setActiveDrag({ kind, id, title: task.text, projectColor: project?.color || null, assigneeId: task.assigneeId || null })
    return
  }
  if (kind === 'ms') {
    const ms = milestones.find(m => m.id === id)
    if (!ms) return
    setActiveDrag({ kind, id, title: ms.title, projectColor: null, assigneeId: null })
  }
}

// Rev 3: teamProjectIds를 hook에서 가져와 cascade 필터에 사용
const teamProjectIds = useMemo(() => new Set(
  projects.filter(p => p.teamId === currentTeamId).map(p => p.id)
), [projects, currentTeamId])

const handleDragEnd = (event) => {
  const { active, over } = event
  setActiveDrag(null)
  if (!over) return
  const [kind, id] = active.id.split(':', 2)

  // 분기 1: 셀 → 백로그
  if (over.id === 'backlog') {
    if (kind === 'task') updateTask(id, { scheduledDate: null })
    if (kind === 'ms') {
      updateMilestone(id, { scheduled_date: null })
      // Rev 3 EC3: teamProjectIds 필터로 타팀 task 배제 (팀 전환 window 방어)
      const childIds = tasks
        .filter(t => t.keyMilestoneId === id && teamProjectIds.has(t.projectId))
        .map(t => t.id)
      if (childIds.length > 0) updateTasksBulk(childIds, { scheduledDate: null })
    }
    return
  }

  // 분기 2: 셀 → 셀
  const overIdStr = typeof over.id === 'string' ? over.id : ''
  if (!overIdStr.startsWith('cell:')) return
  const [, userId, dateISO] = overIdStr.split(':', 3) // Rev 3 W7: userId = profiles.user_id

  // No-op 가드
  if (kind === 'task') {
    const task = tasks.find(t => t.id === id)
    if (task?.scheduledDate === dateISO && task?.assigneeId === userId) return
    updateTask(id, { scheduledDate: dateISO, assigneeId: userId })
    return
  }
  if (kind === 'ms') {
    const ms = milestones.find(m => m.id === id)
    if (ms?.scheduled_date === dateISO) return
    updateMilestone(id, { scheduled_date: dateISO })
    // Rev 3 EC3: teamProjectIds 필터
    const children = tasks.filter(t => t.keyMilestoneId === id && teamProjectIds.has(t.projectId))
    if (children.length > 0) {
      const needDefault = children.filter(t => !t.assigneeId).map(t => t.id)
      const keepAssignee = children.filter(t => t.assigneeId).map(t => t.id)
      if (needDefault.length > 0) updateTasksBulk(needDefault, { scheduledDate: dateISO, assigneeId: userId })
      if (keepAssignee.length > 0) updateTasksBulk(keepAssignee, { scheduledDate: dateISO })
    }
  }
}

// × 버튼 핸들러 (ScheduleCell에서 호출)
const handleUnscheduleTask = (taskId) => updateTask(taskId, { scheduledDate: null })
const handleUnscheduleMS = (msId) => {
  updateMilestone(msId, { scheduled_date: null })
  // Rev 3 EC3: teamProjectIds 필터로 타팀 task 배제
  const childIds = tasks
    .filter(t => t.keyMilestoneId === msId && teamProjectIds.has(t.projectId))
    .map(t => t.id)
  if (childIds.length > 0) updateTasksBulk(childIds, { scheduledDate: null })
}

return (
  <div style={layout}>
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <BacklogPanel
        backlogTasks={backlogTasks} backlogMilestones={backlogMilestones}
        tasks={tasks} milestones={milestones} projects={projects} members={members}
      />
      <ScheduleGrid
        members={members} weekDays={weekDays} weekLabel={weekLabel}
        scheduledTasks={scheduledTasks} scheduledMilestones={scheduledMilestones}
        tasks={tasks} projects={projects}
        activeDrag={activeDrag}
        selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId}
        onUnscheduleTask={handleUnscheduleTask} onUnscheduleMS={handleUnscheduleMS}
        currentTeamId={currentTeamId} addTask={addTask}
        {...nav}
      />
      <DragOverlay dropAnimation={null}>
        {activeDrag ? <DragPreview item={activeDrag} color={activeDrag.projectColor} /> : null}
      </DragOverlay>
    </DndContext>
  </div>
)
```

커밋: **commit 6** (뼈대), **commit 9** (DnD 완성 — onDragStart/End + × 버튼 연결).

### 4-11. `src/components/views/weekly-schedule/BacklogPanel.jsx` (신규)

핵심 추가 (Rev 3): 최외곽 div에 `useDroppable({ id: 'backlog' })` 등록. isOver 시 약한 파란 배경.

```jsx
import { useDroppable } from '@dnd-kit/core'
// ...
const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })
const [mode, setMode] = useState('project') // 'project' | 'member'
const [search, setSearch] = useState('')

// 검색: Task는 text+notes, MS는 title+description
const matches = (item, kind) => {
  if (!search.trim()) return true
  const q = search.toLowerCase()
  if (kind === 'task') return (item.text || '').toLowerCase().includes(q) || (item.notes || '').toLowerCase().includes(q)
  return (item.title || '').toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)
}

return (
  <div ref={setNodeRef} style={{
    width: 230, flexShrink: 0,
    background: isOver ? 'rgba(49,130,206,0.08)' : COLOR.bgSurface,
    borderRight: `0.5px solid ${COLOR.border}`,
    display: 'flex', flexDirection: 'column',
  }}>
    {/* 헤더 + 토글 + 검색 input + 트리 */}
    ...
  </div>
)
```

배치 완료 아이템 스타일:
- Task: `opacity: t.scheduledDate ? 0.3 : 1`, `textDecoration: t.scheduledDate ? 'line-through' : 'none'`
- MS: `opacity: m.scheduled_date ? 0.3 : 1`, `textDecoration: m.scheduled_date ? 'line-through' : 'none'`

커밋: **commit 7**.

### 4-12. `src/components/views/weekly-schedule/BacklogItem.jsx` (신규)

```jsx
import { useDraggable } from '@dnd-kit/core'

export default function BacklogItem({ kind, item, scheduled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${kind}:${item.id}`,
    data: { kind, item },
  })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      opacity: isDragging ? 0.4 : (scheduled ? 0.3 : 1),
      textDecoration: scheduled ? 'line-through' : 'none',
      cursor: 'grab',
      // MS는 보라 배지 스타일, Task는 체크박스+텍스트 (자식에서 렌더)
    }}>
      {/* 아이템 렌더 */}
    </div>
  )
}
```

커밋: **commit 7**.

### 4-13. `src/components/views/weekly-schedule/ScheduleGrid.jsx` (신규)

`gridTemplateColumns: '160px repeat(5, 1fr)'`, sticky left member 열, 오늘 열 `PILL.amber` 배경, 주간 네비 툴바.

**멤버 row 렌더 시 Rev 3 W7 핵심 규칙**:
```jsx
{members.map(member => (
  <React.Fragment key={member.userId}>
    {/* sticky left 열: 멤버 정보 */}
    <div>{member.displayName}</div>
    {/* 요일별 셀 */}
    {weekDays.map(day => (
      <ScheduleCell
        key={`${member.userId}:${toISODateString(day)}`}
        userId={member.userId}                      {/* ← profiles.user_id (tasks.assignee_id와 동일) */}
        dateISO={toISODateString(day)}
        isToday={toISODateString(day) === todayISO}
        tasksInCell={scheduledTasks.filter(t => t.assigneeId === member.userId && t.scheduledDate === toISODateString(day))}
        milestonesInCell={scheduledMilestones.filter(m => m.scheduled_date === toISODateString(day)) /* MS는 assignee 없으므로 모든 멤버 행에 중복 표시? → 아니, 스펙 재확인 필요 */}
        activeDrag={activeDrag}
        {...handlers}
      />
    ))}
  </React.Fragment>
))}
```

**MS 렌더 주의**: MS는 assignee 개념이 없으므로 그리드 셀 (멤버×요일) 매핑이 모호하다. **해결**: MS는 어느 한 멤버 행에 표시 (예: `assignedToRow` 규칙 없이 첫 번째 멤버 행, 또는 별도 "프로젝트 MS" 전용 행). spec §5-9 명시 필요 — **Rev 3 추가 결정**: **MS는 프로젝트의 owner_id가 있으면 해당 user의 행에, 없으면 첫 번째 멤버 행에 표시**. 추후 spec §5-9 갱신.

> 임시: 이 diff-plan은 ScheduleGrid가 MS를 멤버별로 라우팅하는 책임을 갖는 것으로 명세. 구현 시 `milestonesInCell` 필터 로직 상세는 ScheduleGrid 내부에서 owner 기반 분배 결정.

커밋: **commit 8**.

### 4-14. `src/components/views/weekly-schedule/ScheduleCell.jsx` (신규) — Rev 3: × 버튼 + 하이라이트

```jsx
import { useDroppable } from '@dnd-kit/core'

export default function ScheduleCell({
  userId,                         // Rev 3 W7: profiles.user_id = tasks.assignee_id
  dateISO, isToday, tasksInCell, milestonesInCell,
  projects, tasks, activeDrag, onUnscheduleTask, onUnscheduleMS,
  selectedProjectId, setSelectedProjectId, currentTeamId, addTask,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${userId}:${dateISO}`,   // Rev 3 W7: cell id에 userId 사용
    data: { userId, dateISO },
  })
  const [showInlineAdd, setShowInlineAdd] = useState(false)
  const [hover, setHover] = useState(false)

  // R18 (Rev 3 W2): 드래그 중인 task의 *현재* assignee와 같은 행 하이라이트
  // 목적지 하이라이트는 isOver로 별도 처리
  const rowHighlight = activeDrag?.kind === 'task' && activeDrag.assigneeId === userId
  const todayBg = isToday ? 'rgba(250,238,218,0.25)' : 'transparent' // amber 투명
  const dragBg = isOver ? 'rgba(49,130,206,0.08)' : (rowHighlight ? 'rgba(49,130,206,0.05)' : todayBg)

  // Rev 3 W6: 프로젝트별 그룹핑 + updatedAt desc 정렬 (ScheduleCell 로컬 헬퍼, spec §5-9 명세)
  // _kind discriminator: task/MS 구분 (task=camelCase, MS=snake_case)
  // _updatedAt: task는 t.updatedAt, MS는 m.updated_at — 혼재 정렬용
  const groupedByProject = groupByProjectId(tasksInCell, milestonesInCell, projects)
  const groupsSorted = sortGroupsByNewestUpdate(groupedByProject)

  return (
    <div ref={setNodeRef}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        minHeight: 120,
        background: dragBg,
        outline: isOver ? '1.5px dashed #3182CE' : 'none',
        border: `0.5px solid ${COLOR.border}`,
        padding: 6,
        position: 'relative',
      }}
    >
      {groupsSorted.map(group => (
        <div key={group.projectId}>
          <div style={{ fontSize: 11, color: COLOR.textSecondary }}>{group.projectName}</div>
          {group.items.map(item => (
            <CellItem key={item.id} item={item} onRemove={() => {
              if (item._kind === 'task') onUnscheduleTask(item.id)
              else onUnscheduleMS(item.id)
            }} />
          ))}
        </div>
      ))}
      {/* "+" 버튼 → CellInlineAdd */}
      {hover && <button onClick={() => setShowInlineAdd(true)}>＋</button>}
      {showInlineAdd && <CellInlineAdd
        userId={userId} dateISO={dateISO}   /* Rev 3 W7: userId (profiles.user_id) */
        projects={projects.filter(p => p.teamId === currentTeamId)}
        selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId}
        currentTeamId={currentTeamId} addTask={addTask}
        onClose={() => setShowInlineAdd(false)}
      />}
    </div>
  )
}

// CellItem: hover 시 × 버튼 노출
function CellItem({ item, onRemove }) {
  const [hover, setHover] = useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* item 본문 렌더 (MS 보라 배지 or Task 체크박스+텍스트) */}
      {hover && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#ccc', padding: 2, fontSize: 12,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
          onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
          aria-label="미배정으로 되돌리기"
        >×</button>
      )}
    </div>
  )
}
```

커밋: **commit 8** (Cell 구조), **commit 9** (× 버튼 onUnschedule 연결 — onDragEnd 완성과 함께).

### 4-15. `src/components/views/weekly-schedule/CellInlineAdd.jsx` (신규) — Rev 3: scope 'assigned'

```jsx
export default function CellInlineAdd({
  userId,                         // Rev 3 W7: profiles.user_id = tasks.assignee_id
  dateISO, projects, selectedProjectId, setSelectedProjectId,
  currentTeamId, addTask, onClose,
}) {
  const [text, setText] = useState('')

  const handleEnter = () => {
    if (!selectedProjectId || !text.trim()) return // 가드
    // ⚠ 중요 (Rev 3 W5): useStore.addTask는 applyTransitionRules를 호출하지 않음
    // (updateTask만 호출). 따라서 scope/assigneeId/teamId 3개 조합을 호출자가 직접 책임.
    // DB CHECK constraint(valid_scope): scope='assigned' ↔ team_id NOT NULL AND assignee_id NOT NULL
    // 누락/잘못된 조합은 INSERT 실패.
    addTask({
      text: text.trim(),
      projectId: selectedProjectId,
      assigneeId: userId,                // tasks.assignee_id에 저장됨 (profiles.user_id)
      scheduledDate: dateISO,            // camelCase (mapTask/taskToRow 컨벤션)
      category: 'today',
      teamId: currentTeamId,              // DB CHECK: assigned ↔ team_id NOT NULL
      scope: 'assigned',                  // DB CHECK: assigned ↔ assignee_id NOT NULL
    })
    setText('') // 연속 입력 가능, selectedProjectId 유지
  }

  return (
    <div style={{ display: 'flex', gap: 4, padding: 4 }}>
      <select value={selectedProjectId || ''} onChange={e => setSelectedProjectId(e.target.value || null)}>
        <option value="">프로젝트 선택</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input autoFocus value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); handleEnter() }
          if (e.key === 'Escape') onClose()
        }}
        onBlur={() => { if (!text.trim()) onClose() }}
        placeholder="태스크 내용..."
      />
    </div>
  )
}
```

커밋: **commit 10**.

### 4-16. `src/components/views/weekly-schedule/DragPreview.jsx` (신규)

```jsx
export default function DragPreview({ item, color }) {
  const isMS = item.kind === 'ms'
  return (
    <div style={{
      padding: '4px 10px',
      border: `1px solid ${color || '#3182CE'}`,
      borderRadius: 6,
      transform: 'rotate(2deg)',
      background: isMS ? '#EEEDFE' : '#ffffff',
      color: isMS ? '#534AB7' : '#2c2c2a',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontSize: 13,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      maxWidth: 260,
      zIndex: 9999,
    }}>
      {item.title}
    </div>
  )
}
```

MS 드래그는 보라 배지 스타일, Task는 흰 배경 + 프로젝트 색 border.

커밋: **commit 9**.

---

## 5. 작업 순서 (커밋 단위, R-ATOMIC)

| # | 커밋 | 파일 | 검증 |
|---|------|------|------|
| **1** | DB migration | `supabase/migrations/20260420_weekly_scheduled_date.sql` | Supabase Table Editor `scheduled_date` 칼럼 확인 |
| **2** | 스토어: mapTask + taskToRow + **updateTasksBulk** + **updateMilestone** (Rev 3) | `src/hooks/useStore.js` (:116, :171, :585 신규 2개 action) | `npm run build` 성공, DevTools `useStore.getState().updateTasksBulk` / `updateMilestone` 존재 |
| **3** | Milestone SELECT 3곳 | `src/hooks/useStore.js` (:473, :949), `src/hooks/useMilestonesByProjects.js` (:34) | `npm run build` 성공, loadAll 후 store 내 milestone에 `scheduled_date` 필드 존재 |
| **4** | 날짜 유틸 | `src/utils/weekDate.js` | `getISOWeekNumber(new Date('2026-04-20')) === 17` |
| **5** | 데이터 hook (members 포함) | `src/hooks/useWeeklySchedule.js` | `npm run build` 성공 |
| **6** | WeeklyScheduleView 뼈대 + 하위 컴포넌트 스텁 | `WeeklyScheduleView.jsx` + `BacklogPanel/ScheduleGrid` stub | 임시 수동 import로 렌더 확인 |
| **7** | BacklogPanel 완성 (+ **useDroppable('backlog')**) | `BacklogPanel.jsx`, `BacklogItem.jsx` | 토글/검색/트리 렌더 |
| **8** | ScheduleGrid + Cell (+ **× 버튼 + R18 하이라이트 자리**) | `ScheduleGrid.jsx`, `ScheduleCell.jsx` | 멤버×요일 렌더, sticky, amber 오늘 하이라이트 |
| **9** | DnD 완성 (**onDragStart**, onDragEnd, **× 버튼 연결**, DragPreview, **W7 userId 통일**, **EC3 teamProjectIds 필터**) | `WeeklyScheduleView.jsx` 핸들러, `DragPreview.jsx`, `ScheduleCell` | 모든 DnD 시나리오 + R18 멤버 행 하이라이트 + × 버튼 작동 + **grep으로 `memberId` 잔존 없음 확인** |
| **10** | CellInlineAdd (scope='assigned') | `CellInlineAdd.jsx` + 상위 state | "+" → 프로젝트 선택 → Enter → 새 task (scope='assigned' DB CHECK 통과) |
| **11** | 라우팅 + 사이드바 | `App.jsx`, `useViewUrlSync.js`, `Sidebar.jsx` | 사이드바 진입, URL 동기화, 최종 `npm run build` 성공 |

**배포 경계**: R-ATOMIC이지만 commit 1~11 모두 한 PR로 묶어 merge. 단독 배포 금지.

---

## 6. 검증 절차

### 6-1. 자동
- `npm run build` 각 커밋 후 성공 (commit 1은 SQL만이라 skip)
- 기존 뷰 무영향 회귀

### 6-2. 수동 (spec §8 T1~T19 전부)

**Rev 3 신규 케이스 특화**:
- **T1 확장**: MS 드래그 시 `updateMilestone` 경로로 store.milestones 즉시 갱신되어 다음 폴링 없이 셀에 MS 표시
- **R18 (T-R18 신규)**: 담당자별 모드 task 드래그 시 해당 assignee 행 전체에 약한 파란 배경
- **× 버튼 (T-X 신규)**: 셀 아이템 hover → × 클릭 → 즉시 백로그 풀로 이동 (MS면 cascade)
- **BacklogPanel 드롭 (T-B 신규)**: 셀에서 백로그 패널로 드래그 → 패널 전체 파란 배경 피드백 → 드롭 시 scheduled_date=null
- **CellInlineAdd (T6 정정)**: scope='assigned' + assignee_id=**userId** (member.userId=profiles.user_id) + scheduled_date=dateISO 로 DB에 INSERT, `valid_scope` CHECK 통과 검증 (Supabase Table Editor에서 row 확인)

**Rev 3 신규 회귀 테스트**:
- **T20 (W7 회귀)**: 본인 assigned task를 같은 user 행의 다른 날짜로 이동 → no-op 미발동(date 다름), updateTask 호출됨. `tasks.assignee_id`(user_id)와 `cell:${userId}:...`의 userId가 동일 uuid인지 확인
- **T21 (R18)**: 담당자별 모드에서 Ed(userId=U1)의 task 드래그 시작 → U1 행 셀들 모두 `rgba(49,130,206,0.05)`, 다른 유저 행은 배경 변화 없음. 목적지 셀만 isOver로 진한 파랑
- **T22 (EC3)**: 팀 A→B 전환 1초 이내 MS 드롭 → 로컬 store.tasks에 A팀 잔존 task가 있어도 cascade에서 제외 (`teamProjectIds.has(t.projectId)` 필터)

---

## 7. 리스크 & 완화 (Rev 3 업데이트)

| # | 리스크 | 완화 |
|---|--------|------|
| D1 | `updateTasksBulk`의 `applyTransitionRules` 미적용으로 오용 | rowPatch whitelist(`scheduledDate`/`assigneeId`만). 다른 필드는 silently ignored |
| D2 | MS cascade partial failure (`updateMilestone` + `updateTasksBulk` 2개 쿼리) | 트랜잭션 없음. 실패 시 syncStatus='error' + 다음 loadAll 복구. 후속 phase에서 Supabase RPC로 묶기 가능 |
| D3 | milestone SELECT 3곳 중 하나 누락 시 scheduled_date 미로드 → 빈 셀 | commit 3에서 3곳(`:473`, `:949`, `useMilestonesByProjects.js:34`) 모두 동시 반영. 검증: loadAll 후 DevTools에서 milestone 객체 확인 |
| D4 | `taskToRow` 누락 시 drop해도 DB 미반영 | commit 2가 mapTask + taskToRow + bulk + updateMilestone 동시 반영 |
| D5 | DragOverlay z-index 충돌 | `z-index: 9999` |
| D6 | PointerSensor 5px와 셀 내 체크박스/× 버튼 클릭 충돌 | 체크박스/× 버튼은 `<button>` + `e.stopPropagation()` |
| D7 | CellInlineAdd projectId 상위 lift 누락 | WeeklyScheduleView가 `selectedProjectId` state 보유, 모든 ScheduleCell에 props drill |
| D8 | ISO 주차 연 경계 | 알고리즘 표준(목요일 기준) |
| D9 | `scheduled_date` timezone 불일치 | `toISODateString()` YYYY-MM-DD only |
| D10 | milestone snake_case vs task camelCase 혼용 실수 | spec §5-7 patch 컨벤션 명시. 리뷰 시 grep 체크 |
| D11 | `scope='assigned'` assumption이 깨질 가능성 | DB `valid_scope` CHECK 확인 완료(`:144-148`). CellInlineAdd는 assigneeId 있는 task만 생성하므로 assigned 확정 |
| D12 (Rev 3) | `updateMilestone`이 `useKeyMilestones`의 로컬 state와 불일치 | WeeklyScheduleView는 `updateMilestone` (store)만 사용. 다른 뷰는 기존 hook 사용. 서로 독립 state, 동일 DB row 참조라 다음 loadAll에서 정합 |
| D13 (Rev 3) | × 버튼 클릭 시 `updateMilestone` + `updateTasksBulk` 2회 쿼리 | D2와 동일. partial failure 시 복구 경로 동일 |
| D14 (Rev 3) | `useWeeklySchedule`의 `members` 로드가 async — 초기 렌더에서 빈 그리드 | spec §3-5 E2 처리: "팀 멤버가 없습니다" 메시지는 members.length === 0이면 표시. 로딩 중 한 프레임 빈 그리드는 허용 |
| D15 (Rev 3) | `split(':', 2)` 보장에도 cell 드롭존은 `cell:userId:dateISO` 3조각이라 `split(':', 3)` 필요 | onDragEnd 분기 2에서 `overIdStr.split(':', 3)`로 명시 처리 |
| **D16** (Rev 3 W7) | **ScheduleGrid/ScheduleCell에서 `member.id` vs `member.userId` 혼동**으로 assignee 매칭 전부 깨짐 | `cell:${member.userId}:${dateISO}` 확정. `ScheduleCell` props는 `userId`로 명명. onDragEnd `split` 변수명도 `userId`. assigneeId 비교도 userId로 통일 |
| **D17** (Rev 3 W2) | R18 하이라이트 의미 모호 (현재 assignee vs 목적지) | 현재 assignee로 확정. 목적지는 isOver로 별도. spec §5-9 명시 |
| **D18** (Rev 3 EC3) | 팀 전환 직후 loadAll 전 window에 타팀 task가 cascade에 포함 | MS cascade 경로 3곳(onDragEnd 분기 1/2, handleUnscheduleMS) 모두 `teamProjectIds.has(t.projectId)` 필터 적용 |
| **D19** (Rev 3 W5) | `useStore.addTask`가 `applyTransitionRules` 미경유 — scope/assigneeId/teamId 3개 조합 누락 시 DB CHECK 실패 | CellInlineAdd가 3개 모두 명시 전달 + 주석으로 향후 기여자에게 경고 |
| **D20** (Rev 3 W1) | `updateMilestone` patch whitelist 없어 PK/FK 오염 위험 | 주석으로 허용 key(`scheduled_date`)만 명시. 재사용 시 whitelist 추가 |
| **D21** (Rev 3 MS 행 라우팅) | MS는 assignee 개념 없으므로 멤버×요일 그리드 어느 셀에 표시할지 모호 | 임시 결정: MS `owner_id` 있으면 해당 user 행, 없으면 첫 번째 멤버 행. spec §5-9 갱신 + 구현 시 별도 로직 |

---

## 8. Out of Scope

spec §9 그대로. 추가로:
- `updateMilestone` 이후 다른 뷰(ProjectView)에서 같은 MS 수정 시 store state stale 가능성 → 다음 loadAll(10초)에서 복구. 실시간 sync는 후속 phase.

---

## 9. 다음 단계

1. diff-reviewer subagent 리뷰 → 결함 수정 후
2. `/execute weekly-schedule` 실행 → 11개 커밋 순차 생성
