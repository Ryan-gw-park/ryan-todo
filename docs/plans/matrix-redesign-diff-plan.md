# Phase matrix-redesign — Diff Plan (마스터)

> **Date**: 2026-04-15
> **Spec (통합)**: [matrix-redesign-spec.md](./matrix-redesign-spec.md)
> **Recon**: [matrix-redesign-recon.md](./matrix-redesign-recon.md)
> **Loop 분할 Spec**: 01 / 02 / 03
> **Loop 분할 Diff Plan**: 01 / 02 / 03

---

## 0. 문서 구조

| 문서 | 역할 | 링크 |
|------|------|------|
| 통합 Spec | 전체 요구사항 R01~R31 | [matrix-redesign-spec.md](./matrix-redesign-spec.md) |
| Recon | 코드베이스 영향 분석 | [matrix-redesign-recon.md](./matrix-redesign-recon.md) |
| Loop 41 Spec | 기반 정리 (DB migration + cleanup) | [matrix-redesign-01-spec.md](./matrix-redesign-01-spec.md) |
| Loop 41 Diff Plan | 실행 계획 | [matrix-redesign-01-diff-plan.md](./matrix-redesign-01-diff-plan.md) |
| Loop 42 Spec | 피벗 뷰 구현 | [matrix-redesign-02-spec.md](./matrix-redesign-02-spec.md) |
| Loop 42 Diff Plan | 실행 계획 | [matrix-redesign-02-diff-plan.md](./matrix-redesign-02-diff-plan.md) |
| Loop 43 Spec | ProjectView 평탄화 | [matrix-redesign-03-spec.md](./matrix-redesign-03-spec.md) |
| Loop 43 Diff Plan | 실행 계획 | [matrix-redesign-03-diff-plan.md](./matrix-redesign-03-diff-plan.md) |

---

## 1. 전체 의존성 그래프

```
Loop 41 (Foundation)
  ├─ DB: parent_id 평탄화, 1:1 MS cleanup
  ├─ CODE: DepthToggle 삭제, milestoneTree 부분 정리, useStore 단순화
  └─ Blocks: Loop 42, Loop 43
        │
        ├─────────────┬─────────────┐
        ▼             ▼             ▼
    Loop 42 (Pivot)           Loop 43 (ProjectView)
    ├─ 피벗 테이블 구현       ├─ BacklogPanel 평탄화
    ├─ MsBacklogSidebar 삭제  ├─ MsTaskTreeMode 평탄화
    └─ designTokens PILL 추가 ├─ backlogFilter.js 삭제
                              └─ "백로그" 명칭 전수 제거

(Loop 42와 43은 독립 — 병렬 진행 가능)
```

---

## 2. 전체 변경 파일 목록

### 2.1 DB Migration (2개 신규)
| 파일 | Loop |
|------|------|
| `supabase/migrations/20260415000000_ms_flatten_parent_id.sql` | 41 |
| `supabase/migrations/20260415000001_cleanup_1to1_milestones.sql` | 41 |

### 2.2 코드 파일 (신규 5 / 삭제 3 / 수정 10+)

| 상태 | 파일 | Loop |
|------|------|------|
| 신규 | `src/components/views/grid/PivotMatrixTable.jsx` | 42 |
| 신규 | `src/components/views/grid/cells/PivotProjectRow.jsx` | 42 |
| 신규 | `src/components/views/grid/cells/PivotMsSubRow.jsx` | 42 |
| 신규 | `src/components/views/grid/cells/PivotTaskCell.jsx` | 42 |
| 신규 | `src/components/views/grid/cells/PivotUngroupedSubRow.jsx` | 42 |
| 삭제 | `src/components/shared/DepthToggle.jsx` | 41 |
| 삭제 | `src/components/common/MsBacklogSidebar.jsx` | 42 |
| 삭제 | `src/utils/backlogFilter.js` | 43 |
| 수정 | `src/utils/milestoneTree.js` | 41 + 43 |
| 수정 | `src/utils/milestoneProgress.js` | 41 |
| 수정 | `src/hooks/useStore.js` (moveMilestone, cascadeMilestoneOwner, addMilestoneInProject, deleteMilestone) | 41 |
| 수정 | `src/components/timeline/TimelineFilters.jsx` | 41 |
| 수정 | `src/components/views/grid/grids/TeamMatrixGrid.jsx` | 42 |
| 수정 | `src/components/views/UnifiedGridView.jsx` | 42 |
| 수정 | `src/styles/designTokens.js` | 42 |
| 수정 | `src/components/project/BacklogPanel.jsx` | 43 |
| 수정 | `src/components/project/MsTaskTreeMode.jsx` | 43 |
| 수정 | `src/components/project/CompactMilestoneRow.jsx` | 43 |
| 수정 | `src/components/project/CompactMilestoneTab.jsx` (grep) | 43 |
| 수정 | `src/components/project/KeyMilestoneTab.jsx` (grep) | 43 |

---

## 3. 실행 순서 (권장)

1. **Loop 41** 전체 실행 (DB + 코드 cleanup) — 완료 후 빌드/런타임 검증
2. **Loop 42** 실행 (피벗 뷰) — 완료 후 매트릭스 뷰 사용자 수용 테스트
3. **Loop 43** 실행 (ProjectView 평탄화) — Loop 42와 병렬 가능하나 리뷰 부하 분산 위해 순차 권장

각 Loop 완료 시점에 git commit 분리 → rollback 용이.

---

## 4. 사전 확인 체크리스트 (Loop 41 실행 전)

- [ ] Supabase dashboard에서 `key_milestones` 테이블 CSV export 완료
- [ ] Supabase dashboard에서 `tasks` 테이블 CSV export 완료
- [ ] 사전 쿼리 결과 기록:
  - [ ] `SELECT count(*) FROM key_milestones WHERE parent_id IS NOT NULL;` = ?
  - [ ] 1:1 MS 개수 (spec §3.2 쿼리) = ?
  - [ ] task-less MS 개수 (Loop 41 spec §7 검증 C) = ?
- [ ] `milestoneTree.js` 각 함수 사용처 grep 결과 문서화
- [ ] `DepthToggle` 사용처 grep (TimelineFilters 외 있는지 재확인)

---

## 5. 각 Loop Diff Plan 요약

### 5.1 Loop 41 (Foundation)
- **DB**: 2개 migration (parent_id NULL, 1:1 cleanup)
- **삭제**: DepthToggle.jsx, milestoneTree 미사용 함수, milestoneProgress.computeMilestoneCountRecursive
- **수정**: useStore.js 4개 함수 단순화, TimelineFilters.jsx depth 제거
- **위험**: parent_id 값 복구 불가 (CSV 백업 필수)
- **상세**: [matrix-redesign-01-diff-plan.md](./matrix-redesign-01-diff-plan.md)

### 5.2 Loop 42 (Pivot View)
- **신규**: 5개 컴포넌트 (PivotMatrixTable + 4 cells)
- **삭제**: MsBacklogSidebar.jsx
- **수정**: TeamMatrixGrid Wrapper 변환, UnifiedGridView 레이아웃, designTokens PILL 토큰
- **위험**: TDZ 회피, sticky 레이어링, Secondary 중복 표시 엣지
- **상세**: [matrix-redesign-02-diff-plan.md](./matrix-redesign-02-diff-plan.md)

### 5.3 Loop 43 (ProjectView Cleanup)
- **삭제**: backlogFilter.js, milestoneTree.computeDepth/getProjectMaxDepth (추가)
- **수정**: BacklogPanel 헤더 제거, MsTaskTreeMode 평탄화, CompactMilestoneRow 단순화
- **확인**: MilestoneDetailModal "상위 MS 선택" UI는 실제로 없음 → L43-R04 skip
- **상세**: [matrix-redesign-03-diff-plan.md](./matrix-redesign-03-diff-plan.md)

---

## 6. 통합 검증 (3 Loop 완료 후)

### 6.1 DB
- [ ] parent_id NOT NULL = 0
- [ ] 1:1 MS = 0
- [ ] task-less MS는 감소하지 않음

### 6.2 빌드
- [ ] `npm run build` 성공 (TDZ 에러 없음)

### 6.3 기능 회귀
- [ ] 팀 매트릭스 = 피벗 테이블 정상 렌더
- [ ] 개인 매트릭스 = 기존 그리드 정상 (R21: 별도 phase)
- [ ] 주간 플래너 정상
- [ ] ProjectView의 MS 트리는 flat
- [ ] "백로그" 사용자 노출 문자열 0건
- [ ] Timeline의 depth 필터 제거됐으나 나머지 정상

### 6.4 DELETE-5 통합 grep
```bash
grep -rn 'DepthToggle' src/                # 0건
grep -rn 'MsBacklogSidebar' src/           # 0건
grep -rn 'backlogFilter\|isBacklogTask' src/  # 0건
grep -rn 'computeMilestoneCountRecursive' src/  # 0건
grep -rn 'flattenTreeWithTasks\|getMaxDepth\|flattenVisibleNodes\|expandAll\|computeGroupSpan\|getVisibleMs' src/  # 0건
grep -rn '백로그' src/ --include='*.jsx'   # category/status enum만 (2-3건 예상)
```

---

## 7. Rollback 전략 (Phase 전체)

Loop 순서대로 git commit 분리 → 뒤에서부터 revert 가능:
- Loop 43만 revert → ProjectView 백로그 복원, 매트릭스 피벗 유지
- Loop 42+43 revert → 매트릭스 3×3 복원
- Loop 41 revert → DB 롤백 필요 (CSV 복원) + 코드 복원

DB migration은 마이그레이션 파일 삭제가 아니라 **역방향 migration 추가**로 rollback (Supabase 관행).

---

**Diff Plan 작성 완료. 다음 단계**: `/execute matrix-redesign-01`로 Loop 41부터 실행하세요.
