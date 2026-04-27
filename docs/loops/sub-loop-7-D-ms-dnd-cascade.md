# Sub-Loop 7-D: MS Cross-Cell DnD + Task Cascade

## 목표
요구사항 #4: "마일스톤을 특정 과제 위로 지정하기" + "모든 프로젝트, 모든 담당자를 바꿔서 드래그앤드랍"

매트릭스 셀 안의 MS를 드래그해서 다른 셀(같은/다른 프로젝트, 같은/다른 담당자)로 이동. 백로그 MS도 동일하게 통합 처리.

**Cascade**:
- root MS + 모든 자식 MS (recursive descendants)
- 모든 cascade MS의 owner_id, project_id 변경
- 모든 cascade MS의 task → projectId, assigneeId 변경 + **category='today' 리셋**

---

## REQ-LOCK 요구사항

1. MilestoneRow가 `cell-ms:${msId}` ID로 draggable — `interactive=true && !isEditing`일 때만 활성
2. 신규 store action `moveMilestoneWithTasks(msId, { targetProjectId, targetOwnerId })` — atomic cascade
3. 백로그 MS와 셀 MS는 동일한 cascade 동작 (D2: 통합)
4. Cross-project 시 root MS의 `parent_id`만 null로 끊고 자식들의 parent_id는 보존
5. Cross-project 시 target 프로젝트의 `pkm_id` 자동 select-or-insert (7-C와 동일 로직)
6. Cascade되는 모든 task → `category='today'` 리셋
7. Task의 `scope`/`assigneeId` 정규화는 기존 `updateTask` normalize 로직에 위임 (개인 프로젝트 → scope='private' 자동)
8. Drop target 분기:
   - `mat:projId:catKey` (개인 매트릭스): targetProjectId=projId, targetOwnerId=userId, **카테고리는 무시** (MS는 today 컬럼 표시 규칙 그대로)
   - `tmat:projId:memberId` (팀 매트릭스): targetProjectId=projId, targetOwnerId=memberId
   - `pw:` / `tw:` (weekly): MS drop 무시
9. Same source/target = no-op
10. Task DnD 동작 100% 동일 (변경 없음)
11. Vite TDZ 0건

---

## 영향 파일

| # | 파일 | 종류 | 변경 요약 |
|---|---|---|---|
| 1 | `src/hooks/useStore.js` | EDIT | 신규 `moveMilestoneWithTasks` action (~55줄) |
| 2 | `src/components/views/grid/cells/MilestoneRow.jsx` | EDIT | `useDraggable` 적용 + drag handle 통합 |
| 3 | `src/components/views/UnifiedGridView.jsx` | EDIT | `handleDragEnd` MS 분기 통합, `activeItem`에 cell-ms 인식, store destructure에 moveMilestoneWithTasks 추가 |

PersonalMatrixGrid, TeamMatrixGrid, CellContent, weekly grids — **변경 없음**.

---

## 1. EDIT: `src/hooks/useStore.js`

기존 `addMilestoneInProject` action 다음에 신규 `moveMilestoneWithTasks` 추가:

```js
// 추가 (addMilestoneInProject 정의 뒤)

  // 매트릭스 셀 간 MS 이동 + 자식 MS + task cascade
  // - cascade: root + recursive descendant MS 전체
  // - cross-project 시 root의 parent_id를 null로 끊음
  // - cross-project 시 target 프로젝트의 pkm 자동 확보
  // - 모든 cascade task → category='today' 리셋, assigneeId/projectId 변경
  // - task scope/assigneeId 정규화는 updateTask normalize에 위임
  moveMilestoneWithTasks: async (msId, { targetProjectId, targetOwnerId }) => {
    const d = db()
    if (!d) return
    const allMs = get().milestones
    const sourceMs = allMs.find(m => m.id === msId)
    if (!sourceMs) return

    const sourceProjectId = sourceMs.project_id
    const sourceOwnerId = sourceMs.owner_id
    const isCrossProject = sourceProjectId !== targetProjectId

    // No-op: 같은 위치로 이동
    if (!isCrossProject && sourceOwnerId === targetOwnerId) return

    // 1. Cascade 수집 — root + recursive children
    const cascadeIds = new Set()
    const walk = (id) => {
      if (cascadeIds.has(id)) return
      cascadeIds.add(id)
      allMs.filter(m => m.parent_id === id).forEach(child => walk(child.id))
    }
    walk(msId)

    // 2. Cross-project 시 target 프로젝트의 pkm 확보
    let targetPkmId = sourceMs.pkm_id
    if (isCrossProject) {
      // 메모리에서 먼저 추출 시도
      targetPkmId = allMs.find(m => m.project_id === targetProjectId)?.pkm_id
      if (!targetPkmId) {
        // DB 조회
        const { data: pkm, error: selErr } = await d
          .from('project_key_milestones')
          .select('id')
          .eq('project_id', targetProjectId)
          .maybeSingle()
        if (selErr) {
          console.error('[useStore] moveMilestoneWithTasks select pkm:', selErr)
          return
        }
        if (pkm) {
          targetPkmId = pkm.id
        } else {
          // 없으면 생성
          const userId = getCachedUserId()
          const { data: created, error: insErr } = await d
            .from('project_key_milestones')
            .insert({ project_id: targetProjectId, created_by: userId })
            .select('id')
            .single()
          if (insErr) {
            console.error('[useStore] moveMilestoneWithTasks create pkm:', insErr)
            return
          }
          targetPkmId = created?.id
        }
      }
      if (!targetPkmId) {
        console.error('[useStore] moveMilestoneWithTasks: targetPkmId missing')
        return
      }
    }

    // 3. MS 업데이트 payload 구성
    const msUpdates = []
    cascadeIds.forEach(id => {
      const ms = allMs.find(m => m.id === id)
      if (!ms) return
      const patch = {
        project_id: targetProjectId,
        pkm_id: targetPkmId,
        owner_id: targetOwnerId,
      }
      // root MS만 cross-project 시 parent_id 끊기 (자식 MS들의 parent_id는 보존)
      if (id === msId && isCrossProject) {
        patch.parent_id = null
      }
      msUpdates.push({ id, patch })
    })

    // 4. 로컬 즉시 반영 (MS)
    set(s => ({
      milestones: s.milestones.map(m => {
        const u = msUpdates.find(x => x.id === m.id)
        return u ? { ...m, ...u.patch } : m
      })
    }))

    // 5. DB 업데이트 (MS)
    for (const { id, patch } of msUpdates) {
      const { error } = await d.from('key_milestones')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('[useStore] moveMilestoneWithTasks ms update:', error)
    }

    // 6. Task cascade — cascade MS에 연결된 모든 task
    // updateTask를 사용하여 normalize 로직(개인/팀 프로젝트 scope) 자동 적용
    const tasksToUpdate = get().tasks.filter(t => t.keyMilestoneId && cascadeIds.has(t.keyMilestoneId))
    for (const task of tasksToUpdate) {
      await get().updateTask(task.id, {
        projectId: targetProjectId,
        assigneeId: targetOwnerId,
        category: 'today',
      })
    }
  },
```

> 핵심 설계: `updateTask`에 위임 = 개인 프로젝트로 이동 시 자동으로 `scope='private'`, `teamId=null`, `assigneeId=_cachedUserId` 강제 set (line 533~540 normalize). 우리가 받은 `targetOwnerId`와 다를 수 있지만 그게 정상.

---

## 2. EDIT: `src/components/views/grid/cells/MilestoneRow.jsx`

### 2-1. import에 useDraggable 추가

```jsx
// OLD
import { useState } from 'react'
import { COLOR } from '../../../../styles/designTokens'
```
```jsx
// NEW
import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { COLOR } from '../../../../styles/designTokens'
```

### 2-2. useDraggable 호출 + drag attributes 적용

```jsx
// OLD
export default function MilestoneRow({
  ms,
  taskCount,
  collapsed,
  onToggleCollapse,
  isEditing,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onAddTask,
  onDelete,
  onOpenDetail,
  breadcrumb,
  interactive = false,
}) {
  const [hover, setHover] = useState(false)

  const showHoverButtons = interactive && hover && !isEditing

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 2px 2px', marginBottom: 1,
        background: hover && interactive ? COLOR.bgHover : 'transparent',
        borderRadius: 3,
        position: 'relative',
      }}
    >
```
```jsx
// NEW
export default function MilestoneRow({
  ms,
  taskCount,
  collapsed,
  onToggleCollapse,
  isEditing,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onAddTask,
  onDelete,
  onOpenDetail,
  breadcrumb,
  interactive = false,
}) {
  const [hover, setHover] = useState(false)

  // 7-D: drag handle — interactive 모드에서만 활성, 편집 중에는 비활성
  const dragDisabled = !interactive || isEditing
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cell-ms:${ms.id}`,
    disabled: dragDisabled,
  })

  const showHoverButtons = interactive && hover && !isEditing

  return (
    <div
      ref={setNodeRef}
      {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 2px 2px', marginBottom: 1,
        background: hover && interactive ? COLOR.bgHover : 'transparent',
        borderRadius: 3,
        position: 'relative',
        cursor: dragDisabled ? 'default' : 'grab',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
```

> 변경: `useDraggable` hook 호출, `setNodeRef` ref 적용, drag listeners 조건부 spread, cursor/opacity 추가.
> 기존 input/button의 `e.stopPropagation()`은 그대로 유지 — drag와 클릭 이벤트 충돌 방지.

---

## 3. EDIT: `src/components/views/UnifiedGridView.jsx`

### 3-1. store destructure에 moveMilestoneWithTasks 추가

```js
// OLD
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone, deleteMilestone, openConfirmDialog } = useStore()
```
```js
// NEW
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone, deleteMilestone, openConfirmDialog, moveMilestoneWithTasks } = useStore()
```

> `updateMilestone`은 7-A의 `handleMsEditFinish`에서 여전히 사용 → 보존.

### 3-2. activeItem에 cell-ms prefix 인식 추가

```js
// OLD
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const id = String(activeId)
    if (id.startsWith('bl-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(6))
      return ms ? { type: 'ms', data: ms } : null
    }
    const taskId = id.startsWith('bl-task:') ? id.slice(8) : id
    const task = tasks.find(t => t.id === taskId)
    return task ? { type: 'task', data: task } : null
  }, [activeId, tasks, milestones])
```
```js
// NEW
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const id = String(activeId)
    if (id.startsWith('bl-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(6))
      return ms ? { type: 'ms', data: ms } : null
    }
    if (id.startsWith('cell-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(8))
      return ms ? { type: 'ms', data: ms } : null
    }
    const taskId = id.startsWith('bl-task:') ? id.slice(8) : id
    const task = tasks.find(t => t.id === taskId)
    return task ? { type: 'task', data: task } : null
  }, [activeId, tasks, milestones])
```

> DragOverlay 렌더는 `type='ms'`로 통일되어 있으므로 변경 없음.

### 3-3. handleDragEnd MS 분기 통합

```js
// OLD
  const handleDragEnd = useCallback((e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overId = String(over.id)

    // Parse drop zone ID → extract patch
    // Format: "mat:projId:category" | "tmat:projId:memberId" | "pw:projId:dateStr" | "tw:memberId:dateStr"
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]

    // ─── Backlog MS drop → owner 배정 ───
    if (activeIdStr.startsWith('bl-ms:')) {
      const msId = activeIdStr.slice(6)
      if (mode === 'tmat') {
        const [, , targetMemberId] = parts
        updateMilestone(msId, { owner_id: targetMemberId })
      }
      // mat/pw/tw에는 MS 드롭 미적용
      return
    }

    // ─── Task drop (그리드 내부 or 백로그) ───
    const taskId = activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8) : activeIdStr
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (mode === 'mat') {
      // Personal matrix: project + category
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      // Team matrix: project + assignee
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      // Personal weekly: project + date
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      // Team weekly: member + date
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, updateMilestone])
```
```js
// NEW
  const handleDragEnd = useCallback((e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overId = String(over.id)

    // Parse drop zone ID → extract patch
    // Format: "mat:projId:category" | "tmat:projId:memberId" | "pw:projId:dateStr" | "tw:memberId:dateStr"
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]

    // ─── MS drop (백로그 or 셀 출처 통합) ───
    // 7-D: 두 prefix 모두 moveMilestoneWithTasks로 cascade 처리
    if (activeIdStr.startsWith('bl-ms:') || activeIdStr.startsWith('cell-ms:')) {
      const msId = activeIdStr.startsWith('bl-ms:')
        ? activeIdStr.slice(6)
        : activeIdStr.slice(8)
      let targetProjectId = null
      let targetOwnerId = null
      if (mode === 'mat') {
        // 개인 매트릭스: targetOwner = userId (카테고리는 무시 — MS는 today 컬럼 표시 규칙으로 자동 위치)
        const [, projId] = parts
        targetProjectId = projId
        targetOwnerId = userId
      } else if (mode === 'tmat') {
        // 팀 매트릭스: targetOwner = memberId
        const [, projId, memberId] = parts
        targetProjectId = projId
        targetOwnerId = memberId
      } else {
        // pw/tw weekly: MS drop 무시
        return
      }
      moveMilestoneWithTasks(msId, { targetProjectId, targetOwnerId })
      return
    }

    // ─── Task drop (그리드 내부 or 백로그) ───
    const taskId = activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8) : activeIdStr
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (mode === 'mat') {
      // Personal matrix: project + category
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      // Team matrix: project + assignee
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      // Personal weekly: project + date
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      // Team weekly: member + date
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, moveMilestoneWithTasks, userId])
```

> 변경 1: MS 분기를 `bl-ms:` 단독 → `bl-ms:` || `cell-ms:` 통합
> 변경 2: 동작을 `updateMilestone(owner_id)` → `moveMilestoneWithTasks(...)`로 교체
> 변경 3: 개인 매트릭스(mat) drop도 지원 (이전엔 무시했음)
> 변경 4: deps에서 `updateMilestone` 제거 (이 callback 안에서 더 이상 사용 안 함), `moveMilestoneWithTasks`, `userId` 추가

---

## DELETE-5 검증

| 항목 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| `handleDragEnd` 내 `updateMilestone(msId, { owner_id })` 호출 | useStore destructure 그대로 | 1곳 (handleDragEnd) | — | useCallback deps | — | `moveMilestoneWithTasks(...)`로 교체 |
| `updateMilestone` import | UnifiedGridView destructure | handleMsEditFinish (7-A에서 추가)에서 여전히 사용 | — | — | — | **보존** — title 편집에 필요 |
| `useCallback deps` `updateMilestone` | — | — | — | handleDragEnd deps | — | 제거 (해당 callback에서만 — handleMsEditFinish의 deps는 변경 없음) |

### 잔여 import 검증
- [x] MilestoneRow: `useDraggable` import 추가 — `useDraggable({ id, disabled })` 호출에서 사용
- [x] UnifiedGridView: `moveMilestoneWithTasks` destructure 추가 — handleDragEnd에서 사용
- [x] useStore: 신규 import 0건 (`db`, `getCachedUserId`는 모듈 내 기존)

### 잔여 변수 검증
- [x] `updateMilestone` UnifiedGridView 안에서 여전히 사용 (handleMsEditFinish 1건) — 제거 금지
- [x] `userId`는 UnifiedGridView 위쪽에서 이미 `getCachedUserId()`로 정의됨 — 신규 변수 0개

### 동작 동등성 (변경 없는 부분)
- [x] Task DnD (mat/tmat/pw/tw) 4개 분기 동일
- [x] Weekly grids 미수정
- [x] CellContent, PersonalMatrixGrid, TeamMatrixGrid 미수정
- [x] MilestoneRow의 input/button stopPropagation 그대로 — drag/click 충돌 방지
- [x] DragOverlay 렌더 로직 변경 없음 (`type='ms'` 통일)
- [x] 7-A의 inline edit, 7-B의 done section, 7-C의 InlineMsAdd 모두 영향 없음

### 백로그 MS 동작 변경 (의도적)
- 이전: 백로그 MS → tmat 셀 = `owner_id`만 변경, task 따라가지 않음
- 신규: 백로그 MS → mat/tmat 셀 = full cascade (task 모두 따라감, category=today 리셋)
- D2 결정 사항 — 사용자 동의함

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | MilestoneRow draggable, interactive && !isEditing 활성 | MilestoneRow §2-2 dragDisabled | ✓ |
| 2 | moveMilestoneWithTasks 신규 action | useStore §1 | ✓ |
| 3 | bl-ms와 cell-ms 통합 cascade | UnifiedGridView §3-3 | ✓ |
| 4 | root parent_id null, 자식 보존 | useStore §1 step 3 `if (id === msId && isCrossProject)` | ✓ |
| 5 | target pkm 자동 select-or-insert | useStore §1 step 2 | ✓ |
| 6 | task category='today' 리셋 | useStore §1 step 6 updateTask call | ✓ |
| 7 | task scope normalize 위임 | updateTask 호출 (라인 533~540 자동 적용) | ✓ |
| 8 | mat=userId, tmat=memberId, pw/tw=무시 | UnifiedGridView §3-3 mode 분기 | ✓ |
| 9 | Same source/target no-op | useStore §1 step 0 early return | ✓ |
| 10 | Task DnD 동작 100% 동일 | UnifiedGridView §3-3 task 분기 변경 없음 | ✓ |
| 11 | Vite TDZ 0건 | 모든 token inline | ✓ |

---

## 빌드 검증 명령

```bash
# 1. 빌드
npm run build

# 2. 신규 action 정의 확인
grep -n "moveMilestoneWithTasks" src/hooks/useStore.js
# 예상: 정의 1건

# 3. UnifiedGridView에서 신규 action 사용
grep -n "moveMilestoneWithTasks" src/components/views/UnifiedGridView.jsx
# 예상: destructure 1건 + handleDragEnd 호출 1건 + useCallback deps 1건

# 4. cell-ms prefix 사용
grep -n "cell-ms:" src/components/views/grid/cells/MilestoneRow.jsx src/components/views/UnifiedGridView.jsx
# 예상: MilestoneRow useDraggable 1건 + UnifiedGridView activeItem/handleDragEnd 2건

# 5. updateMilestone은 handleMsEditFinish에서만 사용 (handleDragEnd에서 제거됨)
grep -n "updateMilestone" src/components/views/UnifiedGridView.jsx
# 예상: destructure 1건 + handleMsEditFinish 호출 1건 (총 2건)
# 만약 3건+이면 handleDragEnd에 잔존 의심

# 6. Cascade 사용 검증 (코드 reading)
grep -A2 "if (id === msId && isCrossProject)" src/hooks/useStore.js
# 예상: parent_id null 처리 확인
```

## 런타임 검증 체크리스트

### 셀 → 셀 (같은 프로젝트, 다른 멤버) — 팀 매트릭스
- [ ] MS 드래그 → DragOverlay에 MS 제목 표시
- [ ] 같은 프로젝트의 다른 멤버 셀에 drop
- [ ] MS가 새 멤버 셀로 이동
- [ ] MS의 task들이 새 멤버에 assignee 변경됨 (TaskRow 표시 + Supabase 직접 확인)
- [ ] task category 모두 today로 리셋

### 셀 → 셀 (다른 프로젝트, 같은/다른 멤버) — 팀 매트릭스
- [ ] MS와 task 모두 새 프로젝트로 이동
- [ ] MS의 owner_id, project_id, pkm_id 모두 새 값으로 set (Supabase 직접 확인)
- [ ] root MS의 parent_id가 null로 끊김 (자식이 있으면 자식의 parent_id는 그대로)
- [ ] target 프로젝트가 MS 0개였어도 정상 동작 (pkm 자동 생성)

### 백로그 → 셀
- [ ] 백로그 MS를 매트릭스 셀로 drop
- [ ] cascade 동작 동일 (task 따라감, category 리셋)
- [ ] 백로그 사이드바에서 해당 MS가 사라지거나 적절히 갱신됨 (백로그 사이드바가 어떤 필터로 표시하는지 확인)

### 개인 매트릭스
- [ ] today 컬럼 셀 안의 MS를 drag 가능
- [ ] today 컬럼 다른 위치에 drop → owner=userId 유지, project_id만 변경
- [ ] next/later 컬럼에 drop → 동작은 처리되지만 MS는 today 컬럼에서만 보임 (cellMs filter는 그대로)

### 자식 MS cascade
- [ ] 부모 MS에 자식 MS가 1개 이상 있는 케이스 만들고 부모를 drag
- [ ] 자식 MS도 함께 새 프로젝트/owner로 이동 (Supabase에서 자식의 project_id, owner_id 확인)
- [ ] 자식의 parent_id는 root MS의 id 그대로 (자식 트리 구조 보존)

### Edge cases
- [ ] Same source/target에 drop = no-op (콘솔 에러 0)
- [ ] 편집 중인 MS는 drag 시작 안 됨 (input 클릭만 동작)
- [ ] Weekly grid의 MS 헤더는 drag 안 됨 (interactive=false)
- [ ] task DnD 4개 분기 모두 정상 동작

### 7-A/B/C와 충돌 없음
- [ ] MS 인라인 편집 정상
- [ ] MS + 버튼 task 추가 정상
- [ ] MS ⋮ 삭제 정상
- [ ] Done section 펼침/접힘 정상
- [ ] 새 MS 추가 후 즉시 drag 가능

---

## 커밋 메시지

```
feat(matrix): MS cross-cell drag with task cascade (Sub-Loop 7-D)

- New store action moveMilestoneWithTasks(msId, { targetProjectId, targetOwnerId })
  * Recursive descendant collection (root + all children)
  * Cross-project: auto select-or-insert target pkm
  * Cross-project: detach root parent_id only (children preserve their parent_id)
  * All cascade MS: project_id, pkm_id, owner_id updated
  * All cascade tasks: projectId, assigneeId, category reset to 'today'
  * Task scope normalization delegated to updateTask (handles personal/team auto-set)
- MilestoneRow: useDraggable with id 'cell-ms:${msId}'
  * Disabled when !interactive || isEditing
  * Existing input/button stopPropagation prevents drag/click conflicts
- UnifiedGridView handleDragEnd:
  * Unified bl-ms: and cell-ms: handling via single moveMilestoneWithTasks call
  * Personal matrix (mat:) drop now supported (was previously ignored)
  * Team matrix (tmat:) drop now full-cascade (was owner_id only)
  * Weekly drops still ignored for MS
- activeItem recognizes cell-ms: prefix for DragOverlay
- updateMilestone import preserved (still used by handleMsEditFinish from 7-A)
- Task DnD logic unchanged
```
