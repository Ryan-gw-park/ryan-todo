import { useState } from "react";

// ─── Notion-style color system ───
const PC = {
  green:  { card: "#f0faf5", header: "#d1fae5", text: "#166534", dot: "#22c55e" },
  pink:   { card: "#fdf2f0", header: "#fce7e4", text: "#9b2c2c", dot: "#e05252" },
  blue:   { card: "#eff6ff", header: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  purple: { card: "#f5f3ff", header: "#ede9fe", text: "#5b21b6", dot: "#8b5cf6" },
  yellow: { card: "#fef9ec", header: "#fef3c7", text: "#92400e", dot: "#d97706" },
  orange: { card: "#fff7ed", header: "#ffedd5", text: "#9a3412", dot: "#f97316" },
};

const PROJECTS = [
  { id:"p1", name:"개별과제", color:"green", teamId:null },
  { id:"p2", name:"정기주총", color:"pink", teamId:"t1" },
  { id:"p3", name:"ABI 코리아", color:"blue", teamId:"t1" },
  { id:"p4", name:"일본법인/해외SCM", color:"purple", teamId:"t1" },
  { id:"p5", name:"BIS", color:"orange", teamId:"t1" },
  { id:"p6", name:"C&", color:"yellow", teamId:null },
];

const MS = [
  { id:"ms1", projectId:"p2", name:"공증 준비", color:"#e05252", ownerId:"ryan", progress:2, total:6, dueDate:"03/28" },
  { id:"ms2", projectId:"p2", name:"안건자료 PPT", color:"#f97316", ownerId:"ryan", progress:1, total:2, dueDate:"03/25" },
  { id:"ms3", projectId:"p2", name:"의사록+첨부서류", color:"#8b5cf6", ownerId:"edmond", progress:0, total:1, dueDate:"04/01" },
  { id:"ms4", projectId:"p3", name:"마일스톤 정의", color:"#3b82f6", ownerId:"ryan", progress:0, total:2, dueDate:"03/22" },
  { id:"ms5", projectId:"p4", name:"PO/물류 Flow", color:"#8b5cf6", ownerId:"ryan", progress:0, total:2, dueDate:"03/30" },
  { id:"ms6", projectId:"p4", name:"일본법인 계약", color:"#22c55e", ownerId:null, progress:0, total:1, dueDate:"04/05" },
];

const MEMBERS = [
  { id:"ryan", name:"Ryan Park", initial:"R", color:"#1D9E75" },
  { id:"edmond", name:"Edmond Park", initial:"E", color:"#6366f1" },
  { id:"ash", name:"ash.kim", initial:"A", color:"#f59e0b" },
  { id:"eric", name:"eric.kim", initial:"E", color:"#ef4444" },
];

const TASKS = [
  // 개별과제
  { id:"t1", text:"사업보고서 업데이트", projectId:"p1", msId:null, category:"today", done:false, assignee:"ryan", dueDate:"03/19" },
  { id:"t2", text:"원진 회신", projectId:"p1", msId:null, category:"today", done:false, assignee:"ryan", dueDate:"03/19" },
  { id:"t3", text:"공시 위반 케이스별 처벌 수위", projectId:"p1", msId:null, category:"today", done:false, assignee:"ryan", dueDate:null },
  { id:"t4", text:"전결권 이사회 승인 필요?", projectId:"p1", msId:null, category:"backlog", done:false, assignee:"ryan", dueDate:null },
  // 정기주총
  { id:"t5", text:"안건 PPT - 수요일 오후 3시", projectId:"p2", msId:"ms2", category:"today", done:false, assignee:"ryan", dueDate:"03/19" },
  { id:"t6", text:"Sifive 메일 번역?", projectId:"p2", msId:null, category:"today", done:false, assignee:"ryan", dueDate:"03/19" },
  { id:"t7", text:"위임:본+산은 추가하기", projectId:"p2", msId:"ms1", category:"backlog", done:false, assignee:"ryan", dueDate:null },
  { id:"t8", text:"안건 PPT 재무제표 분석", projectId:"p2", msId:"ms2", category:"backlog", done:false, assignee:"ryan", dueDate:null },
  { id:"t9", text:"등기서류 공증인 확인 체크", projectId:"p2", msId:"ms1", category:"backlog", done:false, assignee:"ryan", dueDate:null },
  { id:"t10", text:"위임장 뿌리기+웹사이트 게재", projectId:"p2", msId:"ms1", category:"backlog", done:false, assignee:"ryan", dueDate:null },
  { id:"t11", text:"필요 서류 공증인 확인 필요", projectId:"p2", msId:"ms1", category:"backlog", done:false, assignee:"ryan", dueDate:null },
  { id:"t12", text:"Sifive 위임투표 양식 (BKL)", projectId:"p2", msId:"ms1", category:"next", done:false, assignee:"ash", dueDate:"03/20" },
  { id:"t13", text:"의사록 작성", projectId:"p2", msId:"ms3", category:"next", done:false, assignee:"edmond", dueDate:"03/21" },
  { id:"t14", text:"투표 역선", projectId:"p2", msId:null, category:"backlog", done:false, assignee:"ryan", dueDate:null },
  // ABI 코리아
  { id:"t15", text:"마일스톤 정의+순서+Todo 스케줄링", projectId:"p3", msId:"ms4", category:"today", done:false, assignee:"ryan", dueDate:"03/19" },
  { id:"t16", text:"ABI 이사회 Paper Work", projectId:"p3", msId:null, category:"backlog", done:false, assignee:"ryan", dueDate:null },
  // 일본법인
  { id:"t17", text:"PO/물류/자금 Flow 정리 x Case별", projectId:"p4", msId:"ms5", category:"today", done:false, assignee:"ryan", dueDate:"03/19" },
  { id:"t18", text:"일본법인 계약 Flow (PO) 정리", projectId:"p4", msId:"ms6", category:"today", done:false, assignee:"ryan", dueDate:"03/20" },
  // BIS
  { id:"t19", text:"제출 서류 작성", projectId:"p5", msId:null, category:"today", done:false, assignee:"ryan", dueDate:"03/20" },
  { id:"t20", text:"Sales팀 자료 취합", projectId:"p5", msId:null, category:"today", done:false, assignee:"ryan", dueDate:"03/19" },
  // C&
  { id:"t21", text:"4/4 메르디앙 입주", projectId:"p6", msId:null, category:"today", done:false, assignee:"ryan", dueDate:"04/04" },
  { id:"t22", text:"3/23 송화캐슬 입주", projectId:"p6", msId:null, category:"today", done:false, assignee:"ryan", dueDate:"03/23" },
  { id:"t23", text:"매월 20일 아이컴포넌트 세금계산서 발행", projectId:"p6", msId:null, category:"next", done:false, assignee:"ryan", dueDate:"03/20" },
  { id:"t24", text:"매월 25일 청소/승강기 지급", projectId:"p6", msId:null, category:"next", done:false, assignee:"ryan", dueDate:"03/25" },
  { id:"t25", text:"법인세 처리", projectId:"p6", msId:null, category:"next", done:false, assignee:"ryan", dueDate:null },
  { id:"t26", text:"리스차 처리", projectId:"p6", msId:null, category:"backlog", done:false, assignee:"ryan", dueDate:null },
];

// ─── Shared styles ───
const S = {
  font: "'Noto Sans KR','Inter',-apple-system,sans-serif",
  textPrimary: "#37352f",
  textSecondary: "#6b6a66",
  textTertiary: "#a09f99",
  border: "#e8e6df",
  bgPage: "#ffffff",
  bgSurface: "#fafaf8",
  bgHover: "#f5f4f0",
};

const Pill = ({items, active, onChange}) => (
  <div style={{display:"flex",gap:2,background:S.bgSurface,borderRadius:8,padding:2}}>
    {items.map(it => (
      <button key={it} onClick={()=>onChange(it)} style={{
        border:"none",borderRadius:6,padding:"5px 14px",fontSize:12,fontFamily:S.font,cursor:"pointer",
        fontWeight:active===it?600:400,
        background:active===it?"#fff":"transparent",
        color:active===it?S.textPrimary:S.textTertiary,
        boxShadow:active===it?"0 1px 2px rgba(0,0,0,0.06)":"none",
      }}>{it}</button>
    ))}
  </div>
);

const Dot = ({color,size=8}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0}} />
);

const Check = ({done,size=16}) => (
  <div style={{
    width:size,height:size,borderRadius:4,flexShrink:0,cursor:"pointer",
    border:done?"none":"1.5px solid #d0d0d0",
    background:done?"#2383e2":"#fff",
    display:"flex",alignItems:"center",justifyContent:"center",
  }}>
    {done && <svg width={10} height={10} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </div>
);

const MsBadge = ({ms}) => {
  if (!ms) return <span style={{fontSize:11,color:S.textTertiary}}>+MS 연결</span>;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:ms.color,background:`${ms.color}12`,borderRadius:4,padding:"1px 6px"}}>
      <Dot color={ms.color} size={6}/>{ms.name}
    </span>
  );
};

const ProgressBar = ({done,total,color="#22c55e",width=60}) => (
  <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{width,height:4,borderRadius:2,background:"#e8e6df"}}>
      <div style={{width:`${total?done/total*100:0}%`,height:4,borderRadius:2,background:color,transition:"width 0.3s"}}/>
    </div>
    <span style={{fontSize:11,color:S.textSecondary}}>{done}/{total}</span>
  </div>
);

const DetailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{opacity:0.3,cursor:"pointer"}}>
    <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Avatar = ({member,size=20}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:member.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.45,fontWeight:600,flexShrink:0}}>
    {member.initial}
  </div>
);

// ════════════════════════════════════════
// VIEW 1: AllTasksView — MS Grouping (단일 뷰)
// ════════════════════════════════════════
function AllTasksMockup() {
  const [expanded, setExpanded] = useState({"p2":true,"p3":true});
  const toggle = (id) => setExpanded(p=>({...p,[id]:!p[id]}));

  const projTasks = (pid) => TASKS.filter(t=>t.projectId===pid && !t.done);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <span style={{fontSize:14,fontWeight:600,color:S.textPrimary}}>전체 할일</span>
        <span style={{fontSize:12,color:S.textTertiary}}>총 {TASKS.filter(t=>!t.done).length}건</span>
      </div>
      {PROJECTS.map(p => {
        const tasks = projTasks(p.id);
        if (!tasks.length) return null;
        const projMs = MS.filter(m=>m.projectId===p.id);
        const unlinked = tasks.filter(t=>!t.msId);
        const isOpen = expanded[p.id] !== false;
        return (
          <div key={p.id} style={{marginBottom:20,background:"#fff",borderRadius:10,border:`0.5px solid ${S.border}`,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:PC[p.color].card,cursor:"pointer"}} onClick={()=>toggle(p.id)}>
              <Dot color={PC[p.color].dot} />
              <span style={{fontSize:14,fontWeight:600,color:S.textPrimary}}>{p.name}</span>
              <span style={{fontSize:12,color:S.textTertiary}}>{tasks.length}건</span>
              <span style={{marginLeft:"auto",fontSize:11,color:S.textTertiary}}>{isOpen?"▾":"▸"}</span>
            </div>
            {isOpen && (
              <div style={{padding:"4px 0"}}>
                {projMs.map(ms => {
                  const msTasks = tasks.filter(t=>t.msId===ms.id);
                  if (!msTasks.length) return null;
                  return (
                    <div key={ms.id} style={{padding:"0 14px",marginBottom:4}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0 4px 0"}}>
                        <Dot color={ms.color} size={6} />
                        <span style={{fontSize:13,fontWeight:600,color:S.textPrimary}}>{ms.name}</span>
                        <ProgressBar done={ms.progress} total={ms.total} color={ms.color} />
                        <span style={{fontSize:11,color:S.textTertiary}}>{ms.dueDate}</span>
                      </div>
                      {msTasks.map(t => (
                        <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0 5px 14px",borderBottom:`0.5px solid ${S.border}`}}>
                          <Check done={t.done} />
                          <span style={{flex:1,fontSize:13,color:S.textPrimary}}>{t.text}</span>
                          <span style={{fontSize:11,color:S.textTertiary,background:"#f5f4f0",borderRadius:4,padding:"1px 6px"}}>{t.category}</span>
                          <DetailIcon />
                        </div>
                      ))}
                    </div>
                  );
                })}
                {unlinked.length > 0 && (
                  <div style={{padding:"0 14px",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0 4px 0"}}>
                      <span style={{fontSize:12,color:S.textTertiary,fontStyle:"italic"}}>미연결 ({unlinked.length})</span>
                    </div>
                    {unlinked.map(t => (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0 5px 14px",borderBottom:`0.5px solid ${S.border}`}}>
                        <Check done={t.done} />
                        <span style={{flex:1,fontSize:13,color:S.textPrimary}}>{t.text}</span>
                        <span style={{fontSize:11,color:S.textTertiary}}>+MS 연결</span>
                        <DetailIcon />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════
// VIEW 2: Matrix — Task mode + MS mode
// ════════════════════════════════════════
function MatrixMockup() {
  const [matrixMode, setMatrixMode] = useState("할일 모드");
  const [filter, setFilter] = useState("전체");
  const cats = ["오늘","다음","남은"];
  const visibleProjects = PROJECTS.filter(p => filter==="전체" || (filter==="팀"?p.teamId:!p.teamId));

  if (matrixMode === "할일 모드") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <Pill items={["할일 모드","마일스톤 모드"]} active={matrixMode} onChange={setMatrixMode} />
          <Pill items={["전체","팀","개인"]} active={filter} onChange={setFilter} />
        </div>
        {/* Header */}
        <div style={{display:"grid",gridTemplateColumns:`100px repeat(${visibleProjects.length}, 1fr)`,gap:1}}>
          <div />
          {visibleProjects.map(p => (
            <div key={p.id} style={{background:PC[p.color].header,borderRadius:"8px 8px 0 0",padding:"8px 10px",display:"flex",alignItems:"center",gap:6}}>
              <Dot color={PC[p.color].dot} />
              <span style={{fontSize:13,fontWeight:600,color:PC[p.color].text}}>{p.name}</span>
            </div>
          ))}
          {/* Rows */}
          {cats.map(cat => {
            const catKey = cat==="오늘"?"today":cat==="다음"?"next":"backlog";
            return [
              <div key={`label-${cat}`} style={{padding:"10px 8px",fontSize:12,fontWeight:600,color:S.textSecondary,display:"flex",alignItems:"flex-start"}}>
                {cat} 할일
              </div>,
              ...visibleProjects.map(p => {
                const tasks = TASKS.filter(t=>t.projectId===p.id && t.category===catKey && !t.done);
                return (
                  <div key={`${p.id}-${cat}`} style={{background:PC[p.color].card,padding:8,minHeight:60,borderBottom:`0.5px solid ${S.border}`}}>
                    <span style={{fontSize:11,color:PC[p.color].text}}>• {cat} {tasks.length}</span>
                    {tasks.map(t => (
                      <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:6,padding:"4px 0",marginTop:4,background:"#fff",borderRadius:6,padding:"6px 8px"}}>
                        <Check done={t.done} size={14} />
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:S.textPrimary,lineHeight:1.4}}>{t.text}</div>
                          <MsBadge ms={MS.find(m=>m.id===t.msId)} />
                        </div>
                      </div>
                    ))}
                    <div style={{marginTop:4,fontSize:11,color:S.textTertiary,cursor:"pointer"}}>+ 추가</div>
                  </div>
                );
              })
            ];
          })}
        </div>
      </div>
    );
  }

  // 마일스톤 모드
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <Pill items={["할일 모드","마일스톤 모드"]} active={matrixMode} onChange={setMatrixMode} />
        <Pill items={["전체","팀","개인"]} active={filter} onChange={setFilter} />
      </div>
      {/* Header */}
      <div style={{display:"grid",gridTemplateColumns:`120px repeat(${visibleProjects.filter(p=>p.teamId).length}, 1fr)`,gap:1}}>
        <div style={{padding:8,fontSize:12,fontWeight:600,color:S.textSecondary}}>담당자</div>
        {visibleProjects.filter(p=>p.teamId).map(p => (
          <div key={p.id} style={{background:PC[p.color].header,borderRadius:"8px 8px 0 0",padding:"8px 10px",display:"flex",alignItems:"center",gap:6}}>
            <Dot color={PC[p.color].dot} />
            <span style={{fontSize:13,fontWeight:600,color:PC[p.color].text}}>{p.name}</span>
          </div>
        ))}
        {/* Member rows */}
        {MEMBERS.map(mem => [
          <div key={`mem-${mem.id}`} style={{display:"flex",alignItems:"center",gap:6,padding:8}}>
            <Avatar member={mem} />
            <span style={{fontSize:12,fontWeight:500,color:S.textPrimary}}>{mem.name.split(" ")[0]}</span>
          </div>,
          ...visibleProjects.filter(p=>p.teamId).map(p => {
            const projMs = MS.filter(m=>m.projectId===p.id && m.ownerId===mem.id);
            return (
              <div key={`${mem.id}-${p.id}`} style={{background:PC[p.color].card,padding:8,minHeight:80,borderBottom:`0.5px solid ${S.border}`}}>
                {projMs.length === 0 && <span style={{fontSize:11,color:S.textTertiary}}>—</span>}
                {projMs.map(ms => (
                  <div key={ms.id} style={{background:"#fff",borderRadius:8,padding:"8px 10px",marginBottom:6,cursor:"pointer",border:`0.5px solid ${S.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <Dot color={ms.color} size={6} />
                      <span style={{fontSize:12,fontWeight:600,color:S.textPrimary}}>{ms.name}</span>
                    </div>
                    <ProgressBar done={ms.progress} total={ms.total} color={ms.color} width={50} />
                    <div style={{fontSize:11,color:S.textTertiary,marginTop:2}}>{ms.total}건 · {ms.dueDate}</div>
                  </div>
                ))}
              </div>
            );
          })
        ])}
        {/* Unassigned row */}
        <div style={{display:"flex",alignItems:"center",gap:6,padding:8}}>
          <span style={{fontSize:12,fontWeight:500,color:S.textTertiary,fontStyle:"italic"}}>미배정</span>
        </div>
        {visibleProjects.filter(p=>p.teamId).map(p => {
          const unassigned = MS.filter(m=>m.projectId===p.id && !m.ownerId);
          return (
            <div key={`unassign-${p.id}`} style={{background:PC[p.color].card,padding:8,minHeight:40,borderBottom:`0.5px solid ${S.border}`}}>
              {unassigned.map(ms => (
                <div key={ms.id} style={{background:"#fff",borderRadius:8,padding:"8px 10px",marginBottom:6,border:`0.5px solid ${S.border}`,opacity:0.7}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <Dot color={ms.color} size={6} />
                    <span style={{fontSize:12,fontWeight:500,color:S.textPrimary}}>{ms.name}</span>
                  </div>
                  <span style={{fontSize:11,color:S.textTertiary}}>{ms.total}건</span>
                </div>
              ))}
              {unassigned.length===0 && <span style={{fontSize:11,color:S.textTertiary}}>—</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// VIEW 3: Weekly Planner
// ════════════════════════════════════════
function WeeklyMockup() {
  const [backlogProject, setBacklogProject] = useState("전체");
  const [backlogTab, setBacklogTab] = useState("할일");
  const [catFilter, setCatFilter] = useState("전체");
  const days = ["월 3/17","화 3/18","수 3/19","목 3/20","금 3/21"];
  const dayDates = ["03/17","03/18","03/19","03/20","03/21"];

  const getTasksForDay = (memberId, dayDate) => {
    return TASKS.filter(t => t.assignee===memberId && t.dueDate===dayDate && !t.done);
  };

  const backlogTasks = TASKS.filter(t => {
    if (t.done) return false;
    if (dayDates.includes(t.dueDate)) return false;
    if (backlogProject !== "전체" && t.projectId !== backlogProject) return false;
    if (catFilter === "남은") return t.category === "backlog";
    if (catFilter === "다음") return t.category === "next";
    return true;
  });

  const backlogMs = backlogProject !== "전체"
    ? MS.filter(m => m.projectId === backlogProject)
    : [];

  return (
    <div style={{display:"flex",gap:0,height:"100%"}}>
      {/* Main grid */}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <Pill items={["할일","마일스톤"]} active="할일" onChange={()=>{}} />
          <Pill items={["전체","팀","개인"]} active="전체" onChange={()=>{}} />
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button style={{border:"none",background:S.bgSurface,borderRadius:4,padding:"4px 8px",cursor:"pointer",fontSize:12}}>◀</button>
            <span style={{fontSize:13,fontWeight:600,color:S.textPrimary}}>이번주</span>
            <button style={{border:"none",background:S.bgSurface,borderRadius:4,padding:"4px 8px",cursor:"pointer",fontSize:12}}>▶</button>
          </div>
          <span style={{fontSize:12,color:S.textTertiary}}>2026.03.17 ~ 03.21 (12주차)</span>
        </div>
        {/* Grid header */}
        <div style={{display:"grid",gridTemplateColumns:`90px repeat(5, 1fr)`,gap:1}}>
          <div style={{padding:8,fontSize:12,fontWeight:600,color:S.textSecondary}}>담당자</div>
          {days.map(d => (
            <div key={d} style={{padding:"8px 10px",fontSize:12,fontWeight:600,color:d.includes("3/19")?S.textPrimary:S.textSecondary,background:d.includes("3/19")?"#fef9ec":"#fafaf8",borderRadius:"6px 6px 0 0",textAlign:"center"}}>
              {d}
            </div>
          ))}
          {/* Member rows */}
          {MEMBERS.map(mem => [
            <div key={`wk-${mem.id}`} style={{display:"flex",alignItems:"flex-start",gap:6,padding:"10px 8px"}}>
              <Avatar member={mem} size={22} />
              <span style={{fontSize:12,fontWeight:500,color:S.textPrimary}}>{mem.name.split(" ")[0]}</span>
            </div>,
            ...dayDates.map((dd, di) => {
              const tasks = getTasksForDay(mem.id, dd);
              return (
                <div key={`${mem.id}-${di}`} style={{
                  background:dd==="03/19"?"#fffdf5":"#fff",
                  padding:6,minHeight:70,
                  borderBottom:`0.5px solid ${S.border}`,
                  borderRight:`0.5px solid ${S.border}`,
                }}>
                  {tasks.map(t => {
                    const proj = PROJECTS.find(p=>p.id===t.projectId);
                    return (
                      <div key={t.id} style={{
                        background:PC[proj.color].card,
                        borderRadius:6,padding:"5px 8px",marginBottom:4,fontSize:11,
                        cursor:"grab",
                      }}>
                        <div style={{fontWeight:500,color:S.textPrimary,lineHeight:1.3}}>{t.text}</div>
                        <div style={{color:S.textTertiary,marginTop:2}}>
                          <Dot color={PC[proj.color].dot} size={5} /> {proj.name}
                        </div>
                      </div>
                    );
                  })}
                  {tasks.length===0 && (
                    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:11,color:"#ddd"}}>—</span>
                    </div>
                  )}
                </div>
              );
            })
          ])}
        </div>
      </div>
      {/* Backlog sidebar */}
      <div style={{width:260,borderLeft:`0.5px solid ${S.border}`,background:S.bgSurface,padding:12,overflow:"auto",flexShrink:0}}>
        <div style={{fontSize:13,fontWeight:600,color:S.textPrimary,marginBottom:10}}>백로그</div>
        <select value={backlogProject} onChange={e=>setBacklogProject(e.target.value)} style={{
          width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${S.border}`,fontSize:12,
          fontFamily:S.font,marginBottom:8,background:"#fff",color:S.textPrimary,
        }}>
          <option value="전체">전체 프로젝트</option>
          {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{display:"flex",gap:4,marginBottom:10}}>
          <Pill items={["전체","남은","다음"]} active={catFilter} onChange={setCatFilter} />
        </div>
        <Pill items={["할일","마일스톤"]} active={backlogTab} onChange={setBacklogTab} />
        <div style={{marginTop:10}}>
          {backlogTab === "할일" ? (
            backlogProject === "전체" ? (
              // Flat list grouped by project
              PROJECTS.map(p => {
                const tasks = backlogTasks.filter(t=>t.projectId===p.id);
                if (!tasks.length) return null;
                return (
                  <div key={p.id} style={{marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>
                      <Dot color={PC[p.color].dot} size={6} />
                      <span style={{fontSize:12,fontWeight:600,color:S.textPrimary}}>{p.name}</span>
                    </div>
                    {tasks.map(t => (
                      <div key={t.id} style={{
                        display:"flex",alignItems:"center",gap:6,padding:"5px 8px",marginBottom:2,
                        background:"#fff",borderRadius:6,cursor:"grab",fontSize:11,
                        border:`0.5px solid ${S.border}`,
                      }}>
                        <span style={{flex:1,color:S.textPrimary}}>{t.text}</span>
                        <span style={{color:S.textTertiary,fontSize:10}}>{t.category}</span>
                      </div>
                    ))}
                  </div>
                );
              })
            ) : (
              // MS tree for selected project
              <>
                {MS.filter(m=>m.projectId===backlogProject).map(ms => {
                  const msTasks = backlogTasks.filter(t=>t.msId===ms.id);
                  return (
                    <div key={ms.id} style={{marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>
                        <Dot color={ms.color} size={6} />
                        <span style={{fontSize:12,fontWeight:600,color:S.textPrimary}}>{ms.name}</span>
                        <ProgressBar done={ms.progress} total={ms.total} color={ms.color} width={40} />
                      </div>
                      {msTasks.map(t => (
                        <div key={t.id} style={{
                          display:"flex",alignItems:"center",gap:6,padding:"5px 8px 5px 16px",marginBottom:2,
                          background:"#fff",borderRadius:6,cursor:"grab",fontSize:11,
                          border:`0.5px solid ${S.border}`,
                        }}>
                          <span style={{flex:1,color:S.textPrimary}}>{t.text}</span>
                          <span style={{color:S.textTertiary,fontSize:10}}>{t.category}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {(() => {
                  const unlinked = backlogTasks.filter(t=>!t.msId);
                  if (!unlinked.length) return null;
                  return (
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:11,color:S.textTertiary,padding:"4px 0",fontStyle:"italic"}}>미연결 ({unlinked.length})</div>
                      {unlinked.map(t => (
                        <div key={t.id} style={{
                          display:"flex",alignItems:"center",gap:6,padding:"5px 8px",marginBottom:2,
                          background:"#fff",borderRadius:6,cursor:"grab",fontSize:11,
                          border:`0.5px solid ${S.border}`,
                        }}>
                          <span style={{flex:1,color:S.textPrimary}}>{t.text}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )
          ) : (
            // 마일스톤 탭
            (backlogProject === "전체" ? MS : MS.filter(m=>m.projectId===backlogProject)).map(ms => {
              const proj = PROJECTS.find(p=>p.id===ms.projectId);
              return (
                <div key={ms.id} style={{
                  background:"#fff",borderRadius:8,padding:"8px 10px",marginBottom:6,
                  border:`0.5px solid ${S.border}`,cursor:"pointer",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <Dot color={ms.color} size={6} />
                    <span style={{fontSize:12,fontWeight:600,color:S.textPrimary}}>{ms.name}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                    <ProgressBar done={ms.progress} total={ms.total} color={ms.color} width={40} />
                    <span style={{fontSize:10,color:S.textTertiary}}>{proj.name}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div style={{marginTop:12,padding:8,border:`1.5px dashed ${S.border}`,borderRadius:8,textAlign:"center",fontSize:11,color:S.textTertiary}}>
          ← 요일 셀로 드래그
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// Main App — Tab switching
// ════════════════════════════════════════
export default function Loop36Mockup() {
  const [view, setView] = useState("전체 할일");
  const views = ["전체 할일","매트릭스","주간 플래너"];

  return (
    <div style={{fontFamily:S.font,color:S.textPrimary,maxWidth:1200,margin:"0 auto",padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,paddingTop:8}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:700}}>Loop-36 목업</h2>
        <div style={{display:"flex",gap:4}}>
          {views.map(v => (
            <button key={v} onClick={()=>setView(v)} style={{
              border:"none",borderRadius:8,padding:"7px 18px",fontSize:13,fontFamily:S.font,cursor:"pointer",
              fontWeight:view===v?600:400,
              background:view===v?"#1e293b":"#f5f4f0",
              color:view===v?"#fff":"#6b6a66",
            }}>{v}</button>
          ))}
        </div>
      </div>
      {view==="전체 할일" && <AllTasksMockup />}
      {view==="매트릭스" && <MatrixMockup />}
      {view==="주간 플래너" && <WeeklyMockup />}
    </div>
  );
}
