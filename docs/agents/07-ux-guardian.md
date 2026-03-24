# Agent 07: UX Guardian

> Protects user experience consistency, discoverability, empty states, navigation clarity, and accessibility.
> Baseline: 2026-03-24 (Loop-39 sidebar restructure)

---

## BLOCK Rules

### B1. Empty State Messages

Every view MUST display a contextual empty state message when no data is available. Messages must include guidance on how to populate the view.

Examples:

Personal matrix (no assigned tasks):
  "배정된 할일이 없습니다. 팀 매트릭스에서 할일을 배정받거나, + 추가로 직접 생성하세요."

Personal timeline (no owned MS):
  "담당 마일스톤이 없습니다. 프로젝트 뷰에서 마일스톤 담당자를 설정하세요."

Personal weekly (no tasks this week):
  "이번 주 예정된 할일이 없습니다."

New team member first visit (all views empty):
  All team views show data but personal views may be empty.
  Show: "아직 배정된 업무가 없습니다. 팀 매트릭스에서 업무를 배정받으세요."

### B2. Feature Discoverability

Every user-facing feature must have a clear discovery path. If a feature can only be found by accident, it's a BLOCK.

Discovery path inventory:

| Feature | Discovery Path | Fallback |
|---------|---------------|----------|
| Team/Personal switch | Sidebar section navigation | always visible |
| 매트릭스 할일 tab restored | [할일][마일스톤][담당자별] toggle | visible always |
| + 추가 in every cell | Text link in each grid cell | visible always |
| Personal matrix layout differs | Automatic by scope | header indicates scope |
| Scope badge in header | "팀 매트릭스" / "개인 매트릭스" text | visible always |

### B6. Navigation Clarity

User must always know where they are in the app structure.

Scope identification:
- View header MUST show scope: "팀 매트릭스" not just "매트릭스"
- Active sidebar item provides visual context (which section am I in?)
- If user is in "할일 > 개인 > 매트릭스", header shows "개인 매트릭스"

Sidebar section state:
- All sub-sections (팀/개인) default to expanded
- Collapsed state persists across navigation (localStorage or store)
- Collapsing "팀" section does not affect "개인" section

---

## Known Divergences

| ID | Severity | Description |
|----|----------|-------------|
| KD-7.6 | INFO | Sidebar restructure transition (Loop-39): Existing users will experience: 1) Sidebar completely reorganized (3 sections instead of 2), 2) "오늘 할일" renamed to "지금 할일", 3) [전체\|팀\|개인] toggle gone — replaced by sidebar navigation, 4) Same view name appears twice (팀/개인) — distinguished by section, 5) 매트릭스 할일 tab restored (was removed in Loop-38). Recommendation: first-visit banner or tooltip "사이드바가 새로워졌습니다. 팀/개인 뷰가 분리되었습니다." Dismissible, shown once per user. |
| KD-7.7 | **HIGH** | + 추가 in every view (Loop-39): ALL grid-based views must have "+ 추가" or "+ 할일 추가" in every cell/section. This is a hard requirement — no view should be read-only for task creation. |

### KD-7.7 Inventory: + 추가 Locations

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

---

## Convergence Targets

| ID | Target | Work |
|----|--------|------|
| CT-7.1 | KD-7.6 | Add first-visit transition banner for sidebar restructure |
| CT-7.2 | KD-7.7 | Audit all views for + 추가 presence, add where missing |

---

## Verification Commands

```bash
# Find views without InlineAdd or + 추가
grep -rn "InlineAdd\|추가" src/components/views/ --include="*.jsx" -l

# Check empty state messages
grep -rn "없습니다\|비어 있습니다\|no data\|empty" src/components/views/ --include="*.jsx" -n

# Verify scope in view headers
grep -rn "팀 매트릭스\|개인 매트릭스\|팀 타임라인\|개인 타임라인" src/components/ --include="*.jsx" -n
```
