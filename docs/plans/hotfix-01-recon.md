# Hotfix-01 Recon — 팀 매트릭스 크래시 + 노트 저장 실패

> 작성일: 2026-04-13
> 상태: 조사 완료
> 긴급도: **Critical** (서비스 장애)

---

## 1. 이슈 요약

### 이슈 A: 팀 매트릭스 페이지 접근 불가

- **증상**: 팀 매트릭스(/team/matrix) 진입 시 흰 화면 + React Error #310
- **에러**: `Minified React error #310` — "Rendered more hooks than during the previous render"
- **원인**: `TeamMatrixGrid.jsx` line 197에서 `useMemo`를 `projects.map()` 루프 안에서 호출
- **도입 시점**: Phase 12d (`9feac46`) — memberCounts 계산 코드

### 이슈 B: 노트 저장 실패

- **증상**: 노트 입력 후 새로고침하면 내용 사라짐
- **원인 1**: `useStore.js` `addMemo` 함수에 `return m` 누락 → 신규 메모 생성 후 `undefined` 반환
- **원인 2**: `MemoryView.jsx` `handleAdd`에서 `addMemo` 호출 시 `await` 누락 → Promise 객체가 newMemo에 할당
- **도입 시점**: Phase 11a (`769113a`) — MemoryView split pane 재작성 시 addMemo 반환값 처리 누락

---

## 2. 영향 범위

### 이슈 A
- `src/components/views/grid/grids/TeamMatrixGrid.jsx` — line 197-208

### 이슈 B
- `src/hooks/useStore.js` — addMemo 함수 (line ~857)
- `src/components/views/MemoryView.jsx` — handleAdd 함수 (line ~188)

---

## 3. 근본 원인 분석

### 이슈 A: React hooks 규칙 위반

```jsx
// TeamMatrixGrid.jsx line 188-208
{projects.map(proj => {
  // ... 변수 계산 ...
  const memberCounts = useMemo(() => {   // ❌ 루프 안에서 hook 호출
    // memberCounts 계산 로직
  }, [projTasks])
```

React hooks는 컴포넌트 함수의 최상위 레벨에서만 호출 가능. `.map()` 콜백 안에서 호출하면 렌더마다 hook 호출 수가 달라져 #310 에러 발생.

### 이슈 B: addMemo 반환값 + await 누락

```js
// useStore.js — addMemo
addMemo: async (memo) => {
  const m = { id: crypto.randomUUID(), ... }
  set(s => ({ memos: [...s.memos, m] }))
  // ... DB upsert ...
  // ❌ return m 없음 — undefined 반환
}

// MemoryView.jsx — handleAdd
const newMemo = addMemo(...)  // ❌ await 없음 — Promise 할당
if (newMemo) setSelectedId(newMemo.id)  // newMemo.id = undefined
```

결과: 신규 메모 생성은 되지만 selectedId가 설정 안 됨 → 편집 불가 → 사용자가 입력한 내용이 저장 안 됨.

> 기존 메모의 `updateMemo` 경로 (OutlinerEditor onChange → updateMemo → Supabase upsert)는 정상 동작 확인됨.

---

## 4. 수정 방향

| 이슈 | 수정 | 복잡도 |
|------|------|--------|
| A | `useMemo` → 일반 변수 계산으로 교체 | 1줄 변경 |
| B-1 | `addMemo` 함수 끝에 `return m` 추가 | 1줄 추가 |
| B-2 | `handleAdd`에서 `await addMemo(...)` + `async` 추가 | 2줄 변경 |

---

## 5. 위험 요소

- 이슈 A 수정은 단순 — `useMemo` 제거만으로 동작 동일 (루프 안 memoization은 무의미)
- 이슈 B 수정은 `addMemo`의 기존 호출처가 다른 곳에 있는지 확인 필요 — `return m` 추가가 다른 곳에 영향 없는지
