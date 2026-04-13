# Phase 12d Spec v2 — 팀원 뷰 신규 + 정/부 담당자 시스템

> 작성일: 2026-04-13
> 상태: **확정**
> 선행: `12d-recon.md`, Phase 12a/12b/12c
> 변경 이력: v1 → v2 — 8가지 issue 권장안으로 해결 (DnD 비활성, B안 이중 출현 스타일 명세, cascade 정/부 대칭, 담당자 변경 동선, FK/아이콘/정렬/edge case 정밀화)

---

## 1. 목표

1. **팀원 뷰 (MembersView)** 신규 — 멤버 컬럼 칸반, 프로젝트별 task 그룹핑, 워크로드 비교 분석 뷰
2. **정/부 담당자 시스템** — tasks와 milestones에 secondary 컬럼 추가
3. **12c 팀 매트릭스 패치** — 스택 아바타로 정/부 표시

---

## 2. 확정 결정사항

### 사용자 1차 확정 (C1~C9)

| # | 항목 | 결정 |
|---|------|------|
| C1 | 정/부 의미론 | 데이터 비대칭(정 leader) + 실행 flat(동등) |
| C2 | 캡 | 2명 고정 |
| C3 | 적용 범위 | tasks + milestones |
| C4 | 카운팅 | 정만 메인, 부는 보조 (`+부 N`) |
| C5 | 12c task/MS 행 UI | A안 — 스택 아바타 |
| C6 | 12d 부담당 처리 | 별도 섹션 (dashed divider + 부담당 N) |
| C7 | DB 변경 | secondary_* 컬럼 추가 |
| C8 | 사이드바 | "팀" 섹션에 "팀원" 신설 |
| C9 | Phase 묶음 | 12d 단일 phase |

### Q1~Q7 결정 (recon 식별 항목)

| # | 항목 | v1 | v2 (확정) |
|---|------|-----|-----------|
| Q1 | B안 부담당 처리 | (b) 양쪽 출현 | **(b) 양쪽 출현 + 상세 스타일 명세** (4-7항) |
| Q2 | 컬럼 정렬 | (a) task 수 내림차순 | **(a) task 수 내림차순 + stable mount-time order** (4-3-c항) |
| Q3 | 빈 컬럼 | (a) 항상 표시 | **(a) 항상 표시 + 정0/부N edge case 명세** (4-3-d항) |
| Q4 | DnD | (b) 활성 | **(a) v1 비활성** ⚠️ 변경 |
| Q5 | 정 변경 시 부 | (a) 유지 | (a) 유지 |
| Q6 | swap 액션 | (b) 범위 외 | (b) 범위 외 |
| Q7 | cascade | (a) primary만 | **재정의 — 정/부 대칭 cascade** ⚠️ 변경 (4-2-c항) |

### v2 추가 결정 (Issue 1~8)

| # | 항목 | 결정 |
|---|------|------|
| **I1** | DnD 동작 | **v1 비활성** — 담당자 변경은 detail panel + popover dropdown 일원화. 분석/비교 뷰 역할 명확화. v2 별도 검토. |
| **I2** | B안 부담당 스타일 | opacity 0.55, mini badge `정 RyanName`, 좌측 회색 strip, 체크박스 read-only (klick 시 정 sub-section으로 점프), key suffix `-secondary` |
| **I3** | cascade 규칙 | **정/부 대칭** — MS 정 변경 → task 정 cascade, MS 부 변경 → task 부 cascade. 두 동작 독립. |
| **I4** | 담당자 변경 동선 | DualAssigneeSelector 단일 컴포넌트 + 두 모드 (`mode='full'` for DetailPanel, `mode='popover'` for 아바타 클릭). 12c/12d 모두 popover 우선. |
| **I5.1** | secondary_owner_id FK | `REFERENCES profiles(id)` 추가 (기존 owner_id와 일관). secondary_assignee_id는 FK 없음 유지 (기존 assignee_id와 일관). |
| **I5.2** | 사이드바 아이콘 | 코드 확인 후 기존 패턴 따름 (이모지/SVG 일관). 구현 시 결정. |
| **I5.3** | 컬럼 정렬 안정성 | mount-time 정렬 고정, task 추가/완료로 재정렬 안 함. 페이지 재진입 또는 수동 refresh 버튼으로만 재정렬. |
| **I5.4** | 정0/부N edge case | 카운트 표시 `0 +부 N`. 본문: 정담당 영역에 "정담당 task 없음" 안내 + 부담당 섹션. 정렬은 정 카운트만 사용 (부 무관). |

---

## 3. DB 마이그레이션

```sql
-- Phase 12d: 정/부 담당자 시스템

ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS secondary_assignee_id uuid DEFAULT NULL;

ALTER TABLE key_milestones 
  ADD COLUMN IF NOT EXISTS secondary_owner_id uuid DEFAULT NULL 
  REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_tasks_secondary_assignee 
  ON tasks(secondary_assignee_id) 
  WHERE secondary_assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ms_secondary_owner 
  ON key_milestones(secondary_owner_id) 
  WHERE secondary_owner_id IS NOT NULL;
```

**검증 사항:**
- `valid_scope` CHECK constraint 영향 없음 (secondary는 CHECK 미포함)
- RLS 신규 정책 불필요 (기존 row-level 정책이 커버)
- 기존 데이터 영향 없음 (모두 NULL 시작)
- `tasks.secondary_assignee_id`는 FK 없음 (기존 `assignee_id`와 일관 — CHECK constraint로만 관리)
- `key_milestones.secondary_owner_id`는 FK profiles(id) (기존 `owner_id`와 일관)

---

## 4. 기능 범위

### 4-1. Store 변경

**mapTask 추가:**
```js
secondaryAssigneeId: r.secondary_assignee_id || null,
```

**taskToRow 추가:**
```js
secondary_assignee_id: t.secondaryAssigneeId || null,
```

**milestones SELECT** — 기존이 와일드카드 또는 명시적 컬럼인지 확인 후:
- 와일드카드: 자동 로드 (action 불필요)
- 명시적: `secondary_owner_id` 컬럼 추가

**applyTransitionRules** — secondary 규칙 추가 안 함
- 정 변경만 scope 결정 (R1, R2 그대로)
- 부 변경은 scope 무관 (의도적 분리)

**collapseState 신규 키:**
```js
_defaultCollapseState: {
  ...,
  membersView: {},  // 컬럼별 프로젝트 그룹 접기 상태
}
```

### 4-2. cascadeMilestoneOwner 정/부 대칭화

**기존 (단일 owner):**
```js
cascadeMilestoneOwner(msId, newOwnerId)
```

**신규 시그니처:**
```js
cascadeMilestoneOwner(msId, newOwnerId, ownerType = 'primary')
// ownerType: 'primary' | 'secondary'
```

**동작:**
- `ownerType === 'primary'`:
  - MS의 `owner_id` 업데이트
  - MS 내 모든 task의 `assignee_id` 업데이트 (기존 동작)
  - task의 `secondary_assignee_id`는 그대로 유지 (Q5)
- `ownerType === 'secondary'`:
  - MS의 `secondary_owner_id` 업데이트
  - MS 내 모든 task의 `secondary_assignee_id` 업데이트
  - task의 `assignee_id`는 그대로 유지

**호출처:**
- DetailPanel MS 정 변경 → `cascadeMilestoneOwner(msId, newId, 'primary')`
- DetailPanel MS 부 변경 → `cascadeMilestoneOwner(msId, newId, 'secondary')`

**Edge case:**
- MS 정담당이 부담당과 동일한 사람으로 변경되려 할 때 → 부담당을 자동 NULL로 설정 (중복 방지)
- 마찬가지로 MS 부담당이 정담당과 동일한 사람으로 변경되려 할 때 → 변경 거부 + UI 경고

### 4-3. 팀원 뷰 (MembersView) 신규

#### 4-3-a. 레이아웃

- 멤버 = 컬럼 (240px 고정)
- 가로 스크롤 (TimelineGrid 패턴 재사용: `overflowX: auto`)
- 세로 스크롤 시 컬럼 헤더 sticky (`position: sticky, top: 0, zIndex: 3`)
- 컬럼 간 gap: 8px
- 컨테이너 padding: 1rem 0

#### 4-3-b. 컬럼 헤더

```
┌─ Ryan ──────────────────┐
│ ⓡ Ryan         12 +부 1 │← sticky
└─────────────────────────┘
```

- MiniAvatar (22px) + 멤버 이름 + 카운트
- 카운트 형식:
  - 부담당 0건: `12` (메인 카운트만)
  - 부담당 N건: `12 +부 N` (보조 카운트 작은 글씨)
- 부담당 카운트 색상: text-tertiary (시각 무게 ↓)
- 정 0건 + 부 N건 (edge case I5.4): `0 +부 N` 동일 형식

#### 4-3-c. 컬럼 정렬 (stable mount-time order)

**1차 정렬 시점:**
- 컴포넌트 mount 시 또는 사용자가 "정렬 새로고침" 버튼 클릭 시
- 정렬 기준: 멤버별 정담당 task 수 내림차순
- task 수가 같으면 멤버 ID 알파벳순 (안정성)
- 정렬 결과를 컴포넌트 state에 저장

**재정렬 안 하는 경우:**
- task 추가/완료/삭제
- 담당자 변경
- 컬럼 내부 스크롤
- → 회의 중 시선 위치 흐트러짐 방지

**재정렬 하는 경우:**
- 페이지 재진입 (멤버 뷰 다시 진입)
- 수동 "정렬 새로고침" 버튼 (헤더에 작은 ↻ 아이콘)
- 멤버 추가/제거

**구현:**
```js
const [sortedMemberIds, setSortedMemberIds] = useState(null);

useEffect(() => {
  if (sortedMemberIds === null) {
    const sorted = [...members]
      .map(m => ({ id: m.userId, count: countPrimary(m.userId) }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
      .map(x => x.id);
    setSortedMemberIds(sorted);
  }
}, [members, sortedMemberIds]);
```

#### 4-3-d. 컬럼 본문

**프로젝트별 그룹 (정담당 영역):**
```
┌─ Ryan ──────────────────┐
│ ⓡ Ryan         12 +부 1 │
├─────────────────────────┤
│ ● ABI 코리아         3   │← 프로젝트 헤더
│   □ task 1              │
│   □ task 2              │
│   □ task 3              │
│ ● 26Q1 정기이사회    4   │
│   □ task 4              │
│   ...                   │
│ ┈┈┈ 부담당 (1) ┈┈┈┈┈┈ │← dashed divider
│ ● ABI 코리아         1   │
│   ▏□ task X    정 Edmond│← muted 스타일
└─────────────────────────┘
```

**프로젝트 헤더:**
- 프로젝트 dot (6px) + 이름 + 카운트
- task 수 0건 프로젝트는 그룹 표시 안 함

**task 행:**
- checkbox + 텍스트 (1줄 ellipsis 또는 wrap, 밀도 모드에 따라)
- click → DetailPanel 진입
- 우측 detail 아이콘 (hover 시 표시)
- 아바타 배지는 표시 안 함 (컬럼 자체가 담당자라 중복)

**부담당 섹션:**
- dashed divider (`border-top: 1px dashed var(--color-border-tertiary)`)
- 헤더 텍스트: `부담당 (N)` (font 11px, text-tertiary)
- 정담당 0건이어도 부담당 N건이면 섹션 표시
- 부담당 task: muted 스타일 (4-3-e)

**Edge case — 정 0건 + 부 N건:**
- 카운트 헤더: `0 +부 N`
- 정담당 영역: "정담당 task 없음" 안내 텍스트 (font 11px, text-tertiary, 가운데, padding 16px)
- 부담당 섹션: 정상 표시
- 컬럼 정렬에서는 task 수 = 0으로 처리 (정렬 우선순위 낮음)

**Edge case — 정 0건 + 부 0건 (정말 빈 컬럼):**
- 카운트 헤더: `0`
- 본문: "할 일 없음" 안내 텍스트
- 항상 표시 (Q3)

#### 4-3-e. 부담당 task 행 스타일

- opacity: 0.55
- 좌측 색 strip 없음 (가로 공간 절약)
- mini badge: `정 Ryan` (작은 "정" 라벨 + 정담당자 이름, font 10px, padding 1px 6px, background `rgba(0,0,0,0.05)`)
- text 색: text-tertiary
- click → DetailPanel 진입 (정상)
- checkbox는 read-only (클릭 시 정담당 컬럼의 동일 task 위치로 점프 + 시각적 강조)

#### 4-3-f. 밀도 토글

- 위치: 컴포넌트 헤더 (제목 우측)
- 옵션: `편안 / 컴팩트` Pill 토글
- localStorage key: `membersViewDensity`
- 편안 모드:
  - task 행 padding: 6px 12px 6px 22px
  - font: 12px
  - line-height: 1.4
- 컴팩트 모드:
  - task 행 padding: 3px 12px 3px 22px
  - font: 11px
  - line-height: 1.3
  - task 텍스트 1줄 ellipsis

#### 4-3-g. 정렬 새로고침 버튼

- 위치: 컴포넌트 헤더 우측
- 작은 ↻ 아이콘 버튼 (16px)
- 클릭 → `setSortedMemberIds(null)` → useEffect 재실행
- tooltip: "멤버 정렬 새로고침"
- task 추가/완료가 누적되어 정렬이 stale해진 것 같을 때 사용자가 명시적으로 호출

#### 4-3-h. DnD

**v1 비활성** (Issue 1)
- DndContext 미렌더 또는 sensors 빈 배열
- 담당자 변경은 task 클릭 → DetailPanel 또는 우측 detail 아이콘 클릭 → DetailPanel
- 12d는 분석/비교 뷰 역할로 명확화
- v2에서 별도 검토 가능

#### 4-3-i. 클릭 동작

- task 행 클릭 → DetailPanel 진입
- task 체크박스 클릭 → done toggle (정담당 task만, 부담당 task는 read-only)
- 프로젝트 헤더 클릭 → 해당 프로젝트 그룹 접기/펼치기 (`collapseState.membersView[memberId][projectId]`)

### 4-4. 12c 팀 매트릭스 패치 (C5)

#### 4-4-a. task 행 스택 아바타

기존 12c task 행:
```jsx
<TaskAssigneeChip taskId={t.id} assigneeId={t.assigneeId} ... />
```

신규:
```jsx
{t.secondaryAssigneeId ? (
  <StackedAvatar
    primary={getMember(t.assigneeId)}
    secondary={getMember(t.secondaryAssigneeId)}
    onClick={() => openPopover(t.id)}
  />
) : (
  <TaskAssigneeChip ... />  // 단일 owner 기존 그대로
)}
```

- 단일 owner: 기존 TaskAssigneeChip 그대로 (변경 없음)
- 정+부 owner: StackedAvatar 사용
- 클릭 시 DualAssigneeSelector popover 호출

#### 4-4-b. MS 행 스택 아바타

MilestoneRow에 owner 표시 추가:
- 기존: owner 표시 없음
- 신규: alive/total pill 우측에 StackedAvatar (있을 때만)
- 단일 owner: MiniAvatar 단독
- 정+부 owner: StackedAvatar
- 클릭 → DetailPanel MS 모드

#### 4-4-c. Lane 헤더 참여자 칩 카운트 규칙

- **정담당 기준**으로만 카운트 (C4)
- 부담당은 칩 카운트에 포함 안 함
- 부담당 별도 표시 없음 (Lane 헤더는 단순화 유지)
- 미배정 칩: 정담당이 NULL인 task

#### 4-4-d. B안 부담당 이중 출현 (Q1 + I2)

12c B안 (담당자별 그룹 토글)에서 부담당 task 처리:

**출현 위치:**
- 정담당 sub-section: 해당 task가 정상 출현
- 부담당자 sub-section: 동일 task가 muted 스타일로 출현

**부쪽 sub-section의 task 행 스타일:**
- opacity: 0.55
- mini badge: `정 RyanName` (font 10px, padding 1px 6px, background `rgba(0,0,0,0.05)`)
- text 색: text-tertiary
- 좌측에 옅은 회색 strip (`box-shadow: inset 2px 0 0 var(--color-border-tertiary)`)
- React key: `${taskId}-secondary` suffix (key 충돌 방지)

**checkbox 동작:**
- read-only — 클릭해도 done toggle 안 됨
- 클릭 시 정담당 sub-section의 동일 task로 스크롤 + 강조 (1초 background flash)
- 시각적 신호: cursor `not-allowed`, hover 시 tooltip "정담당자 영역에서 변경"

**click 동작:**
- task 본문 click → DetailPanel 정상 진입
- DetailPanel은 동일 task이므로 어디서 들어가든 같은 데이터 편집

**sub-section 헤더 카운트:**
- 형식: `Edmond 4 +부 1` (정 4 + 부 1)
- 정 0건이지만 부 N건인 경우: `Edmond 0 +부 N`
- 정렬: 정 카운트 기준 내림차순 (부는 영향 없음)

**미배정 sub-section:**
- 부담당 task는 미배정 sub-section에 절대 출현하지 않음
- 미배정은 "정담당 NULL" 의미만

### 4-5. DualAssigneeSelector 신규 컴포넌트

#### 4-5-a. Props

```js
{
  // 데이터
  taskId?: string,        // task 변경 시
  msId?: string,          // milestone 변경 시
  primaryId: string|null,
  secondaryId: string|null,
  members: Member[],

  // 모드
  mode: 'full' | 'popover',  // full=DetailPanel 안, popover=아바타 클릭

  // 콜백
  onChangePrimary: (newId: string|null) => void,
  onChangeSecondary: (newId: string|null) => void,

  // popover 전용
  anchorEl?: HTMLElement,
  onClose?: () => void,
}
```

#### 4-5-b. UI — `mode='full'`

DetailPanel 안에 인라인 표시:

```
정담당자
  [⬤ Ryan ▾]    (dropdown)

부담당자 (선택)
  [⬤ Edmond ▾] [×]   (dropdown + 제거 버튼)
  또는
  [+ 부담당자 추가]   (없을 때)
```

- 정담당과 부담당 각각 별도 dropdown
- 부담당이 NULL일 때: "+ 부담당자 추가" 버튼
- 부담당이 있을 때: dropdown + 제거(×) 버튼
- 정담당과 부담당이 같은 사람으로 설정되려 하면: 변경 거부 + 경고 toast

#### 4-5-c. UI — `mode='popover'`

스택 아바타 클릭 시 popover 형태:

```
┌─────────────────────┐
│ 정담당              │
│  ◉ Ryan             │
│  ○ Edmond           │
│  ○ eric.kim         │
│  ○ ash.kim          │
│  ○ 미배정           │
├─────────────────────┤
│ 부담당              │
│  ○ (없음)           │
│  ○ Ryan             │
│  ◉ Edmond           │
│  ○ eric.kim         │
│  ○ ash.kim          │
└─────────────────────┘
```

- 두 섹션 (정 / 부) 분리
- radio 형식 (단일 선택)
- "미배정" 옵션 (정담당)
- "(없음)" 옵션 (부담당)
- 부담당 섹션에는 정담당으로 선택된 멤버는 표시 안 함 (또는 disabled)
- 외부 클릭 → 닫힘

#### 4-5-d. 호출 위치

| 위치 | 모드 | 호출 방식 |
|------|------|-----------|
| DetailPanel task 정/부 | full | 항상 표시 |
| DetailPanel MS 정/부 | full | 항상 표시 |
| 12c task 행 스택 아바타 | popover | 아바타 클릭 |
| 12c MS 행 스택 아바타 | popover | 아바타 클릭 |
| 12d task 행 | popover | 사용 안 함 (DetailPanel만) |
| 12d 컬럼 헤더 멤버 클릭 | 사용 안 함 | (filter 기능 없음) |

### 4-6. StackedAvatar 신규 컴포넌트

#### 4-6-a. Props

```js
{
  primary: { name: string, color: string, userId: string },
  secondary: { name: string, color: string, userId: string } | null,
  size?: number,  // default 16
  showLabel?: boolean,  // default true (정 이름 표시)
  onClick?: () => void,
}
```

#### 4-6-b. UI

```
[⬤⬤ Ryan]   ← primary 앞, secondary 뒤 (marginLeft: -size*0.35)
```

- secondary가 null: 단순 MiniAvatar (변경 없음)
- secondary가 있음:
  - primary 아바타 (앞)
  - secondary 아바타 (뒤, marginLeft: -size*0.35로 겹침)
  - secondary 아바타에 흰 border (1.5px, var(--color-background-primary))
  - 라벨: 정 이름만 표시 (showLabel=true 기본)
- 전체 wrapper: cursor pointer, hover 시 약간 강조
- 클릭: onClick 호출 (popover 트리거)

#### 4-6-c. 사용처

| 위치 | 표시 |
|------|------|
| 12c task 행 우측 | 항상 표시 (단일 또는 정+부) |
| 12c MS 행 (alive/total 우측) | owner가 있을 때만 |
| 12c B안 sub-section 헤더 | 멤버 본인 단일 (변경 없음) |
| 12d 컬럼 헤더 | 단일 (멤버 본인) |
| DetailPanel | 사용 안 함 (DualAssigneeSelector full 모드 사용) |

### 4-7. Sidebar + 라우팅

- `TASK_VIEWS` 배열에 항목 추가:
  ```js
  { key: 'team-members', label: '팀원', icon: <기존 패턴 따름> }
  ```
- 사이드바 "팀" 섹션 안에 배치
- `App.jsx` views 객체에 등록:
  ```js
  'team-members': () => <MembersView />
  ```
- `setView('team-members')` 호출 → 라우팅
- 아이콘은 Sidebar.jsx 코드 확인 후 기존 패턴 (이모지 vs SVG) 따름 (I5.2)

---

## 5. 영향 파일

### 신규
| 파일 | 역할 |
|------|------|
| `supabase/migrations/20260413_secondary_assignee.sql` | DB 마이그레이션 |
| `src/components/views/MembersView.jsx` | 팀원 뷰 본체 |
| `src/components/shared/StackedAvatar.jsx` | 정/부 겹침 아바타 |
| `src/components/shared/DualAssigneeSelector.jsx` | 정/부 dual 선택 (full + popover 모드) |

### 수정
| 파일 | 변경 |
|------|------|
| `useStore.js` | mapTask/taskToRow secondary 매핑, milestones SELECT 확인, collapseState `membersView`, `cascadeMilestoneOwner` ownerType 파라미터 |
| `TeamMatrixGrid.jsx` (12c) | task 행 StackedAvatar 패치, MS 행 StackedAvatar, B안 부담당 이중 출현 + muted 스타일 |
| `MilestoneRow.jsx` | secondary_owner badge 추가 (StackedAvatar 사용) |
| `Sidebar.jsx` | TASK_VIEWS에 "팀원" 추가 |
| `App.jsx` | views 객체에 MembersView 등록 |
| `DetailPanel.jsx` | AssigneeSelector → DualAssigneeSelector (full 모드) |

---

## 6. 구현 순서 (R-ATOMIC)

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `feat(db): add secondary_assignee_id + secondary_owner_id (12d-1)` | DB 마이그레이션 + 인덱스 + secondary_owner_id FK |
| 2 | `feat(store): add secondary fields + cascade dual (12d-2)` | mapTask/taskToRow secondary, milestones SELECT, collapseState membersView, cascadeMilestoneOwner ownerType 파라미터 |
| 3 | `feat(shared): add StackedAvatar component (12d-3)` | 정/부 겹침 아바타 |
| 4 | `feat(shared): add DualAssigneeSelector with full + popover modes (12d-4)` | 정/부 dual 선택 (두 모드) |
| 5 | `feat(team-matrix): patch task/MS rows with stacked avatar + popover (12d-5)` | 12c 패치 (task 행 + MS 행) |
| 6 | `feat(team-matrix): B안 부담당 이중 출현 with muted styling (12d-6)` | B안 토글 시 부담당 sub-section |
| 7 | `feat(views): add MembersView with stable mount-time sort (12d-7)` | 팀원 뷰 본체 (DnD 없음) |
| 8 | `feat(sidebar): add 팀원 menu + App.jsx view registration (12d-8)` | 라우팅 |
| 9 | `feat(detail): replace AssigneeSelector with DualAssigneeSelector (12d-9)` | DetailPanel 정/부 통합 |

각 커밋:
- REQ-LOCK protocol
- DELETE-5 cascade 검증 (특히 4, 5, 9 — 기존 컴포넌트 교체)
- npm run build 통과

---

## 7. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| R1 | CHECK constraint 영향 | 안전 — secondary는 CHECK 미포함 |
| R2 | RLS 영향 | 안전 — row-level 정책 |
| R3 | applyTransitionRules secondary 처리 | 안 넣음 (의도적) |
| R4 | B안 이중 출현 React key 충돌 | `${taskId}-secondary` suffix |
| R5 | 12d DnD 가로 스크롤 충돌 | DnD 비활성으로 회피 (I1) |
| R6 | cascade 정/부 독립성 보장 | ownerType 파라미터로 명시적 분기 |
| R7 | 정 변경 시 부 유지 | applyTransitionRules에서 secondary 건드리지 않음 |
| R8 | 정==부 동일인 설정 시도 | DualAssigneeSelector에서 변경 거부 + 경고 |
| R9 | mount-time 정렬이 stale | 수동 새로고침 버튼 제공 |
| R10 | DetailPanel 다른 사용처 영향 | AssigneeSelector → DualAssigneeSelector 교체 시 grep으로 모든 호출 확인 |
| R11 | secondary_owner_id FK 위반 (deleted profile) | profiles 삭제 시 cascade 정책 검토 (기본 RESTRICT) |
| R12 | 12c B안 부담당 출현으로 sub-section 카운트 혼란 | 카운트 형식 `정 N +부 M`로 명시 |

---

## 8. QA 체크리스트

### DB
- [ ] `secondary_assignee_id` 컬럼 생성 (tasks)
- [ ] `secondary_owner_id` 컬럼 생성 (key_milestones, FK profiles)
- [ ] 인덱스 2개 생성
- [ ] 기존 CHECK constraint 영향 없음
- [ ] 기존 RLS 정책 영향 없음

### Store
- [ ] mapTask에 secondaryAssigneeId 매핑
- [ ] taskToRow에 secondary_assignee_id 변환
- [ ] milestones에 secondary_owner_id 로드
- [ ] collapseState `membersView: {}` 추가
- [ ] 스냅샷 save/restore에 membersView 포함

### cascade
- [ ] `cascadeMilestoneOwner(msId, newId, 'primary')` — task assignee_id만 cascade
- [ ] `cascadeMilestoneOwner(msId, newId, 'secondary')` — task secondary_assignee_id만 cascade
- [ ] 정 변경 시 부 유지 (Q5)
- [ ] 부 변경 시 정 유지
- [ ] MS 정==부 설정 거부

### StackedAvatar
- [ ] secondary null → 단일 MiniAvatar
- [ ] secondary 있음 → 겹침 표시 (앞=정)
- [ ] 흰 border로 시각 구분
- [ ] 클릭 시 onClick 호출

### DualAssigneeSelector
- [ ] full 모드 — DetailPanel 인라인
- [ ] popover 모드 — 아바타 클릭 시 표시
- [ ] 정/부 두 섹션 분리
- [ ] 부담당 섹션에 정담당 멤버 disabled
- [ ] "미배정" / "(없음)" 옵션
- [ ] 정==부 시도 시 경고
- [ ] 부담당 제거 동작

### 12c 팀 매트릭스 패치
- [ ] task 행: 단일 owner → 기존 그대로
- [ ] task 행: 정+부 owner → StackedAvatar
- [ ] MS 행: owner 있으면 StackedAvatar 표시
- [ ] task/MS 아바타 클릭 → DualAssigneeSelector popover
- [ ] Lane 헤더 참여자 칩: 정담당만 카운트
- [ ] B안 토글: 정/부 양쪽 sub-section 출현
- [ ] B안 부담당 task: opacity 0.55, mini badge `정 RyanName`
- [ ] B안 부담당 task: 좌측 회색 strip
- [ ] B안 부담당 checkbox: read-only, 클릭 시 정 sub-section 점프 + flash
- [ ] B안 sub-section 헤더 카운트: `Edmond 4 +부 1`
- [ ] React key 충돌 없음 (`-secondary` suffix)

### 팀원 뷰 (MembersView)
- [ ] 멤버 컬럼 240px 고정
- [ ] 가로 스크롤 (TimelineGrid 패턴)
- [ ] 컬럼 헤더 sticky
- [ ] 컬럼 정렬: mount-time stable order
- [ ] 정렬 새로고침 ↻ 버튼
- [ ] task 추가/완료 시 재정렬 안 됨
- [ ] 컬럼 헤더 카운트: `12 +부 1` 형식
- [ ] 정 0 + 부 N edge case: `0 +부 N` + "정담당 task 없음" 안내
- [ ] 정 0 + 부 0 edge case: `0` + "할 일 없음" 안내
- [ ] 빈 컬럼 항상 표시 (Q3)
- [ ] 프로젝트별 그룹 (dot + 이름 + 카운트)
- [ ] 프로젝트 그룹 접기/펼치기 (`collapseState.membersView`)
- [ ] 부담당 섹션: dashed divider + "부담당 (N)"
- [ ] 부담당 task: muted (opacity 0.55) + mini badge
- [ ] 부담당 checkbox: read-only, 클릭 시 정담당 컬럼 점프
- [ ] task click → DetailPanel
- [ ] DnD 비활성 (DndContext 미렌더)
- [ ] 밀도 토글 (편안/컴팩트), localStorage `membersViewDensity`

### Sidebar + 라우팅
- [ ] "팀원" 메뉴 항목 표시 ("팀" 섹션 안)
- [ ] 클릭 → MembersView 전환
- [ ] 아이콘 — 기존 패턴 따름 (구현 시 결정)

### DetailPanel
- [ ] task 정/부 변경 — DualAssigneeSelector full 모드
- [ ] MS 정/부 변경 — DualAssigneeSelector full 모드
- [ ] 부담당 추가/제거 동작
- [ ] cascade 트리거 (MS 정/부 변경 시)

### 회귀
- [ ] 12a 매트릭스 today/next/later 정상
- [ ] 12b 프로젝트 순서 DnD 정상
- [ ] 12c 팀 매트릭스 기본 동작 정상
- [ ] 단일 owner task 표시 정상 (StackedAvatar 단일 모드)
- [ ] 기존 AssigneeSelector 사용처 모두 DualAssigneeSelector로 교체 확인 (grep)
- [ ] `npm run build` 통과
- [ ] 스냅샷 save/restore 정상

---

## 9. v1 → v2 변경 요약

**Issue 1 (DnD)** — 활성 → **비활성**. 12d는 분석/비교 뷰. 담당자 변경은 detail panel + popover로 일원화. 컬럼 간 우발적 drag 위험 제거.

**Issue 2 (B안 스타일)** — 추상 → **정밀 명세**. opacity 0.55, mini badge `정 RyanName`, 좌측 strip, checkbox read-only, sub-section 카운트 `정 N +부 M`, key suffix `-secondary`, 점프 + flash 동작 정의.

**Issue 3 (cascade)** — 정만 cascade → **정/부 대칭 cascade**. `cascadeMilestoneOwner` 시그니처에 `ownerType` 파라미터 추가. MS 정 변경 → task 정 cascade, MS 부 변경 → task 부 cascade. 두 동작 독립.

**Issue 4 (담당자 변경 동선)** — 모호 → **DualAssigneeSelector 단일 컴포넌트 두 모드**. `mode='full'` (DetailPanel) + `mode='popover'` (아바타 클릭). 12c와 12d 일관 패턴.

**Issue 5.1 (FK)** — 누락 → **secondary_owner_id에 FK profiles(id) 추가**. owner_id와 일관. tasks.secondary_assignee_id는 FK 없음 유지 (assignee_id와 일관).

**Issue 5.2 (사이드바 아이콘)** — 이모지 → **기존 패턴 따름**. 구현 시 코드 확인.

**Issue 5.3 (정렬 안정성)** — 즉시 재정렬 → **mount-time stable order**. task 추가/완료 시 재정렬 안 함. 수동 새로고침 ↻ 버튼 제공.

**Issue 5.4 (정 0 + 부 N edge case)** — 미정 → **edge case 명세**. 카운트 `0 +부 N`, 본문 "정담당 task 없음" 안내, 정렬 우선순위는 정 카운트 0으로.

**커밋 시퀀스** — 7개 → **9개**. B안 부담당 이중 출현을 별도 커밋(6번)으로 분리, DualAssigneeSelector 두 모드를 한 커밋(4번)으로 통합, MembersView를 stable sort 포함하여 커밋 7번에 정리.
