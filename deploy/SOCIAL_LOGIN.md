# 볼탱이 대전 소셜 로그인 설정

게임과 API를 운영 도메인의 같은 HTTPS 오리진에서 서비스한다. Node.js 22.12 이상에서 저장소 루트의 `npm ci --omit=dev`로 운영 의존성을 설치한다. 로그인 키는 API 서비스의 환경변수로 주입한다. 시스템 브라우저를 쓰는 Android 빌드에는 같은 도메인의 게임 주소를 설정한다.

## 공급자 등록

`BATTLE_AUTH_ORIGIN`에는 외부에서 접근하는 오리진을 입력한다. 예를 들어 `https://games.example.com`을 설정했다면 그 뒤에 아래 경로를 붙인 전체 HTTPS 주소를 각 개발자 콘솔에 등록한다. 운영 콘솔에서 앱의 서비스 상태, 허용 도메인 및 테스트 사용자 제한도 확인한다.

| 공급자 | 개발자 콘솔 작업과 서버 환경변수 | 콜백 경로 |
|---|---|---|
| 카카오 | Kakao Developers 앱에서 카카오 로그인을 활성화한다. `BATTLE_KAKAO_CLIENT_ID`에 REST API 키를 넣는다. Client Secret을 사용하는 앱은 `BATTLE_KAKAO_CLIENT_SECRET`도 설정한다. | `/api/battle/auth/callback/kakao` |
| 네이버 | 네이버 로그인 애플리케이션의 웹 서비스 URL과 Callback URL을 등록한다. `BATTLE_NAVER_CLIENT_ID`, `BATTLE_NAVER_CLIENT_SECRET`을 설정한다. | `/api/battle/auth/callback/naver` |
| Google | Google Auth Platform에 웹 애플리케이션용 OAuth 클라이언트와 승인된 리디렉션 URI를 등록한다. `BATTLE_GOOGLE_CLIENT_ID`, `BATTLE_GOOGLE_CLIENT_SECRET`을 설정한다. | `/api/battle/auth/callback/google` |
| Apple | Sign in with Apple을 활성화한 기본 App ID에 웹 Services ID를 연결하고 도메인과 Return URL을 등록한다. `BATTLE_APPLE_CLIENT_ID`는 Services ID다. `BATTLE_APPLE_TEAM_ID`, `BATTLE_APPLE_KEY_ID`, `BATTLE_APPLE_PRIVATE_KEY`에는 발급받은 팀 ID, 키 ID, P-256 개인 키(PEM)를 설정한다. 서버는 코드 교환 때마다 5분 유효한 클라이언트 서명을 생성한다. | `/api/battle/auth/callback/apple` |

Apple 개인 키 환경변수는 실제 개행 또는 리터럴 `\n`으로 개행을 표현할 수 있다. 서비스 관리자 전용 비밀 저장소나 저장소 밖의 권한 제한 파일로 값을 주입한다. 키 회전 후 서비스를 재시작한다. 설정을 읽을 수 있는 공급자 목록은 `GET /api/battle/auth/providers`로 확인한다. 목록에 나타난 뒤에는 실제 콘솔 값과 외부 접근성까지 검증하기 위해 운영 도메인에서 서비스를 직접 승인해야 한다.

공급자 문서 · [Kakao Login](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api) · [네이버 로그인](https://developers.naver.com/docs/login/api/api.md) · [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) · [Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple)

## 게임에서 계정이 열리는 과정

1. 게임이 `POST /api/battle/auth/start`에 `provider`와 선택적 `nickname`을 JSON으로 보낸다. 기존 로컬 진행도를 연결할 때는 현재 계정의 유효한 Bearer 토큰을 이 요청에 첨부한다.
2. 게임은 응답의 `claimToken`과 `flowId`를 보관하고 `authorizeUrl`을 시스템 브라우저에서 연다. 백엔드의 첫 화면이 짧은 수명의 Secure·HttpOnly 쿠키를 설정한 후 공급자로 이동한다. Google·카카오는 S256 PKCE를 사용한다. Apple 콜백은 교차 사이트 폼 POST를 받기 위해 HTTPS와 SameSite=None 쿠키를 사용한다.
3. 서버가 공급자 코드를 교환한다. Google·Apple은 공식 JWKS의 서명, 발급자, 대상 클라이언트, 유효시간과 요청 nonce를 확인한다. 네이버·카카오는 서버가 직접 받은 액세스 토큰으로 공식 사용자 정보 API를 조회한다. 계정 키에는 공급자와 앱별 사용자 식별자를 사용한다.
4. 게임은 `POST /api/battle/auth/claim`에 `claimToken`을 보내 대기 상태를 확인한다. 인증을 마친 브라우저에 6자리 확인 코드가 표시된다. 같은 오리진·저장소의 웹 탭끼리는 BroadcastChannel로 자동 전달하고, Android처럼 브라우저와 게임이 분리된 경우 사용자가 게임에 코드를 입력한다.
5. 게임이 `claimToken`과 문자열 `confirmationCode`를 함께 제출하면 서버가 게임 계정과 계정 토큰을 한 번 반환한다. 닉네임 설정이 필요한 계정은 `account.needsNickname`을 받는다. 공급자 인증서와 토큰 응답은 로그인 과정 중에만 사용한다. API 계정 토큰은 리디렉션 URL에 포함되지 않는다.

## 운영과 확인

서버를 이 버전으로 전환하면 기존 계정의 점수·승수·경기 수는 유지하고 계정 저장 파일과 복구 사본에서 학교·반 필드를 제거한다. 운영 전환 전에 기존 버전 복구가 필요한 경우를 위해 접근이 제한된 배포 전 백업을 준비하고, 보관 기간은 개인정보 처리방침에 맞춘다. 새 클라이언트의 닉네임 초대와 랭킹 검색은 새 서버 API를 사용하므로 서버와 공급자 설정을 먼저 검증하고 클라이언트를 배포한다.

로그인 흐름의 유효기간은 시작 후 10분이다. 확인 코드를 다섯 번 잘못 입력하거나 시간이 지나면 게임에서 로그인을 다시 시작한다. 이 구현은 단일 Node 프로세스에 로그인 대기 상태를 둔다. 재시작하면 진행 중이던 로그인은 다시 시작해야 한다. 여러 인스턴스로 확장할 때는 서버 간 원자적 일회성 교환을 지원하는 공유 저장소가 필요하다. HTTPS 프록시는 Apple 폼 POST와 응답의 Set-Cookie를 전달해야 한다. 인증 경로는 캐시를 끄고 요청 본문·쿼리·쿠키·Authorization 헤더를 로그에서 제외한다.

로컬 자동 검증은 `node --test tests/social-auth.test.mjs`로 실행한다. 공급자의 정상 코드 교환, 서명·nonce 검증, 앱 복귀, 취소, 만료와 중복 수령을 독립적인 테스트 자격증명으로 확인한다. 운영 점검에서는 각 공급자의 실제 계정으로 승인·취소하고, 같은 공급자 계정으로 재접속했을 때 기존 경기 기록이 유지되는지 확인한다. Android에서는 시스템 브라우저에서 확인 코드를 받아 게임으로 돌아오는 경로도 점검한다.
