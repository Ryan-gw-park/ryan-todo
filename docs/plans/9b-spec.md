# Phase 9b Spec — 프로젝트 뷰 BacklogPanel (우측 사이드패널)

> 작성일: 2026-04-09
> 기준: `9b-recon.md`
> 상태: **초안** (상세화 필요)

---

## 1. 목표

프로젝트 뷰(전체 할일 + 타임라인) 우측에 **항상 표시되는 280px 백로그 패널**을 추가한다. MS에 연결되지 않은 task를 한눈에 파악하고, 인라인으로 관리할 수 있게 한다.

---

## 2. 확정된 결정사항

| # | 항목 | 결정 | 근거 |
|---|------|------|------|
| D1 | DnD | **Phase 분리**. 9b: 표시+편집만. DnD(백로그→MS 드래그)는 후속 | MsTaskTreeMode 네이티브 DnD와 dnd-kit 혼재 위험 |
| D2 | Age 표시 | **생략** | tasks 테이블에 `createdAt` 없음. DB 마이그레이션 불필요 |
| D3 | 타임라인 모드 | **표시** | 전체 할일 + 타임라인 모두에서 BacklogPanel 표시 |
| D4 | 반응형 | **좁은 화면(< 1024px) 숨김** | 토글 버튼 없이 단순 숨김 (데스크톱 우선) |
| D5 | 카운트 경고색 | **유지** (0~5 회색 / 6~15 노랑 / 16+ 빨강) | handoff 원안 |
| D6 | 정렬 | `sortOrder` 기본 | 기존 task 정렬 패턴과 일관 |
| D7 | DB 변경 | **없음** | 기존 필드만 사용 |
| D8 | Compact 모드 | **미적용** | CompactMilestoneTab은 이미 하단 백로그 있음 |

---

## 3. 기능 범위

### 3-1. BacklogPanel 레이아웃

```
┌──────────────────────────────────────────────────────┬─────────────────┐
│ UnifiedProjectView (flex: 1)                         │ BacklogPanel    │
│ ┌────────────────────────────────────────────────┐   │ (280px)         │
│ │ 헤더: 프로젝트명 + 모드 Pill                    │   │                 │
│ ├────────────────────────────────────────────────┤   │ ┌─────────────┐ │
│ │ MsTaskTreeMode 또는 Timeline                   │   │ │📥 백로그 (12)│ │
│ │                                                │   │ │ ⚠ 노랑/빨강 │ │
│ │                                                │   │ ├─────────────┤ │
│ │                                                │   │ │ □ task 1    │ │
│ │                                                │   │ │ □ task 2    │ │
│ │                                                │   │ │ □ task 3    │ │
│ │                                                │   │ │ ...         │ │
│ │                                                │   │ ├─────────────┤ │
│ │                                                │   │ │ + 추가      │ │
│ └────────────────────────────────────────────────┘   │ └─────────────┘ │
│                                                      │                 │
│         DetailPanel (z-100, overlay)                  │                 │
└──────────────────────────────────────────────────────┴─────────────────┘
```

- BacklogPanel은 일반 flow (z-index 없음)
- DetailPanel은 fixed z-100 → 자동으로 위에 overlay

### 3-2. BacklogPanel 헤더

```
📥 백로그 (N)
```

- 아이콘 + "백로그" + 카운트 badge
- 카운트 경고색:
  - 0~5: `#888780` (회색)
  - 6~15: `#D4A017` (노랑)
  - 16+: `#E53E3E` (빨강)
- 빈 상태: 카운트 대신 "백로그 비어있음" 메시지

### 3-3. Task 목록

각 task 행:
- 체크박스 (toggleDone)
- task 텍스트 (클릭 → openDetail)
- assignee 아바타 (팀 모드, 배정된 경우만)
- dueDate (있으면 MM-DD 형식)
- done 시 취소선 + 회색 처리

필터: `projectTasks.filter(t => !t.keyMilestoneId && !t.done && !t.deletedAt)`
정렬: `sortOrder ASC`

### 3-4. 인라인 추가

- 하단 `+ 백로그에 추가` 버튼
- InlineAdd 컴포넌트 재사용: `extraFields={{ keyMilestoneId: null }}`
- category: `'today'` (기본)

### 3-5. 빈 상태

```
✓ 백로그 비어있음
```
- 연한 회색, 가운데 정렬
- 백로그가 잘 관리되고 있다는 긍정 신호

### 3-6. 반응형

- `window.innerWidth >= 1024`: BacklogPanel 표시 (280px)
- `window.innerWidth < 1024`: BacklogPanel 숨김 (display: none)
- 미디어 쿼리 또는 JS resize 감지

---

## 4. 영향 파일

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/components/project/BacklogPanel.jsx` | **신규** | 백로그 사이드패널 컴포넌트 |
| `src/components/project/UnifiedProjectView.jsx` | **추가** | flex 레이아웃 변경 + BacklogPanel 마운트 |

- DB 변경 없음
- 기존 컴포넌트 수정 없음 (UnifiedProjectView에 추가만)
- MsTaskTreeMode, CompactMilestoneTab 변경 없음

---

## 5. 사용하는 기존 패턴/컴포넌트

| 항목 | 소스 |
|------|------|
| 백로그 필터 | `!t.keyMilestoneId && !t.done && !t.deletedAt` |
| InlineAdd | `src/components/shared/InlineAdd.jsx` |
| MiniAvatar | `src/components/views/grid/shared/MiniAvatar.jsx` |
| openDetail | `useStore(s => s.openDetail)` |
| toggleDone | `useStore(s => s.toggleDone)` |
| designTokens | COLOR, FONT 상수 |

---

## 6. 제외 사항 (후속 loop)

- BacklogPanel → MS 트리 DnD (네이티브 DnD 혼재 문제 해결 후)
- Age 표시 (createdAt 필드 부재)
- CompactMilestoneTab 통합 (이미 하단 백로그 있음)
- 모바일 토글 버튼

---

## 7. QA 체크리스트 (구현 후)

- [ ] 전체 할일 모드에서 BacklogPanel 표시
- [ ] 타임라인 모드에서 BacklogPanel 표시
- [ ] 백로그 task 목록 정상 렌더 (체크박스, 텍스트, assignee, dueDate)
- [ ] 카운트 경고색 (0~5 회색, 6~15 노랑, 16+ 빨강)
- [ ] 빈 상태 메시지 ("백로그 비어있음")
- [ ] task 클릭 → DetailPanel 열림 (BacklogPanel 위에 overlay)
- [ ] 체크박스 토글 → done 처리 → 목록에서 사라짐
- [ ] 인라인 추가 → 백로그 task 생성
- [ ] 반응형: 1024px 미만에서 숨김
- [ ] `npm run build` 통과
- [ ] 기존 프로젝트 뷰 기능 회귀 없음
