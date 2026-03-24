import { useState, useRef, useCallback, useMemo } from "react";

const TEAM_MEMBERS = [
  { id: "u1", name: "Ryan Park" },
  { id: "u2", name: "Ethan" },
  { id: "u3", name: "Ash" },
  { id: "u4", name: "Eric" },
  { id: "u5", name: "Edmond" },
];

const INITIAL_MILESTONES = [
  { id: "m1", title: "주주분류 + 1% 이상 개별 연락", desc: "주주 1% 이상 이메일 + 등기 기준", start: "2026-03-09", end: "2026-03-13", color: "#1D9E75", order: 0 },
  { id: "m2", title: "공동행사약정서 (w/ Brandon)", desc: "", start: "2026-03-09", end: "2026-03-13", color: "#1D9E75", order: 1 },
  { id: "m3", title: "소집통지 (1% 이상, 이메일)", desc: "우편 발송 여부 확인", start: "2026-03-11", end: "2026-03-15", color: "#1D9E75", order: 2 },
  { id: "m4", title: "소집 공고", desc: "", start: "2026-03-09", end: "2026-03-12", color: "#1D9E75", order: 3 },
  { id: "m5", title: "위임장 발송 + 등기 서류 취합", desc: "본사 + 산은 위임장 포함", start: "2026-03-13", end: "2026-03-17", color: "#D85A30", order: 4 },
  { id: "m6", title: "등기 필요 서류 준비 + 취합 (각자)", desc: "팀원 각자 담당분", start: "2026-03-13", end: "2026-03-17", color: "#D85A30", order: 5 },
  { id: "m7", title: "등기", desc: "", start: "2026-03-28", end: "2026-03-31", color: "#1D9E75", order: 6 },
  { id: "m8", title: "안건자료 PPT", desc: "사업보고서 · 감사보고서 · 재무제표", start: "2026-03-14", end: "2026-03-18", color: "#D85A30", order: 7 },
];

const INITIAL_TASKS = [
  { id: "t1", text: "주주명부 정리", done: true, msId: "m1" },
  { id: "t2", text: "1% 이상 개별 연락", done: false, msId: "m1" },
  { id: "t3", text: "소집통지 우편 발송?", done: false, msId: "m3" },
  { id: "t4", text: "위임: 본 + 산은 추가하기", done: false, msId: "m5" },
  { id: "t5", text: "Sifive 위임투표 양식 (BKL, 공증인 확인 필요)", done: false, msId: "m5" },
  { id: "t6", text: "안건 PPT 작성", done: false, msId: "m8" },
  { id: "t7", text: "Sifive 메일 - 번역?", done: false, msId: null },
  { id: "t8", text: "소집통지 우편 발송 확인", done: false, msId: null },
];

const fmt = (d) => { const dt = new Date(d); return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`; };

function OwnerDropdown({ ownerId, onChange }) {
  const [open, setOpen] = useState(false);
  const owner = TEAM_MEMBERS.find(m => m.id === ownerId);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ fontSize: 11, color: "#D85A30", cursor: "pointer", border: "none", background: "none", fontFamily: "inherit", fontWeight: 500, padding: "2px 4px", borderRadius: 4 }}
      >
        {owner ? owner.name : "미지정"} ▾
      </button>
      {open && (
        <div
          style={{ position: "absolute", top: "100%", left: 0, background: "#fff", border: "0.5px solid #e8e6df", borderRadius: 8, padding: "4px 0", boxShadow: "0 4px 16px rgba(0,0,0,.1)", zIndex: 100, minWidth: 140 }}
          onMouseLeave={() => setOpen(false)}
        >
          <div onClick={() => { onChange(null); setOpen(false); }} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#a09f99" }}>
            ✕ 미지정
          </div>
          {TEAM_MEMBERS.map(m => (
            <div key={m.id} onClick={() => { onChange(m.id); setOpen(false); }} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: m.id === ownerId ? 600 : 400, background: m.id === ownerId ? "#f0efe8" : "transparent" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#1D9E75", color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>{m.name[0]}</span>
              {m.name}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

function TaskChip({ task, onToggle, onClick }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => { setDragging(true); e.dataTransfer.setData("taskId", task.id); }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onClick?.(task)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px",
        background: dragging ? "#e8f5e9" : "#f5f4f0", borderRadius: 5, fontSize: 12,
        cursor: "grab", transition: "all .12s", userSelect: "none",
        border: dragging ? "1px dashed #1D9E75" : "1px solid transparent",
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
        style={{
          width: 14, height: 14, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
          border: task.done ? "none" : "1.5px solid #c4c2ba",
          background: task.done ? "#1D9E75" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 8,
        }}
      >
        {task.done && "✓"}
      </div>
      <span style={{ textDecoration: task.done ? "line-through" : "none", color: task.done ? "#c4c2ba" : "#2C2C2A" }}>
        {task.text}
      </span>
    </div>
  );
}

function InlineTaskInput({ onAdd, placeholder = "+ 추가" }) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");
  const ref = useRef(null);
  const submit = () => { if (text.trim()) { onAdd(text.trim()); setText(""); } else setActive(false); };
  if (!active) return (
    <button
      onClick={() => { setActive(true); setTimeout(() => ref.current?.focus(), 0); }}
      style={{ fontSize: 11, color: "#c4c2ba", cursor: "pointer", padding: "3px 6px", borderRadius: 4, border: "none", background: "none", fontFamily: "inherit", whiteSpace: "nowrap" }}
    >
      {placeholder}
    </button>
  );
  return (
    <input
      ref={ref} autoFocus value={text} placeholder="할일 입력 후 Enter"
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setText(""); setActive(false); } }}
      onBlur={submit}
      style={{ fontSize: 12, border: "none", outline: "none", background: "#f5f4f0", fontFamily: "inherit", color: "#2C2C2A", padding: "3px 8px", borderRadius: 5, width: 150 }}
    />
  );
}

function MilestoneRow({ ms, tasks, expanded, onToggle, onTaskToggle, onAddTask, dragOverMs, onDragAction, onClick, isBacklog }) {
  const [hover, setHover] = useState(false);
  const isDragOver = dragOverMs === ms.id;
  const doneCnt = tasks.filter(t => t.done).length;
  const totalCnt = tasks.length;
  const pct = totalCnt > 0 ? Math.round((doneCnt / totalCnt) * 100) : 0;

  // Collapsed: show max 2 task chips as preview
  const previewTasks = expanded ? tasks : tasks.slice(0, 2);
  const hiddenCount = expanded ? 0 : Math.max(0, tasks.length - 2);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); onDragAction("over", ms.id); }}
      onDragLeave={() => onDragAction("leave", ms.id)}
      onDrop={(e) => { e.preventDefault(); const tid = e.dataTransfer.getData("taskId"); if (tid) onDragAction("drop", ms.id, tid); }}
      style={{
        display: "flex", alignItems: "stretch",
        borderBottom: "0.5px solid #f0efe8",
        background: isDragOver ? "#f0fdf4" : expanded ? "#fafaf8" : hover ? "#fdfcfa" : "transparent",
        boxShadow: isDragOver ? "inset 0 0 0 1.5px #1D9E75" : "none",
        transition: "background .1s, box-shadow .15s",
      }}
    >
      {/* Left: milestone info */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: "0.5px solid #f0efe8" }}>
        {/* Top line: grip + chevron + dot + title + progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 4px 0", minHeight: 34 }}>
          {/* Drag grip */}
          {!isBacklog && (
            <div style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", color: "#d3d1c7", fontSize: 10, flexShrink: 0, opacity: hover ? 0.8 : 0, transition: "opacity .12s", userSelect: "none" }}>
              ⠿
            </div>
          )}
          {isBacklog && <div style={{ width: 22 }} />}

          {/* Chevron */}
          <button
            onClick={() => onToggle(ms.id)}
            style={{
              width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 3, border: "none", background: "none", cursor: "pointer",
              color: "#c4c2ba", fontSize: 9, flexShrink: 0,
              transform: expanded ? "none" : "rotate(-90deg)", transition: "transform .15s",
            }}
          >
            ▾
          </button>

          {/* Color dot */}
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isBacklog ? "#b4b2a9" : ms.color, flexShrink: 0 }} />

          {/* Title — no truncation */}
          <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, flex: 1 }}>
            {ms.title}
          </span>

          {/* Progress badge */}
          {totalCnt > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginRight: 4 }}>
              <div style={{ width: 32, height: 3, background: "#eeeee6", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#1D9E75", borderRadius: 2, transition: "width .3s" }} />
              </div>
              <span style={{ fontSize: 9.5, color: "#b4b2a9", fontVariantNumeric: "tabular-nums" }}>{doneCnt}/{totalCnt}</span>
            </div>
          )}
        </div>

        {/* Expanded: dates → desc → deliverables */}
        {expanded && (
          <div style={{ padding: "0 12px 8px 46px", display: "flex", flexDirection: "column", gap: 3 }}>
            {!isBacklog && ms.start && (
              <div style={{ fontSize: 10.5, color: "#ccc9c0", display: "flex", alignItems: "center", gap: 4 }}>
                {fmt(ms.start)} <span style={{ color: "#ddd9d0" }}>→</span> {fmt(ms.end)}
              </div>
            )}
            {ms.desc && (
              <div style={{ fontSize: 11.5, color: "#a09f99", lineHeight: 1.4 }}>{ms.desc}</div>
            )}
            {!isBacklog && (
              <div style={{ fontSize: 11, color: "#c4c2ba", cursor: "pointer", marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#d3d1c7" }} />
                결과물 추가
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: tasks area */}
      <div
        style={{
          width: 400, flexShrink: 0, padding: expanded ? "8px 12px" : "6px 12px",
          display: "flex", flexWrap: "wrap", gap: 4, alignContent: "flex-start",
          minHeight: expanded ? 44 : 34,
        }}
      >
        {totalCnt === 0 && (
          <>
            <div style={{
              border: "1.5px dashed #e0ddd6", borderRadius: 5, padding: "3px 8px",
              fontSize: 11, color: "#d3d1c7", display: "flex", alignItems: "center",
              justifyContent: "center", flex: 1, minHeight: 26,
              ...(isDragOver ? { borderColor: "#1D9E75", background: "#f0fdf4", color: "#1D9E75" } : {}),
            }}>
              할일을 드래그하여 연결
            </div>
            <InlineTaskInput onAdd={(t) => onAddTask(ms.id, t)} />
          </>
        )}

        {previewTasks.map(task => (
          <TaskChip key={task.id} task={task} onToggle={onTaskToggle} onClick={onClick} />
        ))}

        {hiddenCount > 0 && (
          <button
            onClick={() => onToggle(ms.id)}
            style={{
              fontSize: 10.5, color: "#a09f99", background: "#eeeee6", border: "none",
              borderRadius: 999, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            +{hiddenCount}개 더보기
          </button>
        )}

        {totalCnt > 0 && (
          <InlineTaskInput onAdd={(t) => onAddTask(ms.id, t)} />
        )}
      </div>
    </div>
  );
}

export default function CompactMilestoneView() {
  const [milestones] = useState(INITIAL_MILESTONES);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [expandedMs, setExpandedMs] = useState(new Set(["m5"]));
  const [ownerId, setOwnerId] = useState(null);
  const [dragOverMs, setDragOverMs] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTab, setActiveTab] = useState("milestone");
  const idCounter = useRef(100);

  const sorted = useMemo(() => [...milestones].sort((a, b) => a.order - b.order), [milestones]);
  const backlogTasks = useMemo(() => tasks.filter(t => !t.msId && !t.done), [tasks]);
  const totalActive = useMemo(() => tasks.filter(t => !t.done).length, [tasks]);

  const allMsIds = useMemo(() => [...sorted.map(m => m.id), "__backlog__"], [sorted]);
  const allExpanded = expandedMs.size >= allMsIds.length;

  const toggleExpandAll = useCallback(() => {
    if (allExpanded) setExpandedMs(new Set());
    else setExpandedMs(new Set(allMsIds));
  }, [allExpanded, allMsIds]);

  const toggleExpand = useCallback((id) => {
    setExpandedMs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleTaskDone = useCallback((id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  const addTask = useCallback((msId, text) => {
    setTasks(prev => [...prev, { id: `t${++idCounter.current}`, text, done: false, msId }]);
  }, []);

  const handleDragAction = useCallback((action, msId, taskId) => {
    if (action === "over") setDragOverMs(msId);
    else if (action === "leave") setDragOverMs(null);
    else if (action === "drop" && taskId) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, msId } : t));
      setDragOverMs(null);
    }
  }, []);

  const BACKLOG_MS = { id: "__backlog__", title: "백로그", desc: "", start: null, end: null, color: "#b4b2a9", order: 9999 };

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", fontFamily: "-apple-system, 'Pretendard', sans-serif", fontSize: 13, color: "#2C2C2A", background: "#f7f6f3" }}>
      {/* ── Sidebar ── */}
      <div style={{ width: 184, background: "#fff", borderRight: "0.5px solid #e8e6df", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 10px", fontWeight: 600, fontSize: 13 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>R</div>
          Ryan's Todo
        </div>
        <div style={{ padding: "12px 14px 4px", fontSize: 9.5, color: "#b4b2a9", fontWeight: 600, letterSpacing: ".06em" }}>글로벌 뷰</div>
        {[["📋","오늘 할일"],["📑","전체 할일"],["▦","매트릭스"],["━","타임라인"],["✎","노트"]].map(([ic,nm]) => (
          <div key={nm} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 12, color: "#7a7870", cursor: "pointer" }}>
            <span style={{ width: 14, textAlign: "center", fontSize: 12, opacity: 0.5 }}>{ic}</span>{nm}
          </div>
        ))}
        <div style={{ padding: "12px 14px 4px", fontSize: 9.5, color: "#b4b2a9", fontWeight: 600, letterSpacing: ".06em" }}>팀 프로젝트</div>
        {[["#2563eb","정기주총",true],["#dc2626","ABI 코리아",false],["#7c3aed","일본법인/해외SCM",false],["#f59e0b","BIS",false]].map(([c,n,on]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 12, color: on ? "#2C2C2A" : "#7a7870", background: on ? "#eeeee6" : "transparent", fontWeight: on ? 600 : 400, cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />{n}
          </div>
        ))}
        <div style={{ padding: "12px 14px 4px", fontSize: 9.5, color: "#b4b2a9", fontWeight: 600, letterSpacing: ".06em" }}>개인 프로젝트</div>
        {[["#16a34a","개별과제"],["#ea580c","C&Plus"]].map(([c,n]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 12, color: "#7a7870", cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />{n}
          </div>
        ))}
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 18px", background: "#fff", borderBottom: "0.5px solid #e8e6df", flexShrink: 0 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#2563eb" }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>정기주총</div>
          <div style={{ fontSize: 11, color: "#b4b2a9" }}>
            SCD팀 · 오너: <OwnerDropdown ownerId={ownerId} onChange={setOwnerId} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
            {[["milestone","마일스톤"],["tasks","할일"],["timeline","타임라인"]].map(([k,l]) => (
              <button key={k} onClick={() => setActiveTab(k)} style={{
                fontSize: 11.5, padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                color: activeTab === k ? "#2C2C2A" : "#a09f99",
                background: activeTab === k ? "#f0efe8" : "none",
                border: "none", fontFamily: "inherit", fontWeight: activeTab === k ? 600 : 500,
              }}>
                {l}
                {k === "tasks" && <span style={{ fontSize: 10, background: "#e8e6df", borderRadius: 999, padding: "1px 6px", marginLeft: 3, color: "#a09f99", fontWeight: 500 }}>{totalActive}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {activeTab === "milestone" && (
            <>
              {/* Column header */}
              <div style={{
                display: "flex", alignItems: "center", height: 30, padding: "0 12px",
                background: "#fafaf8", borderBottom: "0.5px solid #e8e6df",
                fontSize: 10.5, color: "#b4b2a9", fontWeight: 600, letterSpacing: ".03em",
                position: "sticky", top: 0, zIndex: 2,
              }}>
                <button
                  onClick={toggleExpandAll}
                  style={{
                    border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 10, color: "#c4c2ba", padding: "2px 6px", borderRadius: 3,
                    marginRight: 4, display: "flex", alignItems: "center", gap: 3,
                  }}
                  title={allExpanded ? "전체 접기" : "전체 펼치기"}
                >
                  <span style={{ fontSize: 8, transform: allExpanded ? "none" : "rotate(-90deg)", transition: "transform .15s" }}>▾</span>
                  {allExpanded ? "접기" : "펼치기"}
                </button>
                <div style={{ flex: 1, paddingLeft: 22 }}>마일스톤</div>
                <div style={{ width: 400, flexShrink: 0, paddingLeft: 12 }}>연결된 할일</div>
              </div>

              {/* Milestone rows */}
              {sorted.map(ms => (
                <MilestoneRow
                  key={ms.id} ms={ms}
                  tasks={tasks.filter(t => t.msId === ms.id)}
                  expanded={expandedMs.has(ms.id)}
                  onToggle={toggleExpand}
                  onTaskToggle={toggleTaskDone}
                  onAddTask={addTask}
                  dragOverMs={dragOverMs}
                  onDragAction={handleDragAction}
                  onClick={(t) => setSelectedTask(t)}
                  isBacklog={false}
                />
              ))}

              {/* Add milestone */}
              <div
                onClick={() => {}}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px 7px 46px", color: "#c4c2ba", fontSize: 12, cursor: "pointer", borderBottom: "0.5px solid #f0efe8" }}
              >
                + 마일스톤 추가
              </div>

              {/* Backlog — as a milestone row */}
              <div style={{ borderTop: "1.5px dashed #e8e6df" }}>
                <MilestoneRow
                  ms={BACKLOG_MS}
                  tasks={backlogTasks}
                  expanded={expandedMs.has("__backlog__")}
                  onToggle={toggleExpand}
                  onTaskToggle={toggleTaskDone}
                  onAddTask={(_, text) => addTask(null, text)}
                  dragOverMs={dragOverMs}
                  onDragAction={(action, _, tid) => handleDragAction(action, null, tid)}
                  onClick={(t) => setSelectedTask(t)}
                  isBacklog={true}
                />
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 16px 16px", borderTop: "0.5px solid #f0efe8", display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 11, color: "#c4c2ba", cursor: "pointer", padding: "3px 0", display: "flex", alignItems: "center", gap: 4 }}>
                  📎 참조 문서 <span style={{ fontSize: 9.5, background: "#eeeee6", borderRadius: 999, padding: "0 5px" }}>0</span>
                </div>
                <div style={{ fontSize: 11, color: "#c4c2ba", cursor: "pointer", padding: "3px 0", display: "flex", alignItems: "center", gap: 4 }}>
                  ✓ 합의된 정책 <span style={{ fontSize: 9.5, background: "#eeeee6", borderRadius: 999, padding: "0 5px" }}>0</span>
                </div>
              </div>
            </>
          )}

          {activeTab !== "milestone" && (
            <div style={{ padding: 40, textAlign: "center", color: "#b4b2a9" }}>
              {activeTab === "tasks" ? "할일 탭 — 마일스톤별 아웃라이너 뷰" : "타임라인 탭 — 간트 차트 뷰"}
              <br /><span style={{ fontSize: 11 }}>(이 목업에서는 마일스톤 탭에 집중)</span>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <div style={{ position: "fixed", top: 0, right: 0, width: 340, height: "100%", background: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,.08)", borderLeft: "0.5px solid #e8e6df", zIndex: 200, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "0.5px solid #e8e6df" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>상세</span>
            <button onClick={() => setSelectedTask(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#b4b2a9" }}>✕</button>
          </div>
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{selectedTask.text}</div>
            <div style={{ fontSize: 12, color: "#7a7870", marginBottom: 8 }}>
              상태: {selectedTask.done ? "✅ 완료" : "⬜ 진행중"}
            </div>
            <div style={{ fontSize: 12, color: "#7a7870", marginBottom: 8 }}>
              마일스톤: {selectedTask.msId ? milestones.find(m => m.id === selectedTask.msId)?.title || "—" : "백로그"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
