# Phase 10a Spec (Final) — 매트릭스 MS 시각 강화

> 작성일: 2026-04-09
> 상태: **확정** (목업 + 7개 추가 결정 전부 반영)
> 선행: `10a-recon.md`, `10a-spec.md` (초안)
> 의존: 없음 (9a/9b와 독립 진행 가능)

---

## 1. 목표

1. **개인 매트릭스**: MS를 모든 카테고리 컬럼(today/next/later)에서 표시 (팀 매트릭스와 일관)
2. **매트릭스 전체**: MS 행을 시각적 앵커로 강화 — 배경 + accent bar + 카운트 + 들여쓰기
3. **가로 정렬**: 동일 프로젝트 행 내 모든 셀에서 MS 표시 순서 통일

---

## 2. 확정 결정사항 (전부 lock)

### 초안 결정 (D1~D7)

| # | 항목 | 결정 |
|---|------|------|
| D1 | 개인 매트릭스 MS 표시 | 모든 컬럼에서 표시 |
| D2 | InlineMsAdd | today 컬럼만 유지 |
| D3 | MS 행 배경 | 항상 표시 (`#F1EFE8` = gray 50) |
| D4 | MS 하위 task 들여쓰기 | 22px (accent + chevron 정렬) |
| D5 | 접기/펼치기 | 기존 유지 |
| D6 | DB 변경 | 없음 |
| D7 | 주간 플래너 영향 | 없음 |

### 추가 결정 (D8~D14)

| # | 항목 | 결정 |
|---|------|------|
| D8 | Owner 아바타 | **추가 안 함** (10a 범위 외) |
| D9 | MS 제목 클릭 | **인라인 편집** |
| D10 | DetailPanel 진입 경로 | **별도 추가** — chevron과 제목 사이에 작은 `›` 버튼 또는 행 hover 시 우측 끝에 detail 아이콘 |
| D11 | 빈 MS 그룹 (셀에 task 0개) | **회색 처리하여 표시** (숨김 X) |
| D12 | 카운트 기준 | **`살아있는 할일 / 전체 할일`** = `(M - done) / M`. MS 절대 진척도 (셀 컨텍스트 무관) |
| D13 | 카운트 색상 | **회색 단일** (단계별 색 없음) |
| D14 | DnD 호환 | **10a에서 준비 안 함, 완전히 분리.** 10b 또는 9b 후속 loop에서 |
| D15 | 가로 정렬 | **`sortOrder` ASC 통일** — 동일 프로젝트 행 내 모든 셀에서 MS 순서 일치 |
| D16 | Accent bar | 내부 3px×14px div, 프로젝트 dot 색상 (border-left 금지 우회) |
| D17 | ungrouped task 섹션 | "기타" 9px uppercase 라벨로 분리 |

---

## 3. 기능 범위

### 3-1. IN SCOPE

1. **`PersonalMatrixGrid` 모든 컬럼 MS 전달**
   - line 65: `cat.key === 'today'` 조건 제거
   - line 106: `InlineMsAdd`는 `cat.key === 'today'` 조건 유지

2. **`MilestoneRow` 시각 강화**
   - 배경: `#F1EFE8` 항상, hover 시 `#E8E6DD` 정도
   - Accent bar: 내부 첫 요소 3px×14px div, 프로젝트 dot 색상
   - 폰트: 12px / weight 500
   - 패딩: 5px 8px 5px 5px
   - chevron: ▾/▸ (10px, text-secondary)
   - 카운트 badge: `N/M` (10px, 회색 pill)
   - **제목 영역 클릭 → 인라인 편집** (기존 task 인라인 편집 패턴 재사용)
   - **detail 진입 버튼**: 행 hover 시 우측 끝 `›` 버튼 등장 → 클릭 시 `openDetail(milestone)`
   - chevron 클릭 → 토글만 (편집 X)

3. **`CellContent` 들여쓰기 + 빈 MS + 가로 정렬**
   - MS 하위 task 렌더 시 `paddingLeft: 22`
   - ungrouped 섹션에 "기타" 라벨 추가
   - **빈 MS 그룹** (`tasks.length === 0`) → MS 행만 렌더 + opacity 0.5 또는 text-tertiary
   - **MS 정렬**: 프로젝트 행 내 모든 셀이 동일한 `sortOrder` 기준 사용

4. **`milestoneProgress` 유틸 신규** (`src/utils/milestoneProgress.js`)
   - `computeMilestoneCount(milestoneId, allTasks)` → `{ alive, total }`
   - `alive = M - done - deleted`
   - `total = 모든 task (done 포함, deleted 제외)`
   - pure function, 테스트 가능

5. **빈 상태 처리** (D11)
   - 빈 MS 행: `opacity: 0.5`, accent bar/배경 모두 동일 색이지만 약하게
   - 카운트도 0/M로 표시 (회색 그대로)

### 3-2. OUT OF SCOPE

- Owner 아바타 (D8)
- DnD drop target (D14, 10b로 분리)
- 카운트 색상 세분화 (D13)
- DetailPanel UI 자체 변경 (진입 경로만 추가)
- 셀 내부 스크롤 처리
- 주간 플래너 / 프로젝트 뷰 변경

---

## 4. UI 사양

### 4-1. MS 행 (펼친 상태)

```
┌──────────────────────────────────────┐
│ |▾ 법인설립             1/4       › │  ← 배경 #F1EFE8, accent 3px, hover 시 › 등장
│       □ 대행사 계약                  │  ← paddingLeft: 22
│       □ 필요서류 확보                 │
│       □ 설립등기                     │
│       □ 외국환은행 지정              │
└──────────────────────────────────────┘
```

### 4-2. MS 행 (접힌 상태)

```
┌──────────────────────────────────────┐
│ |▸ 법인설립             1/4         │
└──────────────────────────────────────┘
```

### 4-3. MS 행 (인라인 편집 중)

```
┌──────────────────────────────────────┐
│ |▾ [법인설립_______]    1/4         │  ← input, focus
└──────────────────────────────────────┘
```

### 4-4. 빈 MS 그룹 (D11)

```
┌──────────────────────────────────────┐
│ |▸ 사업자등록           0/3         │  ← opacity 0.5
└──────────────────────────────────────┘
```

### 4-5. 가로 정렬 (D15)

```
프로젝트 행: ABI 코리아
┌────────────┬────────────┬────────────┐
│ 지금        │ 다음        │ 나중        │
├────────────┼────────────┼────────────┤
│ ▾ 법인설립 │ ▸ 법인설립 │ ▸ 법인설립 │ ← sortOrder 1
│ ▸ 사업자등록│ ▸ 사업자등록│            │ ← sortOrder 2 (나중에는 없음)
│ ▸ 회계/세무 │            │ ▸ 직원전적 │ ← sortOrder 3, 4
└────────────┴────────────┴────────────┘
```

- 모든 셀에서 MS는 sortOrder ASC 정렬
- 같은 MS는 같은 가로 라인에 (시각적 정렬)
- 단, 카테고리에 task가 0개여도 MS 자체 정렬 위치는 유지 (빈 MS 회색 표시)

### 4-6. 스타일 토큰

| 요소 | 값 |
|------|-----|
| MS 배경 | `#F1EFE8` (gray 50) |
| MS hover 배경 | `#E8E6DD` (gray 50~100 사이) |
| Accent bar | 3px × 14px, `project.color` |
| MS 제목 | 12px / 500 / `text-primary` |
| chevron | 10px / `text-secondary` |
| 카운트 pill | 10px / 500 / bg `background-primary` / color `text-secondary` |
| Detail `›` 버튼 | 10px / `text-tertiary`, hover 시 visible |
| 빈 MS opacity | 0.5 |
| Task paddingLeft | 22px |
| MS 패딩 | 5px 8px 5px 5px |

---

## 5. 카운트 계산 (D12)

```js
// src/utils/milestoneProgress.js
export function computeMilestoneCount(milestoneId, allTasks) {
  const tasks = allTasks.filter(t => 
    t.keyMilestoneId === milestoneId && !t.deletedAt
  )
  const total = tasks.length
  const alive = tasks.filter(t => !t.done).length
  return { alive, total }
}
```

- 표시: `{alive}/{total}`
- 예: 4개 중 1개 done → `3/4`
- 셀 컨텍스트 무관 (today/next/later 어디에 있어도 동일)
- MS가 여러 셀에 분산되어도 카운트 일관

---

## 6. 영향 파일

### 신규
| 파일 | 역할 |
|------|------|
| `src/utils/milestoneProgress.js` | 카운트 계산 유틸 |

### 수정
| 파일 | 변경 |
|------|------|
| `src/components/views/grid/cells/MilestoneRow.jsx` | 배경, accent, 카운트, 인라인 편집, detail 버튼 |
| `src/components/views/grid/cells/CellContent.jsx` | 들여쓰기 22px, 빈 MS 처리, "기타" 섹션, sortOrder 정렬 |
| `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | 모든 컬럼에 MS 전달, InlineMsAdd는 today만 |

### 수정 없음
- DB / RLS
- 주간 플래너 / 프로젝트 뷰 / 타임라인
- DetailPanel (`openDetail` 호출만)
- 9a/9b 컴포넌트
- `useStore` (`updateMilestone`, `openDetail` 이미 존재)

---

## 7. 기술 제약 & 리스크

| # | 리스크 | 영향 | 대응 |
|---|--------|------|------|
| R1 | Vite TDZ | 모듈 레벨 const 참조 | 모든 스타일 컴포넌트 함수 내부 inline |
| R2 | MilestoneRow 인라인 편집 신규 도입 | 기존 동작 회귀 | 기존 task 인라인 편집 hook/패턴 재사용 (UniversalCard 4-zone 규칙 준수) |
| R3 | 가로 정렬 sortOrder 의존 | 일부 MS에 sortOrder 없으면 정렬 깨짐 | fallback: `sortOrder ?? Number.MAX_SAFE_INTEGER` |
| R4 | 빈 MS opacity 0.5가 hover 시 dim 지속 | 시각 결함 | hover 시 opacity 1로 복원 |
| R5 | chevron 클릭 영역과 제목 클릭 영역 분리 | 잘못된 영역 클릭 시 의도와 다른 동작 | chevron은 명시적 button, 제목은 별도 클릭 핸들러, detail 버튼은 우측 끝 별도 button |
| R6 | 셀 내 스크롤 부재 + dense MS 시 셀 폭주 | 시각 결함 | 10a 범위 외 (현재 동작 유지). 후속 loop에서 처리 |
| R7 | 인라인 편집 중 chevron/detail 버튼 클릭 | 편집 취소 + 동작 충돌 | 편집 모드일 때 chevron/detail 비활성화 |

---

## 8. 구현 순서 (R-ATOMIC)

| # | 커밋 | 목적 |
|---|------|------|
| 1 | `feat: add milestoneProgress util` | pure 유틸, 테스트 가능 |
| 2 | `feat: enhance MilestoneRow visual (bg + accent + count)` | 배경/accent/카운트만, 인터랙션 변경 X |
| 3 | `feat: add inline edit + detail entry to MilestoneRow` | 제목 클릭 편집 + 우측 detail 버튼 |
| 4 | `feat: indent tasks under MS in CellContent` | paddingLeft 22 + "기타" 섹션 |
| 5 | `feat: show empty MS groups in gray` | 빈 MS opacity 0.5 |
| 6 | `feat: align MS by sortOrder across cells` | 가로 정렬 |
| 7 | `feat: show MS in all columns of PersonalMatrixGrid` | today 제한 제거, InlineMsAdd는 today만 |

각 커밋 독립 빌드 + UI 회귀 없음.

---

## 9. QA 체크리스트

### 9-1. 개인 매트릭스
- [ ] today/next/later 모두에서 MS 그룹 표시
- [ ] InlineMsAdd는 today에만 표시
- [ ] 같은 MS가 여러 컬럼에 분산되어도 카운트 동일
- [ ] 가로 정렬: 동일 프로젝트 행에서 MS sortOrder 순서 통일

### 9-2. 팀 매트릭스
- [ ] MS 행 시각 강화 적용
- [ ] 가로 정렬 적용 (동일 프로젝트 행에서)

### 9-3. MilestoneRow 시각
- [ ] 배경 #F1EFE8 항상 표시
- [ ] hover 시 약간 진한 배경
- [ ] 좌측 3px accent bar 프로젝트 색상
- [ ] 카운트 N/M 표시 (회색)
- [ ] 빈 MS opacity 0.5
- [ ] hover 시 빈 MS opacity 1 복원

### 9-4. 인터랙션 (D9, D10)
- [ ] chevron 클릭 → 접기/펼치기
- [ ] 제목 클릭 → 인라인 편집 시작
- [ ] 인라인 편집 Enter → 저장
- [ ] 인라인 편집 Esc → 취소
- [ ] 행 hover 시 우측 `›` 버튼 등장
- [ ] `›` 클릭 → openDetail(milestone)
- [ ] 편집 중 chevron/detail 비활성화

### 9-5. CellContent
- [ ] MS 하위 task paddingLeft 22
- [ ] ungrouped task에 "기타" 라벨
- [ ] MS 정렬 sortOrder ASC

### 9-6. 회귀 (⭐)
- [ ] 주간 플래너 정상 동작 (MilestoneRow 영향 없음)
- [ ] 프로젝트 뷰 정상 동작
- [ ] 타임라인 정상 동작
- [ ] DetailPanel 정상 동작
- [ ] 9a/9b 머지 후에도 충돌 없음 (병렬 진행 가능)

### 9-7. 빌드
- [ ] `npm run build` 성공
- [ ] Vite TDZ 오류 없음

---

## 10. REQ-LOCK 체크리스트

- [ ] D1~D17 17개 결정 사항 전부 반영
- [ ] IN SCOPE 5개 항목 전부 diff 포함
- [ ] OUT OF SCOPE 6개 항목 diff 미포함
- [ ] §8 7 커밋 각각 독립 빌드
- [ ] §9 7개 카테고리 QA 전부 통과

---

## 11. 9a/9b/10b와의 관계

| Phase | 의존 | 노트 |
|-------|------|------|
| 9a (MS Owner UI) | 독립 | 10a는 owner 아바타 미사용 (D8) |
| 9b (BacklogPanel) | 독립 | 10a는 BacklogPanel 영향 없음 |
| 10b (매트릭스 DnD drop target) | **10a 머지 후** | MilestoneRow 마크업이 dnd-kit 호환되도록 후속 작업 |

→ **10a는 9a/9b와 병렬 진행 가능.** 단일 개발자라면 순서 자유.

---

## 12. 다음 단계

1. 이 스펙으로 §8 R-ATOMIC 7 커밋 diff 작성
2. 각 커밋 apply + build + commit
3. §9 QA 수행
4. 10b 후속 (DnD drop target) 검토 — 9b 머지 후
