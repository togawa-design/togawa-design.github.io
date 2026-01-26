/**
 * 求人管理機能モジュール
 */
import { escapeHtml } from '@shared/utils.js';
import {
  generateIndeedXml,
  generateGoogleJobsJsonLd,
  generateJobBoxXml,
  generateCsv,
  downloadFile
} from '@features/admin/job-feed-generator.js';

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
let applicationsCache = [];
let reportData = null;

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
 * フィード生成用の求人データを準備
 */
function prepareJobsForFeed() {
  // 公開中の求人のみをフィルタリング
  return jobsCache.filter(job => {
    const isVisible = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;
    return isVisible && job.title;
  }).map(job => ({
    ...job,
    company: companyName,
    companyDomain: companyDomain,
    companyAddress: job.location || ''
  }));
}

/**
 * ローディング表示
 */
function showFeedLoading() {
  const feedStatus = document.getElementById('feed-status');
  if (feedStatus) feedStatus.style.display = 'flex';
}

function hideFeedLoading() {
  const feedStatus = document.getElementById('feed-status');
  if (feedStatus) feedStatus.style.display = 'none';
}

/**
 * Indeed XMLをダウンロード
 */
async function downloadIndeed() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const xml = generateIndeedXml(jobs);
    downloadFile(xml, `indeed-${companyDomain}.xml`, 'application/xml');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}

/**
 * Google JSON-LDをダウンロード
 */
async function downloadGoogle() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const jsonLd = generateGoogleJobsJsonLd(jobs);
    downloadFile(jsonLd, `google-jobs-${companyDomain}.json`, 'application/json');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}

/**
 * 求人ボックスXMLをダウンロード
 */
async function downloadJobbox() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const xml = generateJobBoxXml(jobs);
    downloadFile(xml, `jobbox-${companyDomain}.xml`, 'application/xml');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}

/**
 * CSVをダウンロード
 */
async function downloadCsvFeed() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const csv = generateCsv(jobs);
    downloadFile(csv, `jobs-${companyDomain}.csv`, 'text/csv;charset=utf-8');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}

// ========================================
// レポート機能
// ========================================

/**
 * レポート期間を計算
 */
function getReportPeriod(type) {
  const now = new Date();
  let start, end;

  switch (type) {
    case 'week': {
      // 今週（日曜始まり）
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last-week': {
      // 先週
      const dayOfWeek = now.getDay();
      end = new Date(now);
      end.setDate(now.getDate() - dayOfWeek - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month': {
      // 今月
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last-month': {
      // 先月
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
  }

  return { start, end };
}

/**
 * Firestoreから応募データを取得
 */
async function loadApplicationsData(startDate, endDate) {
  if (!companyDomain) return [];

  try {
    const db = firebase.firestore();
    const snapshot = await db.collection('applications')
      .where('companyDomain', '==', companyDomain)
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
    }));
  } catch (error) {
    console.error('応募データ取得エラー:', error);
    return [];
  }
}

/**
 * 前期間のデータを取得（比較用）
 */
async function loadComparisonData(currentStart, currentEnd) {
  const duration = currentEnd.getTime() - currentStart.getTime();
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);

  return await loadApplicationsData(prevStart, prevEnd);
}

/**
 * ステータス別に集計
 */
function aggregateByStatus(applications) {
  const statusMap = {
    'new': '新規',
    'contacted': '連絡済',
    'interviewing': '面接中',
    'hired': '採用',
    'rejected': '不採用',
    'withdrawn': '辞退'
  };

  const counts = {};
  Object.values(statusMap).forEach(label => {
    counts[label] = 0;
  });

  applications.forEach(app => {
    const status = app.status || 'new';
    const label = statusMap[status] || '新規';
    counts[label] = (counts[label] || 0) + 1;
  });

  const total = applications.length;
  return Object.entries(counts).map(([status, count]) => ({
    status,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  }));
}

/**
 * 求人別に集計
 */
function aggregateByJob(applications) {
  const jobCounts = {};

  applications.forEach(app => {
    const jobId = app.jobId || 'unknown';
    const jobTitle = app.jobTitle || '不明な求人';
    if (!jobCounts[jobId]) {
      jobCounts[jobId] = { jobId, jobTitle, count: 0 };
    }
    jobCounts[jobId].count++;
  });

  return Object.values(jobCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * 流入元別に集計
 */
function aggregateBySource(applications) {
  const sourceMap = {
    'google': 'Google検索',
    'indeed': 'Indeed',
    'jobbox': '求人ボックス',
    'direct': '直接流入',
    'line': 'LINE',
    'other': 'その他'
  };

  const counts = {};

  applications.forEach(app => {
    let source = app.source || app.utmSource || 'other';
    if (source.includes('google')) source = 'google';
    else if (source.includes('indeed')) source = 'indeed';
    else if (source.includes('jobbox') || source.includes('stanby')) source = 'jobbox';
    else if (source.includes('line')) source = 'line';
    else if (source === 'direct' || source === '(direct)') source = 'direct';
    else source = 'other';

    const label = sourceMap[source] || 'その他';
    counts[label] = (counts[label] || 0) + 1;
  });

  const total = applications.length;
  return Object.entries(counts)
    .map(([source, count]) => ({
      source,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 担当者別に集計
 */
function aggregateByAssignee(applications) {
  const assigneeCounts = {};

  applications.forEach(app => {
    const assignee = app.assignee || '未割当';
    if (!assigneeCounts[assignee]) {
      assigneeCounts[assignee] = { assignee, handled: 0, pending: 0 };
    }

    const status = app.status || 'new';
    if (status === 'new') {
      assigneeCounts[assignee].pending++;
    } else {
      assigneeCounts[assignee].handled++;
    }
  });

  return Object.values(assigneeCounts).sort((a, b) => b.handled - a.handled);
}

/**
 * レポートプレビューを表示
 */
function renderReportPreview(data) {
  const { applications, comparison, period } = data;

  // サマリー
  const total = applications.length;
  const prevTotal = comparison.length;
  const change = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
  const changeText = change >= 0 ? `+${change}%` : `${change}%`;

  const hired = applications.filter(a => a.status === 'hired').length;
  const pending = applications.filter(a => a.status === 'new' || a.status === 'contacted').length;

  document.getElementById('summary-total').textContent = total;
  document.getElementById('summary-change').textContent = changeText;
  document.getElementById('summary-change').className = `summary-value ${change >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('summary-hired').textContent = hired;
  document.getElementById('summary-pending').textContent = pending;

  // ステータス別
  const statusData = aggregateByStatus(applications);
  const statusTbody = document.getElementById('status-breakdown');
  statusTbody.innerHTML = statusData.map(item => `
    <tr>
      <td>${escapeHtml(item.status)}</td>
      <td>${item.count}</td>
      <td>${item.percentage}%</td>
    </tr>
  `).join('');

  // 求人別
  const jobData = aggregateByJob(applications);
  const jobTbody = document.getElementById('job-performance');
  if (jobData.length === 0) {
    jobTbody.innerHTML = '<tr><td colspan="4">データがありません</td></tr>';
  } else {
    jobTbody.innerHTML = jobData.map(item => {
      const job = jobsCache.find(j => j.id === item.jobId);
      const pv = job?.pageViews || '-';
      const cvr = pv && pv !== '-' && pv > 0 ? ((item.count / pv) * 100).toFixed(1) + '%' : '-';
      return `
        <tr>
          <td>${escapeHtml(item.jobTitle)}</td>
          <td>${item.count}</td>
          <td>${pv}</td>
          <td>${cvr}</td>
        </tr>
      `;
    }).join('');
  }

  // 流入元
  const sourceData = aggregateBySource(applications);
  const sourceTbody = document.getElementById('source-breakdown');
  if (sourceData.length === 0) {
    sourceTbody.innerHTML = '<tr><td colspan="3">データがありません</td></tr>';
  } else {
    sourceTbody.innerHTML = sourceData.map(item => `
      <tr>
        <td>${escapeHtml(item.source)}</td>
        <td>${item.count}</td>
        <td>${item.percentage}%</td>
      </tr>
    `).join('');
  }

  // 担当者別
  const assigneeData = aggregateByAssignee(applications);
  const assigneeTbody = document.getElementById('assignee-breakdown');
  if (assigneeData.length === 0) {
    assigneeTbody.innerHTML = '<tr><td colspan="3">データがありません</td></tr>';
  } else {
    assigneeTbody.innerHTML = assigneeData.map(item => `
      <tr>
        <td>${escapeHtml(item.assignee)}</td>
        <td>${item.handled}</td>
        <td>${item.pending}</td>
      </tr>
    `).join('');
  }

  // 表示切替
  document.getElementById('report-empty').style.display = 'none';
  document.getElementById('report-content').style.display = 'block';
  document.getElementById('report-actions').style.display = 'flex';
}

/**
 * レポート生成
 */
async function generateReport() {
  const periodSelect = document.getElementById('report-period');
  const periodType = periodSelect.value;

  let start, end;

  if (periodType === 'custom') {
    const fromInput = document.getElementById('report-from');
    const toInput = document.getElementById('report-to');

    if (!fromInput.value || !toInput.value) {
      alert('開始日と終了日を指定してください');
      return;
    }

    start = new Date(fromInput.value);
    start.setHours(0, 0, 0, 0);
    end = new Date(toInput.value);
    end.setHours(23, 59, 59, 999);
  } else {
    const period = getReportPeriod(periodType);
    start = period.start;
    end = period.end;
  }

  // ローディング表示
  document.getElementById('report-loading').style.display = 'flex';
  document.getElementById('report-empty').style.display = 'none';
  document.getElementById('report-content').style.display = 'none';
  document.getElementById('report-actions').style.display = 'none';

  try {
    const [applications, comparison] = await Promise.all([
      loadApplicationsData(start, end),
      loadComparisonData(start, end)
    ]);

    applicationsCache = applications;
    reportData = {
      applications,
      comparison,
      period: { start, end }
    };

    renderReportPreview(reportData);

  } catch (error) {
    console.error('レポート生成エラー:', error);
    alert('レポートの生成に失敗しました: ' + error.message);
  } finally {
    document.getElementById('report-loading').style.display = 'none';
  }
}

/**
 * レポートをCSVでダウンロード
 */
function downloadReportCsv() {
  if (!reportData || !reportData.applications.length) {
    alert('レポートデータがありません');
    return;
  }

  const { applications, period } = reportData;

  // ヘッダー行
  const headers = ['応募日時', '求人タイトル', '氏名', 'ステータス', '流入元', '担当者'];

  // データ行
  const rows = applications.map(app => [
    app.createdAt ? new Date(app.createdAt).toLocaleString('ja-JP') : '',
    app.jobTitle || '',
    app.name || '',
    app.status || 'new',
    app.source || app.utmSource || '',
    app.assignee || ''
  ]);

  // CSV生成
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const startStr = period.start.toISOString().split('T')[0];
  const endStr = period.end.toISOString().split('T')[0];
  a.download = `report-${companyDomain}-${startStr}-${endStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * レポートをExcelでダウンロード
 */
function downloadReportExcel() {
  if (!reportData || !reportData.applications.length) {
    alert('レポートデータがありません');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('Excelライブラリが読み込まれていません');
    return;
  }

  const { applications, period } = reportData;
  const wb = XLSX.utils.book_new();

  // サマリーシート
  const summaryData = [
    ['レポート期間', `${period.start.toLocaleDateString('ja-JP')} 〜 ${period.end.toLocaleDateString('ja-JP')}`],
    ['会社', companyName],
    [''],
    ['総応募数', applications.length],
    ['採用数', applications.filter(a => a.status === 'hired').length],
    ['対応中', applications.filter(a => a.status === 'new' || a.status === 'contacted').length]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'サマリー');

  // 応募一覧シート
  const appHeaders = ['応募日時', '求人タイトル', '氏名', '電話番号', 'メール', 'ステータス', '流入元', '担当者'];
  const appRows = applications.map(app => [
    app.createdAt ? new Date(app.createdAt).toLocaleString('ja-JP') : '',
    app.jobTitle || '',
    app.name || '',
    app.phone || '',
    app.email || '',
    app.status || 'new',
    app.source || app.utmSource || '',
    app.assignee || ''
  ]);
  const wsApps = XLSX.utils.aoa_to_sheet([appHeaders, ...appRows]);
  XLSX.utils.book_append_sheet(wb, wsApps, '応募一覧');

  // ステータス別シート
  const statusData = aggregateByStatus(applications);
  const statusHeaders = ['ステータス', '件数', '割合'];
  const statusRows = statusData.map(item => [item.status, item.count, `${item.percentage}%`]);
  const wsStatus = XLSX.utils.aoa_to_sheet([statusHeaders, ...statusRows]);
  XLSX.utils.book_append_sheet(wb, wsStatus, 'ステータス別');

  // 流入元別シート
  const sourceData = aggregateBySource(applications);
  const sourceHeaders = ['流入元', '件数', '割合'];
  const sourceRows = sourceData.map(item => [item.source, item.count, `${item.percentage}%`]);
  const wsSource = XLSX.utils.aoa_to_sheet([sourceHeaders, ...sourceRows]);
  XLSX.utils.book_append_sheet(wb, wsSource, '流入元別');

  // 担当者別シート
  const assigneeData = aggregateByAssignee(applications);
  const assigneeHeaders = ['担当者', '対応済', '未対応'];
  const assigneeRows = assigneeData.map(item => [item.assignee, item.handled, item.pending]);
  const wsAssignee = XLSX.utils.aoa_to_sheet([assigneeHeaders, ...assigneeRows]);
  XLSX.utils.book_append_sheet(wb, wsAssignee, '担当者別');

  // ダウンロード
  const startStr = period.start.toISOString().split('T')[0];
  const endStr = period.end.toISOString().split('T')[0];
  XLSX.writeFile(wb, `report-${companyDomain}-${startStr}-${endStr}.xlsx`);
}

/**
 * セクション切り替え
 */
function switchSection(sectionId) {
  // すべてのセクションを非表示
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });

  // すべてのナビアイテムを非アクティブ
  document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.classList.remove('active');
  });

  // 指定セクションを表示
  const targetSection = document.getElementById(`section-${sectionId}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // 対応するナビアイテムをアクティブ
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    if (a.dataset.section === sectionId) {
      a.closest('li').classList.add('active');
    }
  });

  // ページタイトル更新
  const pageTitle = document.getElementById('page-title');
  const headerActions = document.querySelector('.header-actions');

  if (sectionId === 'jobs') {
    if (pageTitle) pageTitle.textContent = `${companyName} の求人一覧`;
    if (headerActions) headerActions.style.display = 'flex';
  } else if (sectionId === 'reports') {
    if (pageTitle) pageTitle.textContent = '応募レポート';
    if (headerActions) headerActions.style.display = 'none';
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

  // フィードダウンロードボタン
  document.getElementById('btn-download-indeed')?.addEventListener('click', downloadIndeed);
  document.getElementById('btn-download-google')?.addEventListener('click', downloadGoogle);
  document.getElementById('btn-download-jobbox')?.addEventListener('click', downloadJobbox);
  document.getElementById('btn-download-csv')?.addEventListener('click', downloadCsvFeed);

  // サイドバーナビゲーション
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      const section = link.dataset.section;
      if (section && section !== 'back') {
        e.preventDefault();
        switchSection(section);
      }
    });
  });

  // レポート機能
  document.getElementById('report-period')?.addEventListener('change', (e) => {
    const customDates = document.getElementById('report-custom-dates');
    if (customDates) {
      customDates.style.display = e.target.value === 'custom' ? 'flex' : 'none';
    }
  });

  document.getElementById('btn-generate-report')?.addEventListener('click', generateReport);
  document.getElementById('btn-report-csv')?.addEventListener('click', downloadReportCsv);
  document.getElementById('btn-report-excel')?.addEventListener('click', downloadReportExcel);
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
