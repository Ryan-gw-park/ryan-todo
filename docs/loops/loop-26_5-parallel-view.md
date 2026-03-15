# Loop-26.5 — 병렬 보기 (타임라인 / 결과물+Task)

## 목표
프로젝트 레이어의 **병렬 보기 탭** 구현. 2가지 뷰 모드:
- **타임라인 모드**: 전체 마일스톤 간트 (간결한 전체 조망)
- **결과물+Task 모드**: 마일스톤별 결과물 간트 + 연결 Task 병렬 표시 (커버리지 체크)

---

## 전제 조건
- Loop-26.3 완료 (ref_milestones, ref_deliverables 데이터 존재)
- Loop-26.4 완료 (Tasks 탭 동작, tasks.deliverable_id 매핑)

---

## 영향받는 파일

### 수정 대상
| 파일 | 변경 | 규모 |
|------|------|------|
| `src/components/project/ParallelView.jsx` | 임시 → 2모드 실제 구현 | L |

### 신규 생성
| 파일 | 역할 |
|------|------|
| `src/components/project/parallel/SimpleGanttMode.jsx` | 마일스톤 간트 전체 뷰 |
| `src/components/project/parallel/DetailParallelMode.jsx` | 결과물 + Task 병렬 뷰 |
| `src/hooks/useParallelData.js` | 병렬 보기용 데이터 조합 훅 |

### 수정 금지
- 기존 모든 뷰 및 컴포넌트
- `useStore.js` 기존 액션

---

## ParallelView.jsx

```jsx
// src/components/project/ParallelView.jsx
import SimpleGanttMode from './parallel/SimpleGanttMode'
import DetailParallelMode from './parallel/DetailParallelMode'

export default function ParallelView({ projectId, mode }) {
  switch (mode) {
    case 'simple': return <SimpleGanttMode projectId={projectId} />
    case 'detail': return <DetailParallelMode projectId={projectId} />
    default: return <SimpleGanttMode projectId={projectId} />
  }
}
```

---

## useParallelData 훅

```javascript
// src/hooks/useParallelData.js
import { useState, useEffect } from 'react'
import { getDb } from '../utils/supabase'
import useStore from './useStore'

export function useParallelData(projectId) {
  const [milestones, setMilestones] = useState([])
  const [deliverables, setDeliverables] = useState([])
  const [loading, setLoading] = useState(true)

  const tasks = useStore(s =>
    s.tasks.filter(t => t.projectId === projectId && !t.deletedAt)
  )

  useEffect(() => {
    if (!projectId) return
    load()
  }, [projectId])

  async function load() {
    setLoading(true)
    const db = getDb()

    // 1. project_references 조회
    const { data: ref } = await db
      .from('project_references')
      .select('id')
      .eq('project_id', projectId)
      .single()

    if (!ref) { setLoading(false); return }

    // 2. milestones + deliverables 조회
    const [msResult, dvResult] = await Promise.all([
      db.from('ref_milestones')
        .select('*')
        .eq('reference_id', ref.id)
        .order('sort_order'),
      db.from('ref_deliverables')
        .select('*')
        .eq('reference_id', ref.id)
        .order('sort_order'),
    ])

    setMilestones(msResult.data || [])
    setDeliverables(dvResult.data || [])
    setLoading(false)
  }

  // 마일스톤별 결과물 그룹핑
  function getDeliverablesByMilestone(milestoneId) {
    return deliverables.filter(d => d.milestone_id === milestoneId)
  }

  // 결과물별 Task 조회
  function getTasksByDeliverable(deliverableId) {
    return tasks.filter(t => t.deliverableId === deliverableId)
  }

  // 미연결 Task (deliverableId가 null인 프로젝트 Task)
  const unlinkedTasks = tasks.filter(t => !t.deliverableId && !t.done)

  // 미배정 결과물 수 (Task가 0인 결과물)
  const unassignedCount = deliverables.filter(d =>
    tasks.filter(t => t.deliverableId === d.id && !t.deletedAt).length === 0
  ).length

  return {
    milestones, deliverables, tasks,
    loading, unlinkedTasks, unassignedCount,
    getDeliverablesByMilestone, getTasksByDeliverable,
    reload: load,
  }
}
```

---

## 1. SimpleGanttMode.jsx (타임라인 모드)

전체 마일스톤을 간트로 보여주는 간결한 뷰.  
임원 보고, 전체 조망, 타부서 협의 시 사용.

```jsx
export default function SimpleGanttMode({ projectId }) {
  const { milestones, loading } = useParallelData(projectId)
  const columns = generateWeekColumns() // 현재 ±2개월

  if (loading) return <Skeleton />

  return (
    <div style={{ overflow: 'auto' }}>
      <table className="gantt-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', paddingLeft: 12, width: 210, /* sticky header styles */ }}>항목</th>
            {columns.map((col, i) => (
              <th key={i} style={{ /* col header styles, today highlight */ }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {milestones.map(ms => {
            const bar = calcMilestoneBar(ms, columns)
            const isUrgent = ms.end_date && daysUntil(ms.end_date) <= 7 && daysUntil(ms.end_date) >= 0

            return (
              <tr key={ms.id}>
                <td style={{ padding: '8px 12px', borderRight: '0.5px solid #e8e6df' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#b4b2a9', fontWeight: 600, minWidth: 20, fontSize: 11 }}>
                      {ms.sort_order + 1}
                    </span>
                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ms.title}
                    </span>
                    {isUrgent && (
                      <span style={{ fontSize: 9, background: '#FAEEDA', color: '#854F0B', padding: '0 5px', borderRadius: 2, fontWeight: 600 }}>
                        임박
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#b4b2a9', marginLeft: 'auto' }}>
                      {ms.end_date ? formatShortDate(ms.end_date) : ''}
                    </span>
                  </div>
                </td>
                <td colSpan={columns.length}>
                  <div style={{ position: 'relative', height: 38 }}>
                    {bar && (
                      <div style={{
                        position: 'absolute', height: 12, top: 13, borderRadius: 3, opacity: .85,
                        left: `${bar.left}%`, width: `${bar.width}%`,
                        background: ms.color || '#1D9E75',
                      }} />
                    )}
                    <TodayLine columns={columns} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

### 간트 바 계산

```javascript
function calcMilestoneBar(ms, columns) {
  if (!ms.start_date && !ms.end_date) return null
  const start = ms.start_date || ms.end_date
  const end = ms.end_date || ms.start_date

  const startIdx = columns.findIndex(c => isDateInWeek(start, c.weekStart))
  const endIdx = columns.findIndex(c => isDateInWeek(end, c.weekStart))

  if (startIdx < 0 && endIdx < 0) return null

  const s = Math.max(0, startIdx)
  const e = Math.min(columns.length - 1, endIdx < 0 ? columns.length - 1 : endIdx)

  return {
    left: (s / columns.length) * 100,
    width: (Math.max(1, e - s + 1) / columns.length) * 100,
  }
}
```

### 주 단위 컬럼 생성

```javascript
function generateWeekColumns() {
  // 현재 기준 -1개월 ~ +3개월
  const today = new Date()
  const start = new Date(today); start.setMonth(start.getMonth() - 1)
  const end = new Date(today); end.setMonth(end.getMonth() + 3)

  const columns = []
  let cursor = new Date(start)
  // 월요일로 정렬
  cursor.setDate(cursor.getDate() - cursor.getDay() + 1)

  while (cursor < end) {
    const weekStart = new Date(cursor)
    const isThisWeek = isDateInWeek(today, weekStart)
    const month = cursor.getMonth() + 1
    const weekOfMonth = Math.ceil(cursor.getDate() / 7)

    columns.push({
      weekStart,
      label: `${month}/${weekOfMonth}주`,
      isToday: isThisWeek,
    })
    cursor.setDate(cursor.getDate() + 7)
  }
  return columns
}
```

### 오늘 기준선

```jsx
function TodayLine({ columns }) {
  const todayIdx = columns.findIndex(c => c.isToday)
  if (todayIdx < 0) return null
  const left = ((todayIdx + 0.5) / columns.length) * 100

  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0,
      left: `${left}%`, width: 1.5,
      background: '#378ADD', zIndex: 1, opacity: .45,
    }} />
  )
}
```

---

## 2. DetailParallelMode.jsx (결과물+Task 모드)

마일스톤별 결과물 간트 + 연결 Task를 나란히 보여주는 커버리지 체크 뷰.

```jsx
export default function DetailParallelMode({ projectId }) {
  const {
    milestones, deliverables, loading,
    getDeliverablesByMilestone, getTasksByDeliverable,
  } = useParallelData(projectId)

  const columns = generateWeekColumns()

  if (loading) return <Skeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 3, background: '#fff', borderBottom: '0.5px solid #e8e6df' }}>
        <div style={{ width: 160, flexShrink: 0, padding: '7px 12px', fontSize: 10, color: '#a09f99', fontWeight: 600, letterSpacing: '.03em' }}>
          결과물
        </div>
        <div style={{ display: 'flex', flex: 1 }}>
          {columns.map((c, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, padding: '7px 0', color: c.isToday ? '#378ADD' : '#b4b2a9', fontWeight: 500, background: c.isToday ? 'rgba(55,138,221,.04)' : 'transparent' }}>
              {c.label}
            </div>
          ))}
        </div>
        <div style={{ width: '42%', flexShrink: 0, padding: '7px 12px', fontSize: 10, color: '#a09f99', fontWeight: 600, letterSpacing: '.03em', borderLeft: '0.5px solid #e8e6df' }}>
          연결된 Tasks
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {milestones.map(ms => {
          const msDeliverables = getDeliverablesByMilestone(ms.id)

          return (
            <div key={ms.id}>
              {/* 마일스톤 헤더 행 */}
              <div style={{ display: 'flex', background: '#fafaf8', borderBottom: '0.5px solid #e8e6df' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#6b6a66', flex: 1 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: ms.color || '#1D9E75' }} />
                  {ms.title}
                  {ms.end_date && (
                    <span style={{ fontSize: 10, color: '#b4b2a9', fontWeight: 400, marginLeft: 4 }}>
                      D{daysUntil(ms.end_date)}
                    </span>
                  )}
                </div>
                <div style={{ width: '42%', flexShrink: 0, borderLeft: '0.5px solid #e8e6df' }} />
              </div>

              {/* 결과물별 행 */}
              {msDeliverables.length > 0 ? msDeliverables.map(dv => {
                const dvTasks = getTasksByDeliverable(dv.id)
                const isEmpty = dvTasks.length === 0
                const bar = calcDeliverableBar(dv, ms, columns)

                return (
                  <div key={dv.id} style={{ display: 'flex', borderBottom: '0.5px solid #f0efe8', minHeight: Math.max(46, dvTasks.length * 27 + 14) }}>
                    {/* 좌: 결과물 이름 */}
                    <div style={{ width: 160, flexShrink: 0, padding: '7px 10px 7px 26px', borderRight: '0.5px solid #e8e6df', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dv.title}
                      </span>
                    </div>

                    {/* 중: 간트 바 */}
                    <div style={{ flex: 1, position: 'relative', minHeight: 38, borderRight: '0.5px solid #e8e6df' }}>
                      {bar && (
                        <div style={{
                          position: 'absolute', height: 12, top: 13, borderRadius: 3, opacity: .85,
                          left: `${bar.left}%`, width: `${bar.width}%`,
                          background: ms.color || '#1D9E75',
                        }} />
                      )}
                      <TodayLine columns={columns} />
                    </div>

                    {/* 우: 연결 Task */}
                    <div style={{
                      width: '42%', flexShrink: 0, padding: '5px 12px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
                      ...(isEmpty ? {
                        background: 'repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(186,117,23,.025) 10px, rgba(186,117,23,.025) 20px)'
                      } : {}),
                    }}>
                      {isEmpty ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#BA7517', fontWeight: 500 }}>
                          ⚠ 미배정
                          <button style={{ fontSize: 10, color: '#a09f99', background: 'none', border: '0.5px solid #d3d1c7', borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}>
                            + Task 추가
                          </button>
                        </div>
                      ) : dvTasks.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                          <CheckBox size={11} done={t.done} />
                          <span style={{ flex: 1 }}>{t.text}</span>
                          <AssigneePill size="small" assigneeId={t.assigneeId} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }) : (
                // 마일스톤에 결과물 없음
                <div style={{ display: 'flex', borderBottom: '0.5px solid #f0efe8', minHeight: 46 }}>
                  <div style={{ width: 160, flexShrink: 0, padding: '7px 26px', borderRight: '0.5px solid #e8e6df', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#b4b2a9', fontStyle: 'italic' }}>결과물 미정</span>
                  </div>
                  <div style={{ flex: 1, position: 'relative', minHeight: 38, borderRight: '0.5px solid #e8e6df' }}>
                    <TodayLine columns={columns} />
                  </div>
                  <div style={{ width: '42%', flexShrink: 0, padding: '5px 12px', display: 'flex', alignItems: 'center', background: 'repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(186,117,23,.025) 10px, rgba(186,117,23,.025) 20px)' }}>
                    <span style={{ fontSize: 11, color: '#BA7517', fontWeight: 500 }}>⚠ 미배정</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### 결과물 간트 바 계산

```javascript
// 결과물은 자체 날짜가 없으므로, 소속 마일스톤의 날짜를 상속
function calcDeliverableBar(deliverable, milestone, columns) {
  return calcMilestoneBar(milestone, columns)
}
```

> 결과물이 개별 날짜를 갖게 되면 독립 계산으로 확장 가능.

---

## 병렬 보기의 "수직 스크롤 동기화"

결과물+Task 모드에서 좌측(결과물+간트)과 우측(Task 목록)은 **같은 행**에 있으므로  
별도 스크롤 동기화가 필요 없다 — flexbox 행으로 자연스럽게 정렬됨.

전체 컨테이너만 수직 스크롤.

---

## 검증 체크리스트

### 타임라인 모드
- [ ] 전체 마일스톤 간트 바 표시 (start_date ~ end_date 범위)
- [ ] 날짜 없는 마일스톤은 바 미표시
- [ ] 오늘 기준선 위치 정확
- [ ] 임박(7일 이내) 배지 표시
- [ ] 마일스톤 정렬 순서 (sort_order)

### 결과물+Task 모드
- [ ] 마일스톤 헤더 행 표시 (컬러 닷 + D-day)
- [ ] 결과물별 행 — 간트 바 + 연결 Task 나란히
- [ ] Task가 없는 결과물 → "⚠ 미배정" + 스트라이프 배경
- [ ] 마일스톤에 결과물 없는 경우 → "결과물 미정" 행
- [ ] "+ Task 추가" 버튼 동작 (Task 생성 후 deliverable_id 연결)
- [ ] 두 모드 간 전환 시 스크롤/상태 유지

### ProjectHeader 미배정 배지
- [ ] 병렬 보기 탭에 "미배정 N" 배지 표시 (unassignedCount 반영)

### 회귀 검증
- [ ] Reference 탭 정상
- [ ] Tasks 탭 3모드 정상
- [ ] 기존 글로벌 뷰 전체 정상
- [ ] DetailPanel 정상
- [ ] `npm run build` 성공

---

## 주의사항

- **SimpleGanttMode는 ref_milestones만 사용** — 데이터가 적으면 빈 간트 표시
- **DetailParallelMode의 Task는 useStore에서 직접 읽음** — Supabase 추가 호출 없음
- **"+ Task 추가" 버튼**: 클릭 시 해당 결과물의 deliverable_id를 미리 설정한 상태로 Task 생성. 구현은 기존 `addTask()` + `{ deliverableId: dv.id }` 패치. addTask에 deliverableId 전달이 안 되면, 생성 후 즉시 updateTask로 deliverable_id 설정.
- **날짜 유틸 함수** (daysUntil, formatShortDate, isDateInWeek): 별도 utils 파일로 분리하거나 각 컴포넌트 내부에 작성. 기존 dateParser.js와 충돌하지 않도록 주의.
