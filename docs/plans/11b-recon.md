# Phase 11b Recon — 노트 뷰 UI 개선 (OutlinerEditor + MemoDetailPane)

> 작성일: 2026-04-10
> 상태: 조사 완료

---

## 1. 요구사항 요약

1. 카드 wrapper 제거 (background + border + radius 삭제)
2. 콘텐츠 padding 축소 (24px 28px → 14px 18px, 실제 현재 16px 20px)
3. 제목 아래 hairline + 날짜를 제목 우측으로 이동
4. line-height 축소 (22px → 20px, 또는 1.5~1.6)
5. 불릿 유지 + 시각 구분 강화
6. 들여쓰기 정규화 (현재 22px → **17px** 고정)
7. 배경 단일화 (colorObj.card 제거, background-primary 단일)

---

## 2. 현재 상태 (실측)

### OutlinerRow.jsx
- **들여쓰기**: `node.level * 22` (line 37) — 요구사항의 18/28/42와 다름, 실제는 22px 균일
- **chevron/bullet 컨테이너**: 20px 고정
- **line-height**: 22px (desktop) / 20px (mobile) — line 58-69
- **row padding**: 3px 4px
- **min-height**: 30px
- **bullet 스타일**: 4단계 (원/사각, 채움/비움) + L4+ 대시

### MemoDetailPane (MemoryView.jsx)
- **카드 wrapper**: `background: colorObj.card`, `border: 1px solid rgba(0,0,0,0.04)`, `borderRadius: 10`, `padding: 16px 20px`, `minHeight: 300` — line 150
- **외부 wrapper**: `padding: 16px 20px` — line 149
- **헤더**: `padding: 16px 20px 12px`, `borderBottom: 1px solid #f0efe8` — line 107
- **타임스탬프**: 하단 우측, `marginTop: 12`, `fontSize: 12` — line 159-161

---

## 3. 변경 계획

### 3-1. MemoryView.jsx (MemoDetailPane)

**변경 A: 카드 wrapper 제거**
```diff
-<div style={{ background: colorObj.card, borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.04)', minHeight: 300 }}>
-  <OutlinerEditor ... />
-</div>
+<OutlinerEditor ... />
```

**변경 B: 외부 padding 축소**
```diff
-<div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
+<div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
```

**변경 C: 제목 영역 + 날짜 우측 이동 + hairline**
- 헤더 border-bottom 유지 (hairline 역할)
- 하단 타임스탬프 제거, 헤더 제목 우측에 표시

**변경 D: 배경 단일화**
- `colorObj.card` 사용 제거 → 기본 배경 (흰색/background-primary)
- 컬러 식별은 dot (좌측)만으로

### 3-2. OutlinerRow.jsx

**변경 E: 들여쓰기 22 → 17**
```diff
-paddingLeft: node.level * 22
+paddingLeft: node.level * 17
```

**변경 F: line-height 축소**
```diff
-lineHeight: isMobile ? '20px' : '22px'
+lineHeight: isMobile ? '19px' : '20px'
```

**변경 G: row padding 미세 조정**
- 현재 `3px 4px` 유지 또는 `2px 4px`로 축소
- chevron 행(collapsible)은 `padding: '3px 4px 4px'` 유지

**변경 H: min-height 축소**
```diff
-minHeight: 30
+minHeight: 26
```

**변경 I: chevron/bullet 컨테이너 20 → 17**
```diff
-width: 20, height: 28
+width: 17, height: 24
```

---

## 4. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/MemoryView.jsx` | 카드 제거, padding, 날짜 위치, 배경 |
| `src/components/shared/OutlinerRow.jsx` | 들여쓰기 17, line-height, padding, min-height |

---

## 5. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | OutlinerRow는 다른 곳에서도 사용 (DetailPanel 등) | OutlinerRow 변경이 영향 받는지 확인 필요 |
| W2 | 들여쓰기 22 → 17 시 bullet 컨테이너 크기 조정 누락 | 20 → 17로 동시 변경 |
| W3 | 배경 단일화로 컬러 식별력 감소 | dot + 제목 색으로 보완 (또는 dot 강조) |
| W4 | 기존 memo의 notes는 탭 들여쓰기 유지 (데이터 변경 없음) | 시각만 변경 |

---

## 6. 사전 확인 필요

1. **OutlinerRow 공용 사용처**: DetailPanel의 task notes 편집에도 OutlinerEditor가 쓰이는데, 17px 변경이 과도하게 압축되어 보이지 않는지?
2. **배경 단일화 시 컬러 구분**: 완전히 흰색으로 할지, 아주 연한 tint는 유지할지?
3. **날짜 위치**: 제목 우측 (inline) vs 제목 아래 작게 (아래 line)?
