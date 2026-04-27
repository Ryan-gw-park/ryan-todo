# Phase 9a Spec — 프로젝트 뷰 MS Owner UI

> 작성일: 2026-04-09
> 상태: 초안 (Claude Web 상세화 필요)

---

## 1. 목표

프로젝트 뷰의 MS(마일스톤) 행에 **owner 아바타를 항상 표시**하고, 클릭 시 팀 멤버 드롭다운으로 owner를 변경할 수 있게 한다.

---

## 2. 결정 사항 (사용자 확정)

| # | 항목 | 결정 |
|---|------|------|
| D1 | MS owner 표시 방식 | **항상 아바타 표시** + 클릭 시 멤버 드롭다운 |
| D2 | Task assignee 인라인 편집 | **현재 상태 유지** (CompactTaskRow에 이름 read-only + DetailPanel에서 편집) |
| D3 | 미지정(null) owner 표시 | **빈 원형 아이콘** (ghost avatar) |
| D4 | Timeline 탭 | **9a 범위에서 제외** (별도 Sub-Loop) |

---

## 3. 기능 범위

### 3-1. IN SCOPE

1. **CompactMilestoneRow에 owner avatar 추가**
   - progress badge `[3/7]` 옆에 MiniAvatar 표시
   - owner가 있으면: 이니셜 + 배경색 아바타
   - owner가 null이면: 회색 빈 원형 (ghost avatar)
   - 클릭 시: 팀 멤버 드롭다운 → owner 변경
   - `updateMilestone(id, { owner_id: userId })` 호출

2. **HierarchicalTree TreeCell에 owner avatar 추가**
   - title 옆 또는 progress bar 근처에 소형 MiniAvatar
   - owner가 있으면: 이니셜 아바타 (크기 16~18px)
   - owner가 null이면: ghost avatar
   - 클릭 시: 동일 멤버 드롭다운
   - TreeCell 공간 제약 고려 (COL_W_FIRST=160, COL_W_REST=150)

3. **MilestoneOwnerSelector 신규 컴포넌트**
   - `OwnerDropdown.jsx` 패턴 기반 (복제 후 milestone 용도로 변형)
   - Props: `milestoneId`, `ownerId`, `members`, `onChangeOwner`
   - 기존 `OwnerDropdown`은 수정하지 않음 ("Don't Touch, Wrap It")

4. **팀 모드에서만 표시**
   - `currentTeamId`가 있을 때만 owner avatar 렌더
   - 개인 모드(teamId=null)에서는 avatar 영역 숨김

### 3-2. OUT OF SCOPE

- Task assignee 인라인 편집 추가 (현재 상태 유지)
- MilestoneTaskChip에 assignee avatar 추가
- Timeline 탭 MS owner 표시
- DB 스키마 변경 (owner_id는 이미 존재)
- RLS 정책 변경

---

## 4. UI 사양 (초안 — 상세화 필요)

### 4-1. CompactMilestoneRow 레이아웃

```
현재:
┌────────────────────────────────────────────┐
│ ≡ ▶ ● 법인설립   [3/7]          [›]       │
│       title      progress       detail     │
└────────────────────────────────────────────┘

변경 후:
┌────────────────────────────────────────────┐
│ ≡ ▶ ● 법인설립   [3/7] (JK)    [›]       │
│       title      progress owner  detail    │
└────────────────────────────────────────────┘

미지정:
┌────────────────────────────────────────────┐
│ ≡ ▶ ● 법인설립   [3/7] (○)     [›]       │
│       title      progress ghost  detail    │
└────────────────────────────────────────────┘
```

### 4-2. HierarchicalTree TreeCell 레이아웃

```
현재:
┌────────────────┐
│ ● 법인설립      │
│   ████░░ 3/7   │
└────────────────┘

변경 후:
┌────────────────┐
│ ● 법인설립 (JK) │
│   ████░░ 3/7   │
└────────────────┘
```

### 4-3. MilestoneOwnerSelector 드롭다운

```
┌─────────────────────┐
│ ✕ 미지정             │
│─────────────────────│
│ (JK) 정규 Kim       │
│ (SH) 수현 Park  ✓   │   ← 현재 owner 하이라이트
│ (YJ) 영진 Lee       │
└─────────────────────┘
```

---

## 5. 데이터 흐름

```
사용자 클릭 avatar
  → MilestoneOwnerSelector 드롭다운 열림
  → 멤버 선택
  → onChangeOwner(userId) 콜백
  → updateMilestone(milestoneId, { owner_id: userId })
  → Zustand store 업데이트
  → UI 리렌더 (아바타 변경)
  → Supabase DB 동기화
```

---

## 6. 영향 파일

### 수정
| 파일 | 변경 |
|------|------|
| `src/components/project/CompactMilestoneRow.jsx` | owner avatar + selector 추가 (props 추가) |
| `src/components/project/HierarchicalTree.jsx` | TreeCell에 owner avatar 추가 |
| `src/components/project/MsTaskTreeMode.jsx` | members 데이터를 하위 컴포넌트에 전달 |
| `src/components/project/CompactMilestoneTab.jsx` | members 데이터를 CompactMilestoneRow에 전달 |

### 신규
| 파일 | 역할 |
|------|------|
| `src/components/project/MilestoneOwnerSelector.jsx` | MS용 owner 선택 드롭다운 |

### 수정 없음
| 파일 | 이유 |
|------|------|
| `useStore.js` | `updateMilestone` 이미 `owner_id` 지원 |
| `OwnerDropdown.jsx` | "Don't Touch" — 프로젝트 owner 전용 유지 |
| `AssigneeSelector.jsx` | Task assignee 변경 없음 |
| `DetailPanel.jsx` | 현재 상태 유지 |

---

## 7. 재사용 코드

| 코드 | 위치 | 사용 방법 |
|------|------|----------|
| `MiniAvatar` | `src/components/views/grid/shared/MiniAvatar.jsx` | owner/ghost 아바타 표시 |
| `OwnerDropdown` UI 패턴 | `src/components/project/OwnerDropdown.jsx` | 드롭다운 스타일 참고하여 복제 |
| `useTeamMembers.getMembers()` | `src/hooks/useTeamMembers.js` | 팀 멤버 목록 fetch |
| `updateMilestone(id, patch)` | `src/hooks/useStore.js` | owner_id 업데이트 |
| `memberMap` 패턴 | `MsTaskTreeMode.jsx:28-37` | userId → displayName 매핑 |

---

## 8. 기술 제약

1. **Vite TDZ**: MiniAvatar import 후 모듈 레벨에서 스타일 상수 참조 금지
2. **"Don't Touch, Wrap It"**: 기존 컴포넌트에는 **추가만** 수행 (삭제/변경 없음)
3. **개인 모드 호환**: `currentTeamId === null`일 때 owner UI 숨김
4. **TreeCell 공간**: COL_W_FIRST=160px, COL_W_REST=150px — 아바타 크기 16px 이하 권장

---

## 9. 상세화 필요 항목

> Claude Web 또는 사용자가 보강해야 할 부분

- [ ] Ghost avatar 디자인 상세 (색상, 보더, 크기)
- [ ] 드롭다운 포지셔닝 (아바타 기준 아래? 왼쪽?)
- [ ] TreeCell 아바타 정확한 위치 (title 오른쪽? progress bar 위?)
- [ ] 클릭 vs hover 상호작용 세부사항
- [ ] 드롭다운 닫힘 조건 (외부 클릭? ESC?)
- [ ] 애니메이션/트랜지션 필요 여부
- [ ] 모바일 대응 (터치 시 드롭다운 동작)
