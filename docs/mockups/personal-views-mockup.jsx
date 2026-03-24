import { useState } from "react";

const S = {
  font: "'Noto Sans KR','Inter',-apple-system,sans-serif",
  textPrimary: "#37352f",
  textSecondary: "#6b6a66",
  textTertiary: "#a09f99",
  border: "#e8e6df",
};

const Dot=({color,size=7})=><div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0}}/>;
const Pill=({items,active,onChange})=>(
  <div style={{display:"flex",gap:1,background:"#f5f4f0",borderRadius:7,padding:2}}>
    {items.map(it=>(
      <button key={it} onClick={()=>onChange(it)} style={{
        border:"none",borderRadius:5,padding:"4px 14px",fontSize:11.5,fontFamily:S.font,cursor:"pointer",
        fontWeight:active===it?600:400,background:active===it?"#fff":"transparent",
        color:active===it?S.textPrimary:S.textTertiary,
        boxShadow:active===it?"0 1px 2px rgba(0,0,0,0.06)":"none",
      }}>{it}</button>
    ))}
  </div>
);
const Check=({done=false})=>(
  <div style={{width:14,height:14,borderRadius:3,flexShrink:0,cursor:"pointer",
    border:done?"none":"1.5px solid #ccc",background:done?"#2383e2":"#fff",
    display:"flex",alignItems:"center",justifyContent:"center"}}>
    {done&&<svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </div>
);

const PROJECTS = [
  { id:"p1", name:"정기주총", color:"#e05252" },
  { id:"p2", name:"ABI 코리아", color:"#3b82f6" },
  { id:"p3", name:"일본법인/해외SCM", color:"#8b5cf6" },
  { id:"p4", name:"BIS", color:"#f97316" },
  { id:"p5", name:"개별과제", color:"#22c55e" },
  { id:"p6", name:"C&", color:"#f59e0b" },
];

const CATEGORIES = ["오늘", "다음", "나중"];

// ─── Ryan의 할일 (모든 프로젝트에서 내가 담당하는 것만) ───
const MY_TASKS = [
  // 정기주총
  { id:"t1", proj:"p1", text:"등기 서류 <> 공증인 확인 체크", ms:"공증+위임장+의사록", cat:"오늘", done:false, due:"03/24", start:"2026-03-20", end:"2026-03-24" },
  { id:"t2", proj:"p1", text:"위임장 뿌리기 + 웹사이트 게재", ms:"공증+위임장+의사록", cat:"오늘", done:false, due:"03/24", start:"2026-03-20", end:"2026-03-24" },
  { id:"t3", proj:"p1", text:"안건 PPT - 재무제표 분석", ms:"안건자료 PPT", cat:"다음", done:false, due:"03/26", start:"2026-03-24", end:"2026-03-26" },
  { id:"t4", proj:"p1", text:"투표 엑셀 준비", ms:"운영 매뉴얼", cat:"다음", done:false, due:"03/28", start:"2026-03-25", end:"2026-03-28" },
  { id:"t5", proj:"p1", text:"현장 배치도 작성", ms:"운영 매뉴얼", cat:"나중", done:false, due:"04/01", start:"2026-03-28", end:"2026-04-01" },

  // ABI 코리아
  { id:"t6", proj:"p2", text:"대행사 Search 및 계약", ms:"법인설립 > 지점설립", cat:"오늘", done:false, due:"03/24", start:"2026-03-20", end:"2026-03-24" },
  { id:"t7", proj:"p2", text:"공증 및 아포스티유 필요", ms:"법인설립 > 지점설립", cat:"다음", done:false, due:"04/06", start:"2026-03-24", end:"2026-04-06" },
  { id:"t8", proj:"p2", text:"대행사 확인 필 (국내지사)", ms:"법인설립 > 국내지사", cat:"다음", done:false, due:"04/13", start:"2026-04-06", end:"2026-04-13" },

  // 일본법인
  { id:"t9", proj:"p3", text:"PO 프로세스 Flow 정리", ms:"PO/물류 Flow", cat:"다음", done:false, due:"03/30", start:"2026-03-24", end:"2026-03-30" },

  // BIS
  { id:"t10", proj:"p4", text:"Sales 자료 취합 요청", ms:"Sales 자료 취합", cat:"오늘", done:false, due:"03/24", start:"2026-03-22", end:"2026-03-24" },
  { id:"t11", proj:"p4", text:"제출 서류 리스트 확인", ms:"제출 서류", cat:"나중", done:false, due:"04/10", start:"2026-04-01", end:"2026-04-10" },

  // 개별과제 (개인)
  { id:"t12", proj:"p5", text:"마일스톤 테스트", ms:"마일스톤 테스트", cat:"나중", done:false, due:"04/05", start:"2026-03-28", end:"2026-04-05" },
];

// ─── Ryan의 MS (owner_id = ryan) ───
const MY_MS = [
  { id:"m1", proj:"p1", title:"공증+위임장+의사록", d:0, start:"2026-03-10", end:"2026-03-28", tasks:2 },
  { id:"m2", proj:"p1", title:"안건자료 PPT", d:0, start:"2026-03-14", end:"2026-03-26", tasks:1 },
  { id:"m3", proj:"p1", title:"운영 매뉴얼", d:0, start:"2026-03-17", end:"2026-04-01", tasks:2 },
  { id:"m4", proj:"p2", title:"지점설립", d:1, path:"법인설립 > 지점설립", start:"2026-03-20", end:"2026-04-13", tasks:2 },
  { id:"m5", proj:"p2", title:"국내지사", d:1, path:"법인설립 > 국내지사", start:"2026-04-06", end:"2026-05-04", tasks:1 },
  { id:"m6", proj:"p3", title:"PO/물류 Flow", d:0, start:"2026-03-24", end:"2026-03-30", tasks:1 },
  { id:"m7", proj:"p4", title:"Sales 자료 취합", d:0, start:"2026-03-22", end:"2026-03-28", tasks:1 },
  { id:"m8", proj:"p4", title:"제출 서류", d:0, start:"2026-04-01", end:"2026-04-10", tasks:1 },
  { id:"m9", proj:"p5", title:"마일스톤 테스트", d:0, start:"2026-03-28", end:"2026-04-05", tasks:1 },
];

// ─── 할일 카드 (compact) ───
function TaskRow({ task, showProject=true }) {
  const proj = PROJECTS.find(p=>p.id===task.proj);
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:7,padding:"5px 8px",marginBottom:1,
      borderRadius:5,cursor:"grab",transition:"background 0.1s",
    }}
      onMouseEnter={e=>e.currentTarget.style.background="#f5f4f0"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
    >
      <Check done={task.done} />
      <span style={{flex:1,fontSize:12,color:S.textPrimary,lineHeight:1.3,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.text}</span>
      {task.ms && <span style={{fontSize:9.5,color:S.textTertiary,flexShrink:0,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.ms}</span>}
      {showProject && <Dot color={proj?.color} size={6} />}
      {task.due && <span style={{fontSize:9.5,color:S.textTertiary,flexShrink:0}}>{task.due}</span>}
    </div>
  );
}

// ═══════════════════════════════════════
// 개인 매트릭스 — 프로젝트 × 카테고리
// ═══════════════════════════════════════
function PersonalMatrix() {
  const projsWithTasks = PROJECTS.filter(p => MY_TASKS.some(t=>t.proj===p.id));

  return (
    <div>
      <div style={{fontSize:11,color:S.textTertiary,marginBottom:12}}>
        내가 담당하는 모든 할일 — 프로젝트 × 카테고리(오늘/다음/나중) 그리드
      </div>

      {/* 그리드 헤더 */}
      <div style={{display:"grid",gridTemplateColumns:"140px repeat(3, 1fr)",gap:0,border:`0.5px solid ${S.border}`,borderRadius:10,overflow:"hidden"}}>
        {/* 헤더 행 */}
        <div style={{padding:"8px 10px",background:"#fafaf8",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,fontSize:11,fontWeight:600,color:S.textTertiary}}>
          프로젝트
        </div>
        {CATEGORIES.map(cat => (
          <div key={cat} style={{
            padding:"8px 10px",background:"#fafaf8",borderBottom:`0.5px solid ${S.border}`,
            borderRight:`0.5px solid ${S.border}`,
            fontSize:11,fontWeight:600,color: cat==="오늘"?"#ef4444":cat==="다음"?S.textPrimary:S.textTertiary,
          }}>
            {cat}
            <span style={{fontSize:10,color:S.textTertiary,marginLeft:6}}>
              {MY_TASKS.filter(t=>t.cat===cat).length}
            </span>
          </div>
        ))}

        {/* 프로젝트 행 */}
        {projsWithTasks.map((proj,pi) => [
          <div key={`p-${proj.id}`} style={{
            padding:"8px 10px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,
            display:"flex",alignItems:"flex-start",gap:6,background:`${proj.color}04`,
          }}>
            <Dot color={proj.color} size={7} />
            <div>
              <div style={{fontSize:12,fontWeight:600,color:S.textPrimary}}>{proj.name}</div>
              <div style={{fontSize:10,color:S.textTertiary}}>{MY_TASKS.filter(t=>t.proj===proj.id).length}건</div>
            </div>
          </div>,
          ...CATEGORIES.map(cat => {
            const tasks = MY_TASKS.filter(t=>t.proj===proj.id && t.cat===cat);
            return (
              <div key={`${proj.id}-${cat}`} style={{
                padding:"4px 4px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,
                minHeight:50,
              }}>
                {tasks.length===0 ? (
                  <span style={{fontSize:10,color:"#e0e0e0",padding:"8px",display:"block"}}>—</span>
                ) : tasks.map(t => (
                  <TaskRow key={t.id} task={t} showProject={false} />
                ))}
                <div style={{padding:"2px 8px"}}>
                  <span style={{fontSize:10,color:S.textTertiary,cursor:"pointer"}}>+ 추가</span>
                </div>
              </div>
            );
          })
        ])}
      </div>

      {/* 요약 */}
      <div style={{marginTop:12,display:"flex",gap:16,fontSize:11,color:S.textTertiary}}>
        <span>전체: {MY_TASKS.length}건</span>
        <span style={{color:"#ef4444"}}>오늘: {MY_TASKS.filter(t=>t.cat==="오늘").length}건</span>
        <span>다음: {MY_TASKS.filter(t=>t.cat==="다음").length}건</span>
        <span>나중: {MY_TASKS.filter(t=>t.cat==="나중").length}건</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 개인 타임라인 — 내 MS/할일 간트
// ═══════════════════════════════════════
function PersonalTimeline() {
  const START = new Date("2026-03-09");
  const WEEKS = 10;
  const COL_W = 60;
  const ROW_H = 28;
  const toX=(ds)=>{if(!ds)return null;return((new Date(ds)-START)/(7*864e5))*COL_W};
  const weekDates = Array.from({length:WEEKS},(_,i)=>{const d=new Date(START);d.setDate(d.getDate()+i*7);return d});

  // MS를 프로젝트별로 그룹핑
  const byProject = {};
  MY_MS.forEach(ms => {
    if(!byProject[ms.proj]) byProject[ms.proj] = [];
    byProject[ms.proj].push(ms);
  });

  const rows = [];
  Object.entries(byProject).forEach(([projId, msList]) => {
    const proj = PROJECTS.find(p=>p.id===projId);
    rows.push({ type:"project-header", proj, id:`ph-${projId}` });
    msList.forEach(ms => {
      rows.push({ type:"ms", ms, proj, id:ms.id });
      // 해당 MS의 할일
      const tasks = MY_TASKS.filter(t=>t.proj===projId && t.ms===(ms.path||ms.title));
      tasks.forEach(t => rows.push({ type:"task", task:t, proj, ms, id:t.id }));
      // + 추가 행
      rows.push({ type:"add-task", proj, ms, id:`add-${ms.id}` });
    });
  });

  return (
    <div>
      <div style={{fontSize:11,color:S.textTertiary,marginBottom:12}}>
        내가 담당하는 MS와 할일의 간트 차트 — 팀+개인 프로젝트 전부
      </div>

      <div style={{border:`0.5px solid ${S.border}`,borderRadius:10,overflow:"hidden"}}>
        {/* 주 헤더 */}
        <div style={{display:"flex",borderBottom:`0.5px solid ${S.border}`}}>
          <div style={{width:220,flexShrink:0,padding:"6px 10px",fontSize:10,fontWeight:600,color:S.textTertiary,background:"#fafaf8"}}>
            내 마일스톤 / 할일
          </div>
          <div style={{display:"flex",flex:1,overflow:"hidden"}}>
            {weekDates.map((d,i)=>(
              <div key={i} style={{width:COL_W,flexShrink:0,padding:"6px 4px",fontSize:9.5,color:S.textTertiary,textAlign:"center",borderLeft:`0.5px solid #f0efeb`,background:"#fafaf8"}}>
                {`${d.getMonth()+1}/${d.getDate()}`}
              </div>
            ))}
          </div>
        </div>

        {/* 행 */}
        <div style={{overflowX:"auto"}}>
          {rows.map(row => {
            if (row.type === "project-header") {
              return (
                <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,background:`${row.proj.color}08`}}>
                  <div style={{width:220,flexShrink:0,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                    <Dot color={row.proj.color} size={7} />
                    <span style={{fontSize:12,fontWeight:700,color:S.textPrimary}}>{row.proj.name}</span>
                  </div>
                  <div style={{flex:1,minWidth:WEEKS*COL_W}} />
                </div>
              );
            }

            if (row.type === "ms") {
              const x1=toX(row.ms.start);const x2=toX(row.ms.end);
              const w=x1!==null&&x2!==null?Math.max(x2-x1,6):0;
              return (
                <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,minHeight:ROW_H}}>
                  <div style={{width:220,flexShrink:0,padding:"4px 10px 4px 24px",display:"flex",alignItems:"center",gap:5}}>
                    <Dot color={row.proj.color} size={5} />
                    <span style={{fontSize:11,fontWeight:600,color:S.textPrimary}}>{row.ms.path||row.ms.title}</span>
                    <span style={{fontSize:9,color:S.textTertiary}}>{row.ms.tasks}건</span>
                  </div>
                  <div style={{flex:1,position:"relative",minWidth:WEEKS*COL_W,height:ROW_H}}>
                    {weekDates.map((_,i)=><div key={i} style={{position:"absolute",left:i*COL_W,top:0,bottom:0,width:COL_W,borderLeft:`0.5px solid #f0efeb`}}/>)}
                    {w>0&&<div style={{position:"absolute",left:x1,top:6,width:w,height:14,borderRadius:4,background:`${row.proj.color}30`,border:`1px solid ${row.proj.color}45`,
                      fontSize:8.5,color:row.proj.color,paddingLeft:4,overflow:"hidden",whiteSpace:"nowrap",lineHeight:"14px"
                    }}>{(row.ms.path||row.ms.title).length>25?(row.ms.path||row.ms.title).slice(0,25)+"…":(row.ms.path||row.ms.title)}</div>}
                  </div>
                </div>
              );
            }

            // task
            if (row.type === "add-task") {
              return (
                <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,minHeight:24}}>
                  <div style={{width:220,flexShrink:0,padding:"3px 10px 3px 38px"}}>
                    <span style={{fontSize:10.5,color:S.textTertiary,cursor:"pointer"}}>+ 할일 추가</span>
                  </div>
                  <div style={{flex:1,minWidth:WEEKS*COL_W}} />
                </div>
              );
            }
            const x1=toX(row.task.start);const x2=toX(row.task.end);
            const w=x1!==null&&x2!==null?Math.max(x2-x1,6):0;
            return (
              <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,minHeight:ROW_H}}>
                <div style={{width:220,flexShrink:0,padding:"4px 10px 4px 38px",display:"flex",alignItems:"center",gap:5}}>
                  <Check done={row.task.done} />
                  <span style={{fontSize:10.5,color:S.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.task.text}</span>
                </div>
                <div style={{flex:1,position:"relative",minWidth:WEEKS*COL_W,height:ROW_H}}>
                  {weekDates.map((_,i)=><div key={i} style={{position:"absolute",left:i*COL_W,top:0,bottom:0,width:COL_W,borderLeft:`0.5px solid #f0efeb`}}/>)}
                  {w>0&&<div style={{position:"absolute",left:x1,top:6,width:w,height:14,borderRadius:4,background:`${row.proj.color}50`,
                    fontSize:8.5,color:"#fff",paddingLeft:4,overflow:"hidden",whiteSpace:"nowrap",lineHeight:"14px",cursor:"grab"
                  }}>{row.task.text.length>20?row.task.text.slice(0,20)+"…":row.task.text}</div>}
                  {(()=>{const tx=toX("2026-03-24");return tx?<div style={{position:"absolute",top:0,bottom:0,left:tx,width:1.5,background:"#ef4444",opacity:0.4,zIndex:1}}/>:null})()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 개인 주간 플래너 — 행=프로젝트, 열=요일
// ═══════════════════════════════════════
function PersonalWeekly() {
  const DAYS = ["월 3/23","화 3/24","수 3/25","목 3/26","금 3/27"];
  const DAY_KEYS = ["mon","tue","wed","thu","fri"];

  // 할일을 요일에 매핑 (due date 기준)
  const tasksByDay = {};
  MY_TASKS.forEach(t => {
    if(!t.due) return;
    const d = new Date(`2026-${t.due.replace("/","-")}`);
    const dow = d.getDay(); // 0=sun, 1=mon...
    if(dow>=1&&dow<=5) {
      const key = DAY_KEYS[dow-1];
      if(!tasksByDay[key]) tasksByDay[key] = [];
      tasksByDay[key].push(t);
    }
  });

  const projsWithTasks = PROJECTS.filter(p => MY_TASKS.some(t=>t.proj===p.id));

  return (
    <div>
      <div style={{fontSize:11,color:S.textTertiary,marginBottom:12}}>
        내 이번 주 스케줄 — 행=프로젝트, 열=요일. 드래그로 일정 조정.
      </div>

      <div style={{display:"grid",gridTemplateColumns:"130px repeat(5, 1fr)",gap:0,border:`0.5px solid ${S.border}`,borderRadius:10,overflow:"hidden"}}>
        {/* 헤더 */}
        <div style={{padding:"8px 10px",background:"#fafaf8",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,fontSize:10,fontWeight:600,color:S.textTertiary}}>
          프로젝트
        </div>
        {DAYS.map((day,i) => (
          <div key={day} style={{
            padding:"8px 8px",background: i===1?"#fef9ec":"#fafaf8",
            borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,
            fontSize:11,fontWeight: i===1?700:500,
            color: i===1?"#d97706":S.textTertiary,
          }}>
            {day}
            {i===1 && <span style={{fontSize:9,marginLeft:4}}>오늘</span>}
          </div>
        ))}

        {/* 프로젝트별 행 */}
        {projsWithTasks.map(proj => [
          <div key={`p-${proj.id}`} style={{
            padding:"8px 10px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,
            display:"flex",alignItems:"flex-start",gap:5,background:`${proj.color}04`,
          }}>
            <Dot color={proj.color} size={7} />
            <span style={{fontSize:11.5,fontWeight:600,color:S.textPrimary}}>{proj.name}</span>
          </div>,
          ...DAY_KEYS.map((dayKey,di) => {
            const dayTasks = MY_TASKS.filter(t => {
              if(t.proj!==proj.id || !t.due) return false;
              const d = new Date(`2026-${t.due.replace("/","-")}`);
              return d.getDay() === di+1; // mon=1
            });
            return (
              <div key={`${proj.id}-${dayKey}`} style={{
                padding:"4px 4px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,
                minHeight:50, background: di===1?"#fffbeb":"transparent",
              }}>
                {dayTasks.map(t => (
                  <div key={t.id} style={{
                    display:"flex",alignItems:"center",gap:5,padding:"4px 6px",marginBottom:2,
                    background:"#fff",borderRadius:5,border:`0.5px solid ${S.border}`,
                    cursor:"grab",fontSize:10.5,color:S.textPrimary,
                  }}>
                    <Check done={t.done} />
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
                  </div>
                ))}
                {dayTasks.length===0 && (
                  <div style={{padding:"8px 4px",fontSize:10,color:"#e0e0e0",textAlign:"center"}}>—</div>
                )}
                <div style={{padding:"2px 6px"}}>
                  <span style={{fontSize:10,color:S.textTertiary,cursor:"pointer"}}>+ 추가</span>
                </div>
              </div>
            );
          })
        ])}
      </div>

      {/* 이번 주 요약 */}
      <div style={{marginTop:12,display:"flex",gap:16,fontSize:11,color:S.textTertiary}}>
        {DAY_KEYS.map((k,i) => {
          const count = Object.values(tasksByDay).flat().filter(t => {
            const d = new Date(`2026-${t.due.replace("/","-")}`);
            return d.getDay() === i+1;
          }).length;
          return <span key={k}>{DAYS[i].split(" ")[0]}: {count}건</span>;
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════
export default function PersonalViewMockup() {
  const [view, setView] = useState("매트릭스");

  return (
    <div style={{fontFamily:S.font,color:S.textPrimary,maxWidth:1200,margin:"0 auto",padding:"0 24px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:10,marginBottom:4}}>
        <h2 style={{margin:0,fontSize:17,fontWeight:700}}>개인 뷰</h2>
        <span style={{fontSize:12,color:S.textTertiary}}>scope = personal — 내가 담당하는 모든 항목</span>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <Pill items={["매트릭스","타임라인","주간 플래너"]} active={view} onChange={setView} />
      </div>

      {/* scope 설명 */}
      <div style={{padding:"8px 12px",background:"#f0fdf4",borderRadius:7,fontSize:11,color:"#166534",marginBottom:16,lineHeight:1.6}}>
        <strong>데이터 범위:</strong> 팀 프로젝트(정기주총, ABI, 일본법인, BIS) + 개인 프로젝트(개별과제, C&)에서 <strong>내가 owner 또는 assignee인 할일/MS만</strong> 표시.
        다른 팀원의 할일은 보이지 않음.
      </div>

      {view === "매트릭스" && <PersonalMatrix />}
      {view === "타임라인" && <PersonalTimeline />}
      {view === "주간 플래너" && <PersonalWeekly />}

      {/* 팀 뷰와의 차이 */}
      <div style={{marginTop:24,padding:14,background:"#fafaf8",borderRadius:8,fontSize:11.5,color:S.textSecondary,lineHeight:1.7}}>
        <strong>팀 뷰와의 차이:</strong><br/>
        • <strong>팀 매트릭스</strong>: 행=팀원 전체, 열=프로젝트 → "누가 뭘 맡고 있지?"<br/>
        • <strong>개인 매트릭스</strong>: 행=프로젝트, 열=카테고리(오늘/다음/나중) → "내가 뭘 해야 하지?"<br/><br/>
        • <strong>팀 타임라인</strong>: 모든 팀원의 MS/할일 간트<br/>
        • <strong>개인 타임라인</strong>: 내 담당분만 간트 → "내 일정이 어떻게 되지?"<br/><br/>
        • <strong>팀 주간 플래너</strong>: 행=팀원 전체, 열=요일 → "이번 주 팀 배분"<br/>
        • <strong>개인 주간 플래너</strong>: 행=프로젝트, 열=요일 → "내 이번 주 스케줄"
      </div>
    </div>
  );
}
