# Phase 9a Diff Plan (v2) — 프로젝트 뷰 MS Owner UI

> 작성일: 2026-04-09
> 기준: `9a-spec-final.md` (확정)
> 상태: 리뷰 반영 v2

---

## 0. 전제 요약

- DB / RLS 변경 없음 (`key_milestones.owner_id` 이미 존재)
- `OwnerDropdown.jsx`, `AssigneeSelector.jsx`, `DetailPanel.jsx`, `MiniAvatar.jsx` 수정 없음
- 기존 파일은 **추가만** (삭제/변경 금지, "Don't Touch, Wrap It")
- **HierarchicalTree.jsx는 고아 파일** — 사용처 없음. 수정 대상에서 제외
- MS 렌더 실체: `MsTaskTreeMode.jsx` 내부 `MsNode` 인라인 컴포넌트 (line 272)

---

## 리뷰 반영 사항 (v1 BLOCK → v2)

| 리뷰 이슈 | 해결 |
|-----------|------|
| [C1] HierarchicalTree 고아 파일 | Step 5를 MsNode 수정으로 교체 |
| [C2] onCascade stub | Step 4/6에서 cascadeMilestoneOwner를 명시적으로 전달 |
| [C3] CompactMilestoneTab cascade 전달 누락 | Step 6-B에 onCascade prop chain 추가 |
| [C4] useStore.js import TDZ 위험 | getDescendantIds를 cascadeMilestoneOwner 내부에 inline 구현 |
| [W1] depth size 미완성 | computeDepth import + 명시적 size 계산 |
| [W2] allMilestones 변수명 충돌 | CompactMilestoneTab에서 기존 milestones 직접 사용 + 전체는 storeMilestones |
| [W3] memberMap useEffect 이중 호출 | 기존 useEffect 확장하여 members 배열도 저장 |
| [W5] Undo 원자성 | cascadeMilestoneOwner에 undoPrevStates 반환, MsTaskTreeMode에서 undo 스택 연결 |
| [W6] ownerDisplay prop 누락 | MilestoneOwnerSelector Props에 ownerDisplay 추가 |
| [W7] spacer 너비 고정 | depth 기반 동적 size 사용 |

---

## Step 1: `milestoneOwnerAggregate.js` 신규 유틸

**파일**: `src/utils/milestoneOwnerAggregate.js` (신규)

```js
/**
 * MS owner 상태 계산 유틸
 * - computeOwnerDisplay: single / ghost / mixed 판정
 * - collectChildOwners: 하위 MS의 owner_id 재귀 수집
 * - getDescendantIds: cascade용 하위 MS id 재귀 수집
 */

// 부모 MS의 owner 표시 모드 계산
export function computeOwnerDisplay(milestone, allMilestones) {
  if (milestone.owner_id) return { mode: 'single', ownerId: milestone.owner_id }

  const childOwners = collectChildOwners(milestone.id, allMilestones)
  if (childOwners.length === 0) return { mode: 'ghost' }

  // 빈도순 정렬 → top 2 + 나머지 카운트
  const freq = {}
  childOwners.forEach(id => { freq[id] = (freq[id] || 0) + 1 })
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
  const topOwners = sorted.slice(0, 2).map(([id]) => id)
  const extraCount = Math.max(0, sorted.length - 2)

  return { mode: 'mixed', topOwners, extraCount }
}

// 재귀로 모든 하위 MS의 owner_id 수집 (non-null만)
export function collectChildOwners(msId, allMilestones, visited = new Set()) {
  if (visited.has(msId)) return []  // 순환 참조 방지
  visited.add(msId)
  const children = allMilestones.filter(m => m.parent_id === msId)
  const owners = []
  for (const child of children) {
    if (child.owner_id) owners.push(child.owner_id)
    owners.push(...collectChildOwners(child.id, allMilestones, visited))
  }
  return owners
}

// cascade용: 모든 하위 MS id 수집
export function getDescendantIds(msId, allMilestones, visited = new Set()) {
  if (visited.has(msId)) return []
  visited.add(msId)
  const children = allMilestones.filter(m => m.parent_id === msId)
  const ids = []
  for (const child of children) {
    ids.push(child.id)
    ids.push(...getDescendantIds(child.id, allMilestones, visited))
  }
  return ids
}
```

**커밋**: `feat(utils): add milestoneOwnerAggregate util (9a step 1)`

---

## Step 2: `cascadeMilestoneOwner` store 함수 추가

**파일**: `src/hooks/useStore.js`
**위치**: `updateMilestone` 함수 뒤 (line ~1043 이후)
**변경**: 함수 **추가만** (기존 코드 무수정)

> **TDZ 방지**: `getDescendantIds`를 import하지 않고 함수 내부에 inline 구현

```js
cascadeMilestoneOwner: async (msId, ownerId, { overwrite = false } = {}) => {
  const { milestones } = get()
  const d = db()
  if (!d) return { prevStates: [] }

  // inline descendant 수집 (외부 import 회피 — TDZ 방지)
  const getDesc = (parentId, visited = new Set()) => {
    if (visited.has(parentId)) return []
    visited.add(parentId)
    const children = milestones.filter(m => m.parent_id === parentId)
    const ids = []
    for (const c of children) {
      ids.push(c.id)
      ids.push(...getDesc(c.id, visited))
    }
    return ids
  }

  const descendantIds = getDesc(msId)

  // overwrite=false면 owner_id가 null인 것만 대상
  const targetIds = overwrite
    ? descendantIds
    : descendantIds.filter(id => {
        const m = milestones.find(ms => ms.id === id)
        return m && !m.owner_id
      })

  if (targetIds.length === 0) return { prevStates: [] }

  // 롤백용 이전 상태 보관
  const prevStates = targetIds.map(id => {
    const m = milestones.find(ms => ms.id === id)
    return { id, owner_id: m?.owner_id || null }
  })

  // 로컬 즉시 반영 (단일 set)
  set(s => ({
    milestones: s.milestones.map(m =>
      targetIds.includes(m.id) ? { ...m, owner_id: ownerId } : m
    )
  }))

  // DB 순차 update (moveMilestoneWithTasks 패턴)
  let hasError = false
  for (const id of targetIds) {
    const { error } = await d.from('key_milestones')
      .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { console.error('[useStore] cascadeMilestoneOwner:', error); hasError = true }
  }

  // 실패 시 롤백
  if (hasError) {
    set(s => ({
      milestones: s.milestones.map(m => {
        const prev = prevStates.find(p => p.id === m.id)
        return prev ? { ...m, owner_id: prev.owner_id } : m
      })
    }))
    return { prevStates: [], error: true }
  }

  return { prevStates } // Undo용 반환
},
```

**커밋**: `feat(store): add cascadeMilestoneOwner action (9a step 2)`

---

## Step 3: `MilestoneOwnerSelector.jsx` 신규 컴포넌트

**파일**: `src/components/project/MilestoneOwnerSelector.jsx` (신규)

**Props**:
```js
{
  milestoneId,     // string
  ownerId,         // string | null
  ownerDisplay,    // { mode: 'single'|'ghost'|'mixed', ownerId?, topOwners?, extraCount? }
  members,         // [{ userId, displayName, role }]
  hasChildren,     // boolean — cascade 버튼 표시 여부
  onChangeOwner,   // (userId: string | null) => void
  onCascade,       // (userId: string | null, { overwrite: boolean }) => void
  size,            // number (avatar 크기, default 20)
  currentTeamId,   // string | null — null이면 visibility: hidden
}
```

**구현 핵심**:

1. **state**: `const [open, setOpen] = useState(false)`, `const ref = useRef(null)`
2. **click-outside**: OwnerDropdown.jsx와 동일 패턴 (useEffect + mousedown listener)
3. **아바타 렌더** (ownerDisplay.mode별):
   - `'single'`: `<MiniAvatar name={memberName} size={size} />`
   - `'ghost'`: dashed border + `+` 아이콘 (border: `1px dashed #B4B2A9`, background: `transparent`)
   - `'mixed'`: 스택 — topOwners[0] MiniAvatar + topOwners[1] (marginLeft: -6) + extraCount>0 `+N` badge
4. **currentTeamId === null**: 아바타 영역 `visibility: 'hidden'`, `width: size` (동적)
5. **클릭 → 드롭다운** (width: 200px, right-aligned, top+4px):
   - 헤더: "오너 지정" (fontSize 11, color `#a09f99`)
   - "미지정" 옵션 (○ + "미지정")
   - 멤버 목록 (아바타 + displayName, 현재값 하이라이트)
   - `hasChildren && (구분선 + "↗ 하위 MS에 전체 적용")` → onCascade 호출
6. **접근성**: `role="button"`, `aria-label="오너: {name}, 클릭하여 변경"` / `"오너 미지정, 클릭하여 지정"`, `tabIndex={0}`, `onKeyDown` (Enter=toggle, Esc=close)
7. **닫힘**: 외부 클릭 + ESC + 멤버 선택

**import**: `MiniAvatar` from `../views/grid/shared/MiniAvatar` (Vite TDZ 안전 — MiniAvatar는 pure component)

**커밋**: `feat(project): add MilestoneOwnerSelector component (9a step 3)`

---

## Step 4: `MsTaskTreeMode.jsx` — members 확보 + MsNode에 owner props 전달

**파일**: `src/components/project/MsTaskTreeMode.jsx`

### 변경 1 — import 추가 (파일 상단, line 4 뒤):
```js
import MilestoneOwnerSelector from './MilestoneOwnerSelector'
import { computeOwnerDisplay } from '../../utils/milestoneOwnerAggregate'
import { computeDepth } from '../../utils/milestoneTree'
```

### 변경 2 — 기존 memberMap useEffect 확장 (line 28~37):
기존 `memberMap` 빌드 시 `members` 배열도 함께 저장 (이중 fetch 방지):
```js
// ─── Member map + members array ───
const [memberMap, setMemberMap] = useState({})
const [members, setMembers] = useState([])
useEffect(() => {
  if (!currentTeamId) { setMembers([]); return }
  useTeamMembers.getMembers(currentTeamId).then(mems => {
    setMembers(mems)
    const map = {}
    mems.forEach(m => { map[m.userId] = m.displayName || m.name || '?' })
    setMemberMap(map)
  })
}, [currentTeamId])
```

### 변경 3 — cascadeMilestoneOwner store action 가져오기 (line 24 근처):
```js
const cascadeMilestoneOwner = useStore(s => s.cascadeMilestoneOwner)
```

### 변경 4 — cascade 핸들러 + undo 스택 연결:
```js
const handleCascadeOwner = useCallback(async (msId, ownerId, { overwrite } = {}) => {
  const { prevStates, error } = await cascadeMilestoneOwner(msId, ownerId, { overwrite })
  if (!error && prevStates.length > 0) {
    undoStack.current.push({
      desc: `하위 MS ${prevStates.length}개 오너 일괄 변경`,
      undo: () => {
        // prevStates로 각각 복원
        for (const { id, owner_id } of prevStates) {
          updateMilestone(id, { owner_id })
        }
      }
    })
    setToast({ msg: `하위 MS ${prevStates.length}개 오너 변경`, canUndo: true })
  }
}, [cascadeMilestoneOwner, updateMilestone])
```

### 변경 5 — MsNode 호출부에 props 추가 (line 240~253):
```diff
 <MsNode
   key={node.id} node={node} depth={0} dotColor={dotColor}
   ...
   memberMap={memberMap}
+  members={members}
+  allMilestones={milestones}
+  currentTeamId={currentTeamId}
+  onUpdateMilestone={updateMilestone}
+  onCascadeOwner={handleCascadeOwner}
 />
```

### 변경 6 — MsNode 재귀 호출부에도 동일 props 전달 (line 471~484):
```diff
 <MsNode
   key={child.id} node={child} depth={depth + 1} dotColor={dotColor}
   ...
   memberMap={memberMap}
+  members={members}
+  allMilestones={allMilestones}
+  currentTeamId={currentTeamId}
+  onUpdateMilestone={onUpdateMilestone}
+  onCascadeOwner={onCascadeOwner}
 />
```

**커밋**: `feat(project): pass owner props through MsTaskTreeMode + MsNode (9a step 4)`

---

## Step 5: `MsNode` 내부에 owner 아바타 삽입

**파일**: `src/components/project/MsTaskTreeMode.jsx` (MsNode 인라인 컴포넌트)

### 변경 1 — MsNode props 확장 (line 273~281):
```diff
 function MsNode({ node, depth, dotColor, collapsed, toggleNode, hoverId, setHoverId,
   editingMsId, setEditingMsId, editingTaskId, setEditingTaskId,
   addingTaskMsId, setAddingTaskMsId,
   onMsEditFinish, onAddChildMs, onDeleteMs,
   onTaskEditFinish, onAddTaskSubmit,
   toggleDone, openDetail, projectTasks, countAll,
   dragState, setDragState, onTaskDrop, onMsDropChild, onMsReorder,
-  memberMap,
+  memberMap, members, allMilestones, currentTeamId, onUpdateMilestone, onCascadeOwner,
 }) {
```

### 변경 2 — total 카운트와 hover 버튼 사이에 아바타 삽입 (line 377~379 사이):

현재 구조:
```
line 377: {total > 0 && <span ...>{total}</span>}
line 379: {isHover && !isEditing && !dragState && (
```

삽입 코드 (line 377과 379 사이):
```jsx
{/* MS Owner Avatar */}
{currentTeamId ? (
  <MilestoneOwnerSelector
    milestoneId={node.id}
    ownerId={node.owner_id}
    ownerDisplay={computeOwnerDisplay(node, allMilestones || [])}
    members={members || []}
    hasChildren={(node.children || []).length > 0}
    onChangeOwner={(userId) => onUpdateMilestone(node.id, { owner_id: userId })}
    onCascade={(userId, opts) => onCascadeOwner(node.id, userId, opts)}
    size={depth === 0 ? 20 : depth === 1 ? 18 : 16}
    currentTeamId={currentTeamId}
  />
) : (
  <div style={{ width: depth === 0 ? 20 : depth === 1 ? 18 : 16, visibility: 'hidden', flexShrink: 0 }} />
)}
```

**커밋**: `feat(project): integrate owner avatar in MsNode (9a step 5)`

---

## Step 6: `CompactMilestoneTab.jsx` 아바타 통합

**파일**: `src/components/project/CompactMilestoneTab.jsx`

### 변경 1 — import 추가 (파일 상단):
```js
import useTeamMembers from '../../hooks/useTeamMembers'
import { computeDepth } from '../../utils/milestoneTree'
```

### 변경 2 — members + storeMilestones 가져오기:
```js
const currentTeamId = useStore(s => s.currentTeamId)
const storeMilestones = useStore(s => s.milestones)  // 전체 MS (변수명 충돌 회피)
const cascadeMilestoneOwner = useStore(s => s.cascadeMilestoneOwner)

const [members, setMembers] = useState([])
useEffect(() => {
  if (!currentTeamId) { setMembers([]); return }
  useTeamMembers.getMembers(currentTeamId).then(setMembers)
}, [currentTeamId])
```

### 변경 3 — CompactMilestoneRow에 props 전달 (line 235~251):
```diff
 <CompactMilestoneRow
   key={ms.id}
   milestone={ms}
   ...
+  members={members}
+  allMilestones={storeMilestones}
+  currentTeamId={currentTeamId}
+  onCascadeOwner={async (msId, ownerId, opts) => {
+    await cascadeMilestoneOwner(msId, ownerId, opts)
+  }}
 />
```

**커밋**: `feat(project): integrate owner in CompactMilestoneTab (9a step 6)`

---

## Step 7: `CompactMilestoneRow.jsx` 아바타 통합

**파일**: `src/components/project/CompactMilestoneRow.jsx`

### 변경 1 — import 추가 (파일 상단):
```js
import MilestoneOwnerSelector from './MilestoneOwnerSelector'
import { computeOwnerDisplay } from '../../utils/milestoneOwnerAggregate'
import { computeDepth } from '../../utils/milestoneTree'
```

### 변경 2 — Props 추가 (line 91~95):
```diff
 export default function CompactMilestoneRow({
   milestone, tasks, expanded, onToggleExpand, onTaskToggle,
   onAddTask, onTaskClick, isBacklog, deliverables,
   taskColW, onResizeStart, onUpdateMilestone, onOpenMilestoneDetail,
+  members, allMilestones, currentTeamId, onCascadeOwner,
 })
```

### 변경 3 — progress badge와 detail 버튼 사이에 아바타 삽입 (line 210~212 사이):
```jsx
{/* MS Owner Avatar */}
{(() => {
  const avatarSize = (() => {
    if (!allMilestones) return 20
    const d = computeDepth(milestone, allMilestones)
    return d === 0 ? 20 : d === 1 ? 18 : 16
  })()
  return currentTeamId ? (
    <MilestoneOwnerSelector
      milestoneId={milestone.id}
      ownerId={milestone.owner_id}
      ownerDisplay={computeOwnerDisplay(milestone, allMilestones || [])}
      members={members || []}
      hasChildren={allMilestones?.some(m => m.parent_id === milestone.id)}
      onChangeOwner={(userId) => onUpdateMilestone(milestone.id, { owner_id: userId })}
      onCascade={(userId, opts) => onCascadeOwner?.(milestone.id, userId, opts)}
      size={avatarSize}
      currentTeamId={currentTeamId}
    />
  ) : (
    <div style={{ width: avatarSize, visibility: 'hidden', flexShrink: 0 }} />
  )
})()}
```

### 변경 4 — Backlog MS 가드:
`isBacklog` prop이 true인 경우 아바타를 표시하지 않도록 조건 추가:
```jsx
{!isBacklog && (/* 위의 아바타 코드 */)}
```

**커밋**: `feat(project): integrate owner avatar in CompactMilestoneRow (9a step 7)`

---

## Step 8: `UnifiedProjectHeader.jsx` 텍스트 변경

**파일**: `src/components/project/UnifiedProjectHeader.jsx`
**위치**: line 31

```diff
-{' · 오너 : '}
+{' · 프로젝트 오너 : '}
```

**커밋**: `chore(project): rename header label to 프로젝트 오너 (9a step 8)`

---

## 작업 순서 요약

| Step | 파일 | 유형 | 의존성 |
|------|------|------|--------|
| 1 | `src/utils/milestoneOwnerAggregate.js` | 신규 | 없음 |
| 2 | `src/hooks/useStore.js` | 추가 | 없음 (inline 구현) |
| 3 | `src/components/project/MilestoneOwnerSelector.jsx` | 신규 | MiniAvatar import |
| 4 | `src/components/project/MsTaskTreeMode.jsx` (부모) | 추가 | Step 1, 2, 3 |
| 5 | `src/components/project/MsTaskTreeMode.jsx` (MsNode) | 추가 | Step 3, 4 |
| 6 | `src/components/project/CompactMilestoneTab.jsx` | 추가 | Step 2, 3 |
| 7 | `src/components/project/CompactMilestoneRow.jsx` | 추가 | Step 1, 3 |
| 8 | `src/components/project/UnifiedProjectHeader.jsx` | 1줄 변경 | 없음 |

> Step 4+5는 같은 파일이므로 하나의 커밋으로 통합 가능 (7 커밋 → 7 커밋)

---

## 검증 절차

각 Step 커밋 후: `npm run build` 통과

전체 완료 후 — Spec §9 QA 체크리스트:
- §9-1: 기본 동작 (L1/L2/L3 크기, ghost, 드롭다운, 선택)
- §9-2: 혼합 오너 (스택 + +N)
- §9-3: Cascade (null만 / 전체 / confirm / Ctrl+Z 롤백)
- §9-4: 매트릭스 ↔ 프로젝트 뷰 양방향 동기화
- §9-5: 접근성 (키보드, aria-label)
- §9-6: 빌드 + TDZ + 회귀

---

## Review

### Adversarial Review (v1 → v2 반영)

**판정**: CONDITIONAL PASS

**v1 Critical 해결**:
- [C1] HierarchicalTree → MsNode로 교체 ✓
- [C2/C3] onCascade stub → 명시적 prop chain ✓
- [C4] import TDZ → inline 구현 ✓

**잔여 Warning**:
- [W5] Undo 원자성: cascade에 prevStates 반환 + MsTaskTreeMode undoStack 연결로 해결. 단, `updateMilestone` 단일 호출의 롤백은 기존 store 동작(console.error만)과 일관성 유지 — 별도 이슈로 분리
- [I2] `updateMilestone` 자체 롤백 미구현: 기존 store 전체 패턴이므로 9a 범위 외 (기존 동작 유지)

**권장**: Step 4+5 구현 시 `allMilestones`가 로드 전 빈 배열인 경우 ghost 깜빡임 주의. `milestones` selector가 이미 store에서 동기적으로 로드되므로 실제로는 문제 없을 가능성 높으나, 렌더 확인 필요.
