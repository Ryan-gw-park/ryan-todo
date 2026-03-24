# 사이드바 상단 재설계 + 프로필 이니셜 수정

> 모든 항목을 이번에 완료. 완료 후 `git push origin main` 실행.

---

## 변경 1: 사이드바 상단 — 로고를 팀 선택기로 교체

### 현재 상태
```
R  Ryan's Todo
S  SCD팀 ∨         ← 별도 버튼, 어색함
```

### 변경 후
```
[favicon]  SCD팀  ∨     ← 파비콘 이미지 + 팀명 + 드롭다운
─────────────────────
글로벌 뷰
  📋 오늘 할일
  ...
```

### 수정 대상
```bash
cat src/components/layout/Sidebar.jsx
```

### 수정 내용

**1-1. 기존 로고 영역 + TeamSwitcher 버튼을 제거하고, 통합 팀 선택기로 교체:**

기존 코드에서 아래 두 요소를 찾아라:
- "Ryan's Todo" 로고/텍스트 영역
- TeamSwitcher 컴포넌트 또는 "SCD팀 ∨" 버튼

이 두 요소를 **하나의 팀 선택기 블록**으로 교체:

```jsx
{/* 사이드바 최상단 — 팀 선택기 */}
<div
  onClick={handleTeamSwitcherClick}  // 기존 TeamSwitcher 열기 로직
  style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
    marginBottom: 4,
  }}
  onMouseEnter={e => e.currentTarget.style.background = '#f6f5f0'}
  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
>
  {/* 파비콘 이미지 사용 */}
  <img
    src="/favicon.svg"
    alt=""
    style={{ width: 28, height: 28, borderRadius: 8 }}
    onError={e => {
      // fallback: 파비콘 로드 실패 시 텍스트 이니셜
      e.currentTarget.style.display = 'none'
      e.currentTarget.nextSibling.style.display = 'flex'
    }}
  />
  <div style={{
    width: 28, height: 28, borderRadius: 8,
    background: '#1D9E75', display: 'none',
    alignItems: 'center', justifyContent: 'center',
    color: 'white', fontSize: 12, fontWeight: 500,
  }}>
    R
  </div>

  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 14, fontWeight: 500, color: '#2C2C2A' }}>
      {currentTeamId ? teamName : '개인 모드'}
    </div>
  </div>

  {/* 드롭다운 화살표 */}
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
    <path d="M3 5l3 3 3-3" stroke="#a09f99" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</div>
```

**1-2. 파비콘 경로 확인:**

```bash
# 파비콘 파일 위치 찾기
find public/ -name "favicon*" -o -name "*.ico" -o -name "logo*" | head -10
ls -la public/favicon* 2>/dev/null
ls -la public/*.svg 2>/dev/null
ls -la public/*.png 2>/dev/null
```

파비콘이 `public/favicon.svg`이면 `/favicon.svg`, `public/favicon.png`이면 `/favicon.png`으로 경로 설정.
`public/favicon.ico`만 있으면 `/favicon.ico` 사용 (img 태그로 표시 가능).

다른 위치에 있으면 해당 경로로 수정하라. `src/assets/` 안에 있으면 import 방식 사용:

```javascript
import faviconImg from '../../assets/favicon.png'  // 경로 맞춰서
// ...
<img src={faviconImg} ... />
```

**1-3. teamName 가져오기:**

```bash
# 팀 이름을 어떻게 가져오는지 확인
grep -n "teamName\|team.*name\|myTeams\|currentTeam" src/components/layout/Sidebar.jsx | head -10
grep -n "teamName\|team.*name\|myTeams" src/hooks/useStore.js | head -10
```

현재 TeamSwitcher에서 팀 이름을 가져오는 방식을 확인하고 동일하게 사용:

```javascript
// 예시 — 실제 store 구조에 맞춰 수정
const myTeams = useStore(s => s.myTeams)
const currentTeamId = useStore(s => s.currentTeamId)
const teamName = myTeams.find(t => t.id === currentTeamId)?.name || '개인 모드'
```

**1-4. TeamSwitcher 클릭 핸들러:**

기존 TeamSwitcher 컴포넌트를 모달/드롭다운으로 열던 방식을 그대로 유지하라.
TeamSwitcher 컴포넌트 자체는 삭제하지 않고, 트리거(열기 버튼)만 교체한다.

```bash
grep -n "TeamSwitcher\|teamSwitcher\|showTeamSwitcher\|toggleTeamSwitcher" src/components/layout/Sidebar.jsx | head -10
```

기존에 `<TeamSwitcher />` 컴포넌트가 자체 버튼을 포함하고 있었다면, 이제 버튼은 위의 통합 블록이 대신하고 TeamSwitcher는 드롭다운/모달 부분만 렌더링하도록 조정하라.

만약 TeamSwitcher가 독립적인 드롭다운 컴포넌트라면:

```jsx
const [showTeamSwitcher, setShowTeamSwitcher] = useState(false)

// 통합 블록의 onClick
function handleTeamSwitcherClick() {
  setShowTeamSwitcher(!showTeamSwitcher)
}

// TeamSwitcher 드롭다운 (통합 블록 바로 아래에)
{showTeamSwitcher && <TeamSwitcher onClose={() => setShowTeamSwitcher(false)} />}
```

**1-5. 구분선 추가:**

팀 선택기 아래, 글로벌 뷰 목록 위에 구분선:

```jsx
<div style={{ height: 1, background: '#f0efe8', margin: '8px 0 12px' }} />
```

---

## 변경 2: 프로필 이니셜 — 영문 이름 첫 글자만 사용

### 현재 문제
프로필 아이콘에 "RY" 같이 2글자가 표시되는 경우가 있다. 모든 사용자의 이니셜은 영문 이름 첫 번째 글자 1개만 사용해야 한다.

### 수정 대상

```bash
# 이니셜 생성 로직 찾기
grep -rn "initial\|charAt\|substring\|slice.*0.*1\|split.*map\|\.name\[0\]\|avatar.*text\|getInitial" src/ --include="*.jsx" --include="*.js" | grep -iv "node_modules\|\.css" | head -20

# 프로필 아이콘/아바타 컴포넌트 찾기
grep -rn "avatar\|Avatar\|initials\|profileIcon\|userIcon" src/components/ --include="*.jsx" -l | head -10
```

### 수정 방향

이니셜을 생성하는 모든 곳을 찾아서 **첫 글자 1개만** 사용하도록 변경:

```javascript
// ❌ 현재 (2글자 이니셜)
const initials = name.split(' ').map(n => n[0]).join('').toUpperCase()  // "Ryan Park" → "RP"
// 또는
const initials = name.substring(0, 2).toUpperCase()  // "Ryan" → "RY"

// ✅ 변경 후 (1글자)
const initial = (name || '?')[0].toUpperCase()  // "Ryan Park" → "R"
```

**전수 확인 — 이니셜이 사용되는 모든 위치:**

```bash
# 아바타/프로필 원형 표시 위치 찾기
grep -rn "borderRadius.*50%\|border-radius.*50%\|rounded-full" src/components/ --include="*.jsx" | grep -i "profile\|avatar\|user\|member\|assignee" | head -20
```

각 위치를 확인하고:
1. 이니셜 계산 로직이 있으면 1글자로 변경
2. 공통 유틸 함수가 있으면 그것만 수정하면 전체 반영됨
3. 각 컴포넌트에서 인라인으로 계산하고 있으면 각각 수정

**사이드바 하단 프로필 영역도 수정:**

```bash
grep -n "Ryan\|userName\|profileIcon\|avatar" src/components/layout/Sidebar.jsx | head -10
```

사이드바 하단 프로필에서도 1글자 이니셜 사용:

```jsx
{/* 프로필 아바타 */}
<div style={{
  width: 28, height: 28, borderRadius: '50%',
  background: '#1D9E75', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  color: 'white', fontSize: 12, fontWeight: 500,
}}>
  {(userName || '?')[0].toUpperCase()}
</div>
```

**TeamMatrixView, TodayView, AllTasksView 등에서 배정자 아바타도 확인:**

```bash
grep -rn "assignee.*avatar\|member.*avatar\|initial" src/components/ --include="*.jsx" | head -15
```

모든 곳에서 동일한 1글자 이니셜 규칙을 적용하라.

---

## 변경 3: 사이드바 상단 라운드 박스에 파비콘 이미지 사용

변경 1에서 이미 포함했지만, 추가 확인 사항:

### 파비콘 파일 확인

```bash
# 모든 가능한 파비콘/로고 파일 찾기
find . -name "favicon*" -o -name "logo*" -o -name "icon*" | grep -v node_modules | grep -v .git | head -20

# HTML에서 파비콘 참조 확인
grep -n "favicon\|icon.*rel\|shortcut" index.html public/index.html 2>/dev/null | head -5
```

### 이미지 형식별 처리

**SVG인 경우:**
```jsx
<img src="/favicon.svg" alt="" style={{ width: 28, height: 28, borderRadius: 8 }} />
```

**PNG/ICO인 경우:**
```jsx
<img src="/favicon.png" alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
```

**여러 크기가 있으면:** 가장 작은 것 (32x32 또는 64x64) 사용. 192x192 같은 큰 것은 불필요.

**src/assets에 별도 로고 이미지가 있으면:**
```bash
find src/assets -name "*.png" -o -name "*.svg" -o -name "*.ico" | head -10
```

있으면 import 방식 사용:
```javascript
import appIcon from '../../assets/logo.png'  // 실제 경로
```

---

## 검증 체크리스트

### 사이드바 상단
- [ ] "Ryan's Todo" 텍스트 제거됨
- [ ] 별도 "S SCD팀 ∨" 버튼 제거됨
- [ ] 파비콘 이미지 + "SCD팀" + ∨ 화살표가 하나의 블록으로 표시
- [ ] 클릭 시 팀 선택 드롭다운/모달 정상 열림
- [ ] 팀 전환 정상 동작
- [ ] 개인 모드 전환 시 "개인 모드" 텍스트 표시
- [ ] 파비콘 이미지가 28x28 라운드 박스로 표시
- [ ] 파비콘 로드 실패 시 텍스트 이니셜 폴백

### 이니셜
- [ ] 사이드바 하단 프로필: 1글자 (R)
- [ ] 매트릭스 뷰 배정자 아바타: 1글자
- [ ] DetailPanel 담당자/생성자 아바타 (있으면): 1글자
- [ ] TeamSwitcher 멤버 목록 아바타 (있으면): 1글자
- [ ] 2글자 이니셜이 표시되는 곳이 없음

### 구분선 + 레이아웃
- [ ] 팀 선택기 아래 구분선 존재
- [ ] 글로벌 뷰 목록 정상 표시
- [ ] 팀/개인 프로젝트 목록 정상 표시
- [ ] 사이드바 접기/펼치기 정상 동작
- [ ] 프로젝트 클릭 → ProjectLayer 진입 정상

### 회귀 검증
- [ ] 모든 뷰 정상 (TodayView, MatrixView, ProjectView, TimelineView, MemoryView)
- [ ] 개인 모드 전체 정상
- [ ] `npm run build` 성공

---

## 주의사항

- TeamSwitcher 컴포넌트 자체는 삭제하지 않음 — 트리거만 교체
- 파비콘 경로는 실제 프로젝트의 파일 위치를 확인한 후 설정
- 이니셜 변경은 공통 유틸이 있으면 거기만, 없으면 모든 사용처를 각각 수정
- 기존 뷰 컴포넌트 내부 수정 금지 (이니셜 유틸은 예외)
- 완료 후 `git push origin main` 실행
