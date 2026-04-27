# Phase 9a Recon — 프로젝트 뷰 Assignee + MS Owner UI

> 작성일: 2026-04-09
> 상태: Recon 완료

---

## 1. 요구사항 요약

> "프로젝트 화면에서 담당자는 마일스톤에도 담당자 Assign이 필요하다. 팀 매트릭스뷰에서 마일스톤을 담당자에게 매핑이 되면 그게 마일스톤의 담당자가 되는 것이고, 매트릭스 셀에서 정의된 프로젝트x담당자 셀에서 마일스톤과 할일은 그 즉시 해당 담당자로 배정이 되어야 한다."

- **매트릭스에서의 자동 배정**: 이미 7-C/7-D에서 구현 완료 (MS `owner_id`, task `assigneeId` 자동 set)
- **프로젝트 뷰에서의 표시/편집**: 현재 **미구현** — 이것이 9a의 범위

---

## 2. 현재 상태 분석

### 2-1. 이미 존재하는 것

| 항목 | 위치 | 상태 |
|------|------|------|
| `AssigneeSelector` (task 배정 UI) | `src/components/shared/AssigneeSelector.jsx` | DetailPanel에서만 사용 |
| `OwnerDropdown` (프로젝트 owner 선택) | `src/components/project/OwnerDropdown.jsx` | UnifiedProjectHeader에서 사용 |
| `MiniAvatar` (이니셜 아바타) | `src/components/views/grid/shared/MiniAvatar.jsx` | 매트릭스 헤더에서 사용 |
| `updateTask(id, { assigneeId })` | `src/hooks/useStore.js:534` | R1 규칙 자동 적용 |
| `updateMilestone(id, { owner_id })` | `src/hooks/useStore.js:1034` | 사용 가능 |
| `useTeamMembers.getMembers(teamId)` | `src/hooks/useTeamMembers.js` | `{ userId, displayName, avatarUrl, role }` 반환 |
| `OutlinerTaskNode` assignee 표시 | `src/components/project/tasks/OutlinerTaskNode.jsx:173` | 이름만 read-only 표시 |

### 2-2. 프로젝트 뷰 컴포넌트 구조

```
UnifiedProjectView.jsx
├── UnifiedProjectHeader.jsx        ← OwnerDropdown 있음 (프로젝트 owner)
├── MsTaskTreeMode.jsx              ← 좌: MS 트리, 우: task 목록
│   ├── HierarchicalTree.jsx        ← MS 트리 렌더 (TreeCell)
│   │   └── TreeCell (inline)       ← ❌ owner 없음
│   └── task 영역
│       └── CompactTaskRow.jsx      ← assigneeName prop 있음 (이미 표시!)
├── CompactMilestoneTab.jsx         ← 대안 레이아웃
│   └── CompactMilestoneRow.jsx     ← ❌ owner 없음
│       └── MilestoneTaskChip.jsx   ← ❌ assignee 없음
└── Timeline 탭
    └── TimelineMsRow.jsx           ← 별도 검토 필요
```

### 2-3. 현재 UI Gap

| 컴포넌트 | Assignee (task) | Owner (MS) | 비고 |
|----------|:-:|:-:|------|
| DetailPanel | ✅ 편집 가능 | ❌ | AssigneeSelector 사용 |
| OutlinerTaskNode | ✅ read-only 이름 | - | line 173 |
| CompactTaskRow | ✅ 이름 표시 | - | assigneeName prop |
| HierarchicalTree TreeCell | - | ❌ | 공간 협소 |
| CompactMilestoneRow | - | ❌ | **핵심 추가 대상** |
| MilestoneTaskChip | ❌ | - | 칩 크기 작음 |

---

## 3. 구현 옵션

### 옵션 A: MS Owner 인라인 아바타 + 클릭 드롭다운 (권장)

**MS 행에 owner avatar 표시 + 클릭 시 OwnerDropdown 스타일 선택**

- `CompactMilestoneRow`: progress badge 옆에 `MiniAvatar` + 클릭 시 멤버 드롭다운
- `HierarchicalTree TreeCell`: title 옆에 작은 `MiniAvatar` (hover 시 이름 tooltip)
- Task assignee: 이미 `CompactTaskRow`에 이름 표시됨 → **충분할 수 있음**

**Trade-off**:
- (+) 기존 `OwnerDropdown` 패턴 재사용 가능
- (+) 시각적 일관성 (매트릭스 헤더의 MiniAvatar와 동일)
- (-) TreeCell 공간이 좁아 레이아웃 조정 필요

### 옵션 B: MS Owner hover 시만 표시

**평소에는 숨기고, MS 행 hover 시 작은 아바타/선택 버튼 노출**

- `CompactMilestoneRow`: hover 시 detail 버튼 옆에 owner 아이콘 등장
- `HierarchicalTree TreeCell`: hover 시 소형 owner badge

**Trade-off**:
- (+) 공간 절약, 깔끔한 기본 상태
- (-) 담당자가 누군지 한눈에 안 보임 (원래 요구사항과 충돌 가능)
- (-) 호버 의존 → 모바일에서 문제

### 옵션 C: MilestoneOwnerDropdown 신규 컴포넌트

**OwnerDropdown을 milestone용으로 분기/복제**

- `OwnerDropdown`은 현재 프로젝트 owner 전용 (`projectId` prop)
- Milestone용으로 `MilestoneOwnerSelector` 신규 생성, `milestoneId` + `ownerId` + `onChangeOwner` props
- 내부적으로 `updateMilestone(id, { owner_id })` 호출

**Trade-off**:
- (+) 관심사 분리 깔끔
- (-) OwnerDropdown과 80% 중복 코드
- 대안: OwnerDropdown에 `entityType` prop 추가 → "Don't Touch, Wrap It" 위반 가능성

---

## 4. 재사용 가능한 기존 코드

| 코드 | 위치 | 재사용 방법 |
|------|------|------------|
| `MiniAvatar` | `src/components/views/grid/shared/MiniAvatar.jsx` | MS owner / task assignee 아바타 표시 |
| `OwnerDropdown` UI 패턴 | `src/components/project/OwnerDropdown.jsx` | 드롭다운 스타일/로직 참고 (복제 후 milestone용 변형) |
| `AssigneeSelector` | `src/components/shared/AssigneeSelector.jsx` | task assignee 선택 로직 참고 |
| `useTeamMembers.getMembers()` | `src/hooks/useTeamMembers.js` | 팀 멤버 목록 fetch |
| `updateMilestone(id, patch)` | `src/hooks/useStore.js:1034` | MS owner 업데이트 |
| `memberMap` 패턴 | `MsTaskTreeMode.jsx:28-37` | userId → displayName 매핑 (이미 구현) |

---

## 5. 영향 파일 목록

### 수정 대상
| 파일 | 변경 내용 |
|------|----------|
| `src/components/project/CompactMilestoneRow.jsx` | Owner avatar + selector 추가 |
| `src/components/project/HierarchicalTree.jsx` | TreeCell에 owner avatar 추가 |
| `src/components/project/MsTaskTreeMode.jsx` | memberMap/members를 하위 컴포넌트에 전달 |

### 신규 생성 가능
| 파일 | 역할 |
|------|------|
| `src/components/project/MilestoneOwnerSelector.jsx` | MS용 owner 선택 드롭다운 (OwnerDropdown 패턴 기반) |

### 수정 불필요 (이미 동작)
| 파일 | 이유 |
|------|------|
| `CompactTaskRow.jsx` | assigneeName 이미 표시 |
| `OutlinerTaskNode.jsx` | assignee 이름 이미 표시 |
| `DetailPanel.jsx` | AssigneeSelector 이미 통합 |
| `useStore.js` | updateMilestone 이미 owner_id 지원 |

---

## 6. 위험 요소 및 사전 확인

| # | 위험 | 영향 | 대응 |
|---|------|------|------|
| 1 | HierarchicalTree TreeCell 공간 부족 | owner avatar가 title/progress와 겹칠 수 있음 | TreeCell 너비(COL_W_FIRST=160, COL_W_REST=150) 확인 후 avatar 크기 결정 |
| 2 | "Don't Touch, Wrap It" 규칙 | CompactMilestoneRow, HierarchicalTree는 기존 파일 | **추가만** 수행 (삭제/변경 없음). Props 추가는 허용 범위 |
| 3 | 개인 모드(teamId=null)에서 불필요한 UI 노출 | owner selector가 개인 프로젝트에 뜨면 혼란 | `currentTeamId` 체크로 팀 모드에서만 표시 |
| 4 | OwnerDropdown 직접 수정 유혹 | milestone용으로 변경하면 프로젝트 owner UI 깨질 수 있음 | 신규 컴포넌트로 분리 |
| 5 | MilestoneTaskChip에 assignee 추가 시 레이아웃 깨짐 | 칩이 작아서 avatar 넣으면 overflow | 현재 CompactTaskRow에 이미 표시되므로 칩에는 추가 불필요할 수 있음 |
| 6 | Vite TDZ | MiniAvatar import 시 모듈 레벨 상수 참조 주의 | 모든 스타일 참조는 함수 내부 inline |

---

## 7. 결정 필요사항 (Spec 단계에서 확정)

1. **MS owner 표시 방식**: 항상 표시(옵션 A) vs hover 시만(옵션 B)?
2. **MS owner 편집 위치**: 인라인(MS 행에서 직접) vs DetailModal에서만?
3. **Task assignee**: CompactTaskRow의 현재 이름 표시로 충분? 인라인 선택도 필요?
4. **MilestoneTaskChip**: assignee avatar 추가 필요? (공간 제약)
5. **Timeline 탭**: MS owner 표시 필요? (별도 Sub-Loop?)
6. **미지정(null) owner 표시**: 아이콘? 텍스트? 숨김?
