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

  // カスタムカラーを設定
  setCustomColors({
    primary: settings.customPrimary || '',
    accent: settings.customAccent || '',
    bg: settings.customBg || '',
    text: settings.customText || ''
  });

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

  // 動画ボタン設定
  const showVideoCheckbox = document.getElementById('recruit-show-video-button');
  const videoUrlGroup = document.getElementById('recruit-video-url-group');
  if (showVideoCheckbox) {
    showVideoCheckbox.checked = String(settings.showVideoButton).toLowerCase() === 'true';
    if (videoUrlGroup) {
      videoUrlGroup.style.display = showVideoCheckbox.checked ? 'block' : 'none';
    }
  }
  setInputValue('recruit-video-url', settings.videoUrl || '');

  // セクション並び替え設定
  if (settings.sectionOrder) {
    applySectionOrder(settings.sectionOrder);
  }
  if (settings.sectionVisibility) {
    applySectionVisibility(settings.sectionVisibility);
  }
}

/**
 * フォームにデフォルト値を設定
 */
export function populateFormWithDefaults(companyName = '', companyDescription = '', companyImageUrl = '') {
  // レイアウトスタイルをデフォルトに設定
  setLayoutStyle('default');
  // カスタムカラーをリセット
  resetCustomColors();

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

  // 動画ボタン設定をリセット
  const showVideoCheckbox = document.getElementById('recruit-show-video-button');
  const videoUrlGroup = document.getElementById('recruit-video-url-group');
  if (showVideoCheckbox) showVideoCheckbox.checked = false;
  if (videoUrlGroup) videoUrlGroup.style.display = 'none';
  setInputValue('recruit-video-url', '');

  // セクション設定をリセット
  renderRecruitSectionsList();
}

/**
 * フォームから設定値を取得
 */
export function getFormValues(companyDomain) {
  return {
    companyDomain: companyDomain || '',
    layoutStyle: getLayoutStyle(),
    // カスタムカラー
    customPrimary: document.getElementById('recruit-custom-primary')?.value || '',
    customAccent: document.getElementById('recruit-custom-accent')?.value || '',
    customBg: document.getElementById('recruit-custom-bg')?.value || '',
    customText: document.getElementById('recruit-custom-text')?.value || '',
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
    ogpImage: document.getElementById('recruit-ogp-image')?.value || '',
    // 動画ボタン設定
    showVideoButton: document.getElementById('recruit-show-video-button')?.checked ? 'true' : 'false',
    videoUrl: document.getElementById('recruit-video-url')?.value || '',
    // セクション並び替え設定
    sectionOrder: getRecruitSectionOrder().join(','),
    sectionVisibility: JSON.stringify(getRecruitSectionVisibility())
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
 * カスタムカラーを設定
 */
export function setCustomColors(colors) {
  const colorIds = ['primary', 'accent', 'bg', 'text'];
  colorIds.forEach(id => {
    const colorInput = document.getElementById(`recruit-custom-${id}`);
    const textInput = document.getElementById(`recruit-custom-${id}-text`);
    const value = colors[id] || '';
    if (colorInput) {
      colorInput.value = value || (id === 'bg' ? '#ffffff' : id === 'text' ? '#1f2937' : '#000000');
    }
    if (textInput) {
      textInput.value = value;
    }
  });
}

/**
 * カスタムカラーをリセット
 */
export function resetCustomColors() {
  const colorIds = ['primary', 'accent', 'bg', 'text'];
  const defaults = {
    primary: '',
    accent: '',
    bg: '#ffffff',
    text: '#1f2937'
  };
  colorIds.forEach(id => {
    const colorInput = document.getElementById(`recruit-custom-${id}`);
    const textInput = document.getElementById(`recruit-custom-${id}-text`);
    if (colorInput) colorInput.value = defaults[id] || '#000000';
    if (textInput) textInput.value = '';
  });
}

/**
 * カラーピッカーのイベントリスナーをセットアップ
 */
export function setupColorPickers() {
  const colorIds = ['primary', 'accent', 'bg', 'text'];

  colorIds.forEach(id => {
    const colorInput = document.getElementById(`recruit-custom-${id}`);
    const textInput = document.getElementById(`recruit-custom-${id}-text`);

    if (colorInput && textInput) {
      // カラーピッカー → テキスト入力
      colorInput.addEventListener('input', () => {
        textInput.value = colorInput.value;
        updateLivePreview();
      });

      // テキスト入力 → カラーピッカー
      textInput.addEventListener('input', () => {
        const val = textInput.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          colorInput.value = val;
        }
        updateLivePreview();
      });
    }
  });

  // リセットボタン
  const resetBtn = document.getElementById('recruit-reset-colors');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetCustomColors();
      updateLivePreview();
    });
  }
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

/**
 * レイアウトスタイルごとのデフォルトカラー
 */
const layoutStyleColors = {
  default: { primary: '#6366f1', accent: '#818cf8', bg: '#ffffff', text: '#1f2937' },
  modern: { primary: '#3b82f6', accent: '#60a5fa', bg: '#f8fafc', text: '#1e293b' },
  yellow: { primary: '#f59e0b', accent: '#fbbf24', bg: '#fffbeb', text: '#78350f' },
  impact: { primary: '#111827', accent: '#374151', bg: '#f9fafb', text: '#111827' },
  local: { primary: '#92400e', accent: '#b45309', bg: '#fef3c7', text: '#78350f' },
  zen: { primary: '#059669', accent: '#10b981', bg: '#f0fdf4', text: '#1f2937' }
};

/**
 * リアルタイムプレビューを更新
 */
export function updateLivePreview() {
  const previewContainer = document.getElementById('recruit-live-preview');
  if (!previewContainer) return;

  // ロゴ
  const logoUrl = document.getElementById('recruit-logo-url')?.value || '';
  const logoEl = document.getElementById('preview-logo');
  if (logoEl) {
    if (logoUrl) {
      logoEl.src = logoUrl;
      logoEl.style.display = 'block';
    } else {
      logoEl.style.display = 'none';
    }
  }

  // 会社名
  const companyName = document.getElementById('recruit-company-name-display')?.value || '';
  const companyNameEl = document.getElementById('preview-company-name');
  if (companyNameEl) {
    companyNameEl.textContent = companyName || '会社名';
  }

  // ヒーロータイトル
  const heroTitle = document.getElementById('recruit-hero-title')?.value || '';
  const heroTitleEl = document.getElementById('preview-hero-title');
  if (heroTitleEl) {
    heroTitleEl.textContent = heroTitle || 'キャッチコピー';
  }

  // ヒーローサブタイトル
  const heroSubtitle = document.getElementById('recruit-hero-subtitle')?.value || '';
  const heroSubtitleEl = document.getElementById('preview-hero-subtitle');
  if (heroSubtitleEl) {
    heroSubtitleEl.textContent = heroSubtitle || 'サブタイトル';
  }

  // ヒーロー背景画像
  const heroImage = document.getElementById('recruit-hero-image')?.value || '';
  const heroEl = document.getElementById('preview-hero');
  if (heroEl) {
    if (heroImage) {
      heroEl.style.backgroundImage = `url(${heroImage})`;
    } else {
      heroEl.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  }

  // 会社紹介
  const companyIntro = document.getElementById('recruit-company-intro')?.value || '';
  const introEl = document.getElementById('preview-intro-text');
  if (introEl) {
    introEl.textContent = companyIntro ? truncateText(companyIntro, 60) : '会社紹介文がここに表示されます';
  }

  // 求人セクションタイトル
  const jobsTitle = document.getElementById('recruit-jobs-title')?.value || '';
  const jobsTitleEl = document.getElementById('preview-jobs-title');
  if (jobsTitleEl) {
    jobsTitleEl.textContent = jobsTitle || '募集中の求人';
  }

  // CTAタイトル
  const ctaTitle = document.getElementById('recruit-cta-title')?.value || '';
  const ctaTitleEl = document.getElementById('preview-cta-title');
  if (ctaTitleEl) {
    ctaTitleEl.textContent = ctaTitle || 'ご応募お待ちしています';
  }

  // CTAボタンテキスト
  const ctaButtonText = document.getElementById('recruit-cta-button-text')?.value || '';
  const ctaButtonEl = document.getElementById('preview-cta-button');
  if (ctaButtonEl) {
    ctaButtonEl.textContent = ctaButtonText || '今すぐ応募する';
  }

  // デザインパターンの色を適用
  applyPreviewColorTheme();
}

/**
 * プレビューにカラーテーマを適用
 */
export function applyPreviewColorTheme() {
  const layoutStyle = getLayoutStyle();
  const previewContainer = document.getElementById('recruit-live-preview');

  if (!previewContainer) return;

  // レイアウトスタイルをプレビューに適用
  previewContainer.setAttribute('data-layout-style', layoutStyle);

  // カスタムカラーを取得
  const customPrimaryInput = document.getElementById('recruit-custom-primary-text');
  const customAccentInput = document.getElementById('recruit-custom-accent-text');
  const customBgInput = document.getElementById('recruit-custom-bg-text');
  const customTextInput = document.getElementById('recruit-custom-text-text');

  // カスタムカラーの値（テキスト入力から取得、空欄の場合はレイアウトスタイルのデフォルトを使用）
  const baseColors = layoutStyleColors[layoutStyle] || layoutStyleColors.default;
  const colors = {
    primary: customPrimaryInput?.value || baseColors.primary,
    accent: customAccentInput?.value || baseColors.accent,
    bg: customBgInput?.value || baseColors.bg,
    text: customTextInput?.value || baseColors.text
  };

  // CSS変数でカラーを設定（previewContainer = .preview-phone-content）
  previewContainer.style.setProperty('--preview-primary', colors.primary);
  previewContainer.style.setProperty('--preview-accent', colors.accent);
  previewContainer.style.setProperty('--preview-bg', colors.bg);
  previewContainer.style.setProperty('--preview-text', colors.text);
}

/**
 * リアルタイムプレビューのイベントリスナーをセットアップ
 */
export function setupLivePreview() {
  const previewContainer = document.getElementById('recruit-live-preview');
  if (!previewContainer) return;

  // 監視するフォームフィールドのIDリスト
  const fieldIds = [
    'recruit-logo-url',
    'recruit-company-name-display',
    'recruit-hero-title',
    'recruit-hero-subtitle',
    'recruit-hero-image',
    'recruit-company-intro',
    'recruit-jobs-title',
    'recruit-cta-title',
    'recruit-cta-button-text'
  ];

  // 各フィールドにinputイベントリスナーを追加
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLivePreview);
    }
  });

  // レイアウトスタイルのradioボタンにchangeイベントリスナーを追加
  const layoutStyleRadios = document.querySelectorAll('input[name="recruit-layout-style"]');
  layoutStyleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateLivePreview();
    });
  });

  // カスタムカラーピッカーをセットアップ
  setupColorPickers();

  // 初期プレビューを更新
  updateLivePreview();
}

// ========================================
// セクション管理機能
// ========================================

/**
 * 採用ページのデフォルトセクション
 */
export const RECRUIT_SECTIONS = [
  { id: 'hero', name: 'ヒーロー', icon: '🎯', required: true },
  { id: 'company-intro', name: '会社紹介', icon: '🏢', required: false },
  { id: 'jobs', name: '求人一覧', icon: '📋', required: true },
  { id: 'cta', name: 'CTA', icon: '📞', required: true }
];

/**
 * セクション順序を取得
 */
export function getRecruitSectionOrder() {
  const orderList = document.getElementById('recruit-sections-list');
  if (!orderList) {
    return RECRUIT_SECTIONS.map(s => s.id);
  }
  return Array.from(orderList.querySelectorAll('.recruit-section-item'))
    .map(li => li.dataset.section);
}

/**
 * セクション表示状態を取得
 */
export function getRecruitSectionVisibility() {
  const visibility = {};
  RECRUIT_SECTIONS.forEach(section => {
    if (!section.required) {
      const checkbox = document.getElementById(`recruit-section-${section.id}-visible`);
      visibility[section.id] = checkbox?.checked ?? true;
    }
  });
  return visibility;
}

/**
 * セクション順序を適用
 */
export function applySectionOrder(orderString) {
  const orderList = document.getElementById('recruit-sections-list');
  if (!orderList || !orderString) return;

  const order = orderString.split(',').map(s => s.trim()).filter(s => s);
  const items = Array.from(orderList.querySelectorAll('.recruit-section-item'));
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.dataset.section] = item;
  });

  order.forEach(sectionId => {
    const item = itemMap[sectionId];
    if (item) {
      orderList.appendChild(item);
    }
  });
}

/**
 * セクション表示状態を適用
 */
export function applySectionVisibility(visibilityString) {
  if (!visibilityString) return;

  try {
    const visibility = JSON.parse(visibilityString);
    Object.keys(visibility).forEach(sectionId => {
      const checkbox = document.getElementById(`recruit-section-${sectionId}-visible`);
      if (checkbox) {
        checkbox.checked = visibility[sectionId];
      }
    });
  } catch (e) {
    console.error('セクション表示状態のパースエラー:', e);
  }
}

/**
 * セクションリストをレンダリング
 */
export function renderRecruitSectionsList() {
  const container = document.getElementById('recruit-sections-list');
  if (!container) return;

  container.innerHTML = RECRUIT_SECTIONS.map(section => `
    <li class="recruit-section-item" data-section="${section.id}" draggable="true">
      <span class="section-drag-handle">⋮⋮</span>
      <span class="section-icon">${section.icon}</span>
      <span class="section-name">${section.name}</span>
      ${!section.required ? `
        <label class="section-visibility-toggle">
          <input type="checkbox" id="recruit-section-${section.id}-visible" checked>
          <span class="toggle-label">表示</span>
        </label>
      ` : '<span class="section-required-badge">必須</span>'}
    </li>
  `).join('');

  setupRecruitSectionDragDrop();

  // 表示/非表示チェックボックスの変更イベント
  RECRUIT_SECTIONS.forEach(section => {
    if (!section.required) {
      const checkbox = document.getElementById(`recruit-section-${section.id}-visible`);
      if (checkbox) {
        checkbox.addEventListener('change', updateLivePreview);
      }
    }
  });
}

/**
 * ドラッグ&ドロップを設定
 */
export function setupRecruitSectionDragDrop() {
  const list = document.getElementById('recruit-sections-list');
  if (!list) return;

  let draggedItem = null;

  list.querySelectorAll('.recruit-section-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.recruit-section-item').forEach(i => {
        i.classList.remove('drag-over');
      });
      draggedItem = null;
      updateLivePreview();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === item) return;

      list.querySelectorAll('.recruit-section-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      if (e.clientY < midY) {
        item.classList.add('drag-over');
        list.insertBefore(draggedItem, item);
      } else {
        list.insertBefore(draggedItem, item.nextSibling);
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
  });
}

/**
 * 動画ボタンセクションの初期化
 */
export function initVideoButtonSection() {
  const checkbox = document.getElementById('recruit-show-video-button');
  const videoUrlGroup = document.getElementById('recruit-video-url-group');

  if (checkbox && videoUrlGroup) {
    checkbox.addEventListener('change', () => {
      videoUrlGroup.style.display = checkbox.checked ? 'block' : 'none';
      updateLivePreview();
    });
  }

  // 動画URL入力のプレビュー更新
  const videoUrlInput = document.getElementById('recruit-video-url');
  if (videoUrlInput) {
    videoUrlInput.addEventListener('input', updateLivePreview);
  }
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
  setCustomColors,
  resetCustomColors,
  setupColorPickers,
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
  setupLogoUpload,
  setupLivePreview,
  updateLivePreview,
  applyPreviewColorTheme,
  // セクション管理
  RECRUIT_SECTIONS,
  getRecruitSectionOrder,
  getRecruitSectionVisibility,
  applySectionOrder,
  applySectionVisibility,
  renderRecruitSectionsList,
  setupRecruitSectionDragDrop,
  initVideoButtonSection
};
