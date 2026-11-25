// Preserve existing account IDs for migration. Only the nickname is a public identity.
const PROFILE_KEY = 'puffpuff_user_profile_v1';

function publicProfile(account) {
  return {
    userId: account.userId,
    nickname: String(account.nickname || ''),
    provider: account.provider || null,
    needsNickname: Boolean(account.needsNickname),
  };
}

// Older versions cached directory entries and profiles containing school affiliation.
export function migrateLocalProfiles() {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of [PROFILE_KEY, 'puffpuff_friends_v1', 'puffpuff_community_users_v1', 'puffpuff_latest_challenge_v1']) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const clean = JSON.parse(raw, (field, value) =>
          field === 'schoolName' || field === 'className' ? undefined : value);
        const updated = JSON.stringify(clean);
        if (updated !== raw) storage.setItem(key, updated);
      } catch { /* A damaged legacy cache must not prevent starting the game. */ }
    }
  }
}

export function loadUserProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_KEY) || sessionStorage.getItem(PROFILE_KEY);
    const value = JSON.parse(stored);
    return value?.userId ? publicProfile(value) : null;
  } catch { return null; }
}

export function saveUserProfile(account) {
  const profile = publicProfile(account);
  const value = JSON.stringify(profile);
  localStorage.setItem(PROFILE_KEY, value);
  sessionStorage.setItem(PROFILE_KEY, value);
  return profile;
}

export function clearUserProfile() {
  localStorage.removeItem(PROFILE_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem('puffpuff_bound_device_uid_v1');
}
