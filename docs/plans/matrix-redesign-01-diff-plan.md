# Loop 41 — 기반 정리 Diff Plan

> **Phase**: Matrix Redesign Foundation
> **Spec**: [matrix-redesign-01-spec.md](./matrix-redesign-01-spec.md)
> **Date**: 2026-04-15
> **Depends on**: 없음
> **Blocks**: Loop 42, Loop 43

---

## 0. 사전 조사 결과 (spec에서 가정한 것과 차이)

| Spec 가정 | 실제 조사 결과 | 조치 |
|----------|---------------|------|
| DepthToggle는 매트릭스 toolbar 사용 | **TimelineFilters.jsx:1,48**만 사용 — 매트릭스 무관 | 삭제 시 TimelineFilters 분기 고려 (depth 필터 유지? 제거?) |
| milestoneTree 함수들을 Loop 41에서 대부분 정리 | 9개 파일에서 import 중. 대부분 ProjectView/Timeline. 매트릭스에선 CellContent.jsx만 `getMsPath` 사용 | 본 Loop에선 **사용처 0인 함수만** 삭제. 나머지는 Loop 43 이후 이관 (spec §5.1 기대치 조정 반영) |
| `getProjectMaxDepth` 함수명 | 실제 파일엔 `getMaxDepth`(37줄)와 `getProjectMaxDepth`(285줄) 둘 다 존재 | 실제 함수명 사용 |
| `computeMilestoneCountRecursive` | 실제 파일 `milestoneProgress.js`에 존재 확인 필요 | diff 실행 시 재확인 |

---

## 1. 변경할 파일 목록

### 1.1 DB Migration (신규 2개)

| 파일 (신규) | 내용 |
|------------|------|
| `supabase/migrations/20260415000000_ms_flatten_parent_id.sql` | `parent_id`를 NULL로 일괄 업데이트 |
| `supabase/migrations/20260415000001_cleanup_1to1_milestones.sql` | 1:1 MS+task 쌍 정리 (MS 삭제, task.key_milestone_id=null) |

### 1.2 코드 삭제

| 파일 | 변경 |
|------|------|
| [src/components/shared/DepthToggle.jsx](../../src/components/shared/DepthToggle.jsx) (38줄) | **파일 삭제** |
| [src/components/timeline/TimelineFilters.jsx](../../src/components/timeline/TimelineFilters.jsx):1,48 | DepthToggle import/렌더 제거. `depth` prop 체인 grep 후 dead code 정리 (DELETE-5) |

### 1.3 코드 수정 (단순화)

| 파일 | 변경 내용 | 예상 줄번호 |
|------|----------|------------|
| [src/utils/milestoneProgress.js](../../src/utils/milestoneProgress.js) | `computeMilestoneCountRecursive` 함수 삭제. `computeMilestoneCount`만 유지. 사용처 grep 후 호출부가 있으면 `computeMilestoneCount`로 대체 | 파일 전체 29줄 → ~15줄 |
| [src/utils/milestoneTree.js](../../src/utils/milestoneTree.js) | **사용처 0인 함수만 삭제**. 현재 사용 중인 함수들 (아래 4.1 참조)은 Loop 43까지 보류 | 309줄 → 가변 |
| [src/hooks/useStore.js](../../src/hooks/useStore.js):1226-1280 `moveMilestone` | `parent_id` 변경 로직 제거. `newParentId` 인자는 유지하되 내부에서 무시(always null 처리). depth 계산 제거. project_id 변경 시나리오만 유지 (`moveMilestoneWithTasks`는 이미 별도 함수로 존재) | 1226줄~ |
| [src/hooks/useStore.js](../../src/hooks/useStore.js):1090+ `cascadeMilestoneOwner` | parent→children 재귀 cascade 제거. 단일 MS owner 변경만 처리. `ownerType: 'primary' \| 'secondary'` 분기는 유지 | 1090줄~ |
| [src/hooks/useStore.js](../../src/hooks/useStore.js):926+ `addMilestoneInProject` | `opts.parentId` 무시 (deprecated 주석 추가). `parent_id: null` 강제 INSERT | 926줄~ |
| [src/hooks/useStore.js](../../src/hooks/useStore.js):1182+ `deleteMilestone` | 하위 MS CASCADE 삭제 로직 제거 (flat이므로 불필요). 해당 MS의 task keyMilestoneId=null로 업데이트는 유지 | 1182줄~ |

### 1.4 변경 없음 (유지)

- `tasks` 테이블 schema
- `key_milestones` 테이블 컬럼 (parent_id/depth 컬럼은 유지, 값만 NULL로)
- `mapTask`, `taskToRow`, `mapMilestone`
- applyTransitionRules
- 매트릭스 뷰 (3×3 그리드 유지 — Loop 42에서 교체)

---

## 2. DB 마이그레이션 SQL (최종안)

### 2.1 `supabase/migrations/20260415000000_ms_flatten_parent_id.sql`

```sql
-- Loop 41-1: MS parent_id 평탄화
-- 기존 L2+ MS를 L1으로 승격. parent_id 컬럼 유지, 값만 NULL.
-- Rollback: parent_id 값 복구 불가. 실행 전 key_milestones 테이블 CSV export 필수.

BEGIN;

-- 영향 규모 로깅 (실행 결과는 마이그레이션 log에 기록)
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM key_milestones WHERE parent_id IS NOT NULL;
  RAISE NOTICE '[Loop41-1] parent_id NOT NULL 레코드 수: %', cnt;
END $$;

-- 평탄화
UPDATE key_milestones
SET parent_id = NULL,
    updated_at = NOW()
WHERE parent_id IS NOT NULL;

COMMIT;
```

### 2.2 `supabase/migrations/20260415000001_cleanup_1to1_milestones.sql`

```sql
-- Loop 41-2: 1:1 MS+task 자동 정리
-- 무조건 모두 정리 (보존 조건 없음)
-- Rollback: MS 삭제 비가역. 실행 전 key_milestones + tasks 테이블 CSV export 필수.

BEGIN;

-- 1. 1:1 MS ID 임시 저장
CREATE TEMP TABLE _1to1_ms_ids ON COMMIT DROP AS
SELECT key_milestone_id AS ms_id
FROM tasks
WHERE key_milestone_id IS NOT NULL
  AND deleted_at IS NULL
GROUP BY key_milestone_id
HAVING COUNT(*) = 1;

-- 로깅
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM _1to1_ms_ids;
  RAISE NOTICE '[Loop41-2] 1:1 정리 대상 MS 수: %', cnt;
END $$;

-- 2. 해당 task의 keyMilestoneId 해제
UPDATE tasks
SET key_milestone_id = NULL,
    updated_at = NOW()
WHERE key_milestone_id IN (SELECT ms_id FROM _1to1_ms_ids);

-- 3. 해당 MS 삭제
DELETE FROM key_milestones
WHERE id IN (SELECT ms_id FROM _1to1_ms_ids);

COMMIT;
```

### 2.3 사전 백업 (마이그레이션 전 필수)

Supabase Dashboard → Table Editor → `key_milestones` CSV export, `tasks` CSV export.
파일명: `backup_key_milestones_2026-04-15.csv`, `backup_tasks_2026-04-15.csv`.

---

## 3. API 변경

**없음.** 본 Loop는 DB migration + 내부 store 로직 단순화만. 외부 API/컴포넌트 인터페이스는 불변.

---

## 4. 프론트엔드 변경

### 4.1 milestoneTree.js 함수별 처리 방침

| 함수 | 현 사용처 | 처리 |
|------|----------|------|
| `buildTree` | InlineTimelineView.jsx:8, UnifiedProjectView.jsx:6 | **보류** (Loop 43 이후) |
| `getMaxDepth` (37줄) | 사용처 0 추정 — grep 재확인 | **삭제** |
| `collectLeaves` (52줄) | ProjectTaskPanel.jsx:3 | 보류 |
| `countTasksRecursive` (70줄) | HierarchicalTree.jsx:6, MsTaskListMode.jsx:4, ProjectTaskPanel.jsx:3 | 보류. 단, flat이므로 재귀 불필요 → 내부 구현을 단일 GROUP BY로 단순화 검토 (선택) |
| `flattenTree` (95줄) | HierarchicalTree.jsx:6 | 보류 |
| `flattenTreeWithTasks` (126줄) | 사용처 0 추정 | **삭제** |
| `getNodePath` (171줄) | ProjectTaskPanel.jsx:3 | 보류 |
| `flattenVisibleNodes` (185줄) | 사용처 0 추정 | **삭제** |
| `expandAll` (212줄) | 사용처 0 추정 | **삭제** |
| `computeGroupSpan` (229줄) | 사용처 0 추정 | **삭제** |
| `getMsPath` (248줄) | CompactMsRow.jsx:7, CellContent.jsx:6 | 보류 |
| `computeDepth` (267줄) | MsBacklogSidebar.jsx:6, CompactMilestoneRow.jsx:8 | MsBacklogSidebar는 Loop 42에서 삭제. 그 후에도 CompactMilestoneRow가 쓰므로 보류 |
| `getProjectMaxDepth` (285줄) | MsBacklogSidebar.jsx:6 | MsBacklogSidebar 삭제 후 사용처 0 → Loop 42 완료 시점에 삭제 가능. **본 Loop에선 보류** |
| `getVisibleMs` (303줄) | 사용처 0 추정 | **삭제** |

**diff 실행 시 검증**: 각 "삭제" 표시 함수마다 `grep -rn '함수명' src/ --include='*.jsx' --include='*.js'` 실행 후 0건 확인.

### 4.2 DepthToggle 삭제

- [src/components/shared/DepthToggle.jsx](../../src/components/shared/DepthToggle.jsx) 파일 삭제
- [src/components/timeline/TimelineFilters.jsx:1](../../src/components/timeline/TimelineFilters.jsx#L1) import 제거
- [src/components/timeline/TimelineFilters.jsx:48](../../src/components/timeline/TimelineFilters.jsx#L48) JSX 제거
- TimelineFilters의 `depth`, `onDepthChange` props grep → 호출자(Timeline 부모 컴포넌트)에서 prop 전달 제거

### 4.3 DELETE-5 검증 테이블

diff 실행 결과 문서에 아래 표 필수 포함:

| 대상 | 파일 위치 | Import 제거 | JSX 제거 | Prop 체인 정리 | 파일 삭제 | 검증 grep |
|------|----------|------------|---------|---------------|----------|----------|
| DepthToggle | shared/DepthToggle.jsx | TimelineFilters.jsx:1 | TimelineFilters.jsx:48 | TimelineFilters `depth`/`onDepthChange`, 상위 prop drill | ✓ | `grep -rn 'DepthToggle\|onDepthChange' src/` |
| milestoneTree.flattenTreeWithTasks | utils/milestoneTree.js | - | - | - | 함수만 제거 | `grep -rn 'flattenTreeWithTasks' src/` |
| milestoneTree.getMaxDepth | 동일 | - | - | - | 함수만 제거 | `grep -rn 'getMaxDepth' src/` |
| milestoneTree.flattenVisibleNodes | 동일 | - | - | - | 함수만 제거 | `grep -rn 'flattenVisibleNodes' src/` |
| milestoneTree.expandAll | 동일 | - | - | - | 함수만 제거 | `grep -rn 'expandAll' src/` |
| milestoneTree.computeGroupSpan | 동일 | - | - | - | 함수만 제거 | `grep -rn 'computeGroupSpan' src/` |
| milestoneTree.getVisibleMs | 동일 | - | - | - | 함수만 제거 | `grep -rn 'getVisibleMs' src/` |
| milestoneProgress.computeMilestoneCountRecursive | utils/milestoneProgress.js | 호출자 grep | - | - | 함수만 제거 | `grep -rn 'computeMilestoneCountRecursive' src/` |

---

## 5. 작업 순서 (의존성 고려)

1. **사전 백업**: Supabase dashboard에서 key_milestones + tasks CSV export
2. **사전 검증 쿼리 실행**: spec §6 체크리스트 5개 쿼리 실행 결과 기록 (마이그레이션 효과 측정용)
3. **milestoneTree.js grep & 삭제**: 표 4.1 "삭제" 함수 7개 각각 grep 0건 확인 후 제거
4. **milestoneProgress.js 정리**: `computeMilestoneCountRecursive` 제거
5. **useStore.js 단순화**: moveMilestone, cascadeMilestoneOwner, addMilestoneInProject, deleteMilestone (순서대로)
6. **DepthToggle 제거**: TimelineFilters.jsx import/JSX 제거 → DepthToggle.jsx 파일 삭제 → prop drill 정리
7. **로컬 빌드 확인**: `npm run build` 통과
8. **마이그레이션 실행**: `20260415000000` → `20260415000001` 순서
9. **검증 쿼리 실행**: spec §7 성공기준 A/B/C
10. **매트릭스 뷰 동작 확인**: 3×3 그리드가 여전히 정상 작동 (사용자 시각 변화 없음)

---

## 6. 검증 절차

### 6.1 빌드 검증
- `npm run build` — TDZ 에러 없이 성공

### 6.2 런타임 검증
- 기존 매트릭스 뷰 열기 → 3×3 그리드 정상 렌더 (사용자 시각 변화 없음)
- 기존 ProjectView 열기 → MsTaskTreeMode, BacklogPanel 정상 (Loop 43 전이므로 "백로그" 여전히 노출)
- Timeline 열기 → DepthToggle 제거되었으나 나머지 기능 정상

### 6.3 DB 검증 (spec §7 A/B/C)
```sql
-- A: parent_id = 0
SELECT count(*) FROM key_milestones WHERE parent_id IS NOT NULL;

-- B: 1:1 MS = 0
SELECT count(*) FROM (
  SELECT key_milestone_id FROM tasks
  WHERE key_milestone_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY key_milestone_id HAVING count(*) = 1
) sub;

-- C: task 없는 MS는 유지 (사전 count와 비교하여 감소 없어야 함)
SELECT count(*) FROM key_milestones km
WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.key_milestone_id = km.id AND t.deleted_at IS NULL);
```

### 6.4 DELETE-5 검증
- 위 4.3 표의 모든 grep 명령이 0건 결과

---

## 7. Rollback 계획

| 변경 | Rollback 방법 |
|------|--------------|
| SQL migration | 백업 CSV에서 `key_milestones.parent_id` + 삭제된 MS 행 복원. task.key_milestone_id도 복원. |
| 코드 변경 | `git revert` |
| DepthToggle | git에서 파일 복원 + import/JSX 복원 |

---

## 8. REQ-LOCK 커버리지 (Loop 41 spec §2 검증)

| ID | 요구사항 | diff 반영 위치 |
|----|---------|---------------|
| L41-R01 | parent_id를 모두 NULL로 평탄화 | §2.1 migration |
| L41-R02 | 1:1 MS+task 쌍 자동 정리 | §2.2 migration |
| L41-R03 | 무조건 모두 정리 (보존 조건 없음) | §2.2 `HAVING COUNT(*) = 1`만 조건 |
| L41-R04 | SQL migration으로 실행 | §2.1, §2.2 |
| L41-R05 | key_milestones 백업 (Supabase export) | §2.3, §5.1 |
| L41-R06 | DepthToggle 파일 삭제 + 모든 import/사용처 제거 | §4.2 |
| L41-R07 | milestoneTree.js 미사용 함수 삭제 (파일 유지) | §4.1 (보류 함수 명시, 실제 삭제는 사용처 0 함수만) |
| L41-R08 | computeMilestoneCountRecursive 삭제 | §1.3, §4.3 표 |
| L41-R09 | moveMilestone parent 제거, 프로젝트 이동만 유지 | §1.3 |
| L41-R10 | cascadeMilestoneOwner 단일 MS만 처리 | §1.3 |

---

## 9. 알려진 리스크

| # | 리스크 | 완화 |
|---|------|------|
| R1 | DepthToggle 삭제로 Timeline의 depth 필터 기능 자체가 사라짐 → Timeline UX 퇴행 | Timeline이 L1 flat이면 depth 필터 무의미. 사용자에게 "Timeline 필터 단순화" 공지. 필요 시 후속 Loop에서 Timeline 재설계 |
| R2 | 1:1 정리로 사용자가 의도적으로 만든 단일 MS가 사라짐 | spec R25 확정: 무조건 정리. 사용자 혼란 시 CSV 백업에서 수동 복원 |
| R3 | milestoneTree 함수 대부분이 보류됨 → Loop 41 cleanup 성과 미미 | spec §5.1 기대치 조정 반영. 실질적 정리는 Loop 43 이후 |
| R4 | 마이그레이션 순서 오류 시 데이터 불일치 | migration 파일 타임스탬프 순서 준수 (20260415000000 → 20260415000001) |
