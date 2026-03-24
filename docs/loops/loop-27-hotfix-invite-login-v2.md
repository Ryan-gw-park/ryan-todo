# Loop-27 핫픽스: 초대 라우팅 + 로그인 전면 개편

## 진단 요약

| # | 문제 | 원인 |
|---|------|------|
| 1 | `/invite/{code}` 접속 시 로그인 페이지 표시 | App.jsx Step 4에서 `!session` → LoginScreen으로 차단 |
| 2 | "email rate limit exceeded" 에러 | LoginScreen.jsx에 signInWithOtp 잔존 |
| 3 | signUp 후 이메일 확인 단계에서 invite 흐름 끊김 가능 | Supabase "Confirm email" 설정 미확인 |
| 4 | Google OAuth redirect 시 sessionStorage 유실 가능 | 모바일 Safari 등에서 OAuth 왕복 중 storage 소실 |
| 5 | 동일 이메일 Google + Email/PW 충돌 | 에러 메시지 미처리 |
| 6 | InviteAccept → 로그인 페이지 이동 시 컨텍스트 단절 | 초대 페이지에서 벗어나면 사용자 혼란 |

---

## 수정 계획 (5건)

### 수정 1: App.jsx — `/invite` 경로를 auth guard 이전에 처리

**파일:** `src/App.jsx`

Step 3(authLoading) 과 Step 4(!session) 사이에 삽입:

```jsx
// Step 3.5: Allow invite page without auth
if (!session && location.pathname.startsWith('/invite/')) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InviteAccept />
    </Suspense>
  )
}
```

**주의사항:**
- InviteAccept는 이미 lazy import되어 있으므로 추가 import 불필요
- 기존 Step 4의 sessionStorage 저장 로직(pendingInvite)은 그대로 유지 — Google OAuth 흐름에서 사용
- Step 5의 pendingInvite Navigate 로직도 그대로 유지

---

### 수정 2: InviteAccept — 미로그인 시 로그인 폼 임베드

**파일:** `src/components/team/InviteAccept.jsx`

InviteAccept 내부에서 session 여부에 따라 두 가지 UI를 분기한다. 미로그인 사용자를 별도 페이지로 보내지 않고, **초대 페이지 안에서 로그인/회원가입을 처리**한다.

#### 미로그인 상태 UI 구조:

```
┌──────────────────────────────────────┐
│       초대 링크가 확인되었습니다        │
│   팀에 참가하려면 로그인이 필요합니다    │
│                                      │
│   [G] Google로 로그인                 │
│   ──────── 또는 ────────             │
│                                      │
│   (로그인 / 회원가입 탭 전환)           │
│                                      │
│   [로그인 모드]                        │
│   이메일:    [________________]       │
│   비밀번호:  [________________]       │
│   [로그인]                            │
│   계정이 없으신가요? → 회원가입 전환     │
│                                      │
│   [회원가입 모드]                      │
│   이메일:    [________________]       │
│   비밀번호:  [________________]       │
│   비밀번호 확인: [________________]    │
│   [회원가입]                          │
│   이미 계정이 있으신가요? → 로그인 전환  │
└──────────────────────────────────────┘
```

#### 로그인 로직 — 이메일+비밀번호:

```javascript
const handleLogin = async () => {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다')
    } else {
      setError(error.message)
    }
    return
  }
  // 로그인 성공 → session이 생기면 InviteAccept가 re-render되어
  // 자동으로 로그인 상태 분기 → acceptInvite() 실행
}
```

#### 회원가입 로직:

```javascript
const handleSignUp = async () => {
  if (password !== confirmPassword) {
    setError('비밀번호가 일치하지 않습니다')
    return
  }
  if (password.length < 6) {
    setError('비밀번호는 최소 6자 이상이어야 합니다')
    return
  }

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    // 동일 이메일 충돌 처리 (수정 4 참조)
    if (error.message.includes('User already registered')) {
      setError('이미 가입된 이메일입니다. 로그인으로 전환해주세요.')
      setMode('login') // 자동으로 로그인 모드로 전환
      return
    }
    setError(error.message)
    return
  }

  // ★ 수정 3: 이메일 확인 필요 여부 체크
  if (data.user && !data.session) {
    // Confirm email이 켜져 있는 경우 — session이 null로 온다
    setEmailConfirmPending(true)
    // "이메일을 확인해주세요" 안내 표시 + invite_code는 유지됨
    // 사용자가 이메일 확인 후 같은 링크로 돌아오면 로그인 상태 → 자동 팀 합류
    return
  }

  // session이 즉시 생성된 경우 → re-render로 자동 acceptInvite()
}
```

#### Google OAuth — redirectUrl에 invite 경로 포함 (수정 2-B):

```javascript
const handleGoogleLogin = async () => {
  // ★ 핵심: redirectTo에 현재 invite URL을 포함
  // OAuth 완료 후 이 URL로 돌아오므로 sessionStorage 의존 불필요
  const currentUrl = window.location.href // 예: https://app.url/invite/wxwdn5b1

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: currentUrl, // OAuth 완료 후 invite 페이지로 직접 복귀
    }
  })
}
```

이렇게 하면 OAuth 왕복 후 sessionStorage/localStorage에 의존하지 않고, 브라우저가 직접 `/invite/{code}`로 돌아온다. App.jsx에서 session이 있고 경로가 `/invite/*`이면 InviteAccept가 렌더되어 자동으로 acceptInvite() 실행.

#### 로그인 상태 UI (기존 로직 유지):

```
invite_code 검증
  ├── 무효 → "유효하지 않은 초대 링크입니다" 에러
  ├── 이미 멤버 → "이미 팀에 가입되어 있습니다" + 메인 이동
  └── 미가입 → acceptInvite()
      ├── auto_approve ON → active → 환영 토스트 + 메인 이동
      └── auto_approve OFF → pending → "팀장 승인 대기" 안내
```

#### 이메일 확인 대기 UI (emailConfirmPending === true):

```
┌──────────────────────────────────────┐
│       ✉ 이메일을 확인해주세요          │
│                                      │
│   {email}로 확인 메일을 보냈습니다.     │
│   메일의 링크를 클릭한 후               │
│   아래 링크로 다시 접속해주세요.         │
│                                      │
│   [이 초대 링크 복사]                  │
│                                      │
│   (현재 invite URL을 클립보드에 복사)    │
└──────────────────────────────────────┘
```

---

### 수정 3: Supabase 이메일 확인(Confirm email) 설정 점검

이 수정은 코드가 아닌 **Supabase 대시보드 설정 확인**이다.

#### 확인 방법:
Supabase Dashboard → Authentication → Providers → Email → "Confirm email" 토글

#### 두 가지 전략 중 선택:

**전략 A (권장): Confirm email 끄기**
- signUp() 후 즉시 session 생성 → invite 흐름 끊김 없음
- 단점: 존재하지 않는 이메일로도 가입 가능
- 소규모 팀 내부 도구에는 충분히 적합

**전략 B: Confirm email 켜둔 채로 처리**
- signUp() 후 data.session === null → 이메일 확인 필요
- InviteAccept에서 "이메일 확인 대기" UI 표시 (위 코드의 emailConfirmPending 분기)
- 사용자가 이메일 확인 후 같은 invite 링크로 다시 접속
- 장점: 이메일 검증으로 보안 강화
- 단점: UX 한 단계 추가, Supabase 기본 이메일 rate limit에 걸릴 수 있음

**코드에서는 양쪽 모두 대응한다:**
- `data.user && !data.session` 체크로 Confirm email 설정과 무관하게 동작
- Confirm email이 꺼져 있으면 이 분기에 진입하지 않음 (session이 즉시 생성되므로)

---

### 수정 4: 동일 이메일 충돌 에러 처리

**파일:** `src/components/team/InviteAccept.jsx` (수정 2에 포함)

#### 시나리오별 에러 메시지:

```javascript
// signUp 시도 시
if (error.message.includes('User already registered')) {
  setError('이미 가입된 이메일입니다. 로그인으로 전환해주세요.')
  setMode('login')
  return
}

// signInWithPassword 시도 시
if (error.message.includes('Invalid login credentials')) {
  setError('이메일 또는 비밀번호가 올바르지 않습니다')
  return
}

// 기타 에러
setError(error.message)
```

#### Google SSO 계정으로 비밀번호 로그인 시도하는 경우:
- Google SSO로 가입한 사용자가 같은 이메일로 signInWithPassword() 시도
- Supabase는 "Invalid login credentials" 반환 (비밀번호가 설정된 적 없으므로)
- 에러 메시지에 Google 로그인 안내를 추가:

```javascript
if (error.message.includes('Invalid login credentials')) {
  setError('이메일 또는 비밀번호가 올바르지 않습니다. Google 계정으로 가입하셨다면 Google 로그인을 이용해주세요.')
  return
}
```

---

### 수정 5: LoginScreen.jsx — 매직링크 제거 + 이메일/비밀번호 추가

**파일:** `src/components/auth/LoginScreen.jsx` (또는 실제 위치)

이 파일은 InviteAccept 바깥에서 직접 로그인할 때 사용되는 일반 로그인 화면이다.

#### 제거:
- `signInWithOtp` 호출 코드 전체 (LoginScreen.jsx:57-73 부근)
- "이메일 인증하기" 버튼
- 매직링크 관련 상태 변수, 에러 핸들링

#### 추가:
- 이메일+비밀번호 로그인 폼 (signInWithPassword)
- 회원가입 폼 (signUp) — 로그인/회원가입 모드 전환
- 에러 메시지 처리 (수정 4와 동일한 패턴)

#### UI 구조:

```
[앱 로고 + 이름]
[G] Google로 로그인
──────── 또는 ────────

(로그인 모드)
이메일:    [________________]
비밀번호:  [________________]
[로그인]
계정이 없으신가요? [회원가입]

(회원가입 모드)
이메일:    [________________]
비밀번호:  [________________]  (최소 6자)
비밀번호 확인: [________________]
[회원가입]
이미 계정이 있으신가요? [로그인]
```

**Google OAuth redirectUrl 처리:**
```javascript
// 일반 로그인(invite가 아닌 경우)에서는 기존 방식 유지
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin, // 메인 페이지로 복귀
  }
})
```

**기존 유지:**
- Google OAuth 버튼 — 그대로
- authError prop 표시 — 그대로

---

## 수정 순서

1. **App.jsx** — Step 3.5 삽입 (invite 경로 auth guard 우회)
2. **InviteAccept.jsx** — 미로그인 UI 추가 (로그인 폼 임베드 + Google OAuth redirectTo + signUp + 에러 처리)
3. **LoginScreen.jsx** — signInWithOtp 제거 + signInWithPassword/signUp 추가
4. **Supabase 설정 확인** — Confirm email 상태 확인 (코드 리포트에 현재 설정 기록)
5. 빌드 확인: `npm run build`
6. 잔존 확인: `grep -r "signInWithOtp" src/` → 결과 없어야 함

---

## 코드 재사용 참고

InviteAccept와 LoginScreen 모두 이메일+비밀번호 로그인/회원가입 폼이 필요하다. 코드 중복을 피하기 위해:

**방법 A (권장):** 공통 컴포넌트 `AuthForm.jsx` 추출
```
src/components/auth/AuthForm.jsx
├── Google 로그인 버튼
├── 이메일+비밀번호 로그인
├── 회원가입 (모드 전환)
├── 에러 메시지 표시
└── props: { onSuccess, redirectTo, showTitle }
```

InviteAccept에서: `<AuthForm onSuccess={handleAcceptInvite} redirectTo={currentInviteUrl} showTitle={false} />`
LoginScreen에서: `<AuthForm onSuccess={() => navigate('/')} redirectTo={window.location.origin} showTitle={true} />`

**방법 B:** 각각 독립 구현 (코드 중복 있지만 단순)

→ 방법 A를 권장하지만, 작업 범위를 줄이려면 방법 B로 진행 후 추후 리팩터링.

---

## 테스트 시나리오

### 초대 플로우
- [ ] 미로그인 + `/invite/{code}` 접속 → InviteAccept 페이지 표시 (로그인 폼 임베드)
- [ ] InviteAccept에서 이메일+비밀번호 로그인 → 자동 팀 합류
- [ ] InviteAccept에서 이메일+비밀번호 회원가입 → 자동 팀 합류
- [ ] InviteAccept에서 Google 로그인 → OAuth 완료 → /invite/{code}로 직접 복귀 → 팀 합류
- [ ] 로그인 상태 + `/invite/{code}` 접속 → 직접 acceptInvite() 실행
- [ ] 이미 팀 멤버 → 중복 가입 방지 메시지
- [ ] 잘못된 invite_code → 에러 메시지

### 에러 처리
- [ ] 가입 시 이미 등록된 이메일 → "이미 가입된 이메일입니다" + 로그인 모드 자동 전환
- [ ] Google로 가입한 이메일로 비밀번호 로그인 시도 → 적절한 안내 메시지
- [ ] signUp 후 Confirm email 필요 시 → 이메일 확인 안내 UI + invite 링크 복사 제공

### 일반 로그인 (invite 아닌 경우)
- [ ] LoginScreen에서 Google 로그인 → 정상 동작
- [ ] LoginScreen에서 이메일+비밀번호 로그인 → 정상 동작
- [ ] LoginScreen에서 회원가입 → 정상 동작
- [ ] `grep -r "signInWithOtp" src/` → 결과 없음

### 코드 품질
- [ ] `npm run build` 성공
- [ ] InviteAccept와 LoginScreen 간 인증 로직 공유 (AuthForm 컴포넌트 또는 의도적 분리)

---

## updateTask 시그니처 주의

`updateTask(id, patch)` — 절대 `updateTask({...task})` 형태 사용 금지.
