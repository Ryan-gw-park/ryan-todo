# RECON: Team Tasks View — Band Layout & Drag-and-Drop

**Phase**: `team-tasks-band-dnd`
**Type**: Layout overhaul + DnD feature
**Status**: Recon (pre-spec)
**작성일**: 2026-04-27
**선행 문서**: [docs/plans/recon-team-tasks-band-dnd.md](recon-team-tasks-band-dnd.md) (초안 — 본 문서가 코드베이스 검증 후 갱신본)

---

## 0. 본 문서의 위치

선행 초안(`recon-team-tasks-band-dnd.md`)은 사용자 + 모델 협업으로 작성된 **설계 의도** 문서이다. 그 문서의 컴포넌트 이름·DB 가정·DELETE 대상이 실제 코드베이스와 일치하는지 검증한 결과를 본 문서에 정리한다. 사용자 요청 흐름은 다음과 같다:

```
recon-team-tasks-band-dnd.md   ← 설계 의도 (이전 단계)
team-tasks-band-dnd-recon.md   ← 코드 검증 후 영향 범위 + 옵션 비교 (본 문서)
team-tasks-band-dnd-spec.md    ← 다음 단계 (/spec)
team-tasks-band-dnd-diff-plan.md
```

---

## 1. 검증된 코드베이스 현황

### 1.1 실제 컴포넌트 트리 (선행 초안의 가정과 차이)

선행 초안은 `TeamTasksView.jsx` / `TotalsColumn` / `MsRowLabel` / `AddMilestoneRow` 같은 이름을 가정했지만, 실제는 **`Pivot*` 계열**로 구성되어 있다.

| 선행 초안 가정 | 실제 코드 | 비고 |
|---|---|---|
| `TeamTasksView.jsx` | [src/components/views/UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx) | 팀/개인 매트릭스 + 주간 플래너 4모드 통합 오케스트레이터 |
| (별도 wrapper) | [src/components/views/grid/grids/TeamMatrixGrid.jsx](../../src/components/views/grid/grids/TeamMatrixGrid.jsx) | 26줄, `PivotMatrixTable`을 호출 |
| (테이블 레이아웃) | [src/components/views/grid/PivotMatrixTable.jsx](../../src/components/views/grid/PivotMatrixTable.jsx) | 182줄, colgroup 정의 + 행 조립 |
| `TotalsColumn` | `PivotProjectRow` Line 64-75, `PivotMsSubRow` Line 45-54 | 별도 컴포넌트 아님 — **인라인** 셀 |
| `MsRowLabel` | [src/components/views/grid/cells/PivotMsSubRow.jsx](../../src/components/views/grid/cells/PivotMsSubRow.jsx) | 좌측-라벨 행 구조 (밴드 아님) |
| `AddMilestoneRow` | [src/components/views/grid/cells/PivotAddMsRow.jsx](../../src/components/views/grid/cells/PivotAddMsRow.jsx) | 별도 행으로 렌더링 중 |
| (미분류 처리) | [src/components/views/grid/cells/PivotUngroupedSubRow.jsx](../../src/components/views/grid/cells/PivotUngroupedSubRow.jsx) | `keyMilestoneId == null` 전용 행 — **이미 존재** |
| (Task 카드) | [src/components/views/grid/cells/PivotTaskCell.jsx](../../src/components/views/grid/cells/PivotTaskCell.jsx) | (MS × Member) 셀 단위. 카드 자체는 더 안쪽 |

**시사점**: 선행 초안의 §6 파일 목록은 **신규 디렉토리 `src/components/team-tasks/`** 를 가정했으나, 실제 컨벤션은 **`src/components/views/grid/cells/`** 다. 본 recon은 후자를 따른다.

### 1.2 Store 검증

[src/hooks/useStore.js](../../src/hooks/useStore.js)에서 다음을 확인:

- **`updateTask(id, patch)`**: Line 614. 시그니처 = `async (id, patch)`. 내부에서 `applyTransitionRules(currentTask, patch)` 적용. CLAUDE.md §3-3과 일치.
- **`applyTransitionRules`**: Line 30-82. 7개 규칙 자동 적용:
  - **R1**: `assigneeId` 설정 → `scope='assigned'` 자동
  - **R5**: `projectId` 변경 → `keyMilestoneId=null` 자동 (단, patch에 명시되지 않은 경우만)
  - **R7**: `scope='team'` → `assigneeId=null` 자동
  - 시사점: cross-project drop 시 patch에 `keyMilestoneId`만 잘 명시하면 R5가 덮어쓰지 않음
- **`reorderTasks(reorderedTasks)`**: Line 743-749. **이미 존재**. 인자 형태 = `Task[]`, 배치 `sortOrder = i` 부여 후 store + DB 업데이트.
- **`sort_order` 컬럼**: 이미 존재 (Line 7, 120, 184, 401). `tasks.sort_order INTEGER`.
  - **시사점**: 선행 초안의 §5/§11 #1에서 가정한 `sort_index` 마이그레이션은 **불필요**. `sortOrder` (camelCase) / `sort_order` (DB) 페어를 그대로 재사용한다.
- **`addTask(task)`**: Line 1173-1241. 신규 task 생성용. 본 작업과 직접 관계 없음.

### 1.3 dnd-kit 도입 현황

[package.json](../../package.json) Line 13-15:

```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

`@dnd-kit/modifiers`는 **미설치**. 필요 시 추가하거나, `restrictToVerticalAxis` 등 modifier 없이 collision detection만으로 처리.

**기존 dnd-kit 사용 사례** (재사용 가능한 패턴):
- [src/components/Sidebar.jsx](../../src/components/Sidebar.jsx) — 프로젝트 재정렬. `DndContext` + `SortableContext` + `arrayMove` 패턴.
- [src/components/CompactMilestoneTab.jsx](../../src/components/CompactMilestoneTab.jsx) — `DragOverlay`, `useDroppable`, `PointerSensor`, `TouchSensor` 활용.
- [src/components/HierarchicalTree.jsx](../../src/components/HierarchicalTree.jsx) — 트리형 DnD 패턴.
- 표준 sensor 설정: `useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3-5 } }))`.

**시사점**: dnd-kit 도입 비용 0. 기존 패턴 모방으로 일관성 확보.

### 1.4 Personal Todo 영역의 cross-project DnD

memory에 기록된 Loop-49 cross-project DnD가 다음 위치에 구현되어 있음:
- [src/personal-todo/PersonalTodoShell.jsx](../../src/personal-todo/PersonalTodoShell.jsx) — cross-project drop 분기
- [src/personal-todo/PersonalTodoProjectGroup.jsx](../../src/personal-todo/PersonalTodoProjectGroup.jsx) — droppable + V5 가드
- [src/personal-todo/PersonalTodoTaskRow.jsx](../../src/personal-todo/PersonalTodoTaskRow.jsx) — `useDraggable` data에 task 첨부

**시사점**: 본 작업은 personal-todo의 패턴을 **거의 그대로 복제** 가능. V5 same-type 가드 패턴까지 포함해 재사용 검토 필요. 단 personal-todo는 그룹화 차원이 1개(project)인 반면 team-tasks는 2개(project × milestone) × 멤버 컬럼 → 드롭 타겟 종류가 더 많음.

### 1.5 Design Tokens

[src/styles/designTokens.js](../../src/styles/designTokens.js) (137줄):
- `COLOR.accent = #2383e2` — Line 18. **존재**. 선행 초안 D-10의 accent 토큰은 그대로 사용 가능.
- `PIVOT.colWidthProject = 170`, `colWidthMember = 115`, `colWidthTotal = 55`, `msSubRowBg = #FAFAF7`. 본 작업으로 `colWidthTotal`은 **삭제 후보**, `colWidthProject` → 130 변경, 또는 **신규 그리드 시스템 도입**.
- **drop-indicator 토큰 미존재** — 신규 추가 필요 (예: `COLOR.dropIndicator`, `COLOR.dropTargetTint`).

### 1.6 RLS

[supabase/migrations/20260314300000_team_member_assign_policy.sql](../../supabase/migrations/20260314300000_team_member_assign_policy.sql):
- `team_tasks_member_assign` 정책: `scope IN ('team','assigned')` AND `team_id IN (auth.uid 소속 팀)` → 같은 팀 멤버는 서로의 task `assignee_id` 변경 가능.
- `key_milestone_id`, `project_id` 변경에 대한 별도 정책 없음 → 기본 UPDATE 정책에 의존. **확인 필요**: 같은 팀 내 다른 사용자의 task `project_id`도 자유롭게 바꿀 수 있는가? 그렇지 않다면 cross-project drop이 RLS에서 막힐 수 있음.

### 1.7 카운트 계산 위치

- 프로젝트 카운트: `PivotProjectRow` Line 17-24 — inline 계산 (`tasks.filter(...)`)
- MS 카운트: `PivotMsSubRow` Line 53 — inline
- **useMemo 없음** — 매 렌더 재계산. 본 작업으로 카운트 표시 위치만 옮기면 되므로 성능에 영향 없음.

---

## 2. 영향 받는 파일 / 모듈

### 2.1 변경되는 파일

| 파일 | 변경 종류 | 사유 |
|---|---|---|
| [src/components/views/UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx) | 변경 | DndContext 래핑 위치 결정 (옵션 §3 참고) |
| [src/components/views/grid/grids/TeamMatrixGrid.jsx](../../src/components/views/grid/grids/TeamMatrixGrid.jsx) | 변경 | DndContext provider 삽입 + 신규 props |
| [src/components/views/grid/PivotMatrixTable.jsx](../../src/components/views/grid/PivotMatrixTable.jsx) | 변경 | colgroup 재정의, 합계 컬럼 제거, 행 조립 순서 재구성 |
| [src/components/views/grid/cells/PivotProjectRow.jsx](../../src/components/views/grid/cells/PivotProjectRow.jsx) | 변경 | 카운트 통합, hover 어포던스(`+ MS`) 추가, droppable 등록 |
| [src/components/views/grid/cells/PivotMsSubRow.jsx](../../src/components/views/grid/cells/PivotMsSubRow.jsx) | 변경 또는 폐기 | 밴드 + Task 행 분리 구조로 전환 |
| [src/components/views/grid/cells/PivotUngroupedSubRow.jsx](../../src/components/views/grid/cells/PivotUngroupedSubRow.jsx) | 변경 | 밴드 + Task 행 분리, opacity 0.7 |
| [src/components/views/grid/cells/PivotAddMsRow.jsx](../../src/components/views/grid/cells/PivotAddMsRow.jsx) | **삭제** | hover 어포던스로 `PivotProjectRow` 안에 흡수 |
| [src/components/views/grid/cells/PivotTaskCell.jsx](../../src/components/views/grid/cells/PivotTaskCell.jsx) | 변경 | Task 카드를 `useDraggable` 래핑, 셀 자체를 `useDroppable`로 등록 |
| [src/hooks/useStore.js](../../src/hooks/useStore.js) | **선택적 변경** | `reorderTasks`만으로 부족하면 신규 액션(예: `moveTaskToTarget`) 추가. 단순한 cross-cell 이동은 기존 `updateTask` + `reorderTasks` 조합으로 충분할 가능성 높음 |
| [src/styles/designTokens.js](../../src/styles/designTokens.js) | 변경 | `dropIndicator`, `dropTargetTint` 토큰 신규. `PIVOT.colWidthTotal` 삭제 또는 deprecated 표시. `colWidthProject`를 130으로 (또는 신규 토큰 `colGutterLabel = 130`) |

### 2.2 신규 파일

| 경로 | 책임 |
|---|---|
| `src/components/views/grid/cells/PivotMilestoneBand.jsx` | 풀폭 MS 밴드 (라벨 + 카운트 + droppable). 미분류 밴드는 `variant="ungrouped"` prop으로 구분 |
| `src/components/views/grid/cells/PivotTaskRow.jsx` | (MS × 6 Member) 컬럼별 Task 카드 스택 컨테이너. cell 별 `useDroppable` 등록 |
| `src/components/views/grid/dnd/TeamTasksDndContext.jsx` (또는 컨텍스트 컴포넌트) | `DndContext` + sensors + collision detection + `onDragEnd` 핸들러. 드롭 리졸버 로직 집중 위치 |
| `src/components/views/grid/dnd/resolveDrop.js` | 드롭 결과 → `updateTask(id, patch)` 호출 매핑 (순수 함수). 테스트 가능성 확보 목적 |

### 2.3 변경 / 신규 없는 파일 (확인용)

- 마이그레이션: `sort_order`가 이미 존재하므로 **신규 마이그레이션 불필요**.
- RLS: **추가 정책 불필요** 가능성 높음 (§5 위험 #2 확인 필요).

---

## 3. 구현 옵션 (3안 비교)

### Option A: 기존 `Pivot*` 컴포넌트 in-place 수정

`PivotMatrixTable` + `PivotProjectRow` + `PivotMsSubRow`를 직접 수정해 밴드 레이아웃으로 전환. 신규 파일은 `PivotMilestoneBand`, `PivotTaskRow`, DnD context만.

**장점**:
- 변경 최소. 행 조립 흐름이 한 파일에 모여 있어 디버깅 쉬움.
- CLAUDE.md "branch at the top level, once" 패턴과 충돌 없음 — 팀 매트릭스 뷰 한 곳에만 영향.

**단점**:
- `PivotMsSubRow` 자체를 거의 다시 쓰는 셈이라 in-place 수정의 의미가 옅음.
- DnD 로직이 cell 레벨로 침투해 cell 컴포넌트 응집도가 낮아질 수 있음.

**적합도**: ★★★★☆ — 권장.

### Option B: 신규 디렉토리 `src/components/team-tasks/` 도입 + 기존 Pivot 유지 (이중 트랙)

선행 초안이 가정한 디렉토리 구조대로 새로 만들고, `TeamMatrixGrid`에서 신규 컴포넌트로 분기. 기존 `PivotMatrixTable`은 다른 사용처가 있으면 유지.

**장점**:
- 선행 초안 §6과 1:1 매칭. 향후 Personal Tasks View 동일 작업 시 `personal-tasks/` 디렉토리로 평행 구조 유지 가능.
- "Don't Touch, Wrap It" 원칙에 가장 충실.

**단점**:
- `PivotMatrixTable`은 **`TeamMatrixGrid` 외에 다른 사용처가 있는지** 검증 필요. 단일 사용처라면 이중 트랙은 dead code 양산.
- 그리드 컨벤션이 두 갈래로 갈라져 후속 유지보수 부담.

**적합도**: ★★☆☆☆ — `PivotMatrixTable`이 다른 곳에서도 쓰일 때만 권장.

### Option C: DnD 우선, 레이아웃은 후속 단계로 분리

R-ATOMIC 시퀀스를 두 페이즈로 쪼갬: (1) 합계 제거 + 밴드 + 카운트 통합 (Layout Only), (2) DnD (DnD Only). 한 페이즈 내에서 두 변경이 섞이면 회귀 추적이 어렵다는 점을 회피.

**장점**:
- 각 페이즈의 회귀 검증이 명확.
- 사용자가 "MS 밴드 기능만 먼저 출시" 같은 의사결정을 할 수 있음.

**단점**:
- 사용자 요청은 한 phase로 묶여 있음 (`team-tasks-band-dnd`). 강제로 쪼개면 메타 의사결정 필요.
- DnD 단계에서 결국 §11 commit 7-10을 또 만들게 되어 commit 수는 줄지 않음.

**적합도**: ★★★☆☆ — 사용자가 "시간 더 길게 풀어도 좋다"고 동의하는 경우에 한해 권장.

### 권장: **Option A**

이유: (1) `PivotMatrixTable`이 `TeamMatrixGrid` 외 사용처가 없는 것으로 보이고 (확인 필요), (2) 작업 범위가 한 뷰에 국한되며, (3) 기존 `Pivot*` 명명 컨벤션을 유지하는 것이 코드베이스 일관성 측면에서 유리하다.

---

## 4. 재사용 가능한 함수 / 패턴

| 항목 | 위치 | 재사용 방식 |
|---|---|---|
| `updateTask(id, patch)` | [useStore.js:614](../../src/hooks/useStore.js#L614) | 모든 task 필드 변경의 단일 진입점. cross-cell drop 시 호출 |
| `applyTransitionRules` | [useStore.js:30-82](../../src/hooks/useStore.js#L30-L82) | patch 자동 보정 — D-08 조건 자동 충족. 단 `category='today'` 강제 리셋은 patch에 명시해야 함 (자동 안 됨) |
| `reorderTasks(reorderedTasks)` | [useStore.js:743-749](../../src/hooks/useStore.js#L743-L749) | 동일 cell 내 reorder 시 그대로 호출. 호출자는 새 순서의 `Task[]`만 만들면 됨 |
| dnd-kit DndContext 패턴 | [Sidebar.jsx](../../src/components/Sidebar.jsx) | sensors + `onDragStart`/`onDragEnd` + `DragOverlay` 보일러플레이트 그대로 차용 |
| Cross-project DnD 분기 | [PersonalTodoShell.jsx](../../src/personal-todo/PersonalTodoShell.jsx) | drop 결과로 다른 그룹에 떨어졌는지 판정하는 로직 — 멤버 컬럼·MS·프로젝트 3차원으로 일반화하면 적용 가능 |
| V5 same-type 가드 | [PersonalTodoProjectGroup.jsx](../../src/personal-todo/PersonalTodoProjectGroup.jsx) | drop 시 source/target 타입이 호환되지 않으면 거부하는 패턴 — task vs MS-band vs project-header 사이 타입 호환 체크에 적용 |
| `keyMilestoneId == null` 그룹 처리 | [PivotUngroupedSubRow.jsx](../../src/components/views/grid/cells/PivotUngroupedSubRow.jsx) | 미분류 밴드 (L-04) 구현 시 기존 그룹화 로직 그대로 사용 |
| 카운트 inline 계산 | [PivotProjectRow.jsx:17-24](../../src/components/views/grid/cells/PivotProjectRow.jsx#L17-L24) | 위치만 행 내부 셀로 옮기고 계산식은 그대로 |
| `COLOR.accent` 토큰 | [designTokens.js:18](../../src/styles/designTokens.js#L18) | drop indicator 색상 (`#2383e2`)으로 그대로 사용 |
| DELETE-5 절차 | (CLAUDE.md / 메모) | `합계` 컬럼·`PivotAddMsRow`·`PivotMsSubRow` 폐기 시 import/caller/props/deps/types 전부 추적 |

---

## 5. 위험 요소 및 사전 확인 사항

| # | 항목 | 영향도 | 어떻게 확인 |
|---|---|---|---|
| 1 | `PivotMatrixTable`이 `TeamMatrixGrid` 외에 사용되는가? | 🔴 High — Option A vs B 결정 좌우 | `grep "PivotMatrixTable" src/`로 import 위치 전수 조사 |
| 2 | RLS가 같은 팀 내 다른 사용자의 task `project_id` 변경을 허용하는가? | 🔴 High — D-05 cross-project drop 가능 여부 | `supabase/migrations/`에서 `tasks` UPDATE 정책 확인. 막힌다면 D-05는 본인 task로 축소 |
| 3 | `reorderTasks`가 cross-cell 이동 후 sortOrder 재계산을 함께 처리할 수 있는가, 아니면 별도 단계로 분리해야 하는가? | 🟡 Medium — 액션 추가 여부 결정 | `reorderTasks` 사용처에서 동일 그룹 내 가정인지 확인. 다른 그룹 mix 호출이 안전한지 코드 리딩 |
| 4 | `category='today'` 강제 리셋이 정말 필요한 의도인가? | 🟡 Medium — 사용자 의도 확인 | spec 단계에서 사용자에게 확인. cross-member/cross-MS drop 후 카드를 항상 today로 보내는 게 맞는지 |
| 5 | 미분류(`keyMilestoneId=null`) 밴드를 클릭/호버해서 MS를 신규 생성하는 인터랙션이 필요한가? | 🟢 Low | 선행 초안 L-05는 프로젝트 헤더 hover만 명시. 미분류 밴드는 명시 없음 → spec에서 결정 |
| 6 | 자동 스크롤 임계점·속도 (D-10)는 무엇인가? | 🟢 Low | dnd-kit 기본값 사용 또는 spec에서 결정 |
| 7 | 6 멤버 미만 / 6 멤버 초과 팀의 그리드 폭 처리 | 🟡 Medium | 현재 `members.length`로 동적 — 그대로 유지 가능. 단 1fr × N 변경 시 단일 멤버 팀에서 카드 폭이 과도해질 수 있음 → spec에서 max-width 결정 |
| 8 | DnD 모바일/태블릿 지원 (touch sensor) | 🟢 Low | `CompactMilestoneTab.jsx`가 `TouchSensor`까지 등록 — 동일 패턴 차용. 단 현재 팀 매트릭스가 모바일에서 사용 가능한지 별도 확인 |
| 9 | `DragOverlay` 안에서 카드를 렌더할 때 store 접근 방식 (CLAUDE.md §6 #7: render 중 `getState()` 금지) | 🟢 Low | overlay는 별도 컴포넌트로 분리하고 `useStore` selector로 task 조회 |
| 10 | optimistic update 시 다른 셀로 이동한 카드가 잠깐 두 군데 모두 보이거나 사라지는 깜빡임 | 🟡 Medium | `updateTask`가 store를 동기 갱신하므로 polling 의존성 없음. 다만 sortOrder 충돌 시 정렬 흔들림 가능 — spec에서 처리 정책 결정 |
| 11 | 검색/필터가 적용된 상태에서 DnD 동작 | 🟡 Medium | 현재 팀 매트릭스에 검색 필터가 있는지 확인 필요 — 있다면 필터 통과한 카드만 보이는데 그 사이에 drop했을 때 sortOrder 빈틈 처리 |

---

## 6. 본 recon이 선행 초안과 다른 점 (요약)

| 항목 | 선행 초안 | 본 recon |
|---|---|---|
| 컴포넌트 명명 | `TeamTasksView` / `TeamTaskCard` / `TeamMilestoneBand` 등 `Team*` 계열 | 기존 `Pivot*` 컨벤션 유지 (`PivotMilestoneBand` 등) |
| 디렉토리 | `src/components/team-tasks/` | `src/components/views/grid/cells/` 및 `dnd/` |
| sort 컬럼 마이그레이션 | 조건부 (sort_index 추가) | **불필요** (`sort_order` 이미 존재) |
| Store 신규 액션 | `reorderTasks(groupKey, fromIdx, toIdx)` 신규 가정 | `reorderTasks(reorderedTasks)` **이미 존재** — 그대로 사용 |
| R-ATOMIC commit 1 (sort_index 추가) | 포함 | **삭제** — 마이그레이션 불필요 |
| RLS | "확인 중" | `team_tasks_member_assign` 정책으로 같은 팀 멤버 간 assignee 변경 허용 확인. project_id 변경 정책은 추가 확인 필요 (위험 #2) |

---

## 7. 다음 단계

본 recon은 **분석만** 수행했다. 다음 단계로 사용자가 직접 **요구사항 확정**을 진행해야 한다:

```
/spec team-tasks-band-dnd
```

`/spec` 단계에서 결정해야 할 항목:
- §3 Option A/B/C 중 채택안
- §5 위험 #1, #2 확인 결과
- §5 위험 #4: cross-cell drop 시 `category='today'` 강제 리셋 여부
- §5 위험 #7: 멤버 수 변동 시 그리드 폭 처리 정책
- §5 위험 #11: 필터 적용 상태에서 DnD 정책

---

## 8. 참고

- 선행 초안: [docs/plans/recon-team-tasks-band-dnd.md](recon-team-tasks-band-dnd.md)
- 프로젝트 규칙: [ryan-todo/CLAUDE.md](../../CLAUDE.md), [Ryans-Todo/CLAUDE.md](../../../CLAUDE.md)
- Loop-49 cross-project DnD 패턴 참고 자료: [docs/plans/loop-49-note-font-and-cross-project-dnd-recon.md](loop-49-note-font-and-cross-project-dnd-recon.md)
