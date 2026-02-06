/**
 * Admin Dashboard - LP設定モジュール
 */

import { escapeHtml, showToast } from '@shared/utils.js';
import { spreadsheetConfig, heroImagePresets, useFirestore } from './config.js';
import * as FirestoreService from '@shared/firestore-service.js';
import { uploadLPImage, selectImageFile } from './image-uploader.js';
import { parseCSVLine } from './csv-utils.js';
import { getCompaniesCache, loadCompanyManageData } from './company-manager.js';
import { isAdmin, getUserCompanyDomain } from './auth.js';
import {
  initSectionManager,
  loadSectionsFromSettings,
  getCurrentLPContent,
  renderSectionsList
} from './lp-section-manager.js';
import { LAYOUT_STYLES } from '@features/lp/LPEditor.js';

// レイアウトスタイルごとのデフォルトカラー（採用ページと統一された5種類）
const layoutStyleColors = {
  // モダン: 洗練されたダークグレー + 青
  modern: { primary: '#0984e3', accent: '#74b9ff', bg: '#f8fafc', text: '#2d3436' },
  // アットホーム: 温かみのあるオレンジ系
  athome: { primary: '#e67e22', accent: '#f39c12', bg: '#fef9f3', text: '#5d4037' },
  // キュート: ポップで可愛いパステル調
  cute: { primary: '#ff8fa3', accent: '#fab1a0', bg: '#fff5f7', text: '#6d4c41' },
  // 信頼: 誠実で堅実な印象
  trust: { primary: '#0077c2', accent: '#4ea8de', bg: '#f0f8ff', text: '#1a2a3a' },
  // 建築: 力強いオレンジ + ダーク
  kenchiku: { primary: '#f39c12', accent: '#e67e22', bg: '#f5f5f5', text: '#2c3e50' }
};

let previewUpdateTimer = null;
const MAX_POINTS = 6;
let sectionManagerInitialized = false;
let allJobsCache = [];
let currentJobData = null;
let visibleCompaniesCache = [];
let selectedCompanyDomain = null;

// LP設定用の会社・求人リストを読み込み
export async function loadJobListForLP() {
  const companySelectGroup = document.getElementById('lp-company-select-group');
  const jobSelectGroup = document.getElementById('lp-job-select-group');
  const stepsIndicator = document.getElementById('lp-selection-steps');

  // 会社データを取得
  let companiesCache = getCompaniesCache();
  if (!companiesCache || companiesCache.length === 0) {
    await loadCompanyManageData();
    companiesCache = getCompaniesCache();
  }

  visibleCompaniesCache = companiesCache.filter(c =>
    c.companyDomain && (c.showCompany === true || c.showCompany === '○' || c.showCompany === '◯')
  );

  // 権限に応じた表示
  if (isAdmin()) {
    // admin: 会社選択 → 求人選択
    if (companySelectGroup) companySelectGroup.style.display = 'block';
    if (jobSelectGroup) jobSelectGroup.style.display = 'none';
    if (stepsIndicator) stepsIndicator.style.display = 'flex';

    // 会社カードグリッドを作成
    renderCompanyCards(visibleCompaniesCache);

    // 検索機能を設定
    const searchInput = document.getElementById('lp-company-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = query
          ? visibleCompaniesCache.filter(c =>
              c.company?.toLowerCase().includes(query) ||
              c.companyDomain?.toLowerCase().includes(query)
            )
          : visibleCompaniesCache;
        renderCompanyCards(filtered);
      });
    }

    // 戻るボタンのイベント（動的読み込み対応: 重複登録防止）
    const backBtn = document.getElementById('lp-back-to-companies');
    if (backBtn && !backBtn.hasAttribute('data-listener-attached')) {
      backBtn.addEventListener('click', () => {
        if (companySelectGroup) companySelectGroup.style.display = 'block';
        if (jobSelectGroup) jobSelectGroup.style.display = 'none';
        const editor = document.getElementById('lp-editor');
        if (editor) editor.style.display = 'none';
        updateStepIndicator('company');
      });
      backBtn.setAttribute('data-listener-attached', 'true');
    }
  } else {
    // 会社ユーザー: 自社の求人のみ表示
    const userCompanyDomain = getUserCompanyDomain();
    if (companySelectGroup) companySelectGroup.style.display = 'none';
    if (stepsIndicator) stepsIndicator.style.display = 'none';

    // 戻るボタンを非表示
    const backBtn = document.getElementById('lp-back-to-companies');
    if (backBtn) backBtn.style.display = 'none';

    if (userCompanyDomain) {
      selectedCompanyDomain = userCompanyDomain;
      await loadJobsForCompany(userCompanyDomain);
      if (jobSelectGroup) jobSelectGroup.style.display = 'block';
    } else {
      console.warn('[LP設定] 会社ドメインが設定されていません');
      if (jobSelectGroup) jobSelectGroup.style.display = 'none';
    }
  }
}

// 会社カードをレンダリング
function renderCompanyCards(companies) {
  const grid = document.getElementById('lp-company-grid');
  if (!grid) return;

  if (companies.length === 0) {
    grid.innerHTML = '<div class="lp-no-results"><p>該当する会社がありません</p></div>';
    return;
  }

  grid.innerHTML = companies.map(company => {
    const initial = (company.company || company.companyDomain || '?').charAt(0).toUpperCase();
    return `
      <div class="lp-company-card" data-domain="${escapeHtml(company.companyDomain)}">
        <div class="lp-company-icon">${escapeHtml(initial)}</div>
        <div class="lp-company-name">${escapeHtml(company.company || company.companyDomain)}</div>
        <div class="lp-company-domain">${escapeHtml(company.companyDomain)}</div>
      </div>
    `;
  }).join('');

  // カードクリックイベント
  grid.querySelectorAll('.lp-company-card').forEach(card => {
    card.addEventListener('click', async () => {
      const domain = card.dataset.domain;
      selectedCompanyDomain = domain;

      // 選択状態を更新
      grid.querySelectorAll('.lp-company-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // 求人を読み込んで表示を切り替え
      await loadJobsForCompany(domain);

      const companySelectGroup = document.getElementById('lp-company-select-group');
      const jobSelectGroup = document.getElementById('lp-job-select-group');
      if (companySelectGroup) companySelectGroup.style.display = 'none';
      if (jobSelectGroup) jobSelectGroup.style.display = 'block';

      // ステップインジケーターを更新
      updateStepIndicator('job');

      // 選択した会社名を表示
      const companyNameEl = document.getElementById('lp-selected-company-name');
      if (companyNameEl) {
        const company = visibleCompaniesCache.find(c => c.companyDomain === domain);
        companyNameEl.textContent = `${company?.company || domain} の求人`;
      }
    });
  });
}

// ステップインジケーターを更新
function updateStepIndicator(currentStep) {
  const steps = document.querySelectorAll('.lp-step');
  const stepOrder = ['company', 'job', 'edit'];
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

// 特定の会社の求人を読み込む
async function loadJobsForCompany(companyDomain) {
  const jobGrid = document.getElementById('lp-job-grid');
  const jobSelect = document.getElementById('lp-job-select');

  // 会社データを取得
  const company = visibleCompaniesCache.find(c => c.companyDomain === companyDomain);
  if (!company) {
    console.warn(`[LP設定] 会社が見つかりません: ${companyDomain}`);
    return;
  }

  // ローディング表示
  if (jobGrid) {
    jobGrid.innerHTML = '<div class="lp-loading-placeholder">求人を読み込み中...</div>';
  }

  // Firestoreから求人を読み込む
  if (useFirestore) {
    try {
      FirestoreService.initFirestore();
      const result = await FirestoreService.getJobs(companyDomain);

      if (!result.success) {
        console.warn(`[LP設定] Firestore求人読み込みエラー: ${result.error}`);
        if (jobGrid) {
          jobGrid.innerHTML = '<div class="lp-no-results"><p>求人データの読み込みに失敗しました</p></div>';
        }
        return;
      }

      const jobs = (result.jobs || []).map(job => ({
        id: `${companyDomain}_${job.id}`,
        jobId: job.id,
        title: job.title || '(タイトルなし)',
        company: company.company,
        companyDomain: companyDomain,
        manageSheetUrl: company.manageSheetUrl,
        rawData: job
      }));

      allJobsCache = jobs;
      renderJobCards(jobs);

      // 互換性のため非表示のselectも更新
      if (jobSelect) {
        let html = '<option value="">-- 求人を選択 --</option>';
        for (const job of jobs) {
          html += `<option value="${escapeHtml(job.id)}">${escapeHtml(job.title)}</option>`;
        }
        jobSelect.innerHTML = html;
      }

    } catch (e) {
      console.warn(`[LP設定] Firestore求人読み込みエラー: ${companyDomain}`, e);
      if (jobGrid) {
        jobGrid.innerHTML = '<div class="lp-no-results"><p>求人データの読み込み中にエラーが発生しました</p></div>';
      }
    }
    return;
  }

  // 従来のCSV読み込み
  const sheetName = company.jobsSheet?.trim();
  const manageSheetUrl = company.manageSheetUrl?.trim();

  let csvUrl = '';

  if (sheetName) {
    csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  } else if (manageSheetUrl) {
    const sheetIdMatch = manageSheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetIdMatch) {
      const externalSheetId = sheetIdMatch[1];
      csvUrl = `https://docs.google.com/spreadsheets/d/${externalSheetId}/gviz/tq?tqx=out:csv`;
    }
  }

  if (!csvUrl) {
    console.warn(`[LP設定] 求人シートURLが見つかりません: ${companyDomain}`);
    if (jobGrid) {
      jobGrid.innerHTML = '<div class="lp-no-results"><p>求人シートが設定されていません</p></div>';
    }
    return;
  }

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      console.warn(`[LP設定] 求人シートの読み込みに失敗: ${response.status}`);
      if (jobGrid) {
        jobGrid.innerHTML = '<div class="lp-no-results"><p>求人データの読み込みに失敗しました</p></div>';
      }
      return;
    }

    const csvText = await response.text();
    const jobs = parseJobsCSV(csvText, company);
    allJobsCache = jobs;

    renderJobCards(jobs);

    if (jobSelect) {
      let html = '<option value="">-- 求人を選択 --</option>';
      for (const job of jobs) {
        html += `<option value="${escapeHtml(job.id)}">${escapeHtml(job.title)}</option>`;
      }
      jobSelect.innerHTML = html;
    }

  } catch (e) {
    console.warn(`[LP設定] 求人読み込みエラー: ${companyDomain}`, e);
    if (jobGrid) {
      jobGrid.innerHTML = '<div class="lp-no-results"><p>求人データの読み込み中にエラーが発生しました</p></div>';
    }
  }
}

// 求人カードをレンダリング
function renderJobCards(jobs) {
  const grid = document.getElementById('lp-job-grid');
  if (!grid) return;

  if (jobs.length === 0) {
    grid.innerHTML = '<div class="lp-no-results"><p>この会社には求人がありません</p></div>';
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

  // カードクリックイベント（LP設定を編集ボタン）
  grid.querySelectorAll('.lp-select-job-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.lp-job-card');
      const jobId = card.dataset.jobId;

      // 選択状態を更新
      grid.querySelectorAll('.lp-job-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // 非表示のselectも更新（互換性のため）
      const jobSelect = document.getElementById('lp-job-select');
      if (jobSelect) {
        jobSelect.value = jobId;
      }

      // LP設定を読み込み
      await loadLPSettings(jobId);

      // ステップインジケーターを更新
      updateStepIndicator('edit');
    });
  });
}

// 求人CSVをパース
function parseJobsCSV(csvText, company) {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[0] || '');
  const jobs = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const job = {};

    headers.forEach((header, idx) => {
      const cleanHeader = header.replace(/"/g, '').trim();
      // ヘッダーが「英語名 日本語名」形式の場合、英語名をキーとして使用
      const key = cleanHeader.split(' ')[0] || cleanHeader;
      job[key] = values[idx] || '';
    });

    // 表示対象の求人のみ
    if (job.visible === 'false' || job.visible === 'FALSE') continue;

    // 求人IDを生成（会社ドメイン + 求人ID）
    const jobId = job.jobId || job['求人ID'] || job.id || job['ID'] || `job-${i}`;

    // タイトルを取得（複数のヘッダー名に対応）
    const title = job.title || job['タイトル'] || job['求人タイトル'] || job['募集タイトル'] || job['求人名'] || job['募集名'] || '(タイトルなし)';

    jobs.push({
      id: `${company.companyDomain}_${jobId}`,
      jobId: jobId,
      title: title,
      company: company.company,
      companyDomain: company.companyDomain,
      jobsSheet: company.jobsSheet,
      manageSheetUrl: company.manageSheetUrl,
      rawData: job
    });
  }

  return jobs;
}


// 旧関数（互換性のため残す）
export async function loadCompanyListForLP() {
  return loadJobListForLP();
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

// LP設定を読み込み（求人ID単位）
export async function loadLPSettings(jobId) {
  const editor = document.getElementById('lp-editor');
  const previewBtn = document.getElementById('lp-preview-btn');
  const editModeBtn = document.getElementById('lp-edit-mode-btn');

  if (!jobId) {
    if (editor) editor.style.display = 'none';
    currentJobData = null;
    return;
  }

  // 求人データを取得
  currentJobData = allJobsCache.find(j => j.id === jobId);
  if (!currentJobData) {
    if (editor) editor.style.display = 'none';
    return;
  }

  if (editor) editor.style.display = 'block';

  // 読み込み中状態を設定
  setFormLoadingState(true);

  // LP URLは既にcompanyDomain_jobId形式のcurrentJobData.idを使用
  const lpJobId = currentJobData.id;

  if (previewBtn) previewBtn.href = `lp.html?j=${encodeURIComponent(lpJobId)}`;
  if (editModeBtn) editModeBtn.href = `lp.html?j=${encodeURIComponent(lpJobId)}&edit`;

  renderHeroImagePresets();

  // ヒーロー画像アップロードを設定
  setupHeroImageUpload(currentJobData?.companyDomain || selectedCompanyDomain);

  // デフォルトのデザインパターンを設定
  const patternRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
  if (patternRadio) patternRadio.checked = true;

  try {
    // Firestoreから読み込み
    if (useFirestore) {
      const companyDomain = currentJobData?.companyDomain || selectedCompanyDomain;
      console.log('[LP設定] Firestoreから読み込み:', companyDomain, jobId);

      FirestoreService.initFirestore();
      const result = await FirestoreService.getLPSettings(companyDomain, jobId);

      if (result.success && result.settings && Object.keys(result.settings).length > 0) {
        const settings = result.settings;
        applyLPSettingsToForm(settings);
        console.log('[LP設定] Firestoreから設定を読み込みました');
      } else {
        console.log('[LP設定] Firestoreに設定がありません、デフォルト表示');
        clearLPForm();
      }

      setFormLoadingState(false);
      return;
    }

    // 従来の方法: 会社の管理シートからLP設定を読み込む
    // manageSheetUrl または jobsSheet（管理シート）を使用
    const sheetUrl = currentJobData.manageSheetUrl?.trim() || currentJobData.jobsSheet?.trim();
    console.log('[LP設定] 管理シートURL:', sheetUrl);

    if (!sheetUrl) {
      console.log('[LP設定] 管理シートURLが見つかりません');
      clearLPForm();
      return;
    }

    // スプレッドシートIDを抽出（URLまたはIDの両方に対応）
    let companySheetId = null;
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetIdMatch) {
      companySheetId = sheetIdMatch[1];
    } else if (/^[a-zA-Z0-9_-]+$/.test(sheetUrl)) {
      // IDのみの場合
      companySheetId = sheetUrl;
    }

    if (!companySheetId) {
      console.log('[LP設定] 管理シートIDを抽出できません');
      clearLPForm();
      return;
    }

    // キャッシュを防ぐためにタイムスタンプを追加
    const cacheKey = Date.now();
    const csvUrl = `https://docs.google.com/spreadsheets/d/${companySheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('LP設定')}&_t=${cacheKey}`;
    console.log('[LP設定] LP設定シートURL:', csvUrl);

    const response = await fetch(csvUrl, { cache: 'no-store' });

    if (response.ok) {
      const csvText = await response.text();
      const settings = parseLPSettingsCSV(csvText, jobId);

      if (settings) {
        setInputValue('lp-hero-title', settings.heroTitle);
        setInputValue('lp-hero-subtitle', settings.heroSubtitle);
        setInputValue('lp-hero-image', settings.heroImage);

        // ポイントを動的にレンダリング
        const points = [];
        for (let i = 1; i <= 6; i++) {
          const title = settings[`pointTitle${i}`] || '';
          const desc = settings[`pointDesc${i}`] || '';
          if (title || desc) {
            points.push({ title, desc });
          }
        }
        renderPointInputs(points.length > 0 ? points : [{ title: '', desc: '' }, { title: '', desc: '' }, { title: '', desc: '' }]);

        setInputValue('lp-cta-text', settings.ctaText || '今すぐ応募する');
        setInputValue('lp-faq', settings.faq);

        // FAQエディターをレンダリング
        const faqs = parseFAQString(settings.faq);
        renderFAQInputs(faqs);

        if (settings.designPattern) {
          const patternRadio = document.querySelector(`input[name="design-pattern"][value="${settings.designPattern}"]`);
          if (patternRadio) patternRadio.checked = true;
        }

        if (settings.sectionOrder) {
          applySectionOrder(settings.sectionOrder);
        }

        if (settings.sectionVisibility) {
          applySectionVisibility(settings.sectionVisibility);
        }

        // 広告トラッキング設定
        setInputValue('lp-tiktok-pixel', settings.tiktokPixelId);
        setInputValue('lp-google-ads-id', settings.googleAdsId);
        setInputValue('lp-google-ads-label', settings.googleAdsLabel);
        setInputValue('lp-meta-pixel', settings.metaPixelId);
        setInputValue('lp-line-tag', settings.lineTagId);
        setInputValue('lp-clarity', settings.clarityProjectId);

        // OGP設定
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

        // カスタムカラー設定を反映
        setLPCustomColors({
          primary: settings.customPrimary || '',
          accent: settings.customAccent || '',
          bg: settings.customBg || '',
          text: settings.customText || ''
        });

        updateHeroImagePresetSelection(settings.heroImage || '');
        updateHeroImageUploadPreview(settings.heroImage || '');

        // セクションマネージャーを初期化してデータを読み込み
        initSectionManagerIfNeeded();
        loadSectionsFromSettings(settings);
        renderSectionsList();

        // リアルタイムプレビューをセットアップ
        setupLPLivePreview();

        return;
      }
    }
  } catch (e) {
    console.log('LP設定シートが見つかりません');
  } finally {
    // 読み込み完了
    setFormLoadingState(false);
  }

  clearLPForm();
  // リアルタイムプレビューをセットアップ（新規作成時も）
  setupLPLivePreview();
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

/**
 * LP設定をフォームに反映する共通関数
 */
function applyLPSettingsToForm(settings) {
  setInputValue('lp-hero-title', settings.heroTitle);
  setInputValue('lp-hero-subtitle', settings.heroSubtitle);
  setInputValue('lp-hero-image', settings.heroImage);

  // ポイントを動的にレンダリング
  const points = [];
  for (let i = 1; i <= 6; i++) {
    const title = settings[`pointTitle${i}`] || '';
    const desc = settings[`pointDesc${i}`] || '';
    if (title || desc) {
      points.push({ title, desc });
    }
  }
  renderPointInputs(points.length > 0 ? points : [{ title: '', desc: '' }, { title: '', desc: '' }, { title: '', desc: '' }]);

  setInputValue('lp-cta-text', settings.ctaText || '今すぐ応募する');
  setInputValue('lp-faq', settings.faq);

  // FAQエディターをレンダリング
  const faqs = parseFAQString(settings.faq);
  renderFAQInputs(faqs);

  if (settings.designPattern) {
    const patternRadio = document.querySelector(`input[name="design-pattern"][value="${settings.designPattern}"]`);
    if (patternRadio) patternRadio.checked = true;
  }

  if (settings.sectionOrder) {
    applySectionOrder(settings.sectionOrder);
  }

  if (settings.sectionVisibility) {
    applySectionVisibility(settings.sectionVisibility);
  }

  // 広告トラッキング設定
  setInputValue('lp-tiktok-pixel', settings.tiktokPixelId);
  setInputValue('lp-google-ads-id', settings.googleAdsId);
  setInputValue('lp-google-ads-label', settings.googleAdsLabel);
  setInputValue('lp-meta-pixel', settings.metaPixelId);
  setInputValue('lp-line-tag', settings.lineTagId);
  setInputValue('lp-clarity', settings.clarityProjectId);

  // OGP設定
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

  // カスタムカラー設定を反映
  setLPCustomColors({
    primary: settings.customPrimary || '',
    accent: settings.customAccent || '',
    bg: settings.customBg || '',
    text: settings.customText || ''
  });

  updateHeroImagePresetSelection(settings.heroImage || '');
  updateHeroImageUploadPreview(settings.heroImage || '');

  // セクションマネージャーを初期化してデータを読み込み
  initSectionManagerIfNeeded();
  loadSectionsFromSettings(settings);
  renderSectionsList();

  // リアルタイムプレビューをセットアップ
  setupLPLivePreview();
}

/**
 * LPカスタムカラーを設定
 */
function setLPCustomColors(colors) {
  const colorIds = ['primary', 'accent', 'bg', 'text'];
  colorIds.forEach(id => {
    const colorInput = document.getElementById(`lp-custom-${id}`);
    const textInput = document.getElementById(`lp-custom-${id}-text`);
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
 * LPカスタムカラーをリセット
 */
function resetLPCustomColors() {
  // 現在選択されているレイアウトスタイルのデフォルトカラーを適用
  const selectedLayoutOption = document.querySelector('.lp-admin-layout-option.selected');
  const layoutStyle = selectedLayoutOption?.dataset?.layout || 'modern';
  const defaults = layoutStyleColors[layoutStyle] || layoutStyleColors.modern;

  const colorIds = ['primary', 'accent', 'bg', 'text'];
  colorIds.forEach(id => {
    const colorInput = document.getElementById(`lp-custom-${id}`);
    const textInput = document.getElementById(`lp-custom-${id}-text`);
    if (colorInput) colorInput.value = defaults[id] || '#000000';
    if (textInput) textInput.value = '';  // 空にしてデフォルトを使用
  });
}

/**
 * LPカラーピッカーのイベントリスナーをセットアップ
 */
function setupLPColorPickers() {
  const colorIds = ['primary', 'accent', 'bg', 'text'];

  colorIds.forEach(id => {
    const colorInput = document.getElementById(`lp-custom-${id}`);
    const textInput = document.getElementById(`lp-custom-${id}-text`);

    if (colorInput && textInput) {
      // カラーピッカー → テキスト入力
      colorInput.addEventListener('input', () => {
        textInput.value = colorInput.value;
        debouncedUpdatePreview();
      });

      // テキスト入力 → カラーピッカー
      textInput.addEventListener('input', () => {
        const val = textInput.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          colorInput.value = val;
        }
        debouncedUpdatePreview();
      });
    }
  });

  // リセットボタン
  const resetBtn = document.getElementById('lp-reset-colors');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetLPCustomColors();
      debouncedUpdatePreview();
    });
  }
}

/**
 * 現在のカスタムカラーを取得
 */
function getLPCustomColors() {
  const selectedLayoutOption = document.querySelector('.lp-admin-layout-option.selected');
  const layoutStyle = selectedLayoutOption?.dataset?.layout || 'modern';
  const baseColors = layoutStyleColors[layoutStyle] || layoutStyleColors.modern;

  return {
    primary: document.getElementById('lp-custom-primary-text')?.value || baseColors.primary,
    accent: document.getElementById('lp-custom-accent-text')?.value || baseColors.accent,
    bg: document.getElementById('lp-custom-bg-text')?.value || baseColors.bg,
    text: document.getElementById('lp-custom-text-text')?.value || baseColors.text
  };
}

// リアルタイムプレビュー初期化フラグ
let lpLivePreviewInitialized = false;

/**
 * リアルタイムプレビューのセットアップ
 */
function setupLPLivePreview() {
  // 既に初期化済みの場合はスキップ（重複登録防止）
  if (lpLivePreviewInitialized) {
    // 既存のセットアップ済みなら、プレビューを更新するだけ
    updateLPPreview();
    return;
  }

  const previewContainer = document.getElementById('lp-preview-container');
  if (!previewContainer) return;

  // 監視するフォームフィールドのIDリスト
  const fieldIds = [
    'lp-hero-title',
    'lp-hero-subtitle',
    'lp-hero-image',
    'lp-cta-text',
    'lp-faq',
    'lp-tiktok-pixel',
    'lp-google-ads-id',
    'lp-google-ads-label',
    'lp-meta-pixel',
    'lp-line-tag',
    'lp-clarity',
    'lp-ogp-title',
    'lp-ogp-description',
    'lp-ogp-image',
    'lp-video-url'
  ];

  // 各フィールドにinputイベントリスナーを追加
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => debouncedUpdatePreview());
    }
  });

  // デザインパターンのradioボタンにchangeイベントリスナーを追加
  document.querySelectorAll('input[name="design-pattern"]').forEach(radio => {
    radio.addEventListener('change', () => debouncedUpdatePreview());
  });

  // 動画ボタン表示チェックボックス
  const showVideoCheckbox = document.getElementById('lp-show-video-button');
  if (showVideoCheckbox) {
    showVideoCheckbox.addEventListener('change', () => debouncedUpdatePreview());
  }

  // レイアウトスタイルオプション（クリック時）
  document.querySelectorAll('.lp-admin-layout-option').forEach(option => {
    option.addEventListener('click', () => {
      // 少し遅延させて選択状態が更新されてからプレビュー更新
      setTimeout(() => debouncedUpdatePreview(), 50);
    });
  });

  // カラーピッカーをセットアップ
  setupLPColorPickers();

  lpLivePreviewInitialized = true;

  // 初期プレビューを更新
  updateLPPreview();
}

// セクションマネージャーを初期化（一度だけ）
function initSectionManagerIfNeeded() {
  if (!sectionManagerInitialized) {
    initSectionManager(updateLPPreview, {
      getCompanyDomain: () => currentJobData?.companyDomain || null
    });
    sectionManagerInitialized = true;
  }
}

// ポイント入力フィールドをレンダリング
export function renderPointInputs(points = [{ title: '', desc: '' }, { title: '', desc: '' }, { title: '', desc: '' }]) {
  const container = document.getElementById('point-inputs-container');
  if (!container) return;

  container.innerHTML = points.map((point, index) => `
    <div class="point-input-group" data-point-index="${index}">
      <label>ポイント${index + 1}</label>
      <input type="text" class="point-title" placeholder="タイトル" value="${escapeHtml(point.title || '')}">
      <input type="text" class="point-desc" placeholder="説明文" value="${escapeHtml(point.desc || '')}">
      <button type="button" class="btn-remove-point" title="削除">&times;</button>
    </div>
  `).join('');

  // 削除ボタンのイベント
  container.querySelectorAll('.btn-remove-point').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const group = e.target.closest('.point-input-group');
      if (group && container.children.length > 1) {
        group.remove();
        reindexPoints();
        updateAddButtonState();
        debouncedUpdatePreview();
      }
    });
  });

  // 入力時にプレビュー更新
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => debouncedUpdatePreview());
  });

  updateAddButtonState();
}

// ポイントのインデックスを振り直す
function reindexPoints() {
  const container = document.getElementById('point-inputs-container');
  if (!container) return;

  container.querySelectorAll('.point-input-group').forEach((group, index) => {
    group.dataset.pointIndex = index;
    const label = group.querySelector('label');
    if (label) label.textContent = `ポイント${index + 1}`;
  });
}

// 追加ボタンの状態を更新
function updateAddButtonState() {
  const container = document.getElementById('point-inputs-container');
  const addBtn = document.getElementById('btn-add-point');
  if (!container || !addBtn) return;

  const count = container.children.length;
  addBtn.disabled = count >= MAX_POINTS;
}

// ポイントを追加
export function addPoint() {
  const container = document.getElementById('point-inputs-container');
  if (!container) return;

  const count = container.children.length;
  if (count >= MAX_POINTS) return;

  const newIndex = count;
  const div = document.createElement('div');
  div.className = 'point-input-group';
  div.dataset.pointIndex = newIndex;
  div.innerHTML = `
    <label>ポイント${newIndex + 1}</label>
    <input type="text" class="point-title" placeholder="タイトル" value="">
    <input type="text" class="point-desc" placeholder="説明文" value="">
    <button type="button" class="btn-remove-point" title="削除">&times;</button>
  `;

  // 削除ボタンのイベント
  div.querySelector('.btn-remove-point').addEventListener('click', () => {
    if (container.children.length > 1) {
      div.remove();
      reindexPoints();
      updateAddButtonState();
      debouncedUpdatePreview();
    }
  });

  // 入力時にプレビュー更新
  div.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => debouncedUpdatePreview());
  });

  container.appendChild(div);
  updateAddButtonState();

  // 新しいフィールドにフォーカス
  div.querySelector('.point-title').focus();
}

// 現在のポイントデータを取得
export function getPointsData() {
  const container = document.getElementById('point-inputs-container');
  if (!container) return [];

  const points = [];
  container.querySelectorAll('.point-input-group').forEach(group => {
    const title = group.querySelector('.point-title')?.value || '';
    const desc = group.querySelector('.point-desc')?.value || '';
    points.push({ title, desc });
  });
  return points;
}

// ポイント追加ボタンの初期化
export function initPointsSection() {
  const addBtn = document.getElementById('btn-add-point');
  if (addBtn) {
    addBtn.addEventListener('click', addPoint);
  }

  // 初期状態で3つのポイントを表示
  renderPointInputs();
}

// 動画ボタン設定の初期化
export function initVideoButtonSection() {
  const checkbox = document.getElementById('lp-show-video-button');
  const videoUrlGroup = document.getElementById('video-url-group');

  if (checkbox && videoUrlGroup) {
    checkbox.addEventListener('change', () => {
      videoUrlGroup.style.display = checkbox.checked ? 'block' : 'none';
    });
  }
}

// ===========================================
// ヒーロー画像アップロード
// ===========================================

/**
 * ヒーロー画像プレビューを更新
 */
export function updateHeroImageUploadPreview(url) {
  const previewEl = document.getElementById('lp-hero-image-preview');
  if (!previewEl) return;

  if (url) {
    previewEl.innerHTML = `<img src="${escapeHtml(url)}" alt="ヒーロー画像プレビュー" style="max-width: 200px; max-height: 120px; object-fit: cover; border-radius: 8px;">`;
    previewEl.style.display = 'block';
  } else {
    previewEl.innerHTML = '';
    previewEl.style.display = 'none';
  }
}

/**
 * ヒーロー画像アップロードボタンを設定
 */
export function setupHeroImageUpload(companyDomain) {
  let uploadBtn = document.getElementById('btn-upload-hero-image');
  let urlInput = document.getElementById('lp-hero-image');
  const previewEl = document.getElementById('lp-hero-image-preview');

  if (!uploadBtn || !urlInput) return;

  // 既存のイベントリスナーを削除するために要素を複製して置き換え
  const newUploadBtn = uploadBtn.cloneNode(true);
  uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
  uploadBtn = newUploadBtn;

  // URL入力時のプレビュー更新
  urlInput.addEventListener('input', () => {
    updateHeroImageUploadPreview(urlInput.value);
  });

  // 初期プレビュー
  if (urlInput.value) {
    updateHeroImageUploadPreview(urlInput.value);
  }

  // アップロードボタンクリック
  uploadBtn.addEventListener('click', async () => {
    const domain = companyDomain || selectedCompanyDomain;
    if (!domain) {
      showToast('会社情報が設定されていません', 'error');
      return;
    }

    try {
      // ファイル選択
      const file = await selectImageFile({ accept: 'image/png,image/jpeg,image/webp' });

      // アップロード中の表示
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="upload-spinner"></span> アップロード中...';
      if (previewEl) {
        previewEl.classList.add('uploading');
        previewEl.innerHTML = '<div class="upload-spinner"></div>';
        previewEl.style.display = 'block';
      }

      // Cloudinaryにアップロード
      const timestamp = Date.now();
      const url = await uploadLPImage(file, domain);

      // キャッシュ回避のためタイムスタンプを追加
      const urlWithCache = url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;

      // URLを入力欄に設定
      urlInput.value = urlWithCache;
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));

      // プレビューを更新
      updateHeroImageUploadPreview(urlWithCache);

      // ヒーロー画像プリセットの選択状態を更新
      updateHeroImagePresetSelection(urlWithCache);

      showToast('画像をアップロードしました', 'success');
    } catch (error) {
      console.error('[LPSettings] ヒーロー画像アップロードエラー:', error);
      if (error.message !== 'ファイルが選択されませんでした') {
        showToast('アップロードに失敗しました: ' + error.message, 'error');
      }
      // プレビューを元に戻す
      updateHeroImageUploadPreview(urlInput.value);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<span class="upload-icon">📷</span> アップロード';
      if (previewEl) {
        previewEl.classList.remove('uploading');
      }
    }
  });
}

// ===========================================
// FAQ エディター
// ===========================================

// FAQ追加ボタンの初期化
export function initFAQSection() {
  const addBtn = document.getElementById('btn-add-faq');
  if (addBtn) {
    addBtn.addEventListener('click', addFAQItem);
  }

  // 初期状態で1つのFAQを表示
  renderFAQInputs([{ question: '', answer: '' }]);
}

// FAQリストを描画
export function renderFAQInputs(faqs = [{ question: '', answer: '' }]) {
  const container = document.getElementById('faq-list');
  if (!container) return;

  container.innerHTML = faqs.map((faq, index) => `
    <div class="faq-item" data-index="${index}">
      <div class="faq-item-header">
        <span class="faq-item-number">Q${index + 1}</span>
        <div class="faq-item-actions">
          <button type="button" class="faq-action-btn delete" data-index="${index}" title="削除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
      <div class="faq-fields">
        <div class="faq-field">
          <label>
            <span class="faq-label-icon q">Q</span>
            質問
          </label>
          <input type="text" class="faq-question-input" value="${escapeHtml(faq.question)}" placeholder="例: 未経験でも応募できますか？">
        </div>
        <div class="faq-field">
          <label>
            <span class="faq-label-icon a">A</span>
            回答
          </label>
          <textarea class="faq-answer-input" rows="2" placeholder="例: はい、未経験の方も大歓迎です。丁寧に指導いたします。">${escapeHtml(faq.answer)}</textarea>
        </div>
      </div>
    </div>
  `).join('');

  // 削除ボタンのイベント
  container.querySelectorAll('.faq-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      removeFAQItem(index);
    });
  });

  // 入力フィールドの変更イベント
  container.querySelectorAll('.faq-question-input, .faq-answer-input').forEach(input => {
    input.addEventListener('input', () => {
      updateFAQHiddenField();
      debouncedUpdatePreview();
    });
  });

  // 初期状態で隠しフィールドを同期
  updateFAQHiddenField();
}

// FAQ項目を追加
export function addFAQItem() {
  const faqs = getFAQData();
  faqs.push({ question: '', answer: '' });
  renderFAQInputs(faqs);
  updateFAQHiddenField();

  // 新しく追加された項目の質問フィールドにフォーカス
  setTimeout(() => {
    const lastItem = document.querySelector('.faq-item:last-child .faq-question-input');
    if (lastItem) lastItem.focus();
  }, 100);
}

// FAQ項目を削除
export function removeFAQItem(index) {
  const faqs = getFAQData();
  if (faqs.length <= 1) {
    // 最後の1つは削除せず、空にする
    renderFAQInputs([{ question: '', answer: '' }]);
  } else {
    faqs.splice(index, 1);
    renderFAQInputs(faqs);
  }
  updateFAQHiddenField();
  debouncedUpdatePreview();
}

// FAQデータを取得
export function getFAQData() {
  const container = document.getElementById('faq-list');
  if (!container) return [];

  const faqs = [];
  container.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question-input')?.value?.trim() || '';
    const answer = item.querySelector('.faq-answer-input')?.value?.trim() || '';
    faqs.push({ question, answer });
  });
  return faqs;
}

// 非表示フィールドを更新（互換性のため）
export function updateFAQHiddenField() {
  const faqs = getFAQData();
  const hiddenField = document.getElementById('lp-faq');
  if (hiddenField) {
    // 従来の形式に変換: Q:質問|A:回答\nQ:質問2|A:回答2
    const faqString = faqs
      .filter(f => f.question || f.answer)
      .map(f => `Q:${f.question}|A:${f.answer}`)
      .join('\n');
    hiddenField.value = faqString;
  }
}

// FAQ文字列をパース
export function parseFAQString(faqString) {
  if (!faqString) return [{ question: '', answer: '' }];

  const faqs = [];
  // リテラルな\nを実際の改行に変換してから分割
  const normalizedString = faqString.replace(/\\n/g, '\n');
  // || または改行で分割
  const lines = normalizedString.split(/\|\||[\n\r]+/).filter(line => line.trim());

  for (const line of lines) {
    // Q:質問|A:回答 形式
    const match = line.match(/Q[:：](.+?)\|A[:：](.+)/i);
    if (match) {
      faqs.push({
        question: match[1].trim(),
        answer: match[2].trim()
      });
    }
  }

  return faqs.length > 0 ? faqs : [{ question: '', answer: '' }];
}

// CSVテキストを正しく行に分割（ダブルクォート内の改行を考慮）
function splitCSVToRows(csvText) {
  const rows = [];
  let currentRow = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      if (csvText[i + 1] === '"') {
        // エスケープされたダブルクォート
        currentRow += '""';
        i++;
      } else {
        // クォートの開始/終了
        insideQuotes = !insideQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !insideQuotes) {
      // 行の終わり（クォート外）
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else if (char === '\r') {
      // キャリッジリターンは無視
      continue;
    } else {
      currentRow += char;
    }
  }

  // 最後の行を追加
  if (currentRow.trim()) {
    rows.push(currentRow);
  }

  return rows;
}

// LP設定CSVをパース（jobIdで検索）
function parseLPSettingsCSV(csvText, jobId) {
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

    // jobIdで検索（新形式）
    const rowJobId = rowData.jobId || rowData['求人ID'] || '';
    if (rowJobId === jobId) {
      const result = {
        heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
        heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
        heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
        ctaText: rowData.ctaText || rowData['CTAテキスト'] || '',
        faq: rowData.faq || rowData['FAQ'] || '',
        designPattern: rowData.designPattern || rowData['デザインパターン'] || '',
        layoutStyle: rowData.layoutStyle || rowData['レイアウトスタイル'] || 'modern',
        sectionOrder: rowData.sectionOrder || rowData['セクション順序'] || '',
        sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || '',
        // 広告トラッキング設定
        tiktokPixelId: rowData.tiktokPixelId || rowData['TikTok Pixel ID'] || '',
        googleAdsId: rowData.googleAdsId || rowData['Google Ads ID'] || '',
        googleAdsLabel: rowData.googleAdsLabel || rowData['Google Ads ラベル'] || '',
        metaPixelId: rowData.metaPixelId || rowData['Meta Pixel ID'] || '',
        lineTagId: rowData.lineTagId || rowData['LINE Tag ID'] || '',
        clarityProjectId: rowData.clarityProjectId || rowData['Clarity Project ID'] || '',
        // OGP設定
        ogpTitle: rowData.ogpTitle || rowData['OGPタイトル'] || '',
        ogpDescription: rowData.ogpDescription || rowData['OGP説明文'] || '',
        ogpImage: rowData.ogpImage || rowData['OGP画像'] || '',
        // 動画ボタン設定
        showVideoButton: rowData.showVideoButton || rowData['動画ボタン表示'] || '',
        videoUrl: rowData.videoUrl || rowData['動画URL'] || '',
        // 新形式v2 LP構成データ
        lpContent: rowData.lpContent || rowData['LP構成'] || '',
        // カスタムカラー設定
        customPrimary: rowData.customPrimary || rowData['カスタムカラー（メイン）'] || '',
        customAccent: rowData.customAccent || rowData['カスタムカラー（アクセント）'] || '',
        customBg: rowData.customBg || rowData['カスタムカラー（背景）'] || '',
        customText: rowData.customText || rowData['カスタムカラー（テキスト）'] || ''
      };

      // ポイント1〜6を動的に読み込み
      for (let i = 1; i <= 6; i++) {
        result[`pointTitle${i}`] = rowData[`pointTitle${i}`] || rowData[`ポイント${i}タイトル`] || '';
        result[`pointDesc${i}`] = rowData[`pointDesc${i}`] || rowData[`ポイント${i}説明`] || '';
      }

      return result;
    }
  }
  return null;
}

// LP設定フォームをクリア
export function clearLPForm() {
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

  // ポイントを初期状態に戻す
  renderPointInputs();

  // FAQエディターを初期状態に戻す
  renderFAQInputs([{ question: '', answer: '' }]);

  const standardRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
  if (standardRadio) standardRadio.checked = true;

  // カスタムカラーをリセット
  resetLPCustomColors();

  updateHeroImagePresetSelection('');

  // セクションマネージャーをリセット
  initSectionManagerIfNeeded();
  loadSectionsFromSettings({});
  renderSectionsList();
}

// ヒーロー画像プリセットをレンダリング
export function renderHeroImagePresets() {
  const container = document.getElementById('hero-image-presets');
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

// ヒーロー画像プリセットを選択
export function selectHeroImagePreset(url) {
  const input = document.getElementById('lp-hero-image');
  if (input) {
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  updateHeroImagePresetSelection(url);
}

// ヒーロー画像プリセットの選択状態を更新
export function updateHeroImagePresetSelection(selectedUrl) {
  const container = document.getElementById('hero-image-presets');
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
 * 動画設定を求人シートに同期
 * LP設定で動画を設定した場合、求人シートにも反映させる
 * 注意: 現状はバックエンドの部分更新APIがないため、ログ出力のみ
 */
async function syncVideoToJob(jobId, showVideoButton, videoUrl, jobData) {
  // TODO: バックエンドにupdateJobVideoアクションを追加後に有効化
  // 現状は求人編集画面から動画を設定すればLP側にも同期されるため、
  // LP→求人の同期は必須ではない（求人シートが正とする運用）
  console.log('[LP設定] 動画設定の求人シート同期（未実装）:', {
    jobId,
    showVideoButton,
    videoUrl,
    companyDomain: jobData?.companyDomain || selectedCompanyDomain
  });
}

// LP設定を保存（求人ID単位）
export async function saveLPSettings() {
  console.log('[LP保存] saveLPSettings 開始');

  const jobId = document.getElementById('lp-job-select')?.value;
  console.log('[LP保存] jobId:', jobId);

  if (!jobId) {
    alert('求人を選択してください');
    console.log('[LP保存] jobIdがないため中断');
    return;
  }

  // 求人データを取得
  const jobData = currentJobData || allJobsCache.find(j => j.id === jobId);
  console.log('[LP保存] jobData:', jobData);

  if (!jobData) {
    alert('求人データが見つかりません');
    console.log('[LP保存] jobDataがないため中断');
    return;
  }

  // ポイントデータを取得
  const points = getPointsData();

  // レイアウトスタイルを取得（新しいUIから読み取り）
  const selectedLayoutOption = document.querySelector('.lp-admin-layout-option.selected');
  const layoutStyle = selectedLayoutOption?.dataset?.layout || 'modern';

  const settings = {
    jobId: jobId,
    companyDomain: jobData.companyDomain,
    company: jobData.company,
    jobTitle: jobData.title,
    designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'modern',
    layoutStyle: layoutStyle,
    heroTitle: document.getElementById('lp-hero-title')?.value || '',
    heroSubtitle: document.getElementById('lp-hero-subtitle')?.value || '',
    heroImage: document.getElementById('lp-hero-image')?.value || '',
    ctaText: document.getElementById('lp-cta-text')?.value || '',
    faq: document.getElementById('lp-faq')?.value || '',
    sectionOrder: getSectionOrder().join(','),
    sectionVisibility: JSON.stringify(getSectionVisibility())
  };

  // ポイント1〜6を設定
  for (let i = 0; i < 6; i++) {
    settings[`pointTitle${i + 1}`] = points[i]?.title || '';
    settings[`pointDesc${i + 1}`] = points[i]?.desc || '';
  }

  // 広告トラッキング設定
  settings.tiktokPixelId = document.getElementById('lp-tiktok-pixel')?.value || '';
  settings.googleAdsId = document.getElementById('lp-google-ads-id')?.value || '';
  settings.googleAdsLabel = document.getElementById('lp-google-ads-label')?.value || '';
  settings.metaPixelId = document.getElementById('lp-meta-pixel')?.value || '';
  settings.lineTagId = document.getElementById('lp-line-tag')?.value || '';
  settings.clarityProjectId = document.getElementById('lp-clarity')?.value || '';

  // OGP設定
  settings.ogpTitle = document.getElementById('lp-ogp-title')?.value || '';
  settings.ogpDescription = document.getElementById('lp-ogp-description')?.value || '';
  settings.ogpImage = document.getElementById('lp-ogp-image')?.value || '';

  // カスタムカラー設定
  const customColors = getLPCustomColors();
  settings.customPrimary = document.getElementById('lp-custom-primary-text')?.value || '';
  settings.customAccent = document.getElementById('lp-custom-accent-text')?.value || '';
  settings.customBg = document.getElementById('lp-custom-bg-text')?.value || '';
  settings.customText = document.getElementById('lp-custom-text-text')?.value || '';

  // 新形式v2のLP構成データ（セクションマネージャーから取得）
  const lpContent = getCurrentLPContent();
  if (lpContent) {
    settings.lpContent = JSON.stringify(lpContent);

    // lpContent内のheroCTAセクションから動画設定を同期
    const heroCtaSection = lpContent.sections?.find(s => s.type === 'heroCta');
    if (heroCtaSection?.data) {
      settings.showVideoButton = heroCtaSection.data.showVideoButton ? 'true' : 'false';
      settings.videoUrl = heroCtaSection.data.videoUrl || '';
    } else {
      // heroCTAセクションがない場合はフォームから取得
      settings.showVideoButton = document.getElementById('lp-show-video-button')?.checked ? 'true' : 'false';
      settings.videoUrl = document.getElementById('lp-video-url')?.value || '';
    }
  } else {
    // lpContentがない場合（旧形式）はフォームから取得
    settings.showVideoButton = document.getElementById('lp-show-video-button')?.checked ? 'true' : 'false';
    settings.videoUrl = document.getElementById('lp-video-url')?.value || '';
  }

  // デバッグ: 送信するデータをログ
  console.log('[LP保存] 送信する設定:', settings);
  console.log('[LP保存] layoutStyle:', settings.layoutStyle);
  console.log('[LP保存] faq:', settings.faq);
  console.log('[LP保存] lpContent:', settings.lpContent ? 'あり' : 'なし');
  console.log('[LP保存] showVideoButton:', settings.showVideoButton);
  console.log('[LP保存] videoUrl:', settings.videoUrl);

  // Firestoreに保存
  if (useFirestore) {
    try {
      const saveBtn = document.getElementById('btn-save-lp-settings');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      FirestoreService.initFirestore();
      const result = await FirestoreService.saveLPSettings(settings.companyDomain, jobId, settings);

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'LP設定を保存';
      }

      if (!result.success) {
        alert('Firestoreへの保存に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      // 動画設定を求人にも同期
      if (settings.showVideoButton || settings.videoUrl) {
        await syncVideoToJob(jobId, settings.showVideoButton, settings.videoUrl, jobData);
      }

      localStorage.removeItem(`lp_settings_${jobId}`);
      showToast('LP設定を保存しました', 'success');

    } catch (error) {
      console.error('Firestore保存エラー:', error);
      alert('Firestoreへの保存中にエラーが発生しました: ' + error.message);
    }
    return;
  }

  // 従来のGAS API保存
  const gasApiUrl = spreadsheetConfig.gasApiUrl;
  if (gasApiUrl) {
    try {
      const saveBtn = document.getElementById('btn-save-lp-settings');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveLPSettings',
        settings: settings
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const responseText = await response.text();
      console.log('[LP保存] GASレスポンス:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('[LP保存] パース済みレスポンス:', result);
      } catch (parseError) {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'LP設定を保存';
        }
        throw new Error(`GASからの応答が不正です: ${responseText.substring(0, 200)}`);
      }

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'LP設定を保存';
      }

      if (!result.success) {
        alert('スプレッドシートへの保存に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      // 動画設定を求人シートにも同期
      if (settings.showVideoButton || settings.videoUrl) {
        await syncVideoToJob(jobId, settings.showVideoButton, settings.videoUrl, jobData);
      }

      localStorage.removeItem(`lp_settings_${jobId}`);
      alert(`LP設定をスプレッドシートに保存しました。\n\n求人: ${jobData.title}\n会社: ${jobData.company}\nデザインパターン: ${settings.designPattern}`);

    } catch (error) {
      console.error('GAS API呼び出しエラー:', error);
      alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
      saveLPSettingsLocal(settings, jobId, jobData);
    }
  } else {
    saveLPSettingsLocal(settings, jobId, jobData);
  }
}

// ローカルストレージにLP設定を保存
function saveLPSettingsLocal(settings, jobId, jobData) {
  const lpSettingsKey = `lp_settings_${jobId}`;
  localStorage.setItem(lpSettingsKey, JSON.stringify(settings));
  alert(`LP設定をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n求人: ${jobData?.title || jobId}\nデザインパターン: ${settings.designPattern}`);
}

// セクションの順番を取得
export function getSectionOrder() {
  // lp-section-managerからセクション順序を取得
  const lpContent = getCurrentLPContent();
  if (lpContent?.sections?.length > 0) {
    return lpContent.sections
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(s => s.type);
  }
  return ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
}

// セクションの表示状態を取得
export function getSectionVisibility() {
  // lp-section-managerからセクション表示状態を取得
  const lpContent = getCurrentLPContent();
  if (lpContent?.sections?.length > 0) {
    const visibility = {};
    lpContent.sections.forEach(s => {
      visibility[s.type] = s.visible !== false;
    });
    return visibility;
  }
  // フォールバック：デフォルト値
  return {
    hero: true,
    points: true,
    jobs: true,
    details: true,
    faq: true,
    apply: true
  };
}

// セクション順序を適用
export function applySectionOrder(orderString) {
  const orderList = document.getElementById('lp-section-order');
  if (!orderList || !orderString) return;

  const order = orderString.split(',').map(s => s.trim()).filter(s => s);
  if (order.length === 0) return;

  const items = Array.from(orderList.querySelectorAll('.section-order-item'));
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.dataset.section] = item;
  });

  order.forEach(section => {
    const item = itemMap[section];
    if (item) {
      orderList.appendChild(item);
    }
  });
}

// セクション表示状態を適用
export function applySectionVisibility(visibilityString) {
  if (!visibilityString) return;

  try {
    const visibility = JSON.parse(visibilityString);
    ['points', 'jobs', 'details', 'faq'].forEach(key => {
      if (visibility[key] !== undefined) {
        const el = document.getElementById(`section-${key}-visible`);
        if (el) el.checked = visibility[key];
      }
    });
  } catch (e) {
    console.error('セクション表示状態のパースエラー:', e);
  }
}

// デバウンス付きプレビュー更新
export function debouncedUpdatePreview() {
  if (previewUpdateTimer) {
    clearTimeout(previewUpdateTimer);
  }
  previewUpdateTimer = setTimeout(() => {
    updateLPPreview();
  }, 300);
}

// プレビュー表示/非表示切り替え（後方互換用 - 常時表示になったため基本使用しない）
export function toggleLPPreview() {
  // プレビューは常時表示のため、単にプレビューを更新
  updateLPPreview();
}

// プレビューを閉じる（後方互換用 - 常時表示になったため基本使用しない）
export function closeLPPreview() {
  // プレビューは常時表示のため何もしない
}

// LPプレビューを更新
export function updateLPPreview() {
  const iframe = document.getElementById('lp-preview-frame');
  const container = document.getElementById('lp-preview-container');

  if (!iframe || !container) return;

  const companyDomain = selectedCompanyDomain;
  if (!companyDomain) return;

  // 会社データを取得
  const companiesCache = getCompaniesCache();
  const company = companiesCache?.find(c => c.companyDomain === companyDomain) || {
    company: companyDomain,
    companyDomain: companyDomain
  };

  // 現在のフォームデータからLP設定を構築
  const lpSettings = getCurrentLPSettings();

  // 求人データを取得（rawDataから詳細情報を取得）
  const jobData = currentJobData?.rawData || currentJobData || null;

  // プレビューHTMLを生成
  const previewHtml = generatePreviewHtml(company, lpSettings, jobData);

  // iframeに注入
  iframe.srcdoc = previewHtml;
}

// 現在のフォーム値からLP設定オブジェクトを取得
function getCurrentLPSettings() {
  const points = getPointsData();
  // レイアウトスタイルを取得（新しいUIから読み取り）
  const selectedLayoutOption = document.querySelector('.lp-admin-layout-option.selected');
  const layoutStyle = selectedLayoutOption?.dataset?.layout || 'modern';

  // カスタムカラーを取得
  const customColors = getLPCustomColors();

  // v2セクションデータを取得
  const lpContent = getCurrentLPContent();
  const v2Sections = lpContent?.sections || [];

  const settings = {
    designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'modern',
    layoutStyle: layoutStyle,
    heroTitle: document.getElementById('lp-hero-title')?.value || '',
    heroSubtitle: document.getElementById('lp-hero-subtitle')?.value || '',
    heroImage: document.getElementById('lp-hero-image')?.value || '',
    ctaText: document.getElementById('lp-cta-text')?.value || '今すぐ応募する',
    faq: document.getElementById('lp-faq')?.value || '',
    sectionOrder: getSectionOrder().join(','),
    sectionVisibility: JSON.stringify(getSectionVisibility()),
    // カスタムカラー
    customPrimary: customColors.primary,
    customAccent: customColors.accent,
    customBg: customColors.bg,
    customText: customColors.text,
    // v2セクションデータ
    v2Sections: v2Sections
  };

  // ポイントデータを設定に追加
  for (let i = 0; i < 6; i++) {
    settings[`pointTitle${i + 1}`] = points[i]?.title || '';
    settings[`pointDesc${i + 1}`] = points[i]?.desc || '';
  }

  return settings;
}

// プレビューHTML生成
function generatePreviewHtml(company, lpSettings, jobData = null) {
  const patternClass = `lp-pattern-${lpSettings.designPattern || 'modern'}`;
  const layoutStyle = lpSettings.layoutStyle || 'modern';

  // カスタムカラーを取得
  const baseColors = layoutStyleColors[layoutStyle] || layoutStyleColors.modern;
  const customColors = {
    primary: lpSettings.customPrimary || baseColors.primary,
    accent: lpSettings.customAccent || baseColors.accent,
    bg: lpSettings.customBg || baseColors.bg,
    text: lpSettings.customText || baseColors.text
  };

  // セクション表示設定を解析
  let sectionVisibility = { points: true, jobs: true, details: true, faq: true };
  try {
    if (lpSettings.sectionVisibility) {
      sectionVisibility = { ...sectionVisibility, ...JSON.parse(lpSettings.sectionVisibility) };
    }
  } catch (e) {}

  // セクション順序を解析
  const defaultOrder = ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
  let sectionOrder = defaultOrder;
  if (lpSettings.sectionOrder) {
    const customOrder = lpSettings.sectionOrder.split(',').map(s => s.trim()).filter(s => s);
    if (customOrder.length > 0) {
      const missingSections = defaultOrder.filter(s => !customOrder.includes(s));
      sectionOrder = [...customOrder, ...missingSections];
    }
  }

  // v2セクションをマップに変換（IDでアクセス可能に）
  const v2SectionsMap = {};
  (lpSettings.v2Sections || []).forEach(s => {
    v2SectionsMap[s.type] = s;
  });

  // 各セクションをレンダリング
  const sectionsHtml = sectionOrder.map(section => {
    // 非表示の場合はスキップ
    if (sectionVisibility[section] === false) return '';

    switch (section) {
      case 'hero':
        return renderPreviewHero(company, lpSettings, jobData);
      case 'points':
        return renderPreviewPoints(lpSettings);
      case 'jobs':
        return renderPreviewJobs(company, jobData);
      case 'details':
        return renderPreviewDetails(company, jobData);
      case 'faq':
        return lpSettings.faq ? renderPreviewFAQ(lpSettings.faq) : '';
      case 'apply':
        return renderPreviewApply(company, lpSettings);
      case 'video':
        return renderPreviewVideo(v2SectionsMap.video);
      case 'carousel':
        return renderPreviewCarousel(v2SectionsMap.carousel);
      case 'gallery':
        return renderPreviewGallery(v2SectionsMap.gallery);
      case 'testimonial':
        return renderPreviewTestimonial(v2SectionsMap.testimonial);
      case 'custom':
        return renderPreviewCustom(v2SectionsMap.custom);
      default:
        return '';
    }
  }).join('');

  // CSS変数としてカスタムカラーを設定
  const colorVars = `
    --lp-primary: ${customColors.primary};
    --lp-accent: ${customColors.accent};
    --lp-bg: ${customColors.bg};
    --lp-text: ${customColors.text};
  `;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>
    ${getPreviewStyles()}
  </style>
</head>
<body class="lp-body ${patternClass}" style="${colorVars}" data-layout="${layoutStyle}">
  <div id="lp-content">
    ${sectionsHtml}
  </div>
</body>
</html>
  `;
}

// ヒーローセクション
function renderPreviewHero(company, lpSettings, jobData = null) {
  const jobTitle = jobData?.title || '';
  const heroTitle = lpSettings.heroTitle || jobTitle || `${company.company || '会社名'}で働こう`;
  const heroSubtitle = lpSettings.heroSubtitle || '';
  const heroImage = lpSettings.heroImage || '';

  return `
    <section class="lp-hero">
      <div class="lp-hero-bg" style="${heroImage ? `background-image: url('${escapeHtml(heroImage)}')` : 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}"></div>
      <div class="lp-hero-overlay"></div>
      <div class="lp-hero-content">
        <p class="lp-hero-company">${escapeHtml(company.company || '')}</p>
        <h1 class="lp-hero-title">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle">${escapeHtml(heroSubtitle)}</p>` : ''}
        <div class="lp-hero-cta">
          <a href="#lp-apply" class="lp-btn-apply-hero">今すぐ応募する</a>
        </div>
      </div>
    </section>
  `;
}

// ポイントセクション
function renderPreviewPoints(lpSettings) {
  const points = [];
  for (let i = 1; i <= 6; i++) {
    const title = lpSettings[`pointTitle${i}`];
    const desc = lpSettings[`pointDesc${i}`] || '';
    if (title) {
      points.push({ title, desc, idx: i });
    }
  }

  if (points.length === 0) return '';

  return `
    <section class="lp-points">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">この求人のポイント</h2>
        <div class="lp-points-grid">
          ${points.map((point, idx) => `
            <div class="lp-point-card">
              <div class="lp-point-number">${idx + 1}</div>
              <h3 class="lp-point-title">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// 求人セクション
function renderPreviewJobs(company, jobData = null) {
  if (!jobData) {
    return `
      <section class="lp-jobs">
        <div class="lp-section-inner">
          <h2 class="lp-section-title">募集中の求人</h2>
          <div class="lp-jobs-placeholder">
            <p>求人情報は実際のページでご確認ください</p>
          </div>
        </div>
      </section>
    `;
  }

  const title = jobData.title || '求人タイトル';
  const location = jobData.location || jobData.workLocation || '';
  const salary = jobData.monthlySalary || jobData.totalBonus || '';
  const jobType = jobData.jobType || '';
  const employmentType = jobData.employmentType || '';

  return `
    <section class="lp-jobs">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">募集中の求人</h2>
        <div class="lp-job-card-preview">
          <h3 class="lp-job-title-preview">${escapeHtml(title)}</h3>
          <div class="lp-job-meta-preview">
            ${location ? `<span class="lp-job-meta-item"><span class="lp-meta-icon">📍</span>${escapeHtml(location)}</span>` : ''}
            ${salary ? `<span class="lp-job-meta-item"><span class="lp-meta-icon">💰</span>${escapeHtml(salary)}</span>` : ''}
            ${jobType ? `<span class="lp-job-meta-item"><span class="lp-meta-icon">💼</span>${escapeHtml(jobType)}</span>` : ''}
            ${employmentType ? `<span class="lp-job-meta-item"><span class="lp-meta-icon">📋</span>${escapeHtml(employmentType)}</span>` : ''}
          </div>
        </div>
      </div>
    </section>
  `;
}

// 募集要項セクション
function renderPreviewDetails(company, jobData = null) {
  if (!jobData) {
    return `
      <section class="lp-details">
        <div class="lp-section-inner">
          <h2 class="lp-section-title">募集要項</h2>
          <div class="lp-details-placeholder">
            <p>詳細な募集要項は実際のページでご確認ください</p>
          </div>
        </div>
      </section>
    `;
  }

  // 表示する項目を定義
  const detailItems = [
    { label: '仕事内容', value: jobData.jobDescription },
    { label: '勤務地', value: jobData.location || jobData.workLocation },
    { label: '給与', value: jobData.monthlySalary || jobData.totalBonus },
    { label: '勤務時間', value: jobData.workingHours },
    { label: '休日・休暇', value: jobData.holidays },
    { label: '応募資格', value: jobData.requirements },
    { label: '福利厚生', value: jobData.benefits },
    { label: 'アクセス', value: jobData.access }
  ].filter(item => item.value);

  if (detailItems.length === 0) {
    return `
      <section class="lp-details">
        <div class="lp-section-inner">
          <h2 class="lp-section-title">募集要項</h2>
          <div class="lp-details-placeholder">
            <p>詳細な募集要項は実際のページでご確認ください</p>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="lp-details">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">募集要項</h2>
        <div class="lp-details-table">
          ${detailItems.map(item => `
            <div class="lp-details-row">
              <div class="lp-details-label">${escapeHtml(item.label)}</div>
              <div class="lp-details-value">${escapeHtml(item.value).replace(/\n/g, '<br>')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// FAQセクション
function renderPreviewFAQ(faqText) {
  if (!faqText) return '';

  // || または改行で分割（保存形式は改行区切り）
  const faqItems = faqText.split(/\|\||[\n\r]+/).filter(item => item.trim()).map(item => {
    // Q:質問|A:回答 形式をパース
    const match = item.match(/Q[:：](.+?)\|A[:：](.+)/i);
    if (match) {
      return {
        question: match[1].trim(),
        answer: match[2].trim()
      };
    }
    return null;
  }).filter(item => item && item.question && item.answer);

  if (faqItems.length === 0) return '';

  return `
    <section class="lp-faq">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">よくある質問</h2>
        <div class="lp-faq-list">
          ${faqItems.map(item => `
            <div class="lp-faq-item">
              <div class="lp-faq-question">
                <span class="lp-faq-q">Q</span>
                <span>${escapeHtml(item.question)}</span>
              </div>
              <div class="lp-faq-answer">
                <span class="lp-faq-a">A</span>
                <span>${escapeHtml(item.answer)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// 応募セクション
function renderPreviewApply(company, lpSettings) {
  const ctaText = lpSettings.ctaText || '今すぐ応募する';

  return `
    <section class="lp-apply" id="lp-apply">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">応募する</h2>
        <p class="lp-apply-text">ご応募お待ちしております</p>
        <div class="lp-apply-buttons">
          <button class="lp-btn-apply-main">${escapeHtml(ctaText)}</button>
        </div>
      </div>
    </section>
  `;
}

// 動画セクション
function renderPreviewVideo(sectionData) {
  if (!sectionData || sectionData.visible === false) return '';
  const data = sectionData.data || {};
  const title = data.sectionTitle || '';
  const videoUrl = data.videoUrl || '';

  if (!videoUrl) return '';

  // YouTubeのIDを抽出
  let embedHtml = '';
  const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&]+)/);
  if (ytMatch) {
    embedHtml = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;border-radius:8px;"></iframe>`;
  } else {
    embedHtml = `<div class="lp-video-placeholder">動画: ${escapeHtml(videoUrl)}</div>`;
  }

  return `
    <section class="lp-video">
      <div class="lp-section-inner">
        ${title ? `<h2 class="lp-section-title">${escapeHtml(title)}</h2>` : ''}
        <div class="lp-video-container">${embedHtml}</div>
      </div>
    </section>
  `;
}

// カルーセルセクション
function renderPreviewCarousel(sectionData) {
  if (!sectionData || sectionData.visible === false) return '';
  const data = sectionData.data || {};
  const title = data.sectionTitle || '';
  const images = data.images || [];

  if (images.length === 0) return '';

  return `
    <section class="lp-carousel">
      <div class="lp-section-inner">
        ${title ? `<h2 class="lp-section-title">${escapeHtml(title)}</h2>` : ''}
        <div class="lp-carousel-preview">
          ${images.slice(0, 3).map((img, i) => {
            const url = typeof img === 'string' ? img : img.url;
            return url ? `<img src="${escapeHtml(url)}" alt="画像${i + 1}" style="width:100%;max-width:200px;height:120px;object-fit:cover;border-radius:8px;">` : '';
          }).join('')}
          ${images.length > 3 ? `<span style="color:#888;">他${images.length - 3}枚</span>` : ''}
        </div>
      </div>
    </section>
  `;
}

// ギャラリーセクション
function renderPreviewGallery(sectionData) {
  if (!sectionData || sectionData.visible === false) return '';
  const data = sectionData.data || {};
  const title = data.sectionTitle || '';
  const images = data.images || [];

  if (images.length === 0) return '';

  const columns = sectionData.layout?.columns || 3;

  return `
    <section class="lp-gallery">
      <div class="lp-section-inner">
        ${title ? `<h2 class="lp-section-title">${escapeHtml(title)}</h2>` : ''}
        <div class="lp-gallery-grid" style="display:grid;grid-template-columns:repeat(${columns}, 1fr);gap:8px;">
          ${images.slice(0, 6).map((img, i) => {
            const url = typeof img === 'string' ? img : img.url;
            return url ? `<img src="${escapeHtml(url)}" alt="画像${i + 1}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;">` : '';
          }).join('')}
        </div>
        ${images.length > 6 ? `<p style="text-align:center;color:#888;margin-top:10px;">他${images.length - 6}枚</p>` : ''}
      </div>
    </section>
  `;
}

// 社員の声セクション
function renderPreviewTestimonial(sectionData) {
  if (!sectionData || sectionData.visible === false) return '';
  const data = sectionData.data || {};
  const title = data.sectionTitle || '社員の声';
  const testimonials = data.testimonials || [];

  if (testimonials.length === 0) return '';

  return `
    <section class="lp-testimonial">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">${escapeHtml(title)}</h2>
        <div class="lp-testimonial-list" style="display:flex;flex-direction:column;gap:20px;">
          ${testimonials.slice(0, 3).map(t => `
            <div class="lp-testimonial-card" style="background:#f8f9fa;padding:20px;border-radius:12px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                ${t.avatar ? `<img src="${escapeHtml(t.avatar)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : '<div style="width:48px;height:48px;border-radius:50%;background:#ddd;"></div>'}
                <div>
                  <div style="font-weight:700;">${escapeHtml(t.name || '社員')}</div>
                  ${t.role ? `<div style="font-size:12px;color:#666;">${escapeHtml(t.role)}</div>` : ''}
                </div>
              </div>
              <p style="font-size:14px;color:#444;">${escapeHtml(t.quote || '')}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// カスタムセクション
function renderPreviewCustom(sectionData) {
  if (!sectionData || sectionData.visible === false) return '';
  const data = sectionData.data || {};
  const title = data.title || '';
  const content = data.content || '';
  const image = data.image || '';

  if (!title && !content && !image) return '';

  return `
    <section class="lp-custom">
      <div class="lp-section-inner">
        ${title ? `<h2 class="lp-section-title">${escapeHtml(title)}</h2>` : ''}
        ${image ? `<img src="${escapeHtml(image)}" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:20px;">` : ''}
        ${content ? `<div class="lp-custom-content">${content}</div>` : ''}
      </div>
    </section>
  `;
}

// プレビュー用スタイル
function getPreviewStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans JP', sans-serif; line-height: 1.6; color: var(--lp-text, #333); background-color: var(--lp-bg, #fff); }

    .lp-hero { position: relative; min-height: 400px; display: flex; align-items: center; justify-content: center; }
    .lp-hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
    .lp-hero-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
    .lp-hero-content { position: relative; z-index: 1; text-align: center; color: #fff; padding: 40px 20px; }
    .lp-hero-company { font-size: 14px; margin-bottom: 10px; opacity: 0.9; }
    .lp-hero-title { font-size: 28px; font-weight: 900; margin-bottom: 15px; }
    .lp-hero-subtitle { font-size: 16px; opacity: 0.9; margin-bottom: 20px; }
    .lp-hero-cta { margin-top: 20px; }
    .lp-btn-apply-hero { display: inline-block; padding: 15px 40px; background: var(--lp-accent, #ff6b35); color: #fff; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; }

    .lp-section-inner { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    .lp-section-title { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 30px; color: var(--lp-text, #333); }

    .lp-points { background: color-mix(in srgb, var(--lp-bg, #f8f9fa) 95%, var(--lp-primary, #667eea) 5%); }
    .lp-points-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .lp-point-card { background: var(--lp-bg, #fff); padding: 25px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .lp-point-number { width: 36px; height: 36px; background: var(--lp-primary, #667eea); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-bottom: 15px; }
    .lp-point-title { font-size: 18px; font-weight: 700; margin-bottom: 10px; color: var(--lp-text, #333); }
    .lp-point-desc { font-size: 14px; color: color-mix(in srgb, var(--lp-text, #666) 70%, transparent); }

    .lp-jobs, .lp-details { background: var(--lp-bg, #fff); }
    .lp-jobs-placeholder, .lp-details-placeholder { text-align: center; padding: 40px; background: color-mix(in srgb, var(--lp-bg, #f8f9fa) 95%, var(--lp-primary, #667eea) 5%); border-radius: 8px; color: color-mix(in srgb, var(--lp-text, #888) 60%, transparent); }

    /* 求人カードプレビュー */
    .lp-job-card-preview { background: var(--lp-bg, #fff); border: 1px solid color-mix(in srgb, var(--lp-text, #ddd) 20%, transparent); border-radius: 12px; padding: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .lp-job-title-preview { font-size: 18px; font-weight: 700; margin-bottom: 15px; color: var(--lp-text, #333); }
    .lp-job-meta-preview { display: flex; flex-wrap: wrap; gap: 12px; }
    .lp-job-meta-item { display: flex; align-items: center; gap: 6px; font-size: 14px; color: color-mix(in srgb, var(--lp-text, #666) 80%, transparent); background: color-mix(in srgb, var(--lp-bg, #f3f4f6) 95%, var(--lp-primary, #667eea) 5%); padding: 6px 12px; border-radius: 20px; }
    .lp-meta-icon { font-size: 14px; }

    /* 募集要項テーブル */
    .lp-details-table { display: flex; flex-direction: column; gap: 0; border: 1px solid color-mix(in srgb, var(--lp-text, #ddd) 20%, transparent); border-radius: 12px; overflow: hidden; }
    .lp-details-row { display: flex; border-bottom: 1px solid color-mix(in srgb, var(--lp-text, #eee) 15%, transparent); }
    .lp-details-row:last-child { border-bottom: none; }
    .lp-details-label { width: 120px; flex-shrink: 0; padding: 15px; background: color-mix(in srgb, var(--lp-bg, #f8f9fa) 95%, var(--lp-primary, #667eea) 5%); font-weight: 600; font-size: 13px; color: var(--lp-text, #333); }
    .lp-details-value { flex: 1; padding: 15px; font-size: 14px; color: color-mix(in srgb, var(--lp-text, #333) 90%, transparent); line-height: 1.7; white-space: pre-wrap; }

    .lp-faq { background: color-mix(in srgb, var(--lp-bg, #f8f9fa) 95%, var(--lp-primary, #667eea) 5%); }
    .lp-faq-list { display: flex; flex-direction: column; gap: 15px; }
    .lp-faq-item { background: var(--lp-bg, #fff); border-radius: 8px; padding: 20px; }
    .lp-faq-question { display: flex; gap: 12px; font-weight: 600; margin-bottom: 10px; color: var(--lp-text, #333); }
    .lp-faq-answer { display: flex; gap: 12px; color: color-mix(in srgb, var(--lp-text, #666) 70%, transparent); }
    .lp-faq-q, .lp-faq-a { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .lp-faq-q { background: var(--lp-primary, #667eea); color: #fff; }
    .lp-faq-a { background: color-mix(in srgb, var(--lp-primary, #e9ecef) 20%, var(--lp-bg, #fff) 80%); color: var(--lp-text, #333); }

    .lp-apply { background: linear-gradient(135deg, var(--lp-primary, #667eea) 0%, var(--lp-accent, #764ba2) 100%); color: #fff; text-align: center; }
    .lp-apply .lp-section-title { color: #fff; }
    .lp-apply-text { margin-bottom: 25px; opacity: 0.9; }
    .lp-btn-apply-main { padding: 18px 50px; background: var(--lp-accent, #ff6b35); color: #fff; border: none; border-radius: 50px; font-size: 18px; font-weight: 700; cursor: pointer; }

    /* デザインパターン（フォールバック用、カスタムカラーが優先） */
    .lp-pattern-modern .lp-point-number { background: var(--lp-primary, #10b981); }
    .lp-pattern-modern .lp-btn-apply-hero, .lp-pattern-modern .lp-btn-apply-main { background: var(--lp-accent, #10b981); }
    .lp-pattern-modern .lp-apply { background: linear-gradient(135deg, var(--lp-primary, #10b981) 0%, var(--lp-accent, #059669) 100%); }
    .lp-pattern-modern .lp-faq-q { background: var(--lp-primary, #10b981); }

    .lp-pattern-classic .lp-point-number { background: var(--lp-primary, #92400e); }
    .lp-pattern-classic .lp-btn-apply-hero, .lp-pattern-classic .lp-btn-apply-main { background: var(--lp-accent, #b45309); }
    .lp-pattern-classic .lp-apply { background: linear-gradient(135deg, var(--lp-primary, #92400e) 0%, var(--lp-accent, #78350f) 100%); }
    .lp-pattern-classic .lp-faq-q { background: var(--lp-primary, #92400e); }

    .lp-pattern-minimal .lp-point-number { background: var(--lp-primary, #374151); }
    .lp-pattern-minimal .lp-btn-apply-hero, .lp-pattern-minimal .lp-btn-apply-main { background: var(--lp-accent, #111827); }
    .lp-pattern-minimal .lp-apply { background: var(--lp-primary, #111827); }
    .lp-pattern-minimal .lp-faq-q { background: var(--lp-primary, #374151); }

    .lp-pattern-colorful .lp-point-number { background: var(--lp-primary, #ec4899); }
    .lp-pattern-colorful .lp-btn-apply-hero, .lp-pattern-colorful .lp-btn-apply-main { background: linear-gradient(90deg, var(--lp-primary, #ec4899), var(--lp-accent, #8b5cf6)); }
    .lp-pattern-colorful .lp-apply { background: linear-gradient(135deg, var(--lp-primary, #ec4899) 0%, var(--lp-accent, #8b5cf6) 100%); }
    .lp-pattern-colorful .lp-faq-q { background: var(--lp-primary, #ec4899); }

    /* カスタムセクション */
    .lp-video { background: var(--lp-bg, #fff); }
    .lp-video-container { max-width: 600px; margin: 0 auto; }
    .lp-video-placeholder { text-align: center; padding: 40px; background: #f0f0f0; border-radius: 8px; color: #888; }

    .lp-carousel { background: color-mix(in srgb, var(--lp-bg, #f8f9fa) 95%, var(--lp-primary, #667eea) 5%); }
    .lp-carousel-preview { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; align-items: center; }

    .lp-gallery { background: var(--lp-bg, #fff); }

    .lp-testimonial { background: color-mix(in srgb, var(--lp-bg, #f8f9fa) 95%, var(--lp-primary, #667eea) 5%); }

    .lp-custom { background: var(--lp-bg, #fff); }
    .lp-custom-content { font-size: 14px; line-height: 1.8; color: var(--lp-text, #333); }
  `;
}

// セクション並び替え初期化
export function initSectionSortable() {
  const list = document.getElementById('lp-section-order');
  if (!list) return;

  let draggedItem = null;

  // タッチデバイス対応
  let touchStartY = 0;
  let touchCurrentItem = null;

  list.querySelectorAll('.section-order-item').forEach(item => {
    item.setAttribute('draggable', 'true');

    // ドラッグ開始
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ''); // Firefox対応

      // ドラッグゴースト画像の透明度調整
      setTimeout(() => {
        item.style.opacity = '0.4';
      }, 0);
    });

    // ドラッグ終了
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      item.style.opacity = '';
      draggedItem = null;

      // 全アイテムからdrag-overクラスを削除
      list.querySelectorAll('.section-order-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      // プレビュー更新
      updateLPPreview();

      // 更新アニメーション
      item.style.animation = 'none';
      item.offsetHeight; // リフロー
      item.style.animation = 'sortableDropped 0.3s ease';
    });

    // ドラッグオーバー
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!draggedItem || draggedItem === item) return;

      const afterElement = getDragAfterElement(list, e.clientY);

      // ドラッグオーバー表示を更新
      list.querySelectorAll('.section-order-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      if (afterElement && afterElement !== draggedItem) {
        afterElement.classList.add('drag-over');
      }

      if (afterElement == null) {
        list.appendChild(draggedItem);
      } else {
        list.insertBefore(draggedItem, afterElement);
      }
    });

    // ドラッグ離脱
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    // タッチ開始（モバイル対応）
    item.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchCurrentItem = item;
      item.classList.add('dragging');
    }, { passive: true });

    // タッチ移動
    item.addEventListener('touchmove', (e) => {
      if (!touchCurrentItem) return;

      const touchY = e.touches[0].clientY;
      const afterElement = getDragAfterElement(list, touchY);

      if (afterElement == null) {
        list.appendChild(touchCurrentItem);
      } else if (afterElement !== touchCurrentItem) {
        list.insertBefore(touchCurrentItem, afterElement);
      }
    }, { passive: true });

    // タッチ終了
    item.addEventListener('touchend', () => {
      if (touchCurrentItem) {
        touchCurrentItem.classList.remove('dragging');
        updateLPPreview();
      }
      touchCurrentItem = null;
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.section-order-item:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// セクションマネージャー初期化をエクスポート
export { initSectionManagerIfNeeded };

// LP設定セクションの初期化フラグをリセット（セクション再読み込み時に使用）
export function resetLPLivePreviewState() {
  lpLivePreviewInitialized = false;
  sectionManagerInitialized = false;
}

// カラーピッカー関連の関数をエクスポート
export { setLPCustomColors, resetLPCustomColors, setupLPColorPickers, getLPCustomColors, layoutStyleColors };

export default {
  loadCompanyListForLP,
  loadJobListForLP,
  loadLPSettings,
  clearLPForm,
  renderHeroImagePresets,
  selectHeroImagePreset,
  updateHeroImagePresetSelection,
  saveLPSettings,
  getSectionOrder,
  getSectionVisibility,
  applySectionOrder,
  applySectionVisibility,
  debouncedUpdatePreview,
  toggleLPPreview,
  closeLPPreview,
  updateLPPreview,
  initSectionSortable,
  renderPointInputs,
  addPoint,
  getPointsData,
  initPointsSection,
  initVideoButtonSection,
  setupHeroImageUpload,
  updateHeroImageUploadPreview,
  initSectionManagerIfNeeded,
  resetLPLivePreviewState,
  setLPCustomColors,
  resetLPCustomColors,
  setupLPColorPickers,
  getLPCustomColors,
  layoutStyleColors
};
