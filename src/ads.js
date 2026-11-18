// 볼탱이 대전 — Google AdSense / AdMob 통합 광고 매니저 (배너 · 전면 · 보상형 광고)

export const AD_CONFIG = {
  // 실제 Google AdSense / AdMob 발급 후 아래 ID를 입력하면 실광고로 자동 전환됩니다.
  adClient: '', // 예: 'ca-pub-XXXXXXXXXXXXXXXX'
  bannerSlot: '',
  interstitialSlot: '',
  rewardSlot: '',
  // 전체이용가(만 3세 이상) 가족 정책 준수: 비개인화 광고(NPA) 기본 활성화
  nonPersonalizedAds: true,
};

export function hasLiveAdConfig() {
  return Boolean(AD_CONFIG.adClient && AD_CONFIG.adClient.startsWith('ca-pub-'));
}

export function initBannerAd(containerEl) {
  if (!containerEl || !hasLiveAdConfig() || !AD_CONFIG.bannerSlot) return;
  containerEl.innerHTML = '';
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = AD_CONFIG.adClient;
  ins.dataset.adSlot = AD_CONFIG.bannerSlot;
  ins.dataset.adFormat = 'auto';
  ins.dataset.fullWidthResponsive = 'true';
  if (AD_CONFIG.nonPersonalizedAds) ins.dataset.npa = '1';
  containerEl.appendChild(ins);
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // ignore before script load
  }
}

export function runAdCountdown({
  overlayEl,
  closeBtnEl,
  seconds = 3,
  waitLabel = (s) => `⏳ ${s}초 후 닫기`,
  readyLabel = '✕ 광고 닫고 계속하기',
  onComplete = null,
}) {
  if (!overlayEl || !closeBtnEl) {
    onComplete?.();
    return;
  }

  overlayEl.classList.remove('hidden');
  let left = seconds;

  const syncBtn = () => {
    if (left > 0) {
      closeBtnEl.disabled = true;
      closeBtnEl.textContent = waitLabel(left);
    } else {
      closeBtnEl.disabled = false;
      closeBtnEl.textContent = readyLabel;
    }
  };
  syncBtn();

  const timer = setInterval(() => {
    left--;
    syncBtn();
    if (left <= 0) clearInterval(timer);
  }, 1000);

  const handleClose = () => {
    if (closeBtnEl.disabled) return;
    clearInterval(timer);
    closeBtnEl.removeEventListener('click', handleClose);
    overlayEl.classList.add('hidden');
    onComplete?.();
  };

  closeBtnEl.addEventListener('click', handleClose);
}
