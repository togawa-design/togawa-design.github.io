/**
 * 採用ページ設定 - API モジュール
 * 公開ページ（company-recruit.js, lp.js）で使用するAPI関数のみを提供
 * 管理画面用の機能は core.js を使用
 * Firestore専用
 */

import * as FirestoreService from '@shared/firestore-service.js';

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
    const result = await FirestoreService.getRecruitSettings(companyDomain);

    if (result.success && result.settings && Object.keys(result.settings).length > 0) {
      settingsCache.set(companyDomain, { data: result.settings, timestamp: now });
      return result.settings;
    }
  } catch (error) {
    console.log('[RecruitSettings] Firestore読み込みエラー:', error);
  }

  return cached?.data || null;
}

/**
 * 採用ページ設定を保存
 */
export async function saveRecruitSettings(settings) {
  try {
    const result = await FirestoreService.saveRecruitSettings(settings.companyDomain, settings);

    if (!result.success) {
      throw new Error(result.error || '保存に失敗しました');
    }

    // 保存成功時にキャッシュを更新
    if (settings.companyDomain) {
      settingsCache.set(settings.companyDomain, { data: settings, timestamp: Date.now() });
    }

    return result;
  } catch (error) {
    console.error('[RecruitSettings] Firestore保存エラー:', error);
    throw error;
  }
}

export default {
  loadRecruitSettings,
  saveRecruitSettings
};
