# Phase 9a Spec (Final) — 프로젝트 뷰 MS Owner UI

> 작성일: 2026-04-09
> 상태: **확정** (목업 + 추가 제안 전부 수용)
> 선행: `9a-recon.md`, `9a-spec.md` (초안)

---

## 1. 목표

프로젝트 뷰의 MS(마일스톤) 행에 **오너 아바타를 항상 표시**하고, 클릭 시 팀 멤버 드롭다운으로 오너를 변경할 수 있게 한다. 매트릭스 뷰와 프로젝트 뷰는 동일한 `milestones.owner_id`를 source of truth로 사용하여 양방향 실시간 동기화된다.

---

## 2. 결정 사항 (전부 확정)

| # | 항목 | 결정 |
|---|------|------|
| D1 | MS owner 표시 방식 | **항상 아바타 표시** + 클릭 시 멤버 드롭다운 |
| D2 | Task assignee 인라인 편집 | 9a 범위 외 (현재 상태 유지, 9b 후속) |
| D3 | 미지정(null) owner 표시 | **Ghost 아바타**: 1px dashed `#B4B2A9` + 투명 배경 + 중앙 `+` 아이콘 |
| D4 | Timeline 탭 | 9a 범위 외 |
| D5 | 아바타 크기 계층 | L1=20px / L2=18px / L3=16px / TreeCell 내부=16px 고정 |
| D6 | 아바타 배치 | progress 카운트와 detail 화살표 `›` **사이** (오른쪽 끝 고정) |
| D7 | 혼합 오너 표현 | 부모 `owner_id=null`이지만 하위에 오너 존재 시 **스택 아바타 + `+N`** (최대 2 + 카운트) |
| D8 | Cascade 옵션 | 드롭다운 하단 "하위 MS 전체 적용" 버튼. **기본 동작: null인 하위만 채움**, 기존 오너 덮어쓰기는 confirm |
| D9 | 드롭다운 포지셔닝 | 아바타 기준 `right-aligned, top+4px`, 너비 200px |
| D10 | 드롭다운 닫힘 조건 | 외부 클릭 + ESC + 선택 완료 |
| D11 | 개인 모드 처리 | `visibility: hidden` + 동일 크기 spacer 유지 (레이아웃 shift 방지) |
| D12 | 접근성 | `role="button"` + `aria-label` + 키보드 네비(↑↓/Enter/Esc) |
| D13 | 낙관적 업데이트 | 실패 시 자동 롤백 (기존 store 동작 확인 후 보강) |
| D14 | 헤더 라벨 명시화 | `UnifiedProjectHeader`의 "오너:" → "**프로젝트 오너:**" (텍스트 1줄만 변경) |

---

## 3. 기능 범위

### 3-1. IN SCOPE

1. **`CompactMilestoneRow`에 오너 아바타 추가**
   - progress badge `[N]` 옆, detail 화살표 앞
   - 있으면 이니셜 아바타 (L1=20 / L2=18 / L3=16px)
   - 없으면 Ghost 아바타 (dashed)
   - 혼합 오너(부모 null, 자식 분산) → 스택 + `+N`
   - 클릭 → `MilestoneOwnerSelector` 드롭다운

2. **`HierarchicalTree` TreeCell에 오너 아바타 추가**
   - 항상 16px
   - title 오른쪽 끝, progress bar 위 라인
   - 동일 selector 재사용

3. **`MilestoneOwnerSelector` 신규 컴포넌트**
   - `OwnerDropdown.jsx` 패턴 기반 복제 (기존 파일 무수정)
   - Props: `milestoneId`, `ownerId`, `members`, `currentTeamId`, `hasChildren`, `onChangeOwner`, `onCascadeToChildren`
   - 드롭다운 하단에 하위 cascade 버튼 (hasChildren일 때만)
   - 접근성: role, aria-label, 키보드 네비

4. **혼합 오너 계산 유틸** (`src/utils/milestoneOwnerAggregate.js` 신규)
   - 입력: `milestone`, `allMilestones`
   - 출력: `{ mode: 'single' | 'ghost' | 'mixed', ownerId?, topOwners?: [id,id], extraCount? }`
   - 부모 자신에 `owner_id`가 있으면 single 우선
   - 없으면 자식 재귀 traverse → 고유 오너 집계 → 빈도순 top 2 + 나머지 카운트

5. **Cascade 로직** (`useStore.js` — 함수 추가만, 기존 무수정)
   - 신규 `cascadeMilestoneOwner(msId, ownerId, { overwrite })` 추가
   - 재귀 traverse → 단일 state update batch → 단일 Supabase RPC 또는 순차 update
   - Undo 대상: 하나의 단위 operation으로 처리

6. **매트릭스 ↔ 프로젝트 뷰 양방향 동기화 검증**
   - 별도 코드 수정 아님, **수동 QA 체크리스트** (§9)
   - 실패 시에만 selector 리렌더 트리거 보강

7. **`UnifiedProjectHeader` 텍스트 변경**
   - `오너:` → `프로젝트 오너:` (1줄, 로직 무수정)

8. **팀 모드 가드**
   - `currentTeamId === null` → 아바타 영역 `visibility: hidden` + 동일 너비 유지

### 3-2. OUT OF SCOPE

- Task assignee 인라인 편집
- MilestoneTaskChip assignee
- Timeline 탭 MS owner
- DB 스키마 / RLS 변경
- `OwnerDropdown`, `AssigneeSelector`, `DetailPanel` 수정

---

## 4. UI 사양

### 4-1. CompactMilestoneRow

```
L1: [≡] [▾] [●] 법인설립           [12] (JK)  [›]
         20px                       20px
L2:      [▾] [●] 지점설립           [4]  (JK)
              18px                   18px
L3:          [●] 대행사 계약         [1]  (SH)
              16px                   16px
Ghost:       [●] 설립등기            [1]  (○)
                                          dashed
Mixed:   [▸] [●] 회계/세무           [8]  (YJ)(+2)
                                          스택
```

### 4-2. 아바타 스펙

| 상태 | 스타일 |
|------|--------|
| Single | 배경색 (멤버 색상), 이니셜 2자, font 10px/9px (크기별) |
| Ghost | `border: 1px dashed #B4B2A9`, `background: transparent`, 중앙 `+` 아이콘 (8px, stroke #B4B2A9) |
| Mixed | 첫 아바타(최빈 오너) + 오른쪽으로 -6px overlap된 `+N` 원 (배경 `secondary`) |
| 현재값 outline | 드롭다운 열렸을 때 `outline: 2px solid [멤버색]; outline-offset: 1px` |

### 4-3. 드롭다운

```
┌─────────────────────────┐
│ 오너 지정                │  ← 11px, text-tertiary
├─────────────────────────┤
│ (○) 미지정              │
├─────────────────────────┤
│ (JK) 정규 Kim        ✓  │  ← 현재값 하이라이트
│ (SH) 수현 Park          │
│ (YJ) 영진 Lee           │
├─────────────────────────┤
│ ↗ 하위 MS에 전체 적용    │  ← hasChildren일 때만
└─────────────────────────┘
```

- 너비 200px 고정
- `box-shadow: 0 4px 16px rgba(0,0,0,0.08)`
- 외부 클릭/ESC/선택 시 닫힘
- 키보드: Tab 진입, ↑↓ 이동, Enter 선택, Esc 닫기

---

## 5. 데이터 흐름

```
단일 지정:
  avatar click → MilestoneOwnerSelector open
  → member select → onChangeOwner(userId)
  → updateMilestone(msId, { owner_id: userId })
  → Zustand → UI rerender → Supabase sync

Cascade:
  "하위 MS에 전체 적용" click
  → hasOverwriteTarget 체크 (자식 중 owner_id 이미 있는지)
  → 있으면 confirm("N개 하위 MS에 기존 오너가 있습니다. 덮어쓸까요?")
  → cascadeMilestoneOwner(msId, ownerId, { overwrite })
  → 재귀 traverse → batch update → 단일 undo op

혼합 오너 표시 (읽기):
  render MS row
  → computeOwnerDisplay(milestone, allMilestones)
  → mode=single|ghost|mixed → 해당 컴포넌트 렌더
```

---

## 6. 영향 파일

### 수정
| 파일 | 변경 |
|------|------|
| `src/components/project/CompactMilestoneRow.jsx` | 아바타 + selector 래핑, members props 추가 |
| `src/components/project/HierarchicalTree.jsx` | TreeCell에 16px 아바타 + selector |
| `src/components/project/MsTaskTreeMode.jsx` | members/allMilestones 하위 전달 |
| `src/components/project/CompactMilestoneTab.jsx` | members/allMilestones 전달 |
| `src/components/project/UnifiedProjectHeader.jsx` | "오너:" → "프로젝트 오너:" (1줄) |
| `src/hooks/useStore.js` | `cascadeMilestoneOwner` 함수 **추가** (기존 무수정) |

### 신규
| 파일 | 역할 |
|------|------|
| `src/components/project/MilestoneOwnerSelector.jsx` | MS용 오너 드롭다운 (cascade 포함) |
| `src/utils/milestoneOwnerAggregate.js` | 혼합 오너 계산 유틸 |

### 수정 없음 (Don't Touch)
`OwnerDropdown.jsx`, `AssigneeSelector.jsx`, `DetailPanel.jsx`, `MiniAvatar.jsx`, DB 스키마, RLS

---

## 7. 기술 제약 & 리스크 대응

1. **Vite TDZ**: `MiniAvatar`, `designTokens` import 후 모듈 레벨 const 참조 금지. 모든 스타일은 컴포넌트 함수 내부 inline.
2. **"Don't Touch, Wrap It"**: 기존 컴포넌트는 props 추가만 허용. 내부 로직/마크업 변경 금지.
3. **레이아웃 shift 방지**: 개인 모드에서 `display: none` 대신 `visibility: hidden` + 고정 width spacer.
4. **Undo 원자성**: cascade 결과는 단일 operation으로 기록하여 Ctrl+Z 한 번에 전체 롤백.
5. **낙관적 업데이트 실패 롤백**: `updateMilestone`/`cascadeMilestoneOwner`에 try/catch + 이전 state 보관 → 실패 시 revert. 기존 store에 이미 있으면 확인만, 없으면 cascade 함수에만 추가.
6. **재귀 depth**: 순환 참조 방지 위해 traverse에 visited Set.

---

## 8. 구현 순서 (R-ATOMIC, 한 커밋당 하나)

| # | 커밋 | 목적 |
|---|------|------|
| 1 | `feat: add milestoneOwnerAggregate util` | 혼합 오너 계산 로직 (pure, 테스트 가능) |
| 2 | `feat: add cascadeMilestoneOwner to store` | Store 함수 추가 + 롤백 |
| 3 | `feat: add MilestoneOwnerSelector component` | 드롭다운 UI (단독 렌더 가능) |
| 4 | `feat: integrate owner avatar in CompactMilestoneRow` | MsTaskTreeMode에서 props 전달 포함 |
| 5 | `feat: integrate owner avatar in HierarchicalTree TreeCell` | TreeCell 16px 아바타 |
| 6 | `feat: integrate owner avatar in CompactMilestoneTab` | 대안 레이아웃 경로 |
| 7 | `chore: rename header label to 프로젝트 오너` | UnifiedProjectHeader 1줄 |

각 커밋은 독립적으로 빌드 통과 + UI 회귀 없음.

---

## 9. QA 체크리스트

### 9-1. 기본 동작
- [ ] L1/L2/L3 MS 각각 아바타 크기 20/18/16 확인
- [ ] Ghost 아바타 dashed 렌더
- [ ] 아바타 클릭 → 드롭다운 열림
- [ ] 멤버 선택 → 아바타 즉시 교체
- [ ] 미지정 선택 → Ghost로 복귀
- [ ] 외부 클릭 / ESC / 선택 시 닫힘
- [ ] 개인 모드 진입 시 아바타 숨김, 레이아웃 shift 없음

### 9-2. 혼합 오너
- [ ] 부모 `owner_id=null`, 자식 2명 → 두 아바타 스택
- [ ] 자식 3명 이상 → 상위 2 + `+N`
- [ ] 부모에 직접 지정 시 mixed 표시 사라지고 single로 전환

### 9-3. Cascade
- [ ] 자식 전부 null → confirm 없이 즉시 cascade
- [ ] 일부 자식에 기존 오너 → confirm 다이얼로그 노출
- [ ] confirm 취소 → 아무 변경 없음
- [ ] Ctrl+Z → 전체 cascade가 한 번에 롤백

### 9-4. 매트릭스 ↔ 프로젝트 뷰 양방향 (⭐ 중요)
- [ ] 프로젝트 뷰에서 JK→SH 변경 → 매트릭스 [ABI×JK] 셀에서 사라짐
- [ ] 동시에 매트릭스 [ABI×SH] 셀에 등장
- [ ] 매트릭스 셀 드래그로 MS 이동 → 프로젝트 뷰 아바타 즉시 변경
- [ ] 실패 케이스: selector가 캐싱하여 리렌더 안 되면 셀렉터 메모이제이션 재검토

### 9-5. 접근성
- [ ] 키보드만으로 아바타 focus → Enter → 드롭다운 → ↑↓ → Enter 선택 가능
- [ ] 스크린리더 `aria-label` 읽힘 ("오너: 정규 Kim, 클릭하여 변경")
- [ ] Ghost 상태 `aria-label` 읽힘 ("오너 미지정, 클릭하여 지정")

### 9-6. 빌드 & TDZ
- [ ] `npm run build` 성공
- [ ] 프로덕션 빌드에서 TDZ 오류 없음 (`designTokens`, `MiniAvatar` 관련)
- [ ] 기존 뷰 회귀 없음 (매트릭스/주간/타임라인/노트)

---

## 10. 재사용 코드

| 코드 | 위치 |
|------|------|
| `MiniAvatar` | `src/components/views/grid/shared/MiniAvatar.jsx` |
| `OwnerDropdown` UI 패턴 (참고만) | `src/components/project/OwnerDropdown.jsx` |
| `useTeamMembers.getMembers()` | `src/hooks/useTeamMembers.js` |
| `updateMilestone` | `src/hooks/useStore.js:1034` |
| `memberMap` 패턴 | `MsTaskTreeMode.jsx:28-37` |
| 색상 토큰 | `src/styles/designTokens.js` (COLOR, FONT) |

---

## 11. REQ-LOCK 체크리스트 (skill 준수)

- [ ] D1~D14 14개 결정 사항 전부 반영
- [ ] IN SCOPE 8개 항목 전부 diff에 포함
- [ ] OUT OF SCOPE 5개 항목 diff에 포함 안 됨
- [ ] 영향 파일 수정/신규/무수정 분류 정확
- [ ] 구현 순서 7 커밋 각각 독립 빌드 통과
- [ ] QA 체크리스트 §9 전부 통과

---

## 12. 다음 단계

1. 본 스펙을 Claude Web(Opus)에 전달 → §8 순서대로 R-ATOMIC diff 7개 작성
2. Claude Code가 각 diff를 순차 apply + build + commit
3. 모든 커밋 후 §9 QA 수행
4. 9b 후속(Task assignee 인라인 편집 + EntityOwnerSelector generalize) 스펙 착수
