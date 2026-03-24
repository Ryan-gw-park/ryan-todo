# Loop-39.1: Sidebar 3-Section Restructure + Routing

> **Prereq**: Loop-38 complete, Agent docs updated
> **Ref mockup**: `docs/mockups/sidebar-restructure-mockup.jsx`
> **Agent review required**

---

## Goal

Restructure sidebar from 2 sections (글로벌뷰 / 프로젝트) to 3 sections (글로벌 / 할일 / 프로젝트).
Add scope-based routing. Rename "오늘 할일" → "지금 할일".

**This sub-loop changes ONLY sidebar + routing. Views themselves remain unchanged — they will receive scope prop but ignore it until 39.2+.**

---

## Diagnostic

```bash
# Current sidebar structure
cat src/components/layout/Sidebar.jsx | head -60
wc -l src/components/layout/Sidebar.jsx

# Current view routing (App.jsx or useStore viewId)
grep -rn "viewId\|activeView\|VIEW_ORDER" src/ --include="*.jsx" --include="*.js" | head -15

# Current BottomNav
cat src/components/layout/BottomNav.jsx | head -30

# Current [전체|팀|개인] toggle location
grep -rn "전체.*팀.*개인\|scopeFilter\|viewScope" src/ --include="*.jsx" | head -10
```

## Implementation

### Step 1: Sidebar.jsx — 3-section layout

```
글로벌 뷰 (section header)
  📋 지금 할일           ← renamed from 오늘 할일
  📄 전체 할일
  📝 노트

할일 (section header)
  ▾ 팀 (collapsible sub-section)
    ⊞ 매트릭스            → viewId="team-matrix"
    📅 타임라인            → viewId="team-timeline"
    🗓 주간 플래너         → viewId="team-weekly"
  ▾ 개인 (collapsible sub-section)
    ⊞ 매트릭스            → viewId="personal-matrix"
    📅 타임라인            → viewId="personal-timeline"
    🗓 주간 플래너         → viewId="personal-weekly"

프로젝트 (section header)
  ▾ 팀 프로젝트           + (add button)
    ● 정기주총             → viewId="project-{id}"
    ● ABI 코리아
    ● ...
  ▾ 개인 프로젝트          + (add button)
    ● 개별과제
    ● C&
```

Sub-sections (팀/개인) are collapsible with ▸▾ toggle. Default: expanded.
Collapse state stored in localStorage or useStore.

### Step 2: ViewId mapping + scope derivation

```js
// In useStore or App.jsx
const viewId = "team-matrix"; // from sidebar click

// Derive scope from viewId
const scope = viewId.startsWith("team-") ? "team"
            : viewId.startsWith("personal-") ? "personal"
            : null; // global views have no scope

// Derive base view from viewId
const baseView = viewId.replace("team-","").replace("personal-","");
// "matrix", "timeline", "weekly"
```

### Step 3: Legacy viewId redirect

```js
// Old IDs → new IDs
const LEGACY_MAP = {
  "matrix": "team-matrix",
  "timeline": "team-timeline",
  "weekly": "team-weekly",
  "today": "now",
};
if (LEGACY_MAP[viewId]) setViewId(LEGACY_MAP[viewId]);
```

### Step 4: VIEW_ORDER for keyboard shortcuts

```js
const VIEW_ORDER = [
  "now", "allTasks",
  "team-matrix", "team-timeline", "team-weekly",
  "personal-matrix", "personal-timeline", "personal-weekly",
  "notes"
];
```

### Step 5: BottomNav mobile adaptation

```
Mobile bottom nav (4 items max):
  지금 할일 | 전체 할일 | 팀 매트릭스 | 노트
```

### Step 6: Pass scope prop to views (but views ignore it for now)

```jsx
// In App.jsx view rendering
{baseView === "matrix" && <MatrixView scope={scope} />}
{baseView === "timeline" && <TimelineView scope={scope} />}
{baseView === "weekly" && <WeeklyPlannerView scope={scope} />}
```

Views receive scope but continue rendering as before until 39.2+.

---

## Pre-Commit Checklist

- [ ] Sidebar shows 3 sections: 글로벌 뷰 / 할일 / 프로젝트
  `grep -rn "글로벌 뷰\|할일\|프로젝트" src/components/layout/Sidebar.jsx`
- [ ] "지금 할일" label exists (not "오늘 할일")
  `grep -rn "지금 할일" src/components/layout/Sidebar.jsx`
- [ ] 할일 section has 팀/개인 sub-sections with ▸▾ toggle
- [ ] Team sub-section has 매트릭스/타임라인/주간플래너
- [ ] Personal sub-section has 매트릭스/타임라인/주간플래너
- [ ] Clicking "팀 > 매트릭스" sets viewId="team-matrix"
- [ ] Clicking "개인 > 매트릭스" sets viewId="personal-matrix"
- [ ] Legacy viewId "matrix" redirects to "team-matrix"
- [ ] VIEW_ORDER updated for keyboard shortcuts
- [ ] BottomNav updated for mobile
- [ ] All existing views still render correctly (scope prop ignored)
- [ ] `npm run build` succeeds

## Constraints
- Do NOT modify view component internals — only routing and sidebar
- No CSS variables — inline styles
- git push origin main

---
---

# Loop-39.2: Team Matrix — Restore Task Tab + Scope Filter

> **Prereq**: Loop-39.1 complete (sidebar + routing)
> **Ref mockup**: `docs/mockups/team-views-mockup.jsx` — 매트릭스 section
> **Agent review required**

---

## Goal

1. Restore [할일] tab in team matrix (was removed in Loop-38)
2. Restructure matrix tabs: [할일] [마일스톤] [담당자별]
3. Apply scope="team" filter — show only team projects, all team members
4. Remove [전체|팀|개인] toggle from matrix header
5. Fix "더보기" — collapsed MS lists must be expandable on click

---

## Diagnostic

```bash
# Current matrix header/mode toggle
grep -rn "할일 모드\|마일스톤 모드\|전체.*팀.*개인\|scopeFilter" src/components/matrix/ --include="*.jsx" | head -10

# Old task grid code (should still be in files, just unused)
grep -rn "TaskMatrixGrid\|MatrixTaskCell\|handleDragEnd" src/components/matrix/ --include="*.jsx" -l

# CompactMsRow from Loop-38
grep -rn "CompactMsRow" src/components/ --include="*.jsx" -l

# "더보기" or "외 N개" text
grep -rn "외.*개\|더보기\|showAll\|collapsed" src/components/matrix/ --include="*.jsx" | head -10
```

## Implementation

### Step 1: Matrix header tabs

```jsx
// Remove [전체|팀|개인] toggle
// Replace with:
const [matrixTab, setMatrixTab] = useState("할일"); // "할일" | "마일스톤" | "담당자별"

// Header:
<Pill items={["할일","마일스톤","담당자별"]} active={matrixTab} onChange={setMatrixTab} />

// Depth toggle appears only when matrixTab === "마일스톤"
{matrixTab === "마일스톤" && <DepthToggle ... />}
```

### Step 2: Task tab — restore team matrix grid

Rows = team members (avatar + name + task count).
Cols = team projects (dot + name).
Cell = tasks for (member, project). Each cell has:
- Task rows with checkbox + text + category badge
- `+ 추가` at bottom of each cell

If old MatrixView task grid code is preserved in files, re-import and connect.
If deleted, rebuild per mockup.

Key: scope="team" means filter `projects.filter(p => p.teamId)`.

### Step 3: MS tab + 담당자별 tab — apply scope filter

Loop-38 MS grid and member portfolio already exist.
Add scope filter: only show team projects' milestones.

### Step 4: Fix "더보기" expandable

The "...외 N개" text in project/member sub-views must be clickable:
```jsx
const [showAll, setShowAll] = useState(false);
{!showAll && items.length > 5 && (
  <span onClick={() => setShowAll(true)} style={{cursor:"pointer"}}>
    ...외 {items.length - 5}개
  </span>
)}
{showAll ? items.map(...) : items.slice(0,5).map(...)}
```

### Step 5: + 추가 in every cell

Every member × project cell in task tab MUST have `+ 추가`.
Every member portfolio card in 담당자별 tab MUST have `+ 추가`.

---

## Pre-Commit Checklist

- [ ] [할일][마일스톤][담당자별] 3 tabs exist in matrix header
  `grep -rn "할일.*마일스톤.*담당자별" src/components/matrix/ --include="*.jsx"`
- [ ] [전체|팀|개인] toggle is REMOVED
  `grep -rn "전체.*팀.*개인" src/components/matrix/ --include="*.jsx"` → should NOT match
- [ ] Task tab renders member × project grid with task cards
- [ ] Each cell in task tab has `+ 추가`
  `grep -rn "+ 추가" src/components/matrix/ --include="*.jsx"`
- [ ] scope="team" filters to team projects only
- [ ] "...외 N개" is clickable and expands full list
- [ ] DnD works in task tab (category + assignee change)
- [ ] `npm run build` succeeds
- [ ] Other views unaffected

## Constraints
- `updateTask(id, patch)` signature sacred
- DnD sensors: distance:3, delay:200
- No CSS variables, no left color borders
- git push origin main

---
---

# Loop-39.3: Team Timeline + Team Weekly — Scope Filter

> **Prereq**: Loop-39.2 complete
> **Ref mockup**: `docs/mockups/team-views-mockup.jsx` — 타임라인 + 주간플래너 sections
> **Agent review required**

---

## Goal

1. Apply scope="team" to TimelineView — show team projects, all members
2. Apply scope="team" to WeeklyPlannerView — rows=team members, team tasks
3. Remove [전체|팀|개인] toggle from both views
4. Add `+ 할일 추가` after each MS task list in timeline
5. Add `+ 추가` in every cell in weekly planner
6. Show member avatar badges on timeline MS/task rows

---

## Diagnostic

```bash
# Current timeline scope toggle
grep -rn "전체.*팀.*개인\|scopeFilter" src/components/timeline/ --include="*.jsx" | head -5

# Current weekly planner scope toggle
grep -rn "전체.*팀.*개인\|scopeFilter" src/components/weekly/ --include="*.jsx" | head -5

# Timeline left panel — does it show member avatars?
grep -rn "avatar\|Avatar\|assignee" src/components/timeline/ --include="*.jsx" | head -5

# Weekly planner row structure
grep -rn "gridTemplateColumns\|memberRow\|teamMember" src/components/weekly/ --include="*.jsx" | head -5
```

## Implementation

### Step 1: TimelineView — scope="team" filter

```js
if (scope === "team") {
  const teamProjects = projects.filter(p => p.teamId);
  // filter milestones and tasks to team projects only
}
```

### Step 2: Timeline — member avatar on rows

Each MS row and task row shows assignee/owner avatar (16px) next to title.
```
● 공증+위임장        ████████████  (R)  4건
  ☐ 등기서류 확인         ████      (R)
  ☐ Sifive 위임투표       ██        (A)
  + 할일 추가
```

### Step 3: Timeline — `+ 할일 추가` after each MS

After the last task row under each MS, add a clickable `+ 할일 추가` row.
Click → inline input → Enter → `addTask({ keyMilestoneId: msId, assigneeId: currentUser })`.

### Step 4: WeeklyPlannerView — scope="team" filter

Rows = all team members. Tasks = from team projects only.
Remove [전체|팀|개인] toggle.

### Step 5: Weekly — `+ 추가` in every cell

Every member × day cell must have `+ 추가` at bottom.

### Step 6: Weekly — project color dot on task cards

Each task card in weekly planner shows project color dot for quick identification.

---

## Pre-Commit Checklist

- [ ] TimelineView: [전체|팀|개인] toggle removed
- [ ] TimelineView: only team projects shown when scope="team"
- [ ] TimelineView: member avatar visible on MS and task rows
- [ ] TimelineView: `+ 할일 추가` after each MS's tasks
  `grep -rn "할일 추가" src/components/timeline/ --include="*.jsx"`
- [ ] WeeklyPlannerView: [전체|팀|개인] toggle removed
- [ ] WeeklyPlannerView: rows=team members, team tasks only
- [ ] WeeklyPlannerView: `+ 추가` in every cell
- [ ] WeeklyPlannerView: project color dot on task cards
- [ ] `npm run build` succeeds
- [ ] Global views (지금할일, 전체할일, 노트) unaffected

## Constraints
- `updateTask(id, patch)` signature sacred
- Do NOT modify UnifiedProjectView or global-only components
- No CSS variables
- git push origin main

---
---

# Loop-39.4: Personal Matrix — Project × Category Grid

> **Prereq**: Loop-39.3 complete
> **Ref mockup**: `docs/mockups/personal-views-mockup.jsx` — 매트릭스 section
> **Agent review required**

---

## Goal

Implement personal matrix: rows=projects, cols=categories(오늘/다음/나중).
Shows ONLY my tasks (assignee=me OR creator=me) across ALL projects (team+personal).

**This is a different layout from team matrix** — same component, scope prop branching.

---

## Diagnostic

```bash
# Current MatrixView — where to add scope branching
cat src/components/matrix/MatrixView.jsx | head -30
grep -rn "scope" src/components/matrix/ --include="*.jsx" | head -5

# How current user ID is accessed
grep -rn "currentUser\|userId\|user\.id\|session" src/hooks/useStore.js | head -5
```

## Implementation

### Step 1: MatrixView scope branching

```jsx
function MatrixView({ scope }) {
  if (scope === "team") {
    return <TeamMatrixContent />;  // existing code
  }
  return <PersonalMatrixContent />;  // new
}
```

### Step 2: PersonalMatrixContent — grid layout

```
rows = projects that have my tasks (team + personal)
cols = ["오늘", "다음", "나중"]
cell = my tasks for (project, category)
```

```jsx
const myTasks = useMemo(() =>
  tasks.filter(t => t.assigneeId === me || t.createdBy === me),
  [tasks, me]);

const projsWithMyTasks = projects.filter(p =>
  myTasks.some(t => t.projectId === p.pkmId));

// Grid: gridTemplateColumns: "140px repeat(3, 1fr)"
```

### Step 3: Each cell — task rows + `+ 추가`

```jsx
<div> {/* cell for (project, category) */}
  {cellTasks.map(t => (
    <TaskRow key={t.id} task={t} />
  ))}
  <span onClick={()=>addTask({projectId, category, assigneeId:me})}>+ 추가</span>
</div>
```

### Step 4: DnD — category change only

Personal matrix DnD changes category (오늘/다음/나중) only.
assigneeId change is BLOCKED.

```jsx
const handleDragEnd = (event) => {
  // extract target category from droppable id
  // updateTask(taskId, { category: newCategory });
  // DO NOT change assigneeId
};
```

### Step 5: Summary row

Bottom of grid: `전체: N건 | 오늘: N건 | 다음: N건 | 나중: N건`

---

## Pre-Commit Checklist

- [ ] scope="personal" renders project × category grid (NOT member × project)
- [ ] Rows are projects (with my tasks), cols are 오늘/다음/나중
- [ ] Only my tasks shown (assignee=me OR creator=me)
- [ ] Team AND personal projects included (not just personal projects)
- [ ] `+ 추가` in every cell
- [ ] DnD changes category only, NOT assigneeId
- [ ] scope="team" still renders existing team matrix (no regression)
- [ ] `npm run build` succeeds

## Constraints
- `updateTask(id, patch)` signature sacred
- Personal DnD: category change only, assignee BLOCKED
- useMemo for task filtering
- No CSS variables
- git push origin main

---
---

# Loop-39.5: Personal Timeline + Personal Weekly

> **Prereq**: Loop-39.4 complete
> **Ref mockup**: `docs/mockups/personal-views-mockup.jsx` — 타임라인 + 주간플래너
> **Agent review required**

---

## Goal

1. Personal timeline: my MS/tasks gantt only (from all projects)
2. Personal weekly: rows=projects, cols=weekdays, my tasks only
3. `+ 할일 추가` / `+ 추가` in all appropriate locations

---

## Implementation

### Step 1: TimelineView scope="personal"

```jsx
if (scope === "personal") {
  const myMs = milestones.filter(m => m.ownerId === me);
  const myTasks = tasks.filter(t => t.assigneeId === me || t.createdBy === me);
  // Group by project → MS → tasks
  // No avatar badges needed (all mine)
}
```

Structure: project headers → MS rows → task rows → `+ 할일 추가`.
Same gantt rendering as team timeline, just filtered data.

### Step 2: WeeklyPlannerView scope="personal"

```jsx
if (scope === "personal") {
  // rows = projects with my tasks this week
  // cols = Mon~Fri
  // cell = my tasks for (project, day)
}
```

Layout difference from team:
- Team: rows=members, cols=days
- Personal: rows=projects, cols=days

### Step 3: `+ 할일 추가` in personal timeline

After each MS's task list, add `+ 할일 추가` row.
Click → addTask({ keyMilestoneId, assigneeId: me }).

### Step 4: `+ 추가` in personal weekly

Every project × day cell has `+ 추가` at bottom.
Click → addTask({ projectId, dueDate: dayDate, assigneeId: me }).

### Step 5: DnD constraints

Personal timeline: bar drag changes dates only, not assignee.
Personal weekly: day-to-day DnD changes dueDate only, not assignee.

---

## Pre-Commit Checklist

- [ ] scope="personal" timeline shows only my MS/tasks
- [ ] scope="personal" timeline includes tasks from ALL projects (team+personal)
- [ ] scope="personal" weekly rows=projects (not members)
- [ ] scope="personal" weekly shows only my tasks
- [ ] `+ 할일 추가` after each MS in personal timeline
- [ ] `+ 추가` in every cell in personal weekly
- [ ] DnD does NOT change assigneeId in personal views
- [ ] scope="team" timeline and weekly still work (no regression)
- [ ] `npm run build` succeeds

## Constraints
- `updateTask(id, patch)` signature sacred
- useMemo for filtering
- No CSS variables
- git push origin main

---
---

# Loop-39.6: Cleanup + Regression Verification

> **Prereq**: Loop-39.5 complete (all views working)
> **Agent review required**

---

## Goal

1. Remove dead code — [전체|팀|개인] toggle remnants
2. Verify all views render correctly
3. Verify view headers show scope ("팀 매트릭스" / "개인 매트릭스")
4. Full regression check

---

## Implementation

### Step 1: Remove [전체|팀|개인] toggle code

```bash
# Find any remaining toggle references
grep -rn "전체.*팀.*개인\|scopeFilter\|viewScope\|filterScope" src/ --include="*.jsx" --include="*.js"
```

Remove all found references. The toggle UI and its state are no longer needed.

### Step 2: View headers must show scope

Each view header must indicate scope:
- "팀 매트릭스" not just "매트릭스"
- "개인 타임라인" not just "타임라인"

```bash
grep -rn "팀 매트릭스\|개인 매트릭스\|팀 타임라인\|개인 타임라인\|팀 주간\|개인 주간" src/ --include="*.jsx"
```

### Step 3: Verify "지금 할일" naming

```bash
grep -rn "오늘 할일" src/ --include="*.jsx"
# Should NOT match (all replaced with 지금 할일)
```

### Step 4: Full regression verification

```bash
# All views render without console errors:
# 1. 지금 할일
# 2. 전체 할일
# 3. 노트
# 4. 팀 매트릭스 — [할일] tab
# 5. 팀 매트릭스 — [마일스톤] tab
# 6. 팀 매트릭스 — [담당자별] tab
# 7. 팀 타임라인
# 8. 팀 주간 플래너
# 9. 개인 매트릭스
# 10. 개인 타임라인
# 11. 개인 주간 플래너
# 12. 프로젝트 뷰 (any team project)
# 13. 프로젝트 뷰 (any personal project)
# 14. DetailPanel
# 15. Mobile BottomNav

# Build check
npm run build
```

### Step 5: CLAUDE.md update

Add to CLAUDE.md under Architecture section:
```
Sidebar: 3 sections (글로벌 / 할일 / 프로젝트)
Scope: team views filter to team projects × all members
       personal views filter to all projects × my items only
ViewId: "team-matrix", "personal-matrix", etc.
[전체|팀|개인] toggle: REMOVED — scope determined by sidebar position
```

---

## Pre-Commit Checklist

- [ ] No remaining [전체|팀|개인] toggle references
  `grep -rn "전체.*팀.*개인" src/ --include="*.jsx"` → only in data, not UI toggles
- [ ] No remaining "오늘 할일" label
  `grep -rn "오늘 할일" src/ --include="*.jsx"` → should NOT match
- [ ] All 15 views listed above render without console errors
- [ ] View headers show scope (팀/개인 prefix)
- [ ] Sidebar ▸▾ collapse works for 팀/개인 sub-sections
- [ ] Keyboard shortcuts (Ctrl+Shift+←/→) cycle through VIEW_ORDER
- [ ] Mobile BottomNav shows 4 items
- [ ] CLAUDE.md updated with new architecture
- [ ] `npm run build` succeeds

## Constraints
- Do NOT delete old component files — just remove unused imports
- git push origin main
