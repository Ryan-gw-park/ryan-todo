# Phase 12a Spec v3 — 매트릭스 Lane UI 개편 + today 강조 + 집중 모드

> 작성일: 2026-04-10
> 상태: **확정 v3**
> 선행: `12a-spec-v2.md` (이미 구현 완료 — `55023f5`)
> 변경: v2의 sticky 컬럼 헤더 → summary pill bar 전환

---

## 주요 변경 (v2 → v3)

- **sticky 컬럼 헤더 제거** → **summary pill bar** (일반 flow)
- pill bar: 카테고리별 dot + 라벨 + 전체 합산 카운트
- today pill은 강조 스타일 (빨간 tint 배경 + 빨간 텍스트)
- 카드 내부 컬럼 라벨 없음 (today tint가 시각적 단서)
- 집중 모드 시 pill bar는 today pill만 표시

---

## 적용 파일 (구현만 수정)

- `src/components/views/grid/grids/PersonalMatrixGrid.jsx`
- `src/components/views/grid/grids/TeamMatrixGrid.jsx` (해당 없음 — 팀 매트릭스는 집중 모드/today 강조 없음, 팀원 헤더는 유지)

---

## Pill Bar 구현

```jsx
{/* Summary pill bar (sticky 아님) */}
<div style={{
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '8px 14px', marginBottom: 12,
}}>
  {displayCats.map(cat => {
    const isToday = cat.key === 'today'
    return (
      <div key={cat.key} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        background: isToday ? 'rgba(229, 62, 62, 0.08)' : 'transparent',
        color: isToday ? '#991B1B' : COLOR.textSecondary,
        fontSize: FONT.caption, fontWeight: isToday ? 500 : 400,
      }}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
        {cat.label}
        <span style={{ fontSize: FONT.tiny, opacity: 0.8 }}>{catCounts[cat.key]}</span>
      </div>
    )
  })}
  <div style={{ flex: 1 }} />
  <button
    onClick={onToggleFocusMode}
    title={focusMode ? '집중 모드 해제' : '집중 모드'}
    style={{
      width: 28, height: 28, borderRadius: '50%',
      border: 'none',
      background: focusMode ? COLOR.danger : 'transparent',
      color: focusMode ? '#fff' : COLOR.textTertiary,
      cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >◎</button>
</div>
```

---

## 카드 내부 변경

- **내부 grid에서 컬럼 헤더 라벨 제거** (기존 v2에는 없었지만 명시)
- today 컬럼 배경 tint는 그대로 유지
- 집중 모드일 때 1컬럼 grid (today만)

---

## QA 체크리스트 (v3 차이점)

- [ ] pill bar: 카테고리별 dot + 라벨 + 합산 카운트 표시
- [ ] pill bar: today pill 강조 (빨간 tint 배경, 빨간 텍스트)
- [ ] pill bar: **sticky 아님** (스크롤 시 같이 올라감)
- [ ] 집중 모드 ON → pill bar에 today pill만 표시
- [ ] 집중 모드 토글 버튼: 원형 28px
