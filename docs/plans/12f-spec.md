# Phase 12f Spec — 뷰 통합 재설계 + 카드 grid 레이아웃

> 작성일: 2026-04-14
> 상태: **초안** (상세화 필요)
> 선행: `12f-recon.md`, Phase 12a~12d, Hotfix-01

---

## 1. 목표

세 핵심 뷰(개인 매트릭스, 팀 할일뷰, 프로젝트 메인뷰)를 **ProjectLaneCard** + **ProjectGridLayout**으로 통합. 카드 grid 레이아웃으로 한 화면에 여러 프로젝트 비교 가능.

---

## 2. 확정 결정사항

### 기본 결정 (D1~D12, brief 원본)

| # | 항목 | 결정 |
|---|------|------|
| D1 | today/next/later | today 필터로 축소 |
| D2 | 범위 | 단일 phase 12f |
| D3 | 프로젝트 메인뷰 | ProjectLaneCard 단일 카드 전체 화면 |
| D4 | "기타" vs MS | MS first-class 유지 |
| D5 | 백로그 사이드패널 | 팀/개인 뷰에서 제거 (프로젝트 뷰도 제거) |
| D6 | 상단 뷰 토글 | 팀/개인 뷰에서 제거 (사이드바 일원화) |
| D7 | 공용 컴포넌트 | ProjectLaneCard + ProjectGridLayout |
| D8 | 집중 모드 | 폐기 (today 필터로 대체) |
| D9 | MS 추가 버튼 | 12c 구조 유지 (dashed 슬롯) |
| D10 | MS tint | 0.13 → 0.15 |
| D11 | 아바타 컬러 버그 | 수정 |
| D12 | 목록형 토글 | 라벨 정리 |

### 카드 grid 결정 (Q1~Q15)

| # | 항목 | 결정 |
|---|------|------|
| Q1 | 카드 max-height | **500px** |
| Q2 | 그룹별 task limit | **3개** |
| Q3 | 카드 확장 | **한 카드만** |
| Q4 | 그룹 잘라내기 순서 | **마지막 sort_order부터** |
| Q5 | "기타" 섹션 위치 | **항상 마지막** (잘라내기 시 최우선 숨김) |
| Q6 | 반응형 grid | **minmax(320px, 1fr) 자동** |
| Q7 | gap | **12px** |
| Q8 | today 필터 기본 | **ON** |
| Q9 | OFF 시 범위 | **모든 task** |
| Q10 | 개인 grid 컬럼 | **반응형 1-2열** |
| Q11 | 개인 카드 잘라내기 | **적용** |
| Q12 | 프로젝트 뷰 토글 | **유지** (전체 할일 \| 타임라인) |
| Q13 | 프로젝트 뷰 그룹 토글 | **노출** |
| Q14 | 주간 MsBacklogSidebar | **유지** (12f 영향 없음) |
| Q15 | 카드 확장 localStorage | **미저장** (재진입 시 리셋) |

---

## 3. 기능 범위

### 3-1. ProjectLaneCard (공용 카드 컴포넌트)

12c TeamMatrixGrid 내부 Lane 카드를 독립 추출.

**Props**:
```
project, tasks, milestones, members, memberColorMap,
mode: 'team' | 'personal' | 'project',
groupBy: 'milestone' | 'owner',
filter: { today: boolean },
truncate: { tasksPerGroup: 3 },
expanded: boolean,
onToggleExpand: () => void,
collapsed: boolean,
onToggleCollapse: () => void,
dragHandleProps,
// editing/interaction props (기존 12c 패턴)
```

**내부 구조**:
- Lane 헤더: chevron + project dot + name + count + 참여자 칩
- MS 그룹 (groupBy='milestone'): MilestoneRow + tasks + "+ N개 더" + dashed MS 추가
- 담당자별 그룹 (groupBy='owner'): 멤버 sub-section + tasks + MS 태그
- "기타" 섹션: 항상 마지막
- 카드 잘라내기: max-height 500px, 초과 시 그룹 숨김 + "+ N개 그룹 더"

**모드별 차이**:
- `team`: 모든 task, 담당자 배지 표시, 참여자 칩
- `personal`: 현재 사용자 task만 (+ today 필터), 담당자 배지 숨김
- `project`: 모든 task, 프로젝트 헤더 없음 (상위에서 표시), max-height 무제한

### 3-2. ProjectGridLayout (wrapper 컴포넌트)

**CSS Grid**:
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
gap: 12px;
align-items: start;
```

**카드 확장 관리**:
- `expandedCardId: string | null` (한 번에 한 카드만)
- 확장 시: 해당 카드 max-height 해제, 다른 카드 그대로
- 다른 카드 클릭 시: 이전 확장 해제 + 새 카드 확장
- 재진입 시: 모든 카드 접힌 상태 (Q15)

### 3-3. 카드 잘라내기 로직 (ProjectLaneCard 내부)

1. 각 그룹의 task를 3개로 slice → 초과 시 `+ N개 더`
2. CSS `max-height: 500px` + `overflow: hidden`
3. 표시 그룹 수를 task 수 기반 휴리스틱으로 계산:
   - 그룹 헤더 ~32px + task 행 ~28px × 3 = 그룹당 ~116px
   - 500px ÷ 116px ≈ 4개 그룹 → 5개 그룹부터 잘림
4. 잘린 그룹 있으면 카드 하단에 `+ N개 그룹 더` 오버레이
5. "기타" 섹션은 항상 마지막 → 최우선 잘라내기 대상
6. expanded === true: max-height 해제, 모든 그룹/task 표시

### 3-4. 개인 매트릭스 재작성

- today/next/later 3컬럼 **폐기**
- 집중 모드 **폐기** (D8)
- pill bar **폐기**
- 구조: 헤더("today 필터" 토글) + ProjectGridLayout (반응형 1-2열)
- ProjectLaneCard `mode='personal'`, `filter={{ today: todayFilter }}`
- today 필터 ON (기본): `category === 'today'` task만
- today 필터 OFF: 모든 task (category 무관)
- localStorage `personalTodayFilter` 저장

### 3-5. 팀 할일뷰 리팩토링

- 기존 12c 구조 → ProjectLaneCard + ProjectGridLayout (3열 반응형)
- 기능 변화 최소 (내부만 리팩토링)
- 그룹 모드 토글: 목록형(MS 그룹) / 담당자별
- 담당자별 모드 부담당: 정담당 sub-section에만 출현 + mini badge (D21, 12c B안 양쪽 출현 폐기)
- max-width 제거 (grid 자체가 반응형 처리)

### 3-6. 프로젝트 메인뷰 재작성

- MsTaskTreeMode **폐기**
- BacklogPanel **폐기**
- 구조: 프로젝트 헤더 + "전체 할일 | 타임라인" 토글 + ProjectLaneCard 단일 전체 화면
- 카드는 max-height 없음 (expanded 항상 true)
- 그룹 모드 토글 노출 (Q13)
- 타임라인 모드: 기존 Timeline 코드 유지

### 3-7. 상단 토글 제거

- UnifiedGridView: "매트릭스 | 주간 플래너" Pill 제거
- 사이드바 메뉴가 유일한 진입점
- 프로젝트 뷰: "전체 할일 | 타임라인" 유지 (Q12)

### 3-8. 백로그 제거

- BacklogPanel: UnifiedProjectView + CompactMilestoneTab에서 제거
- MsBacklogSidebar: **유지** (주간 플래너 전용, Q14)
- BacklogPanel 고유 기능(검색, 필터)은 "기타" 섹션이 대체 (기본적인 표시만, 검색 없음)

### 3-9. 12a 코드 제거

- focusMode state (UnifiedGridView + PersonalMatrixGrid)
- 2열 Lane 레이아웃
- pill bar
- localStorage `matrixFocusMode`
- `rectSortingStrategy` import (focusMode 전용)

### 3-10. 작은 개선

- MS tint: MilestoneRow alpha 0.13 → 0.15, hover 0.22 → 0.25
- 아바타 컬러 버그: 초기 렌더 시 members 빈 배열 → memberColorMap 빈 맵 → fallback #888 방어
- 12c B안 부담당 양쪽 출현 로직 제거 → 정담당 sub-section + mini badge로 단순화

---

## 4. UI 사양

### 4-1. 팀 할일뷰 (카드 grid)

```
[목록형 ▾]                              ↻

┌─ 팀 개별 과제 ─────┐ ┌─ 26Q1 이사회 ──────┐ ┌─ ABI 코리아 ──────┐
│ ▾ ● 팀 개별 과제 11│ │ ▾ ● 26Q1 이사회  4 │ │ ▸ ● ABI 코리아  0 │
│ ┃ MS 그룹 1    3/5 │ │ □ 전체 초안 스터디  │ │   ● 0 ● 0 ● 0    │
│   □ task 1    ⓡ    │ │ □ 이사회 자료 Deck │ └──────────────────┘
│   □ task 2    ⓔ    │ │ □ Finance 자료     │
│   □ task 3    ⓐ    │ │ □ Jason 자료       │ ┌─ 일본법인 ────────┐
│   + 2개 더         │ │ + 추가             │ │ ...               │
│ ┃ MS 그룹 2    1/2 │ │ + 마일스톤 추가    │ └──────────────────┘
│   □ task 4    ⓡ    │ │ 기타 ──────        │
│   + 추가           │ │   □ task 5         │
│ + 3개 그룹 더      │ │   + 추가           │
└────────────────────┘ └──────────────────┘
```

### 4-2. 개인 매트릭스 (today 필터 ON)

```
[● today 필터 ON]

┌─ 개인 개별 과제 ───┐ ┌─ C& ──────────────┐
│ ▾ ● 개인 개별 과제 │ │ ▾ ● C&          5 │
│   □ 공시 위반 처벌  │ │ ┃ MS 그룹     3/5 │
│   □ 양입기         │ │   □ task 1        │
│   + 추가           │ │   □ task 2        │
│                    │ │   □ task 3        │
└────────────────────┘ │   + 추가          │
                       └──────────────────┘
```

### 4-3. 프로젝트 메인뷰

```
● ABI 코리아 · 프로젝트 오너: Ryan    [전체 할일] [타임라인]   [목록형 ▾]

┃ 법인설립               12/12
  □ 대행사 계약                                     ⓡ Ryan
  □ 필요서류 확보                                    ⓔ Edmond
  □ 설립등기                                        ⓡ Ryan
  + 추가
┃ 사업자등록              5/5
  □ 사업자등록 신청                                   ⓡ Ryan
  ...
+ 마일스톤 추가
기타 ──────
  □ ARM 공문 발송                                    ⓐ ash
  + 추가
```

### 4-4. 카드 잘라내기 UI

접힌 상태 (max-height 500px):
```
┌─ 프로젝트 ─────────┐
│ MS 그룹 1 ...      │
│ MS 그룹 2 ...      │
│ MS 그룹 3 ...      │
│ ░░░░░░░░░░░░░░░░░ │ ← gradient fade
│  + 4개 그룹 더     │
└────────────────────┘
```

확장 상태:
```
┌─ 프로젝트 ──────────────────┐
│ MS 그룹 1 (모든 task)       │
│ MS 그룹 2 (모든 task)       │
│ MS 그룹 3 (모든 task)       │
│ MS 그룹 4 (모든 task)       │
│ MS 그룹 5 (모든 task)       │
│ 기타                        │
│                    [접기 ▲] │
└─────────────────────────────┘
```

---

## 5. 영향 파일

### 신규
| 파일 | 역할 |
|------|------|
| `src/components/shared/ProjectLaneCard.jsx` | 공용 프로젝트 카드 |
| `src/components/shared/ProjectGridLayout.jsx` | 카드 grid wrapper |

### 대규모 수정
| 파일 | 변경 |
|------|------|
| `PersonalMatrixGrid.jsx` | **전면 재작성** — today 필터 + ProjectGridLayout |
| `TeamMatrixGrid.jsx` | **리팩토링** — ProjectLaneCard + ProjectGridLayout 사용 |
| `UnifiedProjectView.jsx` | **재작성** — MsTaskTreeMode 교체, BacklogPanel 제거 |
| `UnifiedGridView.jsx` | 상단 토글 제거, focusMode 제거 |

### 제거
| 파일/코드 | 이유 |
|-----------|------|
| `BacklogPanel.jsx` 사용처 제거 | D5 (주간 MsBacklogSidebar는 유지) |
| focusMode 관련 코드 | D8 |
| pill bar 코드 | D8 |
| MsTaskTreeMode.jsx 사용처 교체 | D3 (파일 자체는 남겨도 됨) |
| 12c B안 양쪽 출현 로직 | D21 |

### 수정
| 파일 | 변경 |
|------|------|
| `MilestoneRow.jsx` | tint alpha 0.15/0.25 (D10) |
| `Sidebar.jsx` | 이미 수정 완료 (개인/팀 분리) |

---

## 6. 구현 순서 (R-ATOMIC, 14개)

| # | 커밋 |
|---|------|
| 1 | `feat(shared): extract ProjectLaneCard from TeamMatrixGrid` |
| 2 | `feat(shared): add ProjectGridLayout with responsive grid` |
| 3 | `feat(shared): add card truncation logic to ProjectLaneCard` |
| 4 | `feat(shared): add card expand/collapse interaction` |
| 5 | `feat(team-todo): use ProjectLaneCard + ProjectGridLayout` |
| 6 | `feat(personal): rewrite with ProjectLaneCard + today filter` |
| 7 | `refactor: remove 12a focus mode + pill bar` |
| 8 | `feat(project): rewrite project view with ProjectLaneCard` |
| 9 | `refactor: remove BacklogPanel from project views` |
| 10 | `refactor: remove top view toggle from UnifiedGridView` |
| 11 | `style(milestone): strengthen MS tint 0.13→0.15` |
| 12 | `fix: resolve gray avatar initial render` |
| 13 | `refactor: simplify B-view secondary to badge-only (D21)` |
| 14 | `chore: cleanup orphaned imports + localStorage keys` |

---

## 7. QA 체크리스트

### ProjectLaneCard
- [ ] MS 그룹 렌더 (accent bar, alive/total, 접기/펼치기)
- [ ] 담당자별 그룹 렌더 (멤버 sub-section)
- [ ] "기타" 섹션 항상 마지막
- [ ] 그룹별 task 3개 제한 + "+ N개 더"
- [ ] dashed + 마일스톤 추가 슬롯
- [ ] 담당자 배지 (team 모드만)

### ProjectGridLayout
- [ ] 반응형 1/2/3열 (minmax 320px)
- [ ] gap 12px
- [ ] align-items: start (높이 불일치 OK)

### 카드 잘라내기
- [ ] max-height 500px 초과 시 그룹 잘라내기
- [ ] "+ N개 그룹 더" 클릭 → 카드 확장
- [ ] 한 카드만 확장, 다른 카드 클릭 시 이전 접힘
- [ ] 확장 시 모든 그룹 + 모든 task 표시
- [ ] "접기" 버튼 → 원래 상태

### 개인 매트릭스
- [ ] today 필터 ON → today task만
- [ ] today 필터 OFF → 모든 task
- [ ] localStorage 저장
- [ ] 3컬럼 구조 없음 (today/next/later 폐기)
- [ ] 집중 모드 없음 (pill bar/◎ 버튼 없음)

### 팀 할일뷰
- [ ] 카드 grid 3열 반응형
- [ ] 목록형/담당자별 토글
- [ ] B안 부담당: 정담당 sub-section만 + mini badge

### 프로젝트 메인뷰
- [ ] ProjectLaneCard 전체 화면
- [ ] max-height 없음 (항상 확장)
- [ ] "전체 할일 | 타임라인" 토글 유지
- [ ] 그룹 모드 토글 노출
- [ ] BacklogPanel 없음

### 제거 확인
- [ ] 상단 "매트릭스 | 주간 플래너" 토글 없음
- [ ] focusMode state/localStorage 없음
- [ ] pill bar 없음
- [ ] BacklogPanel import 없음 (프로젝트 뷰)

### 회귀
- [ ] 주간 플래너 정상 (MsBacklogSidebar 유지)
- [ ] 타임라인 정상
- [ ] 팀원 뷰 (12d MembersView) 정상
- [ ] DnD 프로젝트 순서 정상 (12b)
- [ ] `npm run build` 통과
