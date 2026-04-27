# Phase 10a Recon — 매트릭스 MS 시각 강화 + 개인 매트릭스 MS 전체 컬럼 표시

> 작성일: 2026-04-09
> 상태: 조사 완료

---

## 1. 요구사항 요약

1. **개인 매트릭스**: MS를 'today' 컬럼에서만 → **모든 컬럼에서 표시** (팀 매트릭스와 동일)
2. **매트릭스 전체 (개인+팀)**: MS 행을 **시각적으로 강조** — 배경색 + 접이식 그룹 헤더

---

## 2. 현재 상태 분석

### 2-1. 개인 매트릭스 MS 제한

**PersonalMatrixGrid.jsx line 65**:
```js
const cellMs = cat.key === 'today' ? projMyMilestones : null
```
- `today` 컬럼만 MS 전달 → `next`, `later` 컬럼은 MS 없이 flat task 목록

**InlineMsAdd도 today만** (line 106):
```js
{cat.key === 'today' && <InlineMsAdd onClick={handleAddMsForCell} />}
```

### 2-2. MilestoneRow 현재 스타일

- 배경: `hover && interactive ? COLOR.bgHover : 'transparent'` — **기본 투명**
- 텍스트: `fontSize: 11, fontWeight: 600, color: COLOR.textSecondary`
- Bullet: 5x5px 원, `COLOR.textTertiary`
- task와 크기/여백이 비슷 → **시각적 구분 약함**

### 2-3. 접기/펼치기

이미 존재:
- `collapseState.matrixMs[msId]` — true면 접힘
- `toggleMatrixMsCollapse(msId)` — 토글
- CellContent line 130: `{!msCollapsed && g.tasks.map(...)}`
- MilestoneRow: chevron 회전 애니메이션

### 2-4. CellContent 그룹 렌더 구조

```
CellContent
├─ msGroups[] → MilestoneRow + tasks (접힘 가능)
├─ ungrouped[] → TaskRow (구분선 후)
└─ done[] → DoneSection (접힘 가능)
```

---

## 3. 변경 범위

### 변경 1: 개인 매트릭스 MS 전체 컬럼 표시

**PersonalMatrixGrid.jsx**:
- line 65: `cat.key === 'today'` 조건 제거 → 모든 컬럼에 `projMyMilestones` 전달
- line 106: InlineMsAdd도 모든 컬럼에 표시 (또는 today만 유지 — 결정 필요)

### 변경 2: MilestoneRow 시각 강화

**MilestoneRow.jsx** 스타일 변경:
- **배경색**: 연한 프로젝트 색상 or 고정 회색 배경 (항상, hover 아닐 때도)
- **좌측 accent**: 프로젝트 dot 색상 3px bar (단, CLAUDE.md border-left 금지 → padding-left + pseudo 또는 내부 div)
- **패딩/마진**: task보다 약간 더 큰 여백
- **카운트 badge**: 숫자 배경 pill
- **접기 시 요약**: `▸ 법인설립 (4)` 형태로 compact

### 변경 3: Task 들여쓰기

**CellContent.jsx** — MS 하위 task에 왼쪽 들여쓰기 추가:
- line 130-132: task 렌더 시 `paddingLeft: 14` 추가

---

## 4. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | MilestoneRow.jsx 수정 → 매트릭스+주간+프로젝트 뷰 모두 영향 | MilestoneRow는 매트릭스 셀 전용. 주간은 CellContent 경유이므로 영향 없음 확인 |
| W2 | CLAUDE.md border-left 금지 | border-left 대신 내부 div로 accent bar |
| W3 | 개인 매트릭스 InlineMsAdd 전체 컬럼 확장 시 next/later에서 MS 생성 시 owner_id 설정 | 기존 handleAddMsForCell이 userId를 owner로 설정하므로 무관 |
| W4 | 접힌 상태에서 셀이 너무 작아짐 | 최소 높이 보장 |

---

## 5. 영향 파일

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/components/views/grid/cells/MilestoneRow.jsx` | 수정 | 배경색, accent, 패딩, badge 강화 |
| `src/components/views/grid/cells/CellContent.jsx` | 수정 | MS 하위 task 들여쓰기 |
| `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | 수정 | `cat.key === 'today'` 조건 제거 |
