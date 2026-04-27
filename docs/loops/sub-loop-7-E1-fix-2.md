# Sub-Loop 7-E1 Hot-fix 2: handleDragEnd 분기 순서 재구성

## 버그
같은 MS 그룹 내 task reorder, cross-MS-group 이동, cross-cell task drop, MS → task가 있는 셀 drop이 모두 동작 안 됨.

## 원인
`handleDragEnd` 흐름:
```js
const parts = overId.split(':')
if (parts.length < 3) return   // ← 모든 cell-task: drop이 여기서 차단
const mode = parts[0]
// MS drop 분기
// cell-task: 분기 (도달 불가)
// mat/tmat/pw/tw 분기
```

`cell-task:taskXXX` 형식 → `split(':')` 결과 `['cell-task', 'taskXXX']` → length 2 → `< 3` → 즉시 return → 이후 cell-task: 분기에 절대 도달 못 함.

fix-1의 `closestCenter`는 over.id를 올바르게 매칭하지만, 그 결과를 처리할 분기가 차단되어 있어서 효과 없음.

같은 이유로 fix-1에서 추가한 "MS drop의 over=cell-task: sub-분기"도 절대 실행되지 않음 (MS drop 블록 자체가 parts.length 체크 뒤).

## Fix
`cell-task:` drop 분기를 `parts.length` 체크 **앞으로** 옮기고, 그 안에서 MS source와 task source 양쪽 모두 처리. fix-1에서 추가한 MS drop 블록의 cell-task sub-분기는 중복이므로 제거.

---

## 영향 파일

| 파일 | 변경 |
|---|---|
| `src/components/views/UnifiedGridView.jsx` | `handleDragEnd` 재구성 |

---

## EDIT: `src/components/views/UnifiedGridView.jsx`

`handleDragEnd` 함수 전체 교체:

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

    // ─── MS drop (백로그 or 셀 출처 통합) ───
    // 7-D: 두 prefix 모두 moveMilestoneWithTasks로 cascade 처리
    // 7-E1 fix-1: closestCenter 적용 후 over가 cell-task:로 잡힐 수 있음 → over task의 셀 정보 사용
    if (activeIdStr.startsWith('bl-ms:') || activeIdStr.startsWith('cell-ms:')) {
      const msId = activeIdStr.startsWith('bl-ms:')
        ? activeIdStr.slice(6)
        : activeIdStr.slice(8)
      let targetProjectId = null
      let targetOwnerId = null

      // over가 cell-task:면 그 task의 셀 정보로 cascade 대상 결정
      if (overId.startsWith('cell-task:')) {
        const overTaskId = overId.slice(10)
        const overTask = tasks.find(t => t.id === overTaskId)
        if (!overTask) return
        targetProjectId = overTask.projectId
        targetOwnerId = overTask.assigneeId || userId
      } else if (mode === 'mat') {
        // 개인 매트릭스: targetOwner = userId
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

    // ─── Task drop (cell-task / bl-task / raw) ───
    // 7-E1: cell-task: prefix 추가
    const taskId = activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8)
      : activeIdStr.startsWith('cell-task:') ? activeIdStr.slice(10)
      : activeIdStr
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // 7-E1: over가 cell-task: 면 sortable end (다른 task 위에 drop)
    if (overId.startsWith('cell-task:')) {
      const overTaskId = overId.slice(10)
      if (overTaskId === task.id) return
      const overTask = tasks.find(t => t.id === overTaskId)
      if (!overTask) return

      // 같은 셀 판정
      const sameCell = (
        task.projectId === overTask.projectId &&
        task.assigneeId === overTask.assigneeId &&
        task.category === overTask.category
      )

      if (sameCell) {
        const cellTasks = tasks.filter(t =>
          t.projectId === task.projectId &&
          t.assigneeId === task.assigneeId &&
          t.category === task.category &&
          !t.done
        ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

        const oldIndex = cellTasks.findIndex(t => t.id === task.id)
        const newIndex = cellTasks.findIndex(t => t.id === overTaskId)
        if (oldIndex === -1 || newIndex === -1) return

        if (task.keyMilestoneId !== overTask.keyMilestoneId) {
          updateTask(task.id, {
            keyMilestoneId: overTask.keyMilestoneId,
          })
        }
        const reordered = arrayMove(cellTasks, oldIndex, newIndex)
        reorderTasks(reordered)
      } else {
        updateTask(task.id, {
          projectId: overTask.projectId,
          assigneeId: overTask.assigneeId,
          category: overTask.category,
          keyMilestoneId: task.keyMilestoneId,
        })
      }
      return
    }

    // ─── over가 droppable cell (mat/tmat/pw/tw) ───
    if (mode === 'mat') {
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, moveMilestoneWithTasks, userId, reorderTasks])
```
```js
// NEW
  const handleDragEnd = useCallback((e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overId = String(over.id)

    // ── source 식별 ──
    const isMs = activeIdStr.startsWith('bl-ms:') || activeIdStr.startsWith('cell-ms:')
    const msId = isMs
      ? (activeIdStr.startsWith('bl-ms:') ? activeIdStr.slice(6) : activeIdStr.slice(8))
      : null

    const taskId = !isMs
      ? (activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8)
        : activeIdStr.startsWith('cell-task:') ? activeIdStr.slice(10)
        : activeIdStr)
      : null
    const task = !isMs ? tasks.find(t => t.id === taskId) : null

    // ═══ 1) over가 cell-task: (sortable item 위에 drop) ═══
    // 7-E1 fix-2: parts.length 체크 앞에 위치 — 'cell-task:xxx' 는 split 결과 length 2이므로
    //             이전에는 parts.length<3 차단으로 도달 불가했음
    if (overId.startsWith('cell-task:')) {
      const overTaskId = overId.slice(10)
      const overTask = tasks.find(t => t.id === overTaskId)
      if (!overTask) return

      // MS source — over task의 셀로 cascade
      if (isMs) {
        moveMilestoneWithTasks(msId, {
          targetProjectId: overTask.projectId,
          targetOwnerId: overTask.assigneeId || userId,
        })
        return
      }

      // Task source — sortable end
      if (!task || overTaskId === task.id) return

      const sameCell = (
        task.projectId === overTask.projectId &&
        task.assigneeId === overTask.assigneeId &&
        task.category === overTask.category
      )

      if (sameCell) {
        // 같은 셀 sortable end → reorder (필요시 keyMilestoneId 변경)
        const cellTasks = tasks.filter(t =>
          t.projectId === task.projectId &&
          t.assigneeId === task.assigneeId &&
          t.category === task.category &&
          !t.done
        ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

        const oldIndex = cellTasks.findIndex(t => t.id === task.id)
        const newIndex = cellTasks.findIndex(t => t.id === overTaskId)
        if (oldIndex === -1 || newIndex === -1) return

        // cross-MS-group within same cell — keyMilestoneId 변경
        if (task.keyMilestoneId !== overTask.keyMilestoneId) {
          updateTask(task.id, {
            keyMilestoneId: overTask.keyMilestoneId,
          })
        }
        const reordered = arrayMove(cellTasks, oldIndex, newIndex)
        reorderTasks(reordered)
      } else {
        // 다른 셀 — over task의 위치로 cross-cell move
        // R5 차단을 위해 keyMilestoneId 명시 보존
        updateTask(task.id, {
          projectId: overTask.projectId,
          assigneeId: overTask.assigneeId,
          category: overTask.category,
          keyMilestoneId: task.keyMilestoneId,
        })
      }
      return
    }

    // ═══ 2) over가 droppable cell zone (mat/tmat/pw/tw) ═══
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]

    // MS source → cell drop
    if (isMs) {
      let targetProjectId = null
      let targetOwnerId = null
      if (mode === 'mat') {
        const [, projId] = parts
        targetProjectId = projId
        targetOwnerId = userId
      } else if (mode === 'tmat') {
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

    // Task source → cell drop
    if (!task) return

    if (mode === 'mat') {
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, moveMilestoneWithTasks, userId, reorderTasks])
```

---

## 변경 요약

1. **source 식별을 위쪽으로 끌어올림**: `isMs`, `msId`, `taskId`, `task`를 함수 시작부에 한 번에 정의.
2. **`cell-task:` over 분기를 `parts.length < 3` 체크 앞으로 이동**: 이게 핵심.
3. **분기 안에서 MS와 task source 양쪽 모두 처리**: fix-1에서 잘못된 위치에 있던 "MS drop의 over=cell-task: sub-분기"를 이쪽으로 통합.
4. **기존 MS drop 블록 단순화**: cell-task sub-분기 제거 (위로 옮겨졌으므로).
5. **task drop 분기는 변경 없음**: 기존 mat/tmat/pw/tw 처리 그대로.

---

## DELETE-5 검증

| 항목 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| MS drop 블록의 cell-task: sub-분기 | — | handleDragEnd | — | — | — | 위쪽 통합 분기로 이동 |
| `taskId`/`task` 변수 위치 | — | handleDragEnd 본문 | — | — | — | 함수 시작부로 끌어올림 |

### 잔여 검증
- [x] useCallback deps 변경 없음 (`tasks, moveTaskTo, updateTask, moveMilestoneWithTasks, userId, reorderTasks`) — 모두 동일
- [x] MS source + over=cell zone 분기 — 기존 동작 보존
- [x] Task source + over=cell zone (mat/tmat/pw/tw) — 기존 동작 보존
- [x] MS source + over=cell-task — fix-1 의도 그대로 수행
- [x] Task source + over=cell-task — 7-E1 의도 그대로 수행

---

## 검증

### 빌드
```bash
npm run build
```

### 디버깅 권장 (적용 즉시)
임시로 함수 시작부에 추가:
```js
console.log('[DnD]', { active: activeIdStr, over: overId, isMs, hasTask: !!task })
```
모든 시나리오 테스트 후 제거.

### 런타임 검증 — 필수 시나리오
1. **같은 MS 그룹 내 task reorder** — 원래 버그
   - console: `over: cell-task:xxx, isMs: false, hasTask: true`
   - 결과: 순서 유지
2. **같은 셀의 다른 MS 그룹으로 task drop** — 원래 버그
   - console: 같음
   - 결과: keyMilestoneId 변경, sortOrder reorder
3. **다른 셀의 task 위로 task drop** — 7-E1 cross-cell sortable end
   - 결과: over task의 셀 정보로 update, keyMilestoneId 보존
4. **다른 셀의 빈 공간으로 task drop** — 기존 7-D
   - console: `over: mat:projId:cat` 또는 `tmat:...`
   - 결과: 기존 mat/tmat 분기
5. **MS drag → 빈 셀** — 7-D
   - 결과: 정상 cascade
6. **MS drag → task가 있는 셀** — fix-1 의도 (이제 실제로 동작)
   - console: `over: cell-task:xxx, isMs: true`
   - 결과: over task의 셀 정보로 cascade
7. **백로그 task → 매트릭스 셀** — 기존
   - 결과: 정상 cross-cell move
8. **백로그 MS → 셀** — 7-D
   - 결과: 정상 cascade

### Weekly 회귀
9. **개인 주간 task cross-day drag**
   - drag 시 over가 다른 task 위면 `cell-task:` → cross-cell sortable end → over task의 dueDate **명시 안 함** → dueDate 변경 안 됨 (의도와 다를 수 있음)
   - 빈 공간에 drop이면 `pw:projId:dateStr` → 기존 분기 → 정상
   - **결론**: weekly에서는 task 빈 공간으로 drop해야 dueDate 변경됨. task 위로는 drop하면 안 됨. 또는 추가 fix 필요 (별도 sub-loop).

---

## 사과

7-E1 작성 시 `parts.length < 3` 체크 위치를 고려하지 못한 것이 첫 번째 실수, fix-1에서 closestCenter만 적용하고 같은 흐름 문제를 다시 점검하지 않은 것이 두 번째 실수입니다. fix-2가 근본 원인을 해결합니다.

향후 매트릭스 grid의 dnd 흐름은 이 fix-2 형태가 baseline. 7-E2(MS sortable)에서도 이 구조 위에서 추가합니다.

---

## 커밋 메시지

```
fix(matrix): handleDragEnd ordering — cell-task drop branch before parts check (7-E1 fix-2)

Bug: All cell-task: drops (same-cell reorder, cross-MS-group, cross-cell
sortable end, MS-onto-task) silently failed. Visual reorder reverted on drop.

Cause: parts.length < 3 early-return blocked all 'cell-task:xxx' overIds
(split result has 2 parts). The cell-task: branches added in 7-E1 and
expanded in fix-1 lived AFTER this check and were unreachable.

Fix: Restructure handleDragEnd
- Identify isMs/msId/taskId/task at the top
- Handle over.startsWith('cell-task:') BEFORE the parts.length check
- Inside that branch, dispatch to MS cascade or task sortable end based on source
- Drop the duplicate cell-task: sub-branch from the MS drop block (now
  consolidated above)
- Cell drop zone branch (mat/tmat/pw/tw) unchanged

Combined with fix-1 (closestCenter), cell-task: overIds are now both
correctly matched by collision detection AND reachable in the handler.
```
