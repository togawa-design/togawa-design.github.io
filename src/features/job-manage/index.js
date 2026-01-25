/**
 * 求人管理機能モジュール
 */
import { escapeHtml } from '@shared/utils.js';

// 設定
const config = {
  gasApiUrl: 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec'
};

// 状態
let companyDomain = null;
let companyName = null;
let sheetUrl = null;
let jobsCache = [];
let currentEditingJob = null;
let isNewJob = false;

/**
 * 日付をinput[type="date"]用にフォーマット
 */
function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 求人テーブルを描画
 */
function renderJobsTable() {
  const tbody = document.getElementById('jobs-tbody');
  if (!tbody) return;

  const jobs = jobsCache || [];

  if (jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">求人データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = jobs.map(job => {
    const salary = job.monthlySalary ? `¥${Number(job.monthlySalary).toLocaleString()}` : '-';
    const isVisible = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;

    return `
      <tr data-row="${job._rowIndex}">
        <td>${escapeHtml(job.id || '-')}</td>
        <td>${escapeHtml(job.title || '-')}</td>
        <td>${escapeHtml(job.location || '-')}</td>
        <td>${salary}</td>
        <td>${isVisible ? '<span class="badge success">公開</span>' : '<span class="badge">非公開</span>'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit" data-row="${job._rowIndex}">編集</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 編集ボタンのイベント設定
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowIndex = parseInt(btn.dataset.row, 10);
      editJob(rowIndex);
    });
  });
}

/**
 * 求人データを読み込み
 */
async function loadJobsData() {
  const tbody = document.getElementById('jobs-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';

  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">GAS API URLが設定されていません。<a href="admin.html">管理画面</a>の設定から設定してください。</td></tr>';
    return;
  }

  try {
    const url = `${gasApiUrl}?action=getJobs&domain=${encodeURIComponent(companyDomain)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('データの取得に失敗しました');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '求人データの取得に失敗しました');
    }

    jobsCache = result.jobs || [];

    if (jobsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">求人データがありません</td></tr>';
      return;
    }

    renderJobsTable();

  } catch (error) {
    console.error('求人データの読み込みエラー:', error);
    tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">データの読み込みに失敗しました: ${escapeHtml(error.message)}</td></tr>`;
  }
}

/**
 * 求人編集モーダルを表示（新規）
 */
function showJobModal() {
  currentEditingJob = null;
  isNewJob = true;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  document.getElementById('job-modal-title').textContent = '新規求人作成';
  setVal('edit-job-title', '');
  setVal('edit-job-location', '');
  setVal('edit-job-salary', '');
  setVal('edit-job-bonus', '');
  setVal('edit-job-order', '');
  setVal('edit-job-features', '');
  setVal('edit-job-badges', '');
  setVal('edit-job-description', '');
  setVal('edit-job-requirements', '');
  setVal('edit-job-benefits', '');
  setVal('edit-job-hours', '');
  setVal('edit-job-holidays', '');
  setVal('edit-job-start-date', '');
  setVal('edit-job-end-date', '');

  const visibleEl = document.getElementById('edit-job-visible');
  if (visibleEl) visibleEl.checked = true;

  const deleteBtn = document.getElementById('job-modal-delete');
  if (deleteBtn) deleteBtn.style.display = 'none';

  const modal = document.getElementById('job-modal');
  if (modal) modal.style.display = 'flex';
}

/**
 * 求人編集モーダルを表示（編集）
 */
function editJob(rowIndex) {
  const job = jobsCache?.find(j => j._rowIndex === rowIndex);
  if (!job) {
    alert('求人データが見つかりません');
    return;
  }

  currentEditingJob = job;
  isNewJob = false;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  document.getElementById('job-modal-title').textContent = '求人情報の編集';
  setVal('edit-job-title', job.title);
  setVal('edit-job-location', job.location);
  setVal('edit-job-salary', job.monthlySalary);
  setVal('edit-job-bonus', job.totalBonus);
  setVal('edit-job-order', job.order);
  setVal('edit-job-features', job.features);
  setVal('edit-job-badges', job.badges);
  setVal('edit-job-description', job.jobDescription);
  setVal('edit-job-requirements', job.requirements);
  setVal('edit-job-benefits', job.benefits);
  setVal('edit-job-hours', job.workingHours);
  setVal('edit-job-holidays', job.holidays);

  if (job.publishStartDate) {
    setVal('edit-job-start-date', formatDateForInput(job.publishStartDate));
  } else {
    setVal('edit-job-start-date', '');
  }
  if (job.publishEndDate) {
    setVal('edit-job-end-date', formatDateForInput(job.publishEndDate));
  } else {
    setVal('edit-job-end-date', '');
  }

  const visibleEl = document.getElementById('edit-job-visible');
  if (visibleEl) {
    visibleEl.checked = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;
  }

  const deleteBtn = document.getElementById('job-modal-delete');
  if (deleteBtn) deleteBtn.style.display = '';

  const modal = document.getElementById('job-modal');
  if (modal) modal.style.display = 'flex';
}

/**
 * 求人編集モーダルを閉じる
 */
function closeJobModal() {
  const modal = document.getElementById('job-modal');
  if (modal) modal.style.display = 'none';
  currentEditingJob = null;
  isNewJob = false;
}

/**
 * 求人データを保存
 */
async function saveJobData() {
  if (!companyDomain) {
    alert('会社が選択されていません');
    return;
  }

  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

  const jobData = {
    title: getVal('edit-job-title'),
    location: getVal('edit-job-location'),
    monthlySalary: getVal('edit-job-salary'),
    totalBonus: getVal('edit-job-bonus'),
    order: getVal('edit-job-order'),
    features: getVal('edit-job-features'),
    badges: getVal('edit-job-badges'),
    jobDescription: getVal('edit-job-description'),
    requirements: getVal('edit-job-requirements'),
    benefits: getVal('edit-job-benefits'),
    workingHours: getVal('edit-job-hours'),
    holidays: getVal('edit-job-holidays'),
    publishStartDate: getVal('edit-job-start-date'),
    publishEndDate: getVal('edit-job-end-date'),
    visible: document.getElementById('edit-job-visible')?.checked ? 'true' : 'false'
  };

  if (!jobData.title || !jobData.location) {
    alert('募集タイトルと勤務地は必須です');
    return;
  }

  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    alert('GAS API URLが設定されていません。設定画面でURLを設定してください。');
    return;
  }

  const saveBtn = document.getElementById('job-modal-save');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      action: 'saveJob',
      companyDomain: companyDomain,
      job: jobData,
      rowIndex: isNewJob ? null : currentEditingJob._rowIndex
    }))));
    const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error(`GASからの応答が不正です: ${responseText.substring(0, 200)}`);
    }

    if (!result.success) {
      alert('保存に失敗しました: ' + (result.error || '不明なエラー'));
      return;
    }

    closeJobModal();
    await loadJobsData();

    alert(isNewJob ? '求人を作成しました' : '求人情報を更新しました');

  } catch (error) {
    console.error('求人保存エラー:', error);
    alert('保存中にエラーが発生しました: ' + error.message);
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
  if (!currentEditingJob || !companyDomain) {
    alert('削除対象が選択されていません');
    return;
  }

  if (!confirm('この求人を削除してもよろしいですか？')) {
    return;
  }

  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    alert('GAS API URLが設定されていません');
    return;
  }

  const deleteBtn = document.getElementById('job-modal-delete');

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

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('GASからの応答が不正です');
    }

    if (!result.success) {
      alert('削除に失敗しました: ' + (result.error || '不明なエラー'));
      return;
    }

    closeJobModal();
    await loadJobsData();

    alert('求人を削除しました');

  } catch (error) {
    console.error('求人削除エラー:', error);
    alert('削除中にエラーが発生しました: ' + error.message);
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = '削除';
    }
  }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  document.getElementById('btn-add-job')?.addEventListener('click', showJobModal);
  document.getElementById('btn-refresh')?.addEventListener('click', loadJobsData);
  document.getElementById('job-modal-close')?.addEventListener('click', closeJobModal);
  document.getElementById('job-modal-cancel')?.addEventListener('click', closeJobModal);
  document.getElementById('job-modal-delete')?.addEventListener('click', deleteJob);

  document.getElementById('job-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveJobData();
  });

  document.getElementById('job-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeJobModal();
    }
  });
}

/**
 * 初期化
 */
export async function initJobManager() {
  const params = new URLSearchParams(window.location.search);
  companyDomain = params.get('domain');
  companyName = params.get('company') || companyDomain;
  sheetUrl = params.get('sheetUrl');

  if (!companyDomain) {
    alert('会社ドメインが指定されていません');
    window.location.href = 'admin.html';
    return;
  }

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = `${companyName} の求人一覧`;

  const companyNameEl = document.getElementById('company-name');
  if (companyNameEl) companyNameEl.textContent = companyName;

  const sheetBtn = document.getElementById('btn-open-sheet');
  if (sheetUrl && sheetBtn) {
    sheetBtn.href = sheetUrl;
    sheetBtn.style.display = '';
  } else if (sheetBtn) {
    sheetBtn.style.display = 'none';
  }

  setupEventListeners();
  await loadJobsData();
}

// グローバルにエクスポート（後方互換）
if (typeof window !== 'undefined') {
  window.JobManager = {
    init: initJobManager,
    loadJobsData,
    showJobModal,
    editJob,
    closeJobModal,
    saveJobData,
    deleteJob
  };
}

export default {
  initJobManager
};
