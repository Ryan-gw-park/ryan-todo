# Agent Document Updates — Sidebar Restructure + Team/Personal Scope Split

> **Purpose**: Update all agents to reflect the new 3-section sidebar structure
>   (글로벌 / 할일 / 프로젝트) and team/personal scope separation.
> **Delivery**: Provide to Claude Code with instruction:
>   "Read this document and apply ALL updates to corresponding files in docs/agents/.
>    Do not remove existing content — only ADD new sections or UPDATE specified sections."

---

## 00-director.md

### UPDATE: VIEW_ID Registry (replace existing view list)

```markdown
### View ID Registry

Global views:
- "now" — 지금 할일 (renamed from "today")
- "allTasks" — 전체 할일
- "notes" — 노트

Team views (scope="team"):
- "team-matrix" — 팀 매트릭스 [할일|마일스톤|담당자별]
- "team-timeline" — 팀 타임라인
- "team-weekly" — 팀 주간 플래너

Personal views (scope="personal"):
- "personal-matrix" — 개인 매트릭스 (프로젝트 × 카테고리)
- "personal-timeline" — 개인 타임라인 (내 담당만)
- "personal-weekly" — 개인 주간 플래너 (행=프로젝트)

Project views:
- "project-{id}" — UnifiedProjectView

Retired IDs (redirect to team equivalents):
- "matrix" → "team-matrix"
- "timeline" → "team-timeline"
- "weekly" → "team-weekly"
- "today" → "now"
```

### ADD: Dispatch condition for scope changes

```markdown
### Scope Change Dispatch Rule
When a work instruction involves scope filtering (team↔personal) or
sidebar structure changes, dispatch ALL of:
- 03-view-consistency (navigation surfaces, view inventory)
- 05-design-system (layout variants)
- 07-ux-guardian (discoverability, navigation clarity)
```

---

## 01-schema-guardian.md

No changes required. Scope is a frontend-only filter concept — no DB schema impact.

---

## 02-permission-guard.md

### ADD: B8 — Scope-Based Interaction Constraints

```markdown
### B8: Scope-Based Interaction Constraints (Loop-39)

Data filtering by scope:
- team scope: projects where team_id IS NOT NULL → all team members' tasks/MS visible
- personal scope: ALL projects (team + personal) → only items where
  assignee_id = currentUser OR owner_id = currentUser

Interaction constraints by scope:
| Action | Team Scope | Personal Scope |
|--------|-----------|----------------|
| View tasks | All team members | My tasks only |
| Add task | Any project × any member cell | Any project (assigned to me) |
| DnD change category | ✅ | ✅ |
| DnD change assignee | ✅ | ❌ BLOCKED |
| DnD change dueDate | ✅ | ✅ |
| Edit task | ✅ (permission rules apply) | ✅ (my tasks only) |
| MS reassignment | ✅ (owner_id change) | ❌ BLOCKED |

Personal scope blocks assignee/owner changes because:
- Personal view purpose is "manage MY work", not "redistribute team work"
- Reassignment requires team context (seeing all members' load)
- Use team views for reassignment
```

### ADD: KD-2.10

```markdown
KD-2.10: Personal scope DnD intentionally blocks assigneeId and ownerId changes.
  If user attempts cross-member DnD in personal view, show toast:
  "담당자 변경은 팀 뷰에서 가능합니다"
  This is a UX guardrail, not a permission issue.
```

---

## 03-view-consistency.md

### REPLACE: B1 — Complete View Inventory

```markdown
### B1: Complete View Inventory (Loop-39 — Sidebar Restructure)

Sidebar Section 1: 글로벌 뷰
1. TodayView → renamed "지금 할일" (viewId: "now")
2. AllTasksView → "전체 할일" (viewId: "allTasks")
3. MemoryView → "노트" (viewId: "notes")

Sidebar Section 2: 할일
  ▾ 팀 (scope="team")
4. MatrixView(scope="team") — 팀 매트릭스
   Sub-tabs: [할일] [마일스톤] [담당자별]
   할일 tab: rows=members, cols=projects, DnD reassignment
   마일스톤 tab: rows=members, cols=projects, CompactMsRow, depth toggle
   담당자별 tab: member portfolio cards
5. TimelineView(scope="team") — 팀 타임라인
   All team members' MS/tasks gantt, avatar badges
6. WeeklyPlannerView(scope="team") — 팀 주간 플래너
   rows=members, cols=weekdays, cross-member DnD

  ▾ 개인 (scope="personal")
7. MatrixView(scope="personal") — 개인 매트릭스
   rows=projects, cols=categories(오늘/다음/나중), my tasks only
8. TimelineView(scope="personal") — 개인 타임라인
   My MS/tasks gantt only (from ALL projects including team)
9. WeeklyPlannerView(scope="personal") — 개인 주간 플래너
   rows=projects, cols=weekdays, my tasks only

Sidebar Section 3: 프로젝트
  ▾ 팀 프로젝트
10. UnifiedProjectView — per team project (tree + tasks/timeline)
  ▾ 개인 프로젝트
11. UnifiedProjectView — per personal project

Modals/Panels:
12. DetailPanel
13. ProjectSettingsModal
14. MilestoneDetailModal
15. DeleteConfirmDialog

Retired (files preserved, imports removed):
- [전체|팀|개인] toggle in MatrixView, TimelineView, WeeklyPlannerView
- Standalone MilestoneMatrixView → absorbed into MatrixView 마일스톤 tab
```

### REPLACE: B2 — Navigation Surfaces

```markdown
### B2: Navigation Surfaces (Loop-39)

| Surface | Location | Content |
|---------|----------|---------|
| Sidebar | Sidebar.jsx | 3 sections: 글로벌(3) + 할일(팀3+개인3) + 프로젝트(팀N+개인N) |
| BottomNav | BottomNav.jsx | Mobile subset: 지금할일, 전체할일, 팀매트릭스, 노트 |
| Keyboard | VIEW_ORDER | now, allTasks, team-matrix, team-timeline, team-weekly, personal-matrix, personal-timeline, personal-weekly, notes |

Sidebar sub-sections (팀/개인) are collapsible with ▸▾ toggle.

When adding a new view:
1. Decide scope (global / team / personal)
2. Add to appropriate sidebar section
3. Add to VIEW_ORDER for keyboard cycling
4. Update BottomNav if mobile-relevant
5. Add React.lazy import in App.jsx with viewId routing
```

### ADD: KD-3.9 — URL Redirect

```markdown
KD-3.9: Legacy URL redirects (Loop-39)
  /matrix → /tasks/team/matrix
  /timeline → /tasks/team/timeline
  /weekly → /tasks/team/weekly
  /today → /now
  Implement as simple viewId mapping in App.jsx or useStore.
```

### ADD: KD-3.10 — Scope Prop Convention

```markdown
KD-3.10: Shared components with scope prop (Loop-39)
  MatrixView, TimelineView, WeeklyPlannerView accept scope prop.
  scope="team": team projects, all team members
  scope="personal": all projects, my items only
  
  Layout differs by scope:
  | Component | Team Layout | Personal Layout |
  |-----------|------------|-----------------|
  | MatrixView rows | Team members | Projects |
  | MatrixView cols | Projects | Categories (오늘/다음/나중) |
  | WeeklyPlanner rows | Team members | Projects |
  
  When modifying any of these components, verify BOTH scope variants.
```

### ADD: KD-3.11 — [전체|팀|개인] Toggle Removal

```markdown
KD-3.11: [전체|팀|개인] toggle removed (Loop-39)
  Previously: each view had internal toggle to switch scope
  Now: scope is determined by sidebar navigation position
  
  DO NOT re-add scope toggles inside views.
  If a view needs to show "team" data from "personal" context,
  the user navigates to the team section in sidebar.
```

---

## 04-card-interaction.md

### UPDATE: DndContext Inventory (replace existing table)

```markdown
### DndContext Inventory (Loop-39)

| View | Scope | DndContext | Drag Sources | Drop Targets | onDragEnd |
|------|-------|-----------|-------------|-------------|-----------|
| TodayView | — | SortableContext | task cards | sort positions | reorder |
| MatrixView | team | DndContext | task cards | member×project cells | category+assignee |
| MatrixView | personal | DndContext | task cards | project×category cells | category only |
| WeeklyPlanner | team | DndContext | task cards, backlog | member×day cells | dueDate+assignee |
| WeeklyPlanner | personal | DndContext | task cards | project×day cells | dueDate only |
| UnifiedProjectView | — | DndContext | MS nodes | tree positions | sortOrder+parentId |

Standard sensors for all: PointerSensor distance:3, TouchSensor delay:200/tolerance:5
```

### ADD: B6 — Personal Scope DnD Constraints

```markdown
### B6: Personal Scope DnD Constraints (Loop-39)

In personal scope views, DnD MUST NOT change:
- assigneeId (blocked — show toast "담당자 변경은 팀 뷰에서 가능합니다")
- ownerId (blocked)

Allowed changes in personal scope DnD:
- category (오늘/다음/나중 between columns in personal matrix)
- dueDate (between days in personal weekly planner)

Implementation:
- In onDragEnd, check scope prop before applying assignee changes
- If scope="personal" and target implies assignee change → reject + toast
```

---

## 05-design-system.md

### ADD: B11 — Sidebar 3-Section Design Spec

```markdown
### B11: Sidebar 3-Section Structure (Loop-39)

Section header:
- fontSize: 11px, fontWeight: 600, color: textTertiary
- letterSpacing: 0.02em
- padding: 16px 14px 4px

Sub-section header (팀/개인):
- fontSize: 11px, fontWeight: 500, color: textTertiary
- ▸▾ toggle: fontSize 9px, width 12px
- padding: 6px 14px 2px 18px
- Collapsible — default expanded

Nav item:
- icon: 14px width 20px centered, opacity 0.7
- label: fontSize 13px, color textPrimary
- padding: 6px 12px (+ indent per level: 12px)
- Active state: background #f0efeb, fontWeight 600
- Hover state: background #f5f4f0
- Border radius: 6px
- Margin: 1px 6px

Project item:
- Dot (8px) + name (fontSize 13px)
- Same active/hover as nav items

Badge (notifications):
- fontSize 10px, color #fff, background #ef4444
- borderRadius 8px, padding 0 5px, minWidth 16px
```

### ADD: B12 — Team vs Personal Layout Variants

```markdown
### B12: Team vs Personal Layout Variants (Loop-39)

Same component name, different layout by scope:

| Aspect | Team | Personal |
|--------|------|----------|
| Matrix rows | Team members (avatar + name) | Projects (dot + name) |
| Matrix cols | Projects (dot + name) | Categories: 오늘/다음/나중 |
| Matrix cell | Tasks for (member, project) | Tasks for (project, category) |
| Matrix + 추가 | Creates task for specific member+project | Creates task for specific project+category (assigned to me) |
| Weekly rows | Team members | Projects |
| Weekly cell | Tasks for (member, day) | Tasks for (project, day) |
| Timeline | All members' gantt, avatar badges | My gantt only, no avatar needed |

View header must indicate scope:
- Team views: "팀 매트릭스", "팀 타임라인", "팀 주간 플래너"
- Personal views: "개인 매트릭스", "개인 타임라인", "개인 주간 플래너"

When modifying shared components, test BOTH scope variants.
```

### UPDATE: B8 View Content Width — add new entries

```markdown
Append to existing width table:
| TeamMatrixView | full width |
| TeamTimelineView | full width |
| TeamWeeklyPlannerView | full width |
| PersonalMatrixView | full width |
| PersonalTimelineView | full width |
| PersonalWeeklyPlannerView | full width |
```

---

## 06-sync-performance.md

### ADD: B11 — Scope Filtering Performance

```markdown
### B11: Scope Filtering Performance (Loop-39)

Scope filtering runs on every render — use useMemo.

Team scope filter:
  const teamProjects = useMemo(() =>
    projects.filter(p => p.teamId), [projects]);
  const teamTasks = useMemo(() =>
    tasks.filter(t => teamProjects.some(p => p.pkmId === t.projectId)),
    [tasks, teamProjects]);

Personal scope filter:
  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigneeId === me || t.createdBy === me),
    [tasks, me]);
  const myMs = useMemo(() =>
    milestones.filter(m => m.ownerId === me),
    [milestones, me]);

Performance thresholds:
- tasks < 200: useMemo optional
- tasks 200–500: useMemo recommended
- tasks > 500: useMemo required, consider virtualization
```

### ADD: B12 — No Re-fetch on Scope Switch

```markdown
### B12: No Additional Queries on Scope Switch (Loop-39)

Switching between team and personal views MUST NOT trigger loadAll()
or any Supabase query. store.tasks and store.milestones already
contain all data for both scopes.

Scope switch = frontend filter change only.
Navigation: sidebar click → viewId change → component re-render with
different scope prop → useMemo recalculates filtered data.

Anti-pattern to BLOCK:
  useEffect(() => { loadAll(); }, [scope]); // WRONG — no re-fetch
```

---

## 07-ux-guardian.md

### UPDATE: B1 — Empty State additions

```markdown
Append to B1 examples:

Personal matrix (no assigned tasks):
  "배정된 할일이 없습니다. 팀 매트릭스에서 할일을 배정받거나, + 추가로 직접 생성하세요."

Personal timeline (no owned MS):
  "담당 마일스톤이 없습니다. 프로젝트 뷰에서 마일스톤 담당자를 설정하세요."

Personal weekly (no tasks this week):
  "이번 주 예정된 할일이 없습니다."

New team member first visit (all views empty):
  All team views show data but personal views may be empty.
  Show: "아직 배정된 업무가 없습니다. 팀 매트릭스에서 업무를 배정받으세요."
```

### UPDATE: B2 — Feature Discoverability additions

```markdown
Append to discovery path inventory:

| Feature | Discovery Path | Fallback |
|---------|---------------|----------|
| Team/Personal switch | Sidebar section navigation | always visible |
| 매트릭스 할일 tab restored | [할일][마일스톤][담당자별] toggle | visible always |
| + 추가 in every cell | Text link in each grid cell | visible always |
| Personal matrix layout differs | Automatic by scope | header indicates scope |
| Scope badge in header | "팀 매트릭스" / "개인 매트릭스" text | visible always |
```

### UPDATE: B6 — Navigation Clarity additions

```markdown
Append to B6:

Scope identification:
- View header MUST show scope: "팀 매트릭스" not just "매트릭스"
- Active sidebar item provides visual context (which section am I in?)
- If user is in "할일 > 개인 > 매트릭스", header shows "개인 매트릭스"

Sidebar section state:
- All sub-sections (팀/개인) default to expanded
- Collapsed state persists across navigation (localStorage or store)
- Collapsing "팀" section does not affect "개인" section
```

### UPDATE: KD-7.6 — Existing user transition

```markdown
REPLACE KD-7.6:

KD-7.6: Sidebar restructure transition (Loop-39)
  Existing users will experience:
  1. Sidebar completely reorganized (3 sections instead of 2)
  2. "오늘 할일" renamed to "지금 할일"
  3. [전체|팀|개인] toggle gone — replaced by sidebar navigation
  4. Same view name appears twice (팀/개인) — distinguished by section
  5. 매트릭스 할일 tab restored (was removed in Loop-38)
  
  Recommendation: first-visit banner or tooltip:
  "사이드바가 새로워졌습니다. 팀/개인 뷰가 분리되었습니다."
  Dismissible, shown once per user.
```

### ADD: KD-7.7

```markdown
KD-7.7: + 추가 in every view (Loop-39)
  ALL grid-based views must have "+ 추가" or "+ 할일 추가" in every cell/section.
  This is a hard requirement — no view should be read-only for task creation.
  
  Inventory:
  | View | + 추가 Location |
  |------|----------------|
  | 팀 매트릭스 할일 | Each member × project cell |
  | 팀 매트릭스 담당자별 | Each member × project group |
  | 팀 타임라인 | After each MS's task list |
  | 팀 주간 플래너 | Each member × day cell |
  | 개인 매트릭스 | Each project × category cell |
  | 개인 타임라인 | After each MS's task list |
  | 개인 주간 플래너 | Each project × day cell |
  
  If a new view is added without + 추가 → BLOCK.
```

---

## Summary

| Agent | Changes | Key Items |
|-------|---------|-----------|
| 00-director | VIEW_ID registry rewrite, scope dispatch rule | 2 updates |
| 01-schema | None | — |
| 02-permission | Scope interaction constraints | B8, KD-2.10 |
| 03-view | **View inventory rewrite**, nav surfaces, toggle removal | B1/B2 replace, KD-3.9~3.11 |
| 04-card | DnD inventory rewrite, personal DnD constraints | Table replace, B6 |
| 05-design | Sidebar spec, layout variants, widths | B11, B12, B8 update |
| 06-sync | Scope filter performance, no re-fetch | B11, B12 |
| 07-ux | Empty states, discoverability, navigation, + 추가 rule | B1/B2/B6 update, KD-7.6/7.7 |

**Total: 7 files updated, ~25 additions/replacements.**
