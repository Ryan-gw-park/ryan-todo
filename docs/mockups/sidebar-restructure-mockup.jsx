import { useState } from "react";

const S = {
  font: "'Noto Sans KR','Inter',-apple-system,sans-serif",
  textPrimary: "#37352f",
  textSecondary: "#6b6a66",
  textTertiary: "#a09f99",
  border: "#e8e6df",
  sidebarBg: "#fbfaf8",
  activeBg: "#f0efeb",
  hoverBg: "#f5f4f0",
};

const Dot = ({color,size=8}) => <div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0}}/>;

// ─── 사이드바 아이템 ───
function NavItem({ icon, label, active, onClick, indent=0, badge, rightText }) {
  return (
    <div
      onClick={onClick}
      style={{
        display:"flex", alignItems:"center", gap:8,
        padding:`6px 12px 6px ${12 + indent * 12}px`,
        borderRadius:6, cursor:"pointer",
        background: active ? S.activeBg : "transparent",
        fontWeight: active ? 600 : 400,
        transition:"background 0.1s",
        margin:"1px 6px",
      }}
      onMouseEnter={e => { if(!active) e.currentTarget.style.background = S.hoverBg; }}
      onMouseLeave={e => { if(!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{fontSize:14,width:20,textAlign:"center",flexShrink:0,opacity:0.7}}>{icon}</span>
      <span style={{fontSize:13,color:S.textPrimary,flex:1}}>{label}</span>
      {badge && <span style={{fontSize:10,color:"#fff",background:"#ef4444",borderRadius:8,padding:"0 5px",minWidth:16,textAlign:"center",lineHeight:"16px"}}>{badge}</span>}
      {rightText && <span style={{fontSize:10,color:S.textTertiary}}>{rightText}</span>}
    </div>
  );
}

function SectionHeader({ label, action }) {
  return (
    <div style={{
      display:"flex", alignItems:"center",
      padding:"16px 14px 4px",
      fontSize:11, fontWeight:600, color:S.textTertiary,
      letterSpacing:"0.02em",
    }}>
      <span style={{flex:1}}>{label}</span>
      {action && <span style={{cursor:"pointer",fontSize:14,color:S.textTertiary,lineHeight:1}}>{action}</span>}
    </div>
  );
}

function SubSectionHeader({ label, collapsed, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display:"flex", alignItems:"center", gap:4,
        padding:"6px 14px 2px 18px",
        fontSize:11, fontWeight:500, color:S.textTertiary,
        cursor:"pointer", userSelect:"none",
      }}
    >
      <span style={{fontSize:9,width:12}}>{collapsed ? "▸" : "▾"}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── 메인 콘텐츠 영역 (선택된 뷰 표시) ───
function ContentArea({ activeView }) {
  const viewLabels = {
    "now": "지금 할일",
    "all": "전체 할일",
    "notes": "노트",
    "team-matrix": "팀 매트릭스",
    "team-timeline": "팀 타임라인",
    "team-weekly": "팀 주간 플래너",
    "personal-matrix": "개인 매트릭스",
    "personal-timeline": "개인 타임라인",
    "personal-weekly": "개인 주간 플래너",
  };

  const viewDescriptions = {
    "now": "오늘 집중할 할일. 체크, 인라인 추가, DnD 순서 변경.",
    "all": "팀+개인 전체 할일 조망. MS 그룹핑 포함.",
    "notes": "개인 메모. 클릭하여 전체화면 편집.",
    "team-matrix": "행=팀원, 열=프로젝트. [할일][마일스톤][담당자별] 서브뷰.\nMS depth 토글. DnD 재배정. 인라인 할일 추가.\nscope='team' — 팀 프로젝트의 모든 팀원 데이터.",
    "team-timeline": "팀 프로젝트 전체의 간트 차트.\n모든 팀원의 MS/할일 기간 표시.\nscope='team' — 글로벌 타임라인과 동일하되 팀 한정.",
    "team-weekly": "행=팀원 전체, 열=월~금.\n백로그에서 DnD로 요일 배정.\nscope='team' — 팀원 전체 × 팀 프로젝트 할일.",
    "personal-matrix": "행=프로젝트×카테고리, 열 없음 (내 것만).\n내가 owner/assignee인 모든 항목 표시.\nscope='personal' — 팀+개인 프로젝트에서 내 것만 필터.",
    "personal-timeline": "내가 담당하는 MS/할일의 간트 차트.\n팀 프로젝트 포함, 내 담당분만 표시.\nscope='personal' — 내 assignee/owner 필터.",
    "personal-weekly": "내 이번 주 스케줄.\n행=프로젝트(또는 시간대), 열=월~금.\nscope='personal' — 내 할일만.",
  };

  const label = viewLabels[activeView] || activeView;
  const desc = viewDescriptions[activeView] || "";
  const isProject = activeView.startsWith("project-");
  const projectName = isProject ? activeView.replace("project-","") : "";

  return (
    <div style={{flex:1,padding:"24px 32px"}}>
      <h1 style={{fontSize:20,fontWeight:700,color:S.textPrimary,margin:"0 0 8px"}}>{isProject ? projectName : label}</h1>
      {!isProject && (
        <pre style={{fontSize:12,color:S.textSecondary,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap",fontFamily:S.font}}>
          {desc}
        </pre>
      )}
      {isProject && (
        <div style={{fontSize:12,color:S.textSecondary,lineHeight:1.7}}>
          프로젝트 뷰 — 좌측 컬럼 정렬 트리 + 우측 [전체 할일 | 타임라인]
        </div>
      )}

      {/* scope 표시 */}
      {activeView.includes("team-") && (
        <div style={{marginTop:16,padding:"10px 14px",background:"#eff6ff",borderRadius:8,fontSize:11.5,color:"#1e40af"}}>
          <strong>scope = "team"</strong> — 팀 프로젝트 전체 × 팀원 전체. [전체|팀|개인] 토글 불필요.
        </div>
      )}
      {activeView.includes("personal-") && (
        <div style={{marginTop:16,padding:"10px 14px",background:"#f0fdf4",borderRadius:8,fontSize:11.5,color:"#166534"}}>
          <strong>scope = "personal"</strong> — 내가 관여하는 모든 프로젝트(팀+개인)에서 내 것만 필터.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════
export default function SidebarMockup() {
  const [activeView, setActiveView] = useState("now");
  const [collapsed, setCollapsed] = useState({ taskTeam:false, taskPersonal:false, projTeam:false, projPersonal:false });
  const toggle = (key) => setCollapsed(p => ({...p, [key]:!p[key]}));

  return (
    <div style={{fontFamily:S.font,display:"flex",height:"100vh",background:"#fff"}}>
      {/* ═══ 사이드바 ═══ */}
      <div style={{
        width:220, flexShrink:0,
        background:S.sidebarBg,
        borderRight:`0.5px solid ${S.border}`,
        display:"flex", flexDirection:"column",
        overflowY:"auto",
      }}>
        {/* 팀 헤더 */}
        <div style={{padding:"14px 14px 10px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:"#1D9E75",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700}}>R</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:S.textPrimary}}>SCD팀</div>
          </div>
          <span style={{marginLeft:"auto",fontSize:14,color:S.textTertiary,cursor:"pointer"}}>⌄</span>
        </div>

        {/* ─── 글로벌 뷰 ─── */}
        <SectionHeader label="글로벌 뷰" />
        <NavItem icon="📋" label="지금 할일" active={activeView==="now"} onClick={()=>setActiveView("now")} />
        <NavItem icon="📄" label="전체 할일" active={activeView==="all"} onClick={()=>setActiveView("all")} />
        <NavItem icon="📝" label="노트" active={activeView==="notes"} onClick={()=>setActiveView("notes")} />

        {/* ─── 할일 ─── */}
        <SectionHeader label="할일" />

        <SubSectionHeader label="팀" collapsed={collapsed.taskTeam} onClick={()=>toggle("taskTeam")} />
        {!collapsed.taskTeam && <>
          <NavItem icon="⊞" label="매트릭스" active={activeView==="team-matrix"} onClick={()=>setActiveView("team-matrix")} indent={1} />
          <NavItem icon="📅" label="타임라인" active={activeView==="team-timeline"} onClick={()=>setActiveView("team-timeline")} indent={1} />
          <NavItem icon="🗓" label="주간 플래너" active={activeView==="team-weekly"} onClick={()=>setActiveView("team-weekly")} indent={1} />
        </>}

        <SubSectionHeader label="개인" collapsed={collapsed.taskPersonal} onClick={()=>toggle("taskPersonal")} />
        {!collapsed.taskPersonal && <>
          <NavItem icon="⊞" label="매트릭스" active={activeView==="personal-matrix"} onClick={()=>setActiveView("personal-matrix")} indent={1} />
          <NavItem icon="📅" label="타임라인" active={activeView==="personal-timeline"} onClick={()=>setActiveView("personal-timeline")} indent={1} />
          <NavItem icon="🗓" label="주간 플래너" active={activeView==="personal-weekly"} onClick={()=>setActiveView("personal-weekly")} indent={1} />
        </>}

        {/* ─── 프로젝트 ─── */}
        <SectionHeader label="프로젝트" />

        <SubSectionHeader label="팀 프로젝트" collapsed={collapsed.projTeam} onClick={()=>toggle("projTeam")} />
        {!collapsed.projTeam && <>
          {[
            {id:"정기주총",color:"#e05252"},
            {id:"ABI 코리아",color:"#3b82f6"},
            {id:"일본법인/해외SCM",color:"#8b5cf6"},
            {id:"BIS",color:"#f97316"},
          ].map(p => (
            <NavItem
              key={p.id}
              icon={<Dot color={p.color} size={8} />}
              label={p.id}
              active={activeView===`project-${p.id}`}
              onClick={()=>setActiveView(`project-${p.id}`)}
              indent={1}
            />
          ))}
        </>}

        <SubSectionHeader label="개인 프로젝트" collapsed={collapsed.projPersonal} onClick={()=>toggle("projPersonal")} />
        {!collapsed.projPersonal && <>
          {[
            {id:"개별과제",color:"#22c55e"},
            {id:"C&",color:"#f59e0b"},
          ].map(p => (
            <NavItem
              key={p.id}
              icon={<Dot color={p.color} size={8} />}
              label={p.id}
              active={activeView===`project-${p.id}`}
              onClick={()=>setActiveView(`project-${p.id}`)}
              indent={1}
            />
          ))}
        </>}

        {/* ─── 하단 ─── */}
        <div style={{marginTop:"auto",borderTop:`0.5px solid ${S.border}`,padding:"8px 6px"}}>
          <NavItem icon="🔔" label="알림" badge="40" onClick={()=>{}} />
          <NavItem icon="❓" label="도움말" onClick={()=>{}} />
        </div>

        {/* 유저 */}
        <div style={{padding:"10px 14px",borderTop:`0.5px solid ${S.border}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:"#1D9E75",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:600}}>R</div>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:S.textPrimary}}>Ryan Park</div>
            <div style={{fontSize:10,color:S.textTertiary}}>gunwoong.park@gmail.com</div>
          </div>
        </div>
      </div>

      {/* ═══ 콘텐츠 영역 ═══ */}
      <ContentArea activeView={activeView} />
    </div>
  );
}
