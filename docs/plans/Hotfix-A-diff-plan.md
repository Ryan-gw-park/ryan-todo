# Hotfix-A Diff Plan — 파일·줄 단위 변경 명세

- **Phase**: Hotfix-A
- **Spec**: `docs/plans/Hotfix-A-spec.md` (Rev 3)
- **Recon**: `docs/plans/Hotfix-A-recon.md`
- **Date**: 2026-04-20
- **원칙**: R-ATOMIC — 3개 커밋, 각각 독립 컴파일 가능
- **코드 수정 범위**: 2개 파일, 신규 파일·DB 변경·API 변경 없음

---

## 0. 전체 요약

| 항목 | 값 |
|------|-----|
| 수정 파일 | `src/hooks/useStore.js`, `src/components/views/MemoryView.jsx` |
| 신규 파일 | 없음 |
| DB 마이그레이션 | **없음** (스키마 불변, `updated_at` 컬럼 기존) |
| API 엔드포인트 변경 | 없음 (Supabase REST upsert payload에 `updated_at` 키만 추가) |
| 총 예상 LOC | ~75~95 |
| 커밋 수 | 3 |
| 호출산 영향 | `updateMemo`/`addMemo` 호출은 **MemoryView.jsx 내부 6곳뿐** (grep 전수 확인 완료). 외부 파일 없음 |

---

## 1. 변경 파일 목록 (요약)

### 1-1. `src/hooks/useStore.js` (5개 지점)

| # | 줄 | 변경 유형 | 요지 |
|---|-----|-----------|------|
| S1 | `:252` 직후 | 추가 | Zustand 초기값에 `dirtyMemoIds: {}` 삽입 |
| S2 | `:487-489` | 수정 | loadAll memos 머지 로직을 dirty-aware 분기로 교체 |
| S3 | `:850-861` | 수정 | `addMemo`: 진입 시 dirty add + `updated_at` payload + 성공 시 dirty delete + 실패 시 throw |
| S4 | `:863-874` | 수정 | `updateMemo`: 동일 패턴 |
| S5 | `:499` | **변경 없음** (확인만) | 스냅샷 저장 payload에 `dirtyMemoIds`를 **포함하지 않는다**. 런타임 외 의미 없음 |

### 1-2. `src/components/views/MemoryView.jsx` (9개 지점)

| # | 줄 | 변경 유형 | 요지 |
|---|-----|-----------|------|
| V1 | `:52-58` 영역 | 추가 | `MemoDetailPane` 상단에 `saveState` + `fadeRef` 신설 |
| V2 | `:63-72` | 수정 | `debouncedUpdateNotes` 콜백에 `.then()/.catch()` + saveState 전이 |
| V3 | `:75-84` | 수정 | unmount flush의 `updateMemo`에 `.catch(e => console.error(...))` 가드 + fade 타이머 cleanup |
| V4 | `:87-98` | 수정 | beforeunload flush의 `updateMemo`에 `.catch(...)` 가드 |
| V5 | `:102` 근처 | 추가 | 메모 전환 시 `saveState` 초기화 effect + fade 타이머 cleanup |
| V6 | `:117-119` | 수정 | `saveTitle`에 saveState 전이 + `.then()/.catch()` |
| V7 | `:163` | 수정 | color picker onClick에 saveState 전이 + `.then()/.catch()` |
| V8 | `:188-193` 헤더 영역 | 수정 | 날짜 라인을 flex로 확장, 옆에 saveState 인디케이터 |
| V9 | `:226-230` | 수정 | `handleAdd`의 `addMemo()`를 try/catch로 감쌈 (최소 가드) |

---

## 2. 파일별 상세 변경 (before → after)

### 2-1. `src/hooks/useStore.js`

#### S1 — `dirtyMemoIds: {}` 초기값 (`:252` 직후)

**Before** (`:249-254`):
```js
const useStore = create((set, get) => ({
  projects: [],
  tasks: [],
  memos: [],
  milestones: [],
  syncStatus: 'ok',
```

**After**:
```js
const useStore = create((set, get) => ({
  projects: [],
  tasks: [],
  memos: [],
  dirtyMemoIds: {},                 // ← Hotfix-A: 편집 중(upsert pending/실패) memo id 집합
  milestones: [],
  syncStatus: 'ok',
```

커밋: **commit 1** (A-1).

#### S2 — loadAll memos 머지 분기 (`:487-489`)

**Before** (`:486-490`):
```js
const patch = { collapseState: cs, syncStatus: 'ok', userTaskSettings: mergedUts, milestones }
if (!isArrayEqual(current.tasks, tasks)) patch.tasks = tasks
if (!isArrayEqual(current.projects, projects)) patch.projects = projects
if (!isArrayEqual(current.memos, memos)) patch.memos = memos
set(patch)
```

**After**:
```js
const patch = { collapseState: cs, syncStatus: 'ok', userTaskSettings: mergedUts, milestones }
if (!isArrayEqual(current.tasks, tasks)) patch.tasks = tasks
if (!isArrayEqual(current.projects, projects)) patch.projects = projects
if (!isArrayEqual(current.memos, memos)) {
  // Hotfix-A A-1: 편집 중(dirty) memo는 서버 stale로 덮어쓰지 않는다.
  const dirty = get().dirtyMemoIds
  const dirtyIds = Object.keys(dirty)
  if (dirtyIds.length === 0) {
    patch.memos = memos
  } else {
    const localMap = new Map(current.memos.map(m => [m.id, m]))
    const merged = memos.map(m => dirty[m.id] ? (localMap.get(m.id) || m) : m)
    // addMemo 직후 upsert 전: 로컬에만 있는 dirty 항목 보존
    for (const m of current.memos) {
      if (dirty[m.id] && !memos.find(s => s.id === m.id)) merged.push(m)
    }
    patch.memos = merged
  }
}
set(patch)
```

커밋: **commit 1** (A-1).

#### S3 — `addMemo` 재작성 (`:850-861`)

**Before**:
```js
addMemo: async (memo) => {
  const m = { id: crypto.randomUUID(), title: '', notes: '', color: 'yellow', sortOrder: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...memo }
  set(s => ({ memos: [...s.memos, m] }))
  const d = db()
  if (!d) return
  const userId = await getCurrentUserId()
  const { error } = await d.from('memos').upsert({
    id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder, user_id: userId,
  })
  if (error) console.error('[Ryan Todo] addMemo:', error)
  return m
},
```

**After** (모든 커밋 반영된 최종 모양):
```js
addMemo: async (memo) => {
  const m = { id: crypto.randomUUID(), title: '', notes: '', color: 'yellow', sortOrder: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...memo }
  // Hotfix-A A-1: 로컬 append + dirty mark (loadAll 머지에서 보호)
  set(s => ({ memos: [...s.memos, m], dirtyMemoIds: { ...s.dirtyMemoIds, [m.id]: true } }))
  const d = db()
  if (!d) return m   // 오프라인: dirty 유지한 채 리턴 (다음 연결 시 재시도는 B-1 범위)
  const userId = await getCurrentUserId()
  const { error } = await d.from('memos').upsert({
    id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder, user_id: userId,
    updated_at: m.updatedAt,                                            // ← Hotfix-A A-2
  })
  if (error) {
    console.error('[Ryan Todo] addMemo:', error)
    throw error                                                         // ← Hotfix-A A-3: 호출측 .catch() 감지용 (dirty 유지)
  }
  // 성공: dirty 해제
  set(s => {
    const { [m.id]: _, ...rest } = s.dirtyMemoIds
    return { dirtyMemoIds: rest }
  })
  return m
},
```

커밋 배분:
- dirty add/remove 라이프사이클 → **commit 1**
- `updated_at` payload 추가 → **commit 2**
- `throw error` 추가 → **commit 3**

> **구현 노트**: commit 1 시점에선 `throw`가 아직 없으므로 `if (error) console.error(...)` 유지하되 성공 블록에서만 dirty 제거. commit 3에서 throw 추가 + 에러 블록에서 dirty 제거하지 않음(이미 유지). commit 2는 payload 키 추가만.

#### S4 — `updateMemo` 재작성 (`:863-874`)

**Before**:
```js
updateMemo: async (id, patch) => {
  set(s => ({ memos: s.memos.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m) }))
  const m = get().memos.find(x => x.id === id)
  if (!m) return
  const d = db()
  if (!d) return
  const userId = await getCurrentUserId()
  const { error } = await d.from('memos').upsert({
    id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder, user_id: userId,
  })
  if (error) console.error('[Ryan Todo] updateMemo:', error)
},
```

**After** (모든 커밋 반영된 최종 모양):
```js
updateMemo: async (id, patch) => {
  // Hotfix-A A-1: 로컬 반영 + dirty mark
  set(s => ({
    memos: s.memos.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m),
    dirtyMemoIds: { ...s.dirtyMemoIds, [id]: true },
  }))
  const m = get().memos.find(x => x.id === id)
  if (!m) {
    // 방어: m이 없는 비정상 상태 — dirty는 제거하여 영구 고착 방지
    set(s => { const { [id]: _, ...rest } = s.dirtyMemoIds; return { dirtyMemoIds: rest } })
    return
  }
  const d = db()
  if (!d) throw new Error('offline')      // ← Hotfix-A A-3: 오프라인도 실패로 간주 (dirty 유지)
  const userId = await getCurrentUserId()
  const { error } = await d.from('memos').upsert({
    id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder, user_id: userId,
    updated_at: m.updatedAt,                                         // ← Hotfix-A A-2
  })
  if (error) {
    console.error('[Ryan Todo] updateMemo:', error)
    throw error                                                      // ← Hotfix-A A-3 (dirty 유지)
  }
  // 성공: dirty 해제
  set(s => {
    const { [id]: _, ...rest } = s.dirtyMemoIds
    return { dirtyMemoIds: rest }
  })
},
```

커밋 배분: S3와 동일 (commit 1 → dirty + `if (!m)` 가드, commit 2 → updated_at, commit 3 → throw).

#### S5 — 스냅샷 저장 영향 없음 (`:499` 확인)

**변경 없음**. `snapshot = { tasks, projects, memos, teamId, timestamp, collapseState, userTaskSettings }` — `dirtyMemoIds`는 포함되지 않음. 실수로 넣지 않도록 commit 1에서 주석 추가 권장.

---

### 2-2. `src/components/views/MemoryView.jsx`

#### V1 — `saveState` + `fadeRef` 신설 (`:52-58` 영역)

**Before** (`:52-58`):
```jsx
function MemoDetailPane({ memo, onBack, isMobile }) {
  const { updateMemo, deleteMemo } = useStore()
  const [title, setTitle] = useState(memo.title)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const titleRef = useRef(null)
  const editorRef = useRef(null)
  const colorPickerRef = useRef(null)
```

**After**:
```jsx
function MemoDetailPane({ memo, onBack, isMobile }) {
  const { updateMemo, deleteMemo } = useStore()
  const [title, setTitle] = useState(memo.title)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [saveState, setSaveState] = useState('idle')   // ← 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  const titleRef = useRef(null)
  const editorRef = useRef(null)
  const colorPickerRef = useRef(null)
  const fadeRef = useRef(null)                          // ← 'saved' → 'idle' 페이드 타이머
```

커밋: **commit 3** (A-3).

#### V2 — `debouncedUpdateNotes` 재작성 (`:63-72`)

**Before**:
```jsx
const debouncedUpdateNotes = useCallback((newNotes) => {
  // 로컬 state는 OutlinerEditor가 즉시 관리 (UI 반응 빠름)
  // DB upsert만 debounce
  if (debounceRef.current) clearTimeout(debounceRef.current)
  pendingSaveRef.current = newNotes
  debounceRef.current = setTimeout(async () => {
    await updateMemo(memo.id, { notes: pendingSaveRef.current })
    pendingSaveRef.current = null
  }, 500)
}, [memo.id, updateMemo])
```

**After**:
```jsx
const debouncedUpdateNotes = useCallback((newNotes) => {
  // UI 즉시 반응: dirty 표시
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
        if (fadeRef.current) clearTimeout(fadeRef.current)
        fadeRef.current = setTimeout(() => {
          setSaveState(curr => curr === 'saved' ? 'idle' : curr)
        }, 2000)
      })
      .catch(() => {
        setSaveState('error')
      })
  }, 500)
}, [memo.id, updateMemo])
```

커밋: **commit 3** (A-3).

#### V3 — unmount flush `.catch()` 가드 (`:75-84`)

**Before**:
```jsx
useEffect(() => {
  return () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      if (pendingSaveRef.current !== null) {
        updateMemo(memo.id, { notes: pendingSaveRef.current })
      }
    }
  }
}, [memo.id, updateMemo])
```

**After**:
```jsx
useEffect(() => {
  return () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      if (pendingSaveRef.current !== null) {
        updateMemo(memo.id, { notes: pendingSaveRef.current })
          .catch(e => console.error('[Ryan Todo] unmount flush:', e))
      }
    }
    if (fadeRef.current) clearTimeout(fadeRef.current)
  }
}, [memo.id, updateMemo])
```

커밋: **commit 3** (A-3).

#### V4 — beforeunload flush `.catch()` 가드 (`:87-98`)

**Before**:
```jsx
useEffect(() => {
  const handler = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      if (pendingSaveRef.current !== null) {
        updateMemo(memo.id, { notes: pendingSaveRef.current })
      }
    }
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [memo.id, updateMemo])
```

**After**:
```jsx
useEffect(() => {
  const handler = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      if (pendingSaveRef.current !== null) {
        updateMemo(memo.id, { notes: pendingSaveRef.current })
          .catch(e => console.error('[Ryan Todo] beforeunload flush:', e))
      }
    }
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [memo.id, updateMemo])
```

커밋: **commit 3** (A-3).

#### V5 — 메모 전환 시 saveState 초기화 effect (`:102` 근처)

**Before** (`:102`):
```jsx
useEffect(() => { setTitle(memo.title) }, [memo.id, memo.title])
```

**After** — 해당 effect 바로 아래에 추가:
```jsx
useEffect(() => { setTitle(memo.title) }, [memo.id, memo.title])

// Hotfix-A A-3: 메모 전환 시 saveState를 idle로 리셋하고 페이드 타이머 정리
useEffect(() => {
  setSaveState('idle')
  if (fadeRef.current) {
    clearTimeout(fadeRef.current)
    fadeRef.current = null
  }
}, [memo.id])
```

커밋: **commit 3** (A-3).

#### V6 — `saveTitle` saveState 전이 (`:117-119`)

**Before**:
```jsx
const saveTitle = () => {
  if (title !== memo.title) updateMemo(memo.id, { title })
}
```

**After**:
```jsx
const saveTitle = () => {
  if (title === memo.title) return
  setSaveState('saving')
  updateMemo(memo.id, { title })
    .then(() => {
      setSaveState('saved')
      if (fadeRef.current) clearTimeout(fadeRef.current)
      fadeRef.current = setTimeout(() => {
        setSaveState(curr => curr === 'saved' ? 'idle' : curr)
      }, 2000)
    })
    .catch(() => setSaveState('error'))
}
```

커밋: **commit 3** (A-3).

> **노트**: `saveTitle`은 `onBlur`와 `handleTitleKeyDown`의 Enter에서 호출됨. Enter 처리 후 `editorRef.current?.focusFirst()`가 50ms setTimeout으로 실행되는데, 이 타이밍에 saveState가 'saving'이어도 에디터 포커스 이동에는 영향 없음 — 별도 처리 불요.

#### V7 — color picker onClick saveState 전이 (`:163`)

**Before**:
```jsx
onClick={() => { updateMemo(memo.id, { color: c.id }); setShowColorPicker(false) }}
```

**After**:
```jsx
onClick={() => {
  setSaveState('saving')
  updateMemo(memo.id, { color: c.id })
    .then(() => {
      setSaveState('saved')
      if (fadeRef.current) clearTimeout(fadeRef.current)
      fadeRef.current = setTimeout(() => {
        setSaveState(curr => curr === 'saved' ? 'idle' : curr)
      }, 2000)
    })
    .catch(() => setSaveState('error'))
  setShowColorPicker(false)
}}
```

커밋: **commit 3** (A-3).

> **리팩터 기회**: V2/V6/V7 세 곳에 동일한 `.then().catch()` 패턴이 반복된다. 커밋 내에서 `runSave(fn)` 같은 로컬 헬퍼를 MemoDetailPane 내부에 정의해도 좋다. 다만 본 diff plan은 명시성 우선으로 인라인 유지. 헬퍼 도입은 execute 단계에서 판단.

#### V8 — saveState 인디케이터 UI (`:188-193`)

**Before**:
```jsx
{/* 날짜 (제목 아래) */}
<div style={{ fontSize: 11, color: '#a09f99', marginTop: 2, paddingLeft: isMobile ? 60 : 22 }}>
  {formatDate(memo.updatedAt || memo.createdAt)}
</div>
{/* Hairline */}
<div style={{ height: '0.5px', background: '#f0efe8', marginTop: 10 }} />
```

**After**:
```jsx
{/* 날짜 + 저장 상태 (제목 아래) */}
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, paddingLeft: isMobile ? 60 : 22 }}>
  <span style={{ fontSize: 11, color: '#a09f99' }}>
    {formatDate(memo.updatedAt || memo.createdAt)}
  </span>
  {saveState !== 'idle' && (
    <span style={{
      fontSize: 11,
      color: saveState === 'saved' ? '#38A169'
           : saveState === 'error' ? '#E53E3E'
           : '#888',                                  // dirty / saving
    }}>
      {saveState === 'saved' ? '저장됨 ✓'
        : saveState === 'error' ? '저장 실패 ⚠'
        : '저장 중…'}
    </span>
  )}
</div>
{/* Hairline */}
<div style={{ height: '0.5px', background: '#f0efe8', marginTop: 10 }} />
```

커밋: **commit 3** (A-3).

#### V9 — `handleAdd`의 `addMemo` catch 가드 (`:226-230`)

**Before**:
```jsx
const handleAdd = useCallback(async () => {
  const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].id
  const newMemo = await addMemo({ title: '', notes: '', color: randomColor })
  if (newMemo) setSelectedId(newMemo.id)
}, [addMemo])
```

**After**:
```jsx
const handleAdd = useCallback(async () => {
  const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].id
  try {
    const newMemo = await addMemo({ title: '', notes: '', color: randomColor })
    if (newMemo) setSelectedId(newMemo.id)
  } catch (e) {
    console.error('[Ryan Todo] handleAdd:', e)       // Hotfix-A: 최소 가드, 본격 에러 UI는 Hotfix-B
  }
}, [addMemo])
```

커밋: **commit 3** (A-3).

---

## 3. DB 마이그레이션 — 없음

memos 테이블 스키마는 전혀 바뀌지 않는다.
- `updated_at` 컬럼은 이미 존재(`useStore.js:8 MEMO_COLUMNS`에 포함).
- 트리거 추가·제거 없음. `BEFORE UPDATE` 트리거는 memos에 여전히 부재한 채로 유지하며, 대신 클라이언트가 payload에 `updated_at`을 명시한다(A-2).
- RLS 정책 변경 없음.

---

## 4. API 변경 — 없음

Supabase REST API endpoint는 그대로. 단, `POST /rest/v1/memos` (upsert) 요청 바디에 `updated_at` 필드가 추가된다. Supabase PostgREST는 알려진 컬럼이면 그대로 INSERT/UPDATE에 사용하므로 별도 설정 불필요.

---

## 5. 프론트엔드 변경 요약

- 컴포넌트: `MemoDetailPane` (MemoryView.jsx 내부)에 state 2개 추가 (`saveState`, `fadeRef`). 5개 `updateMemo` 호출 지점을 `.then().catch()` 패턴으로 변경. 1개 `addMemo` 호출 지점을 `try/catch`로 감쌈.
- 새 컴포넌트: 없음.
- 페이지: 없음.
- 스타일: 헤더 영역 인라인 스타일만 수정 (날짜 라인을 flex 컨테이너로 확장).

---

## 6. 작업 순서 (커밋 단위)

> ⚠ **배포 제약**: Commit 1/2/3은 반드시 동일 PR에서 squash 또는 동시 merge. Commit 1 단독 배포 시 W2(dirty 영구 고착) + W3(isArrayEqual 오판으로 핵심 결함 미해결) 발생. R-ATOMIC 원칙은 "독립 컴파일 가능"이지 "독립 배포 가능"이 아님.

### Commit 1 — A-1 Dirty-set 격리 (plain object)

**파일**: `src/hooks/useStore.js`

- S1: `dirtyMemoIds: {}` 초기값 추가
- S2: loadAll memos 머지 분기
- S3 (부분): `addMemo` 진입 시 dirty add + 성공 시 제거. `updated_at` / `throw`는 이 커밋에 포함하지 않음 (기존 `console.error` 유지)
- S4 (부분): `updateMemo` 동일 + `if (!m)` 조기 리턴 분기에서도 dirty 제거

**검증**:
- `npm run build` 성공
- 브라우저 콘솔에서 `useStore.getState().dirtyMemoIds` 확인: `{}` 기본
- 메모 타이핑 → debounce 500ms → `updateMemo` 호출 → 진입 시 dirty에 등록, 성공 시 제거되는지 확인 (console.log 임시 삽입 후 제거)
- **재현 테스트 T1**: 타이핑 중 개발자 도구에서 `useStore.getState().loadAll()` → 로컬 내용 유지되는지

### Commit 2 — A-2 upsert에 updated_at 포함

**파일**: `src/hooks/useStore.js`

- S3 (부분): `addMemo` upsert payload에 `updated_at: m.updatedAt` 추가
- S4 (부분): `updateMemo` upsert payload에 동일 추가

**검증**:
- `npm run build` 성공
- 브라우저에서 memo update → Supabase 대시보드 Table Editor에서 해당 row의 `updated_at`이 변경되는지
- **재현 테스트 T2**: 타이핑 → 500ms 대기 → `loadAll()` 수동 → `isArrayEqual(current.memos, memos)` 결과가 true(같음)인지 (임시 console.log로 확인 후 제거)

### Commit 3 — A-3 저장 상태 UI + 에러 throw 인프라

**파일**: `src/hooks/useStore.js` + `src/components/views/MemoryView.jsx`

- S3 (부분): `addMemo` 에러 시 throw, 오프라인(`if (!d)`) return 유지
- S4 (부분): `updateMemo` 에러 시 throw, 오프라인 시 `throw new Error('offline')`
- V1~V9: MemoryView 전체 saveState 인프라

**검증**:
- `npm run build` 성공
- 타이핑 → 헤더에 "저장 중…" 회색 표시
- 500ms 후 `updateMemo` 호출 → "저장 중…" 유지 (saving)
- upsert 성공 → "저장됨 ✓" 녹색 → 2초 후 사라짐
- 오프라인 상태에서 타이핑 → 500ms 후 "저장 실패 ⚠" 빨강 지속
- 메모 전환 → 새 메모 기준 "idle"
- **재현 테스트 T3, T6, T7, T8**

---

## 7. 검증 절차 (Hotfix-A 완료 기준)

### 7-1. 자동 검증
- `npm run build`: 3회 모두 성공 (commit 1, 2, 3 각 커밋 직후)
- TypeScript·ESLint 경고 0건 (기존 경고는 그대로 허용)

### 7-2. 수동 검증 시나리오 (spec §8 T1~T8)

| # | 시나리오 | 검증 방법 | 기대 |
|---|---------|----------|------|
| T1 | 타이핑 중 `loadAll()` 수동 트리거 | DevTools: `useStore.getState().loadAll()` | 내용 유지 |
| T2 | 타이핑 → 500ms → `loadAll()` | 상동 | "저장됨 ✓" 2초 fade |
| T3 | 오프라인 타이핑 | DevTools Network Offline | "저장 실패 ⚠" 지속 |
| T4 | 탭 숨김 → 10초 → 복귀 | 탭 전환 | 편집 유지 |
| T5 | 새 메모 생성 직후 `loadAll()` | handleAdd 후 1초 내 수동 트리거 | 새 메모 유지 |
| T6 | 메모 A 타이핑 중 B 클릭 | UI 조작 | A flush + B idle |
| T7 | 저장 실패 후 재편집 | offline→online→재타이핑 | 'error' → 'dirty' → 'saving' → 'saved' |
| T8 | 'saving' 중 메모 전환 | UI 조작 | B는 idle로 시작, A의 pending flush |

### 7-3. 회귀 확인
- 기존 Task/Project CRUD는 무영향 (useStore의 다른 action은 변경 없음)
- OutlinerEditor는 수정 금지 — 로컬 입력 동작 동일
- `showToast`는 변경 없음. deleteMemo의 토스트 유지.

---

## 8. 리스크 & 완화 (spec §10과 동일 + 구현 특이점)

| # | 리스크 | 완화 |
|---|--------|------|
| D1 | commit 1 단독 ship 상태에서 upsert가 에러 리턴하면 dirty 제거 안 됨 → 영구 고착 | commit 1에선 에러 시 dirty 제거하도록 일시 설계 ❌ (spec §5-1은 실패 시 유지 정책) → **대신 commit 2/3까지 동시 ship 원칙 유지**. 중간 단계 stash 금지 |
| D2 | Set/Map 미사용 원칙 위반 실수 (spec Rev 2에서 명확히 plain object로 선택) | 리뷰 시 grep으로 `new Set(` / `new Map(` 새 인스턴스 확인 (기존 Zustand state 범위 밖의 로컬 변수는 허용) |
| D3 | `updated_at` ISO 왕복 문자열 불일치 | spec §4-4에서 round-trip 보장 논증 완료. commit 2 검증에서 Supabase 대시보드로 확인 |
| D4 | saveState 'saving' 직후 `updateMemo`가 throw했을 때 pendingSaveRef가 null이 안 됨 | V2의 `.then()` 블록에서만 null 설정 → 실패 시 pendingSaveRef 보존 → 다음 debounce 발동 시 덮어써짐(OK). 또는 unmount 시 다시 flush 시도. 의도된 동작 |
| D5 | color picker에서 saveState='saving' 중 다른 색 클릭 | V7은 새 saveState='saving'으로 덮어씀. 이전 fade 타이머는 V2/V7 공통으로 `fadeRef`를 통해 clearTimeout |
| D6 | commit 3에서 throw 추가 시 commit 1/2 시점의 기존 호출부가 catch 없이 호출 | commit 3 범위에 **MemoryView의 6개 호출 지점 전부** .catch/try 추가 포함. grep 결과상 MemoryView 외 호출 없음 (§0의 grep 전수 확인 결과) |

---

## 9. Out of Scope (재확인)

- navigator.onLine / 오프라인 인디케이터 → Hotfix-B
- upsert 자동 재시도 / 글로벌 에러 토스트 → Hotfix-B B-1
- **오프라인 중 addMemo → 새로고침 시 신규 메모 소실 (스냅샷은 loadAll 성공 시에만 저장되므로) → Hotfix-B B-1 범위**
- sendBeacon / visibilitychange 강화 → Hotfix-B B-2
- 빈 문자열 저장 방어 → Hotfix-B B-3
- deleteMemo 보호 → Hotfix-B B-4
- 메모 검색, Ctrl+Y, 빈 노트 삭제 confirm, 메모 전환 debounce 정밀화 → Loop 45
- OutlinerEditor 내부 수정 → 후속 (never modify)
- Escape→blur→saveTitle 이중 호출 (W1, 기존 버그) → Loop 45 범위
- V2 fade setTimeout의 메모 전환 race (W4, cosmetic) → Loop 45 범위

---

## 10. 다음 단계

1. 이 Diff Plan을 `diff-reviewer` subagent에 전달하여 누락·결함 검토
2. 리뷰 통과 시 `/execute Hotfix-A` 실행
