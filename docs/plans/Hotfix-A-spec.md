# Hotfix-A Spec — 노트 데이터 유실 박멸 + 저장 상태 UI

- **Phase**: Hotfix-A (긴급 핫픽스, Loop 아님)
- **상위 플랜**: `docs/plans/notes-fix-plan.md`
- **Recon**: `docs/plans/Hotfix-A-recon.md`
- **Date**: 2026-04-20
- **Revision**: 3 (리뷰 반영 — Set→plain object, global Map→local state, A-4 제거, addMemo throw+handleAdd catch guard 명확화)
- **우선순위**: Hotfix-A+B 패키지 ship, A가 먼저 (data loss > crash)
- **커밋 원칙**: R-ATOMIC — 각 커밋은 하나의 이슈만 해결

---

## 1. 배경

사용자 리포트: "노트 사용 중 내용이 사라진다. 과거에 저장 완료된 노트도 내용이 사라져 있기도 하다." 사용자는 이 불안정성 때문에 Workflowy로 이탈 중. 전수조사(recon) 결과 4개의 결함이 유실 체인을 구성함을 확인.

**Hotfix-A 완료 후 얻는 것**: Workflowy에서 돌아올 수 있는 최소 신뢰 수준(데이터 안정성 + 저장 상태 가시성).

---

## 2. 성공 기준 (Hotfix-A 단독)

- [ ] 타이핑 중 탭 전환 후 복귀 → 로컬 내용 유지됨
- [ ] 타이핑 중 `loadAll()` 수동/자동 발동 → 내용 유지됨
- [ ] upsert 실패 시 "저장 실패 ⚠" UI 표시 + 로컬 내용 보존
- [ ] 에디터 상단에 "저장 중..." / "저장됨 ✓" 표시 (상태 기반)
- [ ] 메모 간 전환 시 올바른 id로 pending save가 flush되고 다른 메모로 잘못 저장되지 않음

**참고**: 브라우저 탭 닫기 시 마지막 입력 저장 / 오프라인 UI / 빈 문자열 덮어쓰기 차단은 Hotfix-B 범위.

---

## 3. Scope (포함 / 제외)

### 3-1. Hotfix-A 포함

| # | 항목 | 대상 |
|---|------|------|
| A-1 | dirty-set 격리 (memos 배열 통째 교체 방지) | `src/hooks/useStore.js` |
| A-2 | memos upsert payload에 `updated_at` 명시 | `src/hooks/useStore.js` |
| A-3 | 저장 상태 UI (로컬 `saveState`, 4개 상태) | `src/components/views/MemoryView.jsx` + `src/hooks/useStore.js`(에러 throw) |

**A-4 lockedNotes 래퍼는 제거** (리뷰 피드백 반영). A-1이 loadAll 머지 단계에서 dirty 메모의 배열 항목을 서버 값으로 교체하지 않으므로 `memo.notes`는 항상 로컬 최신이다. 추가 레이어는 메모 전환 flicker/타이밍 버그 위험만 키우므로 단일 방어선으로 간다. T1~T5 통과 후 누락 경로 발견 시 별도 phase로 추가 고려.

### 3-2. 제외 (Hotfix-B 또는 Loop 45)

- `navigator.onLine === false` 오프라인 인디케이터 → **Hotfix-B**
- upsert 실패 시 자동 재시도 로직 → **Hotfix-B B-1**
- `beforeunload` / `visibilitychange` 강화, `sendBeacon` → **Hotfix-B B-2**
- 빈 문자열 저장 방어 → **Hotfix-B B-3**
- deleteMemo의 낙관적 삭제 보호 (loadAll 부활 버그) → **Hotfix-B B-4**
- 메모 검색, Ctrl+Y Redo, 빈 노트 삭제 확인, 메모 전환 debounce flush 정밀화 → **Loop 45**

### 3-3. 수정 금지

- `src/components/shared/OutlinerEditor.jsx` (CLAUDE.md "never modify")
- `src/utils/notes.js`
- `src/sync/PollingSyncProvider.js`, `src/sync/SyncContext.jsx`
- `supabase/migrations/*` (스키마 변경 없음)

---

## 4. 사전 확인 결과 (recon에서 완료)

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| 1 | memos.updated_at DB trigger 존재 여부 | **부재** | `supabase/migrations/20260312000000_loop17_team_schema.sql:523-534` — BEFORE UPDATE 트리거 부착 테이블 리스트에 `memos` 없음 (`profiles, companies, teams, comments, matrix_row_config, tasks, projects`만) |
| 2 | mapMemo의 updated_at 매핑 | 확인 | `src/hooks/useStore.js:155-160` — `updatedAt: r.updated_at` |
| 3 | MEMO_COLUMNS에 updated_at 포함 | 확인 | `src/hooks/useStore.js:8` — 포함 |
| 4 | 로컬 `m.updatedAt`(ISO millisecond)과 DB timestamptz(microsecond) 왕복 일치 | 일치 | 클라이언트가 명시 전달 → DB 그대로 저장(트리거 부재) → fetch 시 동일 문자열로 돌아옴 |

**결론**: 클라이언트가 `updated_at`을 명시 전달하는 것이 안전하고 필수.

---

## 5. 요구사항 상세

### 5-1. A-1. Dirty-set 격리 (plain object 자료구조)

**목적**: `loadAll()`이 편집 중(dirty) 메모를 서버 stale 값으로 덮어쓰지 않게 한다.

**자료구조**:
- 신규 state: `dirtyMemoIds: {}` (**plain object**, Zustand 초기값 영역 `src/hooks/useStore.js:252` 근처)
- Plain object이므로 JSON 직렬화 안전 — 스냅샷 저장(`useStore.js:499`)과 함께 직렬화해도 무해. 단, 런타임 외 의미 없으므로 스냅샷에 포함할 필요도 없음. **구현 시 스냅샷 저장 payload에는 넣지 않음** (불필요한 영속화 회피).
- 프로젝트 전반의 dict 스타일(`_defaultCollapseState` 등)과 일관.

**라이프사이클**:

| 시점 | 동작 |
|------|------|
| `updateMemo(id, patch)` 진입 | `dirtyMemoIds = { ...prev, [id]: true }` |
| `updateMemo` upsert **성공** 후 | `dirtyMemoIds = { ...rest }` (구조분해로 해당 id 제거) |
| `updateMemo` upsert **실패** 후 | **해제하지 않음** (로컬 값 보존, 다음 편집 시 재시도) |
| `addMemo(memo)` 진입 | `dirtyMemoIds = { ...prev, [m.id]: true }` |
| `addMemo` upsert 성공 후 | 해당 id 제거 |
| `addMemo` upsert 실패 후 | 해제하지 않음 |

deleteMemo는 A-1 대상 아님 (Hotfix-B B-4 범위).

**의사코드**:

```js
// 진입: 불변 갱신으로 추가
set(s => ({ dirtyMemoIds: { ...s.dirtyMemoIds, [id]: true } }))

// 성공: 불변 갱신으로 제거
set(s => {
  const { [id]: _, ...rest } = s.dirtyMemoIds
  return { dirtyMemoIds: rest }
})

// 체크 (loadAll 내부)
const dirty = get().dirtyMemoIds
const hasDirty = Object.keys(dirty).length > 0
const isDirty = (id) => !!dirty[id]
```

**loadAll 머지 로직 변경** (`src/hooks/useStore.js:489`):

```
Before:
  if (!isArrayEqual(current.memos, memos)) patch.memos = memos

After:
  if (!isArrayEqual(current.memos, memos)) {
    const dirty = get().dirtyMemoIds
    const dirtyIds = Object.keys(dirty)
    if (dirtyIds.length === 0) {
      patch.memos = memos
    } else {
      const localMap = new Map(current.memos.map(m => [m.id, m]))
      const merged = memos.map(m => dirty[m.id] ? (localMap.get(m.id) || m) : m)
      // 로컬에만 있는 dirty 항목 (addMemo 직후 upsert 전) 보존
      for (const m of current.memos) {
        if (dirty[m.id] && !memos.find(s => s.id === m.id)) merged.push(m)
      }
      patch.memos = merged
    }
  }
```

**구독 요구 없음**: MemoryView는 `dirtyMemoIds`를 구독하지 않는다. loadAll 내부에서만 `get()`으로 명령형 조회. UI 상태는 §5-3 로컬 `saveState`가 담당.

### 5-2. A-2. upsert payload에 `updated_at` 명시

**목적**: memos UPDATE 트리거 부재로 인해 DB의 `updated_at`이 갱신되지 않는 문제 해결. `isArrayEqual`이 매 loadAll마다 "다름" 오판하는 현상 제거.

**위치**: `src/hooks/useStore.js`
- `addMemo` upsert (`:856-858`)
- `updateMemo` upsert (`:870-872`)

**변경**:
```
Before:
  await d.from('memos').upsert({
    id: m.id, title: m.title, notes: m.notes, color: m.color,
    sort_order: m.sortOrder, user_id: userId,
  })

After:
  await d.from('memos').upsert({
    id: m.id, title: m.title, notes: m.notes, color: m.color,
    sort_order: m.sortOrder, user_id: userId,
    updated_at: m.updatedAt,   // ← 추가
  })
```

**불변식**: `m.updatedAt`은 `set()` 시점에 `new Date().toISOString()`으로 생성된 값이다(`useStore.js:864`). upsert payload가 이를 재사용하면 로컬 set 값과 DB 값이 일치한다. trigger 부재이므로 DB가 덮어쓰지 않는다.

### 5-3. A-3. 저장 상태 UI (MemoryView 로컬)

**자료구조**: MemoryView의 `MemoDetailPane` 컴포넌트 로컬 state.

```js
const [saveState, setSaveState] = useState('idle')
// type: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
```

**Zustand에 `memoSaveStatus`를 추가하지 않는다.** MemoryView가 유일한 편집 뷰이고, `MyProfile.jsx:60-61`의 `saving/saved` 로컬 패턴과 동일. Map/Set의 JSON.stringify 문제·selector 참조 동등 문제·스냅샷 제외 처리를 모두 회피.

**상태 전이**:

| 이벤트 | 전이 |
|--------|------|
| 사용자 타이핑 (debounce 콜백 진입) | `'dirty'` |
| debounce 타이머 fire 직후, `updateMemo` 호출 직전 | `'saving'` |
| `updateMemo` Promise resolve | `'saved'` → 2초 후 `'idle'` (단, 그 사이 다시 dirty가 되지 않았을 때만) |
| `updateMemo` Promise reject | `'error'` |
| 메모 전환 (`memo.id` 변경) | `'idle'`로 초기화 (새 메모 기준) |

**타이틀 저장 경로도 동일 반영**: `saveTitle()`(`MemoryView.jsx:117-119`)도 `updateMemo`를 호출하므로 같은 saveState 업데이트.

**`updateMemo`가 실패를 Promise로 전달해야 함** (Hotfix-A의 `useStore.js` 변경 일부):

현재 `updateMemo`는 upsert 에러를 `if (error) console.error(...)`로만 처리하고 resolve. MemoryView가 `.catch()`로 에러를 감지하려면 **upsert 에러 시 throw** 해야 한다. 추가 변경:

```js
// useStore.js updateMemo
const { error } = await d.from('memos').upsert({...})
if (error) {
  console.error('[Ryan Todo] updateMemo:', error)
  // dirty 유지, 로컬 값 보존 (원문 플랜 정책)
  throw error  // ← 호출측이 .catch()로 감지
}
// 성공: dirtyMemoIds에서 제거
```

`addMemo`도 대칭을 위해 동일하게 throw. MemoryView의 `handleAdd`(`:226-230`)는 현재 에러 UI가 없으므로 최소 가드로 `.catch(e => console.error('[Ryan Todo] handleAdd:', e))` **한 줄을 추가**해 unhandled rejection을 차단한다. 본격적인 UI 에러 표시(토스트 등)는 Hotfix-B B-1 범위. saveState는 `updateMemo` 호출 경로(notes debounce + title blur + color change)에만 적용 — handleAdd는 생성 직후이므로 상태 인디케이터가 의미 없음.

**MemoryView debounce 콜백 변경** (`MemoryView.jsx:63-72` 근처):

```js
const debouncedUpdateNotes = useCallback((newNotes) => {
  setSaveState('dirty')
  if (debounceRef.current) clearTimeout(debounceRef.current)
  pendingSaveRef.current = newNotes
  debounceRef.current = setTimeout(() => {
    setSaveState('saving')
    const payloadNotes = pendingSaveRef.current
    updateMemo(memo.id, { notes: payloadNotes })
      .then(() => {
        pendingSaveRef.current = null
        setSaveState('saved')
        setTimeout(() => {
          setSaveState(curr => curr === 'saved' ? 'idle' : curr)
        }, 2000)
      })
      .catch(() => {
        setSaveState('error')
      })
  }, 500)
}, [memo.id, updateMemo])
```

**saveTitle도 동일 패턴** 적용 (title 변경도 저장 상태 신호로).

**메모 전환 시 saveState 초기화**: `useEffect(() => { setSaveState('idle') }, [memo.id])` — 기존 title 초기화 effect(`MemoryView.jsx:102`) 근처에 나란히 추가. 이전 메모의 fade 타이머가 살아 있을 수 있으므로 cleanup에서 `clearTimeout` 처리.

**UI 표시** (`MemoryView.jsx` 헤더 영역 `:147-194` 근처):

| saveState | 텍스트 | 색 |
|-----------|--------|-----|
| `'idle'` | (표시 안 함) | — |
| `'dirty'` | 저장 중... | `#888` (회색) |
| `'saving'` | 저장 중... | `#888` |
| `'saved'` | 저장됨 ✓ | `#38A169` (녹색) |
| `'error'` | 저장 실패 ⚠ | `#E53E3E` (빨강) |

참고 패턴: `src/components/shared/MyProfile.jsx:199-206`의 `saved ? '저장됨' : saving ? '저장 중...' : '저장'`. 동일 타이밍(2000ms fade).

---

## 6. 변경 파일 요약

| 파일 | 변경 내용 | 예상 LOC |
|------|-----------|---------|
| `src/hooks/useStore.js` | `dirtyMemoIds: {}` 초기값, `addMemo`/`updateMemo`에 dirty 라이프사이클 + `updated_at` payload + **upsert 에러 throw**, `loadAll` 머지 분기 | ~35~50 |
| `src/components/views/MemoryView.jsx` | `saveState` 로컬 state, debounce 콜백의 `.then()/.catch()` 처리, saveTitle 동일 반영, 메모 전환 초기화 effect, 헤더 인디케이터 렌더링 | ~30~45 |

**신규 파일 없음. 스키마 변경 없음. Zustand 스토어 구조 추가는 `dirtyMemoIds: {}` 하나뿐.**

---

## 7. 커밋 순서 (3개)

각 커밋은 독립 컴파일/테스트 가능해야 한다.

```
commit 1: A-1 dirty-set 격리 (plain object)
  - dirtyMemoIds: {} 초기값
  - addMemo/updateMemo에 진입 시 add, 성공 시 제거
  - 실패 시는 dirty 유지 (policy)
  - loadAll 머지 분기
  - 성공 기준: 수동 loadAll 트리거 시 편집 중 메모 내용 유지

commit 2: A-2 upsert에 updated_at 포함
  - addMemo/updateMemo upsert payload에 updated_at: m.updatedAt
  - 성공 기준: loadAll 후 isArrayEqual이 "같음" 판정

commit 3: A-3 저장 상태 UI + upsert 에러 throw
  - updateMemo/addMemo 에러 시 throw
  - MemoryView saveState 로컬 state + 5개 상태 전이
  - debounce 콜백의 .then()/.catch()
  - saveTitle 동일 반영
  - 메모 전환 시 saveState 초기화 + fade 타이머 cleanup
  - 헤더 인디케이터 렌더링
  - 성공 기준: 타이핑 → "저장 중..." → "저장됨 ✓" 2초 fade → idle. 실패 시 "저장 실패 ⚠" 지속.
```

**정책 메모**:
- A+B 패키지 ship이므로 commit 1 단독에서 upsert 영구 실패 시 dirty 고착은 허용(B-1이 재시도/토스트 커버).
- commit 1~2가 "쓰다가 사라지는" 현상의 핵심 방어. commit 3는 사용자 신뢰 회복용 UI + 에러 전파 인프라.
- commit 3에서 도입하는 `throw`는 Hotfix-B B-1의 try-catch 재시도가 같은 인터페이스를 재사용하므로 phase 간 일관성 확보.

---

## 8. 테스트 시나리오 (spec 기준 수동 검증)

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| T1 | 메모 A 타이핑 중 브라우저 개발자 도구에서 `useStore.getState().loadAll()` 실행 | A의 내용 유지 (A-1 동작) |
| T2 | 메모 A 타이핑 → 500ms 대기 → upsert 완료 → 수동 `loadAll()` | 내용 유지, 헤더에 "저장됨 ✓" 2초 후 사라짐 (A-1, A-2, A-3) |
| T3 | 네트워크 오프라인 상태에서 타이핑 → debounce flush → upsert 실패 | 로컬 내용 유지, "저장 실패 ⚠" 표시, dirty 유지 (A-1 fail policy, A-3) |
| T4 | 탭 숨김 → 10초 대기 → 복귀 (SyncContext loadAll 트리거) | 로컬 편집 유지 (A-1) |
| T5 | 신규 메모 생성 직후(upsert 진행 중) `loadAll()` 수동 트리거 | 새 메모가 목록에서 사라지지 않음 (A-1 merged push) |
| T6 | 메모 A 타이핑 중 메모 B 클릭 | A의 pending save는 올바른 id로 flush (기존 unmount flush `:75-84`), B가 표시됨. B 에디터에 A 내용 잔상 없음. B의 saveState는 'idle'로 초기화 |
| T7 | 저장 실패 후 같은 메모에서 추가 타이핑 | 'dirty' → 'saving'으로 전이, 재시도 결과에 따라 'saved' 또는 'error' |
| T8 | 저장 중 상태('dirty'/'saving') 에서 메모 전환 | 이전 메모의 pending이 flush되고 saveState는 새 메모 기준 'idle' |

**자동화 테스트**: 이 phase는 긴급 핫픽스라 자동 테스트 추가는 Loop 45로 미룬다. 수동 시나리오 기준.

---

## 9. Out of Scope 재확인

- navigator.onLine 인디케이터 → B
- upsert 자동 재시도 → B-1
- sendBeacon / visibilitychange 강화 → B-2
- 빈 문자열 저장 방어 → B-3
- deleteMemo 낙관적 삭제 보호 → B-4
- 메모 검색, Ctrl+Y, 빈 노트 삭제 confirm, 메모 전환 debounce 정밀화 → Loop 45
- 실시간 협업 / CRDT / Realtime 구독 → 후속
- OutlinerEditor 내부 수정 (줄 DnD, Zoom) → 후속 (never modify 제약)
- **A-4 lockedNotes 래퍼 (Revision 2에서 삭제됨)** — A-1 단일 방어 후 필요 시 별도 phase

---

## 10. 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| R1 | dirtyMemoIds 영구 고착 (실패 후 재편집 없으면 서버 변경 영원히 반영 안 됨) | A+B 묶음 ship으로 B-1 재시도가 커버. 성공 경로가 dominant하므로 실사용 영향 미미 |
| R2 | addMemo 직후 loadAll 시 로컬 전용 메모 소실 | 머지 로직에서 `current.memos 중 dirty && 서버에 없는 항목` push (§5-1 로직) |
| R3 | `updated_at` DB precision과 로컬 ISO millisecond 차이로 round-trip 불일치 | 로컬 set 값이 upsert payload와 동일, trigger 부재라 DB 그대로 저장. 실측 후 문제 시 B 단계에서 정규화 |
| R4 | `updateMemo`/`addMemo` throw 변경이 기존 호출측을 깬다 | 현 호출측은 await/then 없이 호출되는 곳 다수. unhandled rejection 가능 → commit 3에서 MemoryView의 **모든** `updateMemo`/`addMemo` 호출(`debouncedUpdateNotes`, `saveTitle`, color picker onClick, unmount flush, beforeunload handler, `handleAdd`)을 명시적 `.catch()`로 감싼다. `handleAdd`는 최소 가드(`console.error`)만, 나머지는 saveState 전이. Hotfix-B B-1에서 글로벌 에러 토스트로 보강 |
| R5 | 메모 전환 시 fade setTimeout이 이전 메모 saveState를 변경 | setTimeout 내부에서 `setSaveState(curr => curr === 'saved' ? 'idle' : curr)` 함수형 업데이트로 조건부 적용 + `useEffect`의 cleanup에서 `clearTimeout` |
| R6 | debounce 콜백 내 setState가 unmount 후 실행 (React warning) | cleanup(`MemoryView.jsx:75-84`)에서 `clearTimeout(debounceRef.current)` — 기존 로직 유지하면 콜백 자체가 실행되지 않음 |

---

## 11. 다음 단계

1. **이 spec을 Claude Web에서 검토/상세화** (목업, 엣지케이스, 비즈니스 룰)
2. 상세화 완료 후 파일 업데이트
3. `/diff-plan Hotfix-A` 실행
4. `/execute Hotfix-A` 실행
