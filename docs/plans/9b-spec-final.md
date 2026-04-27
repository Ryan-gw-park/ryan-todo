# Phase 9b Spec (Final v2) — 프로젝트 뷰 BacklogPanel

> 작성일: 2026-04-09
> 상태: **확정 v2** (9a 구현 완료 반영, DnD 분리, EntityOwnerSelector → TaskAssigneeChip)
> 선행: `9b-recon.md`, `9b-spec.md`, `9a-spec-final.md`, 9a 구현 (`cc1544d`)

---

## 1. 목표

프로젝트 뷰(전체 할일 + 타임라인 + Compact 모드)에 **항상 표시되는 280px 우측 백로그 패널**을 추가한다. 미배정/배정 2-섹션 분할, 검색/필터, 인라인 추가, `TaskAssigneeChip`을 통한 인라인 assignee 변경을 포함한다.

**DnD(백로그→MS 드래그)는 9c로 분리.**

---

## 2. 확정 결정사항 (전부 lock)

| # | 항목 | 결정 |
|---|------|------|
| D1 | DnD | **9c로 분리**. 9b는 표시+편집만 |
| D2 | DnD 충돌 해결 | 9c 범위 (MsTaskTreeMode dnd-kit 마이그레이션) |
| D3 | Age 표시 | `createdAt` 없음 → **`updatedAt` 기반 정렬 토글** ("최근순/오래된순") |
| D4 | 오래된 task 시각화 | 7일 이상 미수정 task에 `🕒` 아이콘 (오래된순 정렬 시) |
| D5 | 타임라인 모드 | **표시** |
| D6 | Compact 모드 | **통합**. CompactMilestoneTab의 하단 `BACKLOG_MS` 제거 + 동일 BacklogPanel 마운트 |
| D7 | 반응형 | **단순 숨김** (< 1024px → `display: none`) |
| D8 | 카운트 경고색 | amber 800/50 (6~15) / red 800/50 (16+) — 디자인 토큰 기반 |
| D9 | 정렬 | 기본 `sortOrder` ASC, 토글 시 `updatedAt` DESC/ASC |
| D10 | DB 변경 | 없음 |
| D11 | 2-섹션 분할 | **미배정 → 배정됨** 순서, 각 섹션 카운트 표시 |
| D12 | 검색/필터 | 검색 input + chip(`내 것만` / `미배정` / `기한 임박`, 단일 선택) |
| D13 | Task assignee 변경 | **`TaskAssigneeChip.jsx` 신규** (MilestoneOwnerSelector와 별도) |
| D14 | 9a 영향 | **없음**. MilestoneOwnerSelector 유지, 리네임/이동 없음 |
| D15 | dueDate 임박 표시 | D-3 이내 → red pill, 그 외 → 회색 텍스트 |
| D16 | 빈 상태 | `✓ 백로그가 깨끗합니다` 메시지 |
| D17 | 카운트 클릭 동작 | 9b 범위 외 (단순 표시만) |
| D18 | 매트릭스 ↔ 백로그 동기화 | 별도 코드 무수정, QA 체크리스트로 검증 |

---

## 3. 9a 영향

**없음.** 9a는 이미 구현 완료 (`cc1544d`).

- `MilestoneOwnerSelector.jsx` → 그대로 유지 (`src/components/project/`)
- `milestoneOwnerAggregate.js` → 그대로 유지
- `cascadeMilestoneOwner` store 함수 → 그대로 유지

9b는 task assignee용으로 별도 `TaskAssigneeChip.jsx`를 신규 생성한다. MS owner selector와 task assignee selector는 요구사항이 다르므로 (cascade, mixed 모드 등) 분리가 적절.

---

## 4. 기능 범위

### 4-1. IN SCOPE

1. **`BacklogPanel.jsx` 신규** (280px 우측 사이드패널)
   - 2-섹션 (미배정 / 배정됨), 섹션별 카운트
   - 검색 input + 빠른 필터 chip
   - 정렬 토글 (sortOrder / updatedAt)
   - 인라인 추가 (`InlineAdd` 재사용, `keyMilestoneId: null`)
   - 빈 상태 메시지
   - 반응형: < 1024px 숨김

2. **각 task 행**
   - 체크박스 (`toggleDone`)
   - 텍스트 (클릭 → `openDetail`)
   - dueDate (D-3 이내 red pill, 그 외 회색)
   - assignee 아바타 (있으면 이니셜 / 없으면 ghost)
   - **아바타 클릭 → `TaskAssigneeChip`** 드롭다운
   - 7일 이상 미수정 + 오래된순 정렬 시 `🕒` 인디케이터

3. **`TaskAssigneeChip.jsx` 신규**
   - 14px MiniAvatar (단순 멤버 드롭다운)
   - cascade 없음, mixed 모드 없음
   - 클릭 → 멤버 목록 → 선택 시 `updateTask(id, { assigneeId })`
   - 미배정: ghost 아바타 (dashed border)

4. **`UnifiedProjectView` 레이아웃 변경**
   - flex: `[메인 flex:1] [BacklogPanel 280px]`
   - 전체 할일 + 타임라인 모두에서 표시

5. **`CompactMilestoneTab` 통합**
   - `BACKLOG_MS` pseudo-milestone 제거
   - 하단 백로그 섹션 마크업 제거
   - 우측에 동일 `BacklogPanel` 마운트

6. **`backlogFilter` 유틸 신규** (`src/utils/backlogFilter.js`)
   - `isBacklogTask(task)` → `!task.keyMilestoneId && !task.done && !task.deletedAt`

### 4-2. OUT OF SCOPE (9c 이후)

- **백로그 → MS DnD** (MsTaskTreeMode dnd-kit 마이그레이션 필요)
- 카운트 클릭 시 dialog
- 일괄 선택 / 일괄 배정
- BacklogFilter 17+ 사용처 일괄 마이그레이션
- DB 스키마 변경

---

## 5. UI 사양

### 5-1. 레이아웃

```
┌──────────────────────────────────────────┬──────────────┐
│ UnifiedProjectView 메인 (flex:1)         │ BacklogPanel │
│  ┌─ 헤더 ─────────────────────────────┐  │ (280px)      │
│  │ ABI 코리아 · 프로젝트 오너: ▾      │  │              │
│  │              [전체 할일][타임라인]  │  │  📥 백로그 12 │
│  ├──────────────────────────────────┤  │  ├──────────┤ │
│  │ MsTaskTreeMode / Timeline /       │  │  검색 / 필터 │
│  │ CompactMilestoneTab               │  │  ├──────────┤ │
│  │  (기존 그대로)                      │  │  미배정 4   │
│  │                                   │  │  □ task     │
│  │                                   │  │  ├──────────┤ │
│  │                                   │  │  배정됨 8   │
│  │                                   │  │  □ task (JK)│
│  │                                   │  │  ├──────────┤ │
│  │                                   │  │  + 추가      │
│  └──────────────────────────────────┘  │              │
└──────────────────────────────────────────┴──────────────┘
        DetailPanel (z-100, 위에 overlay)
```

### 5-2. 헤더

```
📥 백로그          [N badge]
[검색…                    ]
[내 것만] [미배정] [기한 임박]    [기본순 ▾]
```

| 카운트 N | badge 색상 |
|---------|-----------|
| 0~5 | bg `secondary` / text `secondary` |
| 6~15 | bg `#FAEEDA` / text `#854F0B` (amber 800/50) |
| 16+ | bg `#FCEBEB` / text `#A32D2D` (red 800/50) |

### 5-3. 섹션 헤더

```
미배정 ─────────────  4
```
- 11px text-tertiary, 양옆 hairline divider, 카운트 우측 정렬

### 5-4. Task 행

```
□  법인 도장 제작                          (○)
□  사무실 임대 검토         [04-12]        (○)   ← red pill (D-3 이내)
□  은행 후보 리서치          04-15         (JK)
□  노무사 컨택                              (SH)  ← hover bg
🕒 □  오래된 task              03-28         (YJ)  ← 7일+ 미수정 + updatedAt 정렬 시
```

- 행 높이 28px, padding 6px 8px
- hover bg `--color-background-secondary`
- 체크박스 12px
- text 12px
- 아바타 14px (목록 컴팩트), 클릭 시 `TaskAssigneeChip` 열림
- dueDate D-3 이내: `bg: #FCEBEB; color: #A32D2D; padding: 1px 5px; border-radius: 3px`
- dueDate 그 외: `color: text-tertiary` 일반 텍스트
- done task: 필터에서 제외 (즉시 사라짐)

### 5-5. 정렬 토글

- 헤더 우측 작은 셀렉트: `[기본순 ▾]` / `[최근순 ▾]` / `[오래된순 ▾]`
- `기본순` = `sortOrder ASC` (기본값)
- `최근순` = `updatedAt DESC`
- `오래된순` = `updatedAt ASC` (+ 7일+ task에 `🕒`)

### 5-6. 빈 상태

```
        ✓
   백로그가 깨끗합니다
```
- 가운데 정렬, color `#085041` (teal 800)

---

## 6. 데이터 흐름

### 6-1. 표시
```
projectTasks
  → backlogFilter.isBacklogTask
  → searchQuery + filter chip 적용
  → 정렬 (sortOrder/updatedAt)
  → 미배정 vs 배정됨 분할
  → render
```

### 6-2. 인라인 assignee 변경
```
avatar click
  → TaskAssigneeChip open
  → 멤버 선택
  → updateTask(id, { assigneeId: userId })
  → '미배정' 섹션 → '배정됨' 섹션 자동 이동
```

---

## 7. 영향 파일

### 신규
| 파일 | 역할 |
|------|------|
| `src/components/project/BacklogPanel.jsx` | 280px 사이드패널 |
| `src/components/project/TaskAssigneeChip.jsx` | task assignee 인라인 변경 |
| `src/utils/backlogFilter.js` | 백로그 필터 유틸 |

### 수정
| 파일 | 변경 |
|------|------|
| `src/components/project/UnifiedProjectView.jsx` | flex 레이아웃 + BacklogPanel 마운트 |
| `src/components/project/CompactMilestoneTab.jsx` | `BACKLOG_MS` 제거 + BacklogPanel 마운트 |

### 수정 없음
- `MilestoneOwnerSelector.jsx` (9a 유지)
- `MsTaskTreeMode.jsx` (DnD 마이그레이션은 9c)
- `useStore.js` (`updateTask`, `toggleDone`, `openDetail` 이미 존재)
- `InlineAdd.jsx`, `MiniAvatar.jsx`, `DetailPanel.jsx`
- DB 스키마, RLS

---

## 8. 기술 제약 & 리스크

| # | 리스크 | 대응 |
|---|--------|------|
| R1 | CompactMilestoneTab BACKLOG_MS 제거 시 기존 DnD 핸들러 영향 | `__backlog__` 관련 drop 로직도 함께 정리 |
| R2 | Vite TDZ | 모든 스타일 컴포넌트 함수 내부 inline |
| R3 | 1024px 경계 layout shift | CSS media query로 `display: none` (mount 유지) |
| R4 | DetailPanel과 z-index 충돌 | BacklogPanel은 일반 flow (z-index 없음) → 자동 해결 |
| R5 | CompactMilestoneTab에 BacklogPanel 마운트 시 DndContext 범위 | BacklogPanel은 DnD 없으므로 기존 DndContext 영향 없음 |

---

## 9. 구현 순서 (R-ATOMIC)

| # | 커밋 | 목적 |
|---|------|------|
| 1 | `feat(utils): add backlogFilter util` | pure 유틸 |
| 2 | `feat(project): add TaskAssigneeChip component` | task assignee 드롭다운 |
| 3 | `feat(project): add BacklogPanel component` | 단독 렌더 가능 (표시+편집) |
| 4 | `feat(project): integrate BacklogPanel into UnifiedProjectView` | flex 레이아웃 변경 |
| 5 | `refactor(project): remove BACKLOG_MS from CompactMilestoneTab + mount BacklogPanel` | Compact 모드 통합 |

각 커밋 독립 빌드 가능 + UI 회귀 없음.

---

## 10. QA 체크리스트

### 10-1. 표시
- [ ] UnifiedProjectView 우측에 BacklogPanel 280px
- [ ] CompactMilestoneTab 우측에 BacklogPanel 280px (하단 백로그 사라짐)
- [ ] 타임라인 모드에서도 BacklogPanel 표시
- [ ] 전체 할일 모드에서도 BacklogPanel 표시
- [ ] 미배정/배정됨 2-섹션 + 각 카운트
- [ ] 카운트 색상 (0~5 회색 / 6~15 amber / 16+ red)
- [ ] dueDate D-3 이내 red pill
- [ ] 7일 이상 미수정 task에 🕒 (오래된순 정렬 시)
- [ ] 빈 상태 "백로그가 깨끗합니다"

### 10-2. 인터랙션
- [ ] 체크박스 토글 → done → 목록에서 사라짐
- [ ] task 클릭 → DetailPanel 열림 (BacklogPanel 위 overlay)
- [ ] 아바타 클릭 → TaskAssigneeChip 드롭다운 열림
- [ ] assignee 변경 → 미배정 ↔ 배정됨 자동 이동
- [ ] 인라인 추가 → 백로그 task 생성 (`keyMilestoneId: null`)
- [ ] 검색 input → 실시간 필터링
- [ ] 필터 chip 단일 선택 동작
- [ ] 정렬 토글 (기본순/최근순/오래된순)

### 10-3. CompactMilestoneTab 회귀
- [ ] 하단 BACKLOG_MS 사라짐
- [ ] 기존 task→MS DnD 정상 동작
- [ ] MS reorder 정상 동작
- [ ] 인라인 task 추가 정상

### 10-4. 매트릭스 ↔ 백로그 동기화
- [ ] 매트릭스에서 task를 MS에 배정 → 백로그에서 사라짐
- [ ] 백로그에서 assignee 변경 → 매트릭스 셀 반영

### 10-5. 반응형 & 빌드
- [ ] 1024px 미만에서 BacklogPanel 숨김
- [ ] 1024px 이상에서 다시 표시
- [ ] `npm run build` 성공
- [ ] Vite TDZ 오류 없음
- [ ] 모든 기존 뷰 회귀 없음

---

## 11. 후속 작업 (9c)

1. MsTaskTreeMode 네이티브 HTML5 DnD → dnd-kit 마이그레이션
2. BacklogPanel → MS 트리 cross-drop 활성화
3. UnifiedProjectView 단일 DndContext
4. CompactMilestoneTab DnD context 공유
