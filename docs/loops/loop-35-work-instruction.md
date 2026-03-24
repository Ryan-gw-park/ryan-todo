# Loop-35: UniversalCard 공통 컴포넌트

> **목표:** 프로젝트·마일스톤·할일 3종 카드의 상호작용을 단일 컴포넌트로 통합하고, 모든 뷰에 순차 적용한다.
> **범위:** 신규 공통 컴포넌트 생성 + 기존 6개 뷰에 적용. Store 로직 변경 없음.
> **선행 조건:** Loop-31~34 완료
> **원칙:** 기존 컴포넌트 파일은 삭제하지 않고 보존. UniversalCard로 카드 렌더링 부분만 교체.

---

## 확정된 설계 결정

| 항목 | 결정 |
|------|------|
| 제목 편집 | 클릭 시에만 편집 모드 (항상 편집 폐지) |
| 상세 진입 | ▶ 아이콘 클릭 (행 전체 클릭 폐지) |
| 본문 클릭 | 펼치기/접기 |
| 본문 드래그 | DnD (5px 이동 판별) |
| TimelineGrid 간트바 | 수동 마우스 유지, 좌측 패널만 UniversalCard |
| DnD 라이브러리 | dnd-kit 통일 (간트바 제외) |
| 왼쪽 컬러 보더 | **전면 금지** — 프로젝트는 컬러 도트(8px) |
| 프로젝트 상태 영역 | 컬러 도트 8px (보더 아님) |
| 마일스톤 상태 영역 | 컬러 도트 6px |
| 할일 상태 영역 | 체크박스 14x14px |

---

## 작업 순서

> 작업 1(핵심 컴포넌트) → 2(인라인 편집) → 3(펼치기/접기) → 4(DnD) → 5(상세 아이콘) → 6(3종 카드 분기) → 7~12(뷰별 적용)

---

### 작업 1: UniversalCard 기본 구조

**파일:** `src/components/common/UniversalCard.jsx` (신규)

**1-1. Props 인터페이스**

```javascript
/**
 * UniversalCard — 프로젝트/마일스톤/할일 공통 카드 컴포넌트
 *
 * @param {string} type - 'task' | 'milestone' | 'project'
 * @param {object} data - 원본 데이터 (task/milestone/project 객체)
 * @param {string} data.id - 항목 ID
 * @param {string} data.name - 표시할 제목 (task=text, milestone=title, project=name)
 * @param {string} data.color - 색상 (프로젝트/MS 고유색)
 *
 * @param {boolean} expanded - 펼침 상태 (외부 제어)
 * @param {function} onToggleExpand - 펼치기/접기 토글 콜백
 *
 * @param {function} onTitleSave - 제목 편집 완료 콜백: (newText) => void
 * @param {function} onStatusToggle - 상태 토글 콜백: () => void (할일=toggleDone)
 * @param {function} onDetailOpen - 상세 진입 콜백: () => void
 *
 * @param {boolean} draggable - DnD 활성화 여부 (기본: true)
 * @param {object} dragData - dnd-kit에 전달할 드래그 데이터
 *
 * @param {function} renderMeta - 메타 행 커스텀 렌더: () => ReactNode
 *   (MS 뱃지, 담당자, 기간 등 — 뷰마다 다를 수 있음)
 * @param {function} renderExpanded - 펼침 내용 커스텀 렌더: () => ReactNode
 *   (하위 할일 목록, 노트 미리보기 등)
 *
 * @param {boolean} compact - 축소 모드 (타임라인 좌측 패널용)
 * @param {string} className - 추가 CSS 클래스
 */
```

**1-2. 4영역 레이아웃 구조**

```jsx
function UniversalCard({
  type, data, expanded, onToggleExpand,
  onTitleSave, onStatusToggle, onDetailOpen,
  draggable = true, dragData,
  renderMeta, renderExpanded,
  compact = false, className = '',
}) {
  return (
    <div className={`universal-card uc-${type} ${compact ? 'uc-compact' : ''} ${className}`}>
      {/* Zone 1: 상태 영역 (좌측) */}
      <StatusZone type={type} data={data} onToggle={onStatusToggle} />

      {/* Zone 2+3: 제목 + 본문 (중앙, 합쳐서 flex:1) */}
      <div className="uc-center">
        {/* Zone 2: 제목 텍스트 */}
        <TitleZone
          name={data.name}
          onSave={onTitleSave}
          compact={compact}
        />

        {/* 메타 행 (MS 뱃지, 담당자 등) */}
        {renderMeta && <div className="uc-meta">{renderMeta()}</div>}

        {/* Zone 3: 본문 영역 — 클릭=펼치기, 드래그=DnD */}
        {/* BodyZone은 TitleZone 외 나머지 영역 전체를 감싸는 이벤트 핸들러 */}

        {/* 펼침 내용 */}
        {expanded && renderExpanded && (
          <div className="uc-expanded">{renderExpanded()}</div>
        )}
      </div>

      {/* Zone 4: 상세 아이콘 (우측) */}
      <DetailZone onOpen={onDetailOpen} />
    </div>
  );
}
```

> **중요:** Zone 2(제목)과 Zone 3(본문)의 이벤트 분리는 작업 2, 3에서 상세 구현.
> 제목 텍스트 위의 mousedown은 인라인 편집으로, 제목 외 영역의 mousedown은 펼치기/DnD로 라우팅.

**1-3. CSS 기본 스타일**

```css
/* src/components/common/UniversalCard.css */

.universal-card {
  display: flex;
  align-items: stretch;
  min-height: 36px;
  border-radius: 6px;
  transition: background 0.1s;
  position: relative;
}

.universal-card:hover {
  background: var(--color-background-secondary);
}

/* 상태 영역 */
.uc-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  flex-shrink: 0;
  padding: 4px;
}

/* 중앙 영역 */
.uc-center {
  flex: 1;
  min-width: 0;
  padding: 6px 0;
  cursor: default;
}

/* 메타 행 */
.uc-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  flex-wrap: wrap;
}

/* 펼침 내용 */
.uc-expanded {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 0.5px solid var(--color-border-tertiary);
}

/* 상세 아이콘 */
.uc-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
  cursor: pointer;
}

.universal-card:hover .uc-detail {
  opacity: 1;
}

/* 축소 모드 */
.uc-compact {
  min-height: 28px;
}

.uc-compact .uc-status {
  width: 24px;
}

.uc-compact .uc-detail {
  width: 24px;
}
```

---

### 작업 2: 인라인 편집 — TitleZone

**파일:** `src/components/common/TitleZone.jsx` (신규)

**2-1. 동작 규격**

| 이벤트 | 동작 |
|--------|------|
| 제목 텍스트 클릭 | 편집 모드 진입 (span → input 전환) |
| 편집 중 Enter | 저장 후 편집 종료 |
| 편집 중 Escape | 취소, 원래 값 복원, 편집 종료 |
| 편집 중 외부 클릭 (blur) | 저장 후 편집 종료 |
| 빈 값으로 저장 시도 | 취소 (빈 제목 방지) |

**2-2. 구현**

```javascript
function TitleZone({ name, onSave, compact }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef(null);

  // 편집 시작
  const startEdit = (e) => {
    e.stopPropagation(); // 본문 영역 클릭과 분리
    setDraft(name);
    setEditing(true);
  };

  // 편집 모드 진입 시 focus + 전체 선택
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // 저장
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  // 취소
  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  // 키보드 핸들러
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      cancel();
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="uc-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
      />
    );
  }

  return (
    <span
      className={`uc-title-text ${compact ? 'uc-title-compact' : ''}`}
      onClick={startEdit}
    >
      {name}
    </span>
  );
}
```

**2-3. TitleZone CSS**

```css
.uc-title-text {
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: text;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.uc-title-text:hover {
  text-decoration: underline;
  text-decoration-color: var(--color-border-secondary);
  text-underline-offset: 2px;
}

.uc-title-input {
  font-size: 13px;
  color: var(--color-text-primary);
  border: none;
  border-bottom: 1.5px solid var(--color-border-info);
  background: transparent;
  outline: none;
  width: 100%;
  padding: 0;
  font-family: inherit;
}

.uc-title-compact {
  font-size: 12px;
}
```

**2-4. 이벤트 전파 분리 핵심**

TitleZone의 `onClick`에 `e.stopPropagation()`을 넣어서, 본문 영역(BodyZone)의 클릭/드래그 이벤트와 분리한다.

```
마우스 클릭이 제목 텍스트 위 → stopPropagation → TitleZone만 처리 → 편집 모드
마우스 클릭이 제목 외 영역 → 버블링 → BodyZone이 처리 → 펼치기/접기
```

---

### 작업 3: 펼치기/접기 + 드래그 판별 — BodyZone

**파일:** `src/components/common/useClickOrDrag.js` (신규 훅)

**3-1. 클릭 vs 드래그 판별 로직**

```javascript
/**
 * 클릭과 드래그를 5px 이동 거리로 구분하는 훅
 *
 * @param {function} onClick - 클릭 판정 시 콜백 (이동 < 5px)
 * @param {function} onDragStart - 드래그 판정 시 콜백 (이동 >= 5px)
 * @returns {object} { onMouseDown, onMouseMove, onMouseUp } 이벤트 핸들러
 */
function useClickOrDrag({ onClick, onDragStart }) {
  const startPos = useRef(null);
  const isDragging = useRef(false);

  const onMouseDown = useCallback((e) => {
    // 제목 영역이나 상태/상세 영역에서 온 이벤트는 무시
    // (stopPropagation으로 도달하지 않지만 방어)
    if (e.defaultPrevented) return;

    startPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;

    // 전역 이벤트 등록
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!startPos.current) return;

    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);

    if (dx + dy >= 5 && !isDragging.current) {
      isDragging.current = true;
      onDragStart?.(e);
    }
  }, [onDragStart]);

  const handleMouseUp = useCallback((e) => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    if (!isDragging.current && startPos.current) {
      onClick?.(e);  // 이동 < 5px → 클릭
    }

    startPos.current = null;
    isDragging.current = false;
  }, [onClick, handleMouseMove]);

  return { onMouseDown };
}
```

**3-2. UniversalCard 내부에서 사용**

```javascript
// UniversalCard 내부
const { onMouseDown: bodyMouseDown } = useClickOrDrag({
  onClick: () => {
    // 클릭 → 펼치기/접기
    onToggleExpand?.();
  },
  onDragStart: (e) => {
    // 드래그 → DnD 모드 전환
    // dnd-kit의 drag start를 프로그래밍 방식으로 트리거
    // 작업 4에서 상세 구현
  },
});

// uc-center 영역에 적용 (단, TitleZone 제외)
<div className="uc-body" onMouseDown={bodyMouseDown}>
  {/* 메타 행, 펼침 내용 등 */}
</div>
```

**3-3. 펼침 내용 (renderExpanded)**

| 카드 종류 | 펼침 내용 |
|----------|---------|
| 할일 | 노트 미리보기 (2줄 truncate), 기간 (startDate~dueDate), 댓글 수 |
| 마일스톤 | 하위 할일 목록 (각각 UniversalCard type='task') |
| 프로젝트 | 하위 MS 목록 (각각 UniversalCard type='milestone') |

펼침 내용은 뷰에서 `renderExpanded` prop으로 전달한다. UniversalCard 자체는 내용을 모른다.

---

### 작업 4: DnD 통합 — useDraggableCard

**파일:** `src/components/common/useDraggableCard.js` (신규 훅)

**4-1. dnd-kit draggable 래핑**

```javascript
import { useDraggable } from '@dnd-kit/core';

/**
 * UniversalCard용 DnD 훅
 * useClickOrDrag와 연동하여 5px 이동 후에만 DnD 활성화
 */
function useDraggableCard({ id, type, data, disabled = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${type}-${id}`,
    data: { type, ...data },
    disabled,
  });

  return {
    dragRef: setNodeRef,
    dragStyle: transform ? {
      transform: `translate(${transform.x}px, ${transform.y}px)`,
      opacity: isDragging ? 0.3 : 1,
      zIndex: isDragging ? 100 : 'auto',
    } : undefined,
    isDragging,
    dragAttributes: attributes,
    dragListeners: listeners,
  };
}
```

**4-2. UniversalCard에 DnD 연결**

```javascript
function UniversalCard({ type, data, draggable, dragData, ...props }) {
  const {
    dragRef, dragStyle, isDragging, dragAttributes, dragListeners
  } = useDraggableCard({
    id: data.id,
    type,
    data: dragData || data,
    disabled: !draggable,
  });

  return (
    <div
      ref={dragRef}
      className={`universal-card uc-${type} ${isDragging ? 'uc-dragging' : ''}`}
      style={dragStyle}
      {...dragAttributes}
    >
      <StatusZone ... />
      <div
        className="uc-center"
        {...dragListeners}  // 본문 영역 전체가 드래그 핸들
      >
        <TitleZone ... />   {/* TitleZone은 stopPropagation으로 드래그 방지 */}
        <div className="uc-body">
          {renderMeta && ...}
          {expanded && renderExpanded && ...}
        </div>
      </div>
      <DetailZone ... />
    </div>
  );
}
```

**4-3. DnD 시각 피드백 CSS**

```css
.uc-dragging {
  opacity: 0.3;
  border: 1px dashed var(--color-border-secondary);
}

/* DragOverlay에서 사용하는 드래그 복제본 */
.uc-drag-overlay {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  background: var(--color-background-primary);
  pointer-events: none;
  max-width: 280px;
}
```

**4-4. DragOverlay 렌더링**

DnD 시작 시 드래그 중인 카드의 축소 복제본을 DragOverlay로 표시.
이 로직은 각 뷰의 DndContext 내부에서 처리:

```jsx
// 뷰 레벨 (예: TodayView)
<DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
  {/* 할일 목록 */}
  {tasks.map(t => <UniversalCard type="task" data={t} ... />)}

  <DragOverlay>
    {activeDragItem && (
      <UniversalCard
        type={activeDragItem.type}
        data={activeDragItem.data}
        draggable={false}
        compact={true}
        className="uc-drag-overlay"
      />
    )}
  </DragOverlay>
</DndContext>
```

**4-5. 드롭 대상 하이라이트**

드래그 중 유효한 드롭 영역은 파란 테두리 + 연한 파란 배경:

```css
.drop-target-active {
  border: 1.5px solid var(--color-border-info);
  background: var(--color-background-info);
  border-radius: 6px;
  transition: all 0.15s;
}
```

---

### 작업 5: 상세 아이콘 — DetailZone

**파일:** `src/components/common/DetailZone.jsx` (신규)

```javascript
function DetailZone({ onOpen }) {
  return (
    <button
      className="uc-detail"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      aria-label="상세 보기"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M5 3l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
```

**동작:**
- 평소: opacity 0 (숨김)
- 카드 호버: opacity 1 (표시)
- 모바일: 항상 표시 (미디어 쿼리)
- 클릭: `e.stopPropagation()` 후 `onOpen()` 호출

```css
/* 모바일에서 항상 표시 */
@media (pointer: coarse) {
  .uc-detail {
    opacity: 1;
  }
}
```

---

### 작업 6: 3종 카드 분기 — StatusZone

**파일:** `src/components/common/StatusZone.jsx` (신규)

```javascript
function StatusZone({ type, data, onToggle }) {
  if (type === 'task') {
    return (
      <div className="uc-status" onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}>
        <div className={`uc-checkbox ${data.done ? 'uc-checkbox-done' : ''}`}>
          {data.done && <CheckIcon />}
        </div>
      </div>
    );
  }

  if (type === 'milestone') {
    return (
      <div className="uc-status">
        <div className="uc-dot" style={{ width: 6, height: 6, background: data.color }} />
      </div>
    );
  }

  if (type === 'project') {
    return (
      <div className="uc-status">
        <div className="uc-dot" style={{ width: 8, height: 8, background: data.color }} />
      </div>
    );
  }

  return null;
}
```

**CSS:**

```css
.uc-checkbox {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1.5px solid var(--color-border-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.1s;
}

.uc-checkbox:hover {
  border-color: var(--color-border-primary);
}

.uc-checkbox-done {
  background: var(--color-text-success);
  border-color: var(--color-text-success);
}

.uc-dot {
  border-radius: 50%;
  flex-shrink: 0;
}
```

---

### 작업 7: TodayView에 UniversalCard 적용

**파일:** `src/components/TodayView.jsx`

**변경점:**

| 항목 | 현재 | 변경 |
|------|------|------|
| 할일 렌더링 | 커스텀 input + 행 구조 | UniversalCard type='task' |
| 인라인 편집 | 항상 편집 가능 input | 클릭 시 편집 (TitleZone) |
| 상세 진입 | ▶ 호버 아이콘 | DetailZone (동일 원리) |
| DnD | @dnd-kit SortableContext | 유지, UniversalCard에 dragListeners 연결 |
| 펼치기 | 없음 | **추가**: 본문 클릭 시 노트/기간 표시 |

**적용 방법:**

```javascript
// 기존 할일 행 렌더링 부분을 찾아서:
// 기존: <TaskRow task={task} ... />
// 변경: <UniversalCard type="task" data={taskToCardData(task)} ... />

// taskToCardData 변환 함수:
function taskToCardData(task) {
  return {
    id: task.id,
    name: task.text,
    color: null,  // 할일은 고유색 없음
    done: task.done,
    // 기타 필드는 renderMeta에서 직접 참조
  };
}
```

**renderMeta:**
```jsx
renderMeta={() => (
  <>
    {task.keyMilestoneId && <MSBadge milestoneId={task.keyMilestoneId} />}
    {task.assigneeId && <span className="uc-assignee">{memberName}</span>}
  </>
)}
```

**renderExpanded:**
```jsx
renderExpanded={() => (
  <div className="uc-task-expanded">
    {task.notes && <div className="uc-notes-preview">{truncate(task.notes, 100)}</div>}
    {(task.startDate || task.dueDate) && (
      <div className="uc-dates">{formatDateRange(task.startDate, task.dueDate)}</div>
    )}
  </div>
)}
```

**DnD 유지:**
기존 SortableContext와 DndContext는 유지. UniversalCard의 dragListeners가 본문 영역에 바인딩되므로 기존 DnD 동작과 호환.

**expandedIds 상태 추가:**
```javascript
const [expandedIds, setExpandedIds] = useState(new Set());
const toggleExpand = (id) => {
  setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};
```

---

### 작업 8: AllTasksView에 UniversalCard 적용

**파일:** `src/components/AllTasksView.jsx`

**변경점:**

| 항목 | 현재 | 변경 |
|------|------|------|
| 할일 렌더링 | 읽기 전용 행 | UniversalCard type='task' |
| 인라인 편집 | 없음 | **추가**: 제목 클릭 시 편집 |
| 상세 진입 | 행 전체 클릭 | **변경**: ▶ 아이콘 |
| DnD | 없음 | **추가**: 프로젝트 간 이동 |
| 펼치기 | 없음 | **추가**: 본문 클릭 시 펼치기 |

**핵심 변경:** 기존 행 클릭 → selectTask(id) 제거. 대신:
- 제목 클릭 → 인라인 편집
- 본문 클릭 → 펼치기
- ▶ 아이콘 → selectTask(id) (DetailPanel 열기)

---

### 작업 9: MatrixView / TeamMatrixView에 UniversalCard 적용

**파일:** `src/components/MatrixView.jsx`, `src/components/TeamMatrixView.jsx`

**변경점:**

| 항목 | 현재 | 변경 |
|------|------|------|
| 할일 렌더링 | 커스텀 textarea + 카드 | UniversalCard type='task' |
| 인라인 편집 | 텍스트 클릭 → textarea | TitleZone (동일 원리) |
| MS 뱃지 | 없음 | **추가**: renderMeta에 MSBadge |
| 펼치기 | 없음 | **추가**: 본문 클릭 시 |

DnD는 기존 DndContext 유지. UniversalCard의 dragListeners와 기존 droppable 영역이 호환되는지 확인.

**주의:** MatrixView의 기존 DnD는 셀 단위 droppable (projectId:category). UniversalCard의 draggable이 기존 droppable에 올바르게 연결되는지 검증 필요.

---

### 작업 10: CompactTaskList에 UniversalCard 적용

**파일:** `src/components/CompactTaskList.jsx`

**변경점:**

| 항목 | 현재 | 변경 |
|------|------|------|
| 노트 표시 | 별도 노트 아이콘 → 토글 | **제거**: 본문 클릭 = 펼치기로 통합 |
| DnD | @dnd-kit sortable | 유지, UniversalCard에 연결 |

---

### 작업 11: TimelineView 좌측 패널에 UniversalCard(compact) 적용

**파일:** `src/components/timeline/TimelineLeftPanel.jsx`

Loop-34에서 생성된 GroupRow/SortableTaskRow를 UniversalCard(compact=true)로 교체.

**주의:** TimelineGrid (간트바 영역)의 DnD는 변경하지 않음. 수동 마우스 이벤트 유지. 좌측 패널만 UniversalCard.

---

### 작업 12: 모달 내부 목록에 UniversalCard 적용

**파일:**
- `src/components/modals/ProjectSettingsModal.jsx` — MS 목록
- `src/components/modals/MilestoneDetailModal.jsx` — 할일 목록

Loop-33에서 생성된 모달의 목록 부분을 UniversalCard로 교체.

---

## MSBadge 공통 컴포넌트

**파일:** `src/components/common/MSBadge.jsx` (신규)

```javascript
/**
 * 마일스톤 뱃지 — 할일 카드 메타 행에 표시
 * 클릭 시 MS 상세 모달 열기
 */
function MSBadge({ milestoneId }) {
  const milestone = useStore(s => s.milestones?.find(m => m.id === milestoneId));
  const { openModal } = useStore();

  if (!milestone) return null;

  return (
    <button
      className="ms-badge"
      onClick={(e) => {
        e.stopPropagation();
        openModal({ type: 'milestoneDetail', milestoneId, returnTo: null });
      }}
    >
      <span className="ms-badge-dot" style={{ background: milestone.color }} />
      <span className="ms-badge-name">{milestone.title}</span>
    </button>
  );
}
```

```css
.ms-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  cursor: pointer;
}

.ms-badge:hover {
  border-color: var(--color-border-secondary);
}

.ms-badge-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ms-badge-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}
```

---

## 파일 구조

```
src/components/common/
├── UniversalCard.jsx      ← 핵심 카드 컴포넌트
├── UniversalCard.css      ← 스타일
├── TitleZone.jsx          ← 인라인 편집
├── StatusZone.jsx         ← 체크박스 / 컬러 도트
├── DetailZone.jsx         ← ▶ 상세 아이콘
├── MSBadge.jsx            ← 마일스톤 뱃지
├── useClickOrDrag.js      ← 클릭 vs 드래그 판별 훅
└── useDraggableCard.js    ← dnd-kit draggable 래핑 훅
```

---

## 완료 검증 체크리스트

```
[ ] 1. UniversalCard 컴포넌트가 src/components/common/에 존재
[ ] 2. 3종 카드 (task/milestone/project) 렌더링 정상
[ ] 3. StatusZone:
       - 할일: 체크박스 클릭 → toggleDone 동작
       - 마일스톤: 컬러 도트 6px 표시
       - 프로젝트: 컬러 도트 8px 표시 (왼쪽 보더 아님)
[ ] 4. TitleZone:
       - 제목 클릭 → input 전환 → 편집 모드
       - Enter → 저장 + 종료
       - Escape → 취소 + 종료
       - blur → 저장 + 종료
       - 빈 값 → 취소
[ ] 5. 본문 영역 클릭 (이동 < 5px) → 펼치기/접기 동작
[ ] 6. 본문 영역 드래그 (이동 >= 5px) → DnD 모드 전환
[ ] 7. DnD 시각 피드백:
       - 드래그 중: 원본 opacity 0.3
       - DragOverlay: 축소 복제본이 커서 따라다님
       - 드롭 대상: 파란 테두리 하이라이트
[ ] 8. DetailZone:
       - 평소 숨김, 호버 시 표시
       - 할일 클릭 → DetailPanel 열기
       - MS 클릭 → MS 상세 모달 열기
       - 프로젝트 클릭 → 프로젝트 설정 모달 열기
[ ] 9. MSBadge:
       - 할일 카드 메타 행에 표시 (milestoneId 있을 때)
       - 클릭 → MS 상세 모달 열기
[ ] 10. TodayView 적용:
        - 항상 편집 → 클릭 편집으로 변경 확인
        - 기존 DnD (프로젝트 간 이동) 정상
        - 펼치기 동작
[ ] 11. AllTasksView 적용:
        - 인라인 편집 추가 확인
        - 행 클릭 → 펼치기로 변경 (상세 진입 아님)
        - ▶ 아이콘 → DetailPanel 정상
[ ] 12. MatrixView / TeamMatrixView 적용:
        - 기존 DnD (카테고리/담당자/프로젝트) 정상
        - MS 뱃지 표시
        - 펼치기 동작
[ ] 13. CompactTaskList 적용:
        - 노트 아이콘 제거 확인
        - 본문 클릭 → 펼치기 (노트 포함)
        - 기존 DnD (MS 간 이동) 정상
[ ] 14. TimelineView 좌측 패널 적용:
        - compact 모드 정상
        - 간트바 DnD 영향 없음 (수동 마우스 유지)
[ ] 15. 모달 내부 목록 적용:
        - 프로젝트 설정 모달 MS 목록
        - MS 상세 모달 할일 목록
[ ] 16. 기존 뷰 회귀 없음:
        - 모든 뷰에서 기존 기능 (체크, DnD, 편집, 상세) 정상
        - 기존 컴포넌트 파일 보존 (삭제 안 됨)
[ ] 17. 빌드 성공, 에러 0건
```

---

## 다음 Loop 예고

- **Loop-36A:** 전체 할일 MS 그룹핑 + 매트릭스 MS 모드 (UniversalCard 활용)
- **Loop-36B:** 주간 플래너 신규 뷰 (UniversalCard + BacklogSidebar)
