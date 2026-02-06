/**
 * Job-Manage Embedded
 * admin.html内でjob-manage機能を動作させるためのアダプターモジュール
 */

import { setCurrentSubsection, getCurrentSubsection, getNewAbortController, clearAbortController, getPendingInitialTab, clearPendingInitialTab } from './admin-state.js';
import {
  setCompanyInfo,
  setApplicantsInitialized,
  setJobsCache,
  resetJobFilters,
  companyDomain,
  companyName,
  jobsCache,
  jobFilters
} from '@features/job-manage/state.js';

import { initApplicantsSection, getCurrentApplicant } from '@features/applicants/index.js';
import { initRecruitSettings } from '@features/job-manage/recruit-settings.js';
import * as CalendarService from '@features/calendar/calendar-service.js';
import { config } from '@features/job-manage/auth.js';
import { showToast, escapeHtml } from '@shared/utils.js';
import { showConfirmDialog } from '@shared/modal.js';
import { generateIndeedXml, generateGoogleJobsJsonLd, generateJobBoxXml, generateCsv, downloadFile } from '@features/admin/job-feed-generator.js';
import { selectImageFile, uploadJobLogo } from '@features/admin/image-uploader.js';

// 求人編集共通ユーティリティ
import {
  updateDisplayedFeaturesContainer as updateDisplayedFeaturesContainerBase,
  setupFeaturesCheckboxEvents as setupFeaturesCheckboxEventsBase
} from '@shared/job-edit-utils.js';

// 共通サービス
import {
  getJobStatus,
  getStatusLabel,
  getStatusClass,
  populateForm,
  clearForm
} from '@shared/job-service.js';

// Firestoreサービス
import { useFirestore } from '@features/admin/config.js';
import * as FirestoreService from '@shared/firestore-service.js';

// 初期化状態
let isInitialized = false;
let currentInitializedCompany = null;
let eventListenersSetup = false;
let isInitializing = false;

// 求人編集用の状態
let currentEditingJob = null;
let isNewJob = false;

// カレンダー連携用の状態
let jmCalendarIntegrationsCache = {};
let jmCurrentWeekStart = null;
let jmSelectedSlot = null;
let jmCurrentApplicant = null;
let jmAssigneesCache = [];

/**
 * job-manage埋め込みセクションを初期化
 * @param {string} domain - 会社ドメイン
 * @param {string} name - 会社名
 * @param {string} [jobId] - 編集する求人ID（オプション）
 */
export async function initJobManageEmbedded(domain, name, jobId = null) {
  // 初期化中なら無視（連打防止）
  if (isInitializing) {
    console.log('[JobManageEmbedded] 初期化中のため無視:', domain);
    return;
  }

  isInitializing = true;

  try {
    // 会社が変わった場合はリセット
    if (currentInitializedCompany !== domain) {
      isInitialized = false;
      currentInitializedCompany = domain;
      setApplicantsInitialized(false);
      resetJobFilters();
    }

    // 状態を設定
    setCompanyInfo(domain, name, null);

    // UI更新
    const companyNameEl = document.getElementById('jm-company-name');
    const companyDomainEl = document.getElementById('jm-company-domain');
    if (companyNameEl) companyNameEl.textContent = name;
    if (companyDomainEl) companyDomainEl.textContent = domain;

    // イベントリスナー設定（初回のみ）
    if (!eventListenersSetup) {
      setupEventListeners();
      eventListenersSetup = true;
    }

    // 初期タブの取得（指定がある場合）
    const initialTab = getPendingInitialTab();
    clearPendingInitialTab();

    // jobIdが指定されている場合は先に編集画面を表示（UX改善）
    if (jobId) {
      // 編集画面をローディング状態で表示
      showJobEditLoading();

      // バックグラウンドでデータ読み込み
      await loadJobsData();

      // データ読み込み完了後、フォームに値をセット
      editJob(jobId);
    } else if (initialTab) {
      // 初期タブ指定がある場合（applicantsなど）
      switchSubsection(initialTab);
      // jobs, analytics, reports の場合はデータ読み込み
      if (['jobs', 'analytics', 'reports'].includes(initialTab)) {
        await loadJobsData();
      }
    } else {
      // 通常フロー：求人一覧を表示
      switchSubsection('jobs');
      await loadJobsData();
    }

    isInitialized = true;
  } finally {
    isInitializing = false;
  }
}

/**
 * 求人データを読み込み
 */
async function loadJobsData() {
  const jobsList = document.getElementById('jm-jobs-list');
  if (jobsList) {
    jobsList.innerHTML = '<div class="job-cards-loading">データを読み込み中...</div>';
  }

  // 前のリクエストをキャンセルして新しいAbortControllerを取得
  const abortController = getNewAbortController();

  try {
    let result;

    if (useFirestore) {
      // Firestoreから取得
      FirestoreService.initFirestore();
      result = await FirestoreService.getJobs(companyDomain);
    } else {
      // GAS APIから取得（旧方式）
      const gasApiUrl = config.gasApiUrl;
      if (!gasApiUrl) {
        if (jobsList) {
          jobsList.innerHTML = '<div class="error-message">GAS API URLが設定されていません</div>';
        }
        return;
      }

      const url = `${gasApiUrl}?action=getJobs&domain=${encodeURIComponent(companyDomain)}`;
      const response = await fetch(url, { signal: abortController.signal });

      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }

      result = await response.json();
    }

    if (!result.success) {
      throw new Error(result.error || '求人データの取得に失敗しました');
    }

    setJobsCache(result.jobs || []);

    // エリアフィルターのオプションを生成
    populateAreaFilter(jobsCache);

    // 求人リストを描画
    renderJobsTable();

    // 採用ページ設定を読み込み、並び替えボタンの表示を制御
    updateSortButtonVisibility();

    // 正常完了時にAbortControllerをクリア
    clearAbortController();

  } catch (error) {
    // キャンセルされた場合は無視
    if (error.name === 'AbortError') {
      console.log('[JobManageEmbedded] リクエストがキャンセルされました');
      return;
    }
    console.error('[JobManageEmbedded] 求人データ読み込みエラー:', error);
    if (jobsList) {
      jobsList.innerHTML = `<div class="error-message">データの読み込みに失敗しました: ${escapeHtml(error.message)}</div>`;
    }
  }
}

/**
 * エリアフィルターのオプションを生成
 */
function populateAreaFilter(jobs) {
  const areaFilter = document.getElementById('jm-job-filter-area');
  if (!areaFilter) return;

  const areas = [...new Set(jobs.map(j => j.area).filter(Boolean))];
  areaFilter.innerHTML = '<option value="">全エリア</option>';
  areas.forEach(area => {
    const option = document.createElement('option');
    option.value = area;
    option.textContent = area;
    areaFilter.appendChild(option);
  });
}

/**
 * 求人リストを描画
 */
function renderJobsTable() {
  const jobsList = document.getElementById('jm-jobs-list');
  const jobsCount = document.getElementById('jm-jobs-count');
  if (!jobsList) return;

  // フィルタリング
  let filteredJobs = jobsCache.filter(job => {
    if (jobFilters.search && !job.title?.toLowerCase().includes(jobFilters.search.toLowerCase())) {
      return false;
    }
    if (jobFilters.status) {
      const status = getJobStatus(job);
      if (jobFilters.status === 'published' && status !== 'active') return false;
      if (jobFilters.status === 'draft' && status !== 'draft') return false;
      if (jobFilters.status === 'expired' && status !== 'expired') return false;
    }
    if (jobFilters.area && job.area !== jobFilters.area) {
      return false;
    }
    return true;
  });

  // orderでソート（昇順、未設定は末尾）
  filteredJobs.sort((a, b) => {
    const orderA = parseInt(a.order) || 999;
    const orderB = parseInt(b.order) || 999;
    return orderA - orderB;
  });

  if (jobsCount) {
    jobsCount.textContent = filteredJobs.length.toString();
  }

  if (filteredJobs.length === 0) {
    jobsList.innerHTML = '<div class="no-data">該当する求人がありません</div>';
    return;
  }

  jobsList.innerHTML = filteredJobs.map(job => renderJobCard(job)).join('');

  // 求人カードのイベント設定
  setupJobCardEvents();
}

/**
 * 求人カードを描画（カード形式）
 */
function renderJobCard(job) {
  const status = getJobStatus(job);
  const statusLabel = getStatusLabel(status);
  const statusClass = getStatusClass(status);

  const orderNum = parseInt(job.order) || 999;
  const imageUrl = job.jobLogo || job.imageUrl || '';

  return `
    <div class="job-listing-card" data-job-id="${escapeHtml(job.id || '')}" data-order="${orderNum}" draggable="false">
      <span class="job-card-drag-handle" title="ドラッグして並び替え">☰</span>
      <span class="job-order-badge">${orderNum < 999 ? orderNum : '-'}</span>
      <div class="job-card-image">
        ${imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(job.title || '')}" onerror="this.style.display='none';this.parentElement.classList.add('no-image')">`
          : '<span class="no-image-icon">📄</span>'
        }
      </div>
      <div class="job-card-content">
        <div class="job-card-header">
          <h5 class="job-card-title">${escapeHtml(job.title || '求人タイトル未設定')}</h5>
          <span class="job-card-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="job-card-meta">
          ${job.location || job.area ? `<span class="job-meta-item"><span class="meta-icon">📍</span>${escapeHtml(job.area || job.location)}</span>` : ''}
          ${job.monthlySalary ? `<span class="job-meta-item"><span class="meta-icon">💰</span>${escapeHtml(job.monthlySalary)}</span>` : ''}
          ${job.jobType ? `<span class="job-meta-item"><span class="meta-icon">💼</span>${escapeHtml(job.jobType)}</span>` : ''}
          ${job.employmentType ? `<span class="job-meta-item"><span class="meta-icon">👤</span>${escapeHtml(job.employmentType)}</span>` : ''}
        </div>
        <div class="job-card-stats">
          <span class="stat-item" title="応募数">📝 ${job.applicationCount || 0}</span>
          <span class="stat-item" title="閲覧数">👁 ${job.viewCount || 0}</span>
        </div>
      </div>
      <div class="job-card-actions">
        <button class="btn-job-action btn-edit-job" title="編集">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="btn-job-action btn-preview-job" title="プレビュー">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        </button>
      </div>
    </div>
  `;
}


/**
 * 求人カードのイベント設定
 */
function setupJobCardEvents() {
  // 編集ボタン
  document.querySelectorAll('#jm-jobs-list .btn-edit-job').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.job-listing-card');
      const jobId = card?.dataset.jobId;
      if (jobId) {
        editJob(jobId);
      }
    });
  });

  // プレビューボタン
  document.querySelectorAll('#jm-jobs-list .btn-preview-job').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.job-listing-card');
      const jobId = card?.dataset.jobId;
      if (jobId) {
        window.open(`lp.html?j=${companyDomain}_${jobId}`, '_blank');
      }
    });
  });

  // カードクリック
  document.querySelectorAll('#jm-jobs-list .job-listing-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // ボタン類のクリックは除外
      if (e.target.closest('.btn-job-action')) {
        return;
      }
      const jobId = card.dataset.jobId;
      if (jobId) {
        editJob(jobId);
      }
    });
  });
}

/**
 * 求人編集サブセクションをローディング状態で表示
 */
function showJobEditLoading() {
  currentEditingJob = null;
  isNewJob = false;

  // フォームをクリア
  clearForm('jm-edit-job');

  // タイトル・バッジ更新（ローディング状態）
  const titleEl = document.getElementById('jm-job-edit-title');
  const badgeEl = document.getElementById('jm-job-edit-badge');
  if (titleEl) titleEl.textContent = '読み込み中...';
  if (badgeEl) {
    badgeEl.textContent = '編集';
    badgeEl.classList.add('edit');
  }

  // 削除ボタンを非表示（データ読み込み後に表示）
  const deleteBtn = document.getElementById('jm-job-edit-delete-btn');
  if (deleteBtn) deleteBtn.style.display = 'none';

  // 保存ボタンを無効化（データ読み込み後に有効化）
  const saveBtn = document.getElementById('jm-job-edit-save-btn');
  if (saveBtn) saveBtn.disabled = true;

  // サブセクション切り替え（先に編集画面を表示）
  switchSubsection('job-edit');
}

/**
 * 求人編集サブセクションを表示（新規）
 */
function showJobEditNew() {
  currentEditingJob = null;
  isNewJob = true;

  // フォームをクリア
  clearForm('jm-edit-job');

  // メモ欄をクリア
  const memoEl = document.getElementById('jm-edit-job-memo');
  if (memoEl) memoEl.value = '';

  // 給与形態をクリア
  const salaryTypeEl = document.getElementById('jm-edit-job-salary-type');
  if (salaryTypeEl) salaryTypeEl.value = '';
  const salaryOtherEl = document.getElementById('jm-edit-job-salary-other');
  if (salaryOtherEl) salaryOtherEl.value = '';
  const salaryOtherGroup = document.getElementById('jm-salary-other-group');
  if (salaryOtherGroup) salaryOtherGroup.style.display = 'none';

  // 勤務時間リストをクリア
  const workingHoursList = document.getElementById('jm-working-hours-list');
  if (workingHoursList) {
    workingHoursList.innerHTML = `
      <div class="multi-input-item">
        <input type="text" class="jm-working-hours-input" placeholder="例: 8:00〜17:00">
        <button type="button" class="btn-remove-item" title="削除">×</button>
      </div>
    `;
    setupJmWorkingHoursRemoveButtons();
  }

  // 特徴チェックボックスをクリア
  document.querySelectorAll('#jm-features-checkbox-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // 表示する特徴をクリア
  const displayedFeaturesContainer = document.getElementById('jm-displayed-features-container');
  if (displayedFeaturesContainer) {
    displayedFeaturesContainer.innerHTML = '<div class="displayed-features-empty">上記から特徴を選択すると、ここに表示されます</div>';
  }

  // ロゴ設定をクリア
  const logoInput = document.getElementById('jm-edit-job-logo');
  if (logoInput) logoInput.value = '';
  const logoPreview = document.getElementById('jm-job-logo-preview');
  if (logoPreview) logoPreview.style.display = 'none';
  const logoPreviewImg = document.getElementById('jm-job-logo-preview-img');
  if (logoPreviewImg) logoPreviewImg.src = '';

  // 動画設定をクリア
  const showVideoCheckbox = document.getElementById('jm-edit-job-show-video');
  if (showVideoCheckbox) showVideoCheckbox.checked = false;
  const videoUrlInput = document.getElementById('jm-edit-job-video-url');
  if (videoUrlInput) videoUrlInput.value = '';
  const videoUrlGroup = document.getElementById('jm-video-url-group');
  if (videoUrlGroup) videoUrlGroup.style.display = 'none';

  // タイトル・バッジ更新
  const titleEl = document.getElementById('jm-job-edit-title');
  const badgeEl = document.getElementById('jm-job-edit-badge');
  if (titleEl) titleEl.textContent = '新規求人作成';
  if (badgeEl) {
    badgeEl.textContent = '新規';
    badgeEl.classList.remove('edit');
  }

  // 削除ボタンを非表示
  const deleteBtn = document.getElementById('jm-job-edit-delete-btn');
  if (deleteBtn) deleteBtn.style.display = 'none';

  // 保存ボタンを有効化
  const saveBtn = document.getElementById('jm-job-edit-save-btn');
  if (saveBtn) saveBtn.disabled = false;

  // サブセクション切り替え
  switchSubsection('job-edit');
}

/**
 * 求人編集サブセクションを表示（編集）
 */
function editJob(jobId) {
  // IDの型の不一致を考慮して文字列比較も行う
  const job = jobsCache?.find(j => j.id === jobId || j.id === String(jobId) || String(j.id) === String(jobId));
  if (!job) {
    showToast('求人データが見つかりません', 'error');
    return;
  }

  currentEditingJob = job;
  isNewJob = false;

  // フォームに値をセット
  populateForm(job, 'jm-edit-job');

  // メモを設定
  const memoEl = document.getElementById('jm-edit-job-memo');
  if (memoEl) memoEl.value = job.memo || '';

  // 給与形態を設定
  populateSalaryFields(job);

  // 勤務時間を設定
  populateWorkingHoursFields(job);

  // 特徴チェックボックスを設定
  populateFeaturesCheckboxes(job);

  // ロゴ設定を設定
  populateLogoFields(job);

  // 動画設定を設定
  populateVideoFields(job);

  // タイトル・バッジ更新
  const titleEl = document.getElementById('jm-job-edit-title');
  const badgeEl = document.getElementById('jm-job-edit-badge');
  if (titleEl) titleEl.textContent = job.title || '求人編集';
  if (badgeEl) {
    badgeEl.textContent = '編集';
    badgeEl.classList.add('edit');
  }

  // 削除ボタンを表示
  const deleteBtn = document.getElementById('jm-job-edit-delete-btn');
  if (deleteBtn) deleteBtn.style.display = '';

  // 保存ボタンを有効化
  const saveBtn = document.getElementById('jm-job-edit-save-btn');
  if (saveBtn) saveBtn.disabled = false;

  // サブセクション切り替え
  switchSubsection('job-edit');
}

/**
 * 給与形態フィールドを設定
 */
function populateSalaryFields(job) {
  const salaryTypeEl = document.getElementById('jm-edit-job-salary-type');
  const salaryOtherEl = document.getElementById('jm-edit-job-salary-other');
  const salaryOtherGroup = document.getElementById('jm-salary-other-group');

  if (salaryTypeEl) {
    if (job.salaryType) {
      salaryTypeEl.value = job.salaryType;
    } else if (job.monthlySalary) {
      salaryTypeEl.value = '月給';
    } else {
      salaryTypeEl.value = '';
    }
  }

  if (salaryOtherEl && salaryOtherGroup) {
    if (job.salaryType === 'その他' || job.salaryOther) {
      salaryOtherEl.value = job.salaryOther || '';
      salaryOtherGroup.style.display = 'block';
    } else {
      salaryOtherEl.value = '';
      salaryOtherGroup.style.display = 'none';
    }
  }
}

/**
 * 勤務時間フィールドを設定（複数入力対応）
 */
function populateWorkingHoursFields(job) {
  const container = document.getElementById('jm-working-hours-list');
  if (!container) return;

  const hoursData = job.workingHours || '';
  const hoursString = typeof hoursData === 'string' ? hoursData : String(hoursData);
  const hoursArray = hoursString.split(/[|\n]/).map(h => h.trim()).filter(h => h);

  if (hoursArray.length === 0) {
    hoursArray.push('');
  }

  container.innerHTML = hoursArray.map(hour => `
    <div class="multi-input-item">
      <input type="text" class="jm-working-hours-input" placeholder="例: 8:00〜17:00" value="${escapeHtml(hour)}">
      <button type="button" class="btn-remove-item" title="削除">×</button>
    </div>
  `).join('');

  setupJmWorkingHoursRemoveButtons();
}

/**
 * ロゴ設定フィールドを設定
 */
function populateLogoFields(job) {
  const logoInput = document.getElementById('jm-edit-job-logo');
  const logoPreview = document.getElementById('jm-job-logo-preview');
  const logoPreviewImg = document.getElementById('jm-job-logo-preview-img');

  const logoUrl = job.jobLogo || job.imageUrl || '';

  if (logoInput) {
    logoInput.value = logoUrl;
  }

  if (logoPreview && logoPreviewImg) {
    if (logoUrl) {
      logoPreviewImg.src = logoUrl;
      logoPreview.style.display = 'block';
    } else {
      logoPreviewImg.src = '';
      logoPreview.style.display = 'none';
    }
  }
}

/**
 * 動画設定フィールドを設定
 */
function populateVideoFields(job) {
  const showVideoCheckbox = document.getElementById('jm-edit-job-show-video');
  const videoUrlInput = document.getElementById('jm-edit-job-video-url');
  const videoUrlGroup = document.getElementById('jm-video-url-group');

  if (showVideoCheckbox) {
    showVideoCheckbox.checked = String(job.showVideoButton).toLowerCase() === 'true';
  }

  if (videoUrlInput) {
    videoUrlInput.value = job.videoUrl || '';
  }

  if (videoUrlGroup) {
    videoUrlGroup.style.display = showVideoCheckbox?.checked ? 'block' : 'none';
  }
}

/**
 * 特徴チェックボックスを設定
 */
function populateFeaturesCheckboxes(job) {
  const featuresData = job.features || '';
  const featuresArray = featuresData.split(',').map(f => f.trim()).filter(f => f);

  // まず全てのチェックを外す
  document.querySelectorAll('#jm-features-checkbox-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // 該当するものをチェック
  featuresArray.forEach(feature => {
    const cb = document.querySelector(`#jm-features-checkbox-grid input[value="${feature}"]`);
    if (cb) {
      cb.checked = true;
    }
  });

  // 表示する特徴を設定
  const displayedFeaturesData = job.displayedFeatures || '';
  const displayedFeaturesArray = displayedFeaturesData.split(',').map(f => f.trim()).filter(f => f);
  updateDisplayedFeaturesContainer(featuresArray, displayedFeaturesArray);
}

// admin.html用の設定定数
const DISPLAYED_FEATURES_CONFIG = {
  containerId: 'jm-displayed-features-container',
  featuresGridId: 'jm-features-checkbox-grid',
  checkboxName: 'jm-displayed-features',
  onWarning: (msg) => showToast(msg, 'warning')
};

/**
 * 表示する特徴のコンテナを更新（共通モジュールのラッパー）
 */
function updateDisplayedFeaturesContainer(checkedFeatures, selectedDisplayed = []) {
  updateDisplayedFeaturesContainerBase({
    containerId: DISPLAYED_FEATURES_CONFIG.containerId,
    checkboxName: DISPLAYED_FEATURES_CONFIG.checkboxName,
    checkedFeatures,
    selectedDisplayed,
    onWarning: DISPLAYED_FEATURES_CONFIG.onWarning
  });
}

/**
 * 特徴チェックボックスの変更を監視（共通モジュールのラッパー）
 */
function setupFeaturesCheckboxEvents() {
  setupFeaturesCheckboxEventsBase({
    featuresGridId: DISPLAYED_FEATURES_CONFIG.featuresGridId,
    displayedContainerId: DISPLAYED_FEATURES_CONFIG.containerId,
    checkboxName: DISPLAYED_FEATURES_CONFIG.checkboxName,
    onWarning: DISPLAYED_FEATURES_CONFIG.onWarning
  });
}

/**
 * 求人一覧に戻る
 */
function backToJobsList() {
  currentEditingJob = null;
  isNewJob = false;
  switchSubsection('jobs');
}

/**
 * 動画設定をLP設定に同期
 * 求人編集で動画を設定した場合、LP設定にも反映させる
 * 既存のsaveLPSettingsアクションを使用
 */
async function syncVideoToLP(jobId, jobData, showVideoButton, videoUrl) {
  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) return;

  try {
    // LP設定の同期データを作成
    // 初期値としてheroCTAセクションを含むlpContentを設定
    const initialLpContent = {
      version: 2,
      sections: [
        {
          id: 'hero-cta-1',
          type: 'heroCta',
          data: {
            title: `${jobData.title || ''}で一緒に働きませんか？`,
            subtitle: '',
            backgroundImage: '',
            showVideoButton: showVideoButton === 'true',
            videoUrl: videoUrl || ''
          }
        },
        {
          id: 'job-info-1',
          type: 'jobInfo',
          data: {}
        },
        {
          id: 'cta-1',
          type: 'cta',
          data: {
            title: '今すぐ応募する'
          }
        }
      ]
    };

    const lpSettings = {
      jobId: jobId,
      companyDomain: companyDomain,
      company: companyName,
      jobTitle: jobData.title || '',
      showVideoButton: showVideoButton,
      videoUrl: videoUrl,
      lpContent: JSON.stringify(initialLpContent),
      // 動画同期フラグ（既存設定がある場合は動画のみ更新するためのフラグ）
      syncVideoOnly: true
    };

    // 既存のsaveLPSettingsアクションを使用
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      action: 'saveLPSettings',
      settings: lpSettings
    }))));

    const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.warn('[JobManageEmbedded] LP同期レスポンスのパースエラー');
      return;
    }

    if (result.success) {
      console.log('[JobManageEmbedded] 動画設定をLPに同期しました');
    } else {
      console.warn('[JobManageEmbedded] LP同期エラー:', result.error);
    }
  } catch (error) {
    // LP同期のエラーは求人保存のメイン処理に影響を与えない
    console.warn('[JobManageEmbedded] LP同期中にエラー:', error.message);
  }
}

/**
 * 求人を保存
 */
async function saveJob() {
  const getVal = (id) => document.getElementById(`jm-edit-job-${id}`)?.value?.trim() || '';

  // 給与形態の取得
  const salaryType = getVal('salary-type');
  const salaryValue = getVal('salary');
  const salaryOther = getVal('salary-other');

  // 勤務時間の取得（複数入力から）
  const workingHoursInputs = document.querySelectorAll('#jm-working-hours-list .jm-working-hours-input');
  const workingHoursArray = Array.from(workingHoursInputs)
    .map(input => input.value.trim())
    .filter(v => v);
  const workingHours = workingHoursArray.join(' | ');

  // 特徴の取得（チェックボックスから）
  const featuresCheckboxes = document.querySelectorAll('#jm-features-checkbox-grid input[type="checkbox"]:checked');
  const featuresArray = Array.from(featuresCheckboxes).map(cb => cb.value);
  const features = featuresArray.join(',');

  // 表示する特徴の取得
  const displayedFeaturesCheckboxes = document.querySelectorAll('#jm-displayed-features-container input[type="checkbox"]:checked');
  const displayedFeaturesArray = Array.from(displayedFeaturesCheckboxes).map(cb => cb.value);
  const displayedFeatures = displayedFeaturesArray.join(',');

  // ロゴ設定の取得
  const jobLogo = getVal('logo');

  // 動画設定の取得
  const showVideoButton = document.getElementById('jm-edit-job-show-video')?.checked ? 'true' : 'false';
  const videoUrl = getVal('video-url');

  const jobData = {
    id: isNewJob ? '' : (currentEditingJob?.id || ''),
    memo: getVal('memo'),
    title: getVal('title'),
    employmentType: getVal('employment-type'),
    location: getVal('location'),
    access: getVal('access'),
    salaryType: salaryType,
    monthlySalary: salaryValue,
    salaryOther: salaryOther,
    totalBonus: getVal('bonus'),
    order: getVal('order'),
    jobType: getVal('type'),
    features: features,
    displayedFeatures: displayedFeatures,
    badges: '', // バッジは削除
    jobDescription: getVal('description'),
    requirements: getVal('requirements'),
    benefits: getVal('benefits'),
    workingHours: workingHours,
    holidays: getVal('holidays'),
    publishStartDate: getVal('start-date'),
    publishEndDate: getVal('end-date'),
    visible: document.getElementById('jm-edit-job-visible')?.checked ? 'true' : 'false',
    jobLogo: jobLogo,
    showVideoButton: showVideoButton,
    videoUrl: videoUrl
  };

  if (!jobData.title || !jobData.location) {
    showToast('募集タイトルと勤務地は必須です', 'error');
    return;
  }

  const saveBtn = document.getElementById('jm-job-edit-save-btn');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    let result;

    if (useFirestore) {
      // Firestoreに保存
      FirestoreService.initFirestore();
      const existingDocId = isNewJob ? null : (currentEditingJob?._docId || currentEditingJob?.id);
      result = await FirestoreService.saveJob(companyDomain, jobData, existingDocId);
      console.log('[JobManageEmbedded] Firestore保存結果:', result);
    } else {
      // GAS APIに保存（旧方式）
      const gasApiUrl = config.gasApiUrl;
      if (!gasApiUrl) {
        showToast('GAS API URLが設定されていません', 'error');
        return;
      }

      // 空の値を除去してペイロードサイズを削減（GAS URL長制限対策）
      const filteredJobData = Object.fromEntries(
        Object.entries(jobData).filter(([key, value]) => {
          if (value === null || value === undefined || value === '') return false;
          if (key === 'badges') return false; // バッジは常に空なので除外
          return true;
        })
      );

      const requestData = {
        action: 'saveJob',
        companyDomain: companyDomain,
        job: filteredJobData,
        rowIndex: isNewJob ? null : currentEditingJob?._rowIndex
      };
      console.log('[JobManageEmbedded] 保存リクエスト:', requestData);

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify(requestData))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
      console.log('[JobManageEmbedded] URL長:', url.length, 'bytes');

      // URL長制限をチェック（GASは約8KB程度まで対応可能）
      if (url.length > 8000) {
        throw new Error(`データが大きすぎます。求人説明などのテキストを短くしてください。（URL長: ${url.length}文字）`);
      }

      const response = await fetch(url, { method: 'GET', redirect: 'follow' });

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error(`リクエストが大きすぎます。求人説明などのテキストを短くしてください。`);
        }
        throw new Error(`サーバーエラー: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('GASからの応答が不正です: ' + responseText.substring(0, 200));
      }
      console.log('[JobManageEmbedded] GAS保存結果:', result);
    }

    if (!result.success) {
      throw new Error(result.error || '保存に失敗しました');
    }

    // 動画設定がある場合、LP設定にも同期
    if (showVideoButton === 'true' && videoUrl) {
      const jobId = isNewJob ? result.jobId : (currentEditingJob?.id || '');
      if (jobId) {
        await syncVideoToLP(jobId, jobData, showVideoButton, videoUrl);
      }
    }

    showToast(isNewJob ? '求人を作成しました' : '求人情報を更新しました', 'success');
    backToJobsList();
    await loadJobsData();

  } catch (error) {
    console.error('[JobManageEmbedded] 求人保存エラー:', error);
    showToast('保存に失敗しました: ' + error.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  }
}

/**
 * 求人を削除
 */
async function deleteJob() {
  if (!currentEditingJob) {
    showToast('削除対象が選択されていません', 'error');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: '求人の削除',
    message: 'この求人を削除してもよろしいですか？',
    confirmText: '削除する',
    cancelText: 'キャンセル',
    danger: true
  });
  if (!confirmed) return;

  const deleteBtn = document.getElementById('jm-job-edit-delete-btn');

  try {
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = '削除中...';
    }

    let result;

    if (useFirestore) {
      // Firestoreから削除
      FirestoreService.initFirestore();
      const jobId = currentEditingJob._docId || currentEditingJob.id;
      result = await FirestoreService.deleteJob(companyDomain, jobId);
    } else {
      // GAS APIで削除（旧方式）
      const gasApiUrl = config.gasApiUrl;
      if (!gasApiUrl) {
        showToast('GAS API URLが設定されていません', 'error');
        return;
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'deleteJob',
        companyDomain: companyDomain,
        rowIndex: currentEditingJob._rowIndex
      }))));

      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const responseText = await response.text();

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('GASからの応答が不正です');
      }
    }

    if (!result.success) {
      throw new Error(result.error || '削除に失敗しました');
    }

    showToast('求人を削除しました', 'success');
    backToJobsList();
    await loadJobsData();

  } catch (error) {
    console.error('[JobManageEmbedded] 求人削除エラー:', error);
    showToast('削除に失敗しました: ' + error.message, 'error');
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = '削除';
    }
  }
}

/**
 * サブセクションを切り替え
 */
export function switchSubsection(tab) {
  setCurrentSubsection(tab);

  // タブのアクティブ状態更新（job-editの場合は全て非アクティブ）
  document.querySelectorAll('#jm-tabs .jm-tab').forEach(t => {
    t.classList.toggle('active', tab !== 'job-edit' && t.dataset.tab === tab);
  });

  // タブバーの表示/非表示（job-editの場合は非表示）
  const tabsContainer = document.getElementById('jm-tabs');
  if (tabsContainer) {
    tabsContainer.style.display = tab === 'job-edit' ? 'none' : '';
  }

  // サブセクションの表示切替
  document.querySelectorAll('.jm-subsection').forEach(section => {
    section.classList.remove('active');
  });
  const targetSection = document.getElementById(`jm-${tab}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // セクション固有の初期化
  if (tab === 'applicants') {
    initApplicantsSection(companyDomain, companyName, 'jm-');
  } else if (tab === 'recruit') {
    initRecruitSettings(companyDomain);
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // タブ切り替え
  document.querySelectorAll('#jm-tabs .jm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchSubsection(tab.dataset.tab);
    });
  });

  // 新規求人作成ボタン
  document.getElementById('jm-btn-add-job')?.addEventListener('click', showJobEditNew);

  // 更新ボタン
  document.getElementById('jm-btn-refresh')?.addEventListener('click', loadJobsData);

  // 求人編集セクションのイベント
  document.getElementById('jm-job-edit-back-btn')?.addEventListener('click', backToJobsList);
  document.getElementById('jm-job-edit-cancel-btn')?.addEventListener('click', backToJobsList);
  document.getElementById('jm-job-edit-delete-btn')?.addEventListener('click', deleteJob);
  document.getElementById('jm-job-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveJob();
  });

  // 検索・フィルター
  const searchInput = document.getElementById('jm-job-search');
  const statusFilter = document.getElementById('jm-job-filter-status');
  const areaFilter = document.getElementById('jm-job-filter-area');
  const clearFiltersBtn = document.getElementById('jm-btn-clear-filters');

  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        jobFilters.search = searchInput.value.trim();
        renderJobsTable();
      }, 300);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      jobFilters.status = statusFilter.value;
      renderJobsTable();
    });
  }

  if (areaFilter) {
    areaFilter.addEventListener('change', () => {
      jobFilters.area = areaFilter.value;
      renderJobsTable();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      resetJobFilters();
      if (searchInput) searchInput.value = '';
      if (statusFilter) statusFilter.value = '';
      if (areaFilter) areaFilter.value = '';
      renderJobsTable();
    });
  }

  // フィード出力ボタン
  document.getElementById('jm-btn-download-indeed')?.addEventListener('click', () => downloadFeed('indeed'));
  document.getElementById('jm-btn-download-google')?.addEventListener('click', () => downloadFeed('google'));
  document.getElementById('jm-btn-download-jobbox')?.addEventListener('click', () => downloadFeed('jobbox'));
  document.getElementById('jm-btn-download-csv')?.addEventListener('click', () => downloadFeed('csv'));

  // 給与形態変更イベント
  document.getElementById('jm-edit-job-salary-type')?.addEventListener('change', handleJmSalaryTypeChange);

  // 勤務時間追加ボタン
  document.getElementById('jm-btn-add-working-hours')?.addEventListener('click', addJmWorkingHoursItem);

  // 既存の勤務時間削除ボタン
  setupJmWorkingHoursRemoveButtons();

  // 特徴チェックボックスの変更監視
  setupFeaturesCheckboxEvents();

  // ロゴURL入力の変更監視（プレビュー表示）
  document.getElementById('jm-edit-job-logo')?.addEventListener('input', handleJmLogoInputChange);
  document.getElementById('jm-btn-clear-logo')?.addEventListener('click', handleJmClearLogo);
  document.getElementById('jm-btn-upload-logo')?.addEventListener('click', handleJmLogoUpload);

  // 動画表示チェックボックスの変更監視
  document.getElementById('jm-edit-job-show-video')?.addEventListener('change', handleJmShowVideoChange);

  // アナリティクス日付範囲の初期化
  initJmDateRangePicker();

  // カレンダー連携設定ボタン
  document.getElementById('jm-btn-calendar-settings')?.addEventListener('click', showJmCalendarSettingsModal);
  document.getElementById('jm-calendar-settings-close')?.addEventListener('click', closeJmCalendarSettingsModal);
  document.getElementById('jm-calendar-settings-close-btn')?.addEventListener('click', closeJmCalendarSettingsModal);
  document.getElementById('jm-calendar-settings-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeJmCalendarSettingsModal();
    }
  });

  // 面談設定モーダル
  document.getElementById('jm-btn-schedule-interview')?.addEventListener('click', showJmInterviewModal);
  document.getElementById('jm-interview-modal-close')?.addEventListener('click', closeJmInterviewModal);
  document.getElementById('jm-interview-modal-cancel')?.addEventListener('click', closeJmInterviewModal);
  document.getElementById('jm-interview-modal-save')?.addEventListener('click', saveJmInterview);
  document.getElementById('jm-interview-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeJmInterviewModal();
    }
  });

  // 担当者選択変更時
  document.getElementById('jm-interview-staff')?.addEventListener('change', handleJmStaffChange);

  // 週ナビゲーション
  document.getElementById('jm-btn-prev-week')?.addEventListener('click', () => navigateJmWeek(-1));
  document.getElementById('jm-btn-next-week')?.addEventListener('click', () => navigateJmWeek(1));

  // 並び替えモード
  setupSortModeEvents();
}

/**
 * アナリティクス日付範囲ピッカーを初期化
 */
function initJmDateRangePicker() {
  const startInput = document.getElementById('jm-analytics-start-date');
  const endInput = document.getElementById('jm-analytics-end-date');
  const presetBtns = document.querySelectorAll('#jm-analytics .date-preset-btn');

  if (!startInput || !endInput) return;

  // デフォルト: 過去30日間
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);

  endInput.value = formatDateForDateInput(today);
  startInput.value = formatDateForDateInput(thirtyDaysAgo);

  // 最大値を今日に設定
  endInput.max = formatDateForDateInput(today);
  startInput.max = formatDateForDateInput(today);

  // プリセットボタンのイベント
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const { start, end } = getJmPresetDates(preset);

      startInput.value = formatDateForDateInput(start);
      endInput.value = formatDateForDateInput(end);

      // アクティブ状態を更新
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 日付変更時にプリセットのアクティブ状態をクリア
  startInput.addEventListener('change', () => {
    presetBtns.forEach(b => b.classList.remove('active'));
  });
  endInput.addEventListener('change', () => {
    presetBtns.forEach(b => b.classList.remove('active'));
  });
}

/**
 * 日付をinput[type=date]用にフォーマット
 */
function formatDateForDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * プリセット期間の日付を取得
 */
function getJmPresetDates(preset) {
  const today = new Date();
  let start, end;

  switch (preset) {
    case '7days':
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 6);
      break;
    case '30days':
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 29);
      break;
    case '90days':
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 89);
      break;
    default:
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 29);
  }

  return { start, end };
}

/**
 * ロゴURL入力変更時の処理（プレビュー表示）
 */
function handleJmLogoInputChange() {
  const logoInput = document.getElementById('jm-edit-job-logo');
  const logoPreview = document.getElementById('jm-job-logo-preview');
  const logoPreviewImg = document.getElementById('jm-job-logo-preview-img');

  if (!logoInput || !logoPreview || !logoPreviewImg) return;

  const url = logoInput.value.trim();

  if (url) {
    logoPreviewImg.src = url;
    logoPreviewImg.onerror = () => {
      logoPreview.style.display = 'none';
    };
    logoPreviewImg.onload = () => {
      logoPreview.style.display = 'block';
    };
  } else {
    logoPreview.style.display = 'none';
    logoPreviewImg.src = '';
  }
}

/**
 * ロゴクリアボタンの処理
 */
function handleJmClearLogo() {
  const logoInput = document.getElementById('jm-edit-job-logo');
  const logoPreview = document.getElementById('jm-job-logo-preview');
  const logoPreviewImg = document.getElementById('jm-job-logo-preview-img');

  if (logoInput) logoInput.value = '';
  if (logoPreview) logoPreview.style.display = 'none';
  if (logoPreviewImg) logoPreviewImg.src = '';
}

/**
 * ロゴアップロードボタンの処理
 */
async function handleJmLogoUpload() {
  const logoInput = document.getElementById('jm-edit-job-logo');
  const logoPreview = document.getElementById('jm-job-logo-preview');
  const logoPreviewImg = document.getElementById('jm-job-logo-preview-img');
  const uploadProgress = document.getElementById('jm-logo-upload-progress');
  const uploadBtn = document.getElementById('jm-btn-upload-logo');

  try {
    // ファイル選択ダイアログを表示
    const file = await selectImageFile({ accept: 'image/*' });

    // アップロード中表示
    if (uploadProgress) uploadProgress.style.display = 'flex';
    if (uploadBtn) uploadBtn.disabled = true;

    // Cloudinaryにアップロード
    const url = await uploadJobLogo(file, companyDomain);

    // URLをインプットにセット
    if (logoInput) logoInput.value = url;

    // プレビュー表示
    if (logoPreviewImg) {
      logoPreviewImg.src = url;
      logoPreviewImg.onload = () => {
        if (logoPreview) logoPreview.style.display = 'block';
      };
    }

    showToast('画像をアップロードしました');

  } catch (error) {
    if (error.message !== 'ファイルが選択されませんでした') {
      console.error('[JobManageEmbedded] ロゴアップロードエラー:', error);
      showToast('画像のアップロードに失敗しました: ' + error.message, 'error');
    }
  } finally {
    if (uploadProgress) uploadProgress.style.display = 'none';
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

/**
 * 動画表示チェックボックス変更時の処理
 */
function handleJmShowVideoChange() {
  const showVideoCheckbox = document.getElementById('jm-edit-job-show-video');
  const videoUrlGroup = document.getElementById('jm-video-url-group');

  if (!showVideoCheckbox || !videoUrlGroup) return;

  if (showVideoCheckbox.checked) {
    videoUrlGroup.style.display = 'block';
  } else {
    videoUrlGroup.style.display = 'none';
  }
}

/**
 * 給与形態変更時の処理
 */
function handleJmSalaryTypeChange() {
  const salaryTypeEl = document.getElementById('jm-edit-job-salary-type');
  const salaryOtherGroup = document.getElementById('jm-salary-other-group');

  if (!salaryTypeEl || !salaryOtherGroup) return;

  if (salaryTypeEl.value === 'その他') {
    salaryOtherGroup.style.display = 'block';
  } else {
    salaryOtherGroup.style.display = 'none';
  }
}

/**
 * 勤務時間の削除ボタンにイベントを設定
 */
function setupJmWorkingHoursRemoveButtons() {
  const container = document.getElementById('jm-working-hours-list');
  if (!container) return;

  container.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const items = container.querySelectorAll('.multi-input-item');
      if (items.length > 1) {
        btn.closest('.multi-input-item').remove();
      }
    });
  });
}

/**
 * 勤務時間を追加
 */
function addJmWorkingHoursItem() {
  const container = document.getElementById('jm-working-hours-list');
  if (!container) return;

  const newItem = document.createElement('div');
  newItem.className = 'multi-input-item';
  newItem.innerHTML = `
    <input type="text" class="jm-working-hours-input" placeholder="例: 8:00〜17:00">
    <button type="button" class="btn-remove-item" title="削除">×</button>
  `;

  container.appendChild(newItem);

  const removeBtn = newItem.querySelector('.btn-remove-item');
  removeBtn.addEventListener('click', () => {
    const items = container.querySelectorAll('.multi-input-item');
    if (items.length > 1) {
      newItem.remove();
    }
  });

  newItem.querySelector('input').focus();
}

/**
 * フィードをダウンロード
 */
async function downloadFeed(type) {
  const statusEl = document.getElementById('jm-feed-status');
  if (statusEl) statusEl.style.display = 'flex';

  try {
    // visible が true または 'true' の求人のみフィルタリング
    const jobs = jobsCache.filter(j => j.visible === true || j.visible === 'true' || j.visible === 'TRUE');

    let content, filename, mimeType;

    switch (type) {
      case 'indeed':
        content = generateIndeedXml(jobs);
        filename = `${companyDomain}_indeed_feed.xml`;
        mimeType = 'application/xml';
        break;
      case 'google':
        content = generateGoogleJobsJsonLd(jobs);
        filename = `${companyDomain}_google_jobs.json`;
        mimeType = 'application/ld+json';
        break;
      case 'jobbox':
        content = generateJobBoxXml(jobs);
        filename = `${companyDomain}_jobbox_feed.xml`;
        mimeType = 'application/xml';
        break;
      case 'csv':
        content = generateCsv(jobs);
        filename = `${companyDomain}_jobs.csv`;
        mimeType = 'text/csv';
        break;
      default:
        throw new Error('Unknown feed type');
    }

    // ダウンロード
    downloadFile(content, filename, mimeType);
    showToast(`${filename} をダウンロードしました`);

  } catch (error) {
    console.error('[JobManageEmbedded] フィード生成エラー:', error);
    showToast('フィードの生成に失敗しました', 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

// ========================================
// カレンダー連携関連
// ========================================

/**
 * カレンダー連携設定モーダルを表示
 */
async function showJmCalendarSettingsModal() {
  const modal = document.getElementById('jm-calendar-settings-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  await loadJmCalendarIntegrations();
}

/**
 * カレンダー連携設定モーダルを閉じる
 */
function closeJmCalendarSettingsModal() {
  const modal = document.getElementById('jm-calendar-settings-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * カレンダー連携情報を読み込み
 */
async function loadJmCalendarIntegrations() {
  jmCalendarIntegrationsCache = {};

  try {
    // Firestoreから担当者（会社ユーザー）一覧を取得
    const db = firebase.firestore();
    const snapshot = await db.collection('company_users')
      .where('companyDomain', '==', companyDomain)
      .where('isActive', '==', true)
      .get();

    jmAssigneesCache = [];
    snapshot.forEach(doc => {
      jmAssigneesCache.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // 各担当者のカレンダー連携情報を取得
    for (const user of jmAssigneesCache) {
      try {
        const result = await CalendarService.getCalendarIntegration(companyDomain, user.id);
        if (result.integration) {
          jmCalendarIntegrationsCache[user.id] = result.integration;
        }
      } catch (e) {
        console.log(`No calendar integration for user ${user.id}`);
      }
    }

    renderJmCalendarIntegrationsList();
  } catch (error) {
    console.error('Failed to load calendar integrations:', error);
    showToast('カレンダー連携情報の取得に失敗しました', 'error');
  }
}

/**
 * カレンダー連携一覧を描画
 */
function renderJmCalendarIntegrationsList() {
  const container = document.getElementById('jm-calendar-integrations-list');
  if (!container) return;

  if (jmAssigneesCache.length === 0) {
    container.innerHTML = '<p class="no-data">担当者が登録されていません</p>';
    return;
  }

  container.innerHTML = jmAssigneesCache.map(user => {
    const integration = jmCalendarIntegrationsCache[user.id];
    const isConnected = integration?.isActive;

    return `
      <div class="calendar-integration-item" data-user-id="${escapeHtml(user.id)}">
        <div class="calendar-integration-info">
          <div class="calendar-integration-icon">👤</div>
          <div class="calendar-integration-details">
            <strong>${escapeHtml(user.name || user.username)}</strong>
            ${isConnected ? `<small>${escapeHtml(integration.email || '')}</small>` : ''}
          </div>
        </div>
        <div class="calendar-integration-actions">
          ${isConnected
            ? `<span class="calendar-status connected">連携中</span>
               <button class="btn-disconnect-calendar" data-user-id="${escapeHtml(user.id)}">解除</button>`
            : `<button class="btn-connect-calendar" data-user-id="${escapeHtml(user.id)}" data-user-name="${escapeHtml(user.name || user.username)}">
                 Googleカレンダーと連携
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // イベントリスナーを設定
  container.querySelectorAll('.btn-connect-calendar').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      const userName = btn.dataset.userName;
      connectJmCalendar(userId, userName);
    });
  });

  container.querySelectorAll('.btn-disconnect-calendar').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      disconnectJmCalendar(userId);
    });
  });
}

/**
 * カレンダー連携を開始
 */
async function connectJmCalendar(userId, userName) {
  try {
    const result = await CalendarService.initiateCalendarAuth(companyDomain, userId, userName);

    window.open(result.authUrl, 'calendar-auth', 'width=600,height=700');

    // ポーリングで連携完了を検知
    const checkInterval = setInterval(async () => {
      try {
        const checkResult = await CalendarService.getCalendarIntegration(companyDomain, userId);
        if (checkResult.integration?.isActive) {
          clearInterval(checkInterval);
          jmCalendarIntegrationsCache[userId] = checkResult.integration;
          renderJmCalendarIntegrationsList();
          showToast('カレンダー連携が完了しました');
        }
      } catch (e) {
        // 連携未完了の場合は継続
      }
    }, 2000);

    // 60秒後にポーリング停止
    setTimeout(() => clearInterval(checkInterval), 60000);

  } catch (error) {
    console.error('Failed to initiate calendar auth:', error);
    showToast('カレンダー連携の開始に失敗しました', 'error');
  }
}

/**
 * カレンダー連携を解除
 */
async function disconnectJmCalendar(userId) {
  const confirmed = await showConfirmDialog({
    title: 'カレンダー連携の解除',
    message: 'カレンダー連携を解除しますか？',
    confirmText: '解除する',
    cancelText: 'キャンセル',
    danger: true
  });
  if (!confirmed) return;

  try {
    await CalendarService.revokeCalendarAuth(companyDomain, userId);
    delete jmCalendarIntegrationsCache[userId];
    renderJmCalendarIntegrationsList();
    showToast('カレンダー連携を解除しました');
  } catch (error) {
    console.error('Failed to revoke calendar auth:', error);
    showToast('連携解除に失敗しました', 'error');
  }
}

/**
 * ローカル開発環境かどうかを判定
 */
function isLocalDev() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * 面談設定モーダルを表示
 */
async function showJmInterviewModal() {
  const modal = document.getElementById('jm-interview-modal');
  if (!modal) return;

  // 現在選択中の応募者を取得
  jmCurrentApplicant = getCurrentApplicant();
  if (!jmCurrentApplicant) {
    showToast('応募者を選択してください', 'error');
    return;
  }
  console.log('[showJmInterviewModal] jmCurrentApplicant:', jmCurrentApplicant);

  // ローカル開発環境の場合はダミーデータを使用
  if (isLocalDev()) {
    jmAssigneesCache = [
      { id: 'local-user-1', name: 'テスト担当者1', username: 'test1' },
      { id: 'local-user-2', name: 'テスト担当者2', username: 'test2' }
    ];
    jmCalendarIntegrationsCache = {};
  } else {
    // 担当者一覧を取得（キャッシュがなければ取得）
    if (jmAssigneesCache.length === 0) {
      try {
        const db = firebase.firestore();
        const snapshot = await db.collection('company_users')
          .where('companyDomain', '==', companyDomain)
          .where('isActive', '==', true)
          .get();

        jmAssigneesCache = [];
        snapshot.forEach(doc => {
          jmAssigneesCache.push({
            id: doc.id,
            ...doc.data()
          });
        });
      } catch (error) {
        console.error('Failed to load assignees:', error);
      }
    }
  }

  // 担当者セレクトを更新
  const staffSelect = document.getElementById('jm-interview-staff');
  if (staffSelect) {
    staffSelect.innerHTML = '<option value="">担当者を選択...</option>' +
      jmAssigneesCache.map(user => {
        const integration = jmCalendarIntegrationsCache[user.id];
        const suffix = integration?.isActive ? ' (📅連携済)' : '';
        return `<option value="${escapeHtml(user.id)}" data-has-calendar="${integration?.isActive ? 'true' : 'false'}">${escapeHtml(user.name || user.username)}${suffix}</option>`;
      }).join('');
  }

  // 初期化
  jmCurrentWeekStart = CalendarService.getWeekStart(new Date());
  jmSelectedSlot = null;

  // UIリセット
  document.getElementById('jm-availability-section').style.display = 'none';
  document.getElementById('jm-selected-slot-section').style.display = 'none';
  document.getElementById('jm-manual-datetime-section').style.display = 'block';
  document.getElementById('jm-calendar-status-hint').textContent = isLocalDev() ? 'ローカル環境: 手動入力のみ利用可能' : '';
  document.getElementById('jm-interview-datetime').value = '';

  modal.style.display = 'flex';
}

/**
 * 面談設定モーダルを閉じる
 */
function closeJmInterviewModal() {
  const modal = document.getElementById('jm-interview-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * 担当者選択変更時の処理
 */
function handleJmStaffChange() {
  const staffSelect = document.getElementById('jm-interview-staff');
  const selectedOption = staffSelect.options[staffSelect.selectedIndex];
  const hasCalendar = selectedOption?.dataset?.hasCalendar === 'true';

  const availabilitySection = document.getElementById('jm-availability-section');
  const manualSection = document.getElementById('jm-manual-datetime-section');
  const selectedSlotSection = document.getElementById('jm-selected-slot-section');
  const hint = document.getElementById('jm-calendar-status-hint');

  jmSelectedSlot = null;
  selectedSlotSection.style.display = 'none';

  if (hasCalendar) {
    hint.textContent = 'カレンダー連携済み - 空き時間から選択できます';
    hint.className = 'form-hint hint-success';
    availabilitySection.style.display = 'block';
    manualSection.style.display = 'none';
    loadJmAvailability();
  } else {
    hint.textContent = staffSelect.value ? 'カレンダー未連携 - 日時を手動で入力してください' : '';
    hint.className = 'form-hint';
    availabilitySection.style.display = 'none';
    manualSection.style.display = 'block';
  }
}

/**
 * 空き時間を読み込み
 */
async function loadJmAvailability() {
  const staffSelect = document.getElementById('jm-interview-staff');
  const userId = staffSelect.value;
  if (!userId) return;

  const grid = document.getElementById('jm-availability-grid');
  grid.innerHTML = '<div class="loading-message">空き時間を取得中...</div>';

  try {
    const weekEnd = new Date(jmCurrentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startDate = CalendarService.formatDateISO(jmCurrentWeekStart);
    const endDate = CalendarService.formatDateISO(weekEnd);

    const result = await CalendarService.getCalendarAvailability(companyDomain, userId, startDate, endDate);

    updateJmWeekLabel();
    renderJmAvailabilityGrid(result.availableSlots || []);
  } catch (error) {
    console.error('Failed to load availability:', error);
    grid.innerHTML = '<p class="error-message">空き時間の取得に失敗しました</p>';
  }
}

/**
 * 週ラベルを更新
 */
function updateJmWeekLabel() {
  const weekEnd = new Date(jmCurrentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const label = document.getElementById('jm-week-label');
  if (label) {
    label.textContent = `${CalendarService.formatDateISO(jmCurrentWeekStart)} 〜 ${CalendarService.formatDateISO(weekEnd)}`;
  }
}

/**
 * 空き時間グリッドを描画
 */
function renderJmAvailabilityGrid(slots) {
  const grid = document.getElementById('jm-availability-grid');
  if (!grid) return;

  if (!slots || slots.length === 0) {
    grid.innerHTML = '<p class="no-data">この週に空き時間はありません</p>';
    return;
  }

  // 日付ごとにグループ化
  const slotsByDate = {};
  for (const slot of slots) {
    const dateStr = CalendarService.formatDateISO(new Date(slot.start));
    if (!slotsByDate[dateStr]) {
      slotsByDate[dateStr] = [];
    }
    slotsByDate[dateStr].push(slot);
  }

  // 週の各日を生成
  let html = '<div class="availability-week">';
  for (let i = 0; i < 7; i++) {
    const date = new Date(jmCurrentWeekStart);
    date.setDate(date.getDate() + i);
    const dateStr = CalendarService.formatDateISO(date);
    const dayName = CalendarService.getDayOfWeek(date);
    const daySlots = slotsByDate[dateStr] || [];

    html += `
      <div class="availability-day">
        <div class="day-header">${date.getMonth() + 1}/${date.getDate()} (${dayName})</div>
        <div class="day-slots">
          ${daySlots.length === 0
            ? '<span class="no-slots">-</span>'
            : daySlots.map((slot, idx) => {
                console.log(`[renderSlot] Slot ${idx}:`, slot);
                const startTime = new Date(slot.start);
                const timeStr = `${startTime.getHours()}:${String(startTime.getMinutes()).padStart(2, '0')}`;
                const btnHtml = `<button type="button" class="slot-btn" data-start="${slot.start}" data-end="${slot.end}">${timeStr}</button>`;
                if (idx === 0) console.log('[renderSlot] First button HTML:', btnHtml);
                return btnHtml;
              }).join('')
          }
        </div>
      </div>
    `;
  }
  html += '</div>';

  grid.innerHTML = html;

  // イベント委譲でスロットボタンのクリックを処理
  // （既存のリスナーを削除してから追加）
  const newGrid = grid.cloneNode(true);
  grid.parentNode.replaceChild(newGrid, grid);

  newGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.slot-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    // data-start/data-end または data-slot のどちらかから値を取得
    const startValue = btn.dataset.start || btn.dataset.slot;
    const endValue = btn.dataset.end;

    console.log('[slotClick] startValue:', startValue, 'endValue:', endValue);

    newGrid.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    jmSelectedSlot = {
      start: startValue,
      end: endValue
    };
    console.log('[slotClick] jmSelectedSlot set to:', jmSelectedSlot);
    showJmSelectedSlot();
  });

  console.log('[renderAvailability] Grid setup complete, slots:', newGrid.querySelectorAll('.slot-btn').length);
}

/**
 * 選択されたスロットを表示
 */
function showJmSelectedSlot() {
  const section = document.getElementById('jm-selected-slot-section');
  const display = document.getElementById('jm-selected-slot');

  console.log('[showJmSelectedSlot] jmSelectedSlot:', jmSelectedSlot);

  if (jmSelectedSlot && section && display) {
    console.log('[showJmSelectedSlot] start value:', jmSelectedSlot.start, 'type:', typeof jmSelectedSlot.start);
    const slotDate = new Date(jmSelectedSlot.start);
    console.log('[showJmSelectedSlot] parsed slotDate:', slotDate, 'isValid:', !isNaN(slotDate.getTime()));

    if (isNaN(slotDate.getTime())) {
      display.textContent = `選択: ${jmSelectedSlot.start}`;
    } else {
      const dayName = CalendarService.getDayOfWeek(slotDate);
      const timeStr = `${slotDate.getHours()}:${String(slotDate.getMinutes()).padStart(2, '0')}`;
      display.textContent = `${slotDate.getFullYear()}/${slotDate.getMonth() + 1}/${slotDate.getDate()} (${dayName}) ${timeStr}〜`;
    }
    section.style.display = 'block';
  }
}

/**
 * 週を移動
 */
function navigateJmWeek(direction) {
  jmCurrentWeekStart.setDate(jmCurrentWeekStart.getDate() + (direction * 7));
  jmSelectedSlot = null;
  document.getElementById('jm-selected-slot-section').style.display = 'none';
  loadJmAvailability();
}

/**
 * 面談を保存
 */
async function saveJmInterview() {
  const staffSelect = document.getElementById('jm-interview-staff');
  const selectedOption = staffSelect.options[staffSelect.selectedIndex];
  const hasCalendar = selectedOption?.dataset?.hasCalendar === 'true';

  console.log('[saveJmInterview] hasCalendar:', hasCalendar);
  console.log('[saveJmInterview] jmSelectedSlot:', jmSelectedSlot);

  // 日時の取得
  let scheduledAt;
  if (hasCalendar) {
    // カレンダー連携時はスロット選択が必須
    if (!jmSelectedSlot) {
      showToast('空き時間から日程を選択してください', 'error');
      return;
    }
    scheduledAt = new Date(jmSelectedSlot.start);
    console.log('[saveJmInterview] Using calendar slot:', scheduledAt);
  } else {
    // 手動入力
    const datetimeInput = document.getElementById('jm-interview-datetime');
    console.log('[saveJmInterview] Manual datetime value:', datetimeInput?.value);
    if (!datetimeInput?.value) {
      showToast('面談日時を入力してください', 'error');
      return;
    }
    scheduledAt = new Date(datetimeInput.value);
  }

  // 日時の有効性チェック
  if (isNaN(scheduledAt.getTime())) {
    showToast('日時の形式が正しくありません', 'error');
    return;
  }

  const saveBtn = document.getElementById('jm-interview-modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  try {
    const durationMinutes = parseInt(document.getElementById('jm-interview-duration').value);
    const checkedRadio = document.querySelector('input[name="jm-meeting-type"]:checked');
    console.log('[saveJmInterview] checkedRadio:', checkedRadio, 'value:', checkedRadio?.value);
    const meetingType = checkedRadio?.value || 'in_person';
    const location = document.getElementById('jm-interview-location').value;

    console.log('[saveJmInterview] meetingType:', meetingType);

    const staffName = selectedOption?.textContent?.replace(' (📅連携済)', '') || '';

    // ローカル環境ではAPIを呼ばずにUIのみ更新
    if (isLocalDev()) {
      console.log('[saveJmInterview] ローカル環境: APIスキップ');
      showToast('面談を登録しました（ローカルモード）');
      closeJmInterviewModal();
      updateJmInterviewInfo(scheduledAt, staffName, meetingType, location, null);
      return;
    }

    // カレンダーイベントを作成
    // 応募者データのフィールド名を正しく取得
    const applicantName = jmCurrentApplicant?.applicantName || jmCurrentApplicant?.applicant?.name || '';
    const applicantEmail = jmCurrentApplicant?.applicantEmail || jmCurrentApplicant?.applicant?.email || '';
    const jobTitle = jmCurrentApplicant?.jobTitle || '';

    const apiParams = {
      companyDomain,
      companyUserId: staffSelect.value,
      applicationId: jmCurrentApplicant?.id || '',
      applicantName,
      applicantEmail,
      staffName,
      jobTitle,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      meetingType,
      location,
      reminders: [
        { offsetMinutes: 1440 }, // 1日前
        { offsetMinutes: 60 }   // 1時間前
      ]
    };
    console.log('[saveJmInterview] Sending API params:', JSON.stringify(apiParams));

    const result = await CalendarService.createCalendarEvent(apiParams);

    console.log('[saveJmInterview] API result:', result);
    console.log('[saveJmInterview] result.meetLink:', result.meetLink);

    showToast('面談を登録しました');
    closeJmInterviewModal();

    // 面談情報を更新（UIに反映）- meetLinkがあればそれを使用
    const displayLocation = result.meetLink || location;
    updateJmInterviewInfo(scheduledAt, staffName, meetingType, displayLocation, result.meetLink);

  } catch (error) {
    console.error('Failed to save interview:', error);
    showToast('面談の登録に失敗しました', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '面談を登録';
  }
}

/**
 * 面談情報をUIに反映
 */
function updateJmInterviewInfo(scheduledAt, staffName, meetingType, location, meetLink = null) {
  console.log('[updateJmInterviewInfo] Called with:', { scheduledAt, staffName, meetingType, location, meetLink });

  const infoContainer = document.getElementById('jm-interview-info');
  if (!infoContainer) return;

  const dayName = CalendarService.getDayOfWeek(scheduledAt);
  const typeLabels = { in_person: '対面', online: 'オンライン', phone: '電話' };
  const displayType = typeLabels[meetingType] || meetingType;
  console.log('[updateJmInterviewInfo] meetingType:', meetingType, '-> displayType:', displayType);

  // 時刻フォーマット
  const timeStr = `${scheduledAt.getHours()}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`;

  // Meetリンクがある場合はクリック可能なリンクとして表示
  let locationHtml = '';
  if (meetLink) {
    locationHtml = `
      <div class="interview-info-row interview-meet">
        <span class="info-label">📹 Meet</span>
        <a href="${escapeHtml(meetLink)}" target="_blank" rel="noopener" class="meet-link">${escapeHtml(meetLink)}</a>
      </div>`;
  } else if (location) {
    locationHtml = `
      <div class="interview-info-row">
        <span class="info-label">📍 場所</span>
        <span class="info-value">${escapeHtml(location)}</span>
      </div>`;
  }

  infoContainer.innerHTML = `
    <div class="interview-scheduled">
      <div class="interview-datetime">
        <span class="interview-date-text">${scheduledAt.getFullYear()}/${scheduledAt.getMonth() + 1}/${scheduledAt.getDate()} (${dayName})</span>
        <span class="interview-time-text">${timeStr}〜</span>
      </div>
      <div class="interview-info-grid">
        <div class="interview-info-row">
          <span class="info-label">👤 担当</span>
          <span class="info-value">${escapeHtml(staffName)}</span>
        </div>
        <div class="interview-info-row">
          <span class="info-label">📋 形式</span>
          <span class="info-value">${displayType}</span>
        </div>
        ${locationHtml}
      </div>
    </div>
  `;
}

// ========================================
// 並び替えモード機能
// ========================================

/**
 * 並び替えボタンの表示を更新
 * 会社が選択されている場合のみ表示
 */
function updateSortButtonVisibility() {
  const sortModeBtn = document.getElementById('jm-btn-sort-mode');
  if (!sortModeBtn) return;

  // 会社が選択されている場合のみボタンを表示
  if (companyDomain) {
    sortModeBtn.style.display = '';
  } else {
    sortModeBtn.style.display = 'none';
  }
}

let isSortMode = false;
let originalOrder = []; // 元の順序を保存

/**
 * 並び替えモードを開始
 */
function enterSortMode() {
  isSortMode = true;

  const sortModeBar = document.getElementById('jm-sort-mode-bar');
  const jobsList = document.getElementById('jm-jobs-list');
  const sortModeBtn = document.getElementById('jm-btn-sort-mode');

  if (sortModeBar) sortModeBar.style.display = 'flex';
  if (jobsList) jobsList.classList.add('sort-mode');
  if (sortModeBtn) sortModeBtn.style.display = 'none';

  // 元の順序を保存
  originalOrder = Array.from(jobsList.querySelectorAll('.job-listing-card'))
    .map(row => row.dataset.jobId);

  // ドラッグ可能にする
  jobsList.querySelectorAll('.job-listing-card').forEach(row => {
    row.setAttribute('draggable', 'true');
  });

  setupDragDropEvents();
}

/**
 * 並び替えモードを終了
 */
function exitSortMode(revert = false) {
  isSortMode = false;

  const sortModeBar = document.getElementById('jm-sort-mode-bar');
  const jobsList = document.getElementById('jm-jobs-list');

  if (sortModeBar) sortModeBar.style.display = 'none';
  if (jobsList) jobsList.classList.remove('sort-mode');
  // ボタンの表示は updateSortButtonVisibility で制御
  updateSortButtonVisibility();

  // ドラッグを無効化
  jobsList?.querySelectorAll('.job-listing-card').forEach(row => {
    row.setAttribute('draggable', 'false');
  });

  // 元に戻す場合
  if (revert && originalOrder.length > 0) {
    const rows = Array.from(jobsList.querySelectorAll('.job-listing-card'));
    originalOrder.forEach(jobId => {
      const row = rows.find(r => r.dataset.jobId === jobId);
      if (row) jobsList.appendChild(row);
    });
  }

  originalOrder = [];
}

/**
 * ドラッグ&ドロップイベントを設定
 */
function setupDragDropEvents() {
  const jobsList = document.getElementById('jm-jobs-list');
  if (!jobsList) return;

  let draggedItem = null;

  jobsList.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.job-listing-card');
    if (!row || !isSortMode) return;

    draggedItem = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.jobId);
  });

  jobsList.addEventListener('dragend', (e) => {
    const row = e.target.closest('.job-listing-card');
    if (row) row.classList.remove('dragging');
    jobsList.querySelectorAll('.job-listing-card').forEach(r => r.classList.remove('drag-over'));
    draggedItem = null;
    updateOrderBadges();
  });

  jobsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!isSortMode || !draggedItem) return;

    const row = e.target.closest('.job-listing-card');
    if (!row || row === draggedItem) return;

    // 挿入位置を決定
    const rect = row.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    jobsList.querySelectorAll('.job-listing-card').forEach(r => r.classList.remove('drag-over'));

    if (e.clientY < midY) {
      row.classList.add('drag-over');
      jobsList.insertBefore(draggedItem, row);
    } else {
      row.classList.add('drag-over');
      jobsList.insertBefore(draggedItem, row.nextSibling);
    }
  });

  jobsList.addEventListener('drop', (e) => {
    e.preventDefault();
    jobsList.querySelectorAll('.job-listing-card').forEach(r => r.classList.remove('drag-over'));
  });
}

/**
 * 順序番号バッジを更新
 */
function updateOrderBadges() {
  const jobsList = document.getElementById('jm-jobs-list');
  if (!jobsList) return;

  jobsList.querySelectorAll('.job-listing-card').forEach((row, index) => {
    const badge = row.querySelector('.job-order-badge');
    if (badge) {
      badge.textContent = index + 1;
    }
  });
}

/**
 * 並び替え順序を保存
 */
async function saveSortOrder() {
  const jobsList = document.getElementById('jm-jobs-list');
  if (!jobsList) return;

  const saveBtn = document.getElementById('jm-btn-save-sort');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
  }

  try {
    const rows = jobsList.querySelectorAll('.job-listing-card');
    const updates = [];

    rows.forEach((row, index) => {
      const jobId = row.dataset.jobId;
      const newOrder = index + 1;

      // jobsCacheから該当の求人を見つけて更新
      const job = jobsCache.find(j => String(j.id) === String(jobId));
      if (job) {
        job.order = newOrder;
        updates.push({ jobId, order: newOrder });
      }
    });

    // 各求人のorderを更新（GASに保存）
    for (const update of updates) {
      await saveJobOrder(update.jobId, update.order);
    }

    showToast('並び順を保存しました');
    exitSortMode();

  } catch (error) {
    console.error('Failed to save sort order:', error);
    showToast('並び順の保存に失敗しました', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '順序を保存';
    }
  }
}

/**
 * 求人のorderを保存
 */
async function saveJobOrder(jobId, order) {
  const job = jobsCache.find(j => String(j.id) === String(jobId));
  if (!job) return;

  // 既存のjobDataを取得して、orderのみ更新
  const jobData = { ...job, order: String(order) };
  const rowIndex = job._rowIndex;
  // _rowIndexはGAS側で不要なので除外
  delete jobData._rowIndex;

  // GASのスプレッドシートAPIを使用して保存（CORS対応: GETリクエスト + Base64エンコード）
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
    action: 'saveJob',
    companyDomain: companyDomain,
    job: jobData,
    rowIndex: rowIndex
  }))));

  const url = `${config.gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
  const response = await fetch(url, { method: 'GET', redirect: 'follow' });
  const responseText = await response.text();

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error('Invalid response from server');
  }

  if (!result.success) {
    throw new Error(result.error || 'Failed to save job order');
  }
}

/**
 * 並び替えモードのイベントリスナーを設定
 */
function setupSortModeEvents() {
  const sortModeBtn = document.getElementById('jm-btn-sort-mode');
  const saveSortBtn = document.getElementById('jm-btn-save-sort');
  const cancelSortBtn = document.getElementById('jm-btn-cancel-sort');

  if (sortModeBtn) {
    sortModeBtn.addEventListener('click', enterSortMode);
  }

  if (saveSortBtn) {
    saveSortBtn.addEventListener('click', saveSortOrder);
  }

  if (cancelSortBtn) {
    cancelSortBtn.addEventListener('click', () => exitSortMode(true));
  }
}

export default {
  initJobManageEmbedded,
  switchSubsection
};
