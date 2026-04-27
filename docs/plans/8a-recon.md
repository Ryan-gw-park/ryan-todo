# Phase 8-A Recon — Weekly Grid Multi-Day Span

> 작성일: 2026-04-09
> 기준: `loop-7-handoff-to-claude-code.md` §Sub-Loop 8-A
> 상태: 조사 완료

---

## 1. 요구사항 요약

> "개인/팀 주간 플래너 화면에서 과제 별 시작일~마감일을 설정하면, 과제가 마감일에 들어가짐 → 시작일~마감일 기간처럼 표시되면 좋을 것 같습니다"

**현재**: task는 `dueDate` 셀에만 표시. `startDate`는 무시됨.
**목표**: `startDate ~ dueDate` 기간에 해당하는 모든 요일 셀에 task가 span으로 표시.

---

## 2. 현재 상태 분석

### 2-1. 주간 그리드 구조

**PersonalWeeklyGrid.jsx** (88줄):
- 행=프로젝트, 열=요일 (월~금 5일)
- 그리드: `gridTemplateColumns: '160px repeat(5, 1fr)'`
- task 필터: `t.dueDate === ds` (정확히 해당 날짜만)
- `startDate` 완전 미사용

**TeamWeeklyGrid.jsx** (71줄):
- 행=팀원, 열=요일 (월~금 5일)
- 동일한 `t.dueDate === ds` 필터
- `startDate` 완전 미사용

### 2-2. 셀 렌더링 체인

```
Grid (PersonalWeekly/TeamWeekly)
  → 날짜별 task 필터 (dueDate === ds)
  → DroppableCell (dnd-kit drop zone)
    → CellContent (task 그룹핑 + 렌더)
      → TaskRow (개별 task 렌더)
```

### 2-3. 데이터 모델

task 객체에 `startDate`와 `dueDate` 모두 존재:
```js
{ startDate: '2026-04-07', dueDate: '2026-04-10', ... }
```

- `startDate`: 있으면 시작일, 없으면 미설정
- `dueDate`: 있으면 마감일, 없으면 미설정
- 둘 다 `YYYY-MM-DD` string

### 2-4. 현재 주간 5일 (월~금)

- `DAY_LABELS = ['월', '화', '수', '목', '금']`
- 토/일 미포함 → 기간에 토/일 포함 시 건너뜀 (금 → 월)

---

## 3. 구현 옵션

### 옵션 A: 셀 내부 segment bar (권장)

각 셀 안에 task bar segment를 그리고, 연결된 날짜의 bar가 시각적으로 이어지는 효과:
- 시작 셀: `border-radius: left-rounded`, 텍스트 표시
- 중간 셀: flat bar (텍스트 없음)
- 끝 셀: `border-radius: right-rounded`
- 단일 날짜: 양쪽 rounded

```
[월        ][화        ][수        ][목        ][금        ]
[■■■ 법인설립 ■■■■■■■■■■■■■■■■■■■■■■■■■ 법인설립 끝 ■■■]
[                  ][■ 도장 제작 ■■■■■■■■■■■][          ]
```

**구현**:
1. task 필터 변경: `startDate <= ds <= dueDate` (또는 `dueDate === ds` fallback)
2. 각 task에 position 메타데이터 추가: `{ isStart, isEnd, isMiddle, isSingle }`
3. CellContent/TaskRow에서 position에 따라 bar 스타일 분기
4. 체크박스/편집은 `isStart`일 때만 표시

**장점**: 기존 grid 구조 유지, CSS만 추가
**단점**: 셀 간 bar 높이 정렬이 복잡 (같은 행에서 task 순서가 셀마다 다를 수 있음)

### 옵션 B: 각 셀에 task 중복 표시 (simple)

기간에 해당하는 모든 셀에 동일 task를 표시하되, 시각적으로 "기간" 느낌만 줌.

```
[월        ][화        ][수        ][목        ][금        ]
[법인설립   ][법인설립   ][법인설립   ][법인설립   ][법인설립   ]
```

**구현**:
1. task 필터만 변경: `startDate <= ds <= dueDate`
2. 중복 task에 `isStart`일 때만 체크박스, 나머지는 라벨만
3. key를 `${task.id}:${ds}`로

**장점**: 구현 매우 간단 (필터 변경 + key 변경만)
**단점**: 시각적으로 span 느낌이 약함, 중복 텍스트

### 옵션 C: CSS Grid span (absolute positioning)

task를 시작 셀에만 렌더하되, `position: absolute`로 여러 셀에 걸쳐 bar를 그림.

**장점**: Gantt 차트 느낌
**단점**: 높이 계산 매우 복잡, 셀 overflow 문제, 다른 task와 겹침

---

## 4. 재사용 가능한 함수/패턴

| 항목 | 소스 | 용도 |
|------|------|------|
| `fmtDate(d)` | constants.js | 날짜 → YYYY-MM-DD 변환 |
| `getMonday(d)` | constants.js | 주의 월요일 계산 |
| `DAY_LABELS` | constants.js | 요일 라벨 |
| `DroppableCell` | shared/DroppableCell.jsx | dnd-kit drop zone (재사용) |
| `CellContent` | cells/CellContent.jsx | task 그룹핑 렌더 |
| `TaskRow` | cells/TaskRow.jsx | 개별 task 렌더 |
| designTokens | styles/designTokens.js | COLOR, FONT 상수 |

---

## 5. 위험 요소 및 사전 확인

### 결정 필요사항

1. **옵션 A/B/C 선택** — handoff는 옵션 A 권장
2. **토/일 처리**: 현재 5일(월~금)만. 기간에 토/일이 포함되면?
   - (a) 무시하고 금→월로 이어짐 (권장: 주간 플래너는 업무일 기준)
   - (b) 7일로 확장
3. **dueDate 없이 startDate만 있는 task**: startDate 셀에만 표시? 무한 span?
4. **startDate/dueDate 모두 없는 task**: 현재 동작 유지 (`category === 'today' && ds === todayStr`)
5. **체크박스 위치**: span task에서 체크박스를 어디에? 시작 셀만? 모든 셀?
6. **DnD**: span task를 drag하면? 어느 셀 기준?

### 위험

| # | 위험 | 대응 |
|---|------|------|
| W1 | 셀 간 bar 높이 불일치 | task 순서를 sortOrder 기준 통일 |
| W2 | CellContent의 milestone 그룹핑과 span 충돌 | span task는 milestone 그룹과 별도 섹션으로 처리하거나, 그룹 내에서 span 표시 |
| W3 | DnD에서 span task 처리 | span의 시작 셀만 drag 소스로 처리 |
| W4 | 매트릭스 뷰 영향 | 주간 전용 변경이므로 매트릭스 무관, but CellContent/TaskRow 수정 시 주의 |

---

## 6. 영향 파일

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/components/views/grid/grids/PersonalWeeklyGrid.jsx` | 수정 | task 필터 변경 (startDate~dueDate 범위), position 메타데이터 |
| `src/components/views/grid/grids/TeamWeeklyGrid.jsx` | 수정 | 동일 변경 |
| `src/components/views/grid/cells/CellContent.jsx` | 수정 또는 무변경 | 옵션에 따라 span 렌더 추가 |
| `src/components/views/grid/cells/TaskRow.jsx` | 수정 또는 무변경 | span position에 따른 스타일 분기 |
| `src/utils/weeklySpan.js` | **신규** (handoff 제안) | task 필터 + position 계산 유틸 |
