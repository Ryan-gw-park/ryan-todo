# Sub-Loop 7: 매트릭스 통일 — 접기/펼치기 + 체크박스 + 명칭 + 구분선 + 토글 아이콘

아래 str_replace 명령을 순서대로 실행하라. 코드를 자의적으로 해석하거나 추가 수정하지 마라.

---

## 파일 1: src/components/views/PersonalMatrixView.jsx

### 수정 1-1: 카테고리 레이블 변경 — "오늘" → "지금 할일"

old_str:
```
const CAT_COLS = [
  { key: 'today', label: '오늘', emoji: '🔴' },
  { key: 'next', label: '다음', emoji: '🟡' },
  { key: 'later', label: '나중', emoji: '🔵' },
]
```

new_str:
```
const CAT_COLS = [
  { key: 'today', label: '지금 할일', dot: '#E53E3E' },
  { key: 'next', label: '다음', dot: '#D69E2E' },
  { key: 'later', label: '나중', dot: '#3182CE' },
]
```

### 수정 1-2: 카테고리 헤더 렌더링 — 이모지 → dot + 라벨

old_str:
```
              {CAT_COLS.map(cat => (
                <div key={cat.key} style={{
                  padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                  fontSize: FONT.caption, fontWeight: 600,
                  color: cat.key === 'today' ? COLOR.danger : cat.key === 'next' ? COLOR.textPrimary : COLOR.textTertiary,
                }}>
                  {cat.emoji} {cat.label}
                  <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, marginLeft: 6 }}>{catCounts[cat.key]}</span>
                </div>
              ))}
```

new_str:
```
              {CAT_COLS.map(cat => (
                <div key={cat.key} style={{
                  padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`,
                  fontSize: FONT.caption, fontWeight: 600,
                  color: cat.key === 'today' ? COLOR.danger : cat.key === 'next' ? COLOR.textPrimary : COLOR.textTertiary,
                }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: cat.dot, marginRight: 4, verticalAlign: 'middle' }} />
                  {cat.label}
                  <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary, marginLeft: 6 }}>{catCounts[cat.key]}</span>
                </div>
              ))}
```

### 수정 1-3: 프로젝트 행 전체를 접기/펼치기 + 체크박스 + 통일 구분선으로 교체

old_str:
```
              {projectsWithTasks.map(proj => {
                const c = getColor(proj.color)
                const projTasks = myTasks.filter(t => t.projectId === proj.id && !t.done)
                return (
                  <div key={proj.id} style={{ display: 'grid', gridTemplateColumns: `140px repeat(${CAT_COLS.length}, 1fr)` }}>
                    {/* Project label */}
                    <div style={{
                      padding: '8px 10px', borderBottom: '0.5px solid #e8e6df', borderRight: '0.5px solid #e8e6df',
                      display: 'flex', alignItems: 'flex-start', gap: 6, background: `${c.dot}04`,
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <div style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{proj.name}</div>
                        <div style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projTasks.length}건</div>
                      </div>
                    </div>

                    {/* Category cells */}
                    {CAT_COLS.map(cat => {
                      const cellTasks = myTasks.filter(t => t.projectId === proj.id && t.category === cat.key && !t.done)
                      const dropId = `${proj.id}:${cat.key}`
                      return (
                        <CellDrop key={dropId} id={dropId}>
                          <div style={{ padding: '4px 4px', borderBottom: '0.5px solid #e8e6df', borderRight: '0.5px solid #e8e6df', minHeight: 50 }}>
                            {cellTasks.length === 0 ? (
                              <span style={{ fontSize: 10, color: '#e0e0e0', padding: '8px', display: 'block' }}>—</span>
                            ) : cellTasks.map(t => (
                              <DraggableTask key={t.id} task={t} showMs={showMs} msMap={msMap} />
                            ))}
                            <div style={{ padding: '2px 8px' }}>
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

new_str:
```
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
                        <span style={{ fontSize: 12, color: COLOR.textTertiary, width: 14, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
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
```

### 수정 1-4: DraggableTask에 체크박스 추가

old_str:
```
function DraggableTask({ task, showMs, msMap }) {
  const { openDetail } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openDetail(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', marginBottom: 1,
        borderRadius: 4, cursor: 'grab', transition: 'background 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = COLOR.bgHover }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        flex: 1, fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary, lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: task.done ? 'line-through' : 'none',
      }}>
        {task.text}
      </span>
      {showMs && task.milestoneId && msMap[task.milestoneId] && (
        <MSBadge ms={msMap[task.milestoneId]} size="xs" />
      )}
      {task.dueDate && <span style={{ fontSize: FONT.ganttMs, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}
    </div>
  )
}
```

new_str:
```
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
```

---

## 파일 2: src/components/matrix/TeamMatrixView.jsx

### 수정 2-1: 기본 config 레이블 — "오늘 할일" → "지금 할일"

old_str:
```
    { id: '_me_today', section: 'me_today', label: '오늘 할일', row_type: 'task_row', sort_order: 1, parent_section: 'me' },
    { id: '_me_next', section: 'me_next', label: '다음 할일', row_type: 'task_row', sort_order: 2, parent_section: 'me' },
```

new_str:
```
    { id: '_me_today', section: 'me_today', label: '지금 할일', row_type: 'task_row', sort_order: 1, parent_section: 'me' },
    { id: '_me_next', section: 'me_next', label: '다음 할일', row_type: 'task_row', sort_order: 2, parent_section: 'me' },
```

### 수정 2-2: 프로젝트별/담당자별 서브뷰에서도 백로그 사이드바 표시

프로젝트별 서브뷰 렌더 부분을 찾아 flex 래핑 + 사이드바 추가:

old_str:
```
        {subView === 'project' && (
          <SubviewProject
            projects={filteredProjects}
            milestones={milestones}
            tasks={tasks}
            members={members}
            depthFilter={depthFilter}
          />
        )}
        {subView === 'member' && (
          <SubviewMember
            projects={filteredProjects}
            milestones={milestones}
            tasks={tasks}
            members={members}
            userId={userId}
            depthFilter={depthFilter}
          />
        )}
```

new_str:
```
        {subView === 'project' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <SubviewProject
                projects={filteredProjects}
                milestones={milestones}
                tasks={tasks}
                members={members}
                depthFilter={depthFilter}
              />
            </div>
            <MsBacklogSidebar projects={filteredProjects} milestones={milestones} tasks={tasks} />
          </div>
        )}
        {subView === 'member' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <SubviewMember
                projects={filteredProjects}
                milestones={milestones}
                tasks={tasks}
                members={members}
                userId={userId}
                depthFilter={depthFilter}
              />
            </div>
            <MsBacklogSidebar projects={filteredProjects} milestones={milestones} tasks={tasks} />
          </div>
        )}
```

### 수정 2-3: DepthToggle 레이블 변경 확인

이미 Sub-Loop 6에서 L1/L2/L3으로 변경됨. 확인만 하라:

```bash
grep -n "대분류\|중분류\|소분류" src/components/matrix/TeamMatrixView.jsx
```

결과가 없으면 이미 적용됨. 있으면 아래로 교체:

old_str:
```
    { key: '0', label: '대분류' },
    { key: '1', label: '중분류' },
    { key: '2', label: '소분류' },
```

new_str:
```
    { key: '0', label: 'L1' },
    { key: '1', label: 'L2' },
    { key: '2', label: 'L3' },
```

---

## 검증

```bash
npm run build
```

- [ ] 개인 매트릭스: 카테고리 헤더가 "● 지금 할일", "● 다음", "● 나중" (이모지 제거, dot으로 통일)
- [ ] 개인 매트릭스: 프로젝트 행 클릭 → 접기/펼치기 동작
- [ ] 개인 매트릭스: 접힌 상태에서 각 카테고리 셀에 "N건" 또는 "—" 표시
- [ ] 개인 매트릭스: 토글 아이콘(▾) 크기 12px로 잘 보임
- [ ] 개인 매트릭스: 모든 할일 앞에 14px 체크박스 표시
- [ ] 개인 매트릭스: 체크박스 클릭 → 완료 토글 (드래그 시작 안 됨)
- [ ] 개인 매트릭스: 같은 프로젝트 내 모든 셀의 하단 구분선이 동일 (`0.5px solid ${COLOR.border}`)
- [ ] 개인 매트릭스: 백로그 사이드바 상시 표시
- [ ] 팀 매트릭스: "지금 할일" 레이블로 변경됨
- [ ] 팀 매트릭스: 프로젝트별 서브뷰에서 백로그 사이드바 표시됨
- [ ] 팀 매트릭스: 담당자별 서브뷰에서 백로그 사이드바 표시됨
- [ ] 팀 매트릭스: 매트릭스 서브뷰에서 백로그 사이드바 표시됨 (기존)
- [ ] 팀 매트릭스: 마일스톤 모드에서 백로그 사이드바 표시됨 (기존)
- [ ] DnD 여전히 정상 동작
- [ ] npm run build 성공

git push origin main
