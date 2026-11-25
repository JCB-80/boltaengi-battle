// 볼탱이 대전 — 1GB Lightsail 환경용 원자적 디스크 영속 저장소 (JSON + .bak 이중화)
// 영속 대상: 계정(테스트/가입 프로필), 전적(xp, wins, matches), 버전(낙관적 락), 완료된 idempotencyKey
// 비영속 대상(만료 설계): 초대 코드, 진행 중 방 세션, 일회성 memberToken (server.mjs 인메모리 TTL 관리)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { caseFold } from 'unicode-case-folding';

const DEFAULT_MAX_IDEMPOTENCY_KEYS = 2000;

function sanitizeText(value, maxLen = 40) {
  return String(value || '')
    .trim()
    .slice(0, maxLen);
}

function cleanNickname(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFKC').trim();
  if ([...name].length < 2 || [...name].length > 16) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N}_ -]*$/u.test(name) || name.includes('  ')) return null;
  return name;
}

function nicknameKey(name) {
  return caseFold(name.normalize('NFKC')).normalize('NFKC');
}

function computeAccountScore(acc) {
  if (typeof acc.score === 'number' && Number.isFinite(acc.score)) {
    return Math.max(0, Math.floor(acc.score));
  }
  const wins = Math.max(0, Number(acc.wins) || 0);
  const matches = Math.max(0, Number(acc.matches) || 0);
  return wins * 100 + Math.max(0, matches - wins) * 10;
}

function makePublicAccount(acc) {
  return {
    accountId: acc.accountId,
    userId: acc.userId,
    nickname: acc.nickname,
    provider: acc.provider || null,
    needsNickname: !acc.provider || !acc.nickname,
    xp: acc.xp,
    wins: acc.wins,
    matches: acc.matches,
    score: computeAccountScore(acc),
    version: acc.version,
    migratedLocalAt: acc.migratedLocalAt || null,
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
  };
}

export class StoreError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class BattlePersistentStore {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data');
    this.filePath = options.filePath || path.join(this.dataDir, 'battle-store.json');
    this.bakPath = `${this.filePath}.bak`;
    this.tmpPath = `${this.filePath}.tmp`;
    this.maxIdempotencyKeys = options.maxIdempotencyKeys || DEFAULT_MAX_IDEMPOTENCY_KEYS;

    this.state = {
      schemaVersion: 2,
      accountsById: {},
      tokenToAccountId: {},
      userIdToAccountId: {},
      processedKeys: [], // ordered array of { key, accountId, appliedAt, summary }
    };
    this.processedKeyMap = new Map();
    this.recoveredFromBackup = false;

    this.#loadFromDisk();
    if (this.state.schemaVersion === 1) {
      for (const acc of Object.values(this.state.accountsById)) {
        delete acc.schoolName;
        delete acc.className;
      }
      this.state.schemaVersion = 2;
      this.#flushBackupFirst();
    }
  }

  #validatePayload(parsed) {
    return (
      parsed &&
      typeof parsed === 'object' &&
      [1, 2].includes(parsed.schemaVersion) &&
      parsed.accountsById &&
      typeof parsed.accountsById === 'object' &&
      parsed.tokenToAccountId &&
      typeof parsed.tokenToAccountId === 'object' &&
      parsed.userIdToAccountId &&
      typeof parsed.userIdToAccountId === 'object' &&
      Array.isArray(parsed.processedKeys)
    );
  }

  #tryReadJson(targetPath) {
    if (!fs.existsSync(targetPath)) return null;
    const raw = fs.readFileSync(targetPath, 'utf8');
    if (!raw.trim()) throw new Error('EMPTY_FILE');
    const parsed = JSON.parse(raw);
    if (!this.#validatePayload(parsed)) {
      throw new Error('INVALID_SCHEMA');
    }
    return parsed;
  }

  #rebuildIndex() {
    this.processedKeyMap.clear();
    for (const entry of this.state.processedKeys) {
      if (entry && entry.key) {
        this.processedKeyMap.set(entry.key, entry);
      }
    }
  }

  #loadFromDisk() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    let primaryError = null;

    try {
      const primary = this.#tryReadJson(this.filePath);
      if (primary) {
        this.state = primary;
        this.#rebuildIndex();
        return;
      }
    } catch (err) {
      primaryError = err;
    }

    // 주 파일이 손상되었거나 비어 있으면 .bak에서 자동 복구
    try {
      const backup = this.#tryReadJson(this.bakPath);
      if (backup) {
        this.state = backup;
        this.#rebuildIndex();
        this.recoveredFromBackup = Boolean(primaryError);
        this.#flushToDisk();
        return;
      }
    } catch (bakErr) {
      if (primaryError) {
        throw new Error(
          `Store corrupted (primary: ${primaryError.message}, backup: ${bakErr.message})`
        );
      }
    }

    if (primaryError && !fs.existsSync(this.bakPath)) {
      throw new Error(`Primary store corrupted without backup: ${primaryError.message}`);
    }

    this.#flushToDisk();
  }

  #flushToDisk() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const json = JSON.stringify(this.state, null, 2);

    // 1) 임시 파일에 기록 -> fsync -> 주 파일로 원자적 rename
    const fd = fs.openSync(this.tmpPath, 'w', 0o600);
    try {
      fs.writeFileSync(fd, json, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(this.tmpPath, this.filePath);

    // 2) 주 파일 커밋 성공 후 .bak에도 최신 정상 스냅샷을 원자적으로 동기화
    const bakTmpPath = `${this.bakPath}.tmp`;
    const bakFd = fs.openSync(bakTmpPath, 'w', 0o600);
    try {
      fs.writeFileSync(bakFd, json, 'utf8');
      fs.fsyncSync(bakFd);
    } finally {
      fs.closeSync(bakFd);
    }
    fs.renameSync(bakTmpPath, this.bakPath);
  }

  #flushBackupFirst() {
    // The primary rename commits the change after its recovery copy is durable.
    const json = JSON.stringify(this.state, null, 2);
    const backupTmp = `${this.bakPath}.tmp`;
    for (const tempPath of [backupTmp, this.tmpPath]) {
      const fd = fs.openSync(tempPath, 'w', 0o600);
      try {
        fs.writeFileSync(fd, json, 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
    fs.renameSync(backupTmp, this.bakPath);
    fs.renameSync(this.tmpPath, this.filePath);
  }

  #recordIdempotencyKey(key, accountId, summary) {
    const entry = {
      key,
      accountId,
      appliedAt: Date.now(),
      summary,
    };
    this.state.processedKeys.push(entry);
    this.processedKeyMap.set(key, entry);

    while (this.state.processedKeys.length > this.maxIdempotencyKeys) {
      const removed = this.state.processedKeys.shift();
      if (removed && removed.key) {
        this.processedKeyMap.delete(removed.key);
      }
    }
  }

  #persistIdentity(next) {
    const { accountId, userId, accountToken } = next;
    const previous = this.state.accountsById[accountId];
    this.state.accountsById[accountId] = next;
    this.state.userIdToAccountId[userId] = accountId;
    this.state.tokenToAccountId[accountToken] = accountId;
    try {
      this.#flushBackupFirst();
    } catch (err) {
      if (previous) this.state.accountsById[accountId] = previous;
      else {
        delete this.state.accountsById[accountId];
        delete this.state.userIdToAccountId[userId];
        delete this.state.tokenToAccountId[accountToken];
      }
      throw err;
    }
  }

  #nicknameInUse(nickname, ownId) {
    const key = nicknameKey(nickname);
    return Object.values(this.state.accountsById).some((acc) =>
      acc.accountId !== ownId && acc.credentialVersion === 2 && cleanNickname(acc.nickname)
      && nicknameKey(acc.nickname.trim()) === key
    );
  }

  #checkNickname(value, ownId) {
    const nickname = cleanNickname(value);
    if (!nickname) throw new StoreError(400, 'INVALID_NICKNAME', '닉네임 길이와 사용 가능한 문자를 확인해 주세요.');
    if (this.#nicknameInUse(nickname, ownId)) throw new StoreError(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임입니다.');
    return nickname;
  }

  findAccountByNickname(value) {
    const nickname = cleanNickname(value);
    if (!nickname) throw new StoreError(400, 'INVALID_NICKNAME', '닉네임을 확인해 주세요.');
    const key = nicknameKey(nickname);
    const account = Object.values(this.state.accountsById).find((acc) =>
      acc.provider && acc.nickname && nicknameKey(acc.nickname) === key
    );
    return account ? makePublicAccount(account) : null;
  }

  setNickname(accountToken, value) {
    const owner = this.authenticateAccount(accountToken);
    if (!owner.provider) throw new StoreError(403, 'SOCIAL_LOGIN_REQUIRED', '소셜 로그인이 필요합니다.');
    const acc = this.state.accountsById[owner.accountId];
    const next = { ...acc, nickname: this.#checkNickname(value, acc.accountId), updatedAt: Date.now() };
    this.#persistIdentity(next);
    return makePublicAccount(next);
  }

  // Invoked only after the OAuth handler verifies the issuer and its stable subject.
  loginWithSocialIdentity({ provider, subject, nickname, accountToken }) {
    if (!['google', 'kakao', 'naver', 'apple'].includes(provider) || typeof subject !== 'string' ||
        !subject.trim() || subject.length > 512) {
      throw new StoreError(400, 'INVALID_IDENTITY', '소셜 계정을 확인할 수 없습니다.');
    }
    const linked = Object.values(this.state.accountsById).find((acc) =>
      acc.provider === provider && acc.providerSubject === subject
    );
    const owner = accountToken ? this.authenticateAccount(accountToken) : null;
    const old = owner ? this.state.accountsById[owner.accountId] : null;
    if (old && ((linked && old !== linked) || (old.provider && old !== linked))) {
      throw new StoreError(409, 'ACCOUNT_LINK_CONFLICT', '이미 다른 소셜 계정에 연결되어 있습니다.');
    }
    if (linked && (linked.nickname || !nickname)) {
      return { created: false, accountToken: linked.accountToken, account: makePublicAccount(linked) };
    }
    if (old || linked) {
      const next = { ...(linked || old), provider, providerSubject: subject, updatedAt: Date.now() };
      const retained = cleanNickname(next.nickname);
      if (nickname) next.nickname = this.#checkNickname(nickname, next.accountId);
      else next.nickname = retained && !this.#nicknameInUse(retained, next.accountId) ? retained : '';
      this.#persistIdentity(next);
      return { created: false, accountToken: next.accountToken, account: makePublicAccount(next) };
    }
    const displayName = nickname ? this.#checkNickname(nickname) : '';
    const id = `acct_${crypto.randomUUID()}`;
    const token = `btl2_${crypto.randomBytes(24).toString('hex')}`;
    const now = Date.now();
    const fresh = {
      accountId: id, userId: id, nickname: displayName, provider, providerSubject: subject,
      xp: 0, wins: 0, matches: 0, score: 0, version: 1, migratedLocalAt: null,
      accountToken: token, credentialVersion: 2, createdAt: now, updatedAt: now,
    };
    this.#persistIdentity(fresh);
    return { created: true, accountToken: token, account: makePublicAccount(fresh) };
  }

  registerOrLoginAccount({ userId, accountToken }) {
    if (!accountToken) throw new StoreError(403, 'SOCIAL_LOGIN_REQUIRED', '소셜 로그인이 필요합니다.');
    const account = this.authenticateAccount(accountToken);
    if (account.userId !== userId) throw new StoreError(403, 'FORBIDDEN_ACCOUNT', '다른 계정입니다.');
    return { created: false, accountToken, account };
  }

  authenticateAccount(accountToken, expectedAccountId = null) {
    if (!accountToken || typeof accountToken !== 'string') {
      throw new StoreError(401, 'UNAUTHORIZED', '계정 Bearer 토큰이 필요합니다.');
    }
    const accountId = this.state.tokenToAccountId[accountToken];
    const acc = accountId ? this.state.accountsById[accountId] : null;
    if (!acc) {
      throw new StoreError(401, 'INVALID_TOKEN', '유효하지 않은 계정 토큰입니다.');
    }
    if (acc.credentialVersion !== 2 || !accountToken.startsWith('btl2_')) {
      throw new StoreError(401, 'ACCOUNT_RECOVERY_REQUIRED', '기존 계정은 별도 소유권 확인이 필요합니다.');
    }
    if (expectedAccountId && acc.accountId !== expectedAccountId) {
      throw new StoreError(403, 'FORBIDDEN_ACCOUNT', '다른 계정의 데이터에 접근할 수 없습니다.');
    }
    return makePublicAccount(acc);
  }

  deleteAccount(accountToken) {
    const account = this.authenticateAccount(accountToken);
    const acc = this.state.accountsById[account.accountId];
    const previousState = structuredClone(this.state);
    delete this.state.accountsById[account.accountId];
    delete this.state.userIdToAccountId[acc.userId];
    for (const [token, id] of Object.entries(this.state.tokenToAccountId)) {
      if (id === account.accountId) delete this.state.tokenToAccountId[token];
    }
    this.state.processedKeys = this.state.processedKeys.filter(entry => entry.accountId !== account.accountId);
    this.#rebuildIndex();
    try {
      this.#flushBackupFirst();
    } catch (err) {
      this.state = previousState;
      this.#rebuildIndex();
      throw err;
    }
    return account;
  }

  applyReward({
    accountToken,
    accountId = null,
    idempotencyKey,
    deltaXp = 0,
    win = false,
    matchCompleted = true,
    expectedVersion = null,
  }) {
    const publicAcc = this.authenticateAccount(accountToken, accountId);
    const cleanKey = sanitizeText(idempotencyKey, 96);
    if (!cleanKey) {
      throw new StoreError(400, 'MISSING_IDEMPOTENCY_KEY', 'idempotencyKey가 필요합니다.');
    }

    const existingEntry = this.processedKeyMap.get(cleanKey);
    if (existingEntry) {
      if (existingEntry.accountId !== publicAcc.accountId) {
        throw new StoreError(403, 'IDEMPOTENCY_KEY_MISMATCH', '다른 계정의 idempotencyKey입니다.');
      }
      // A prior disk write may have failed after the in-memory mutation. Retrying
      // the same reward must commit both copies before claiming success.
      this.#flushToDisk();
      return {
        deduplicated: true,
        account: makePublicAccount(this.state.accountsById[publicAcc.accountId]),
      };
    }

    const acc = this.state.accountsById[publicAcc.accountId];
    if (expectedVersion !== null && expectedVersion !== undefined) {
      if (Number(expectedVersion) !== acc.version) {
        throw new StoreError(
          409,
          'SAVE_CONFLICT',
          `버전 충돌: expected=${expectedVersion}, current=${acc.version}`
        );
      }
    }

    const safeDeltaXp = Math.max(0, Math.min(2000, Math.floor(Number(deltaXp) || 0)));
    acc.xp += safeDeltaXp;
    acc.score = computeAccountScore(acc);
    if (win) {
      acc.wins += 1;
      acc.score += 100;
    } else if (matchCompleted) {
      acc.score += 10;
    }
    if (matchCompleted) acc.matches += 1;
    acc.version += 1;
    acc.updatedAt = Date.now();

    this.#recordIdempotencyKey(cleanKey, acc.accountId, {
      type: 'reward',
      deltaXp: safeDeltaXp,
      win: Boolean(win),
    });
    this.#flushToDisk();

    return {
      deduplicated: false,
      account: makePublicAccount(acc),
    };
  }

  migrateLocalProgress({
    accountToken,
    idempotencyKey,
    localXp = 0,
    localWins = 0,
    localMatches = 0,
    expectedVersion = null,
  }) {
    const publicAcc = this.authenticateAccount(accountToken);
    const cleanKey = sanitizeText(idempotencyKey, 96);
    if (!cleanKey) {
      throw new StoreError(400, 'MISSING_IDEMPOTENCY_KEY', 'idempotencyKey가 필요합니다.');
    }

    const existingEntry = this.processedKeyMap.get(cleanKey);
    if (existingEntry) {
      if (existingEntry.accountId !== publicAcc.accountId) {
        throw new StoreError(403, 'IDEMPOTENCY_KEY_MISMATCH', '다른 계정의 idempotencyKey입니다.');
      }
      return {
        deduplicated: true,
        account: makePublicAccount(this.state.accountsById[publicAcc.accountId]),
      };
    }

    const acc = this.state.accountsById[publicAcc.accountId];
    if (expectedVersion !== null && expectedVersion !== undefined) {
      if (Number(expectedVersion) !== acc.version) {
        throw new StoreError(
          409,
          'SAVE_CONFLICT',
          `버전 충돌: expected=${expectedVersion}, current=${acc.version}`
        );
      }
    }

    const safeXp = Math.max(0, Math.min(100000, Math.floor(Number(localXp) || 0)));
    const safeWins = Math.max(0, Math.min(10000, Math.floor(Number(localWins) || 0)));
    const safeMatches = Math.max(0, Math.min(20000, Math.floor(Number(localMatches) || 0)));

    acc.xp = Math.max(acc.xp, safeXp);
    acc.wins = Math.max(acc.wins, safeWins);
    acc.matches = Math.max(acc.matches, safeMatches);
    acc.migratedLocalAt = acc.migratedLocalAt || Date.now();
    acc.version += 1;
    acc.updatedAt = Date.now();

    this.#recordIdempotencyKey(cleanKey, acc.accountId, {
      type: 'migrate_local',
      safeXp,
      safeWins,
      safeMatches,
    });
    this.#flushToDisk();

    return {
      deduplicated: false,
      account: makePublicAccount(acc),
    };
  }

  getLeaderboard(options = 20) {
    const opts = typeof options === 'number' ? { limit: options } : options || {};
    const limit = Math.max(1, Math.trunc(Number(opts.limit)) || 20);
    const text = (opts.q || '').trim();
    if ([...text].length > 64) throw new StoreError(400, 'SEARCH_QUERY_TOO_LONG', '검색어가 너무 깁니다.');
    const query = nicknameKey(text);
    const sortByRank = (a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.matches !== a.matches) return b.matches - a.matches;
      return b.xp - a.xp;
    };

    const RANKS = [
      { level: 1, minXp: 0, title: '견습 발명가', badge: '🌱' },
      { level: 2, minXp: 100, title: '숲속 석궁수', badge: '🥉' },
      { level: 3, minXp: 250, title: '구름 조련사', badge: '🥈' },
      { level: 4, minXp: 480, title: '황금 명사수', badge: '🥇' },
      { level: 5, minXp: 800, title: '하늘 대장군', badge: '👑' },
    ];
    const resolveRank = (xpVal) => {
      let cur = RANKS[0];
      for (const r of RANKS) {
        if (xpVal >= r.minXp) cur = r;
      }
      return cur;
    };

    // Legacy tokens and historical scores could have been forged via the old API.
    // Keep the data for recovery, but do not present it as verified competition.
    const allAccounts = Object.values(this.state.accountsById).filter(acc => acc.credentialVersion === 2 && acc.provider && acc.nickname).map((acc) => {
      const wins = Math.max(0, Number(acc.wins) || 0);
      const matches = Math.max(0, Number(acc.matches) || 0);
      const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
      const xp = Math.max(0, Number(acc.xp) || 0);
      const rk = resolveRank(xp);
      return {
        nickname: acc.nickname,
        wins,
        matches,
        winRate,
        score: computeAccountScore(acc),
        xp,
        rankLevel: rk.level,
        rankTitle: rk.title,
        rankBadge: rk.badge,
      };
    });

    allAccounts.sort(sortByRank);
    const leaderboard = [];
    let exactMatch = null;
    for (const [index, item] of allAccounts.entries()) {
      if (query) {
        const key = nicknameKey(item.nickname);
        if (key === query) {
          exactMatch = { rank: index + 1, ...item };
          if (opts.exact) break;
          continue;
        }
        if (opts.exact || !key.includes(query)) continue;
      }
      if (leaderboard.length < limit) leaderboard.push({ rank: index + 1, ...item });
      if (leaderboard.length >= limit && (!query || exactMatch)) break;
    }
    if (exactMatch) {
      leaderboard.unshift(exactMatch);
      if (leaderboard.length > limit) leaderboard.pop();
    }
    if (typeof options === 'number') return leaderboard;
    return { leaderboard };
  }

  getStats() {
    return {
      accountCount: Object.keys(this.state.accountsById).length,
      processedKeyCount: this.state.processedKeys.length,
      recoveredFromBackup: this.recoveredFromBackup,
      filePath: this.filePath,
      bakPath: this.bakPath,
    };
  }
}
