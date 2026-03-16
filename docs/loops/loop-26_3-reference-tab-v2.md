# Loop-26.3 수정 — Reference 탭 3계층 2패널 레이아웃 적용

## 목표

현재 구현된 Reference 탭(마일스톤 좌 | 결과물 우 2단 구조)을  
**마일스톤 > 결과물 계층 좌 | Task 우** 2패널 구조로 변경한다.

목업 파일 `docs/loop-26-mockup-v10.html`을 브라우저에서 열고,  
Reference 탭의 레이아웃을 반드시 확인한 후 작업에 착수하라.

---

## 변경 요약

### Before (현재)
```
좌측: 마일스톤 목록          | 우측: 결과물 카드
● 소집통지 발송 완료         |  1 소집통지서 + 공고문
  2026.03.10 ~ 2026.03.20   |    법무 검토 완료본...
                             |    ✓ Task 2건
```

### After (v10)
```
좌측: 마일스톤 > 결과물 계층  | 우측: 연결 Task (인라인 CRUD)
● 소집통지 발송 완료          | □ 소집통지 메일 발송  [소집통지서] Ethan  ✕
  주주 1% 이상 이메일...      | □ 1% 이상 주주 연락  [소집통지서] Ethan  ✕
  2026.03.10 → 2026.03.20 D-5| ✓ 주주분류 확인  Ash  ✕
  1 소집통지서 + 공고문 [법무] | + Task 추가
  + 결과물 추가               |
```

---

## 핵심 변경 사항

### 1. 레이아웃 구조

좌측(50%)에 마일스톤이 있고, **마일스톤 아래 들여쓰기로 결과물이 1줄 항목으로** 나열된다.  
우측(50%)에 해당 마일스톤의 모든 Task가 표시된다.

```jsx
<div style={{ display: 'flex', borderBottom: '0.5px solid #eeedea', minHeight: 60 }}>
  {/* 좌측: 마일스톤 + 결과물 */}
  <div style={{ width: '50%', flexShrink: 0, padding: '14px 20px 12px', borderRight: '0.5px solid #eeedea' }}>
    {/* 마일스톤 헤더 */}
    {/* 결과물 1줄 항목들 (들여쓰기) */}
    {/* + 결과물 추가 */}
  </div>

  {/* 우측: Task 목록 (인라인 CRUD) */}
  <div style={{ flex: 1, padding: '10px 16px' }}>
    {/* Task 행들 */}
    {/* + Task 추가 */}
  </div>
</div>
```

### 2. 결과물이 1줄 항목으로 변경

기존 카드 형태(배경색 + 설명 + 태그 + Task 수)를 **제거**하고,  
단순 1줄 항목으로 변경한다:

```
1 소집통지서 + 공고문 [법무 검토] ✕
```

- 번호 + 이름 + (선택)태그 + hover 시 삭제 버튼
- **설명(description) 표시 제거**
- **Task 연결 수 표시 제거** (우측 패널에서 직접 보이므로 불필요)
- **좌측 컬러 보더 사용 금지** — border-left 색상 강조 절대 없음

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
  <span style={{ fontSize: 10, color: '#b4b2a9', fontWeight: 600, minWidth: 14 }}>1</span>
  <span style={{ fontSize: 12, color: '#2C2C2A', flex: 1 }}>소집통지서 + 공고문</span>
  {tag && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 500, background: tagBg, color: tagColor }}>{tag}</span>}
  <button className="del-btn">✕</button>
</div>
```

### 3. 날짜 표시 개선

기존 아이콘이 겹치는 날짜 입력을 **텍스트 배지** 형태로 변경:

```
2026.03.10 → 2026.03.20 D-5
```

- 시작일과 종료일이 클릭 가능한 배지 (`background: #f5f4f0`, hover 시 보더)
- 사이에 `→` 텍스트 구분자
- 우측에 D-day
- 임박(7일 이내)이면 배지와 D-day 모두 `background: #FAEEDA; color: #854F0B`

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 11, color: '#6b6a66' }}>
  <span style={{ padding: '2px 8px', borderRadius: 4, background: urgent ? '#FAEEDA' : '#f5f4f0', color: urgent ? '#854F0B' : '#6b6a66', cursor: 'pointer', border: '0.5px solid transparent' }}
    onClick={() => /* date picker open */}>
    {startDate}
  </span>
  <span style={{ color: '#c2c0b6', fontSize: 10 }}>→</span>
  <span style={{ /* 동일 스타일 */ }}>{endDate}</span>
  <span style={{ fontSize: 10, fontWeight: 500, color: urgent ? '#BA7517' : '#b4b2a9' }}>{dday}</span>
</div>
```

### 4. 우측 Task 패널 — 인라인 CRUD

우측에 해당 마일스톤의 모든 Task가 표시된다.  
Task는 두 가지 경로로 연결된다:

- **결과물에 연결된 Task**: `deliverable_id`가 있음 → 결과물명 태그 표시
- **마일스톤에만 연결된 Task**: `ref_milestone_id`가 있고 `deliverable_id`는 null → 태그 없음

각 Task 행:
```
□ [Task 이름 input] [결과물태그] [담당자Pill] ✕
```

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 4 }}>
  <div className="tk-cb" onClick={() => toggleDone(task.id)} />
  <input
    value={task.text}
    onChange={e => updateTask(task.id, { text: e.target.value })}
    onBlur={handleSave}
    style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', color: '#2C2C2A' }}
    placeholder="Task 이름 입력..."
  />
  {task.deliverableId && <span className="tk-dvtag">{deliverableName}</span>}
  <AssigneePill assigneeId={task.assigneeId} />
  <button className="del-btn">✕</button>
</div>
```

**"+ Task 추가" 클릭 시:**
1. 기존 store의 `addTask()` 호출
2. `projectId`, `ref_milestone_id`를 미리 설정
3. 새 Task의 input에 자동 포커스

### 5. 삭제 버튼 개선

모든 삭제 버튼(마일스톤, 결과물, Task) 동일 스타일:

```css
.del-btn {
  opacity: 0;
  transition: opacity 0.12s;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  border: none;
  font-size: 12px;
  color: #c2c0b6;
  flex-shrink: 0;
}
.del-btn:hover {
  background: #fce8e8;
  color: #c53030;
}
/* 부모 hover 시 표시 */
.parent-row:hover .del-btn {
  opacity: 1;
}
```

---

## DB 변경 필요

`tasks` 테이블에 `ref_milestone_id` 컬럼 추가:

```sql
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS ref_milestone_id uuid REFERENCES ref_milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_ref_milestone_id ON tasks(ref_milestone_id);
```

**useStore.js mapTask/taskToRow에도 추가:**
```javascript
// mapTask에 추가
refMilestoneId: r.ref_milestone_id || null,

// taskToRow에 추가
ref_milestone_id: t.refMilestoneId || null,
```

---

## 수정 대상 파일

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/components/project/ReferenceTab.jsx` | 2단→2패널 계층 레이아웃으로 전면 재작성 | L |
| `src/hooks/useStore.js` | mapTask/taskToRow에 `refMilestoneId` 매핑 추가 | S |
| 기타 Reference 관련 훅 | 기존 훅 유지, Task 조회 로직 추가 | S |

## 수정 금지

- 기존 뷰 컴포넌트 (TodayView, MatrixView 등)
- OutlinerEditor, OutlinerRow, useOutliner
- 기존 store 액션 (addTask, updateTask 시그니처 유지)

---

## 디자인 규칙

1. **좌측 컬러 보더 사용 금지** — border-left 색상 강조 절대 없음
2. 마일스톤 닷(●) 색상만으로 구분
3. 인라인 스타일 사용 (기존 앱 패턴)
4. 색상 체계는 목업 참조:
   - 텍스트: `#2C2C2A` (primary), `#6b6a66` (secondary), `#a09f99` (muted), `#b4b2a9` (light)
   - 배경: `#fff`, `#fafaf8`, `#f5f4f0`, `#f0efe8`
   - 보더: `#e8e6df`, `#eeedea`
   - 임박 경고: `#FAEEDA` bg, `#854F0B` text
   - 삭제 hover: `#fce8e8` bg, `#c53030` text

---

## 검증 체크리스트

- [ ] 좌측: 마일스톤 > 결과물 계층 구조 정상 표시
- [ ] 결과물이 1줄 항목 (카드 아님, 설명 없음)
- [ ] 우측: 마일스톤별 Task 목록 표시
- [ ] 결과물에 연결된 Task → 결과물명 태그 표시
- [ ] 마일스톤에만 연결된 Task → 태그 없음
- [ ] Task 이름 인라인 편집 (input) 정상
- [ ] + Task 추가 → 새 Task 생성 + 자동 포커스
- [ ] Task 삭제 (✕) 정상
- [ ] 마일스톤 삭제 (✕) 정상
- [ ] 결과물 삭제 (✕) 정상
- [ ] 날짜 표시: 텍스트 배지 형태, 아이콘 없음
- [ ] 임박 마일스톤: 노란 배지 + D-day 강조
- [ ] 좌측 컬러 보더 없음 확인
- [ ] 하단 접힌 섹션 (참조 문서 / 합의된 정책) 정상
- [ ] 프로젝트 전환 시 데이터 갱신
- [ ] Tasks 탭 전환 후 돌아와도 정상
- [ ] 기존 글로벌 뷰 정상 (회귀)
- [ ] `npm run build` 성공

---

## 주의사항

- 우측 Task CRUD는 기존 store의 `addTask`, `updateTask`, `deleteTask`, `toggleDone`을 **그대로 사용**. 글로벌 뷰와의 동기화가 자동으로 보장됨.
- `ref_milestone_id` 추가 시 DB SQL도 실행 필요 — Ryan에게 SQL 스크립트 전달.
- Task의 `ref_milestone_id`와 `deliverable_id` 모두 nullable. 둘 다 null이면 프로젝트에만 속한 기존 Task.
