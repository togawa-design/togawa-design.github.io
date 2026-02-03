/**
 * 求人サービス - CRUD操作とステータス管理の共有モジュール
 * admin.html と job-manage.html で共通利用
 */

import { escapeHtml, showToast } from './utils.js';

// GAS API URL
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec';

/**
 * 求人のステータスを判定
 * @param {Object} job - 求人データ
 * @returns {'active' | 'draft' | 'expired'} ステータス
 */
export function getJobStatus(job) {
  const isVisible = job.visible === true ||
                    job.visible === 'true' ||
                    job.visible === 'TRUE' ||
                    job.isVisible === true ||
                    job.isVisible === 'true';

  if (!isVisible) return 'draft';

  if (job.publishEndDate) {
    const endDate = new Date(job.publishEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDate < today) return 'expired';
  }

  return 'active';
}

/**
 * ステータスのラベルを取得
 * @param {string} status - ステータス
 * @returns {string} ラベル
 */
export function getStatusLabel(status) {
  const labels = {
    active: '公開中',
    draft: '非公開',
    expired: '掲載終了'
  };
  return labels[status] || status;
}

/**
 * ステータスのCSSクラスを取得
 * @param {string} status - ステータス
 * @returns {string} CSSクラス
 */
export function getStatusClass(status) {
  const classes = {
    active: 'status-active',
    draft: 'status-draft',
    expired: 'status-expired'
  };
  return classes[status] || '';
}

/**
 * 日付をinput[type="date"]用にフォーマット
 * @param {string} dateStr - 日付文字列
 * @returns {string} フォーマット済み日付 (YYYY-MM-DD)
 */
export function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付を表示用にフォーマット
 * @param {string} dateStr - 日付文字列
 * @returns {string} フォーマット済み日付 (YY/MM/DD)
 */
export function formatDateForDisplay(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return `${String(date.getFullYear()).slice(2)}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 求人リストを読み込む
 * @param {string} companyDomain - 会社ドメイン
 * @param {Object} options - オプション
 * @param {AbortSignal} options.signal - AbortController用シグナル
 * @returns {Promise<{success: boolean, jobs?: Array, error?: string, aborted?: boolean}>}
 */
export async function loadJobs(companyDomain, options = {}) {
  if (!companyDomain) {
    return { success: false, error: '会社ドメインが指定されていません' };
  }

  try {
    const url = `${GAS_API_URL}?action=getJobs&domain=${encodeURIComponent(companyDomain)}`;
    const fetchOptions = options.signal ? { signal: options.signal } : {};
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error('データの取得に失敗しました');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '求人データの取得に失敗しました');
    }

    return { success: true, jobs: result.jobs || [], sheetUrl: result.sheetUrl || result.manageSheetUrl };
  } catch (error) {
    // キャンセルされた場合
    if (error.name === 'AbortError') {
      console.log('[JobService] リクエストがキャンセルされました');
      return { success: false, aborted: true };
    }
    console.error('[JobService] 求人データ読み込みエラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 求人を保存する
 * @param {string} companyDomain - 会社ドメイン
 * @param {Object} jobData - 求人データ
 * @param {number|null} rowIndex - 行インデックス（新規の場合はnull）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveJob(companyDomain, jobData, rowIndex = null) {
  if (!companyDomain) {
    return { success: false, error: '会社ドメインが指定されていません' };
  }

  if (!jobData.title || !jobData.location) {
    return { success: false, error: '募集タイトルと勤務地は必須です' };
  }

  try {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      action: 'saveJob',
      companyDomain: companyDomain,
      job: jobData,
      rowIndex: rowIndex
    }))));

    const url = `${GAS_API_URL}?action=post&data=${encodeURIComponent(payload)}`;
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[JobService] JSON parse error:', parseError);
      throw new Error('GASからの応答が不正です');
    }

    if (!result.success) {
      throw new Error(result.error || '保存に失敗しました');
    }

    return { success: true };
  } catch (error) {
    console.error('[JobService] 求人保存エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 求人を削除する
 * @param {string} companyDomain - 会社ドメイン
 * @param {number} rowIndex - 行インデックス
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteJob(companyDomain, rowIndex) {
  if (!companyDomain) {
    return { success: false, error: '会社ドメインが指定されていません' };
  }

  if (rowIndex == null) {
    return { success: false, error: '削除対象が指定されていません' };
  }

  try {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      action: 'deleteJob',
      companyDomain: companyDomain,
      rowIndex: rowIndex
    }))));

    const url = `${GAS_API_URL}?action=post&data=${encodeURIComponent(payload)}`;
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[JobService] JSON parse error:', parseError);
      throw new Error('GASからの応答が不正です');
    }

    if (!result.success) {
      throw new Error(result.error || '削除に失敗しました');
    }

    return { success: true };
  } catch (error) {
    console.error('[JobService] 求人削除エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 求人をフィルタリング
 * @param {Array} jobs - 求人リスト
 * @param {Object} filters - フィルター条件
 * @returns {Array} フィルタリング済み求人リスト
 */
export function filterJobs(jobs, filters = {}) {
  return jobs.filter(job => {
    // 検索フィルター
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const title = (job.title || '').toLowerCase();
      const location = (job.location || '').toLowerCase();
      if (!title.includes(searchLower) && !location.includes(searchLower)) {
        return false;
      }
    }

    // ステータスフィルター
    if (filters.status) {
      const status = getJobStatus(job);
      // 'published' と 'active' を同等に扱う
      const normalizedFilterStatus = filters.status === 'published' ? 'active' : filters.status;
      if (status !== normalizedFilterStatus) {
        return false;
      }
    }

    // エリアフィルター
    if (filters.area) {
      const area = job.area || job.location || '';
      if (!area.includes(filters.area)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * エリアリストを抽出
 * @param {Array} jobs - 求人リスト
 * @returns {string[]} エリアリスト（重複なし）
 */
export function extractAreas(jobs) {
  const areas = new Set();
  jobs.forEach(job => {
    const area = job.area || job.location || '';
    if (area) {
      // 都道府県を抽出
      const match = area.match(/^(.+?[都道府県])/);
      if (match) {
        areas.add(match[1]);
      } else {
        areas.add(area.split(/[市区町村]/)[0] || area);
      }
    }
  });
  return Array.from(areas).sort();
}

/**
 * 求人カードのHTMLを生成
 * @param {Object} job - 求人データ
 * @param {Object} options - オプション
 * @returns {string} HTML
 */
export function renderJobCardHtml(job, options = {}) {
  const status = getJobStatus(job);
  const statusLabel = getStatusLabel(status);
  const statusClass = getStatusClass(status);

  const badges = job.badges ? job.badges.split(',').map(b => b.trim()).filter(b => b) : [];
  const tagsHtml = badges.map(badge => {
    const isUrgent = badge === '急募';
    return `<span class="job-tag${isUrgent ? ' urgent' : ''}">${escapeHtml(badge)}</span>`;
  }).join('');

  const deadline = job.publishEndDate ? formatDateForDisplay(job.publishEndDate) : '-';
  const applications = job.applicationCount || job.applications || 0;
  const views = job.viewCount || job.pv || 0;

  const idAttr = options.idPrefix
    ? `data-job-id="${escapeHtml(job.id || '')}"`
    : `data-row="${job._rowIndex}"`;

  return `
    <div class="job-card-row" ${idAttr}>
      <div class="job-col-image">
        ${job.imageUrl
          ? `<img src="${escapeHtml(job.imageUrl)}" alt="" class="job-thumbnail" loading="lazy" onerror="this.style.display='none'">`
          : '<span class="no-image">📄</span>'
        }
      </div>
      <div class="job-col-info">
        <div class="job-title">${escapeHtml(job.title || '無題')}</div>
        <div class="job-tags">${tagsHtml}</div>
      </div>
      <div class="job-col-type">${escapeHtml(job.jobType || '-')}</div>
      <div class="job-col-area">${escapeHtml(job.area || job.location || '-')}</div>
      <div class="job-col-deadline">${deadline}</div>
      <div class="job-col-stats">${applications}</div>
      <div class="job-col-stats">${views}</div>
      <div class="job-col-status"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
      <div class="job-col-actions">
        <button class="btn-icon btn-edit-job" title="編集">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        ${options.showDuplicate ? `
        <button class="btn-icon btn-duplicate-job" title="複製">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
        ` : ''}
        ${options.showPreview ? `
        <button class="btn-icon btn-preview-job" title="プレビュー">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * 求人フォームからデータを取得
 * @param {string} prefix - フォーム要素IDのプレフィックス
 * @returns {Object} フォームデータ
 */
export function getFormData(prefix = 'edit-job') {
  const getVal = (id) => document.getElementById(`${prefix}-${id}`)?.value?.trim() || '';
  const getChecked = (id) => document.getElementById(`${prefix}-${id}`)?.checked;

  return {
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
    visible: getChecked('visible') ? 'true' : 'false'
  };
}

/**
 * フォームに求人データをセット
 * @param {Object} job - 求人データ
 * @param {string} prefix - フォーム要素IDのプレフィックス
 */
export function populateForm(job, prefix = 'edit-job') {
  const setVal = (id, val) => {
    const el = document.getElementById(`${prefix}-${id}`);
    if (el) el.value = val || '';
  };

  setVal('title', job.title);
  setVal('location', job.location);
  setVal('access', job.access);
  setVal('salary', job.monthlySalary);
  setVal('bonus', job.totalBonus);
  setVal('order', job.order);
  setVal('type', job.jobType);
  setVal('features', job.features);
  setVal('badges', job.badges);
  setVal('description', job.jobDescription);
  setVal('requirements', job.requirements);
  setVal('benefits', job.benefits);
  setVal('hours', job.workingHours);
  setVal('holidays', job.holidays);
  setVal('start-date', formatDateForInput(job.publishStartDate));
  setVal('end-date', formatDateForInput(job.publishEndDate));

  const visibleEl = document.getElementById(`${prefix}-visible`);
  if (visibleEl) {
    visibleEl.checked = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;
  }
}

/**
 * フォームをクリア
 * @param {string} prefix - フォーム要素IDのプレフィックス
 */
export function clearForm(prefix = 'edit-job') {
  const fields = ['title', 'location', 'access', 'salary', 'bonus', 'order', 'type', 'features',
                  'badges', 'description', 'requirements', 'benefits', 'hours',
                  'holidays', 'start-date', 'end-date'];

  fields.forEach(field => {
    const el = document.getElementById(`${prefix}-${field}`);
    if (el) el.value = '';
  });

  const visibleEl = document.getElementById(`${prefix}-visible`);
  if (visibleEl) visibleEl.checked = true;
}

export default {
  getJobStatus,
  getStatusLabel,
  getStatusClass,
  formatDateForInput,
  formatDateForDisplay,
  loadJobs,
  saveJob,
  deleteJob,
  filterJobs,
  extractAreas,
  renderJobCardHtml,
  getFormData,
  populateForm,
  clearForm
};
