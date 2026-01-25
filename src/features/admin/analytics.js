/**
 * Admin Dashboard - アナリティクスモジュール
 */

import { escapeHtml, formatNumber } from '@shared/utils.js';
import { config } from './config.js';
import { getIdToken } from './auth.js';
import { getPatternLabel } from './config.js';

// 企業データキャッシュ
let companyData = [];

export function getCompanyData() {
  return companyData;
}

// ダッシュボードデータ読み込み
export async function loadDashboardData() {
  const dateRangeEl = document.getElementById('date-range');
  const days = dateRangeEl?.value || 7;
  const apiEndpoint = localStorage.getItem('api_endpoint') || config.apiEndpoint;
  const idToken = getIdToken();

  if (apiEndpoint && idToken) {
    await fetchGAData(days, apiEndpoint);
  } else if (apiEndpoint && !idToken) {
    try {
      await fetchGAData(days, apiEndpoint);
    } catch (e) {
      loadMockData(days);
    }
  } else {
    loadMockData(days);
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

    const response = await fetch(`${apiEndpoint}?days=${days}`, { headers });

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

// 各セクションにローディング表示
function showSectionLoading(show) {
  const loadingHtml = '<div class="section-loading"><div class="loading-spinner"></div><span>データを読み込み中...</span></div>';

  const statCards = document.querySelectorAll('.stat-value');
  statCards.forEach(card => {
    if (show) {
      card.dataset.originalText = card.textContent;
      card.innerHTML = '<span class="loading-dots">...</span>';
    }
  });

  const chartEl = document.getElementById('daily-chart');
  if (chartEl && show) {
    chartEl.innerHTML = loadingHtml;
  }

  const tableBody = document.querySelector('.data-table tbody');
  if (tableBody && show) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;">${loadingHtml}</td></tr>`;
  }

  const companyCards = document.getElementById('company-cards');
  if (companyCards && show) {
    companyCards.innerHTML = loadingHtml;
  }

  const logTable = document.querySelector('#applications-section .data-table tbody');
  if (logTable && show) {
    logTable.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;">${loadingHtml}</td></tr>`;
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
    chartEl.innerHTML = '<p>データがありません</p>';
    return;
  }

  const maxViews = Math.max(...dailyData.map(d => d.views));
  const displayData = dailyData.length > 30 ? dailyData.filter((_, i) => i % 3 === 0) : dailyData;

  chartEl.innerHTML = `
    <div class="simple-chart">
      <div class="chart-bars">
        ${displayData.map(d => {
          const heightPercent = maxViews > 0 ? (d.views / maxViews) * 100 : 0;
          return `
            <div class="chart-bar-wrapper">
              <div class="chart-bar" style="height: ${heightPercent}%">
                <span class="bar-value">${d.views}</span>
              </div>
              <span class="bar-label">${d.date}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
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
    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">応募データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = applications.map(app => `
    <tr>
      <td>${escapeHtml(app.date)}</td>
      <td>${escapeHtml(app.company)}</td>
      <td><span class="type-badge ${escapeHtml(app.type)}">${typeLabels[app.type] || escapeHtml(app.type)}</span></td>
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
  const chartEl = document.getElementById('daily-chart');
  if (!chartEl) return;

  const data = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      views: Math.floor(100 + Math.random() * 200),
      clicks: Math.floor(5 + Math.random() * 20)
    });
  }

  const maxViews = Math.max(...data.map(d => d.views));
  const displayData = days > 30 ? data.filter((_, i) => i % 3 === 0) : data;

  chartEl.innerHTML = `
    <div class="simple-chart">
      <div class="chart-bars">
        ${displayData.map(d => {
          const heightPercent = (d.views / maxViews) * 100;
          return `
            <div class="chart-bar-wrapper">
              <div class="chart-bar" style="height: ${heightPercent}%">
                <span class="bar-value">${d.views}</span>
              </div>
              <span class="bar-label">${d.date}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
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
        <a href="company.html?c=${escapeHtml(company.domain)}" target="_blank" class="btn-view-page">ページを確認</a>
      </div>
    `;
  }).join('');
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

export default {
  loadDashboardData,
  renderOverviewTable,
  renderCompanyCards,
  filterCompanies,
  sortCompanies,
  getCompanyData
};
