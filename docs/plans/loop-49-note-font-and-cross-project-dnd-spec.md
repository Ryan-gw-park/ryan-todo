---
phase: loop-49-note-font-and-cross-project-dnd
source: docs/plans/loop-49-note-font-and-cross-project-dnd-recon.md
date: 2026-04-27
status: spec-draft
prev: recon
next: diff-plan
---

# Loop-49 Spec — 개인 할일 노트 폰트 통일 + 프로젝트 간 DnD

> **승인된 결정 (AskUserQuestion)**:
> - Q1 폰트 적용 = **Option 1A** (OutlinerEditor 에 fontSize prop 추가)
> - Q2 DnD 허용 범위 = **Option 2A** (same-type 만)
> - Q3 적용 섹션 = **"지금 할일" + "다음" + "남은" 3개 섹션 모두**
> - Q4 차단 drop 시각 = **cursor=not-allowed + target dim**

---

## 1. Scope (수정 대상 5개 파일)

| 파일 | 이슈 | 변경 요약 |
|---|---|---|
| [src/components/shared/OutlinerRow.jsx](../../src/components/shared/OutlinerRow.jsx) | #1 | hardcoded fontSize → prop 기반 (default 14/13 보존) |
| [src/components/shared/OutlinerEditor.jsx](../../src/components/shared/OutlinerEditor.jsx) | #1 | `fontSize` prop pass-through |
| [src/components/views/personal-todo/cells/FocusCard.jsx](../../src/components/views/personal-todo/cells/FocusCard.jsx) | #1 | OutlinerEditor 에 `fontSize={FONT.body}` (12) 전달 |
| [src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) | #2 | `useDroppable({ id: 'bl-project:${project.id}' })` 헤더 영역 등록 (Option D-ii) + isOver 시각 피드백 |
| [src/components/views/personal-todo/PersonalTodoShell.jsx](../../src/components/views/personal-todo/PersonalTodoShell.jsx) | #2 | `handleDragEnd` 에 cross-project drop 분기 + same-type validation |
| [src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx) | #2 | useDraggable data 에 source task 첨부 (R-04/R-07 시각 피드백 필수 의존) |

**변경 없음**: DB 마이그레이션 / RLS / Edge Function / API 엔드포인트 / 환경 변수 / 패키지 의존성.

---

## 2. 요구사항

### R-01 — OutlinerRow fontSize prop 추가 (Issue #1, Option 1A)

**현상**: [OutlinerRow.jsx:17](../../src/components/shared/OutlinerRow.jsx#L17) 의 textarea fontSize 가 하드코딩 `isMobile ? 13 : 14`. FocusCard 에서 task title 12 와 비교 시 노트 14 가 시각적으로 더 큼.

**요구**:
1. `OutlinerRow` 가 `fontSize` (number) prop 을 받음. 미전달 시 기존 default `isMobile ? 13 : 14` 보존.
2. textarea 의 `fontSize` 와 `lineHeight` 모두 prop 기반. **lineHeight 는 비례 계산** (피드백 #4 — 향후 다른 fontSize 호출 시에도 정합):
   ```js
   const effectiveFontSize = typeof fontSize === 'number' ? fontSize : (isMobile ? 13 : 14)
   // 14×1.42=19.88≈20 (기존 desktop), 13×1.42=18.46≈18 (기존 mobile 19 와 1px 차이),
   // 12×1.42=17.04≈17 (FONT.body 의 lineHeight 1.4 와 정합)
   const effectiveLineHeight = `${Math.round(effectiveFontSize * 1.42)}px`
   ```
   - **근거**: 14→20 (기존 일치), 12→17 (lineHeight 1.4 ≈ 1.42, 시각적 동일), 13→18 (기존 19 와 1px 차이지만 비례 일관성). 향후 fontSize=11/16 등 추가되어도 자동 적용.
   - **회귀 위험**: mobile 13 의 lineHeight 가 19→18 로 1px 줄어듦. desktop 14 는 20 유지. mobile-only 회귀 테스트 시 시각 확인 필요.
3. ~~bullet font (불릿포인트 div / `-` 텍스트) 도 동일 effectiveFontSize 적용~~ → **삭제 (W3 3차 결정)**: bullet `-` 의 hardcoded fontSize=12 보존. 근거: default 케이스 (fontSize=14) 에서 bullet 12→14 변화는 시각 회귀 (bullet 이 텍스트와 동일 크기 = 시각 marker 역할 약화). FocusCard 케이스 (fontSize=12) 에서는 bullet 12 = 텍스트 12 동일 → 추가 작업 불필요. bullet dot (`getBulletStyle()`) 은 SVG/border 기반, fontSize 무관.
4. **OutlinerRow.jsx L16 주석 ("불릿포인트: 데스크탑 14px, 모바일 13px (할일 제목과 동일)") 갱신** — prop 기반으로 동작 변경 명시.

### R-02 — OutlinerEditor fontSize prop pass-through (Issue #1)

**요구**:
1. `OutlinerEditor` props 에 `fontSize` 추가 (optional). 미전달 시 OutlinerRow 가 default 사용.
2. 모든 `<OutlinerRow>` 호출에 `fontSize={fontSize}` pass-through.
3. `forwardRef` 시그니처 무변경. `useImperativeHandle` 무변경.

### R-03 — FocusCard 노트 폰트 12 적용 (Issue #1)

**요구**:
1. [FocusCard.jsx:216-220](../../src/components/views/personal-todo/cells/FocusCard.jsx#L216) 의 `<OutlinerEditor>` 에 `fontSize={FONT.body}` (= 12) 추가.
2. 모바일 동일 12 적용 (별도 모바일 분기 없음 — FocusCard 자체가 desktop-only flow).
3. 다른 4개 OutlinerEditor 호출처 ([DetailPanel.jsx](../../src/components/shared/DetailPanel.jsx), [MemoryView.jsx](../../src/components/views/MemoryView.jsx), [CompactTaskRow.jsx](../../src/components/project/tasks/CompactTaskRow.jsx), [OutlinerTaskNode.jsx](../../src/components/project/tasks/OutlinerTaskNode.jsx)) **무수정** — fontSize prop 미전달 → default 14 동작 보존.

### R-04 — PersonalTodoProjectGroup droppable 등록 (Issue #2, Option 2A)

**현상**: [PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) 는 droppable 등록 없음 → cross-project drop 불가.

**요구**:
1. `useDroppable({ id: 'bl-project:${project.id}', data: { projectId, teamId, isSystem } })` 등록.
2. **`setNodeRef` 를 프로젝트 헤더 영역에만 부착** (피드백 #2 채택, Option D-ii):
   - 부착 위치: 현 [L82](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx#L82) 의 "Project col (col 1)" 영역 (`gridRow: 1 / span ${spanRows}` 가 적용된 헤더 div).
   - **Option D-i (최외곽 div = 헤더+task 목록 전체) 거부 근거**: (a) 같은 project 의 task row 위 drag 시 자기 project 가 isOver → V5 분기 추가 필요, (b) task 목록 영역과 focus panel 의 잠재적 droppable 중첩 가능성, (c) "이 프로젝트로 옮긴다" 의도가 *프로젝트 이름* 을 향하는 게 더 직관적.
   - **D-ii 의 trade-off**: drop zone 좁아짐 → 사용자가 정확히 헤더 영역에 drop 해야 함. PersonalTodoProjectGroup.jsx L82-126 의 헤더 영역 = project name + count + spanRows (task 행 갯수만큼 세로 span). 실제로는 충분히 넓은 영역 (여러 task row 높이) 이라 사용성 양호.
3. `isOver` 상태 + drop 가능 여부 (validation 결과) 에 따라 시각 피드백:
   - **drop 가능** (same-type match): background `COLOR.bgHover` (`#f5f4f0`) + cursor 변경 없음
   - **drop 차단** (type mismatch): background unchanged + opacity `OPACITY.projectDimmed` (0.65) + cursor `not-allowed`
   - **same project (자기 자신)**: drop 무시, 시각 변화 없음 (V5 — 헤더-only droppable 이므로 자연스럽게 자기 task 위는 isOver 안 됨, 단 헤더 자체에 drop 시는 명시적 차단 필요)
4. drop 가능 여부 판정은 `useDndContext()` 의 `active.data.current.task` 로 source task 조회 + own `data.projectId/teamId/isSystem` 와 비교. **R-06 의 useDraggable data 첨부 필수 의존**.

### R-05 — PersonalTodoShell handleDragEnd cross-project 분기 추가 (Issue #2)

**요구**:
1. 기존 분기 (focus panel drop, focus reorder) 보존.
2. **신규 분기 추가**: `if (activeIdStr.startsWith('bl-task:') && overId.startsWith('bl-project:'))` — W2 정정 후 `active.data?.current?.task` 직접 사용 (R-06 의 data 첨부 활용, tasks.find() fallback 불필요):
   ```js
   const taskId = activeIdStr.slice('bl-task:'.length)
   const targetProjectId = overId.slice('bl-project:'.length)
   const task = active.data?.current?.task           // R-06 첨부, 항상 보장
   const targetProject = projects.find(p => p.id === targetProjectId)
   if (!task || !targetProject) return                // data 누락 시 early return (안전 장치)
   if (!canMoveTaskToProject(task, targetProject)) return  // self-target + type mismatch 둘 다 false 처리
   updateTask(taskId, { projectId: targetProjectId })
   return
   ```
3. **`canMoveTaskToProject(task, targetProject)` validation 함수** (W1 3차: 함수 이름 + 위치 명확화):
   - **위치**: [PersonalTodoProjectGroup.jsx](../../src/components/views/personal-todo/cells/PersonalTodoProjectGroup.jsx) 파일 상단 (component 외부) 에 정의 + named export. ProjectGroup 자체가 visual feedback 에서 사용 (R-04 #4) + Shell 도 동일 함수 import.
   - **거부 대안**: `utils/` 분리는 향후 다른 컴포넌트 재사용 시 권장이나, 현재는 ProjectGroup + Shell 만 사용 → 컴포넌트 파일 export 가 적절.
   ```js
   export function canMoveTaskToProject(task, targetProject) {
     if (!task || !targetProject) return false
     if (task.projectId === targetProject.id) return false  // 자기 자신 = false (V5)
     // Private task (no teamId) → personal/system project (no teamId) 만 허용
     if (!task.teamId) return !targetProject.teamId
     // Team task → same teamId project 만 허용
     return task.teamId === targetProject.teamId
   }
   ```
4. `updateTask` 후 `applyTransitionRules` R5 (projectId 변경 → keyMilestoneId 초기화) 자동 적용 ✓. personal-target 가드 (useStore.js:621) 자동 적용 ✓.
5. drop 우선순위 (over 결정): `bl-project:` 와 `focus-panel:root` 가 동시에 over 후보일 경우 — `rectIntersection` collision detection 의 결과를 그대로 사용 (기본 동작 = 가장 큰 intersection 영역). focus panel 영역 내에서는 focus drop 이 우선.

### R-06 — PersonalTodoTaskRow useDraggable data 첨부 (Issue #2, **필수** — 피드백 #3)

**요구**:
1. [PersonalTodoTaskRow.jsx:25](../../src/components/views/personal-todo/cells/PersonalTodoTaskRow.jsx#L25) 의 `useDraggable` 호출에 `data: { task }` 추가:
   ```js
   useDraggable({ id: 'bl-task:${task.id}', data: { task } })
   ```
2. ProjectGroup 의 droppable validation 에서 `useDndContext().active?.data?.current?.task` 로 직접 조회.
3. **R-04 / R-07 의 실시간 isOver 시각 피드백 (V3 vs V4 분기) 구현 필수 의존**: ProjectGroup 안에서 source task 정보 없이는 drop 가능 여부 판정 불가. tasks 배열을 prop 으로 ProjectGroup 까지 내려보내는 대안은 더 침습적 → useDndContext 경로 채택.
4. Shell 의 handleDragEnd 도 동일 경로 사용 (`active.data.current.task`) — tasks 배열 lookup 코드 단순화.

### R-07 — 시각 피드백 정확도 (Issue #2, Q4)

**요구**:
1. **drop 가능 target** (drag in progress + isOver + isAllowedDrop): background `COLOR.bgHover`, transition `background 0.15s`. cursor 변경 없음 (기본 `pointer` 또는 default).
2. **drop 차단 target** (drag in progress + isOver + !isAllowedDrop): opacity `OPACITY.projectDimmed`, cursor `not-allowed` (W-NEW-4 정정 — CSS 적용 위치: **헤더 col div** = `setDropRef` 부착 위치 = R-04 Option D-ii 의 droppable 영역. 최외곽 div 가 아닌 헤더 영역에만 시각 효과 적용 → task rows 는 dim 안 됨).
3. **idle / no drag**: 기존 hover 동작 보존 (header hover 시 "+" 아이콘 등).
4. **same project (자기 자신)**: 시각 변화 없음 (기본 idle 처럼 보이게). isAllowedDrop 함수에서 `task.projectId === targetProject.id` 도 false 처리.
5. drag overlay 사용 안 함 (현재 PersonalTodoShell 도 drag overlay 없음 — opacity 0.3 으로 dragged element 표시).

---

## 3. Non-Goals (N-XX)

| # | 비요구사항 | 근거 |
|---|---|---|
| N-01 | 다른 4개 OutlinerEditor 호출처 (DetailPanel/MemoryView/CompactTaskRow/OutlinerTaskNode) 의 폰트 변경 | fontSize prop default 가 기존 동작 (14/13) 보존. 호출처 무영향 |
| N-02 | OutlinerEditor 외부 API 의 다른 변경 | fontSize prop 추가만 — additive. Loop-46 N-13 (props 인터페이스 무변경) 의 완화 적용: addative prop + default 동작 보존 = N-13 충족 |
| N-03 | DnD 시 task 의 assigneeId / category / scope 변경 | R-05 의 updateTask 는 `{ projectId }` 만 patch. applyTransitionRules R5 (keyMilestoneId 초기화) + personal-target 가드만 자동 적용. team-target 으로 drop 은 same-type 만 허용되므로 scope 변환 자체가 발생 안 함 |
| N-03b | [useStore.js:621](../../src/hooks/useStore.js#L621) 의 personal-target scope 가드 (Team→Personal 시 scope='private', teamId=null, assigneeId=user 자동 덮어쓰기) 변경 | **본 Loop 의 DnD 는 same-type 만 허용 → 이 가드 미발동**. 다만 다른 코드 경로 (UnifiedGridView 매트릭스 cross-cell move 등) 는 여전히 가드 발동 — 기존 동작 보존, 본 Loop 에서 수정하지 않음 (피드백 #6) |
| N-04 | 같은 프로젝트 내 task reorder | 본 Loop 범위 외. 별도 Loop 후보 (백로그 reorder) |
| N-05 | Cross-project DnD 후 keyMilestoneId 보존 | applyTransitionRules R5 가 자동 초기화 → null 로 설정. 의도된 동작 (다른 project 의 milestone 은 의미 없음) |
| N-06 | Drop validation 실패 시 toast / 모달 알림 | cursor=not-allowed + dim 으로 충분한 피드백 제공. 추가 알림은 noisy |
| N-07 | Mobile DnD 지원 (touch) | 기존 TouchSensor 그대로 사용 — 추가 처리 없음. mobile UI 는 PersonalMatrixMobileList 사용 (PersonalTodoShell 미경유) |
| N-08 | Drop 후 자동 펼침 (focus drop 의 setExpanded 같은) | cross-project drop 은 기존 펼침 상태 보존 |
| N-09 | DB 마이그레이션 / RLS / 백엔드 변경 | 프론트엔드 단독 |

---

## 4. Edge Cases

### 4-1. 폰트 적용 (R-01 ~ R-03)

| Case | 입력 | 기대 동작 |
|---|---|---|
| F1 | FocusCard 에서 노트 입력 | textarea fontSize 12, bullet 12, task title 12 모두 일치 ✓ |
| F2 | DetailPanel 에서 노트 입력 | fontSize prop 미전달 → default 14 (desktop) / 13 (mobile) — 기존 동작 보존 ✓ |
| F3 | MemoryView 메모 입력 | F2 와 동일 — default 14 ✓ |
| F4 | OutlinerTaskNode (project view) | F2 와 동일 — default 14, task title 14 와 매치 ✓ |
| F5 | CompactTaskRow (project view) | F2 와 동일 — default 14 ✓ |
| F6 | FocusCard 모바일 환경 | fontSize=12 그대로 적용 (FocusCard 는 desktop-only flow 지만 방어적으로 동작) |
| F7 | OutlinerRow textarea autoResize 동작 | fontSize 변경 후에도 height auto 갱신 (Loop-48 의 autoResize dep `[node.text, node.level]` 효과). lineHeight 17px 기준 1줄 높이 ~22-23px |

### 4-2. Cross-project DnD 허용 매트릭스 (R-04 ~ R-07)

| Source task type | Target project type | 허용 | 동작 |
|---|---|---|---|
| Private (`!teamId`) | Personal (`!teamId`) | ✓ | updateTask({ projectId }), 자동 keyMilestoneId=null |
| Private | System (`!teamId`, `isSystem`) | ✓ | 동일. system project (예: "즉시") 는 personal 과 동일 처리 |
| Private | Team (`teamId !== null`) | ✗ | drop 차단, dim + not-allowed |
| Team-assigned (`teamId !== null`) | Same-team (`teamId === task.teamId`) | ✓ | updateTask({ projectId }), assigneeId/scope 보존 |
| Team-assigned | Different-team (`teamId !== task.teamId`) | ✗ | drop 차단 |
| Team-assigned | Personal (`!teamId`) | ✗ | drop 차단 (data 손실 방지) |
| Team-assigned | System (`!teamId`) | ✗ | drop 차단 (system project 는 개인 전용) |

**System project invariant (피드백 #1 DB 실측)**:
- 앱 시드 코드 ([useStore.js:498](../../src/hooks/useStore.js#L498)) 가 system project 를 항상 `team_id: null, is_system: true, system_key: 'instant'` 로만 생성.
- DB 스키마에는 `is_system + team_id` 조합 제약 없음. 즉 anomalous 데이터 (예: 수동 INSERT) 시 isSystem=true AND teamId IS NOT NULL 가능.
- isAllowedDrop 로직은 anomalous 데이터에도 안전 — `task.teamId === targetProject.teamId` 비교가 row 단위 teamId 매칭으로 동작. 즉 team-system project 가 존재한다면 same-team task 만 drop 허용 (자연스러운 동작).
- **결론**: 매트릭스의 "Team-assigned → System = ✗" 는 **앱 invariant 기준** (system = teamId null). DB anomaly 시 isAllowedDrop 가 자동 처리.
| Any | Same project (자기 자신) | ✗ | no-op, 시각 변화 없음 |

### 4-3. DnD 동작 시나리오

| Case | 입력 | 기대 동작 |
|---|---|---|
| D1 | "지금 할일" 의 private task 를 다른 personal project 헤더로 drop | projectId 갱신, 즉시 view re-render, dragged task 가 새 project 그룹 아래 표시 |
| D2 | "다음 할일" 의 task 를 다른 project 로 drop | 섹션 무관 동일 동작. PersonalTodoTaskRow 가 3개 섹션에서 공유 |
| D3 | 시스템 프로젝트 ("즉시") 로 drop | personal project 와 동일 처리. 시스템 프로젝트로 이동 가능 |
| D4 | drop 중 마우스가 focus panel 영역으로 이동 | rectIntersection 으로 focus-panel:root 가 우선 → focus drop 동작 (기존 분기) |
| D5 | drop 중 마우스가 빈 공간 (project group 사이) | over 없음 → no-op (기존 동작 보존) |
| D6 | 드래그 시작 후 곧바로 drop (이동 거리 <5px) | PointerSensor activationConstraint distance=5 → drag 이벤트 미발생, click 으로 처리 (편집 진입 등 기존 동작) |
| D7 | drop 직후 즉시 다음 drag 시작 | 정상 처리. dragSourceTask state 가 reset 후 새 active 로 갱신 |
| D8 | 같은 task 가 백로그 + focus 양쪽에 표시 (Loop-45 의도된 중복) 중 백로그쪽 drag → cross-project drop | 정상. updateTask 이후 양쪽 모두 새 project 로 갱신됨 |
| D9 | drag 중 외부 sync (다른 device 가 같은 task 의 projectId 변경) | source task 가 사라질 수 있음. dnd-kit 이 active item 추적 — drop 시 useStore 의 최신 tasks 로 lookup, 없으면 no-op |

### 4-4. DnD 시각 피드백 (R-07)

| Case | 상태 | 표시 |
|---|---|---|
| V1 | idle (drag 없음) | 기존 hover 동작 (header "+" 아이콘 등) |
| V2 | drag in progress, ProjectGroup 위 not over | 변화 없음 |
| V3 | drag over allowed target | background bgHover, cursor 기본 |
| V4 | drag over blocked target | opacity 0.65, cursor not-allowed |
| V5 | drag over same project (자기 자신) | 변화 없음 (V2 와 동일). **W6 (3차) 가드 필수**: `headerOpacity` / `headerCursor` / `headerBg` 모두 `!isSelfTarget` 체크 추가 — `canMoveTaskToProject` 가 self → false 반환하므로 가드 없으면 dim 표시됨 |
| V6 | dragged item 자체 | 기존 opacity 0.3 (PersonalTodoTaskRow.jsx:34) 보존 |

---

## 5. Acceptance Criteria

### 5-1. 폰트 (Issue #1)

- [ ] AC-01: FocusCard 펼침 시 task title (12) 과 노트 텍스트 (12) 폰트 사이즈 동일 (개발자 도구로 검증)
- [ ] AC-02: FocusCard 의 노트 bullet (•, ○ 등) 표시 정상 — bullet dot 은 fontSize 무관 (SVG/border), `-` 텍스트는 hardcoded 12 (W3 결정으로 변경 없음, FocusCard 텍스트 12 와 자연 일치)
- [ ] AC-03: DetailPanel 노트 폰트 14 보존 (회귀 없음)
- [ ] AC-04: MemoryView 메모 폰트 14 보존
- [ ] AC-05: OutlinerTaskNode (project view) 노트 폰트 14 보존
- [ ] AC-06: CompactTaskRow 노트 폰트 14 보존
- [ ] AC-07: 모든 OutlinerRow 의 textarea autoResize 정상 동작 (height 자동 조절)

### 5-2. Cross-project DnD (Issue #2)

- [ ] AC-08: "지금 할일" 의 private task 를 다른 personal project 로 drop → projectId 갱신, view 즉시 갱신
- [ ] AC-09: "다음" / "남은" 섹션도 동일 동작
- [ ] AC-10: System project ("즉시") 로 drop 가능 (private task)
- [ ] AC-11: Team task 를 same-team project 로 drop 가능
- [ ] AC-12: Private task → Team project drop 차단 (dim + not-allowed cursor)
- [ ] AC-13: Team task → Personal project drop 차단
- [ ] AC-14: 같은 project 로 drop = no-op (시각 변화 없음, updateTask 미호출)
- [ ] AC-15: 백로그 → focus panel drop 기존 동작 보존 (R-23 회귀 없음)
- [ ] AC-16: focus card 간 reorder 기존 동작 보존 (R-25 회귀 없음)
- [ ] AC-17: keyMilestoneId 자동 초기화 확인 (cross-project drop 후 detail panel 에서 milestone = null)

### 5-3. 빌드 / 품질

- [ ] AC-18: `npm run build` 성공
- [ ] AC-19: ESLint 경고 추가 없음
- [ ] AC-20: 4 커밋 R-ATOMIC 분리 (Issue #1 통합 = C1, Issue #2 의존성 순서 = C2~C4)

---

## 6. 커밋 계획 (R-ATOMIC 4커밋, 피드백 #5 통합)

Issue 단위 = 커밋 단위. R-01~R-03 은 개별 적용 시 사용자 체감 없음 (모두 적용해야 비로소 변화) → 단일 커밋이 R-ATOMIC 원칙 ("하나의 이슈 = 하나의 커밋") 에 부합.

```
Commit 1: feat(outliner): fontSize prop + FocusCard 12 적용
            (R-01 + R-02 + R-03, ~+8 LOC, 3 파일, Issue #1 전체)
            - OutlinerRow: fontSize prop + 비례 lineHeight 계산
            - OutlinerEditor: fontSize pass-through
            - FocusCard: fontSize={FONT.body} 전달

Commit 2: feat(personal-todo-task-row): useDraggable data 에 task 첨부
            (R-06, +2 LOC, R-04/R-07 의 시각 피드백 의존성)

Commit 3: feat(personal-todo-project-group): droppable + 시각 피드백
            (R-04 + R-07, ~+25 LOC, 헤더-only droppable, isOver V3/V4 분기)

Commit 4: feat(personal-todo-shell): cross-project drop 분기 + same-type validation
            (R-05, ~+25 LOC, isAllowedDrop 함수 + handleDragEnd 신규 분기)
```

**커밋 순서 근거**:
- C1 = Issue #1 (독립, 회귀 영역 좁음)
- C2 → C3 → C4 = Issue #2 의존성 순서. C2 가 data 첨부 → C3 가 그 data 로 isOver 시각 피드백 → C4 가 drop 처리.
- 중간 빌드: C1 후, C2 후 (data 첨부만 하면 동작 무변화), C3 후 (droppable 등록되지만 Shell 핸들러 없으니 drop=no-op), C4 후 (전체 동작 완성).

---

## 7. 회귀 테스트 시나리오

### 7-1. Issue #1 회귀

1. FocusCard 펼침 → 노트 입력 / 편집 → 폰트 12 확인
2. DetailPanel 열기 → 노트 입력 / 편집 → 폰트 14 확인 (회귀 없음)
3. MemoryView 메모 편집 → 폰트 14 확인
4. ProjectView 트리 모드 task 노트 편집 → 폰트 14 확인
5. ProjectView compact 모드 task 노트 편집 → 폰트 14 확인

### 7-2. Issue #2 회귀

6. 백로그 task drag → focus panel drop (F-23 기존 동작)
7. Focus card 간 reorder (F-25 기존 동작)
8. Focus card → 외부 drop (no-op, × 버튼만 해제 — F-24)
9. 백로그 task drag (5px 미만 이동) → 편집 진입 (드래그 미발동)
10. Cross-project drop 후 detail panel 열기 → milestone = null 확인 (R5 적용)

### 7-3. 새 기능 검증

11. Edge case 4-2 의 8 매트릭스 모두 수동 재현
12. Drag overlay 없이 dragged item opacity 0.3 표시 보존
13. dim + not-allowed cursor 시각 피드백 확인 (모든 차단 케이스)

---

## 8. 미해결 사항

본 Spec 단계에서 모든 설계 결정 확정 완료. Diff Plan 단계에서는 코드 작성만 수행.

- ~~Q1 폰트 옵션~~ → Option 1A 채택
- ~~Q1 폰트 값~~ → FONT.body (12), 모바일 동일
- ~~Q2 DnD 옵션~~ → Option 2A 채택
- ~~Q2 적용 섹션~~ → 3개 섹션 모두
- ~~Q2 system project drop~~ → personal 과 동일 처리 (허용)
- ~~Q2 same project drop~~ → no-op
- ~~Q2 visual feedback~~ → cursor=not-allowed + dim
- ~~Q2 focus panel + project 동시 over~~ → rectIntersection 기본 동작 (헤더-only droppable 채택으로 사실상 중첩 없음 — 좌측 백로그 영역과 우측 focus panel 영역은 grid column 으로 분리)
- ~~System project DB invariant~~ → 피드백 #1 검증 완료. 앱 시드 코드가 team_id=null 만 생성. isAllowedDrop 로직은 anomalous 데이터에도 row 단위 teamId 매칭으로 안전.
- ~~Droppable 범위~~ → Option D-ii (헤더-only) 채택, 피드백 #2.
- ~~R-06 optional 표기~~ → 필수로 격상, 피드백 #3.
- ~~lineHeight 계산~~ → 비례 계산 (`fontSize × 1.42`), 피드백 #4.
- ~~Commit 분리 과도~~ → 4커밋으로 통합, 피드백 #5.
- ~~scope 가드 비대칭 N-03 명시~~ → N-03b 추가, 피드백 #6.

남는 사소 결정:
- N-13 정책 재해석: "addative prop + default 동작 보존 = N-13 충족" — 본 Loop 가 첫 적용 사례. Diff Plan 의 commit 1 에서 명시.
