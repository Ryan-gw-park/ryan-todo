# Phase matrix-redesign — Recon

> **Phase**: Matrix Pivot Redesign + MS L1 Flat Simplification
> **Date**: 2026-04-15
> **Spec**: [matrix-redesign-spec.md](./matrix-redesign-spec.md)
> **Scope**: TeamMatrixView 피벗 전환 + MS 구조 평탄화 + 백로그 개념 폐기

---

## 0. Spec 핵심 요구사항 (Recon 대상)

| ID | 요구사항 |
|----|---------|
| R01 | 매트릭스 축 전환: rows=프로젝트, cols=팀원 (피벗 테이블) |
| R03 | 펼친 행: MS sub-row + 직속 task sub-row, 셀에 실제 task 표시 |
| R04/R05 | Primary 진하게(weight 500), Secondary 연하게(text-tertiary) |
| R08 | 백로그 패널(우측) 제거 |
| R09 | MS L1 flat 고정. parent_id always null |
| R10 | MS = 선택적 그룹. task는 MS 없이 프로젝트 직속 가능 |
| R11 | "백로그" 개념 폐기 → keyMilestoneId=null = 1등 시민 task |
| R12 | DepthToggle 삭제 |
| R13 | 카운트 색상: 5+ amber pill, 10+ coral pill |
| R15 | 첫 컬럼 + 헤더 행 sticky |
| R18 | 펼침 상태 localStorage 영속 |
| R21 | 개인 매트릭스 → **별도 phase로 분리** |
| R22 | 셀 내 task 클릭 → **inline 편집** |
| R23 | 1:1 MS+task 자동 정리 |
| R24 | 프로젝트 직속 sub-row → **라벨 없음** (익명) |

---

## 1. 영향 범위 분석

### 1.1 직접 영향 (전면 교체/삭제 대상)

| 파일 | 줄수 | 영향 | 비고 |
|------|------|------|------|
| [src/components/views/UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx) | 515 | **전면 수정** | Orchestrator. 백로그 사이드바 import 제거, 팀 매트릭스 분기를 PivotMatrixTable로 |
| [src/components/views/grid/grids/TeamMatrixGrid.jsx](../../src/components/views/grid/grids/TeamMatrixGrid.jsx) | 84 | **삭제 또는 wrap** | 3×3 카드 그리드 — 피벗 테이블로 대체. spec §10에 따라 export 시그니처는 유지하고 내부 교체 |
| [src/components/common/MsBacklogSidebar.jsx](../../src/components/common/MsBacklogSidebar.jsx) | 352 | **삭제** | 백로그 패널. R08, R11에 의해 폐기 |
| [src/components/shared/DepthToggle.jsx](../../src/components/shared/DepthToggle.jsx) | 38 | **삭제** | R12. MS L1 flat이라 depth 토글 무의미 |
| [src/utils/backlogFilter.js](../../src/utils/backlogFilter.js) | 7 | **삭제** | "백로그" 개념 폐기 (R11). `isBacklogTask` 유틸 불필요 |

### 1.2 트리 로직 정리 (parent_id 의존성 제거)

| 파일 | 영향 | 액션 |
|------|------|------|
| [src/utils/milestoneTree.js](../../src/utils/milestoneTree.js) (309줄) | **부분 폐기** | `buildTree`, `computeDepth`, `getProjectMaxDepth`, `getNodePath`, `getMsPath`, `flattenTree`, `flattenTreeWithTasks`, `countTasksRecursive`, `flattenVisibleNodes`, `expandAll/collapseAll` 트리 함수들 사용처 grep 후 단순 flat list 함수로 대체. 파일 자체는 유지(rollback 안전), 미사용 함수만 제거 또는 deprecated 표시 |
| [src/utils/milestoneProgress.js](../../src/utils/milestoneProgress.js) (29줄) | **단순화** | `computeMilestoneCountRecursive` 폐기 (재귀 불필요), `computeMilestoneCount`만 유지 |
| [src/hooks/useStore.js](../../src/hooks/useStore.js):`moveMilestone`, `cascadeMilestoneOwner` | **단순화 또는 삭제** | parent 이동/cascade 로직 — flat이라 불필요. moveMilestone은 다른 프로젝트로 이동만 유지 |

### 1.3 백로그/계층 의존 컴포넌트 (사용처 정리)

| 파일 | 의존도 | 액션 |
|------|--------|------|
| [src/components/project/MsTaskTreeMode.jsx](../../src/components/project/MsTaskTreeMode.jsx) | 트리 indent | 매트릭스 외부 (ProjectView 내부)이지만 MS L1 flat 정책상 평탄화 필요 |
| [src/components/project/MsTaskListMode.jsx](../../src/components/project/MsTaskListMode.jsx) | flat 리스트 | 영향 적음 |
| [src/components/project/BacklogPanel.jsx](../../src/components/project/BacklogPanel.jsx) | 백로그 개념 | **검토 후 재명명/제거** — Phase 12f에서 이미 cleanup 일부 진행 |
| [src/components/project/CompactMilestoneTab.jsx](../../src/components/project/CompactMilestoneTab.jsx), [KeyMilestoneTab.jsx](../../src/components/project/KeyMilestoneTab.jsx) | parent_id 사용? | grep 필요 |
| [src/components/modals/MilestoneDetailModal.jsx](../../src/components/modals/MilestoneDetailModal.jsx) | "상위 MS 선택" UI | **상위 선택 옵션 제거** (spec §6 수정 항목) |

### 1.4 신규 생성

| 파일 | 역할 | 참고 |
|------|------|------|
| `src/components/views/grid/PivotMatrixTable.jsx` | 피벗 테이블 메인 (sticky 헤더/첫 컬럼, overflow-x) | 신규 |
| `src/components/views/grid/cells/PivotProjectRow.jsx` | 접힌/펼친 프로젝트 행 | MilestoneRow 패턴 참고 |
| `src/components/views/grid/cells/PivotMsSubRow.jsx` | MS sub-row | 동일 |
| `src/components/views/grid/cells/PivotTaskCell.jsx` | 셀 내 task 리스트 (Primary/Secondary 분기, inline 편집) | CardTaskRow 패턴 |
| `src/components/views/grid/cells/PivotUngroupedSubRow.jsx` | keyMilestoneId=null sub-row (R24: **라벨 없음**) | PivotMsSubRow와 동일 셸, 헤더 텍스트 비움 |
| `src/utils/cleanup1to1Milestones.js` | 1:1 MS+task 자동 정리 (R23). 마이그레이션 또는 일회성 스크립트 형태 | 신규 |

### 1.5 데이터 모델 (DDL)

| 마이그레이션 | 내용 | 리스크 |
|--------------|------|--------|
| `supabase/migrations/2026XXXX_ms_flatten.sql` | `UPDATE key_milestones SET parent_id = NULL WHERE parent_id IS NOT NULL` | 낮음 — 데이터 손실 없음, 평탄화만 |
| `supabase/migrations/2026XXXX_cleanup_1to1_ms.sql` | 1:1 MS+task 쌍 → MS 삭제, task의 keyMilestoneId=null 설정 | **중간** — task 그룹 정보 손실. spec R23 결정에 따라 자동화 |

### 1.6 영향 없음 (변경 불필요)

- `tasks` 테이블 (컬럼 변경 없음)
- `key_milestones` 테이블 컬럼 (parent_id, depth는 컬럼 유지, 값만 평탄화)
- `mapTask`, `taskToRow`, `mapMilestone` 시그니처
- 개인 매트릭스 (`PersonalMatrixGrid.jsx`) — R21에 의해 본 phase 범위 밖
- 주간 플래너 (`PersonalWeeklyGrid`, `TeamWeeklyGrid`) — 무관
- 타임라인, TodayView, MemoryView, ProjectView 등 — 무관 (단, MsTaskTreeMode는 검토)

---

## 2. 영향받는 파일 / 모듈 목록 (요약)

```
src/
├── components/
│   ├── views/
│   │   ├── UnifiedGridView.jsx                      [수정] 백로그 사이드바 분기 제거, 팀 모드 → PivotMatrixTable
│   │   └── grid/
│   │       ├── grids/TeamMatrixGrid.jsx             [전면 교체] PivotMatrixTable 위임
│   │       ├── PivotMatrixTable.jsx                 [신규]
│   │       └── cells/
│   │           ├── PivotProjectRow.jsx              [신규]
│   │           ├── PivotMsSubRow.jsx                [신규]
│   │           ├── PivotTaskCell.jsx                [신규]
│   │           └── PivotUngroupedSubRow.jsx         [신규]
│   ├── common/MsBacklogSidebar.jsx                  [삭제] DELETE-5
│   ├── shared/
│   │   ├── DepthToggle.jsx                          [삭제] DELETE-5
│   │   └── ProjectLaneCard.jsx                      [현행 유지] 개인 매트릭스가 계속 사용
│   ├── project/
│   │   ├── BacklogPanel.jsx                         [검토] 명칭/역할 재정의
│   │   ├── MsTaskTreeMode.jsx                       [검토] 트리 indent 단순화
│   │   ├── KeyMilestoneTab.jsx                      [검토] parent_id 의존 grep
│   │   └── CompactMilestoneTab.jsx                  [검토] 동일
│   └── modals/MilestoneDetailModal.jsx              [수정] "상위 MS 선택" 옵션 제거
├── hooks/
│   ├── useStore.js                                  [수정] moveMilestone/cascadeMilestoneOwner 단순화
│   ├── useKeyMilestones.js                          [현행 유지]
│   └── useMilestonesByProjects.js                   [현행 유지]
├── utils/
│   ├── milestoneTree.js                             [부분 deprecate] 트리 함수 미사용 처리
│   ├── milestoneProgress.js                         [단순화]
│   ├── backlogFilter.js                             [삭제]
│   └── cleanup1to1Milestones.js                     [신규]
└── styles/designTokens.js                           [추가] amber/coral pill 토큰

supabase/migrations/
├── 2026XXXX_ms_flatten.sql                          [신규]
└── 2026XXXX_cleanup_1to1_ms.sql                     [신규]
```

---

## 3. 구현 옵션 (3개) + Trade-off

### 옵션 A: 점진적 교체 — 기존 TeamMatrixGrid를 wrapper로 두고 내부만 새 컴포넌트로 위임

**구조**:
```
TeamMatrixGrid (export 유지)
  └─ PivotMatrixTable (신규, 모든 로직)
```

**Pros**:
- UnifiedGridView의 import는 그대로 유지 (`<TeamMatrixGrid ... />`)
- spec §10 "Don't Touch, Wrap It 적용 판단"에 명시된 방식
- Rollback 시 `TeamMatrixGrid` 내부만 되돌리면 됨

**Cons**:
- TeamMatrixGrid 84줄 거의 전부가 새 코드로 대체됨 → 사실상 전면 교체와 동일
- props 시그니처가 PivotMatrixTable과 다를 수 있어 변환 레이어 필요

**적합도**: ★★★★★ (spec §10 결정에 부합)

---

### 옵션 B: 새 컴포넌트로 완전 분리 — TeamMatrixGrid는 둔 채 UnifiedGridView가 PivotMatrixTable 직접 임포트

**구조**:
```
UnifiedGridView
  └─ scope==='team' && view==='matrix' ? <PivotMatrixTable /> : <기존>
```

**Pros**:
- TeamMatrixGrid 코드를 건드리지 않고 dead code로 남김 (Don't Touch 원칙 strict 준수)
- A/B 테스트 가능 (feature flag로 분기)

**Cons**:
- dead code 누적 → CLAUDE.md "half-finished implementations 금지"와 충돌
- UnifiedGridView 분기 복잡도 증가
- DELETE-5 권장 (TeamMatrixGrid 자체를 삭제)와 충돌

**적합도**: ★★ (단기 안전, 장기 부채)

---

### 옵션 C: 완전 인-플레이스 재작성 — TeamMatrixGrid 파일을 직접 PivotMatrixTable로 재작성

**구조**:
```
TeamMatrixGrid.jsx → 파일명 유지, 내용 전부 새로 작성
```

**Pros**:
- 파일 1개로 깔끔. 복잡도 낮음
- 신규 컴포넌트 5개를 만들지 않고 `cells/Pivot*.jsx`만 신규

**Cons**:
- 파일 책임이 비대해짐 (84줄 → 500줄+ 예상)
- 컴포넌트 분리 원칙 위배
- 향후 PivotMatrixTable을 다른 곳에서 재사용하기 어려움

**적합도**: ★★★ (간단하나 확장성 부족)

---

### 추천: **옵션 A**

- spec §10이 이미 명시한 방식
- ProjectLaneCard/ProjectGridLayout 분리 패턴(Phase 12f)과 일관성
- 신규 컴포넌트 셋(`Pivot*`)을 [src/components/views/grid/](../../src/components/views/grid/) 하위에 두면 기존 grid/cells 구조와 자연스럽게 통합

---

## 4. 재사용 가능한 함수/패턴

### 4.1 인라인 편집 (R22)
- **참고**: [src/components/shared/ProjectLaneCard.jsx:48-60](../../src/components/shared/ProjectLaneCard.jsx#L48-L60)
  ```jsx
  const [editingId, setEditingId] = useState(null)
  const handleEditFinish = useCallback((taskId, value) => {
    setEditingId(null)
    if (value && value.trim()) updateTask(taskId, { text: value.trim() })
  }, [updateTask])
  ```
- **PivotTaskCell**에 동일 패턴 적용. 클릭 → `setEditingId(taskId)` → input 렌더 → blur/Enter로 finish

### 4.2 Sticky 헤더/컬럼 (R15)
- 코드베이스 내 sticky table 사례는 부분적([MsBacklogSidebar.jsx](../../src/components/common/MsBacklogSidebar.jsx) 헤더만)
- **신규 구현 필요**: `position: sticky; left: 0; z-index: 2` (첫 컬럼) + `position: sticky; top: 0; z-index: 3` (헤더 행)
- 둘이 겹치는 좌상단 셀은 z-index: 4

### 4.3 localStorage 영속 (R18)
- **참고**: [src/components/views/UnifiedGridView.jsx:38-48](../../src/components/views/UnifiedGridView.jsx#L38-L48) (`teamMatrixGroupByOwner`)
- **참고**: useStore.js의 `collapseState` + `_saveCollapseState` debounce 패턴 → Supabase 동기화까지 됨
- **권장**: 펼침 상태는 useStore의 `collapseState['matrixPivot']` 키로 저장 (기존 인프라 재사용)

### 4.4 카운트 + Pill 색상 (R13)
- **참고**: [src/components/views/grid/cells/MilestoneRow.jsx](../../src/components/views/grid/cells/MilestoneRow.jsx) alive/total 배지 (bg `#E8E6DD`, fontSize 10)
- **참고**: [src/components/views/grid/shared/Pill.jsx](../../src/components/views/grid/shared/Pill.jsx) (18줄)
- **신규 토큰** [src/styles/designTokens.js](../../src/styles/designTokens.js)에 추가:
  ```js
  amberPill: { bg: '#fef3c7', fg: '#92400e' }   // 5+
  coralPill: { bg: '#fee2e2', fg: '#991b1b' }   // 10+
  ```

### 4.5 Primary/Secondary 표시 (R04/R05)
- **참고**: [src/components/shared/StackedAvatar.jsx](../../src/components/shared/StackedAvatar.jsx), [DualAssigneeSelector.jsx](../../src/components/shared/DualAssigneeSelector.jsx)
- **PivotTaskCell**에서:
  - `task.assigneeId === memberId` → Primary 셀, `color: COLOR.textPrimary, fontWeight: 500`
  - `task.secondaryAssigneeId === memberId` → Secondary 셀, `color: COLOR.textTertiary, fontWeight: 400`
  - 같은 task가 두 멤버 셀에 동시 등장 (의도된 중복)

### 4.6 카운트 집계 (R06: Primary만)
- **참고**: [src/utils/milestoneProgress.js:computeMilestoneCount](../../src/utils/milestoneProgress.js)
- **신규**: `computePivotCount(tasks, projectId, memberId)` = `tasks.filter(t => t.projectId===projectId && t.assigneeId===memberId && !t.done).length`

### 4.7 1:1 MS+task 자동 정리 (R23)
- **로직**:
  ```js
  for (const ms of milestones) {
    const tasks = allTasks.filter(t => t.keyMilestoneId === ms.id)
    if (tasks.length === 1) {
      await updateTask(tasks[0].id, { keyMilestoneId: null })
      await deleteMilestone(ms.id)
    }
  }
  ```
- **실행 전략**:
  - **DB migration**: 일회성 SQL로 처리 (배포 시 자동 실행, 안전)
  - **앱 부팅 시 1회 실행**: localStorage flag로 idempotency 보장 (rollback 안전)
  - **권장**: SQL migration — 모든 사용자에 일관 적용, 클라이언트 코드 무관

### 4.8 익명 sub-row (R24)
- **참고**: [src/components/views/grid/cells/MilestoneRow.jsx](../../src/components/views/grid/cells/MilestoneRow.jsx)와 동일 셸
- 헤더 텍스트 자리만 비움 (`null` 또는 `' '`)
- 시각적 구분: 좌측 indent + 하단 divider만 (라벨 없이)

---

## 5. 위험 요소 / 사전 확인 사항

### 5.1 데이터 위험

| # | 위험 | 영향도 | 완화 |
|---|------|--------|------|
| D1 | parent_id NULL 평탄화 후 기존 트리 정보 손실 → rollback 불가 | 중 | 마이그레이션 전 `key_milestones` 백업 (Supabase dashboard에서 export). spec §7.1에 따라 "L1만 사용 중이면 영향 없음"이라 가정 — **사전 확인 필요**: 현재 DB에 parent_id 값이 있는 MS가 몇 건인지 |
| D2 | 1:1 MS 자동 정리 시 사용자가 의도적으로 만든 "1개짜리 MS"까지 삭제 | 중 | 정리 대상에서 제외할 조건 검토 (예: MS에 description/start_date/end_date가 있으면 보존). spec R23 "자동 정리"의 정확한 정의 필요 |
| D3 | 백로그 사이드바 삭제로 기존 사용자가 백로그 task 접근 경로 상실 | 중 | 피벗 테이블의 "프로젝트 직속 sub-row"가 동일 역할 수행. 펼침 상태 기본값을 "프로젝트 1개라도 직속 task가 있으면 자동 펼침"으로 할지 검토 |

### 5.2 코드 위험

| # | 위험 | 완화 |
|---|------|------|
| C1 | `milestoneTree.js`의 트리 함수가 매트릭스 외부에서 사용 중일 가능성 | 사용처 grep 후 호출자별 영향 분석. ProjectView 내부에서 쓴다면 그 곳도 평탄화 필요 |
| C2 | `MsBacklogSidebar` 삭제 시 import 깨짐 | UnifiedGridView 외 다른 import 사용처 grep |
| C3 | UnifiedGridView 분기에서 sidebar 영역 layout이 깨질 가능성 | sidebar 영역의 width(가변/고정) 처리 검토. spec §4.1: main이 100% 폭 사용 |
| C4 | DnD ID 체계 변경: 백로그 (`bl-ms:`, `bl-task:`)는 사라지지만 `cell-task:`, `cell-ms:` 등은 유지 | DragOverlay와 sensors 로직은 그대로. drop 대상 정의만 PivotMatrixTable에 맞게 재구성 |
| C5 | `getCachedUserId` 동기 호출에 의존하는 카운트 로직 | 부팅 시 이미 캐시되어 있으므로 영향 없을 것으로 예상 |

### 5.3 UX 위험

| # | 위험 | 완화 |
|---|------|------|
| U1 | 멤버 5명 + 프로젝트 20개 = 100셀+ → 가로 스크롤 빈번 | sticky 첫 컬럼/헤더 필수(R15). 멤버 컬럼 minimum width 115px, 적정값 검증 |
| U2 | 빈 셀 다수 → 시각적 노이즈 | `·` (text-tertiary) 중앙 정렬로 통일(R14), 빈 셀 hover 시 + 추가 노출(인터랙션 §4.4) |
| U3 | Primary task가 Secondary 셀에도 표시되는 중복으로 멘탈 모델 혼란 | weight/color 차이로 명확히 구분(R04/R05). Tooltip 또는 가이드 1회 표시 검토 |
| U4 | inline 편집 시 셀 폭 좁아 input이 비좁음 | 편집 모드 진입 시 셀 내부 input이 cell width 100% 차지. 한국어 keep-all 줄바꿈으로 기본 표시는 유지 |
| U5 | "라벨 없음" 익명 sub-row → 사용자가 "이게 뭐지?" 인식 못 할 수 있음 | 좌측 chevron + indent + 빈 헤더 영역으로 시각 단서 제공. 첫 출시 후 사용자 피드백 모니터 |

### 5.4 사전 확인 필요 (Recon 후 spec/diff 작성 전)

1. **현 DB의 parent_id 사용 실태**: `SELECT count(*) FROM key_milestones WHERE parent_id IS NOT NULL` 결과 확인
2. **1:1 MS+task 쌍 개수**: `SELECT count(*) FROM (SELECT key_milestone_id, count(*) c FROM tasks WHERE key_milestone_id IS NOT NULL GROUP BY key_milestone_id HAVING count(*)=1) sub`
3. **`milestoneTree.js` 함수별 호출자 grep**: 매트릭스 외부 사용처 식별
4. **`MsBacklogSidebar` import 사용처**: UnifiedGridView 외에 있는지
5. **개인 매트릭스의 운명**: spec R21에서 "별도 phase"라 했으나 본 phase 작업 후 Personal과 Team의 시각적 일관성 임시 깨짐 — 사용자 양해 필요
6. **`BacklogPanel.jsx` (project view 내)**: 매트릭스와 다른 곳이지만 "백로그" 명칭이라 본 phase 범위인지 확인
7. **`DepthToggle` import 사용처**: 매트릭스 외에 있는지

---

## 6. Recon 결론 (요약)

- **추천 옵션**: A (TeamMatrixGrid wrapper + PivotMatrixTable 신규)
- **신규 5개 컴포넌트** + **삭제 3개** + **수정 5개** + **DDL 2개**
- **재사용 가능 패턴**: ProjectLaneCard의 inline 편집, MilestoneRow 셀 셸, useStore.collapseState 영속, designTokens 토큰 시스템
- **최대 위험**: D1 (parent_id 평탄화), D2 (1:1 자동 정리 오삭제). 두 가지 모두 사전 DB 쿼리로 영향 규모 확인 가능
- **개인 매트릭스(R21)는 본 phase 범위 밖** — 일관성 깨지는 임시 상태 발생, spec/diff에서 명시 필요

---

**Recon 완료. 다음 단계: `/spec matrix-redesign`로 요구사항을 확정하세요.**
