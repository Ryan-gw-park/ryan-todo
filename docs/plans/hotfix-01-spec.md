# Hotfix-01 Spec (v2) — 팀 매트릭스 크래시 + 노트 저장 실패

> 작성일: 2026-04-13
> 상태: **확정 v2** (Issue 1~7 전부 반영)
> 선행: `hotfix-01-recon.md`
> 긴급도: **Critical** (서비스 장애)

---

## 1. 검증 결과 (Issue 3 + Issue 7)

### Issue 3: addMemo 호출처 cascade 검토 ✅

```
grep -rn "addMemo(" src/ → 1건만 발견
```
- `MemoryView.jsx:188` — **유일한 호출처**
- `return m` 추가가 다른 곳에 영향 없음 확인

### Issue 7: 기존 메모 편집 경로 재확인 ✅

- OutlinerEditor `onChange` (useEffect line 35-41) → `updateMemo(id, { notes })` → `set(로컬)` → `db.upsert(DB)`
- **경로 정상 동작 확인**. debounce 없이 nodes 변경 즉시 serialize → onChange 호출
- **문제는 신규 메모에서만 발생**: addMemo return 없음 → selectedId 미설정 → 상세 패널 미표시 → 편집 불가 → 빈 메모만 DB에 저장

---

## 2. 확정 결정사항

| # | 항목 | 결정 |
|---|------|------|
| D1 | Fix A 성능 | useMemo 제거 성능 영향 없음 (프로젝트당 ~30 task, O(N)). 향후 필요 시 Lane 컴포넌트 분리 |
| D2 | Fix B-1 에러 시 동작 | 에러 시에도 `m` 반환 (낙관적 업데이트 패턴 유지). 에러 toast는 별도 phase |
| D3 | addMemo 호출처 | 1곳 (MemoryView.jsx) — cascade 영향 없음 |
| D4 | 기존 메모 편집 | 정상 동작 (updateMemo 경로 검증 완료) |
| D5 | 커밋 분리 | **두 커밋** (R-ATOMIC 원칙, 독립 revert 가능) |

---

## 3. 수정 사항

### 커밋 1: Fix A — TeamMatrixGrid useMemo 제거

**파일**: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

**현재** (line 197-208):
```jsx
          const memberCounts = useMemo(() => {
            const counts = {}
            projTasks.forEach(t => {
              const key = t.assigneeId || '__unassigned__'
              counts[key] = (counts[key] || 0) + 1
            })
            const unassignedCount = counts['__unassigned__'] || 0
            delete counts['__unassigned__']
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([uid, cnt]) => ({ userId: uid, count: cnt }))
            if (unassignedCount > 0) sorted.push({ userId: '__unassigned__', count: unassignedCount })
            return sorted
          }, [projTasks])
```

**수정**:
```jsx
          const counts = {}
          projTasks.forEach(t => {
            const key = t.assigneeId || '__unassigned__'
            counts[key] = (counts[key] || 0) + 1
          })
          const unassignedCount = counts['__unassigned__'] || 0
          delete counts['__unassigned__']
          const memberCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([uid, cnt]) => ({ userId: uid, count: cnt }))
          if (unassignedCount > 0) memberCounts.push({ userId: '__unassigned__', count: unassignedCount })
```

**커밋 메시지**: `fix(team-matrix): remove useMemo from projects.map loop (React #310)`

---

### 커밋 2: Fix B — addMemo return + handleAdd await

**파일 1**: `src/hooks/useStore.js` — addMemo return 추가

**현재** (line 856-857):
```js
    if (error) console.error('[Ryan Todo] addMemo:', error)
  },
```

**수정**:
```js
    if (error) console.error('[Ryan Todo] addMemo:', error)
    return m
  },
```

> D2: 에러 시에도 m 반환 (낙관적 업데이트 패턴 유지)

**파일 2**: `src/components/views/MemoryView.jsx` — handleAdd async/await

**현재** (line ~186-190):
```js
  const handleAdd = useCallback(() => {
    const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].id
    const newMemo = addMemo({ title: '', notes: '', color: randomColor })
    if (newMemo) setSelectedId(newMemo.id)
  }, [addMemo])
```

**수정**:
```js
  const handleAdd = useCallback(async () => {
    const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].id
    const newMemo = await addMemo({ title: '', notes: '', color: randomColor })
    if (newMemo) setSelectedId(newMemo.id)
  }, [addMemo])
```

**커밋 메시지**: `fix(notes): add return m to addMemo + await in handleAdd`

---

## 4. QA 체크리스트

### Fix A — 팀 매트릭스

- [ ] 팀 매트릭스 페이지 정상 진입
- [ ] C안 (플랫 리스트) 정상 렌더
- [ ] B안 (담당자별 그룹) 토글 정상
- [ ] Lane 헤더 참여자 칩 정상 표시
- [ ] 빈 프로젝트 (task 0건) 정상 표시
- [ ] 미배정 task 있는 프로젝트 참여자 칩에 ghost 칩 표시
- [ ] 프로젝트 추가/삭제 후 매트릭스 정상 렌더
- [ ] B안 토글 ON 상태에서 페이지 재진입 정상

### Fix B — 노트

- [ ] 새 노트 생성 → 즉시 selectedId 설정 (상세 패널에 표시)
- [ ] 새 노트 생성 후 제목 입력 → 새로고침 → 제목 유지
- [ ] 새 노트 생성 후 본문 입력 → 새로고침 → 본문 유지
- [ ] 기존 메모 편집 → 새로고침 → 유지 (회귀 확인)
- [ ] 노트 색상 변경 → 새로고침 → 유지
- [ ] 노트 삭제 → 새로고침 → 삭제 유지
- [ ] 빠른 연속 입력 후 즉시 새로고침 → 데이터 유지
- [ ] `npm run build` 통과

---

## 5. 참고 (Issue 6)

Fix A는 12d 커밋(`9feac46`)이 도입한 코드 수정. 현재 모든 작업은 main 직접 커밋이므로 branch 충돌 없음.
