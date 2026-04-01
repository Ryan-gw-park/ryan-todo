import { useState } from "react";

const S = {
  font: "'Noto Sans KR','Inter',-apple-system,sans-serif",
  text: "#37352f", sub: "#6b6a66", muted: "#a09f99",
  border: "#e8e6df", bg: "#fafaf8",
};

const PROJECTS = [
  { id:"p0", name:"개별과제", color:"#38A169" },
  { id:"p1", name:"C&", color:"#E53E3E" },
  { id:"p2", name:"정기주총", color:"#E53E3E" },
  { id:"p3", name:"ABI 코리아", color:"#3182CE" },
  { id:"p4", name:"일본법인/해외SCM", color:"#805AD5" },
  { id:"p5", name:"BIS", color:"#DD6B20" },
];

const MEMBERS = [
  { id:"ryan", name:"Ryan", color:"#E53E3E" },
  { id:"edmond", name:"Edmond", color:"#3182CE" },
  { id:"eric", name:"eric.kim", color:"#38A169" },
  { id:"ash", name:"ash.kim", color:"#D69E2E" },
];

function Av({ name, color, size=22 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:color||"#888",
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"#fff", fontSize:size*0.42, fontWeight:600, flexShrink:0 }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

function Check({ done, onChange }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange?.() }} style={{
      width:14, height:14, borderRadius:3, flexShrink:0, cursor:"pointer",
      border: done ? "none" : `1.5px solid #c8c7c1`,
      background: done ? "#22c55e" : "#fff",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      {done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
  );
}

// ═══════════════════════════════════════
//  팀 매트릭스 — 행=프로젝트, 열=팀원
// ═══════════════════════════════════════
function TeamMatrix() {
  const [collapsed, setCollapsed] = useState(new Set());
  const [doneSet, setDoneSet] = useState(new Set());

  const toggle = (id) => setCollapsed(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleDone = (id) => setDoneSet(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const teamData = {
    p0: { ryan:[{id:"t01",text:"공시 위반 케이스별 처벌 수위"}] },
    p1: { ryan:[{id:"t02",text:"4/4 메르디앙 입주"},{id:"t03",text:"3/23 송화케슬 입주"}] },
    p2: {
      ryan:[{id:"t04",text:"금요일 주총 참석자 공지"},{id:"t05",text:"Q&A, 백업자료 등"},{id:"t06",text:"출력물"},{id:"t07",text:"주총 결과 공시"}],
      edmond:[{id:"t08",text:"필요 서류 공증인 확인 필요"},{id:"t09",text:"등기 서류 <-> 공증인 확인 체크"},{id:"t10",text:"투표 엑셀"},{id:"t11",text:"의사록 작성"}],
    },
    p3: {
      ryan:[{id:"t12",text:"킥오프 미팅 4월 1일"}],
      eric:[{id:"t13",text:"ABI 이사회 Paper Work"}],
    },
    p4: { ryan:[{id:"t14",text:"TP 스터디 감사위원회 규정 확인"},{id:"t15",text:"Jieun님 크로스체크"}] },
    p5: { ryan:[{id:"t16",text:"제출 서류 작성"}] },
  };

  return (
    <div style={{ flex:1, overflow:"auto", padding:"16px 20px" }}>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:20, fontWeight:700, margin:0 }}>팀 매트릭스</h1>
        <p style={{ fontSize:12, color:S.muted, marginTop:4 }}>2026년 3월 30일 월요일</p>
      </div>

      <div style={{ border:`0.5px solid ${S.border}`, borderRadius:10, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:`160px repeat(${MEMBERS.length}, 1fr)` }}>
          <div style={{ padding:"8px 10px", background:S.bg, borderBottom:`1px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`, fontSize:11, fontWeight:600, color:S.muted }}>
            프로젝트
          </div>
          {MEMBERS.map(m => (
            <div key={m.id} style={{ padding:"8px 10px", background:S.bg, borderBottom:`1px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`, display:"flex", alignItems:"center", gap:6 }}>
              <Av name={m.name} color={m.color} size={20} />
              <span style={{ fontSize:12, fontWeight:600, color:S.text }}>{m.name}</span>
            </div>
          ))}
        </div>

        {/* Project rows */}
        {PROJECTS.map(proj => {
          const projData = teamData[proj.id] || {};
          const totalTasks = Object.values(projData).reduce((s, arr) => s + arr.length, 0);
          const isCollapsed = collapsed.has(proj.id);

          return (
            <div key={proj.id}>
              {/* Project header row — always visible */}
              <div
                onClick={() => toggle(proj.id)}
                style={{
                  display:"grid", gridTemplateColumns:`160px repeat(${MEMBERS.length}, 1fr)`,
                  cursor:"pointer",
                }}
              >
                <div style={{
                  padding:"8px 10px", borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`,
                  display:"flex", alignItems:"center", gap:5,
                  background: isCollapsed ? "#fff" : `${proj.color}04`,
                }}>
                  <span style={{ fontSize:9, color:S.muted, width:12, textAlign:"center", transition:"transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)" }}>▾</span>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:proj.color, flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:600, color:S.text, flex:1 }}>{proj.name}</span>
                  <span style={{ fontSize:9, color:S.muted }}>{totalTasks}건</span>
                </div>
                {/* Collapsed summary per member */}
                {MEMBERS.map(mem => {
                  const tasks = projData[mem.id] || [];
                  return (
                    <div key={mem.id} style={{
                      padding:"8px 10px", borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`,
                      fontSize:10, color:S.muted,
                      background: isCollapsed ? "#fff" : `${proj.color}04`,
                    }}>
                      {isCollapsed && tasks.length > 0 ? `${tasks.length}건` : isCollapsed ? "—" : ""}
                    </div>
                  );
                })}
              </div>

              {/* Expanded: task cells */}
              {!isCollapsed && (
                <div style={{ display:"grid", gridTemplateColumns:`160px repeat(${MEMBERS.length}, 1fr)` }}>
                  <div style={{ borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}` }} />
                  {MEMBERS.map(mem => {
                    const tasks = projData[mem.id] || [];
                    return (
                      <div key={mem.id} style={{ padding:"6px 10px", borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`, minHeight:36 }}>
                        {tasks.length === 0 ? (
                          <span style={{ fontSize:10, color:"#e0e0e0" }}>—</span>
                        ) : tasks.map(t => (
                          <div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:5, padding:"2px 0" }}>
                            <Check done={doneSet.has(t.id)} onChange={() => toggleDone(t.id)} />
                            <span style={{
                              fontSize:12.5, color: doneSet.has(t.id) ? S.muted : S.text, lineHeight:1.4,
                              textDecoration: doneSet.has(t.id) ? "line-through" : "none",
                            }}>{t.text}</span>
                          </div>
                        ))}
                        <div style={{ fontSize:10, color:"#d0d0d0", marginTop:4, cursor:"pointer", paddingLeft:19 }}>+ 추가</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* 완료 */}
        <div style={{ padding:"8px 12px", fontSize:12, color:S.muted, cursor:"pointer" }}>
          ▸ 완료 · 22건
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  개인 매트릭스 — 행=프로젝트, 열=카테고리
// ═══════════════════════════════════════
function PersonalMatrix() {
  const [collapsed, setCollapsed] = useState(new Set());
  const [doneSet, setDoneSet] = useState(new Set());

  const toggle = (id) => setCollapsed(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleDone = (id) => setDoneSet(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const cats = [
    { key:"today", label:"지금 할일", dot:"#E53E3E" },
    { key:"next", label:"다음", dot:"#D69E2E" },
    { key:"later", label:"나중", dot:"#3182CE" },
  ];

  const data = [
    { id:"p0", proj:"개별과제", color:"#38A169",
      today:[{id:"pt01",text:"공시 위반 케이스별 처벌 수위"}], next:[], later:[] },
    { id:"p1", proj:"C&", color:"#E53E3E",
      today:[{id:"pt02",text:"4/4 메르디앙 입주"},{id:"pt03",text:"3/23 송화케슬 입주"}],
      next:[{id:"pt04",text:"매월 20일 아이컴포넌트 세금계산서 발행"},{id:"pt05",text:"매월 25일 청소/승강기 지급"},{id:"pt06",text:"법인세 처리"}], later:[] },
    { id:"p2", proj:"정기주총", color:"#E53E3E",
      today:[{id:"pt07",text:"금요일 주총 참석자 공지"},{id:"pt08",text:"Q&A, 백업자료 등"},{id:"pt09",text:"출력물"},{id:"pt10",text:"주총 결과 공시"}],
      next:[{id:"pt11",text:"투표 엑셀"},{id:"pt12",text:"의사록 작성"}], later:[] },
    { id:"p3", proj:"ABI 코리아", color:"#3182CE",
      today:[{id:"pt13",text:"킥오프 미팅 4월 1일"}], next:[], later:[] },
    { id:"p4", proj:"일본법인/해외SCM", color:"#805AD5",
      today:[{id:"pt14",text:"TP 스터디 감사위원회 규정 확인"},{id:"pt15",text:"Jieun님 크로스체크"}], next:[], later:[] },
    { id:"p5", proj:"BIS", color:"#DD6B20",
      today:[{id:"pt16",text:"제출 서류 작성"}], next:[], later:[] },
  ];

  const totalByKey = (key) => data.reduce((s, d) => s + d[key].length, 0);

  return (
    <div style={{ flex:1, overflow:"auto", padding:"16px 20px" }}>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:20, fontWeight:700, margin:0 }}>개인 매트릭스</h1>
        <p style={{ fontSize:12, color:S.muted, marginTop:4 }}>2026년 3월 30일 월요일</p>
      </div>

      <div style={{ display:"flex", gap:16, marginBottom:12, fontSize:12, color:S.muted }}>
        <span>전체: <b style={{ color:S.text }}>{totalByKey("today")+totalByKey("next")+totalByKey("later")}</b>건</span>
        {cats.map(c => <span key={c.key}>{c.label}: <b style={{ color:S.text }}>{totalByKey(c.key)}</b></span>)}
        <span style={{ color:"#ccc" }}>완료: 22</span>
      </div>

      <div style={{ border:`0.5px solid ${S.border}`, borderRadius:10, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:`160px repeat(${cats.length}, 1fr)` }}>
          <div style={{ padding:"8px 10px", background:S.bg, borderBottom:`1px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`, fontSize:11, fontWeight:600, color:S.muted }}>
            프로젝트
          </div>
          {cats.map(c => (
            <div key={c.key} style={{ padding:"8px 10px", background:S.bg, borderBottom:`1px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`, fontSize:11, fontWeight:600, color: c.key==="today" ? "#E53E3E" : S.sub }}>
              <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:c.dot, marginRight:4 }} />
              {c.label} <span style={{ color:S.muted, fontWeight:400 }}>{totalByKey(c.key)}</span>
            </div>
          ))}
        </div>

        {/* Project rows */}
        {data.map(row => {
          const total = row.today.length + row.next.length + row.later.length;
          const isCollapsed = collapsed.has(row.id);
          const catArrays = [row.today, row.next, row.later];

          return (
            <div key={row.id}>
              {/* Project header — clickable to collapse */}
              <div
                onClick={() => toggle(row.id)}
                style={{ display:"grid", gridTemplateColumns:`160px repeat(${cats.length}, 1fr)`, cursor:"pointer" }}
              >
                <div style={{
                  padding:"8px 10px", borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`,
                  display:"flex", alignItems:"center", gap:5,
                  background: isCollapsed ? "#fff" : `${row.color}04`,
                }}>
                  <span style={{ fontSize:9, color:S.muted, width:12, textAlign:"center", transition:"transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)" }}>▾</span>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:row.color, flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:600, color:S.text, flex:1 }}>{row.proj}</span>
                  <span style={{ fontSize:9, color:S.muted }}>{total}건</span>
                </div>
                {/* Collapsed summary */}
                {catArrays.map((tasks, ci) => (
                  <div key={ci} style={{
                    padding:"8px 10px", borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`,
                    fontSize:10, color:S.muted,
                    background: isCollapsed ? "#fff" : `${row.color}04`,
                  }}>
                    {isCollapsed && tasks.length > 0 ? `${tasks.length}건` : isCollapsed ? "—" : ""}
                  </div>
                ))}
              </div>

              {/* Expanded */}
              {!isCollapsed && (
                <div style={{ display:"grid", gridTemplateColumns:`160px repeat(${cats.length}, 1fr)` }}>
                  <div style={{ borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}` }} />
                  {catArrays.map((tasks, ci) => (
                    <div key={ci} style={{ padding:"6px 10px", borderBottom:`0.5px solid ${S.border}`, borderRight:`0.5px solid ${S.border}`, minHeight:36 }}>
                      {tasks.length === 0 ? (
                        <span style={{ fontSize:10, color:"#e0e0e0" }}>—</span>
                      ) : tasks.map(t => (
                        <div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:5, padding:"2px 0" }}>
                          <Check done={doneSet.has(t.id)} onChange={() => toggleDone(t.id)} />
                          <span style={{
                            fontSize:12.5, color: doneSet.has(t.id) ? S.muted : S.text, lineHeight:1.4,
                            textDecoration: doneSet.has(t.id) ? "line-through" : "none",
                          }}>{t.text}</span>
                        </div>
                      ))}
                      <div style={{ fontSize:10, color:"#d0d0d0", marginTop:4, cursor:"pointer", paddingLeft:19 }}>+ 추가</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 완료 */}
        <div style={{ padding:"8px 12px", fontSize:12, color:S.muted, cursor:"pointer" }}>
          ▸ 완료 · 22건
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  Backlog Sidebar
// ═══════════════════════════════════════
function BacklogSidebar() {
  const [assign, setAssign] = useState("unassigned");
  const pill = (active, label, onClick) => (
    <button onClick={onClick} style={{
      border:"none", borderRadius:4, padding:"3px 10px", fontSize:10.5, fontFamily:S.font, cursor:"pointer",
      fontWeight: active ? 600 : 400, background: active ? "#fff" : "transparent",
      color: active ? S.text : S.muted, boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
    }}>{label}</button>
  );
  return (
    <div style={{ width:260, flexShrink:0, borderLeft:`1px solid ${S.border}`, display:"flex", flexDirection:"column", background:"#fafaf8" }}>
      <div style={{ padding:"12px 12px 8px", borderBottom:`1px solid ${S.border}` }}>
        <div style={{ fontSize:14, fontWeight:700, color:S.text, marginBottom:10 }}>백로그</div>
        <select style={{ width:"100%", padding:"5px 8px", borderRadius:6, border:`1px solid ${S.border}`, fontSize:11, fontFamily:S.font, color:S.text, background:"#fff", marginBottom:8, cursor:"pointer" }}>
          <option>전체 프로젝트</option>
        </select>
        <div style={{ display:"flex", gap:2, background:"#f0efeb", borderRadius:6, padding:2, marginBottom:8 }}>
          {pill(assign==="all", "전체", () => setAssign("all"))}
          {pill(assign==="unassigned", "미배정", () => setAssign("unassigned"))}
          {pill(assign==="assigned", "배정됨", () => setAssign("assigned"))}
        </div>
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:10, color:S.muted, marginBottom:6, fontWeight:500 }}>프로젝트별 배정 단위</div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#3182CE" }} />
            <span style={{ fontSize:10, color:S.sub, flex:1 }}>ABI 코리아</span>
            {["L1","L2","L3"].map((l,i) => (
              <button key={l} style={{ fontSize:9, padding:"1px 6px", borderRadius:3, border:"none", cursor:"pointer", fontFamily:S.font, background:i===0?"#3182CE":"#eee", color:i===0?"#fff":S.muted, fontWeight:i===0?600:400 }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ flex:1, overflow:"auto", padding:8 }}>
        {[
          { name:"ABI 코리아", color:"#3182CE", items:["법인설립","회계/세무","직원 전적","지점 운영","PE","공시"] },
          { name:"정기주총", color:"#E53E3E", items:["주주분류 + 1% 이상 개별 연락","공동행사약정서 (w/ Brandon)","소집통지 (1% 이상, 이메일)","소집 공고","위임장 발송 + 등기 서류 취합","등기","안건자료 PPT"] },
        ].map(g => (
          <div key={g.name} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 0", marginBottom:4 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:g.color }} />
              <span style={{ fontSize:11, fontWeight:600, color:g.color }}>{g.name}</span>
              <span style={{ fontSize:9, color:S.muted, marginLeft:"auto" }}>{g.items.length}개</span>
            </div>
            {g.items.map((m,i) => (
              <div key={i} draggable style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 8px", marginBottom:3, borderRadius:5, background:`${g.color}08`, border:`0.5px solid ${g.color}18`, cursor:"grab", fontSize:11 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:g.color, flexShrink:0 }} />
                <span style={{ fontWeight:500, color:S.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ padding:"8px 12px", borderTop:`1px solid ${S.border}`, textAlign:"center" }}>
        <span style={{ fontSize:10, color:S.muted }}>← 셀로 드래그하여 배정</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  Main
// ═══════════════════════════════════════
export default function App() {
  const [view, setView] = useState("team");
  return (
    <div style={{ fontFamily:S.font, height:"100vh", display:"flex", flexDirection:"column", color:S.text }}>
      <div style={{ padding:"12px 20px", borderBottom:`1px solid ${S.border}`, display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        {[{k:"team",l:"팀 매트릭스"},{k:"personal",l:"개인 매트릭스"}].map(t => (
          <button key={t.k} onClick={() => setView(t.k)} style={{
            fontSize:12, padding:"6px 16px", borderRadius:6, border:"none", cursor:"pointer", fontFamily:S.font,
            background: view===t.k ? "#1e293b" : "#f5f4f0", color: view===t.k ? "#fff" : S.muted, fontWeight: view===t.k ? 600 : 400,
          }}>{t.l}</button>
        ))}
        <div style={{ flex:1 }} />
        <div style={{ display:"flex", gap:2, background:S.bg, borderRadius:7, padding:2 }}>
          <button style={{ border:"none", borderRadius:5, padding:"4px 14px", fontSize:11, fontFamily:S.font, cursor:"pointer", fontWeight:600, background:"#fff", color:S.text, boxShadow:"0 1px 2px rgba(0,0,0,0.06)" }}>할일 모드</button>
          <button style={{ border:"none", borderRadius:5, padding:"4px 14px", fontSize:11, fontFamily:S.font, cursor:"pointer", fontWeight:400, background:"transparent", color:S.muted }}>MS 배정</button>
        </div>
      </div>

      <div style={{ padding:"6px 20px", background:"#fef9ec", fontSize:10.5, color:"#92400e", borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
        <strong>v3:</strong> 프로젝트 행 클릭 → 접기/펼치기. 접힌 상태에서 각 셀에 건수만 표시. 모든 할일 앞에 체크박스 추가.
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {view === "team" ? <TeamMatrix /> : <PersonalMatrix />}
        <BacklogSidebar />
      </div>
    </div>
  );
}
