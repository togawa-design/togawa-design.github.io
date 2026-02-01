/**
 * 採用ページ設定 - 共通コアモジュール
 * admin版とjob-manage版で共通のロジックを提供
 */
import { showToast, escapeHtml } from '@shared/utils.js';
import { uploadRecruitLogo, selectImageFile } from '@features/admin/image-uploader.js';
// API関数をインポート（内部使用 & re-export）
import { loadRecruitSettings, saveRecruitSettings } from './api.js';
export { loadRecruitSettings, saveRecruitSettings };

/**
 * ヒーロー画像プリセット
 */
export const heroImagePresets = [
  { id: 'teamwork-1', name: 'チームミーティング', url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60' },
  { id: 'teamwork-2', name: 'オフィスワーク', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60' },
  { id: 'teamwork-3', name: 'コラボレーション', url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60' },
  { id: 'teamwork-4', name: 'ビジネス握手', url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=60' },
  { id: 'teamwork-5', name: 'ワークショップ', url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=60' },
  { id: 'work-1', name: '製造ライン', url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60' },
  { id: 'work-2', name: '倉庫作業', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=60' },
  { id: 'work-3', name: '建設現場', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60' },
  { id: 'work-4', name: '工場作業', url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=60' },
  { id: 'work-5', name: 'チームワーク', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60' }
];

// loadRecruitSettings と saveRecruitSettings は api.js からre-export済み

/**
 * フォームに設定値を反映
 */
export function populateForm(settings, companyName = '') {
  // レイアウトスタイルを設定
  setLayoutStyle(settings.layoutStyle || 'default');
  // デザインパターンを設定
  setDesignPattern(settings.designPattern || 'standard');

  // ロゴ・ヘッダー設定
  setInputValue('recruit-logo-url', settings.logoUrl || '');
  setInputValue('recruit-company-name-display', settings.companyNameDisplay || '');
  setInputValue('recruit-phone-number', settings.phoneNumber || '');
  setInputValue('recruit-cta-button-text', settings.ctaButtonText || '今すぐ応募する');

  setInputValue('recruit-hero-title', settings.heroTitle || (companyName ? `${companyName}で働こう` : ''));
  setInputValue('recruit-hero-subtitle', settings.heroSubtitle || '');
  setInputValue('recruit-hero-image', settings.heroImage || '');
  setInputValue('recruit-company-intro', settings.companyIntro || '');
  setInputValue('recruit-jobs-title', settings.jobsTitle || '募集中の求人');
  setInputValue('recruit-cta-title', settings.ctaTitle || 'あなたの応募をお待ちしています');
  setInputValue('recruit-cta-text', settings.ctaText || '');
  setInputValue('recruit-ogp-title', settings.ogpTitle || '');
  setInputValue('recruit-ogp-description', settings.ogpDescription || '');
  setInputValue('recruit-ogp-image', settings.ogpImage || '');

  // ヒーロー画像プリセットの選択状態を更新
  updateHeroImagePresetSelection(settings.heroImage || '');

  // ロゴプレビューを更新
  updateLogoPreview(settings.logoUrl || '');
}

/**
 * フォームにデフォルト値を設定
 */
export function populateFormWithDefaults(companyName = '', companyDescription = '', companyImageUrl = '') {
  // レイアウトスタイルをデフォルトに設定
  setLayoutStyle('default');
  // デザインパターンをデフォルトに設定
  setDesignPattern('standard');

  // ロゴ・ヘッダー設定
  setInputValue('recruit-logo-url', '');
  setInputValue('recruit-company-name-display', companyName || '');
  setInputValue('recruit-phone-number', '');
  setInputValue('recruit-cta-button-text', '今すぐ応募する');

  setInputValue('recruit-hero-title', companyName ? `${companyName}で働こう` : '');
  setInputValue('recruit-hero-subtitle', companyDescription ? truncateText(companyDescription, 100) : '私たちと一緒に働きませんか？');
  setInputValue('recruit-hero-image', companyImageUrl || '');
  setInputValue('recruit-company-intro', '');
  setInputValue('recruit-jobs-title', '募集中の求人');
  setInputValue('recruit-cta-title', 'あなたの応募をお待ちしています');
  setInputValue('recruit-cta-text', '気になる求人があれば、ぜひお気軽にご応募ください。');
  setInputValue('recruit-ogp-title', '');
  setInputValue('recruit-ogp-description', '');
  setInputValue('recruit-ogp-image', '');

  // ヒーロー画像プリセットの選択状態を更新
  updateHeroImagePresetSelection(companyImageUrl || '');

  // ロゴプレビューをクリア
  updateLogoPreview('');
}

/**
 * フォームから設定値を取得
 */
export function getFormValues(companyDomain) {
  return {
    companyDomain: companyDomain || '',
    layoutStyle: getLayoutStyle(),
    designPattern: getDesignPattern(),
    // ロゴ・ヘッダー設定
    logoUrl: document.getElementById('recruit-logo-url')?.value || '',
    companyNameDisplay: document.getElementById('recruit-company-name-display')?.value || '',
    phoneNumber: document.getElementById('recruit-phone-number')?.value || '',
    ctaButtonText: document.getElementById('recruit-cta-button-text')?.value || '今すぐ応募する',
    // ファーストビュー
    heroTitle: document.getElementById('recruit-hero-title')?.value || '',
    heroSubtitle: document.getElementById('recruit-hero-subtitle')?.value || '',
    heroImage: document.getElementById('recruit-hero-image')?.value || '',
    companyIntro: document.getElementById('recruit-company-intro')?.value || '',
    jobsTitle: document.getElementById('recruit-jobs-title')?.value || '',
    ctaTitle: document.getElementById('recruit-cta-title')?.value || '',
    ctaText: document.getElementById('recruit-cta-text')?.value || '',
    ogpTitle: document.getElementById('recruit-ogp-title')?.value || '',
    ogpDescription: document.getElementById('recruit-ogp-description')?.value || '',
    ogpImage: document.getElementById('recruit-ogp-image')?.value || ''
  };
}

/**
 * input要素に値を設定
 */
export function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value || '';
  }
}

/**
 * レイアウトスタイルを設定
 */
export function setLayoutStyle(style) {
  const radio = document.querySelector(`input[name="recruit-layout-style"][value="${style}"]`);
  if (radio) {
    radio.checked = true;
  }
}

/**
 * レイアウトスタイルを取得
 */
export function getLayoutStyle() {
  const radio = document.querySelector('input[name="recruit-layout-style"]:checked');
  return radio?.value || 'default';
}

/**
 * デザインパターンを設定
 */
export function setDesignPattern(pattern) {
  const radio = document.querySelector(`input[name="recruit-design-pattern"][value="${pattern}"]`);
  if (radio) {
    radio.checked = true;
  }
}

/**
 * デザインパターンを取得
 */
export function getDesignPattern() {
  const radio = document.querySelector('input[name="recruit-design-pattern"]:checked');
  return radio?.value || 'standard';
}

/**
 * テキストを指定文字数で切り詰め
 */
export function truncateText(text, maxLength) {
  if (!text) return '';
  const plainText = text.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
}

/**
 * 保存ボタンのUI操作
 */
export function setSaveButtonLoading(isLoading) {
  const saveBtn = document.getElementById('btn-save-recruit-settings');
  if (saveBtn) {
    saveBtn.disabled = isLoading;
    saveBtn.textContent = isLoading ? '保存中...' : '採用ページ設定を保存';
  }
}

/**
 * 保存処理の共通ラッパー
 */
export async function handleSave(companyDomain, onSuccess) {
  if (!companyDomain) {
    showToast('会社情報が設定されていません', 'error');
    return null;
  }

  const settings = getFormValues(companyDomain);
  setSaveButtonLoading(true);

  try {
    await saveRecruitSettings(settings);
    showToast('採用ページ設定を保存しました', 'success');
    if (onSuccess) onSuccess(settings);
    return settings;
  } catch (error) {
    console.error('[RecruitSettings] 保存エラー:', error);
    showToast('保存に失敗しました: ' + error.message, 'error');
    return null;
  } finally {
    setSaveButtonLoading(false);
  }
}

/**
 * リセットボタンの共通処理
 */
export function handleReset(savedSettings, companyName = '', companyDescription = '', companyImageUrl = '') {
  if (savedSettings && Object.keys(savedSettings).length > 0) {
    populateForm(savedSettings, companyName);
  } else {
    populateFormWithDefaults(companyName, companyDescription, companyImageUrl);
  }
  showToast('設定をリセットしました', 'info');
}

/**
 * プレビューリンクを更新
 */
export function updatePreviewLink(companyDomain) {
  const previewBtn = document.getElementById('recruit-preview-btn');
  if (previewBtn && companyDomain) {
    previewBtn.href = `company-recruit.html?id=${encodeURIComponent(companyDomain)}`;
  }

  // 編集モードボタンも更新
  const editBtn = document.getElementById('recruit-edit-btn');
  if (editBtn && companyDomain) {
    editBtn.href = `company-recruit.html?id=${encodeURIComponent(companyDomain)}&edit`;
  }
}

/**
 * ヒーロー画像プリセットをレンダリング
 */
export function renderHeroImagePresets() {
  const container = document.getElementById('recruit-hero-image-presets');
  if (!container) return;

  container.innerHTML = heroImagePresets.map(preset => `
    <div class="hero-image-preset" data-url="${escapeHtml(preset.url)}" title="${escapeHtml(preset.name)}">
      <img src="${escapeHtml(preset.thumbnail)}" alt="${escapeHtml(preset.name)}" loading="lazy">
      <span class="preset-name">${escapeHtml(preset.name)}</span>
      <span class="preset-check">✓</span>
    </div>
  `).join('');

  container.querySelectorAll('.hero-image-preset').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      selectHeroImagePreset(url);
    });
  });
}

/**
 * ヒーロー画像プリセットを選択
 */
export function selectHeroImagePreset(url) {
  const input = document.getElementById('recruit-hero-image');
  if (input) {
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  updateHeroImagePresetSelection(url);
}

/**
 * ヒーロー画像プリセットの選択状態を更新
 */
export function updateHeroImagePresetSelection(selectedUrl) {
  const container = document.getElementById('recruit-hero-image-presets');
  if (!container) return;

  container.querySelectorAll('.hero-image-preset').forEach(item => {
    const itemUrl = item.dataset.url;
    const baseSelectedUrl = selectedUrl?.split('?')[0] || '';
    const baseItemUrl = itemUrl?.split('?')[0] || '';
    if (baseSelectedUrl && baseItemUrl && baseSelectedUrl === baseItemUrl) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

/**
 * ロゴプレビューを更新
 */
export function updateLogoPreview(url) {
  const previewEl = document.getElementById('recruit-logo-preview');
  if (!previewEl) return;

  if (url) {
    previewEl.innerHTML = `<img src="${escapeHtml(url)}" alt="ロゴプレビュー">`;
  } else {
    previewEl.innerHTML = '<span class="logo-placeholder">ロゴ未設定</span>';
  }
}

/**
 * ロゴアップロードボタンを設定
 */
export function setupLogoUpload(companyDomain) {
  let uploadBtn = document.getElementById('btn-upload-logo');
  let urlInput = document.getElementById('recruit-logo-url');
  const previewEl = document.getElementById('recruit-logo-preview');

  if (!uploadBtn || !urlInput) return;

  // 既存のイベントリスナーを削除するために要素を複製して置き換え
  const newUploadBtn = uploadBtn.cloneNode(true);
  uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
  uploadBtn = newUploadBtn;

  const newUrlInput = urlInput.cloneNode(true);
  urlInput.parentNode.replaceChild(newUrlInput, urlInput);
  urlInput = newUrlInput;

  // URL入力時のプレビュー更新
  urlInput.addEventListener('input', () => {
    updateLogoPreview(urlInput.value);
  });

  // アップロードボタンクリック
  uploadBtn.addEventListener('click', async () => {
    if (!companyDomain) {
      showToast('会社情報が設定されていません', 'error');
      return;
    }

    try {
      // ファイル選択
      const file = await selectImageFile({ accept: 'image/png,image/jpeg,image/webp,image/svg+xml' });

      // アップロード中の表示
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="upload-spinner"></span> アップロード中...';
      if (previewEl) {
        previewEl.classList.add('uploading');
        previewEl.innerHTML = '<div class="upload-spinner"></div>';
      }

      // Cloudinaryにアップロード（採用ページ専用パス）
      const timestamp = Date.now();
      const url = await uploadRecruitLogo(file, companyDomain);

      // キャッシュ回避のためタイムスタンプを追加
      const urlWithCache = url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;

      // URLを入力欄に設定
      urlInput.value = urlWithCache;

      // プレビューを更新
      updateLogoPreview(urlWithCache);

      showToast('ロゴをアップロードしました', 'success');
    } catch (error) {
      console.error('[RecruitSettings] ロゴアップロードエラー:', error);
      if (error.message !== 'ファイルが選択されませんでした') {
        showToast('アップロードに失敗しました: ' + error.message, 'error');
      }
      // プレビューを元に戻す
      updateLogoPreview(urlInput.value);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<span class="upload-icon">📷</span> アップロード';
      if (previewEl) {
        previewEl.classList.remove('uploading');
      }
    }
  });
}

export default {
  loadRecruitSettings,
  saveRecruitSettings,
  populateForm,
  populateFormWithDefaults,
  getFormValues,
  setInputValue,
  setLayoutStyle,
  getLayoutStyle,
  setDesignPattern,
  getDesignPattern,
  truncateText,
  setSaveButtonLoading,
  handleSave,
  handleReset,
  updatePreviewLink,
  heroImagePresets,
  renderHeroImagePresets,
  selectHeroImagePreset,
  updateHeroImagePresetSelection,
  updateLogoPreview,
  setupLogoUpload
};
