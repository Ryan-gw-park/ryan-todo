# RECON: DnD Drop Zone Fixes

**Phase**: `dnd-drop-fixes`
**Status**: Recon (pre-spec)
**작성일**: 2026-04-29
**선행 commits**:
- `8314c42` (P0-2) Personal Todo Loop-50 회귀 복구 — useSortable → useDraggable
- `299c061` (P0-B) UnifiedGridView handleDragEnd deps 보완
- `2a03b4c` (P0-A) PivotTaskCell onMouseDown 가드 축소

---

## 0. 본 phase가 다루는 3개 이슈

| # | 이슈 | 뷰 |
|---|---|---|
| 1 | Cross-project drop이 안 됨 | 개인 할일 |
| 2 | Focus drop zone이 카드 영역으로만 한정됨 | 개인 할일 |
| 3 | 빈 cell drop이 안 됨 | 팀 할일 |

세 이슈 모두 **dnd-kit의 collision detection이 사용자 의도와 다른 droppable을 over로 매칭하거나 매칭 자체가 안 되는** 공통 패턴.

---

## 1. Issue 별 코드 검증 결과

### 1.1 Issue 1 — 개인 할일 cross-project drop

**현재 droppable 등록 상태** (Personal Todo Shell의 inner DndContext):

| ID | 등록 위치 | 영역 |
|---|---|---|
| `focus-panel:root` | [PersonalTodoShell.jsx:34](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L34) `FocusColumn` | column 2 전체 (minHeight 400) |
| `focus-card:${task.id}` | [FocusCard.jsx:31](../../src/components/views/personal-todo/cells/FocusCard.jsx#L31) — **`useSortable` 자동 droppable** | 각 focus 카드 영역 |
| `bl-project:${project.id}` | [PersonalTodoProjectGroup.jsx:34, line 105 `setDropRef`](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L105) — **최외곽 grid div** (Loop-49 hotfix `4687e67` 적용) | 프로젝트 그룹 전체 (헤더 + task rows) |
| `bl-task:${task.id}` | **미등록** — P0-2가 useSortable→useDraggable로 변경. useDraggable은 droppable 자동 등록 **안 함** |

**handleDragEnd 흐름** ([PersonalTodoShell.jsx:78-164](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L78-L164)):
- branch 1) `overId === 'focus-panel:root' || overId.startsWith('focus-card:')` → focus add
- branch 1.3) `overId.startsWith('bl-task:')` → P0-2가 추가한 task data 비교 분기
- branch 1.5) `overId.startsWith('bl-project:')` → cross-project move (Loop-49)

**결정적 발견**: `bl-task:` droppable이 P0-2 이후 미등록 → **branch 1.3은 dead code**. over.id가 절대 'bl-task:...'가 안 됨.

따라서 다른 project의 task 위 drop 시:
- 가까운 droppable = 그 task를 감싸는 group div (`bl-project:다른projectId`)
- over.id = 'bl-project:...' → branch 1.5 진입 → cross-project move

코드 흐름상 **정상 작동해야 함**. 그런데 사용자 보고 "안 됨".

**가설 — rectIntersection의 collision 우선순위** ([PersonalTodoShell.jsx:185](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L185)):

`rectIntersection`은 dragging item의 bounding rect와 overlap하는 droppable들을 모두 반환하고 첫 번째를 over로 선택. 등록 순서 또는 더 큰 overlap이 우선.

사용자가 source project의 task를 다른 project의 영역으로 드래그할 때:
- dragging item은 transform에 의해 visually 다른 위치로 이동
- 하지만 dragging item rect가 visually 양쪽 group과 일부 overlap할 수 있음 (group들이 세로로 인접)
- **source group이 더 먼저 등록**됐으면 source group이 over → `canMoveTaskToProject(task, sourceProject) === false` → no-op
- 사용자에겐 "안 됨"으로 보임

**부수 가설**: 사용자가 git pull 안 했을 수 있음. P0-2 (`8314c42`)가 origin/main에 있으나 local 환경 미반영 가능성. **사전 확인 필요**.

### 1.2 Issue 2 — Focus drop zone 영역 축소

**구조**:
- column 2 grid item = `<FocusColumn>` (`focus-panel:root` droppable, minHeight 400)
- 그 안에 `<FocusPanel>` (sticky, minHeight 200, [FocusPanel.jsx:66-74](../../src/components/views/personal-todo/FocusPanel.jsx#L66))
- FocusPanel 안에 SortableContext + FocusCard들 (`focus-card:*`, useSortable 자동 droppable)

**중첩 droppable 충돌**:
- 작은 droppable: `focus-card:*` (각 카드 약 40-60px 높이)
- 큰 droppable: `focus-panel:root` (column 전체)

`rectIntersection` 시 dragging item이 어떤 카드와 overlap하면 그 카드가 우선 매칭. 카드 밖 영역(FocusPanel header / quick add input / 빈 영역) 위에 dragging item 있으면 `focus-panel:root` 매칭.

**증상 메커니즘 가설**: 
- 사용자가 visually 카드 위로 dragging → `focus-card:*` 매칭 → branch 1) 진입 → focus add ✓
- 카드 외 영역(예: FocusPanel header, FocusPanel 아래 빈 column 영역) → `focus-panel:root` 매칭해야 하지만 안 됨
- 가능성: FocusPanel은 `position: sticky` — sticky element rect 계산이 dnd-kit과 호환 문제. 또는 sticky가 viewport에 고정되면서 droppable rect가 정적이지 않음.

**Loop-45 history**: `da1a0f6 fix(shell): collisionDetection pointerWithin → rectIntersection (Loop-45 QA fix)` — 즉 처음엔 pointerWithin이었다가 rectIntersection으로 변경됐음. 변경 이유가 무엇인지 확인 필요.

`5b6e94b fix(focus): Shell droppable context + 즉시 defensive filter + grid ratio (Loop-46 QA)` — Loop-46에서 droppable context 등록 위치 fix. minHeight 400 도입.

이전 hotfix들이 누적되며 현재 상태가 됐는데, 사용자 시각으로는 영역 축소 인식.

### 1.3 Issue 3 — 팀 할일 빈 cell drop

**구조**: PivotMatrixTable의 `<td>`는 droppable 미등록.
- [PivotTaskCell.jsx](../../src/components/views/grid/cells/PivotTaskCell.jsx)는 SortableContext만 등록 — useDroppable 호출 없음 (commit 11 의도, spec §2.4)
- 빈 cell 위 pointer = 어떤 droppable도 매칭 안 됨

**collision detection**: UnifiedGridView line 427 — `pointerWithin`. 정확히 등록된 droppable rect 안에 pointer 있어야 함.

매칭 가능 droppable:
- `team-matrix-band:${pid}:${msId}` — MS 밴드 stripe (`<td colSpan>` 내부, 약 24px 높이)
- `team-matrix-project-header:${pid}` — 프로젝트 헤더 행 전체

빈 cell 영역(MS 밴드 아래 + 프로젝트 헤더 행 아닌 위치)에는 droppable 0건 → over=null → dispatcher가 E-01로 처리 (no-op).

**spec §2.4 결정**: "band-level only droppable, 셀 단위 미등록". 의도된 동작. 하지만 사용자 UX 관점에서 cell 영역에 drop 가능해야 직관적.

---

## 2. 영향 받는 파일 / 모듈

| 파일 | Issue | 변경 가능성 |
|---|---|---|
| [PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | 1, 2 | DndContext collision detection 변경 또는 onDragOver 추가 |
| [PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | 1 | useDroppable 등록 위치/방식 조정 |
| [PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | 1 (가능) | 필요 시 useDroppable 추가 |
| [FocusPanel.jsx](../../src/components/views/personal-todo/FocusPanel.jsx) | 2 | sticky 처리 또는 SortableContext 위치 조정 |
| [FocusCard.jsx](../../src/components/views/personal-todo/cells/FocusCard.jsx) | 2 | useSortable → useDraggable 검토 |
| [PivotTaskCell.jsx](../../src/components/views/grid/cells/PivotTaskCell.jsx) | 3 | useDroppable 추가 (셀 단위) |
| [teamMatrixHandlers.js](../../src/components/views/grid/dnd/teamMatrixHandlers.js) | 3 | 새 type `team-matrix-cell` handler 추가 |
| [UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx) | 3 | registerHandler 추가 |

---

## 3. 구현 옵션 (이슈별)

### Issue 1 — Cross-project drop

**Option 1A**: collision detection을 `pointerWithin` 또는 `closestCorners`로 변경
- pointerWithin: pointer가 정확히 droppable rect 안에 있어야 매칭. nested 시 가장 안쪽 우선.
- closestCorners: dragging item corner와 droppable corner 거리 기반.
- 장점: collision 우선순위 명확. source group 자동 우선 문제 회피.
- 단점: Loop-45 시점에 pointerWithin → rectIntersection으로 변경한 history 있음. 회귀 위험. focus drop이 영향받음 (Issue 2와 상호작용).

**Option 1B**: source group을 droppable에서 제외 (custom collision detection)
- `rectIntersection` 결과에서 source group(active task의 projectId와 같은 group) 필터링
- 장점: 다른 변경 영향 최소. branch 1.5 자연스럽게 작동.
- 단점: collision detection 함수 커스텀 작성. dnd-kit 패턴 위반.

**Option 1C** (단순): branch 1.5에서 self-target일 때 명시적으로 fall through하지 않고 다른 droppable 찾기
- 현재는 over=source group이면 `canMoveTaskToProject` false → no-op
- 변경: source group일 때 dnd-kit `e.collisions` 배열에서 다음 후보 droppable 검토
- 장점: collision detection 무변경
- 단점: handler 로직 복잡 — `e.collisions`는 dnd-kit이 자동 제공하지 않을 수 있음

### Issue 2 — Focus drop zone 확장

**Option 2A**: FocusCard를 useSortable → useDraggable로 변경 (Personal Todo 통일)
- focus-card 자동 droppable 제거 → focus-panel:root만 남음 → FocusColumn 전체에서 drop 인식
- focus reorder는 PersonalTodoShell branch 2에서 task data 기반 처리 (PersonalTodoTaskRow와 같은 패턴)
- 장점: P0-2와 일관성. SortableContext 제거. collision 우선순위 단순화.
- 단점: focus reorder 시 auto-displacement 손실. Loop-50 같은 trade-off 다시 발생.

**Option 2B**: SortableContext를 FocusPanel 내부로 한정 + collision detection 변경
- focus-card는 useSortable 유지하되 SortableContext가 카드 영역만 커버
- collisionDetection을 `pointerWithin`으로 변경 → focus 영역 외에 pointer 있으면 focus-panel:root 매칭
- 장점: focus reorder의 auto-displacement 보존
- 단점: collision detection 변경의 다른 영향 (Issue 1과 같은 trade-off)

**Option 2C**: focus-card useSortable의 droppable 비활성화
- `useSortable({ id, disabled: true })` 또는 자동 droppable 등록을 우회
- 장점: 변경 최소. focus-panel:root만 매칭됨.
- 단점: `disabled: true`는 sortable 자체를 비활성화 → reorder 안 됨. 다른 우회 방법 모호.

### Issue 3 — 팀 할일 빈 cell drop

**Option 3A** (권장): PivotTaskCell에 useDroppable 추가 + 새 type 등록
- 각 PivotTaskCell이 `useDroppable({ id: 'team-matrix-cell:{pid}:{msId}:{memberId}', data: { type: 'team-matrix-cell', cellKey } })` 등록
- 새 handler `handleTeamMatrixCellDrop` (cellKey 직접 추출, resolveMemberFromX 불필요)
- registerHandler 등록
- 장점: spec §12.6 cell key 추상 일관. 단순. 빈 cell drop 정확.
- 단점: droppable 등록 수 증가 (프로젝트 N × MS M+1 × 멤버 6+1 = 50×7 = 350개). 성능 우려는 dnd-kit이 통상 처리 가능하나 pointerWithin이 모든 droppable을 매 frame 검사 → 큰 매트릭스에서 성능 저하 가능.

**Option 3B**: MS 밴드 droppable 영역을 task row까지 확장
- 이전 보고에서 분석한 `<tbody>` 변환 또는 div+grid 교체
- 장점: droppable 등록 수 적음. 한 grouping 단위에 한 droppable.
- 단점: HTML table 구조 변경 큼 (`<tbody>` 단위 droppable은 검증 필요). 또는 div+grid 교체는 PivotMatrixTable 전면 재작성.

**Option 3C**: pointerWithin → rectIntersection 변경 + 카드 SortableContext만으로 빈 cell 인식
- rectIntersection은 dragging item rect 기반 → 빈 cell 위에 dragging item 있으면 가까운 SortableContext 또는 band가 매칭
- 장점: droppable 추가 없이 영역 확장
- 단점: rectIntersection의 collision 우선순위 문제 (Issue 1과 같은 메커니즘) 발생 가능. team matrix에서도 카드 위 drop이 정확하지 않을 수 있음.

---

## 4. 재사용 가능한 함수/패턴

| 항목 | 위치 | 본 phase 사용 |
|---|---|---|
| `canMoveTaskToProject` | [src/utils/dnd/guards.js](../../src/utils/dnd/guards.js) | Issue 1 cross-project guard |
| `dispatch` / `registerHandler` | [src/utils/dnd/dispatcher.js](../../src/utils/dnd/dispatcher.js) | Issue 3 새 handler 등록 |
| `getCellTasks` / `matchesCellKey` | [src/utils/dnd/cellKeys/teamMatrix.js](../../src/utils/dnd/cellKeys/teamMatrix.js) | Issue 3 cellKey 비교 |
| `applyCrossCell` 패턴 | [teamMatrixHandlers.js](../../src/components/views/grid/dnd/teamMatrixHandlers.js) | Issue 3 새 handler가 동일 패턴 적용 |
| Loop-49 useDraggable 패턴 | PersonalTodoTaskRow (P0-2 적용) | Issue 2 FocusCard 마이그레이션 시 동일 패턴 |
| 분기 1.5 cross-project move | [PersonalTodoShell.jsx:147-161](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L147-L161) | Issue 1 정상 작동 시 도달 분기 |

---

## 5. 위험 요소 / 사전 확인 필요

| # | 항목 | 영향 |
|---|---|---|
| 1 | **사용자 환경에 P0-2(`8314c42`) 반영됐는지** | Issue 1이 P0-2 미반영으로 보일 가능성. 사용자가 git pull / 브라우저 캐시 / sw.js precache 갱신했는지 확인 필요 |
| 2 | rectIntersection의 정확한 collision 우선순위 동작 | 가설 검증 필요. dnd-kit 소스 또는 console.log로 e.collisions 배열 출력해서 source group이 정말 우선 매칭되는지 확인 |
| 3 | sticky element + dnd-kit droppable rect 호환성 | FocusPanel sticky가 Issue 2에 영향. 명확한 메커니즘 검증 필요 |
| 4 | collision detection 변경의 cross-issue 영향 | Issue 1 해결을 위해 collision detection 변경 시 Issue 2도 같이 영향. 두 이슈를 같은 변경으로 해결 vs 분리 |
| 5 | Issue 3 Option 3A의 성능 | 350개 droppable 등록이 pointerWithin에서 frame당 검사. 매트릭스 크기 클수록 영향. 실측 필요 |
| 6 | Loop-50 auto-displacement 손실 (Issue 2 Option 2A) | FocusCard reorder의 시각 효과 손실 수용 가능한지 |
| 7 | Issue 3 droppable 추가 후 같은 cell drop 시 cellKey 비교 일치 | matchesCellKey 동작 검증. 자체-cell drop 시 E-13 가드 |
| 8 | dnd-kit `e.collisions` 활용 (Option 1C) | dnd-kit API에서 onDragEnd event에 `collisions` 배열이 제공되는지 확인 |

---

## 6. 권장 진행 순서 / 옵션 조합

이슈 3개의 독립성 vs 결합성 분석:

- **Issue 3 (팀 할일)** — 단독 해결 가능. Personal Todo 변경 무관. **Option 3A** 권장 (단순, 정확, 성능 우려 미발현 시).
- **Issue 1 (cross-project)** — 사용자 환경 확인 + 메커니즘 가설 검증이 우선. **사전 확인 5번 #1, #2 필수**.
- **Issue 2 (focus drop zone)** — Issue 1과 collision detection 차원에서 결합. 같이 해결하는 게 일관성 측면 유리.

권장 conditional 시퀀스:

| 순서 | 작업 | 조건 |
|---|---|---|
| 1 | 사용자 환경 확인 | P0-2 미반영이면 Issue 1 자동 해결. 단순 git pull / 브라우저 hard reload |
| 2 | Issue 1 메커니즘 검증 (콘솔 로그) | rectIntersection의 over 매칭 결과 직접 관찰 |
| 3 | Issue 3 — Option 3A 진행 | Issue 1, 2와 독립. 즉시 적용 가능 |
| 4 | Issue 1 + 2 — Option 1A + 2A 또는 1B + 2B 조합 | 메커니즘 검증 결과 따라 결정 |

---

## 7. 다음 단계

```
/spec dnd-drop-fixes
```

`/spec` 단계에서 결정해야 할 항목:
- §3 옵션 선택 (이슈별)
- §5 사전 확인 결과 반영
- 본 phase 범위 — 3개 이슈 모두 vs 일부 (예: Issue 3만 먼저)
- Loop-50 auto-displacement 손실 수용 여부

⚠️ §5 사전 확인 #1 (P0-2 사용자 환경 반영)을 먼저 검증한 뒤 spec 진행 권장. 사용자가 캐시된 옛 버전을 보고 있으면 Issue 1은 자동 해결될 수 있음.

---

## Appendix: 현재 코드 상태 요약

### Personal Todo (P0-2 8314c42 적용 후)
- PersonalTodoTaskRow: useDraggable, data: { task }
- PersonalTodoProjectGroup: useDroppable `bl-project:`, setDropRef는 grid wrapper (col 1+2+3 모두 커버)
- PersonalTodoShell: collisionDetection=rectIntersection, branch 1.3+1.5 모두 작동
- FocusColumn: useDroppable `focus-panel:root`, minHeight 400
- FocusPanel: sticky, SortableContext (focus-card)
- FocusCard: useSortable (자동 droppable)

### Team Matrix (commit 11 39e40f8 적용 후)
- PivotTaskCell: SortableContext만, useDroppable 미등록
- PivotMilestoneBand: useDroppable `team-matrix-band:`, td colSpan
- PivotProjectHeaderRow: useDroppable `team-matrix-project-header:`, tr 전체
- UnifiedGridView: collisionDetection=pointerWithin, dispatcher + 3 handlers
