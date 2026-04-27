---
phase: loop-49-note-font-and-cross-project-dnd
date: 2026-04-27
status: recon
prev: loop-48-note-bug-fix
next: spec
---

# Loop-49 Recon — 개인 할일 노트 폰트 통일 + 프로젝트 간 DnD

> **사용자 보고 (스크린샷 동반)**:
> 1. 개인 할일 (포커스 카드 인라인 펼침) 의 **노트 영역 폰트 사이즈가 할일 제목보다 크다**. 할일 제목과 동일하게 조절.
> 2. "지금 할일" 섹션에서 할일을 **프로젝트 간 드래그 앤 드롭으로 이동** 가능하게 변경.

---

## 1. 코드베이스 영향 범위 분석

### Issue #1 — 노트 영역 폰트 불일치

**현 상태 (실측)**:

| 컴포넌트 | task 제목 폰트 | 노트 (OutlinerRow textarea) 폰트 |
|---|---|---|
| [FocusCard.jsx:152](../../src/components/views/personal-todo/cells/FocusCard.jsx#L152) | `FONT.body` = **12** | (OutlinerRow) **14** (desktop) / 13 (mobile) |
| [PersonalTodoTaskRow.jsx:124](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L124) | `FONT.body` = **12** | — |
| [DetailPanel.jsx:132](../../src/components/shared/DetailPanel.jsx#L132) | **20** | (OutlinerRow) 14 |
| [OutlinerTaskNode.jsx:16](../../src/components/project/tasks/OutlinerTaskNode.jsx#L16) | **14** (desktop) | (OutlinerRow) 14 — 일치 |
| [OutlinerRow.jsx:17](../../src/components/shared/OutlinerRow.jsx#L17) | — | hardcoded `isMobile ? 13 : 14` |

**원인**: `OutlinerRow.jsx` 의 textarea fontSize 가 **하드코딩 14** (주석에는 "할일 제목과 동일" 으로 명시, OutlinerTaskNode 기준일 때만 사실).

**시각적 비교 (스크린샷)**:
- 좌측 "지금 할일" task text = 12
- 우측 "포커스" 펼침 카드의 task text = 12
- 우측 펼침 카드의 노트 bullet text = 14 → **2px 더 큼, 사용자 위화감**

### Issue #2 — 프로젝트 간 DnD

**현 상태 (실측)**:

- [PersonalTodoTaskRow.jsx:25-27](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L25): `useDraggable({ id: 'bl-task:${task.id}' })` — useSortable 아님
- [PersonalTodoShell.jsx:76-114](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L76): `handleDragEnd` 가 처리하는 분기:
  1. `bl-task:* → focus-panel:root` 또는 `focus-card:*` → `updateTask({ isFocus: true })`
  2. `focus-card:* ↔ focus-card:*` → reorder
  3. **그 외 drop = no-op** (현재 cross-project drop 처리 분기 없음)
- [PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx): droppable 등록 없음

**참조 패턴 (재사용 가능)** — [UnifiedGridView.jsx:170-275](../../src/components/views/UnifiedGridView.jsx#L170): 매트릭스의 cross-cell task move 가 이미 구현되어 있음. `cell-task:` / `cell-ms:` 위에 drop 시 `updateTask({ projectId, assigneeId, category, keyMilestoneId })`. 본 Loop 는 더 단순한 케이스 (project group 단위 drop).

### Issue #2 의 핵심 발견 — scope 가드 비대칭 (위험)

[useStore.js:614-635](../../src/hooks/useStore.js#L614) 의 `updateTask` 내부:
```js
const targetProject = ... find(p => p.id === targetProjectId)
if (targetProject && !targetProject.teamId) {
  resolvedPatch.scope = 'private'
  resolvedPatch.teamId = null
  resolvedPatch.assigneeId = _cachedUserId
}
```
**개인 프로젝트로 이동만 보호함**. 팀 프로젝트로 이동 시 scope/teamId 자동 갱신 없음.

| 케이스 | 현재 동작 | 위험 |
|---|---|---|
| Private task → Personal project | scope='private', assignee=user 자동 | OK ✓ |
| Private task → Team project | scope 미변경 (private), teamId 미설정 | **DB CHECK 위반 가능** (`scope='private' AND team_id IS NOT NULL`) |
| Team-assigned task → Personal project | scope='private', teamId=null, assignee=user (덮어씀) | 데이터 손실 (원래 teamId/assignee 사라짐) — 의도 외일 수 있음 |
| Team-assigned task → 같은 팀 다른 project | scope 미변경, projectId 만 갱신 | OK (assigneeId 유지, teamId 유지) ✓ |
| Team-assigned task → 다른 팀 project | scope 미변경, projectId 갱신, teamId 미갱신 | **불일치** (project.teamId ≠ task.teamId) |

**개인 할일 view 의 projects 목록 ([UnifiedGridView.jsx:101-104](../../src/components/views/UnifiedGridView.jsx#L101))**: 시스템 + 팀 (`teamId === currentTeamId`) + 개인 — 즉 한 화면에 mixed type 존재. drop target 타입에 따라 위 5가지 케이스 모두 발생 가능.

[applyTransitionRules.js:64](../../src/hooks/useStore.js#L64) R5: `projectId 변경 → keyMilestoneId 초기화` — 자동 처리됨 ✓.

---

## 2. 영향받는 파일/모듈 목록

### Issue #1 — 폰트 통일

| 파일 | 변경 유형 |
|---|---|
| [src/components/shared/OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) | textarea fontSize 결정 로직 변경 (또는 prop 추가) |
| [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | fontSize prop pass-through (Option A 채택 시) |
| [src/components/views/personal-todo/cells/FocusCard.jsx](../../src/components/views/personal-todo/cells/FocusCard.jsx) | OutlinerEditor 에 `fontSize={FONT.body}` 전달 (Option A 채택 시) |

**기타 OutlinerEditor 호출처 (영향 없음 보장 필요)**:
- DetailPanel.jsx
- MemoryView.jsx
- CompactTaskRow.jsx
- OutlinerTaskNode.jsx

### Issue #2 — 프로젝트 간 DnD

| 파일 | 변경 유형 |
|---|---|
| [src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | `useDroppable({ id: 'bl-project:${project.id}' })` 추가 + isOver 시각 피드백 |
| [src/components/views/personal-todo/PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | `handleDragEnd` 에 cross-project drop 분기 추가. drop 허용 여부 판단 (scope 가드 또는 type 매칭 필터) |
| (옵션) [src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | useDraggable data 에 source projectId 첨부 (drop validation 용) |

**선택적 영향**:
- 동일 프로젝트로 drop = no-op 명시
- 비허용 drop target (scope 불일치) = 시각 피드백 없음 또는 빨간 표시

---

## 3. 구현 옵션 + Trade-off

### Issue #1 — 노트 폰트 통일

**Option 1A — OutlinerRow 에 `fontSize` prop 추가 (권장)**
- OutlinerRow 가 prop 받아 textarea fontSize 결정. 미전달 시 기존 14/13 default.
- OutlinerEditor 가 pass-through. FocusCard 에서 `fontSize={FONT.body}` 전달.
- **장점**: 호출처별 독립 폰트 가능, 기존 4개 호출처 무영향, props 인터페이스 추가 (Loop-48 의 N-13 완화 정책에 부합)
- **단점**: props 표면 +1 (fontSize, fontSize Mobile 두 개 필요할 수도). 호출처마다 결정 필요
- **LOC**: ~+5 (3 파일)

**Option 1B — OutlinerRow 하드코딩을 `FONT.body` (12) 로 변경**
- 모든 호출처 동시 12로 통일.
- **장점**: 가장 단순, design token 기반
- **단점**: 5개 호출처 동시 영향. DetailPanel (제목 20 → 노트 12 격차 더 커짐), OutlinerTaskNode (제목 14 → 노트 12 미세 mismatch). 의도치 않은 시각 변화 위험
- **LOC**: ~+1 (1 파일)

**Option 1C — FocusCard 의 task title 을 14 로 변경**
- FocusCard 만 task title 12 → 14, 노트 14 와 매치.
- **장점**: 1줄 변경
- **단점**: **사용자 의도 정반대**. "노트가 큼 → 작게" 인데 "제목 키워서 맞춤" 이 됨. 좌측 PersonalTodoTaskRow (12) 와 우측 FocusCard (14) 도 또 다른 mismatch 발생
- **권장 안 함**

**권장: Option 1A** — 사용자 의도 (노트를 작게) + 다른 뷰 영향 없음 + N-13 완화 정책 부합.

---

### Issue #2 — 프로젝트 간 DnD

**Option 2A — Same-type 만 허용, type mismatch 는 drop 차단 (권장 MVP)**
- 드래그 시작 시 source task 의 scope/teamId 확인. drop target project 가 같은 type 이면 허용, 아니면 시각 피드백 없음 (drop = no-op).
  - Private task → personal project / system project: 허용
  - Team-assigned task → same-team project: 허용
  - 그 외: drop 무시
- **장점**: scope 가드 비대칭 회피. 데이터 정합성 안전. 사용자에게 "허용 안 됨" 명시
- **단점**: validation 로직 ~10 LOC. 사용자가 왜 드롭 안 되는지 헷갈릴 수 있음 → tooltip / cursor 변경 필요
- **LOC**: ~+30 (Shell + ProjectGroup + TaskRow data)

**Option 2B — 무조건 허용 + applyTransitionRules 에 scope 자동 변환 로직 추가**
- updateTask 내 personal-target 가드처럼 team-target 가드도 추가. private → team 시 scope='team', teamId=target.teamId 자동.
- **장점**: 모든 cross-project drop 가능. 가장 자유로운 UX
- **단점**: applyTransitionRules / updateTask 수정 필요 → 모든 호출처 영향. 잠재적 회귀 위험. team-target 시 누가 assignee 인지 결정 필요 (currentUserId? null?)
- **LOC**: ~+50 (스토어 액션 변경 영향)

**Option 2C — Personal project 간만 허용 (가장 보수적)**
- source task 와 target project 둘 다 `!teamId` 일 때만 drop 허용.
- **장점**: 가장 안전. scope 변환 0건 (전부 private)
- **단점**: 기능 범위 제한. team task 이동 불가 (사용자가 원할 수 있음)
- **LOC**: ~+25

**권장: Option 2A** — 안전 + 충분한 기능. 사용자가 보고한 시나리오 (`팀 개별 과제` 등 team-project 간 이동도 포함될 수 있음) 충족.

---

## 4. 재사용 가능한 기존 코드/패턴

| 재사용 대상 | 위치 | 활용 |
|---|---|---|
| `useDroppable({ id: 'focus-panel:root' })` 패턴 | [PersonalTodoShell.jsx:33](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L33) | ProjectGroup droppable 등록에 동일 패턴. `bl-project:${project.id}` id 컨벤션 |
| `useDraggable({ id: 'bl-task:${task.id}' })` | [PersonalTodoTaskRow.jsx:25](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L25) | 변경 없음 (또는 data 추가) |
| `handleDragEnd` 의 prefix 분기 패턴 | [PersonalTodoShell.jsx:76](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L76) | `if (overId.startsWith('bl-project:'))` 분기 추가 |
| Cross-project task move 로직 | [UnifiedGridView.jsx:265-273](../../src/components/views/UnifiedGridView.jsx#L265) | `updateTask({ projectId, assigneeId, category, keyMilestoneId })` — 다만 본 Loop 는 project header 만 target 이라 assignee/category 보존이 자연스러움 |
| `applyTransitionRules` R5 | [useStore.js:64](../../src/hooks/useStore.js#L64) | projectId 변경 → keyMilestoneId 자동 초기화 ✓ (별도 처리 불필요) |
| Personal project 가드 (L621) | [useStore.js:621](../../src/hooks/useStore.js#L621) | 자동 적용 — Option 2A 의 personal target 케이스에서 활용 |
| `accentColor` prop pass-through 패턴 | [OutlinerEditor.jsx:15](../../src/components/shared/OutlinerEditor.jsx#L15) | `fontSize` prop 추가 시 동일 패턴 |
| `isOver` 시각 피드백 패턴 | [PersonalTodoShell.jsx:33-43](../../src/components/views/personal-todo/PersonalTodoShell.jsx#L33) | ProjectGroup 헤더 / 영역 highlight 에 동일 |
| `projectDimmed` opacity 토큰 | [designTokens.js:131](../../src/styles/designTokens.js#L131) | drop 비허용 target 에 적용 가능 |

---

## 5. 위험 요소 / 사전 확인 필요 사항

### 코드 위험

| # | 위험 | 완화 |
|---|---|---|
| R1 | OutlinerRow 의 fontSize prop 추가 = N-13 완화 (props 인터페이스 무변경) 의 **추가** 케이스. Loop-48 에서 "props 무변경 시 내부 수정 허용" 으로 정의. **prop 추가는 명시적 결정 필요** | Spec 단계에서 "기존 호출처 default 동작 보존되면 prop 추가도 N-13 충족" 으로 재정의. 또는 fontSize 전용 wrapper 컴포넌트 |
| R2 | Cross-project DnD 시 scope 가드 비대칭 → DB CHECK 위반 가능 | Option 2A 채택으로 type mismatch drop 차단. Spec 에서 5케이스 표로 명시 |
| R3 | Personal view 의 projects 목록에 system + team + personal 혼재 → 어느 type 으로 drop 될지 source 기준으로 결정 필요 | Spec 에 5×3 매트릭스 (source type × target type) 명시 |
| R4 | Drop validation 실패 시 사용자에게 피드백 부재 → "왜 안 되지?" UX 혼란 | cursor=not-allowed + 비허용 target dim 처리. tooltip 은 over 시 표시 |
| R5 | `inner DndContext` 컨텍스트 등록 순서 (Loop-46 QA fix). FocusColumn 처럼 droppable 등록은 inner DndContext 내부 컴포넌트에서 호출 필수 | ProjectGroup 이 PersonalTodoListTable → PersonalTodoShell 의 inner DndContext 내부에 위치하므로 OK. 검증만 필요 |
| R6 | DnD 종료 후 즉시 task list 가 갱신되어 dragged element 가 사라지는 케이스 (focus drop 처럼 setExpanded 추가 호출 등) | updateTask 이후 자동 re-render. 별도 처리 불필요 |

### 정책 위험

| # | 위험 | 완화 |
|---|---|---|
| P1 | Loop-48 에서 N-13 완화 정책 완료 (OutlinerEditor 내부 수정 허용). prop 추가는 표면 확장 — 정책 재해석 필요 | "addative prop 은 default 가 기존 동작 보존이면 N-13 충족" 명시 (Spec) |
| P2 | Loop-46 N-14 (동시 편집 관용) — cross-project DnD 와 무관 | 영향 없음 |

### 사전 확인 항목 (Spec 단계)

1. **Issue #1 옵션 결정**: Option 1A (prop 추가) vs 1B (전역 12) — 1A 권장
2. **Issue #1 폰트 값 결정**: FocusCard 노트는 정확히 몇 px? `FONT.body=12` 가 적절한가, 아니면 `FONT.label=12` / `FONT.caption=11` 인가?
3. **Issue #1 모바일 처리**: 모바일에서도 동일 12? 또는 별도 mobileFontSize prop?
4. **Issue #2 옵션 결정**: Option 2A (same-type) vs 2B (full transition) vs 2C (personal-only) — 2A 권장
5. **Issue #2 visual feedback**: 비허용 target = (a) 시각 변화 없음 (drop 무시), (b) cursor=not-allowed, (c) target dim, (d) tooltip "이 프로젝트로 이동 불가". 권장 (b) + (c) 조합
6. **Issue #2 system project drop 허용 여부**: "즉시" 같은 시스템 프로젝트로 drop 가능한가? — 권장 yes (private project 와 동일 처리)
7. **Issue #2 same-project drop**: 같은 프로젝트로 drop = no-op? 또는 reorder? — 본 Loop 범위에서는 no-op (백로그 reorder 는 별도 Loop)
8. **Issue #2 백로그 섹션 (다음/남은) 의 task 도 cross-project DnD 가능 한가?**: 사용자 보고는 "지금 할일" 만 명시. CollapsibleSection 의 task 도 동일 PersonalTodoTaskRow 사용 → 같은 동작. Spec 에서 명시: 모든 섹션 적용 여부 결정
9. **Issue #2 회귀 테스트 시나리오**:
   - private → personal project drop (정상 이동)
   - team → same-team project drop (정상 이동)
   - private → team project drop 차단
   - team → personal project drop 차단
   - private → system project drop 허용
   - 같은 project 로 drop = no-op
   - drop 중 focus panel 로 drop 동시 가능성 → 우선순위?

---

## 6. 다음 단계

1. **Spec 작성** (`/spec loop-49-note-font-and-cross-project-dnd`): §5 사전 확인 9건 결정. R-XX 요구사항 + N-XX non-goal + edge case 표 + AC.
2. **Diff Plan**: 커밋 분리 (Issue #1 ~ Issue #2 = 약 4-5 커밋 예상).
3. **Execute**: 빌드 + 통합 테스트.

---

## 부록: 분석 기준 코드 라인 색인

| 파일 | 주요 라인 |
|---|---|
| [FocusCard.jsx](../../src/components/views/personal-todo/cells/FocusCard.jsx) | L152 task title font, L216-220 OutlinerEditor 호출 |
| [PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | L25-27 useDraggable, L116/L124 task font |
| [PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | L33 useDroppable focus, L76-114 handleDragEnd |
| [PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | L82-126 project col header (droppable target 후보) |
| [PersonalTodoListTable.jsx](../../src/components/views/personal-todo/PersonalTodoListTable.jsx) | L75-110 sections render |
| [OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) | L17 hardcoded fontSize, L68 textarea style |
| [OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | L15 props (accentColor pass-through 패턴) |
| [useStore.js applyTransitionRules](../../src/hooks/useStore.js) | L30-82 (특히 R5 L64), L614-635 updateTask + scope 가드 |
| [UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx) | L101-104 personal projects mix, L265-273 cross-cell update |
