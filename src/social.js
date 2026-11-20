// 말랑포포: 폭신폭신 공성전 — 회원가입(학교·반 정보), 친구 초대, 반대전/학교대전/랜덤매칭 관리
import { CHARACTER_LIST } from './config.js';

const PROFILE_STORAGE_KEY = 'puffpuff_user_profile_v1';
const FRIENDS_STORAGE_KEY = 'puffpuff_friends_v1';
const DIRECTORY_STORAGE_KEY = 'puffpuff_community_users_v1';
const CHALLENGE_STORAGE_KEY = 'puffpuff_latest_challenge_v1';

export const POPULAR_SCHOOLS = [
  '말랑초등학교',
  '푸딩초등학교',
  '크루아상중학교',
  '슈가봉봉고등학교',
  '딸기우유초등학교',
  '초코파이중학교',
];

export const POPULAR_CLASSES = [
  '1학년 1반',
  '2학년 3반',
  '3학년 1반',
  '3학년 2반',
  '4학년 2반',
  '5학년 1반',
  '6학년 3반',
];

export const SAMPLE_DIRECTORY = [
  { userId: 'berry_queen', nickname: '베리여왕', schoolName: '말랑초등학교', className: '3학년 2반', charKey: 'F11_BERRY' },
  { userId: 'choco_king', nickname: '초코대장', schoolName: '말랑초등학교', className: '3학년 1반', charKey: 'M06_CHOCO' },
  { userId: 'pudding_cat', nickname: '푸딩냥이', schoolName: '푸딩초등학교', className: '3학년 2반', charKey: 'F12_PUDDING' },
  { userId: 'cream_hero', nickname: '슈크림왕자', schoolName: '크루아상중학교', className: '1학년 3반', charKey: 'M04_CREAM' },
  { userId: 'gamja_power', nickname: '포슬감자', schoolName: '슈가봉봉고등학교', className: '2학년 1반', charKey: 'M10_GAMJA' },
  { userId: 'cherry_pong', nickname: '체리톡톡', schoolName: '딸기우유초등학교', className: '4학년 2반', charKey: 'F15_CHERRY' },
  { userId: 'milktea_boba', nickname: '버블티요정', schoolName: '초코파이중학교', className: '2학년 4반', charKey: 'F20_MILKTEA' },
  { userId: 'kong_tori', nickname: '콩떡이', schoolName: '말랑초등학교', className: '3학년 2반', charKey: 'M02_KONG' },
  { userId: 'macaron_star', nickname: '마카롱별', schoolName: '푸딩초등학교', className: '5학년 1반', charKey: 'F13_MACARON' },
  { userId: 'sausage_boom', nickname: '소시지붐', schoolName: '크루아상중학교', className: '3학년 1반', charKey: 'M08_SAUSAGE' },
];

const schoolSearchCache = new Map();

export async function searchKoreanSchools(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  if (schoolSearchCache.has(q)) return schoolSearchCache.get(q);

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=10&SCHUL_NM=${encodeURIComponent(q)}`;
    const fetchOpts = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(3000) } : {};
    const res = await fetch(url, fetchOpts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = data?.schoolInfo?.[1]?.row || [];
    const results = rows.map((r) => ({
      name: r.SCHUL_NM,
      region: r.LCTN_SC_NM || '',
      address: r.ORG_RDNMA || '',
      kind: r.SCHUL_KND_SC_NM || '',
    }));
    schoolSearchCache.set(q, results);
    return results;
  } catch {
    return POPULAR_SCHOOLS.filter((s) => s.includes(q)).map((name) => ({
      name,
      region: '',
      address: '',
      kind: '',
    }));
  }
}

export function loadUserProfile() {
  try {
    const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUserProfile(profile) {
  const clean = {
    userId: String(profile.userId || '').trim(),
    nickname: String(profile.nickname || profile.userId || '').trim(),
    schoolName: String(profile.schoolName || '').trim(),
    className: String(profile.className || '').trim(),
    registeredAt: profile.registeredAt || Date.now(),
  };
  const json = JSON.stringify(clean);
  sessionStorage.setItem(PROFILE_STORAGE_KEY, json);
  localStorage.setItem(PROFILE_STORAGE_KEY, json);
  registerCommunityUser(clean);
  return clean;
}

export function getCommunityDirectory() {
  let saved = [];
  try {
    const raw = localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) saved = parsed;
    }
  } catch {
    // ignore
  }
  const byId = new Map();
  for (const p of [...saved, ...SAMPLE_DIRECTORY]) {
    if (p?.userId) byId.set(p.userId.toLowerCase(), p);
  }
  return Array.from(byId.values());
}

export function registerCommunityUser(profile) {
  if (!profile?.userId) return;
  let saved = [];
  try {
    const raw = localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw) || [];
  } catch {
    saved = [];
  }
  const randomChar = CHARACTER_LIST[Math.floor(Math.random() * CHARACTER_LIST.length)].id;
  const entry = {
    userId: profile.userId,
    nickname: profile.nickname,
    schoolName: profile.schoolName,
    className: profile.className,
    charKey: profile.charKey || randomChar,
  };
  const next = [entry, ...saved.filter((u) => u.userId?.toLowerCase() !== profile.userId.toLowerCase())].slice(0, 50);
  localStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(next));
}

export function searchOpponents({ scope = 'school', query = '', myProfile = null } = {}) {
  const all = getCommunityDirectory();
  const q = String(query || '').trim().toLowerCase();
  const myId = myProfile?.userId?.toLowerCase() || '';
  const mySchool = (myProfile?.schoolName || '').trim();
  const myClass = (myProfile?.className || '').trim();

  return all.filter((u) => {
    if (myId && u.userId.toLowerCase() === myId) return false;
    if (scope === 'class') {
      if (mySchool && u.schoolName !== mySchool) return false;
      if (myClass && u.className !== myClass) return false;
    } else if (scope === 'school') {
      if (mySchool && u.schoolName !== mySchool) return false;
    }
    if (!q) return true;
    return (
      u.userId.toLowerCase().includes(q) ||
      u.nickname.toLowerCase().includes(q) ||
      u.schoolName.toLowerCase().includes(q) ||
      u.className.toLowerCase().includes(q)
    );
  });
}

let challengeChannel = null;
function getChallengeChannel() {
  if (!challengeChannel && typeof BroadcastChannel !== 'undefined') {
    challengeChannel = new BroadcastChannel('puffpuff_challenge_bus_v1');
  }
  return challengeChannel;
}

export function sendChallengeSignal(fromProfile, targetOpponent, meta = {}) {
  const payload = {
    id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: fromProfile,
    toUserId: targetOpponent.userId,
    toOpponent: targetOpponent,
    meta,
    ts: Date.now(),
  };
  try {
    getChallengeChannel()?.postMessage(payload);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
  return payload;
}

export function subscribeChallenges(getMyUserId, onIncomingChallenge) {
  const seen = new Set();
  const handlePayload = (payload) => {
    if (!payload || !payload.id || seen.has(payload.id)) return;
    seen.add(payload.id);
    const myId = (getMyUserId?.() || '').trim().toLowerCase();
    const targetId = (payload.toUserId || '').trim().toLowerCase();
    // 본인 아이디가 대상이거나, 테스트/브로드캐스트용으로 수신 허용
    if (myId && targetId === myId) {
      onIncomingChallenge(payload);
    }
  };

  const ch = getChallengeChannel();
  if (ch) {
    ch.addEventListener('message', (e) => handlePayload(e.data));
  }
  window.addEventListener('storage', (e) => {
    if (e.key === CHALLENGE_STORAGE_KEY && e.newValue) {
      try {
        handlePayload(JSON.parse(e.newValue));
      } catch {
        // ignore
      }
    }
  });
}

export function loadFriends() {
  try {
    const raw = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const defaults = SAMPLE_DIRECTORY.slice(0, 3);
  localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

export function addFriendById(userId, extra = {}) {
  const cleanId = String(userId || '').trim();
  if (!cleanId) return null;
  const friends = loadFriends();
  const existing = friends.find((f) => f.userId.toLowerCase() === cleanId.toLowerCase());
  if (existing) return existing;

  const fromDir = SAMPLE_DIRECTORY.find((p) => p.userId.toLowerCase() === cleanId.toLowerCase());
  const randomChar = CHARACTER_LIST[Math.floor(Math.random() * CHARACTER_LIST.length)].id;
  const newFriend = fromDir
    ? { ...fromDir }
    : {
        userId: cleanId,
        nickname: extra.nickname || cleanId,
        schoolName: extra.schoolName || '말랑초등학교',
        className: extra.className || '3학년 2반',
        charKey: extra.charKey || randomChar,
      };

  const next = [newFriend, ...friends].slice(0, 20);
  localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(next));
  return newFriend;
}

export function resolveOpponentById(userId, fallbackSchool = '말랑초등학교', fallbackClass = '3학년 2반') {
  const cleanId = String(userId || '').trim() || 'friend_01';
  const fromDir = SAMPLE_DIRECTORY.find((p) => p.userId.toLowerCase() === cleanId.toLowerCase());
  if (fromDir) return { ...fromDir };

  const friends = loadFriends();
  const fromFriends = friends.find((f) => f.userId.toLowerCase() === cleanId.toLowerCase());
  if (fromFriends) return { ...fromFriends };

  const randomChar = CHARACTER_LIST[Math.floor(Math.random() * CHARACTER_LIST.length)].id;
  return {
    userId: cleanId,
    nickname: cleanId,
    schoolName: fallbackSchool,
    className: fallbackClass,
    charKey: randomChar,
  };
}

export function pickRandomOpponent(excludeSchool = '', excludeClass = '') {
  const pool = SAMPLE_DIRECTORY.filter(
    (p) => !(p.schoolName === excludeSchool && p.className === excludeClass)
  );
  const targetPool = pool.length > 0 ? pool : SAMPLE_DIRECTORY;
  return { ...targetPool[Math.floor(Math.random() * targetPool.length)] };
}

export function shortSchoolLabel(schoolName) {
  if (!schoolName) return '무소속';
  return schoolName
    .replace('초등학교', '초')
    .replace('중학교', '중')
    .replace('고등학교', '고');
}

export function buildInviteUrl(profile, roomCode) {
  const url = new URL(window.location.href.split('?')[0]);
  url.searchParams.set('invite', roomCode);
  if (profile) {
    url.searchParams.set('hostId', profile.userId);
    url.searchParams.set('hostNick', profile.nickname);
    url.searchParams.set('hostSchool', profile.schoolName);
    url.searchParams.set('hostClass', profile.className);
  }
  return url.toString();
}

export function parseInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  if (!invite) return null;
  return {
    roomCode: invite,
    hostId: params.get('hostId') || 'friend_host',
    hostNick: params.get('hostNick') || params.get('hostId') || '초대한 친구',
    hostSchool: params.get('hostSchool') || '말랑초등학교',
    hostClass: params.get('hostClass') || '3학년 2반',
  };
}
