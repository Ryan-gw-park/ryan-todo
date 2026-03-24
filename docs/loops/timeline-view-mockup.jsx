import { useState, useMemo, useCallback } from "react";

const PROJECTS = [
  { id: "p1", name: "정기주총", color: "#2563eb" },
  { id: "p2", name: "ABI 코리아", color: "#dc2626" },
  { id: "p3", name: "일본법인/해외SCM", color: "#7c3aed" },
  { id: "p4", name: "BIS", color: "#f59e0b" },
];

const MEMBERS = [
  { id: "u1", name: "Ryan" },
  { id: "u2", name: "Ethan" },
  { id: "u3", name: "Ash" },
  { id: "u4", name: "Eric" },
  { id: "u5", name: "Edmond" },
];

const MILESTONES = [
  { id: "m1", pId: "p1", title: "공증 준비", start: "2026-03-10", end: "2026-03-17", color: "#1D9E75" },
  { id: "m2", pId: "p1", title: "위임장 발송 + 등기 서류 취합", start: "2026-03-13", end: "2026-03-17", color: "#D85A30" },
  { id: "m3", pId: "p1", title: "안건자료 PPT", start: "2026-03-14", end: "2026-03-18", color: "#D85A30" },
  { id: "m4", pId: "p1", title: "의사록 + 첨부서류", start: "2026-03-14", end: "2026-03-18", color: "#1D9E75" },
  { id: "m5", pId: "p1", title: "운영 매뉴얼", start: "2026-03-17", end: "2026-03-21", color: "#1D9E75" },
  { id: "m6", pId: "p1", title: "등기", start: "2026-03-28", end: "2026-03-31", color: "#1D9E75" },
  { id: "m7", pId: "p2", title: "실사 준비", start: "2026-03-10", end: "2026-03-20", color: "#dc2626" },
  { id: "m8", pId: "p2", title: "계약 검토", start: "2026-03-18", end: "2026-03-28", color: "#dc2626" },
  { id: "m9", pId: "p3", title: "해외SCM 점검", start: "2026-03-12", end: "2026-03-22", color: "#7c3aed" },
  { id: "m10", pId: "p4", title: "BIS 제출 서류", start: "2026-03-15", end: "2026-03-25", color: "#f59e0b" },
];

const TASKS = [
  { id: "t1", mId: "m1", pId: "p1", text: "등기 서류 ↔ 공증인 확인 체크", start: "2026-03-10", end: "2026-03-14", assignee: "u4", done: false },
  { id: "t2", mId: "m1", pId: "p1", text: "필요 서류 공증인 확인", start: "2026-03-12", end: "2026-03-17", assignee: "u5", done: false },
  { id: "t3", mId: "m2", pId: "p1", text: "위임장 뿌려야 하고", start: "2026-03-13", end: "2026-03-16", assignee: "u1", done: false },
  { id: "t4", mId: "m3", pId: "p1", text: "안건 PPT — 수요일 3시 Jason", start: "2026-03-14", end: "2026-03-17", assignee: "u1", done: false },
  { id: "t5", mId: "m3", pId: "p1", text: "안건 PPT — 재무제표 분석", start: "2026-03-15", end: "2026-03-18", assignee: "u2", done: false },
  { id: "t6", mId: "m4", pId: "p1", text: "의사록 작성", start: "2026-03-15", end: "2026-03-18", assignee: "u3", done: false },
  { id: "t7", mId: "m5", pId: "p1", text: "투표 엑셀", start: "2026-03-17", end: "2026-03-20", assignee: "u4", done: false },
  { id: "t8", mId: "m7", pId: "p2", text: "재무 자료 수집", start: "2026-03-10", end: "2026-03-15", assignee: "u2", done: true },
  { id: "t9", mId: "m7", pId: "p2", text: "법률 검토 의뢰", start: "2026-03-14", end: "2026-03-20", assignee: "u5", done: false },
  { id: "t10", mId: "m8", pId: "p2", text: "계약서 초안 작성", start: "2026-03-18", end: "2026-03-24", assignee: "u1", done: false },
  { id: "t11", mId: "m9", pId: "p3", text: "일본법인 재고 확인", start: "2026-03-12", end: "2026-03-18", assignee: "u3", done: false },
  { id: "t12", mId: "m10", pId: "p4", text: "BIS 양식 작성", start: "2026-03-15", end: "2026-03-22", assignee: "u4", done: false },
];

const TIMELINE_START = new Date("2026-03-08");
const TIMELINE_END = new Date("2026-04-02");
const TOTAL_DAYS = Math.ceil((TIMELINE_END - TIMELINE_START) / 86400000);
const TODAY = new Date("2026-03-16");

const dayPos = (dateStr) => {
  const d = new Date(dateStr);
  return Math.max(0, Math.min(1, (d - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)));
};
const todayPos = dayPos("2026-03-16");

const barStyle = (start, end, color, height = 20, opacity = 1) => ({
  position: "absolute",
  left: `${dayPos(start) * 100}%`,
  width: `${Math.max(1, (dayPos(end) - dayPos(start)) * 100)}%`,
  height,
  borderRadius: 3,
  background: color,
  opacity,
  top: "50%",
  transform: "translateY(-50%)",
});

const dates = [];
for (let d = new Date(TIMELINE_START); d <= TIMELINE_END; d.setDate(d.getDate() + 1)) {
  dates.push(new Date(d));
}

function MultiSelect({ label, options, selected, onChange, colorFn }) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === options.length;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
          border: "0.5px solid #d3d1c7", background: "#fff", fontFamily: "inherit",
          color: "#5F5E5A", display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {label}
        {!allSelected && <span style={{ fontSize: 10, background: "#1D9E75", color: "#fff", borderRadius: 999, padding: "0 5px", minWidth: 16, textAlign: "center" }}>{selected.length}</span>}
        <span style={{ fontSize: 9, color: "#a09f99" }}>▾</span>
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#fff",
            border: "0.5px solid #e8e6df", borderRadius: 8, padding: "4px 0",
            boxShadow: "0 4px 16px rgba(0,0,0,.1)", zIndex: 100, minWidth: 160,
          }}
        >
          <div
            onClick={() => onChange(allSelected ? [] : options.map(o => o.id))}
            style={{ padding: "5px 12px", fontSize: 12, cursor: "pointer", color: "#888780", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ width: 14, height: 14, borderRadius: 3, border: "1.5px solid #c4c2ba", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, background: allSelected ? "#1D9E75" : "transparent", color: "#fff", borderColor: allSelected ? "#1D9E75" : "#c4c2ba" }}>
              {allSelected && "✓"}
            </span>
            전체
          </div>
          {options.map(o => {
            const sel = selected.includes(o.id);
            return (
              <div
                key={o.id}
                onClick={() => onChange(sel ? selected.filter(s => s !== o.id) : [...selected, o.id])}
                style={{ padding: "5px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, border: "1.5px solid",
                  borderColor: sel ? "#1D9E75" : "#c4c2ba",
                  background: sel ? "#1D9E75" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: "#fff",
                }}>
                  {sel && "✓"}
                </span>
                {colorFn && <span style={{ width: 7, height: 7, borderRadius: "50%", background: colorFn(o) }} />}
                {o.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DepthSelect({ value, onChange }) {
  const opts = [
    { key: "project", label: "프로젝트" },
    { key: "milestone", label: "프로젝트 + 마일스톤" },
    { key: "task", label: "프로젝트 + 마일스톤 + 할일" },
  ];
  return (
    <div style={{ display: "flex", gap: 1, background: "#f0efe8", borderRadius: 6, padding: 2 }}>
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: value === o.key ? 600 : 400,
            background: value === o.key ? "#fff" : "transparent",
            color: value === o.key ? "#2C2C2A" : "#888780",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DateHeader() {
  const weeks = [];
  let weekStart = null;
  dates.forEach((d, i) => {
    if (d.getDay() === 1 || i === 0) weekStart = i;
    if (d.getDay() === 0 || i === dates.length - 1) {
      weeks.push({ start: weekStart, end: i, label: `${dates[weekStart].getMonth() + 1}/${dates[weekStart].getDate()}` });
    }
  });

  return (
    <div style={{ display: "flex", position: "relative", height: 36, borderBottom: "0.5px solid #e8e6df", background: "#fafaf8", flexShrink: 0 }}>
      <div style={{ width: 220, flexShrink: 0, borderRight: "0.5px solid #e8e6df" }} />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {dates.map((d, i) => {
          const left = (i / dates.length) * 100;
          const isToday = d.toDateString() === TODAY.toDateString();
          const isMon = d.getDay() === 1;
          return (
            <div key={i}>
              {isMon && (
                <div style={{ position: "absolute", left: `${left}%`, top: 4, fontSize: 10, color: "#888780", whiteSpace: "nowrap" }}>
                  {d.getMonth() + 1}/{d.getDate()}
                </div>
              )}
              {isToday && (
                <div style={{ position: "absolute", left: `${left}%`, top: 0, bottom: 0, width: 1, background: "#D85A30", zIndex: 3 }}>
                  <div style={{ position: "absolute", top: 2, left: -10, fontSize: 9, color: "#D85A30", fontWeight: 600, whiteSpace: "nowrap" }}>오늘</div>
                </div>
              )}
              <div style={{ position: "absolute", left: `${left}%`, top: 20, bottom: 0, width: 0.5, background: d.getDay() === 1 ? "#e0ddd6" : "transparent" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GanttRow({ label, indent = 0, bars, height = 32, labelColor, labelWeight, dotColor, children, collapsed, onToggle, hasChildren }) {
  return (
    <div style={{ display: "flex", minHeight: height, borderBottom: "0.5px solid #f0efe8", alignItems: "stretch" }}>
      <div style={{
        width: 220, flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
        paddingLeft: 10 + indent * 16, paddingRight: 8, borderRight: "0.5px solid #f0efe8",
        overflow: "hidden",
      }}>
        {hasChildren && (
          <button
            onClick={onToggle}
            style={{ width: 14, height: 14, border: "none", background: "none", cursor: "pointer", color: "#a09f99", fontSize: 8, flexShrink: 0, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .15s", display: "flex", alignItems: "center", justifyContent: "center" }}
          >▾</button>
        )}
        {!hasChildren && <div style={{ width: 14 }} />}
        {dotColor && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />}
        <span style={{ fontSize: 12, fontWeight: labelWeight || 400, color: labelColor || "#2C2C2A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        {bars}
        {/* Today line */}
        <div style={{ position: "absolute", left: `${todayPos * 100}%`, top: 0, bottom: 0, width: 1, background: "#D85A30", opacity: 0.3, zIndex: 1 }} />
      </div>
    </div>
  );
}

function ProjectTimeline({ projectId }) {
  const project = PROJECTS.find(p => p.id === projectId);
  const ms = MILESTONES.filter(m => m.pId === projectId);
  const [collapsed, setCollapsed] = useState(new Set());

  const toggle = (id) => setCollapsed(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <>
      <DateHeader />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {ms.map(m => {
          const mTasks = TASKS.filter(t => t.mId === m.id);
          const isCollapsed = collapsed.has(m.id);
          return (
            <div key={m.id}>
              <GanttRow
                label={m.title}
                indent={0}
                dotColor={m.color}
                labelWeight={500}
                hasChildren={mTasks.length > 0}
                collapsed={isCollapsed}
                onToggle={() => toggle(m.id)}
                bars={
                  <div style={barStyle(m.start, m.end, m.color, 18, 0.25)}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: 3, border: `1px solid ${m.color}`, opacity: 0.4 }} />
                  </div>
                }
              />
              {!isCollapsed && mTasks.map(t => (
                <GanttRow
                  key={t.id}
                  label={t.text}
                  indent={1}
                  labelColor="#5F5E5A"
                  height={28}
                  bars={
                    <div style={barStyle(t.start, t.end, m.color, 14, t.done ? 0.3 : 0.7)} />
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function GlobalTimeline() {
  const [depth, setDepth] = useState("milestone");
  const [selProjects, setSelProjects] = useState(PROJECTS.map(p => p.id));
  const [selMembers, setSelMembers] = useState(MEMBERS.map(m => m.id));
  const [collapsed, setCollapsed] = useState(new Set());

  const toggle = (id) => setCollapsed(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const filteredProjects = PROJECTS.filter(p => selProjects.includes(p.id));

  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "0.5px solid #e8e6df", background: "#fafaf8", flexWrap: "wrap" }}>
        <DepthSelect value={depth} onChange={setDepth} />
        <MultiSelect
          label="프로젝트"
          options={PROJECTS}
          selected={selProjects}
          onChange={setSelProjects}
          colorFn={(o) => o.color}
        />
        <MultiSelect
          label="담당자"
          options={MEMBERS}
          selected={selMembers}
          onChange={setSelMembers}
        />
      </div>

      <DateHeader />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {filteredProjects.map(p => {
          const pMs = MILESTONES.filter(m => m.pId === p.id);
          const pTasks = TASKS.filter(t => t.pId === p.id && selMembers.includes(t.assignee));
          const pCollapsed = collapsed.has(p.id);

          // Project-level bar: spans earliest to latest of all milestones
          const pStart = pMs.reduce((min, m) => m.start < min ? m.start : min, pMs[0]?.start || "2026-03-10");
          const pEnd = pMs.reduce((max, m) => m.end > max ? m.end : max, pMs[0]?.end || "2026-03-31");

          return (
            <div key={p.id}>
              {/* Project row */}
              <GanttRow
                label={p.name}
                indent={0}
                dotColor={p.color}
                labelWeight={500}
                hasChildren={depth !== "project"}
                collapsed={pCollapsed}
                onToggle={() => toggle(p.id)}
                bars={
                  <div style={barStyle(pStart, pEnd, p.color, depth === "project" ? 18 : 10, depth === "project" ? 0.6 : 0.15)}>
                    {depth === "project" && <div style={{ position: "absolute", inset: 0, borderRadius: 3, border: `1px solid ${p.color}`, opacity: 0.3 }} />}
                  </div>
                }
              />

              {/* Milestone rows */}
              {depth !== "project" && !pCollapsed && pMs.map(m => {
                const mTasks = pTasks.filter(t => t.mId === m.id);
                const mCollapsed = collapsed.has(m.id);

                return (
                  <div key={m.id}>
                    <GanttRow
                      label={m.title}
                      indent={1}
                      dotColor={m.color}
                      labelWeight={500}
                      labelColor="#2C2C2A"
                      hasChildren={depth === "task" && mTasks.length > 0}
                      collapsed={mCollapsed}
                      onToggle={() => toggle(m.id)}
                      bars={
                        <div style={barStyle(m.start, m.end, m.color, 16, 0.3)}>
                          <div style={{ position: "absolute", inset: 0, borderRadius: 3, border: `1px solid ${m.color}`, opacity: 0.3 }} />
                        </div>
                      }
                    />

                    {/* Task rows */}
                    {depth === "task" && !mCollapsed && mTasks.map(t => {
                      const member = MEMBERS.find(mm => mm.id === t.assignee);
                      return (
                        <GanttRow
                          key={t.id}
                          label={`${t.text}`}
                          indent={2}
                          labelColor="#5F5E5A"
                          height={26}
                          bars={
                            <>
                              <div style={barStyle(t.start, t.end, m.color, 12, t.done ? 0.25 : 0.6)} />
                              {member && (
                                <div style={{
                                  position: "absolute",
                                  left: `${dayPos(t.end) * 100}%`,
                                  top: "50%", transform: "translateY(-50%)",
                                  marginLeft: 4, fontSize: 10, color: "#888780",
                                  whiteSpace: "nowrap",
                                }}>
                                  {member.name}
                                </div>
                              )}
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function TimelineViewMockup() {
  const [view, setView] = useState("global");

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", fontFamily: "-apple-system, 'Pretendard', sans-serif", fontSize: 13, color: "#2C2C2A", background: "#f7f6f3" }}>
      {/* Sidebar */}
      <div style={{ width: 184, background: "#fff", borderRight: "0.5px solid #e8e6df", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 10px", fontWeight: 600, fontSize: 13 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>R</div>
          Ryan's Todo
        </div>
        <div style={{ padding: "12px 14px 4px", fontSize: 9.5, color: "#888780", fontWeight: 600, letterSpacing: ".06em" }}>글로벌 뷰</div>
        {[["📋","오늘 할일",false],["📑","전체 할일",false],["▦","매트릭스",false],["━","타임라인",view==="global"],["✎","노트",false]].map(([ic,nm,on]) => (
          <div key={nm} onClick={() => nm === "타임라인" && setView("global")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 12, color: on ? "#2C2C2A" : "#7a7870", background: on ? "#eeeee6" : "transparent", fontWeight: on ? 600 : 400, cursor: "pointer" }}>
            <span style={{ width: 14, textAlign: "center", fontSize: 12, opacity: 0.5 }}>{ic}</span>{nm}
          </div>
        ))}
        <div style={{ padding: "12px 14px 4px", fontSize: 9.5, color: "#888780", fontWeight: 600, letterSpacing: ".06em" }}>팀 프로젝트</div>
        {PROJECTS.map(p => (
          <div key={p.id} onClick={() => setView(p.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", fontSize: 12, color: view === p.id ? "#2C2C2A" : "#7a7870", background: view === p.id ? "#eeeee6" : "transparent", fontWeight: view === p.id ? 600 : 400, cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} />{p.name}
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 18px", background: "#fff", borderBottom: "0.5px solid #e8e6df", flexShrink: 0 }}>
          {view === "global" ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 600 }}>타임라인</span>
              <span style={{ fontSize: 11, color: "#888780" }}>전체 프로젝트</span>
            </>
          ) : (
            <>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: PROJECTS.find(p=>p.id===view)?.color }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{PROJECTS.find(p=>p.id===view)?.name}</span>
              <span style={{ fontSize: 11, color: "#888780" }}>타임라인</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                {["마일스톤","할일","타임라인"].map(t => (
                  <button key={t} style={{
                    fontSize: 11.5, padding: "4px 12px", borderRadius: 6, border: "none", fontFamily: "inherit", cursor: "pointer",
                    background: t === "타임라인" ? "#f0efe8" : "none",
                    color: t === "타임라인" ? "#2C2C2A" : "#a09f99",
                    fontWeight: t === "타임라인" ? 600 : 500,
                  }}>{t}</button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
          {view === "global" ? (
            <GlobalTimeline />
          ) : (
            <ProjectTimeline projectId={view} />
          )}
        </div>
      </div>
    </div>
  );
}
