# Loop-36C: 뷰 레이아웃 최적화 + 노트 전체화면 + 오늘할일 개선

> **분류**: Feature + UX optimization
> **선행 조건**: Loop-36A/B 완료 (MsBadge 공통 컴포넌트 사용 가능)
> **Agent 리뷰 필수**

---

## 목표

1. **글로벌 콘텐츠 너비 체계** — 뷰별 적정 max-width + 중앙 배치로 집중력 있는 화면 구성
2. **노트 전체화면 모드** — 노트 클릭 시 목록 숨기고 단일 노트 전체 화면 편집
3. **오늘 할일 개선** — 빈 카드 축소 + MS 뱃지 선택적 표시

---

## Part 1: 글로벌 콘텐츠 너비 체계

### 현재 문제

모든 뷰가 사이드바를 제외한 전체 브라우저 너비를 사용하고 있어서, 특히 리스트/편집 뷰에서 좌우가 너무 넓어 시선이 분산된다. 프로젝트 뷰의 마일스톤 탭, 할일 탭, 타임라인 탭 모두 동일하게 양쪽 끝까지 펼쳐진다.

### 뷰별 너비 규격

| 뷰 | max-width | 이유 |
|---|---|---|
| 오늘 할일 (TodayView) | `960px` | 카드 그리드 2열, 적정 카드 너비 유지 |
| 전체 할일 (AllTasksView) | `800px` | 계층 리스트, 읽기 집중 |
| 매트릭스 (MatrixView/TeamMatrixView) | **제한 없음** | 프로젝트 열 수에 따라 가로 확장 필요 |
| 글로벌 타임라인 (TimelineView) | **제한 없음** | 시간축 가로 확장 필요 |
| 노트 (MemoryView) — 목록 | `960px` | 카드 그리드 |
| 노트 (MemoryView) — 전체화면 편집 | `720px` | 장문 텍스트 편집, Notion/Medium 패턴 |
| 프로젝트 뷰 — 마일스톤 탭 | `1100px` | 좌측 MS 목록 + 우측 할일 2열 |
| 프로젝트 뷰 — 할일 탭 | `1100px` | 할일 리스트 + 노트 펼침 |
| 프로젝트 뷰 — 타임라인 탭 | `1400px` | 좌측 패널 + 간트 차트 |
| 주간 플래너 (WeeklyPlannerView) | **제한 없음** | 담당자 × 요일 그리드 + 백로그 사이드바 |

### 진단 Phase

```bash
# 각 뷰 컴포넌트의 최상위 wrapper 구조 확인
for view in TodayView AllTasksView MatrixView TeamMatrixView TimelineView MemoryView; do
  echo "=== $view ==="
  grep -n "return\s*(" src/components/views/${view}.jsx 2>/dev/null | head -3
  grep -n "maxWidth\|max-width\|margin.*auto\|padding.*0.*24" src/components/views/${view}.jsx 2>/dev/null | head -3
done

# ProjectLayer의 탭별 렌더링 구조 확인
grep -rn "activeTab\|projectLayerTab\|milestone\|tasks\|timeline" src/components/project/ProjectLayer.jsx -n | head -20

# WeeklyPlannerView 최상위 구조
grep -n "return\s*(\|maxWidth\|padding" src/components/views/WeeklyPlannerView.jsx 2>/dev/null | head -5

# 현재 공통 레이아웃 래퍼가 있는지
grep -rn "ContentWrapper\|PageWrapper\|ViewWrapper\|Layout" src/ --include="*.jsx" -l | head -5
```

### 구현

**방법 A — 뷰별 인라인 스타일 (권장)**

각 뷰 컴포넌트의 최상위 `<div>`에 직접 적용. 가장 단순하고 기존 코드에 영향 최소.

```jsx
// 좁은 뷰 (오늘 할일, 전체 할일, 노트)
<div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>

// 전체 너비 뷰 (매트릭스, 글로벌 타임라인, 주간 플래너)
<div style={{ padding: '0 24px' }}>

// 프로젝트 뷰 — 탭별 분기
const TAB_WIDTH = { milestone: 1100, tasks: 1100, timeline: 1400 };
<div style={{ maxWidth: TAB_WIDTH[activeTab], margin: '0 auto', padding: '0 24px' }}>
```

**방법 B — 공통 래퍼 컴포넌트**

```jsx
// src/components/common/ViewContainer.jsx
function ViewContainer({ maxWidth, children }) {
  return (
    <div style={{
      maxWidth: maxWidth || '100%',
      margin: maxWidth ? '0 auto' : undefined,
      padding: '0 24px',
    }}>
      {children}
    </div>
  );
}
```

**진단 결과에 따라 A 또는 B 선택.** 기존에 공통 래퍼가 있으면 그것을 확장하고, 없으면 A로 시작한 뒤 필요 시 B로 추출.

### 주의사항

- **매트릭스, 글로벌 타임라인, 주간 플래너는 너비 제한하지 않는다** — 가로 스크롤이 필요한 뷰
- **padding: '0 24px'은 모든 뷰에 공통 적용** — 좌우 최소 여백
- **모바일(< 768px)에서는 padding을 '0 12px'로 줄인다**
- **사이드바 너비는 건드리지 않는다**

---

## Part 2: 노트 전체화면 모드

### 현재 상태

MemoryView에서 노트 카드들이 그리드로 나열됨. 노트를 클릭하면 카드가 펼쳐지면서 OutlinerEditor가 표시되지만, 목록과 함께 보이기 때문에 긴 노트 작성 시 공간이 부족하고 집중이 어렵다.

### 변경 사항

**2단계 뷰 전환:**

```
[목록 모드]                          [전체화면 편집 모드]
┌──────┐ ┌──────┐ ┌──────┐          ┌──────────────────────────────────┐
│ 노트1 │ │ 노트2 │ │ 노트3 │   →    │  ← 뒤로    ● 주총 영업보고 자료  │
└──────┘ └──────┘ └──────┘   클릭    │                                  │
┌──────┐ ┌──────┐                    │  (max-width: 720px, 중앙 배치)   │
│ 노트4 │ │ 노트5 │                    │                                  │
└──────┘ └──────┘                    │  ▼ 2025 영업보고                 │
                                     │    ○ 글로벌 확장 및 본격적...     │
                                     │      ■ 수주 전년 대비 30%+...    │
                                     │      ■ 적극적 글로벌 진출...     │
                                     │    ...                           │
                                     └──────────────────────────────────┘
```

### 진단 Phase

```bash
# MemoryView 현재 구조 — 노트 선택/펼치기 로직
cat src/components/views/MemoryView.jsx

# 노트 카드 클릭 시 동작
grep -rn "selectedMemo\|activeMemo\|expandedMemo\|openMemo\|setSelected" src/components/views/MemoryView.jsx -n | head -10

# OutlinerEditor 사용 방식
grep -rn "<OutlinerEditor" src/components/views/MemoryView.jsx -A 5
```

### 구현

#### Phase 2-1: 상태 추가

```js
// MemoryView 내부
const [fullscreenMemoId, setFullscreenMemoId] = useState(null);
const fullscreenMemo = memos.find(m => m.id === fullscreenMemoId);
```

#### Phase 2-2: 목록 모드 → 전체화면 전환

```jsx
// 노트 카드 클릭 또는 ▶ 아이콘 클릭 시
onClick={() => setFullscreenMemoId(memo.id)}
```

#### Phase 2-3: 전체화면 편집 모드 렌더링

```jsx
if (fullscreenMemoId && fullscreenMemo) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 24px' }}>
      {/* 헤더: 뒤로가기 + 노트 제목 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setFullscreenMemoId(null)}
          style={{ /* ← 아이콘 버튼 스타일 */ }}>
          ←
        </button>
        <Dot color={noteColor} size={10} />
        <input value={fullscreenMemo.title}
          onChange={e => updateMemo(fullscreenMemo.id, { title: e.target.value })}
          style={{ fontSize: 20, fontWeight: 700, border: 'none', outline: 'none', flex: 1 }}
        />
        {/* 삭제, 색상 변경 등 액션 버튼 */}
      </div>

      {/* 노트 본문 — OutlinerEditor 전체 높이 */}
      <OutlinerEditor
        nodes={parsedNodes}
        onChange={handleChange}
        onSave={handleSave}
        // 전체화면이므로 높이 제한 없음
      />

      {/* 하단: 생성/수정 시간 */}
      <div style={{ marginTop: 24, fontSize: 12, color: '#a09f99', textAlign: 'right' }}>
        {formatDate(fullscreenMemo.updatedAt)}
      </div>
    </div>
  );
}

// 그 외 → 기존 목록 모드 렌더
return (
  <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
    {/* 기존 노트 카드 그리드 */}
  </div>
);
```

#### Phase 2-4: 키보드 단축키

```
Escape → 전체화면에서 목록으로 복귀
```

### 주의사항

- **OutlinerEditor props는 변경하지 않는다** — 기존 인터페이스 그대로 사용
- **노트 자동저장(800ms 디바운스)은 기존 패턴 유지**
- **전체화면에서 브라우저 뒤로가기(history.back) 시 목록으로 복귀 — pushState 사용 고려**
- **모바일에서는 기본적으로 전체화면 모드가 되도록** (카드 목록 → 카드 클릭 → 전체화면 편집)

---

## Part 3: 오늘 할일 개선

### 3-1. 빈 카드 축소

#### 현재 문제

할일 0건인 프로젝트 카드가 "오늘 할 일이 없습니다" + "+ 추가"로 큰 빈 카드를 차지하여 공간 낭비.

#### 변경

할일 0건인 카드는 **헤더만 표시하고 본문을 접는다.** "+ 추가"는 헤더 오른쪽에 인라인으로 이동.

```
변경 전:
┌──────────────────────────┐
│ ● 정기주총            0  │
│                          │
│   오늘 할 일이 없습니다   │
│   + 추가                 │
│                          │
└──────────────────────────┘

변경 후:
┌──────────────────────────┐
│ ● 정기주총     0  + 추가 │
└──────────────────────────┘
```

#### 진단 Phase

```bash
# TodayView에서 빈 카드 렌더링 조건 확인
grep -rn "오늘 할 일이 없\|할 일이 없\|empty\|noTasks\|tasks\.length.*===.*0" src/components/views/TodayView.jsx -n | head -10

# 카드 렌더링 구조
grep -rn "projectCard\|ProjectCard\|card.*project" src/components/views/TodayView.jsx -n | head -10
```

#### 구현

```jsx
// 할일이 있는 카드
<div style={{ background: PC[p.color].card, borderRadius: 12, overflow: 'hidden' }}>
  <div style={{ /* 헤더 */ }}>{/* 프로젝트 이름 + 카운트 */}</div>
  <div style={{ padding: '8px 16px' }}>
    {tasks.map(t => /* 할일 행 */)}
    <div>+ 추가</div>
  </div>
</div>

// 할일 0건 카드 — 헤더만
<div style={{ background: PC[p.color].card, borderRadius: 12, overflow: 'hidden' }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Dot color={PC[p.color].dot} />
      <span>{p.name}</span>
      <span style={{ color: '#a09f99' }}>0</span>
    </div>
    <span style={{ fontSize: 12, color: '#a09f99', cursor: 'pointer' }}>+ 추가</span>
  </div>
</div>
```

### 3-2. MS 뱃지 선택적 표시

#### 변경

오늘 할일의 각 할일 카드에 소속 마일스톤 뱃지를 선택적으로 표시. 36A에서 만든 `MsBadge` 공통 컴포넌트를 재사용.

```
변경 전:
☐ 안건 PPT - 수요일 오후 3시

변경 후 (MS 뱃지 ON):
☐ 안건 PPT - 수요일 오후 3시
  ● 안건자료 PPT
```

#### 구현

**토글 위치**: 오늘 할일 뷰 상단 `[전체|팀|개인]` 옆에 `MS 표시` 체크박스 또는 아이콘 토글.

```jsx
const [showMs, setShowMs] = useState(false);

// 토글 UI
<label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#a09f99', cursor: 'pointer' }}>
  <input type="checkbox" checked={showMs} onChange={e => setShowMs(e.target.checked)} />
  MS 표시
</label>

// 할일 카드 내부
{showMs && task.keyMilestoneId && (
  <MsBadge ms={milestones.find(m => m.id === task.keyMilestoneId)} />
)}
```

**milestones 데이터 접근**: 36A에서 store에 milestones를 올렸으므로 `useStore(s => s.milestones)`로 읽는다.

---

## 검증 체크리스트

### 콘텐츠 너비
- [ ] 오늘 할일: max-width 960px 중앙 배치
- [ ] 전체 할일: max-width 800px 중앙 배치
- [ ] 매트릭스: 전체 너비 (padding만)
- [ ] 글로벌 타임라인: 전체 너비
- [ ] 노트 목록: max-width 960px
- [ ] 노트 전체화면: max-width 720px
- [ ] 프로젝트 뷰 마일스톤/할일 탭: max-width 1100px
- [ ] 프로젝트 뷰 타임라인 탭: max-width 1400px
- [ ] 주간 플래너: 전체 너비
- [ ] 모든 뷰에 좌우 최소 24px 패딩
- [ ] 모바일(< 768px)에서 패딩 12px

### 노트 전체화면
- [ ] 노트 카드 클릭 → 목록 사라지고 단일 노트 전체화면
- [ ] ← 뒤로가기 → 목록 복귀
- [ ] Escape 키 → 목록 복귀
- [ ] 전체화면에서 제목 인라인 편집
- [ ] OutlinerEditor 정상 동작 (Enter/Tab/Shift+Tab/Alt+Shift+↑↓)
- [ ] 자동저장 (800ms 디바운스) 정상
- [ ] 하단에 수정 시간 표시
- [ ] max-width: 720px 중앙 배치

### 오늘 할일
- [ ] 할일 0건 카드: 헤더만 표시 + "+ 추가" 인라인
- [ ] 할일 있는 카드: 기존과 동일
- [ ] MS 표시 토글 ON → 할일 아래 MsBadge 표시
- [ ] MS 표시 토글 OFF → 기존과 동일 (뱃지 없음)
- [ ] MS 뱃지 클릭 → MS 상세 모달 (36A 기능)

### 회귀 검증
- [ ] 모든 뷰 전환 정상
- [ ] 매트릭스 DnD 정상
- [ ] 프로젝트 뷰 탭 전환 시 너비 변경 정상
- [ ] 주간 플래너 백로그 사이드바 정상
- [ ] DetailPanel 정상
- [ ] 모바일 레이아웃 정상
- [ ] `npm run build` 성공

---

## 주의사항

1. **기존 뷰의 내부 로직은 건드리지 않는다** — 최상위 wrapper에 maxWidth/margin만 추가
2. **CSS 변수 사용 금지** — 인라인 스타일 컨벤션
3. **왼쪽 컬러 보더 사용 금지**
4. **OutlinerEditor props 변경 금지** — 기존 인터페이스 그대로
5. **노트 전체화면 모드는 MemoryView 내부 상태로 관리** — store에 올리지 않음
6. **milestones 데이터는 36A에서 store에 올린 것을 사용** — 별도 로딩 없음
7. **select('*') 금지**

---

## 작업 내역

(작업 완료 후 기록)
