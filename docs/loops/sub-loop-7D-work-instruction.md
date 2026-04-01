# Sub-Loop 7D — 요약라인 병합 + MS뱃지 제거 + 가로선

> 커밋 A/B/C 적용 완료된 상태에서 진행
> 파일 2개: TeamMatrixView.jsx, PersonalMatrixView.jsx

---

## 문제 진단 (스크린샷 기준)

| # | 이슈 | 원인 |
|---|------|------|
| 1 | 프로젝트 펼쳤을 때 헤더행(빈셀) + 콘텐츠행 = **2줄 낭비** | header grid row + content grid row 분리 |
| 2 | 개인 매트릭스 **가로선 깨짐** | 2줄 구조에서 border 겹침/누락 |
| 3 | 팀 매트릭스 **MS뱃지 공간 낭비** | TeamMatrixCard renderMeta에 MSBadge |
| 4 | 팀/개인 매트릭스 **항목 표시 불일치** | 팀=UniversalCard, 개인=DraggableTask 다른 스타일 |

## 해결 원칙

**1줄 병합:**
```
접힘: [▸ 프로젝트명 N건] [3건] [—] [1건]
펼침: [▾ 프로젝트명 N건] [할일+추가] [할일+추가] [할일+추가]
```
→ 프로젝트명 셀은 항상 보이고, 우측 셀은 접힘=건수, 펼침=할일 콘텐츠

**MS뱃지 제거:** 매트릭스 셀 내 MSBadge 완전 제거 (공간 낭비)

---

## Part 1 — 개인 매트릭스 (PersonalMatrixView.jsx)

### 1-1. showMs 토글 버튼 + state 제거

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
          <div style={{ display: 'flex', gap: 2, background: '#f5f4f0', borderRadius: 7, padding: 2 }}>
            <button onClick={() => setShowMs(false)} style={{
              border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: !showMs ? 600 : 400, background: !showMs ? '#fff' : 'transparent',
              color: !showMs ? COLOR.textPrimary : COLOR.textTertiary,
              boxShadow: !showMs ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>할일 모드</button>
            <button onClick={() => setShowMs(true)} style={{
              border: 'none', borderRadius: 5, padding: '4px 14px', fontSize: FONT.caption, fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: showMs ? 600 : 400, background: showMs ? '#fff' : 'transparent',
              color: showMs ? COLOR.textPrimary : COLOR.textTertiary,
              boxShadow: showMs ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>MS 배정</button>
          </div>
new_str:

```

### 1-2. showMs state + msMap 제거

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
  const milestones = useStore(s => s.milestones)
  const [showMs, setShowMs] = useState(false)

  const msMap = useMemo(() => {
    const m = {}
    milestones.forEach(ms => { m[ms.id] = ms })
    return m
  }, [milestones])
new_str:
  const milestones = useStore(s => s.milestones)
```

### 1-3. MSBadge import 제거

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
import MSBadge from '../common/MSBadge'
import MsBacklogSidebar from '../common/MsBacklogSidebar'
new_str:
import MsBacklogSidebar from '../common/MsBacklogSidebar'
```

### 1-4. 프로젝트 행 2줄→1줄 병합

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
              {projectsWithTasks.map(proj => {
                const c = getColor(proj.color)
                const projTasks = myTasks.filter(t => t.projectId === proj.id && !t.done)
                const isCollapsed = collapsed[proj.id]
                return (
                  <div key={proj.id}>
                    {/* Project header — clickable to collapse */}
                    <div
                      onClick={() => toggleCollapse(proj.id)}
                      style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)`, cursor: 'pointer' }}
                    >
                      <div style={{
                        padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                        display: 'flex', alignItems: 'center', gap: 5, background: `${c.dot}04`,
                      }}>
                        <span style={{ fontSize: 9, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1 }}>{proj.name}</span>
                        <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projTasks.length}건</span>
                      </div>
                      {/* Collapsed summary per category */}
                      {CAT_COLS.map(cat => {
                        const count = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done).length
                        return (
                          <div key={cat.key} style={{
                            padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                            fontSize: 10, color: COLOR.textTertiary, background: `${c.dot}04`,
                          }}>
                            {isCollapsed ? (count > 0 ? `${count}건` : '—') : ''}
                          </div>
                        )
                      })}
                    </div>

                    {/* Expanded: task cells */}
                    {!isCollapsed && (
                      <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)` }}>
                        <div style={{ borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}` }} />
                        {CAT_COLS.map(cat => {
                          const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done)
                          const dropId = `${proj.id}:${cat.key}`
                          return (
                            <CellDrop key={dropId} id={dropId}>
                              <div style={{ padding: '6px 8px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, minHeight: 36 }}>
                                {cellTasks.length === 0 ? (
                                  <span style={{ fontSize: 10, color: '#e0e0e0' }}>—</span>
                                ) : cellTasks.map(t => (
                                  <DraggableTask key={t.id} task={t} showMs={showMs} msMap={msMap} />
                                ))}
                                <div style={{ paddingLeft: 19, marginTop: 2 }}>
                                  <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                                </div>
                              </div>
                            </CellDrop>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
new_str:
              {projectsWithTasks.map(proj => {
                const c = getColor(proj.color)
                const projTasks = myTasks.filter(t => t.projectId === proj.id && !t.done)
                const isCollapsed = collapsed[proj.id]
                return (
                  <div key={proj.id} style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)` }}>
                    {/* Left: project name + toggle */}
                    <div
                      onClick={() => toggleCollapse(proj.id)}
                      style={{
                        padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                        display: 'flex', alignItems: isCollapsed ? 'center' : 'flex-start', gap: 5,
                        background: `${c.dot}04`, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 9, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: isCollapsed ? 0 : 2 }} />
                      <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1 }}>{proj.name}</span>
                      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projTasks.length}건</span>
                    </div>
                    {/* Right cells: collapsed=count, expanded=tasks */}
                    {CAT_COLS.map(cat => {
                      const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done)
                      const dropId = `${proj.id}:${cat.key}`
                      return isCollapsed ? (
                        <div key={cat.key} style={{
                          padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                          fontSize: FONT.tiny, color: COLOR.textTertiary, background: `${c.dot}04`,
                          display: 'flex', alignItems: 'center',
                        }}>
                          {cellTasks.length > 0 ? `${cellTasks.length}건` : '—'}
                        </div>
                      ) : (
                        <CellDrop key={dropId} id={dropId}>
                          <div style={{ padding: '6px 8px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, minHeight: 36 }}>
                            {cellTasks.length === 0 ? (
                              <span style={{ fontSize: 10, color: '#e0e0e0' }}>—</span>
                            ) : cellTasks.map(t => (
                              <DraggableTask key={t.id} task={t} />
                            ))}
                            <div style={{ paddingLeft: 19, marginTop: 2 }}>
                              <InlineAdd projectId={proj.id} category={cat.key} color={c} compact />
                            </div>
                          </div>
                        </CellDrop>
                      )
                    })}
                  </div>
                )
              })}
```

### 1-5. DraggableTask에서 showMs/msMap/MSBadge 제거

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
function DraggableTask({ task, showMs, msMap }) {
  const { openDetail, toggleDone } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openDetail(task)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 6px', marginBottom: 1,
        borderRadius: 4, cursor: 'grab', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = COLOR.bgHover }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }} style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer', marginTop: 1,
        border: task.done ? 'none' : `1.5px solid #c8c7c1`,
        background: task.done ? '#22c55e' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span style={{
        flex: 1, fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary, lineHeight: 1.4,
        textDecoration: task.done ? 'line-through' : 'none',
      }}>
        {task.text}
      </span>
      {showMs && task.keyMilestoneId && msMap[task.keyMilestoneId] && (
        <MSBadge ms={msMap[task.keyMilestoneId]} size="xs" />
      )}
      {task.dueDate && <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}
    </div>
  )
}
new_str:
function DraggableTask({ task }) {
  const { openDetail, toggleDone } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openDetail(task)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 6px', marginBottom: 1,
        borderRadius: 4, cursor: 'grab', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = COLOR.bgHover }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div onClick={e => { e.stopPropagation(); e.preventDefault(); toggleDone(task.id) }} style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer', marginTop: 1,
        border: task.done ? 'none' : `1.5px solid #c8c7c1`,
        background: task.done ? '#22c55e' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span style={{
        flex: 1, fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary, lineHeight: 1.4,
        textDecoration: task.done ? 'line-through' : 'none',
      }}>
        {task.text}
      </span>
      {task.dueDate && <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}
    </div>
  )
}
```

---

## Part 2 — 팀 매트릭스 (TeamMatrixView.jsx)

### 2-1. TeamMatrixCard에서 MSBadge renderMeta 제거

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
        renderMeta={milestone ? () => <MSBadge milestone={milestone} /> : undefined}
new_str:

```

### 2-2. TeamMatrixCard에서 milestone prop 제거

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
function TeamMatrixCard({ task, readOnly, isDone, milestone }) {
new_str:
function TeamMatrixCard({ task, readOnly, isDone }) {
```

### 2-3. MSBadge import 제거

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
import MSBadge from '../common/MSBadge'
import CompactMsRow from '../common/CompactMsRow'
new_str:
import CompactMsRow from '../common/CompactMsRow'
```

> 참고: CompactMsRow는 커밋 A에서 이미 사용처가 삭제되었으므로, import도 삭제 가능:
> `import CompactMsRow from '../common/CompactMsRow'` → 삭제
> (빌드에서 unused import warning이 나면 함께 삭제)

### 2-4. 팀 매트릭스 프로젝트 행 2줄→1줄 병합 + milestone prop 제거

> 이 diff 하나로 2줄→1줄 병합 + TeamMatrixCard에서 milestone prop 동시 제거
> `old_str`은 커밋 B에서 넣은 코드 그대로입니다.

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
              {/* ── Project rows ── */}
              {allColumns.map(proj => {
                const c = getColor(proj.color)
                const projTasks = tasks.filter(t => t.projectId === proj.id && !t.done && t.teamId === currentTeamId)
                const isCollapsed = collapsed[proj.id]

                return (
                  <div key={proj.id}>
                    {/* Project header row — clickable to collapse */}
                    <div
                      onClick={() => toggleCollapse(proj.id)}
                      style={{ display: 'grid', gridTemplateColumns: `160px repeat(${members.length}, 1fr)`, cursor: 'pointer' }}
                    >
                      <div style={{
                        padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: isCollapsed ? '#fff' : `${c.dot}04`,
                      }}>
                        <span style={{ fontSize: 9, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1 }}>{proj.name}</span>
                        <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projTasks.length}건</span>
                      </div>
                      {/* Collapsed: per-member count */}
                      {members.map(mem => {
                        const count = projTasks.filter(t => t.assigneeId === mem.userId).length
                        return (
                          <div key={mem.id} style={{
                            padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                            fontSize: FONT.tiny, color: COLOR.textTertiary,
                            background: isCollapsed ? '#fff' : `${c.dot}04`,
                          }}>
                            {isCollapsed ? (count > 0 ? `${count}건` : '—') : ''}
                          </div>
                        )
                      })}
                    </div>

                    {/* Expanded: task cells per member */}
                    {!isCollapsed && (
                      <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${members.length}, 1fr)` }}>
                        <div style={{ borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}` }} />
                        {members.map(mem => {
                          const cellTasks = projTasks.filter(t => t.assigneeId === mem.userId)
                            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                          const dropId = `${proj.id}:${mem.userId}`
                          return (
                            <CategoryDropZone
                              key={mem.id}
                              id={dropId}
                              color={c}
                              activeId={activeId}
                              style={{ padding: '6px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, minHeight: 36 }}
                            >
                              {cellTasks.length === 0 ? (
                                <span style={{ fontSize: FONT.tiny, color: '#e0e0e0' }}>—</span>
                              ) : (
                                <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                  {cellTasks.map(t => (
                                    <TeamMatrixCard key={t.id} task={t} readOnly={mem.userId !== userId && !isOwner} milestone={msMap[t.keyMilestoneId]} />
                                  ))}
                                </SortableContext>
                              )}
                              <InlineAdd
                                projectId={proj.id}
                                category="today"
                                color={c}
                                extraFields={{ scope: 'assigned', assigneeId: mem.userId }}
                                compact
                              />
                            </CategoryDropZone>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
new_str:
              {/* ── Project rows (1줄 병합) ── */}
              {allColumns.map(proj => {
                const c = getColor(proj.color)
                const projTasks = tasks.filter(t => t.projectId === proj.id && !t.done && t.teamId === currentTeamId)
                const isCollapsed = collapsed[proj.id]

                return (
                  <div key={proj.id} style={{ display: 'grid', gridTemplateColumns: `160px repeat(${members.length}, 1fr)` }}>
                    {/* Left: project name + toggle */}
                    <div
                      onClick={() => toggleCollapse(proj.id)}
                      style={{
                        padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                        display: 'flex', alignItems: isCollapsed ? 'center' : 'flex-start', gap: 5,
                        background: `${c.dot}04`, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 9, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: isCollapsed ? 0 : 2 }} />
                      <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary, flex: 1 }}>{proj.name}</span>
                      <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projTasks.length}건</span>
                    </div>
                    {/* Right cells: collapsed=count, expanded=tasks */}
                    {members.map(mem => {
                      const cellTasks = projTasks.filter(t => t.assigneeId === mem.userId)
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                      const dropId = `${proj.id}:${mem.userId}`
                      return isCollapsed ? (
                        <div key={mem.id} style={{
                          padding: '8px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                          fontSize: FONT.tiny, color: COLOR.textTertiary, background: `${c.dot}04`,
                          display: 'flex', alignItems: 'center',
                        }}>
                          {cellTasks.length > 0 ? `${cellTasks.length}건` : '—'}
                        </div>
                      ) : (
                        <CategoryDropZone
                          key={mem.id}
                          id={dropId}
                          color={c}
                          activeId={activeId}
                          style={{ padding: '6px 10px', borderBottom: `0.5px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, minHeight: 36 }}
                        >
                          {cellTasks.length === 0 ? (
                            <span style={{ fontSize: FONT.tiny, color: '#e0e0e0' }}>—</span>
                          ) : (
                            <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                              {cellTasks.map(t => (
                                <TeamMatrixCard key={t.id} task={t} readOnly={mem.userId !== userId && !isOwner} />
                              ))}
                            </SortableContext>
                          )}
                          <InlineAdd
                            projectId={proj.id}
                            category="today"
                            color={c}
                            extraFields={{ scope: 'assigned', assigneeId: mem.userId }}
                            compact
                          />
                        </CategoryDropZone>
                      )
                    })}
                  </div>
                )
              })}
```

### 2-5. msMap 관련 미사용 코드 정리

msMap이 더 이상 그리드에서 사용되지 않으면 정리:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  // 마일스톤 데이터
  const milestones = useStore(s => s.milestones)
  const msMap = useMemo(() => {
    const m = {}
    milestones.forEach(ms => { m[ms.id] = ms })
    return m
  }, [milestones])
new_str:
  const milestones = useStore(s => s.milestones)
```

> 주의: `milestones`는 `MsBacklogSidebar`에 전달되므로 유지. `msMap`만 삭제.

---

## 커밋 실행

```bash
npm run build
# 에러 없으면:
git add -A
git commit -m "Sub-Loop 7D: 요약라인 1줄 병합 + MS뱃지 제거 + 가로선 통일 — 팀/개인 매트릭스 모두"
git push origin main
```

---

## 검증 체크리스트

- [ ] 팀 매트릭스: 프로젝트 펼침 시 1줄(좌=프로젝트명, 우=할일) — 빈 요약행 없음
- [ ] 팀 매트릭스: 프로젝트 접힘 시 1줄(좌=프로젝트명, 우=건수)
- [ ] 팀 매트릭스: MS뱃지 없음 (할일 텍스트만 깔끔하게)
- [ ] 팀 매트릭스: 가로선 프로젝트 단위 통일
- [ ] 개인 매트릭스: 동일 1줄 구조
- [ ] 개인 매트릭스: showMs 토글 버튼 제거됨
- [ ] 개인 매트릭스: 가로선 깨짐 해소
- [ ] DnD 정상 동작 (팀: 셀 간 이동, 개인: 카테고리 간 이동)
- [ ] + 추가 버튼 모든 셀에 존재
- [ ] MsBacklogSidebar 우측 상시 표시 (양쪽 모두)
- [ ] 빌드 에러 없음
