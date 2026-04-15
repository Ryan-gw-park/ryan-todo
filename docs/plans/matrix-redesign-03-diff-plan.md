# Loop 43 — ProjectView 평탄화 Diff Plan

> **Phase**: ProjectView Cleanup
> **Spec**: [matrix-redesign-03-spec.md](./matrix-redesign-03-spec.md)
> **Date**: 2026-04-15
> **Depends on**: Loop 41 (MS L1 flat 완료)
> **Parallel with**: Loop 42

---

## 0. 사전 조사 결과 (spec 가정 vs 실제)

| Spec 가정 | 실제 | 조치 |
|----------|------|------|
| MilestoneDetailModal에 "상위 MS 선택" UI 존재 | **없음**. 해당 파일 188줄엔 `<MemberSelect>` (담당자만) | L43-R04 적용 대상 **없음**. 단, `addMilestoneInProject(projectId, {parentId})` API의 `parentId` 옵션 deprecated (Loop 41에서 처리 예정). 모달 자체는 변경 없음 |
| Task 생성 flow가 MS 필수 강제 | **옵셔널** 이미 적용 (InlineAdd가 extraFields로 처리) | L43-R06 코드 변경 최소화 — copy 점검만 |
| BacklogPanel의 "백로그" 헤더 위치 | BacklogPanel.jsx:165 "📥 백로그" | 제거 확정 |
| MsBacklogSidebar.jsx:156 "백로그" | **Loop 42에서 파일 자체 삭제** | Loop 43에선 해당 없음 |
| MsTaskTreeMode 트리 indent | 652줄. parent_id 직접 참조는 적고, 주로 moveMilestone/cascadeMilestoneOwner 호출 | Loop 41 store 단순화 이후 자연스레 동작. indent 시각은 `computeDepth` depth값이 0이 되므로 무력화 |
| KeyMilestoneTab / CompactMilestoneTab | CompactMilestoneRow.jsx:8 `computeDepth` import | 렌더 indent 코드 제거 |

---

## 1. 변경할 파일 목록

### 1.1 삭제

| 파일 | 사유 |
|------|------|
| [src/utils/backlogFilter.js](../../src/utils/backlogFilter.js) (7줄) | "백로그" 개념 폐기 (통합 spec R11). Loop 42에서 이관 |

### 1.2 수정

| 파일 | 변경 내용 | 줄번호 |
|------|----------|--------|
| [src/components/project/BacklogPanel.jsx](../../src/components/project/BacklogPanel.jsx) | 1. import `isBacklogTask` 제거 (line 4)<br>2. `isBacklogTask` 호출 자리 (line 117)를 인라인 필터 `t => !t.keyMilestoneId && !t.done && !t.deletedAt`로 대체<br>3. "📥 백로그" 헤더 텍스트 (line 165) 제거 — 라벨 없음, chevron+indent만 유지<br>4. 섹션 접기/펼치기 로직은 유지 | 4, 117, 165 |
| [src/components/project/MsTaskTreeMode.jsx](../../src/components/project/MsTaskTreeMode.jsx) | 1. 트리 indent 계산 제거 (depth 항상 0)<br>2. 재귀 렌더 로직 제거 — 모든 MS를 같은 레벨로 map<br>3. parent 기반 DnD 제거 (Loop 41의 moveMilestone 단순화에 맞춤)<br>4. MS expand/collapse는 유지 (MS 단위) | 32(cascadeMilestoneOwner 유지), 85-99(descendant 순회 제거), 기타 트리 indent 계산 |
| [src/components/project/CompactMilestoneRow.jsx](../../src/components/project/CompactMilestoneRow.jsx) | `computeDepth` import(line 8) 및 호출 제거. indent 하드코딩 0 또는 depth param 제거 | 8 |
| [src/components/project/CompactMilestoneTab.jsx](../../src/components/project/CompactMilestoneTab.jsx) | parent_id 의존 grep. CompactMilestoneRow에 depth prop 전달 코드 제거 | grep 확인 |
| [src/components/project/KeyMilestoneTab.jsx](../../src/components/project/KeyMilestoneTab.jsx) | parent_id 의존 grep. 트리 계산이 있다면 제거 | grep 확인 |
| [src/components/modals/MilestoneDetailModal.jsx](../../src/components/modals/MilestoneDetailModal.jsx) | **변경 없음 확인** — 현재 상위 MS 선택 UI 없음. spec R04는 Skip (단, `backlog` 레이블(line 17)은 상태 label이지 "백로그" 개념과 무관 — 확인 후 유지 판단) | 17 |
| [src/utils/milestoneTree.js](../../src/utils/milestoneTree.js) | Loop 42 완료 후 `MsBacklogSidebar` 삭제됨 → `getProjectMaxDepth`(285줄), `computeDepth`(267줄) 일부 호출처 감소. CompactMilestoneRow 수정 후 추가로 사용처 0이 되는 함수들 삭제. **추가 대상**: `buildTree`, `flattenTree`, `countTasksRecursive`, `getNodePath`, `getMsPath`, `collectLeaves` — 아래 행 참조처가 모두 flat 대체된 후 삭제 | 267, 285 |
| `src/components/views/InlineTimelineView.jsx` | `buildTree` import 제거 (line 8). flat 구조에선 `buildTree(milestones, projectId)` 결과 = `milestones.filter(m => m.projectId === projectId)`. 호출부 교체 | 8 |
| `src/components/project/UnifiedProjectView.jsx` | `buildTree` import 제거 (line 6). 동일하게 flat filter로 교체 | 6 |
| `src/components/project/HierarchicalTree.jsx` | `flattenTree`, `countTasksRecursive` 호출 정리. flat 상황: `flattenTree = flat list 반환`, `countTasksRecursive = 단일 MS의 task 수` → 내부 구현 단순화 또는 호출 제거 | 6 |
| `src/components/project/ProjectTaskPanel.jsx` | `collectLeaves`, `getNodePath`, `countTasksRecursive` 제거. flat에선 leaves = 모든 MS, path = MS.title 자체, count = 직접 GROUP BY | 3 |
| `src/components/project/MsTaskListMode.jsx` | `countTasksRecursive` 호출 제거 (line 4). 직접 filter `.length` 사용 | 4 |
| `src/components/views/grid/cells/CellContent.jsx` | `getMsPath` 제거 (line 6). flat에선 path = MS.title | 6 |
| `src/components/project/CompactMsRow.jsx` | `getMsPath` 제거 (line 7). 동일 | 7 |

### 1.3 변경 없음

- DB schema
- 매트릭스 뷰 (Loop 42 완료 상태)
- addTask/applyTransitionRules
- MilestoneDetailModal (상위 선택 UI 원래 없음)

---

## 2. DB 마이그레이션

**없음.** DB는 Loop 41에서 모두 처리.

---

## 3. API 변경

**없음.**

---

## 4. 프론트엔드 변경 상세

### 4.1 BacklogPanel.jsx 평탄화

```diff
- import { isBacklogTask } from '../../utils/backlogFilter'
  ...
  // line 117
- const backlogAll = useMemo(() => projectTasks.filter(isBacklogTask), [projectTasks])
+ const backlogAll = useMemo(() =>
+   projectTasks.filter(t => !t.keyMilestoneId && !t.done && !t.deletedAt),
+   [projectTasks])
  ...
  // line 165
- <h3>📥 백로그</h3>
+ {/* 라벨 없음 — chevron + indent만 유지 (통합 spec R24) */}
+ <div style={{ paddingLeft: 24 }}>
+   <Chevron expanded={isExpanded} onClick={toggle} />
+ </div>
```

**내부 로직 유지**: 섹션 접기/펼치기, task 리스트 렌더, InlineAdd 호출 (이미 `extraFields={{keyMilestoneId: null}}`).

### 4.2 MsTaskTreeMode.jsx 평탄화

```diff
  // 기존: parent_id 기반 트리 재귀 렌더
- function renderTree(msList, depth = 0) {
-   return msList.map(ms => (
-     <>
-       <MsRow ms={ms} indent={depth * 16} />
-       {ms.children && renderTree(ms.children, depth + 1)}
-     </>
-   ))
- }

  // 신규: flat map
+ function renderFlat(msList) {
+   return msList.map(ms => <MsRow ms={ms} indent={0} />)
+ }

  // 85-99줄 handleCascadeOwner: descendant 순회 제거
- const descendants = getDescendants(msId, allMilestones)
- for (const d of descendants) await cascadeMilestoneOwner(d.id, ownerId, ...)
+ await cascadeMilestoneOwner(msId, ownerId, ...)  // Loop 41에서 단일 MS만 처리하도록 단순화됨
```

`moveMilestone` 호출부는 Loop 41에서 newParentId 무시 처리했으므로 자연 호환.

### 4.3 CompactMilestoneRow.jsx 단순화

```diff
- import { computeDepth } from '../../utils/milestoneTree'
  ...
- const depth = computeDepth(milestone, allMilestones)
- return <div style={{ paddingLeft: depth * 16 }}>{milestone.title}</div>
+ return <div>{milestone.title}</div>
```

### 4.4 backlogFilter.js 삭제

- `src/utils/backlogFilter.js` 파일 삭제
- BacklogPanel.jsx에서 import 제거 (§4.1에서 완료)
- `grep -rn 'backlogFilter\|isBacklogTask' src/` = 0건 확인

### 4.5 "백로그" 문자열 전수 점검

```bash
grep -rn '백로그\|backlog\|Backlog' src/
```

예상 잔존 결과:
- `MilestoneDetailModal.jsx:17` — `{ backlog: { label: '남은' } }` — **status label이지 "백로그" 개념과 무관**. 유지 가능 (diff 실행 시 판단)
- `addTask` 및 `InlineAdd`의 `category: 'backlog'` — **category enum**이지 "백로그" 섹션과 무관. 절대 수정 금지

사용자 노출 텍스트에서 "백로그" 제거된 것만 확인.

### 4.6 DELETE-5 검증 테이블

| 대상 | Import 제거 | JSX 제거 | Prop 체인 | 파일 삭제 | 검증 grep |
|------|------------|---------|----------|----------|----------|
| backlogFilter.js | BacklogPanel.jsx:4 | - | 호출부 인라인 대체 | ✓ | `grep -rn 'backlogFilter\|isBacklogTask' src/` = 0 |
| "📥 백로그" 헤더 | - | BacklogPanel.jsx:165 | - | - | `grep -rn '백로그' src/` 결과가 category/status label만 남음 |

### 4.7 milestoneTree.js 추가 정리 (Loop 42 완료 후)

Loop 42에서 `MsBacklogSidebar` 삭제 → `getProjectMaxDepth`는 사용처 0이 되지만 CompactMilestoneRow가 `computeDepth`를 사용 중 (Loop 43 이전 상태).

Loop 43에서 CompactMilestoneRow 수정 후 다시 grep:
- `computeDepth`: 사용처 MsBacklogSidebar(삭제됨) + CompactMilestoneRow(수정됨) → **사용처 0 → 삭제**
- `getProjectMaxDepth`: 사용처 MsBacklogSidebar(삭제됨) → **사용처 0 → 삭제**

추가 DELETE-5 대상:

| 대상 | 검증 grep |
|------|----------|
| milestoneTree.computeDepth | `grep -rn 'computeDepth' src/` = 0 |
| milestoneTree.getProjectMaxDepth | `grep -rn 'getProjectMaxDepth' src/` = 0 |

---

## 5. 작업 순서

1. **CompactMilestoneRow.jsx 수정** — computeDepth 제거
2. **CompactMilestoneTab.jsx / KeyMilestoneTab.jsx grep** — parent_id 의존 제거
3. **MsTaskTreeMode.jsx 평탄화** — 트리 재귀 → flat map
4. **BacklogPanel.jsx 수정** — isBacklogTask 인라인화, "백로그" 헤더 제거
5. **backlogFilter.js 삭제**
6. **milestoneTree.js 추가 정리** — computeDepth, getProjectMaxDepth 삭제
7. **"백로그" 문자열 grep 검증** — 사용자 노출 텍스트 0건
8. **빌드 확인** — `npm run build`
9. **런타임 검증** (§6)
10. **DELETE-5 grep 검증**

---

## 6. 검증 절차

### 6.1 빌드
- `npm run build` 성공

### 6.2 런타임 검증 (ProjectView)

| 시나리오 | 기대 결과 |
|---------|----------|
| ProjectView 진입 | 트리 indent 없이 모든 MS flat 나열 |
| "백로그" 텍스트 노출 | 0건 (UI 문자열 전체) |
| MS 없는 task 추가 (InlineAdd) | keyMilestoneId=null로 저장, 섹션에 표시 |
| MS 있는 task 추가 | 기존 동작 유지 |
| MS expand/collapse | 정상 토글 |
| MS 이동 (moveMilestone) | 다른 프로젝트로 이동만 작동 (같은 프로젝트 내 parent 변경은 no-op) |
| MS owner cascade | 단일 MS owner 변경만. 하위 MS로 전파 없음 |
| 매트릭스 뷰 (Loop 42 완료 상태) | 변경 없음 정상 |

### 6.3 DELETE-5 검증
- `grep -rn 'backlogFilter\|isBacklogTask' src/` = 0
- `grep -rn 'computeDepth' src/` = 0 (Loop 42 완료 가정)
- `grep -rn 'getProjectMaxDepth' src/` = 0
- `grep -rn '백로그' src/ --include='*.jsx'` → category/status enum 외 0건

### 6.4 회귀 검증
- 매트릭스 뷰 정상 (Loop 42 결과 유지)
- Timeline 정상 (Loop 41에서 DepthToggle 제거됨)
- 개인 매트릭스 정상

---

## 7. Rollback 계획

- `git revert` — 모든 수정 되돌림
- backlogFilter.js 파일 git 복원
- DB 변경 없음

---

## 8. REQ-LOCK 커버리지 (Loop 43 spec §2 검증)

| ID | 요구사항 | diff 반영 위치 |
|----|---------|---------------|
| L43-R01 | BacklogPanel "백로그" → 라벨 없음 | §4.1 헤더 제거 |
| L43-R02 | BacklogPanel 내부 시각/문구 정리 | §4.1 |
| L43-R03 | MsTaskTreeMode 트리 indent 제거 | §4.2 |
| L43-R04 | MilestoneDetailModal 상위 MS 선택 UI 제거 | **대상 없음 확인** — spec 가정 무효. skip 기록 |
| L43-R05 | KeyMilestoneTab / CompactMilestoneTab parent_id 의존성 정리 | §1.2 (grep 후 제거), §4.3 |
| L43-R06 | Task 생성 flow MS 선택 optional | **이미 optional 확인**. copy 점검만 (grep으로 "필수" 문구 검색) |
| L43-R07 | 프로젝트 직속 task = 1등 시민 | §4.1 (BacklogPanel 섹션은 유지하되 명칭만 제거) |
| L43-R08 | "백로그" 문자열 전수 재명명 | §4.5 |
| (추가) | backlogFilter.js 삭제 (Loop 42→43 이관) | §4.4 |

---

## 9. 알려진 리스크

| # | 리스크 | 완화 |
|---|------|------|
| R1 | MilestoneDetailModal의 상위 MS 선택 UI가 실제로 존재할 가능성 (조사 누락) | diff 실행 시 파일 재grep: `parent_id`, `parentId`, `상위`, `부모 MS` |
| R2 | `category: 'backlog'` enum을 실수로 제거 | §4.5 경고. category/status는 DB enum, 절대 수정 금지 |
| R3 | MsTaskTreeMode 평탄화로 UX가 "쓸려내려간 느낌" | 사용자에게 "MS 트리가 단일 레벨로 단순화됐음" 공지. 기능 손실 없음 |
| R4 | Loop 42 미완료 상태에서 Loop 43 실행 시 milestoneTree.computeDepth가 여전히 MsBacklogSidebar에서 사용 중 | Loop 42 완료 확인 후 Loop 43 진행. 또는 computeDepth 삭제를 Loop 42에 이관 |
| R5 | BacklogPanel 섹션을 아예 제거해야 하는지 (spec R02: "컴포넌트 유지") | spec R02 확정: 유지. 헤더만 제거 |
