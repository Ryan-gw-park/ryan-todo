# Phase 12a Spec v2 — 매트릭스 Lane UI 개편 + today 강조 + 집중 모드

> 작성일: 2026-04-10
> 상태: **확정**
> 선행: `12a-recon.md`
> 변경 이력: v1 → v2 집중 모드 레이아웃 A안(2열 Lane) 확정, DnD 비활성화 추가

---

## 1. 목표

개인/팀 매트릭스를 단일 grid 표 형식에서 **프로젝트별 Lane 카드**로 전환하고, **지금 할일 컬럼 시각 강조** + **집중 모드** 토글을 추가한다.

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | 레이아웃 | 프로젝트마다 독립 카드 (Lane) + 내부 3컬럼 grid |
| D2 | 카테고리 헤더 | **sticky 상단 고정** (스크롤해도 고정) |
| D3 | 집중 모드 | 상단 토글 버튼 → next/later 숨김, **Lane을 2열 grid로 재배치** |
| D4 | 집중 모드 기억 | **localStorage 저장** (key: `matrixFocusMode`, 새로고침 후 유지) |
| D5 | today 배경 tint | **각 카드 내부의 today 컬럼만** |
| D6 | 팀 매트릭스 | **같이 변경** (PersonalMatrixGrid + TeamMatrixGrid 모두) |
| D7 | Lane 접기/펼치기 | 기존 `collapseState.personalMatrix` / `matrix` 재사용 |
| D8 | today 강조 색상 | `rgba(229, 62, 62, 0.04)` 배경 + 헤더 `#E53E3E` 굵게 |
| D9 | DnD | 일반 모드: 기존 DroppableCell 유지 / **집중 모드: DnD 완전 비활성화** |
| D10 | DB 변경 | 없음 |
| D11 | 반응형 | 좁은 화면 전환은 이번 phase 외 (데스크톱 우선) |
| D12 | 집중 모드 DnD | **비활성화** — sensors 제거 또는 DndContext 미렌더 |
| D13 | sticky 헤더 카운트 | 카테고리별 전체 합산 카운트 표시 (동적 집계) |
| D14 | 접힌 Lane 요약 | 카테고리별 dot + 건수 표시 (`● 3  ● 1  ● 2`) |

---

## 3. 기능 범위

### 3-1. IN SCOPE

1. **PersonalMatrixGrid Lane 카드화**
   - 단일 CSS Grid → 프로젝트마다 독립 div (카드)
   - 카드 스타일: `background: #fff`, `border: 1px solid #e8e6df`, `borderRadius: 10`, `marginBottom: 12`
   - 내부 3컬럼 grid: `gridTemplateColumns: repeat(3, 1fr)`

2. **TeamMatrixGrid Lane 카드화**
   - 동일하게 카드 구조로 변경
   - 팀 매트릭스는 행=프로젝트, 열=팀원 → 각 프로젝트가 독립 카드, 내부에 팀원 컬럼

3. **카테고리 헤더 sticky**
   - 상단 고정 (position: sticky, top: 0, z-index: 10)
   - 배경 `#fff`, border `1px solid #e8e6df`, borderRadius: 10
   - **카테고리별 전체 합산 카운트** 동적 집계 표시
   - 일반 모드: `gridTemplateColumns: 160px 1fr 1fr 1fr 48px`
   - 집중 모드: `gridTemplateColumns: 160px 1fr 48px` (today + 토글 버튼만)

4. **집중 모드 토글**
   - sticky 헤더 우측에 토글 아이콘 버튼 (타겟 아이콘)
   - 클릭 시 `focusMode` state 토글 + localStorage 저장
   - key: `matrixFocusMode`
   - **활성 시:**
     - next/later 컬럼 완전 숨김
     - **Lane 카드를 2열 grid로 재배치** (`gridTemplateColumns: repeat(2, 1fr)`, gap: 8px)
     - 각 Lane 카드 내부는 today 1컬럼만 (`gridTemplateColumns: 1fr`)
     - DnD 완전 비활성화 (DndContext 미렌더 또는 sensors=[])
   - **비활성 시:** 기존 1열 Lane + 3컬럼 grid + DnD 활성

5. **Today 컬럼 강조**
   - 배경: `rgba(229, 62, 62, 0.04)` (각 카드 내부 today 셀)
   - 카테고리 헤더: `fontWeight: 700`, `color: #E53E3E`

6. **프로젝트 Lane 접기/펼치기**
   - 기존 `collapseState.personalMatrix[pid]` 재사용
   - 접기 시 카테고리 셀 숨김, **카테고리별 dot + 건수 요약** 표시
   - 요약 형식: `● 3  ● 1  ● 2` (지금/다음/나중 각 색상 dot + 숫자)
   - 집중 모드에서 접기: today 건수만 표시 (`● 3`)

### 3-2. OUT OF SCOPE (후속 phase)

- 프로젝트 순서 커스터마이징 (Phase 12b)
- 모바일 반응형 (3컬럼 → 1컬럼 자동 전환)
- 팀 매트릭스의 멤버 수 기반 컬럼 조정
- 집중 모드 전환 애니메이션 (후속 polish)

---

## 4. UI 사양

### 4-1. 일반 모드 (집중 모드 OFF)

```
┌─ Sticky Header ────────────────────────────────────┐
│ 프로젝트     │ 🔴 지금 할일 11 │ 다음 5 │ 나중 2 │ [◎] │
└────────────────────────────────────────────────────┘

┌─ Lane Card ──────────────────────────────────────┐
│ ▾ ● 개별과제 (5건)                                │
│ ─────────────────────────────────────────────── │
│ [today tint]      │ [next]        │ [later]     │
│ □ task 1          │ □ task 4      │ □ task 5    │
│ □ task 2          │ + 추가        │ + 추가      │
│ □ task 3          │               │             │
│ + 추가            │               │             │
└──────────────────────────────────────────────────┘

┌─ Lane Card (접힘) ───────────────────────────────┐
│ ▸ ● ABI 코리아 (4건)    ● 1  ● 1  ● 2           │
└──────────────────────────────────────────────────┘
```

### 4-2. 집중 모드 ON (2열 Lane 배치)

```
┌─ Sticky Header ────────────────────────────────────┐
│ 프로젝트     │ 🔴 지금 할일 11                │ [◉] │
└────────────────────────────────────────────────────┘

┌─ Lane ──────────────┐  ┌─ Lane ──────────────┐
│ ▾ ● 개별과제 (3)     │  │ ▾ ● 정기주총 (3)     │
│ ──────────────────  │  │ ──────────────────  │
│ [today tint]        │  │ [today tint]        │
│ □ 이사 견적 비교     │  │ □ 주주명부 확정      │
│ □ 보험 갱신 확인     │  │ □ 이사회 안건 작성   │
│ □ 운전면허 갱신      │  │ □ 감사보고서 수령    │
│ + 추가              │  │ + 추가              │
└─────────────────────┘  └─────────────────────┘

┌─ Lane ──────────────┐  ┌─ Lane ──────────────┐
│ ▾ ● ABI 코리아 (1)   │  │ ▾ ● 일본법인 (1)    │
│ ──────────────────  │  │ ──────────────────  │
│ □ 계약서 검토        │  │ □ 물류 계약 갱신     │
│ + 추가              │  │ + 추가              │
└─────────────────────┘  └─────────────────────┘
```

---

## 5. 집중 모드 DnD 비활성화 상세

| 상태 | DnD 동작 |
|------|----------|
| 일반 모드 | 기존 DroppableCell 유지 (cell-task, cell-ms, mat, tmat prefix) |
| 집중 모드 | **DnD 완전 비활성화** |

구현 방법 (택 1):
- **A. DndContext 조건부 렌더링**: `focusMode ? <>{children}</> : <DndContext ...>{children}</DndContext>`
- **B. sensors 빈 배열**: `sensors={focusMode ? [] : defaultSensors}`
- **권장: A** — DndContext 자체를 빼면 DroppableCell 내부의 useDroppable도 no-op이 됨

---

## 6. 영향 파일

| 파일 | 변경 |
|------|------|
| `PersonalMatrixGrid.jsx` | **대규모** — Grid → Lane 카드, 2열 focus layout |
| `TeamMatrixGrid.jsx` | **대규모** — 동일 |
| `UnifiedGridView.jsx` | focusMode state + localStorage + 토글 버튼 + DndContext 조건부 |

---

## 7. 제약/리스크

| # | 리스크 | 대응 |
|---|--------|------|
| R1 | 기존 DnD 동작 유지 | 일반 모드에서만 DroppableCell 활성 |
| R2 | Lane 카드화로 세로 공간 증가 | 접기 활성 활용 + 집중 모드 2열로 완화 |
| R3 | 팀 매트릭스 멤버 수 많으면 폭 좁아짐 | 데스크톱 우선, 후속 phase |
| R4 | sticky 헤더와 카드 내부 정렬 | 헤더 gridTemplateColumns를 카드와 동일하게 |
| R5 | 2열 배치 시 Lane 카드 높이 불일치 | CSS Grid가 자동 정렬, 명시적 align-items 불필요 |
| R6 | 집중 모드에서 task 카테고리 변경 불가 | 의도된 제약 — 집중 모드 해제 후 이동 |

---

## 8. QA 체크리스트

- [ ] 개인 매트릭스: 프로젝트별 Lane 카드 표시
- [ ] 팀 매트릭스: 프로젝트별 Lane 카드 표시
- [ ] 카테고리 헤더 sticky 동작
- [ ] **카테고리 헤더 전체 합산 카운트 정확**
- [ ] today 배경 tint 적용 (각 카드 내부)
- [ ] today 헤더 빨간색 굵게
- [ ] 집중 모드 토글 → next/later 숨김
- [ ] **집중 모드 → Lane 2열 배치 동작**
- [ ] **집중 모드 → DnD 완전 비활성화 확인**
- [ ] 집중 모드 localStorage 저장 (새로고침 유지)
- [ ] 프로젝트 Lane 접기/펼치기 정상
- [ ] **접힌 Lane 요약: 카테고리별 dot + 건수 표시**
- [ ] **접힌 Lane 집중 모드: today 건수만 표시**
- [ ] DnD 정상 — 일반 모드에서 task/MS 셀 간 이동
- [ ] `npm run build` 통과
