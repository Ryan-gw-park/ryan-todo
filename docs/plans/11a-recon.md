# Phase 11a Recon — 노트 뷰 1열 리스트 + 우측 상세 패널 개편

> 작성일: 2026-04-10
> 상태: 조사 완료

---

## 1. 요구사항 요약

노트 메인 페이지를 **1열 리스트(좌측) + 우측 상세 패널** 레이아웃으로 개편. 이메일 클라이언트 형태.

---

## 2. 현재 상태

### MemoryView.jsx (371줄)

- **레이아웃**: `columnCount: 2` masonry
- **MemoCard**: 접힘/펼침, OutlinerEditor 내장, 색상 dot, 삭제
- **풀스크린 모드**: `fullscreenMemoId` state → 단일 메모 전체 표시
- **키보드 내비게이션**: ArrowUp/Down으로 카드 간 이동, Alt+N 신규

### 데이터 모델

```js
memo: { id, title, notes, color, sortOrder, createdAt, updatedAt }
```

- store: `addMemo`, `updateMemo`, `deleteMemo`
- notes 형식: 탭 들여쓰기 아웃라이너 (OutlinerEditor)

---

## 3. 구현 방향

### 레이아웃 변경

```
┌─────────────────────────────┬────────────────────────────────┐
│ 좌측 리스트 (280-320px)      │ 우측 상세 패널 (flex: 1)        │
│                             │                                │
│ [+ 새 노트]                  │  ● 26.04.10 실적 협의            │
│                             │                                │
│ ● 26.04.10 실적 협의  ← 선택 │  • 매출인식                     │
│ ● 26.04.09 IR대응 협의       │  • MPW는 개발일정이...           │
│ ● 사용 계정                  │  • 매달 영업일 마지막날            │
│ ● Family                    │                                │
│ ● 주총 영업보고 자료          │  + 추가                         │
│ ● 리더십 weekly              │                                │
│                             │              2026.04.10 10:00  │
└─────────────────────────────┴────────────────────────────────┘
```

### 좌측 리스트

- 고정 너비 (300px)
- 각 항목: 색상 dot + 제목 + 날짜 (1줄)
- 선택 상태: 배경 하이라이트
- hover: 약간 진한 배경
- `+ 새 노트` 버튼 상단
- 정렬: sortOrder ASC (기존)

### 우측 상세 패널

- 기존 fullscreen 모드의 UI 재사용 (OutlinerEditor + 타임스탬프)
- 선택된 메모 없으면: "노트를 선택하세요" placeholder
- 제목 인라인 편집
- 색상 변경 (dot 클릭)
- 삭제 버튼

---

## 4. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/MemoryView.jsx` | **대규모 수정** — 2열 masonry → split pane 레이아웃 |

단일 파일 수정. MemoCard 컴포넌트를 MemoListItem + MemoDetail로 분리.

---

## 5. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | 키보드 내비게이션 변경 | 리스트에서 ArrowUp/Down, Enter로 선택 |
| W2 | 모바일 레이아웃 | 모바일에서는 리스트만 표시, 선택 시 상세로 전환 |
| W3 | fullscreenMemoId 기존 로직 | selectedMemoId로 대체 |
| W4 | OutlinerEditor 포커스 | 상세 패널에서 자연스럽게 편집 가능해야 함 |
