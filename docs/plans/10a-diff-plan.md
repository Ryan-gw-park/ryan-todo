# Phase 10a Diff Plan — 매트릭스 MS 시각 강화 + 카운트 통일

> 작성일: 2026-04-09
> 기준: `10a-spec-final.md` (확정)
> 상태: 리뷰 반영 v2

## 리뷰 반영 (v1 → v2)

| 이슈 | 해결 |
|------|------|
| [C1] getColor import 누락 | Step 3에 import 추가 |
| [C2] 빈 MS g.tasks[0] 크래시 | accentColor를 CellContent에서 project prop 기반으로 계산 |
| [C3] countAll 반환값 변경 후 비교 오작동 | 변수명 `msCount`로 변경, 모든 참조 수정 |
| [W2] computeMilestoneCount IIFE 2회 | groups useMemo 안에서 한 번 계산하여 저장 |
| [W5] Bullet div 제거 미언급 | accent bar로 대체, Bullet 제거 명시 |

---

## 0. 전제 요약

- DB / RLS 변경 없음
- 주간 플래너 / 프로젝트 뷰 / 타임라인 무변경
- 카운트 표기를 alive/total로 **전체 통일** (매트릭스 + CompactMilestoneRow + MsTaskListMode + MsTaskTreeMode)
- CLAUDE.md border-left 금지 → 내부 div로 accent bar

---

## Step 1: `milestoneProgress.js` 신규 유틸

**파일**: `src/utils/milestoneProgress.js` (신규)

```js
/**
 * MS 카운트 계산 — alive/total 방식
 * alive = 미완료 task (워크로드 인디케이터)
 * total = 전체 task (deleted 제외)
 */
export function computeMilestoneCount(milestoneId, allTasks) {
  const tasks = allTasks.filter(t =>
    t.keyMilestoneId === milestoneId && !t.deletedAt
  )
  const total = tasks.length
  const alive = tasks.filter(t => !t.done).length
  return { alive, total }
}

/**
 * 재귀 카운트 — MS + 하위 MS의 모든 task
 */
export function computeMilestoneCountRecursive(msId, allMilestones, allTasks) {
  let alive = 0, total = 0
  const { alive: a, total: t } = computeMilestoneCount(msId, allTasks)
  alive += a; total += t
  const children = allMilestones.filter(m => m.parent_id === msId)
  for (const child of children) {
    const r = computeMilestoneCountRecursive(child.id, allMilestones, allTasks)
    alive += r.alive; total += r.total
  }
  return { alive, total }
}
```

**커밋**: `feat(utils): add milestoneProgress util with alive/total count (10a step 1)`

---

## Step 2: `MilestoneRow.jsx` — 시각 강화

**파일**: `src/components/views/grid/cells/MilestoneRow.jsx`

### 변경 — Props 추가:
```diff
 export default function MilestoneRow({
   ms,
   taskCount,
+  aliveCount,    // number — 미완료 task 수
+  totalCount,    // number — 전체 task 수
+  accentColor,   // string — 프로젝트 dot 색상
+  isEmpty,       // boolean — 이 셀에서 task가 0개인 MS
   collapsed,
   ...
```

### 변경 — 스타일 전면 교체:

**root div style**:
```js
style={{
  ...sortableStyle,
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 8px 5px 5px',
  marginBottom: 2,
  background: hover && interactive ? '#E8E6DD' : '#F1EFE8',
  borderRadius: 4,
  position: 'relative',
  cursor: dragDisabled ? 'default' : 'grab',
  opacity: isDragging ? 0.3 : (isEmpty ? 0.5 : 1),
}}
```

hover 시 빈 MS opacity 복원:
```js
opacity: isDragging ? 0.3 : (isEmpty && !hover ? 0.5 : 1),
```

### 변경 — Accent bar 추가 (chevron 앞):
```jsx
{/* Accent bar */}
{accentColor && (
  <div style={{ width: 3, height: 14, borderRadius: 1, background: accentColor, flexShrink: 0 }} />
)}
```

### 변경 — 카운트 표시를 alive/total로:
기존:
```jsx
<span ...>{taskCount > 0 ? taskCount : ''}</span>
```
변경:
```jsx
{totalCount > 0 && (
  <span style={{
    fontSize: 10, fontWeight: 500, color: '#888780',
    background: '#E8E6DD', borderRadius: 8, padding: '0 5px',
    flexShrink: 0,
  }}>{aliveCount}/{totalCount}</span>
)}
```

### 변경 — 편집 중 chevron/detail 비활성화 (R7):
```diff
-{/* Toggle chevron */}
-<span
-  onClick={e => { e.stopPropagation(); onToggleCollapse && onToggleCollapse() }}
+<span
+  onClick={e => { e.stopPropagation(); !isEditing && onToggleCollapse && onToggleCollapse() }}
```

detail 버튼:
```diff
-{!isEditing && onOpenDetail && (
+{!isEditing && onOpenDetail && hover && (
```

**커밋**: `feat(matrix): enhance MilestoneRow visual — bg, accent, alive/total count (10a step 2)`

---

## Step 3: `CellContent.jsx` — 들여쓰기 + 빈 MS + "기타" + 카운트 전달

**파일**: `src/components/views/grid/cells/CellContent.jsx`

### 변경 1 — import 추가:
```js
import { computeMilestoneCount } from '../../../../utils/milestoneProgress'
```

### 변경 2 — MilestoneRow에 새 props 전달 (line 115~128):
```diff
 <MilestoneRow
   ms={g.ms}
-  taskCount={g.tasks.length}
+  taskCount={g.tasks.length}
+  aliveCount={(() => { const c = computeMilestoneCount(g.msId, allTasks); return c.alive })()}
+  totalCount={(() => { const c = computeMilestoneCount(g.msId, allTasks); return c.total })()}
+  accentColor={getProj(g.tasks[0])?.color ? getColor(getProj(g.tasks[0]).color).dot : (project ? getColor(project.color).dot : null)}
+  isEmpty={g.tasks.length === 0}
   collapsed={msCollapsed}
```

> `allTasks`는 store에서 가져와야 함. CellContent에 이미 `useStore(s => s.milestones)`가 있으므로 tasks도 추가:
```js
const allTasks = useStore(s => s.tasks)
```

> accentColor: 첫 task의 프로젝트 또는 부모 grid에서 전달받은 project prop 사용.

### 변경 3 — MS 하위 task 들여쓰기 (line 130-131):
```diff
-{!msCollapsed && g.tasks.map(t => (
-  <TaskRow key={t.id} task={t} project={getProj(t)} editingId={editingId} .../>
-))}
+{!msCollapsed && g.tasks.map(t => (
+  <div key={t.id} style={{ paddingLeft: 22 }}>
+    <TaskRow task={t} project={getProj(t)} editingId={editingId} .../>
+  </div>
+))}
```

### 변경 4 — ungrouped 섹션에 "기타" 라벨 (line 136-144):
```diff
 {groups.ungrouped.length > 0 && (
   <div style={{ marginTop: groups.msGroups.length > 0 ? 2 : 0 }}>
     {groups.msGroups.length > 0 && (
-      <div style={{ height: '0.5px', background: COLOR.border, margin: '3px 0' }} />
+      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 2px', padding: '0 2px' }}>
+        <span style={{ fontSize: 9, color: COLOR.textTertiary, fontWeight: 500, textTransform: 'uppercase' }}>기타</span>
+        <div style={{ flex: 1, height: 0.5, background: COLOR.border }} />
+      </div>
     )}
```

### 변경 5 — MS 정렬 sortOrder fallback 보강 (line 63):
```diff
-result.sort((a, b) => (a.ms.sort_order ?? 0) - (b.ms.sort_order ?? 0))
+result.sort((a, b) => (a.ms.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.ms.sort_order ?? Number.MAX_SAFE_INTEGER))
```

**커밋**: `feat(matrix): add task indent, empty MS, "기타" label, alive/total in CellContent (10a step 3)`

---

## Step 4: `PersonalMatrixGrid.jsx` — 모든 컬럼에 MS 표시

**파일**: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

### 변경 (line 65):
```diff
-const cellMs = cat.key === 'today' ? projMyMilestones : null
-// 7-C: today 컬럼에서만 MS 추가 가능
+const cellMs = projMyMilestones
+// 10a: 모든 컬럼에서 MS 표시. InlineMsAdd는 today만 유지
```

**커밋**: `feat(matrix): show MS in all columns of PersonalMatrixGrid (10a step 4)`

---

## Step 5: 카운트 통일 — CompactMilestoneRow

**파일**: `src/components/project/CompactMilestoneRow.jsx`

### 변경 1 — import 추가:
```js
import { computeMilestoneCount } from '../../utils/milestoneProgress'
```

### 변경 2 — doneCnt/totalCnt → alive/total (line 117-119):
```diff
-const doneCnt = tasks.filter(t => t.done).length
-const totalCnt = tasks.length
-const pct = totalCnt > 0 ? Math.round((doneCnt / totalCnt) * 100) : 0
+const aliveCnt = tasks.filter(t => !t.done).length
+const totalCnt = tasks.length
+const pct = totalCnt > 0 ? Math.round(((totalCnt - aliveCnt) / totalCnt) * 100) : 0
```

> 진척도 bar는 완료 비율이므로 `(total - alive) / total` 유지. 숫자 표시만 변경.

### 변경 3 — 카운트 표시 (line 212):
```diff
-<span ...>{doneCnt}/{totalCnt}</span>
+<span ...>{aliveCnt}/{totalCnt}</span>
```

**커밋**: `refactor(project): unify CompactMilestoneRow count to alive/total (10a step 5)`

---

## Step 6: 카운트 통일 — MsTaskListMode

**파일**: `src/components/project/MsTaskListMode.jsx`

### 변경 (line 148):
```diff
-<span ...>{taskCount.done}/{taskCount.total}</span>
+<span ...>{taskCount.total - taskCount.done}/{taskCount.total}</span>
```

진척도 bar 계산은 그대로 (done/total → 비율은 동일):
```
width: `${taskCount.done / taskCount.total * 100}%`  // 변경 없음
```

**커밋**: `refactor(project): unify MsTaskListMode count to alive/total (10a step 6)`

---

## Step 7: 카운트 통일 — MsTaskTreeMode

**파일**: `src/components/project/MsTaskTreeMode.jsx`

### 변경 1 — import 추가:
```js
import { computeMilestoneCountRecursive } from '../../utils/milestoneProgress'
```

### 변경 2 — countAll 함수를 alive/total로 교체 (line 224-228):
```diff
-const countAll = useCallback((n) => {
-  let c = projectTasks.filter(t => t.keyMilestoneId === n.id && !t.done && !t.deletedAt).length
-  ;(n.children || []).forEach(ch => { c += countAll(ch) })
-  return c
-}, [projectTasks])
+const countAll = useCallback((n) => {
+  return computeMilestoneCountRecursive(n.id, milestones, projectTasks)
+}, [milestones, projectTasks])
```

### 변경 3 — MsNode에서 total 표시 변경 (line ~405):
```diff
-{total > 0 && <span ...>{total}</span>}
+{total.total > 0 && <span ...>{total.alive}/{total.total}</span>}
```

> `total` 변수명이 이제 `{ alive, total }` 객체. 기존 `countAll(node)` 반환값이 숫자 → 객체로 변경됨에 따라 MsNode 내부도 조정.

**커밋**: `refactor(project): unify MsTaskTreeMode count to alive/total (10a step 7)`

---

## 작업 순서 요약

| Step | 파일 | 유형 | 의존성 |
|------|------|------|--------|
| 1 | `src/utils/milestoneProgress.js` | 신규 | 없음 |
| 2 | `MilestoneRow.jsx` | 수정 | 없음 |
| 3 | `CellContent.jsx` | 수정 | Step 1, 2 |
| 4 | `PersonalMatrixGrid.jsx` | 수정 | 없음 |
| 5 | `CompactMilestoneRow.jsx` | 수정 | 없음 |
| 6 | `MsTaskListMode.jsx` | 수정 | 없음 |
| 7 | `MsTaskTreeMode.jsx` | 수정 | Step 1 |

---

## 검증 절차

각 Step 커밋 후: `npm run build` 통과

전체 완료 후 — Spec §9 QA 체크리스트:
- §9-1: 개인 매트릭스 (모든 컬럼 MS, InlineMsAdd today만)
- §9-2: 팀 매트릭스 (시각 강화)
- §9-3: MilestoneRow 시각 (배경, accent, alive/total, 빈 MS opacity)
- §9-4: 인터랙션 (chevron, 인라인 편집, detail, R7 편집 중 비활성화)
- §9-5: CellContent (들여쓰기, "기타", sortOrder)
- §9-6: 카운트 통일 (CompactMilestoneRow, MsTaskListMode, MsTaskTreeMode)
- §9-7: 회귀 (주간, 프로젝트 뷰, 타임라인)
