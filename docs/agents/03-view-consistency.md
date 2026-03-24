# Agent 03: View Consistency

> Protects cross-view data synchronization, navigation consistency, and store dependencies.
> Baseline: 2026-03-18 (codebase diagnostic)

---

## BLOCK Rules

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

When a Loop modifies store data fields (tasks, projects, memos, milestones, etc.), the work instruction MUST include a checklist verifying correct behavior in **every view** that references that field.

Complete View Inventory (updated Loop-37):

Global views:
1. TodayView — 오늘 할일
2. AllTasksView — 전체 할일 (MS grouping, Loop-36A)
3. MatrixView / TeamMatrixView — 매트릭스 (task mode + MS mode, Loop-36A)
4. TimelineView — 글로벌 타임라인
5. WeeklyPlannerView — 주간 플래너 (Loop-36B)
6. MemoryView — 노트 (fullscreen mode, Loop-36C)

Project views:
7. UnifiedProjectView — 프로젝트 통합 뷰 (Loop-37)
   - [전체 할일] mode: row-aligned task list
   - [타임라인] mode: inline gantt bars (NOT TimelineGrid)

Retired (files preserved, imports removed):
- CompactMilestoneTab → replaced by UnifiedProjectView
- TasksTab / CompactTaskList → replaced by UnifiedProjectView
- Project TimelineView usage → replaced by inline gantt in UnifiedProjectView

Detail/Modal:
8. DetailPanel
9. ProjectSettingsModal
10. MilestoneDetailModal
11. DeleteConfirmDialog

**Example**: Adding a new field to the `tasks` array requires verification in at least TodayView, MatrixView, and UnifiedProjectView.

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

When adding or removing a view, ALL three surfaces must be updated:

| Surface | Location | Views |
|---------|----------|-------|
| Sidebar | src/components/layout/Sidebar.jsx | 오늘할일, 전체할일, 매트릭스, 타임라인, 주간플래너, 노트 |
| BottomNav | src/components/layout/BottomNav.jsx | 오늘할일, 전체할일, 매트릭스 (mobile subset) |
| Keyboard | VIEW_ORDER array | today, allTasks, matrix, timeline, weekly, memory |

When adding a new global view:
1. Add to Sidebar
2. Decide: add to BottomNav or explicitly exclude with comment
3. Add to VIEW_ORDER for Ctrl+Shift+←/→ cycling
4. Add React.lazy import in App.jsx

Missing any surface = BLOCK.

### B3. Store reads MUST use useStore selectors

```js
// Forbidden — no re-render, polling updates won't reflect
const tasks = useStore.getState().tasks

// Correct
const tasks = useStore(s => s.tasks)
```

New components using `getState()` to read store data in render = BLOCK.
(Exception: one-time reads inside event handlers for latest value)

### B4. Global ↔ Project view feature parity

Features in global views (today, matrix, timeline) must also work in the corresponding project view tab, and vice versa.

Confirmed parity requirements:
- Timeline: 3-level filter, date inheritance, color scheme, month/quarter/year scale, collapse/expand (only starting level differs)

### B5. Team/personal branch at router level only

```jsx
// Correct — branch once at top
{teamId ? <TeamMatrixView /> : <MatrixView />}

// Forbidden — branches scattered inside
function MatrixView() {
  if (teamId) { /* team logic */ }  // ← Don't do this
}
```

**Exception**: The 4 large view files (TodayView, ProjectView, TimelineView, DetailPanel) may use conditional additions (complex DnD/keyboard logic makes full duplication impractical).

### KD-3.9: Legacy URL Redirects (Loop-39)

```
/matrix → /tasks/team/matrix
/timeline → /tasks/team/timeline
/weekly → /tasks/team/weekly
/today → /now
```

Implement as simple viewId mapping in App.jsx or useStore.

### KD-3.10: Shared Components with Scope Prop (Loop-39)

MatrixView, TimelineView, WeeklyPlannerView accept scope prop.
- scope="team": team projects, all team members
- scope="personal": all projects, my items only

Layout differs by scope:
| Component | Team Layout | Personal Layout |
|-----------|------------|-----------------|
| MatrixView rows | Team members | Projects |
| MatrixView cols | Projects | Categories (오늘/다음/나중) |
| WeeklyPlanner rows | Team members | Projects |

When modifying any of these components, verify BOTH scope variants.

### KD-3.11: [전체|팀|개인] Toggle Removal (Loop-39)

Previously: each view had internal toggle to switch scope
Now: scope is determined by sidebar navigation position

DO NOT re-add scope toggles inside views.
If a view needs to show "team" data from "personal" context,
the user navigates to the team section in sidebar.

---

## Known Divergences

| ID | Severity | Description |
|----|----------|-------------|
| KD-3.1 | MEDIUM | Mobile BottomNav shows matrix/timeline tabs but AppShell force-redirects to today (dead-end) |
| KD-3.2 | MEDIUM | Highlight color read via non-reactive `getState()` in TodayView, AllTasksView, TeamMatrixView |
| KD-3.3 | MEDIUM | `projects` and `memos` not in SYNC_TABLES. Team changes invisible until `loadAll()` |
| KD-3.4 | MEDIUM | `/team/settings`, `/profile` rendered outside SyncProviderWrapper — polling stops on those pages |
| KD-3.5 | LOW | Navigation surface view lists don't match (Sidebar vs BottomNav vs Keyboard) |
| KD-3.6 | LOW | Keyboard VIEW_ORDER missing allTasks and projectLayer |
| KD-3.7 | LOW | MatrixView uses `sortProjectsLocally()` instead of `useProjectFilter` (code path divergence) |
| KD-3.8 | LOW | ProjectView active tab in `useState` (resets) vs ProjectLayer in store (persists) — UX inconsistency |
| KD-3.9 | LOW | TodayView greeting hardcodes "Ryan". Store `userName` not used |
| KD-3.10 | LOW | Optimistic update failure: no rollback, `loadAll()` silently reverts |
| KD-3.11 | LOW | WeeklyPlannerView (Loop-36B) may not be in BottomNav for mobile. Explicit decision needed — weekly planner may not be usable on mobile screen |
| KD-3.12 | LOW | UnifiedProjectView (Loop-37) has two right-panel modes [전체 할일][타임라인]. The timeline mode uses inline gantt bars, NOT the global TimelineGrid. Changes to one do NOT automatically apply to the other |
| KD-3.13 | INFO | Layout width specifications (Loop-36C): TodayView 960px, AllTasksView 800px, MatrixView full, TimelineView full, MemoryView list 960px / fullscreen 720px, ProjectView milestone/tasks 1100px / timeline 1400px, WeeklyPlannerView full |

---

## Convergence Targets

| ID | Target | Work |
|----|--------|------|
| CT-3.1 | KD-3.1 | Fix mobile matrix/timeline routing or remove from BottomNav |
| CT-3.2 | KD-3.2 | Convert `getState()` → `useStore` selector (3 views) |
| CT-3.3 | KD-3.3 | Add `projects` to SYNC_TABLES (verify updated_at index first) |
| CT-3.4 | KD-3.4 | Move SyncProviderWrapper to App level so all routes get polling |

---

## Verification Commands

```bash
# Find views referencing a specific store field (e.g., tasks)
grep -rn "useStore.*tasks\|s\.tasks\|s => s\.tasks" src/ --include="*.jsx" -l

# Find non-reactive getState() calls
grep -rn "useStore\.getState()\|getState()" src/ --include="*.jsx" -n

# Compare navigation view lists
grep -rn "VIEW_ORDER\|currentView.*=\|setCurrentView" src/ --include="*.jsx" -n | head -20
```
