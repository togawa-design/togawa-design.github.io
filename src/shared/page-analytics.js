/**
 * ページアナリティクスサービス
 * LP・採用ページの独立した計測をFirestoreに保存
 */

// Cloud Functions APIエンドポイント
const PAGE_ANALYTICS_ENDPOINT = 'https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/trackPageAnalytics';

// ビジターID（セッション内で一意）
let visitorId = null;

/**
 * ビジターIDを取得または生成
 */
function getVisitorId() {
  if (visitorId) return visitorId;

  // sessionStorageから取得を試みる
  try {
    visitorId = sessionStorage.getItem('pa_visitor_id');
    if (!visitorId) {
      // 新規生成
      visitorId = 'v_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('pa_visitor_id', visitorId);
    }
  } catch (e) {
    // sessionStorageが使えない場合
    visitorId = 'v_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  return visitorId;
}

/**
 * デバイスタイプを判定
 */
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * UTMパラメータを取得
 */
function getUTMParams() {
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const utm = {};

  utmKeys.forEach(key => {
    const value = params.get(key);
    if (value) utm[key] = value;
  });

  return Object.keys(utm).length > 0 ? utm : null;
}

/**
 * リファラーを分類
 */
function classifyReferrer(referrer) {
  if (!referrer) return 'direct';

  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();

    // 同一サイトからの遷移
    if (host === window.location.hostname) return 'internal';

    // 検索エンジン
    if (host.includes('google')) return 'google';
    if (host.includes('yahoo')) return 'yahoo';
    if (host.includes('bing')) return 'bing';

    // 求人サイト
    if (host.includes('indeed')) return 'indeed';
    if (host.includes('jobbox') || host.includes('stanby')) return 'jobbox';
    if (host.includes('engage')) return 'engage';

    // SNS
    if (host.includes('twitter') || host.includes('x.com')) return 'twitter';
    if (host.includes('facebook')) return 'facebook';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('line')) return 'line';

    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * イベントをCloud Functionsに送信
 */
async function sendEvent(eventData) {
  // ローカル環境ではコンソール出力のみ
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocal) {
    console.log('[PageAnalytics] Event:', eventData);
    return;
  }

  try {
    const response = await fetch(PAGE_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) {
      console.warn('[PageAnalytics] Failed to send event:', response.status);
    }
  } catch (error) {
    console.warn('[PageAnalytics] Error sending event:', error.message);
  }
}

/**
 * ページビューをトラッキング
 * @param {Object} options
 * @param {string} options.pageType - 'lp' または 'recruit'
 * @param {string} options.companyDomain - 会社ドメイン
 * @param {string} [options.jobId] - 求人ID（LPの場合）
 * @param {string} [options.companyName] - 会社名
 * @param {string} [options.jobTitle] - 求人タイトル（LPの場合）
 */
export function trackPageView(options) {
  const { pageType, companyDomain, jobId, companyName, jobTitle } = options;

  if (!pageType || !companyDomain) {
    console.warn('[PageAnalytics] pageType and companyDomain are required');
    return;
  }

  const eventData = {
    eventType: 'page_view',
    pageType,
    companyDomain,
    jobId: jobId || null,
    companyName: companyName || null,
    jobTitle: jobTitle || null,
    visitorId: getVisitorId(),
    timestamp: new Date().toISOString(),
    referrer: document.referrer || null,
    referrerType: classifyReferrer(document.referrer),
    utmParams: getUTMParams(),
    device: getDeviceType(),
    userAgent: navigator.userAgent,
    pageUrl: window.location.href,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight
  };

  sendEvent(eventData);
}

/**
 * CTAクリックをトラッキング
 * @param {Object} options
 * @param {string} options.pageType - 'lp' または 'recruit'
 * @param {string} options.companyDomain - 会社ドメイン
 * @param {string} options.buttonType - 'apply', 'phone', 'line', 'form' など
 * @param {string} [options.jobId] - 求人ID
 * @param {string} [options.buttonText] - ボタンのテキスト
 */
export function trackCTAClick(options) {
  const { pageType, companyDomain, buttonType, jobId, buttonText } = options;

  if (!pageType || !companyDomain || !buttonType) {
    console.warn('[PageAnalytics] pageType, companyDomain, and buttonType are required');
    return;
  }

  const eventData = {
    eventType: 'cta_click',
    pageType,
    companyDomain,
    jobId: jobId || null,
    buttonType,
    buttonText: buttonText || null,
    visitorId: getVisitorId(),
    timestamp: new Date().toISOString(),
    device: getDeviceType(),
    pageUrl: window.location.href
  };

  sendEvent(eventData);
}

/**
 * スクロール深度をトラッキング
 * @param {Object} options
 * @param {string} options.pageType - 'lp' または 'recruit'
 * @param {string} options.companyDomain - 会社ドメイン
 * @param {string} [options.jobId] - 求人ID
 */
export function trackScrollDepth(options) {
  const { pageType, companyDomain, jobId } = options;

  if (!pageType || !companyDomain) {
    console.warn('[PageAnalytics] pageType and companyDomain are required');
    return;
  }

  let maxScrollDepth = 0;
  let depthsMilestones = [25, 50, 75, 100];
  let trackedDepths = new Set();

  const calculateScrollDepth = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const depth = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;

    if (depth > maxScrollDepth) {
      maxScrollDepth = depth;

      // マイルストーンに達した場合にイベント送信
      depthsMilestones.forEach(milestone => {
        if (depth >= milestone && !trackedDepths.has(milestone)) {
          trackedDepths.add(milestone);

          const eventData = {
            eventType: 'scroll_depth',
            pageType,
            companyDomain,
            jobId: jobId || null,
            depth: milestone,
            visitorId: getVisitorId(),
            timestamp: new Date().toISOString(),
            device: getDeviceType(),
            pageUrl: window.location.href
          };

          sendEvent(eventData);
        }
      });
    }
  };

  // スクロールイベントをスロットリング
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        calculateScrollDepth();
        ticking = false;
      });
      ticking = true;
    }
  });

  // 初期スクロール位置もチェック
  calculateScrollDepth();
}

/**
 * 滞在時間をトラッキング（ページ離脱時）
 * @param {Object} options
 * @param {string} options.pageType - 'lp' または 'recruit'
 * @param {string} options.companyDomain - 会社ドメイン
 * @param {string} [options.jobId] - 求人ID
 */
export function trackTimeOnPage(options) {
  const { pageType, companyDomain, jobId } = options;

  if (!pageType || !companyDomain) {
    console.warn('[PageAnalytics] pageType and companyDomain are required');
    return;
  }

  const startTime = Date.now();

  const sendTimeOnPage = () => {
    const timeOnPage = Math.round((Date.now() - startTime) / 1000); // 秒

    // 1秒以上滞在した場合のみ送信
    if (timeOnPage >= 1) {
      const eventData = {
        eventType: 'time_on_page',
        pageType,
        companyDomain,
        jobId: jobId || null,
        duration: timeOnPage,
        visitorId: getVisitorId(),
        timestamp: new Date().toISOString(),
        device: getDeviceType(),
        pageUrl: window.location.href
      };

      // sendBeaconを使用（ページ離脱時に確実に送信）
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        console.log('[PageAnalytics] Time on page:', eventData);
      } else if (navigator.sendBeacon) {
        navigator.sendBeacon(PAGE_ANALYTICS_ENDPOINT, JSON.stringify(eventData));
      }
    }
  };

  // ページ離脱時に送信
  window.addEventListener('beforeunload', sendTimeOnPage);
  window.addEventListener('pagehide', sendTimeOnPage);
}

/**
 * 応募完了をトラッキング
 * @param {Object} options
 * @param {string} options.pageType - 'lp' または 'recruit'
 * @param {string} options.companyDomain - 会社ドメイン
 * @param {string} options.applicationType - 'form', 'line', 'phone' など
 * @param {string} [options.jobId] - 求人ID
 */
export function trackApplicationComplete(options) {
  const { pageType, companyDomain, applicationType, jobId } = options;

  if (!pageType || !companyDomain || !applicationType) {
    console.warn('[PageAnalytics] pageType, companyDomain, and applicationType are required');
    return;
  }

  const eventData = {
    eventType: 'application_complete',
    pageType,
    companyDomain,
    jobId: jobId || null,
    applicationType,
    visitorId: getVisitorId(),
    timestamp: new Date().toISOString(),
    referrerType: classifyReferrer(document.referrer),
    utmParams: getUTMParams(),
    device: getDeviceType(),
    pageUrl: window.location.href
  };

  sendEvent(eventData);
}

/**
 * 全トラッキングを初期化（ページビュー、スクロール、滞在時間）
 * @param {Object} options
 * @param {string} options.pageType - 'lp' または 'recruit'
 * @param {string} options.companyDomain - 会社ドメイン
 * @param {string} [options.jobId] - 求人ID（LPの場合）
 * @param {string} [options.companyName] - 会社名
 * @param {string} [options.jobTitle] - 求人タイトル（LPの場合）
 */
export function initPageTracking(options) {
  // ページビュー
  trackPageView(options);

  // スクロール深度
  trackScrollDepth(options);

  // 滞在時間
  trackTimeOnPage(options);
}

// デフォルトエクスポート
const PageAnalytics = {
  trackPageView,
  trackCTAClick,
  trackScrollDepth,
  trackTimeOnPage,
  trackApplicationComplete,
  initPageTracking,
  getVisitorId
};

export default PageAnalytics;
