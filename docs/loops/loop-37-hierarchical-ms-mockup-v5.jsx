import { useState } from "react";

const S = {
  font: "'Noto Sans KR','Inter',-apple-system,sans-serif",
  textPrimary: "#37352f",
  textSecondary: "#6b6a66",
  textTertiary: "#a09f99",
  border: "#e8e6df",
};

const PC = { purple:{dot:"#8b5cf6"}, pink:{dot:"#e05252"} };

const JAPAN_TREE = [
  { id:"j1", title:"법인설립", color:"#8b5cf6", children:[
    { id:"j1-1", title:"지점설립", children:[
      { id:"j1-1-1", title:"필요서류 확보 (PoA, 정관 등)", tasks:[
        { id:"t1", text:"대행사 Search 및 계약", assignee:"SCD", due:"04/06" },
        { id:"t2", text:"공증 및 아포스티유 필요", assignee:"SCD", due:"04/13" },
      ]},
      { id:"j1-1-2", title:"설립등기", tasks:[{id:"t3",text:"대행사 확인 필",assignee:"SCD",due:"04/20"}]},
      { id:"j1-1-3", title:"외국환은행 지정", tasks:[] },
    ]},
    { id:"j1-2", title:"국내지사 설치 운행신고", children:[
      { id:"j1-2-1", title:"필요서류 확보", tasks:[{id:"t4",text:"대행사 확인 필",assignee:"SCD",due:"04/13"}]},
      { id:"j1-2-2", title:"신고접수 확인 및 진행", tasks:[{id:"t5",text:"설립등기 후 진행",assignee:"SCD",due:"05/04"}]},
    ]},
    { id:"j1-3", title:"사업자등록", children:[
      { id:"j1-3-1", title:"사업자등록 신청", tasks:[{id:"t6",text:"대행사 확인 필",assignee:"SCD",due:"05/04"}]},
      { id:"j1-3-2", title:"업종코드 확정", tasks:[{id:"t7",text:"대행사 확인 필",assignee:"SCD",due:"05/04"}]},
      { id:"j1-3-3", title:"부가가치세 사업자 등록", tasks:[] },
      { id:"j1-3-4", title:"원천징수 의무자 등록", tasks:[] },
      { id:"j1-3-5", title:"홈택스 법인 계정 생성", tasks:[{id:"t8",text:"대행사 확인 필",assignee:"SCD",due:"05/11"}]},
    ]},
  ]},
  { id:"j2", title:"회계/세무", color:"#22c55e", children:[
    { id:"j2-1", title:"본사→지사 운영비 송금", children:[
      { id:"j2-1-1", title:"구조 설계", tasks:[{id:"t9",text:"TP 필요여부 확인",assignee:"Finance",due:"04/20"}]},
      { id:"j2-1-2", title:"초기 운영비 금액 확인", tasks:[] },
      { id:"j2-1-3", title:"초기 운영비 송금", tasks:[] },
    ]},
    { id:"j2-2", title:"회계/세무/급여 기장", children:[
      { id:"j2-2-1", title:"기장업체 필요여부 확인", tasks:[] },
      { id:"j2-2-2", title:"기장업체 선정 및 계약", tasks:[] },
    ]},
  ]},
  { id:"j3", title:"직원 전적", color:"#f97316", children:[
    { id:"j3-1", title:"전적 Detail", children:[
      { id:"j3-1-1", title:"퇴직금·근속연수·스톡옵션", tasks:[{id:"t10",text:"전적/승계에 따라 다른 처리",assignee:"HR",due:"04/27"}]},
      { id:"j3-1-2", title:"변동사항 최종결정", tasks:[] },
    ]},
    { id:"j3-2", title:"임직원 동의", children:[
      { id:"j3-2-1", title:"합의전직 동의서 날인", tasks:[] },
      { id:"j3-2-2", title:"근로계약서/NDA 준비", tasks:[] },
      { id:"j3-2-3", title:"지사 근로계약 체결", tasks:[{id:"t11",text:"PE issue 고려 필요",assignee:"HR",due:"05/11"}]},
    ]},
  ]},
];

const JUCHONG_TREE = [
  { id:"s1", title:"공증 + 위임장 + 의사록", color:"#e05252", tasks:[
    {id:"st1",text:"Sifive 위임투표 양식 (BKL)",assignee:"ash.kim"},
    {id:"st2",text:"등기 서류 <> 공증인 확인",assignee:"Ryan"},
    {id:"st3",text:"위임장 뿌리기 + 웹사이트",assignee:"Ryan"},
    {id:"st4",text:"필요 서류 공증인 확인",assignee:"Ryan"},
  ]},
  { id:"s2", title:"안건자료 PPT", color:"#f97316", tasks:[{id:"st5",text:"안건 PPT - 재무제표 분석",assignee:"Ryan"}]},
  { id:"s3", title:"의사록+첨부서류", color:"#8b5cf6", tasks:[{id:"st6",text:"의사록 작성",assignee:"Edmond"}]},
  { id:"s4", title:"운영 매뉴얼", color:"#3b82f6", tasks:[{id:"st7",text:"투표 엑셀",assignee:"Ryan"}]},
  { id:"s5", title:"현장 투표 Dashboard", color:"#22c55e", tasks:[] },
  { id:"s6", title:"현장 준비물 + 식권", color:"#f97316", tasks:[] },
];

const Dot = ({color,size=7}) => <div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0}}/>;
const Check = ({done=false}) => (
  <div style={{width:14,height:14,borderRadius:3,flexShrink:0,cursor:"pointer",
    border:done?"none":"1.5px solid #ccc",background:done?"#2383e2":"#fff",
    display:"flex",alignItems:"center",justifyContent:"center"}}>
    {done&&<svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </div>
);

const countAll = (n) => {
  let t=0,d=0;
  if(n.tasks){t+=n.tasks.length;d+=n.tasks.filter(x=>x.done).length}
  if(n.children)n.children.forEach(c=>{const s=countAll(c);t+=s.total;d+=s.done});
  return{total:t,done:d};
};

// ─── 트리를 flat rows로 변환 (각 행 = 리프까지의 경로) ───
function flattenTree(nodes, parentColor) {
  const rows = [];
  const maxDepth = getMaxDepth(nodes);

  const walk = (ns, path, depth, color) => {
    ns.forEach(n => {
      const c = n.color || color;
      const hasChildren = n.children && n.children.length > 0;
      if (hasChildren) {
        walk(n.children, [...path, { id: n.id, title: n.title, color: c, count: countAll(n) }], depth + 1, c);
      } else {
        const cells = [...path, { id: n.id, title: n.title, color: c, count: countAll(n), isLeaf: true }];
        while (cells.length < maxDepth) cells.push(null);
        rows.push({ leafId: n.id, cells, tasks: n.tasks || [], color: c });
      }
    });
  };

  walk(nodes, [], 0, parentColor || "#888");
  return { rows, maxDepth };
}

function getMaxDepth(nodes, d = 1) {
  let max = d;
  nodes.forEach(n => { if (n.children && n.children.length > 0) max = Math.max(max, getMaxDepth(n.children, d + 1)); });
  return max;
}

// ─── 프로젝트 뷰 ───
function ProjectView({ projectName, projectColor, tree }) {
  const pc = PC[projectColor] || PC.purple;
  const { rows, maxDepth } = flattenTree(tree, pc.dot);
  const [selectedLeaf, setSelectedLeaf] = useState(null);
  const [taskMode, setTaskMode] = useState("전체"); // "전체" | "선택"
  const [activeTab, setActiveTab] = useState("마일스톤");

  // 전체 할일 수집
  const allTasks = [];
  const collectAll = (ns, color, path) => {
    ns.forEach(n => {
      const c = n.color || color;
      const p = [...path, n.title];
      if (n.tasks) n.tasks.forEach(t => allTasks.push({ ...t, _color: c, _path: p.join(" > "), _leafId: n.id }));
      if (n.children) collectAll(n.children, c, p);
    });
  };
  collectAll(tree, pc.dot, []);

  // 선택된 리프의 할일
  const selectedRow = rows.find(r => r.leafId === selectedLeaf);
  const selectedTasks = selectedRow ? selectedRow.tasks.map(t => ({ ...t, _color: selectedRow.color, _leafId: selectedRow.leafId })) : [];
  const selectedTitle = selectedRow ? selectedRow.cells.filter(c => c && c.isLeaf)[0]?.title : "";

  // rowspan 추적: 같은 id가 연속되면 첫 행만 렌더
  const rendered = {};

  return (
    <div style={{ fontFamily: S.font, color: S.textPrimary }}>
      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0 14px", borderBottom:`0.5px solid ${S.border}` }}>
        <Dot color={pc.dot} size={11} />
        <span style={{ fontSize:17, fontWeight:700 }}>{projectName}</span>
        <span style={{ fontSize:12, color:S.textTertiary }}>SCD팀 · 오너: 미지정</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
          {["마일스톤","할일","타임라인"].map(tab => (
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{
              border:"none", borderRadius:7, padding:"5px 16px", fontSize:12, fontFamily:S.font, cursor:"pointer",
              fontWeight:activeTab===tab?600:400,
              background:activeTab===tab?"#1e293b":"#f5f4f0",
              color:activeTab===tab?"#fff":"#6b6a66",
            }}>{tab}</button>
          ))}
        </div>
      </div>

      {/* 메인 컨테이너 */}
      <div style={{ display:"flex", alignItems:"stretch", border:`0.5px solid ${S.border}`, borderRadius:10, overflow:"hidden", marginTop:12, minHeight:400 }}>

        {/* ═══ 좌측: 트리 (컬럼 정렬, 표 없음) ═══ */}
        <div style={{ overflowX:"auto", overflowY:"auto", borderRight:`0.5px solid ${S.border}`, flexShrink:0, padding:"8px 0" }}>

          {/* 트리 행 */}
          {rows.map((row, ri) => {
            const isSelected = selectedLeaf === row.leafId;
            return (
              <div key={row.leafId + '-' + ri} style={{
                display:"flex", alignItems:"stretch",
                background: isSelected ? `${row.color}0c` : "transparent",
                borderRadius: 6,
                margin: "1px 4px",
                cursor:"pointer", transition:"background 0.1s",
              }}
                onClick={() => { setSelectedLeaf(row.leafId); setTaskMode("선택"); }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f5f4f0"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${row.color}0c` : "transparent"; }}
              >
                {row.cells.map((cell, ci) => {
                  if (!cell) return <div key={ci} style={{ width: ci===0?160:150, flexShrink:0 }} />;

                  // rowspan: 이미 렌더한 노드면 빈 칸
                  if (rendered[cell.id] && !cell.isLeaf) {
                    return <div key={ci} style={{ width: ci===0?160:150, flexShrink:0 }} />;
                  }
                  if (!cell.isLeaf) rendered[cell.id] = true;

                  const isDepth0 = ci === 0;

                  return (
                    <div key={ci} style={{
                      width: ci===0?160:150, flexShrink:0,
                      padding:"7px 10px",
                      display:"flex", alignItems:"flex-start", gap:5,
                    }}>
                      {/* 트리 연결선 */}
                      {ci > 0 && (
                        <span style={{ color:`${cell.color}50`, fontSize:11, marginRight:1, flexShrink:0, fontFamily:"monospace" }}>╴</span>
                      )}
                      <Dot color={cell.color} size={isDepth0 ? 8 : 6} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          fontSize: isDepth0 ? 12 : 11.5,
                          fontWeight: isDepth0 ? 700 : ci===1 ? 600 : 400,
                          color: S.textPrimary, lineHeight:1.35, wordBreak:"break-word",
                        }}>{cell.title}</div>
                        {cell.count.total > 0 && (
                          <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:2 }}>
                            <div style={{ width:28, height:2.5, borderRadius:2, background:"#e8e6df" }}>
                              <div style={{ width:`${cell.count.total?cell.count.done/cell.count.total*100:0}%`, height:2.5, borderRadius:2, background:cell.color }}/>
                            </div>
                            <span style={{ fontSize:9.5, color:S.textTertiary }}>{cell.count.done}/{cell.count.total}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* + 추가 */}
          <div style={{ padding:"8px 12px" }}>
            <span style={{ fontSize:11, color:S.textTertiary, cursor:"pointer" }}>+ 마일스톤 추가</span>
          </div>
        </div>

        {/* ═══ 우측: 할일 리스트 ═══ */}
        <div style={{ flex:1, minWidth:280, display:"flex", flexDirection:"column" }}>
          {/* 할일 모드 토글 */}
          <div style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"8px 14px", borderBottom:`0.5px solid ${S.border}`, background:"#fafaf8",
          }}>
            <span style={{ fontSize:12, fontWeight:600, color:S.textSecondary }}>할일</span>
            <div style={{ display:"flex", gap:2, background:"#fff", borderRadius:6, padding:2, marginLeft:8 }}>
              {["전체","선택"].map(m => (
                <button key={m} onClick={() => setTaskMode(m)} style={{
                  border:"none", borderRadius:5, padding:"3px 12px", fontSize:11, fontFamily:S.font, cursor:"pointer",
                  fontWeight: taskMode===m?600:400,
                  background: taskMode===m?"#f0efeb":"transparent",
                  color: taskMode===m?S.textPrimary:S.textTertiary,
                }}>{m === "전체" ? "전체 할일" : "선택 항목"}</button>
              ))}
            </div>
            <span style={{ fontSize:11, color:S.textTertiary, marginLeft:"auto" }}>
              {taskMode === "전체" ? `${allTasks.length}건` : selectedTasks.length > 0 ? `${selectedTasks.length}건` : ""}
            </span>
          </div>

          {/* 할일 목록 */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {taskMode === "전체" ? (
              // ─── 전체 할일 모드: 리프별 그룹핑 ───
              allTasks.length === 0 ? (
                <div style={{ padding:24, textAlign:"center", color:S.textTertiary, fontSize:12 }}>할일이 없습니다</div>
              ) : (
                (() => {
                  let lastLeafId = null;
                  return allTasks.map((t, ti) => {
                    const showHeader = t._leafId !== lastLeafId;
                    lastLeafId = t._leafId;
                    return (
                      <div key={t.id}>
                        {showHeader && (
                          <div style={{
                            padding:"8px 14px 4px",
                            fontSize:11, fontWeight:600, color:t._color,
                            display:"flex", alignItems:"center", gap:5,
                            borderTop: ti > 0 ? `0.5px solid ${S.border}` : "none",
                            background:`${t._color}06`,
                          }}>
                            <Dot color={t._color} size={5} />
                            <span>{t._path}</span>
                          </div>
                        )}
                        <div style={{
                          display:"flex", alignItems:"center", gap:8,
                          padding:"6px 14px 6px 28px",
                          borderBottom:`0.5px solid ${S.border}`,
                          cursor:"pointer", transition:"background 0.08s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fafaf8"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <Check done={t.done} />
                          <span style={{ flex:1, fontSize:12.5, color:S.textPrimary, lineHeight:1.35 }}>{t.text}</span>
                          {t.assignee && <span style={{ fontSize:10, color:S.textTertiary, background:"#f5f4f0", borderRadius:4, padding:"1px 6px", flexShrink:0 }}>{t.assignee}</span>}
                          {t.due && <span style={{ fontSize:10, color:S.textTertiary, flexShrink:0 }}>{t.due}</span>}
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{opacity:0.2,flexShrink:0}}>
                            <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    );
                  });
                })()
              )
            ) : (
              // ─── 선택 항목 모드 ───
              !selectedLeaf ? (
                <div style={{ padding:24, textAlign:"center", color:S.textTertiary, fontSize:12, fontStyle:"italic" }}>
                  ← 왼쪽 트리에서 항목을 선택하세요
                </div>
              ) : (
                <div>
                  {/* 선택된 리프 헤더 */}
                  <div style={{
                    padding:"10px 14px", borderBottom:`0.5px solid ${S.border}`,
                    display:"flex", alignItems:"center", gap:6,
                  }}>
                    <Dot color={selectedRow.color} size={7} />
                    <span style={{ fontSize:13, fontWeight:600, color:S.textPrimary }}>{selectedTitle}</span>
                    {selectedRow && (
                      <div style={{ display:"flex", alignItems:"center", gap:4, marginLeft:"auto" }}>
                        <div style={{ width:36, height:3, borderRadius:2, background:"#e8e6df" }}>
                          <div style={{ width:`${selectedTasks.length?selectedTasks.filter(t=>t.done).length/selectedTasks.length*100:0}%`, height:3, borderRadius:2, background:selectedRow.color }}/>
                        </div>
                        <span style={{ fontSize:10, color:S.textTertiary }}>{selectedTasks.filter(t=>t.done).length}/{selectedTasks.length}</span>
                      </div>
                    )}
                  </div>

                  {/* 할일 목록 */}
                  {selectedTasks.length === 0 ? (
                    <div style={{ padding:20, textAlign:"center" }}>
                      <div style={{ fontSize:12, color:S.textTertiary, marginBottom:6 }}>연결된 할일이 없습니다</div>
                      <div style={{ fontSize:11, color:S.textTertiary }}>드래그하여 연결하거나 아래에서 추가하세요</div>
                    </div>
                  ) : selectedTasks.map(t => (
                    <div key={t.id} style={{
                      display:"flex", alignItems:"center", gap:8,
                      padding:"7px 14px",
                      borderBottom:`0.5px solid ${S.border}`,
                      cursor:"pointer", transition:"background 0.08s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafaf8"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Check done={t.done} />
                      <span style={{ flex:1, fontSize:12.5, color:t.done?S.textTertiary:S.textPrimary, lineHeight:1.35,
                        textDecoration:t.done?"line-through":"none" }}>{t.text}</span>
                      {t.assignee && <span style={{ fontSize:10, color:S.textTertiary, background:"#f5f4f0", borderRadius:4, padding:"1px 6px", flexShrink:0 }}>{t.assignee}</span>}
                      {t.due && <span style={{ fontSize:10, color:S.textTertiary, flexShrink:0 }}>{t.due}</span>}
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{opacity:0.2,flexShrink:0}}>
                        <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ))}

                  <div style={{ padding:"8px 14px" }}>
                    <span style={{ fontSize:11, color:S.textTertiary, cursor:"pointer" }}>+ 할일 추가</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 백로그 */}
      <div style={{ borderTop:`1.5px dashed ${S.border}`, marginTop:8, padding:"8px 10px", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:12, color:S.textTertiary }}>⊙</span>
        <span style={{ fontSize:12, fontWeight:500, color:S.textTertiary }}>백로그</span>
        <span style={{ fontSize:11, color:S.textTertiary, marginLeft:8, cursor:"pointer" }}>+ 추가</span>
      </div>
    </div>
  );
}

// ─── Main ───
export default function Loop37MockupV5() {
  const [project, setProject] = useState("japan");

  return (
    <div style={{ fontFamily:S.font, color:S.textPrimary, maxWidth:1300, margin:"0 auto", padding:"0 24px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, paddingTop:8, marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>Loop-37 v5 — 정렬 트리 + 할일 모드</h2>
        {[{id:"japan",label:"일본법인 (다단계)"},{id:"juchong",label:"정기주총 (flat)"}].map(p => (
          <button key={p.id} onClick={()=>setProject(p.id)} style={{
            border:"none", borderRadius:7, padding:"6px 14px", fontSize:12, fontFamily:S.font, cursor:"pointer",
            fontWeight:project===p.id?600:400,
            background:project===p.id?"#1e293b":"#f5f4f0",
            color:project===p.id?"#fff":"#6b6a66",
          }}>{p.label}</button>
        ))}
      </div>

      {project === "japan" ? (
        <ProjectView projectName="일본법인/해외SCM" projectColor="purple" tree={JAPAN_TREE} />
      ) : (
        <ProjectView projectName="정기주총" projectColor="pink" tree={JUCHONG_TREE} />
      )}
    </div>
  );
}
