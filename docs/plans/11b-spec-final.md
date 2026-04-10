# Phase 11b Spec (Final) — 노트 뷰 UI 개선

> 작성일: 2026-04-10
> 상태: **확정** (충돌 2건 해소 반영)
> 선행: `11b-recon.md`, `11b-spec.md` (초안)
> 의존: 없음 (독립 진행 가능)

---

## 1. 목표

노트 뷰의 시각적 단순화 및 정보 밀도 최적화:
- 카드 wrapper 제거 → flat
- 배경 단일화 → `background-primary`
- 들여쓰기 정규화 (22 → 17px)
- 패딩/line-height 축소
- 제목 하단 hairline + 날짜를 제목 아래로

---

## 2. 확정 결정사항 (전부 lock)

| # | 항목 | 결정 |
|---|------|------|
| D1 | OutlinerRow 변경 범위 | **공용 변경** — DetailPanel(할일 상세 notes)에도 동일 적용 |
| D2 | 배경 | **`background-primary` 단일** — `colorObj.card` tint 제거. 색 구분은 dot만으로 |
| D3 | 날짜 위치 | **제목 아래 작은 글씨** (hairline 위, fontSize 11, color `#a09f99`) |
| D4 | 카드 wrapper | 제거 (border + border-radius + 내부 padding) |
| D5 | 들여쓰기 | 17px 고정 단위 (L1=0, L2=17, L3=34, L4=51) |
| D6 | line-height | 19px (mobile) / 20px (desktop) |
| D7 | row padding | 2px 4px |
| D8 | min-height | 26px |
| D9 | chevron/bullet 컨테이너 | 17 × 24px |
| D10 | 제목 hairline | 0.5px `#f0efe8` |
| D11 | 불릿 | **유지** (기존 4단계: ●/○/■/□ + L4+ 대시) |

---

## 3. 기능 범위

### 3-1. MemoDetailPane (MemoryView.jsx)

1. **카드 wrapper 제거**
   - `<div style={{ background: colorObj.card, border, borderRadius, padding, minHeight }}>` 삭제
   - OutlinerEditor를 body 영역에 직접 렌더

2. **배경 단일화**
   - body 컨테이너: `colorObj.card` → 배경 없음 (부모의 `background-primary` 상속)
   - 카드 tint 완전 제거

3. **외부 padding 축소**
   - `padding: '16px 20px'` → `padding: '14px 18px'`

4. **제목 영역 재구성**
   - 제목 input 유지
   - 제목 아래에 날짜 표시: `fontSize: 11`, `color: '#a09f99'`, `marginTop: 2px`
   - 날짜 아래 hairline: `0.5px solid #f0efe8`
   - 하단 타임스탬프 제거

### 3-2. OutlinerRow.jsx (공용)

1. **들여쓰기**: `node.level * 22` → `node.level * 17`
2. **chevron/bullet 컨테이너**: `20 × 28` → `17 × 24`
3. **line-height**: `22/20` → `20/19` (desktop/mobile)
4. **row padding**: `3px 4px` → `2px 4px`
5. **min-height**: `30` → `26`
6. **불릿 스타일 유지** (기존 4단계, 변경 없음)

### 3-3. OUT OF SCOPE

- DetailPanel 자체 레이아웃 변경 (OutlinerRow 내부만 변경)
- 데이터 모델 변경 (notes 형식 유지)
- 모바일 전용 변경 (반응형은 기존 유지)

---

## 4. UI 사양

### 4-1. MemoDetailPane 레이아웃

```
┌─ Header (padding: 14px 18px 0) ────────────────────┐
│ ● 제목 텍스트                                       │
│    2026년 4월 10일 오후 12:40                         │  ← fontSize 11, #a09f99
├─ Hairline 0.5px #f0efe8 ───────────────────────────┤
│                                                    │
│ Body (padding: 14px 18px, 배경 없음)                 │
│   OutlinerEditor 직접 렌더 (카드 wrapper 없음)        │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 4-2. OutlinerRow 간격

```
● L1 item                    ← paddingLeft: 0
  ○ L2 item                  ← paddingLeft: 17
    ■ L3 item                ← paddingLeft: 34
      □ L4 item              ← paddingLeft: 51
```

---

## 5. 영향 파일

### 수정
| 파일 | 변경 |
|------|------|
| `src/components/views/MemoryView.jsx` | 카드 제거, padding, 배경 제거, 날짜 위치, 헤더 재구성 |
| `src/components/shared/OutlinerRow.jsx` | 들여쓰기 17, line-height, padding, min-height, 컨테이너 크기 |

### 수정 없음
- DetailPanel (OutlinerRow 변경 자동 반영)
- DB / 데이터 모델
- 다른 뷰 컴포넌트

---

## 6. 기술 제약

| # | 리스크 | 대응 |
|---|--------|------|
| R1 | OutlinerRow 공용 → DetailPanel 회귀 | D1 확정. 양쪽 모두 QA |
| R2 | chevron 컨테이너 17px로 줄이면 클릭 영역 좁아짐 | height 24px 유지, 터치 영역은 row 전체 |
| R3 | Vite TDZ | 모듈 레벨 const 참조 금지 |
| R4 | 배경 제거 후 노트 색 구분력 저하 | dot 색상으로 충분. 부족하면 후속에서 제목 색상 연동 검토 |

---

## 7. 구현 순서 (R-ATOMIC)

| # | 커밋 | 목적 |
|---|------|------|
| 1 | `refactor: remove card wrapper and background tint from MemoDetailPane` | 카드 제거 + 배경 단일화 + padding 축소 |
| 2 | `feat: restructure note header with date and hairline` | 날짜 제목 아래 이동 + hairline + 하단 타임스탬프 제거 |
| 3 | `feat: adjust OutlinerRow spacing` | 들여쓰기 17, line-height, padding, min-height, 컨테이너 |

각 커밋 독립 빌드 + UI 회귀 없음.

---

## 8. QA 체크리스트

### 8-1. 노트 뷰
- [ ] 카드 wrapper 없음 (border, border-radius 없음)
- [ ] 배경 단일 background-primary (tint 없음)
- [ ] padding 14px 18px
- [ ] 제목 아래 날짜 표시 (fontSize 11, #a09f99)
- [ ] 제목 아래 hairline (0.5px #f0efe8)
- [ ] 하단 타임스탬프 없음

### 8-2. OutlinerRow (공용)
- [ ] 들여쓰기 L1=0, L2=17, L3=34, L4=51
- [ ] chevron/bullet 컨테이너 17×24
- [ ] line-height 20px (desktop) / 19px (mobile)
- [ ] row padding 2px 4px
- [ ] min-height 26px
- [ ] 불릿 4단계 유지 (●/○/■/□)

### 8-3. 회귀
- [ ] DetailPanel notes 편집 정상 렌더
- [ ] 노트 목록 선택/전환 정상
- [ ] 노트 인라인 편집 정상
- [ ] `npm run build` 성공

---

## 9. REQ-LOCK 체크리스트

- [ ] D1~D11 11개 결정 사항 전부 반영
- [ ] §3 IN SCOPE 항목 전부 diff 포함
- [ ] §3-3 OUT OF SCOPE 항목 diff 미포함
- [ ] §7 3 커밋 각각 독립 빌드
- [ ] §8 3개 카테고리 QA 전부 통과
