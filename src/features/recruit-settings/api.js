/**
 * 採用ページ設定 - API モジュール
 * 公開ページ（company-recruit.js, lp.js）で使用するAPI関数のみを提供
 * 管理画面用の機能は core.js を使用
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec';

// キャッシュ（5分間有効）
const CACHE_TTL = 5 * 60 * 1000;
const settingsCache = new Map();

/**
 * 採用ページ設定を読み込み（キャッシュ付き）
 */
export async function loadRecruitSettings(companyDomain) {
  if (!companyDomain) return null;

  const now = Date.now();

  // キャッシュが有効な場合はキャッシュを返す
  const cached = settingsCache.get(companyDomain);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${GAS_API_URL}?action=getRecruitSettings&companyDomain=${encodeURIComponent(companyDomain)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.settings) {
        // キャッシュを更新
        settingsCache.set(companyDomain, { data: data.settings, timestamp: now });
        return data.settings;
      }
    }
  } catch (error) {
    console.log('[RecruitSettings] 設定の読み込みエラー（新規の可能性）:', error);
  }

  return cached?.data || null;
}

/**
 * 採用ページ設定を保存
 */
export async function saveRecruitSettings(settings) {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
    action: 'updateRecruitSettings',
    settings: settings
  }))));

  const url = `${GAS_API_URL}?action=post&data=${encodeURIComponent(payload)}`;
  const response = await fetch(url, { method: 'GET', redirect: 'follow' });
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || result.error || '保存に失敗しました');
  }

  // 保存成功時にキャッシュを更新
  if (settings.companyDomain) {
    settingsCache.set(settings.companyDomain, { data: settings, timestamp: Date.now() });
  }

  return result;
}

export default {
  loadRecruitSettings,
  saveRecruitSettings
};
