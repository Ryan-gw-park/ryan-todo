# 노트 안정화 수정 계획

> **Trigger**: 노트 데이터 유실 리포트 + Workflowy 이탈
> **Date**: 2026-04-20
> **근거**: notes-audit (Claude Code 전수조사 완료)
> **원칙**: 데이터 유실 수정 > 크래시 수정 (메모리 commit ordering)

---

## Phase 구성

| Phase | 내용 | 성격 | 예상 소요 |
|-------|------|------|----------|
| **Hotfix-A** | 데이터 유실 박멸 + 저장 상태 UI | 긴급 핫픽스 (Loop 아님) | 반나절 |
| **Hotfix-B** | 네트워크 방어 + 탭 닫기 방어 | 긴급 핫픽스 연장 | 반나절 |
| **Loop 45** | 사용성 개선 (검색, Redo, 빈 노트 방어) | 정규 Loop | 1~2일 |

**Hotfix-A + B는 하나의 커밋 시퀀스로 ship. A가 먼저 (data loss > crash).**

---

## Hotfix-A: 데이터 유실 박멸 + 저장 상태 UI

### A-1. Dirty-set 격리 (useStore.js)

**문제**: loadAll()이 memos 배열을 통째 교체. 편집 중 메모도 서버 stale 값으로 덮어씀.
**위치**: useStore.js:489

**수정**:
```
- 신규 state: dirtyMemoIds: new Set() (useStore.js 초기값 영역)
- updateMemo() 진입 시: dirtyMemoIds.add(id)
- updateMemo() upsert 성공 콜백에서: dirtyMemoIds.delete(id)
- addMemo() 진입 시: dirtyMemoIds.add(id)  
- addMemo() upsert 성공 콜백에서: dirtyMemoIds.delete(id)
```

**loadAll() 머지 변경 (useStore.js:489)**:
```
Before:
  if (!isArrayEqual(current.memos, memos)) patch.memos = memos

After:
  if (!isArrayEqual(current.memos, memos)) {
    const dirty = get().dirtyMemoIds
    if (dirty.size === 0) {
      patch.memos = memos              // dirty 없으면 전체 교체 (기존 동작)
    } else {
      // dirty 항목은 로컬 유지, 나머지만 서버 값으로 갱신
      const localMap = new Map(current.memos.map(m => [m.id, m]))
      const merged = memos.map(m => dirty.has(m.id) ? (localMap.get(m.id) || m) : m)
      // 로컬에만 있는 dirty 항목 (addMemo 후 아직 upsert 안 된 것) 추가
      for (const m of current.memos) {
        if (dirty.has(m.id) && !memos.find(s => s.id === m.id)) merged.push(m)
      }
      patch.memos = merged
    }
  }
```

### A-2. upsert에 updated_at 포함 (useStore.js)

**문제**: upsert payload에 updated_at 없음. DB trigger 존재 여부 불명. isArrayEqual이 오판 가능.
**위치**: useStore.js:870-872

**수정**:
```
Before:
  const { error } = await d.from('memos').upsert({
    id, title: m.title, notes: m.notes, color: m.color,
    sort_order: m.sortOrder, user_id: uid
  })

After:
  const { error } = await d.from('memos').upsert({
    id, title: m.title, notes: m.notes, color: m.color,
    sort_order: m.sortOrder, user_id: uid,
    updated_at: m.updatedAt    // ← 추가
  })
```

addMemo도 동일하게 updated_at 포함 (useStore.js:856-858).

**사전 확인 필요**: Supabase 대시보드에서 memos 테이블의 updated_at 컬럼이 timestamp with time zone인지 확인. 그리고 DB trigger가 있다면 trigger가 우리 값을 덮어쓰는지 확인. trigger가 있으면 conflict할 수 있으므로, 이 경우 trigger를 제거하거나 trigger의 updated_at이 payload보다 새로우면 무시하도록 변경.

### A-3. 저장 상태 UI (MemoryView.jsx wrapping)

**문제**: 저장 성공/실패/진행 중을 사용자가 알 수 없음. "저장된 줄 알았는데 사라짐"의 핵심 원인.
**위치**: MemoryView.jsx 에디터 영역

**수정**:
```
에디터 상단 또는 제목 옆에 상태 표시:

- dirtyMemoIds.has(selectedId) && debounce pending → "저장 중..."  (회색 텍스트)
- dirtyMemoIds.has(selectedId) && upsert 진행 중   → "저장 중..."  (회색 텍스트)
- !dirtyMemoIds.has(selectedId)                    → "저장됨 ✓"    (녹색, 2초 후 fade)
- upsert 실패                                      → "저장 실패 ⚠" (빨간색, 지속)
- navigator.onLine === false                       → "오프라인"     (주황색)
```

**구현 방식**:
- useStore에 `memoSaveStatus: Map<id, 'dirty'|'saving'|'saved'|'error'>` 추가
- updateMemo 진입 → 'dirty'
- upsert 시작 → 'saving'  
- upsert 성공 → 'saved' (2초 후 Map에서 제거)
- upsert 실패 → 'error'
- MemoryView에서 현재 selectedId의 status를 구독하여 표시

**참고 패턴**: MyProfile.jsx:206에 이미 '저장됨' / '저장 중...' / '저장' UI가 있음. 동일 패턴 차용.

### A-4. OutlinerEditor 외부 리셋 방어

**문제**: OutlinerEditor.jsx:26-32에서 외부 notes prop 변경 시 편집 중이어도 무조건 리셋.
**제약**: OutlinerEditor는 "never modify" 파일.

**수정 (MemoryView.jsx wrapper 레벨에서 방어)**:
```
MemoryView에서 OutlinerEditor에 전달하는 notes prop을 제어:

const [lockedNotes, setLockedNotes] = useState(memo.notes)
const isDirty = dirtyMemoIds.has(memo.id)

// dirty 상태면 외부 변경 무시, dirty 해제 후에만 서버 값 반영
useEffect(() => {
  if (!isDirty) setLockedNotes(memo.notes)
}, [memo.notes, isDirty])

<OutlinerEditor
  notes={lockedNotes}      // ← memo.notes 대신 lockedNotes 전달
  onChange={handleChange}
/>
```

이렇게 하면 OutlinerEditor 자체를 수정하지 않으면서, dirty 상태에서 loadAll의 stale 값이 에디터에 도달하는 것을 차단함.

---

## Hotfix-B: 네트워크 방어 + 탭 닫기 방어

### B-1. upsert 에러 핸들링 + 재시도 (useStore.js)

**문제**: upsert 실패 시 console.error만. 재시도 없음. 사용자 알림 없음.
**위치**: useStore.js:863-874

**수정**:
```
updateMemo를 try-catch로 감싸고, 실패 시:
1. memoSaveStatus.set(id, 'error')
2. 3초 후 1회 재시도
3. 재시도 실패 시 showToast('노트 저장 실패. 재시도합니다...', 'error')
4. dirtyMemoIds에서 제거하지 않음 → 로컬 값 보존
5. 다음 사용자 편집 시 자연스럽게 재시도됨 (updateMemo가 다시 호출되므로)
```

addMemo, deleteMemo에도 동일 패턴 적용.

### B-2. beforeunload flush 강화 (MemoryView.jsx)

**문제**: beforeunload에서 async updateMemo를 await 없이 호출. 마지막 입력 소실 가능.
**위치**: MemoryView.jsx:87-98

**수정**:
```
beforeunload 핸들러에서:
1. debounce를 즉시 flush (cancel + 즉시 실행)
2. navigator.sendBeacon()으로 동기 전송 (fetch/upsert 대신)
   - sendBeacon은 페이지 종료 시에도 브라우저가 전송 보장
   - Supabase REST endpoint에 직접 POST
3. sendBeacon이 불가능하면 fallback으로 fetch keepalive: true
```

**대안 (더 간단)**:
```
visibilitychange 이벤트를 사용:
- document.visibilityState === 'hidden' 시 즉시 flush + updateMemo
- 탭 전환/최소화 시점에 저장하므로 beforeunload보다 안정적
- beforeunload는 보조 방어선으로 유지
```

### B-3. 빈 내용 저장 방어 (MemoryView.jsx)

**문제**: notes가 빈 문자열이어도 DB에 그대로 upsert. 버그로 빈 값이 emit되면 방어 불가.
**위치**: MemoryView.jsx debounce 콜백

**수정**:
```
debouncedUpdateNotes 콜백에서:
- 새 notes 값이 '' 이고 이전 값이 ''가 아닌 경우 → 저장 건너뛰기 + 경고 로그
- 이전 값과 동일한 경우 → 저장 건너뛰기 (불필요한 upsert 방지)
```

### B-4. 낙관적 업데이트 롤백 기초 (useStore.js)

**문제**: upsert 실패해도 로컬에 낙관적 업데이트가 남음 → 다음 loadAll이 옛 값으로 덮어씀 → "깜빡" 증상.
**위치**: useStore.js addMemo, updateMemo

**수정 (최소한)**:
```
upsert 실패 시:
- dirtyMemoIds에서 제거하지 않음 (A-1 dirty-set이 보호)
- 로컬 값 유지 (롤백하지 않음) — 사용자 입력 보존 우선
- 다음 성공적 upsert 또는 수동 새로고침 시 정합
- memoSaveStatus를 'error'로 설정 → UI에 표시 (A-3)
```

완전한 롤백(실패 시 이전 값 복원)은 복잡도가 높아 후속 과제로 분리.

---

## Loop 45: 사용성 개선

### 45-1. 메모 검색 (MemoryView.jsx)

**문제**: 검색 기능 없음. 메모가 늘어나면 원하는 것을 찾을 수 없음.
**Workflowy 핵심 기능 중 하나.**

**수정**:
```
메모 목록 상단에 검색 input 추가.
- title + notes 텍스트 검색 (클라이언트 사이드 filter)
- 검색어 하이라이트 (목록에서)
- 디바운스 200ms
- 빈 검색어 → 전체 표시
- 검색 결과 없음 → "검색 결과 없음" 메시지
```

### 45-2. Ctrl+Y / Redo 지원

**문제**: Ctrl+Z (undo)만 있고 Redo 없음.
**위치**: useOutliner.js

**제약**: OutlinerEditor는 "never modify"이지만 useOutliner.js는 제약 없음.

**수정**:
```
useOutliner.js의 undo history에 redo stack 추가:
- Ctrl+Z → history에서 pop, redo stack에 push
- Ctrl+Y (또는 Ctrl+Shift+Z) → redo stack에서 pop, history에 push
- 새 입력 시 redo stack 클리어
```

### 45-3. 빈 노트 삭제 방어 (MemoryView.jsx)

**문제**: title과 notes가 비어 있으면 confirm 없이 즉시 삭제. 방금 타이핑 시작한 메모가 debounce 중이면 "빈 노트"로 간주되어 삭제됨.
**위치**: MemoryView.jsx:131-133, :232-237

**수정**:
```
삭제 조건 강화:
- dirtyMemoIds.has(id) 이면 → "저장 중인 내용이 있습니다. 삭제하시겠습니까?" confirm
- 또는: 삭제 전 pending debounce를 flush하고, flush 후 다시 비어있는지 확인
```

### 45-4. 메모 전환 시 잘못된 저장 방어 (MemoryView.jsx)

**문제**: 메모를 빠르게 전환하면 기존 debounce가 이전 memo.id로 저장될 위험.
**위치**: MemoryView.jsx:60-98

**수정**:
```
selectedId 변경 시:
1. 기존 debounce 즉시 flush (이전 메모 저장 확정)
2. flush 완료 후 새 메모 로드
3. 새 debounce callback은 새 memo.id를 캡처
```

이미 unmount effect(:75-84)가 존재하지만, 메모 전환은 unmount가 아니라 re-render이므로 이 effect가 발동하지 않을 수 있음. selectedId 변경을 명시적으로 감지하는 effect 추가.

### 45-5. (선택) 줄 드래그 앤 드롭

**현재**: 재정렬은 Alt+Shift+↑↓ 키보드 전용.
**Workflowy**: 마우스 드래그 가능.

**판단**: OutlinerEditor "never modify" 제약 때문에 에디터 내부 DnD는 불가. 이건 후속 과제로 남기거나, "never modify" 제약을 이 기능에 한해 해제할지 결정 필요.

---

## 커밋 순서

```
Hotfix-A (data loss 수정 — 반드시 먼저)
├── commit 1: dirty-set 격리 (A-1)
├── commit 2: upsert에 updated_at 포함 (A-2)
├── commit 3: OutlinerEditor 외부 리셋 방어 (A-4)
└── commit 4: 저장 상태 UI (A-3)

Hotfix-B (network 방어)
├── commit 5: upsert 에러 핸들링 + 재시도 (B-1)
├── commit 6: beforeunload/visibilitychange 강화 (B-2)
├── commit 7: 빈 내용 저장 방어 (B-3)
└── commit 8: 낙관적 업데이트 정합성 (B-4)

Loop 45 (사용성)
├── commit 9: 메모 검색 (45-1)
├── commit 10: Ctrl+Y Redo (45-2)
├── commit 11: 빈 노트 삭제 방어 (45-3)
└── commit 12: 메모 전환 시 저장 방어 (45-4)
```

**R-ATOMIC 원칙**: 각 commit은 하나의 이슈만 해결.
**Data loss first**: commit 1~3이 가장 중요. 이것만으로도 "쓰다가 사라지는" 현상 90% 이상 차단.

---

## 사전 확인 (Hotfix 작성 전 필수)

| # | 확인 항목 | 방법 |
|---|----------|------|
| 1 | memos.updated_at 컬럼 타입 | Supabase 대시보드 → Table Editor → memos |
| 2 | updated_at DB trigger 존재 여부 | Supabase 대시보드 → SQL Editor → `SELECT * FROM pg_trigger WHERE tgrelid = 'memos'::regclass` |
| 3 | mapMemo가 updated_at을 어떤 이름으로 매핑하는지 | useStore.js:155-160 확인 (updatedAt vs updated_at) |
| 4 | MEMO_COLUMNS에 updated_at 포함 여부 | useStore.js:8 확인 |
| 5 | sendBeacon으로 Supabase REST API 호출 가능 여부 | Supabase REST endpoint + anon key로 POST 테스트 |

---

## 성공 기준

### Hotfix-A+B 완료 후
- [ ] 타이핑 중 탭 전환 후 복귀 → 내용 유지됨
- [ ] 타이핑 중 10초 경과 (loadAll 발동) → 내용 유지됨
- [ ] upsert 실패 시 → "저장 실패" UI 표시 + 로컬 내용 보존
- [ ] 브라우저 탭 닫기 → 마지막 입력 저장됨
- [ ] 에디터 상단에 "저장 중..." / "저장됨 ✓" 표시
- [ ] 빈 문자열로의 덮어쓰기 차단

### Loop 45 완료 후
- [ ] 메모 검색으로 원하는 메모 즉시 찾기
- [ ] Ctrl+Y로 undo 되돌리기
- [ ] 메모 빠르게 전환 시 잘못된 메모에 저장 안 됨
- [ ] debounce 중 삭제 시 확인 다이얼로그

---

## Workflowy 격차 현황 (조사 후 업데이트)

| 기능 | Workflowy | Ryan Todo | Hotfix 후 | Loop 45 후 |
|------|-----------|-----------|-----------|------------|
| 데이터 안정성 | ✅ | ❌ 유실 | ✅ | ✅ |
| 저장 상태 표시 | ✅ (암묵적) | ❌ | ✅ | ✅ |
| 오프라인 지원 | ✅ | ❌ | 🟡 (부분) | 🟡 |
| Enter 새 bullet | ✅ | ✅ | ✅ | ✅ |
| Tab 들여쓰기 | ✅ | ✅ | ✅ | ✅ |
| Backspace 병합 | ✅ | ✅ | ✅ | ✅ |
| Ctrl+Z Undo | ✅ | ✅ (50개) | ✅ | ✅ |
| Ctrl+Y Redo | ✅ | ❌ | ❌ | ✅ |
| 줄 재정렬 | ✅ (DnD) | 🟡 (키보드) | 🟡 | 🟡 |
| 검색 | ✅ | ❌ | ❌ | ✅ |
| Zoom in/out | ✅ | ❌ | ❌ | ❌ (후속) |
| 무한 중첩 | ✅ | ✅ | ✅ | ✅ |
| 블록 선택 | ✅ | ✅ | ✅ | ✅ |

**Hotfix 후**: Workflowy에서 돌아올 수 있는 최소 신뢰 수준
**Loop 45 후**: 일상 사용에 충분한 수준
**후속**: Zoom in/out, DnD는 OutlinerEditor 수정 또는 대체 에디터 검토 필요
