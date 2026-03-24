# Loop-27 핫픽스: 초대 페이지 로딩 1분+ 문제

## 증상

`/invite/{code}` 접속 시 InviteAccept 화면이 뜨기까지 1분 이상 소요.

## 원인 (추정)

App.jsx의 렌더 흐름에서 InviteAccept를 표시하는 Step 3.5에 도달하기 전에 무거운 초기화 체인을 모두 기다림:

```
Step 2: snapshotRestored 체크 → 스냅샷 없으면 대기?
Step 3: authLoading → LoadingSpinner 표시
         └── 내부: getSession() → initTeamState() → loadAll() 직렬 실행
Step 3.5: !session && /invite/* → InviteAccept ← 여기 도달하려면 위가 다 끝나야 함
```

초대 페이지는 session 존재 여부만 알면 되는데, 팀 상태 초기화와 전체 데이터 로딩까지 기다리고 있다.

## 진단 — 먼저 확인할 것

### 1. 실제 병목 확인

App.jsx에서 Step 3.5 이전의 각 단계에 타이밍 로그를 추가하여 어디서 시간이 소모되는지 확인:

```javascript
// App.jsx 렌더 함수 상단에 임시 로그 추가
console.log('[App render]', {
  snapshotRestored,
  authLoading,
  session: !!session,
  pathname: location.pathname,
  timestamp: Date.now()
})
```

또한 auth 초기화 훅(useAuth 또는 해당 코드)에서:

```javascript
console.time('[Auth] getSession')
const session = await supabase.auth.getSession()
console.timeEnd('[Auth] getSession')

console.time('[Auth] initTeamState')
// ...
console.timeEnd('[Auth] initTeamState')

console.time('[Auth] loadAll')
// ...
console.timeEnd('[Auth] loadAll')
```

### 2. snapshotRestored 상태 확인

snapshotRestored가 false인 동안 Step 2에서 Routes를 렌더하지 않고 무언가를 기다리는지 확인. 만약 스냅샷 복원이 auth 완료를 기다린다면 여기서 먼저 걸린다.

```bash
grep -n "snapshotRestored\|snapshot" src/App.jsx src/hooks/*.js
```

---

## 수정: `/invite/*` 경로 전용 빠른 경로 (fast path)

### 핵심 아이디어

`/invite/*` 경로에서는 전체 앱 초기화를 건너뛰고 **auth 상태만 빠르게 체크**한다.

### 구현

App.jsx 렌더 함수의 **최상단** (Step 1 이전 또는 Step 2 이전)에 추가:

```jsx
// ★ Fast path: invite 경로는 무거운 초기화 불필요
if (location.pathname.startsWith('/invite/')) {
  // authLoading 중이어도 OK — InviteAccept 자체에서 auth 상태를 체크함
  // snapshotRestored 대기도 불필요 — 초대 페이지는 캐시 스냅샷이 필요 없음
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InviteAccept />
    </Suspense>
  )
}

// 이하 기존 Step 2, 3, 4, 5... 그대로
```

### InviteAccept 내부에서 자체 auth 체크

InviteAccept가 App.jsx의 auth 상태에 의존하지 않고, 자체적으로 경량 auth 체크를 수행:

```jsx
function InviteAccept() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [teamInfo, setTeamInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { token } = useParams()

  // 1. 경량 auth 체크 — getSession()만 호출, 팀/데이터 로딩 없음
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setAuthChecked(true)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // 2. 로그인 상태이면 팀 조회 + accept 진행
  useEffect(() => {
    if (!authChecked) return

    if (!session) {
      setLoading(false) // 미로그인 → 바로 로그인 폼 표시
      return
    }

    // 로그인 상태 → invite_code 검증 + accept
    verifyAndAccept()
  }, [authChecked, session])

  const verifyAndAccept = async () => {
    // teams 조회, 중복 체크, acceptInvite 등...
  }

  if (!authChecked || loading) {
    return <div>초대 정보를 확인하는 중...</div>
  }

  if (!session) {
    return (
      <div>
        <h2>초대 링크가 확인되었습니다</h2>
        <p>팀에 참가하려면 로그인이 필요합니다</p>
        <AuthForm redirectTo={window.location.href} defaultMode="signup" />
      </div>
    )
  }

  // 로그인 상태 — accept 결과 표시
  // ...
}
```

**핵심:** `supabase.auth.getSession()`은 로컬 토큰 확인이라 매우 빠름 (수십 ms). 전체 앱의 initTeamState/loadAll 체인(수초~수십초)을 완전히 우회.

### 주의사항

- InviteAccept에서 AuthForm 호출 시 `defaultMode="signup"` 전달 — 초대받은 사람은 신규 사용자일 가능성이 높으므로 회원가입이 기본 모드
- LoginScreen에서 AuthForm 호출 시 `defaultMode="login"` (또는 기본값) — 일반 접속은 기존 사용자일 가능성이 높으므로 로그인이 기본
- AuthForm 컴포넌트에서 `defaultMode` prop을 받아 초기 state로 사용:
  ```jsx
  function AuthForm({ redirectTo, defaultMode = 'login' }) {
    const [mode, setMode] = useState(defaultMode)
    // ...
  }
  ```
- InviteAccept는 App.jsx의 useStore, useAuth 등 전역 상태에 의존하면 안 됨
- Supabase 클라이언트만 직접 import해서 사용
- acceptInvite()는 useInvitation 훅에서 가져오되, 팀 초기화가 전제조건이라면 accept 성공 후 메인 화면 이동 시 전체 초기화가 실행됨
- 로그인 성공 후 InviteAccept 내에서 accept까지 완료한 뒤 `window.location.href = '/'` 로 전체 앱 새로 진입하는 것도 방법 (가장 안전)

---

## 수정 후 예상 동작

| 단계 | 소요 시간 |
|------|----------|
| 페이지 로드 + React 렌더 | ~1초 |
| Fast path → InviteAccept 렌더 | 즉시 |
| getSession() | ~50ms |
| 미로그인 → 로그인 폼 표시 | 즉시 |
| **총합** | **~1-2초** |

기존 1분+ → 1-2초로 단축.

## 테스트

- [ ] 미로그인 + `/invite/{code}` → 1-2초 이내에 로그인 폼 표시
- [ ] 로그인 상태 + `/invite/{code}` → 빠르게 팀 합류 처리
- [ ] 일반 로그인 (invite 아닌) → 기존과 동일 동작 (snapshotRestored, authLoading 등 그대로)
- [ ] `npm run build` 성공

## updateTask 시그니처 주의

`updateTask(id, patch)` — 절대 `updateTask({...task})` 형태 사용 금지.
