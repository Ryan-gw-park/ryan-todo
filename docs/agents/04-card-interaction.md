# Agent 04: Card + Interaction

> Protects universal card patterns, DnD, state transitions, inline editing, and click/drag separation.
> Baseline: 2026-03-18 (codebase diagnostic)

---

## BLOCK Rules

### B1. updateTask signature is sacred

```js
// Correct
updateTask(id, { done: true, category: 'today' })

// ABSOLUTELY FORBIDDEN
updateTask({ ...task, done: true })
updateTask(task)
```

Pipeline: `updateTask(id, patch)` → `applyTransitionRules(currentTask, patch)` → optimistic merge → `safeUpsertTask`. Direct DB calls that bypass this pipeline are also forbidden.

### B2. All state changes MUST go through applyTransitionRules

When modifying task state (done, category, scope, etc.), `applyTransitionRules` MUST be invoked. This pure function applies 7 business rules (R1–R7) to expand the patch.

```
Location: useStore.js (top, ~line 25)
Call path: updateTask → applyTransitionRules → expanded patch → DB
```

Calling `supabase.from('tasks').update(...)` directly to change state skips business rules.

### B3. New DndContext must use standard sensor config

When adding a new DndContext, use this standard configuration:

```
PointerSensor:  activationConstraint: { distance: 3 }
TouchSensor:    activationConstraint: { delay: 200, tolerance: 5 }
KeyboardSensor: coordinateGetter: sortableKeyboardCoordinates
```

Deviation requires explicit justification in the work instruction.

### B4. Click vs drag separation mechanism

New components rendering draggable cards MUST implement the 5-layer separation:

1. **dnd-kit activationConstraint** — distance or delay for primary separation
2. **Zone stopPropagation** — StatusZone, TitleZone, DetailZone each block events
3. **Mobile drag listener removal** — `!isMobile ? listeners : undefined`
4. **isDragging visual feedback** — `opacity: 0.3` during drag
5. **Click → detail panel** — when not dragging, open DetailPanel

### B5. Inline editing pattern: blur saves

Follow the TitleZone implementation:

```
Click → show input → type → Enter (save + next row) or blur (save) or Escape (cancel)
onMouseDown: stopPropagation (DnD isolation)
parseDateFromText(text) → auto-extract startDate/dueDate
```

### B6. No nested DndContext

Never nest DndContext inside another DndContext. Using multiple SortableContexts within a single DndContext is allowed.

### B7. Inline Gantt Bars (Loop-37)

Project view timeline mode renders gantt bars directly inside row divs.
This is NOT a DndContext — bars are positioned with CSS absolute positioning.
Bar drag/resize uses manual mousedown/mousemove/mouseup events (same pattern as TimelineGrid).
Do NOT wrap these in a DndContext — mouse events will conflict.

### B8: Personal Scope DnD Constraints (Loop-39)

In personal scope views, DnD MUST NOT change:
- assigneeId (blocked — show toast "담당자 변경은 팀 뷰에서 가능합니다")
- ownerId (blocked)

Allowed changes in personal scope DnD:
- category (오늘/다음/나중 between columns in personal matrix)
- dueDate (between days in personal weekly planner)

Implementation:
- In onDragEnd, check scope prop before applying assignee changes
- If scope="personal" and target implies assignee change → reject + toast

---

## Known Divergences

| ID | Severity | Description |
|----|----------|-------------|
| KD-4.1 | **MEDIUM** | 8 independent DndContexts across 6 files with no shared config factory — root cause of all inconsistencies |
| KD-4.2 | MEDIUM | Collision detection varies: rectIntersection / custom matrixCollision / closestCenter / pointerWithin |
| KD-4.3 | MEDIUM | TouchSensor delay varies: 0ms (not set) / 120ms / 200ms |
| KD-4.4 | MEDIUM | MilestoneOutlinerView and KeyMilestoneTab have no sensors configured (0px threshold) |
| KD-4.5 | LOW | PointerSensor distance varies: 3px / 5px |
| KD-4.6 | LOW | TitleZone onBlur always calls save() — unintended saves possible |
| KD-4.7 | LOW | MilestoneTaskChip has drag listeners + onClick simultaneously attached |
| KD-4.8 | INFO | TimelineGrid uses raw mousedown/up (no dnd-kit — separate paradigm) |
| KD-4.9 | LOW | UnifiedProjectView inline gantt bars use manual mouse events for bar drag/resize, while tree area uses dnd-kit for milestone reordering. Spatial separation (right panel vs left panel) prevents conflict |
| KD-4.10 | LOW | WeeklyPlannerView (Loop-36B) introduces cross-scope DnD: dragging a task to a different team member's row changes assigneeId. Must validate: personal project tasks cannot be assigned to other members |

**DndContext Inventory (updated Loop-37):**

| View | DndContext | Sensors | Collision |
|------|-----------|---------|-----------|
| TodayView | SortableContext | pointer:3, touch:200/5 | closestCenter |
| MatrixView | DndContext | pointer:3, touch:120/5 | pointerWithin |
| TeamMatrixView | DndContext | pointer:3, touch:200/5 | closestCenter |
| CompactMilestoneTab | DndContext | pointer:3, touch:200/5 | pointerWithin |
| WeeklyPlannerView | DndContext | pointer:3, touch:200/5 | closestCenter |
| UnifiedProjectView | DndContext | pointer:3, touch:200/5 | closestCenter |

WeeklyPlannerView DnD (Loop-36B):
- Drag sources: backlog task items, grid task cards
- Drop targets: day cells (memberId + date), backlog area
- onDragEnd: updateTask(id, { dueDate, category, assigneeId })

UnifiedProjectView DnD (Loop-37):
- Drag sources: milestone nodes in tree
- Drop targets: other positions in same parent, other parent nodes
- onDragEnd: reorderMilestones or moveMilestone

**DndContext Inventory (Loop-39 — scope-aware update):**

| View | Scope | DndContext | Drag Sources | Drop Targets | onDragEnd |
|------|-------|-----------|-------------|-------------|-----------|
| TodayView | — | SortableContext | task cards | sort positions | reorder |
| MatrixView | team | DndContext | task cards | member×project cells | category+assignee |
| MatrixView | personal | DndContext | task cards | project×category cells | category only |
| WeeklyPlanner | team | DndContext | task cards, backlog | member×day cells | dueDate+assignee |
| WeeklyPlanner | personal | DndContext | task cards | project×day cells | dueDate only |
| UnifiedProjectView | — | DndContext | MS nodes | tree positions | sortOrder+parentId |

Standard sensors for all: PointerSensor distance:3, TouchSensor delay:200/tolerance:5

---

## Convergence Targets

| ID | Target | Work |
|----|--------|------|
| CT-4.1 | KD-4.1–4.5 | Create `createStandardSensors()` factory → migrate all 8 DndContexts |
| CT-4.2 | KD-4.4 | Add standard sensor config to MilestoneOutlinerView/KeyMilestoneTab |
| CT-4.3 | KD-4.2 | Unify collision detection to 2 strategies: list-type (closestCenter) and matrix-type (pointerWithin+fallback) |

---

## Verification Commands

```bash
# Detect updateTask signature violations
grep -rn "updateTask(" src/ --include="*.jsx" --include="*.js" | \
  grep -v "updateTask(id\|updateTask(taskId\|updateTask(item\.id\|function updateTask\|const updateTask"

# Count DndContexts
grep -rn "<DndContext" src/ --include="*.jsx" -c

# Find DndContexts without sensors prop
grep -rn "<DndContext" src/ --include="*.jsx" -B 5 | grep -v "sensors="

# Detect direct DB state changes bypassing applyTransitionRules
grep -rn "supabase.*from.*tasks.*update\|\.update({" src/ --include="*.js" --include="*.jsx" -n | \
  grep -v "safeUpsert\|useStore"
```
