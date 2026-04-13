# Phase 12c Spec — 팀 매트릭스 리스트형 전환 (플랫 리스트 + 담당자 태그)

> 작성일: 2026-04-13
> 상태: **초안** (상세화 필요)
> 선행: `12c-recon.md`, Phase 12a/12b

---

## 1. 목표

팀 매트릭스의 5컬럼 멤버 grid를 **프로젝트별 Lane + 플랫 task 리스트 + 담당자 배지** 방식으로 교체. MS 그룹 헤더는 유지하여 task 계층 구조를 보존.

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | 기본 뷰 | C안: 플랫 리스트 + Lane 헤더 우측 참여자 칩 + 우측 아바타 배지 |
| D2 | 토글 | B안: 담당자별 그룹 (sub-section) — localStorage `teamMatrixGroupByOwner` |
| D3 | max-width | 880px, `margin: 0 auto` |
| D4 | 멤버 색상 | `getColorByIndex(memberIndex)` 재사용 (자동 할당) |
| D5 | 헤더 칩 정렬 | task 수 내림차순 (가장 바쁜 사람 먼저) |
| D6 | 미배정 task 위치 | 맨 위 (회의에서 즉시 배정) |
| D7 | B안 미배정 그룹 | 첫 sub-section "미배정 (N)" |
| D8 | DnD | Lane 내부 task sortable만 유지, 담당자 변경 = dropdown |
| D9 | 기존 5컬럼 grid | 완전 교체 (토글 안 함) |
| D10 | 개인 매트릭스 | 변경 없음 |
| D11 | MS 표시 | **MS 그룹 헤더 유지** — MilestoneRow (10a) 재사용, 접기/펼치기 |
| D12 | task 정렬 | **MS 그룹 순 → 그룹 내 sortOrder** (프로젝트 뷰와 일관) |
| D13 | 미배정 task 내 MS | MS 없는(미연결) task도 포함, "기타" 섹션 |
| D14 | DB 변경 | 없음 |
| D15 | 담당자 변경 | 아바타 배지 클릭 → 멤버 dropdown (AssigneeSelector 패턴) |

---

## 3. 기능 범위

### 3-1. IN SCOPE

1. **TeamMatrixGrid 완전 재작성** → 플랫 리스트 구조
   - 프로젝트별 Lane 카드 (12a와 동일한 카드 스타일)
   - Lane 내부: MS 그룹 → task 리스트 (sortOrder)
   - 각 task 행 우측: 담당자 아바타 배지 (멤버별 색상)
   - Lane 헤더 우측: 참여자 칩 (아바타 + 카운트, task 수 내림차순)
   - max-width 880px, 가운데 정렬

2. **그룹 모드 토글 (C ↔ B)**
   - UnifiedGridView 헤더에 토글 Pill 또는 아이콘
   - C안 (기본): task에 담당자 배지 표시
   - B안 (토글): 담당자별 sub-section (멤버 헤더 + 하위 task)
   - localStorage `teamMatrixGroupByOwner` 저장

3. **MS 그룹 헤더**
   - MilestoneRow 컴포넌트 재사용 (10a 스타일: accent bar + alive/total 카운트)
   - MS별 task 접기/펼치기 (기존 `matrixMsCollapsed` 재사용)
   - MS 없는 task → "기타" 섹션 (CellContent 패턴)
   - MS 정렬: sort_order ASC

4. **담당자 변경 dropdown**
   - task 우측 아바타 배지 클릭 → 멤버 picker 팝업
   - 미배정 task: ghost 아바타 (dashed border) → 클릭 시 배정
   - AssigneeSelector 패턴 재사용

5. **멤버 아바타 색상**
   - MiniAvatar에 `color` prop 추가 (기존 `#888` → 동적)
   - `getColorByIndex(memberIndex)` → `.dot` 색상 사용

### 3-2. OUT OF SCOPE

- 개인 매트릭스 변경 (today/next/later 그대로)
- 기존 5컬럼 grid 토글 유지 (완전 교체)
- task category 필드 변경 (기존 데이터 유지)
- 칩 클릭 → 멤버 필터링 (후속)

---

## 4. UI 사양

### 4-1. C안 (기본 — 플랫 리스트 + 담당자 태그)

```
┌─ Lane: 팀 개별 과제 11건         R3  E3  ash1  eric3 ┐
│ ▾ ● 1분기 NDR 준비   3/3                              │
│    □ 1분기 NDR 자료 준비                    ⓡ Ryan    │
│    □ 수주/매출 현황 업데이트                  ⓡ Ryan    │
│    □ 주주명부 요약 업데이트                   ⓡ Ryan    │
│ ▾ ● MM 업무   2/2                                     │
│    □ MM                                   ⓔ Edmond   │
│    □ 조직개편 사항 적용                     ⓔ Edmond   │
│ 기타 ──────────────────────────                       │
│    □ 프로젝트 Dashboard                    ⓞ eric     │
│    □ ARM - 공문 발송                       ⓐ ash      │
│ + 추가                                                │
└───────────────────────────────────────────────────────┘
```

### 4-2. B안 (담당자별 그룹)

```
┌─ Lane: 팀 개별 과제 11건                               ┐
│ ⓡ Ryan 3                                               │
│    □ 1분기 NDR 자료 준비                                 │
│    □ 수주/매출 현황 업데이트                               │
│    □ 주주명부 요약 업데이트                                │
│ ⓔ Edmond 3                                             │
│    □ MM                                                  │
│    □ 조직개편 사항 적용                                    │
│    □ 규정 개정                                           │
│ ○ 미배정 2                                               │
│    □ 각종 자료 대시보드화                                  │
│    □ MM 스터디                                           │
│ + 추가                                                   │
└──────────────────────────────────────────────────────────┘
```

### 4-3. MS 그룹 헤더 스타일

10a MilestoneRow와 동일:
- 배경: `hexToRgba(accentColor, 0.13)`
- accent bar: 3px × 14px 프로젝트 dot 색상
- 카운트: `alive/total` pill (10px, 회색)
- chevron: 접기/펼치기
- 접힌 상태: MS 헤더만 표시

### 4-4. 담당자 배지 스타일

- MiniAvatar (14px) + 멤버 색상
- hover 시 클릭 가능 표시 (cursor: pointer)
- 미배정: dashed border ghost 아바타

### 4-5. Lane 헤더 참여자 칩

- `ⓡ 3  ⓔ 3  ⓞ 1  ⓐ 3` 형태
- MiniAvatar (16px) + 카운트 숫자
- task 수 내림차순 정렬
- gap: 8px

---

## 5. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/grid/grids/TeamMatrixGrid.jsx` | **완전 재작성** |
| `src/components/views/UnifiedGridView.jsx` | 토글 state + props + handleDragEnd `tmat:` 분기 정리 |
| `src/components/views/grid/shared/MiniAvatar.jsx` | `color` prop 추가 |

---

## 6. 구현 순서

| # | 커밋 |
|---|------|
| 1 | `feat(team-matrix): replace grid with flat task list + owner badge + MS groups (12c step 1)` |
| 2 | `feat(team-matrix): add group-by-owner toggle with localStorage (12c step 2)` |
| 3 | `feat(team-matrix): add owner picker dropdown on badge click (12c step 3)` |

---

## 7. QA 체크리스트

- [ ] 팀 매트릭스: 플랫 리스트 (1컬럼, max-width 880)
- [ ] Lane 헤더 참여자 칩 (task 수 내림차순)
- [ ] MS 그룹 헤더 표시 (accent bar, alive/total, 접기/펼치기)
- [ ] MS 없는 task → "기타" 섹션
- [ ] 각 task 우측 담당자 아바타 배지 (멤버별 색상)
- [ ] 미배정 task → ghost 아바타 + 맨 위 위치
- [ ] 그룹 모드 토글 (C ↔ B) — localStorage 저장
- [ ] B안: 담당자별 sub-section + 미배정 그룹 맨 위
- [ ] 담당자 배지 클릭 → 멤버 picker dropdown
- [ ] 프로젝트 Lane 접기/펼치기 정상
- [ ] Lane DnD (프로젝트 순서) 정상
- [ ] 개인 매트릭스 회귀 없음
- [ ] `npm run build` 통과
