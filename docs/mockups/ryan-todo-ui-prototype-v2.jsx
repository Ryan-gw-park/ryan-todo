import { useState } from "react";

// ─── Design Tokens (기존 Ryan Todo에서 추출) ───
const T = {
  bg: "#f5f3ef", card: "#ffffff", cardBorder: "#e8e8e8",
  text: "#1a1a1a", textSub: "#888", textMuted: "#adb5bd",
  accent: "#2c5282", border: "#ece8e1", hover: "rgba(0,0,0,0.03)",
  nav: { bg: "#fff", active: "#1a1a1a", inactive: "#999" },
  ryan: { bg: "linear-gradient(135deg, #e8f0fe 0%, #d4e4fc 100%)", text: "#2c5282", sub: "#6a8cbe" },
  team: { bg: "linear-gradient(135deg, #fef3e2 0%, #fde8c8 100%)", text: "#8b5e3c", sub: "#b8956a" },
};

const HL = {
  red: { bg: "#E53E3E", text: "#fff" }, orange: { bg: "#DD6B20", text: "#fff" },
  yellow: { bg: "#D69E2E", text: "#fff" }, blue: { bg: "#3182CE", text: "#fff" },
  green: { bg: "#38A169", text: "#fff" }, purple: { bg: "#805AD5", text: "#fff" },
};

const PROJECTS = [
  { id: "p1", name: "개별과제", color: "#4CAF50", bg: "#E8F5E9" },
  { id: "p2", name: "정기주총", color: "#FF9800", bg: "#FFF3E0" },
  { id: "p3", name: "BIS", color: "#2196F3", bg: "#E3F2FD" },
  { id: "p4", name: "ABI Korea", color: "#9C27B0", bg: "#F3E5F5" },
  { id: "p5", name: "일본법인/해외SCD", color: "#795548", bg: "#EFEBE9" },
  { id: "p6", name: "C&Plus", color: "#E65100", bg: "#FFF3E0" },
];

const SCREENS = [
  { id: "matrix", label: "매트릭스", icon: "⊞" },
  { id: "detail", label: "상세패널", icon: "◫" },
  { id: "today", label: "오늘할일", icon: "◷" },
  { id: "project", label: "프로젝트", icon: "☰" },
  { id: "notification", label: "알림패널", icon: "🔔" },
  { id: "onboarding", label: "온보딩", icon: "👋" },
  { id: "invite", label: "초대/가입", icon: "✉" },
  { id: "teamSettings", label: "팀설정", icon: "⚙" },
  { id: "rowConfig", label: "행구성", icon: "☷" },
];

// ─── Shared ───
const Badge = ({ children, color = "#666", bg = "#f0f0f0", style }) => (
  <span style={{ background: bg, color, borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", ...style }}>{children}</span>
);
const ScopeLabel = ({ scope }) => {
  const m = { team: { l: "팀", bg: "#E8F5E9", c: "#2E7D32" }, assigned: { l: "배정", bg: "#E3F2FD", c: "#1565C0" }, private: { l: "개인", bg: "#F3E5F5", c: "#7B1FA2" } };
  const s = m[scope] || m.private;
  return <Badge bg={s.bg} color={s.c}>{s.l}</Badge>;
};
const Btn = ({ children, primary, small, onClick, style }) => (
  <button onClick={onClick} style={{
    background: primary ? "#1a1a1a" : "#fff", color: primary ? "#fff" : T.text,
    border: primary ? "none" : `1px solid ${T.cardBorder}`, borderRadius: 6,
    padding: small ? "5px 12px" : "8px 16px", fontSize: small ? 12 : 13,
    fontWeight: 500, cursor: "pointer", ...style,
  }}>{children}</button>
);
const Avatar = ({ name, size = 24, bg = "#1a1a1a" }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, fontWeight: 700, flexShrink: 0 }}>{name[0]}</div>
);

// ─── Top Nav (기존 그대로) ───
const TopNav = ({ active, onSelect, showNotiBadge }) => (
  <div style={{ background: T.nav.bg, borderBottom: `1px solid ${T.cardBorder}`, padding: "0 24px", display: "flex", alignItems: "center", height: 48 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 24 }}>
      <Avatar name="R" size={28} />
      <span style={{ fontWeight: 700, fontSize: 15 }}>Ryan Todo</span>
    </div>
    <div style={{ display: "flex", gap: 0, flex: 1 }}>
      {[["today","◷ 오늘할일"],["matrix","⊞ 매트릭스"],["project","☰ 프로젝트"],["timeline","⇥ 타임라인"],["note","◻ 노트"]].map(([id, label]) => (
        <div key={id} onClick={() => onSelect(id)} style={{
          padding: "12px 14px", cursor: "pointer", fontSize: 13,
          fontWeight: active === id ? 600 : 400, color: active === id ? T.nav.active : T.nav.inactive,
          borderBottom: active === id ? "2px solid #1a1a1a" : "2px solid transparent",
        }}>{label}</div>
      ))}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 18, cursor: "pointer", color: "#999" }}>☀</span>
      <div onClick={() => onSelect("notification")} style={{ position: "relative", cursor: "pointer" }}>
        <span style={{ fontSize: 16 }}>🔔</span>
        {showNotiBadge && <div style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: "50%", background: "#E53E3E" }} />}
      </div>
      <Btn primary small>+ 새 할일</Btn>
      <Avatar name="R" size={30} bg="#4a5568" />
    </div>
  </div>
);

// ═══ 1. MATRIX VIEW (기존 매트릭스 + Ryan/팀 섹션 + 강조색상 + 읽기전용) ═══
function MatrixScreen() {
  const [expandedMember, setExpandedMember] = useState(null);
  const [ryanOpen, setRyanOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [selectedTodo, setSelectedTodo] = useState(null);

  const ryanTasks = {
    p1: { today: [{ t: "사업보고서 업데이트", h: null }], next: [] },
    p2: { today: [{ t: "안건 PPT 작성", h: "orange" }, { t: "감사위원회 소집통지 (서면결의)", h: null }, { t: "소집공고 - 영업개황 - 수주?", h: null }, { t: "결산공시", h: null }, { t: "전화 확인 - 본 회신 마지막 확인 필요", h: "red" }], next: [] },
    p3: { today: [{ t: "제출 서류 작성", h: null }], next: [{ t: "Sales팀 자료 취합", h: null }] },
    p4: { today: [{ t: "Todo 스케줄링", h: "blue" }], next: [{ t: "ABI 이사회 Paper Work", h: null }] },
  };

  const teamTasks = {
    Ethan: { p1: [{ t: "계약서 검토", h: null }], p2: [{ t: "주주명부 정리", h: null }, { t: "위임장 양식", h: "yellow" }, { t: "의결권 안내문", h: null }], p3: [{ t: "재무제표 정리", h: null }], p4: [] },
    Ash: { p1: [], p2: [{ t: "공시 서류 초안", h: null }], p3: [], p4: [{ t: "ABI 분기 보고", h: "green" }] },
    Eric: { p1: [{ t: "내부통제 체크", h: null }], p2: [{ t: "전자투표 확인", h: null }], p3: [{ t: "BIS 비율 산출", h: null }], p4: [] },
    Edmond: { p1: [], p2: [], p3: [], p4: [{ t: "등기 서류 준비", h: "purple" }] },
  };

  const cols = PROJECTS.slice(0, 4);
  const memberTotal = (m) => cols.reduce((s, p) => s + (teamTasks[m]?.[p.id]?.length || 0), 0);

  const Card = ({ task, readOnly, onClick }) => {
    const hl = task.h ? HL[task.h] : null;
    return (
      <div onClick={onClick} style={{
        display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 10px",
        background: hl ? hl.bg : "#fff", color: hl ? hl.text : T.text,
        borderRadius: 6, border: hl ? "none" : `1px solid ${T.cardBorder}`,
        fontSize: 13, lineHeight: 1.4, cursor: readOnly ? "default" : "pointer",
      }}>
        <input type="checkbox" readOnly style={{ marginTop: 2, flexShrink: 0 }} disabled={readOnly} />
        <span style={{ flex: 1 }}>{task.t}</span>
        {readOnly && <span style={{ fontSize: 9, opacity: 0.7 }}>👁</span>}
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>매트릭스 뷰</h1>
          <span style={{ fontSize: 13, color: T.textSub }}>2026년 3월 12일 목요일</span>
        </div>
        <Btn small>⚙ 프로젝트 관리</Btn>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `130px repeat(${cols.length}, 1fr)`, gap: 0, minWidth: 700 }}>
          {/* 프로젝트 헤더 */}
          <div />
          {cols.map(p => (
            <div key={p.id} style={{ background: p.bg, borderTop: `3px solid ${p.color}`, borderRadius: "8px 8px 0 0", padding: "8px 12px", margin: "0 2px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
              </div>
            </div>
          ))}

          {/* ── Ryan 섹션 ── */}
          <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
            <div onClick={() => setRyanOpen(!ryanOpen)} style={{
              background: T.ryan.bg, padding: "7px 12px", borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, userSelect: "none",
            }}>
              <span style={{ fontSize: 11, color: T.ryan.sub, transform: ryanOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: T.ryan.text }}>👤 Ryan</span>
              <span style={{ fontSize: 11, color: T.ryan.sub }}>
                오늘 {cols.reduce((s, p) => s + (ryanTasks[p.id]?.today?.length || 0), 0)} · 다음 {cols.reduce((s, p) => s + (ryanTasks[p.id]?.next?.length || 0), 0)}
              </span>
            </div>
          </div>

          {ryanOpen && ["today", "next"].map(cat => (
            <div key={cat} style={{ display: "contents" }}>
              <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 13 }}>{cat === "today" ? "🔥" : "📌"}</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: cat === "today" ? "#c0392b" : "#e67e22" }}>
                  {cat === "today" ? "오늘 할일" : "다음 할일"}
                </span>
              </div>
              {cols.map(p => (
                <div key={p.id} style={{ padding: "4px 4px", margin: "0 2px", background: "#fafaf8", borderLeft: `1px solid ${p.bg}`, borderRight: `1px solid ${p.bg}`, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, padding: "0 4px" }}>• {cat === "today" ? "오늘" : "다음"} {ryanTasks[p.id]?.[cat]?.length || 0}</span>
                  {(ryanTasks[p.id]?.[cat] || []).map((task, i) => <Card key={i} task={task} onClick={() => setSelectedTodo(task)} />)}
                  <div style={{ padding: "3px 4px", fontSize: 11, color: T.textMuted, cursor: "pointer" }}>+ 추가</div>
                </div>
              ))}
            </div>
          ))}

          {/* ── 팀 섹션 ── */}
          <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
            <div onClick={() => setTeamOpen(!teamOpen)} style={{
              background: T.team.bg, padding: "7px 12px", borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, userSelect: "none",
            }}>
              <span style={{ fontSize: 11, color: T.team.sub, transform: teamOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: T.team.text }}>👥 팀</span>
              <span style={{ fontSize: 11, color: T.team.sub }}>총 {Object.keys(teamTasks).reduce((s, m) => s + memberTotal(m), 0)}건</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {Object.keys(teamTasks).map(m => (
                  <span key={m} style={{ fontSize: 11, color: T.team.sub }}>{m} <Badge>{memberTotal(m)}</Badge></span>
                ))}
              </div>
            </div>
          </div>

          {teamOpen && Object.entries(teamTasks).map(([name, data]) => {
            const isExp = expandedMember === name;
            return (
              <div key={name} style={{ display: "contents" }}>
                <div onClick={() => setExpandedMember(isExp ? null : name)} style={{
                  padding: "7px 12px", display: "flex", alignItems: "center", gap: 6,
                  cursor: "pointer", borderBottom: `1px solid ${T.border}`,
                }}>
                  <span style={{ fontSize: 9, color: "#999", transform: isExp ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#555" }}>{name}</span>
                  <Badge style={{ marginLeft: "auto" }}>{memberTotal(name)}</Badge>
                </div>
                {cols.map(p => (
                  <div key={p.id} style={{ padding: "4px", margin: "0 2px", borderBottom: `1px solid ${T.border}`, background: "#fafaf8", borderLeft: `1px solid ${p.bg}`, borderRight: `1px solid ${p.bg}` }}>
                    {!isExp ? (
                      <div onClick={() => setExpandedMember(name)} style={{
                        background: "#f0f0ed", borderRadius: 5, padding: "5px 8px",
                        textAlign: "center", fontWeight: 700, fontSize: 12, color: "#888", cursor: "pointer",
                      }}>{(data[p.id] || []).length}</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {(data[p.id] || []).map((task, i) => <Card key={i} task={task} readOnly />)}
                        {(!data[p.id] || data[p.id].length === 0) && <span style={{ fontSize: 10, color: T.textMuted, textAlign: "center", padding: 4 }}>—</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* 남은 할일 / 완료 */}
          {["남은 할일", "완료"].map((label, idx) => (
            <div key={label} style={{ display: "contents" }}>
              <div style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 5, marginTop: idx === 0 ? 4 : 0 }}>
                <span style={{ fontSize: 13 }}>{idx === 0 ? "📋" : "✅"}</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: idx === 0 ? "#6c757d" : "#28a745" }}>{label}</span>
              </div>
              {cols.map(p => (
                <div key={p.id} style={{
                  padding: "4px 6px", margin: idx === 0 ? "4px 2px 0" : "0 2px", background: "#fafaf8",
                  borderLeft: `1px solid ${p.bg}`, borderRight: `1px solid ${p.bg}`,
                  borderRadius: idx === 1 ? "0 0 8px 8px" : 0,
                }}>
                  <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>• {label} 0</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ 2. DETAIL PANEL (기존 상세패널 + 담당자/scope/강조색상/댓글) ═══
function DetailScreen() {
  const [hlColor, setHlColor] = useState("orange");
  const [comment, setComment] = useState("");
  const [catTab, setCatTab] = useState("today");

  const comments = [
    { author: "Ryan", text: "이번 주 금요일까지 완료 부탁드립니다", time: "3시간 전", bg: "#1a1a1a" },
    { author: "Ethan", text: "진행 중입니다. 목요일까지 초안 공유드릴게요", time: "1시간 전", bg: "#DD6B20" },
  ];

  return (
    <div style={{ padding: "20px 24px", display: "flex", gap: 0 }}>
      {/* 왼쪽: 매트릭스 뷰 영역 (흐리게) */}
      <div style={{ flex: 1, opacity: 0.4, pointerEvents: "none", fontSize: 13, color: T.textSub, padding: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, opacity: 0.5 }}>매트릭스 뷰</h2>
        <p>(배경 뷰 - 클릭하면 상세패널 닫힘)</p>
      </div>

      {/* 오른쪽: 상세 패널 (기존 구조 유지 + 새 필드 추가) */}
      <div style={{ width: 400, background: "#fff", borderLeft: `1px solid ${T.cardBorder}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 0, minHeight: 560, overflowY: "auto" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 18, cursor: "pointer", color: "#999" }}>✕</span>
          <Btn small style={{ background: "#E53E3E", color: "#fff", border: "none", fontSize: 11 }}>삭제</Btn>
        </div>

        {/* 제목 */}
        <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>결산공시</h2>

        {/* 기존 필드: 프로젝트 */}
        <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: "14px 12px", fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: T.textSub }}>프로젝트</span>
          <Badge bg="#FFF3E0" color="#E65100">🟠 정기주총</Badge>

          {/* 기존 필드: 카테고리 */}
          <span style={{ color: T.textSub }}>카테고리</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["오늘 할일", "다음 할일", "남은 할일"].map(c => (
              <div key={c} onClick={() => setCatTab(c)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                background: catTab === c.split(" ")[0] ? (c.includes("오늘") ? "#FFF9DB" : c.includes("다음") ? "#FFE8E8" : "#F0F0F0") : "#f8f8f6",
                border: `1px solid ${catTab === c.split(" ")[0] ? "#ddd" : T.cardBorder}`,
                fontWeight: catTab === c.split(" ")[0] ? 600 : 400,
              }}>{c.includes("오늘") ? "🔥" : c.includes("다음") ? "📌" : "📋"} {c}</div>
            ))}
          </div>

          {/* ★ 신규: 유형 (scope) */}
          <span style={{ color: T.textSub }}>유형</span>
          <ScopeLabel scope="assigned" />

          {/* ★ 신규: 담당자 */}
          <span style={{ color: T.textSub }}>담당자</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar name="R" size={22} />
            <span>Ryan</span>
            <span style={{ fontSize: 11, color: T.accent, cursor: "pointer", marginLeft: "auto", textDecoration: "underline" }}>반납</span>
          </div>

          {/* 기존 필드: 시작일 */}
          <span style={{ color: T.textSub }}>시작일</span>
          <input type="date" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: "4px 8px", fontSize: 13 }} />

          {/* 기존 필드: 마감일 */}
          <span style={{ color: T.textSub }}>마감일</span>
          <input type="date" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: "4px 8px", fontSize: 13 }} />

          {/* 기존 필드: 알람 */}
          <span style={{ color: T.textSub }}>알람</span>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: "#ccc", position: "relative", cursor: "pointer" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: 2 }} />
          </div>

          {/* 기존 필드: 상태 */}
          <span style={{ color: T.textSub }}>상태</span>
          <Btn small style={{ borderRadius: 16, fontSize: 12, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>✓ 완료 처리</Btn>

          {/* ★ 신규: 강조 색상 */}
          <span style={{ color: T.textSub }}>강조 색상</span>
          <div style={{ display: "flex", gap: 5 }}>
            <div onClick={() => setHlColor(null)} style={{
              width: 24, height: 24, borderRadius: 5, background: "#fff", border: `2px solid ${!hlColor ? "#1a1a1a" : "#ddd"}`,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: T.textMuted,
            }}>X</div>
            {Object.entries(HL).map(([k, v]) => (
              <div key={k} onClick={() => setHlColor(k)} style={{
                width: 24, height: 24, borderRadius: 5, background: v.bg, cursor: "pointer",
                border: `2px solid ${hlColor === k ? "#1a1a1a" : "transparent"}`,
              }} />
            ))}
          </div>
        </div>

        {/* 기존 필드: 노트 (아웃라이너) */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: T.textSub }}>노트</span>
            <span style={{ fontSize: 14, color: T.textMuted, cursor: "pointer" }}>≡</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: T.text }}>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ color: T.ryan.sub }}>›</span>
              <span>매출 늘었지만 인식 시점이 늦어져서 매출인식이 덜 되었고 잔고로 남겨져 있다.</span>
            </div>
            <div style={{ display: "flex", gap: 6, paddingLeft: 16 }}>
              <span style={{ color: T.textMuted }}>○</span>
              <span>신기술 선투자 했다. (3D-IC, 칩렛 등) 상장관련 비용 인식</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "#FF9800" }}>●</span>
              <span>단기순이익 늘었다.</span>
            </div>
            <div style={{ padding: "4px 0 4px 16px", fontSize: 12, color: T.textMuted, cursor: "pointer" }}>+ 추가</div>
          </div>
        </div>

        {/* ★ 신규: 댓글 */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 10 }}>
          <span style={{ fontSize: 13, color: T.textSub, marginBottom: 10, display: "block" }}>댓글 ({comments.length})</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {comments.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <Avatar name={c.author} size={24} bg={c.bg} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, marginTop: 2 }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="댓글 입력..."
              style={{ flex: 1, border: `1px solid ${T.cardBorder}`, borderRadius: 6, padding: "6px 10px", fontSize: 13, outline: "none" }} />
            <Btn primary small>등록</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ 3. TODAY VIEW (기존 프로젝트 그리드 카드 + scope 라벨 + 강조색상) ═══
function TodayScreen() {
  const todayData = [
    { project: "개별과제", color: "#4CAF50", bg: "#E8F5E9", tasks: [
      { t: "사업보고서 업데이트", scope: "assigned", h: null },
    ]},
    { project: "정기주총", color: "#FF9800", bg: "#FFF3E0", tasks: [
      { t: "안건 PPT 작성", scope: "assigned", h: "orange" },
      { t: "소집공고 - 영업개황 - 수주?", scope: "team", h: null },
      { t: "결산공시", scope: "assigned", h: null },
      { t: "전화 확인 - 본 회신 마지막 확인 필요", scope: "assigned", h: "red" },
    ]},
    { project: "BIS", color: "#2196F3", bg: "#E3F2FD", tasks: [
      { t: "제출 서류 작성", scope: "assigned", h: null },
    ]},
    { project: "ABI Korea", color: "#9C27B0", bg: "#F3E5F5", tasks: [
      { t: "Todo 스케줄링", scope: "assigned", h: "blue" },
    ]},
    { project: "일본법인/해외SCD", color: "#795548", bg: "#EFEBE9", tasks: [
      { t: "PO / 물류 / 자금 Flow 정리 x Case 별", scope: "team", h: null },
      { t: "일본법인 계약 Flow (PO) 정리", scope: "assigned", h: null },
    ]},
    { project: "C&Plus", color: "#E65100", bg: "#FFF3E0", tasks: [
      { t: "4/4 메르디앙 입주", scope: "private", h: null },
      { t: "3/23 송화캐슬 입주", scope: "private", h: null },
      { t: "벨로 블라인드 지급", scope: "private", h: null },
    ]},
  ];

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>🌤 좋은 하루 되세요, Ryan</h1>
        <span style={{ fontSize: 13, color: T.textSub }}>2026년 3월 12일 목요일</span>
        <span style={{ float: "right", fontSize: 13, color: T.textSub, cursor: "pointer" }}>전체 접기</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 900 }}>
        {todayData.map((proj, pi) => (
          <div key={pi} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${T.cardBorder}`, overflow: "hidden" }}>
            {/* 프로젝트 헤더 (기존 그대로) */}
            <div style={{ background: proj.bg, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: proj.color }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: proj.color }}>{proj.project}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Badge bg="rgba(0,0,0,0.1)" color="rgba(0,0,0,0.6)">{proj.tasks.length}</Badge>
                <span style={{ fontSize: 14, color: "#999", cursor: "pointer" }}>⋮</span>
              </div>
            </div>
            {/* 할일 목록 */}
            <div style={{ padding: "10px 16px" }}>
              {proj.tasks.map((task, ti) => {
                const hl = task.h ? HL[task.h] : null;
                return (
                  <div key={ti} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 4,
                    background: hl ? hl.bg : "transparent", color: hl ? hl.text : T.text,
                    borderRadius: 6, cursor: "pointer",
                  }}>
                    <input type="checkbox" readOnly style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14 }}>{task.t}</span>
                    {/* ★ 신규: scope 라벨 */}
                    <ScopeLabel scope={task.scope} />
                  </div>
                );
              })}
              <div style={{ padding: "6px 10px", fontSize: 12, color: T.textMuted, cursor: "pointer" }}>+ 추가</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ 4. PROJECT VIEW (기존 탭+아웃라이너 + 팀/개인 섹션) ═══
function ProjectScreen() {
  const [activeTab, setActiveTab] = useState("p2");
  const teamProjects = [
    { id: "p1", name: "개별과제", color: "#4CAF50" },
    { id: "p2", name: "정기주총", color: "#FF9800" },
    { id: "p3", name: "BIS", color: "#2196F3" },
    { id: "p4", name: "ABI Korea", color: "#9C27B0" },
    { id: "p5", name: "일본법인/해외SCD", color: "#795548" },
  ];
  const personalProjects = [
    { id: "p6", name: "C&Plus", color: "#E65100" },
  ];

  return (
    <div style={{ padding: "20px 24px", maxWidth: 800 }}>
      {/* 프로젝트 탭 (기존 스타일 유지 + 팀/개인 구분선) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        {teamProjects.map(p => (
          <div key={p.id} onClick={() => setActiveTab(p.id)} style={{
            padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: activeTab === p.id ? 700 : 400,
            background: activeTab === p.id ? "#E8F5E9" : "#f8f8f6", border: `1px solid ${activeTab === p.id ? "#c8e6c9" : T.cardBorder}`,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
            {p.name}
          </div>
        ))}
        {/* ★ 신규: 구분선 */}
        <div style={{ width: 1, height: 24, background: T.border, margin: "0 4px" }} />
        <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4 }}>개인</span>
        {personalProjects.map(p => (
          <div key={p.id} onClick={() => setActiveTab(p.id)} style={{
            padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: activeTab === p.id ? 700 : 400,
            background: activeTab === p.id ? "#FFF3E0" : "#f8f8f6", border: `1px solid ${activeTab === p.id ? "#ffcc80" : T.cardBorder}`,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
            {p.name}
          </div>
        ))}
        <div style={{ padding: "6px 10px", cursor: "pointer", color: T.textMuted, fontSize: 16 }}>⚙</div>
      </div>

      {/* 프로젝트 내용 (기존 아웃라이너 구조) */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF9800" }} />
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>정기주총</h2>
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 20 }}>↑↓ 자유 이동 · Enter 새 항목/분리 · Tab 레벨 · Alt+Shift+↑↓ 순서 이동 · Ctrl++/-/→ 프로젝트 이동</div>

        {[
          { cat: "오늘 할일", icon: "🔥", count: 4, color: "#c0392b", tasks: [
            { t: "안건 PPT 작성", scope: "assigned", assignee: "Ryan" },
            { t: "소집공고 - 영업개황 - 수주?", scope: "team", assignee: null },
            { t: "결산공시", scope: "assigned", assignee: "Ryan" },
            { t: "전화 확인 - 본 회신 마지막 확인 필요", scope: "assigned", assignee: "Ethan" },
          ]},
          { cat: "다음 할일", icon: "📌", count: 0, color: "#e67e22", tasks: [] },
          { cat: "남은 할일", icon: "📋", count: 1, color: "#6c757d", tasks: [
            { t: "감사위원회 26년 일정 반영", scope: "team", assignee: null },
          ]},
          { cat: "완료", icon: "✅", count: 1, color: "#28a745", tasks: [
            { t: "라파더스 자료 → PPT 완성", scope: "assigned", assignee: "Ash", done: true },
          ]},
        ].map((section, si) => (
          <div key={si} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
              <span>{section.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: section.color }}>{section.cat}</span>
              <Badge bg="#f0f0f0" color="#888">{section.count}</Badge>
              <span style={{ marginLeft: "auto", fontSize: 14, color: T.textMuted, cursor: "pointer" }}>≡</span>
            </div>
            {section.tasks.map((task, ti) => (
              <div key={ti} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 14,
                opacity: task.done ? 0.4 : 1, textDecoration: task.done ? "line-through" : "none",
              }}>
                <span style={{ cursor: "pointer", color: T.textMuted, fontSize: 10 }}>›</span>
                <input type="checkbox" checked={task.done || false} readOnly />
                <span style={{ flex: 1 }}>{task.t}</span>
                {/* ★ 신규: 담당자 + scope */}
                {task.assignee && <span style={{ fontSize: 11, color: T.textSub }}>{task.assignee}</span>}
                <ScopeLabel scope={task.scope} />
                {task.done && <span style={{ fontSize: 11, color: T.textMuted }}>2026-03-11</span>}
              </div>
            ))}
            <div style={{ padding: "6px 0 6px 20px", fontSize: 12, color: T.textMuted, cursor: "pointer" }}>+ 할일 추가</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ 5. NOTIFICATION PANEL ═══
function NotificationScreen() {
  const notis = [
    { icon: "✅", actor: "Ethan", msg: "'주주명부 정리'를 완료했습니다", time: "5분 전" },
    { icon: "💬", actor: "Ash", msg: "'안건 PPT 작성'에 댓글을 남겼습니다", time: "20분 전" },
    { icon: "📌", actor: "Ryan", msg: "'위임장 양식 준비'를 Ethan에게 배정했습니다", time: "1시간 전" },
    { icon: "➕", actor: "Eric", msg: "'전자투표 시스템 확인'을 생성했습니다", time: "2시간 전" },
    { icon: "📌", actor: "Ryan", msg: "'공시 서류 초안'을 Ash에게 배정했습니다", time: "3시간 전" },
    { icon: "✅", actor: "Edmond", msg: "'등기 서류 준비'를 완료했습니다", time: "어제" },
    { icon: "💬", actor: "Eric", msg: "'BIS 비율 산출'에 댓글을 남겼습니다", time: "어제" },
  ];

  return (
    <div style={{ padding: "20px 24px", display: "flex", gap: 0 }}>
      <div style={{ flex: 1, opacity: 0.35, padding: 40, textAlign: "center", color: T.textSub }}>
        (메인 뷰 영역 — 알림 패널은 오른쪽에서 슬라이드)
      </div>
      {/* 알림 패널 */}
      <div style={{ width: 360, background: "#fff", borderLeft: `1px solid ${T.cardBorder}`, display: "flex", flexDirection: "column", minHeight: 500 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🔔 알림</span>
          <span style={{ fontSize: 16, cursor: "pointer", color: T.textMuted }}>✕</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {notis.map((n, i) => (
            <div key={i} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.hover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>{n.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}><b>{n.actor}</b>이(가) {n.msg}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{n.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, textAlign: "center", fontSize: 12, color: T.textMuted }}>
          최근 30일 알림 표시
        </div>
      </div>
    </div>
  );
}

// ═══ 6. ONBOARDING ═══
function OnboardingScreen() {
  const [step, setStep] = useState(0);
  return (
    <div style={{ padding: "60px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        {step === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: "40px 32px", textAlign: "center" }}>
            <div style={{ marginBottom: 8 }}><Avatar name="R" size={48} /></div>
            <h2 style={{ margin: "12px 0 6px", fontSize: 22, fontWeight: 800 }}>Ryan Todo에 오신 걸 환영합니다</h2>
            <p style={{ color: T.textSub, fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>팀과 함께 할일을 관리하거나, 개인 할일만 사용할 수 있어요.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn primary onClick={() => setStep(1)} style={{ padding: "12px", width: "100%", fontSize: 14 }}>새 팀 만들기</Btn>
              <Btn onClick={() => setStep(2)} style={{ padding: "12px", width: "100%", fontSize: 14 }}>초대 코드로 팀 참가</Btn>
              <span onClick={() => setStep(3)} style={{ marginTop: 8, fontSize: 13, color: T.textMuted, cursor: "pointer" }}>개인 할일만 사용할게요 →</span>
            </div>
          </div>
        )}
        {step === 1 && (
          <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: "32px" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>새 팀 만들기</h3>
            <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>팀 이름</label>
            <input placeholder="예: 법무팀" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 14, marginTop: 4, marginBottom: 16, boxSizing: "border-box" }} />
            <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>팀 설명 (선택)</label>
            <input placeholder="팀에 대한 간단한 설명" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 14, marginTop: 4, marginBottom: 20, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setStep(0)} style={{ flex: 1 }}>뒤로</Btn>
              <Btn primary style={{ flex: 1 }}>팀 생성</Btn>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: "32px" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>팀에 참가하기</h3>
            <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>초대 코드 또는 링크</label>
            <input placeholder="초대 코드를 입력하세요" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 14, marginTop: 4, marginBottom: 20, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setStep(0)} style={{ flex: 1 }}>뒤로</Btn>
              <Btn primary style={{ flex: 1 }}>참가 요청</Btn>
            </div>
          </div>
        )}
        {step === 3 && (
          <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${T.cardBorder}`, padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>준비 완료!</h3>
            <p style={{ color: T.textSub, fontSize: 14, margin: "0 0 20px" }}>개인 할일로 시작합니다. 나중에 언제든 팀을 만들 수 있어요.</p>
            <Btn primary style={{ width: "100%" }}>시작하기</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ 7. INVITE / JOIN ═══
function InviteScreen() {
  const [tab, setTab] = useState("invite");
  return (
    <div style={{ padding: "20px 24px", maxWidth: 500 }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800 }}>팀 초대 / 가입</h2>
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `2px solid ${T.border}` }}>
        {[["invite","팀원 초대"],["pending","승인 대기"],["join","가입 화면(수신자)"]].map(([id, l]) => (
          <div key={id} onClick={() => setTab(id)} style={{
            padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            color: tab === id ? T.accent : T.textSub,
            borderBottom: tab === id ? `2px solid ${T.accent}` : "2px solid transparent", marginBottom: -2,
          }}>{l}</div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${T.cardBorder}`, padding: 20 }}>
        {tab === "invite" && (<>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>이메일로 초대</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 16 }}>
            <input placeholder="email@company.com" style={{ flex: 1, padding: "8px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 13 }} />
            <Btn primary small>초대 발송</Btn>
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>초대 링크 공유</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input readOnly value="https://ryantodo.app/invite/abc123" style={{ flex: 1, padding: "8px 12px", border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 12, color: T.textSub, background: "#fafaf8" }} />
              <Btn small>복사</Btn>
            </div>
          </div>
        </>)}
        {tab === "pending" && (<>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, marginBottom: 12 }}>승인 대기 (1명)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
            <Avatar name="?" size={32} bg="#ccc" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>newbie@company.com</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>2시간 전</div>
            </div>
            <Btn primary small>승인</Btn>
            <Btn small style={{ color: "#c0392b" }}>거절</Btn>
          </div>
          <div style={{ marginTop: 14, padding: 10, background: "#fafaf8", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.textSub }}>가입 승인 모드</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#38A169" }}>수동 승인 ON</span>
          </div>
        </>)}
        {tab === "join" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>법무팀에 초대되었습니다</h3>
            <p style={{ fontSize: 13, color: T.textSub, margin: "0 0 20px" }}>초대한 사람: Ryan · 팀원 5명</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn style={{ minWidth: 90 }}>거절</Btn>
              <Btn primary style={{ minWidth: 90 }}>참가하기</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ 8. TEAM SETTINGS ═══
function TeamSettingsScreen() {
  const members = [
    { name: "Ryan", role: "owner" }, { name: "Ethan", role: "member" },
    { name: "Ash", role: "member" }, { name: "Eric", role: "member" }, { name: "Edmond", role: "member" },
  ];
  return (
    <div style={{ padding: "20px 24px", maxWidth: 520 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>⚙ 팀 설정</h2>
      {/* 팀 정보 */}
      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${T.cardBorder}`, padding: 20, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 10, display: "block" }}>팀 정보</span>
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: "10px 12px", fontSize: 13 }}>
          <span style={{ color: T.textSub }}>팀 이름</span>
          <input defaultValue="법무팀" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: "6px 10px", fontSize: 13 }} />
          <span style={{ color: T.textSub }}>설명</span>
          <input defaultValue="법무/컴플라이언스 업무" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: "6px 10px", fontSize: 13 }} />
        </div>
      </div>
      {/* 팀원 */}
      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${T.cardBorder}`, padding: 20, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>팀원 ({members.length}명)</span>
          <Btn primary small>+ 초대</Btn>
        </div>
        {members.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < members.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <Avatar name={m.name} size={30} bg={m.role === "owner" ? "#1a1a1a" : "#888"} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{m.name}</span>
            <Badge bg={m.role === "owner" ? "#E8F0FE" : "#f0f0f0"} color={m.role === "owner" ? T.accent : "#666"}>{m.role === "owner" ? "팀장" : "팀원"}</Badge>
            {m.role !== "owner" && <span style={{ fontSize: 11, color: "#c0392b", cursor: "pointer" }}>내보내기</span>}
          </div>
        ))}
      </div>
      {/* 설정 */}
      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${T.cardBorder}`, padding: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 12, display: "block" }}>설정</span>
        {[["가입 승인 모드", "초대 수락 시 팀장 승인 필요"], ["알림 보존 기간", "설정 기간 이후 자동 삭제"]].map(([t, d], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i === 0 ? `1px solid ${T.border}` : "none" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 11, color: T.textMuted }}>{d}</div></div>
            {i === 0 ? (
              <div style={{ width: 36, height: 20, borderRadius: 10, background: "#ccc", position: "relative", cursor: "pointer" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: 2 }} />
              </div>
            ) : (
              <select style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 4, padding: "4px 8px", fontSize: 12 }}>
                <option>7일</option><option>30일</option><option>90일</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ 9. ROW CONFIG (팀원은 팀 설정에서 자동 연동) ═══
function RowConfigScreen() {
  return (
    <div style={{ padding: "20px 24px", maxWidth: 480 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>행 구성 관리</h2>
        <span style={{ fontSize: 16, cursor: "pointer", color: T.textMuted }}>✕</span>
      </div>
      <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16, lineHeight: 1.6 }}>
        매트릭스 뷰의 왼쪽 행 구조를 설정합니다. 팀원 목록은 팀 설정에서 자동으로 가져옵니다.
      </div>

      {[
        { icon: "👤", label: "Ryan", children: [
          { label: "오늘 할일", type: "태스크", editable: true },
          { label: "다음 할일", type: "태스크", editable: true },
        ], editable: true },
        { icon: "👥", label: "팀", children: [
          { label: "Ethan", type: "팀원 (자동)", editable: false },
          { label: "Ash", type: "팀원 (자동)", editable: false },
          { label: "Eric", type: "팀원 (자동)", editable: false },
          { label: "Edmond", type: "팀원 (자동)", editable: false },
        ], editable: false, autoNote: "팀 설정에서 관리" },
        { icon: "📋", label: "남은 할일", children: [], editable: true },
        { icon: "✅", label: "완료", children: [], editable: true },
      ].map((section, si) => (
        <div key={si} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${T.cardBorder}`, padding: "10px 14px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ cursor: "grab", color: T.textMuted, fontSize: 13 }}>☰</span>
            <span style={{ fontSize: 14 }}>{section.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{section.label}</span>
            {section.autoNote && <span style={{ fontSize: 10, color: T.accent }}>{section.autoNote}</span>}
            {section.editable && <>
              <span style={{ fontSize: 11, color: T.accent, cursor: "pointer" }}>이름변경</span>
              <span style={{ fontSize: 11, color: "#c0392b", cursor: "pointer", marginLeft: 6 }}>삭제</span>
            </>}
          </div>
          {section.children.length > 0 && (
            <div style={{ paddingLeft: 24, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {section.children.map((child, ci) => (
                <div key={ci} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "#fafaf8", borderRadius: 6, border: `1px solid ${T.border}` }}>
                  <span style={{ cursor: child.editable !== false ? "grab" : "default", color: T.textMuted, fontSize: 11 }}>☰</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{child.label}</span>
                  <Badge bg={child.editable === false ? "#E3F2FD" : "#f0f0f0"} color={child.editable === false ? "#1565C0" : "#888"}>{child.type}</Badge>
                  {child.editable !== false && <>
                    <span style={{ fontSize: 10, color: T.accent, cursor: "pointer" }}>이름변경</span>
                    <span style={{ fontSize: 10, color: "#c0392b", cursor: "pointer" }}>삭제</span>
                  </>}
                </div>
              ))}
              {section.children[0]?.editable !== false && (
                <div style={{ padding: "4px 10px", fontSize: 12, color: T.accent, cursor: "pointer" }}>+ 항목 추가</div>
              )}
            </div>
          )}
        </div>
      ))}

      <div style={{ padding: "10px 14px", textAlign: "center", border: `1px dashed ${T.cardBorder}`, borderRadius: 8, fontSize: 13, color: T.accent, cursor: "pointer", marginTop: 4 }}>
        + 섹션 추가
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: T.textMuted }}>☰ = 드래그 핸들 · 팀원 목록은 "팀 설정 → 팀원 관리"에서 자동 반영됩니다.</div>
    </div>
  );
}

// ═══ MAIN APP ═══
export default function App() {
  const [screen, setScreen] = useState("matrix");

  const map = {
    matrix: MatrixScreen, detail: DetailScreen, today: TodayScreen,
    project: ProjectScreen, notification: NotificationScreen,
    onboarding: OnboardingScreen, invite: InviteScreen,
    teamSettings: TeamSettingsScreen, rowConfig: RowConfigScreen,
  };
  const Comp = map[screen];

  return (
    <div style={{ fontFamily: "'Apple SD Gothic Neo', 'Pretendard', -apple-system, sans-serif", background: T.bg, minHeight: "100vh", color: T.text }}>
      {/* 시안 탭 네비게이션 */}
      <div style={{ background: "#1a1a1a", padding: "6px 16px", display: "flex", gap: 0, overflowX: "auto" }}>
        {SCREENS.map(s => (
          <div key={s.id} onClick={() => setScreen(s.id)} style={{
            padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: screen === s.id ? 700 : 400,
            color: screen === s.id ? "#fff" : "#888", borderBottom: screen === s.id ? "2px solid #fff" : "2px solid transparent",
            whiteSpace: "nowrap",
          }}>{s.icon} {s.label}</div>
        ))}
      </div>

      {/* 앱 네비 (실제 앱처럼) */}
      <TopNav active={screen === "today" ? "today" : screen === "matrix" || screen === "detail" ? "matrix" : screen === "project" ? "project" : screen === "notification" ? "matrix" : ""} onSelect={s => {}} showNotiBadge />

      <Comp />
    </div>
  );
}
