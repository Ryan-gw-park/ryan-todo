# 팀 매트릭스 재설계 통합 Spec

> **Phase**: Matrix Pivot Redesign + MS Architecture Simplification
> **Status**: Confirmed — 2026-04-15
> **Scope**: TeamMatrixView, PersonalMatrixView, MS 구조, 백로그 개념

---

## 1. 목적

매트릭스 뷰의 원래 의도를 복원한다:
- **가로축 = 팀원, 세로축 = 프로젝트**
- 각 셀에서 "이 프로젝트에서 이 사람이 뭘 하고 있는지"를 즉시 파악

동시에 MS(마일스톤) 구조를 단순화하여 1:1 중복 문제를 해소한다.

---

## 2. 확정 사항 요약

| 항목 | 결정 |
|------|------|
| 매트릭스 축 | rows = 프로젝트, cols = 팀원 (피벗 테이블) |
| 접힌 행 | 멤버별 task 카운트 표시 |
| 펼친 행 | MS sub-row + 프로젝트 직속 task sub-row, 각 셀에 실제 task 표시 |
| Primary assignee | 해당 멤버 셀에 일반 weight(500)로 표시 |
| Secondary assignee | 해당 멤버 셀에 연한 글씨(text-tertiary)로 표시. 별도 태그 없음 |
| 카운트 집계 | Primary만 카운트. Secondary는 시각적 표시만 |
| 빈 멤버 컬럼 | 항상 전체 멤버 컬럼 표시 |
| 백로그 패널 (우측) | **제거** |
| MS 구조 | **L1 flat 고정**. parent_id 폐기 (always null) |
| MS 역할 | 필수 컨테이너 → **선택적 그룹 태그**. task는 MS 없이 프로젝트에 직접 존재 가능 |
| "백로그" 개념 | **폐기**. keyMilestoneId = null인 task = "프로젝트 직속 task" (1등 시민) |
| DepthToggle (L1/L2/L3) | **삭제** |
| 1:1 MS+task 정리 | SQL migration으로 **무조건 전부** 자동 정리 |
| 프로젝트 행 기본 상태 | **전체 접힘**. 직속 task 있는 프로젝트만 자동 펼침 |
| BacklogPanel / MsTaskTreeMode | 본 phase 포함. 명칭 재정의 + indent 평탄화 |
| 셀 내 task 편집 | **inline 편집** (drawer 아님) |
| 빈 셀 인터랙션 | hover → + 버튼 → inline 생성 |

---

## 3. 아키텍처 변경

### 3.1 MS 구조 단순화

#### Before (무한 depth)
```
key_milestones
├── parent_id: nullable → 트리 형성 (L1 → L2 → L3 → ...)
├── depth: deprecated but 존재
└── 트리 순회 로직 (getMilestoneDepth, getChildren, getAncestors)
```

#### After (L1 flat + 선택사항)
```
key_milestones
├── parent_id: always null (컬럼 유지, 앱에서 미사용)
├── depth: deprecated (컬럼 유지, 앱에서 미사용)
└── 트리 순회 로직 전부 제거
```

#### MS의 새로운 역할
- MS는 "2개 이상 task를 묶을 때" 선택적으로 생성
- 단일 task는 MS 없이 프로젝트에 직접 소속 (keyMilestoneId = null)
- UI에서 keyMilestoneId = null인 task를 "백로그/미분류"가 아닌 정상 task로 표시

### 3.2 데이터 모델

#### tasks 테이블 (변경 없음)
```sql
-- 기존 컬럼 유지. 변경 없음.
-- keyMilestoneId: nullable
--   null = 프로젝트 직속 task (이전 "백로그")
--   non-null = 특정 MS에 소속된 task
```

#### key_milestones 테이블
```sql
-- parent_id: 기존 non-null 값 → null로 migration
-- 앱에서 parent_id 참조 전면 중단
-- depth 컬럼: 앱에서 참조 중단
-- 테이블/컬럼 자체는 유지 (rollback 안전)
```

#### Migration SQL
```sql
-- 1. 기존 L2+ MS를 L1으로 평탄화
UPDATE key_milestones SET parent_id = NULL WHERE parent_id IS NOT NULL;

-- 2. (선택) 1:1 MS+task 쌍 정리 — 향후 배치로 처리
-- 자동 정리는 위험하므로 수동 또는 UI에서 "MS 해제" 기능 제공
```

---

## 4. 매트릭스 뷰 UI 설계

### 4.1 레이아웃

```
┌─ Sidebar (148px) ─┬─ Main ─────────────────────────────────────────┐
│                    │ [팀 매트릭스]                                    │
│ 개인               │ 2026년 4월 15일 수요일 · 프로젝트 × 담당자        │
│  할일              │                                                 │
│  주간 플래너        │ [전체] [미배정] [배정됨]         [전체 펼치기]    │
│  타임라인           │                                                 │
│  노트              │ ┌─────────────────────────────────────────────┐ │
│                    │ │ Pivot Table                                 │ │
│ 팀                 │ │ (horizontal scroll if needed)               │ │
│  할일 ← active     │ │                                             │ │
│  주간 플래너        │ │ sticky 첫 컬럼 + sticky 헤더                 │ │
│  타임라인           │ │                                             │ │
│  팀원              │ └─────────────────────────────────────────────┘ │
│                    │                                                 │
│ 프로젝트            │ ← 백로그 패널 제거됨. main이 100% 폭 사용       │
│  ...               │                                                 │
└────────────────────┴─────────────────────────────────────────────────┘
```

### 4.2 Pivot Table 구조

#### 컬럼
```
| 프로젝트 · 마일스톤 | Edmond | eric.kim | ash.kim | ethan | ryan | 미배정 | 합계 |
  (170px, sticky)      (115px each)                                       (55px)
```

- 멤버 목록: 팀 전체 멤버 (빈 컬럼 포함 항상 표시)
- 합계 컬럼: 해당 행의 Primary task 총 카운트

#### 행: 접힌 프로젝트
```
| ▶ ABI 코리아  40건 |  1  |  ·  |  ·  |  ·  |  ·  | 39  | 40 |
```
- 1줄. 각 멤버 셀에 Primary task 카운트
- 빈 셀: `·` (color-text-tertiary)
- 카운트 색상: 5+ = amber pill, 10+ = coral pill

#### 행: 펼친 프로젝트
```
| ▼ 26Q1 정기 이사회  15건 |  6  |  4  |  3  |  1  |  ·  |  1  | 15 |
|   · P&L                 | ... | ... |tasks| ... | ... | ... |  1 |
|   · Pipeline + Tech     |tasks|tasks| ... | ... | ... | ... |  3 |
|   · 안건                |tasks|tasks|tasks| ... | ... | ... |  6 |
|   (프로젝트 직속)        |tasks| ... | ... | ... | ... | ... |  2 |
```

- 프로젝트 헤더 행: 카운트 유지 (접힌 상태와 동일 정보)
- MS sub-row: 각 L1 MS가 한 행. 셀에 해당 MS × 멤버의 task 목록
- 프로젝트 직속 sub-row: keyMilestoneId = null인 task들. "(프로젝트 직속)" 또는 "(미분류)" 라벨

#### 셀 내 task 표시
```
Primary task:
  [☐] task 이름          ← color-text-primary, font-weight: 500

Secondary task:
  [☐] task 이름          ← color-text-tertiary, font-weight: 400
```

- 체크박스 + task 이름
- text는 word-break: keep-all (한국어 단어 단위 줄바꿈)
- 셀 내에서 세로로 쌓임 (flex-direction: column)
- 빈 셀: `·` 중앙 정렬

### 4.3 Toolbar

```
[전체] [미배정] [배정됨]                           [전체 펼치기]
```

- 전체/미배정/배정됨: 기존 필터 유지
- **전체 펼치기**: 모든 프로젝트 행 토글
- **DepthToggle (L1/L2/L3) 삭제** — MS가 L1 flat이므로 depth 토글 불필요

### 4.4 인터랙션

| 동작 | 결과 |
|------|------|
| 프로젝트 행 chevron 클릭 | 해당 프로젝트 펼침/접힘 토글 |
| 전체 펼치기 버튼 | 모든 프로젝트 일괄 펼침/접힘 |
| 셀 내 task 체크박스 클릭 | task done 토글 |
| 셀 내 task 이름 클릭 | task 상세 편집 (inline 또는 drawer) |
| 빈 셀 hover | + 추가 버튼 노출 → 클릭 시 해당 프로젝트 × 멤버로 새 task 생성 |
| 멤버 컬럼 헤더 클릭 | Members View로 이동 (해당 멤버 필터) |
| 합계 컬럼 셀 클릭 | 해당 프로젝트의 모든 task를 drawer로 표시 |
| 펼침 상태 영속성 | 어떤 프로젝트가 펼쳐져 있는지 localStorage에 저장, 새로고침 시 복원 |

### 4.5 반응형

- 가로 부족 시: pv-wrap에 overflow-x: auto → 가로 스크롤
- 첫 컬럼 (프로젝트명): position: sticky; left: 0 → 가로 스크롤 시 고정
- 헤더 행: position: sticky; top: 0 → 세로 스크롤 시 고정

---

## 5. 개인 매트릭스 뷰

동일 피벗 구조 적용:
- rows = 프로젝트 (팀 + 개인 프로젝트 모두)
- cols = **멤버 컬럼 불필요** (개인이므로 자기 자신만)
- 대신: cols = MS sub-row가 인라인으로 표시되는 단순 리스트 형태
- 또는: 팀 매트릭스와 동일 구조이되 멤버가 자기 자신 1명 + 미배정

> 개인 매트릭스의 정확한 컬럼 구조는 별도 논의 필요. 이 spec은 팀 매트릭스 우선.

---

## 6. 컴포넌트 변경 목록

### 삭제 대상 (DELETE-5 적용 필요)

| 대상 | 이유 |
|------|------|
| `DepthToggle` 컴포넌트 | MS L1 flat 고정으로 불필요 |
| `MsBacklogSidebar` (백로그 패널) | 백로그 패널 제거 |
| MS parent_id 관련 hooks/로직 | `getMilestoneDepth()`, `getMilestoneChildren()`, `getMilestoneAncestors()` 등 |
| `MsTaskTreeMode` 트리 indent 로직 | flat 리스트로 단순화 |
| 기존 매트릭스 그리드 렌더링 (3×3 카드) | 피벗 테이블로 대체 |

### 신규 생성

| 대상 | 역할 |
|------|------|
| `PivotMatrixTable` | 피벗 테이블 메인 컴포넌트 |
| `PivotProjectRow` | 접힌/펼친 프로젝트 행 |
| `PivotMsSubRow` | MS sub-row (펼친 상태 내) |
| `PivotTaskCell` | 셀 내 task 리스트 렌더링 (Primary/Secondary 구분) |
| `PivotUngroupedSubRow` | keyMilestoneId = null task sub-row |

### 수정

| 대상 | 변경 내용 |
|------|----------|
| `TeamMatrixView` | 내부를 `PivotMatrixTable`로 교체 (Don't Touch → Wrap It 적용 가능 여부 검토) |
| Task 생성 flow | MS 선택을 필수 → 선택 사항으로 변경 |
| MS 생성 UI | "상위 마일스톤 선택" 옵션 제거 |

---

## 7. DB Migration 계획

### Phase 1: MS parent_id 평탄화
```sql
UPDATE key_milestones SET parent_id = NULL WHERE parent_id IS NOT NULL;
```
- 리스크: 낮음. 기존 L2+ MS가 L1으로 승격될 뿐 데이터 손실 없음
- Rollback: parent_id 값은 복구 불가하나, 앱 동작에 영향 없음 (이미 L1만 사용 중)

### Phase 2: UI 변경
- 매트릭스 뷰 피벗 전환
- 백로그 패널 제거
- DepthToggle 제거
- task 생성 시 MS 선택 optional화

### Phase 3: 1:1 MS+task 자동 정리 (R25/R26 확정)

**본 phase에 포함. SQL migration으로 일괄 처리.**

> **⚠️ SQL 실제 구현은 [matrix-redesign-01-diff-plan.md §2.2](./matrix-redesign-01-diff-plan.md)를 참조. 임시 테이블 `_1to1_ms_ids` 방식 사용 — 이전 버전의 복합 서브쿼리 DELETE는 dead code path를 포함하여 제거됨.**

핵심 로직:
1. 1:1 MS ID를 임시 테이블에 기록
2. 해당 task의 `key_milestone_id`를 NULL로
3. 해당 MS 삭제

**전제**: 마이그레이션 직전 `key_milestones` + `tasks` 스냅샷 CSV export.
**Rollback**: MS 삭제 비가역. CSV 백업으로 수동 복원.

---

## 8. REQ-LOCK: 요구사항 테이블

| ID | 요구사항 | 상태 |
|----|---------|------|
| R01 | 매트릭스 축: rows=프로젝트, cols=팀원 | confirmed |
| R02 | 접힌 행: 멤버별 Primary task 카운트 | confirmed |
| R03 | 펼친 행: MS sub-row + 직속 task sub-row, 셀에 실제 task | confirmed |
| R04 | Primary: 진한 글씨 (weight 500, text-primary) | confirmed |
| R05 | Secondary: 연한 글씨 (weight 400, text-tertiary). 태그 없음 | confirmed |
| R06 | 카운트: Primary만 집계 | confirmed |
| R07 | 빈 멤버 컬럼 항상 표시 | confirmed |
| R08 | 백로그 패널(우측) 제거 | confirmed |
| R09 | MS: L1 flat 고정. parent_id always null | confirmed |
| R10 | MS: 선택적 그룹. task는 MS 없이 프로젝트 직속 가능 | confirmed |
| R11 | "백로그" 개념 폐기 → "프로젝트 직속 task" 승격 | confirmed |
| R12 | DepthToggle (L1/L2/L3) 삭제 | confirmed |
| R13 | 카운트 색상: 5+ amber pill, 10+ coral pill | confirmed |
| R14 | 빈 셀: `·` (text-tertiary, 중앙) | confirmed |
| R15 | 첫 컬럼 + 헤더 행 sticky | confirmed |
| R16 | 가로 부족 시 overflow-x: auto | confirmed |
| R17 | 전체 펼치기 토글 | confirmed |
| R18 | 펼침 상태 localStorage 영속 | confirmed |
| R19 | 멤버 컬럼 헤더 클릭 → Members View | confirmed |
| R20 | task done 토글 셀 내 직접 가능 | confirmed |
| R21 | 개인 매트릭스: **별도 과제로 분리**. 본 phase 범위 밖 | confirmed |
| R22 | 셀 내 task 클릭 → **inline 편집** | confirmed |
| R23 | 1:1 MS+task 쌍 → **자동 정리** (MS 제거, task만 남김) | confirmed |
| R24 | 프로젝트 직속 task sub-row → **라벨 없음** (익명 sub-row) | confirmed |
| R25 | 1:1 MS+task 정리: **무조건 모두 정리** (메타데이터/owner 보존 조건 없음) | confirmed |
| R26 | 1:1 정리 실행: **SQL migration** (supabase/migrations에 일회성 DDL + rollback 포함) | confirmed |
| R27 | 프로젝트 행 기본 상태: **전체 접힘**. 단, `keyMilestoneId=null` 직속 task가 있는 프로젝트는 **자동 펼침** | confirmed |
| R28 | BacklogPanel(project view) / MsTaskTreeMode: **본 phase 범위 포함**. "백로그" 명칭 재정의 + MS 트리 indent 평탄화 | confirmed |
| R29 | 빈 셀 인터랙션: hover 시 + 버튼 노출 → 클릭 시 inline task 생성 (spec §4.4 유지). **자동 필드**: projectId=행, assigneeId=컬럼 멤버(null if 미배정), keyMilestoneId=sub-row MS(또는 null), teamId=currentTeamId, scope는 applyTransitionRules 결정 | confirmed |
| R30 | **Primary/Secondary 양쪽 셀 중복 표시**: 같은 task가 primary assignee 셀에 진하게(weight 500, text-primary), secondary assignee 셀에 연하게(weight 400, text-tertiary) 동시 등장. 카운트는 Primary 셀에만 집계 | confirmed |
| R31 | Toolbar 필터 semantic: `전체`=팀 task 전부, `미배정`=`assigneeId IS NULL AND secondaryAssigneeId IS NULL AND scope='team'`, `배정됨`=둘 중 하나라도 NOT NULL. 필터는 **셀 내 task 표시**에만 적용 (컬럼/행 목록은 영향 없음) | confirmed |

---

## 9. 미결 사항

| 항목 | 내용 | 결정 필요 시점 |
|------|------|---------------|
| task DnD (셀 간 이동) | 다른 멤버 셀로 드래그 → assignee 변경 | 후속 loop |
| 개인 매트릭스 재설계 | 별도 phase로 분리됨 | 후속 loop |

---

## 10. Don't Touch, Wrap It 적용 판단

기존 `TeamMatrixView` 컴포넌트:
- 현재 3×3 그리드 기반으로 내부가 완전히 다른 구조
- 피벗 테이블로의 전환은 **내부 전면 교체**에 해당
- "Don't Touch, Wrap It"이 적용되려면 외부 인터페이스(props, 라우팅)만 유지하고 내부를 새 컴포넌트로 교체해야 함
- **판단**: `TeamMatrixView`의 기존 export/props 시그니처 유지. 내부를 `PivotMatrixTable`로 교체. 기존 그리드 코드는 삭제 (DELETE-5 적용).
- 이는 "내부 수정 금지" 원칙의 예외이나, 뷰 전체를 재설계하는 것이므로 불가피. TodayView, MemoryView 등 비관련 뷰는 변경 없음.
