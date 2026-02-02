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

import { initApplicantsSection } from '@features/applicants/index.js';
import { initRecruitSettings } from '@features/job-manage/recruit-settings.js';
import { config } from '@features/job-manage/auth.js';
import { showToast, escapeHtml } from '@shared/utils.js';
import { generateIndeedXml, generateGoogleJobsJsonLd, generateJobBoxXml, generateCsv, downloadFile } from '@features/admin/job-feed-generator.js';

// 共通サービス
import {
  getJobStatus,
  getStatusLabel,
  getStatusClass,
  formatDateForDisplay,
  populateForm,
  clearForm
} from '@shared/job-service.js';

// 初期化状態
let isInitialized = false;
let currentInitializedCompany = null;
let eventListenersSetup = false;
let isInitializing = false;

// 求人編集用の状態
let currentEditingJob = null;
let isNewJob = false;

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

  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    if (jobsList) {
      jobsList.innerHTML = '<div class="error-message">GAS API URLが設定されていません</div>';
    }
    return;
  }

  // 前のリクエストをキャンセルして新しいAbortControllerを取得
  const abortController = getNewAbortController();

  try {
    const url = `${gasApiUrl}?action=getJobs&domain=${encodeURIComponent(companyDomain)}`;
    const response = await fetch(url, { signal: abortController.signal });

    if (!response.ok) {
      throw new Error('データの取得に失敗しました');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '求人データの取得に失敗しました');
    }

    setJobsCache(result.jobs || []);

    // エリアフィルターのオプションを生成
    populateAreaFilter(jobsCache);

    // 求人リストを描画
    renderJobsTable();

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
 * 求人カードを描画
 */
function renderJobCard(job) {
  const status = getJobStatus(job);
  const statusLabel = getStatusLabel(status);
  const statusClass = getStatusClass(status);

  return `
    <div class="job-card-row" data-job-id="${escapeHtml(job.id || '')}">
      <div class="job-col-image">
        ${job.imageUrl
          ? `<img src="${escapeHtml(job.imageUrl)}" alt="" class="job-thumbnail" onerror="this.style.display='none'">`
          : '<span class="no-image">📄</span>'
        }
      </div>
      <div class="job-col-info">
        <div class="job-title">${escapeHtml(job.title || '無題')}</div>
        <div class="job-tags">
          ${(job.badges || '').split(',').filter(Boolean).map(b => `<span class="job-tag">${escapeHtml(b.trim())}</span>`).join('')}
        </div>
      </div>
      <div class="job-col-type">${escapeHtml(job.jobType || '-')}</div>
      <div class="job-col-area">${escapeHtml(job.area || job.location || '-')}</div>
      <div class="job-col-deadline">${job.deadline ? formatDateForDisplay(job.deadline) : '-'}</div>
      <div class="job-col-stats">${job.applicationCount || 0}</div>
      <div class="job-col-stats">${job.viewCount || 0}</div>
      <div class="job-col-status"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
      <div class="job-col-actions">
        <button class="btn-icon btn-edit-job" title="編集">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="btn-icon btn-preview-job" title="プレビュー">
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
      const row = btn.closest('.job-card-row');
      const jobId = row?.dataset.jobId;
      if (jobId) {
        editJob(jobId);
      }
    });
  });

  // プレビューボタン
  document.querySelectorAll('#jm-jobs-list .btn-preview-job').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.job-card-row');
      const jobId = row?.dataset.jobId;
      if (jobId) {
        window.open(`lp.html?j=${companyDomain}_${jobId}`, '_blank');
      }
    });
  });

  // 行クリック
  document.querySelectorAll('#jm-jobs-list .job-card-row').forEach(row => {
    row.addEventListener('click', () => {
      const jobId = row.dataset.jobId;
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
 * 求人一覧に戻る
 */
function backToJobsList() {
  currentEditingJob = null;
  isNewJob = false;
  switchSubsection('jobs');
}

/**
 * 求人を保存
 */
async function saveJob() {
  const getVal = (id) => document.getElementById(`jm-edit-job-${id}`)?.value?.trim() || '';

  const jobData = {
    id: isNewJob ? '' : (currentEditingJob?.id || ''),
    title: getVal('title'),
    location: getVal('location'),
    monthlySalary: getVal('salary'),
    totalBonus: getVal('bonus'),
    order: getVal('order'),
    jobType: getVal('type'),
    features: getVal('features'),
    badges: getVal('badges'),
    jobDescription: getVal('description'),
    requirements: getVal('requirements'),
    benefits: getVal('benefits'),
    workingHours: getVal('hours'),
    holidays: getVal('holidays'),
    publishStartDate: getVal('start-date'),
    publishEndDate: getVal('end-date'),
    visible: document.getElementById('jm-edit-job-visible')?.checked ? 'true' : 'false'
  };

  if (!jobData.title || !jobData.location) {
    showToast('募集タイトルと勤務地は必須です', 'error');
    return;
  }

  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    showToast('GAS API URLが設定されていません', 'error');
    return;
  }

  const saveBtn = document.getElementById('jm-job-edit-save-btn');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      action: 'saveJob',
      companyDomain: companyDomain,
      job: jobData,
      rowIndex: isNewJob ? null : currentEditingJob?._rowIndex
    }))));

    const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('GASからの応答が不正です');
    }

    if (!result.success) {
      throw new Error(result.error || '保存に失敗しました');
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

  if (!confirm('この求人を削除してもよろしいですか？')) {
    return;
  }

  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    showToast('GAS API URLが設定されていません', 'error');
    return;
  }

  const deleteBtn = document.getElementById('jm-job-edit-delete-btn');

  try {
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = '削除中...';
    }

    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      action: 'deleteJob',
      companyDomain: companyDomain,
      rowIndex: currentEditingJob._rowIndex
    }))));

    const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('GASからの応答が不正です');
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

export default {
  initJobManageEmbedded,
  switchSubsection
};
