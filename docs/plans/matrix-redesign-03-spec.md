# Loop 43 — ProjectView 평탄화 (Project View Cleanup)

> **Phase**: ProjectView Cleanup
> **Status**: Confirmed — 2026-04-15
> **Depends on**: Loop 41 (MS L1 flat 완료)
> **Independent of**: Loop 42 (병렬 진행 가능)
> **Related docs**: matrix-redesign-spec.md, loop-41-spec.md, loop-42-spec.md

---

## 0. 목적

매트릭스 외 영역(ProjectView)에서도 "백로그" 개념과 MS 트리 indent를 정리한다. MS는 선택적 그룹으로 격하되었으므로 task 생성 시 MS 선택을 강제하지 않는다.

이 Loop는 **시스템 일관성**을 위한 polish. 기능 변화는 거의 없으나 명칭과 시각적 표현이 매트릭스 뷰와 통일된다.

---

## 1. Scope

### 포함
- `BacklogPanel.jsx` 명칭/역할 재정의 ("백로그" → "프로젝트 직속 task")
- `MsTaskTreeMode.jsx` indent 평탄화 (L1만 처리, 트리 indent 제거)
- `MilestoneDetailModal.jsx`에서 "상위 MS 선택" 옵션 제거
- `KeyMilestoneTab.jsx` / `CompactMilestoneTab.jsx`의 parent_id 의존성 정리
- Task 생성 flow에서 MS 선택을 optional로 (필수 → 선택)

### 제외
- 매트릭스 피벗 뷰 → Loop 42
- DepthToggle 삭제 → Loop 41
- DB migration → Loop 41
- 개인 매트릭스 → 별도 phase

---

## 2. REQ-LOCK 요구사항

| ID | 요구사항 | 상태 |
|----|---------|------|
| L43-R01 | `BacklogPanel.jsx` 표시 명칭 변경: **라벨 없음** (통합 spec R24 매트릭스와 일관). 기존 "백로그" 헤더 제거, chevron + indent만 유지 | confirmed |
| L43-R02 | `BacklogPanel.jsx` 컴포넌트 자체는 유지하되 내부 시각/문구 정리 | confirmed |
| L43-R03 | `MsTaskTreeMode.jsx`의 트리 indent 로직 제거. flat 리스트로 단순화 | confirmed |
| L43-R04 | `MilestoneDetailModal.jsx`에서 "상위 마일스톤 선택" UI 제거 | confirmed |
| L43-R05 | `KeyMilestoneTab.jsx` / `CompactMilestoneTab.jsx`: parent_id 의존성 grep 후 평탄화 | confirmed |
| L43-R06 | Task 생성 flow: **현 상태 확인 완료** — `InlineAdd`가 이미 `extraFields.keyMilestoneId`를 옵셔널로 처리 중. `BacklogPanel`은 `{keyMilestoneId: null}`, `MsTaskTreeMode`/`MsTaskListMode`는 `{keyMilestoneId: msId}`를 명시 전달. **코드 변경 없음, copy/라벨만 점검**. 만약 어딘가 MS 선택 필수 UI 강제 시 optional로 완화 | confirmed |
| L43-R07 | "프로젝트 직속 task"는 ProjectView에서 1등 시민. 별도 섹션이 아닌 정상 task 영역에 표시 | confirmed |
| L43-R08 | 명칭 변경: "백로그"라는 단어가 노출되는 모든 UI 문자열을 점검하고 재명명 (또는 라벨 제거) | confirmed |

---

## 3. 컴포넌트별 변경 사항

### 3.1 BacklogPanel.jsx

**파일**: `src/components/project/BacklogPanel.jsx`

**역할 변화**:
- 기존: "백로그 = 미분류 잔여물" 인식
- 신규: "프로젝트 직속 task" — 정상적인 task 영역, MS 그룹화가 안 된 task들을 표시

**변경 항목**:
1. 표시 텍스트에서 "백로그" 제거
2. 헤더 라벨: **라벨 없음** (매트릭스 뷰 R26 / 통합 spec R24 익명 sub-row와 일관). chevron + indent만, 텍스트 자리는 비움
3. 내부 로직은 유지 (`keyMilestoneId === null` 필터)
4. 컴포넌트 파일명은 유지 (rollback 안전, 향후 별도 rename 가능)

**참고**: Loop 42의 PivotUngroupedSubRow와 동일한 시각 패턴 차용 (chevron + indent + 빈 헤더).

### 3.2 MsTaskTreeMode.jsx

**파일**: `src/components/project/MsTaskTreeMode.jsx`

**변경 사항**:
1. parent_id 기반 트리 indent 로직 제거
2. 모든 MS를 동일 레벨로 렌더링 (L1 flat)
3. MS 그룹 헤더 + 하위 task 리스트 구조는 유지
4. 트리 expand/collapse는 MS 단위로만 (자식 MS 개념 없음)

**삭제 대상**:
- `getChildMilestones()` 등 트리 순회 호출
- depth 기반 indent 계산
- 재귀 렌더링

**유지**:
- MS 헤더 행
- MS 내 task 리스트
- MS expand/collapse 토글
- DnD (Loop 41에서 단순화된 moveMilestone 사용)

### 3.3 MilestoneDetailModal.jsx

**파일**: `src/components/modals/MilestoneDetailModal.jsx`

**변경 사항**:
- "상위 마일스톤 선택" 드롭다운/필드 제거
- 관련 state (`selectedParentId` 등) 제거
- 저장 시 `parent_id`를 항상 NULL로 (또는 필드 자체 미전송)

**DELETE-5 적용**: 제거되는 UI element와 관련 state/prop을 5방향 추적.

### 3.4 KeyMilestoneTab.jsx / CompactMilestoneTab.jsx

**파일**:
- `src/components/project/KeyMilestoneTab.jsx`
- `src/components/project/CompactMilestoneTab.jsx`

**조사 필요**:
```bash
grep -n 'parent_id\|parentId\|getChildren\|getAncestors\|computeDepth' \
  src/components/project/KeyMilestoneTab.jsx \
  src/components/project/CompactMilestoneTab.jsx
```

**처리**:
- parent_id 참조가 없으면 → 변경 없음
- 있으면 → 평탄화 (indent 제거, 트리 호출 제거)

### 3.5 Task 생성 flow (현상 확인 완료)

**조사 결과** (grep 2026-04-15):
- `src/components/shared/InlineAdd.jsx` (L6-17): `addTask({ text, projectId, category, startDate, dueDate, ...extraFields })` — MS 필수 강제 없음
- `src/components/project/BacklogPanel.jsx:238`: `extraFields={{ keyMilestoneId: null, assigneeId: null }}`
- `src/components/project/MsTaskTreeMode.jsx:155`: `addTask({ ..., keyMilestoneId: msId, ... })`
- `src/components/project/MsTaskListMode.jsx:67`: `keyMilestoneId: msId`
- `src/components/modals/MilestoneDetailModal.jsx:118`: MS 내부에서 task 추가 시 `keyMilestoneId: milestoneId`
- `src/components/project/KeyMilestoneTab.jsx:539`: 동일

**결론**: 현재 task 생성 flow는 **이미 MS를 optional로 처리** 중. `InlineAdd` 기본 호출 시 `keyMilestoneId`는 `undefined` → DB에서 `null`로 저장됨. 강제 UI 없음.

**코드 변경 필요 없음**. 단, 다음만 점검:
1. 만약 어딘가 "마일스톤을 선택하세요" placeholder가 필수처럼 느껴지는 문구가 있다면 "마일스톤 (선택사항)"으로 완화
2. ProjectView의 "MS 없는 task 추가" 진입점이 접근 가능한지 확인 (BacklogPanel의 InlineAdd 또는 최상위 `+ 할일` 버튼)
3. 새 피벗 뷰에서 빈 셀 hover + 생성 시 컨텍스트에 따라 `keyMilestoneId` 자동 설정 (Loop 42 L42-R23)

---

## 4. 사전 확인 체크리스트 (diff 작성 전)

| # | 확인 항목 | 방법 |
|---|----------|------|
| 1 | Loop 41 완료 여부 | parent_id NULL 검증 쿼리 |
| 2 | "백로그" 문자열 사용처 전수 조사 | `grep -rn '백로그\|backlog\|Backlog' src/` |
| 3 | `MsTaskTreeMode.jsx`의 parent_id 사용 위치 | 파일 내 grep |
| 4 | `MilestoneDetailModal.jsx`의 "상위 MS 선택" UI 위치 | 파일 내 grep `상위\|parent_id\|parentId` |
| 5 | task 생성 컴포넌트 식별 | task 추가 진입점 grep |
| 6 | KeyMilestoneTab/CompactMilestoneTab의 parent_id 사용 | 위 grep 명령 |

---

## 5. 성공 기준

- [ ] "백로그" 단어가 UI에 노출되지 않음 (또는 의도적으로 유지된 케이스만)
- [ ] BacklogPanel이 "프로젝트 직속 task" 영역으로 표시
- [ ] MsTaskTreeMode가 평탄한 MS 리스트로 렌더 (트리 indent 없음)
- [ ] MilestoneDetailModal에 "상위 MS 선택" UI 없음
- [ ] Task 생성 시 MS 선택 안 해도 정상 저장 (keyMilestoneId = null)
- [ ] MS 미선택 task가 ProjectView에 정상 표시
- [ ] DELETE-5 검증 테이블 diff 문서에 포함
- [ ] 빌드 성공
- [ ] 기존 task/MS 데이터 정상 동작 (회귀 없음)

---

## 6. Rollback 계획

- git revert로 모든 변경 되돌림
- DB 변경 없음 (Loop 41에서 처리됨)
- BacklogPanel.jsx 파일명을 유지했으므로 import 깨짐 없음

---

## 7. 후속 작업 (이번 Loop 외)

- BacklogPanel.jsx 파일명 자체를 ProjectDirectTasksPanel.jsx 등으로 rename — 별도 Loop에서 처리 가능 (DELETE-5 + 모든 import 업데이트 필요)
- 개인 매트릭스 (PersonalMatrixView) 피벗 적용 — 별도 phase
- task DnD (셀 간 이동) — 후속 Loop

---

## 8. 매트릭스 뷰와의 일관성

Loop 43 완료 시점에 시스템 전반에서 "백로그" 개념이 사라지고, MS는 선택적 그룹으로 통일된다.

| 영역 | Loop 42 후 | Loop 43 후 |
|------|------------|-----------|
| 매트릭스 뷰 | 백로그 사이드바 없음. 직속 task = 익명 sub-row | (변경 없음) |
| ProjectView | "백로그" 영역 존재. MsTaskTreeMode는 트리 indent | 직속 task 영역 (라벨 정리). MsTaskTreeMode flat |
| MS 생성 모달 | "상위 MS 선택" 옵션 존재 (no-op) | 옵션 제거 |
| Task 생성 | MS 선택 필수 | MS 선택 optional |

**Loop 43 미완료 시 영향**: 매트릭스 뷰는 새 패러다임, ProjectView는 옛 패러다임 → 일관성 깨진 임시 상태. 사용자 혼란 가능성 있으나 기능에 문제 없음.
