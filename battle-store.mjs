// 볼탱이 대전 — 1GB Lightsail 환경용 원자적 디스크 영속 저장소 (JSON + .bak 이중화)
// 영속 대상: 계정(테스트/가입 프로필), 전적(xp, wins, matches), 버전(낙관적 락), 완료된 idempotencyKey
// 비영속 대상(만료 설계): 초대 코드, 진행 중 방 세션, 일회성 memberToken (server.mjs 인메모리 TTL 관리)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_MAX_IDEMPOTENCY_KEYS = 2000;

function sanitizeText(value, maxLen = 40) {
  return String(value || '')
    .trim()
    .slice(0, maxLen);
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
    schoolName: acc.schoolName,
    className: acc.className,
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
      schemaVersion: 1,
      accountsById: {},
      tokenToAccountId: {},
      userIdToAccountId: {},
      processedKeys: [], // ordered array of { key, accountId, appliedAt, summary }
    };
    this.processedKeyMap = new Map();
    this.recoveredFromBackup = false;

    this.#loadFromDisk();
  }

  #validatePayload(parsed) {
    return (
      parsed &&
      typeof parsed === 'object' &&
      parsed.schemaVersion === 1 &&
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

  registerOrLoginAccount({ userId, nickname, schoolName = '', className = '' }) {
    const cleanUserId = sanitizeText(userId, 48);
    if (!cleanUserId) {
      throw new StoreError(400, 'INVALID_USER_ID', 'userId가 필요합니다.');
    }

    const now = Date.now();
    const existingAccountId = this.state.userIdToAccountId[cleanUserId];
    if (existingAccountId && this.state.accountsById[existingAccountId]) {
      const acc = this.state.accountsById[existingAccountId];
      if (nickname) acc.nickname = sanitizeText(nickname, 24) || acc.nickname;
      if (schoolName) acc.schoolName = sanitizeText(schoolName, 32);
      if (className) acc.className = sanitizeText(className, 24);
      acc.updatedAt = now;
      this.#flushToDisk();
      return {
        created: false,
        accountToken: acc.accountToken,
        account: makePublicAccount(acc),
      };
    }

    const accountId = `acct_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const accountToken = `btl_${crypto.randomBytes(24).toString('hex')}`;
    const acc = {
      accountId,
      userId: cleanUserId,
      nickname: sanitizeText(nickname, 24) || cleanUserId,
      schoolName: sanitizeText(schoolName, 32),
      className: sanitizeText(className, 24),
      xp: 0,
      wins: 0,
      matches: 0,
      score: 0,
      version: 1,
      migratedLocalAt: null,
      accountToken,
      createdAt: now,
      updatedAt: now,
    };

    this.state.accountsById[accountId] = acc;
    this.state.userIdToAccountId[cleanUserId] = accountId;
    this.state.tokenToAccountId[accountToken] = accountId;
    this.#flushToDisk();

    return {
      created: true,
      accountToken,
      account: makePublicAccount(acc),
    };
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
    if (expectedAccountId && acc.accountId !== expectedAccountId) {
      throw new StoreError(403, 'FORBIDDEN_ACCOUNT', '다른 계정의 데이터에 접근할 수 없습니다.');
    }
    return makePublicAccount(acc);
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
    const limit = Math.max(1, Number(opts.limit) || 20);
    const scope = opts.scope === 'school' || opts.scope === 'class' ? opts.scope : 'all';
    const schoolName = String(opts.schoolName || '').trim();
    const className = String(opts.className || '').trim();

    const sortByRank = (a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.matches !== a.matches) return b.matches - a.matches;
      return b.xp - a.xp;
    };

    const allAccounts = Object.values(this.state.accountsById).map((acc) => {
      const wins = Math.max(0, Number(acc.wins) || 0);
      const matches = Math.max(0, Number(acc.matches) || 0);
      const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
      return {
        userId: acc.userId,
        nickname: acc.nickname,
        schoolName: acc.schoolName || '',
        className: acc.className || '',
        wins,
        matches,
        winRate,
        score: computeAccountScore(acc),
        xp: Math.max(0, Number(acc.xp) || 0),
      };
    });

    const filtered = allAccounts.filter((item) => {
      if (scope === 'school' && schoolName) return item.schoolName === schoolName;
      if (scope === 'class' && schoolName && className) {
        return item.schoolName === schoolName && item.className === className;
      }
      return true;
    });

    filtered.sort(sortByRank);
    const leaderboard = filtered.slice(0, limit).map((item, idx) => ({
      rank: idx + 1,
      ...item,
    }));

    const schoolPeers = schoolName ? allAccounts.filter((item) => item.schoolName === schoolName) : [];
    schoolPeers.sort(sortByRank);
    const schoolTop = schoolPeers[0] ? { rank: 1, ...schoolPeers[0] } : null;

    if (typeof options === 'number') return leaderboard;
    return { leaderboard, schoolTop };
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
