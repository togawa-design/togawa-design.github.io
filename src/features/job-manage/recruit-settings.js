/**
 * 採用ページ設定機能（会社ユーザー用）
 * シンプル版 - 共通コアを使用
 */
import { showToast } from '@shared/utils.js';
import {
  loadRecruitSettings,
  populateForm,
  populateFormWithDefaults,
  handleSave,
  handleReset,
  updatePreviewLink,
  renderHeroImagePresets,
  setupLogoUpload
} from '@features/recruit-settings/core.js';

// 現在の会社ドメイン
let companyDomain = null;
let companyName = null;
let recruitSettings = {};

/**
 * 採用ページ設定を初期化
 */
export async function initRecruitSettings(domain) {
  companyDomain = domain;

  // 会社名を取得
  const companyNameEl = document.getElementById('company-name');
  companyName = companyNameEl?.textContent || '';

  // URLを更新
  const urlEl = document.getElementById('recruit-page-url');
  if (urlEl) {
    urlEl.textContent = `/company-recruit.html?id=${domain}`;
  }

  // プレビューリンク更新
  updatePreviewLink(domain);

  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresets();

  // ロゴアップロード機能を設定
  setupLogoUpload(domain);

  // 設定を読み込み
  recruitSettings = await loadRecruitSettings(domain) || {};

  if (Object.keys(recruitSettings).length > 0) {
    populateForm(recruitSettings, companyName);
  } else {
    populateFormWithDefaults(companyName);
  }

  // イベントリスナーを設定
  setupEventListeners();
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 保存ボタン
  const saveBtn = document.getElementById('btn-save-recruit-settings');
  if (saveBtn) {
    // 既存のリスナーを削除して新規追加
    saveBtn.replaceWith(saveBtn.cloneNode(true));
    document.getElementById('btn-save-recruit-settings')?.addEventListener('click', async () => {
      const saved = await handleSave(companyDomain, (settings) => {
        recruitSettings = settings;
        // 成功メッセージ表示
        const successMsg = document.getElementById('recruit-save-message');
        if (successMsg) {
          successMsg.style.display = 'block';
          setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
        }
      });
    });
  }

  // リセットボタン
  const resetBtn = document.getElementById('btn-reset-recruit-settings');
  if (resetBtn) {
    resetBtn.replaceWith(resetBtn.cloneNode(true));
    document.getElementById('btn-reset-recruit-settings')?.addEventListener('click', () => {
      handleReset(recruitSettings, companyName);
    });
  }
}

export default {
  initRecruitSettings
};
