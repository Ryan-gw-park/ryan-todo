# Sub-Loop 7E — 백로그 사이드바에 할일 배정 추가

> 커밋 A/B/C/D 적용 완료 후 진행
> 대상 파일: `src/components/common/MsBacklogSidebar.jsx`

---

## 문제

현재 백로그 사이드바는 **마일스톤(MS)만** 표시.
Ryan 요구: "백로그에서는 마일스톤과 할일을 모두 각각 선택해서 배정할 수 있어야 한다."

## 해결

콘텐츠 유형 토글 `[MS][할일]` 추가.
- MS 선택 시: 기존 동작 (마일스톤 목록)
- 할일 선택 시: 미배정/배정된 할일 목록 (프로젝트별 그룹)
- 할일도 드래그하여 매트릭스 셀에 배정 가능

---

## E-1. 콘텐츠 유형 state 추가

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
export default function MsBacklogSidebar({ projects, milestones, tasks }) {
  const [blProject, setBlProject] = useState('all')
  const [blAssign, setBlAssign] = useState('unassigned')
new_str:
export default function MsBacklogSidebar({ projects, milestones, tasks }) {
  const [blProject, setBlProject] = useState('all')
  const [blAssign, setBlAssign] = useState('unassigned')
  const [contentType, setContentType] = useState('ms') // 'ms' | 'task'
```

## E-2. 할일 필터 로직 추가

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
  // Group by project
  const backlogByProject = useMemo(() => {
    const map = {}
    backlogMs.forEach(m => {
      if (!map[m.project_id]) map[m.project_id] = []
      map[m.project_id].push(m)
    })
    return map
  }, [backlogMs])
new_str:
  // Group MS by project
  const backlogByProject = useMemo(() => {
    const map = {}
    backlogMs.forEach(m => {
      if (!map[m.project_id]) map[m.project_id] = []
      map[m.project_id].push(m)
    })
    return map
  }, [backlogMs])

  // Filter tasks for backlog
  const backlogTasks = useMemo(() => {
    let result = tasks.filter(t => !t.done && !t.deletedAt)

    // Project filter
    if (blProject !== 'all') {
      result = result.filter(t => t.projectId === blProject)
    }

    // Assignment filter
    if (blAssign === 'unassigned') result = result.filter(t => !t.assigneeId)
    else if (blAssign === 'assigned') result = result.filter(t => !!t.assigneeId)

    return result.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [tasks, blProject, blAssign])

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const map = {}
    backlogTasks.forEach(t => {
      if (!map[t.projectId]) map[t.projectId] = []
      map[t.projectId].push(t)
    })
    return map
  }, [backlogTasks])
```

## E-3. 필터 영역에 콘텐츠 유형 토글 삽입

배정 필터(전체/미배정/배정됨) 바로 위에 MS/할일 토글을 추가합니다.

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
        {/* Assignment filter */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 8 }}>
          {pill(blAssign === 'all', '전체', () => setBlAssign('all'))}
          {pill(blAssign === 'unassigned', '미배정', () => setBlAssign('unassigned'))}
          {pill(blAssign === 'assigned', '배정됨', () => setBlAssign('assigned'))}
        </div>
new_str:
        {/* Content type toggle */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 6 }}>
          {pill(contentType === 'ms', 'MS', () => setContentType('ms'))}
          {pill(contentType === 'task', '할일', () => setContentType('task'))}
        </div>

        {/* Assignment filter */}
        <div style={{ display: 'flex', gap: 2, background: '#f0efeb', borderRadius: 6, padding: 2, marginBottom: 8 }}>
          {pill(blAssign === 'all', '전체', () => setBlAssign('all'))}
          {pill(blAssign === 'unassigned', '미배정', () => setBlAssign('unassigned'))}
          {pill(blAssign === 'assigned', '배정됨', () => setBlAssign('assigned'))}
        </div>
```

## E-4. depth 선택 영역: MS일 때만 표시

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
        {/* Per-project depth selector — L1/L2/L3 */}
        {multiDepthProjects.length > 0 && (
new_str:
        {/* Per-project depth selector — L1/L2/L3 (MS only) */}
        {contentType === 'ms' && multiDepthProjects.length > 0 && (
```

## E-5. 콘텐츠 영역: MS/할일 분기 렌더링

기존 MS 목록 전체를 조건부로 감싸고, 할일 목록을 추가합니다.

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
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
new_str:
      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {contentType === 'ms' ? (
          <>
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
          </>
        ) : (
          <>
            {Object.entries(tasksByProject).map(([pid, taskList]) => {
              const p = projects.find(pr => pr.id === pid)
              if (!p) return null
              const c = getColor(p.color)
              return (
                <div key={pid} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.dot }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: COLOR.textTertiary, marginLeft: 'auto' }}>{taskList.length}건</span>
                  </div>
                  {taskList.map(task => (
                    <div key={task.id} draggable style={{
                      display: 'flex', alignItems: 'flex-start', gap: 5,
                      padding: '4px 8px', marginBottom: 3, borderRadius: 5,
                      background: `${c.dot}06`, border: `0.5px solid ${c.dot}15`,
                      cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${c.dot}12`; e.currentTarget.style.borderColor = `${c.dot}35` }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${c.dot}06`; e.currentTarget.style.borderColor = `${c.dot}15` }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: 2, flexShrink: 0, marginTop: 1,
                        border: `1.5px solid ${COLOR.textTertiary}`, background: '#fff',
                      }} />
                      <span style={{
                        flex: 1, fontWeight: 400, color: COLOR.textPrimary, lineHeight: 1.4,
                        whiteSpace: 'normal', wordBreak: 'break-word',
                      }}>
                        {task.text}
                      </span>
                      {task.dueDate && (
                        <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
            {backlogTasks.length === 0 && (
              <div style={{ textAlign: 'center', color: COLOR.textTertiary, fontSize: 11, padding: 20 }}>
                {blAssign === 'unassigned' ? '미배정 할일이 없습니다' : '해당 필터에 맞는 할일이 없습니다'}
              </div>
            )}
          </>
        )}
      </div>
```

## E-6. 하단 힌트 동적 텍스트

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
        <span style={{ fontSize: 10, color: COLOR.textTertiary }}>← 팀원 셀로 드래그하여 배정</span>
new_str:
        <span style={{ fontSize: 10, color: COLOR.textTertiary }}>← 셀로 드래그하여 {contentType === 'ms' ? 'MS' : '할일'} 배정</span>
```

---

## 커밋 실행

```bash
npm run build
# 에러 없으면:
git add -A
git commit -m "Sub-Loop 7E: 백로그 사이드바에 할일 배정 추가 — MS/할일 콘텐츠 토글, 프로젝트별 그룹, 미배정 필터"
git push origin main
```

---

## 검증 체크리스트

- [ ] 백로그 상단에 `[MS]` `[할일]` 토글 표시
- [ ] MS 선택 시: 기존과 동일 (마일스톤 목록 + depth 선택)
- [ ] 할일 선택 시: 프로젝트별 할일 그룹 표시
- [ ] 할일 선택 시: depth 선택 영역 숨김
- [ ] 미배정 필터: MS/할일 각각 정상 동작
- [ ] 할일 카드: 체크박스 아이콘 + 텍스트 + 날짜
- [ ] 할일 카드: 드래그 가능 (cursor: grab)
- [ ] 빈 상태 메시지: MS/할일 각각 적절한 텍스트
- [ ] 하단 힌트: 콘텐츠 유형에 따라 동적 변경
- [ ] 빌드 에러 없음
