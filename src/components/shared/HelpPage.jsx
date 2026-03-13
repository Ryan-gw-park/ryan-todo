import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  { id: 'start', title: '🚀 시작하기' },
  { id: 'matrix', title: '📊 매트릭스 뷰' },
  { id: 'tasks', title: '✅ 할일 관리' },
  { id: 'projects', title: '📁 프로젝트' },
  { id: 'team', title: '👥 팀 협업' },
  { id: 'permissions', title: '🔐 권한 구조' },
  { id: 'shortcuts', title: '⌨️ 키보드 단축키' },
  { id: 'etc', title: '💡 기타 기능' },
]

/* ── style helpers ── */
const H2 = ({ id, children }) => (
  <h2 id={id} style={{ fontSize: 20, fontWeight: 700, color: '#37352f', marginTop: 48, marginBottom: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
    {children}
  </h2>
)
const H3 = ({ children }) => (
  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#37352f', marginTop: 24, marginBottom: 8 }}>{children}</h3>
)
const P = ({ children }) => (
  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#555', marginBottom: 12 }}>{children}</p>
)
const Table = ({ headers, rows }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
    <thead>
      <tr>{headers.map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #e8e8e8', color: '#37352f', fontWeight: 600 }}>{h}</th>)}</tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
          {row.map((cell, j) => <td key={j} style={{ padding: '8px 12px', color: '#555' }}>{cell}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
)
const Kbd = ({ children }) => (
  <kbd style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', background: '#f9f9f9', fontSize: 12, fontFamily: 'monospace' }}>{children}</kbd>
)
const Tip = ({ children }) => (
  <div style={{ padding: '12px 16px', background: '#fef9e7', borderRadius: 8, borderLeft: '3px solid #f0c36d', fontSize: 13, color: '#6b5900', marginBottom: 16 }}>
    💡 {children}
  </div>
)

/* ── sections ── */
function SectionStart() {
  return (
    <>
      <H2 id="start">🚀 시작하기</H2>

      <H3>팀 만들기</H3>
      <P>첫 로그인 후 온보딩 화면에서 "새 팀 만들기"를 선택하세요. 팀 이름과 설명을 입력하면 팀이 생성되고, 자동으로 팀장이 됩니다.</P>

      <H3>팀원 초대</H3>
      <P>팀 설정(⚙) → 초대 링크 복사 또는 이메일로 초대할 수 있습니다. 초대받은 사람은 링크를 클릭하면 팀에 참가됩니다.</P>

      <H3>팀 전환</H3>
      <P>상단 네비게이션의 팀 이름 드롭다운에서 다른 팀으로 전환하거나 "개인 모드"로 전환할 수 있습니다. 개인 모드에서는 팀 기능 없이 나만의 할일을 관리합니다.</P>

      <H3>개인 모드</H3>
      <P>팀에 참가하지 않아도 개인 모드로 모든 기능을 사용할 수 있습니다. 온보딩에서 "건너뛰기"를 선택하면 바로 개인 모드로 시작됩니다.</P>
    </>
  )
}

function SectionMatrix() {
  return (
    <>
      <H2 id="matrix">📊 매트릭스 뷰</H2>

      <P>매트릭스 뷰는 프로젝트(열) × 카테고리(행)로 할일을 한눈에 보여주는 핵심 뷰입니다.</P>

      <H3>3개 영역</H3>
      <Table
        headers={['영역', '내용']}
        rows={[
          ['내 이름 (예: Ryan Park)', '나에게 배정된 할일. 오늘 할일 / 다음 할일로 구분'],
          ['팀 이름 (예: SCD팀)', '팀원별 할일 요약. 클릭하면 펼쳐서 상세 확인 가능'],
          ['남은 할일 · 완료', '아직 배정되지 않은 팀 할일 + 완료된 할일'],
        ]}
      />

      <H3>프로젝트 필터</H3>
      <P>오른쪽 상단의 [전체 | 팀 | 개인] 필터로 표시할 프로젝트를 전환할 수 있습니다. 이 필터는 매트릭스뿐 아니라 오늘할일, 프로젝트, 타임라인 뷰에서도 동일하게 적용됩니다.</P>

      <H3>드래그 앤 드롭</H3>
      <P>할일 카드를 드래그하여 다른 프로젝트나 카테고리로 이동할 수 있습니다.</P>
      <Table
        headers={['동작', '결과']}
        rows={[
          ['남은 할일 → 내 오늘/다음', '나에게 자동 배정'],
          ['내 카드 → 남은 할일', '배정 해제 (미배정 팀 할일로)'],
          ['내 카드 → 다른 팀원 행', '해당 팀원에게 배정 + "다음 할일"로 배치'],
          ['같은 셀 안에서 드래그', '순서 변경'],
        ]}
      />
      <Tip>카드를 다른 팀원에게 드래그하면 자동으로 "다음 할일"에 배치됩니다. 상대방이 직접 "오늘 할일"로 올릴지 결정할 수 있습니다.</Tip>

      <H3>행 구성 / 프로젝트 관리</H3>
      <P>"⚙ 뷰 관리" 버튼을 클릭하면 행 구성(순서 변경, 섹션 접기/펼치기)과 프로젝트 관리(추가/수정/삭제)를 할 수 있습니다.</P>
    </>
  )
}

function SectionTasks() {
  return (
    <>
      <H2 id="tasks">✅ 할일 관리</H2>

      <H3>할일 생성</H3>
      <P>각 프로젝트 셀의 "+ 추가" 버튼을 클릭하거나, 상단의 "+ 새 할일" 버튼으로 생성할 수 있습니다. 내 섹션(오늘/다음)에서 생성하면 자동으로 나에게 배정됩니다.</P>

      <H3>할일 상세</H3>
      <P>카드를 클릭하면 오른쪽에 상세 패널이 열립니다. 여기서 수정할 수 있는 항목:</P>
      <Table
        headers={['항목', '설명']}
        rows={[
          ['제목', '할일 이름 수정'],
          ['카테고리', '오늘 할일 / 다음 할일 / 남은 할일 전환'],
          ['담당자', '팀원에게 배정 또는 배정 해제'],
          ['시작일 / 마감일', '날짜 설정 (타임라인에 반영)'],
          ['알람', '설정 시간에 브라우저 알림'],
          ['강조 색상', '카드에 색상 강조 (개인별 독립 설정)'],
          ['노트', '아웃라이너 형태의 메모 (들여쓰기, 접기/펼치기)'],
          ['댓글', '팀 할일에 댓글 작성 (팀 모드일 때만)'],
        ]}
      />

      <H3>완료 / 삭제</H3>
      <P>카드 왼쪽 체크박스를 클릭하면 완료 처리됩니다. 완료 취소는 완료 영역에서 다시 클릭. 삭제는 상세 패널의 "삭제" 버튼으로 가능합니다.</P>
    </>
  )
}

function SectionProjects() {
  return (
    <>
      <H2 id="projects">📁 프로젝트</H2>

      <H3>팀 프로젝트 vs 개인 프로젝트</H3>
      <P>팀 모드에서 프로젝트를 생성할 때 "팀 프로젝트" 또는 "개인 프로젝트"를 선택할 수 있습니다.</P>
      <Table
        headers={['구분', '팀 프로젝트', '개인 프로젝트']}
        rows={[
          ['조회', '팀원 전체', '나만'],
          ['할일 배정', '가능', '불가 (개인 할일)'],
          ['삭제', '팀장만', '본인만'],
          ['생성 후 소속 변경', '불가', '불가'],
        ]}
      />
      <Tip>프로젝트 소속(팀/개인)은 생성 후 변경할 수 없습니다. 신중하게 선택하세요.</Tip>

      <H3>프로젝트 관리</H3>
      <P>매트릭스 뷰의 "⚙ 뷰 관리" → 프로젝트 탭에서 추가/수정/삭제/순서 변경이 가능합니다.</P>

      <H3>프로젝트 뷰</H3>
      <P>프로젝트 탭에서는 선택한 프로젝트의 할일을 아웃라이너 형태로 볼 수 있습니다. 카테고리별로 구분되며 드래그로 순서 변경이 가능합니다.</P>
    </>
  )
}

function SectionTeam() {
  return (
    <>
      <H2 id="team">👥 팀 협업</H2>

      <H3>할일 배정</H3>
      <P>팀 할일을 특정 팀원에게 배정할 수 있습니다. 배정 방법:</P>
      <Table
        headers={['방법', '동작']}
        rows={[
          ['상세 패널 → 담당자 드롭다운', '팀원 선택하여 배정'],
          ['카드를 내 섹션으로 DnD', '나에게 자동 배정'],
          ['카드를 다른 팀원 행으로 DnD', '해당 팀원에게 배정'],
        ]}
      />

      <H3>댓글</H3>
      <P>팀 할일(개인 할일 제외)의 상세 패널 하단에서 댓글을 작성할 수 있습니다. 시간순으로 표시되며, 본인 댓글은 수정/삭제 가능합니다. 팀장은 모든 댓글을 삭제할 수 있습니다.</P>

      <H3>알림</H3>
      <P>상단의 🔔 아이콘을 클릭하면 알림 패널이 열립니다. 다음 이벤트가 자동으로 알림됩니다:</P>
      <Table
        headers={['이벤트', '알림 내용']}
        rows={[
          ['할일 생성', '"OOO이(가) xxx을(를) 생성했습니다"'],
          ['할일 배정', '"OOO이(가) xxx을(를) OOO에게 배정했습니다"'],
          ['할일 완료', '"OOO이(가) xxx을(를) 완료했습니다"'],
          ['할일 삭제', '"OOO이(가) xxx을(를) 삭제했습니다"'],
          ['댓글 작성', '"OOO이(가) xxx에 댓글을 남겼습니다"'],
        ]}
      />
      <P>알림은 최근 30일간 보관되며, 알림을 클릭하면 해당 할일의 상세 패널이 열립니다.</P>

      <H3>실시간 동기화</H3>
      <P>팀원의 변경사항은 10초 이내에 자동 반영됩니다. 탭을 비활성화했다가 돌아오면 즉시 최신 상태로 갱신됩니다.</P>
    </>
  )
}

function SectionPermissions() {
  return (
    <>
      <H2 id="permissions">🔐 권한 구조</H2>

      <P>팀에는 두 가지 역할이 있습니다: 팀장(Owner)과 팀원(Member).</P>

      <H3>팀장 vs 팀원</H3>
      <Table
        headers={['행동', '팀장', '팀원']}
        rows={[
          ['팀 설정 변경 (이름, 설명)', '✅', '❌'],
          ['팀원 초대 / 내보내기', '✅', '❌'],
          ['팀장 권한 부여 / 해제', '✅', '❌'],
          ['팀 프로젝트 삭제', '✅', '❌'],
          ['타인 할일 수정 (제목, 노트 등)', '✅', '❌'],
          ['타인 할일 삭제', '✅', '❌'],
          ['타인 할일 DnD 이동', '✅', '❌'],
          ['다른 팀원에게 배정', '✅', '✅'],
          ['내 할일 수정 / 삭제', '✅', '✅'],
          ['프로젝트 생성', '✅', '✅'],
          ['개인 프로젝트 삭제', '✅ (본인)', '✅ (본인)'],
          ['댓글 작성', '✅', '✅'],
          ['타인 댓글 삭제', '✅', '❌'],
        ]}
      />
      <Tip>팀장은 최소 1명이 유지됩니다. 마지막 팀장은 권한을 해제할 수 없습니다. 팀장은 여러 명 가능합니다.</Tip>
    </>
  )
}

function SectionShortcuts() {
  return (
    <>
      <H2 id="shortcuts">⌨️ 키보드 단축키</H2>

      <Table
        headers={['단축키', '동작']}
        rows={[
          [<><Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>←</Kbd> / <Kbd>→</Kbd></>, '이전 / 다음 뷰로 전환'],
          [<Kbd>Esc</Kbd>, '상세 패널 닫기'],
        ]}
      />
      <Tip>단축키는 데스크탑에서만 동작합니다.</Tip>
    </>
  )
}

function SectionEtc() {
  return (
    <>
      <H2 id="etc">💡 기타 기능</H2>

      <H3>타임라인 뷰</H3>
      <P>시작일과 마감일이 설정된 할일을 간트 차트 형태로 볼 수 있습니다. 월간/분기/연간 단위로 전환 가능합니다.</P>

      <H3>노트</H3>
      <P>할일과 별개로 자유롭게 메모를 작성할 수 있는 공간입니다. 색상 카드로 구분되며 개인 전용입니다.</P>

      <H3>다크모드</H3>
      <P>상단 네비게이션의 ☀/🌙 아이콘을 클릭하여 다크모드를 전환할 수 있습니다.</P>

      <H3>PWA 설치</H3>
      <P>모바일 브라우저에서 "홈 화면에 추가"를 하면 네이티브 앱처럼 사용할 수 있습니다. 알람과 Push 알림도 지원됩니다.</P>

      <H3>알람</H3>
      <P>할일에 알람을 설정하면 지정된 시간에 브라우저 알림이 표시됩니다. 10분 후 다시 알림(스누즈) 기능도 있습니다. 반복 알람(매일/매주)도 설정 가능합니다.</P>
    </>
  )
}

/* ── main component ── */
export default function HelpPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('start')

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* 상단 바 */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', fontSize: 18,
          cursor: 'pointer', color: '#666', padding: '2px 6px',
        }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#37352f', margin: 0 }}>📖 사용법</h1>
      </div>

      {/* 본문: 좌측 목차 + 우측 내용 */}
      <div style={{
        display: 'flex', maxWidth: 960, margin: '0 auto', padding: '24px',
        gap: 32,
      }}>
        {/* 좌측 목차 (데스크탑) */}
        <nav className="help-toc" style={{
          width: 200, flexShrink: 0, position: 'sticky', top: 80,
          alignSelf: 'flex-start',
        }}>
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => { e.preventDefault(); setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{
                display: 'block', padding: '8px 12px', borderRadius: 6,
                fontSize: 13, color: activeSection === s.id ? '#37352f' : '#999',
                fontWeight: activeSection === s.id ? 600 : 400,
                background: activeSection === s.id ? '#f5f3ef' : 'transparent',
                textDecoration: 'none', cursor: 'pointer',
                marginBottom: 2, transition: 'all 0.15s',
              }}
            >{s.title}</a>
          ))}
        </nav>

        {/* 우측 내용 */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <SectionStart />
          <SectionMatrix />
          <SectionTasks />
          <SectionProjects />
          <SectionTeam />
          <SectionPermissions />
          <SectionShortcuts />
          <SectionEtc />
        </main>
      </div>
    </div>
  )
}
