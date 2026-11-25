// The browser handles provider authentication. Only the app that started it can claim the result.
import { loadUserProfile, saveUserProfile, clearUserProfile } from './social.js?v=31';

const pendingKey = 'boltaengi_social_login_v1';
const providerNames = { kakao: '카카오', naver: '네이버', google: 'Google', apple: 'Apple' };
const messages = {
  NICKNAME_TAKEN: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
  INVALID_NICKNAME: '닉네임은 글자나 숫자로 시작하는 2~16자로 입력해 주세요.',
  AUTH_DENIED: '로그인을 취소했습니다.',
  AUTH_FLOW_EXPIRED: '로그인 시간이 지났습니다. 다시 시작해 주세요.',
  CONFIRMATION_CODE_INVALID: '브라우저에 표시된 여섯 자리 코드를 다시 확인해 주세요.',
  AUTH_PROVIDER_FAILED: '로그인 제공사의 응답을 확인하지 못했습니다. 다시 시도해 주세요.',
  AUTH_PROVIDER_UNAVAILABLE: '이 로그인 서비스는 아직 준비 중입니다.',
  AUTH_BUSY: '로그인이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.',
  ACCOUNT_LINK_CONFLICT: '이 소셜 계정과 기존 게임 계정의 연결을 확인해 주세요.',
  UNAUTHORIZED: '계정 인증이 만료되었습니다. 다시 로그인해 주세요.',
};

async function request(path, body, token) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/battle/' + path, {
      method: body ? 'POST' : 'GET', headers, cache: 'no-store', signal: controller.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'HTTP ' + response.status);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export function createProfileLogin({client, onProfile, onSignOut}) {
  const byId = id => document.getElementById(id);
  const modal = byId('profileModal');
  const field = byId('profNickname');
  const code = byId('loginConfirmationCode');
  const status = byId('accountStatusText');
  const launchLink = byId('continueSocialLogin');
  const buttons = [...modal.querySelectorAll('[data-social-provider]')];
  const available = new Set();
  const storage = window.AndroidBridge ? localStorage : sessionStorage;
  let flow = null;
  let timer = null;
  let polling = false;
  let busy = false;
  let afterLogin = null;
  let loginAttempt = 0;
  let availabilityFetch = 0;
  let pairing = false;

  const show = (id, visible) => byId(id).classList.toggle('hidden', !visible);
  const message = err => messages[err.message] || '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';

  function render() {
    const profile = loadUserProfile();
    const authenticated = Boolean(client.getActiveAccountAuth()?.accountToken);
    const linked = Boolean(profile?.provider && authenticated);
    const waiting = Boolean(flow);
    show('socialProviders', !linked && !waiting);
    show('loginPairing', waiting && pairing);
    show('cancelSocialLogin', waiting || (busy && !linked));
    show('saveNicknameBtn', linked && !waiting);
    show('logoutAccountBtn', linked && !waiting);
    show('deleteAccountBtn', authenticated && !waiting);
    byId('saveNicknameBtn').disabled = busy;
    byId('deleteAccountBtn').disabled = busy;
    byId('logoutAccountBtn').disabled = busy;
    byId('confirmLoginCodeBtn').disabled = busy;
    field.disabled = waiting || busy;
    for (const button of buttons) button.disabled = busy || !available.has(button.dataset.socialProvider);
    byId('profileHelp').textContent = linked
      ? providerNames[profile.provider] + ' 계정으로 연결되어 있습니다. 랭킹과 친구 초대에 이 닉네임을 사용합니다.'
      : profile && authenticated
        ? '기존 전적을 이어서 사용하려면 이 기기에서 소셜 계정을 연결하세요.'
        : '처음이라면 게임 닉네임을 정하세요. 이미 가입했다면 닉네임을 비워 두고 같은 계정으로 로그인하세요.';
  }

  function resetFlow() {
    loginAttempt++;
    clearTimeout(timer);
    flow = null;
    pairing = false;
    code.value = '';
    launchLink.removeAttribute('href');
    show('continueSocialLogin', false);
    try { storage.removeItem(pendingKey); } catch {}
  }

  function finish(account) {
    const previous = loadUserProfile();
    saveUserProfile(account);
    onProfile(account, previous);
    render();
    if (account.needsNickname) {
      field.value = '';
      status.textContent = '사용할 닉네임을 입력하고 저장해 주세요.';
      field.focus();
      return;
    }
    modal.classList.add('hidden');
    const next = afterLogin;
    afterLogin = null;
    if (next) next();
  }

  async function claim(confirmationCode) {
    if (!flow || polling) return;
    const current = flow;
    if (current.expires <= Date.now()) {
      resetFlow(); render(); status.textContent = messages.AUTH_FLOW_EXPIRED; return;
    }
    polling = true;
    clearTimeout(timer);
    try {
      const result = await request('auth/claim', {claimToken: current.claimToken, confirmationCode});
      if (flow !== current) return;
      if (result.pending) {
        if (result.confirmationRequired && !pairing) {
          pairing = true; render();
          status.textContent = '로그인 창에 표시된 확인 코드를 입력해 주세요.';
        }
      } else {
        client.activateSocialAccount(result);
        resetFlow();
        finish(result.account);
      }
    } catch (err) {
      if (flow !== current) return;
      if (['AUTH_FLOW_EXPIRED', 'AUTH_DENIED', 'AUTH_PROVIDER_FAILED', 'ACCOUNT_LINK_CONFLICT', 'UNAUTHORIZED'].includes(err.message)) resetFlow();
      status.textContent = message(err);
      render();
    } finally {
      polling = false;
      if (flow) timer = setTimeout(() => claim(), pairing ? 5000 : 1600);
    }
  }

  function submitCode(value) {
    value = value.trim();
    if (!flow || !/^\d{6}$/.test(value)) { status.textContent = '확인 코드 여섯 자리를 입력해 주세요.'; return; }
    if (polling) {
      const atSubmit = flow;
      setTimeout(() => { if (atSubmit === flow) submitCode(value); }, 200);
    } else claim(value);
  }

  let channel;
  try {
    channel = new BroadcastChannel('battle-social-confirm-v1');
    channel.onmessage = ({data}) => {
      if (flow && data?.type === 'battle-social-confirm' && data.flowId === flow.flowId &&
          typeof data.confirmationCode === 'string') submitCode(data.confirmationCode);
    };
  } catch { /* Manual confirmation is available when the browser has no BroadcastChannel. */ }

  async function start(provider) {
    if (busy || flow || !available.has(provider)) return;
    const native = typeof window.AndroidBridge?.openSocialLogin === 'function';
    const popup = native ? null : window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    const attempt = ++loginAttempt;
    busy = true; render();
    status.textContent = providerNames[provider] + ' 로그인에 연결하고 있습니다.';
    try {
      const token = client.getActiveAccountAuth()?.accountToken;
      const result = await request('auth/start', {provider, nickname: field.value.trim()}, token);
      if (attempt !== loginAttempt) { popup?.close(); return; }
      const url = new URL(result.authorizeUrl);
      if (url.origin !== location.origin || url.pathname !== '/api/battle/auth/authorize/' + provider ||
          !url.searchParams.get('ticket') || !result.claimToken || !result.flowId) throw new Error('AUTH_PROVIDER_FAILED');
      flow = {claimToken: result.claimToken, flowId: result.flowId, expires: Date.now() + 600000};
      try { storage.setItem(pendingKey, JSON.stringify(flow)); } catch {}
      launchLink.href = url.href;
      if (native) {
        if (!window.AndroidBridge.openSocialLogin(url.href)) throw new Error('AUTH_PROVIDER_FAILED');
      } else if (popup && !popup.closed) {
        popup.location.href = url.href;
      } else show('continueSocialLogin', true);
      status.textContent = '로그인 창에서 계정을 인증한 뒤 게임으로 돌아오세요.';
      claim();
    } catch (err) {
      popup?.close();
      if (attempt === loginAttempt) { resetFlow(); status.textContent = message(err); }
    } finally { busy = false; render(); }
  }

  async function open(callback) {
    afterLogin = typeof callback === 'function' ? callback : null;
    const profile = loadUserProfile();
    field.value = profile?.needsNickname ? '' : profile?.nickname || '';
    modal.classList.remove('hidden');
    if (!flow) status.textContent = '';
    render();
    if (flow || (profile?.provider && client.getActiveAccountAuth())) return;
    const current = ++availabilityFetch;
    available.clear(); render();
    try {
      const {providers} = await request('auth/providers');
      if (current !== availabilityFetch) return;
      for (const id of providers || []) if (providerNames[id]) available.add(id);
      if (!available.size) status.textContent = '소셜 로그인 준비 중입니다. 로컬 대전은 바로 즐길 수 있어요.';
    } catch { status.textContent = '로그인 서버에 연결할 수 없습니다. 로컬 대전은 바로 즐길 수 있어요.'; }
    render();
  }

  function close() {
    afterLogin = null;
    resetFlow();
    modal.classList.add('hidden');
    render();
  }

  for (const button of buttons) button.addEventListener('click', () => start(button.dataset.socialProvider));
  byId('confirmLoginCodeBtn').addEventListener('click', () => submitCode(code.value));
  byId('cancelSocialLogin').addEventListener('click', () => { resetFlow(); render(); status.textContent = messages.AUTH_DENIED; });
  byId('closeProfileModalBtn').addEventListener('click', close);
  byId('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (pairing) { submitCode(code.value); return; }
    if (busy || flow || !loadUserProfile()?.provider) return;
    if (!field.value.trim()) { field.focus(); status.textContent = '닉네임을 입력해 주세요.'; return; }
    busy = true; render();
    try {
      const result = await request('accounts/nickname', {nickname: field.value.trim()}, client.getActiveAccountAuth()?.accountToken);
      finish(result.account);
    } catch (err) { status.textContent = message(err); }
    finally { busy = false; render(); }
  });

  async function signOut(remove) {
    if (busy || flow || !client.getActiveAccountAuth()) return;
    if (remove && !window.confirm('계정과 서버 전적을 삭제할까요? 삭제한 전적은 복구할 수 없습니다.')) return;
    busy = true; render();
    const profile = loadUserProfile();
    try {
      if (remove) await client.deleteAccount();
      client.clearSession();
      client.forgetAccount();
      clearUserProfile();
      if (remove && profile) localStorage.removeItem('puffpuff_stats_' + profile.userId.toLowerCase());
      onSignOut(remove ? profile?.userId : null);
      close();
    } catch (err) { status.textContent = message(err); }
    finally { busy = false; render(); }
  }
  byId('logoutAccountBtn').addEventListener('click', () => signOut(false));
  byId('deleteAccountBtn').addEventListener('click', () => signOut(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && flow) claim(); });
  function resume() {
    try { flow = JSON.parse(storage.getItem(pendingKey)); } catch {}
    if (!flow?.claimToken || flow.expires <= Date.now()) { resetFlow(); return; }
    modal.classList.remove('hidden'); status.textContent = '로그인 결과를 확인하고 있습니다.'; render(); claim();
  }
  function refresh(account) {
    const previous = loadUserProfile();
    saveUserProfile(account);
    onProfile(account, previous);
    render();
  }
  return {open, resume, refresh};
}
