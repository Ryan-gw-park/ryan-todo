# Phase 11b Diff Plan — 노트 뷰 UI 개선

> 작성일: 2026-04-10
> 기준: `11b-spec-final.md` (확정)
> 상태: 리뷰 반영 v2

## 리뷰 반영 (v1 → v2)

| 이슈 | 해결 |
|------|------|
| [W1] background-primary 명시 부족 | MemoDetailPane 최상위 div에 `background: '#fff'` 명시 추가 |
| [W2] 헤더 borderBottom 제거 누락 | Step 2에 명시적 제거 기술 |
| [W3] 모바일 뒤로가기 버튼 너비 불확실 | 버튼에 `width: 28` 고정 |
| [W5] 커밋 분리 | 단일 커밋으로 진행 (범위가 작음) |

---

## 0. 전제 요약

- DB / RLS 변경 없음
- **공용 OutlinerRow 변경** → DetailPanel의 notes 편집에도 자동 반영
- 단일 커밋 또는 3 커밋 (spec §7 R-ATOMIC)

---

## Step 1: `OutlinerRow.jsx` — spacing 조정

**파일**: `src/components/shared/OutlinerRow.jsx`

### 변경 1 — root div (line 37):
```diff
-display: 'flex', alignItems: 'flex-start', gap: 0, paddingLeft: node.level * 22, minHeight: 30,
+display: 'flex', alignItems: 'flex-start', gap: 0, paddingLeft: node.level * 17, minHeight: 26,
```

### 변경 2 — chevron/bullet 컨테이너 (line 46):
```diff
-style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, height: 28, cursor: hasChildren ? 'pointer' : 'default' }}
+style={{ width: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, height: 24, cursor: hasChildren ? 'pointer' : 'default' }}
```

### 변경 3 — textarea (line 68):
```diff
-style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize, lineHeight: isMobile ? '20px' : '22px', padding: '3px 4px', fontFamily: 'inherit', color: '#37352f', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', display: 'block', fontWeight: 400 }}
+style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize, lineHeight: isMobile ? '19px' : '20px', padding: '2px 4px', fontFamily: 'inherit', color: '#37352f', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', display: 'block', fontWeight: 400 }}
```

### 변경 4 — actions 컨테이너 (line 70):
```diff
-<div style={{ display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s', flexShrink: 0, height: 28, alignItems: 'center' }} className="bullet-actions">
+<div style={{ display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s', flexShrink: 0, height: 24, alignItems: 'center' }} className="bullet-actions">
```

**커밋**: `feat(notes): adjust OutlinerRow spacing — 17px indent, 20px line-height (11b step 1)`

---

## Step 2: `MemoryView.jsx` — MemoDetailPane 재구성

**파일**: `src/components/views/MemoryView.jsx`

### 변경 1 — 헤더 재구성 (line ~107):

**기존**:
```jsx
<div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0efe8', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
  {isMobile && <button ...>←</button>}
  <div style={{ position: 'relative' }} ref={colorPickerRef}>
    <div onClick={...} style={{ width: 12, height: 12, ... }} />
    ...
  </div>
  <input ref={titleRef} ... style={{ flex: 1, fontSize: 18, fontWeight: 700, ... }} />
  <button onClick={handleDelete} ...><TrashIcon /></button>
</div>
```

**변경**:
```jsx
<div style={{ padding: '14px 18px 0', flexShrink: 0 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    {isMobile && <button ...>←</button>}
    <div style={{ position: 'relative' }} ref={colorPickerRef}>
      {/* color dot + picker */}
    </div>
    <input ref={titleRef} ... style={{ flex: 1, fontSize: 18, fontWeight: 700, ... }} />
    <button onClick={handleDelete}><TrashIcon /></button>
  </div>
  {/* 날짜 (제목 아래) */}
  <div style={{ fontSize: 11, color: '#a09f99', marginTop: 2, paddingLeft: isMobile ? 38 : 22 }}>
    {formatDate(memo.updatedAt || memo.createdAt)}
  </div>
  {/* Hairline */}
  <div style={{ height: '0.5px', background: '#f0efe8', marginTop: 10 }} />
</div>
```

> **paddingLeft**: 날짜를 color dot 정렬 위치에 맞추기 위해. dot(12px) + gap(10px) = 22px. 모바일은 뒤로가기 버튼 너비 추가.

### 변경 2 — body 영역: 카드 wrapper 제거 + 배경 단일화

**기존**:
```jsx
<div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
  <div style={{ background: colorObj.card, borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.04)', minHeight: 300 }}>
    <OutlinerEditor ... />
  </div>
  <div style={{ marginTop: 12, fontSize: 12, color: '#a09f99', textAlign: 'right' }}>
    {formatDate(memo.updatedAt || memo.createdAt)}
  </div>
</div>
```

**변경**:
```jsx
<div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
  <OutlinerEditor
    ref={editorRef}
    notes={memo.notes}
    onChange={(newNotes) => updateMemo(memo.id, { notes: newNotes })}
    accentColor={colorObj.dot}
  />
</div>
```

제거되는 것:
- 카드 wrapper div (background colorObj.card, border, borderRadius, padding, minHeight)
- 하단 타임스탬프 (헤더로 이동됨)

### 변경 3 — colorObj 사용 축소

`colorObj.dot`은 accentColor로 여전히 사용. `colorObj.card`는 제거.

**커밋**: `refactor(notes): remove card wrapper, restructure header with date below title (11b step 2)`

---

## 작업 순서 요약

| Step | 파일 | 유형 | 의존성 |
|------|------|------|--------|
| 1 | `src/components/shared/OutlinerRow.jsx` | 수정 | 없음 |
| 2 | `src/components/views/MemoryView.jsx` | 수정 | 없음 |

> Step 1과 2는 독립적. 순서 무관.

---

## 검증 절차

각 Step 커밋 후: `npm run build` 통과

전체 완료 후 — Spec §8 QA 체크리스트:
- §8-1: 노트 뷰 (카드 없음, 배경 단일, padding 14/18, 날짜 제목 아래, hairline)
- §8-2: OutlinerRow (들여쓰기 17, line-height 20, padding 2/4, min-height 26, 컨테이너 17×24)
- §8-3: 회귀 (DetailPanel 할일 notes 정상 렌더, 노트 편집 정상)
