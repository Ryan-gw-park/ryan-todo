# Spec Validation — 개인 할일 매트릭스 뷰

> 입력 Spec: [`spec-personal-agenda-matrix.md`](./spec-personal-agenda-matrix.md)
> 검증 기준: 코드베이스 실제 상태 + [`recon-report-personal-agenda-matrix.md`](./recon-report-personal-agenda-matrix.md) + [`CLAUDE.md`](../../CLAUDE.md)
> 검증일: 2026-05-18

---

## 0. 결과 요약

| 심각도 | 건수 | 카테고리 |
|---|---|---|
| 🔴 BLOCK | 3 | 잘못된 파일 경로, DndContext 중첩 미반영, 매트릭스 행 의미 모호 |
| 🟠 HIGH | 3 | gridTemplateColumns 표기 오류, mapTask 의사코드 정확화, 의존성 그래프 누락 |
| 🟡 MEDIUM | 5 | R-CONST 해석 모호, C7 wrapper 문구, C8 R5 우회 조건, 함수명 의사코드, 매핑 부정확 |
| 🟢 LOW | 3 | 문서 정합성, 명명, 검증 기준 명세 부족 |

**판정**: Spec은 **요구사항 측면(R-DATA/STORE/TOKEN/UX/CONST)에서 대부분 정확**하나, **3개 BLOCK 항목 (특히 #1 경로, #2 DndContext 중첩)을 수정 전에는 diff 단계로 진행 불가**. #3 (행 의미 모호)는 사용자 결정 필요.

---

## 1. 🔴 BLOCK 항목

### B1. C10의 PersonalTodoShell 경로 오류

**Spec C10 (line 535)**:
> `src/components/views/grid/grids/PersonalTodoShell.jsx`

**실제 경로** (`Glob` 검증):
> `src/components/views/personal-todo/PersonalTodoShell.jsx`

**영향**: C10 diff 적용 시 파일 부재 에러. R-VIEW-3 미충족.

**수정 권고**: Spec §C10 변경 파일 경로를 `src/components/views/personal-todo/PersonalTodoShell.jsx`로 정정.

추가로 §5 REQ-LOCK 검증 매핑 표의 R-VIEW-6 검증 기준도 동일 경로 사용 (현재 별도 명시 없음).

---

### B2. DndContext 중첩 — 매트릭스 핸들러 등록 위치 오류

**Spec R-DND-1 (line 103)**:
> dispatcher에 핸들러 2개 등록:
> - `'agenda-matrix-task'` → `handleAgendaMatrixTaskDrop`
> - `'agenda-matrix-row'` → `handleAgendaMatrixRowDrop`

**Spec C8 변경 파일 (line 426)**:
> `src/components/views/UnifiedGridView.jsx` — `registerHandler('agenda-matrix-task', handler)` 등록

**실제 아키텍처** (코드 검증):

```
UnifiedGridView.jsx:452 — 외부 DndContext (dispatcher 사용, registerHandler)
└─ PersonalMatrixGrid
    └─ PersonalTodoShell.jsx:194 — 내부 DndContext (자체 handleDragEnd, dispatcher 미사용)
        └─ <PersonalTodoListTable />  ← swap 대상
```

**문제**: `PersonalTodoShell.jsx:18-23` 주석이 정확히 이 문제를 설명한다:
> `useDroppable/useSortable`은 호출 시점의 nearest React Context로 등록됨.
> Shell 함수 본체에서 직접 `useDroppable`을 부르면 OUTER(UnifiedGridView)에 등록되어
> inner(Shell) DndContext의 드래그에 보이지 않음.

→ `PersonalAgendaMatrixTable`이 PersonalTodoShell *내부*에 swap되면, 매트릭스 셀의 `useDroppable/useSortable`은 **inner DndContext**에 등록된다.
→ **UnifiedGridView에 등록한 dispatcher 핸들러는 호출되지 않는다.** PersonalTodoShell의 `handleDragEnd`만 호출된다.

**영향**: C8/C9 핸들러가 **무동작**. 모든 매트릭스 드래그가 fall-through.

**수정 권고** (3가지 옵션):

| 옵션 | 변경 | 트레이드오프 |
|---|---|---|
| A | `PersonalTodoShell.jsx`의 `handleDragEnd`에 매트릭스 분기 inline 추가 (`'cell-task:'` prefix 또는 별도 `'agenda-cell-task:'` prefix) | Shell 비대화. 가장 단순 |
| B | PersonalTodoShell의 `handleDragEnd` 시작부에 `dispatchDrop(e, ctx)` 호출 추가 (외부 패턴 복사). 매트릭스 핸들러는 PersonalTodoShell 모듈에서 `registerHandler` | dispatcher 패턴 재사용. inner ctx 빌드 필요 |
| C | `PersonalAgendaMatrixTable`이 자체 DndContext 마운트 (third level) | 격리도 좋음. 하지만 inner 안의 inner는 PersonalTodoShell의 백로그/포커스 드래그와 충돌 가능. **비권장** |

**권장**: **옵션 B** — dispatcher 패턴 일관성 + Shell 복잡도 최소. PersonalTodoShell의 import에 `import { dispatch as dispatchDrop, registerHandler } from '../../../utils/dnd/dispatcher'` 추가. C8/C9 등록 위치를 `PersonalTodoShell.jsx` 또는 `PersonalAgendaMatrixTable.jsx` 모듈 최상단으로 이동.

**Spec 수정 사항**:
- R-DND-1 본문: "dispatcher에 핸들러 2개 등록 (단, inner DndContext를 위한 등록 시점/위치는 PersonalTodoShell 또는 PersonalAgendaMatrixTable 모듈 최상단)"
- C8 변경 파일 목록에 `PersonalTodoShell.jsx` 또는 `PersonalAgendaMatrixTable.jsx` 추가, `UnifiedGridView.jsx` 제거
- §4 의존성 그래프에 "C8 → C10 (Shell에 dispatchDrop 추가)" 의존 명시

---

### B3. 매트릭스 "행"의 의미 모호 — 키 마일스톤 vs 상위 프로젝트

**Spec C4a (line 279)**:
> 프로젝트 목록: `useStore(s => s.projects)` 사용 (백로그 ≠ null만 표시)

**Spec C5 (line 342)**:
> 카운트: 미분류 task 수 (`keyMilestoneId === null && !done && !deletedAt`)

**Spec C8 (line 451)**:
> 다른 프로젝트 행이면 keyMilestoneId 변경 + R5 우회

**실제 데이터 모델** (recon §2.2):
- `tasks.project_id` (text) → 상위 프로젝트 ID
- `tasks.key_milestone_id` (uuid) → 키 마일스톤 ID (별도 컬럼)
- `useStore.projects` = 상위 프로젝트 (text id)
- `useStore.milestones` = 키 마일스톤 (uuid)

**문제**: Spec이 **상위 프로젝트와 키 마일스톤을 혼용**.
- Recon §1.1의 "행: 프로젝트(키 마일스톤) 목록"이 모호한 표현이었고, spec이 이를 그대로 가져옴
- C4a는 `useStore.projects` (상위 프로젝트) 사용 → 행 = 상위 프로젝트
- C5는 `keyMilestoneId === null` → 행 = 키 마일스톤
- 두 해석이 모순

**영향**:
- 만약 **행 = 상위 프로젝트** (C4a 해석):
  - inbox = `projectId === null` (현재 코드에 그런 task가 존재하지 않음 — 모든 task가 어떤 프로젝트에 속함, 즉시 등록 기본 프로젝트 포함)
  - C8 cross-row drag = `projectId` 변경 → R5 발동 → keyMilestoneId 자동 nullify → R5 우회 필요
- 만약 **행 = 키 마일스톤** (C5/C8 해석):
  - inbox = `keyMilestoneId === null` ✓
  - C8 cross-row drag = `keyMilestoneId`만 변경 (projectId는 그대로) → R5 발동 안 함 → R5 우회 불필요
  - C4a에서 useStore.projects 대신 `useStore.milestones`를 사용해야 함

**수정 권고**: 사용자 결정 필요. 일관성 있게 한 모델로 통일. 권장은 **행 = 키 마일스톤** (recon §1.1 원문 + C5/C8 다수파). 이 경우:
- C4a 수정: `useStore(s => s.milestones)` 사용 (단, 매트릭스 행에 보여줄 milestone 필터 룰 명시 — 모든 milestone? 진행중?)
- C8 수정: `patch.keyMilestoneId = dstCellKey.msId`만, projectId 변경 불필요, R5 우회 불필요
- AgendaRowHeader 라벨 = milestone.title (또는 milestone 소속 project + milestone)

대안 (행 = 상위 프로젝트):
- 키 마일스톤 정보는 detail panel에서만 (D5 결정과 정합)
- inbox 정의를 `keyMilestoneId IS NULL`이 아니라 새 기준으로 (예: 즉시 프로젝트의 task)
- 단 이 경우 "신규 할일 inbox row" 개념이 약해짐

---

## 2. 🟠 HIGH 항목

### H1. C10의 gridTemplateColumns 변경 표기 오류

**Spec C10 (line 549-551)**:
```diff
- gridTemplateColumns: '1.5fr 1fr'
+ gridTemplateColumns: '2fr 1fr'
```

**실제 값** (`PersonalTodoShell.jsx:201`):
```js
gridTemplateColumns: 'minmax(420px, 1.5fr) minmax(280px, 1fr)'
```

**문제**: Spec의 변경 전 문자열이 실제와 다름 → str_replace 적용 시 fail. minmax wrapper 의미도 무시됨.

**수정 권고**:
```diff
- gridTemplateColumns: 'minmax(420px, 1.5fr) minmax(280px, 1fr)'
+ gridTemplateColumns: 'minmax(420px, 2fr) minmax(280px, 1fr)'
```

또는 D4 결정의 의도가 minmax 제거라면 명시. 매트릭스가 가로 스크롤일 경우 minmax 유지가 안전.

---

### H2. C3b mapTask 패치 명세 부정확

**Spec R-STORE-2 (line 49)**:
> `mapTask`에 `agendas` 필드 인식 추가 (`row.agendas ?? []`)

**실제 mapTask** (`useStore.js:185-209`):
```js
function mapTask(r) {
  return {
    id: r.id, text: r.text, projectId: r.project_id, category: r.category || 'backlog',
    done: r.done || false,
    // ...
    isFocus: r.is_focus === true,
    focusSortOrder: r.focus_sort_order ?? 0,
  }
}
```

기존 패턴: `r.field_name || default_value` (boolean은 `=== true`, number는 `?? 0`).

**문제**: `??`와 `||`가 빈 배열에서 의미가 다름 — `[] || []` → `[]` (`[]`는 truthy), `[] ?? []` → `[]` (둘 다 정상이지만, `r.agendas`가 `null/undefined`일 때만 fallback 필요). 

**수정 권고**: 일관성을 위해 다음 중 하나:
```js
agendas: r.agendas || [],   // null/undefined/falsy → 빈 배열 (기존 패턴 일치)
// 또는
agendas: r.agendas ?? [],   // null/undefined만 → 빈 배열 (Spec 표현)
```

DB가 `NOT NULL DEFAULT '{}'`이므로 `[]` 외에 falsy가 올 일 없음 → 어느 쪽이든 동작. 기존 패턴 일치를 위해 `|| []` 권장.

추가로 `taskToRow` 함수도 patch 필요 (`useStore.js:122` 부근):
```js
function taskToRow(t) {
  const row = {
    // ...
    agendas: t.agendas || [],  // 신규
  }
  // ...
}
```

Spec R-STORE-3 (`addTask`도 `agendas` 처리)는 taskToRow 패치를 의미하는 것으로 보임. 하지만 명시되지 않음. **C3b 본문에 `taskToRow` 수정 명시 필요**.

---

### H3. 의존성 그래프 누락

**Spec §4 의존성 그래프 (line 593-612)**:
```
C1 (DB) ─► C3b (mapTask)
C2 (tokens) ──► C4a (skeleton) ──► C4b (cells) ──► C5 (inbox)
```

**누락 사항**:
1. **C3b → C4b**: C4b가 `task.agendas`를 필터에 사용 (`personalAgenda.js`의 `getCellTasks` line 308). C3b 없이 C4b 적용 시 `task.agendas === undefined`로 인한 filter 실패.
2. **C2 → C4b**: C4b가 `is_focus` ⭐ 뱃지에 색상 토큰 사용 (또는 AGENDA chip 색상). C2 의존성 필수.
3. **C3a → C7**: 이미 명시됨 ✓
4. **C8/C9 → C10**: B2 결정에 따라 PersonalTodoShell 수정 필요 시 의존성 추가

**수정 권고**: 의존성 그래프 갱신:
```
C1 ──► C3b ──► C4b ──► C5 ──► C6, C7, C8, C8.5, C9 ──► C10
C2 ──► C4a ──┘                 │
C3a ─────────────────────► C7 ─┘
```

---

## 3. 🟡 MEDIUM 항목

### M1. R-CONST-3 ↔ R-VIEW-3 사이 잠재 충돌

**R-CONST-3 (line 131)**:
> 기존 뷰 컴포넌트(`TodayView`, `MatrixView`, `TimelineView`, `MemoryView`) 내부 수정 0건

**R-VIEW-3 (line 81)**:
> `PersonalTodoShell` 내부에서 `<PersonalTodoListTable />` → `<PersonalAgendaMatrixTable />` swap

**문제**: `PersonalTodoShell`은 R-CONST-3의 4개 명시 목록에 없으므로 룰 위반 아님. 하지만 [CLAUDE.md §3-1](../../CLAUDE.md)의 "Never modify existing components directly — extend them" 원칙과 정신적으로 충돌. Spec이 명시적으로 "외과적 교체"라고 D3에서 정당화하지만, R-CONST-3에 `PersonalTodoShell` 예외를 명시하는 게 명확.

**수정 권고**: R-CONST-3에 다음 추가:
> 단, `PersonalTodoShell`은 D3 (외과적 교체) 결정에 따라 `<PersonalTodoListTable />` ↔ `<PersonalAgendaMatrixTable />` swap 및 `gridTemplateColumns` 비율 변경에 한해 *예외 허용*. 그 외 부분(DndContext, handleDragEnd, FocusColumn, FocusPanel)은 수정 0건.

### M2. C7 SortableTaskCard wrapper 결정 모호

**Spec C7 (line 388-404)**:
> **권장 1**: `SortableTaskCard`가 너무 광범위하게 사용 중이라면 매트릭스 전용 wrapper `AgendaMatrixTaskCard` 신설

문구가 "권장 1"인데 "권장 2"가 없음. 그리고 "광범위하게 사용 중이라면"이라는 조건문이 결정을 코드 적용 시점으로 미룸.

**검증**: `SortableTaskCard.jsx`는 매트릭스 그리드 cell 외 다른 곳에서도 사용되는지?
- 추측: PivotTaskCell, FocusPanel, 백로그 등 다수 사용 가능성
- → wrapper 패턴(`AgendaMatrixTaskCard`) 사용 확정

**수정 권고**: C7 본문을 "wrapper 패턴 확정"으로 단정 표현하고 "권장 1" 표현 제거. R-COMP-8(`SortableTaskCard` 수정 없이 재사용)과 정합.

### M3. C8의 R5 우회 코드가 B3 결정에 종속

B3 결정에 따라 C8의 코드 변경:
- 행 = 키 마일스톤: `patch.projectId` 변경 없음 → R5 우회 *불필요*. Spec C8 line 451-454의 R5 우회 코드 *삭제*.
- 행 = 상위 프로젝트: 현재 spec 코드 그대로 유지.

**수정 권고**: B3 결정 후 C8 의사코드 정정.

### M4. C8/C9 내 `updateSortIndex` / `reorderTasks` 함수명 의사코드 정리

**Spec C8 (line 437)**:
> `if (sameCellKey(srcCellKey, dstCellKey)) { return updateSortIndex(task.id, over) }`

`updateSortIndex`는 의사명. 실제 store에는 `reorderTasks(reordered)` 함수가 있음 (`PersonalTodoShell.jsx:141`에서 사용). 

**수정 권고**: C8 의사코드에 다음 주석:
> // `updateSortIndex`는 의사명. 실제 구현은 `reorderTasks(reordered)` 사용. `personalAgenda.js`에서 cellTasks 정렬 후 `reorderTasks` 호출.

### M5. R-DND-3 매핑 부정확 — C8.5에서 over.data.current.type 사용 안 함

**§5 REQ-LOCK 매핑 표 (line 644)**:
> R-DND-1~8 → C8, C9

**R-DND-3 (line 105)**:
> `over.data.current.type` 값: `'agenda-matrix-task'` / `'agenda-matrix-row'`

C8.5는 chip X 버튼 클릭 이벤트 (`onClick` + `stopPropagation`)이지 드래그 이벤트가 아님. `over.data.current.type` 미사용.

**수정 권고**: C8.5의 충족 R 목록에서 `R-DND-3` 제거. R-UX-4만 매핑.

---

## 4. 🟢 LOW 항목

### L1. C2 토큰 추가 위치 명시 부족
"PILL export 직후, PIVOT export 직전" — 정확. ✓ 단 PIVOT은 별도 export이므로 "PIVOT 객체 *유지*"라는 표현보다 "PIVOT export 변경 없음" 명시 권장.

### L2. C5의 `projectId='inbox'` 식별자 충돌 검증 누락
`projectId='inbox'`는 store의 실제 projects에 `id='inbox'`가 존재하면 충돌. 추측 — `inbox`라는 system project가 없을 가능성 높지만 grep 검증 필요.

**수정 권고**: spec §C5에 "projectId='inbox' 식별자는 실제 store.projects에 'inbox' id 부재 검증 후 사용" 추가.

### L3. C4b의 `is_focus` 시각화와 FocusPanel 중복 표시 명시 불완전
D8은 "매트릭스 카드에 ⭐ 뱃지, 우측 FocusPanel은 그대로" — 즉 같은 task가 매트릭스 셀의 ⭐ 뱃지 + 우측 FocusPanel 카드 둘 다에 표시됨. UX 의도이지만 명시적으로 spec §1.4 또는 D8 부연 설명 추가.

---

## 5. 검증된 정상 항목 (Sanity Pass)

### 데이터 모델
- ✅ `tasks.id` text 타입 유지 (rename 없음) — R-DATA, R-CONST-2 ✓
- ✅ `agendas text[]` 컬럼명 / 타입 / DEFAULT — Postgres 문법 유효 ✓
- ✅ `valid_agendas CHECK (agendas <@ ARRAY[...]::text[])` — `<@` operator는 "subset" 의미, 유효 문법 ✓
- ✅ `CREATE INDEX ... USING GIN (agendas)` — text[]에 GIN 가능 ✓
- ✅ RLS 정책 변경 0건 — 기존 `private_tasks_owner`/`team_tasks_*` 자동 적용 (recon §2.2 확인) ✓
- ✅ `updated_at` 트리거 영향 없음 ✓

### Store
- ✅ `updateTask(id, patch)` 시그니처 불변 — R-STORE-1, [CLAUDE.md §3-3](../../CLAUDE.md) 준수 ✓
- ✅ `applyTransitionRules` 본체 변경 없음 — R-STORE-4. 7개 규칙은 agendas 미참조 (검증: `useStore.js:36-88`) ✓
- ✅ `hoveredTaskId` 추가는 store 최상위에 정의 가능 (현재 `detailTask` 등 같은 레벨에 단순 state 다수 존재) ✓

### 디자인 토큰
- ✅ AGENDA 색상값이 [CLAUDE.md §6 #5](../../CLAUDE.md) 금지 색상(`#c4c2ba`, `#d3d1c7`)을 사용하지 않음 ✓
- ✅ secondary text 최소 `#888780` 준수 (personal.dot = '#888780' ✓)
- ✅ Vite TDZ 준수 패턴 (모듈 레벨 const 0건) — recon §2.7 확인 ✓

### Recon 정합성
- ✅ D1 (text[] A안) ↔ recon Q1 권장 일치 ✓
- ✅ D2 (별도 플래그 없음) ↔ recon Q2 일치 ✓
- ✅ D5 (B안 평탄화) ↔ recon §1.3 일치 ✓
- ✅ D6 (추가 모드) ↔ recon §1.7 표 일치 ✓
- ✅ D10 (필터: assigneeId === me) ↔ recon Q6 일치 ✓
- ✅ R-DND droppable id 규칙 ↔ recon §2.5 권장 일치 ✓
- ✅ C5 inbox row 식별 ↔ recon Q2 일치 ✓
- ✅ Open Question 결정: D3, D8, D9 모두 spec에 명시 ✓

---

## 6. 권장 진행 순서

1. **B1, B3 즉시 수정** — 경로 정정, 행 의미 결정 (사용자 결정 필요)
2. **B2 아키텍처 옵션 선택** — DndContext 중첩 대응 (권장: 옵션 B)
3. **H1~H3 보완** — minmax 표기, mapTask 명세 정확화, 의존성 그래프 갱신
4. **M1~M5 정리** — 모호 표현 정리, 매핑 표 정정
5. **L1~L3 마이너 보완**
6. 보완 후 diff 단계로 진행 (`/diff-plan personal-agenda-matrix`)

---

## 7. 사용자 결정 필요 사항 (Spec 보강 입력)

| # | 결정 항목 | 옵션 | 권장 |
|---|---|---|---|
| Q-V1 | 매트릭스 "행"의 의미 (B3) | (a) 키 마일스톤 / (b) 상위 프로젝트 | (a) — recon §0 원문 + inbox 정의 일치 |
| Q-V2 | DndContext 중첩 대응 (B2) | A inline / B inner dispatcher / C 자체 DndContext | B — dispatcher 일관성 |
| Q-V3 | gridTemplateColumns minmax 유지 (H1) | (a) minmax(420px, 2fr) 유지 / (b) 단순 2fr | (a) — 매트릭스 가로 스크롤 보장 |
| Q-V4 | C7 wrapper 패턴 (M2) | wrapper 신설 / SortableTaskCard 직접 수정 | wrapper — R-COMP-8 보존 |

---

**다음 단계**: 위 BLOCK/HIGH 항목 해결 후 spec 갱신 → diff-plan 단계 진행 가능.
