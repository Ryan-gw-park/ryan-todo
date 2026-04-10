# Phase 12a Recon — 개인 매트릭스 Lane UI 개편

> 작성일: 2026-04-10
> 상태: 조사 완료

---

## 1. 요구사항 요약

1. **표 형식 → 프로젝트별 Lane (카드형)** 전환
2. **지금 할일 컬럼 시각 강조** (배경 tint + 폰트 강조)
3. **집중 모드 토글** (상단 버튼 → 다음/나중 접기, today만 전폭 표시)
4. 프로젝트 Lane 접기/펼치기 (기존 projectCollapsed 재사용)

Phase 12b(프로젝트 순서 커스터마이징)는 별도 phase.

---

## 2. 현재 상태 분석

### 2-1. PersonalMatrixGrid.jsx (현재)

- **CSS Grid**: `gridTemplateColumns: '160px repeat(3, 1fr)'`
- **구조**: 모든 프로젝트 × 카테고리가 단일 grid
- **행**: 각 프로젝트 1행 (헤더 셀 + 3 카테고리 셀)
- **하나의 큰 표**에 모든 프로젝트가 섞여 있음
- 프로젝트 접기: `collapseState.personalMatrix[pid]` — 이미 존재
- 축소 시 카테고리 셀은 `{count}건`만 표시

### 2-2. CATS

```js
[
  { key: 'today', label: '지금 할일', color: '#E53E3E' },
  { key: 'next', label: '다음', color: '#D69E2E' },
  { key: 'later', label: '나중', color: '#3182CE' },
]
```

### 2-3. 기존 collapseState

- `collapseState.personalMatrix[projectId]` — 프로젝트 접기 (이미 존재, 재사용)
- `collapseState.matrixMs[msId]` — MS 접기
- `collapseState.matrixDone[pid]` — done 섹션 접기

### 2-4. UnifiedGridView 통합

- PersonalMatrixGrid에 collapsed, toggleCollapse, matrixMsCollapsed 등 props 전달
- 스토어는 이미 `toggleCollapse('personalMatrix', pid)` 지원

---

## 3. 구현 방향

### 3-1. Lane 카드 레이아웃

현재 단일 CSS Grid → **각 프로젝트마다 독립 div (카드)** 로 전환

```jsx
{projects.map(proj => (
  <ProjectLane key={proj.id}>
    {/* 프로젝트 헤더: dot + 이름 + 카운트 + 접기 버튼 */}
    <LaneHeader ... />
    {/* 카테고리 3컬럼 grid (카드 내부) */}
    {!isCollapsed && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {CATS.map(cat => <CellContent ... />)}
      </div>
    )}
  </ProjectLane>
))}
```

**카드 스타일**:
- `background: #fff`, `border: 1px solid #e8e6df`, `borderRadius: 10`
- 하단 `marginBottom: 16`
- 헤더 padding `10px 14px`
- 내부 3컬럼 grid padding `8px 14px`

### 3-2. 카테고리 헤더 (lane 상단)

현재 모든 프로젝트가 공유하는 카테고리 헤더 → **sticky** 또는 **첫 카드 내부**

**옵션**:
- A. sticky 카테고리 헤더 (스크롤해도 상단 고정)
- B. 각 카드 내부에 카테고리 헤더 반복
- C. 카드 외부 상단에 한 번만 표시 (현재와 유사하되 카드와 정렬)

→ **권장**: 옵션 C — 외부에 sticky 헤더 1개

### 3-3. 지금 할일 강조

- today 컬럼 배경: 연한 적색 tint `rgba(229, 62, 62, 0.04)`
- today 헤더 폰트: `fontWeight: 700`, `color: #E53E3E`
- today task: 기본 스타일 유지, 나머지는 약간 연하게

### 3-4. 집중 모드 토글

- 매트릭스 상단 (카테고리 헤더 옆) 토글 버튼
- state: `focusMode` (local state, 페이지 내부만)
- 활성 시: next/later 컬럼 숨김, today 컬럼이 전폭 차지
- Grid: `gridTemplateColumns: focusMode ? '1fr' : 'repeat(3, 1fr)'`

---

## 4. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | **대규모 수정** — Grid 구조 변경, Lane 카드화 |
| `src/components/views/grid/shared/ProjectCell.jsx` | 수정 또는 신규 `LaneHeader.jsx` |
| `src/components/views/UnifiedGridView.jsx` | focusMode state 추가 (선택) |

단일 파일 수정 또는 LaneHeader 신규 1개 추가.

---

## 5. 재사용 가능

| 항목 | 소스 | 용도 |
|------|------|------|
| `projectCollapsed` state | 기존 store | Lane 접기 |
| `CellContent` | 기존 | 카테고리 셀 내용 |
| `ProjectCell` → `LaneHeader` | 리팩터 | 프로젝트 헤더 |
| `DroppableCell` | 기존 | drop zone 유지 |
| `InlineAdd`, `InlineMsAdd` | 기존 | 인라인 추가 |

---

## 6. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | 기존 DnD (cell-task, cell-ms) 동작 유지 | DroppableCell은 그대로, grid 구조만 변경 |
| W2 | 팀 매트릭스는 변경 안 함 (이 phase는 개인만) | TeamMatrixGrid는 건드리지 않음 |
| W3 | projectCollapsed 기존 동작 깨짐 | `collapseState.personalMatrix` key 그대로 사용 |
| W4 | 집중 모드에서 다음/나중의 task가 숨겨지는데, 사용자가 혼동할 수 있음 | 집중 모드 상태 표시 (버튼 highlight) |
| W5 | 카드화로 인한 세로 공간 증가 | 프로젝트 많을 때 스크롤 많아짐 → 접기 활성 활용 |
| W6 | 반응형 | 좁은 화면에서 3컬럼 → 1컬럼 자동 전환? (Phase 외) |

---

## 7. 사전 확인 필요

1. **카테고리 헤더 위치**: sticky / 카드 외부 1회 / 카드 내부 반복?
2. **집중 모드 기억**: 페이지 새로고침 후 유지? localStorage?
3. **today 배경 tint 범위**: today 셀만 vs today 컬럼 전체 (lane 카드 내부)?
4. **팀 매트릭스도 같이 변경**?
