# Phase 12a Spec — 매트릭스 Lane UI 개편 + today 강조 + 집중 모드

> 작성일: 2026-04-10
> 상태: **초안** (상세화 필요)
> 선행: `12a-recon.md`

---

## 1. 목표

개인/팀 매트릭스를 단일 grid 표 형식에서 **프로젝트별 Lane 카드**로 전환하고, **지금 할일 컬럼 시각 강조** + **집중 모드** 토글을 추가한다.

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | 레이아웃 | 프로젝트마다 독립 카드 (Lane) + 내부 3컬럼 grid |
| D2 | 카테고리 헤더 | **sticky 상단 고정** (스크롤해도 고정) |
| D3 | 집중 모드 | 상단 토글 버튼 → next/later 숨김, today 전폭 |
| D4 | 집중 모드 기억 | **localStorage 저장** (새로고침 후 유지) |
| D5 | today 배경 tint | **각 카드 내부의 today 컬럼만** |
| D6 | 팀 매트릭스 | **같이 변경** (PersonalMatrixGrid + TeamMatrixGrid 모두) |
| D7 | Lane 접기/펼치기 | 기존 `collapseState.personalMatrix` / `matrix` 재사용 |
| D8 | today 강조 색상 | `rgba(229, 62, 62, 0.04)` 배경 + 헤더 `#E53E3E` 굵게 |
| D9 | DnD | 기존 DroppableCell 유지 (cell-task, cell-ms, mat, tmat prefix) |
| D10 | DB 변경 | 없음 |
| D11 | 반응형 | 좁은 화면 전환은 이번 phase 외 (데스크톱 우선) |

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
   - 상단 고정 (position: sticky, top: 0)
   - 배경 `#fff`, border-bottom `1px solid #e8e6df`
   - 카드 너비에 맞춤 (padding: project cell 너비 + 카테고리 컬럼)

4. **집중 모드 토글**
   - 카테고리 헤더 우측에 버튼 `[🎯 집중 모드]`
   - 클릭 시 `focusMode` state 토글 + localStorage 저장
   - key: `matrixFocusMode`
   - 활성 시: next/later 컬럼 숨김, grid `1fr`로 변경

5. **Today 컬럼 강조**
   - 배경: `rgba(229, 62, 62, 0.04)` (각 카드 내부 today 셀)
   - 카테고리 헤더: `fontWeight: 700`, `color: #E53E3E`

6. **프로젝트 Lane 접기/펼치기**
   - 기존 `ProjectCell` (토글 동작) 재사용 or `LaneHeader` 신규
   - 접기 시 카테고리 셀들 숨김, 헤더에 요약 카운트만 표시

### 3-2. OUT OF SCOPE (후속 phase)

- 프로젝트 순서 커스터마이징 (Phase 12b)
- 모바일 반응형 (3컬럼 → 1컬럼 자동 전환)
- 팀 매트릭스의 멤버 수 기반 컬럼 조정

---

## 4. UI 사양

### 4-1. 레이아웃 (개인 매트릭스, 집중 모드 OFF)

```
┌─ Sticky Header ────────────────────────────────┐
│ 프로젝트      │ 🔴 지금 할일 11 │ 다음 3 │ 나중 0 │ [🎯 집중] │
├────────────────────────────────────────────────┤
│                                                │
│ ┌─ Lane Card ────────────────────────────────┐│
│ │ ▾ ● 개인 개별 과제 (3)                      ││
│ │ ─────────────────────────────────────────  ││
│ │ [today - tint 배경] │ [next]    │ [later] ││
│ │ □ task 1            │ + 추가    │ + 추가  ││
│ │ □ task 2            │           │         ││
│ └────────────────────────────────────────────┘│
│                                                │
│ ┌─ Lane Card ────────────────────────────────┐│
│ │ ▾ ● C& (5)                                 ││
│ │ ...                                         ││
│ └────────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

### 4-2. 집중 모드 ON

```
┌─ Sticky Header ────────────────────────────────┐
│ 프로젝트       │ 🔴 지금 할일 11 │ [🎯 집중 ✓] │
├────────────────────────────────────────────────┤
│                                                │
│ ┌─ Lane Card ────────────────────────────────┐│
│ │ ▾ ● 개인 개별 과제 (3)                      ││
│ │ ─────────────────────────────────────────  ││
│ │ [today만 전폭 - tint 배경]                  ││
│ │ □ task 1                                    ││
│ │ □ task 2                                    ││
│ └────────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

---

## 5. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | **대규모** — Grid → Lane 카드 구조 |
| `src/components/views/grid/grids/TeamMatrixGrid.jsx` | **대규모** — 동일 |
| `src/components/views/UnifiedGridView.jsx` | focusMode state + localStorage + 토글 버튼 |

---

## 6. 제약/리스크

| # | 리스크 | 대응 |
|---|--------|------|
| R1 | 기존 DnD (cell-task/cell-ms) 동작 유지 | DroppableCell은 그대로 사용 |
| R2 | Lane 카드화로 세로 공간 증가 | 접기 활성 활용 |
| R3 | 팀 매트릭스의 멤버 수가 많으면 내부 grid 폭 좁아짐 | 이번 phase는 데스크톱 우선 |
| R4 | sticky 헤더와 카드 내부 정렬 | 헤더 gridTemplateColumns를 카드와 동일하게 |

---

## 7. QA 체크리스트

- [ ] 개인 매트릭스: 프로젝트별 Lane 카드 표시
- [ ] 팀 매트릭스: 프로젝트별 Lane 카드 표시
- [ ] 카테고리 헤더 sticky 동작
- [ ] today 배경 tint 적용
- [ ] today 헤더 빨간색 굵게
- [ ] 집중 모드 토글 → next/later 숨김
- [ ] 집중 모드 localStorage 저장 (새로고침 유지)
- [ ] 프로젝트 Lane 접기/펼치기 정상
- [ ] DnD 정상 (task/MS 셀 간 이동)
- [ ] `npm run build` 통과
