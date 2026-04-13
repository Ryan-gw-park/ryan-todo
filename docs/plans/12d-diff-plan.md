# Phase 12d Diff Plan — 팀원 뷰 신규 + 정/부 담당자 시스템

> 작성일: 2026-04-13
> 기준: `12d-spec-v2.md` (확정)
> 상태: 리뷰 반영 v2

## 리뷰 반영 (v1 → v2)

| 이슈 | 해결 |
|------|------|
| [C1] cascade rollback이 secondary 미처리 | prevStates를 `msField` 기반 분기 저장/복원 |
| [C2] task cascade 로직 없음 (spec은 있다고 가정) | **task cascade 신규 구현** — MS 하위 task의 assignee/secondary 업데이트 |
| [C3] B안 `{ task, isSecondary }` wrapper로 렌더 파탄 | OwnerGroupView 렌더 블록 전체 재작성 |
| [C4] DetailPanel members state 없음 | useState + useEffect로 members 로드 추가 |
| [W2] MilestoneRow StackedAvatar 코드 누락 | Step 5에 MilestoneRow 수정 명시 |
| [W3] Sidebar key 불일치 | diff plan `key: 'members'` 유지 (prefix 자동) |
| [W5] collapseState.membersView 2중 중첩 | `memberId:projectId` 복합키 |
| [W6] cascade overwrite+secondary 조합 | msField 기반 분기 |
| [W7] VIEW_ORDER 미포함 | Step 8에 추가 |

---

## 0. 전제 요약

- DB: `secondary_assignee_id` (tasks) + `secondary_owner_id` (milestones) 추가
- Store: mapTask/taskToRow 매핑 + cascade ownerType 파라미터
- 신규: StackedAvatar, DualAssigneeSelector, MembersView
- 패치: TeamMatrixGrid (12c), MilestoneRow, DetailPanel
- 라우팅: Sidebar "팀원" + App.jsx views
- DnD: MembersView v1 비활성 (I1)
- 커밋 9개 (spec §6 R-ATOMIC)

---

## Step 1: DB 마이그레이션

**파일**: `supabase/migrations/20260413_secondary_assignee.sql` (신규)

```sql
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS secondary_assignee_id uuid DEFAULT NULL;

ALTER TABLE key_milestones 
  ADD COLUMN IF NOT EXISTS secondary_owner_id uuid DEFAULT NULL 
  REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_tasks_secondary_assignee 
  ON tasks(secondary_assignee_id) 
  WHERE secondary_assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ms_secondary_owner 
  ON key_milestones(secondary_owner_id) 
  WHERE secondary_owner_id IS NOT NULL;
```

**커밋**: `feat(db): add secondary_assignee_id + secondary_owner_id (12d-1)`

---

## Step 2: Store 변경

**파일**: `src/hooks/useStore.js`

### 변경 1 — mapTask (line ~179):
```diff
     assigneeId: r.assignee_id || null,
+    secondaryAssigneeId: r.secondary_assignee_id || null,
     createdBy: r.created_by || null,
```

### 변경 2 — taskToRow (line ~124):
```diff
     assignee_id: t.assigneeId || null,
+    secondary_assignee_id: t.secondaryAssigneeId || null,
     created_by: t.createdBy || null,
```

### 변경 3 — milestones SELECT (line ~469):
현재: `.select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, parent_id, depth')`
```diff
-.select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, parent_id, depth')
+.select('id, pkm_id, project_id, title, color, sort_order, owner_id, secondary_owner_id, status, start_date, end_date, created_by, parent_id, depth')
```

### 변경 4 — _defaultCollapseState:
```diff
   teamMatrixMs: {},
+  membersView: {},   // 'memberId:projectId' 복합키 → boolean (2중 중첩 아닌 flat)
   timeline: {},
```
> [W5 해결] 기존 `toggleCollapse('membersView', key)` 단일 레벨 API 재사용. key를 `${memberId}:${projectId}` 복합 문자열로 구성.

### 변경 5 — cascadeMilestoneOwner 시그니처 변경:
```diff
-cascadeMilestoneOwner: async (msId, ownerId, { overwrite = false } = {}) => {
+cascadeMilestoneOwner: async (msId, ownerId, { overwrite = false, ownerType = 'primary' } = {}) => {
```

내부 로직 상세:
```js
// ownerType에 따라 대상 필드 분기
const msField = ownerType === 'secondary' ? 'secondary_owner_id' : 'owner_id'
const taskField = ownerType === 'secondary' ? 'secondaryAssigneeId' : 'assigneeId'
const taskDbField = ownerType === 'secondary' ? 'secondary_assignee_id' : 'assignee_id'

// 중복 방지: 정==부 동일인 시 거부
if (ownerType === 'secondary') {
  const ms = milestones.find(m => m.id === msId)
  if (ms && ms.owner_id === ownerId) return { prevStates: [], error: 'duplicate' }
}
if (ownerType === 'primary') {
  const ms = milestones.find(m => m.id === msId)
  if (ms && ms.secondary_owner_id === ownerId) {
    await get().updateMilestone(msId, { secondary_owner_id: null })
  }
}
```

**[C1 해결] rollback 분기**: prevStates를 `msField` 기반으로 저장:
```js
const prevStates = targetIds.map(id => {
  const m = milestones.find(ms => ms.id === id)
  return { id, [msField]: m?.[msField] || null }
})
```
rollback set() 블록도 동일 필드 사용:
```js
set(s => ({
  milestones: s.milestones.map(m => {
    const prev = prevStates.find(p => p.id === m.id)
    return prev ? { ...m, [msField]: prev[msField] } : m
  })
}))
```

**[C2 해결] task cascade 신규 구현**:
기존 cascadeMilestoneOwner는 하위 MS만 cascade. spec §4-2-c는 "MS 내 모든 task의 assignee/secondary도 cascade" 요구.

cascade 동작 내에 task 업데이트 추가:
```js
// MS cascade 후, 해당 MS + 하위 MS의 모든 task도 업데이트
const allMsIds = [msId, ...targetIds]
const { tasks } = get()
const targetTasks = tasks.filter(t => allMsIds.includes(t.keyMilestoneId) && !t.deletedAt)

// overwrite=false: taskField가 null인 task만 대상
const taskTargets = overwrite
  ? targetTasks
  : targetTasks.filter(t => !t[taskField])

if (taskTargets.length > 0) {
  // 로컬 즉시 반영
  set(s => ({
    tasks: s.tasks.map(t =>
      taskTargets.some(tt => tt.id === t.id) ? { ...t, [taskField]: ownerId } : t
    )
  }))
  // DB 업데이트
  for (const t of taskTargets) {
    await d.from('tasks')
      .update({ [taskDbField]: ownerId, updated_at: new Date().toISOString() })
      .eq('id', t.id)
  }
}
```

**[W6 해결] overwrite + secondary 조합**: overwrite 분기에서 `m[msField]`로 해당 필드만 체크:
```js
const taskTargets = overwrite
  ? targetTasks
  : targetTasks.filter(t => !t[taskField])  // secondary 모드면 secondary 필드만 체크
```

**커밋**: `feat(store): add secondary fields + cascade dual ownerType with task cascade (12d-2)`

---

## Step 3: StackedAvatar 신규

**파일**: `src/components/shared/StackedAvatar.jsx` (신규)

```jsx
import MiniAvatar from '../views/grid/shared/MiniAvatar'

export default function StackedAvatar({ primary, secondary, size = 16, showLabel = true, onClick }) {
  if (!secondary) {
    return (
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: onClick ? 'pointer' : 'default' }}>
        <MiniAvatar name={primary.name} size={size} color={primary.color} />
        {showLabel && <span style={{ fontSize: 11, color: '#6b6a66' }}>{primary.name}</span>}
      </div>
    )
  }
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <MiniAvatar name={primary.name} size={size} color={primary.color} />
        <div style={{ marginLeft: -size * 0.35, border: '1.5px solid #fff', borderRadius: '50%' }}>
          <MiniAvatar name={secondary.name} size={size} color={secondary.color} />
        </div>
      </div>
      {showLabel && <span style={{ fontSize: 11, color: '#6b6a66' }}>{primary.name}</span>}
    </div>
  )
}
```

**커밋**: `feat(shared): add StackedAvatar component (12d-3)`

---

## Step 4: DualAssigneeSelector 신규

**파일**: `src/components/shared/DualAssigneeSelector.jsx` (신규)

두 모드: `mode='full'` (DetailPanel 인라인) + `mode='popover'` (아바타 클릭)

### Props:
```js
{ primaryId, secondaryId, members, onChangePrimary, onChangeSecondary, mode, onClose }
```

### full 모드:
- 정담당 dropdown + 부담당 dropdown (또는 "+ 부담당자 추가" 버튼)
- 부담당 제거(×) 버튼
- 정==부 시도 시 경고 toast

### popover 모드:
- 두 섹션 (정/부) 분리 radio 리스트
- 부담당 섹션에서 정담당 멤버 disabled
- "미배정"/"(없음)" 옵션
- 외부 클릭 닫힘

**커밋**: `feat(shared): add DualAssigneeSelector with full + popover modes (12d-4)`

---

## Step 5: TeamMatrixGrid 패치 (task/MS 행)

**파일**: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

### 변경 1 — TeamTaskRow에서 TaskAssigneeChip → StackedAvatar (line ~99):

```diff
-{!msTag && (
-  <TaskAssigneeChip
-    taskId={task.id}
-    assigneeId={task.assigneeId}
-    members={members}
-    onChangeAssignee={(userId) => updateTask(task.id, { assigneeId: userId, scope: userId ? 'assigned' : 'team' })}
-    size={14}
-  />
-)}
+{!msTag && (
+  task.secondaryAssigneeId ? (
+    <StackedAvatar
+      primary={getMemberInfo(task.assigneeId)}
+      secondary={getMemberInfo(task.secondaryAssigneeId)}
+      size={14}
+      onClick={() => openPopover(task.id)}
+    />
+  ) : (
+    <TaskAssigneeChip ... />  // 기존 단일 owner 유지
+  )
+)}
```

> `getMemberInfo(userId)` 헬퍼: members + memberColorMap 클로저에서 `{ name, color, userId }` 반환. null 방어: `userId ? { ... } : null`.
> `openPopover(taskId)` — `useState({ taskId, anchorEl })` state 관리 → DualAssigneeSelector mode='popover' 렌더.

### 변경 2 — import 추가:
```js
import StackedAvatar from '../../../shared/StackedAvatar'
import DualAssigneeSelector from '../../../shared/DualAssigneeSelector'
```

### 변경 3 — MilestoneRow에 StackedAvatar 추가 ([W2 해결]):

**파일**: `src/components/views/grid/cells/MilestoneRow.jsx`

Props 추가:
```diff
 export default function MilestoneRow({
   ms, taskCount, aliveCount, totalCount, accentColor, isEmpty,
+  ownerId, secondaryOwnerId, members, memberColorMap,
   collapsed, onToggleCollapse, ...
```

alive/total pill 뒤 (line 143~145 사이)에 StackedAvatar 삽입:
```jsx
{/* Owner badge (있을 때만) */}
{ownerId && (
  <StackedAvatar
    primary={getMemberInfo(ownerId, members, memberColorMap)}
    secondary={secondaryOwnerId ? getMemberInfo(secondaryOwnerId, members, memberColorMap) : null}
    size={14}
    showLabel={false}
  />
)}
```

MsGroupView 호출부에서 MilestoneRow에 새 props 전달:
```diff
 <MilestoneRow
   ms={g.ms}
   ...
+  ownerId={g.ms.owner_id}
+  secondaryOwnerId={g.ms.secondary_owner_id}
+  members={members}
+  memberColorMap={memberColorMap}
```

**커밋**: `feat(team-matrix): patch task/MS rows with stacked avatar + popover (12d-5)`

---

## Step 6: B안 부담당 이중 출현

**파일**: `src/components/views/grid/grids/TeamMatrixGrid.jsx` (OwnerGroupView)

### 변경 — OwnerGroupView에서 부담당 task를 양쪽 sub-section에 출현:

기존: `projTasks.forEach(t => { groups[t.assigneeId || '__unassigned__'].push(t) })`

**[C3 해결]** OwnerGroupView 그룹핑 + 렌더 전체 재작성:

```js
// 그룹핑: { task, isSecondary } wrapper 사용
const ownerGroups = useMemo(() => {
  const groups = {}
  // 정담당 그룹핑
  projTasks.forEach(t => {
    const key = t.assigneeId || '__unassigned__'
    if (!groups[key]) groups[key] = { primary: [], secondary: [] }
    groups[key].primary.push(t)
  })
  // 부담당 그룹핑 (별도 배열)
  projTasks.forEach(t => {
    if (t.secondaryAssigneeId) {
      const key = t.secondaryAssigneeId
      if (!groups[key]) groups[key] = { primary: [], secondary: [] }
      groups[key].secondary.push(t)
    }
  })
  // 정렬: 미배정 먼저, 나머지 정담당 task 수 내림차순
  const unassigned = groups['__unassigned__'] || { primary: [], secondary: [] }
  delete groups['__unassigned__']
  const sorted = Object.entries(groups).sort((a, b) => b[1].primary.length - a[1].primary.length)
  const result = []
  if (unassigned.primary.length > 0) result.push({ userId: '__unassigned__', ...unassigned })
  sorted.forEach(([uid, g]) => result.push({ userId: uid, ...g }))
  return result
}, [projTasks])
```

렌더 코드:
```jsx
{ownerGroups.map(g => {
  const primaryCount = g.primary.length
  const secondaryCount = g.secondary.length
  return (
    <div key={g.userId}>
      {/* Sub-section 헤더 */}
      <div style={{ ... }}>
        <MiniAvatar ... /> {displayName}
        <span>{primaryCount}{secondaryCount > 0 ? ` +부 ${secondaryCount}` : ''}</span>
      </div>
      {/* 정담당 task */}
      {g.primary.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(t => (
        <TeamTaskRow key={t.id} task={t} ... msTag={getMsName(t.keyMilestoneId)} />
      ))}
      {/* 부담당 task (muted) */}
      {g.secondary.length > 0 && g.secondary.map(t => (
        <div key={`${t.id}-secondary`} style={{ opacity: 0.55, boxShadow: 'inset 2px 0 0 #e8e6df' }}>
          <TeamTaskRow task={t} ... msTag={getMsName(t.keyMilestoneId)} />
          <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: 3 }}>
            정 {getPrimaryName(t.assigneeId)}
          </span>
        </div>
      ))}
      <InlineAdd ... />
    </div>
  )
})}
```

> 핵심: `primary`와 `secondary` 배열을 분리하여 기존 `t.id`, `t.sortOrder` 접근이 정상 동작. wrapper 객체 아님.

**커밋**: `feat(team-matrix): B안 부담당 이중 출현 with muted styling (12d-6)`

---

## Step 7: MembersView 신규

**파일**: `src/components/views/MembersView.jsx` (신규)

대규모 신규 컴포넌트:
- 멤버 컬럼 240px, 가로 스크롤 (TimelineGrid 패턴)
- 컬럼 헤더 sticky
- mount-time stable order (task 수 내림차순)
- 프로젝트별 task 그룹핑 + 접기
- 부담당 섹션 (dashed divider + muted)
- DnD 비활성
- 밀도 토글 (localStorage)
- edge case: 정0+부N, 빈 컬럼

**커밋**: `feat(views): add MembersView with stable mount-time sort (12d-7)`

---

## Step 8: Sidebar + App.jsx 라우팅

**파일**: `src/components/layout/Sidebar.jsx`, `src/App.jsx`

### Sidebar — TASK_VIEWS에 추가:
```diff
 const TASK_VIEWS = [
   { key: 'matrix',   label: '매트릭스',   icon: '⊞' },
   { key: 'weekly',   label: '주간 플래너', icon: '📅' },
   { key: 'timeline', label: '타임라인',   icon: '▤' },
+  { key: 'members',  label: '팀원',       icon: '👥' },
 ]
```

> 사이드바 렌더링에서 `team-${v.key}` → `team-members`로 매핑.

### App.jsx — views 객체에 추가:
```diff
 const MembersView = lazy(() => import('./components/views/MembersView'))

 const views = useMemo(() => ({
   ...
+  'team-members': () => <MembersView />,
   ...
 }), [])
```

### [W7 해결] App.jsx — VIEW_ORDER에 추가:
```diff
 const VIEW_ORDER = [..., 'team-timeline', 'team-weekly',
+  'team-members',
 ]
```
> 모바일: `team-members`는 모바일 리다이렉트 로직에서 `personal-matrix`로 전환 (기존 team-* 패턴 동일)

**커밋**: `feat(sidebar): add 팀원 menu + App.jsx view registration (12d-8)`

---

## Step 9: DetailPanel DualAssigneeSelector

**파일**: `src/components/shared/DetailPanel.jsx`

### 변경 — AssigneeSelector → DualAssigneeSelector (line ~192):

```diff
-import AssigneeSelector from './AssigneeSelector'
+import DualAssigneeSelector from './DualAssigneeSelector'

 {currentTeamId && (
   <DetailRow label="담당자">
-    <AssigneeSelector task={task} onUpdate={(patch) => updateTask(task.id, patch)} />
+    <DualAssigneeSelector
+      mode="full"
+      primaryId={task.assigneeId}
+      secondaryId={task.secondaryAssigneeId}
+      members={members}
+      onChangePrimary={(id) => updateTask(task.id, { assigneeId: id, scope: id ? 'assigned' : 'team' })}
+      onChangeSecondary={(id) => updateTask(task.id, { secondaryAssigneeId: id })}
+    />
   </DetailRow>
 )}
```

**[C4 해결]** DetailPanel에 members state 추가:
```js
// DetailPanel 함수 내부, 기존 useEffect들 근처
const [dpMembers, setDpMembers] = useState([])
useEffect(() => {
  if (!currentTeamId) { setDpMembers([]); return }
  useTeamMembers.getMembers(currentTeamId).then(setDpMembers)
}, [currentTeamId])
```

DualAssigneeSelector 호출:
```jsx
<DualAssigneeSelector
  mode="full"
  primaryId={task.assigneeId}
  secondaryId={task.secondaryAssigneeId}
  members={dpMembers}
  onChangePrimary={(id) => updateTask(task.id, { assigneeId: id, scope: id ? 'assigned' : 'team' })}
  onChangeSecondary={(id) => updateTask(task.id, { secondaryAssigneeId: id })}
/>
```

> 기존 AssigneeSelector.jsx는 삭제하지 않음 (DELETE-5 확인 후 결정). grep 결과 DetailPanel만 사용.

MS DetailModal에도 DualAssigneeSelector 추가 (MS owner 정/부):
- `src/components/modals/MilestoneDetailModal.jsx` 수정
- MS의 `owner_id` → `onChangePrimary` → `cascadeMilestoneOwner(msId, newId, { ownerType: 'primary' })`
- MS의 `secondary_owner_id` → `onChangeSecondary` → `cascadeMilestoneOwner(msId, newId, { ownerType: 'secondary' })`

**커밋**: `feat(detail): replace AssigneeSelector with DualAssigneeSelector (12d-9)`

---

## 작업 순서

| Step | 파일 | 의존성 |
|------|------|--------|
| 1 | Migration SQL | 없음 |
| 2 | useStore.js | Step 1 (DB) |
| 3 | StackedAvatar.jsx | 없음 |
| 4 | DualAssigneeSelector.jsx | Step 3 |
| 5 | TeamMatrixGrid.jsx (task/MS 패치) | Step 2, 3 |
| 6 | TeamMatrixGrid.jsx (B안 이중 출현) | Step 5 |
| 7 | MembersView.jsx | Step 2, 3 |
| 8 | Sidebar.jsx + App.jsx | Step 7 |
| 9 | DetailPanel.jsx | Step 4 |

---

## 검증

각 Step 후 `npm run build` 통과
최종: spec §8 QA 체크리스트 전체 (DB, Store, cascade, StackedAvatar, DualAssigneeSelector, 12c 패치, MembersView, Sidebar, DetailPanel, 회귀)

> ⚠️ **Supabase 마이그레이션 적용 필요**: Step 1 후 `supabase db push` 또는 대시보드 SQL 실행
