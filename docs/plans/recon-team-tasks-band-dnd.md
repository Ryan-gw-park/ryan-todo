# RECON: Team Tasks View — Band Layout & Drag-and-Drop

**Loop**: TBD (next available, suggested `Sub-Loop 13`)
**Type**: Layout overhaul + DnD feature
**Status**: Recon (pre-diff)
**Protocol**: REQ-LOCK + DELETE-5 + R-ATOMIC

---

## 1. Context

The current Team Tasks View places projects and milestones in the leftmost column with one row per MS. This produces structural waste:

- MS rows are tall when only one member column has tasks (e.g. `임원배상책임보험` row has 5 of 6 member columns empty while the row height is set by `ash.kim`'s 2 cards).
- A dedicated count row sits beneath each project header.
- A standalone `+ 마일스톤` trigger row is empty across all member columns.
- A right-aligned `합계` column duplicates header information.

This recon converts MS labels to full-width horizontal bands, absorbs counts into the project header row, removes the totals column, and folds `+ MS` into a hover affordance on the project header. It also adds drag-and-drop so users can move tasks across members, milestones, and projects without opening the detail panel.

---

## 2. REQ-LOCK Requirements Table

| ID | Requirement | Acceptance |
|---|---|---|
| L-01 | Remove `합계` (right-most totals) column | No element with that label rendered; project totals appear inline with project header (e.g. `▼ 팀 개별 과제 14건`); MS totals appear at the right edge of each MS band (e.g. `2건`). |
| L-02 | Project header row absorbs the per-member count row | Counts (4 / 3 / 2 / 5 / · / ·) render in the same row as the project title, vertically centered, aligned to the 6 member columns. No separate count row exists. |
| L-03 | MS labels render as full-width horizontal bands, not as left-column rows | Each MS occupies a single horizontal stripe spanning all 6 member columns + the 130px label gutter; band shows MS name on the left and count on the right; band height ≤ 24px. |
| L-04 | Virtual backlog group (`keyMilestoneId === null`) renders as a band with reduced visual weight | Same band structure as L-03 but with `opacity: 0.7` (or equivalent dim treatment) and the label `미분류`. |
| L-05 | `+ 마일스톤` button moves from a standalone row to a hover-only affordance on the project header row | Button absent until pointer enters the project header row; appears at the right edge as a small dashed-border pill; clicking opens MS creation flow (existing). |
| L-06 | Left label gutter narrows from current width to 130px | Project title (`▼ <name> <n>건`) fits on a single line at 130px for all five active team projects; if not, ellipsis is forbidden — title wraps or column widens until single-line fit. |
| L-07 | Row vertical padding reduced | Project header row padding 5px (top/bottom); MS band padding 4px; task row padding 4px. No row taller than necessary to contain its tallest task card. |
| L-08 | Member column header row remains as before, aligned to the new 130px + 6×1fr grid | Headers `Ryan / Edmond / eric.kim / ash.kim / ethan / 미배정` centered above their respective columns. |
| D-01 | Task cards are draggable | A task card responds to pointer-down → drag with a ghost preview rendered at pointer; drop releases the task at the drop target; ESC cancels. |
| D-02 | Reorder within the same member column + same MS group | Drop targets between sibling task cards reorder via store action; no other field changes. |
| D-03 | Move to a different member column within the same MS | `assignee_id` updates to the target column's member; `category` resets to `'today'`; position becomes the end of the destination stack unless dropped between specific cards. |
| D-04 | Move to a different MS within the same project | `key_milestone_id` updates; `category` resets to `'today'`; assignee unchanged unless drop landed in a different member column. |
| D-05 | Move to a different project | `project_id` updates; `key_milestone_id` resets to `null` (virtual backlog) unless drop landed on a specific MS band of the target project; `category` resets to `'today'`; assignee preserved if both projects share the same team. |
| D-06 | Drop on an MS band (not on a specific card) | Task appended to the end of the destination column-MS combination; the column is determined by horizontal pointer position over the band. |
| D-07 | Drop on a project header row (not on a band) | Task appended to the project's virtual backlog (`key_milestone_id = null`); column determined by horizontal pointer position. |
| D-08 | All field changes from D-02 through D-07 are made through existing `updateTask(id, patch)` store action | Signature unchanged; no view component writes to Supabase directly; reordering uses an existing or newly-added store action that itself wraps `updateTask`. |
| D-09 | DnD respects scope rules | Team Tasks View only shows team-scope projects; cross-scope drops are not possible from this view (private projects are not droppable targets here). |
| D-10 | Visual feedback during drag | Source card dimmed to ~0.4 opacity; drop indicator (1.5px solid line in `--accent` token color from `designTokens.js`) renders between cards or as a band-wide highlight on bands; auto-scroll near viewport edges. |

---

## 3. Layout Scope

### 3.1 Grid

All rows share a single grid: `grid-template-columns: 130px repeat(6, 1fr)`.

- **Member header row**: column 1 empty; columns 2–7 show member names (centered, 11px, secondary text).
- **Project header row**: column 1 holds the title + count; columns 2–7 hold per-member counts (or `·` for zero); the `+ MS` hover button is positioned absolute at the right edge.
- **MS band**: full-width `grid-column: 1 / -1`, internal flex layout (label left, count right).
- **Task row**: column 1 empty; columns 2–7 hold a vertical stack of task cards per member.

### 3.2 Components (estimated)

| Component | New / Changed | Responsibility |
|---|---|---|
| `TeamTasksView` | Changed | Top-level view; orchestrates project list, DnD context. |
| `TeamProjectHeaderRow` | New (split from current view) | Renders project title + member counts + hover `+ MS` button. |
| `TeamMilestoneBand` | New | Full-width MS band with label + count; receives drop events. |
| `TeamTaskRow` | New | Container for one MS group's task cards across 6 member columns. |
| `TeamTaskCard` | Changed | Existing card, made draggable; visual unchanged. |
| `TeamTasksDndContext` | New | Wraps view in `DndContext` from `dnd-kit`; owns drag state, drop resolution, and dispatches store actions. |

### 3.3 Tokens

All styling uses `designTokens.js` (`COLOR`, `FONT`, `SPACE`). No hardcoded hex values. Per the project's TDZ rule, tokens are referenced inside functions/JSX — never assigned to module-level `const`.

### 3.4 Removed elements (DELETE-5 candidates)

| Removed | Why |
|---|---|
| `合計` (totals) column header + cells | L-01 — info collapsed into project header / MS band |
| Count-only row beneath project header | L-02 — folded into project header row |
| `+ 마일스톤` standalone trigger row | L-05 — folded into hover affordance |
| MS-as-left-column-row component (`MsRowLabel` or equivalent) | L-03 — replaced by `TeamMilestoneBand` |

Each must pass DELETE-5 — see §10.

---

## 4. DnD Scope

### 4.1 Behavior matrix

For a drag from source `(srcProject, srcMs, srcMember)` to drop target `(dstProject, dstMs, dstMember, position)`:

| Move type | `project_id` | `key_milestone_id` | `assignee_id` | `category` | Position |
|---|---|---|---|---|---|
| Reorder (same project / MS / member) | unchanged | unchanged | unchanged | unchanged | from drop position |
| Cross-member (same project / MS) | unchanged | unchanged | → `dstMember` | → `'today'` | end of dst stack (or drop position) |
| Cross-MS (same project) | unchanged | → `dstMs` | unchanged or → `dstMember` | → `'today'` | end of dst stack (or drop position) |
| Cross-project | → `dstProject` | → `dstMs` (or `null` if dropped on project header) | unchanged or → `dstMember` | → `'today'` | end of dst stack |
| Drop on MS band | unchanged or → `dstProject` | → `dstMs` | derived from x-position over band | → `'today'` | end of (member, MS) stack |
| Drop on project header | unchanged or → `dstProject` | → `null` | derived from x-position over header | → `'today'` | end of (member, virtual-backlog) stack |

### 4.2 Drop targets

The `DndContext` exposes four kinds of droppable regions:

1. **Task slot** (between two cards or below the last card in a `(member, MS)` stack) — full reorder/assignment capability.
2. **Empty member column under an MS band** — appends to that `(member, MS)` stack.
3. **MS band** — appends to the `(member-from-x, MS)` stack; member is derived from horizontal pointer position relative to the band.
4. **Project header row** — appends to the `(member-from-x, null)` virtual backlog of that project.

### 4.3 Reorder mechanics

- Tasks within a `(project, MS, member)` group must have a stable sort. If an `order` / `sort_index` field exists on `tasks`, the existing one is reused. If not, this recon flags it as a **prerequisite**: a `sort_index` integer column is added to `tasks` before D-02 can be implemented.
- **Decision needed before diff**: confirm whether `tasks.sort_index` (or equivalent) exists. If not, schema migration becomes Phase 0 of this loop.

### 4.4 Library

`dnd-kit` (already in stack per `userMemories`). Specifically: `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `closestCenter` collision detection, plus `restrictToVerticalAxis` only inside same-column reorder (otherwise unrestricted).

### 4.5 Animation

- Source card opacity 0.4 during drag (handled by `useDraggable` `isDragging`).
- `DragOverlay` renders the card at pointer with no rotation or shadow (flat).
- Drop indicator: 1.5px solid line using accent token; on band/header drops, indicator is the entire band/header background switched to accent-tint (~10% alpha).

---

## 5. Data Model

No schema changes assumed if `tasks.sort_index` already exists.

If not present:

```sql
ALTER TABLE tasks ADD COLUMN sort_index INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_tasks_group_sort
  ON tasks (project_id, key_milestone_id, assignee_id, sort_index);
```

Backfill: assign `sort_index` per group based on `created_at` ascending.

The `updateTask(id, patch)` signature is **not** modified. Any new store action (e.g. `reorderTasks(groupKey, fromIdx, toIdx)`) wraps `updateTask` internally for each affected card whose `sort_index` shifts.

---

## 6. Files Impacted (estimate)

| File | Type | Notes |
|---|---|---|
| `src/components/views/TeamTasksView.jsx` | Changed | Major restructure. |
| `src/components/team-tasks/TeamProjectHeaderRow.jsx` | New | Extracted from current view. |
| `src/components/team-tasks/TeamMilestoneBand.jsx` | New | |
| `src/components/team-tasks/TeamTaskRow.jsx` | New | |
| `src/components/team-tasks/TeamTaskCard.jsx` | Changed | Wrap with `useDraggable`. |
| `src/components/team-tasks/TeamTasksDndContext.jsx` | New | DnD context + drop resolver. |
| `src/store/tasksStore.js` | Changed | Add `reorderTasks` (wraps `updateTask`); existing actions untouched. |
| `src/styles/designTokens.js` | Possibly changed | Add accent / drop-indicator tokens if missing. |
| `db/migrations/<timestamp>_tasks_sort_index.sql` | New (conditional) | Only if `sort_index` not already present. |

---

## 7. Edge Cases

- **Drop outside any zone** — drag cancels; no mutation.
- **Drop on the source position** — no-op.
- **Drop on a project with zero MS** — only project header is a valid drop target; lands in virtual backlog.
- **Drop on collapsed project (▶)** — project auto-expands during hover (300ms hover delay) so the user can target an inner band; if released on the header, lands in virtual backlog.
- **Cross-project drag while source MS still exists in source project** — source MS is not deleted, it just no longer contains this task.
- **Member column = `미배정`** — dropping here means `assignee_id = null`; treated as a regular target.
- **Concurrent edits** — last-write-wins via existing `updateTask` semantics; no additional locking.
- **Permission check** — task delete is creator-only per existing rule, but task **move** is permitted for any team member with task write access. Confirm during diff if RLS policies enforce this.

---

## 8. Out of Scope

- Reorder of MS bands within a project (separate future loop).
- Reorder of project order in the view (separate future loop, uses sidebar DnD).
- Multi-select drag.
- Keyboard-accessible DnD (announced as future a11y pass).
- Personal Tasks View parity — same redesign should be cloned to the personal view in a follow-up loop, not this one.
- DnD across team / personal scope boundaries.

---

## 9. Verification Table (post-impl checklist)

| ID | Check | Method |
|---|---|---|
| V-L-01 | No `합계` column rendered | Visual + grep `'합계'` in TeamTasksView tree |
| V-L-02 | Project header row contains counts inline | Visual; DOM inspection |
| V-L-03 | MS bands span full width | Visual; computed width = container width |
| V-L-04 | Virtual backlog band visually distinct | Visual; opacity check |
| V-L-05 | `+ MS` button hidden until row hover | Pointer-over test |
| V-L-06 | Left gutter = 130px, no ellipsis on titles | DOM inspection |
| V-L-07 | Row padding ≤ 5px | DOM inspection |
| V-L-08 | Member headers aligned to columns | Visual |
| V-D-01 | Drag initiates on pointer-down | Manual |
| V-D-02 | Same-column reorder updates only `sort_index` | Network tab; DB after move |
| V-D-03 | Cross-member updates `assignee_id` + resets `category` | DB after move |
| V-D-04 | Cross-MS updates `key_milestone_id` + resets `category` | DB after move |
| V-D-05 | Cross-project updates `project_id` (+ `key_milestone_id`) + resets `category` | DB after move |
| V-D-06 | Drop on MS band lands at end of `(member-from-x, MS)` group | Manual |
| V-D-07 | Drop on project header lands in virtual backlog | Manual |
| V-D-08 | `updateTask` signature unchanged | grep + diff review |
| V-D-09 | Personal projects not droppable from this view | Manual |
| V-D-10 | Drop indicators visible; source card dimmed; auto-scroll works | Manual |
| V-G-01 | No hardcoded colors (all via `designTokens.js`) | grep `#[0-9a-f]{3,6}` in changed files |
| V-G-02 | No `border-left` color bars | grep `border-left` in changed files |
| V-G-03 | No text below `#888780` | grep + visual |
| V-G-04 | No `text-overflow: ellipsis` / `line-clamp` on task titles | grep |
| V-G-05 | All views still build (`npm run build` clean) | CI |
| V-G-06 | Other views (Matrix, Personal Tasks, Project Tasks) unaffected | Visual sweep |

---

## 10. DELETE-5 Cascade

| Target | ① import | ② caller | ③ props | ④ deps | ⑤ types | Action |
|---|---|---|---|---|---|---|
| `TotalsColumn` (or inline totals cells) | N/A — same file | TeamTasksView render | none | computed totals helpers (verify usage) | none | Delete |
| Count-only row component | TBD during diff | TeamTasksView render | per-member counts | counts derivation hook (kept — moved into project header) | none | Delete component, retain count derivation |
| `AddMilestoneRow` | TBD | TeamTasksView render | `onClickAddMs` | none | none | Delete; rebind `onClickAddMs` to header hover button |
| `MsRowLabel` (left-column MS row) | TBD | TeamTasksView render | `ms`, `count` | none | MS row prop types if any | Delete; replace with `TeamMilestoneBand` |
| `合計` header cell | N/A | header row | none | none | none | Delete |

Final import sweep required:
- [ ] All `import` lines in `TeamTasksView.jsx` reference identifiers used in the file body.
- [ ] No unused `useState` / `useMemo` left over from removed sections.
- [ ] `tasksStore` exports referenced by the deleted components are still used elsewhere — if not, separate cleanup loop.

---

## 11. R-ATOMIC Commit Sequence

Each commit is one issue. Builds must pass between every commit.

| # | Type | Title | Notes |
|---|---|---|---|
| 1 | `chore` | add `sort_index` column + backfill | Conditional — skip if already exists |
| 2 | `feat` | add `reorderTasks` store action | Wraps existing `updateTask`; signature unchanged |
| 3 | `refactor` | extract `TeamProjectHeaderRow`, `TeamMilestoneBand`, `TeamTaskRow` | No behavior change yet |
| 4 | `feat` | render MS as full-width band; absorb count row into project header | L-01, L-02, L-03, L-04 |
| 5 | `feat` | left gutter 130px + row padding pass | L-06, L-07 |
| 6 | `feat` | hover-only `+ MS` button on project header | L-05 |
| 7 | `feat` | wire `dnd-kit` DndContext + draggable cards + reorder within group | D-01, D-02 |
| 8 | `feat` | cross-member + cross-MS drop resolution | D-03, D-04 |
| 9 | `feat` | cross-project drop + MS-band drop + project-header drop | D-05, D-06, D-07 |
| 10 | `feat` | drop indicators + drag overlay + auto-scroll | D-10 |
| 11 | `chore` | DELETE-5 sweep (remove `TotalsColumn`, `AddMilestoneRow`, `MsRowLabel`, count row) | §10 |

Each commit ends with the REQ-LOCK verification subset that applies to it.

---

## 12. Open Questions (resolve before diff)

1. Does `tasks.sort_index` (or equivalent ordering column) already exist? If no, commit #1 is required and this loop's scope grows.
2. Is the team scope of `assignee_id` enforced in RLS for team projects? (Affects D-09 verification path.)
3. Should drop-on-MS-band default the assignee to **the column under the pointer** (proposed) or to **the dragged task's current assignee** (alternative)? Current proposal is the former — confirm.
4. Confirm the virtual backlog band label: `미분류` (current proposal) vs leaving label empty.
5. Confirm `+ MS` button visual: dashed-border pill at row right edge (current proposal) vs ghost text-only.

---

## 13. Mockup Reference

The visual target for §3 was rendered in the chat preceding this recon (band layout with inline counts, hover `+ MS`, full-width MS bands, virtual backlog dimmed). Treat that mockup as the canonical visual spec. Any divergence at diff time must be explicitly noted.
