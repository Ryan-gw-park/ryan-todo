# Loop-37: 계층형 마일스톤 + 프로젝트 뷰 통합

> **분류**: Feature (DB 스키마 변경 + 프로젝트 뷰 전면 재구성)
> **선행 조건**: Loop-36A/B/C 완료
> **참조 목업**: `docs/mockups/loop-37-hierarchical-ms-mockup-v5.jsx`
> **Agent 리뷰 필수**

---

## 목표

1. **key_milestones에 `parent_id` 추가** — 계층형 마일스톤 지원 (프로젝트마다 깊이가 다름)
2. **프로젝트 뷰 3탭 → 단일 통합 뷰** — 좌측: 컬럼 정렬 트리 (항상 고정) + 우측: [전체 할일 | 선택 항목 | 타임라인] 패널 전환
3. **기존 flat 프로젝트 완전 호환** — parent_id = NULL이면 기존과 동일 동작

---

## 아키텍처 변경 요약

```
변경 전:
  ProjectLayer
  ├── [마일스톤] 탭 → CompactMilestoneTab (flat MS → 연결된 할일)
  ├── [할일] 탭    → TasksTab / CompactTaskList
  └── [타임라인] 탭 → TimelineView (LeftPanel + TimelineGrid)

변경 후:
  ProjectLayer
  └── UnifiedProjectView (단일)
      ├── 좌측: HierarchicalTree (컬럼 정렬 트리, 항상 고정)
      │   └── TreeNode (재귀) — depth × 고정너비 컬럼
      └── 우측: RightPanel
          ├── [전체 할일] → AllTasksList (모든 리프의 할일, 그룹핑)
          ├── [선택 항목] → SelectedTasksList (선택된 리프의 할일)
          └── [타임라인]  → TimelineGrid (기존 재사용)
```

---

## Part 1: DB 스키마 — 계층형 마일스톤

### 마이그레이션 SQL

Ryan이 Supabase SQL Editor에서 직접 실행.

```sql
-- Loop-37: 계층형 마일스톤
-- parent_id = NULL이면 최상위 (기존 flat MS는 모두 NULL)
ALTER TABLE key_milestones
  ADD COLUMN parent_id uuid DEFAULT NULL
  REFERENCES key_milestones(id) ON DELETE CASCADE;

-- 깊이 캐시 (프론트에서 계산해도 되지만, 쿼리 편의)
ALTER TABLE key_milestones
  ADD COLUMN depth integer DEFAULT 0;

-- 인덱스
CREATE INDEX idx_key_milestones_parent ON key_milestones(parent_id);
CREATE INDEX idx_key_milestones_depth ON key_milestones(depth);
```

### RLS 확인

기존 key_milestones RLS 정책이 parent_id 컬럼 추가로 영향받지 않는지 확인 필요.

```bash
grep -rn "key_milestones" supabase/migrations/ --include="*.sql" -l
```

기존 정책이 `SELECT *` 패턴이면 새 컬럼이 자동 포함되므로 변경 불필요.

### 데이터 마이그레이션

기존 flat MS는 모두 `parent_id = NULL, depth = 0`으로 유지됨 (DEFAULT 값). 별도 데이터 마이그레이션 없음.

---

## Part 2: Store 확장 — 계층형 milestones

### 진단 Phase

```bash
# 36A에서 milestones를 store에 어떻게 올렸는지 확인
grep -rn "milestones\|key_milestones" src/hooks/useStore.js -n | head -20

# loadAll에서 milestones 로딩 쿼리
grep -rn "from.*key_milestones\|select.*milestones" src/hooks/useStore.js -n | head -10

# milestones CRUD 함수 (addMilestone, updateMilestone, deleteMilestone)
grep -rn "addMilestone\|updateMilestone\|deleteMilestone\|reorderMilestones" src/hooks/useStore.js -n | head -15
```

### 변경 사항

**milestones 로딩에 parent_id, depth 추가:**

```js
// loadAll 내 milestones 쿼리
const { data: milestones } = await d
  .from('key_milestones')
  .select('id, title, color, status, sort_order, pkm_id, owner_id, start_date, due_date, parent_id, depth')
  // ← parent_id, depth 추가
```

**addMilestone 확장:**

```js
addMilestone: async (pkmId, title, parentId = null) => {
  const parentMs = parentId ? get().milestones.find(m => m.id === parentId) : null;
  const depth = parentMs ? parentMs.depth + 1 : 0;

  const { data } = await d.from('key_milestones').insert({
    pkm_id: pkmId,
    title,
    parent_id: parentId,
    depth,
    sort_order: /* 형제 중 마지막 */,
  }).select().single();

  if (data) set({ milestones: [...get().milestones, mapMilestone(data)] });
},
```

**트리 빌더 유틸:**

```js
// src/utils/milestoneTree.js
export function buildTree(milestones, pkmId) {
  const filtered = milestones.filter(m => m.pkmId === pkmId);
  const map = new Map(filtered.map(m => [m.id, { ...m, children: [] }]));
  const roots = [];

  filtered.forEach(m => {
    const node = map.get(m.id);
    if (m.parentId && map.has(m.parentId)) {
      map.get(m.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  // sort_order로 정렬 (재귀)
  const sort = (nodes) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach(n => sort(n.children));
  };
  sort(roots);

  return roots;
}

export function getMaxDepth(tree) {
  let max = 0;
  const walk = (nodes, d) => {
    nodes.forEach(n => {
      max = Math.max(max, d);
      if (n.children.length > 0) walk(n.children, d + 1);
    });
  };
  walk(tree, 0);
  return max + 1; // depth 0부터 시작하므로
}

export function collectLeaves(tree) {
  const leaves = [];
  const walk = (nodes) => {
    nodes.forEach(n => {
      if (n.children.length > 0) walk(n.children);
      else leaves.push(n);
    });
  };
  walk(tree);
  return leaves;
}

export function countTasksRecursive(node, tasks) {
  let total = 0, done = 0;
  const leafIds = [];
  const walk = (n) => {
    if (n.children.length > 0) n.children.forEach(walk);
    else leafIds.push(n.id);
  };
  walk(node);
  tasks.filter(t => leafIds.includes(t.keyMilestoneId)).forEach(t => {
    total++;
    if (t.done) done++;
  });
  return { total, done };
}
```

---

## Part 3: 프로젝트 뷰 통합 — 단일 뷰

### Phase 3-1: UnifiedProjectView 셸

**파일**: `src/components/project/UnifiedProjectView.jsx`

```jsx
function UnifiedProjectView({ projectId }) {
  const milestones = useStore(s => s.milestones);
  const tasks = useStore(s => s.tasks);
  const project = useStore(s => s.projects.find(p => p.id === projectId));

  const tree = buildTree(milestones, project.pkmId);
  const [expanded, setExpanded] = useState(() => expandAll(tree));
  const [selectedLeaf, setSelectedLeaf] = useState(null);
  const [rightMode, setRightMode] = useState("전체"); // "전체" | "선택" | "타임라인"

  return (
    <div style={{ display: "flex", ... }}>
      <HierarchicalTree tree={tree} expanded={expanded} ... />
      <RightPanel mode={rightMode} ... />
    </div>
  );
}
```

### Phase 3-2: HierarchicalTree 컴포넌트

**파일**: `src/components/project/HierarchicalTree.jsx`

v5 목업의 좌측 트리를 React 컴포넌트로 구현.

핵심 특성:
- 재귀 flattenTree → 각 행이 리프까지의 경로
- 같은 그룹 노드는 세로로 병합 (첫 행만 렌더)
- 컬럼 정렬 — depth × 고정너비, 표 구분선 없이 트리 스타일
- 행 클릭 → selectedLeaf 변경 + rightMode를 "선택"으로 전환
- 진행률 바 (하위 전체 할일 재귀 집계)
- 각 노드 hover 시 "+ 하위 추가" 표시
- 접기/펼치기: 그룹 노드 ▾▸ 토글
- DnD: 마일스톤 순서 변경 + 부모 변경 (드래그로 다른 그룹 아래로 이동)

**DnD 상세:**
```
- 같은 부모 내 순서 변경: sort_order 업데이트
- 다른 부모로 이동: parent_id + depth 업데이트 + sort_order
- depth 0 간 순서 변경: sort_order만
- 리프를 그룹으로 전환: 하위 MS를 추가하면 자동으로 그룹이 됨
  (tasks는 기존 리프에 연결 유지, 새 하위 MS에 재배치는 수동)
```

### Phase 3-3: RightPanel — 전체 할일 / 선택 항목 모드

**파일**: `src/components/project/ProjectTaskPanel.jsx`

v5 목업의 우측 할일 리스트를 컴포넌트로 구현.

**전체 할일 모드:**
- tree의 모든 리프 ID 수집
- tasks 중 해당 리프에 연결된 할일 전부 표시
- 리프별 그룹 헤더: 경로 ("법인설립 > 지점설립 > 필요서류 확보") + 컬러 도트
- 체크박스, ▶ 상세 진입, assignee, due date 표시

**선택 항목 모드:**
- selectedLeaf의 할일만 표시
- 상단에 선택된 리프 이름 + 진행률
- 할일 없으면 "드래그하여 연결 / + 추가"
- 인라인 할일 추가: Enter → `addTask({ keyMilestoneId: selectedLeaf })`

**공통:**
- 체크박스 → `toggleDone(id)`
- ▶ → `openDetail(taskId)`
- `updateTask(id, patch)` 시그니처 엄수
- `applyTransitionRules` 경유

### Phase 3-4: RightPanel — 타임라인 모드

**핵심: 기존 TimelineGrid를 그대로 재사용.**

```jsx
// rightMode === "타임라인"일 때
<TimelineGrid
  rows={visibleRows}       // 트리의 펼쳐진 노드 목록 → 간트 행으로 변환
  timeScale={timeScale}    // monthly | quarterly | annual
  onBarDrag={handleBarDrag}
  onBarResize={handleBarResize}
/>
```

**트리 ↔ TimelineGrid 연동:**

| 연동 항목 | 방법 |
|----------|------|
| 행 데이터 | `flattenVisibleNodes(tree, expanded)` → `{id, title, startDate, dueDate, depth, color, type:'ms'\|'task'}[]` |
| 접기/펼치기 | 트리의 `expanded` 상태 변경 → rows 재계산 → Grid 행 갱신 |
| 스크롤 동기화 | 트리와 Grid를 같은 flex 컨테이너에 넣고, 세로 스크롤 공유 (`overflow: auto`를 부모에) |
| 행 높이 | 고정 행 높이 (38px) — 트리 행과 Grid 행 동일 |
| 클릭 하이라이트 | 트리에서 노드 클릭 → selectedLeaf → Grid에서 해당 행 하이라이트 |

**간트 행 타입:**

```
depth 0 그룹 (법인설립)  → 반투명 그룹 바 (자식의 min(start) ~ max(end) 자동계산)
depth 1 그룹 (지점설립)  → 반투명 그룹 바 (동일)
depth N 리프 (필요서류)  → 개별 바 (start_date ~ due_date, 드래그 이동/리사이즈 가능)
할일 (설립등기 할일)     → 기존 TimelineGrid 할일 바 패턴
```

**그룹 바 기간 자동계산:**

```js
function computeGroupSpan(node, milestones, tasks) {
  if (!node.children.length) {
    // 리프: 자신의 start_date ~ due_date, 또는 연결된 tasks의 min/max
    return { start: node.startDate, end: node.dueDate };
  }
  // 그룹: 자식 전체의 min(start) ~ max(end)
  const spans = node.children.map(c => computeGroupSpan(c, milestones, tasks));
  return {
    start: min(spans.map(s => s.start).filter(Boolean)),
    end: max(spans.map(s => s.end).filter(Boolean)),
  };
}
```

### Phase 3-5: ProjectLayer 연결 변경

```jsx
// 기존
{activeTab === 'milestone' && <CompactMilestoneTab />}
{activeTab === 'tasks' && <TasksTab />}
{activeTab === 'timeline' && <TimelineView projectId={...} />}

// 변경
<UnifiedProjectView projectId={selectedProjectId} />
// 탭 자체가 사라짐. 3탭 버튼 UI 제거.
```

**기존 컴포넌트 처리:**
- `CompactMilestoneTab.jsx` → 삭제하지 않음 (보존). import만 제거.
- `TasksTab.jsx` / `CompactTaskList.jsx` → 삭제하지 않음. import만 제거.
- `TimelineView.jsx` → **글로벌 타임라인에서는 계속 사용**. 프로젝트 뷰에서만 UnifiedProjectView로 대체.
- `TimelineGrid` → **공유 컴포넌트로 재사용**. UnifiedProjectView와 글로벌 TimelineView 모두 사용.

---

## Part 4: "+ 하위 추가" 기능

각 노드에서 하위 마일스톤을 추가할 수 있어야 한다.

**그룹 노드**: hover 시 "+ 하위 추가" → 클릭 시 해당 노드의 children에 새 MS 생성
**리프 노드**: hover 시 "+ 할일 추가" → 인라인 입력 → addTask({ keyMilestoneId: leafId })
**최상위**: 트리 하단 "+ 마일스톤 추가" → depth 0, parent_id = null

```js
// 하위 MS 추가
const addChildMilestone = async (parentId, title) => {
  const parent = milestones.find(m => m.id === parentId);
  await addMilestone(parent.pkmId, title, parentId);
  // addMilestone이 parent_id, depth를 자동 설정
};
```

**리프 → 그룹 전환**: 현재 리프(할일이 연결됨)에 하위 MS를 추가하면, 해당 노드가 자동으로 그룹이 된다. 기존에 연결된 할일은 keyMilestoneId가 그대로 유지되므로, 해당 노드를 리프로 취급하면 여전히 할일이 보인다. 이 경우 그룹이면서 동시에 할일이 있는 "하이브리드" 노드가 된다. UI에서는 하위 MS 목록 아래에 "직접 연결된 할일" 섹션을 표시한다.

---

## 검증 체크리스트

### DB
- [ ] parent_id 컬럼 추가 성공
- [ ] depth 컬럼 추가 성공
- [ ] 기존 flat MS가 parent_id=NULL, depth=0으로 유지
- [ ] 인덱스 생성 확인
- [ ] RLS 영향 없음 확인

### 트리 구조
- [ ] flat 프로젝트(정기주총): depth 0만 → 1컬럼 트리, 기존과 동일 동작
- [ ] deep 프로젝트(일본법인): 3~4단계 계층 → 다컬럼 트리
- [ ] 접기/펼치기 개별 노드 동작
- [ ] 전체 펼치기 / 최상위만 / 전체 접기 동작
- [ ] 진행률 바 재귀 집계 정확
- [ ] 행 클릭 → 선택 하이라이트 + 우측 전환

### 우측 패널
- [ ] [전체 할일] 모드: 모든 리프 할일 그룹핑 표시, 경로 헤더
- [ ] [선택 항목] 모드: 선택된 리프 할일만, + 추가
- [ ] [타임라인] 모드: TimelineGrid 정상 렌더, 간트 바 표시
- [ ] 타임라인: 트리 접기/펼치기 → 간트 행 연동
- [ ] 타임라인: 그룹 바 자동 기간 계산
- [ ] 타임라인: 바 드래그 이동/리사이즈 정상

### CRUD
- [ ] + 마일스톤 추가 (depth 0) → DB 저장
- [ ] + 하위 추가 (depth N+1) → parent_id, depth 정확
- [ ] + 할일 추가 (리프에) → keyMilestoneId 설정
- [ ] 마일스톤 DnD 순서 변경 → sort_order 업데이트
- [ ] 마일스톤 DnD 부모 변경 → parent_id, depth 업데이트

### 기존 뷰 호환
- [ ] 글로벌 타임라인 뷰: TimelineView 정상 (프로젝트 뷰와 독립)
- [ ] 글로벌 전체 할일 뷰(36A): MS 그룹핑에 계층 MS 반영
- [ ] 매트릭스 MS 모드(36A): 계층 MS 표시
- [ ] DetailPanel에서 MS 표시: 계층 경로 or 리프 이름

### 회귀 검증
- [ ] 오늘 할일 뷰 정상
- [ ] 전체 할일 뷰 정상
- [ ] 매트릭스 뷰 정상 (할일 모드 + MS 모드)
- [ ] 글로벌 타임라인 정상
- [ ] 주간 플래너 정상
- [ ] 노트 뷰 정상
- [ ] DetailPanel 정상
- [ ] 모바일 레이아웃 정상
- [ ] `npm run build` 성공

---

## 주의사항

1. **updateTask(id, patch) 시그니처 엄수**
2. **기존 마이그레이션 파일 수정 금지** — 새 파일로 생성
3. **CompactMilestoneTab, TasksTab, CompactTaskList를 삭제하지 않는다** — import만 제거, 파일 보존
4. **TimelineGrid는 수정하지 않고 재사용** — props 인터페이스만 맞춤
5. **글로벌 TimelineView는 건드리지 않는다** — 프로젝트 뷰에서만 UnifiedProjectView 사용
6. **CSS 변수 사용 금지** — 인라인 스타일 컨벤션
7. **왼쪽 컬러 보더 사용 금지** — 도트로 대체
8. **`select('*')` 금지**
9. **DnD 센서 표준 설정** (distance: 3, delay: 200)
10. **flat 프로젝트에서 모든 기능이 동일하게 동작해야 한다** — parent_id=NULL인 MS만 있어도 트리/할일/타임라인 전부 정상

---

## 작업 내역

(작업 완료 후 기록)
