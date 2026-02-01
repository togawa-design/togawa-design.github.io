/**
 * 求人管理 - LP設定モジュール
 */
import { escapeHtml } from '@shared/utils.js';
import { parseCSVLine } from '@features/admin/csv-utils.js';
import {
  saveLPSettings,
  renderHeroImagePresets,
  updateHeroImagePresetSelection,
  toggleLPPreview,
  closeLPPreview,
  updateLPPreview,
  debouncedUpdatePreview,
  initPointsSection,
  initFAQSection,
  initVideoButtonSection,
  setLPCustomColors,
  resetLPCustomColors,
  setupLPColorPickers,
  getLPCustomColors,
  layoutStyleColors
} from '@features/admin/lp-settings.js';
import {
  initSectionManager,
  loadSectionsFromSettings
} from '@features/admin/lp-section-manager.js';
import {
  loadCompanyManageData,
  getCompaniesCache
} from '@features/admin/company-manager.js';
import {
  companyDomain,
  companyName,
  sheetUrl,
  setSheetUrl,
  jobsCache,
  lpSettingsInitialized,
  setLpSettingsInitialized,
  allJobsCacheForLP,
  setAllJobsCacheForLP,
  currentJobDataForLP,
  setCurrentJobDataForLP
} from './state.js';

/**
 * 会社のシートURLを取得
 */
export async function ensureSheetUrl() {
  if (sheetUrl) return sheetUrl;

  try {
    let companiesCache = getCompaniesCache();
    if (!companiesCache || companiesCache.length === 0) {
      await loadCompanyManageData();
      companiesCache = getCompaniesCache();
    }

    const company = companiesCache.find(c => c.companyDomain === companyDomain);
    if (company) {
      const url = company.manageSheetUrl || company.jobsSheet || null;
      setSheetUrl(url);
      console.log('[LP設定] company-managerから取得したsheetUrl:', url);
    } else {
      console.warn('[LP設定] 会社が見つかりません:', companyDomain);
    }
  } catch (e) {
    console.warn('[LP設定] 会社情報の取得に失敗:', e);
  }

  return sheetUrl;
}

/**
 * 会社ユーザー用LP設定の初期化
 */
export function initCompanyLPSettings() {
  console.log('[LP設定] initCompanyLPSettings 開始');

  initSectionManager(updateLPPreview, {
    getCompanyDomain: () => companyDomain
  });

  initPointsSection();
  initFAQSection();
  initVideoButtonSection();

  const saveBtn = document.getElementById('btn-save-lp-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveLPSettings();
    });
  }

  const resetBtn = document.getElementById('btn-reset-lp-settings');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('LP設定をリセットしますか？')) {
        clearLPForm();
      }
    });
  }

  const togglePreviewBtn = document.getElementById('btn-toggle-preview');
  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener('click', toggleLPPreview);
  }

  const closePreviewBtn = document.getElementById('btn-close-preview');
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener('click', closeLPPreview);
  }

  const backToJobsBtn = document.getElementById('lp-back-to-jobs');
  if (backToJobsBtn) {
    backToJobsBtn.addEventListener('click', () => {
      const jobSelectGroup = document.getElementById('lp-job-select-group');
      const editor = document.getElementById('lp-editor');
      if (jobSelectGroup) jobSelectGroup.style.display = 'block';
      if (editor) editor.style.display = 'none';
      updateStepIndicatorForCompany('job');
    });
  }

  document.querySelectorAll('.preview-device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preview-device-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const device = btn.dataset.device;
      const wrapper = document.querySelector('.lp-preview-frame-wrapper');
      if (wrapper) wrapper.setAttribute('data-device', device);
    });
  });

  setupLPFormListeners();
  setupCollapsibleSections();
  setupLPColorPickers();

  setLpSettingsInitialized(true);
}

/**
 * LP設定フォームのイベントリスナーをセットアップ
 */
function setupLPFormListeners() {
  const inputIds = [
    'lp-hero-title', 'lp-hero-subtitle', 'lp-hero-image',
    'lp-cta-text', 'lp-faq',
    'lp-tiktok-pixel', 'lp-google-ads-id', 'lp-google-ads-label',
    'lp-ogp-title', 'lp-ogp-description', 'lp-ogp-image',
    'lp-video-url'
  ];

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => debouncedUpdatePreview());
    }
  });

  document.querySelectorAll('input[name="design-pattern"]').forEach(radio => {
    radio.addEventListener('change', () => debouncedUpdatePreview());
  });
}

/**
 * 折りたたみセクションの初期化
 */
function setupCollapsibleSections() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.target;
      const content = document.getElementById(targetId);
      const icon = header.querySelector('.collapse-icon');

      if (content) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        if (icon) icon.textContent = isVisible ? '▶' : '▼';
      }
    });
  });
}

/**
 * ステップインジケーターを更新（会社ユーザー用）
 */
function updateStepIndicatorForCompany(currentStep) {
  const steps = document.querySelectorAll('.lp-step');
  const stepOrder = ['job', 'edit'];
  const currentIndex = stepOrder.indexOf(currentStep);

  steps.forEach(step => {
    const stepName = step.dataset.step;
    const stepIndex = stepOrder.indexOf(stepName);

    step.classList.remove('active', 'completed');
    if (stepIndex < currentIndex) {
      step.classList.add('completed');
    } else if (stepIndex === currentIndex) {
      step.classList.add('active');
    }
  });
}

/**
 * 会社ユーザー用LP設定を読み込み
 */
export async function loadCompanyLPSettings() {
  if (!lpSettingsInitialized) {
    initCompanyLPSettings();
  }

  console.log('[LP設定] loadCompanyLPSettings 開始, companyDomain:', companyDomain);
  await loadJobsForLPSettings();
}

/**
 * LP設定用の求人一覧を読み込み
 */
async function loadJobsForLPSettings() {
  const jobGrid = document.getElementById('lp-job-grid');
  const jobSelect = document.getElementById('lp-job-select');

  if (jobGrid) {
    jobGrid.innerHTML = '<div class="lp-loading-placeholder">求人を読み込み中...</div>';
  }

  try {
    if (jobsCache.length > 0) {
      const newCache = jobsCache.map(job => ({
        id: `${companyDomain}_${job.jobId || job.id}`,
        jobId: job.jobId || job.id,
        title: job.title || job.募集タイトル || '(タイトルなし)',
        company: companyName,
        companyDomain: companyDomain,
        sheetUrl: sheetUrl,
        rawData: job
      }));

      setAllJobsCacheForLP(newCache);
      renderJobCardsForLP(newCache);

      if (jobSelect) {
        let html = '<option value="">-- 求人を選択 --</option>';
        for (const job of newCache) {
          html += `<option value="${escapeHtml(job.id)}">${escapeHtml(job.title)}</option>`;
        }
        jobSelect.innerHTML = html;
      }
    } else {
      if (jobGrid) {
        jobGrid.innerHTML = '<div class="lp-no-results"><p>求人が見つかりません。まず求人を登録してください。</p></div>';
      }
    }
  } catch (e) {
    console.error('[LP設定] 求人読み込みエラー:', e);
    if (jobGrid) {
      jobGrid.innerHTML = '<div class="lp-no-results"><p>求人データの読み込み中にエラーが発生しました</p></div>';
    }
  }
}

/**
 * LP設定用の求人カードをレンダリング
 */
function renderJobCardsForLP(jobs) {
  const grid = document.getElementById('lp-job-grid');
  if (!grid) return;

  if (jobs.length === 0) {
    grid.innerHTML = '<div class="lp-no-results"><p>求人がありません</p></div>';
    return;
  }

  grid.innerHTML = jobs.map(job => `
    <div class="lp-job-card" data-job-id="${escapeHtml(job.id)}">
      <div class="lp-job-title">${escapeHtml(job.title)}</div>
      <div class="lp-job-id">ID: ${escapeHtml(job.jobId)}</div>
      <div class="lp-job-actions">
        <button type="button" class="lp-job-action-btn primary lp-select-job-btn">LP設定を編集</button>
        <a href="lp.html?j=${encodeURIComponent(job.id)}" target="_blank" class="lp-job-action-btn secondary">プレビュー</a>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.lp-select-job-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.lp-job-card');
      const jobId = card.dataset.jobId;

      grid.querySelectorAll('.lp-job-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const jobSelect = document.getElementById('lp-job-select');
      if (jobSelect) {
        jobSelect.value = jobId;
      }

      setCurrentJobDataForLP(allJobsCacheForLP.find(j => j.id === jobId));

      await loadLPSettingsForJob(jobId);

      const jobSelectGroup = document.getElementById('lp-job-select-group');
      const editor = document.getElementById('lp-editor');
      if (jobSelectGroup) jobSelectGroup.style.display = 'none';
      if (editor) editor.style.display = 'block';

      updateStepIndicatorForCompany('edit');
    });
  });
}

/**
 * フォームの読み込み中状態を設定
 */
function setFormLoadingState(isLoading) {
  const editorEl = document.getElementById('lp-editor');
  if (!editorEl) return;

  // フォーム要素を取得
  const inputs = editorEl.querySelectorAll('input, select, textarea, button');
  inputs.forEach(el => {
    el.disabled = isLoading;
  });

  // 保存・リセットボタン
  const saveBtn = document.getElementById('btn-save-lp-settings');
  const resetBtn = document.getElementById('btn-reset-lp-settings');
  if (saveBtn) saveBtn.disabled = isLoading;
  if (resetBtn) resetBtn.disabled = isLoading;

  // ローディング表示
  const loadingOverlay = editorEl.querySelector('.lp-loading-overlay');
  if (isLoading) {
    if (!loadingOverlay) {
      const overlay = document.createElement('div');
      overlay.className = 'lp-loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div><p>読み込み中...</p>';
      editorEl.style.position = 'relative';
      editorEl.appendChild(overlay);
    }
  } else {
    loadingOverlay?.remove();
  }
}

/**
 * 特定の求人のLP設定を読み込み
 */
async function loadLPSettingsForJob(jobId) {
  console.log('[LP設定] loadLPSettingsForJob:', jobId);

  const previewBtn = document.getElementById('lp-preview-btn');
  const editModeBtn = document.getElementById('lp-edit-mode-btn');

  if (!jobId) {
    return;
  }

  // 読み込み中状態を設定
  setFormLoadingState(true);

  if (previewBtn) previewBtn.href = `lp.html?j=${encodeURIComponent(jobId)}`;
  if (editModeBtn) editModeBtn.href = `lp.html?j=${encodeURIComponent(jobId)}&edit`;

  renderHeroImagePresets();

  const patternRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
  if (patternRadio) patternRadio.checked = true;

  try {
    await ensureSheetUrl();

    if (!sheetUrl) {
      console.log('[LP設定] 管理シートURLが見つかりません');
      clearLPFormForJob();
      return;
    }

    let companySheetId = null;
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetIdMatch) {
      companySheetId = sheetIdMatch[1];
    } else if (/^[a-zA-Z0-9_-]+$/.test(sheetUrl)) {
      companySheetId = sheetUrl;
    }

    if (!companySheetId) {
      console.log('[LP設定] 管理シートIDを抽出できません');
      clearLPFormForJob();
      return;
    }

    const cacheKey = Date.now();
    const csvUrl = `https://docs.google.com/spreadsheets/d/${companySheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('LP設定')}&_t=${cacheKey}`;

    const response = await fetch(csvUrl, { cache: 'no-store' });

    if (response.ok) {
      const csvText = await response.text();
      const settings = parseLPSettingsCSVForJob(csvText, jobId);

      if (settings) {
        setInputValue('lp-hero-title', settings.heroTitle);
        setInputValue('lp-hero-subtitle', settings.heroSubtitle);
        setInputValue('lp-hero-image', settings.heroImage);
        setInputValue('lp-cta-text', settings.ctaText || '今すぐ応募する');
        setInputValue('lp-faq', settings.faq);

        setInputValue('lp-tiktok-pixel', settings.tiktokPixelId);
        setInputValue('lp-google-ads-id', settings.googleAdsId);
        setInputValue('lp-google-ads-label', settings.googleAdsLabel);

        setInputValue('lp-ogp-title', settings.ogpTitle);
        setInputValue('lp-ogp-description', settings.ogpDescription);
        setInputValue('lp-ogp-image', settings.ogpImage);

        // 動画ボタン設定
        const showVideoCheckbox = document.getElementById('lp-show-video-button');
        const videoUrlGroup = document.getElementById('video-url-group');
        if (showVideoCheckbox) {
          showVideoCheckbox.checked = String(settings.showVideoButton).toLowerCase() === 'true' || settings.showVideoButton === true;
          if (videoUrlGroup) {
            videoUrlGroup.style.display = showVideoCheckbox.checked ? 'block' : 'none';
          }
        }
        setInputValue('lp-video-url', settings.videoUrl);

        if (settings.designPattern) {
          const radio = document.querySelector(`input[name="design-pattern"][value="${settings.designPattern}"]`);
          if (radio) radio.checked = true;
        }

        // カスタムカラー設定を反映
        setLPCustomColors({
          primary: settings.customPrimary || '',
          accent: settings.customAccent || '',
          bg: settings.customBg || '',
          text: settings.customText || ''
        });

        updateHeroImagePresetSelection(settings.heroImage || '');
        loadSectionsFromSettings(settings);

        // リアルタイムプレビューを更新
        debouncedUpdatePreview();

        return;
      }
    }
  } catch (e) {
    console.log('[LP設定] LP設定シートが見つかりません:', e);
  } finally {
    // 読み込み完了
    setFormLoadingState(false);
  }

  clearLPFormForJob();
  // リアルタイムプレビューを更新（新規作成時も）
  debouncedUpdatePreview();
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

/**
 * LP設定CSVをパース（求人ID単位）
 */
function parseLPSettingsCSVForJob(csvText, jobId) {
  const lines = splitCSVToRows(csvText);
  const headers = parseCSVLine(lines[0] || '');

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const rowData = {};

    headers.forEach((header, idx) => {
      const key = header.replace(/"/g, '').trim();
      rowData[key] = values[idx] || '';
    });

    const rowJobId = rowData.jobId || rowData['求人ID'] || '';
    if (rowJobId === jobId) {
      const result = {
        heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
        heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
        heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
        ctaText: rowData.ctaText || rowData['CTAテキスト'] || '',
        faq: rowData.faq || rowData['FAQ'] || '',
        designPattern: rowData.designPattern || rowData['デザインパターン'] || '',
        layoutStyle: rowData.layoutStyle || rowData['レイアウトスタイル'] || 'default',
        sectionOrder: rowData.sectionOrder || rowData['セクション順序'] || '',
        sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || '',
        tiktokPixelId: rowData.tiktokPixelId || rowData['TikTok Pixel ID'] || '',
        googleAdsId: rowData.googleAdsId || rowData['Google Ads ID'] || '',
        googleAdsLabel: rowData.googleAdsLabel || rowData['Google Ads ラベル'] || '',
        ogpTitle: rowData.ogpTitle || rowData['OGPタイトル'] || '',
        ogpDescription: rowData.ogpDescription || rowData['OGP説明文'] || '',
        ogpImage: rowData.ogpImage || rowData['OGP画像'] || '',
        showVideoButton: rowData.showVideoButton || rowData['動画ボタン表示'] || '',
        videoUrl: rowData.videoUrl || rowData['動画URL'] || '',
        lpContent: rowData.lpContent || rowData['LP構成'] || '',
        // カスタムカラー設定
        customPrimary: rowData.customPrimary || rowData['カスタムカラー（メイン）'] || '',
        customAccent: rowData.customAccent || rowData['カスタムカラー（アクセント）'] || '',
        customBg: rowData.customBg || rowData['カスタムカラー（背景）'] || '',
        customText: rowData.customText || rowData['カスタムカラー（テキスト）'] || ''
      };

      for (let j = 1; j <= 6; j++) {
        result[`pointTitle${j}`] = rowData[`pointTitle${j}`] || rowData[`ポイント${j}タイトル`] || '';
        result[`pointDesc${j}`] = rowData[`pointDesc${j}`] || rowData[`ポイント${j}説明`] || '';
      }

      return result;
    }
  }
  return null;
}

/**
 * CSVテキストを正しく行に分割
 */
function splitCSVToRows(csvText) {
  const rows = [];
  let currentRow = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      if (csvText[i + 1] === '"') {
        currentRow += '""';
        i++;
      } else {
        insideQuotes = !insideQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !insideQuotes) {
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else if (char === '\r') {
      continue;
    } else {
      currentRow += char;
    }
  }

  if (currentRow.trim()) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * LP設定フォームをクリア（求人単位）
 */
function clearLPFormForJob() {
  const fields = [
    'lp-hero-title', 'lp-hero-subtitle', 'lp-hero-image',
    'lp-faq',
    'lp-tiktok-pixel', 'lp-google-ads-id', 'lp-google-ads-label',
    'lp-ogp-title', 'lp-ogp-description', 'lp-ogp-image',
    'lp-video-url'
  ];
  fields.forEach(id => setInputValue(id, ''));
  setInputValue('lp-cta-text', '今すぐ応募する');

  // 動画ボタン設定をリセット
  const showVideoCheckbox = document.getElementById('lp-show-video-button');
  const videoUrlGroup = document.getElementById('video-url-group');
  if (showVideoCheckbox) showVideoCheckbox.checked = false;
  if (videoUrlGroup) videoUrlGroup.style.display = 'none';

  const standardRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
  if (standardRadio) standardRadio.checked = true;

  // カスタムカラーをリセット
  resetLPCustomColors();

  updateHeroImagePresetSelection('');
  loadSectionsFromSettings({});
}

/**
 * LP設定フォームをリセット
 */
export function clearLPForm() {
  clearLPFormForJob();
}

/**
 * 会社ユーザー用LP設定を保存
 */
export async function saveCompanyLPSettings() {
  await saveLPSettings();
}
