# Phase 8-A Spec (Final) — Weekly Grid Multi-Day Span

> 작성일: 2026-04-09
> 상태: **확정**
> 선행: `8a-recon.md`

---

## 1. 목표

주간 플래너에서 `startDate ~ dueDate` 기간이 있는 task를 **셀 내부 segment bar**로 여러 날에 걸쳐 표시한다.

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | 구현 방식 | **옵션 A**: 셀 내부 segment bar (시작/중간/끝 rounded) |
| D2 | 토/일 처리 | 금→월로 자연스럽게 이어짐 (주말 건너뜀, 5일 그리드 유지) |
| D3 | 체크박스 | **시작 셀에만** 체크박스 표시 |
| D4 | startDate만, dueDate 없음 | **startDate 셀에만** 표시 (단일 날짜) |
| D5 | dueDate만, startDate 없음 | 기존 동작 유지 (dueDate 셀에만, 단일 날짜) |
| D6 | 둘 다 없음 | 기존 동작 유지 (`category === 'today' && todayStr`) |
| D7 | 텍스트 표시 | 시작 셀에만 task 텍스트 표시, 중간/끝 셀은 bar만 |
| D8 | DnD | span task의 시작 셀만 drag 소스 |
| D9 | DB 변경 | 없음 |
| D10 | 매트릭스 뷰 | 영향 없음 (주간 전용 변경) |

---

## 3. 기능 범위

### 3-1. Task 필터 변경

기존: `t.dueDate === ds`
변경:
```
if (startDate && dueDate) → startDate <= ds <= dueDate (주중 날짜만)
if (startDate && !dueDate) → startDate === ds
if (!startDate && dueDate) → dueDate === ds
if (!startDate && !dueDate) → category === 'today' && ds === todayStr
```

### 3-2. Position 메타데이터

각 task-day 조합에 position 정보 추가:
```js
{
  task,
  position: 'single' | 'start' | 'middle' | 'end',
  spanDays: number, // 이번 주 내 걸치는 일수
}
```

### 3-3. Segment Bar 스타일

| position | 좌측 | 우측 | 체크박스 | 텍스트 | 배경 |
|----------|------|------|---------|--------|------|
| `single` | rounded | rounded | O | O | 프로젝트 dot 색상 10% |
| `start` | rounded | flat | O | O | 프로젝트 dot 색상 10% |
| `middle` | flat | flat | X | X | 프로젝트 dot 색상 10% |
| `end` | flat | rounded | X | X | 프로젝트 dot 색상 10% |

Bar 높이: 24px, border-radius: 4px (rounded 쪽만)

### 3-4. key 전략

span task가 여러 셀에 등장하므로: `key={task.id}:${ds}`

### 3-5. 빈 상태

span task가 셀을 채우더라도 `middle`/`end` 셀에서는 "—" placeholder 미표시.

---

## 4. UI 사양

### 4-1. Segment Bar 시각

```
[월           ][화           ][수           ][목           ][금           ]
[□ 법인설립 ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■]
[             ][□ 도장 제작 ■■■■■■■■■■■■■■■■■■■■■][                    ]
[□ 개별 task  ][             ][             ][             ][□ 단일 task  ]
```

- start: `borderRadius: '4px 0 0 4px'`, 체크박스 + 텍스트
- middle: `borderRadius: 0`, bar만
- end: `borderRadius: '0 4px 4px 0'`, bar만 (또는 짧은 텍스트 필요 시)
- single: `borderRadius: 4`, 체크박스 + 텍스트 (기존과 동일)

### 4-2. Bar 색상

프로젝트 dot 색상 기반 (opacity 0.12):
```js
background: `${project.dotColor}1F` // hex + 12% alpha
```
Bar 좌측에 3px 두께의 세로 indicator (시작 셀만):
```js
borderLeft: `3px solid ${project.dotColor}` // start + single만
```

---

## 5. 영향 파일

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/utils/weeklySpan.js` | **신규** | task→day 매핑 + position 계산 |
| `src/components/views/grid/grids/PersonalWeeklyGrid.jsx` | 수정 | 필터 → weeklySpan 사용 |
| `src/components/views/grid/grids/TeamWeeklyGrid.jsx` | 수정 | 동일 |
| `src/components/views/grid/cells/TaskRow.jsx` | 수정 | position prop에 따른 segment bar 스타일 |

CellContent.jsx는 무변경 (tasks 배열만 받으므로).

---

## 6. 구현 순서

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `feat(utils): add weeklySpan util` | getTasksForDay 함수 |
| 2 | `feat(weekly): add segment bar style to TaskRow` | position prop + bar 스타일 |
| 3 | `feat(weekly): integrate multi-day span in PersonalWeeklyGrid` | 필터 교체 |
| 4 | `feat(weekly): integrate multi-day span in TeamWeeklyGrid` | 필터 교체 |

---

## 7. QA 체크리스트

- [ ] startDate + dueDate 모두 있는 task → 기간 내 모든 주중 날짜에 bar 표시
- [ ] startDate만 있는 task → startDate 셀에만 표시 (단일)
- [ ] dueDate만 있는 task → dueDate 셀에만 표시 (단일, 기존 동작)
- [ ] 둘 다 없는 task → category 기반 표시 (기존 동작)
- [ ] 시작 셀: 체크박스 + 텍스트 + left-rounded bar
- [ ] 중간 셀: bar만 (flat 양쪽)
- [ ] 끝 셀: bar만 + right-rounded
- [ ] 단일 날짜: 양쪽 rounded + 체크박스 + 텍스트
- [ ] 금→월 주말 건너뛰기 정상
- [ ] 주를 넘어가는 기간: 해당 주에 걸치는 부분만 표시
- [ ] DnD: span task drag 정상 (시작 셀)
- [ ] 매트릭스 뷰 회귀 없음
- [ ] `npm run build` 성공
