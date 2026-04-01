# Sub-Loop 4.2: 프로젝트 뷰 타임라인을 InlineTimelineView로 교체

아래 str_replace 명령을 순서대로 실행하라. 코드를 자의적으로 해석하거나 추가 수정하지 마라.

---

## 파일 1: src/components/views/InlineTimelineView.jsx

### 수정 1-1: 함수 시그니처에 projectId 추가

old_str:
```
export default function InlineTimelineView({ scope }) {
```

new_str:
```
export default function InlineTimelineView({ scope, projectId }) {
  const isProjectMode = !!projectId
```

### 수정 1-2: displayProjects에 projectId 필터 추가

old_str:
```
  const displayProjects = useMemo(() => {
    let base = scope === 'personal' ? projects : filteredProjects
    if (scope === 'personal') {
      // personal: show all projects where user has tasks or MS
      return base
    }
    return base
  }, [projects, filteredProjects, scope])
```

new_str:
```
  const displayProjects = useMemo(() => {
    let base = scope === 'personal' ? projects : filteredProjects
    if (isProjectMode) {
      return base.filter(p => p.id === projectId)
    }
    return base
  }, [projects, filteredProjects, scope, isProjectMode, projectId])
```

### 수정 1-3: 프로젝트 모드일 때 프로젝트 헤더 행 생략

old_str:
```
      // Project row
      rows.push({
        rowType: 'project', id: p.id, name: p.name, color: getColor(p.color).dot,
        projectColor: getColor(p.color).dot,
        startDate: projStart, endDate: projEnd,
        hasChildren: projMs.length > 0 || projTasks.length > 0,
      })

      if (collapsed.has(p.id)) return
      if (depth === 'project') return
```

new_str:
```
      // Project row — skip in project mode (already shown in project header)
      if (!isProjectMode) {
        rows.push({
          rowType: 'project', id: p.id, name: p.name, color: getColor(p.color).dot,
          projectColor: getColor(p.color).dot,
          startDate: projStart, endDate: projEnd,
          hasChildren: projMs.length > 0 || projTasks.length > 0,
        })

        if (collapsed.has(p.id)) return
        if (depth === 'project') return
      }
```

### 수정 1-4: Header/padding을 프로젝트 모드에서 조정

old_str:
```
  return (
    <div data-view="timeline" style={{ padding: SPACE.viewPadding, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ─── Header ─── */}
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0 }}>
            {scope === 'personal' ? '개인 타임라인' : '타임라인'}
          </h1>
          <p style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary, marginTop: 4 }}>{monthLabel}</p>
        </div>
```

new_str:
```
  return (
    <div data-view="timeline" style={{ padding: isProjectMode ? 0 : SPACE.viewPadding, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: isProjectMode ? undefined : 1400, margin: isProjectMode ? 0 : '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* ─── Header (global mode only) ─── */}
        {!isProjectMode && (
          <div style={{ marginBottom: 16, flexShrink: 0 }}>
            <h1 style={{ fontSize: FONT.viewTitle, fontWeight: 700, color: COLOR.textPrimary, margin: 0 }}>
              {scope === 'personal' ? '개인 타임라인' : '타임라인'}
            </h1>
            <p style={{ fontSize: FONT.subtitle, color: COLOR.textTertiary, marginTop: 4 }}>{monthLabel}</p>
          </div>
        )}
```

### 수정 1-5: 프로젝트 모드에서 깊이 필터 '프로젝트' 옵션 제거

old_str:
```
          {[
            { k: 'project', l: '프로젝트' },
            { k: 'ms', l: '+마일스톤' },
            { k: 'ms+task', l: '+마일스톤+할일' },
          ].map(d => (
```

new_str:
```
          {[
            ...(!isProjectMode ? [{ k: 'project', l: '프로젝트' }] : []),
            { k: 'ms', l: '마일스톤' },
            { k: 'ms+task', l: '마일스톤+할일' },
          ].map(d => (
```

### 수정 1-6: LEFT_W 프로젝트 모드 대응

old_str:
```
  const LEFT_W = 260
```

new_str:
```
  const LEFT_W = isProjectMode ? 300 : 260
```

### 수정 1-7: 좌측 헤더 텍스트 프로젝트 모드 대응

old_str:
```
                <span style={{ fontSize: FONT.label, color: COLOR.textTertiary, fontWeight: 500 }}>프로젝트 / MS / 할일</span>
```

new_str:
```
                <span style={{ fontSize: FONT.label, color: COLOR.textTertiary, fontWeight: 500 }}>
                  {isProjectMode ? '마일스톤 / 할일' : '프로젝트 / MS / 할일'}
                </span>
```

---

## 파일 2: src/components/project/UnifiedProjectView.jsx

### 수정 2-1: InlineTimelineView import 추가

old_str:
```
import { toX, getWeekDates, getTimelineStart, formatWeekLabel, getTodayX, getBarWidth } from '../../utils/ganttHelpers'
```

new_str:
```
import { toX, getWeekDates, getTimelineStart, formatWeekLabel, getTodayX, getBarWidth } from '../../utils/ganttHelpers'
import InlineTimelineView from '../views/InlineTimelineView'
```

### 수정 2-2: 타임라인 모드에서 기존 트리+GanttRow 전체를 InlineTimelineView로 교체

old_str:
```
      {/* Main container */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Column headers */}
        <div style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, background: '#fafaf8', flexShrink: 0 }}>
          {/* Left: tree column headers */}
          <div style={{ width: totalTreeWidth, flexShrink: 0, display: 'flex', position: 'sticky', left: 0, zIndex: 4, background: '#fafaf8' }}>
```

new_str:
```
      {/* Main container */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Timeline mode → full InlineTimelineView */}
        {rightMode === '타임라인' && (
          <InlineTimelineView projectId={projectId} />
        )}

        {/* Task list mode → existing tree + task rows */}
        {rightMode === '전체 할일' && <>
        {/* Column headers */}
        <div style={{ display: 'flex', borderBottom: `0.5px solid ${S.border}`, background: '#fafaf8', flexShrink: 0 }}>
          {/* Left: tree column headers */}
          <div style={{ width: totalTreeWidth, flexShrink: 0, display: 'flex', position: 'sticky', left: 0, zIndex: 4, background: '#fafaf8' }}>
```

### 수정 2-3: main container 닫기 전에 Fragment 닫기 추가

Scrollable body가 끝나는 부분을 찾아야 한다. 아래 grep으로 정확한 위치를 확인하라:

```bash
grep -n "마일스톤 추가\|마일스톤이 없습니다" src/components/project/UnifiedProjectView.jsx
```

Scrollable body `</div>` 와 main container `</div>` 사이에 `</>}` 를 삽입한다.

"+ 마일스톤 추가" 버튼과 백로그 섹션 뒤에 scrollable body가 닫힌다.
아래 패턴을 찾아 교체하라:

old_str:
```
        </div>
      </div>
    </div>
  )
}
```

**주의**: 이 패턴이 파일 끝부분에서 `UnifiedProjectView` 컴포넌트를 닫는 부분이어야 한다. 
다른 함수 컴포넌트의 닫는 부분과 혼동하지 마라.

정확한 위치 확인을 위해 아래를 먼저 실행하라:

```bash
# UnifiedProjectView 함수의 return 마지막 부분 확인
tail -30 src/components/project/UnifiedProjectView.jsx | head -20
```

찾은 위치에서 scrollable body `</div>` 바로 뒤에 `</>}` 를 삽입:

new_str:
```
        </div>
        </>}
      </div>
    </div>
  )
}
```

---

## 수정 2-4: 타임라인 모드에서 불필요한 column header 렌더 방지

수정 2-2에서 Column headers 전체를 `{rightMode === '전체 할일' && <>` 안에 넣었으므로,
기존의 타임라인 전용 right header (weekDates 렌더링 부분)도 자동으로 숨겨진다.

별도 수정 불필요 — 이미 `<>...</>` Fragment 안에 포함됨.

---

## 검증

```bash
npm run build
```

- [ ] 프로젝트(정기주총) → '전체 할일' 모드 → 기존 트리+할일 레이아웃 정상
- [ ] 프로젝트(정기주총) → '타임라인' 전환 → InlineTimelineView 렌더
- [ ] 프로젝트 타임라인에 프로젝트 헤더 행 없음 (프로젝트명은 상단에 이미 있음)
- [ ] 깊이 필터에 '프로젝트' 옵션 없음 (프로젝트 모드이므로)
- [ ] 정기주총(flat): depth 0 MS → 할일 행 표시
- [ ] ABI 코리아(deep): 법인설립 > 지점설립 > 필요서류 3단 들여쓰기
- [ ] ▸/▾ 접기/펼치기 동작
- [ ] 주간 날짜 헤더 + 오늘 빨간선
- [ ] 담당자 아바타 표시
- [ ] 할일 클릭 → openDetail 정상
- [ ] '전체 할일' ↔ '타임라인' 탭 전환 반복해도 정상
- [ ] 글로벌 팀/개인 타임라인 (4.1) 여전히 정상
- [ ] npm run build 성공

git push origin main
