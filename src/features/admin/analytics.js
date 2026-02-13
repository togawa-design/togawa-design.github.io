/**
 * Admin Dashboard - アナリティクスモジュール
 */

import { escapeHtml, formatNumber } from '@shared/utils.js';
import { renderDemographics } from '@shared/analytics-utils.js';
import { config } from './config.js';
import { getIdToken, isAdmin, getUserCompanyDomain } from './auth.js';
import { getPatternLabel } from './config.js';
import { getDateRange } from './date-picker.js';

// 企業データキャッシュ
let companyData = [];

// Chart.jsインスタンスを保持
let dailyChart = null;
let dayOfWeekChart = null;
let hourChart = null;
let channelChart = null;
let actionChart = null;
let detailDailyChart = null;

export function getCompanyData() {
  return companyData;
}

/**
 * APIのURLを構築（会社ユーザーの場合は自社フィルターを追加）
 * @param {string} baseUrl - ベースURL
 * @param {Object} params - クエリパラメータ
 * @returns {string} 完成したURL
 */
function buildApiUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl, window.location.origin);

  // パラメータを追加
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  // 会社ユーザーの場合は自社フィルターを追加
  if (!isAdmin()) {
    const companyDomain = getUserCompanyDomain();
    if (companyDomain) {
      url.searchParams.set('company_domain', companyDomain);
    }
  }

  return url.toString();
}

// ダッシュボードデータ読み込み
export async function loadDashboardData() {
  const { days } = getDateRange();
  const apiEndpoint = config.apiEndpoint;

  // 会社ユーザー用のUI制限を適用
  applyAnalyticsUIRestrictions();

  if (apiEndpoint) {
    try {
      await fetchGAData(days, apiEndpoint);
    } catch (e) {
      console.error('[Admin] API fetch failed, loading mock data:', e);
      loadMockData(days);
    }
  } else {
    loadMockData(days);
  }
}

/**
 * 会社ユーザー用のアナリティクスUI制限を適用
 */
function applyAnalyticsUIRestrictions() {
  if (isAdmin()) return;

  // 概要セクションの「企業別アクセスランキング」を非表示
  const companyRanking = document.getElementById('overview-company-ranking');
  if (companyRanking) {
    companyRanking.style.display = 'none';
  }

  // 詳細分析セクションの「採用管理」タブを非表示（admin専用）
  const recruitmentManagementTab = document.getElementById('tab-recruitment-management');
  if (recruitmentManagementTab) {
    recruitmentManagementTab.style.display = 'none';
  }

  // 「採用管理」タブコンテンツを非表示
  const recruitmentManagementTabContent = document.getElementById('recruitment-management-tab');
  if (recruitmentManagementTabContent) {
    recruitmentManagementTabContent.classList.remove('active');
  }

  // 詳細分析セクションの「企業分析」タブを非表示
  const companyAnalyticsTab = document.getElementById('tab-company-analytics');
  if (companyAnalyticsTab) {
    companyAnalyticsTab.style.display = 'none';
  }

  // 「企業分析」タブコンテンツを非表示
  const companyAnalyticsTabContent = document.getElementById('company-analytics-tab');
  if (companyAnalyticsTabContent) {
    companyAnalyticsTabContent.classList.remove('active');
  }

  // デフォルトタブを「ページ・流入」に変更
  const pageTrafficTab = document.getElementById('tab-page-traffic');
  const pageTrafficTabContent = document.getElementById('page-traffic-tab');
  if (pageTrafficTab && pageTrafficTabContent) {
    pageTrafficTab.classList.add('active');
    pageTrafficTabContent.classList.add('active');
  }

  // 「企業別エンゲージメント」セクションを非表示
  const engagementSection = document.getElementById('engagement-company-section');
  if (engagementSection) {
    engagementSection.style.display = 'none';
  }

  // 「企業別CVR」セクションを非表示
  const cvrSection = document.getElementById('company-cvr-section');
  if (cvrSection) {
    cvrSection.style.display = 'none';
  }
}

// Cloud Functions API からデータ取得
async function fetchGAData(days, apiEndpoint) {
  try {
    showLoading(true);
    showSectionLoading(true);

    const headers = {};
    const idToken = getIdToken();
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    // URLを構築
    let url = `${apiEndpoint}?days=${days}`;

    // 会社ユーザーの場合は自社のみ
    if (!isAdmin()) {
      const companyDomain = getUserCompanyDomain();
      if (companyDomain) {
        url += `&company_domain=${encodeURIComponent(companyDomain)}`;
      }
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    const data = result.data;

    // 概要データを更新
    if (data.overview) {
      updateElement('total-pageviews', formatNumber(data.overview.pageViews));
      updateElement('total-users', formatNumber(data.overview.users));
      updateElement('company-views', formatNumber(data.overview.companyViews));
      updateElement('apply-clicks', formatNumber(data.overview.applyClicks));

      // ユーザー属性（男女比・年齢分布）を描画
      renderAdminDemographics(data.overview.gender, data.overview.age);
    }

    // 日別チャートを描画
    if (data.daily) {
      renderDailyChartFromAPI(data.daily);
    }

    // 企業別データを描画
    if (data.companies) {
      companyData = data.companies
        .filter(c => c.domain && c.domain !== '(not set)' && c.name && c.name !== '(not set)')
        .map(c => ({
          name: c.name,
          domain: c.domain,
          views: c.views,
          clicks: c.clicks,
          pattern: 'standard'
        }));
      renderOverviewTable();
      renderCompanyCards();
    }

    // 応募データを描画
    if (data.applications) {
      renderApplicationsDataFromAPI(data.applications);
    }

    showLoading(false);

  } catch (error) {
    console.error('[Admin] API fetch error:', error);
    showLoading(false);
    loadMockData(days);
  }
}

// ローディング表示
function showLoading(show) {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.textContent = show ? '読み込み中...' : '更新';
    refreshBtn.disabled = show;
  }
}

// ユーザー属性（男女比・年齢分布）を描画
function renderAdminDemographics(gender, age) {
  renderDemographics(gender, age, {
    maleBarId: 'admin-gender-bar-male',
    femaleBarId: 'admin-gender-bar-female',
    malePercentId: 'admin-gender-male-percent',
    femalePercentId: 'admin-gender-female-percent',
    ageContainerId: 'admin-age-bars'
  });
}

// スケルトンローダーHTML生成
function createSkeletonLoader(type = 'default') {
  switch (type) {
    case 'stat':
      return `
        <div class="skeleton-card">
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-label"></div>
        </div>
      `;
    case 'chart':
      return `
        <div class="skeleton skeleton-chart"></div>
      `;
    case 'table-row':
      return `
        <tr>
          <td colspan="6"><div class="skeleton skeleton-table-row"></div></td>
        </tr>
        <tr>
          <td colspan="6"><div class="skeleton skeleton-table-row"></div></td>
        </tr>
        <tr>
          <td colspan="6"><div class="skeleton skeleton-table-row"></div></td>
        </tr>
      `;
    case 'card':
      return `
        <div class="skeleton-card" style="height: 120px;">
          <div class="skeleton skeleton-text" style="width: 60%;"></div>
          <div class="skeleton skeleton-text-sm"></div>
          <div class="skeleton skeleton-text-sm" style="width: 40%;"></div>
        </div>
      `.repeat(3);
    default:
      return '<div class="loading-placeholder">データを読み込み中...</div>';
  }
}

// 空状態HTML生成
function createEmptyState(options = {}) {
  const {
    icon = '📊',
    title = 'データがありません',
    description = '表示できるデータがまだありません',
    actionText = null,
    actionId = null
  } = options;

  let actionHtml = '';
  if (actionText && actionId) {
    actionHtml = `<button class="empty-state-action" id="${actionId}">${actionText}</button>`;
  }

  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h4 class="empty-state-title">${title}</h4>
      <p class="empty-state-description">${description}</p>
      ${actionHtml}
    </div>
  `;
}

// エラー状態HTML生成
function createErrorState(options = {}) {
  const {
    title = 'データの読み込みに失敗しました',
    description = '再度お試しください',
    retryId = null
  } = options;

  let retryHtml = '';
  if (retryId) {
    retryHtml = `<button class="error-state-retry" id="${retryId}">再試行</button>`;
  }

  return `
    <div class="error-state">
      <div class="error-state-icon">⚠️</div>
      <h4 class="error-state-title">${title}</h4>
      <p class="error-state-description">${description}</p>
      ${retryHtml}
    </div>
  `;
}

// 各セクションにローディング表示
function showSectionLoading(show) {
  const statCards = document.querySelectorAll('#section-analytics-detail .stat-value');
  statCards.forEach(card => {
    if (show) {
      card.dataset.originalText = card.textContent;
      card.innerHTML = '<span class="skeleton" style="display: inline-block; width: 60px; height: 24px; vertical-align: middle;"></span>';
    }
  });

  const chartEl = document.getElementById('daily-chart');
  if (chartEl && show) {
    chartEl.innerHTML = createSkeletonLoader('chart');
  }

  const tableBody = document.querySelector('.data-table tbody');
  if (tableBody && show) {
    tableBody.innerHTML = createSkeletonLoader('table-row');
  }

  const companyCards = document.getElementById('company-cards');
  if (companyCards && show) {
    companyCards.innerHTML = createSkeletonLoader('card');
  }

  const logTable = document.querySelector('#applications-section .data-table tbody');
  if (logTable && show) {
    logTable.innerHTML = createSkeletonLoader('table-row');
  }
}

// 要素のテキストを更新
function updateElement(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// API からの日別データでチャートを描画
function renderDailyChartFromAPI(dailyData) {
  const chartEl = document.getElementById('daily-chart');
  if (!chartEl) return;

  if (!dailyData || dailyData.length === 0) {
    chartEl.innerHTML = createEmptyState({
      icon: '📈',
      title: 'グラフデータがありません',
      description: '選択期間のデータがまだ記録されていません'
    });
    return;
  }

  // 既存のチャートを破棄
  if (dailyChart) {
    dailyChart.destroy();
    dailyChart = null;
  }

  const displayData = dailyData.length > 30 ? dailyData.filter((_, i) => i % 3 === 0) : dailyData;

  // Canvas要素を作成
  chartEl.innerHTML = '<canvas id="daily-chart-canvas"></canvas>';
  const canvas = document.getElementById('daily-chart-canvas');
  const ctx = canvas.getContext('2d');

  dailyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: displayData.map(d => d.date),
      datasets: [{
        label: 'PV',
        data: displayData.map(d => d.views),
        borderColor: 'rgba(99, 102, 241, 1)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.9)',
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 }
        }
      }
    }
  });
}

// API からの応募データを描画
function renderApplicationsDataFromAPI(applications) {
  const tbody = document.querySelector('#applications-table tbody');
  if (!tbody) return;

  const typeLabels = {
    apply: '応募ボタン',
    line: 'LINE相談',
    consult: '相談フォーム'
  };

  if (!applications || applications.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">${createEmptyState({
      icon: '📋',
      title: '応募データがありません',
      description: '選択期間内の応募イベントはまだありません'
    })}</td></tr>`;
    return;
  }

  tbody.innerHTML = applications.map(app => `
    <tr>
      <td>${escapeHtml(app.date)}</td>
      <td>${escapeHtml(app.company)}</td>
      <td><span class="type-badge ${escapeHtml(app.type)}">${typeLabels[app.type] || escapeHtml(app.type)}</span></td>
      <td>${escapeHtml(app.pageType || app.pagePath || '-')}</td>
      <td>${escapeHtml(app.source)}</td>
    </tr>
  `).join('');
}

// モックデータ読み込み（デモ用）
function loadMockData(days) {
  const baseViews = days * 150;
  const baseUsers = days * 80;
  const companyViews = days * 45;
  const applyClicks = days * 12;

  updateElement('total-pageviews', formatNumber(baseViews + Math.floor(Math.random() * 500)));
  updateElement('total-users', formatNumber(baseUsers + Math.floor(Math.random() * 200)));
  updateElement('company-views', formatNumber(companyViews + Math.floor(Math.random() * 100)));
  updateElement('apply-clicks', formatNumber(applyClicks + Math.floor(Math.random() * 30)));

  renderDailyChart(days);
  renderMockCompanyData();
  renderMockApplicationsData();
}

// 日別チャート描画（モック）
function renderDailyChart(days) {
  const data = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      views: Math.floor(100 + Math.random() * 200)
    });
  }

  renderDailyChartFromAPI(data);
}

// 企業別データ描画（モック）
function renderMockCompanyData() {
  companyData = [
    { name: 'トヨタ自動車', domain: 'toyota', views: 1250, clicks: 89, pattern: 'modern' },
    { name: '日産自動車', domain: 'nissan', views: 980, clicks: 67, pattern: 'classic' },
    { name: '本田技研工業', domain: 'honda', views: 856, clicks: 54, pattern: 'colorful' },
    { name: 'スバル', domain: 'subaru', views: 654, clicks: 43, pattern: 'minimal' },
    { name: 'マツダ', domain: 'mazda', views: 523, clicks: 32, pattern: 'standard' },
    { name: 'スズキ', domain: 'suzuki', views: 412, clicks: 28, pattern: 'modern' },
    { name: 'ダイハツ', domain: 'daihatsu', views: 387, clicks: 24, pattern: 'classic' },
    { name: '三菱自動車', domain: 'mitsubishi', views: 298, clicks: 18, pattern: 'standard' }
  ];

  renderOverviewTable();
  renderCompanyCards();
}

// 概要テーブル描画
export function renderOverviewTable() {
  const tbody = document.querySelector('#overview-company-table tbody');
  if (!tbody) return;

  const sortedData = [...companyData].sort((a, b) => b.views - a.views);

  tbody.innerHTML = sortedData.slice(0, 5).map((company, index) => {
    const cvr = ((company.clicks / company.views) * 100).toFixed(1);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(company.name)}</td>
        <td>${formatNumber(company.views)}</td>
        <td>${company.clicks}</td>
        <td>${cvr}%</td>
      </tr>
    `;
  }).join('');
}

// 企業カード描画
export function renderCompanyCards() {
  const container = document.getElementById('company-cards');
  if (!container) return;

  if (!companyData || companyData.length === 0) {
    container.innerHTML = createEmptyState({
      icon: '🏢',
      title: '企業データがありません',
      description: '表示できる企業データがまだありません'
    });
    return;
  }

  container.innerHTML = companyData.map(company => {
    const cvr = ((company.clicks / company.views) * 100).toFixed(1);
    const patternLabel = getPatternLabel(company.pattern);

    return `
      <div class="company-card" data-domain="${escapeHtml(company.domain)}" data-name="${escapeHtml(company.name)}" data-views="${company.views}" data-clicks="${company.clicks}">
        <div class="company-card-header">
          <h4>${escapeHtml(company.name)}</h4>
          <span class="pattern-badge ${escapeHtml(company.pattern)}">${patternLabel}</span>
        </div>
        <div class="company-card-stats">
          <div class="card-stat">
            <span class="stat-value">${formatNumber(company.views)}</span>
            <span class="stat-label">ページビュー</span>
          </div>
          <div class="card-stat">
            <span class="stat-value">${company.clicks}</span>
            <span class="stat-label">応募クリック</span>
          </div>
          <div class="card-stat">
            <span class="stat-value">${cvr}%</span>
            <span class="stat-label">CVR</span>
          </div>
        </div>
        <button class="btn-view-status" data-domain="${escapeHtml(company.domain)}" data-name="${escapeHtml(company.name)}">会社の状況を確認</button>
      </div>
    `;
  }).join('');

  // 詳細ボタンのイベントリスナー
  container.querySelectorAll('.btn-view-status').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const domain = e.target.dataset.domain;
      const name = e.target.dataset.name;
      showCompanyDetailSection(domain, name);
    });
  });
}

// 企業フィルター
export function filterCompanies(query) {
  const cards = document.querySelectorAll('.company-card');
  const lowerQuery = query.toLowerCase();

  cards.forEach(card => {
    const name = card.dataset.name.toLowerCase();
    const domain = card.dataset.domain.toLowerCase();

    if (name.includes(lowerQuery) || domain.includes(lowerQuery)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// 企業ソート
export function sortCompanies() {
  const sortByEl = document.getElementById('sort-by');
  const sortBy = sortByEl?.value || 'views';
  const container = document.getElementById('company-cards');
  if (!container) return;

  const cards = Array.from(container.querySelectorAll('.company-card'));

  cards.sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return parseInt(b.dataset.views) - parseInt(a.dataset.views);
      case 'clicks':
        return parseInt(b.dataset.clicks) - parseInt(a.dataset.clicks);
      case 'cvr':
        const cvrA = parseInt(a.dataset.clicks) / parseInt(a.dataset.views);
        const cvrB = parseInt(b.dataset.clicks) / parseInt(b.dataset.views);
        return cvrB - cvrA;
      case 'name':
        return a.dataset.name.localeCompare(b.dataset.name, 'ja');
      default:
        return 0;
    }
  });

  cards.forEach(card => container.appendChild(card));
}

// 応募データ描画（モック）
function renderMockApplicationsData() {
  const tbody = document.querySelector('#applications-table tbody');
  if (!tbody) return;

  const applications = [
    { date: '2025/01/17 14:32', company: 'トヨタ自動車', type: 'apply', source: 'Google検索' },
    { date: '2025/01/17 13:15', company: '日産自動車', type: 'line', source: '直接アクセス' },
    { date: '2025/01/17 11:48', company: 'トヨタ自動車', type: 'apply', source: 'Yahoo検索' },
    { date: '2025/01/17 10:22', company: '本田技研工業', type: 'apply', source: '直接アクセス' },
    { date: '2025/01/16 18:45', company: 'スバル', type: 'line', source: 'Google検索' },
    { date: '2025/01/16 16:30', company: 'トヨタ自動車', type: 'apply', source: 'SNS' },
    { date: '2025/01/16 14:12', company: 'マツダ', type: 'apply', source: 'Google検索' },
    { date: '2025/01/16 11:55', company: '日産自動車', type: 'apply', source: '直接アクセス' }
  ];

  const typeLabels = {
    apply: '応募ボタン',
    line: 'LINE相談',
    consult: '相談フォーム'
  };

  tbody.innerHTML = applications.map(app => `
    <tr>
      <td>${escapeHtml(app.date)}</td>
      <td>${escapeHtml(app.company)}</td>
      <td><span class="type-badge ${escapeHtml(app.type)}">${typeLabels[app.type]}</span></td>
      <td>${escapeHtml(app.source)}</td>
    </tr>
  `).join('');
}

// 分析タブの初期化
export function initAnalyticsTabs() {
  const tabs = document.querySelectorAll('.analytics-tab');
  const contents = document.querySelectorAll('.analytics-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;

      // タブの切り替え
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // コンテンツの切り替え
      contents.forEach(c => c.classList.remove('active'));
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');

        // タブごとのデータ読み込み
        loadTabData(targetId);
      }
    });
  });
}

// タブごとのデータ読み込み
async function loadTabData(tabId) {
  const { days } = getDateRange();
  const apiEndpoint = config.apiEndpoint;

  switch (tabId) {
    case 'recruitment-management-tab':
      // 採用管理タブ：アラートとファネルデータを読み込む
      await loadRecruitmentManagementData();
      break;
    case 'company-analytics-tab':
      // 企業分析タブ：企業カードとエンゲージメントデータを読み込む
      await loadEngagementData(days, apiEndpoint);
      break;
    case 'page-traffic-tab':
      // ページ・流入タブ：エンゲージメント、流入元、時系列データを読み込む
      await Promise.all([
        loadEngagementData(days, apiEndpoint),
        loadTrafficData(days, apiEndpoint),
        loadTrendData(days, apiEndpoint)
      ]);
      break;
    case 'conversion-tab':
      // コンバージョンタブ：ファネルデータを読み込む
      await loadFunnelData(days, apiEndpoint);
      break;
  }
}

// エンゲージメントデータ読み込み
async function loadEngagementData(days, apiEndpoint) {
  try {
    const headers = {};
    const idToken = getIdToken();
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = buildApiUrl(apiEndpoint, { type: 'engagement', days });
    const response = await fetch(url, { headers });
    const result = await response.json();

    if (result.success && result.data) {
      renderEngagementData(result.data);
    } else {
      renderMockEngagementData();
    }
  } catch (error) {
    console.error('[Admin] Engagement data error:', error);
    renderMockEngagementData();
  }
}

// エンゲージメントデータ描画
function renderEngagementData(data) {
  const overall = data.overall || {};

  updateElement('avg-session-duration', `${overall.avgSessionDuration || 0}秒`);
  updateElement('engagement-rate', `${overall.engagementRate || 0}%`);
  updateElement('bounce-rate', `${overall.bounceRate || 0}%`);

  // 企業別エンゲージメントテーブル
  const tbody = document.querySelector('#engagement-company-table tbody');
  if (tbody && data.byCompany && data.byCompany.length > 0) {
    tbody.innerHTML = data.byCompany.map(c => `
      <tr>
        <td>${escapeHtml(c.name || c.domain)}</td>
        <td>${formatNumber(c.views)}</td>
        <td>${Math.round(c.engagementTime)}秒</td>
        <td>${c.avgTimePerView}秒</td>
      </tr>
    `).join('');
  } else if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4">${createEmptyState({
      icon: '📊',
      title: 'エンゲージメントデータがありません',
      description: '企業別のエンゲージメントデータがまだありません'
    })}</td></tr>`;
  }
}

// モックエンゲージメントデータ
function renderMockEngagementData() {
  updateElement('avg-session-duration', '45.2秒');
  updateElement('engagement-rate', '68.5%');
  updateElement('bounce-rate', '31.5%');

  const tbody = document.querySelector('#engagement-company-table tbody');
  if (tbody) {
    const mockData = [
      { name: 'トヨタ自動車', views: 1250, time: 4500, avg: '3.6' },
      { name: '日産自動車', views: 980, time: 3200, avg: '3.3' },
      { name: '本田技研工業', views: 856, time: 2800, avg: '3.3' },
    ];
    tbody.innerHTML = mockData.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${formatNumber(c.views)}</td>
        <td>${c.time}秒</td>
        <td>${c.avg}秒</td>
      </tr>
    `).join('');
  }
}

// 流入元データ読み込み
async function loadTrafficData(days, apiEndpoint) {
  try {
    const headers = {};
    const idToken = getIdToken();
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = buildApiUrl(apiEndpoint, { type: 'traffic', days });
    const response = await fetch(url, { headers });
    const result = await response.json();

    if (result.success && result.data) {
      renderTrafficData(result.data);
    } else {
      renderMockTrafficData();
    }
  } catch (error) {
    console.error('[Admin] Traffic data error:', error);
    renderMockTrafficData();
  }
}

// 流入元データ描画
function renderTrafficData(data) {
  // チャネル別チャート（Chart.js）
  const chartEl = document.getElementById('channel-chart');
  if (chartEl && data.channels && data.channels.length > 0) {
    // 既存のチャートを破棄
    if (channelChart) {
      channelChart.destroy();
      channelChart = null;
    }

    // Canvas要素を作成
    chartEl.innerHTML = '<canvas id="channel-chart-canvas"></canvas>';
    const canvas = document.getElementById('channel-chart-canvas');
    const ctx = canvas.getContext('2d');

    channelChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.channels.map(c => c.channel),
        datasets: [{
          label: 'セッション数',
          data: data.channels.map(c => c.sessions),
          backgroundColor: [
            'rgba(99, 102, 241, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)'
          ],
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 12 } }
          }
        }
      }
    });
  }

  // 参照元テーブル
  const tbody = document.querySelector('#source-table tbody');
  if (tbody && data.sources && data.sources.length > 0) {
    tbody.innerHTML = data.sources.map(s => `
      <tr>
        <td>${escapeHtml(s.source)}</td>
        <td>${escapeHtml(s.medium)}</td>
        <td>${formatNumber(s.sessions)}</td>
        <td>${formatNumber(s.users)}</td>
      </tr>
    `).join('');
  } else if (tbody) {
    tbody.innerHTML = `<tr><td colspan="4">${createEmptyState({
      icon: '🔗',
      title: '流入元データがありません',
      description: '参照元・メディアのデータがまだありません'
    })}</td></tr>`;
  }
}

// モック流入元データ
function renderMockTrafficData() {
  const mockData = {
    channels: [
      { channel: 'Organic Search', sessions: 1250 },
      { channel: 'Direct', sessions: 890 },
      { channel: 'Social', sessions: 456 },
      { channel: 'Referral', sessions: 234 }
    ],
    sources: [
      { source: 'google', medium: 'organic', sessions: 890, users: 756 },
      { source: '(direct)', medium: '(none)', sessions: 456, users: 412 },
      { source: 'yahoo', medium: 'organic', sessions: 234, users: 198 }
    ]
  };
  renderTrafficData(mockData);
}

// ファネルデータ読み込み
async function loadFunnelData(days, apiEndpoint) {
  try {
    const headers = {};
    const idToken = getIdToken();
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = buildApiUrl(apiEndpoint, { type: 'funnel', days });
    const response = await fetch(url, { headers });
    const result = await response.json();

    if (result.success && result.data) {
      renderFunnelData(result.data);
    } else {
      renderMockFunnelData();
    }
  } catch (error) {
    console.error('[Admin] Funnel data error:', error);
    renderMockFunnelData();
  }
}

// ファネルデータ描画
function renderFunnelData(data) {
  // ファネルチャート
  const funnelEl = document.getElementById('funnel-chart');
  if (funnelEl && data.funnel && data.funnel.length > 0) {
    funnelEl.innerHTML = data.funnel.map(stage => `
      <div class="funnel-stage">
        <span class="funnel-stage-name">${escapeHtml(stage.stage)}</span>
        <span class="funnel-stage-count">${formatNumber(stage.count)}</span>
        <span class="funnel-stage-rate">${stage.rate}%</span>
      </div>
    `).join('');
  }

  // アクション内訳チャート（Chart.js）
  const actionEl = document.getElementById('action-breakdown-chart');
  if (actionEl && data.actionBreakdown && data.actionBreakdown.length > 0) {
    // 既存のチャートを破棄
    if (actionChart) {
      actionChart.destroy();
      actionChart = null;
    }

    // Canvas要素を作成
    actionEl.innerHTML = '<canvas id="action-chart-canvas"></canvas>';
    const canvas = document.getElementById('action-chart-canvas');
    const ctx = canvas.getContext('2d');

    actionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.actionBreakdown.map(a => a.label),
        datasets: [{
          label: '件数',
          data: data.actionBreakdown.map(a => a.count),
          backgroundColor: [
            'rgba(16, 185, 129, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)'
          ],
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 12 } }
          }
        }
      }
    });
  }

  // 企業別CVRテーブル
  const tbody = document.querySelector('#company-funnel-table tbody');
  if (tbody && data.byCompany && data.byCompany.length > 0) {
    tbody.innerHTML = data.byCompany.map(c => `
      <tr>
        <td>${escapeHtml(c.domain)}</td>
        <td>${formatNumber(c.views)}</td>
        <td>${formatNumber(c.clicks)}</td>
        <td>${c.cvr}%</td>
      </tr>
    `).join('');
  } else if (tbody) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">データがありません</td></tr>';
  }
}

// モックファネルデータ
function renderMockFunnelData() {
  const mockData = {
    funnel: [
      { stage: 'サイト訪問', count: 5000, rate: '100' },
      { stage: '企業ページ閲覧', count: 2500, rate: '50.0' },
      { stage: 'ページスクロール', count: 1800, rate: '36.0' },
      { stage: 'アクション', count: 150, rate: '6.0' }
    ],
    actionBreakdown: [
      { label: '応募ボタン', count: 89 },
      { label: 'LINE相談', count: 45 },
      { label: 'フォーム送信', count: 16 }
    ],
    byCompany: [
      { domain: 'toyota', views: 1250, clicks: 89, cvr: '7.1' },
      { domain: 'nissan', views: 980, clicks: 67, cvr: '6.8' },
      { domain: 'honda', views: 856, clicks: 54, cvr: '6.3' }
    ]
  };
  renderFunnelData(mockData);
}

// 時系列データ読み込み
async function loadTrendData(days, apiEndpoint) {
  try {
    const headers = {};
    const idToken = getIdToken();
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = buildApiUrl(apiEndpoint, { type: 'trends', days });
    const response = await fetch(url, { headers });
    const result = await response.json();

    if (result.success && result.data) {
      renderTrendData(result.data);
    } else {
      renderMockTrendData();
    }
  } catch (error) {
    console.error('[Admin] Trend data error:', error);
    renderMockTrendData();
  }
}

// 時系列データ描画
function renderTrendData(data) {
  // ピーク情報
  if (data.insights) {
    updateElement('peak-day', data.insights.peakDay || '-');
    updateElement('peak-hour', data.insights.peakHour || '-');
  }

  // 曜日別チャート（Chart.js）
  const dayChartEl = document.getElementById('day-of-week-chart');
  if (dayChartEl && data.byDayOfWeek && data.byDayOfWeek.length > 0) {
    // 既存のチャートを破棄
    if (dayOfWeekChart) {
      dayOfWeekChart.destroy();
      dayOfWeekChart = null;
    }

    // Canvas要素を作成
    dayChartEl.innerHTML = '<canvas id="day-of-week-canvas"></canvas>';
    const canvas = document.getElementById('day-of-week-canvas');
    const ctx = canvas.getContext('2d');

    dayOfWeekChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.byDayOfWeek.map(d => d.day),
        datasets: [{
          label: 'セッション数',
          data: data.byDayOfWeek.map(d => d.sessions),
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            padding: 10,
            cornerRadius: 6,
            titleFont: { size: 12 },
            bodyFont: { size: 14, weight: 'bold' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 12 } }
          }
        }
      }
    });
  }

  // 時間帯別チャート（Chart.js）
  const hourChartEl = document.getElementById('hour-chart');
  if (hourChartEl && data.byHour && data.byHour.length > 0) {
    // 既存のチャートを破棄
    if (hourChart) {
      hourChart.destroy();
      hourChart = null;
    }

    const hourGroups = [
      { label: '深夜', hours: [0,1,2,3,4,5] },
      { label: '朝', hours: [6,7,8,9,10,11] },
      { label: '昼', hours: [12,13,14,15,16,17] },
      { label: '夜', hours: [18,19,20,21,22,23] }
    ];
    const groupedData = hourGroups.map(g => {
      const total = g.hours.reduce((sum, h) => {
        const found = data.byHour.find(d => d.hour === h);
        return sum + (found ? found.sessions : 0);
      }, 0);
      return { label: g.label, sessions: total };
    });

    // Canvas要素を作成
    hourChartEl.innerHTML = '<canvas id="hour-chart-canvas"></canvas>';
    const canvas = document.getElementById('hour-chart-canvas');
    const ctx = canvas.getContext('2d');

    hourChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: groupedData.map(g => g.label),
        datasets: [{
          label: 'セッション数',
          data: groupedData.map(g => g.sessions),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            padding: 10,
            cornerRadius: 6,
            titleFont: { size: 12 },
            bodyFont: { size: 14, weight: 'bold' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 12 } }
          }
        }
      }
    });
  }
}

// モック時系列データ
function renderMockTrendData() {
  updateElement('peak-day', '木');
  updateElement('peak-hour', '14時');

  const mockData = {
    byDayOfWeek: [
      { day: '日', sessions: 380 },
      { day: '月', sessions: 270 },
      { day: '火', sessions: 245 },
      { day: '水', sessions: 244 },
      { day: '木', sessions: 250 },
      { day: '金', sessions: 278 },
      { day: '土', sessions: 358 }
    ],
    byHour: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      sessions: Math.floor(Math.random() * 50) + 10
    }))
  };

  renderTrendData(mockData);
}

// ===== 企業詳細セクション機能 =====

// 現在表示中の企業情報
let currentCompanyDetail = { domain: '', name: '' };

// 企業詳細セクションを表示
export async function showCompanyDetailSection(domain, name) {
  currentCompanyDetail = { domain, name };

  // タイトル更新
  const titleEl = document.getElementById('company-detail-title');
  if (titleEl) titleEl.textContent = `${name} の分析`;

  // ページリンク更新
  const pageBtn = document.getElementById('detail-view-page-btn');
  if (pageBtn) pageBtn.href = `company.html?c=${domain}`;

  // セクション切り替え
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  const detailSection = document.getElementById('section-company-detail');
  if (detailSection) {
    detailSection.classList.add('active');
  }

  // ページタイトル更新
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = '企業詳細分析';
  }

  // サイドバーのactive状態をクリア
  document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.classList.remove('active');
  });

  // ローディング表示
  showDetailLoading(true);

  // データ取得
  const { days } = getDateRange();

  try {
    await loadCompanyDetailData(domain, days);
  } catch (error) {
    console.error('[Admin] Company detail error:', error);
    loadMockCompanyDetailData(domain, name);
  }
}

// 企業一覧に戻る
export function backToCompanies() {
  // セクション切り替え
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  const companiesSection = document.getElementById('section-companies');
  if (companiesSection) {
    companiesSection.classList.add('active');
  }

  // サイドバーのactive状態を更新
  document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.classList.remove('active');
  });
  const activeLink = document.querySelector('[data-section="companies"]');
  if (activeLink) {
    activeLink.parentElement.classList.add('active');
  }

  // ページタイトル更新
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = '企業別データ';
  }
}

// 企業詳細ローディング表示
function showDetailLoading(show) {
  const loadingHtml = '<div class="loading-placeholder">データを読み込み中...</div>';

  if (show) {
    document.querySelectorAll('.detail-stat-value').forEach(el => {
      el.textContent = '-';
    });
    document.querySelectorAll('.detail-chart').forEach(el => {
      el.innerHTML = loadingHtml;
    });
    document.querySelectorAll('.detail-table-container tbody').forEach(el => {
      el.innerHTML = '<tr><td colspan="4" class="loading-cell">データを読み込み中...</td></tr>';
    });
  }
}

// 企業詳細データを取得
async function loadCompanyDetailData(domain, days) {
  const apiEndpoint = config.apiEndpoint;
  const headers = {};
  const idToken = getIdToken();
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(`${apiEndpoint}?type=company-detail&domain=${domain}&days=${days}`, { headers });
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'API Error');
  }

  renderCompanyDetailData(result.data, domain);
}

// 企業詳細データを描画
async function renderCompanyDetailData(data, domain) {
  // サマリー更新
  const company = companyData.find(c => c.domain === domain) || {};
  const totalViews = data.summary?.totalViews || company.views || 0;
  const totalClicks = company.clicks || 0;
  const cvr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : 0;
  const avgDaily = data.summary?.avgDailyViews || 0;

  updateElement('detail-total-views', formatNumber(totalViews));
  updateElement('detail-total-clicks', formatNumber(totalClicks));
  updateElement('detail-cvr', `${cvr}%`);
  updateElement('detail-avg-daily', formatNumber(Math.round(avgDaily)));

  // 日別チャート
  renderDetailDailyChart(data.daily || []);

  // 流入元チャート
  renderDetailTrafficChart(data.traffic || []);

  // 性別チャート（Google Signalsデータを使用）
  const genderData = data.gender || {};
  renderDetailGenderChart({
    male: genderData.male || 0,
    female: genderData.female || 0,
    other: genderData.unknown || 0
  });

  // 年齢層チャート（Google Signalsデータを使用）
  // GA4の年齢層: 18-24, 25-34, 35-44, 45-54, 55-64, 65+
  const ageData = data.age || {};
  const convertedAge = convertGAAgeBrackets(ageData);
  renderDetailAgeChart(convertedAge);

  // 求人別データ（GA4のjobsデータを使用）
  const jobsData = data.jobs || [];
  if (jobsData.length > 0) {
    // 求人チャート用データ
    const jobChartData = jobsData.slice(0, 5).map(job => ({
      title: job.jobTitle || job.pagePath || '不明',
      applications: job.applications || 0
    }));
    renderDetailJobChart(jobChartData);

    // 求人テーブル用データ
    const jobTableData = jobsData.map(job => ({
      title: job.jobTitle || job.pagePath || '不明',
      views: job.views || 0,
      applications: job.applications || 0,
      cvr: job.views > 0 ? ((job.applications || 0) / job.views * 100).toFixed(1) : '0.0'
    }));
    renderDetailJobTable(jobTableData);
  } else {
    renderDetailJobChart([]);
    renderDetailJobTable([]);
  }

  // 最近の応募データを取得
  await loadRecentApplications(domain);
}

// GA4の年齢層フォーマットを変換
function convertGAAgeBrackets(gaAge) {
  // GA4形式: 18-24, 25-34, 35-44, 45-54, 55-64, 65+
  // 内部形式: 20s, 30s, 40s, 50s
  return {
    '20s': (gaAge['18-24'] || 0) + (gaAge['25-34'] || 0),
    '30s': gaAge['35-44'] || 0,
    '40s': gaAge['45-54'] || 0,
    '50s': (gaAge['55-64'] || 0) + (gaAge['65+'] || 0)
  };
}

// モック企業詳細データ
function loadMockCompanyDetailData(domain, name) {
  const company = companyData.find(c => c.domain === domain) || { views: 1000, clicks: 50 };
  const totalViews = company.views;
  const totalClicks = company.clicks;
  const cvr = ((totalClicks / totalViews) * 100).toFixed(1);

  updateElement('detail-total-views', formatNumber(totalViews));
  updateElement('detail-total-clicks', formatNumber(totalClicks));
  updateElement('detail-cvr', `${cvr}%`);
  updateElement('detail-avg-daily', formatNumber(Math.round(totalViews / 30)));

  // モック日別データ
  const mockDaily = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    mockDaily.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      views: Math.floor(20 + Math.random() * 60)
    });
  }
  renderDetailDailyChart(mockDaily);

  // モック求人別データ
  const mockJobs = [
    { title: '製造スタッフ', applications: 23 },
    { title: '組立作業員', applications: 18 },
    { title: '検査・検品', applications: 12 },
    { title: '機械オペレーター', applications: 8 },
    { title: 'フォークリフト', applications: 5 }
  ];
  renderDetailJobChart(mockJobs);

  // モック流入元データ
  const mockTraffic = [
    { channel: 'Organic Search', count: Math.floor(totalViews * 0.45) },
    { channel: 'Direct', count: Math.floor(totalViews * 0.28) },
    { channel: 'Social', count: Math.floor(totalViews * 0.18) },
    { channel: 'Referral', count: Math.floor(totalViews * 0.09) }
  ];
  renderDetailTrafficChart(mockTraffic);

  // モック性別データ
  const mockGender = {
    male: Math.floor(totalClicks * 0.72),
    female: Math.floor(totalClicks * 0.25),
    other: Math.floor(totalClicks * 0.03)
  };
  renderDetailGenderChart(mockGender);

  // モック年齢層データ
  const mockAge = {
    '20s': Math.floor(totalClicks * 0.35),
    '30s': Math.floor(totalClicks * 0.32),
    '40s': Math.floor(totalClicks * 0.23),
    '50s': Math.floor(totalClicks * 0.10)
  };
  renderDetailAgeChart(mockAge);

  // モック求人テーブル
  renderDetailJobTable(mockJobs.map(j => ({
    ...j,
    views: Math.floor(totalViews * (j.applications / totalClicks)),
    cvr: ((j.applications / (totalViews * (j.applications / totalClicks))) * 100).toFixed(1)
  })));

  // 最近の応募はFirestoreから取得
  loadRecentApplications(domain);
}

// 日別チャート描画（Chart.js）
function renderDetailDailyChart(data) {
  const chartEl = document.getElementById('detail-daily-chart');
  if (!chartEl || !data.length) {
    if (chartEl) chartEl.innerHTML = createEmptyState({
      icon: '📈',
      title: '日別データがありません',
      description: '選択期間のデータがまだ記録されていません'
    });
    return;
  }

  // 既存のチャートを破棄
  if (detailDailyChart) {
    detailDailyChart.destroy();
    detailDailyChart = null;
  }

  // Canvas要素を作成
  chartEl.innerHTML = '<canvas id="detail-daily-canvas"></canvas>';
  const canvas = document.getElementById('detail-daily-canvas');
  const ctx = canvas.getContext('2d');

  detailDailyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'PV',
        data: data.map(d => d.views),
        borderColor: 'rgba(99, 102, 241, 1)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.9)',
          padding: 8,
          cornerRadius: 4
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 45 }
        }
      }
    }
  });
}

// 求人別チャート描画
function renderDetailJobChart(data) {
  const chartEl = document.getElementById('detail-job-chart');
  if (!chartEl) return;

  if (!data.length) {
    chartEl.innerHTML = createEmptyState({
      icon: '💼',
      title: '求人データがありません',
      description: '表示できる求人別データがまだありません'
    });
    return;
  }

  const maxApps = Math.max(...data.map(d => d.applications));

  chartEl.innerHTML = `
    <div class="detail-bar-chart">
      ${data.slice(0, 5).map((d, i) => {
        const widthPercent = maxApps > 0 ? (d.applications / maxApps) * 100 : 0;
        return `
          <div class="detail-bar-row">
            <span class="detail-bar-label" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</span>
            <div class="detail-bar-track">
              <div class="detail-bar-fill job-${i + 1}" style="width: ${widthPercent}%"></div>
              <span class="detail-bar-value">${d.applications}件</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 流入元チャート描画
function renderDetailTrafficChart(data) {
  const chartEl = document.getElementById('detail-traffic-chart');
  if (!chartEl) return;

  if (!data.length) {
    chartEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
    return;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const colors = ['organic', 'direct', 'social', 'referral'];

  // グラデーション用の角度計算
  let gradientStops = [];
  let currentAngle = 0;
  data.forEach((d, i) => {
    const percent = (d.count / total) * 100;
    const colorClass = colors[i % colors.length];
    const colorMap = { organic: '#10b981', direct: '#6366f1', social: '#f59e0b', referral: '#8b5cf6' };
    gradientStops.push(`${colorMap[colorClass]} ${currentAngle}deg ${currentAngle + (percent * 3.6)}deg`);
    currentAngle += percent * 3.6;
  });

  chartEl.innerHTML = `
    <div class="detail-pie-chart">
      <div class="pie-visual" style="background: conic-gradient(${gradientStops.join(', ')});"></div>
      <div class="pie-legend">
        ${data.map((d, i) => {
          const percent = ((d.count / total) * 100).toFixed(1);
          return `
            <div class="pie-legend-item">
              <span class="pie-color ${colors[i % colors.length]}"></span>
              <span class="pie-label">${escapeHtml(d.channel)}</span>
              <span class="pie-value">${percent}%</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 性別チャート描画
function renderDetailGenderChart(data) {
  const chartEl = document.getElementById('detail-gender-chart');
  if (!chartEl) return;

  const total = data.male + data.female + data.other;
  if (total === 0) {
    chartEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
    return;
  }

  const malePercent = ((data.male / total) * 100).toFixed(1);
  const femalePercent = ((data.female / total) * 100).toFixed(1);
  const otherPercent = ((data.other / total) * 100).toFixed(1);

  const maleAngle = (data.male / total) * 360;
  const femaleAngle = (data.female / total) * 360;

  chartEl.innerHTML = `
    <div class="detail-pie-chart">
      <div class="pie-visual" style="background: conic-gradient(#3b82f6 0deg ${maleAngle}deg, #ec4899 ${maleAngle}deg ${maleAngle + femaleAngle}deg, #94a3b8 ${maleAngle + femaleAngle}deg 360deg);"></div>
      <div class="pie-legend">
        <div class="pie-legend-item">
          <span class="pie-color male"></span>
          <span class="pie-label">男性</span>
          <span class="pie-value">${data.male}人 (${malePercent}%)</span>
        </div>
        <div class="pie-legend-item">
          <span class="pie-color female"></span>
          <span class="pie-label">女性</span>
          <span class="pie-value">${data.female}人 (${femalePercent}%)</span>
        </div>
        <div class="pie-legend-item">
          <span class="pie-color other"></span>
          <span class="pie-label">その他</span>
          <span class="pie-value">${data.other}人 (${otherPercent}%)</span>
        </div>
      </div>
    </div>
  `;
}

// 年齢層チャート描画
function renderDetailAgeChart(data) {
  const chartEl = document.getElementById('detail-age-chart');
  if (!chartEl) return;

  const total = data['20s'] + data['30s'] + data['40s'] + data['50s'];
  if (total === 0) {
    chartEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
    return;
  }

  const ages = [
    { key: '20s', label: '20代', color: 'age-20s', colorCode: '#3b82f6' },
    { key: '30s', label: '30代', color: 'age-30s', colorCode: '#10b981' },
    { key: '40s', label: '40代', color: 'age-40s', colorCode: '#f59e0b' },
    { key: '50s', label: '50代以上', color: 'age-50s', colorCode: '#ef4444' }
  ];

  let gradientStops = [];
  let currentAngle = 0;
  ages.forEach(age => {
    const percent = (data[age.key] / total) * 100;
    gradientStops.push(`${age.colorCode} ${currentAngle}deg ${currentAngle + (percent * 3.6)}deg`);
    currentAngle += percent * 3.6;
  });

  chartEl.innerHTML = `
    <div class="detail-pie-chart">
      <div class="pie-visual" style="background: conic-gradient(${gradientStops.join(', ')});"></div>
      <div class="pie-legend">
        ${ages.map(age => {
          const percent = ((data[age.key] / total) * 100).toFixed(1);
          return `
            <div class="pie-legend-item">
              <span class="pie-color ${age.color}"></span>
              <span class="pie-label">${age.label}</span>
              <span class="pie-value">${data[age.key]}人 (${percent}%)</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 求人別テーブル描画
function renderDetailJobTable(data) {
  const tbody = document.querySelector('#detail-job-table tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(job => `
    <tr>
      <td>${escapeHtml(job.title)}</td>
      <td>${formatNumber(job.views)}</td>
      <td>${job.applications}</td>
      <td>${job.cvr}%</td>
    </tr>
  `).join('');
}

// Firestoreから最近の応募データを取得
async function loadRecentApplications(domain) {
  const apiEndpoint = config.apiEndpoint;
  const headers = {};
  const idToken = getIdToken();
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  try {
    const response = await fetch(`${apiEndpoint}?type=recent-applications&domain=${domain}&limit=10`, { headers });
    const result = await response.json();

    if (result.success && result.data && result.data.applications) {
      const applications = result.data.applications.map(app => ({
        date: app.date,
        job: app.jobTitle || '-',
        type: app.type || 'apply',
        source: app.source || 'Direct'
      }));
      renderDetailRecentApplications(applications);
    } else {
      renderDetailRecentApplications([]);
    }
  } catch (error) {
    console.error('[Admin] Recent applications error:', error);
    renderDetailRecentApplications([]);
  }
}

// 最近の応募テーブル描画
function renderDetailRecentApplications(data) {
  const tbody = document.querySelector('#detail-recent-applications tbody');
  if (!tbody) return;

  const typeLabels = {
    apply: '応募',
    line: 'LINE',
    consult: '相談'
  };

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(app => `
    <tr>
      <td>${escapeHtml(app.date)}</td>
      <td>${escapeHtml(app.job)}</td>
      <td><span class="type-badge ${app.type}">${typeLabels[app.type] || app.type}</span></td>
      <td>${escapeHtml(app.source)}</td>
    </tr>
  `).join('');
}

// 企業詳細セクションのイベント初期化
export function initCompanyDetailSection() {
  // 戻るボタン（動的読み込み対応: 重複登録防止）
  const backBtn = document.getElementById('btn-back-to-companies');
  if (backBtn && !backBtn.hasAttribute('data-listener-attached')) {
    backBtn.addEventListener('click', backToCompanies);
    backBtn.setAttribute('data-listener-attached', 'true');
  }
}

// ========================================
// 採用管理タブ（admin専用）
// ========================================

// 採用管理データのキャッシュ（ドリルダウン用）
let recruitmentApplicationsCache = [];

/**
 * 採用管理データを読み込み
 */
async function loadRecruitmentManagementData() {
  try {
    // Firestoreから応募者データを取得
    const db = firebase.firestore();
    const snapshot = await db.collection('applications')
      .orderBy('createdAt', 'desc')
      .get();

    const applications = [];
    snapshot.forEach(doc => {
      applications.push({ id: doc.id, ...doc.data() });
    });

    // キャッシュに保存
    recruitmentApplicationsCache = applications;

    // アラートとファネルを描画
    renderRecruitmentAlerts(applications);
    renderRecruitmentFunnel(applications);
    renderLeadTimeStats(applications);
    renderLeadTimeDistribution(applications);
    renderAssigneePerformance(applications);
    renderCompanyRecruitmentTable(applications);

    // 戻るボタンのイベント設定
    initRecruitmentDetailEvents();

  } catch (error) {
    console.error('[Admin] Failed to load recruitment data:', error);
    const alertsContainer = document.getElementById('recruitment-alerts');
    if (alertsContainer) {
      alertsContainer.innerHTML = '<div class="error-message">データの読み込みに失敗しました</div>';
    }
  }
}

/**
 * 対応アラートを描画
 * 48時間以上未対応の応募者を表示
 */
function renderRecruitmentAlerts(applications) {
  const container = document.getElementById('recruitment-alerts');
  if (!container) return;

  const now = new Date();
  const alertThreshold = 48 * 60 * 60 * 1000; // 48時間

  // 新規ステータスで48時間以上経過した応募者を抽出
  const delayedApps = applications.filter(app => {
    if (app.status !== 'new' && app.status !== undefined) return false;
    const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
    const elapsed = now - createdAt;
    return elapsed > alertThreshold;
  });

  if (delayedApps.length === 0) {
    container.innerHTML = '<div class="no-alerts"><span class="alert-icon">✓</span> 対応が必要なアラートはありません</div>';
    return;
  }

  container.innerHTML = delayedApps.map(app => {
    const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
    const elapsed = Math.floor((now - createdAt) / (1000 * 60 * 60));
    const applicantName = app.applicantName || app.applicant?.name || '名前未設定';
    const companyName = app.companyName || app.companyDomain || '-';

    return `
      <div class="alert-card alert-warning">
        <div class="alert-header">
          <span class="alert-icon">⚠️</span>
          <span class="alert-title">${escapeHtml(applicantName)} - ${escapeHtml(app.jobTitle || '求人未設定')}</span>
        </div>
        <div class="alert-body">
          <p>企業: ${escapeHtml(companyName)}</p>
          <p>応募から <strong>${elapsed}時間</strong> 経過（初回連絡未完了）</p>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 採用ファネルを描画
 */
function renderRecruitmentFunnel(applications) {
  const container = document.getElementById('recruitment-funnel-chart');
  const statsContainer = document.getElementById('funnel-stats');
  if (!container) return;

  // 期間フィルター取得
  const periodSelect = document.getElementById('funnel-period');
  const days = parseInt(periodSelect?.value || '30');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // 期間内のデータをフィルター
  const filteredApps = applications.filter(app => {
    const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
    return createdAt >= cutoffDate;
  });

  // ステータス別カウント
  const statusCounts = {
    total: filteredApps.length,
    new: 0,
    contacted: 0,
    interviewing: 0,
    interviewed: 0,
    hired: 0,
    joined: 0
  };

  filteredApps.forEach(app => {
    const status = app.status || 'new';
    // ステータスを累積でカウント
    if (['new', 'contacted', 'interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.new++;
    }
    if (['contacted', 'interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.contacted++;
    }
    if (['interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.interviewing++;
    }
    if (['interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.interviewed++;
    }
    if (['hired', 'joined'].includes(status)) {
      statusCounts.hired++;
    }
    if (status === 'joined') {
      statusCounts.joined++;
    }
  });

  // ファネルチャートを描画
  const stages = [
    { label: '応募', count: statusCounts.new, color: '#3b82f6' },
    { label: '連絡済', count: statusCounts.contacted, color: '#8b5cf6' },
    { label: '面接', count: statusCounts.interviewing + statusCounts.interviewed, color: '#f59e0b' },
    { label: '内定', count: statusCounts.hired, color: '#10b981' },
    { label: '入社', count: statusCounts.joined, color: '#059669' }
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  container.innerHTML = `
    <div class="funnel-stages">
      ${stages.map((stage, index) => {
        const width = Math.max((stage.count / maxCount) * 100, 10);
        const rate = index === 0 ? 100 : (stages[0].count > 0 ? (stage.count / stages[0].count * 100).toFixed(1) : 0);
        return `
          <div class="funnel-stage">
            <div class="funnel-label">${stage.label}</div>
            <div class="funnel-bar-wrapper">
              <div class="funnel-bar" style="width: ${width}%; background: ${stage.color};">
                <span class="funnel-count">${formatNumber(stage.count)}</span>
              </div>
            </div>
            <div class="funnel-rate">${rate}%</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // ファネル統計を描画
  if (statsContainer) {
    const conversionRate = statusCounts.new > 0
      ? ((statusCounts.hired / statusCounts.new) * 100).toFixed(1)
      : 0;
    const joinRate = statusCounts.hired > 0
      ? ((statusCounts.joined / statusCounts.hired) * 100).toFixed(1)
      : 0;

    statsContainer.innerHTML = `
      <div class="funnel-stat-card">
        <div class="funnel-stat-value">${conversionRate}%</div>
        <div class="funnel-stat-label">応募→内定率</div>
      </div>
      <div class="funnel-stat-card">
        <div class="funnel-stat-value">${joinRate}%</div>
        <div class="funnel-stat-label">内定→入社率</div>
      </div>
    `;
  }

  // 期間変更時のイベントリスナー
  if (periodSelect && !periodSelect.hasAttribute('data-listener-attached')) {
    periodSelect.addEventListener('change', () => {
      loadRecruitmentManagementData();
    });
    periodSelect.setAttribute('data-listener-attached', 'true');
  }
}

/**
 * リードタイム統計を描画
 */
function renderLeadTimeStats(applications) {
  // ステータス遷移履歴がある応募者のみ対象
  const appsWithHistory = applications.filter(app => app.statusHistory && app.statusHistory.length > 0);

  // 各リードタイムを計算
  const leadTimes = {
    firstResponse: [],
    interviewSetup: [],
    decision: [],
    total: []
  };

  appsWithHistory.forEach(app => {
    const history = app.statusHistory;
    const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);

    // 初回レスポンス（new → contacted）
    const contactedEntry = history.find(h => h.status === 'contacted');
    if (contactedEntry) {
      const contactedAt = contactedEntry.timestamp?.toDate ? contactedEntry.timestamp.toDate() : new Date(contactedEntry.timestamp);
      leadTimes.firstResponse.push((contactedAt - createdAt) / (1000 * 60 * 60)); // 時間
    }

    // 面談設定（contacted → interviewing）
    const interviewingEntry = history.find(h => h.status === 'interviewing');
    if (contactedEntry && interviewingEntry) {
      const contactedAt = contactedEntry.timestamp?.toDate ? contactedEntry.timestamp.toDate() : new Date(contactedEntry.timestamp);
      const interviewingAt = interviewingEntry.timestamp?.toDate ? interviewingEntry.timestamp.toDate() : new Date(interviewingEntry.timestamp);
      leadTimes.interviewSetup.push((interviewingAt - contactedAt) / (1000 * 60 * 60 * 24)); // 日
    }

    // 選考判断（interviewed → hired/ng）
    const interviewedEntry = history.find(h => h.status === 'interviewed');
    const decisionEntry = history.find(h => h.status === 'hired' || h.status === 'ng' || h.status === 'rejected');
    if (interviewedEntry && decisionEntry) {
      const interviewedAt = interviewedEntry.timestamp?.toDate ? interviewedEntry.timestamp.toDate() : new Date(interviewedEntry.timestamp);
      const decisionAt = decisionEntry.timestamp?.toDate ? decisionEntry.timestamp.toDate() : new Date(decisionEntry.timestamp);
      leadTimes.decision.push((decisionAt - interviewedAt) / (1000 * 60 * 60 * 24)); // 日
    }

    // 全体（new → joined）
    const joinedEntry = history.find(h => h.status === 'joined');
    if (joinedEntry) {
      const joinedAt = joinedEntry.timestamp?.toDate ? joinedEntry.timestamp.toDate() : new Date(joinedEntry.timestamp);
      leadTimes.total.push((joinedAt - createdAt) / (1000 * 60 * 60 * 24)); // 日
    }
  });

  // 平均を計算
  const calcAvg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const avgFirstResponse = calcAvg(leadTimes.firstResponse);
  const avgInterviewSetup = calcAvg(leadTimes.interviewSetup);
  const avgDecision = calcAvg(leadTimes.decision);
  const avgTotal = calcAvg(leadTimes.total);

  // 表示を更新
  const updateEl = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  updateEl('lead-time-first-response', avgFirstResponse !== null ? `${avgFirstResponse.toFixed(1)}時間` : '-');
  updateEl('lead-time-interview-setup', avgInterviewSetup !== null ? `${avgInterviewSetup.toFixed(1)}日` : '-');
  updateEl('lead-time-decision', avgDecision !== null ? `${avgDecision.toFixed(1)}日` : '-');
  updateEl('lead-time-total', avgTotal !== null ? `${avgTotal.toFixed(1)}日` : '-');
}

/**
 * リードタイム分布グラフを描画
 */
function renderLeadTimeDistribution(applications) {
  const container = document.getElementById('lead-time-distribution-chart');
  if (!container) return;

  // statusHistoryがある応募者から初回レスポンス時間を計算
  const responseTimes = [];
  applications.forEach(app => {
    if (!app.statusHistory || app.statusHistory.length === 0) return;

    const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
    const contactedEntry = app.statusHistory.find(h => h.status === 'contacted');

    if (contactedEntry) {
      const contactedAt = contactedEntry.timestamp?.toDate
        ? contactedEntry.timestamp.toDate()
        : new Date(contactedEntry.timestamp);
      const hours = (contactedAt - createdAt) / (1000 * 60 * 60);
      if (hours >= 0) {
        responseTimes.push(hours);
      }
    }
  });

  // 分布を計算（0-6h, 6-12h, 12-24h, 24-48h, 48h+）
  const buckets = [
    { label: '0-6h', min: 0, max: 6, count: 0, class: '' },
    { label: '6-12h', min: 6, max: 12, count: 0, class: '' },
    { label: '12-24h', min: 12, max: 24, count: 0, class: 'warning' },
    { label: '24-48h', min: 24, max: 48, count: 0, class: 'warning' },
    { label: '48h+', min: 48, max: Infinity, count: 0, class: 'danger' }
  ];

  responseTimes.forEach(time => {
    for (const bucket of buckets) {
      if (time >= bucket.min && time < bucket.max) {
        bucket.count++;
        break;
      }
    }
  });

  const total = responseTimes.length;
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  if (total === 0) {
    container.innerHTML = '<div class="no-data">レスポンスデータがまだありません</div>';
    return;
  }

  container.innerHTML = `
    <div class="distribution-bars">
      ${buckets.map(bucket => {
        const percentage = total > 0 ? ((bucket.count / total) * 100).toFixed(0) : 0;
        const height = maxCount > 0 ? Math.max((bucket.count / maxCount) * 150, 4) : 4;
        return `
          <div class="distribution-bar-group">
            <div class="distribution-bar ${bucket.class}" style="height: ${height}px;">
              <span class="distribution-bar-value">${percentage}%</span>
            </div>
            <div class="distribution-bar-label">${bucket.label}</div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="distribution-legend">
      <div class="distribution-legend-item">
        <span class="distribution-legend-color good"></span>
        <span>理想（12h以内）</span>
      </div>
      <div class="distribution-legend-item">
        <span class="distribution-legend-color warning"></span>
        <span>注意（12-48h）</span>
      </div>
      <div class="distribution-legend-item">
        <span class="distribution-legend-color danger"></span>
        <span>要改善（48h+）</span>
      </div>
    </div>
  `;
}

/**
 * 担当者別パフォーマンスを描画
 */
function renderAssigneePerformance(applications) {
  const tbody = document.querySelector('#assignee-performance-table tbody');
  if (!tbody) return;

  // 担当者ごとに集計
  const assigneeStats = {};

  applications.forEach(app => {
    // 担当者名を取得（assignee, handler, 担当者 など複数フィールドに対応）
    const assignee = app.assignee || app.handler || app.担当者 || '未割当';

    if (!assigneeStats[assignee]) {
      assigneeStats[assignee] = {
        name: assignee,
        total: 0,
        contacted: 0,
        hired: 0,
        joined: 0,
        responseTimes: []
      };
    }

    assigneeStats[assignee].total++;
    const status = app.status || 'new';

    // 連絡済み以降のステータスをカウント
    if (['contacted', 'interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      assigneeStats[assignee].contacted++;
    }
    if (['hired', 'joined'].includes(status)) {
      assigneeStats[assignee].hired++;
    }
    if (status === 'joined') {
      assigneeStats[assignee].joined++;
    }

    // レスポンス時間を計算
    if (app.statusHistory && app.statusHistory.length > 0) {
      const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
      const contactedEntry = app.statusHistory.find(h => h.status === 'contacted');
      if (contactedEntry) {
        const contactedAt = contactedEntry.timestamp?.toDate
          ? contactedEntry.timestamp.toDate()
          : new Date(contactedEntry.timestamp);
        const hours = (contactedAt - createdAt) / (1000 * 60 * 60);
        if (hours >= 0) {
          assigneeStats[assignee].responseTimes.push(hours);
        }
      }
    }
  });

  // 平均を計算して配列に変換
  const sortedAssignees = Object.values(assigneeStats)
    .map(stat => {
      const avgResponse = stat.responseTimes.length > 0
        ? stat.responseTimes.reduce((a, b) => a + b, 0) / stat.responseTimes.length
        : null;
      const hiringRate = stat.total > 0 ? (stat.hired / stat.total) * 100 : 0;
      const acceptanceRate = stat.hired > 0 ? (stat.joined / stat.hired) * 100 : 0;

      return {
        ...stat,
        avgResponse,
        hiringRate,
        acceptanceRate
      };
    })
    .sort((a, b) => b.total - a.total);

  if (sortedAssignees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">データがありません</td></tr>';
    return;
  }

  // パフォーマンスクラスを判定
  const getResponseClass = (hours) => {
    if (hours === null) return '';
    if (hours <= 12) return 'performance-good';
    if (hours <= 24) return 'performance-warning';
    return 'performance-danger';
  };

  const getRateClass = (rate) => {
    if (rate >= 40) return 'performance-good';
    if (rate >= 25) return 'performance-warning';
    return 'performance-danger';
  };

  tbody.innerHTML = sortedAssignees.map(stat => {
    const responseDisplay = stat.avgResponse !== null
      ? `${stat.avgResponse.toFixed(1)}時間`
      : '-';

    return `
      <tr>
        <td>${escapeHtml(stat.name)}</td>
        <td>${formatNumber(stat.total)}</td>
        <td class="${getResponseClass(stat.avgResponse)}">${responseDisplay}</td>
        <td class="${getRateClass(stat.hiringRate)}">${stat.hiringRate.toFixed(1)}%</td>
        <td class="${getRateClass(stat.acceptanceRate)}">${stat.acceptanceRate.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');
}

/**
 * 企業別採用状況をカード形式で描画
 */
function renderCompanyRecruitmentTable(applications) {
  const container = document.getElementById('recruitment-company-cards');
  if (!container) return;

  // 企業ごとに集計
  const companyStats = {};

  applications.forEach(app => {
    const companyKey = app.companyDomain || 'unknown';
    const companyName = app.companyName || app.companyDomain || '不明';

    if (!companyStats[companyKey]) {
      companyStats[companyKey] = {
        domain: companyKey,
        name: companyName,
        total: 0,
        interviewing: 0,
        hired: 0,
        joined: 0,
        applications: []
      };
    }

    companyStats[companyKey].total++;
    companyStats[companyKey].applications.push(app);
    const status = app.status || 'new';
    if (['interviewing', 'interviewed'].includes(status)) {
      companyStats[companyKey].interviewing++;
    }
    if (['hired', 'joined'].includes(status)) {
      companyStats[companyKey].hired++;
    }
    if (status === 'joined') {
      companyStats[companyKey].joined++;
    }
  });

  const sortedCompanies = Object.values(companyStats).sort((a, b) => b.total - a.total);

  if (sortedCompanies.length === 0) {
    container.innerHTML = createEmptyState({
      icon: '🏢',
      title: '企業別採用データがありません',
      description: '応募データがまだありません'
    });
    return;
  }

  container.innerHTML = sortedCompanies.map(company => {
    const passRate = company.total > 0
      ? ((company.hired / company.total) * 100).toFixed(1)
      : 0;
    const passRateClass = passRate >= 30 ? 'high' : (passRate >= 15 ? 'medium' : 'low');

    return `
      <div class="recruitment-company-card" data-company-domain="${escapeHtml(company.domain)}" data-company-name="${escapeHtml(company.name)}">
        <div class="recruitment-card-header">
          <div class="recruitment-card-title">
            <span class="company-icon">🏢</span>
            <h4>${escapeHtml(company.name)}</h4>
          </div>
          <button class="recruitment-card-toggle" aria-expanded="false">
            <span class="toggle-icon">▼</span>
          </button>
        </div>
        <div class="recruitment-card-stats">
          <div class="recruitment-stat">
            <span class="recruitment-stat-value">${formatNumber(company.total)}</span>
            <span class="recruitment-stat-label">応募</span>
          </div>
          <div class="recruitment-stat">
            <span class="recruitment-stat-value">${formatNumber(company.interviewing)}</span>
            <span class="recruitment-stat-label">面接</span>
          </div>
          <div class="recruitment-stat">
            <span class="recruitment-stat-value">${formatNumber(company.hired)}</span>
            <span class="recruitment-stat-label">内定</span>
          </div>
          <div class="recruitment-stat">
            <span class="recruitment-stat-value">${formatNumber(company.joined)}</span>
            <span class="recruitment-stat-label">入社</span>
          </div>
          <div class="recruitment-stat highlight ${passRateClass}">
            <span class="recruitment-stat-value">${passRate}%</span>
            <span class="recruitment-stat-label">通過率</span>
          </div>
        </div>
        <div class="recruitment-card-detail" style="display: none;">
          <div class="recruitment-detail-loading">
            <div class="loading-placeholder">詳細データを読み込み中...</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // アコーディオン展開イベントを追加
  container.querySelectorAll('.recruitment-company-card').forEach(card => {
    const toggleBtn = card.querySelector('.recruitment-card-toggle');
    const header = card.querySelector('.recruitment-card-header');
    const detail = card.querySelector('.recruitment-card-detail');

    const toggleCard = () => {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';

      // 他のカードを閉じる
      container.querySelectorAll('.recruitment-company-card').forEach(otherCard => {
        if (otherCard !== card) {
          const otherToggle = otherCard.querySelector('.recruitment-card-toggle');
          const otherDetail = otherCard.querySelector('.recruitment-card-detail');
          otherToggle.setAttribute('aria-expanded', 'false');
          otherDetail.style.display = 'none';
          otherCard.classList.remove('expanded');
        }
      });

      if (!isExpanded) {
        // 展開
        toggleBtn.setAttribute('aria-expanded', 'true');
        detail.style.display = 'block';
        card.classList.add('expanded');

        // 詳細データを読み込み
        const domain = card.dataset.companyDomain;
        const name = card.dataset.companyName;
        loadCompanyRecruitmentDetailInline(domain, name, detail, applications);
      } else {
        // 閉じる
        toggleBtn.setAttribute('aria-expanded', 'false');
        detail.style.display = 'none';
        card.classList.remove('expanded');
      }
    };

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCard();
    });

    header.addEventListener('click', toggleCard);
  });
}

/**
 * 企業別採用詳細をカード内に読み込み（インライン表示）
 */
function loadCompanyRecruitmentDetailInline(companyDomain, companyName, detailContainer, allApplications) {
  // この企業の応募データをフィルタ
  const companyApps = allApplications.filter(app =>
    (app.companyDomain || 'unknown') === companyDomain
  );

  // ファネルデータを計算
  const funnelData = calculateCompanyFunnel(companyApps);

  // リードタイムを計算
  const leadTimeData = calculateCompanyLeadTime(companyApps);

  // 担当者別パフォーマンスを計算
  const assigneeData = calculateAssigneePerformance(companyApps);

  detailContainer.innerHTML = `
    <div class="recruitment-detail-content">
      <!-- 採用ファネル -->
      <div class="recruitment-detail-section">
        <h5>採用ファネル</h5>
        <div class="mini-funnel">
          ${renderMiniFunnel(funnelData)}
        </div>
      </div>

      <!-- リードタイム -->
      <div class="recruitment-detail-section">
        <h5>リードタイム</h5>
        <div class="lead-time-mini-grid">
          <div class="lead-time-mini-item">
            <span class="mini-icon">⏱️</span>
            <span class="mini-value">${leadTimeData.firstResponse}</span>
            <span class="mini-label">初回レスポンス</span>
          </div>
          <div class="lead-time-mini-item">
            <span class="mini-icon">📅</span>
            <span class="mini-value">${leadTimeData.interviewSetup}</span>
            <span class="mini-label">面談設定</span>
          </div>
          <div class="lead-time-mini-item">
            <span class="mini-icon">📋</span>
            <span class="mini-value">${leadTimeData.decision}</span>
            <span class="mini-label">選考判断</span>
          </div>
          <div class="lead-time-mini-item">
            <span class="mini-icon">🎯</span>
            <span class="mini-value">${leadTimeData.total}</span>
            <span class="mini-label">全体</span>
          </div>
        </div>
      </div>

      <!-- 担当者別 -->
      ${assigneeData.length > 0 ? `
      <div class="recruitment-detail-section">
        <h5>担当者別パフォーマンス</h5>
        <div class="mini-assignee-list">
          ${assigneeData.map(a => `
            <div class="mini-assignee-item">
              <span class="assignee-name">${escapeHtml(a.name)}</span>
              <span class="assignee-stat">${a.count}件</span>
              <span class="assignee-stat">${a.responseTime}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * ミニファネルをレンダリング
 */
function renderMiniFunnel(data) {
  const stages = [
    { name: '応募', count: data.total, color: '#e0e7ff' },
    { name: '面接', count: data.interviewing, color: '#c7d2fe' },
    { name: '内定', count: data.hired, color: '#a5b4fc' },
    { name: '入社', count: data.joined, color: '#6366f1' }
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return stages.map((stage, i) => {
    const width = Math.max((stage.count / maxCount) * 100, 10);
    const rate = i > 0 && stages[i-1].count > 0
      ? ((stage.count / stages[i-1].count) * 100).toFixed(0)
      : 100;
    return `
      <div class="mini-funnel-stage">
        <div class="mini-funnel-bar" style="width: ${width}%; background: ${stage.color};">
          <span class="mini-funnel-name">${stage.name}</span>
          <span class="mini-funnel-count">${stage.count}</span>
        </div>
        ${i > 0 ? `<span class="mini-funnel-rate">${rate}%</span>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * 企業別ファネルデータを計算
 */
function calculateCompanyFunnel(applications) {
  let total = applications.length;
  let interviewing = 0;
  let hired = 0;
  let joined = 0;

  applications.forEach(app => {
    const status = app.status || 'new';
    if (['interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      interviewing++;
    }
    if (['hired', 'joined'].includes(status)) {
      hired++;
    }
    if (status === 'joined') {
      joined++;
    }
  });

  return { total, interviewing, hired, joined };
}

/**
 * 企業別リードタイムを計算
 */
function calculateCompanyLeadTime(applications) {
  // 簡易計算（実データがある場合はより詳細に）
  let firstResponseTimes = [];
  let interviewSetupTimes = [];
  let decisionTimes = [];
  let totalTimes = [];

  applications.forEach(app => {
    if (app.statusHistory && Array.isArray(app.statusHistory)) {
      // ステータス履歴から計算（実装は省略、ダミーデータを返す）
    }
  });

  // ダミーデータ（実際はステータス履歴から計算）
  return {
    firstResponse: firstResponseTimes.length > 0 ? `${Math.round(average(firstResponseTimes))}時間` : '-',
    interviewSetup: interviewSetupTimes.length > 0 ? `${Math.round(average(interviewSetupTimes))}日` : '-',
    decision: decisionTimes.length > 0 ? `${Math.round(average(decisionTimes))}日` : '-',
    total: totalTimes.length > 0 ? `${Math.round(average(totalTimes))}日` : '-'
  };
}

/**
 * 担当者別パフォーマンスを計算
 */
function calculateAssigneePerformance(applications) {
  const assigneeStats = {};

  applications.forEach(app => {
    const assignee = app.assignee || '未割当';
    if (!assigneeStats[assignee]) {
      assigneeStats[assignee] = { name: assignee, count: 0 };
    }
    assigneeStats[assignee].count++;
  });

  return Object.values(assigneeStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(a => ({
      ...a,
      responseTime: '-' // 実際はステータス履歴から計算
    }));
}

/**
 * 配列の平均を計算
 */
function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 採用管理詳細ビューのイベント初期化（カード形式では不要だが互換性のため残す）
 */
function initRecruitmentDetailEvents() {
  // カード形式ではインライン展開するため、この関数は空
}

/**
 * 企業別採用詳細を表示（互換性のため残す、カード形式では使用しない）
 */
function showCompanyRecruitmentDetail(companyDomain, companyName) {
  // カード形式ではインライン展開するため、この関数は使用しない
  console.log('[Analytics] showCompanyRecruitmentDetail called but using inline expansion');
}

/**
 * 採用管理一覧に戻る
 */
function backToRecruitmentOverview() {
  const overviewSection = document.getElementById('recruitment-overview-section');
  const detailSection = document.getElementById('recruitment-detail-section');

  if (overviewSection) overviewSection.style.display = 'block';
  if (detailSection) detailSection.style.display = 'none';
}

/**
 * 企業別ファネルを描画
 */
function renderCompanyFunnel(applications) {
  const container = document.getElementById('company-funnel-chart');
  const statsContainer = document.getElementById('company-funnel-stats');
  if (!container) return;

  // ステータス別カウント
  const statusCounts = {
    total: applications.length,
    new: 0,
    contacted: 0,
    interviewing: 0,
    interviewed: 0,
    hired: 0,
    joined: 0
  };

  applications.forEach(app => {
    const status = app.status || 'new';
    if (['new', 'contacted', 'interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.new++;
    }
    if (['contacted', 'interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.contacted++;
    }
    if (['interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.interviewing++;
    }
    if (['interviewed', 'hired', 'joined'].includes(status)) {
      statusCounts.interviewed++;
    }
    if (['hired', 'joined'].includes(status)) {
      statusCounts.hired++;
    }
    if (status === 'joined') {
      statusCounts.joined++;
    }
  });

  const stages = [
    { label: '応募', count: statusCounts.new, color: '#3b82f6' },
    { label: '連絡済', count: statusCounts.contacted, color: '#8b5cf6' },
    { label: '面接', count: statusCounts.interviewing + statusCounts.interviewed, color: '#f59e0b' },
    { label: '内定', count: statusCounts.hired, color: '#10b981' },
    { label: '入社', count: statusCounts.joined, color: '#059669' }
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  container.innerHTML = `
    <div class="funnel-stages">
      ${stages.map((stage, index) => {
        const width = Math.max((stage.count / maxCount) * 100, 10);
        const rate = index === 0 ? 100 : (stages[0].count > 0 ? (stage.count / stages[0].count * 100).toFixed(1) : 0);
        return `
          <div class="funnel-stage">
            <div class="funnel-label">${stage.label}</div>
            <div class="funnel-bar-wrapper">
              <div class="funnel-bar" style="width: ${width}%; background: ${stage.color};">
                <span class="funnel-count">${formatNumber(stage.count)}</span>
              </div>
            </div>
            <div class="funnel-rate">${rate}%</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (statsContainer) {
    const conversionRate = statusCounts.new > 0
      ? ((statusCounts.hired / statusCounts.new) * 100).toFixed(1)
      : 0;
    const joinRate = statusCounts.hired > 0
      ? ((statusCounts.joined / statusCounts.hired) * 100).toFixed(1)
      : 0;

    statsContainer.innerHTML = `
      <div class="funnel-stat-card">
        <div class="funnel-stat-value">${conversionRate}%</div>
        <div class="funnel-stat-label">応募→内定率</div>
      </div>
      <div class="funnel-stat-card">
        <div class="funnel-stat-value">${joinRate}%</div>
        <div class="funnel-stat-label">内定→入社率</div>
      </div>
    `;
  }
}

/**
 * 企業別リードタイム統計を描画
 */
function renderCompanyLeadTimeStats(applications) {
  const appsWithHistory = applications.filter(app => app.statusHistory && app.statusHistory.length > 0);

  const leadTimes = {
    firstResponse: [],
    interviewSetup: [],
    decision: [],
    total: []
  };

  appsWithHistory.forEach(app => {
    const history = app.statusHistory;
    const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);

    const contactedEntry = history.find(h => h.status === 'contacted');
    if (contactedEntry) {
      const contactedAt = contactedEntry.timestamp?.toDate ? contactedEntry.timestamp.toDate() : new Date(contactedEntry.timestamp);
      leadTimes.firstResponse.push((contactedAt - createdAt) / (1000 * 60 * 60));
    }

    const interviewingEntry = history.find(h => h.status === 'interviewing');
    if (contactedEntry && interviewingEntry) {
      const contactedAt = contactedEntry.timestamp?.toDate ? contactedEntry.timestamp.toDate() : new Date(contactedEntry.timestamp);
      const interviewingAt = interviewingEntry.timestamp?.toDate ? interviewingEntry.timestamp.toDate() : new Date(interviewingEntry.timestamp);
      leadTimes.interviewSetup.push((interviewingAt - contactedAt) / (1000 * 60 * 60 * 24));
    }

    const interviewedEntry = history.find(h => h.status === 'interviewed');
    const decisionEntry = history.find(h => h.status === 'hired' || h.status === 'ng' || h.status === 'rejected');
    if (interviewedEntry && decisionEntry) {
      const interviewedAt = interviewedEntry.timestamp?.toDate ? interviewedEntry.timestamp.toDate() : new Date(interviewedEntry.timestamp);
      const decisionAt = decisionEntry.timestamp?.toDate ? decisionEntry.timestamp.toDate() : new Date(decisionEntry.timestamp);
      leadTimes.decision.push((decisionAt - interviewedAt) / (1000 * 60 * 60 * 24));
    }

    const joinedEntry = history.find(h => h.status === 'joined');
    if (joinedEntry) {
      const joinedAt = joinedEntry.timestamp?.toDate ? joinedEntry.timestamp.toDate() : new Date(joinedEntry.timestamp);
      leadTimes.total.push((joinedAt - createdAt) / (1000 * 60 * 60 * 24));
    }
  });

  const calcAvg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const avgFirstResponse = calcAvg(leadTimes.firstResponse);
  const avgInterviewSetup = calcAvg(leadTimes.interviewSetup);
  const avgDecision = calcAvg(leadTimes.decision);
  const avgTotal = calcAvg(leadTimes.total);

  const updateEl = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  updateEl('company-lead-time-first-response', avgFirstResponse !== null ? `${avgFirstResponse.toFixed(1)}時間` : '-');
  updateEl('company-lead-time-interview-setup', avgInterviewSetup !== null ? `${avgInterviewSetup.toFixed(1)}日` : '-');
  updateEl('company-lead-time-decision', avgDecision !== null ? `${avgDecision.toFixed(1)}日` : '-');
  updateEl('company-lead-time-total', avgTotal !== null ? `${avgTotal.toFixed(1)}日` : '-');
}

/**
 * 企業別レスポンス分布を描画
 */
function renderCompanyDistribution(applications) {
  const container = document.getElementById('company-distribution-chart');
  if (!container) return;

  const responseTimes = [];
  applications.forEach(app => {
    if (!app.statusHistory || app.statusHistory.length === 0) return;

    const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
    const contactedEntry = app.statusHistory.find(h => h.status === 'contacted');

    if (contactedEntry) {
      const contactedAt = contactedEntry.timestamp?.toDate
        ? contactedEntry.timestamp.toDate()
        : new Date(contactedEntry.timestamp);
      const hours = (contactedAt - createdAt) / (1000 * 60 * 60);
      if (hours >= 0) {
        responseTimes.push(hours);
      }
    }
  });

  const buckets = [
    { label: '0-6h', min: 0, max: 6, count: 0, class: '' },
    { label: '6-12h', min: 6, max: 12, count: 0, class: '' },
    { label: '12-24h', min: 12, max: 24, count: 0, class: 'warning' },
    { label: '24-48h', min: 24, max: 48, count: 0, class: 'warning' },
    { label: '48h+', min: 48, max: Infinity, count: 0, class: 'danger' }
  ];

  responseTimes.forEach(time => {
    for (const bucket of buckets) {
      if (time >= bucket.min && time < bucket.max) {
        bucket.count++;
        break;
      }
    }
  });

  const total = responseTimes.length;
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  if (total === 0) {
    container.innerHTML = '<div class="no-data">レスポンスデータがまだありません</div>';
    return;
  }

  container.innerHTML = `
    <div class="distribution-bars">
      ${buckets.map(bucket => {
        const percentage = total > 0 ? ((bucket.count / total) * 100).toFixed(0) : 0;
        const height = maxCount > 0 ? Math.max((bucket.count / maxCount) * 150, 4) : 4;
        return `
          <div class="distribution-bar-group">
            <div class="distribution-bar ${bucket.class}" style="height: ${height}px;">
              <span class="distribution-bar-value">${percentage}%</span>
            </div>
            <div class="distribution-bar-label">${bucket.label}</div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="distribution-legend">
      <div class="distribution-legend-item">
        <span class="distribution-legend-color good"></span>
        <span>理想（12h以内）</span>
      </div>
      <div class="distribution-legend-item">
        <span class="distribution-legend-color warning"></span>
        <span>注意（12-48h）</span>
      </div>
      <div class="distribution-legend-item">
        <span class="distribution-legend-color danger"></span>
        <span>要改善（48h+）</span>
      </div>
    </div>
  `;
}

/**
 * 企業別担当者パフォーマンスを描画
 */
function renderCompanyAssigneePerformance(applications) {
  const tbody = document.querySelector('#company-assignee-table tbody');
  if (!tbody) return;

  const assigneeStats = {};

  applications.forEach(app => {
    const assignee = app.assignee || app.handler || app.担当者 || '未割当';

    if (!assigneeStats[assignee]) {
      assigneeStats[assignee] = {
        name: assignee,
        total: 0,
        contacted: 0,
        hired: 0,
        joined: 0,
        responseTimes: []
      };
    }

    assigneeStats[assignee].total++;
    const status = app.status || 'new';

    if (['contacted', 'interviewing', 'interviewed', 'hired', 'joined'].includes(status)) {
      assigneeStats[assignee].contacted++;
    }
    if (['hired', 'joined'].includes(status)) {
      assigneeStats[assignee].hired++;
    }
    if (status === 'joined') {
      assigneeStats[assignee].joined++;
    }

    if (app.statusHistory && app.statusHistory.length > 0) {
      const createdAt = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
      const contactedEntry = app.statusHistory.find(h => h.status === 'contacted');
      if (contactedEntry) {
        const contactedAt = contactedEntry.timestamp?.toDate
          ? contactedEntry.timestamp.toDate()
          : new Date(contactedEntry.timestamp);
        const hours = (contactedAt - createdAt) / (1000 * 60 * 60);
        if (hours >= 0) {
          assigneeStats[assignee].responseTimes.push(hours);
        }
      }
    }
  });

  const sortedAssignees = Object.values(assigneeStats)
    .map(stat => {
      const avgResponse = stat.responseTimes.length > 0
        ? stat.responseTimes.reduce((a, b) => a + b, 0) / stat.responseTimes.length
        : null;
      const hiringRate = stat.total > 0 ? (stat.hired / stat.total) * 100 : 0;
      const acceptanceRate = stat.hired > 0 ? (stat.joined / stat.hired) * 100 : 0;

      return { ...stat, avgResponse, hiringRate, acceptanceRate };
    })
    .sort((a, b) => b.total - a.total);

  if (sortedAssignees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">データがありません</td></tr>';
    return;
  }

  const getResponseClass = (hours) => {
    if (hours === null) return '';
    if (hours <= 12) return 'performance-good';
    if (hours <= 24) return 'performance-warning';
    return 'performance-danger';
  };

  const getRateClass = (rate) => {
    if (rate >= 40) return 'performance-good';
    if (rate >= 25) return 'performance-warning';
    return 'performance-danger';
  };

  tbody.innerHTML = sortedAssignees.map(stat => {
    const responseDisplay = stat.avgResponse !== null
      ? `${stat.avgResponse.toFixed(1)}時間`
      : '-';

    return `
      <tr>
        <td>${escapeHtml(stat.name)}</td>
        <td>${formatNumber(stat.total)}</td>
        <td class="${getResponseClass(stat.avgResponse)}">${responseDisplay}</td>
        <td class="${getRateClass(stat.hiringRate)}">${stat.hiringRate.toFixed(1)}%</td>
        <td class="${getRateClass(stat.acceptanceRate)}">${stat.acceptanceRate.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');
}

export default {
  loadDashboardData,
  renderOverviewTable,
  renderCompanyCards,
  filterCompanies,
  sortCompanies,
  getCompanyData,
  initAnalyticsTabs,
  showCompanyDetailSection,
  backToCompanies,
  initCompanyDetailSection
};
