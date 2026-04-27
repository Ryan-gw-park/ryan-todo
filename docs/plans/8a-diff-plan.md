# Phase 8-A Diff Plan — Weekly Grid Multi-Day Span

> 작성일: 2026-04-09
> 기준: `8a-spec-final.md` (확정)
> 상태: 초안

---

## 0. 전제 요약

- DB / RLS 변경 없음
- 매트릭스 뷰 무변경
- CellContent.jsx 무변경 (tasks 배열만 받으므로)
- TaskRow.jsx에 `spanPosition` prop 추가 (기존 매트릭스 호출은 미전달 → undefined → 기존 동작)
- 주간 5일(월~금) 유지 (주말 건너뜀)

---

## Step 1: `weeklySpan.js` 신규 유틸

**파일**: `src/utils/weeklySpan.js` (신규)

```js
/**
 * 주간 플래너 multi-day span 유틸
 *
 * getSpanTasksForDay(allTasks, ds, weekDateStrs, todayStr, filterFn)
 *   → [{ task, spanPosition: 'single'|'start'|'middle'|'end' }]
 *
 * filterFn: (task) => boolean — 프로젝트/멤버 등 추가 필터
 */

export function getSpanTasksForDay(allTasks, ds, weekDateStrs, todayStr, filterFn) {
  const result = []

  for (const t of allTasks) {
    if (t.done) continue
    if (filterFn && !filterFn(t)) continue

    const hasStart = !!t.startDate
    const hasDue = !!t.dueDate

    // Case 1: startDate + dueDate → span
    if (hasStart && hasDue) {
      if (t.startDate <= ds && ds <= t.dueDate) {
        // ds가 주중 날짜인지는 weekDateStrs.includes(ds)로 이미 보장됨
        const weekStart = weekDateStrs[0]
        const weekEnd = weekDateStrs[weekDateStrs.length - 1]
        const effectiveStart = t.startDate < weekStart ? weekStart : t.startDate
        const effectiveEnd = t.dueDate > weekEnd ? weekEnd : t.dueDate
        // 이번 주 내에서의 시작/끝 판정
        const isStart = ds === effectiveStart || (weekDateStrs.indexOf(ds) === 0 && t.startDate < weekStart)
        const isEnd = ds === effectiveEnd || (weekDateStrs.indexOf(ds) === weekDateStrs.length - 1 && t.dueDate > weekEnd)

        let pos
        if (isStart && isEnd) pos = 'single'
        else if (isStart) pos = 'start'
        else if (isEnd) pos = 'end'
        else pos = 'middle'

        result.push({ task: t, spanPosition: pos })
      }
      continue
    }

    // Case 2: startDate만 → startDate 셀에만
    if (hasStart && !hasDue) {
      if (t.startDate === ds) {
        result.push({ task: t, spanPosition: 'single' })
      }
      continue
    }

    // Case 3: dueDate만 → dueDate 셀에만
    if (!hasStart && hasDue) {
      if (t.dueDate === ds) {
        result.push({ task: t, spanPosition: 'single' })
      }
      continue
    }

    // Case 4: 둘 다 없음 → category today
    if (!hasStart && !hasDue) {
      if (t.category === 'today' && ds === todayStr) {
        result.push({ task: t, spanPosition: 'single' })
      }
    }
  }

  return result.sort((a, b) => (a.task.sortOrder || 0) - (b.task.sortOrder || 0))
}
```

**커밋**: `feat(utils): add weeklySpan util for multi-day task spans (8a step 1)`

---

## Step 2: `TaskRow.jsx` — spanPosition prop 추가

**파일**: `src/components/views/grid/cells/TaskRow.jsx`

### 변경 1 — props에 spanPosition 추가 (line 9):
```diff
-export default function TaskRow({ task, project, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, showMs }) {
+export default function TaskRow({ task, project, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, showMs, spanPosition }) {
```

### 변경 2 — spanPosition에 따른 스타일 분기:

`spanPosition`이 `'middle'` 또는 `'end'`일 때: 체크박스/텍스트 숨기고 bar만 표시.

TaskRow return문 상단에 span bar 렌더 분기 추가:

```jsx
// span middle/end → 심플 bar만 렌더
if (spanPosition === 'middle' || spanPosition === 'end') {
  const barColor = project ? getColor(project.color).dot : '#888'
  return (
    <div
      ref={setNodeRef}
      style={{
        ...sortableStyle,
        height: 24, marginBottom: 1,
        background: `${barColor}1F`,
        borderRadius: spanPosition === 'end' ? '0 4px 4px 0' : 0,
        opacity: isDragging ? 0.3 : 1,
      }}
    />
  )
}
```

### 변경 3 — start/single일 때 bar 스타일 적용:

기존 root div style에 spanPosition 조건 추가:

```diff
 style={{
   ...sortableStyle,
   display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 4px', marginBottom: 1,
-  borderRadius: 4, cursor: isEditing ? 'text' : 'grab',
+  borderRadius: spanPosition === 'start' ? '4px 0 0 4px' : 4,
+  cursor: isEditing ? 'text' : 'grab',
   ...
+  ...(spanPosition && spanPosition !== 'single' ? {
+    background: hover && !isEditing ? COLOR.bgHover : `${(project ? getColor(project.color).dot : '#888')}1F`,
+    borderLeft: spanPosition === 'start' ? `3px solid ${project ? getColor(project.color).dot : '#888'}` : undefined,
+  } : {}),
+  ...(spanPosition === 'single' || !spanPosition ? {} : {}),
 }}
```

실제로는 기존 background 로직과 합쳐서:

```js
const barColor = project ? getColor(project.color).dot : '#888'
const isSpan = spanPosition && spanPosition !== 'single'
const baseBg = isSpan ? `${barColor}1F` : 'transparent'

// root div style:
background: hover && !isEditing ? COLOR.bgHover : baseBg,
borderRadius: spanPosition === 'start' ? '4px 0 0 4px' : 4,
borderLeft: (spanPosition === 'start' || spanPosition === 'single') && isSpan ? `3px solid ${barColor}` : undefined,
```

> **핵심**: `spanPosition`이 undefined(매트릭스 호출)이면 기존 동작 그대로. 주간에서만 전달됨.

**커밋**: `feat(weekly): add segment bar style to TaskRow (8a step 2)`

---

## Step 3: `PersonalWeeklyGrid.jsx` — span 필터 적용

**파일**: `src/components/views/grid/grids/PersonalWeeklyGrid.jsx`

### 변경 1 — import 추가:
```js
import { getSpanTasksForDay } from '../../../../utils/weeklySpan'
```

### 변경 2 — weekTasks 필터 변경 (line 15-23):

기존 `weekTasks`는 유지하되 span 계산용으로 확장:
```diff
 const weekTasks = useMemo(() =>
   myTasks.filter(t => {
     if (t.done) return false
-    if (t.dueDate && weekDateStrs.includes(t.dueDate)) return true
-    if (!t.dueDate && t.category === 'today' && weekDateStrs.includes(todayStr)) return true
+    // span: startDate~dueDate 범위에 이번 주 날짜가 포함되면
+    if (t.startDate && t.dueDate) {
+      return t.startDate <= weekDateStrs[weekDateStrs.length - 1] && t.dueDate >= weekDateStrs[0]
+    }
+    if (t.startDate && !t.dueDate && weekDateStrs.includes(t.startDate)) return true
+    if (t.dueDate && weekDateStrs.includes(t.dueDate)) return true
+    if (!t.dueDate && !t.startDate && t.category === 'today' && weekDateStrs.includes(todayStr)) return true
     return false
   }),
   [myTasks, weekDateStrs, todayStr]
 )
```

### 변경 3 — dayTasks 계산을 getSpanTasksForDay로 교체 (line 60-65):

```diff
-const dayTasks = weekTasks.filter(t => {
-  if (t.projectId !== proj.id) return false
-  if (t.dueDate === ds) return true
-  if (!t.dueDate && t.category === 'today' && ds === todayStr) return true
-  return false
-})
+const spanItems = getSpanTasksForDay(weekTasks, ds, weekDateStrs, todayStr, t => t.projectId === proj.id)
+const dayTasks = spanItems.map(s => s.task)
```

### 변경 4 — CellContent에 spanMap 전달:

CellContent는 tasks 배열만 받으므로, span 정보를 TaskRow까지 전달하려면 별도 방법이 필요.

**방안**: CellContent에 `spanMap` prop을 추가하지 않고, 대신 task 객체에 임시 `_spanPosition` 필드를 붙여서 전달. CellContent는 그대로 pass-through하고, TaskRow에서 `task._spanPosition`을 읽음.

```js
const dayTasks = spanItems.map(s => ({ ...s.task, _spanPosition: s.spanPosition }))
```

그리고 TaskRow에서:
```js
const spanPosition = task._spanPosition || props.spanPosition
```

> **또는** CellContent를 거치지 않고 PersonalWeeklyGrid에서 직접 TaskRow를 렌더하는 방안. 하지만 CellContent에 milestone 그룹핑 로직이 있으므로, `_spanPosition` 방식이 더 안전.

### 변경 5 — key 변경:

CellContent에 전달하는 tasks의 key가 중복될 수 있으므로 (같은 task가 여러 셀에), CellContent에 `cellKey` prefix prop을 추가하거나 task 객체에 `_cellKey`를 부여.

실제로는 CellContent가 `task.id`를 key로 쓰므로, 같은 task가 다른 셀의 CellContent에 전달되면 문제 없음 (다른 컴포넌트 인스턴스).

**커밋**: `feat(weekly): integrate multi-day span in PersonalWeeklyGrid (8a step 3)`

---

## Step 4: `TeamWeeklyGrid.jsx` — 동일 span 적용

**파일**: `src/components/views/grid/grids/TeamWeeklyGrid.jsx`

PersonalWeeklyGrid와 동일한 변경:

### 변경 1 — import:
```js
import { getSpanTasksForDay } from '../../../../utils/weeklySpan'
```

### 변경 2 — dayTasks 계산 교체 (line 48-53):
```diff
-const dayTasks = tasks.filter(t => {
-  if (t.done || t.assigneeId !== mem.userId || t.teamId !== currentTeamId) return false
-  if (t.dueDate === ds) return true
-  if (!t.dueDate && t.category === 'today' && ds === todayStr) return true
-  return false
-}).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
+const spanItems = getSpanTasksForDay(tasks, ds, weekDateStrs, todayStr,
+  t => t.assigneeId === mem.userId && t.teamId === currentTeamId
+)
+const dayTasks = spanItems.map(s => ({ ...s.task, _spanPosition: s.spanPosition }))
```

**커밋**: `feat(weekly): integrate multi-day span in TeamWeeklyGrid (8a step 4)`

---

## Step 5: `TaskRow.jsx` — `_spanPosition` 읽기

Step 2에서 `spanPosition` prop을 추가했는데, 실제로는 `task._spanPosition`도 읽어야 합니다:

```js
// TaskRow 함수 내부 최상단
const effectiveSpanPosition = spanPosition || task._spanPosition
```

그리고 이후 모든 `spanPosition` 참조를 `effectiveSpanPosition`으로.

> Step 2와 5를 합쳐서 하나의 커밋으로 처리 가능.

---

## 작업 순서 요약

| Step | 파일 | 유형 | 의존성 |
|------|------|------|--------|
| 1 | `src/utils/weeklySpan.js` | 신규 | 없음 |
| 2+5 | `src/components/views/grid/cells/TaskRow.jsx` | 수정 | 없음 |
| 3 | `src/components/views/grid/grids/PersonalWeeklyGrid.jsx` | 수정 | Step 1 |
| 4 | `src/components/views/grid/grids/TeamWeeklyGrid.jsx` | 수정 | Step 1 |

---

## 검증 절차

각 Step 커밋 후: `npm run build` 통과

전체 완료 후 — Spec §7 QA 체크리스트:
- startDate + dueDate → 기간 내 모든 주중 날짜에 bar
- startDate만 → startDate 셀에만
- dueDate만 → dueDate 셀에만 (기존)
- 둘 다 없음 → category today (기존)
- 시작 셀: 체크박스 + 텍스트 + left-rounded
- 중간 셀: bar만
- 끝 셀: bar + right-rounded
- 매트릭스 뷰 회귀 없음
