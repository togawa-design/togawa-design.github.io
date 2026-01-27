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
import { initApplicantsSection, loadApplicantsData } from '@features/applicants/index.js';

// 設定
const config = {
  gasApiUrl: 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec',
  firebaseConfig: {
    apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
    authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
    projectId: "generated-area-484613-e3-90bd4"
  },
  sessionKey: 'rikueco_admin_session',
  userRoleKey: 'rikueco_user_role',
  userCompanyKey: 'rikueco_user_company'
};

// ユーザーロール定義
const USER_ROLES = {
  ADMIN: 'admin',
  COMPANY: 'company'
};

/**
 * セッション確認
 */
function checkSession() {
  return !!sessionStorage.getItem(config.sessionKey);
}

/**
 * ユーザーロール取得
 */
function getUserRole() {
  return sessionStorage.getItem(config.userRoleKey);
}

/**
 * ユーザーの所属会社ドメイン取得
 */
function getUserCompanyDomain() {
  return sessionStorage.getItem(config.userCompanyKey);
}

/**
 * 管理者かどうか
 */
function isAdmin() {
  return getUserRole() === USER_ROLES.ADMIN;
}

/**
 * 特定の会社へのアクセス権限があるか
 */
function hasAccessToCompany(domain) {
  if (isAdmin()) return true;
  return getUserCompanyDomain() === domain;
}

/**
 * ログアウト処理
 */
function handleLogout() {
  sessionStorage.removeItem(config.sessionKey);
  sessionStorage.removeItem(config.userRoleKey);
  sessionStorage.removeItem(config.userCompanyKey);
  sessionStorage.removeItem('auth_method');
  sessionStorage.removeItem('company_user_id');

  // Firebaseからもサインアウト
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut();
  }
}

/**
 * Firebase初期化
 */
function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('[JobManager] Firebase not loaded');
    return false;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(config.firebaseConfig);
  }
  return true;
}

// 状態
let companyDomain = null;
let companyName = null;
let sheetUrl = null;
let jobsCache = [];
let currentEditingJob = null;
let isNewJob = false;
let applicationsCache = [];
let reportData = null;
let analyticsCache = null;

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
// アクセス解析機能
// ========================================

/**
 * アクセス解析の期間を計算
 */
function getAnalyticsPeriod(type) {
  const now = new Date();
  let start, end;

  switch (type) {
    case '7days': {
      end = new Date(now);
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      break;
    }
    case '30days': {
      end = new Date(now);
      start = new Date(now);
      start.setDate(now.getDate() - 29);
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
      break;
    }
    case 'last-month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    }
    default:
      end = new Date(now);
      start = new Date(now);
      start.setDate(now.getDate() - 6);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * 秒数を読みやすい形式に変換
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}分${secs}秒`;
  }
  return `${secs}秒`;
}

/**
 * Cloud Functions（GA4 API）からアクセス解析データを取得
 */
async function loadAnalyticsData() {
  const periodSelect = document.getElementById('analytics-period');
  const periodType = periodSelect?.value || '7days';

  // 日数を計算
  let days = 7;
  switch (periodType) {
    case '7days': days = 7; break;
    case '30days': days = 30; break;
    case 'month': {
      const now = new Date();
      days = now.getDate();
      break;
    }
    case 'last-month': days = 30; break;
  }

  // ローディング表示
  const jobTbody = document.getElementById('job-analytics-tbody');
  const sourceTbody = document.getElementById('source-analytics-tbody');
  const deviceTbody = document.getElementById('device-analytics-tbody');

  if (jobTbody) jobTbody.innerHTML = '<tr><td colspan="5" class="loading-cell">データを読み込み中...</td></tr>';
  if (sourceTbody) sourceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">読み込み中...</td></tr>';
  if (deviceTbody) deviceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">読み込み中...</td></tr>';

  try {
    const apiEndpoint = 'https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/getAnalyticsData';

    // 概要データを取得
    const overviewRes = await fetch(`${apiEndpoint}?type=overview&days=${days}`);
    const overviewData = await overviewRes.json();

    // 流入元データを取得
    const trafficRes = await fetch(`${apiEndpoint}?type=traffic&days=${days}`);
    const trafficData = await trafficRes.json();

    // 会社別詳細データを取得（company_domainがある場合）
    let companyDetailData = null;
    if (companyDomain) {
      const companyRes = await fetch(`${apiEndpoint}?type=company-detail&days=${days}&domain=${encodeURIComponent(companyDomain)}`);
      companyDetailData = await companyRes.json();
    }

    if (!overviewData.success) {
      throw new Error(overviewData.error || 'データ取得エラー');
    }

    analyticsCache = {
      overview: overviewData.data,
      traffic: trafficData.data,
      companyDetail: companyDetailData?.data
    };

    renderGA4AnalyticsData(analyticsCache);

  } catch (error) {
    console.error('アクセス解析データ取得エラー:', error);
    renderAnalyticsDemo();
  }
}

/**
 * デモデータを表示（データがない場合）
 */
function renderAnalyticsDemo() {
  // サマリー
  document.getElementById('analytics-pv').textContent = '- (未連携)';
  document.getElementById('analytics-users').textContent = '-';
  document.getElementById('analytics-pages-per-session').textContent = '-';
  document.getElementById('analytics-avg-time').textContent = '-';

  // 求人別
  const jobTbody = document.getElementById('job-analytics-tbody');
  if (jobTbody) {
    jobTbody.innerHTML = `
      <tr>
        <td colspan="5" class="loading-cell">
          アクセス解析データがありません。<br>
          Google Analyticsとの連携を設定すると、詳細なアクセスデータを確認できます。
        </td>
      </tr>
    `;
  }

  // 流入元
  const sourceTbody = document.getElementById('source-analytics-tbody');
  if (sourceTbody) {
    sourceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データなし</td></tr>';
  }

  // デバイス
  const deviceTbody = document.getElementById('device-analytics-tbody');
  if (deviceTbody) {
    deviceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データなし</td></tr>';
  }
}

/**
 * アクセス解析データを描画
 */
function renderAnalyticsData(pageviews) {
  // サマリー計算
  const totalPV = pageviews.length;
  const uniqueUsers = new Set(pageviews.map(pv => pv.userId || pv.sessionId)).size;
  const sessions = new Set(pageviews.map(pv => pv.sessionId)).size;
  const pagesPerSession = sessions > 0 ? (totalPV / sessions).toFixed(1) : '-';

  // 平均滞在時間の計算（仮）
  const avgTime = pageviews.reduce((acc, pv) => acc + (pv.duration || 0), 0) / totalPV;

  document.getElementById('analytics-pv').textContent = totalPV.toLocaleString();
  document.getElementById('analytics-users').textContent = uniqueUsers.toLocaleString();
  document.getElementById('analytics-pages-per-session').textContent = pagesPerSession;
  document.getElementById('analytics-avg-time').textContent = formatDuration(avgTime);

  // 求人別集計
  const jobStats = {};
  pageviews.forEach(pv => {
    const jobId = pv.jobId || 'unknown';
    const jobTitle = pv.jobTitle || pv.pagePath || '不明';
    if (!jobStats[jobId]) {
      jobStats[jobId] = { jobTitle, pv: 0, users: new Set(), bounces: 0, totalDuration: 0 };
    }
    jobStats[jobId].pv++;
    jobStats[jobId].users.add(pv.userId || pv.sessionId);
    if (pv.bounce) jobStats[jobId].bounces++;
    jobStats[jobId].totalDuration += pv.duration || 0;
  });

  const jobData = Object.values(jobStats)
    .map(item => ({
      ...item,
      users: item.users.size,
      bounceRate: item.pv > 0 ? Math.round((item.bounces / item.pv) * 100) : 0,
      avgDuration: item.pv > 0 ? item.totalDuration / item.pv : 0
    }))
    .sort((a, b) => b.pv - a.pv)
    .slice(0, 10);

  const jobTbody = document.getElementById('job-analytics-tbody');
  if (jobTbody) {
    if (jobData.length === 0) {
      jobTbody.innerHTML = '<tr><td colspan="5" class="loading-cell">データがありません</td></tr>';
    } else {
      jobTbody.innerHTML = jobData.map(item => `
        <tr>
          <td>${escapeHtml(item.jobTitle)}</td>
          <td>${item.pv}</td>
          <td>${item.users}</td>
          <td>${item.bounceRate}%</td>
          <td>${formatDuration(item.avgDuration)}</td>
        </tr>
      `).join('');
    }
  }

  // 流入元別集計
  const sourceStats = {};
  pageviews.forEach(pv => {
    let source = pv.source || pv.utmSource || pv.referrer || 'direct';
    if (source.includes('google')) source = 'Google検索';
    else if (source.includes('indeed')) source = 'Indeed';
    else if (source.includes('jobbox') || source.includes('stanby')) source = '求人ボックス';
    else if (source.includes('line')) source = 'LINE';
    else if (source === 'direct' || source === '(direct)' || !source) source = '直接流入';
    else source = 'その他';

    sourceStats[source] = (sourceStats[source] || 0) + 1;
  });

  const sourceData = Object.entries(sourceStats)
    .map(([source, count]) => ({
      source,
      count,
      percentage: totalPV > 0 ? Math.round((count / totalPV) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  const sourceTbody = document.getElementById('source-analytics-tbody');
  if (sourceTbody) {
    if (sourceData.length === 0) {
      sourceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データがありません</td></tr>';
    } else {
      sourceTbody.innerHTML = sourceData.map(item => `
        <tr>
          <td>${escapeHtml(item.source)}</td>
          <td>${item.count}</td>
          <td>${item.percentage}%</td>
        </tr>
      `).join('');
    }
  }

  // デバイス別集計
  const deviceStats = {};
  pageviews.forEach(pv => {
    let device = pv.device || pv.deviceCategory || 'unknown';
    if (device === 'mobile' || device.includes('mobile')) device = 'モバイル';
    else if (device === 'desktop' || device.includes('desktop')) device = 'デスクトップ';
    else if (device === 'tablet' || device.includes('tablet')) device = 'タブレット';
    else device = 'その他';

    deviceStats[device] = (deviceStats[device] || 0) + 1;
  });

  const deviceData = Object.entries(deviceStats)
    .map(([device, count]) => ({
      device,
      count,
      percentage: totalPV > 0 ? Math.round((count / totalPV) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  const deviceTbody = document.getElementById('device-analytics-tbody');
  if (deviceTbody) {
    if (deviceData.length === 0) {
      deviceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データがありません</td></tr>';
    } else {
      deviceTbody.innerHTML = deviceData.map(item => `
        <tr>
          <td>${escapeHtml(item.device)}</td>
          <td>${item.count}</td>
          <td>${item.percentage}%</td>
        </tr>
      `).join('');
    }
  }
}

/**
 * GA4 APIデータを描画
 */
function renderGA4AnalyticsData(data) {
  const { overview, traffic, companyDetail } = data;

  // サマリー
  document.getElementById('analytics-pv').textContent = (overview?.pageViews || 0).toLocaleString();
  document.getElementById('analytics-users').textContent = (overview?.users || 0).toLocaleString();

  const sessions = overview?.sessions || 0;
  const pageViews = overview?.pageViews || 0;
  const pagesPerSession = sessions > 0 ? (pageViews / sessions).toFixed(1) : '-';
  document.getElementById('analytics-pages-per-session').textContent = pagesPerSession;
  document.getElementById('analytics-avg-time').textContent = '-'; // GA4 APIでは取得が複雑

  // 求人別アクセス
  const jobTbody = document.getElementById('job-analytics-tbody');
  if (jobTbody) {
    if (companyDetail?.jobs && companyDetail.jobs.length > 0) {
      jobTbody.innerHTML = companyDetail.jobs.map(item => `
        <tr>
          <td>${escapeHtml(item.jobTitle || item.pagePath || '不明')}</td>
          <td>${item.views || 0}</td>
          <td>${item.users || '-'}</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `).join('');
    } else {
      // ページパスベースのデータを表示
      jobTbody.innerHTML = `
        <tr>
          <td colspan="5" class="loading-cell">
            この会社の求人別データはまだありません。<br>
            <small>※ GA4でカスタムイベント（view_job_detail）の設定が必要です</small>
          </td>
        </tr>
      `;
    }
  }

  // 流入元
  const sourceTbody = document.getElementById('source-analytics-tbody');
  if (sourceTbody) {
    const sources = traffic?.sources || [];
    if (sources.length > 0) {
      const totalSessions = sources.reduce((acc, s) => acc + (s.sessions || 0), 0);
      sourceTbody.innerHTML = sources.slice(0, 10).map(item => {
        const percentage = totalSessions > 0 ? Math.round((item.sessions / totalSessions) * 100) : 0;
        return `
          <tr>
            <td>${escapeHtml(item.source || '(direct)')}</td>
            <td>${item.sessions || 0}</td>
            <td>${percentage}%</td>
          </tr>
        `;
      }).join('');
    } else if (traffic?.channels && traffic.channels.length > 0) {
      const totalSessions = traffic.channels.reduce((acc, c) => acc + (c.sessions || 0), 0);
      sourceTbody.innerHTML = traffic.channels.map(item => {
        const percentage = totalSessions > 0 ? Math.round((item.sessions / totalSessions) * 100) : 0;
        return `
          <tr>
            <td>${escapeHtml(item.channel || '不明')}</td>
            <td>${item.sessions || 0}</td>
            <td>${percentage}%</td>
          </tr>
        `;
      }).join('');
    } else {
      sourceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データがありません</td></tr>';
    }
  }

  // デバイス別
  const deviceTbody = document.getElementById('device-analytics-tbody');
  if (deviceTbody) {
    const devices = traffic?.devices || [];
    if (devices.length > 0) {
      const totalSessions = devices.reduce((acc, d) => acc + (d.sessions || 0), 0);
      deviceTbody.innerHTML = devices.map(item => {
        const deviceName = item.device === 'mobile' ? 'モバイル' :
                          item.device === 'desktop' ? 'デスクトップ' :
                          item.device === 'tablet' ? 'タブレット' : item.device;
        const percentage = totalSessions > 0 ? Math.round((item.sessions / totalSessions) * 100) : 0;
        return `
          <tr>
            <td>${escapeHtml(deviceName)}</td>
            <td>${item.sessions || 0}</td>
            <td>${percentage}%</td>
          </tr>
        `;
      }).join('');
    } else {
      deviceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データがありません</td></tr>';
    }
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
  } else if (sectionId === 'analytics') {
    if (pageTitle) pageTitle.textContent = 'アクセス解析';
    if (headerActions) headerActions.style.display = 'none';
  } else if (sectionId === 'reports') {
    if (pageTitle) pageTitle.textContent = '応募レポート';
    if (headerActions) headerActions.style.display = 'none';
  } else if (sectionId === 'applicants') {
    if (pageTitle) pageTitle.textContent = '応募者管理';
    if (headerActions) headerActions.style.display = 'none';
    // 応募者管理を初期化（初回のみ）
    if (!applicantsInitialized) {
      applicantsInitialized = true;
      initApplicantsSection(companyDomain, companyName);
    }
  } else if (sectionId === 'lp-settings') {
    if (pageTitle) pageTitle.textContent = 'LP設定';
    if (headerActions) headerActions.style.display = 'none';
    // LP設定を読み込み
    loadCompanyLPSettings();
  } else if (sectionId === 'settings') {
    if (pageTitle) pageTitle.textContent = 'アカウント設定';
    if (headerActions) headerActions.style.display = 'none';
  }
}

// 応募者管理の初期化フラグ
let applicantsInitialized = false;

// LP設定初期化フラグ
let lpSettingsInitialized = false;

// ヒーロー画像プリセット
const heroImagePresets = [
  { id: 'teamwork-1', name: 'チームミーティング', url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60' },
  { id: 'teamwork-2', name: 'オフィスワーク', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60' },
  { id: 'teamwork-3', name: 'コラボレーション', url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60' },
  { id: 'work-1', name: '製造ライン', url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60' },
  { id: 'work-2', name: '倉庫作業', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=60' },
  { id: 'work-3', name: '建設現場', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60' },
  { id: 'work-4', name: '工場作業', url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=60' },
  { id: 'work-5', name: 'チームワーク', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60' }
];

const MAX_POINTS = 6;
const gasApiUrl = 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec';
const spreadsheetId = '1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0';
const lpSettingsSheetName = 'LP設定';

/**
 * 会社ユーザー用LP設定の初期化
 */
function initCompanyLPSettings() {
  // URL表示
  const urlDisplay = document.getElementById('lp-url-display');
  if (urlDisplay) {
    urlDisplay.textContent = `${window.location.origin}/lp.html?c=${companyDomain}`;
  }

  // プレビューボタン
  const previewBtn = document.getElementById('lp-preview-btn-company');
  if (previewBtn) {
    previewBtn.href = `lp.html?c=${encodeURIComponent(companyDomain)}`;
  }

  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresetsCompany();

  // ポイント追加ボタン
  const addPointBtn = document.getElementById('btn-add-point-company');
  if (addPointBtn) {
    addPointBtn.addEventListener('click', addPointCompany);
  }

  // 保存ボタン
  const saveBtn = document.getElementById('btn-save-lp-settings-company');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCompanyLPSettings);
  }

  // リセットボタン
  const resetBtn = document.getElementById('btn-reset-lp-settings-company');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('LP設定をリセットしますか？')) {
        clearCompanyLPForm();
      }
    });
  }

  lpSettingsInitialized = true;
}

/**
 * 会社ユーザー用LP設定を読み込み
 */
async function loadCompanyLPSettings() {
  if (!lpSettingsInitialized) {
    initCompanyLPSettings();
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(lpSettingsSheetName)}`;
    const response = await fetch(csvUrl);

    if (response.ok) {
      const csvText = await response.text();
      const settings = parseLPSettingsCSVCompany(csvText, companyDomain);

      if (settings) {
        setCompanyInputValue('lp-hero-title-company', settings.heroTitle);
        setCompanyInputValue('lp-hero-subtitle-company', settings.heroSubtitle);
        setCompanyInputValue('lp-hero-image-company', settings.heroImage);

        // ポイントを動的にレンダリング
        const points = [];
        for (let i = 1; i <= 6; i++) {
          const title = settings[`pointTitle${i}`] || '';
          const desc = settings[`pointDesc${i}`] || '';
          if (title || desc) {
            points.push({ title, desc });
          }
        }
        renderPointInputsCompany(points.length > 0 ? points : [{ title: '', desc: '' }, { title: '', desc: '' }, { title: '', desc: '' }]);

        setCompanyInputValue('lp-cta-text-company', settings.ctaText || '今すぐ応募する');
        setCompanyInputValue('lp-faq-company', settings.faq);

        if (settings.designPattern) {
          const patternRadio = document.querySelector(`input[name="design-pattern-company"][value="${settings.designPattern}"]`);
          if (patternRadio) patternRadio.checked = true;
        }

        // セクション表示設定
        if (settings.sectionVisibility) {
          try {
            const visibility = JSON.parse(settings.sectionVisibility);
            document.getElementById('section-points-visible-company').checked = visibility.points !== false;
            document.getElementById('section-jobs-visible-company').checked = visibility.jobs !== false;
            document.getElementById('section-details-visible-company').checked = visibility.details !== false;
            document.getElementById('section-faq-visible-company').checked = visibility.faq !== false;
          } catch (e) {
            console.warn('セクション表示設定のパースに失敗:', e);
          }
        }

        updateHeroImagePresetSelectionCompany(settings.heroImage || '');
        return;
      }
    }
  } catch (e) {
    console.log('LP設定シートが見つかりません:', e);
  }

  // 設定がない場合は初期状態
  clearCompanyLPForm();
}

function setCompanyInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

/**
 * LP設定CSVをパース（会社ユーザー用）
 */
function parseLPSettingsCSVCompany(csvText, targetDomain) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return null;

  const headers = parseCSVLineSimple(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLineSimple(lines[i]);
    const rowData = {};

    headers.forEach((header, idx) => {
      const key = header.replace(/"/g, '').trim();
      rowData[key] = values[idx] || '';
    });

    if (rowData.companyDomain === targetDomain || rowData['会社ドメイン'] === targetDomain) {
      const result = {
        heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
        heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
        heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
        ctaText: rowData.ctaText || rowData['CTAテキスト'] || '',
        faq: rowData.faq || rowData['FAQ'] || '',
        designPattern: rowData.designPattern || rowData['デザインパターン'] || '',
        sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || ''
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
 * シンプルなCSVパーサー
 */
function parseCSVLineSimple(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * ヒーロー画像プリセットをレンダリング（会社ユーザー用）
 */
function renderHeroImagePresetsCompany() {
  const container = document.getElementById('hero-image-presets-company');
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
      selectHeroImagePresetCompany(url);
    });
  });
}

function selectHeroImagePresetCompany(url) {
  const input = document.getElementById('lp-hero-image-company');
  if (input) {
    input.value = url;
  }
  updateHeroImagePresetSelectionCompany(url);
}

function updateHeroImagePresetSelectionCompany(selectedUrl) {
  const container = document.getElementById('hero-image-presets-company');
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
 * ポイント入力フィールドをレンダリング（会社ユーザー用）
 */
function renderPointInputsCompany(points = [{ title: '', desc: '' }, { title: '', desc: '' }, { title: '', desc: '' }]) {
  const container = document.getElementById('point-inputs-container-company');
  if (!container) return;

  container.innerHTML = points.map((point, index) => `
    <div class="point-input-group" data-point-index="${index}">
      <label>ポイント${index + 1}</label>
      <input type="text" class="point-title" placeholder="タイトル" value="${escapeHtml(point.title || '')}">
      <input type="text" class="point-desc" placeholder="説明文" value="${escapeHtml(point.desc || '')}">
      <button type="button" class="btn-remove-point" title="削除">&times;</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-remove-point').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const group = e.target.closest('.point-input-group');
      if (group && container.children.length > 1) {
        group.remove();
        reindexPointsCompany();
        updateAddPointButtonStateCompany();
      }
    });
  });

  updateAddPointButtonStateCompany();
}

function reindexPointsCompany() {
  const container = document.getElementById('point-inputs-container-company');
  if (!container) return;

  container.querySelectorAll('.point-input-group').forEach((group, index) => {
    group.dataset.pointIndex = index;
    const label = group.querySelector('label');
    if (label) label.textContent = `ポイント${index + 1}`;
  });
}

function updateAddPointButtonStateCompany() {
  const container = document.getElementById('point-inputs-container-company');
  const addBtn = document.getElementById('btn-add-point-company');
  if (!container || !addBtn) return;

  addBtn.disabled = container.children.length >= MAX_POINTS;
}

function addPointCompany() {
  const container = document.getElementById('point-inputs-container-company');
  if (!container || container.children.length >= MAX_POINTS) return;

  const newIndex = container.children.length;
  const div = document.createElement('div');
  div.className = 'point-input-group';
  div.dataset.pointIndex = newIndex;
  div.innerHTML = `
    <label>ポイント${newIndex + 1}</label>
    <input type="text" class="point-title" placeholder="タイトル" value="">
    <input type="text" class="point-desc" placeholder="説明文" value="">
    <button type="button" class="btn-remove-point" title="削除">&times;</button>
  `;

  div.querySelector('.btn-remove-point').addEventListener('click', () => {
    if (container.children.length > 1) {
      div.remove();
      reindexPointsCompany();
      updateAddPointButtonStateCompany();
    }
  });

  container.appendChild(div);
  updateAddPointButtonStateCompany();
  div.querySelector('.point-title').focus();
}

function getPointsDataCompany() {
  const container = document.getElementById('point-inputs-container-company');
  if (!container) return [];

  const points = [];
  container.querySelectorAll('.point-input-group').forEach(group => {
    const title = group.querySelector('.point-title')?.value || '';
    const desc = group.querySelector('.point-desc')?.value || '';
    points.push({ title, desc });
  });
  return points;
}

function clearCompanyLPForm() {
  setCompanyInputValue('lp-hero-title-company', '');
  setCompanyInputValue('lp-hero-subtitle-company', '');
  setCompanyInputValue('lp-hero-image-company', '');
  setCompanyInputValue('lp-cta-text-company', '今すぐ応募する');
  setCompanyInputValue('lp-faq-company', '');

  renderPointInputsCompany();

  const standardRadio = document.querySelector('input[name="design-pattern-company"][value="standard"]');
  if (standardRadio) standardRadio.checked = true;

  document.getElementById('section-points-visible-company').checked = true;
  document.getElementById('section-jobs-visible-company').checked = true;
  document.getElementById('section-details-visible-company').checked = true;
  document.getElementById('section-faq-visible-company').checked = true;

  updateHeroImagePresetSelectionCompany('');
}

/**
 * 会社ユーザー用LP設定を保存
 */
async function saveCompanyLPSettings() {
  const points = getPointsDataCompany();

  const sectionVisibility = {
    points: document.getElementById('section-points-visible-company')?.checked !== false,
    jobs: document.getElementById('section-jobs-visible-company')?.checked !== false,
    details: document.getElementById('section-details-visible-company')?.checked !== false,
    faq: document.getElementById('section-faq-visible-company')?.checked !== false
  };

  const settings = {
    companyDomain: companyDomain,
    designPattern: document.querySelector('input[name="design-pattern-company"]:checked')?.value || 'standard',
    heroTitle: document.getElementById('lp-hero-title-company')?.value || '',
    heroSubtitle: document.getElementById('lp-hero-subtitle-company')?.value || '',
    heroImage: document.getElementById('lp-hero-image-company')?.value || '',
    ctaText: document.getElementById('lp-cta-text-company')?.value || '',
    faq: document.getElementById('lp-faq-company')?.value || '',
    sectionVisibility: JSON.stringify(sectionVisibility)
  };

  // ポイント1〜6を設定
  for (let i = 0; i < 6; i++) {
    settings[`pointTitle${i + 1}`] = points[i]?.title || '';
    settings[`pointDesc${i + 1}`] = points[i]?.desc || '';
  }

  const saveBtn = document.getElementById('btn-save-lp-settings-company');
  const successMsg = document.getElementById('lp-save-message');
  const errorMsg = document.getElementById('lp-error-message');

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
  }
  if (successMsg) successMsg.style.display = 'none';
  if (errorMsg) errorMsg.style.display = 'none';

  try {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      action: 'saveLPSettings',
      settings: settings
    }))));
    const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('サーバーからの応答が不正です');
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'LP設定を保存';
    }

    if (result.success) {
      if (successMsg) {
        successMsg.textContent = 'LP設定を保存しました';
        successMsg.style.display = 'block';
        setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
      }
    } else {
      throw new Error(result.error || '保存に失敗しました');
    }
  } catch (error) {
    console.error('LP設定保存エラー:', error);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'LP設定を保存';
    }
    if (errorMsg) {
      errorMsg.textContent = 'LP設定の保存に失敗しました: ' + error.message;
      errorMsg.style.display = 'block';
    }
  }
}

/**
 * パスワード変更フォームのセットアップ
 */
function setupPasswordChangeForm() {
  const form = document.getElementById('password-change-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorEl = document.getElementById('password-change-error');
    const successEl = document.getElementById('password-change-success');

    // エラー・成功メッセージをリセット
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    // バリデーション
    if (newPassword !== confirmPassword) {
      errorEl.textContent = '新しいパスワードが一致しません';
      errorEl.style.display = 'block';
      return;
    }

    if (newPassword.length < 8) {
      errorEl.textContent = 'パスワードは8文字以上で設定してください';
      errorEl.style.display = 'block';
      return;
    }

    try {
      // Firestoreで現在のパスワードを確認して更新
      const result = await changeCompanyUserPassword(currentPassword, newPassword);

      if (result.success) {
        successEl.textContent = 'パスワードを変更しました';
        successEl.style.display = 'block';
        form.reset();
      } else {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
      }
    } catch (error) {
      console.error('Password change error:', error);
      errorEl.textContent = 'パスワードの変更に失敗しました';
      errorEl.style.display = 'block';
    }
  });
}

/**
 * 会社ユーザーのパスワードを変更
 */
async function changeCompanyUserPassword(currentPassword, newPassword) {
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  const db = firebase.firestore();
  const username = sessionStorage.getItem('company_user_id');

  if (!username) {
    // セッションにユーザーIDがない場合、companyDomainから検索
    try {
      const userQuery = await db.collection('company_users')
        .where('companyDomain', '==', companyDomain)
        .limit(1)
        .get();

      if (userQuery.empty) {
        return { success: false, error: 'ユーザー情報が見つかりません' };
      }

      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();

      // 現在のパスワードを確認
      if (userData.password !== currentPassword) {
        return { success: false, error: '現在のパスワードが正しくありません' };
      }

      // パスワードを更新
      await db.collection('company_users').doc(userDoc.id).update({
        password: newPassword,
        passwordChangedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: error.message };
    }
  }

  // ユーザーIDがある場合
  try {
    const userQuery = await db.collection('company_users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return { success: false, error: 'ユーザー情報が見つかりません' };
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // 現在のパスワードを確認
    if (userData.password !== currentPassword) {
      return { success: false, error: '現在のパスワードが正しくありません' };
    }

    // パスワードを更新
    await db.collection('company_users').doc(userDoc.id).update({
      password: newPassword,
      passwordChangedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Password change error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社ユーザー向けの機能制限を適用
 */
function applyCompanyUserRestrictions() {
  // フィード生成セクションを非表示（管理者のみ）
  const feedSection = document.querySelector('.feed-section');
  if (feedSection) {
    feedSection.style.display = 'none';
  }

  // サイドバーの「戻る」リンクを調整（admin.htmlではなく自社ページへ）
  const backLink = document.querySelector('.sidebar-nav a[data-section="back"]');
  if (backLink) {
    // 戻るリンクを非表示にする（会社ユーザーは他の会社に移動できない）
    backLink.style.display = 'none';
  }

  // 「管理画面へ戻る」を非表示にし、ログアウトボタンを表示
  const backAdminBtn = document.getElementById('btn-back-admin');
  if (backAdminBtn) {
    backAdminBtn.style.display = 'none';
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.style.display = 'block';
    logoutBtn.addEventListener('click', () => {
      handleLogout();
      window.location.href = 'admin.html';
    });
  }

  // 設定メニューを表示（会社ユーザーのみ）
  const settingsNavItem = document.getElementById('nav-settings-item');
  if (settingsNavItem) {
    settingsNavItem.style.display = 'block';
  }

  // LP設定メニューを表示（会社ユーザーのみ）
  const lpSettingsNavItem = document.getElementById('nav-lp-settings-item');
  if (lpSettingsNavItem) {
    lpSettingsNavItem.style.display = 'block';
  }

  // LP設定の初期化
  initCompanyLPSettings();

  // パスワード変更フォームのイベント設定
  setupPasswordChangeForm();

  // 会社ユーザー用のバッジ表示
  const companyNameEl = document.getElementById('company-name');
  if (companyNameEl) {
    companyNameEl.innerHTML = `${escapeHtml(companyName)} <span class="badge info">会社ユーザー</span>`;
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

  // アクセス解析機能
  document.getElementById('btn-load-analytics')?.addEventListener('click', loadAnalyticsData);
}

/**
 * 初期化
 */
export async function initJobManager() {
  // Firebase初期化
  initFirebase();

  // セッション確認
  if (!checkSession()) {
    window.location.href = 'admin.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  companyDomain = params.get('domain');
  companyName = params.get('company') || companyDomain;
  sheetUrl = params.get('sheetUrl');

  // URLパラメータでセクション指定があれば最初に切り替え（チラつき防止）
  const initialSection = params.get('section');
  if (initialSection && ['analytics', 'reports', 'applicants'].includes(initialSection)) {
    switchSection(initialSection);
  }

  if (!companyDomain) {
    alert('会社ドメインが指定されていません');
    window.location.href = 'admin.html';
    return;
  }

  // アクセス権限チェック
  if (!hasAccessToCompany(companyDomain)) {
    alert('この会社へのアクセス権限がありません');
    window.location.href = 'admin.html';
    return;
  }

  // 会社ユーザーの場合、管理者専用機能を非表示にする
  if (!isAdmin()) {
    applyCompanyUserRestrictions();
  }

  const pageTitle = document.getElementById('page-title');
  if (pageTitle && !initialSection) pageTitle.textContent = `${companyName} の求人一覧`;

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
