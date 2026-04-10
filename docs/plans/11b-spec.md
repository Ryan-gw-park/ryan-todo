# Phase 11b Spec — 노트 뷰 UI 개선

> 작성일: 2026-04-10
> 상태: **초안** (상세화 필요)
> 선행: `11b-recon.md`

---

## 1. 목표

노트 뷰의 시각적 단순화 및 정보 밀도 최적화:
- 카드 wrapper 제거 (flat 느낌)
- 들여쓰기 정규화 (22 → 17px)
- 패딩/line-height 축소
- 제목 하단 hairline + 작은 날짜 표시
- 배경 tint 유지 (컬러 식별)

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | OutlinerRow 변경 범위 | **공용 변경** — DetailPanel(할일 상세 notes)에도 동일 적용 |
| D2 | 배경 단일화 수준 | **colorObj.card tint 유지** — 컬러 식별 보존 |
| D3 | 날짜 위치 | **제목 아래 작은 글씨** (제목 hairline 바로 아래) |
| D4 | 카드 wrapper | 제거 (border + border-radius + 내부 padding) |
| D5 | 들여쓰기 | 17px 고정 단위 (L1=0, L2=17, L3=34, L4=51) |
| D6 | line-height | 19px(mobile) / 20px(desktop) |
| D7 | row padding | 2px 4px |
| D8 | min-height | 26px |
| D9 | chevron/bullet 컨테이너 | 17 × 24px |
| D10 | 제목 hairline | 0.5px `#f0efe8` |

---

## 3. 기능 범위

### 3-1. MemoDetailPane (MemoryView.jsx)

1. **카드 wrapper 제거**:
   - `<div style={{ background: colorObj.card, border, borderRadius, padding, minHeight }}>` 삭제
   - OutlinerEditor를 직접 body 영역에 렌더

2. **body 영역 배경 tint 유지**:
   - body 컨테이너 자체에 `background: colorObj.card` 적용
   - border/radius 없음 (카드 느낌 제거)

3. **외부 padding 축소**:
   - body 외부 wrapper: `16px 20px` → `14px 18px`

4. **제목 영역 재구성**:
   - 제목 input 아래 hairline `0.5px solid #f0efe8`
   - 날짜를 헤더 내부 제목 아래 작은 글씨로 표시
   - 하단 타임스탬프 제거

### 3-2. OutlinerRow.jsx (공용)

1. **들여쓰기**: `node.level * 22` → `node.level * 17`
2. **chevron/bullet 컨테이너**: `20 × 28` → `17 × 24`
3. **line-height**: `20/22` → `19/20`
4. **row padding**: `3px 4px` → `2px 4px`
5. **min-height**: `30` → `26`
6. bullet 스타일 유지 (기존 4단계)

---

## 4. UI 사양

### 4-1. MemoDetailPane 레이아웃

```
┌─ Header (padding: 14px 18px 0) ────────────────────┐
│ ● 제목 텍스트                                       │
│    2026년 4월 10일 오후 12:40                         │  ← 작은 글씨 (fontSize 11, #a09f99)
├─ Hairline 0.5px #f0efe8 ───────────────────────────┤
│                                                    │
│ Body (padding: 14px 18px, background: colorObj.card)│
│   OutlinerEditor 직접 렌더 (카드 wrapper 없음)        │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 4-2. OutlinerRow 간격 (L1~L4)

```
● L1 item                    ← paddingLeft: 0
  ○ L2 item                  ← paddingLeft: 17
    ■ L3 item                ← paddingLeft: 34
      □ L4 item              ← paddingLeft: 51
```

---

## 5. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/MemoryView.jsx` | 카드 제거, padding, 날짜 위치, 헤더 재구성 |
| `src/components/shared/OutlinerRow.jsx` | 들여쓰기 17, line-height, padding, min-height |

---

## 6. 회귀 체크

- [ ] 노트 뷰에서 OutlinerEditor 정상 렌더
- [ ] DetailPanel (할일 상세)의 notes OutlinerEditor 정상 렌더
- [ ] 들여쓰기 17px로 정렬
- [ ] 제목 아래 날짜 표시
- [ ] 배경 tint 유지 (컬러별 구분 가능)
- [ ] `npm run build` 통과

---

## 7. 제외 사항

- DetailPanel 자체 레이아웃 변경 (OutlinerRow 내부만 변경)
- 데이터 모델 변경 (notes 형식 유지)
- 모바일 전용 변경 (반응형은 기존 유지)
