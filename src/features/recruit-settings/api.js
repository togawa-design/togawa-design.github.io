/**
 * 採用ページ設定 - API モジュール
 * 公開ページ（company-recruit.js, lp.js）で使用するAPI関数のみを提供
 * 管理画面用の機能は core.js を使用
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec';

/**
 * 採用ページ設定を読み込み
 */
export async function loadRecruitSettings(companyDomain) {
  if (!companyDomain) return null;

  try {
    const response = await fetch(
      `${GAS_API_URL}?action=getRecruitSettings&companyDomain=${encodeURIComponent(companyDomain)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.settings) {
        return data.settings;
      }
    }
  } catch (error) {
    console.log('[RecruitSettings] 設定の読み込みエラー（新規の可能性）:', error);
  }

  return null;
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

  return result;
}

export default {
  loadRecruitSettings,
  saveRecruitSettings
};
