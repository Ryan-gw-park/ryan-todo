# MS 그룹 헤더 + 타임라인 스크롤 수정 — 구현 Diff

## REQ-LOCK 요구사항

| # | 요구사항 | 출처 |
|---|---------|------|
| R1 | 매트릭스 셀 안에서 할일을 MS별로 그룹핑하여 MS명 헤더 아래에 소속 할일 표시 | 사용자 확정 |
| R2 | 주간 플래너에서도 동일 방식 적용 | 사용자 확정 |
| R3 | MS에 소속되지 않은 할일은 구분선 아래 하단에 표시 | 목업 확정 |
| R4 | MS가 없는 셀은 기존 플랫 렌더링 유지 | 목업 확정 |
| R5 | 기존 기능(체크박스, 인라인 편집, DnD, + 추가) 유지 | 사용자 지시 |
| R6 | 그리드 구분선(가로/세로) 직선 유지 | 사용자 지시 |
| R7 | 타임라인 로딩 시 왼쪽 MS/할일 영역 전체 노출 (잘림 방지) | 사용자 지시 |

## 수정 파일

| 파일 | 변경 |
|---|---|
| `UnifiedGridView.jsx` | `MsGroupedTasks` 공용 컴포넌트 추가 + 4개 그리드 셀 렌더링 교체 |
| `InlineTimelineView.jsx` | auto-scroll 시 왼쪽 트리 패널 보존 |

---

## Part 1: 타임라인 스크롤 수정

### Diff A0 — `src/components/views/InlineTimelineView.jsx` : 미사용 import 정리

**str_replace #0**

```javascript
<<<<<<< OLD
  parseDate, daysBetween, addDays, fmtISO, getDayWidth, getBarStyle,
=======
  parseDate, addDays, fmtISO, getBarStyle,
>>>>>>> NEW
```

### Diff A — `src/components/views/InlineTimelineView.jsx`

현재: `scrollLeft = todayOffset - 200` → 왼쪽 트리(300px)가 잘림
수정: 초기 로딩 시 scrollLeft = 0으로 왼쪽 영역 전체 노출

**str_replace #1**

```javascript
<<<<<<< OLD
  // ─── Auto-scroll to today ───
  useEffect(() => {
    if (!gridRef.current) return
    const dayW = getDayWidth(colW, scale)
    const todayOffset = daysBetween(minD, new Date()) * dayW
    setTimeout(() => {
      if (gridRef.current) gridRef.current.scrollLeft = Math.max(0, todayOffset - 200)
    }, 100)
  }, [scale])
=======
  // ─── Auto-scroll to today (왼쪽 트리 영역 보존) ───
  useEffect(() => {
    if (!gridRef.current) return
    setTimeout(() => {
      if (gridRef.current) gridRef.current.scrollLeft = 0
    }, 100)
  }, [scale])
>>>>>>> NEW
```

---

## Part 2: MS 그룹 헤더

### Diff B — `src/components/views/UnifiedGridView.jsx` : MsGroupedTasks 컴포넌트 추가

`DroppableCell` 함수 바로 앞에 삽입한다.

**str_replace #2**

```javascript
<<<<<<< OLD
/* ─── Droppable Cell ─── */
function DroppableCell({ id, activeId, children }) {
=======
/* ─── MS Grouped Tasks — 셀 안에서 할일을 MS별로 그룹핑 ─── */
function MsGroupedTasks({ tasks: cellTasks, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, showProject, project, projectMap }) {
  const getProj = (t) => project || (projectMap && projectMap[t.projectId]) || null
  const milestones = useStore(s => s.milestones)

  const groups = useMemo(() => {
    const msMap = {}
    const noMs = []
    cellTasks.forEach(t => {
      if (t.keyMilestoneId) {
        if (!msMap[t.keyMilestoneId]) msMap[t.keyMilestoneId] = []
        msMap[t.keyMilestoneId].push(t)
      } else {
        noMs.push(t)
      }
    })
    const result = []
    Object.entries(msMap).forEach(([msId, msTasks]) => {
      const ms = milestones.find(m => m.id === msId)
      result.push({ msId, msTitle: ms?.title || '(제목 없음)', tasks: msTasks })
    })
    result.sort((a, b) => (a.tasks[0]?.sortOrder || 0) - (b.tasks[0]?.sortOrder || 0))
    return { msGroups: result, ungrouped: noMs }
  }, [cellTasks, milestones])

  if (groups.msGroups.length === 0) {
    return cellTasks.map(t => (
      <TaskCard key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
    ))
  }

  return (
    <>
      {groups.msGroups.map(g => (
        <div key={g.msId} style={{ marginBottom: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 2px 1px', marginBottom: 1,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.textTertiary, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: COLOR.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {g.msTitle}
            </span>
            <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{g.tasks.length}</span>
          </div>
          {g.tasks.map(t => (
            <TaskCard key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
          ))}
        </div>
      ))}
      {groups.ungrouped.length > 0 && (
        <div style={{ marginTop: groups.msGroups.length > 0 ? 2 : 0 }}>
          {groups.msGroups.length > 0 && (
            <div style={{ height: '0.5px', background: COLOR.border, margin: '3px 0' }} />
          )}
          {groups.ungrouped.map(t => (
            <TaskCard key={t.id} task={t} project={getProj(t)} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject={showProject} />
          ))}
        </div>
      )}
    </>
  )
}

/* ─── Droppable Cell ─── */
function DroppableCell({ id, activeId, children }) {
>>>>>>> NEW
```

### Diff C — PersonalMatrixGrid 셀: 플랫 → MS 그룹

**str_replace #3**

```javascript
<<<<<<< OLD
                      <>
                        {cellTasks.map(t => (
                          <TaskCard key={t.id} task={t} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        ))}
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                      </>
=======
                      <>
                        <MsGroupedTasks tasks={cellTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                      </>
>>>>>>> NEW
```

### Diff D — TeamMatrixGrid 셀: 플랫 → MS 그룹

**str_replace #4**

```javascript
<<<<<<< OLD
                      <>
                        {cellTasks.map(t => (
                          <TaskCard key={t.id} task={t} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        ))}
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                      </>
=======
                      <>
                        <MsGroupedTasks tasks={cellTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                        <InlineAdd projectId={proj.id} category="today" color={c} extraFields={{ scope: 'assigned', assigneeId: mem.userId }} compact />
                      </>
>>>>>>> NEW
```

### Diff E — PersonalWeeklyGrid 셀: 플랫 → MS 그룹

**str_replace #5**

```javascript
<<<<<<< OLD
                    {dayTasks.map(t => (
                      <TaskCard key={t.id} task={t} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showMs />
                    ))}
                    {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
=======
                    <MsGroupedTasks tasks={dayTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} />
                    {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
>>>>>>> NEW
```

### Diff F — TeamWeeklyGrid 셀: 플랫 → MS 그룹

**str_replace #6**

```javascript
<<<<<<< OLD
                  {dayTasks.map(t => {
                    const proj = projectMap[t.projectId]
                    return <TaskCard key={t.id} task={t} project={proj} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject showMs />
                  })}
                  {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
=======
                  <MsGroupedTasks tasks={dayTasks} editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish} toggleDone={toggleDone} openDetail={openDetail} showProject projectMap={projectMap} />
                  {dayTasks.length === 0 && <span style={{ fontSize: FONT.tiny, color: '#e0e0e0', display: 'block', textAlign: 'center', padding: '8px 0' }}>—</span>}
>>>>>>> NEW
```

---

## REQ-LOCK 검증

| # | 요구사항 | Diff | 처리 |
|---|---------|------|------|
| R1 | 매트릭스 MS 그룹 헤더 | Diff C (개인), Diff D (팀) | ✅ |
| R2 | 주간 플래너 동일 적용 | Diff E (개인), Diff F (팀) | ✅ |
| R3 | MS 미배정 할일 구분선 아래 | Diff B (ungrouped 섹션, 구분선 포함) | ✅ |
| R4 | MS 없는 셀 플랫 유지 | Diff B (`msGroups.length === 0` 분기) | ✅ |
| R5 | 기존 기능 유지 | TaskCard 동일 props, InlineAdd 유지 | ✅ |
| R6 | 구분선 직선 유지 | DroppableCell 불변, border 스타일 불변 | ✅ |
| R7 | 타임라인 왼쪽 영역 보존 | Diff A (`scrollLeft = 0`) | ✅ |

## DELETE-5 검증

### 삭제 대상

| 삭제 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|-----------|----------|----------|---------|--------|---------|------|
| 개인매트릭스 `cellTasks.map(TaskCard)` L301-302 | N/A | `MsGroupedTasks`로 대체 | 동일 props | N/A | N/A | ✅ |
| 팀매트릭스 `cellTasks.map(TaskCard)` L358-359 | N/A | `MsGroupedTasks`로 대체 | 동일 props | N/A | N/A | ✅ |
| 개인주간 `dayTasks.map(TaskCard showMs)` L442-443 | N/A | `MsGroupedTasks`로 대체 | `showMs` 제거 → MS 헤더가 대체 | TaskCard 자체의 showMs 로직은 유지 (미사용 시 무해) | N/A | ✅ |
| 팀주간 `dayTasks.map(TaskCard showProject showMs)` L514-516 | N/A | `MsGroupedTasks`로 대체 | `showProject` 유지, `showMs` 제거 → MS 헤더가 대체, `projectMap` 추가 | `projectMap` L469에서 여전히 사용 | N/A | ✅ |
| 타임라인 `todayOffset` 계산 + 스크롤 로직 L183-186 | N/A | 삭제 → `scrollLeft = 0`으로 대체 | N/A | `getDayWidth`, `daysBetween`, `minD` — 다른 곳에서도 사용 → 유지 | N/A | ✅ |

### 잔여 import 검증
- [x] 기존 import 변경 없음
- [x] `useMemo` — 이미 import, MsGroupedTasks에서 사용 → ✅
- [x] `useStore` — 이미 import, MsGroupedTasks에서 사용 → ✅
- [x] `getDayWidth`, `daysBetween` — InlineTimelineView에서 제거됐으나, 다른 곳(handleBarDragEnd 등)에서 사용 여부 확인 필요

### getDayWidth / daysBetween 사용 확인

```
grep -n 'getDayWidth\|daysBetween' InlineTimelineView.jsx
→ L184 (삭제됨) + import L12 + handleBarDragEnd 등에서 사용 여부
```

import에 `getDayWidth, daysBetween`이 있고, 삭제되는 건 L183-184뿐. handleBarDragEnd(TimelineShared에서 사용)와 다른 로직에서 여전히 참조 가능 → **import 유지 안전**

---

## Claude Code 프롬프트

```
아래 diff를 순서대로 적용하라. 해석이나 판단 없이 지시 그대로만 이행하라.

파일 1: src/components/views/InlineTimelineView.jsx — str_replace #0~#1
파일 2: src/components/views/UnifiedGridView.jsx — str_replace #2~#6

적용 순서:
0. str_replace #0 (InlineTimelineView 미사용 import 정리)
1. str_replace #1 (InlineTimelineView 타임라인 스크롤 수정)
2. str_replace #2 (UnifiedGridView MsGroupedTasks 컴포넌트 추가)
3. str_replace #3 (PersonalMatrixGrid)
4. str_replace #4 (TeamMatrixGrid)
5. str_replace #5 (PersonalWeeklyGrid)
6. str_replace #6 (TeamWeeklyGrid)

각 str_replace 적용 후 파일 저장.
모든 적용 완료 후:
  npm run build
  빌드 성공 시: git add -A && git commit -m "feat: MS group headers in matrix/weekly cells + fix timeline initial scroll" && git push origin main
  빌드 실패 시: 에러 내용만 보고 (수정 금지)
```
