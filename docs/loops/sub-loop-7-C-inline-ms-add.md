# Sub-Loop 7-C: 매트릭스 셀에서 "+ 마일스톤" 인라인 추가

## 목표
요구사항 #2: "매트릭스 화면에서 마일스톤 추가가 안됨"

매트릭스 셀에서 hover 없이도 작은 "+ 마일스톤" 버튼으로 즉시 MS 생성 + 자동 인라인 편집 모드 진입.

- **개인 매트릭스**: today 컬럼 셀에서만 노출 (Q1 답변과 일관 — 빈 MS는 today에만 표시되므로)
- **팀 매트릭스**: 모든 (프로젝트 × 멤버) 셀에서 노출
- 생성된 MS의 `owner_id`는 셀 위치로 자동 결정 (개인=`userId`, 팀=`mem.userId`)
- 생성 직후 `editingMsId`로 set → MilestoneRow가 input 노출 + 자동 포커스 (7-A 활용)

---

## REQ-LOCK 요구사항

1. `addMilestone` 시그니처에 5번째 인자 `ownerId` 추가 (default `null`) — 기존 호출자 5곳 무영향
2. 신규 store action `addMilestoneInProject(projectId, opts)` — pkm 자동 select-or-insert + addMilestone 호출
3. 신규 컴포넌트 `cells/InlineMsAdd.jsx` — 작은 텍스트 버튼 (~25줄)
4. PersonalMatrixGrid: today 컬럼 셀에만 InlineMsAdd 노출
5. TeamMatrixGrid: 모든 (project × member) 셀에 노출
6. 클릭 시 빈 title MS 생성 → `onStartMsEdit(newMs.id)` 호출 → 7-A의 `editingMsId` 흐름으로 자동 인라인 편집
7. 생성 시 owner_id 자동 set (개인=userId, 팀=mem.userId)
8. Vite TDZ 0건
9. weekly grids 변경 없음
10. UnifiedGridView 변경 없음 (`onStartMsEdit`은 7-A에서 이미 prop drilling됨)

---

## 영향 파일

| # | 파일 | 종류 | 변경 요약 |
|---|---|---|---|
| 1 | `src/hooks/useStore.js` | EDIT | `addMilestone` 5번째 인자 + 신규 `addMilestoneInProject` action |
| 2 | `src/components/views/grid/cells/InlineMsAdd.jsx` | **CREATE** | 신규 — 작은 "+ 마일스톤" 버튼 |
| 3 | `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | EDIT | InlineMsAdd import + handleAddMsForCell + today 셀에 노출 |
| 4 | `src/components/views/grid/grids/TeamMatrixGrid.jsx` | EDIT | InlineMsAdd import + handleAddMsForCell + 모든 셀에 노출 |

---

## 1. EDIT: `src/hooks/useStore.js`

### 1-1. addMilestone 5번째 인자 ownerId 추가

기존 함수의 시그니처와 insert payload만 수정:

```js
// OLD
  addMilestone: async (projectId, pkmId, title, parentId = null) => {
    const d = db()
    if (!d) return null
    const userId = getCachedUserId()
    // depth: parent_id 체인을 따라가서 실제 depth 계산 (DB depth 필드 의존 안함)
    const computeDepthChain = (pid) => {
      let depth = 0, cur = pid
      const visited = new Set()
      while (cur) {
        if (visited.has(cur)) break
        visited.add(cur)
        const parent = get().milestones.find(m => m.id === cur)
        if (!parent) break
        depth++
        cur = parent.parent_id
      }
      return depth
    }
    const depth = parentId ? computeDepthChain(parentId) : 0
    const siblings = get().milestones.filter(m => m.project_id === projectId && m.parent_id === parentId)
    const sortOrder = siblings.length

    const { data, error } = await d.from('key_milestones')
      .insert({
        pkm_id: pkmId,
        project_id: projectId,
        title,
        parent_id: parentId,
        depth,
        sort_order: sortOrder,
        created_by: userId,
        owner_id: null,
        status: 'not_started',
      })
      .select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, parent_id, depth')
      .single()
    if (error) { console.error('[useStore] addMilestone:', error); return null }
    if (data) set({ milestones: [...get().milestones, data] })
    return data
  },
```
```js
// NEW
  addMilestone: async (projectId, pkmId, title, parentId = null, ownerId = null) => {
    const d = db()
    if (!d) return null
    const userId = getCachedUserId()
    // depth: parent_id 체인을 따라가서 실제 depth 계산 (DB depth 필드 의존 안함)
    const computeDepthChain = (pid) => {
      let depth = 0, cur = pid
      const visited = new Set()
      while (cur) {
        if (visited.has(cur)) break
        visited.add(cur)
        const parent = get().milestones.find(m => m.id === cur)
        if (!parent) break
        depth++
        cur = parent.parent_id
      }
      return depth
    }
    const depth = parentId ? computeDepthChain(parentId) : 0
    const siblings = get().milestones.filter(m => m.project_id === projectId && m.parent_id === parentId)
    const sortOrder = siblings.length

    const { data, error } = await d.from('key_milestones')
      .insert({
        pkm_id: pkmId,
        project_id: projectId,
        title,
        parent_id: parentId,
        depth,
        sort_order: sortOrder,
        created_by: userId,
        owner_id: ownerId,
        status: 'not_started',
      })
      .select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, parent_id, depth')
      .single()
    if (error) { console.error('[useStore] addMilestone:', error); return null }
    if (data) set({ milestones: [...get().milestones, data] })
    return data
  },
```

> 변경: 시그니처 `parentId = null` → `parentId = null, ownerId = null`. insert payload `owner_id: null` → `owner_id: ownerId`. 기존 호출자 5곳 (HierarchicalTree, MsTaskTreeMode, MsTaskListMode, CompactMilestoneTab) 모두 5번째 인자 안 넘김 → ownerId=null → 동작 100% 동일.

### 1-2. 신규 action `addMilestoneInProject` 추가

기존 `addMilestone: async (...) => {...},` 정의 직후에 추가:

```js
// 추가 (addMilestone 정의 뒤)

  // 매트릭스 셀에서 MS를 추가할 때 사용 — pkm을 자동으로 select-or-insert 후 addMilestone 호출
  addMilestoneInProject: async (projectId, opts = {}) => {
    const { ownerId = null, title = '', parentId = null } = opts
    // 1. pkm 확보 — 먼저 메모리의 milestones에서 추출 시도
    let pkmId = get().milestones.find(m => m.project_id === projectId)?.pkm_id
    if (!pkmId) {
      // 2. DB 조회
      const d = db()
      if (!d) return null
      const { data: pkm, error: selErr } = await d
        .from('project_key_milestones')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle()
      if (selErr) {
        console.error('[useStore] addMilestoneInProject select pkm:', selErr)
        return null
      }
      if (pkm) {
        pkmId = pkm.id
      } else {
        // 3. 없으면 생성
        const userId = getCachedUserId()
        const { data: created, error: insErr } = await d
          .from('project_key_milestones')
          .insert({ project_id: projectId, created_by: userId })
          .select('id')
          .single()
        if (insErr) {
          console.error('[useStore] addMilestoneInProject create pkm:', insErr)
          return null
        }
        pkmId = created?.id
      }
    }
    if (!pkmId) return null
    return get().addMilestone(projectId, pkmId, title, parentId, ownerId)
  },
```

> `useProjectKeyMilestone` hook은 그대로 유지 (다른 컴포넌트가 아직 사용 중). 향후 별도 리팩터링 sub-loop에서 통합 검토 가능.

---

## 2. CREATE: `src/components/views/grid/cells/InlineMsAdd.jsx`

```jsx
import { COLOR } from '../../../../styles/designTokens'

/* ─── Inline MS Add — 매트릭스 셀 하단의 작은 "+ 마일스톤" 버튼 ─── */
export default function InlineMsAdd({ onClick }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick && onClick() }}
      style={{
        display: 'block',
        marginTop: 2,
        padding: '3px 4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 11,
        color: '#c8c8c8',
        fontFamily: 'inherit',
        transition: 'color 0.12s',
        width: '100%',
        textAlign: 'left',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = COLOR.textSecondary }}
      onMouseLeave={e => { e.currentTarget.style.color = '#c8c8c8' }}
    >
      + 마일스톤
    </button>
  )
}
```

> InlineAdd("+ 추가")와 동일한 fade-in 컬러 패턴 (#c8c8c8 → hover 시 진하게). 일관된 인터랙션.

---

## 3. EDIT: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

### 3-1. import 추가

```jsx
// OLD
import InlineAdd from '../../../shared/InlineAdd'
import { CATS } from '../constants'
import ProjectCell from '../shared/ProjectCell'
import DroppableCell from '../shared/DroppableCell'
import CellContent from '../cells/CellContent'
```
```jsx
// NEW
import InlineAdd from '../../../shared/InlineAdd'
import { CATS } from '../constants'
import ProjectCell from '../shared/ProjectCell'
import DroppableCell from '../shared/DroppableCell'
import CellContent from '../cells/CellContent'
import InlineMsAdd from '../cells/InlineMsAdd'
```

### 3-2. props에 onStartMsEdit는 이미 있음 — 활용만

`onStartMsEdit`은 7-A에서 이미 props로 받고 있음. 추가 작업 없음.

### 3-3. addMilestoneInProject store action 추가

기존 `const addTask = useStore(s => s.addTask)` 다음에 추가:

```jsx
// OLD
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
  const userId = getCachedUserId()
```
```jsx
// NEW
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
  const userId = getCachedUserId()
```

### 3-4. 셀 안에 handleAddMsForCell 클로저 + InlineMsAdd 노출

`InlineAdd` 호출 직후에 today 컬럼인 경우만 InlineMsAdd 추가. 그리고 `handleCellMsAddTask` 클로저 옆에 `handleAddMsForCell` 추가:

```jsx
// OLD
              const cellMs = cat.key === 'today' ? projMyMilestones : null
              const handleCellMsAddTask = async (msId) => {
                const t = await addTask({
                  text: '',
                  projectId: proj.id,
                  keyMilestoneId: msId,
                  category: cat.key,
                })
                if (t) setEditingId(t.id)
              }
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellActiveCount > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellActiveCount}건</span> : null
                    ) : (
                      <>
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          toggleDone={toggleDone} openDetail={openDetail}
                          matrixMsInteractive
                          editingMsId={editingMsId}
                          onStartMsEdit={onStartMsEdit}
                          handleMsEditFinish={handleMsEditFinish}
                          cancelMsEdit={cancelMsEdit}
                          matrixMsCollapsed={matrixMsCollapsed}
                          toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                          handleMsDelete={handleMsDelete}
                          onMsAddTask={handleCellMsAddTask}
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                        />
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                      </>
                    )}
                  </div>
                </DroppableCell>
              )
```
```jsx
// NEW
              const cellMs = cat.key === 'today' ? projMyMilestones : null
              const handleCellMsAddTask = async (msId) => {
                const t = await addTask({
                  text: '',
                  projectId: proj.id,
                  keyMilestoneId: msId,
                  category: cat.key,
                })
                if (t) setEditingId(t.id)
              }
              // 7-C: today 컬럼에서만 MS 추가 가능 (개인 매트릭스의 빈 MS도 today에만 표시되므로 일관성 유지)
              const handleAddMsForCell = async () => {
                const newMs = await addMilestoneInProject(proj.id, { ownerId: userId })
                if (newMs && onStartMsEdit) onStartMsEdit(newMs.id)
              }
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellActiveCount > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellActiveCount}건</span> : null
                    ) : (
                      <>
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          toggleDone={toggleDone} openDetail={openDetail}
                          matrixMsInteractive
                          editingMsId={editingMsId}
                          onStartMsEdit={onStartMsEdit}
                          handleMsEditFinish={handleMsEditFinish}
                          cancelMsEdit={cancelMsEdit}
                          matrixMsCollapsed={matrixMsCollapsed}
                          toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                          handleMsDelete={handleMsDelete}
                          onMsAddTask={handleCellMsAddTask}
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                        />
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                        {cat.key === 'today' && <InlineMsAdd onClick={handleAddMsForCell} />}
                      </>
                    )}
                  </div>
                </DroppableCell>
              )
```

> 핵심: `{cat.key === 'today' && <InlineMsAdd ... />}` — today 컬럼에만 노출.

---

## 4. EDIT: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

### 4-1. import 추가

```jsx
// OLD
import InlineAdd from '../../../shared/InlineAdd'
import ProjectCell from '../shared/ProjectCell'
import DroppableCell from '../shared/DroppableCell'
import MiniAvatar from '../shared/MiniAvatar'
import CellContent from '../cells/CellContent'
```
```jsx
// NEW
import InlineAdd from '../../../shared/InlineAdd'
import ProjectCell from '../shared/ProjectCell'
import DroppableCell from '../shared/DroppableCell'
import MiniAvatar from '../shared/MiniAvatar'
import CellContent from '../cells/CellContent'
import InlineMsAdd from '../cells/InlineMsAdd'
```

### 4-2. addMilestoneInProject store action 추가

```jsx
// OLD
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
```
```jsx
// NEW
  const milestones = useStore(s => s.milestones)
  const addTask = useStore(s => s.addTask)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
```

### 4-3. 셀 안에 handleAddMsForCell + InlineMsAdd 노출

```jsx
// OLD
              const cellMs = milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)
              const handleCellMsAddTask = async (msId) => {
                const t = await addTask({
                  text: '',
                  projectId: proj.id,
                  keyMilestoneId: msId,
                  category: 'today',
                  scope: 'assigned',
                  assigneeId: mem.userId,
                })
                if (t) setEditingId(t.id)
              }
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellActiveCount > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellActiveCount}건</span> : null
                    ) : (
                      <>
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          toggleDone={toggleDone} openDetail={openDetail}
                          matrixMsInteractive
                          editingMsId={editingMsId}
                          onStartMsEdit={onStartMsEdit}
                          handleMsEditFinish={handleMsEditFinish}
                          cancelMsEdit={cancelMsEdit}
                          matrixMsCollapsed={matrixMsCollapsed}
                          toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                          handleMsDelete={handleMsDelete}
                          onMsAddTask={handleCellMsAddTask}
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                        />
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                      </>
                    )}
                  </div>
                </DroppableCell>
              )
```
```jsx
// NEW
              const cellMs = milestones.filter(m => m.project_id === proj.id && m.owner_id === mem.userId)
              const handleCellMsAddTask = async (msId) => {
                const t = await addTask({
                  text: '',
                  projectId: proj.id,
                  keyMilestoneId: msId,
                  category: 'today',
                  scope: 'assigned',
                  assigneeId: mem.userId,
                })
                if (t) setEditingId(t.id)
              }
              // 7-C: 셀 위치(프로젝트 × 멤버)로 owner 자동 set
              const handleAddMsForCell = async () => {
                const newMs = await addMilestoneInProject(proj.id, { ownerId: mem.userId })
                if (newMs && onStartMsEdit) onStartMsEdit(newMs.id)
              }
              return (
                <DroppableCell key={dropId} id={dropId} activeId={activeId}>
                  <div style={{ padding: '6px 8px', minHeight: 36 }}>
                    {isCol ? (
                      cellActiveCount > 0 ? <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{cellActiveCount}건</span> : null
                    ) : (
                      <>
                        <CellContent
                          tasks={cellTasks}
                          cellMilestones={cellMs}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          toggleDone={toggleDone} openDetail={openDetail}
                          matrixMsInteractive
                          editingMsId={editingMsId}
                          onStartMsEdit={onStartMsEdit}
                          handleMsEditFinish={handleMsEditFinish}
                          cancelMsEdit={cancelMsEdit}
                          matrixMsCollapsed={matrixMsCollapsed}
                          toggleMatrixMsCollapse={toggleMatrixMsCollapse}
                          handleMsDelete={handleMsDelete}
                          onMsAddTask={handleCellMsAddTask}
                          doneCollapsed={projDoneCollapsed}
                          onToggleDoneCollapse={onToggleProjDone}
                        />
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                        <InlineMsAdd onClick={handleAddMsForCell} />
                      </>
                    )}
                  </div>
                </DroppableCell>
              )
```

> 팀 매트릭스에서는 모든 셀에 InlineMsAdd 노출 (조건 없음).

---

## DELETE-5 검증

이 sub-loop는 **추가 only** — 삭제 0건. 단 `addMilestone` 시그니처 변경의 cascade만 확인.

| 항목 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|---|---|---|---|---|---|---|
| `addMilestone` 5번째 인자 추가 | useStore 내부 정의 | HierarchicalTree, MsTaskTreeMode, MsTaskListMode, CompactMilestoneTab 5곳 | 모두 4개 인자만 전달 → ownerId=null default | — | — | 무영향 (default 사용) |
| `addMilestoneInProject` 신규 | useStore 내부 정의 | PersonalMatrixGrid, TeamMatrixGrid 신규 호출 | — | `db()`, `getCachedUserId`, `addMilestone` | — | 신규 추가 |
| `InlineMsAdd` 신규 컴포넌트 | 자체 파일 | PersonalMatrixGrid, TeamMatrixGrid | onClick | COLOR | — | 신규 추가 |

### 잔여 import 검증
- [x] InlineMsAdd: `COLOR` 1건만 import — 본문에서 사용
- [x] PersonalMatrixGrid: `InlineMsAdd` import 추가 — `{cat.key === 'today' && ...}`에서 사용
- [x] TeamMatrixGrid: `InlineMsAdd` import 추가 — 셀 마지막에 사용
- [x] useStore: 신규 import 0건 (`db`, `getCachedUserId`는 이미 모듈 내 사용 중)

### 기존 호출자 호환성
- [x] `HierarchicalTree.jsx` line 276, 287: `addMilestone(projectId, pkmId, '', nodeId)` → ownerId 미지정 → null
- [x] `MsTaskTreeMode.jsx` line 99: `addMilestone(projectId, pkmId, '', parentId)` → ownerId 미지정 → null
- [x] `MsTaskListMode.jsx` line 35: `addMilestone(projectId, pkmId, '', parentId)` → ownerId 미지정 → null
- [x] `CompactMilestoneTab.jsx` line 149: `addMilestone()` (인자 없음) → 모두 default

> CompactMilestoneTab의 `addMilestone()` 인자 없는 호출은 별도 이슈일 수 있음 — projectId/pkmId 없이 호출하면 RLS 에러. 하지만 이건 7-C 범위 밖. **변경하지 않음**.

---

## REQ-LOCK 검증

| # | 요구사항 | 적용 위치 | 확인 |
|---|---|---|---|
| 1 | addMilestone 5번째 인자 ownerId | useStore §1-1 | ✓ |
| 2 | 신규 addMilestoneInProject action | useStore §1-2 | ✓ |
| 3 | 신규 InlineMsAdd 컴포넌트 | cells/InlineMsAdd.jsx §2 | ✓ |
| 4 | 개인 매트릭스 today 컬럼만 | PersonalMatrixGrid §3-4 `cat.key === 'today' && ...` | ✓ |
| 5 | 팀 매트릭스 모든 셀 | TeamMatrixGrid §4-3 무조건 | ✓ |
| 6 | 클릭 → 빈 MS + 자동 인라인 편집 | handleAddMsForCell → onStartMsEdit | ✓ |
| 7 | owner_id 자동 set | 개인 ownerId=userId, 팀 ownerId=mem.userId | ✓ |
| 8 | Vite TDZ 0건 | 모든 token 참조 컴포넌트 함수 내부 | ✓ |
| 9 | weekly grids 변경 없음 | PersonalWeeklyGrid, TeamWeeklyGrid 미수정 | ✓ |
| 10 | UnifiedGridView 변경 없음 | onStartMsEdit 이미 prop drilling됨 | ✓ |

---

## 빌드 검증 명령

```bash
# 1. 빌드
npm run build

# 2. 신규 파일 존재
ls src/components/views/grid/cells/InlineMsAdd.jsx

# 3. addMilestone 시그니처 검증
grep -n "addMilestone:" src/hooks/useStore.js
# 예상: 1건, 시그니처에 ownerId 포함

# 4. addMilestoneInProject action 검증
grep -n "addMilestoneInProject" src/hooks/useStore.js
# 예상: 정의 1건

# 5. InlineMsAdd 사용처 검증
grep -rn "InlineMsAdd" src/components/views/grid/grids/
# 예상: PersonalMatrixGrid (today 조건), TeamMatrixGrid (무조건) 각 1건

# 6. 기존 호출자 변경 없음 확인
grep -n "addMilestone(" src/components/project/*.jsx
# 예상: 5건, 모두 4개 인자
```

## 런타임 검증 체크리스트

### 개인 매트릭스
- [ ] today 컬럼 셀 마지막에 회색 "+ 마일스톤" 텍스트 노출
- [ ] next/later 컬럼에는 노출되지 않음
- [ ] 클릭 → 빈 MS가 즉시 셀 안에 표시 + input 자동 포커스 (편집 모드)
- [ ] Enter 입력 → 제목 저장 (DB 반영 확인)
- [ ] 빈 제목으로 blur → MilestoneRow는 "(제목 없음)"으로 표시 (기존 fallback)
- [ ] 같은 프로젝트에 새 빈 MS가 누적 가능 (여러 번 클릭)
- [ ] 새로 만든 MS의 owner_id가 현재 user (Supabase에서 직접 확인)

### 팀 매트릭스
- [ ] 모든 (project × member) 셀 마지막에 "+ 마일스톤" 노출
- [ ] 다른 멤버 셀에서 클릭 → 그 멤버 owner로 MS 생성
- [ ] 각 셀이 independent — 한 셀에서 만든 MS는 다른 셀의 owner로 보이지 않음
- [ ] owner_id가 mem.userId로 set (Supabase에서 직접 확인)

### project_key_milestones 자동 생성
- [ ] 새 프로젝트(MS 0개)에서 "+ 마일스톤" 첫 클릭 → pkm 자동 생성 + MS 정상 생성
- [ ] 기존 프로젝트에서 클릭 → 기존 pkm 재사용 (Supabase에서 pkm row 1개 유지 확인)

### 7-A 기능과 충돌 없음
- [ ] 신규 MS의 인라인 편집 → 기존 MilestoneRow 흐름 동일
- [ ] 신규 MS hover → +/⋮/› 모두 동작
- [ ] 신규 MS 접기/펼치기 동작
- [ ] 신규 MS 삭제 → confirm dialog → 정상

### Weekly (regression)
- [ ] 개인/팀 주간 변경 없이 정상 — "+ 마일스톤" 버튼 없음

### 7-B (Done section) 호환
- [ ] 새 MS 추가 후 done section 펼침/접힘 정상

---

## 커밋 메시지

```
feat(matrix): inline "+ 마일스톤" button in cells (Sub-Loop 7-C)

- New InlineMsAdd component (cells/InlineMsAdd.jsx) — small footer button
- Personal matrix: shows in today column only (matches empty MS visibility rule)
- Team matrix: shows in every (project × member) cell
- New owner_id auto-set per cell position:
  * Personal: owner = current userId
  * Team: owner = mem.userId of the cell
- useStore: addMilestone gains optional 5th param ownerId (default null,
  existing 5 callers unaffected)
- useStore: new addMilestoneInProject action — auto select-or-insert pkm,
  then delegates to addMilestone
- Click flow: create empty MS → onStartMsEdit(newMs.id) → MilestoneRow auto
  enters edit mode (uses 7-A editingMsId pipeline)
- UnifiedGridView untouched — onStartMsEdit was already prop-drilled in 7-A
- Weekly grids unchanged
```
