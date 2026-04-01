# Sub-Loop 6: 팀/개인 매트릭스 MS 배정 모드 + 백로그 사이드바

아래 명령을 순서대로 실행하라. 코드를 자의적으로 해석하거나 추가 수정하지 마라.

---

## Step 1: 새 파일 생성 — src/components/common/MsBacklogSidebar.jsx

```jsx
import { useState, useMemo } from 'react'
import { COLOR, FONT } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'

/* ═══════════════════════════════════════════════════════
   MsBacklogSidebar — MS 배정 모드 백로그 사이드바
   팀/개인 매트릭스 공용
   ═══════════════════════════════════════════════════════ */

export default function MsBacklogSidebar({ projects, milestones, tasks }) {
  const [blProject, setBlProject] = useState('all')
  const [blAssign, setBlAssign] = useState('unassigned')

  // Per-project depth map: { projectId: depthLevel }
  const [depthMap, setDepthMap] = useState(() => {
    const map = {}
    projects.forEach(p => { map[p.id] = 0 })
    return map
  })

  const setDepth = (pid, d) => setDepthMap(prev => ({ ...prev, [pid]: d }))

  // Compute max depth per project
  const maxDepthMap = useMemo(() => {
    const map = {}
    projects.forEach(p => {
      const projMs = milestones.filter(m => m.project_id === p.id)
      let max = 0
      projMs.forEach(m => { if ((m.depth ?? 0) > max) max = m.depth ?? 0 })
      map[p.id] = max
    })
    return map
  }, [projects, milestones])

  // Filter MS for backlog
  const backlogMs = useMemo(() => {
    let result = milestones

    // Project filter
    if (blProject !== 'all') {
      result = result.filter(m => m.project_id === blProject)
    }

    // Depth filter — per project
    result = result.filter(m => {
      const targetDepth = depthMap[m.project_id] ?? 0
      return (m.depth ?? 0) === targetDepth
    })

    // Assignment filter
    if (blAssign === 'unassigned') result = result.filter(m => !m.owner_id)
    else if (blAssign === 'assigned') result = result.filter(m => !!m.owner_id)

    return result
  }, [milestones, blProject, blAssign, depthMap])

  // Group by project
  const backlogByProject = useMemo(() => {
    const map = {}
    backlogMs.forEach(m => {
      if (!map[m.project_id]) map[m.project_id] = []
      map[m.project_id].push(m)
    })
    return map
  }, [backlogMs])

  // Get parent MS name for breadcrumb
  const msMap = useMemo(() => {
    const map = {}
    milestones.forEach(m => { map[m.id] = m })
    return map
  }, [milestones])

  const getParentPath = (ms) => {
    if (!ms.parent_id) return null
    const parts = []
    let current = msMap[ms.parent_id]
    while (current) {
      parts.unshift(current.title || '?')
      current = current.parent_id ? msMap[current.parent_id] : null
    }
    return parts.length > 0 ? parts.join(' > ') : null
  }

  // MS task count
  const getTaskCount = (msId) => {
    return tasks.filter(t => t.keyMilestoneId === msId && !t.deletedAt).length
  }

  const pill = (active, label, onClick) => (
    <button onClick={onClick} style={{
      border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 10.5,
      fontFamily: 'inherit', cursor: 'pointer',
      fontWeight: active ? 600 : 400,
      background: active ? '#fff' : 'transparent',
      color: active ? COLOR.textPrimary : COLOR.textTertiary,
      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    }}>{label}</button>
  )

  // Projects that have multi-depth MS
  const multiDepthProjects = projects.filter(p => (maxDepthMap[p.id] || 0) > 0)

  return (
    <div style={{
      width: 280, flexShrink: 0, borderLeft: `1px solid ${COLOR.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: '#fafaf8',
    }}>
      {/* Header + filters */}
      <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${COLOR.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.textPrimary, marginBottom: 10 }}>백로그</div>

        {/* Project dropdown */}
        <select value={blProject} onChange={e => setBlProject(e.target.value)}
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 6,
            border: `1px solid ${COLOR.border}`, fontSize: 11, fontFamily: 'inherit',
            color: COLOR.textPrimary, background: '#fff', marginBottom: 8, cursor: 'pointer',
          }}
        >
          <option value="all">전체 프로젝트</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Assignment filter */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 8 }}>
          {pill(blAssign === 'all', '전체', () => setBlAssign('all'))}
          {pill(blAssign === 'unassigned', '미배정', () => setBlAssign('unassigned'))}
          {pill(blAssign === 'assigned', '배정됨', () => setBlAssign('assigned'))}
        </div>

        {/* Per-project depth selector — L1/L2/L3 */}
        {multiDepthProjects.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, color: COLOR.textTertiary, marginBottom: 6, fontWeight: 500 }}>프로젝트별 배정 단위</div>
            {multiDepthProjects.map(p => {
              const c = getColor(p.color)
              const maxD = maxDepthMap[p.id] || 0
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: COLOR.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {Array.from({ length: maxD + 1 }, (_, d) => (
                    <button key={d} onClick={() => setDepth(p.id, d)} style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 3, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: (depthMap[p.id] ?? 0) === d ? c.dot : '#eee',
                      color: (depthMap[p.id] ?? 0) === d ? '#fff' : COLOR.textTertiary,
                      fontWeight: (depthMap[p.id] ?? 0) === d ? 600 : 400,
                    }}>L{d + 1}</button>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {Object.entries(backlogByProject).map(([pid, msList]) => {
          const p = projects.find(pr => pr.id === pid)
          if (!p) return null
          const c = getColor(p.color)
          return (
            <div key={pid} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: c.dot }}>{p.name}</span>
                <span style={{ fontSize: 9, color: COLOR.textTertiary, marginLeft: 'auto' }}>{msList.length}개</span>
              </div>
              {msList.map(ms => {
                const parentPath = getParentPath(ms)
                const tc = getTaskCount(ms.id)
                return (
                  <div key={ms.id} draggable style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', marginBottom: 3, borderRadius: 5,
                    background: `${c.dot}08`, border: `0.5px solid ${c.dot}18`,
                    cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${c.dot}15`; e.currentTarget.style.borderColor = `${c.dot}40` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${c.dot}08`; e.currentTarget.style.borderColor = `${c.dot}18` }}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: COLOR.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ms.title || '(제목 없음)'}
                      </div>
                      {parentPath && (
                        <div style={{ fontSize: 8.5, color: COLOR.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {parentPath}
                        </div>
                      )}
                    </div>
                    {tc > 0 && <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{tc}</span>}
                  </div>
                )
              })}
            </div>
          )
        })}

        {backlogMs.length === 0 && (
          <div style={{ textAlign: 'center', color: COLOR.textTertiary, fontSize: 11, padding: 20 }}>
            {blAssign === 'unassigned' ? '미배정 MS가 없습니다' : '해당 필터에 맞는 MS가 없습니다'}
          </div>
        )}
      </div>

      {/* Hint */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${COLOR.border}`, textAlign: 'center' }}>
        <span style={{ fontSize: 10, color: COLOR.textTertiary }}>← 팀원 셀로 드래그하여 배정</span>
      </div>
    </div>
  )
}
```

---

## Step 2: TeamMatrixView.jsx — DepthToggle 레이블 변경 (대분류/중분류/소분류 → L1/L2/L3)

old_str:
```
/* ═══ Depth Toggle — [전체][대분류][중분류][소분류] (Loop-38) ═══ */
function DepthToggle({ value, onChange }) {
  const items = [
    { key: 'all', label: '전체' },
    { key: '0', label: '대분류' },
    { key: '1', label: '중분류' },
    { key: '2', label: '소분류' },
  ]
```

new_str:
```
/* ═══ Depth Toggle — [전체][L1][L2][L3] (Loop-38) ═══ */
function DepthToggle({ value, onChange }) {
  const items = [
    { key: 'all', label: '전체' },
    { key: '0', label: 'L1' },
    { key: '1', label: 'L2' },
    { key: '2', label: 'L3' },
  ]
```

---

## Step 3: TeamMatrixView.jsx — import MsBacklogSidebar

old_str:
```
import CompactMsRow from '../common/CompactMsRow'
```

new_str:
```
import CompactMsRow from '../common/CompactMsRow'
import MsBacklogSidebar from '../common/MsBacklogSidebar'
```

---

## Step 4: TeamMatrixView.jsx — milestone 모드에서 기존 MilestoneMatrixView를 백로그 사이드바 레이아웃으로 교체

old_str:
```
  if (matrixMode === 'milestone') {
    return (
      <div data-view="matrix" style={{ padding: isMobile ? SPACE.viewPaddingMobile : SPACE.viewPadding }}>
        <div style={{ maxWidth: VIEW_WIDTH.wide, margin: '0 auto' }}>
          <div style={{ marginBottom: 32, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <TeamModePill active={matrixMode} onChange={setMatrixMode} />
              <button onClick={() => setShowRowConfig(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLOR.border}`, background: 'white', cursor: 'pointer', color: COLOR.textSecondary, fontSize: FONT.label, fontFamily: 'inherit', fontWeight: 500 }}>
                <SettingsIcon /> 뷰 관리
              </button>
            </div>
          </div>
          <Suspense fallback={<div style={{ textAlign: 'center', color: COLOR.textTertiary, padding: 40 }}>로딩...</div>}>
            <MilestoneMatrixView projects={filteredProjects} milestones={milestones} tasks={tasks} />
          </Suspense>
        </div>
        {showRowConfig && <RowConfigSettings teamId={currentTeamId} userId={userId} onClose={() => setShowRowConfig(false)} onSave={cfg => { setConfig(cfg); setShowRowConfig(false) }} />}
      </div>
    )
  }
```

new_str:
```
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
```

---

## Step 5: PersonalMatrixView.jsx — import MsBacklogSidebar

old_str:
```
import MSBadge from '../common/MSBadge'
```

new_str:
```
import MSBadge from '../common/MSBadge'
import MsBacklogSidebar from '../common/MsBacklogSidebar'
```

---

## Step 6: PersonalMatrixView.jsx — MS 뱃지 체크박스를 MS 배정 모드 토글로 교체

old_str:
```
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: FONT.caption, color: COLOR.textTertiary }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={showMs} onChange={e => setShowMs(e.target.checked)} style={{ accentColor: COLOR.textPrimary }} />
              MS 뱃지
            </label>
          </div>
```

new_str:
```
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
```

---

## Step 7: PersonalMatrixView.jsx — MS 배정 모드일 때 백로그 사이드바 표시

DndContext 블록을 감싸는 div를 찾아서, showMs일 때 사이드바를 추가한다.

old_str:
```
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
```

new_str:
```
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ flex: 1, overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
```

그리고 DndContext 닫는 부분 뒤에 사이드바 + 감싸는 div 닫기를 추가한다.

PersonalMatrixView의 DragOverlay 뒤, DndContext 닫기 뒤를 찾는다:

old_str:
```
          <DragOverlay>
            {activeTask && (
              <div style={{ background: '#fff', borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 8px', fontSize: FONT.body, color: COLOR.textPrimary, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTask.text}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
```

new_str:
```
          <DragOverlay>
            {activeTask && (
              <div style={{ background: '#fff', borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 8px', fontSize: FONT.body, color: COLOR.textPrimary, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTask.text}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        {showMs && <MsBacklogSidebar projects={projects} milestones={milestones} tasks={tasks} />}
        </div>
      </div>
    </div>
  )
}
```

---

## 검증

```bash
npm run build
```

- [ ] 팀 매트릭스 → 'MS 배정 모드' 탭 → 우측에 백로그 사이드바 표시
- [ ] 백로그 사이드바: 프로젝트 드롭다운 동작
- [ ] 백로그 사이드바: 전체/미배정/배정됨 필터 동작
- [ ] 백로그 사이드바: ABI 코리아 depth 선택 L1/L2/L3 버튼 동작
- [ ] 백로그 사이드바: MS 칩에 부모 경로 표시 (depth >= 2일 때)
- [ ] 팀 매트릭스 → '할일 모드' 탭 → 기존 DnD 그리드 정상
- [ ] 팀 매트릭스 → DepthToggle 레이블이 L1/L2/L3으로 표시
- [ ] 개인 매트릭스 → '할일 모드' / 'MS 배정' 토글 동작
- [ ] 개인 매트릭스 → 'MS 배정' 모드일 때 우측 백로그 사이드바 표시
- [ ] 개인 매트릭스 → '할일 모드'일 때 백로그 사이드바 숨김
- [ ] 기존 기능 전체 정상 (DnD, InlineAdd, 완료 토글 등)
- [ ] npm run build 성공

git push origin main
