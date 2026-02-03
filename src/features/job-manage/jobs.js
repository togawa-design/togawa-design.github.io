/**
 * 求人管理 - 求人CRUD操作モジュール
 */
import { escapeHtml } from '@shared/utils.js';
import { fetchCompanyDetailData } from '@shared/analytics-utils.js';
import { config } from './auth.js';
import {
  companyDomain,
  companyName,
  sheetUrl,
  setSheetUrl,
  jobsCache,
  setJobsCache,
  currentEditingJob,
  setCurrentEditingJob,
  isNewJob,
  setIsNewJob,
  jobStatsCache,
  setJobStatsCache,
  jobFilters,
  getNewAbortController,
  clearAbortController
} from './state.js';

// 共通サービス
import {
  getJobStatus as getJobStatusBase,
  formatDateForInput
} from '@shared/job-service.js';

// 求人編集共通ユーティリティ
import {
  updateDisplayedFeaturesContainer as updateDisplayedFeaturesContainerBase,
  setupFeaturesCheckboxEvents as setupFeaturesCheckboxEventsBase
} from '@shared/job-edit-utils.js';

/**
 * 求人のステータスを判定（後方互換: 'active' を 'published' として返す）
 */
export function getJobStatus(job) {
  const status = getJobStatusBase(job);
  return status === 'active' ? 'published' : status;
}

/**
 * フィルターを適用して求人をフィルタリング
 */
export function filterJobs(jobs) {
  return jobs.filter(job => {
    // 検索フィルター
    if (jobFilters.search) {
      const searchLower = jobFilters.search.toLowerCase();
      const title = (job.title || '').toLowerCase();
      const location = (job.location || '').toLowerCase();
      if (!title.includes(searchLower) && !location.includes(searchLower)) {
        return false;
      }
    }

    // ステータスフィルター
    if (jobFilters.status) {
      const status = getJobStatus(job);
      if (status !== jobFilters.status) {
        return false;
      }
    }

    // エリアフィルター
    if (jobFilters.area) {
      const location = job.location || '';
      if (!location.includes(jobFilters.area)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * エリアドロップダウンを更新
 */
export function updateAreaDropdown() {
  const select = document.getElementById('job-filter-area');
  if (!select) return;

  const areas = new Set();
  (jobsCache || []).forEach(job => {
    if (job.location) {
      const match = job.location.match(/^(.+?[都道府県])/);
      if (match) {
        areas.add(match[1]);
      } else {
        areas.add(job.location.split(/[市区町村]/)[0]);
      }
    }
  });

  const currentValue = select.value;

  select.innerHTML = '<option value="">全エリア</option>';
  Array.from(areas).sort().forEach(area => {
    const option = document.createElement('option');
    option.value = area;
    option.textContent = area;
    select.appendChild(option);
  });

  select.value = currentValue;
}

/**
 * 求人カード一覧を描画
 */
export function renderJobsTable() {
  const listContainer = document.getElementById('jobs-list');
  const countEl = document.getElementById('jobs-count');
  const filteredCountEl = document.getElementById('jobs-filtered-count');

  const tbody = document.getElementById('jobs-tbody');
  if (tbody && !listContainer) {
    renderJobsTableLegacy();
    return;
  }

  if (!listContainer) return;

  const allJobs = jobsCache || [];
  const jobs = filterJobs(allJobs);

  if (countEl) {
    countEl.textContent = allJobs.length;
  }

  if (filteredCountEl) {
    if (jobs.length !== allJobs.length) {
      filteredCountEl.textContent = `（${jobs.length}件表示中）`;
    } else {
      filteredCountEl.textContent = '';
    }
  }

  updateAreaDropdown();

  if (jobs.length === 0) {
    const hasFilters = jobFilters.search || jobFilters.status || jobFilters.area;
    listContainer.innerHTML = `<div class="job-cards-loading">${hasFilters ? '条件に一致する求人がありません' : '求人データがありません'}</div>`;
    return;
  }

  listContainer.innerHTML = jobs.map(job => {
    const isVisible = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;
    const imageUrl = job.imageUrl?.trim() || '';

    const badges = job.badges ? job.badges.split(',').map(b => b.trim()).filter(b => b) : [];
    const tagsHtml = badges.map(badge => {
      const isUrgent = badge === '急募';
      return `<span class="job-card-tag${isUrgent ? ' urgent' : ''}">${escapeHtml(badge)}</span>`;
    }).join('');

    let deadlineHtml = '-';
    let deadlineClass = '';
    if (job.publishEndDate) {
      const endDate = new Date(job.publishEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      const formattedDate = `${String(endDate.getFullYear()).slice(2)}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${String(endDate.getDate()).padStart(2, '0')}`;
      deadlineHtml = formattedDate;

      if (daysLeft < 0) {
        deadlineClass = ' expired';
      } else if (daysLeft <= 7) {
        deadlineClass = ' soon';
      }
    }

    let statusBadge = '';
    if (!isVisible) {
      statusBadge = '<span class="badge draft">非公開</span>';
    } else if (deadlineClass === ' expired') {
      statusBadge = '<span class="badge expired">掲載終了</span>';
    } else {
      statusBadge = '<span class="badge published">公開中</span>';
    }

    const stats = jobStatsCache[job.id] || {};
    const applications = stats.applications || 0;
    const pv = stats.pv || 0;

    return `
      <div class="job-card-row" data-row="${job._rowIndex}">
        <div class="job-card-image">
          ${imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'job-card-image-placeholder\\'>📋</div>'">`
            : '<div class="job-card-image-placeholder">📋</div>'
          }
        </div>
        <div class="job-card-info">
          <div class="job-card-title">${escapeHtml(job.title || '-')}</div>
          <div class="job-card-tags">${tagsHtml}</div>
        </div>
        <div class="job-card-type">${escapeHtml(job.jobType || '-')}</div>
        <div class="job-card-area">${escapeHtml(job.location || '-')}</div>
        <div class="job-card-deadline${deadlineClass}">${deadlineHtml}</div>
        <div class="job-card-stats">${applications}</div>
        <div class="job-card-stats">${pv}</div>
        <div class="job-card-status">${statusBadge}</div>
        <div class="job-card-actions">
          <button class="btn-icon btn-edit" data-row="${job._rowIndex}" title="編集">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="btn-icon btn-duplicate" data-row="${job._rowIndex}" title="複製">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  listContainer.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowIndex = parseInt(btn.dataset.row, 10);
      editJob(rowIndex);
    });
  });

  listContainer.querySelectorAll('.btn-duplicate').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowIndex = parseInt(btn.dataset.row, 10);
      duplicateJob(rowIndex);
    });
  });
}

/**
 * 旧テーブル形式での描画（フォールバック用）
 */
function renderJobsTableLegacy() {
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
export async function loadJobsData() {
  const listContainer = document.getElementById('jobs-list');
  const tbody = document.getElementById('jobs-tbody');

  if (!listContainer && !tbody) return;

  if (listContainer) {
    listContainer.innerHTML = '<div class="job-cards-loading">データを読み込み中...</div>';
  }
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';
  }

  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    const errorMsg = 'GAS API URLが設定されていません。<a href="admin.html">管理画面</a>の設定から設定してください。';
    if (listContainer) {
      listContainer.innerHTML = `<div class="job-cards-loading">${errorMsg}</div>`;
    }
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">${errorMsg}</td></tr>`;
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

    if (result.sheetUrl && !sheetUrl) {
      setSheetUrl(result.sheetUrl);
    }
    if (result.manageSheetUrl && !sheetUrl) {
      setSheetUrl(result.manageSheetUrl);
    }

    if (jobsCache.length === 0) {
      if (listContainer) {
        listContainer.innerHTML = '<div class="job-cards-loading">求人データがありません</div>';
      }
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">求人データがありません</td></tr>';
      }
      const countEl = document.getElementById('jobs-count');
      if (countEl) countEl.textContent = '0';
      return;
    }

    renderJobsTable();
    loadJobStats();

    // 正常完了時にAbortControllerをクリア
    clearAbortController();

  } catch (error) {
    // キャンセルされた場合は無視
    if (error.name === 'AbortError') {
      console.log('[JobManage] リクエストがキャンセルされました');
      return;
    }
    console.error('求人データの読み込みエラー:', error);
    const errorMsg = `データの読み込みに失敗しました: ${escapeHtml(error.message)}`;
    if (listContainer) {
      listContainer.innerHTML = `<div class="job-cards-loading">${errorMsg}</div>`;
    }
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">${errorMsg}</td></tr>`;
    }
  }
}

/**
 * 求人ごとの統計データを読み込み（応募数、PV）
 */
async function loadJobStats() {
  if (!companyDomain) return;

  try {
    const db = firebase.firestore();
    const applicationsSnapshot = await db.collection('applications')
      .where('companyDomain', '==', companyDomain)
      .get();

    const applicationCounts = {};
    applicationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const jobId = data.jobId || data.job_id || '';
      if (jobId) {
        applicationCounts[jobId] = (applicationCounts[jobId] || 0) + 1;
      }
    });

    let jobPVs = {};

    try {
      const pvData = await fetchCompanyDetailData(companyDomain, 30);

      if (pvData?.jobs) {
        pvData.jobs.forEach(job => {
          const pagePath = job.pagePath || '';
          const match = pagePath.match(/job=([^&]+)/);
          if (match) {
            const jobId = decodeURIComponent(match[1]);
            jobPVs[jobId] = (jobPVs[jobId] || 0) + (job.views || 0);
          }
          if (job.jobId) {
            jobPVs[job.jobId] = (jobPVs[job.jobId] || 0) + (job.views || 0);
          }
        });
      } else if (pvData?.jobStats) {
        pvData.jobStats.forEach(stat => {
          const jobId = stat.jobId || stat.id || '';
          if (jobId) {
            jobPVs[jobId] = stat.pageViews || stat.views || 0;
          }
        });
      } else if (pvData?.pages) {
        pvData.pages.forEach(page => {
          const match = page.pagePath?.match(/job=([^&]+)/);
          if (match) {
            const jobId = decodeURIComponent(match[1]);
            jobPVs[jobId] = (jobPVs[jobId] || 0) + (page.views || page.pageViews || 0);
          }
        });
      }
    } catch (analyticsError) {
      console.warn('Analytics APIからのPV取得に失敗:', analyticsError);
    }

    const newJobStatsCache = {};
    const allJobIds = new Set([...Object.keys(applicationCounts), ...Object.keys(jobPVs)]);
    allJobIds.forEach(jobId => {
      newJobStatsCache[jobId] = {
        applications: applicationCounts[jobId] || 0,
        pv: jobPVs[jobId] || 0
      };
    });

    setJobStatsCache(newJobStatsCache);
    renderJobsTable();

  } catch (error) {
    console.error('求人統計データの取得エラー:', error);
  }
}

/**
 * 求人編集セクションに切り替え（新規）
 */
export function showJobModal() {
  setCurrentEditingJob(null);
  setIsNewJob(true);

  // セクション形式のフォームをクリア
  clearSectionForm();

  // タイトル・バッジ更新
  const titleEl = document.getElementById('job-edit-title');
  const badgeEl = document.getElementById('job-edit-badge');
  if (titleEl) titleEl.textContent = '新規求人作成';
  if (badgeEl) {
    badgeEl.textContent = '新規';
    badgeEl.classList.remove('edit');
  }

  // 削除ボタンを非表示
  const deleteBtn = document.getElementById('job-edit-delete-btn');
  if (deleteBtn) deleteBtn.style.display = 'none';

  // セクション切り替え
  switchToJobEditSection();
}

/**
 * セクションフォームをクリア
 */
function clearSectionForm() {
  const fields = ['memo', 'title', 'employment-type', 'location', 'salary', 'bonus', 'order', 'type', 'features',
                  'description', 'requirements', 'benefits',
                  'holidays', 'start-date', 'end-date'];

  fields.forEach(field => {
    const el = document.getElementById(`edit-job-${field}-section`);
    if (el) el.value = '';
  });

  const visibleEl = document.getElementById('edit-job-visible-section');
  if (visibleEl) visibleEl.checked = true;

  // 給与形態をクリア
  const salaryTypeEl = document.getElementById('edit-job-salary-type-section');
  if (salaryTypeEl) salaryTypeEl.value = '';
  const salaryOtherEl = document.getElementById('edit-job-salary-other-section');
  if (salaryOtherEl) salaryOtherEl.value = '';
  const salaryOtherGroup = document.getElementById('salary-other-group');
  if (salaryOtherGroup) salaryOtherGroup.style.display = 'none';

  // 勤務時間リストをクリア（1つの空フィールドに戻す）
  const workingHoursList = document.getElementById('working-hours-list');
  if (workingHoursList) {
    workingHoursList.innerHTML = `
      <div class="multi-input-item">
        <input type="text" class="working-hours-input" placeholder="例: 8:00〜17:00">
        <button type="button" class="btn-remove-item" title="削除">×</button>
      </div>
    `;
    setupWorkingHoursRemoveButtons();
  }

  // 特徴チェックボックスをクリア
  document.querySelectorAll('#features-checkbox-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // 表示する特徴をクリア
  const displayedFeaturesContainer = document.getElementById('displayed-features-container');
  if (displayedFeaturesContainer) {
    displayedFeaturesContainer.innerHTML = '<div class="displayed-features-empty">上記から特徴を選択すると、ここに表示されます</div>';
  }
}

/**
 * セクションフォームに値をセット
 */
function populateSectionForm(job) {
  const setVal = (id, val) => {
    const el = document.getElementById(`edit-job-${id}-section`);
    if (el) el.value = val || '';
  };

  setVal('memo', job.memo);
  setVal('title', job.title);
  setVal('employment-type', job.employmentType);
  setVal('location', job.location);
  setVal('access', job.access);
  setVal('bonus', job.totalBonus);
  setVal('order', job.order);
  setVal('type', job.jobType);
  setVal('description', job.jobDescription);
  setVal('requirements', job.requirements);
  setVal('benefits', job.benefits);
  setVal('holidays', job.holidays);
  setVal('start-date', formatDateForInput(job.publishStartDate));
  setVal('end-date', formatDateForInput(job.publishEndDate));

  // 給与形態を設定
  const salaryTypeEl = document.getElementById('edit-job-salary-type-section');
  const salaryEl = document.getElementById('edit-job-salary-section');
  const salaryOtherEl = document.getElementById('edit-job-salary-other-section');
  const salaryOtherGroup = document.getElementById('salary-other-group');

  if (salaryTypeEl) {
    // salaryType があれば使用、なければ monthlySalary から推測
    if (job.salaryType) {
      salaryTypeEl.value = job.salaryType;
    } else if (job.monthlySalary) {
      // 既存データの場合、月給として設定
      salaryTypeEl.value = '月給';
    } else {
      salaryTypeEl.value = '';
    }
  }

  if (salaryEl) {
    salaryEl.value = job.monthlySalary || '';
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

  // 勤務時間を複数入力に対応
  const workingHoursList = document.getElementById('working-hours-list');
  if (workingHoursList) {
    const hoursData = job.workingHours || '';
    // 「|」または改行で分割
    const hoursArray = hoursData.split(/[|\n]/).map(h => h.trim()).filter(h => h);

    if (hoursArray.length === 0) {
      hoursArray.push(''); // 空でも1つのフィールドを表示
    }

    workingHoursList.innerHTML = hoursArray.map(hour => `
      <div class="multi-input-item">
        <input type="text" class="working-hours-input" placeholder="例: 8:00〜17:00" value="${escapeHtml(hour)}">
        <button type="button" class="btn-remove-item" title="削除">×</button>
      </div>
    `).join('');
    setupWorkingHoursRemoveButtons();
  }

  // 特徴チェックボックスを設定
  const featuresData = job.features || '';
  const featuresArray = featuresData.split(',').map(f => f.trim()).filter(f => f);

  // まず全てのチェックを外す
  document.querySelectorAll('#features-checkbox-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // 該当するものをチェック
  featuresArray.forEach(feature => {
    const cb = document.querySelector(`#features-checkbox-grid input[value="${feature}"]`);
    if (cb) {
      cb.checked = true;
    }
  });

  // hidden フィールドにも設定
  setVal('features', job.features);

  // 表示する特徴を設定
  const displayedFeaturesData = job.displayedFeatures || '';
  const displayedFeaturesString = typeof displayedFeaturesData === 'string' ? displayedFeaturesData : String(displayedFeaturesData);
  const displayedFeaturesArray = displayedFeaturesString.split(',').map(f => f.trim()).filter(f => f);
  updateDisplayedFeaturesContainer(featuresArray, displayedFeaturesArray);

  const visibleEl = document.getElementById('edit-job-visible-section');
  if (visibleEl) {
    visibleEl.checked = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;
  }
}

/**
 * job-editセクションに切り替え
 */
function switchToJobEditSection() {
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });

  const targetSection = document.getElementById('section-job-edit');
  if (targetSection) {
    targetSection.classList.add('active');
  }

  const pageTitle = document.getElementById('page-title');
  const headerActions = document.querySelector('.header-actions');
  if (pageTitle) pageTitle.textContent = '求人編集';
  if (headerActions) headerActions.style.display = 'none';
}

/**
 * 求人編集セクションに切り替え（編集）
 */
export function editJob(rowIndex) {
  const job = jobsCache?.find(j => j._rowIndex === rowIndex);
  if (!job) {
    alert('求人データが見つかりません');
    return;
  }

  setCurrentEditingJob(job);
  setIsNewJob(false);

  // セクション形式のフォームに値をセット
  populateSectionForm(job);

  // タイトル・バッジ更新
  const titleEl = document.getElementById('job-edit-title');
  const badgeEl = document.getElementById('job-edit-badge');
  if (titleEl) titleEl.textContent = job.title || '求人編集';
  if (badgeEl) {
    badgeEl.textContent = '編集';
    badgeEl.classList.add('edit');
  }

  // 削除ボタンを表示
  const deleteBtn = document.getElementById('job-edit-delete-btn');
  if (deleteBtn) deleteBtn.style.display = '';

  // セクション切り替え
  switchToJobEditSection();
}

/**
 * 求人を複製（セクション方式）
 */
export function duplicateJob(rowIndex) {
  const job = jobsCache?.find(j => j._rowIndex === rowIndex);
  if (!job) {
    alert('求人データが見つかりません');
    return;
  }

  setCurrentEditingJob(null);
  setIsNewJob(true);

  // セクション形式のフォームに値をセット（タイトルに「(コピー)」追加）
  const duplicatedJob = { ...job, title: `${job.title || ''} (コピー)` };
  populateSectionForm(duplicatedJob);

  // 掲載期間はクリア
  const startDateEl = document.getElementById('edit-job-start-date-section');
  const endDateEl = document.getElementById('edit-job-end-date-section');
  if (startDateEl) startDateEl.value = '';
  if (endDateEl) endDateEl.value = '';

  // 非公開にする
  const visibleEl = document.getElementById('edit-job-visible-section');
  if (visibleEl) visibleEl.checked = false;

  // タイトル・バッジ更新
  const titleEl = document.getElementById('job-edit-title');
  const badgeEl = document.getElementById('job-edit-badge');
  if (titleEl) titleEl.textContent = '求人の複製';
  if (badgeEl) {
    badgeEl.textContent = '複製';
    badgeEl.classList.remove('edit');
  }

  // 削除ボタンを非表示
  const deleteBtn = document.getElementById('job-edit-delete-btn');
  if (deleteBtn) deleteBtn.style.display = 'none';

  // セクション切り替え
  switchToJobEditSection();
}

/**
 * 求人編集セクションを閉じて求人一覧に戻る
 */
export function closeJobModal() {
  setCurrentEditingJob(null);
  setIsNewJob(false);

  // 求人一覧セクションに戻る
  if (window.switchToJobsSection) {
    window.switchToJobsSection();
  } else {
    // フォールバック
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });
    const jobsSection = document.getElementById('section-jobs');
    if (jobsSection) {
      jobsSection.classList.add('active');
    }
    const pageTitle = document.getElementById('page-title');
    const headerActions = document.querySelector('.header-actions');
    if (pageTitle) pageTitle.textContent = '求人一覧';
    if (headerActions) headerActions.style.display = 'flex';
  }
}

/**
 * 求人データを保存
 */
export async function saveJobData() {
  if (!companyDomain) {
    alert('会社が選択されていません');
    return;
  }

  // セクション形式のフォームからデータを取得
  const getVal = (id) => document.getElementById(`edit-job-${id}-section`)?.value?.trim() || '';

  // 給与形態の取得
  const salaryType = getVal('salary-type');
  const salaryValue = getVal('salary');
  const salaryOther = getVal('salary-other');

  // 勤務時間の取得（複数入力から）
  const workingHoursInputs = document.querySelectorAll('#working-hours-list .working-hours-input');
  const workingHoursArray = Array.from(workingHoursInputs)
    .map(input => input.value.trim())
    .filter(v => v);
  const workingHours = workingHoursArray.join(' | ');

  // 特徴の取得（チェックボックスから）
  const featuresCheckboxes = document.querySelectorAll('#features-checkbox-grid input[type="checkbox"]:checked');
  const featuresArray = Array.from(featuresCheckboxes).map(cb => cb.value);
  const features = featuresArray.join(',');

  // 表示する特徴の取得
  const displayedFeaturesCheckboxes = document.querySelectorAll('#displayed-features-container input[type="checkbox"]:checked');
  const displayedFeaturesArray = Array.from(displayedFeaturesCheckboxes).map(cb => cb.value);
  const displayedFeatures = displayedFeaturesArray.join(',');

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
    visible: document.getElementById('edit-job-visible-section')?.checked ? 'true' : 'false'
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

  const saveBtn = document.getElementById('job-edit-save-btn');

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
export async function deleteJob() {
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

  const deleteBtn = document.getElementById('job-edit-delete-btn');

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
 * 勤務時間の削除ボタンにイベントを設定
 */
function setupWorkingHoursRemoveButtons() {
  const container = document.getElementById('working-hours-list');
  if (!container) return;

  container.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const items = container.querySelectorAll('.multi-input-item');
      // 最後の1つは削除しない
      if (items.length > 1) {
        btn.closest('.multi-input-item').remove();
      }
    });
  });
}

/**
 * 勤務時間を追加
 */
function addWorkingHoursItem() {
  const container = document.getElementById('working-hours-list');
  if (!container) return;

  const newItem = document.createElement('div');
  newItem.className = 'multi-input-item';
  newItem.innerHTML = `
    <input type="text" class="working-hours-input" placeholder="例: 8:00〜17:00">
    <button type="button" class="btn-remove-item" title="削除">×</button>
  `;

  container.appendChild(newItem);

  // 新しい削除ボタンにイベントを設定
  const removeBtn = newItem.querySelector('.btn-remove-item');
  removeBtn.addEventListener('click', () => {
    const items = container.querySelectorAll('.multi-input-item');
    if (items.length > 1) {
      newItem.remove();
    }
  });

  // 新しい入力フィールドにフォーカス
  newItem.querySelector('input').focus();
}

/**
 * 給与形態変更時の処理
 */
function handleSalaryTypeChange() {
  const salaryTypeEl = document.getElementById('edit-job-salary-type-section');
  const salaryOtherGroup = document.getElementById('salary-other-group');

  if (!salaryTypeEl || !salaryOtherGroup) return;

  if (salaryTypeEl.value === 'その他') {
    salaryOtherGroup.style.display = 'block';
  } else {
    salaryOtherGroup.style.display = 'none';
  }
}

// job-manage.html用の設定定数
const DISPLAYED_FEATURES_CONFIG = {
  containerId: 'displayed-features-container',
  featuresGridId: 'features-checkbox-grid',
  checkboxName: 'displayed-features',
  onWarning: (msg) => alert(msg)
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
 * 求人編集フォームのイベントハンドラを設定
 */
export function setupJobEditEventHandlers() {
  // 給与形態の変更イベント
  const salaryTypeEl = document.getElementById('edit-job-salary-type-section');
  if (salaryTypeEl) {
    salaryTypeEl.addEventListener('change', handleSalaryTypeChange);
  }

  // 勤務時間追加ボタン
  const addHoursBtn = document.getElementById('btn-add-working-hours');
  if (addHoursBtn) {
    addHoursBtn.addEventListener('click', addWorkingHoursItem);
  }

  // 既存の勤務時間削除ボタン
  setupWorkingHoursRemoveButtons();

  // 特徴チェックボックスの変更監視
  setupFeaturesCheckboxEvents();
}
