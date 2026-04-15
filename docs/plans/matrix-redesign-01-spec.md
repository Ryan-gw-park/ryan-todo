# Loop 41 — 기반 정리 (Foundation Cleanup)

> **Phase**: Matrix Redesign Foundation
> **Status**: Confirmed — 2026-04-15
> **Depends on**: 없음 (가장 먼저 진행)
> **Blocks**: Loop 42, Loop 43
> **Related docs**: matrix-redesign-spec.md (원본 통합 spec)

---

## 0. 목적

MS 구조를 L1 flat으로 평탄화하고, 1:1 MS+task 중복을 정리한다. DepthToggle 등 무한 depth 전제로 만들어진 컴포넌트를 삭제한다.

이 Loop는 **backend 중심**으로, 사용자에게 보이는 UI 변화는 거의 없다. 다음 Loop들의 안전한 기반.

---

## 1. Scope

### 포함
- MS `parent_id` 평탄화 SQL migration
- 1:1 MS+task 쌍 자동 정리 SQL migration
- `DepthToggle` 컴포넌트 삭제 (DELETE-5)
- `milestoneTree.js` 트리 함수 deprecate (사용처 grep 후 미사용 함수 제거)
- `milestoneProgress.js`의 `computeMilestoneCountRecursive` 제거
- `useStore.js`의 `moveMilestone`/`cascadeMilestoneOwner`의 parent 관련 로직 단순화

### 제외 (다른 Loop)
- 매트릭스 피벗 뷰 → Loop 42
- 백로그 사이드바 제거 → Loop 42 (매트릭스 영역이므로)
- BacklogPanel 명칭 재정의 → Loop 43
- MsTaskTreeMode 평탄화 → Loop 43
- "상위 MS 선택" UI 제거 → Loop 43

---

## 2. REQ-LOCK 요구사항

| ID | 요구사항 | 상태 |
|----|---------|------|
| L41-R01 | `key_milestones.parent_id`를 모두 NULL로 평탄화 | confirmed |
| L41-R02 | 1:1 MS+task 쌍 자동 정리: MS 삭제, task의 `key_milestone_id` NULL로 | confirmed |
| L41-R03 | 1:1 정리: 무조건 모두 정리 (메타/owner 보존 조건 없음) | confirmed |
| L41-R04 | 정리 실행: SQL migration (supabase/migrations에 일회성 DDL) | confirmed |
| L41-R05 | 마이그레이션 전 `key_milestones` 테이블 백업 (Supabase dashboard export) | confirmed |
| L41-R06 | `DepthToggle` 컴포넌트 파일 삭제 + 모든 import/사용처 제거 (DELETE-5) | confirmed |
| L41-R07 | `milestoneTree.js`의 트리 순회 함수 (`computeDepth`, `getNodePath`, `getMsPath`, `flattenTree*`, `countTasksRecursive` 등): 사용처 grep 후 미사용 함수 삭제. 파일 자체는 유지 (rollback 안전) | confirmed |
| L41-R08 | `milestoneProgress.js`의 `computeMilestoneCountRecursive` 삭제. `computeMilestoneCount`만 유지 | confirmed |
| L41-R09 | `useStore.js`의 `moveMilestone`: parent 변경 로직 제거. 다른 프로젝트로 이동만 유지 | confirmed |
| L41-R10 | `useStore.js`의 `cascadeMilestoneOwner`: parent 기반 cascade 제거 (MS가 flat이므로 단일 MS만 처리) | confirmed |

---

## 3. SQL Migrations

### 3.1 parent_id 평탄화

**파일**: `supabase/migrations/2026XXXX_ms_flatten_parent_id.sql`

```sql
-- MS parent_id 평탄화 — L1 flat 정책 적용
-- 기존 L2+ MS는 L1으로 승격됨
-- Rollback: parent_id 값 복구 불가. 마이그레이션 전 백업 필수.

BEGIN;

UPDATE key_milestones
SET parent_id = NULL, updated_at = NOW()
WHERE parent_id IS NOT NULL;

COMMIT;
```

**리스크**: 낮음. 데이터 손실 없음 (parent_id 값만 NULL로 변경).

**사전 확인**: 마이그레이션 전 아래 쿼리로 영향 규모 확인.
```sql
SELECT COUNT(*) FROM key_milestones WHERE parent_id IS NOT NULL;
```

### 3.2 1:1 MS+task 자동 정리

**파일**: `supabase/migrations/2026XXXX_cleanup_1to1_milestones.sql`

```sql
-- 1:1 MS+task 쌍 정리 — MS 삭제, task만 남김
-- 무조건 모두 정리 (R03)
-- Rollback: MS 삭제는 비가역. 마이그레이션 전 key_milestones 백업 필수 (R05)

BEGIN;

-- 1. 1:1 MS ID를 temp table에 기록 (UPDATE 전에)
CREATE TEMP TABLE _1to1_ms_ids ON COMMIT DROP AS
SELECT key_milestone_id AS ms_id
FROM tasks
WHERE key_milestone_id IS NOT NULL
  AND deleted_at IS NULL
GROUP BY key_milestone_id
HAVING COUNT(*) = 1;

-- 2. 해당 task의 key_milestone_id 해제
UPDATE tasks
SET key_milestone_id = NULL, updated_at = NOW()
WHERE key_milestone_id IN (SELECT ms_id FROM _1to1_ms_ids);

-- 3. 해당 MS 삭제 (temp table 기준이므로 원래 빈 MS는 안 건드림)
DELETE FROM key_milestones
WHERE id IN (SELECT ms_id FROM _1to1_ms_ids);

COMMIT;
```

**리스크**: 중. MS 삭제는 비가역. 백업 필수.

**사전 확인**:
```sql
-- 정리 대상 MS 개수
SELECT COUNT(*) FROM (
  SELECT key_milestone_id
  FROM tasks
  WHERE key_milestone_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY key_milestone_id
  HAVING COUNT(*) = 1
) sub;
```

### 3.3 실행 순서

1. `key_milestones` 전체 export (Supabase dashboard)
2. 3.1 parent_id 평탄화 실행
3. 3.2 1:1 정리 실행
4. 결과 검증: `SELECT COUNT(*) FROM key_milestones WHERE parent_id IS NOT NULL` → 0건이어야 함

---

## 4. 컴포넌트 삭제

### 4.1 DepthToggle (DELETE-5 적용 필요)

**대상 파일**: `src/components/shared/DepthToggle.jsx` (38줄)

**삭제 사유**: MS L1 flat 고정으로 depth 토글 무의미.

**DELETE-5 grep 대상**:
```bash
grep -rn 'DepthToggle' src/
grep -rn "from.*DepthToggle" src/
```

**예상 사용처**: 매트릭스 뷰 toolbar. 기타 사용처가 있다면 별도 검토.

**diff 작성 시 DELETE-5 검증 테이블 필수.**

---

## 5. 코드 단순화 (Modify)

### 5.1 milestoneTree.js 정리

**파일**: `src/utils/milestoneTree.js` (309줄)

**검토 대상 함수**:
- `buildTree`, `computeDepth`, `getProjectMaxDepth`
- `getNodePath`, `getMsPath`
- `flattenTree`, `flattenTreeWithTasks`
- `countTasksRecursive`
- `flattenVisibleNodes`
- `expandAll`, `collapseAll`

**처리 방침**:
1. 각 함수의 사용처 grep
2. **사용처가 0건인 함수**: 삭제
3. **사용처가 매트릭스 외 ProjectView (MsTaskTreeMode 등)에서 쓰이는 경우**: **Loop 41에서는 삭제 보류**. Loop 43에서 ProjectView 평탄화하며 호출 제거 후, 그 다음 삭제
4. 파일 자체는 유지 (rollback 안전)

**⚠️ 기대치 조정**: Loop 41 시점에서 MsTaskTreeMode가 `buildTree`, `flattenTree*`, `computeDepth` 등을 여전히 호출할 가능성이 높음. 따라서 **Loop 41에서 실제로 삭제되는 함수는 소수**일 수 있음. 이 경우 Loop 41은 "parent_id 평탄화 + 1:1 정리 + DepthToggle 삭제"만 확실히 완료하고, 트리 함수 대량 정리는 Loop 43 이후로 자연 이관된다. diff-plan 단계에서 grep 결과에 따라 Loop 41 vs Loop 43 범위 재조정 가능.

### 5.2 milestoneProgress.js 단순화

**파일**: `src/utils/milestoneProgress.js` (29줄)

**제거**: `computeMilestoneCountRecursive`
**유지**: `computeMilestoneCount`

이유: MS가 flat이므로 재귀 카운트 불필요.

### 5.3 useStore.js 정리

**파일**: `src/hooks/useStore.js`

**`moveMilestone`**:
- parent 변경 로직 제거
- 다른 프로젝트로 이동 시나리오만 유지 (project_id 변경)

**`cascadeMilestoneOwner`**:
- parent → children cascade 로직 제거
- 단일 MS의 owner 변경만 처리

**시그니처 보존**: 메모리의 architectural constraint에 따라 `updateTask(id, patch)` 시그니처는 변경 금지. milestone 관련 함수도 가능한 한 시그니처 보존하고 내부 로직만 단순화.

---

## 6. 사전 확인 체크리스트 (diff 작성 전 필수)

| # | 확인 항목 | 방법 |
|---|----------|------|
| 1 | 현 DB의 `parent_id` 사용 실태 | `SELECT count(*) FROM key_milestones WHERE parent_id IS NOT NULL` |
| 2 | 1:1 MS+task 쌍 개수 | §3.2 사전 확인 쿼리 |
| 3 | `milestoneTree.js` 함수별 호출자 | `grep -rn '함수명' src/` |
| 4 | `DepthToggle` import 사용처 | `grep -rn 'DepthToggle' src/` |
| 5 | `key_milestones` 테이블 백업 | Supabase dashboard에서 CSV export |

---

## 7. 성공 기준 (Acceptance Criteria)

- [ ] SQL migration 2개 파일이 supabase/migrations에 생성됨
- [ ] **검증 A** — parent_id 평탄화: 아래 쿼리 결과 = 0
  ```sql
  SELECT count(*) FROM key_milestones WHERE parent_id IS NOT NULL;
  ```
- [ ] **검증 B** — 1:1 MS 정리: 아래 쿼리 결과 = 0
  ```sql
  SELECT count(*) FROM (
    SELECT key_milestone_id
    FROM tasks
    WHERE key_milestone_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY key_milestone_id
    HAVING count(*) = 1
  ) sub;
  ```
- [ ] **검증 C** — task-less MS 존재 확인 (의도적 빈 MS는 허용, 참고용):
  ```sql
  SELECT count(*) FROM key_milestones km
  WHERE NOT EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.key_milestone_id = km.id AND t.deleted_at IS NULL
  );
  ```
  → 마이그레이션 전후 동일하거나 증가(0개 task MS는 건드리지 않음). 감소하면 안 됨.
- [ ] `DepthToggle.jsx` 파일 삭제됨
- [ ] DELETE-5 검증 테이블이 diff 문서에 포함됨
- [ ] `milestoneProgress.js`에 `computeMilestoneCountRecursive` 함수 없음
- [ ] 빌드 성공 (npm run build)
- [ ] 기존 매트릭스 뷰가 여전히 동작 (3×3 그리드, 사용자 시각 변화 없음 — Loop 42에서 교체 예정)

---

## 8. Rollback 계획

### Phase 41-1 SQL (parent_id 평탄화) Rollback
- 백업한 key_milestones CSV에서 parent_id 컬럼 복원
- 또는: 새 parent_id를 알 수 없으므로 영구 손실 → 앱 동작에는 영향 없음 (이미 L1만 사용)

### Phase 41-2 SQL (1:1 정리) Rollback
- 백업한 CSV에서 삭제된 MS 복원
- 백업한 tasks CSV에서 key_milestone_id 복원

### 코드 변경 Rollback
- git revert

---

## 9. 후속 Loop 영향

- **Loop 42**: 본 Loop 완료 시점에 MS는 flat 상태. PivotMatrixTable이 트리 순회 없이 단순 GROUP BY로 작업 가능
- **Loop 43**: 본 Loop 완료 시점에 1:1 MS가 사라졌으므로, ProjectView의 MS 리스트가 자연스럽게 짧아짐. 사용자가 변화를 인지할 가능성 있음
