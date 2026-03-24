# Loop-27 핫픽스: InviteAccept 미로그인 시 빈 화면 수정

## 증상

`/invite/wxwdn5b1` 접속 시 (미로그인 상태):
- 콘솔 에러 없음
- 빈 화면 또는 "초대 정보를 확인하는 중..." 무한 로딩
- InviteAccept 컴포넌트가 로딩 상태에서 빠져나오지 못함

## 원인

InviteAccept에서 invite_code로 teams 테이블을 조회하는데, 미로그인(anon) 상태에서는 teams 테이블의 RLS 정책이 SELECT를 차단한다. Supabase는 RLS 차단 시 에러가 아닌 **빈 배열**을 반환하므로, 컴포넌트는 "팀을 찾을 수 없음"과 "아직 로딩 중"을 구분하지 못한다.

## 수정 방법 — 2가지 중 택 1

### 방법 A (권장): 미로그인이면 팀 조회를 건너뛰기

InviteAccept에서 session이 없으면 teams 쿼리를 아예 실행하지 않고, 바로 로그인 폼을 보여준다. 팀 이름은 보안상 미인증 사용자에게 노출하지 않는 것이 낫다.

**파일:** `src/components/team/InviteAccept.jsx`

수정 로직:

```jsx
// 현재 (문제)
useEffect(() => {
  // session 여부와 무관하게 teams 조회 시도
  const { data } = await supabase
    .from('teams')
    .select('id, name, ...')
    .eq('invite_code', token)
    .single()
  // anon이면 data가 null → 로딩 상태 유지
}, [token])

// 수정 후
useEffect(() => {
  // 미로그인이면 팀 조회 스킵 — 바로 auth 폼 표시
  if (!session) {
    setLoading(false)
    // teamInfo는 null인 채로 유지
    return
  }

  // 로그인 상태에서만 팀 조회
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, auto_approve')
    .eq('invite_code', token)
    .single()

  if (error || !data) {
    setError('유효하지 않은 초대 링크입니다')
    setLoading(false)
    return
  }

  setTeamInfo(data)
  setLoading(false)
}, [token, session])
```

미로그인 UI:
```
┌──────────────────────────────────────┐
│       초대 링크가 확인되었습니다        │
│   팀에 참가하려면 로그인이 필요합니다    │
│                                      │
│   [AuthForm — Google + Email/PW]     │
└──────────────────────────────────────┘
```

로그인 성공 후 session이 생기면 → useEffect 재실행 → teams 조회 → acceptInvite() 진행.

### 방법 B (대안): RLS 정책 추가

teams 테이블에 anon이 invite_code로 팀 이름만 읽을 수 있는 정책 추가:

```sql
CREATE POLICY "anon can read team by invite_code"
ON teams FOR SELECT
TO anon
USING (invite_code IS NOT NULL AND invite_code != '');
```

이 방법은 미인증 사용자에게 팀 이름을 보여줄 수 있지만, 보안상 불필요한 정보 노출이다. **방법 A를 권장한다.**

---

## 추가 방어 코드

현재 코드에서 `loading` 상태가 절대 false가 되지 않는 경우를 방어:

```jsx
// 타임아웃 fallback — 10초 이상 로딩이면 에러 표시
useEffect(() => {
  const timeout = setTimeout(() => {
    if (loading) {
      setLoading(false)
      setError('초대 정보를 확인할 수 없습니다. 다시 시도해주세요.')
    }
  }, 10000)
  return () => clearTimeout(timeout)
}, [loading])
```

---

## 수정 후 예상 동작

1. 미로그인 + `/invite/{code}` → 즉시 로그인 폼 표시 (팀 조회 없이)
2. Google/Email로 로그인 → session 생성 → teams 조회 → invite_code 유효성 검증
3. 유효 → acceptInvite() → 팀 합류
4. 무효 → "유효하지 않은 초대 링크" 에러
5. 이미 멤버 → "이미 팀에 가입되어 있습니다"

## 테스트

- [ ] 미로그인 + 유효한 invite 링크 → 로그인 폼 즉시 표시 (빈 화면 아님)
- [ ] 로그인 후 → 팀 합류 성공
- [ ] 로그인 상태 + 유효한 invite 링크 → 바로 팀 합류
- [ ] 로그인 상태 + 무효한 invite 링크 → 에러 메시지
- [ ] `npm run build` 성공

## updateTask 시그니처 주의

`updateTask(id, patch)` — 절대 `updateTask({...task})` 형태 사용 금지.
