# 볼탱이 대전 (PuffPuffSiege-Online) 배포·운영·TLS 준비 가이드

> 이 문서는 **실제 AWS/인프라 변경 없이** 로컬 검증 완료된 아키텍처와 배포 시 필요한 승인/설정 절차를 정리한 것입니다.

## 1. 서비스 격리 구조 (Grow 앱과 비간섭)
| 항목 | 기존 Grow 앱 | 볼탱이 대전 (Battle) |
| :--- | :--- | :--- |
| 정적 경로 | `/grow/` | `/battle/` |
| API 경로 | `/api/grow/*` | `/api/battle/*` |
| 내부 바인딩 | `127.0.0.1:3101` | `127.0.0.1:8791` |
| 프로세스명 | 기존 Grow 서비스 | `boltaengi-battle.service` |
| 영속 저장소 | Grow 전용 저장소 | `/opt/boltaengi-battle/data/battle-store.json` (+ `.bak`) |

## 2. 1GB Lightsail 메모리 제한 및 systemd 설정 예시
- `verify-persistence.mjs` 기준 Node.js 프로세스 RSS 메모리: 약 **131 MB** (추가 DB 데몬 불필요).
- `/etc/systemd/system/boltaengi-battle.service`:
```ini
[Unit]
Description=Boltaengi Battle Authoritative Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/boltaengi-battle
ExecStart=/usr/bin/node --max-old-space-size=256 /opt/boltaengi-battle/server.mjs
Restart=on-failure
RestartSec=3
MemoryMax=320M
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 3. 영속 데이터 vs 비영속 데이터 분리 & `localStorage` 이관
- **영속(디스크 `battle-store.json` + `.bak` 이중화)**:
  - 내부 계정 ID, 로그인 제공자와 제공자별 사용자 식별값, 공개 닉네임
  - 누적 전적(`xp`, `wins`, `matches`), 낙관적 락 `version`
  - 완료된 `idempotencyKey` 목록(최근 2,000건 상한 — 재시도·새로고침 시 중복 지급 차단)
- **비영속(의도적 만료 — 메모리 `Map` 관리)**:
  - 초대 코드(`inviteCode`), 활성 방/시뮬레이션(`rooms`, 15분 TTL), 일회성 `memberToken`
  - 서버 재시작 시 진행 중 임시 방은 자동 만료(`404 ROOM_NOT_FOUND`), 영속 전적·계정은 그대로 복구됨.
- **기존 계정과 진행도**
  1. 기존 기기에 유효한 게임 계정 토큰이 있으면 소셜 로그인 시작 요청에 첨부한다. 로그인에 성공하면 같은 계정의 온라인 경기 기록을 이어 간다.
  2. 온라인 경기 결과는 서버가 집계한다. 클라이언트는 계정별로 로컬 진행도를 저장하고 서버에서 확정된 온라인 보상을 반영한다.
  3. 로그인 제공자 등록, 콜백 주소, 기존 학교·반 필드 정리 절차는 [소셜 로그인 운영 설정](SOCIAL_LOGIN.md)을 따른다.

## 4. 사용자 결정·승인이 필요한 운영 배포 전제 조건 (미실행)
1. **서버 접속 및 방화벽(SSH 22 / HTTPS 443)**:
   - 현재 `boltangi-game-seoul` (`43.203.70.197`)은 HTTP 80만 열려 있고 SSH 22가 닫혀 있음.
   - 배포를 위해 임시 SSH 허용(본인 IP 한정) 및 **HTTPS 443 포트 개방** 승인 필요.
2. **CDN → Origin 구간 TLS 암호화**:
   - 현재 `boltangi-game-cdn` ↔ Origin 구간이 `HTTP only`로 설정되어 있음.
   - 실사용자 로그인/토큰(`Authorization: Bearer`) 통신 전, Origin 서버에 **443 TLS 인증서(Let's Encrypt 또는 Cloudflare Origin CA)**를 설치하고 CDN Origin 프로토콜을 HTTPS로 전환해야 함.
3. **데이터 보관·백업·로그 정책 확인**:
   - 실사용자 데이터 투입 시 `data/battle-store.json` 일일 외부 스냅샷(S3 또는 Lightsail 스냅샷) 및 개인정보 처리방침 안내 확인 필요.
