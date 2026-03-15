# 긴급 수정: Key Milestone 버그 + deliverable_id 완전 구현 + 보안 강화

> 근거: audit-report-project-permissions.md 점검 결과 + SQL 실행 확인
> 수정 항목: 🔴 필수 4건 + 🟡 권장 2건 = 총 6건
> 모든 항목 이번 수정에서 완료. 미루는 항목 없음.

---

## 수정 1: 🔴 모든 Key Milestone 훅에 created_by 추가 (데이터 리셋 버그 원인)

### 현상
마일스톤, 결과물, 링크, 정책을 추가하면 잠시 후 사라진다 (리셋).

### 원인
모든 add() 및 자동 생성에서 `created_by`를 설정하지 않아, RLS INSERT 정책이 차단하거나 이후 SELECT 정책에서 필터링됨.

### 수정 대상 파일 탐색

```bash
find src/ -name "useProjectKeyMilestone*" -o -name "useKeyMilestones*" -o -name "useKeyDeliverables*" -o -name "useKeyLinks*" -o -name "useKeyPolicies*" | head -20
```

### 수정 1-1: userId 캐싱 유틸 확인

```bash
grep -n "getCachedUserId\|_cachedUserId\|cachedUser\|getCurrentUserId" src/hooks/useStore.js src/utils/*.js 2>/dev/null
```

기존에 캐싱된 userId를 가져오는 유틸이 있으면 그것을 import해서 사용하라.
없다면 아래 공통 유틸을 생성하라:

```javascript
// src/utils/auth.js (신규 생성 — 기존 파일이 없는 경우에만)
import { getDb } from './supabase'

let _cachedUserId = null

export async function getCachedUserId() {
  if (_cachedUserId) return _cachedUserId
  const { data: { user } } = await getDb().auth.getUser()
  _cachedUserId = user?.id || null
  return _cachedUserId
}

export function clearCachedUserId() {
  _cachedUserId = null
}
```

> 이미 useStore.js 등에 동일 기능이 있으면 신규 생성하지 말고 기존 것을 사용하라.
> `clearCachedUserId()`는 로그아웃 시 호출되어야 한다.

### 수정 1-2: 각 훅에서 Supabase INSERT를 호출하는 모든 위치 탐색

```bash
grep -n "\.insert\|\.upsert" src/hooks/useProjectKeyMilestone*.js src/hooks/useKey*.js
```

### 수정 1-3: 수정해야 하는 정확한 위치 목록

| # | 파일 | 함수 | INSERT 대상 테이블 | 수정 내용 |
|---|------|------|-------------------|----------|
| 1 | useProjectKeyMilestone.js | init() 내 자동 생성 | project_key_milestones | created_by 추가 |
| 2 | useKeyMilestones.js | add() | key_milestones | created_by 추가 |
| 3 | useKeyDeliverables.js | add() | key_deliverables | created_by 추가 |
| 4 | useKeyLinks.js | add() | key_links | created_by 추가 |
| 5 | useKeyPolicies.js | add() | key_policies | created_by 추가 |

### 수정 1-4: 각 위치별 수정 패턴

**useProjectKeyMilestone.js — init() 자동 생성:**

```javascript
// ❌ 수정 전
const { data } = await db.from('project_key_milestones').insert({
  project_id: projectId,
}).select().single()

// ✅ 수정 후
const userId = await getCachedUserId()  // 유틸 import
const { data, error } = await db.from('project_key_milestones').insert({
  project_id: projectId,
  created_by: userId,
}).select().single()

if (error) {
  console.error('[useProjectKeyMilestone] insert failed:', error.message, error.details)
  return
}
```

**useKeyMilestones.js — add():**

```javascript
// ❌ 수정 전
const { data } = await db.from('key_milestones').insert({
  pkm_id: pkmId,
  project_id: projectId,
  title: '',
  sort_order: milestones.length,
}).select().single()

// ✅ 수정 후
const userId = await getCachedUserId()
const { data, error } = await db.from('key_milestones').insert({
  pkm_id: pkmId,
  project_id: projectId,
  title: '',
  sort_order: milestones.length,
  created_by: userId,
}).select().single()

if (error) {
  console.error('[useKeyMilestones] insert failed:', error.message, error.details)
  return
}
// data가 있을 때만 로컬 상태 갱신
if (data) {
  setMilestones(prev => [...prev, mapMilestone(data)])
}
```

**useKeyDeliverables.js — add():**

```javascript
// ❌ 수정 전
const { data } = await db.from('key_deliverables').insert({
  pkm_id: pkmId,
  project_id: projectId,
  milestone_id: milestoneId || null,
  title: '',
  sort_order: deliverables.length,
}).select().single()

// ✅ 수정 후
const userId = await getCachedUserId()
const { data, error } = await db.from('key_deliverables').insert({
  pkm_id: pkmId,
  project_id: projectId,
  milestone_id: milestoneId || null,
  title: '',
  sort_order: deliverables.length,
  created_by: userId,
}).select().single()

if (error) {
  console.error('[useKeyDeliverables] insert failed:', error.message, error.details)
  return
}
if (data) {
  setDeliverables(prev => [...prev, mapDeliverable(data)])
}
```

**useKeyLinks.js — add():**

```javascript
// ❌ 수정 전
const { data } = await db.from('key_links').insert({
  pkm_id: pkmId,
  project_id: projectId,
  title: '',
  url: '',
  sort_order: links.length,
}).select().single()

// ✅ 수정 후
const userId = await getCachedUserId()
const { data, error } = await db.from('key_links').insert({
  pkm_id: pkmId,
  project_id: projectId,
  title: '',
  url: '',
  sort_order: links.length,
  created_by: userId,
}).select().single()

if (error) {
  console.error('[useKeyLinks] insert failed:', error.message, error.details)
  return
}
if (data) {
  setLinks(prev => [...prev, mapLink(data)])
}
```

**useKeyPolicies.js — add():**

```javascript
// ❌ 수정 전
const { data } = await db.from('key_policies').insert({
  pkm_id: pkmId,
  project_id: projectId,
  title: '',
  sort_order: policies.length,
}).select().single()

// ✅ 수정 후
const userId = await getCachedUserId()
const { data, error } = await db.from('key_policies').insert({
  pkm_id: pkmId,
  project_id: projectId,
  title: '',
  sort_order: policies.length,
  created_by: userId,
}).select().single()

if (error) {
  console.error('[useKeyPolicies] insert failed:', error.message, error.details)
  return
}
if (data) {
  setPolicies(prev => [...prev, mapPolicy(data)])
}
```

> **중요:** 위 코드는 패턴 예시이다. 실제 변수명, 매핑 함수명, state setter명은 각 훅의 실제 코드를 읽고 맞춰라. 구조를 변경하지 말고 `created_by` 추가 + error 핸들링만 삽입하라.

---

## 수정 2: 🔴 모든 훅의 전체 DB 호출에 에러 핸들링 추가

### 현상
INSERT뿐 아니라 UPDATE, DELETE 호출에서도 error를 체크하지 않아, 실패해도 UI에서 감지할 수 없다.

### 수정 대상 탐색

```bash
grep -n "\.insert\|\.update\|\.delete\|\.upsert" src/hooks/useProjectKeyMilestone*.js src/hooks/useKey*.js
```

### 수정 패턴 — UPDATE

```javascript
// ❌ 수정 전
await db.from('key_milestones').update({ title: newTitle }).eq('id', id)
setMilestones(prev => prev.map(m => m.id === id ? { ...m, title: newTitle } : m))

// ✅ 수정 후
const { error } = await db.from('key_milestones').update({ title: newTitle }).eq('id', id)
if (error) {
  console.error('[useKeyMilestones] update failed:', error.message, error.details)
  return  // 로컬 상태 롤백 또는 변경하지 않음
}
setMilestones(prev => prev.map(m => m.id === id ? { ...m, title: newTitle } : m))
```

### 수정 패턴 — DELETE

```javascript
// ❌ 수정 전
await db.from('key_milestones').delete().eq('id', id)
setMilestones(prev => prev.filter(m => m.id !== id))

// ✅ 수정 후
const { error } = await db.from('key_milestones').delete().eq('id', id)
if (error) {
  console.error('[useKeyMilestones] delete failed:', error.message, error.details)
  return
}
setMilestones(prev => prev.filter(m => m.id !== id))
```

### 수정 패턴 — SELECT (초기 로딩)

```javascript
// ❌ 수정 전
const { data } = await db.from('key_milestones').select('*').eq('pkm_id', pkmId)
setMilestones((data || []).map(mapMilestone))

// ✅ 수정 후
const { data, error } = await db.from('key_milestones').select('*').eq('pkm_id', pkmId)
if (error) {
  console.error('[useKeyMilestones] select failed:', error.message, error.details)
  return
}
setMilestones((data || []).map(mapMilestone))
```

### 적용 범위 — 전수 목록

| 파일 | 적용할 함수 | DB 호출 유형 |
|------|-----------|-------------|
| useProjectKeyMilestone.js | init() SELECT | SELECT |
| useProjectKeyMilestone.js | init() INSERT (자동 생성) | INSERT |
| useKeyMilestones.js | load() | SELECT |
| useKeyMilestones.js | add() | INSERT |
| useKeyMilestones.js | update() | UPDATE |
| useKeyMilestones.js | remove() | DELETE |
| useKeyMilestones.js | reorder() | UPDATE (다중) |
| useKeyDeliverables.js | load() | SELECT |
| useKeyDeliverables.js | add() | INSERT |
| useKeyDeliverables.js | update() | UPDATE |
| useKeyDeliverables.js | remove() | DELETE |
| useKeyDeliverables.js | getByMilestone() | SELECT |
| useKeyLinks.js | load() | SELECT |
| useKeyLinks.js | add() | INSERT |
| useKeyLinks.js | update() | UPDATE |
| useKeyLinks.js | remove() | DELETE |
| useKeyPolicies.js | load() | SELECT |
| useKeyPolicies.js | add() | INSERT |
| useKeyPolicies.js | update() | UPDATE |
| useKeyPolicies.js | remove() | DELETE |

**총 20개 DB 호출 지점. 하나도 빠뜨리지 말 것.**

각 호출 지점을 찾아서 `{ error }` 디스트럭처링 + `if (error)` 체크 + `console.error` + `return` 패턴을 적용하라.

---

## 수정 3: 🔴 tasks 테이블에 deliverable_id 컬럼 추가 (DB 마이그레이션)

### 현상
tasks 테이블에 `deliverable_id` 컬럼이 존재하지 않는다. SQL 실행 결과에서 7개 컬럼만 반환되었고 `deliverable_id`가 누락되어 있다.
할일과 결과물(key_deliverables)을 연결하려면 이 컬럼이 반드시 필요하다.

### 수정 3-1: SQL 마이그레이션 스크립트 생성

아래 SQL을 `docs/migration-add-deliverable-id.sql` 파일로 생성하라.
Ryan이 Supabase SQL Editor에서 직접 실행한다.

```sql
-- ============================================================
-- Migration: tasks.deliverable_id 추가
-- 실행 환경: Supabase SQL Editor
-- 전제: key_deliverables 테이블이 이미 존재
-- ============================================================

-- 1. 컬럼 추가
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS deliverable_id uuid
REFERENCES key_deliverables(id) ON DELETE SET NULL;

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id
ON tasks(deliverable_id);

-- 3. 확인 쿼리 — 실행 후 deliverable_id 행이 보이면 성공
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'tasks'
AND column_name = 'deliverable_id';
```

**FK 동작 설명:**
- `ON DELETE SET NULL` — 결과물이 삭제되면 연결된 tasks의 deliverable_id가 자동으로 NULL로 리셋됨
- 기존 모든 tasks 행의 deliverable_id는 NULL (기존 데이터 무영향)
- nullable이므로 결과물 연결은 선택사항

### 수정 3-2: useStore.js — mapTask에 deliverableId 추가

```bash
grep -n "mapTask\|function mapTask\|const mapTask" src/hooks/useStore.js
```

mapTask 함수를 찾아 전체 코드를 출력한 뒤 `deliverableId` 매핑을 추가하라:

```javascript
// ❌ 수정 전 (현재 — key_milestone_id만 있음)
function mapTask(r) {
  return {
    // ...기존 필드들...
    keyMilestoneId: r.key_milestone_id || null,
    // deliverableId 없음
  }
}

// ✅ 수정 후
function mapTask(r) {
  return {
    // ...기존 필드들 전부 유지 — 하나도 삭제/변경하지 않음...
    keyMilestoneId: r.key_milestone_id || null,
    deliverableId: r.deliverable_id || null,   // ★ 추가
  }
}
```

### 수정 3-3: useStore.js — taskToRow에 deliverable_id 추가

```bash
grep -n "taskToRow\|function taskToRow\|const taskToRow" src/hooks/useStore.js
```

taskToRow 함수를 찾아 전체 코드를 출력한 뒤 `deliverable_id` 매핑을 추가하라:

```javascript
// ❌ 수정 전
function taskToRow(t) {
  return {
    // ...기존 필드들...
    key_milestone_id: t.keyMilestoneId || null,
    // deliverable_id 없음
  }
}

// ✅ 수정 후
function taskToRow(t) {
  return {
    // ...기존 필드들 전부 유지 — 하나도 삭제/변경하지 않음...
    key_milestone_id: t.keyMilestoneId || null,
    deliverable_id: t.deliverableId || null,   // ★ 추가
  }
}
```

### 수정 3-4: addTask에서 deliverableId 전달 경로 확인 및 수정

```bash
grep -n "addTask" src/hooks/useStore.js
```

addTask 함수의 전체 코드를 출력하고, 외부에서 받은 파라미터가 taskToRow로 변환되는 경로를 추적하라.

**확인 사항:**
1. addTask의 파라미터 구조가 어떤 형태인지 (객체? 개별 인자?)
2. 내부에서 task 객체를 구성할 때 `deliverableId`가 포함되는지
3. taskToRow 호출 시 `deliverableId`가 `deliverable_id`로 변환되는지

```javascript
// 만약 addTask가 이런 구조라면:
addTask: async (taskData) => {
  const newTask = {
    // ...기존 필드들...
    keyMilestoneId: taskData.keyMilestoneId || null,
    deliverableId: taskData.deliverableId || null,  // ★ 추가 (없으면)
  }
  const row = taskToRow(newTask)
  // ...Supabase upsert...
}
```

> 실제 addTask 구현 방식에 맞게 조정하라. 핵심은 외부에서 `deliverableId`를 전달했을 때 DB에 `deliverable_id`로 저장되는 경로가 끊기지 않는 것이다.

### 수정 3-5: updateTask에서 deliverableId 전달 확인 및 수정

```bash
grep -n "updateTask" src/hooks/useStore.js
```

updateTask(id, patch) 함수의 전체 코드를 출력하고, patch 내의 필드가 DB 컬럼명으로 변환되는 방식을 확인하라.

**경우 1: patch를 통째로 taskToRow에 넣는 방식**
→ taskToRow에 deliverableId → deliverable_id 매핑이 추가되었으므로 추가 작업 불필요

**경우 2: 개별 필드를 하나씩 매핑하는 방식**
→ 아래 매핑을 추가:

```javascript
if (patch.deliverableId !== undefined) {
  dbPatch.deliverable_id = patch.deliverableId
}
```

**경우 3: camelCase → snake_case 자동 변환 유틸을 사용하는 방식**
→ 변환 유틸이 deliverableId → deliverable_id를 올바르게 처리하는지 확인

> 어떤 방식이든 `updateTask(taskId, { deliverableId: 'some-uuid' })`를 호출하면 DB에 `deliverable_id = 'some-uuid'`가 저장되어야 한다. 이 경로가 끊기면 DetailPanel의 결과물 선택이 저장되지 않는다.

---

## 수정 4: 🔴 할일 생성/편집 UI에 결과물 선택(태깅) 기능 추가

### 현상
tasks.deliverable_id 컬럼이 추가되더라도, 할일을 결과물에 연결하는 UI가 없으면 사용할 수 없다.

### 수정 4-1: DeliverableSelector 컴포넌트 생성

`src/components/shared/DeliverableSelector.jsx` 를 신규 생성하라:

```jsx
// src/components/shared/DeliverableSelector.jsx
import { useState, useEffect, useRef } from 'react'
import { getDb } from '../../utils/supabase'

export default function DeliverableSelector({ projectId, value, onChange, style }) {
  const [deliverables, setDeliverables] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // 프로젝트의 결과물 목록 로드
  useEffect(() => {
    if (!projectId) {
      setDeliverables([])
      return
    }
    loadDeliverables()
  }, [projectId])

  async function loadDeliverables() {
    setLoading(true)
    const db = getDb()
    const { data, error } = await db
      .from('key_deliverables')
      .select('id, title, milestone_id')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[DeliverableSelector] load failed:', error.message)
      setLoading(false)
      return
    }
    setDeliverables(data || [])
    setLoading(false)
  }

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = deliverables.find(d => d.id === value)

  // 프로젝트가 없거나 결과물이 0개면 렌더링하지 않음
  if (!projectId) return null
  if (!loading && deliverables.length === 0) return null

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', border: '1px solid #e8e6df', borderRadius: 6,
          background: 'transparent', cursor: 'pointer', fontSize: 12,
          color: selected ? '#2C2C2A' : '#a09f99', fontFamily: 'inherit',
          width: '100%', textAlign: 'left',
        }}
      >
        <span style={{ color: '#1D9E75', fontSize: 10 }}>◆</span>
        {loading ? '로딩...' : (selected ? selected.title || '(제목 없음)' : '결과물 연결')}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #e8e6df', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 100,
          maxHeight: 200, overflowY: 'auto', marginTop: 4,
        }}>
          {/* 연결 해제 옵션 */}
          {value && (
            <div
              onClick={() => { onChange(null); setOpen(false) }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                color: '#a09f99', borderBottom: '1px solid #f0efe8',
              }}
            >
              연결 해제
            </div>
          )}

          {deliverables.map(d => (
            <div
              key={d.id}
              onClick={() => { onChange(d.id); setOpen(false) }}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                background: d.id === value ? '#f6f5f0' : 'transparent',
                color: '#2C2C2A',
              }}
              onMouseEnter={e => { if (d.id !== value) e.currentTarget.style.background = '#fafaf7' }}
              onMouseLeave={e => { if (d.id !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {d.title || '(제목 없음)'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

> `getDb`의 import 경로는 기존 프로젝트의 Supabase client import 패턴을 따르라. `../../utils/supabase`가 아닐 수 있다.

### 수정 4-2: DetailPanel에 DeliverableSelector 배치

```bash
find src/ -name "DetailPanel*" -o -name "TaskDetail*" | head -5
```

DetailPanel을 열고 전체 코드를 읽은 뒤, 프로젝트 이름 표시 영역 또는 기존 속성 편집 영역에 결과물 선택 UI를 추가하라.

**import 추가:**
```jsx
import DeliverableSelector from '../shared/DeliverableSelector'
```

**UI 배치 (프로젝트/카테고리 속성 영역 내):**

```jsx
{/* 결과물 연결 — 프로젝트가 있는 할일에만 표시 */}
{task.projectId && (
  <div style={{ padding: '8px 16px' }}>
    <div style={{ fontSize: 11, color: '#a09f99', marginBottom: 4 }}>결과물</div>
    <DeliverableSelector
      projectId={task.projectId}
      value={task.deliverableId}
      onChange={(deliverableId) => updateTask(task.id, { deliverableId })}
    />
  </div>
)}
```

**`updateTask` 참조 확인:**
DetailPanel 내에서 `updateTask`를 어떻게 가져오는지 확인하라 (useStore에서 직접? props로?).
기존 패턴과 동일한 방식으로 호출하라.

### 수정 4-3: Tasks 탭에서 결과물 이름 읽기전용 표시

```bash
grep -rn "MilestoneOutliner\|TasksTab\|keyMilestoneId\|key_milestone" src/components/ --include="*.jsx" -l | head -10
```

Tasks 탭에서 할일 항목을 렌더링하는 부분을 찾아, 결과물이 연결된 할일 옆에 결과물 이름을 읽기전용 라벨로 표시하라.

**결과물 이름 조회 방법:**

이미 useKeyDeliverables 훅이 같은 프로젝트의 결과물 목록을 가지고 있으므로, Tasks 탭 컴포넌트에서 접근 가능한지 확인하라.

```bash
grep -rn "useKeyDeliverables\|deliverables" src/components/project/ --include="*.jsx" | head -10
```

접근 가능하면:
```jsx
// 할일 항목 렌더링 부분에서
const deliverableTitle = task.deliverableId
  ? deliverables.find(d => d.id === task.deliverableId)?.title
  : null

// JSX 내
{deliverableTitle && (
  <span style={{
    fontSize: 10, color: '#a09f99', marginLeft: 4,
    background: '#f6f5f0', padding: '1px 6px', borderRadius: 4,
    whiteSpace: 'nowrap',
  }}>
    {deliverableTitle}
  </span>
)}
```

접근 불가능하면 (다른 훅 스코프):
```jsx
// 간단한 인라인 조회 (컴포넌트 마운트 시 1회)
const [deliverableMap, setDeliverableMap] = useState({})

useEffect(() => {
  if (!projectId) return
  getDb()
    .from('key_deliverables')
    .select('id, title')
    .eq('project_id', projectId)
    .then(({ data }) => {
      const map = {}
      ;(data || []).forEach(d => { map[d.id] = d.title })
      setDeliverableMap(map)
    })
}, [projectId])

// 사용
{task.deliverableId && deliverableMap[task.deliverableId] && (
  <span style={{
    fontSize: 10, color: '#a09f99', marginLeft: 4,
    background: '#f6f5f0', padding: '1px 6px', borderRadius: 4,
    whiteSpace: 'nowrap',
  }}>
    {deliverableMap[task.deliverableId]}
  </span>
)}
```

---

## 수정 5: 🟡 DetailPanel에 소속 마일스톤 이름 표시

### 현황
tasks 테이블에 `key_milestone_id` 컬럼이 이미 존재하고, mapTask에 `keyMilestoneId` 매핑도 있다.
하지만 DetailPanel에서 이를 보여주는 UI가 없다.

### 수정

DetailPanel에 마일스톤 이름을 표시하는 섹션을 추가하라.

**데이터 조회:**

```javascript
const [milestoneName, setMilestoneName] = useState(null)

useEffect(() => {
  if (!task?.keyMilestoneId) {
    setMilestoneName(null)
    return
  }
  getDb()
    .from('key_milestones')
    .select('title')
    .eq('id', task.keyMilestoneId)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error('[DetailPanel] milestone query failed:', error.message)
        setMilestoneName(null)
        return
      }
      setMilestoneName(data?.title || null)
    })
}, [task?.keyMilestoneId])
```

**UI 위치:** 프로젝트 이름 표시 바로 아래, 결과물 선택(수정 4-2) 바로 위에:

```jsx
{/* 마일스톤 표시 (읽기전용) */}
{task.keyMilestoneId && milestoneName && (
  <div style={{
    padding: '4px 16px',
    display: 'flex', alignItems: 'center', gap: 8,
  }}>
    <div style={{ fontSize: 11, color: '#a09f99', flexShrink: 0 }}>마일스톤</div>
    <div style={{
      fontSize: 12, color: '#2C2C2A',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ color: '#1D9E75', fontSize: 10 }}>◆</span>
      <span>{milestoneName}</span>
    </div>
  </div>
)}

{/* 결과물 선택 (수정 4-2 — 바로 아래) */}
{task.projectId && (
  <div style={{ padding: '4px 16px' }}>
    <div style={{ fontSize: 11, color: '#a09f99', marginBottom: 4 }}>결과물</div>
    <DeliverableSelector
      projectId={task.projectId}
      value={task.deliverableId}
      onChange={(deliverableId) => updateTask(task.id, { deliverableId })}
    />
  </div>
)}
```

**마일스톤은 읽기전용이다.** 마일스톤 변경은 Tasks 탭에서 할일을 드래그/이동하는 방식으로만 가능하고, DetailPanel에서는 소속 정보만 보여준다. 결과물은 DetailPanel에서 변경 가능하다.

---

## 수정 6: 🟡 deleteProject / updateProject 보안 강화

### 수정 6-1: deleteProject 함수 내 권한 체크 추가

```bash
grep -n "deleteProject" src/hooks/useStore.js
```

`deleteProject` 함수의 전체 코드를 출력한 뒤, 함수 최상단에 아래 가드를 추가하라:

```javascript
deleteProject: async (id) => {
  const project = get().projects.find(p => p.id === id)
  if (!project) return

  // ★ 팀 프로젝트: 팀장만 삭제 가능
  const teamId = get().currentTeamId
  if (project.teamId && teamId) {
    const myRole = get().myRole  // get().myRole이 없으면 아래 대안 사용
    if (myRole !== 'owner') {
      console.warn('[deleteProject] 팀 프로젝트 삭제는 팀장만 가능합니다')
      return
    }
  }

  // ★ 개인 프로젝트: 본인 소유인지 확인
  if (!project.teamId) {
    const userId = _cachedUserId || (await getCurrentUserId())
    if (project.userId && project.userId !== userId) {
      console.warn('[deleteProject] 다른 사용자의 개인 프로젝트는 삭제할 수 없습니다')
      return
    }
  }

  // 기존 삭제 로직 계속... (아래는 기존 코드 그대로 유지)
}
```

> `get().myRole`이 존재하지 않는 경우, store에서 `myRole`을 어떻게 관리하는지 확인하라.
> team_members 테이블에서 현재 사용자의 role을 조회하는 방식일 수 있다.

### 수정 6-2: updateProject에서 teamId/userId 변경 차단

```bash
grep -n "updateProject" src/hooks/useStore.js
```

`updateProject` 함수의 전체 코드를 출력하고, patch를 DB에 전달하기 전에 소속 관련 필드를 제거하라:

```javascript
updateProject: async (id, patch) => {
  // ★ 소속 변경 차단 — 이 필드들은 업데이트에서 절대 제외
  const {
    teamId, userId,          // camelCase (프론트)
    team_id, user_id,        // snake_case (DB)
    created_by, createdBy,   // 생성자도 변경 불가
    id: _id,                 // id도 변경 불가
    ...safePatch
  } = patch

  // 아래 기존 로직에서 patch → safePatch로 교체
  // safePatch에는 name, color, sortOrder 등 안전한 필드만 남음
}
```

> **주의:** updateProject의 기존 구현을 먼저 읽고, patch가 camelCase인지 snake_case인지 확인하라.
> 위 코드는 양쪽 모두 제거하는 방어적 패턴이다.

---

## 파일 변경 요약

### 신규 생성

| 파일 | 역할 |
|------|------|
| `src/utils/auth.js` | getCachedUserId 유틸 (기존에 없는 경우에만) |
| `src/components/shared/DeliverableSelector.jsx` | 결과물 선택 드롭다운 컴포넌트 |
| `docs/migration-add-deliverable-id.sql` | tasks.deliverable_id 컬럼 추가 SQL |

### 수정

| 파일 | 변경 내용 | 규모 |
|------|----------|------|
| `src/hooks/useProjectKeyMilestone.js` | created_by 추가 + error 핸들링 (INSERT 1곳, SELECT 1곳) | S |
| `src/hooks/useKeyMilestones.js` | created_by 추가 + 전체 DB 호출 error 핸들링 (SELECT 1, INSERT 1, UPDATE 2, DELETE 1) | M |
| `src/hooks/useKeyDeliverables.js` | created_by 추가 + 전체 DB 호출 error 핸들링 (SELECT 2, INSERT 1, UPDATE 1, DELETE 1) | M |
| `src/hooks/useKeyLinks.js` | created_by 추가 + 전체 DB 호출 error 핸들링 (SELECT 1, INSERT 1, UPDATE 1, DELETE 1) | M |
| `src/hooks/useKeyPolicies.js` | created_by 추가 + 전체 DB 호출 error 핸들링 (SELECT 1, INSERT 1, UPDATE 1, DELETE 1) | M |
| `src/hooks/useStore.js` | mapTask에 deliverableId 추가, taskToRow에 deliverable_id 추가, addTask 경로 확인, updateTask 경로 확인, deleteProject 가드 추가, updateProject 소속 차단 | L |
| `src/components/shared/DetailPanel.jsx` (또는 해당 파일) | 마일스톤 이름 표시 + DeliverableSelector import 및 배치 | M |
| Tasks 탭 관련 컴포넌트 (MilestoneOutlinerView 등) | 결과물 이름 읽기전용 라벨 표시 | S |

### 수정 금지

| 파일/영역 | 이유 |
|----------|------|
| tasks 테이블의 text, done, category, alarm 컬럼 | 기존 컬럼 절대 변경 금지 |
| TodayView.jsx 내부 | 기존 뷰 수정 금지 원칙 |
| MatrixView.jsx / TeamMatrixView.jsx 내부 | 기존 뷰 수정 금지 원칙 |
| TimelineView.jsx 내부 | 기존 뷰 수정 금지 원칙 |
| MemoryView.jsx 내부 | 기존 뷰 수정 금지 원칙 |
| 기존 DnD, 키보드 단축키 로직 | 회귀 위험 |

---

## 실행 순서

```
1. Ryan이 Supabase SQL Editor에서 migration-add-deliverable-id.sql 실행
   → deliverable_id 컬럼 생성 확인
   → 확인 쿼리 결과에 deliverable_id 행이 보여야 함

2. Claude Code가 수정 1 실행
   → getCachedUserId 유틸 확인/생성
   → 5개 훅에 created_by 추가

3. Claude Code가 수정 2 실행
   → 5개 훅의 20개 DB 호출 지점에 error 핸들링 추가

4. Claude Code가 수정 3 실행
   → useStore.js: mapTask에 deliverableId 추가
   → useStore.js: taskToRow에 deliverable_id 추가
   → useStore.js: addTask에서 deliverableId 전달 경로 확인/수정
   → useStore.js: updateTask에서 deliverableId 전달 경로 확인/수정

5. Claude Code가 수정 4 실행
   → DeliverableSelector.jsx 컴포넌트 생성
   → DetailPanel에 DeliverableSelector 배치
   → Tasks 탭에 결과물 이름 읽기전용 라벨 표시

6. Claude Code가 수정 5 실행
   → DetailPanel에 마일스톤 이름 읽기전용 표시 추가

7. Claude Code가 수정 6 실행
   → deleteProject 함수에 권한 가드 추가
   → updateProject 함수에 소속 변경 차단 추가

8. 검증 체크리스트 전항목 확인
```

---

## 검증 체크리스트

수정 완료 후 아래를 **빠짐없이 전부** 확인하라:

### created_by 수정 검증
- [ ] Key Milestone 탭에서 마일스톤 추가 → 페이지 새로고침 → 데이터 유지됨
- [ ] 결과물 추가 → 페이지 새로고침 → 데이터 유지됨
- [ ] 링크 추가 → 페이지 새로고침 → 데이터 유지됨
- [ ] 정책 추가 → 페이지 새로고침 → 데이터 유지됨
- [ ] 마일스톤 제목 수정 → 새로고침 → 유지됨
- [ ] 결과물 삭제 → 새로고침 → 삭제 상태 유지됨
- [ ] 브라우저 콘솔에 insert/update/delete failed 에러 없음

### deliverable_id DB 검증
- [ ] Supabase SQL Editor에서 `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name='deliverable_id'` 실행 → 결과 1행 반환
- [ ] `SELECT deliverable_id FROM tasks LIMIT 5` → 컬럼 존재, 기존 데이터 모두 NULL
- [ ] `SELECT indexname FROM pg_indexes WHERE tablename='tasks' AND indexname='idx_tasks_deliverable_id'` → 인덱스 존재

### deliverable_id 프론트엔드 검증
- [ ] DetailPanel에서 프로젝트가 있는 할일 → 결과물 드롭다운 표시됨
- [ ] 결과물이 1개 이상 있는 프로젝트의 할일 → 드롭다운에 목록 표시
- [ ] 결과물이 0개인 프로젝트의 할일 → 드롭다운 미표시 (빈 공간 아님)
- [ ] 프로젝트가 없는 할일 → DeliverableSelector 자체 미렌더링
- [ ] 결과물 선택 → 새로고침 → 연결 유지됨
- [ ] 결과물 "연결 해제" 클릭 → 새로고침 → NULL 유지됨
- [ ] 결과물 삭제(Key Milestone 탭에서) → 해당 tasks의 deliverableId 자동 NULL (FK SET NULL)
- [ ] Tasks 탭에서 결과물이 연결된 할일 옆에 결과물 이름 라벨 표시됨
- [ ] Tasks 탭에서 결과물이 없는 할일 → 라벨 없음

### DetailPanel 마일스톤/결과물 표시 검증
- [ ] 마일스톤에 연결된 할일 → 상세 패널에 "◆ 마일스톤명" 읽기전용 표시
- [ ] 마일스톤 미연결 할일 → 마일스톤 행 자체가 안 보임 (빈 공간 아님)
- [ ] 결과물 + 마일스톤 둘 다 연결된 할일 → 마일스톤(읽기전용) 위, 결과물(선택 가능) 아래 순서로 표시
- [ ] 마일스톤만 있고 결과물 없는 할일 → 마일스톤 표시 + 결과물 "결과물 연결" 선택 가능

### 권한 검증
- [ ] 팀원(비팀장) 계정으로 deleteProject 호출 시도 → console.warn 출력, 삭제 안 됨
- [ ] 다른 사용자의 개인 프로젝트 deleteProject 호출 시도 → console.warn 출력, 삭제 안 됨
- [ ] updateProject 호출 시 patch에 teamId/userId/team_id/user_id 포함 → 해당 필드 무시됨, name/color만 변경됨

### 회귀 검증
- [ ] TodayView 정상 (Task 추가/완료/삭제)
- [ ] AllTasksView 정상 (전체 할일 목록)
- [ ] MatrixView 정상 (드래그앤드롭, Lane 구분)
- [ ] ProjectView 정상 (아웃라이너, 키보드 단축키 전체: Shift+방향키 블록 지정, Alt+Tab 부모+자식 동반 이동, Enter 하위 항목 추가)
- [ ] TimelineView 정상 (간트 드래그)
- [ ] MemoryView 정상 (메모 CRUD)
- [ ] Key Milestone 탭 정상 (마일스톤/결과물/링크/정책 CRUD + 새로고침 후 유지)
- [ ] Tasks 탭 정상 (할일 추가/완료/삭제 + 글로벌 뷰 동기화)
- [ ] 병렬 보기 탭 정상 (표시되는 경우)
- [ ] 개인 모드 (teamId=null) 전체 정상
- [ ] 팀 전환 후 프로젝트 목록 정상 갱신
- [ ] 기존 모든 할일이 정상 표시 (deliverableId=null인 기존 데이터 무영향)
- [ ] `npm run build` 성공, 경고 없음

---

## 주의사항

- `updateTask(id, patch)` 시그니처 준수 — `updateTask({...task})` 아님
- 기존 tasks/memos 테이블의 text, done, category, alarm 컬럼 절대 변경 금지
- 기존 뷰 컴포넌트(TodayView, MatrixView, TeamMatrixView, TimelineView, MemoryView, AllTasksView) 내부 수정 금지
- console.error/console.warn만 사용 — alert이나 UI 에러 모달 불필요
- auth.getUser()는 async — await 빠뜨리지 말 것
- DeliverableSelector는 프로젝트가 있는 할일에만 표시 — 프로젝트 미설정 할일에서는 렌더링하지 않음
- 결과물이 0개인 프로젝트에서도 DeliverableSelector를 렌더링하지 않음
- 마일스톤 표시는 읽기전용 — DetailPanel에서 마일스톤을 변경하는 UI는 만들지 않음
- SQL 마이그레이션 파일은 docs/ 폴더에 생성하여 Ryan에게 안내
- 모든 Supabase import 경로는 기존 프로젝트의 패턴을 따르라 (getDb, supabase 등)
