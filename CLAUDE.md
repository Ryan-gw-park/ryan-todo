# CLAUDE.md — Ryan Todo Project Rules

## SUPREME QUALITY PRINCIPLE (Overrides Everything)

**All items have equal priority and importance.**

Features, visual quality, design details, color schemes, architecture, DB schema, API efficiency, UX interactions, accessibility, performance — none of these is "lower priority" than any other.

- Only the **order** of work is managed systematically (based on dependencies and prerequisites)
- **Importance grades are never assigned** to items
- **Every identified issue is fixed** without exception
- Never skip items for reasons like "later", "when we have time", or "it's a minor visual thing"
- A 1px checkbox background color, text contrast, or hover feedback is treated identically to a functional bug

**Violations (NEVER do this):**
- "Classify as P0/P1/P2 and handle P2 next time" → FORBIDDEN. If identified, fix in the same cycle
- "Feature works, so visual issues can wait" → FORBIDDEN. Visual fixes go in the same commit
- "Low priority, excluded from fix prompt" → FORBIDDEN. All items from diagnosis go into the fix prompt
- Identifying items in a work instruction then dropping them in the execution prompt → FORBIDDEN

**Correct practice:**
- 7 items identified in diagnosis → 7 items in fix prompt → 7 items in same commit
- Feature fixes and visual fixes are never separated — they are one work unit
- Work order is decided by **dependency** ("fix import first → then the rest simultaneously"), not importance

---

## Critical DB Constraints

**NEVER rename existing tables or columns:**
- `tasks` table: columns `text`, `done`, `category`, `alarm`, `notes`, `id` (text type, not UUID)
- `memos` table: table name `memos`
- These column/table names must never be changed, renamed, or aliased

**New tables and columns:**
- New tables use UUID for IDs
- Cross-references to existing tables use `text` type without DB-level foreign key constraints
- Every new column: `DEFAULT` required, `nullable` recommended
- `updated_at` index required on every table with timestamps
- RLS policies must be applied immediately upon column/table creation

---

## "Don't Touch, Wrap It" Principle

Existing battle-tested components must NOT be modified directly. New functionality is added via:
- Wrapper components
- Separate hooks
- Top-level branching (e.g., `teamId ? TeamMatrixView : MatrixView`)

**Exceptions (modification allowed):**
- Data mapping functions (`taskToRow`, `mapTask`, `loadAll`, `addTask`) — new fields may be added, but never deleted or renamed
- Store internal logic (`useStore.js`) — when work instructions explicitly permit
- View files for card rendering replacement (Loop-35 scope) — only the card rendering portion

---

## updateTask Signature

```
updateTask(id, patch)
```
NOT `updateTask({...task})`. This is enforced in all prompts and code.

---

## State Transition Rules (R1–R7)

`applyTransitionRules` at `useStore.js:25` — automatically applied to every `updateTask` call.

```
R1:  assigneeId set       → scope = 'assigned'
R2:  assigneeId = null    → scope = 'team' (if teamId) / 'private' (if no teamId)
R2+: team task unassigned → category = 'backlog'
R3:  done = true          → prevCategory = current category (category unchanged)
R4:  done = false         → prevCategory = '' (guard: if category='done', restore to prevCategory||'backlog')
R5:  projectId changed    → keyMilestoneId = null (unless explicitly set)
R6:  scope = 'private'    → teamId = null, assigneeId = null
R7:  scope = 'team'       → assigneeId = null
```

**`category:'done'` is ABOLISHED.** `done` boolean is the sole completion indicator. `category` only represents priority: `'today' | 'next' | 'backlog'`.

---

## Architecture & Tech Stack

- **Frontend:** React 19, Vite, Zustand, dnd-kit, vite-plugin-pwa, Workbox (injectManifest)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, RLS, Web Push via VAPID)
- **Deployment:** Vercel (migrated from Netlify)
- **DB Hierarchy:** Company → Team → Member (3-tier in DB, 2-tier in UI)
- **Task Scopes:** team / assigned / private
- **Auth:** Google SSO + Magic Link + Email/Password
- **Sync:** 10-second polling via SyncProvider abstraction
- **Display Names:** `team_members.display_name` with `profiles.display_name` as fallback

---

## Security Rules

- Never expose VAPID private keys or other secrets in conversation
- Keys must be regenerated if accidentally shared
- RLS policies must protect all tables — 13 tables, 47+ policies audited
- Personal project isolation: 4-layer protection (RLS + CHECK + Store + UI)

---

## Service Worker

SW registration must be in `main.jsx` BEFORE `ReactDOM.createRoot`, not inside a React hook. This avoids cold start delays.

---

## Development Workflow

### Loop-Based Iterative Development
Each feature is a numbered Loop with:
1. Scoped work instruction document
2. Verification checklist
3. Completion report

Claude Code executes the structured prompts.

### Diagnostic-First
Before implementing fixes, run diagnostic prompts to identify root causes (bundle size, query scope, initialization chain, etc.). Never jump to fixes without understanding the change scope.

### Design-Last Discipline
All functional implementation is completed before UI refinement loops begin. Design notes are held and batched.

---

## Permanent Design Principles

1. `category:'done'` abolished — `done` boolean only
2. Unassigned team tasks → forced `category='backlog'`
3. **Left color border (`border-left`) is BANNED everywhere** — projects/tasks/milestones use color dots instead
4. Color guide: `#c4c2ba`, `#d3d1c7` are too light — NEVER use. Secondary text must be `#888780` or darker
5. Personal project isolation: 4-layer (RLS + CHECK + Store + UI)
6. All new columns: DEFAULT required, nullable recommended, updated_at index required, RLS immediate
7. Global/Project timeline = same engine (`TimelineEngine`), only `rootLevel` differs
8. All card interactions = UniversalCard spec (4-zone separation: Status / Title / Body / Detail)
9. **Inline editing:** Click-to-edit only (always-editable abolished). Title text area is limited width, not full row.
10. **Detail entry:** ▶ icon only (row-click for detail abolished). Row click = expand/collapse.
11. **TimelineGrid DnD excluded** from UniversalCard — Gantt bars keep manual mouse events. Only left panel uses UniversalCard.
12. **Highlight colors:** Checkbox always white background. Text color auto-calculated from background luminance (WCAG formula, threshold 0.5).

### Global Visual Principles (UniversalCard — all 3 card types, all views)

These apply identically to task, milestone, and project cards in every view.
Not per-view overrides — implemented inside UniversalCard/TitleZone/StatusZone.

13. **Inline edit width = real-time text size.** Hidden span measurement. Min 60px, max parent 100%. Input grows/shrinks as user types. No fixed width, no percentage, no max-width constant.
14. **Title text always fully visible — ellipsis BANNED.** `white-space: normal`, `word-break: break-word`, `overflow: visible`. No `-webkit-line-clamp`. Titles wrap to 2, 3+ lines as needed.
15. **Highlight cards: checkbox/dots always visible.** Checkbox keeps white background regardless of card highlight color. Color dots for milestones/projects are never obscured by background.
16. **Highlight cards: text auto-contrast.** WCAG luminance formula, threshold 0.5. Dark background → white text, light background → dark text. Applies to title, meta, assignee, and edit input.
17. **Meta info on same line as title.** Assignee name, category icon never cause a second line. If space insufficient, meta is omitted (title is never omitted).
18. **Detail icon hidden during edit.** When TitleZone is in edit mode, DetailZone (▶) is hidden. Reappears on hover after edit ends.
19. **4-zone event separation.** Title click → edit (stopPropagation). Empty space click → expand/collapse. Empty space drag (5px+) → DnD. ▶ click → detail (stopPropagation). Status click → toggleDone (stopPropagation).

---

## CSS Pattern

- **No CSS variables** — project uses inline styles + hardcoded color constants
- Follow existing patterns, don't introduce new CSS systems
- Hardcoded colors: `#37352f` (text), `#e8e6df` (border), `#f5f4ef` (background), etc.

---

## DnD Rules

- All views use `useSortable` from dnd-kit (not `useDraggable`)
- UniversalCard receives sortable ref/listeners as props from parent view
- UniversalCard is a pure rendering component — DnD logic stays in views
- Click vs drag: 5px movement threshold
- TimelineGrid Gantt bars: manual mouse events (NOT dnd-kit)

---

## Store Rules

- `milestones` state does NOT exist in global store — milestones are loaded per-project via hooks or prop drilling
- MSBadge receives milestone data as prop, not from store
- Avoid Supabase direct queries in custom hooks that render on every cycle (infinite loop risk)
- Global state over local state for shared UI (e.g., project filter)

---

## Modal System

- `activeModal` + `confirmDialog` as separate store states
- Only one modal at a time (project settings / milestone detail / task DetailPanel)
- `returnTo` pattern for back navigation (MS modal → project modal)
- Error Boundary wraps all modals to prevent app crash

---

## Current Loop Status

| Loop | Scope | Status |
|------|-------|--------|
| 31 | Task state foundation (applyTransitionRules, category:'done' abolish) | ✅ COMPLETE |
| 32 | Schema extension (projects/milestones columns + RLS) | ✅ COMPLETE |
| 33 | UI modals (ProjectSettings, MilestoneDetail, DeleteConfirm) | ✅ COMPLETE |
| 34 | Timeline optimization (TimelineEngine, filters, inheritance, scales) | ✅ COMPLETE |
| 35 | UniversalCard common component | 🔧 IN PROGRESS (regression fixes ongoing) |
| 36A | AllTasks MS grouping + Matrix MS mode | ⏳ WAITING |
| 36B | Weekly Planner new view | ⏳ WAITING |
| 37+ | Comments, notifications, polling sync, performance | ⏳ FUTURE |

---

## File Naming Conventions

- Work instructions: `loop-{N}-work-instruction.md`
- Views: `src/components/views/`
- Matrix: `src/components/matrix/`
- Timeline: `src/components/timeline/`
- Common: `src/components/common/` (UniversalCard, TitleZone, StatusZone, etc.)
- Modals: `src/components/modals/`
- Project components: `src/components/project/`
- Layout: `src/components/layout/`
- Store: `src/hooks/useStore.js`
