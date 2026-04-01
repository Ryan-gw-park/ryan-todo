# Sub-Loop 7 — 매트릭스 통일 Work Instruction

> 파일: `src/components/matrix/TeamMatrixView.jsx`
> 파일: `src/components/views/PersonalMatrixView.jsx`
> 순서: 커밋 A → B → C (각 커밋 후 `git push origin main`)

---

## 커밋 A — 팀 매트릭스 정리 (제거)

> 이 커밋은 사용하지 않는 코드를 제거합니다. **아래 순서대로** (파일 하단→상단) 적용하세요.
> 대상 파일: `src/components/matrix/TeamMatrixView.jsx`

### A-1. SubviewMember 컴포넌트 전체 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
/* ═══ SubviewMember — member portfolio cards ═══ */
function SubviewMember({ projects, milestones, tasks, members, userId, depthFilter }) {
new_str:

```

위 old_str부터 파일 끝(1465줄)까지 전체를 삭제합니다.

**정확한 범위:** `/* ═══ SubviewMember` 주석부터 파일 끝까지 전체 삭제.

실제 적용: 아래 str_replace를 사용하세요.

```bash
# A-1: SubviewMember 전체 삭제 (파일 끝까지)
# 이 블록은 라인이 너무 길어 sed로 처리
sed -n '1342p' src/components/matrix/TeamMatrixView.jsx
# "/* ═══ SubviewMember" 가 보이면:
sed -i '1342,$ d' src/components/matrix/TeamMatrixView.jsx
```

### A-2. SubviewProject 컴포넌트 전체 삭제

```bash
# A-2: SubviewProject 전체 삭제
# "/* ═══ SubviewProject" 부터 바로 위 삭제한 곳 직전까지
sed -i '/^\/\* ═══ SubviewProject/,/^}$/{ /^}$/{ N; /\n$/d }; d }' src/components/matrix/TeamMatrixView.jsx
```

실제로는 아래처럼 정확한 범위 삭제:
```bash
# SubviewProject는 라인 1245~1340 (SubviewMember 삭제 후 파일 끝 부근)
grep -n 'SubviewProject' src/components/matrix/TeamMatrixView.jsx
# 해당 function 시작부터 닫는 } 까지 삭제
```

### A-3 ~ A-7. 하단 컴포넌트/헬퍼 삭제

아래 블록들을 **파일 하단에서 상단 순서**로 삭제합니다. 각 블록의 시작 주석/function 선언으로 찾으세요.

**삭제 대상 (순서대로):**

1. `SubviewMatrix` 함수 전체 (`/* ═══ SubviewMatrix` ~ 닫는 `}`)
2. 헬퍼 블록 전체:
   ```
   const S = {
     textPrimary: '#37352f',
     ...
   }

   function Dot({ color, size = 7 }) { ... }
   function Avatar({ member, size = 18 }) { ... }
   function filterByDepth(milestones, projectId, depthFilter) { ... }
   function getMsTaskCount(msId, tasks) { ... }
   function getAssignee(ms, members) { ... }
   ```
3. `DepthToggle` 함수 전체 (`/* ═══ Depth Toggle` ~ 닫는 `}`)
4. `SubViewPill` 함수 전체 (`/* ═══ Sub-view Pill` ~ 닫는 `}`)
5. `TeamModePill` 함수 전체 (`/* ═══ Mode Pill` ~ 닫는 `}`)

**하나의 sed 명령으로 처리 가능:**

```bash
# TeamModePill 시작(line ~1032)부터 파일 끝(SubviewMember까지 이미 삭제됨)까지 삭제
# 먼저 TaskOverlay 다음의 MemberAvatar 끝 위치 확인
grep -n 'function MemberAvatar' src/components/matrix/TeamMatrixView.jsx
# MemberAvatar 함수는 유지. 그 다음 빈 줄 이후 TeamModePill부터 파일 끝까지 삭제

# 정확한 방법: MemberAvatar 닫는 } 다음 줄부터 파일 끝까지 삭제
# MemberAvatar는 ~1030줄에서 끝남
```

**권장: 아래 하나의 통합 명령 사용**

```bash
# A-3~A-7 통합: TeamModePill 주석부터 파일 끝까지 삭제
# (이 시점에서 SubviewMember, SubviewProject는 이미 삭제됨)
LINE=$(grep -n '^/\* ═══ Mode Pill' src/components/matrix/TeamMatrixView.jsx | head -1 | cut -d: -f1)
sed -i "${LINE},\$ d" src/components/matrix/TeamMatrixView.jsx
```

### A-8. {false && ...} 미배정/완료 데드 섹션 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
              {/* ── 남은 할일 + 완료 통합 섹션 ── */}
              <div style={{ height: 16 }} />
              {false && remainingRow && (
                <SectionHeader
                  config={{ ...remainingRow, label: '남은 할일 · 완료' }}
                  onToggle={handleToggleSection}
                />
              )}
              {false && remainingRow && !remainingRow.is_collapsed && (
                <>
                  <TaskRowWithDnd
                    label="남은 할일"
                    emoji="📋"
                    columns={allColumns}
                    tasks={remainingTasks}
                    isMobile={isMobile}
                    LW={LW}
                    COL_GAP={COL_GAP}
                    COL_MIN={COL_MIN}
                    category="backlog"
                    activeId={activeId}
                    collapsed={collapsed}
                    extraFields={currentTeamId ? { scope: 'team' } : undefined}
                    msMap={msMap}
                  />
                  {completedRow && (
                    <CompletedRow
                      columns={allColumns}
                      tasks={completedTasks}
                      isMobile={isMobile}
                      LW={LW}
                      COL_GAP={COL_GAP}
                      COL_MIN={COL_MIN}
                      activeId={activeId}
                      collapsed={collapsed}
                      doneCollapsed={doneCollapsed}
                      storeToggle={storeToggle}
                      msMap={msMap}
                    />
                  )}
                </>
              )}
new_str:

```

### A-9. subView === 'project' / 'member' 조건부 블록 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
        {/* Loop-38: conditional sub-view rendering */}
        {/* subView === 'matrix' → rendered below via original DnD task grid */}
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

        {/* Original task-mode grid — shown when subView is 'matrix' */}
        {subView === 'matrix' && <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
new_str:
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
```

그리고 닫는 쪽도 수정:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
        <MsBacklogSidebar projects={filteredProjects} milestones={milestones} tasks={tasks} />
        </div>}
new_str:
        <MsBacklogSidebar projects={filteredProjects} milestones={milestones} tasks={tasks} />
        </div>
```

### A-10. SubViewPill + DepthToggle 툴바 행 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
        {/* Header row 2: sub-view tabs + depth toggle (Loop-38) */}
        <div style={{ marginBottom: 20, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SubViewPill active={subView} onChange={setSubView} />
          <div style={{ width: 1, height: 20, background: '#e8e6df' }} />
          <DepthToggle value={depthFilter} onChange={setDepthFilter} />
        </div>
new_str:

```

### A-11. 헤더 툴바에서 TeamModePill 제거 (task 모드 헤더)

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <TeamModePill active={matrixMode} onChange={setMatrixMode} />
            <button onClick={() => setShowRowConfig(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLOR.border}`, background: 'white', cursor: 'pointer', color: COLOR.textSecondary, fontSize: FONT.label, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = COLOR.textTertiary; e.currentTarget.style.color = COLOR.textPrimary }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = COLOR.border; e.currentTarget.style.color = COLOR.textSecondary }}
            >
              <SettingsIcon /> 뷰 관리
            </button>
          </div>
new_str:
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setShowRowConfig(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLOR.border}`, background: 'white', cursor: 'pointer', color: COLOR.textSecondary, fontSize: FONT.label, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = COLOR.textTertiary; e.currentTarget.style.color = COLOR.textPrimary }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = COLOR.border; e.currentTarget.style.color = COLOR.textSecondary }}
            >
              <SettingsIcon /> 뷰 관리
            </button>
          </div>
```

### A-12. matrixMode === 'milestone' 분기 블록 전체 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  // 마일스톤 모드 → 별도 컴포넌트
  if (matrixMode === 'milestone') {
    return (
      <div data-view="matrix" style={{ padding: isMobile ? SPACE.viewPaddingMobile : SPACE.viewPadding, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: VIEW_WIDTH.wide, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ marginBottom: 20, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>팀 매트릭스</h1>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <TeamModePill active={matrixMode} onChange={setMatrixMode} />
              <button onClick={() => setShowRowConfig(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLOR.border}`, background: 'white', cursor: 'pointer', color: COLOR.textSecondary, fontSize: FONT.label, fontFamily: 'inherit', fontWeight: 500 }}>
                <SettingsIcon /> 뷰 관리
              </button>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Suspense fallback={<div style={{ textAlign: 'center', color: COLOR.textTertiary, padding: 40 }}>로딩...</div>}>
                <MilestoneMatrixView projects={filteredProjects} milestones={milestones} tasks={tasks} />
              </Suspense>
            </div>
            <MsBacklogSidebar projects={filteredProjects} milestones={milestones} tasks={tasks} />
          </div>
        </div>
        {showRowConfig && <RowConfigSettings teamId={currentTeamId} userId={userId} onClose={() => setShowRowConfig(false)} onSave={cfg => { setConfig(cfg); setShowRowConfig(false) }} />}
      </div>
    )
  }
new_str:

```

### A-13. 미사용 state 변수 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const [matrixMode, setMatrixMode] = useState('task') // 'task' | 'milestone'

  // Loop-38: sub-view tabs + depth toggle
  const [subView, setSubView] = useState('matrix') // 'matrix' | 'project' | 'member'
  const [depthFilter, setDepthFilter] = useState('0') // 'all' | '0' | '1' | '2'
  const [members, setMembers] = useState([])
  const [showUnassigned, setShowUnassigned] = useState(false)
new_str:
  const [members, setMembers] = useState([])
```

### A-14. 미사용 import 정리

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
new_str:
import { useState, useCallback, useEffect, useMemo } from 'react'
```

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
const MilestoneMatrixView = lazy(() => import('./MilestoneMatrixView'))
new_str:

```

### A-15. 미사용 변수 정리

`remainingRow`, `completedRow`, `remainingTasks`, `completedTasks`는 데드 섹션에서만 사용되었으므로 삭제:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const remainingRow = config.find(r => r.row_type === 'remaining')
  const completedRow = config.find(r => r.row_type === 'completed')
new_str:

```

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const remainingTasks = tasks
    .filter(t => t.teamId === currentTeamId && t.scope === 'team' && !t.assigneeId && !t.done && t.category === 'backlog')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const completedTasks = tasks
    .filter(t => {
      if (!t.done) return false
      if (t.teamId === currentTeamId) return true
      if (t.scope === 'private' && t.createdBy === userId) return true
      if (!t.teamId && !t.scope) return true
      return false
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
new_str:

```

### A-16. CompletedRow 컴포넌트 삭제

데드 섹션에서만 사용되던 `CompletedRow` 전체 삭제:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
/* ═══ Completed Row — 프로젝트별 접기/펼치기 ═══ */
function CompletedRow({ columns, tasks: doneTasks, isMobile, LW, COL_GAP, COL_MIN, activeId, collapsed, doneCollapsed, storeToggle, msMap }) {
  return (
    <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'stretch' }}>
      <div style={{
        width: LW, flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start', paddingTop: 14, paddingRight: 8, paddingLeft: 12,
        ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
      }}>
        <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>✅</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#999', lineHeight: 1.3, whiteSpace: 'nowrap' }}>완료</span>
      </div>
      {columns.map(p => {
        const c = getColor(p.color)
        const isCol = collapsed[p.id]
        const cellTasks = doneTasks.filter(t => t.projectId === p.id)
        const isDoneCollapsed = doneCollapsed[p.id] !== false && cellTasks.length > 0
        return (
          <CategoryDropZone
            key={p.id}
            id={`${p.id}:done`}
            color={c}
            activeId={activeId}
            style={{
              flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
              background: '#f7f7f5',
              borderLeft: '1px solid rgba(0,0,0,0.04)',
              borderRight: '1px solid rgba(0,0,0,0.04)',
              borderBottom: '1px solid rgba(0,0,0,0.04)',
              borderRadius: '0 0 10px 10px',
              padding: isCol ? '8px 4px' : (isMobile ? '8px 8px' : '10px 14px'),
              minHeight: 50,
              transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
              overflow: 'hidden',
            }}
          >
            {isCol ? (
              <div style={{ fontSize: 10, color: '#bbb', fontWeight: 600, textAlign: 'center' }}>{cellTasks.length}</div>
            ) : (
              <>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', opacity: 0.7 }}>완료</span>
                  <span style={{ fontSize: 10, color: '#bbb', fontWeight: 600 }}>{cellTasks.length}</span>
                  {cellTasks.length > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); storeToggle('matrixDone', p.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 10, fontFamily: 'inherit', padding: '0 4px' }}>
                      {isDoneCollapsed ? '펼치기' : '접기'}
                    </button>
                  )}
                </div>
                <div style={{ minHeight: 20 }}>
                  {isDoneCollapsed
                    ? <div style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>완료 {cellTasks.length}건</div>
                    : (
                      <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {cellTasks.map(task => (
                          <TeamMatrixCard key={task.id} task={task} readOnly={false} isDone milestone={msMap[task.keyMilestoneId]} />
                        ))}
                      </SortableContext>
                    )
                  }
                </div>
              </>
            )}
          </CategoryDropZone>
        )
      })}
    </div>
  )
}
new_str:

```

### A 커밋 실행

```bash
cd /path/to/ryan-todo
# 위 str_replace 전부 적용 후
npm run build
# 에러 없으면:
git add -A
git commit -m "Sub-Loop 7A: 팀 매트릭스 데드 코드 제거 — TeamModePill, SubViewPill, DepthToggle, milestone 모드, subView, 미배정/완료 섹션, SubviewProject/Member/Matrix 컴포넌트"
git push origin main
```

---

## 커밋 B — 팀 매트릭스 축 전환 (행=프로젝트, 열=팀원)

> 커밋 A가 적용된 상태에서 진행합니다.
> 대상 파일: `src/components/matrix/TeamMatrixView.jsx`

이 커밋은 그리드 구조를 근본적으로 변경합니다:
- **Before:** 열=프로젝트, 행=팀원(나 섹션 + 팀 섹션)
- **After:** 행=프로젝트, 열=팀원 (목업 `matrix-unified-v3.jsx` 기준)

### B-1. 기존 그리드 본문 전체를 새 그리드로 교체

커밋 A 적용 후, 그리드 본문은 `<DndContext>` 안의 프로젝트 헤더 행 ~ DragOverlay 직전까지입니다.

**기존 그리드 영역** (커밋 A 후 남아있는 부분):

```
              {/* ── Project header row ── */}
              ...
              {/* ── 나 섹션 ── */}
              ...
              {/* ── 팀 섹션 ── */}
              ...
            </div>
          </div>
```

이 전체 블록을 아래로 교체:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
          <div style={{ flex: 1, overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            <div style={{ minWidth: isMobile ? LW + N * (COL_MIN + COL_GAP) : 'auto' }}>

              {/* ── Project header row ── */}
              <div style={{ display: 'flex', gap: COL_GAP, marginBottom: 0 }}>
                <div style={{ width: LW, flexShrink: 0, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}) }} />
                {allColumns.map(p => {
                  const c = getColor(p.color)
                  const pt = tasks.filter(t => t.projectId === p.id && !t.done)
                  const isCol = collapsed[p.id]
                  return (
                    <div key={p.id} onClick={() => toggleCollapse(p.id)} style={{
                      flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
                      background: c.header, borderRadius: '10px 10px 0 0',
                      padding: isCol ? '12px 0' : (isMobile ? '10px 10px' : '12px 16px'),
                      display: 'flex', alignItems: 'center', justifyContent: isCol ? 'center' : 'space-between',
                      height: 48, boxSizing: 'border-box', borderBottom: `2.5px solid ${c.dot}`,
                      cursor: 'pointer', transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
                      overflow: 'hidden',
                    }}>
                      {isCol ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot }} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: c.text }}>{pt.length}</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{p.name}</span>
                          </div>
                          <span style={{ fontSize: 11, color: c.text, background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '1px 8px', fontWeight: 600, flexShrink: 0 }}>{pt.length}</span>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── 나 섹션 ── */}
              {meHeader && (
                <SectionHeader
                  config={{ ...meHeader, label: userName }}
                  onToggle={handleToggleSection}
                />
              )}
              {meHeader && !meHeader.is_collapsed && taskRows.map(row => {
                const category = rowCategoryMap[row.section] || 'today'
                const rowTasks = myTasksForRow(category)
                return (
                  <TaskRowWithDnd
                    key={row.id}
                    label={row.label}
                    emoji={category === 'today' ? '🎯' : '📌'}
                    columns={allColumns}
                    tasks={rowTasks}
                    isMobile={isMobile}
                    LW={LW}
                    COL_GAP={COL_GAP}
                    COL_MIN={COL_MIN}
                    category={category}
                    activeId={activeId}
                    collapsed={collapsed}
                    extraFields={currentTeamId ? { scope: 'assigned', assigneeId: userId } : undefined}
                    msMap={msMap}
                  />
                )
              })}

              {/* ── 팀 섹션 ── */}
              <div style={{ height: 16 }} />
              {teamHeader && (
                <SectionHeader
                  config={{ ...teamHeader, label: teamName }}
                  onToggle={handleToggleSection}
                />
              )}
              {teamHeader && !teamHeader.is_collapsed && memberRows.map(row => {
                const isMemberCollapsed = collapsedMembers.has(row.mapped_user_id)
                const mTasks = memberTasks(row.mapped_user_id)
                return (
                  <MemberDropZone key={row.id} memberId={row.mapped_user_id} activeId={activeId}>
                    {!isMemberCollapsed ? (
                      <>
                        {/* 펼친 상태: 이름 헤더 (전체 너비) + 상세 카드 */}
                        <div
                          onClick={() => handleToggleMember(row.mapped_user_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', cursor: 'pointer' }}
                        >
                          <MemberAvatar name={row.label} size={22} />
                          <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textSecondary }}>{row.label}</span>
                          <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>▾</span>
                          <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary, marginLeft: 4 }}>{mTasks.length}건</span>
                        </div>
                        <ReadOnlyRow
                          columns={allColumns}
                          tasks={mTasks}
                          isMobile={isMobile}
                          LW={LW}
                          COL_GAP={COL_GAP}
                          COL_MIN={COL_MIN}
                          collapsed={collapsed}
                          isOwner={isOwner}
                          msMap={msMap}
                        />
                      </>
                    ) : (
                      /* 접힌 상태: 프로젝트별 카운트 표시 */
                      <div
                        onClick={() => handleToggleMember(row.mapped_user_id)}
                        style={{ display: 'flex', gap: COL_GAP, cursor: 'pointer', alignItems: 'stretch' }}
                      >
                        <div style={{
                          width: LW, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                          paddingTop: 10, paddingBottom: 10, paddingRight: 8, paddingLeft: 12,
                          ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
                        }}>
                          <MemberAvatar name={row.label} size={22} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
                          <span style={{ fontSize: 10, color: '#aaa' }}>▸</span>
                        </div>
                        {allColumns.map(p => {
                                  const isCol = collapsed[p.id]
                          const isPersonalCol = !p.teamId
                          const count = isPersonalCol ? 0 : mTasks.filter(t => t.projectId === p.id).length
                          return (
                            <div key={p.id} style={{
                              flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
                              background: isPersonalCol ? '#f5f5f3' : '#fafafa',
                              borderLeft: '1px solid rgba(0,0,0,0.04)',
                              borderRight: '1px solid rgba(0,0,0,0.04)',
                              borderTop: '1px solid rgba(0,0,0,0.06)',
                              padding: isCol ? '8px 4px' : '8px 14px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              minHeight: 36,
                              transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
                              overflow: 'hidden',
                            }}>
                              {count > 0 ? (
                                <span style={{
                                  fontSize: 12, fontWeight: 600, color: '#666',
                                  background: '#eee', borderRadius: 10, padding: '2px 10px',
                                }}>{count}</span>
                              ) : (
                                !isCol && <span style={{ fontSize: 11, color: '#ddd' }}>—</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </MemberDropZone>
                )
              })}

            </div>
          </div>
new_str:
          <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0 12px' : 0 }}>
            <div style={{ border: `0.5px solid ${COLOR.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* ── Column header: 프로젝트 | 팀원... ── */}
              <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${members.length}, 1fr)` }}>
                <div style={{ padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, fontSize: FONT.caption, fontWeight: 600, color: COLOR.textTertiary }}>
                  프로젝트
                </div>
                {members.map(mem => (
                  <div key={mem.id} style={{ padding: '8px 10px', background: COLOR.bgSurface, borderBottom: `1px solid ${COLOR.border}`, borderRight: `0.5px solid ${COLOR.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MemberAvatar name={mem.displayName || mem.name} size={20} />
                    <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{mem.displayName || mem.name}</span>
                  </div>
                ))}
              </div>

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
            </div>
          </div>
```

### B-2. DnD handleDragEnd 수정 — 새 드롭 zone ID 대응

기존 `projectId:category` 형식 대신 `projectId:memberId`를 처리하도록 수정.

**기존 카테고리 drop zone 핸들러를 새 member-cell 핸들러로 교체:**

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
    // ── 카테고리 drop zone (projectId:category) ──
    if (typeof overId === 'string' && overId.includes(':')) {
      const [targetProjectId, targetCategory] = overId.split(':')
      const project = projects.find(p => p.id === targetProjectId)

      // Loop-31: 드롭 대상의 expected scope/assigneeId 결정
      let expectedScope = task.scope
      let expectedAssignee = task.assigneeId
      if (project?.teamId) {
        if (targetCategory === 'today' || targetCategory === 'next') {
          expectedScope = 'assigned'
          expectedAssignee = userId
        } else if (targetCategory === 'backlog') {
          expectedScope = 'team'
          expectedAssignee = null
        }
      } else {
        // Loop-35I: 개인 프로젝트 타겟 — scope='private'로 전환
        expectedScope = 'private'
        expectedAssignee = null
      }
      const expectedDone = targetCategory === 'done'

      // 조기 리턴: 모든 상태가 동일할 때만
      const isSamePosition = (
        task.projectId === targetProjectId &&
        task.category === targetCategory &&
        task.scope === expectedScope &&
        task.assigneeId === expectedAssignee &&
        task.done === expectedDone
      )
      if (isSamePosition) return

      const patch = { projectId: targetProjectId, category: targetCategory }

      // 자동 배정
      if (project?.teamId) {
        if (targetCategory === 'today' || targetCategory === 'next') {
          patch.scope = 'assigned'
          patch.assigneeId = userId
        } else if (targetCategory === 'backlog') {
          patch.scope = 'team'
          patch.assigneeId = null
        }
      } else {
        // Loop-35I: 개인 프로젝트 타겟 — scope='private'로 전환, teamId 해제
        patch.scope = 'private'
        patch.teamId = null
        patch.assigneeId = null
      }

      // Loop-31: done 처리 — 완료 행 drop 시 done=true, 미완료 행 drop 시 done=false
      if (targetCategory === 'done' && !task.done) {
        patch.done = true
      } else if (targetCategory !== 'done' && task.done) {
        patch.done = false
      }

      updateTask(active.id, patch)
      return
    }
new_str:
    // ── 셀 drop zone (projectId:memberId) ──
    if (typeof overId === 'string' && overId.includes(':')) {
      const [targetProjectId, targetMemberId] = overId.split(':')
      // 동일 위치면 무시
      if (task.projectId === targetProjectId && task.assigneeId === targetMemberId) return

      const patch = {
        projectId: targetProjectId,
        assigneeId: targetMemberId,
        scope: 'assigned',
      }
      // done 해제
      if (task.done) patch.done = false

      updateTask(active.id, patch)
      return
    }
```

**기존 task-on-task cross-cell 핸들러도 수정:**

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
    } else {
      // Cross-cell: 대상 task 위치로 이동
      const project = projects.find(p => p.id === overTask.projectId)
      const patch = { projectId: overTask.projectId, category: overTask.category }

      if (project?.teamId) {
        if (overTask.category === 'today' || overTask.category === 'next') {
          patch.scope = 'assigned'
          patch.assigneeId = userId
        } else if (overTask.category === 'backlog') {
          patch.scope = 'team'
          patch.assigneeId = null
        }
      } else {
        // Loop-35I: 개인 프로젝트 타겟 — scope='private'로 전환, teamId 해제
        patch.scope = 'private'
        patch.teamId = null
        patch.assigneeId = null
      }

      // Loop-31: done 처리 — 대상 task의 done 상태 기준
      if (overTask.done && !task.done) {
        patch.done = true
      } else if (!overTask.done && task.done) {
        patch.done = false
      }

      updateTask(active.id, patch)
    }
new_str:
    } else {
      // Cross-cell: 대상 task의 project + assignee로 이동
      const patch = {
        projectId: overTask.projectId,
        assigneeId: overTask.assigneeId,
        scope: 'assigned',
      }
      if (task.done) patch.done = false
      updateTask(active.id, patch)
    }
```

**same-cell reorder 조건도 수정 (category 대신 assigneeId 기준):**

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
    if (task.projectId === overTask.projectId && task.category === overTask.category) {
      // Same cell: reorder
      const cellTasks = tasks
        .filter(t => t.projectId === task.projectId && t.category === task.category)
        .sort((a, b) => a.sortOrder - b.sortOrder)
new_str:
    if (task.projectId === overTask.projectId && task.assigneeId === overTask.assigneeId) {
      // Same cell: reorder
      const cellTasks = tasks
        .filter(t => t.projectId === task.projectId && t.assigneeId === task.assigneeId && !t.done)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
```

### B-3. 미사용 변수/함수 정리

커밋 A에서 이미 많이 정리됨. 추가로 축 전환 후 불필요해진 것들:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const myRole = useStore(s => s.myRole)
  const isOwner = myRole === 'owner'
  const isMobile = window.innerWidth < 768
  const LW = isMobile ? 80 : 110
  const COL_GAP = 10
  const COL_MIN = isMobile ? 200 : 0
new_str:
  const myRole = useStore(s => s.myRole)
  const isOwner = myRole === 'owner'
  const isMobile = window.innerWidth < 768
```

`N`, `rowCategoryMap` 도 삭제:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const N = allColumns.length
  const rowCategoryMap = { me_today: 'today', me_next: 'next' }
new_str:

```

미사용 filter helpers 삭제:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  // Filter helpers
  const myTasksForRow = (category) => tasks
    .filter(t => {
      if (t.category !== category) return false
      if (t.done) return false
      if (t.teamId === currentTeamId && t.assigneeId === userId && t.scope === 'assigned') return true
      // scope='team'(미배정)은 "남은 할일"에만 표시 — 여기서 제외
      if (t.scope === 'private' && t.createdBy === userId) return true
      if (!t.teamId && !t.scope) return true
      return false
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const memberTasks = (memberId) => tasks
    .filter(t => t.assigneeId === memberId && t.scope === 'assigned' && t.teamId === currentTeamId && !t.done)
    .sort((a, b) => a.sortOrder - b.sortOrder)
new_str:

```

미사용 sub-components 삭제 (축 전환 후 불필요):

- `SectionHeader` — 나/팀 섹션 헤더 용도였음 → 삭제
- `MemberDropZone` — 팀원 행 드롭 대상 → 삭제  
- `TaskRowWithDnd` — 기존 열=프로젝트 행 → 삭제
- `ReadOnlyRow` — 팀원 상세 행 → 삭제

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
/* ═══ Section Header — lane-style: {name} ▾ ═══ */
function SectionHeader({ config, onToggle }) {
  return (
    <div>
      <div
        onClick={() => onToggle(config)}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '0 0 4px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{config.label}</span>
        <span style={{
          fontSize: 11, color: '#bbb',
          marginLeft: 6,
          transition: 'transform 0.2s ease',
          display: 'inline-block',
          transform: config.is_collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>▾</span>
      </div>
      <div style={{ borderBottom: '1px solid #ece8e1', marginBottom: 6 }} />
    </div>
  )
}

/* ═══ Member Drop Zone — 팀원 행 드롭 대상 ═══ */
function MemberDropZone({ memberId, activeId, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: `member:${memberId}` })
  return (
    <div ref={setNodeRef} style={{
      transition: 'background 0.08s',
      ...(isOver && activeId ? { background: 'rgba(49,130,206,0.06)', borderRadius: 8 } : {}),
    }}>
      {children}
    </div>
  )
}
new_str:

```

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
/* ═══ Task Row with DnD — editable rows (나 섹션, 남은 할일) ═══ */
function TaskRowWithDnd({ label, emoji, columns, tasks: rowTasks, isMobile, LW, COL_GAP, COL_MIN, category, activeId, collapsed, extraFields, msMap }) {
  return (
    <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'stretch' }}>
      <div style={{
        width: LW, flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start', paddingTop: 14, paddingRight: 8, paddingLeft: 12,
        ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
      }}>
        {emoji && <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{label}</span>
      </div>

      {columns.map(p => {
        const c = getColor(p.color)
        const isCol = collapsed[p.id]
        const cellTasks = rowTasks.filter(t => t.projectId === p.id)
        return (
          <CategoryDropZone
            key={p.id}
            id={`${p.id}:${category}`}
            color={c}
            activeId={activeId}
            style={{
              flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
              background: c.card,
              borderLeft: '1px solid rgba(0,0,0,0.04)',
              borderRight: '1px solid rgba(0,0,0,0.04)',
              borderTop: '1px solid rgba(0,0,0,0.06)',
              padding: isCol ? '8px 4px' : (isMobile ? '8px 8px' : '10px 14px'),
              minHeight: 60,
              transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
              overflow: 'hidden',
            }}
          >
            {isCol ? (
              <div style={{ fontSize: 10, color: c.dot, fontWeight: 600, textAlign: 'center' }}>{cellTasks.length}</div>
            ) : (
              <>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.text, opacity: 0.7 }}>{label}</span>
                  <span style={{ fontSize: 10, color: c.dot, fontWeight: 600 }}>{cellTasks.length}</span>
                </div>
                <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {cellTasks.map(task => (
                    <TeamMatrixCard key={task.id} task={task} readOnly={false} milestone={msMap[task.keyMilestoneId]} />
                  ))}
                </SortableContext>
                <InlineAdd projectId={p.id} category={category} color={c} extraFields={extraFields} />
              </>
            )}
          </CategoryDropZone>
        )
      })}
    </div>
  )
}

/* ═══ Member Detail Row — 팀장: 편집 가능, 팀원: 읽기전용 ═══ */
function ReadOnlyRow({ columns, tasks: rowTasks, isMobile, LW, COL_GAP, COL_MIN, collapsed, isOwner, msMap }) {
  return (
    <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'stretch' }}>
      <div style={{
        width: LW, flexShrink: 0,
        alignSelf: 'flex-start', paddingTop: 6, paddingRight: 8,
        ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}),
      }} />

      {columns.map(p => {
        const c = getColor(p.color)
        const isCol = collapsed[p.id]
        // 팀원 펼침 행: 개인 프로젝트 열은 빈 셀
        const isPersonalCol = !p.teamId
        const cellTasks = isPersonalCol ? [] : rowTasks.filter(t => t.projectId === p.id)
        return (
          <div key={p.id} style={{
            flex: isCol ? '0 0 48px' : 1, minWidth: isCol ? 48 : COL_MIN,
            background: isPersonalCol ? '#f5f5f3' : c.card,
            borderLeft: '1px solid rgba(0,0,0,0.04)',
            borderRight: '1px solid rgba(0,0,0,0.04)',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            padding: isCol ? '8px 4px' : (isMobile ? '8px 8px' : '10px 14px'),
            minHeight: 40,
            transition: 'flex 0.25s ease, min-width 0.25s ease, padding 0.25s ease',
            overflow: 'hidden',
          }}>
            {isCol ? (
              <div style={{ fontSize: 10, color: c.dot, fontWeight: 600, textAlign: 'center' }}>{cellTasks.length}</div>
            ) : isPersonalCol ? (
              <span style={{ fontSize: 11, color: '#ddd' }}>—</span>
            ) : (
              <>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.text, opacity: 0.7 }}>상세</span>
                  <span style={{ fontSize: 10, color: c.dot, fontWeight: 600 }}>{cellTasks.length}</span>
                </div>
                {cellTasks.map(task => (
                  <TeamMatrixCard key={task.id} task={task} readOnly={!isOwner} milestone={msMap[task.keyMilestoneId]} />
                ))}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
new_str:

```

DnD에서 `member:` prefix 핸들러도 제거 (새 레이아웃에서는 `projectId:memberId` drop zone으로 대체됨):

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
    // ── 팀원 행 drop ──
    // Loop-31: category 강제 변경 제거 — R1이 scope='assigned' 자동 설정
    if (typeof overId === 'string' && overId.startsWith('member:')) {
      const targetMemberId = overId.split(':')[1]
      updateTask(active.id, {
        assigneeId: targetMemberId,
      })
      return
    }
new_str:

```

config 관련 미사용 변수 정리 (새 레이아웃에서 section/row config 불필요):

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  // Group config rows
  const sectionHeaders = config.filter(r => r.row_type === 'section_header')
  const meHeader = sectionHeaders.find(r => r.section === 'me')
  const teamHeader = sectionHeaders.find(r => r.section === 'team')
  const taskRows = config.filter(r => r.row_type === 'task_row').sort((a, b) => a.sort_order - b.sort_order)
  const memberRows = config.filter(r => r.row_type === 'member_row').sort((a, b) => a.sort_order - b.sort_order)
new_str:

```

`collapsedMembers`, `handleToggleSection`, `handleToggleMember` 제거:

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const [config, setConfig] = useState(defaultConfig)
  // 팀원 접기 상태: collapsedMembers Set에 포함된 팀원만 요약 모드
  // 팀 섹션 펼치기 = 모든 팀원 상세 카드 표시 (기본), 개별 클릭으로 접기 토글
  const [collapsedMembers, setCollapsedMembers] = useState(new Set())
new_str:
  const [config, setConfig] = useState(defaultConfig)
```

```
str_replace
path: src/components/matrix/TeamMatrixView.jsx
old_str:
  const handleToggleSection = useCallback(async (configItem) => {
    setConfig(prev => prev.map(c => c.id === configItem.id ? { ...c, is_collapsed: !c.is_collapsed } : c))
    await useMatrixConfig.toggleCollapse(configItem.id, configItem.is_collapsed)
  }, [])

  const handleToggleMember = useCallback((mappedUserId) => {
    setCollapsedMembers(prev => {
      const next = new Set(prev)
      if (next.has(mappedUserId)) next.delete(mappedUserId)
      else next.add(mappedUserId)
      return next
    })
  }, [])
new_str:

```

### B 커밋 실행

```bash
npm run build
# 에러 없으면:
git add -A
git commit -m "Sub-Loop 7B: 팀 매트릭스 축 전환 — 행=프로젝트, 열=팀원, CSS Grid 레이아웃, 프로젝트 접기/펼치기, DnD 셀 기반 재배정"
git push origin main
```

---

## 커밋 C — 개인 매트릭스 변경

> 대상 파일: `src/components/views/PersonalMatrixView.jsx`

현재 코드를 목업과 비교한 결과, **개인 매트릭스는 이미 대부분 목업과 일치합니다:**
- ✅ `CAT_COLS` 라벨: 이미 `'지금 할일'`
- ✅ dot 사용 (이모지 없음)
- ✅ 프로젝트 행 접기/펼치기 (▾ 토글)
- ✅ 체크박스 14px
- ✅ 구분선 `0.5px solid ${COLOR.border}`
- ✅ 접힌 건수 표시

**미세 조정만 필요:**

### C-1. ▾ 아이콘 크기를 목업과 일치 (fontSize 12 → 9, width 14 → 12)

```
str_replace
path: src/components/views/PersonalMatrixView.jsx
old_str:
                        <span style={{ fontSize: 12, color: COLOR.textTertiary, width: 14, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
new_str:
                        <span style={{ fontSize: 9, color: COLOR.textTertiary, width: 12, textAlign: 'center', transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', flexShrink: 0 }}>▾</span>
```

### C 커밋 실행

```bash
npm run build
git add -A
git commit -m "Sub-Loop 7C: 개인 매트릭스 ▾ 아이콘 크기 목업 일치 (9px)"
git push origin main
```

---

## 검증 체크리스트

커밋 완료 후 확인:

- [ ] 팀 매트릭스: 행=프로젝트, 열=팀원으로 정상 렌더링
- [ ] 팀 매트릭스: TeamModePill, SubViewPill, DepthToggle 완전 제거
- [ ] 팀 매트릭스: DnD 정상 동작 (드래그로 할일 셀 간 이동)
- [ ] 팀 매트릭스: MsBacklogSidebar 우측 상시 표시
- [ ] 팀 매트릭스: 프로젝트 접기/펼치기 동작 (접힌 건수 표시)
- [ ] 팀 매트릭스: + 추가 버튼 각 셀에 존재
- [ ] 개인 매트릭스: 기존 기능 정상 동작
- [ ] 빌드 에러 없음 (`npm run build`)
