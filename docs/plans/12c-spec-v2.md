# Phase 12c Spec v2 — 팀 매트릭스 리스트형 전환 (플랫 리스트 + MS 그룹 + 담당자 태그)

> 작성일: 2026-04-13
> 상태: **확정**
> 선행: `12c-recon.md`, Phase 12a/12b
> 변경 이력: v1 → v2 — 10가지 ambiguity 해결 (용어 분리, MS 그룹 구조 정밀화, MS 추가 패턴, 인라인 편집/상세 패널 동선 명시)

---

## 1. 목표

팀 매트릭스의 5컬럼 멤버 grid를 **프로젝트별 Lane + MS 그룹 + 플랫 task 리스트 + 담당자 배지** 방식으로 교체. MS 그룹 헤더로 task 계층(프로젝트 → MS → task)을 보존하며, 회의 워크플로우에 최적화한다.

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | 기본 뷰 | C안: 플랫 리스트 + Lane 헤더 우측 참여자 칩 + task 우측 아바타 배지 |
| D2 | 토글 | B안: 담당자별 그룹 — localStorage `teamMatrixGroupByOwner` |
| D3 | max-width | 880px, `margin: 0 auto` |
| D4 | 멤버 색상 | `getColorByIndex(memberIndex)` 재사용 (자동 할당, stable mapping) |
| D5 | 헤더 칩 정렬 | task 수 내림차순 (가장 바쁜 사람 먼저) |
| D6 | ~~미배정 task 위치~~ | **폐기** — 담당자 미배정 task는 자기 MS 그룹 내부 그대로 + ghost 아바타 |
| D7 | B안 미배정 그룹 | 첫 sub-section "미배정 (N)" |
| D8 | DnD | 같은 MS 그룹 내부 정렬만. MS 변경은 detail panel. |
| D9 | 기존 5컬럼 grid | 완전 교체 (토글 유지 안 함) |
| D10 | 개인 매트릭스 | 변경 없음 |
| D11 | MS 표시 | MS 그룹 헤더 유지 — MilestoneRow (10a) 재사용 |
| D12 | task 정렬 | MS sortOrder → 그룹 내 sortOrder (프로젝트 뷰와 일관) |
| D13 | "기타" 섹션 | MS에 연결되지 않은 task는 Lane 맨 아래 "기타" 섹션에 표시 |
| D14 | DB 변경 | 없음 |
| D15 | 담당자 변경 | 아바타 배지 클릭 → 멤버 dropdown (AssigneeSelector 패턴) |
| **D16** | **용어 분리** | **담당자 없음 = "미배정" / MS 연결 없음 = "기타"** |
| **D17** | **B안 MS 컨텍스트** | **task 행에 작은 MS 태그 (`■ MS이름`) — MS 헤더 없이도 소속 표시** |
| **D18** | **MS 추가 패턴** | **D안 — MS 그룹 내부 `+ task` + Lane 끝 dashed `+ 마일스톤 추가` 슬롯 + "기타" 섹션 내부 `+ task`** |
| **D19** | **MS alive/total 카운트** | **MS 전체 task 기준 (DB 원본) — 모든 뷰 일관** |
| **D20** | **MS collapse state** | **`teamMatrixMsCollapsed` 신규 키 (개인 `matrixMsCollapsed`와 분리)** |
| **D21** | **인라인 편집** | **task/MS 모두 기존 패턴 적용 (동적 width, ESC/Enter)** |
| **D22** | **우측 상세 패널** | **task/MS 모두 기존 UniversalCard 4-zone 분리 적용** |
| **D23** | **dashed 슬롯 hover** | **기본 opacity 0.4 → hover opacity 1** |

---

## 3. 기능 범위

### 3-1. IN SCOPE

1. **TeamMatrixGrid 완전 재작성** → 플랫 리스트 + MS 그룹 구조
   - 프로젝트별 Lane 카드 (12a 카드 스타일 재사용)
   - Lane 내부 구조:
     - MS 그룹 헤더 (MilestoneRow 재사용)
     - MS별 task 리스트 (sortOrder 순)
     - MS 그룹 내부 마지막 위치에 `+ task 추가`
     - 모든 MS 그룹 다음에 dashed `+ 마일스톤 추가` 슬롯
     - "기타" 섹션 (MS 미연결 task)
     - 기타 섹션 내부 마지막 위치에 `+ task 추가`
   - 각 task 행 우측: 담당자 아바타 배지
   - Lane 헤더 우측: 참여자 칩 (task 수 내림차순)
   - max-width 880px, 가운데 정렬

2. **그룹 모드 토글 (C ↔ B)**
   - UnifiedGridView 헤더에 토글 Pill
   - C안 (기본): MS 그룹 + 담당자 배지
   - B안 (토글): 담당자별 sub-section + task 행에 MS 태그
   - localStorage `teamMatrixGroupByOwner`

3. **MS 그룹 헤더 (C안)**
   - MilestoneRow (10a) 재사용 — accent bar + alive/total
   - 접기/펼치기: `teamMatrixMsCollapsed[msId]` (신규 키, 개인 매트릭스와 분리)
   - 정렬: MS sort_order ASC
   - 진행률: MS 전체 task 기준 (DB 원본)
   - 인라인 편집: MS 이름 클릭
   - 상세 패널: MS 행 chevron/non-title 영역 클릭 → MilestoneSelector 모드

4. **task 행 (C안)**
   - UniversalCard 4-zone 분리 (title=edit, non-title=drag, checkbox=toggle, arrow=detail)
   - 인라인 편집 (동적 width, ESC/Enter)
   - 우측 담당자 아바타 배지 (멤버별 색상)
   - 미배정: ghost 아바타 (dashed border)
   - 배지 클릭 → 멤버 dropdown (AssigneeSelector)

5. **B안 (담당자별 그룹)**
   - 각 담당자 sub-section: 멤버 헤더 (아바타 + 이름 + 카운트)
   - 첫 sub-section: "미배정 (N)" — 담당자 없는 task
   - sub-section 내부 task 행: 작은 MS 태그 (`■ MS이름`) 표시 (D17)
     - MS 미연결 task는 `■ 기타` 표시
   - sub-section 끝 `+ task 추가` → 해당 담당자에게 자동 배정, MS는 "기타"
   - MS 그룹 헤더 없음 (담당자가 1차 분류)

6. **+ 추가 패턴 (D18)**

   | 위치 | 동작 |
   |------|------|
   | MS 그룹 내부 마지막 task 아래 `+ task 추가` | 해당 MS에 task 추가 (keyMilestoneId 자동 설정) |
   | 모든 MS 다음 dashed `+ 마일스톤 추가` 슬롯 | 새 MS 생성 (sort_order 마지막) |
   | "기타" 섹션 내부 `+ task 추가` | MS 미연결 task 추가 (keyMilestoneId = null) |
   | B안: sub-section 끝 `+ task 추가` | 해당 담당자 자동 배정 + 기타 섹션 |

7. **dashed 빈 슬롯 (D18, D23)**
   - dashed border, 가운데 텍스트 "+ 마일스톤 추가"
   - 기본 opacity 0.4, 색상 text-tertiary
   - hover 시 opacity 1, border 진하게, color text-secondary
   - 클릭 → 인라인 입력 모드

8. **담당자 변경 dropdown (D15)**
   - task 우측 아바타 배지 클릭 → 멤버 picker 팝업
   - 미배정 task: ghost 아바타 클릭 → 동일 dropdown
   - AssigneeSelector 패턴 재사용

9. **멤버 아바타 색상 (D4)**
   - MiniAvatar에 `color` prop 추가
   - `getColorByIndex(memberIndex)` 매핑
   - 멤버 ID → index 매핑은 stable (members 배열 sort 후 사용)

### 3-2. OUT OF SCOPE

- 개인 매트릭스 변경
- 기존 5컬럼 grid 토글 유지
- task category 필드 변경
- 칩 클릭 → 멤버 필터링
- task의 MS 변경 DnD (detail panel 사용)
- 멤버 색상 수동 커스터마이징

---

## 4. UI 사양

### 4-1. C안 (기본 — 플랫 리스트 + MS 그룹 + 담당자 태그)

```
┌─ Lane: 팀 개별 과제 11건         ⓡ3  ⓔ3  ⓞ1  ⓐ3  ⓔt1 ┐
│ ▾ ┃ 1분기 NDR 준비           3/3                          │
│   □ 1분기 NDR 자료 준비                          ⓡ Ryan   │
│   □ 수주/매출 현황 업데이트                       ⓡ Ryan   │
│   □ 주주명부 요약 업데이트                        ⓡ Ryan   │
│   + task 추가                                              │
│ ▾ ┃ MM 업무                  2/2                          │
│   □ MM                                          ⓔ Edmond │
│   □ 조직개편 사항 적용                            ⓔ Edmond │
│   + task 추가                                              │
│ ▾ ┃ 대시보드 작업             2/2                          │
│   □ 프로젝트 Dashboard                           ⓞ eric   │
│   □ 각종 자료 대시보드화                          ⓐ ash    │
│   □ 신규 정책 검토                              ⓞ 미배정   │← ghost
│   + task 추가                                              │
│ ┌──────── + 마일스톤 추가 ──────────┐                     │
│ └──────────────────────────────────┘                      │
│ 기타 ─────────────────────────────                        │
│   □ ARM - 공문 발송                              ⓐ ash    │
│   □ MM 스터디 (from Ethan)                       ⓐ ash    │
│   + task 추가                                              │
└────────────────────────────────────────────────────────────┘
```

### 4-2. B안 (담당자별 그룹)

```
┌─ Lane: 팀 개별 과제 11건                                  ┐
│ ⓞ 미배정 1                                                 │
│   □ 신규 정책 검토                              ■ 대시보드 │
│   + task 추가                                              │
│ ⓡ Ryan 3                                                   │
│   □ 1분기 NDR 자료 준비                       ■ 1분기 NDR │
│   □ 수주/매출 현황 업데이트                    ■ 1분기 NDR │
│   □ 주주명부 요약 업데이트                     ■ 1분기 NDR │
│   + task 추가                                              │
│ ⓔ Edmond 3                                                 │
│   □ MM                                          ■ MM 업무 │
│   □ 조직개편 사항 적용                          ■ MM 업무 │
│   □ 규정 개정                                   ■ 기타    │
│   + task 추가                                              │
│ ⓐ ash 3                                                    │
│   □ ARM - 공문 발송                             ■ 기타    │
│   □ 각종 자료 대시보드화                        ■ 대시보드 │
│   □ MM 스터디 (from Ethan)                      ■ 기타    │
│   + task 추가                                              │
└────────────────────────────────────────────────────────────┘
```

> B안에는 dashed `+ 마일스톤 추가` 슬롯이 없음. MS 추가는 C안으로 전환 후 가능 (또는 detail panel).

### 4-3. MS 그룹 헤더 스타일

10a MilestoneRow 재사용:
- 배경: `hexToRgba(accentColor, 0.13)`
- accent bar: 3px × 14px 프로젝트 dot 색상
- alive/total pill: 10px, 회색
- chevron: 접기/펼치기 (`teamMatrixMsCollapsed[msId]`)
- 인라인 편집: MS 이름 클릭
- 상세 패널 진입: chevron 우측 영역 클릭

### 4-4. task 행 스타일

- UniversalCard 4-zone 적용
- 좌측 checkbox (toggle done)
- title (inline edit, 동적 width)
- 우측 담당자 아바타 배지 (dropdown trigger)
- 행 우측 끝 detail 아이콘 (상세 패널 진입, hover 시 표시)
- non-title 영역 drag handle (DnD)

### 4-5. 담당자 배지 스타일

- MiniAvatar (14px) + 이름 라벨
- 멤버별 색상: `getColorByIndex(memberIndex)`
- 미배정: dashed border, opacity 0.6, "미배정" 라벨
- hover: cursor pointer, 배경 강조

### 4-6. Lane 헤더 참여자 칩

- 형식: `ⓡ 3  ⓔ 3  ⓞ 1  ⓐ 3`
- MiniAvatar (16px) + 카운트
- task 수 내림차순 정렬
- 미배정 task가 있으면 마지막에 `ⓞ 1` (ghost) 추가
- gap: 8px

### 4-7. dashed 마일스톤 추가 슬롯

- 위치: Lane 내 모든 MS 그룹 다음, "기타" 섹션 위
- 스타일:
  - height: 32px, full width (Lane 내부 padding 제외)
  - border: 1px dashed `var(--color-border-tertiary)`
  - border-radius: 6px
  - margin: 6px 14px
  - 텍스트 "+ 마일스톤 추가" (font 12px, text-tertiary, 가운데 정렬)
  - opacity: 0.4 (기본)
- hover:
  - opacity: 1
  - border-color: `var(--color-border-secondary)`
  - color: text-secondary
- 클릭 → 인라인 입력 (MS 이름 입력 → Enter 시 생성)

### 4-8. "기타" 섹션

- 위치: Lane 맨 아래 (dashed 슬롯 다음)
- 헤더: 작은 라벨 "기타" (font 11px, text-tertiary, font-weight 500)
- 배경: `rgba(0,0,0,0.025)` 헤더 행만
- task 표시: MS 그룹과 동일 스타일
- 마지막 task 아래 `+ task 추가` (keyMilestoneId = null로 생성)
- task 0개일 때도 헤더 + `+ task 추가`는 표시

### 4-9. B안 task 행 MS 태그 (D17)

- 위치: 담당자 배지가 있던 우측 자리 (B안에서는 담당자가 sub-section으로 분리되므로)
- 형식: `■ MS이름` (작은 사각형 dot + MS 이름)
- 스타일: font 11px, color text-tertiary, background var(--color-background-secondary), padding 1-6px, border-radius 3px
- MS 미연결: `■ 기타`
- 클릭: 해당 MS detail panel 진입 (선택 사항, 미구현 시 단순 라벨)

---

## 5. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/grid/grids/TeamMatrixGrid.jsx` | **완전 재작성** |
| `src/components/views/UnifiedGridView.jsx` | 토글 state + props + handleDragEnd `tmat:` 분기 정리 |
| `src/components/views/grid/shared/MiniAvatar.jsx` | `color` prop 추가 |
| `src/hooks/useStore.js` | `teamMatrixMsCollapsed` state + toggle action 추가 (D20) |

### 미변경
- `PersonalMatrixGrid.jsx`
- `matrixMsCollapsed` (개인 매트릭스 전용으로 유지)
- DB 스키마

---

## 6. 구현 순서 (R-ATOMIC)

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `feat(team-matrix): replace grid with flat list + MS groups + owner badges (12c-1)` | TeamMatrixGrid 재작성 (C안), MilestoneRow 재사용, max-width 880, 헤더 칩, "기타" 섹션, dashed `+ 마일스톤` 슬롯, MiniAvatar color prop, `teamMatrixMsCollapsed` state |
| 2 | `feat(team-matrix): add group-by-owner toggle with localStorage (12c-2)` | 토글 (C↔B), B안 sub-section + 미배정 그룹 + MS 태그, UnifiedGridView 헤더 |
| 3 | `feat(team-matrix): add owner picker dropdown on badge click (12c-3)` | 아바타 배지 클릭 → 멤버 dropdown, 미배정 ghost 아바타 동일 동작 |

각 커밋:
- REQ-LOCK protocol (요구사항 표 + 검증 표)
- DELETE-5 cascade (1번 커밋 특히 중요 — 기존 5컬럼 grid 코드 완전 삭제)
- npm run build 통과

---

## 7. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | 기존 5컬럼 DnD (`tmat:` prefix) 코드 삭제 후 handleDragEnd 회귀 | DELETE-5 cascade로 `tmat:` 관련 모든 코드 정리, 새 prefix 또는 제거 |
| W2 | CellContent가 새 구조에서 불필요 | TeamMatrixGrid 내부에서만 직접 렌더 (CellContent는 PersonalMatrixGrid 전용으로 유지) |
| W3 | 멤버 색상이 멤버 순서에 의존 | members 배열 정렬을 ID 또는 이름으로 stable 처리 |
| W4 | MS alive/total 진행률이 다른 뷰와 불일치 | DB 원본 기준 (D19) — 모든 task 기준 |
| W5 | dashed 슬롯이 task 영역과 시각적 충돌 | margin + opacity 0.4 기본값으로 노이즈 최소화 |
| W6 | B안 토글 시 MS 태그가 너무 많아 시각적 노이즈 | task 행 우측 작은 pill로 제한, 일관된 위치 |
| W7 | `teamMatrixMsCollapsed` 신규 state — 스냅샷 저장/복원 누락 | 12a의 collapseState 패턴과 동일하게 snapshot save/restore에 포함 |
| W8 | 회의 중 실시간 동기화 — 10초 폴링 | 기존 동작 유지 (변경 없음) |

---

## 8. QA 체크리스트

### 기본 동작 (C안)
- [ ] 팀 매트릭스: 플랫 리스트 (max-width 880, 가운데 정렬)
- [ ] Lane 헤더 참여자 칩 — task 수 내림차순
- [ ] 미배정 task가 있으면 헤더 칩 마지막에 ghost 칩 표시
- [ ] MS 그룹 헤더 (accent bar, alive/total, 접기/펼치기)
- [ ] MS alive/total 카운트가 DB 전체 기준
- [ ] MS 그룹 내부 task 정렬: sortOrder ASC
- [ ] MS 그룹 내부 마지막 위치 `+ task 추가`
- [ ] dashed `+ 마일스톤 추가` 슬롯 (모든 MS 다음)
- [ ] dashed 슬롯 hover 시 강조 (opacity 0.4 → 1)
- [ ] "기타" 섹션 (MS 미연결 task)
- [ ] "기타" 섹션 내부 `+ task 추가`
- [ ] task 우측 담당자 아바타 배지 (멤버별 색상)
- [ ] 미배정 task → ghost 아바타 (dashed border)

### 인라인 편집 / 상세 패널
- [ ] task 인라인 편집 (동적 width, ESC/Enter)
- [ ] MS 인라인 편집 (동적 width, ESC/Enter)
- [ ] task detail 아이콘 클릭 → 우측 패널 진입
- [ ] MS 우측 영역 클릭 → 우측 패널 (MilestoneSelector 모드)
- [ ] UniversalCard 4-zone 동작 (title/non-title/checkbox/arrow)

### 추가 동선
- [ ] MS 내부 `+ task` → 해당 MS에 task 생성
- [ ] dashed 슬롯 클릭 → 인라인 MS 이름 입력
- [ ] "기타" 섹션 `+ task` → keyMilestoneId = null
- [ ] B안 sub-section `+ task` → 해당 담당자 자동 배정 + MS 없음

### 토글 (B안)
- [ ] 토글 ON → 담당자별 sub-section
- [ ] localStorage `teamMatrixGroupByOwner` 저장 (새로고침 유지)
- [ ] 첫 sub-section: "미배정 (N)"
- [ ] sub-section 정렬: 미배정 → task 수 내림차순
- [ ] task 행 우측 MS 태그 (`■ MS이름`)
- [ ] MS 미연결 task → `■ 기타`
- [ ] B안 sub-section 끝 `+ task 추가` 동작
- [ ] B안에는 dashed `+ 마일스톤` 슬롯 없음

### 담당자 변경
- [ ] 아바타 배지 클릭 → 멤버 dropdown
- [ ] 미배정 ghost 아바타 클릭 → 동일 dropdown
- [ ] 담당자 변경 → assignee_id 업데이트, 즉시 반영

### 상태 분리
- [ ] `teamMatrixMsCollapsed`가 `matrixMsCollapsed`(개인)와 분리 동작
- [ ] 팀 매트릭스에서 MS 접기 → 개인 매트릭스 영향 없음
- [ ] 스냅샷 저장/복원에 `teamMatrixMsCollapsed` 포함

### 회귀
- [ ] 개인 매트릭스 정상 (회귀 없음)
- [ ] Lane DnD (프로젝트 순서) 정상 (12b)
- [ ] 12a 집중 모드 — 팀 매트릭스에는 적용 안 됨 확인
- [ ] `tmat:` prefix 코드 완전 정리 (DELETE-5)
- [ ] `npm run build` 통과
