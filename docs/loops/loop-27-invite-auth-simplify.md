# Loop-27: 초대 플로우 단순화 + 비밀번호 관리

## 목표

1. 이메일 기반 초대(signInWithOtp)를 완전 제거하고 초대 링크 복사 방식으로 단순화
2. 미로그인 수신자의 초대 수락 플로우를 안전하게 처리 (회원가입 → 자동 팀 합류)
3. 프로필에 비밀번호 설정/변경 기능 추가 (Google SSO 전용 사용자 포함)

## 배경

현재 초대 방식은 `signInWithOtp`로 매직링크를 발송하는데, 세 가지 문제가 있다:
- Supabase Auth 이메일 rate limit 초과로 초대 실패 발생 (`AuthApiError: email rate limit exceeded`)
- 매직링크로 가입한 사용자는 비밀번호가 없어서 로그아웃 후 재로그인 불가
- 커스텀 SMTP 없이는 발송 한도가 시간당 3~4회로 실용성 없음

**결정사항:**
- 이메일 초대 기능 완전 제거 (Edge Function 포함)
- 초대 링크 복사만 유지
- 외부 SMTP 설정 불필요
- 비밀번호 관리 기능을 이 Loop에 포함

---

## Phase 1: 이메일 초대 제거 + 초대 링크 UI 승격

### 1-1. useInvitation.js — sendEmailInvite 제거

**파일:** `src/hooks/useInvitation.js`

- `sendEmailInvite()` 함수 전체 삭제
- 관련 import 정리 (`signInWithOtp` 등)
- `acceptInvite()` 함수는 **그대로 유지** — 링크 기반 초대 수락에 계속 사용됨
- `generateInviteLink()` 함수는 **그대로 유지**

### 1-2. TeamSettings.jsx — 이메일 초대 UI 제거 + 링크 복사 승격

**파일:** `src/components/team/TeamSettings.jsx`

변경사항:
- 이메일 입력 필드 + 이메일 초대 버튼 **제거**
- "초대 링크 복사" 버튼을 메인 초대 수단으로 **승격** (기존 보조 위치에서 primary 위치로)
- invite_code가 없으면 자동 생성 후 복사하는 흐름 유지
- 링크 복사 성공 시 토스트 메시지 표시

UI 구조:
```
팀 설정
├── 팀 정보 (팀 이름 등)
├── 멤버 초대
│   └── [초대 링크 복사] 버튼 (primary, 큰 사이즈)
│   └── 안내 텍스트: "링크를 복사해서 카톡, 슬랙 등으로 전달하세요"
├── 멤버 관리
│   └── 기존 멤버 목록 + 승인/거절
└── 팀 설정 (auto_approve 토글 등)
```

### 1-3. Edge Function 제거

**파일:** `supabase/functions/send-invite-email/index.ts`

- 파일 전체 삭제 (또는 주석 처리 후 deprecated 표시)
- Supabase Dashboard에서 해당 Edge Function 배포 제거는 수동으로 처리

### 1-4. team_invitations 테이블 정리 (선택)

`team_invitations` 테이블은 이메일 초대 추적용이었으므로 더 이상 불필요하다. 단, 테이블 삭제는 마이그레이션이 필요하고 위험도가 있으므로:
- **최소 조치:** 코드에서 team_invitations 참조를 모두 제거
- **선택 조치:** 추후 마이그레이션으로 테이블 DROP

---

## Phase 2: 초대 링크 랜딩 페이지

### 2-1. InviteLanding 페이지 컴포넌트 생성

**새 파일:** `src/components/invite/InviteLanding.jsx`

이 페이지는 `/invite/{invite_code}` URL로 접근했을 때 표시된다.

**로직 흐름:**

```
URL: /invite/{invite_code}
        │
        ▼
  invite_code 유효성 검증
  (teams 테이블에서 invite_code 조회)
        │
        ├── 무효 → 에러 메시지 표시 ("유효하지 않은 초대 링크입니다")
        │
        ├── 유효 + 로그인 상태
        │   ├── 이미 해당 팀 멤버 → "이미 팀에 가입되어 있습니다" + 메인으로 이동
        │   └── 미가입 → acceptInvite() 실행
        │       ├── auto_approve ON → 즉시 active → 메인으로 이동 + 환영 토스트
        │       └── auto_approve OFF → pending 상태 → "가입 신청 완료, 팀장 승인을 기다려주세요" 표시
        │
        └── 유효 + 미로그인 상태
            └── sessionStorage에 invite_code 저장
            └── 팀 이름 표시 + "로그인/회원가입 후 팀에 합류할 수 있습니다" 안내
            └── 로그인 페이지로 이동 버튼
```

**UI 요소:**
- 팀 이름 표시 (초대받은 팀이 어디인지 확인)
- 로딩 상태 (invite_code 검증 중)
- 에러 상태 (잘못된 링크)
- 성공 상태 (팀 합류 완료)

### 2-2. 라우트 등록

**파일:** `src/App.jsx`

```jsx
<Route path="/invite/:inviteCode" element={<InviteLanding />} />
```

- 이 라우트는 인증 여부와 무관하게 접근 가능해야 함 (public route)
- ProtectedRoute 바깥에 위치

### 2-3. 로그인 후 자동 초대 수락

**파일:** `src/App.jsx` 또는 `src/hooks/useAuth.js` (기존 auth 처리 로직 위치)

로그인 완료 후 실행되는 로직에 다음을 추가:

```javascript
// 로그인 성공 콜백 또는 auth state change 핸들러에서
const pendingInvite = sessionStorage.getItem('pending_invite_code');
if (pendingInvite) {
  sessionStorage.removeItem('pending_invite_code');
  // /invite/{code} 페이지로 리다이렉트 → 해당 페이지에서 acceptInvite 처리
  navigate(`/invite/${pendingInvite}`);
}
```

**주의:** `acceptInvite()` 직접 호출 대신 `/invite/{code}`로 리다이렉트하는 방식 권장. InviteLanding 페이지가 유효성 검증 + 에러 핸들링 + UI 피드백을 모두 담당하므로 로직 중복을 방지한다.

---

## Phase 3: 프로필 비밀번호 관리

### 3-1. 현재 로그인 방식 감지

**새 훅 또는 유틸:** `src/hooks/useAuthProvider.js` (또는 기존 auth 훅에 추가)

Supabase의 `auth.getUser()`에서 사용자의 인증 provider를 확인:

```javascript
const { data: { user } } = await supabase.auth.getUser();

// user.app_metadata.provider → 'google', 'email' 등
// user.app_metadata.providers → ['google'], ['email'], ['google', 'email'] 등
const hasGoogle = user.app_metadata.providers?.includes('google');
const hasPassword = user.app_metadata.providers?.includes('email');
// 비밀번호 미설정 = providers에 'email'이 없음
```

### 3-2. 프로필 페이지에 보안 섹션 추가

**파일:** 기존 프로필/설정 컴포넌트 (위치는 현재 코드 구조에 따라 결정)

**UI 구조:**

```
보안
├── 로그인 방식
│   ├── ✅ Google 연결됨 (hasGoogle인 경우)
│   └── ✅ 이메일+비밀번호 (hasPassword인 경우) / ❌ 비밀번호 미설정
│
├── 비밀번호 설정/변경
│   ├── [비밀번호 설정] 버튼 (hasPassword === false일 때)
│   └── [비밀번호 변경] 버튼 (hasPassword === true일 때)
│
└── 비밀번호 입력 폼 (버튼 클릭 시 인라인 확장)
    ├── 새 비밀번호 입력
    ├── 비밀번호 확인 입력
    ├── 최소 8자 등 유효성 검증
    └── [저장] / [취소] 버튼
```

### 3-3. 비밀번호 설정/변경 로직

```javascript
const handlePasswordUpdate = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    // 에러 처리 (비밀번호 정책 미충족 등)
    toast.error('비밀번호 변경 실패: ' + error.message);
    return;
  }
  toast.success('비밀번호가 설정되었습니다');
  // provider 정보 갱신을 위해 user 다시 fetch
};
```

**유효성 검증 규칙:**
- 최소 8자
- 새 비밀번호와 확인 비밀번호 일치
- (선택) 대문자/숫자/특수문자 포함 — Supabase Auth 기본 정책에 맞춤

---

## 영향받는 파일 목록

| 파일 | 변경 유형 |
|------|-----------|
| `src/hooks/useInvitation.js` | 수정 — sendEmailInvite 제거 |
| `src/components/team/TeamSettings.jsx` | 수정 — 이메일 UI 제거, 링크 복사 승격 |
| `supabase/functions/send-invite-email/index.ts` | 삭제 |
| `src/components/invite/InviteLanding.jsx` | 신규 생성 |
| `src/App.jsx` | 수정 — /invite/:inviteCode 라우트 추가 + 로그인 후 pending invite 처리 |
| 프로필/설정 컴포넌트 | 수정 — 보안 섹션 추가 |

## 회귀 테스트 범위

- [ ] 초대 링크 복사 버튼 정상 작동
- [ ] 복사된 링크로 접속 시 InviteLanding 페이지 표시
- [ ] 로그인 상태에서 초대 링크 클릭 → 팀 합류 성공
- [ ] 미로그인 상태에서 초대 링크 클릭 → 로그인 후 자동 팀 합류
- [ ] 이미 팀 멤버인 사용자가 링크 클릭 → 중복 가입 방지
- [ ] 잘못된 invite_code → 에러 메시지 표시
- [ ] auto_approve OFF 상태에서 초대 수락 → pending 상태 진입
- [ ] 비밀번호 설정 (Google SSO 전용 계정) → 이후 이메일+비밀번호 로그인 가능
- [ ] 비밀번호 변경 (기존 비밀번호 있는 계정) → 새 비밀번호로 로그인 가능
- [ ] 기존 팀 관리 기능 (멤버 목록, 승인/거절 등) 회귀 없음

## 완료 조건 (Contract Lock)

- [ ] `npm run build` 성공
- [ ] 이메일 관련 코드 완전 제거 확인 (grep으로 signInWithOtp, sendEmailInvite 잔존 여부 검증)
- [ ] 초대 링크 복사 → 미로그인 사용자 수락 전체 플로우 테스트 통과
- [ ] 비밀번호 설정/변경 동작 확인
- [ ] 기존 기능 회귀 없음
