/**
 * UTMパラメータ・トラッキング用ユーティリティ
 * 広告効果測定のためのデータ収集
 */

const UTM_STORAGE_KEY = 'rikueko_utm_data';
const FIRST_VISIT_KEY = 'rikueko_first_visit';

/**
 * URLからUTMパラメータを取得
 * @returns {Object} UTMパラメータオブジェクト
 */
export function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content: params.get('utm_content') || '',
    utm_term: params.get('utm_term') || ''
  };
}

/**
 * UTMパラメータをlocalStorageに保存（初回訪問時のみ）
 * First-touch attribution用
 */
export function saveUtmParams() {
  const existingData = localStorage.getItem(UTM_STORAGE_KEY);

  // 既にUTMデータがある場合は上書きしない（First-touch）
  if (existingData) {
    return;
  }

  const utmParams = getUtmParams();

  // UTMパラメータが1つでもあれば保存
  const hasUtm = Object.values(utmParams).some(v => v);
  if (hasUtm) {
    const data = {
      ...utmParams,
      landingPage: window.location.pathname + window.location.search,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
  }
}

/**
 * 保存されたUTMパラメータを取得
 * @returns {Object|null}
 */
export function getSavedUtmParams() {
  const data = localStorage.getItem(UTM_STORAGE_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * 初回訪問日時を記録
 */
export function recordFirstVisit() {
  const existingVisit = localStorage.getItem(FIRST_VISIT_KEY);
  if (!existingVisit) {
    localStorage.setItem(FIRST_VISIT_KEY, new Date().toISOString());
  }
}

/**
 * 初回訪問日時を取得
 * @returns {string|null}
 */
export function getFirstVisitTime() {
  return localStorage.getItem(FIRST_VISIT_KEY);
}

/**
 * 初回訪問からの経過日数を計算
 * @returns {number|null}
 */
export function getDaysToConversion() {
  const firstVisit = getFirstVisitTime();
  if (!firstVisit) return null;

  const firstDate = new Date(firstVisit);
  const now = new Date();
  const diffTime = Math.abs(now - firstDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * 応募時に保存するトラッキングデータを取得
 * @param {string} lpDesignPattern - LPのデザインパターン
 * @returns {Object}
 */
export function getTrackingDataForApplication(lpDesignPattern = '') {
  const savedUtm = getSavedUtmParams();
  const currentUtm = getUtmParams();
  const firstVisit = getFirstVisitTime();

  // First-touch UTM（初回訪問時のUTM）を優先
  // ただし、現在のURLにもUTMがあれば Last-touch として記録
  const hasCurrentUtm = Object.values(currentUtm).some(v => v);

  return {
    // First-touch attribution（初回訪問時の流入元）
    utm_source: savedUtm?.utm_source || currentUtm.utm_source || '',
    utm_medium: savedUtm?.utm_medium || currentUtm.utm_medium || '',
    utm_campaign: savedUtm?.utm_campaign || currentUtm.utm_campaign || '',
    utm_content: savedUtm?.utm_content || currentUtm.utm_content || '',
    utm_term: savedUtm?.utm_term || currentUtm.utm_term || '',

    // Last-touch（応募時の流入元）※初回と異なる場合のみ
    lastTouchSource: hasCurrentUtm && savedUtm ? currentUtm.utm_source : null,
    lastTouchMedium: hasCurrentUtm && savedUtm ? currentUtm.utm_medium : null,

    // 訪問データ
    landingPage: savedUtm?.landingPage || window.location.pathname,
    lpDesignPattern: lpDesignPattern,
    firstVisitAt: firstVisit || new Date().toISOString(),
    daysToConversion: getDaysToConversion() || 0
  };
}

/**
 * 応募完了後にトラッキングデータをクリア
 * 次回訪問時に新しいセッションとしてカウントするため
 */
export function clearTrackingData() {
  localStorage.removeItem(UTM_STORAGE_KEY);
  localStorage.removeItem(FIRST_VISIT_KEY);
}

/**
 * ページ読み込み時の初期化処理
 * LPページで呼び出す
 */
export function initTracking() {
  recordFirstVisit();
  saveUtmParams();
}

export default {
  getUtmParams,
  saveUtmParams,
  getSavedUtmParams,
  recordFirstVisit,
  getFirstVisitTime,
  getDaysToConversion,
  getTrackingDataForApplication,
  clearTrackingData,
  initTracking
};
