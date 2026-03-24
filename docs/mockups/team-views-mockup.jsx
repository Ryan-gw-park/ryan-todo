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
const Avatar=({m,size=20})=>(
  <div style={{width:size,height:size,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.42,fontWeight:600,flexShrink:0}}>{m.initial}</div>
);

const MEMBERS = [
  { id:"ryan", name:"Ryan", initial:"R", color:"#1D9E75" },
  { id:"edmond", name:"Edmond", initial:"E", color:"#6366f1" },
  { id:"eric", name:"eric.kim", initial:"E", color:"#ef4444" },
  { id:"ash", name:"ash.kim", initial:"A", color:"#f59e0b" },
];

const PROJECTS = [
  { id:"p1", name:"정기주총", color:"#e05252" },
  { id:"p2", name:"ABI 코리아", color:"#3b82f6" },
  { id:"p3", name:"일본법인/해외SCM", color:"#8b5cf6" },
  { id:"p4", name:"BIS", color:"#f97316" },
];

const CATEGORIES = ["오늘","다음","나중","완료"];

// ─── 팀 전체 할일 ───
const TEAM_TASKS = [
  // Ryan
  { id:"t1", proj:"p1", text:"등기 서류 확인 체크", ms:"공증+위임장", cat:"오늘", owner:"ryan", done:false, due:"03/24", start:"2026-03-20", end:"2026-03-24" },
  { id:"t2", proj:"p1", text:"위임장 뿌리기 + 웹사이트", ms:"공증+위임장", cat:"오늘", owner:"ryan", done:false, due:"03/24", start:"2026-03-20", end:"2026-03-24" },
  { id:"t3", proj:"p1", text:"안건 PPT - 재무제표 분석", ms:"안건자료 PPT", cat:"다음", owner:"ryan", done:false, due:"03/26", start:"2026-03-24", end:"2026-03-26" },
  { id:"t4", proj:"p1", text:"투표 엑셀 준비", ms:"운영 매뉴얼", cat:"나중", owner:"ryan", done:false, due:"03/28", start:"2026-03-25", end:"2026-03-28" },
  { id:"t5", proj:"p2", text:"대행사 Search 및 계약", ms:"법인설립>지점설립", cat:"오늘", owner:"ryan", done:false, due:"03/24", start:"2026-03-20", end:"2026-03-24" },
  { id:"t6", proj:"p2", text:"공증 및 아포스티유", ms:"법인설립>지점설립", cat:"다음", owner:"ryan", done:false, due:"04/06", start:"2026-03-24", end:"2026-04-06" },
  { id:"t7", proj:"p4", text:"Sales 자료 취합 요청", ms:"Sales 자료", cat:"오늘", owner:"ryan", done:false, due:"03/24", start:"2026-03-22", end:"2026-03-24" },
  // Edmond
  { id:"t8", proj:"p1", text:"의사록 작성", ms:"의사록+첨부서류", cat:"다음", owner:"edmond", done:false, due:"03/28", start:"2026-03-24", end:"2026-03-28" },
  { id:"t9", proj:"p2", text:"TP 필요여부 확인", ms:"회계/세무>운영비송금", cat:"다음", owner:"edmond", done:false, due:"04/20", start:"2026-04-13", end:"2026-04-20" },
  // eric
  { id:"t10", proj:"p2", text:"대행사 확인 필 (사업자등록)", ms:"법인설립>사업자등록", cat:"다음", owner:"eric", done:false, due:"05/04", start:"2026-04-27", end:"2026-05-04" },
  { id:"t11", proj:"p2", text:"업종코드 확정", ms:"법인설립>사업자등록", cat:"나중", owner:"eric", done:false, due:"05/04", start:"2026-05-04", end:"2026-05-11" },
  // ash
  { id:"t12", proj:"p1", text:"Sifive 위임투표 양식 (BKL)", ms:"공증+위임장", cat:"오늘", owner:"ash", done:true, due:"03/17", start:"2026-03-10", end:"2026-03-17" },
];

// ─── 팀 MS ───
const TEAM_MS = [
  { id:"m1", proj:"p1", title:"공증+위임장+의사록", d:0, owner:"ryan", t:4, start:"2026-03-10", end:"2026-03-28" },
  { id:"m2", proj:"p1", title:"안건자료 PPT", d:0, owner:"ryan", t:2, start:"2026-03-14", end:"2026-03-26" },
  { id:"m3", proj:"p1", title:"의사록+첨부서류", d:0, owner:"edmond", t:1, start:"2026-03-20", end:"2026-04-01" },
  { id:"m4", proj:"p1", title:"운영 매뉴얼", d:0, owner:"ryan", t:1, start:"2026-03-17", end:"2026-03-28" },
  { id:"m5", proj:"p1", title:"현장 투표 Dashboard", d:0, owner:null, t:0, start:"2026-03-24", end:"2026-03-28" },
  { id:"m6", proj:"p2", title:"지점설립", d:1, path:"법인설립 > 지점설립", owner:"ryan", t:3, start:"2026-03-20", end:"2026-04-27" },
  { id:"m7", proj:"p2", title:"국내지사 설치", d:1, path:"법인설립 > 국내지사", owner:"ryan", t:2, start:"2026-04-06", end:"2026-05-04" },
  { id:"m8", proj:"p2", title:"사업자등록", d:1, path:"법인설립 > 사업자등록", owner:"eric", t:5, start:"2026-04-27", end:"2026-05-31" },
  { id:"m9", proj:"p2", title:"운영비 송금", d:1, path:"회계/세무 > 운영비 송금", owner:"edmond", t:1, start:"2026-04-13", end:"2026-05-11" },
  { id:"m10", proj:"p2", title:"기장업체 선정", d:1, path:"회계/세무 > 기장업체", owner:"edmond", t:0, start:"2026-05-04", end:"2026-05-25" },
  { id:"m11", proj:"p3", title:"PO/물류 Flow", d:0, owner:"ryan", t:2, start:"2026-03-24", end:"2026-03-30" },
  { id:"m12", proj:"p4", title:"Sales 자료 취합", d:0, owner:"ryan", t:1, start:"2026-03-22", end:"2026-03-28" },
  { id:"m13", proj:"p4", title:"제출 서류", d:0, owner:"ryan", t:1, start:"2026-04-01", end:"2026-04-10" },
];

// ═══════════════════════════════════════
// 팀 매트릭스 — 할일 서브뷰
// 행=카테고리(오늘/다음/나중) × 팀원, 열=프로젝트
// ═══════════════════════════════════════
function TeamMatrixTask() {
  return (
    <div>
      <div style={{fontSize:11,color:S.textTertiary,marginBottom:10}}>
        팀원 × 프로젝트 그리드 — DnD로 카테고리/담당자 변경, 인라인 추가
      </div>

      <div style={{display:"grid",gridTemplateColumns:`100px repeat(${PROJECTS.length}, 1fr)`,gap:0,border:`0.5px solid ${S.border}`,borderRadius:10,overflow:"hidden"}}>
        {/* 헤더 */}
        <div style={{padding:"8px 8px",background:"#fafaf8",borderBottom:`1px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,fontSize:10,fontWeight:600,color:S.textTertiary}} />
        {PROJECTS.map(p=>(
          <div key={p.id} style={{background:`${p.color}10`,padding:"8px 8px",borderBottom:`1px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,display:"flex",alignItems:"center",gap:5}}>
            <Dot color={p.color} size={7} />
            <span style={{fontSize:11.5,fontWeight:600,color:S.textPrimary}}>{p.name}</span>
          </div>
        ))}

        {/* 팀원 × 프로젝트 셀 */}
        {MEMBERS.map(mem => [
          <div key={`m-${mem.id}`} style={{padding:"6px 6px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,display:"flex",alignItems:"flex-start",gap:5}}>
            <Avatar m={mem} size={20} />
            <div>
              <div style={{fontSize:11,fontWeight:600,color:S.textPrimary}}>{mem.name}</div>
              <div style={{fontSize:9,color:S.textTertiary}}>{TEAM_TASKS.filter(t=>t.owner===mem.id).length}건</div>
            </div>
          </div>,
          ...PROJECTS.map(p => {
            const tasks = TEAM_TASKS.filter(t=>t.proj===p.id && t.owner===mem.id);
            return (
              <div key={`${mem.id}-${p.id}`} style={{padding:"4px 4px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,minHeight:48,background:`${p.color}03`}}>
                {tasks.length===0 ? (
                  <span style={{fontSize:10,color:"#e0e0e0",padding:"4px 6px",display:"block"}}>—</span>
                ) : tasks.map(t => (
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 6px",marginBottom:1,borderRadius:4,cursor:"grab",transition:"background 0.1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f5f4f0"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  >
                    <Check done={t.done} />
                    <span style={{flex:1,fontSize:11,color:t.done?S.textTertiary:S.textPrimary,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
                    <span style={{fontSize:9,color:S.textTertiary,flexShrink:0}}>{t.cat}</span>
                  </div>
                ))}
                <div style={{padding:"2px 6px"}}>
                  <span style={{fontSize:10,color:S.textTertiary,cursor:"pointer"}}>+ 추가</span>
                </div>
              </div>
            );
          })
        ])}

        {/* 미배정 행 */}
        {(() => {
          const unassigned = TEAM_TASKS.filter(t=>!t.owner);
          return [
            <div key="un-label" style={{padding:"6px 6px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:11,color:S.textTertiary,fontStyle:"italic"}}>미배정</span>
            </div>,
            ...PROJECTS.map(p => {
              const tasks = unassigned.filter(t=>t.proj===p.id);
              return (
                <div key={`un-${p.id}`} style={{padding:"4px 4px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,background:`${p.color}02`}}>
                  {tasks.length===0 ? <span style={{fontSize:10,color:"#e0e0e0",padding:"4px 6px",display:"block"}}>—</span>
                    : tasks.map(t => (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 6px",fontSize:11,color:S.textPrimary}}>
                        <Check done={t.done} />
                        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
                      </div>
                    ))}
                </div>
              );
            })
          ];
        })()}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 팀 매트릭스 — MS 서브뷰 (CompactMsRow)
// ═══════════════════════════════════════
function TeamMatrixMs({ depthFilter }) {
  const getMs = (projId) => {
    const ms = TEAM_MS.filter(m=>m.proj===projId);
    if (depthFilter==="전체") return ms;
    const d = depthFilter==="대분류"?0:depthFilter==="중분류"?1:2;
    return ms.filter(m=>m.d===d);
  };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:`100px repeat(${PROJECTS.length}, 1fr)`,gap:0,border:`0.5px solid ${S.border}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"8px 8px",background:"#fafaf8",borderBottom:`1px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`}} />
        {PROJECTS.map(p=>(
          <div key={p.id} style={{background:`${p.color}10`,padding:"8px 8px",borderBottom:`1px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,display:"flex",alignItems:"center",gap:5}}>
            <Dot color={p.color} size={7} />
            <span style={{fontSize:11.5,fontWeight:600,color:S.textPrimary}}>{p.name}</span>
            <span style={{fontSize:9,color:S.textTertiary,marginLeft:"auto"}}>{getMs(p.id).length}</span>
          </div>
        ))}

        {MEMBERS.map(mem => [
          <div key={`m-${mem.id}`} style={{padding:"6px 6px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,display:"flex",alignItems:"flex-start",gap:5}}>
            <Avatar m={mem} size={20} />
            <span style={{fontSize:10.5,fontWeight:600,color:S.textPrimary,lineHeight:1.6}}>{mem.name}</span>
          </div>,
          ...PROJECTS.map(p => {
            const ms = getMs(p.id).filter(m=>m.owner===mem.id);
            return (
              <div key={`${mem.id}-${p.id}`} style={{padding:"4px 4px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,background:`${p.color}03`}}>
                {ms.length===0 ? <span style={{fontSize:10,color:"#e0e0e0",padding:"4px 6px",display:"block"}}>—</span>
                  : ms.map(m => (
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 6px",marginBottom:1,borderRadius:4}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f5f4f0"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    >
                      <Dot color={p.color} size={5} />
                      {m.path && <span style={{fontSize:9.5,color:S.textTertiary}}>{m.path.split(" > ").slice(0,-1).join(" > ")} ›</span>}
                      <span style={{fontSize:11,fontWeight:500,color:S.textPrimary,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</span>
                      <span style={{fontSize:9,color:S.textTertiary}}>{m.t}건</span>
                    </div>
                  ))}
              </div>
            );
          })
        ])}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// 팀 매트릭스 — 담당자별 서브뷰
// ═══════════════════════════════════════
function TeamMatrixMember({ depthFilter }) {
  return (
    <div>
      {MEMBERS.map(mem => {
        const myTasks = TEAM_TASKS.filter(t=>t.owner===mem.id);
        const myMs = TEAM_MS.filter(m=>m.owner===mem.id);
        const byProj = {};
        myTasks.forEach(t => { if(!byProj[t.proj]) byProj[t.proj]={tasks:[],ms:[]}; byProj[t.proj].tasks.push(t); });
        myMs.forEach(m => { if(!byProj[m.proj]) byProj[m.proj]={tasks:[],ms:[]}; byProj[m.proj].ms.push(m); });

        return (
          <div key={mem.id} style={{marginBottom:8,background:"#fff",borderRadius:8,border:`0.5px solid ${S.border}`,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#fafaf8",borderBottom:`0.5px solid ${S.border}`}}>
              <Avatar m={mem} size={22} />
              <span style={{fontSize:12.5,fontWeight:700,color:S.textPrimary}}>{mem.name}</span>
              <span style={{fontSize:10.5,color:S.textTertiary}}>{myTasks.length} 할일 · {myMs.length} MS</span>
              {myTasks.length > 8 && <span style={{fontSize:9.5,color:"#ef4444",fontWeight:600}}>⚠ 과부하</span>}
            </div>
            <div style={{padding:"8px 12px",display:"flex",flexWrap:"wrap",gap:10}}>
              {Object.keys(byProj).length===0 ? (
                <span style={{fontSize:10.5,color:S.textTertiary,fontStyle:"italic"}}>배정된 업무 없음</span>
              ) : Object.entries(byProj).map(([projId, data]) => {
                const proj = PROJECTS.find(p=>p.id===projId);
                return (
                  <div key={projId} style={{minWidth:200,flex:"1 1 220px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                      <Dot color={proj.color} size={6} />
                      <span style={{fontSize:11,fontWeight:600,color:proj.color}}>{proj.name}</span>
                      <span style={{fontSize:9,color:S.textTertiary}}>{data.tasks.length}건 · {data.ms.length}MS</span>
                    </div>
                    {data.tasks.map(t => (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,padding:"3px 6px",fontSize:11,color:S.textPrimary}}>
                        <Check done={t.done} />
                        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.done?"line-through":"none",color:t.done?S.textTertiary:S.textPrimary}}>{t.text}</span>
                        <span style={{fontSize:9,color:S.textTertiary}}>{t.cat}</span>
                      </div>
                    ))}
                    <div style={{padding:"2px 6px"}}><span style={{fontSize:10,color:S.textTertiary,cursor:"pointer"}}>+ 추가</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// 팀 타임라인
// ═══════════════════════════════════════
function TeamTimeline() {
  const START = new Date("2026-03-09");
  const WEEKS = 14;
  const COL_W = 50;
  const ROW_H = 28;
  const toX=(ds)=>{if(!ds)return null;return((new Date(ds)-START)/(7*864e5))*COL_W};
  const weekDates = Array.from({length:WEEKS},(_,i)=>{const d=new Date(START);d.setDate(d.getDate()+i*7);return d});

  // 프로젝트별 → MS → 할일 순서
  const rows = [];
  PROJECTS.forEach(proj => {
    const projMs = TEAM_MS.filter(m=>m.proj===proj.id);
    if(!projMs.length) return;
    rows.push({ type:"project", proj, id:`ph-${proj.id}` });
    projMs.forEach(ms => {
      rows.push({ type:"ms", ms, proj, id:ms.id });
      const tasks = TEAM_TASKS.filter(t=>t.proj===proj.id && (t.ms||"").includes(ms.title.split(">").pop().trim()));
      tasks.forEach(t => rows.push({ type:"task", task:t, proj, ms, id:t.id }));
      rows.push({ type:"add", proj, ms, id:`add-${ms.id}` });
    });
  });

  return (
    <div>
      <div style={{fontSize:11,color:S.textTertiary,marginBottom:10}}>
        팀 프로젝트 전체의 MS/할일 간트 — 모든 팀원 포함
      </div>

      <div style={{border:`0.5px solid ${S.border}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:`0.5px solid ${S.border}`}}>
          <div style={{width:240,flexShrink:0,padding:"6px 10px",fontSize:10,fontWeight:600,color:S.textTertiary,background:"#fafaf8"}}>프로젝트 / MS / 할일</div>
          <div style={{display:"flex",flex:1,overflow:"hidden"}}>
            {weekDates.map((d,i)=>(
              <div key={i} style={{width:COL_W,flexShrink:0,padding:"6px 2px",fontSize:9,color:S.textTertiary,textAlign:"center",borderLeft:`0.5px solid #f0efeb`,background:"#fafaf8"}}>
                {`${d.getMonth()+1}/${d.getDate()}`}
              </div>
            ))}
          </div>
        </div>

        <div style={{overflowX:"auto"}}>
          {rows.map(row => {
            if (row.type==="project") return (
              <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,background:`${row.proj.color}08`}}>
                <div style={{width:240,flexShrink:0,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                  <Dot color={row.proj.color} size={7} />
                  <span style={{fontSize:12,fontWeight:700,color:S.textPrimary}}>{row.proj.name}</span>
                </div>
                <div style={{flex:1,minWidth:WEEKS*COL_W}} />
              </div>
            );

            if (row.type==="add") return (
              <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,minHeight:22}}>
                <div style={{width:240,flexShrink:0,padding:"2px 10px 2px 44px"}}>
                  <span style={{fontSize:10,color:S.textTertiary,cursor:"pointer"}}>+ 할일 추가</span>
                </div>
                <div style={{flex:1,minWidth:WEEKS*COL_W}} />
              </div>
            );

            if (row.type==="ms") {
              const x1=toX(row.ms.start);const x2=toX(row.ms.end);
              const w=x1!==null&&x2!==null?Math.max(x2-x1,6):0;
              const owner = row.ms.owner ? MEMBERS.find(m=>m.id===row.ms.owner) : null;
              return (
                <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,minHeight:ROW_H}}>
                  <div style={{width:240,flexShrink:0,padding:"4px 10px 4px 24px",display:"flex",alignItems:"center",gap:5}}>
                    <Dot color={row.proj.color} size={5} />
                    <span style={{fontSize:11,fontWeight:600,color:S.textPrimary,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.ms.path||row.ms.title}</span>
                    {owner && <Avatar m={owner} size={16} />}
                    <span style={{fontSize:9,color:S.textTertiary}}>{row.ms.t}건</span>
                  </div>
                  <div style={{flex:1,position:"relative",minWidth:WEEKS*COL_W,height:ROW_H}}>
                    {weekDates.map((_,i)=><div key={i} style={{position:"absolute",left:i*COL_W,top:0,bottom:0,width:COL_W,borderLeft:`0.5px solid #f0efeb`}}/>)}
                    {w>0&&<div style={{position:"absolute",left:x1,top:6,width:w,height:14,borderRadius:4,background:`${row.proj.color}30`,border:`1px solid ${row.proj.color}40`,
                      fontSize:8,color:row.proj.color,paddingLeft:4,overflow:"hidden",whiteSpace:"nowrap",lineHeight:"14px"
                    }}>{(row.ms.path||row.ms.title).length>20?(row.ms.path||row.ms.title).slice(0,20)+"…":(row.ms.path||row.ms.title)}</div>}
                  </div>
                </div>
              );
            }

            // task
            const x1=toX(row.task.start);const x2=toX(row.task.end);
            const w=x1!==null&&x2!==null?Math.max(x2-x1,6):0;
            const owner = MEMBERS.find(m=>m.id===row.task.owner);
            return (
              <div key={row.id} style={{display:"flex",borderBottom:`0.5px solid ${S.border}`,minHeight:ROW_H}}>
                <div style={{width:240,flexShrink:0,padding:"4px 10px 4px 44px",display:"flex",alignItems:"center",gap:5}}>
                  <Check done={row.task.done} />
                  <span style={{flex:1,fontSize:10.5,color:row.task.done?S.textTertiary:S.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:row.task.done?"line-through":"none"}}>{row.task.text}</span>
                  {owner && <Avatar m={owner} size={14} />}
                </div>
                <div style={{flex:1,position:"relative",minWidth:WEEKS*COL_W,height:ROW_H}}>
                  {weekDates.map((_,i)=><div key={i} style={{position:"absolute",left:i*COL_W,top:0,bottom:0,width:COL_W,borderLeft:`0.5px solid #f0efeb`}}/>)}
                  {w>0&&<div style={{position:"absolute",left:x1,top:6,width:w,height:14,borderRadius:4,background:`${row.proj.color}50`,
                    fontSize:8,color:"#fff",paddingLeft:4,overflow:"hidden",whiteSpace:"nowrap",lineHeight:"14px",cursor:"grab"
                  }}>{row.task.text.length>18?row.task.text.slice(0,18)+"…":row.task.text}</div>}
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
// 팀 주간 플래너 — 행=팀원, 열=요일
// ═══════════════════════════════════════
function TeamWeekly() {
  const DAYS = ["월 3/23","화 3/24","수 3/25","목 3/26","금 3/27"];

  const getTasksForDay = (memberId, dayIdx) => {
    return TEAM_TASKS.filter(t => {
      if(t.owner!==memberId || !t.due) return false;
      const d = new Date(`2026-${t.due.replace("/","-")}`);
      return d.getDay() === dayIdx+1;
    });
  };

  return (
    <div>
      <div style={{fontSize:11,color:S.textTertiary,marginBottom:10}}>
        행=팀원, 열=요일 — 백로그에서 DnD로 배정, 팀원 간 재배정
      </div>

      <div style={{display:"grid",gridTemplateColumns:`100px repeat(5, 1fr)`,gap:0,border:`0.5px solid ${S.border}`,borderRadius:10,overflow:"hidden"}}>
        {/* 헤더 */}
        <div style={{padding:"8px 6px",background:"#fafaf8",borderBottom:`1px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,fontSize:10,fontWeight:600,color:S.textTertiary}}>팀원</div>
        {DAYS.map((day,i) => (
          <div key={day} style={{
            padding:"8px 8px",background:i===1?"#fef9ec":"#fafaf8",
            borderBottom:`1px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,
            fontSize:11,fontWeight:i===1?700:500,color:i===1?"#d97706":S.textTertiary,
          }}>
            {day}{i===1 && <span style={{fontSize:9,marginLeft:4}}>오늘</span>}
          </div>
        ))}

        {/* 팀원 행 */}
        {MEMBERS.map(mem => [
          <div key={`m-${mem.id}`} style={{padding:"6px 6px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,display:"flex",alignItems:"flex-start",gap:4}}>
            <Avatar m={mem} size={20} />
            <span style={{fontSize:10.5,fontWeight:600,color:S.textPrimary,lineHeight:1.6}}>{mem.name}</span>
          </div>,
          ...DAYS.map((_,di) => {
            const tasks = getTasksForDay(mem.id, di);
            return (
              <div key={`${mem.id}-d${di}`} style={{
                padding:"4px 4px",borderBottom:`0.5px solid ${S.border}`,borderRight:`0.5px solid ${S.border}`,
                minHeight:55,background:di===1?"#fffbeb":"transparent",
              }}>
                {tasks.map(t => {
                  const proj = PROJECTS.find(p=>p.id===t.proj);
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 5px",marginBottom:2,background:"#fff",borderRadius:5,border:`0.5px solid ${S.border}`,cursor:"grab",fontSize:10.5}}>
                      <Check done={t.done} />
                      <Dot color={proj?.color} size={5} />
                      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:t.done?S.textTertiary:S.textPrimary,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
                    </div>
                  );
                })}
                {tasks.length===0 && <div style={{padding:"6px 4px",fontSize:10,color:"#e0e0e0",textAlign:"center"}}>—</div>}
                <div style={{padding:"2px 4px"}}><span style={{fontSize:9.5,color:S.textTertiary,cursor:"pointer"}}>+ 추가</span></div>
              </div>
            );
          })
        ])}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════
export default function TeamViewMockup() {
  const [view, setView] = useState("매트릭스");
  const [matrixTab, setMatrixTab] = useState("할일");
  const [depthFilter, setDepthFilter] = useState("대분류");

  return (
    <div style={{fontFamily:S.font,color:S.textPrimary,maxWidth:1300,margin:"0 auto",padding:"0 24px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:10,marginBottom:4}}>
        <h2 style={{margin:0,fontSize:17,fontWeight:700}}>팀 뷰</h2>
        <span style={{fontSize:12,color:S.textTertiary}}>scope = team — 팀 프로젝트 × 팀원 전체</span>
      </div>

      {/* 뷰 전환 */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap"}}>
        <Pill items={["매트릭스","타임라인","주간 플래너"]} active={view} onChange={setView} />

        {/* 매트릭스 서브탭 */}
        {view==="매트릭스" && <>
          <div style={{width:1,height:20,background:S.border}} />
          <Pill items={["할일","마일스톤","담당자별"]} active={matrixTab} onChange={setMatrixTab} />
        </>}

        {/* depth 토글 (MS 탭에서만) */}
        {view==="매트릭스" && matrixTab==="마일스톤" && <>
          <div style={{width:1,height:20,background:S.border}} />
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:10,color:S.textTertiary}}>표시 단위:</span>
            <Pill items={["전체","대분류","중분류","소분류"]} active={depthFilter} onChange={setDepthFilter} />
          </div>
        </>}
      </div>

      {/* scope 설명 */}
      <div style={{padding:"8px 12px",background:"#eff6ff",borderRadius:7,fontSize:11,color:"#1e40af",marginBottom:14,lineHeight:1.6}}>
        <strong>데이터 범위:</strong> 팀 프로젝트(정기주총, ABI 코리아, 일본법인, BIS) × 팀원 전체(Ryan, Edmond, eric, ash).
        모든 할일과 마일스톤이 팀 관점에서 표시됨.
      </div>

      {/* 뷰 렌더 */}
      {view==="매트릭스" && matrixTab==="할일" && <TeamMatrixTask />}
      {view==="매트릭스" && matrixTab==="마일스톤" && <TeamMatrixMs depthFilter={depthFilter} />}
      {view==="매트릭스" && matrixTab==="담당자별" && <TeamMatrixMember depthFilter={depthFilter} />}
      {view==="타임라인" && <TeamTimeline />}
      {view==="주간 플래너" && <TeamWeekly />}

      {/* 팀 vs 개인 비교 */}
      <div style={{marginTop:24,padding:14,background:"#fafaf8",borderRadius:8,fontSize:11.5,color:S.textSecondary,lineHeight:1.7}}>
        <strong>개인 뷰와의 차이:</strong><br/>
        • <strong>팀 매트릭스</strong>: 행=팀원, 열=프로젝트 → "누가 뭘 맡고 있지?" + DnD 재배정<br/>
        • <strong>개인 매트릭스</strong>: 행=프로젝트, 열=카테고리(오늘/다음/나중) → "내가 뭘 해야 하지?"<br/><br/>
        • <strong>팀 타임라인</strong>: 모든 팀원의 MS/할일 간트 + 담당자 아바타<br/>
        • <strong>개인 타임라인</strong>: 내 담당분만 간트<br/><br/>
        • <strong>팀 주간 플래너</strong>: 행=팀원 전체, 팀원 간 DnD 재배정<br/>
        • <strong>개인 주간 플래너</strong>: 행=프로젝트, 내 스케줄만
      </div>
    </div>
  );
}
