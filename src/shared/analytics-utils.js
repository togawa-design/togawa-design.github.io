/**
 * アナリティクス共通ユーティリティ
 * admin/analytics.js と job-manage/index.js で共有
 */

import { escapeHtml } from './utils.js';

// ========================================
// GA API 設定
// ========================================

/**
 * Google Analytics API エンドポイント
 */
export const GA_API_ENDPOINT = 'https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/getAnalyticsData';

/**
 * GA APIからデータを取得
 * @param {string} type - データタイプ（overview, traffic, company-detail, engagement, funnel, trends等）
 * @param {Object} params - 追加パラメータ（days, domain等）
 * @param {string} [authToken] - 認証トークン（オプション）
 * @returns {Promise<Object>} APIレスポンス
 */
export async function fetchAnalyticsData(type, params = {}, authToken = null) {
  const queryParams = new URLSearchParams({ type, ...params });
  const url = `${GA_API_ENDPOINT}?${queryParams.toString()}`;

  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Unknown API error');
  }

  return result.data;
}

/**
 * 概要データを取得
 * @param {number} days - 日数
 * @param {string} [authToken] - 認証トークン
 * @returns {Promise<Object>}
 */
export async function fetchOverviewData(days, authToken = null) {
  return fetchAnalyticsData('overview', { days }, authToken);
}

/**
 * トラフィックデータを取得
 * @param {number} days - 日数
 * @param {string} [authToken] - 認証トークン
 * @returns {Promise<Object>}
 */
export async function fetchTrafficData(days, authToken = null) {
  return fetchAnalyticsData('traffic', { days }, authToken);
}

/**
 * 会社別詳細データを取得
 * @param {string} domain - 会社ドメイン
 * @param {number} days - 日数
 * @param {string} [authToken] - 認証トークン
 * @returns {Promise<Object>}
 */
export async function fetchCompanyDetailData(domain, days, authToken = null) {
  return fetchAnalyticsData('company-detail', { domain, days }, authToken);
}

// ========================================
// フォーマット・変換ユーティリティ
// ========================================

/**
 * 秒数を読みやすい形式にフォーマット
 * @param {number} seconds - 秒数
 * @returns {string} フォーマットされた文字列
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const secs = Math.round(seconds);
  if (secs >= 3600) {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hours}時間${mins}分`;
  }
  if (secs >= 60) {
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}分${remainSecs}秒`;
  }
  return `${secs}秒`;
}

/**
 * デバイスカテゴリを日本語に変換
 * @param {string} device - デバイスカテゴリ（mobile, desktop, tablet等）
 * @returns {string} 日本語名
 */
export function getDeviceName(device) {
  if (!device) return 'その他';
  const d = device.toLowerCase();
  if (d === 'mobile' || d.includes('mobile')) return 'モバイル';
  if (d === 'desktop' || d.includes('desktop')) return 'デスクトップ';
  if (d === 'tablet' || d.includes('tablet')) return 'タブレット';
  return device;
}

/**
 * 流入元を日本語に変換
 * @param {string} source - 流入元
 * @returns {string} 日本語名
 */
export function getSourceName(source) {
  if (!source) return '直接流入';
  const s = source.toLowerCase();
  if (s.includes('google')) return 'Google検索';
  if (s.includes('indeed')) return 'Indeed';
  if (s.includes('jobbox') || s.includes('stanby')) return '求人ボックス';
  if (s.includes('line')) return 'LINE';
  if (s === 'direct' || s === '(direct)' || s === '(none)') return '直接流入';
  return source;
}

/**
 * 男女比グラフを描画
 * @param {Object} gender - { male: number, female: number }
 * @param {Object} elementIds - DOM要素ID { maleBar, femaleBar, malePercent, femalePercent }
 */
export function renderGenderChart(gender, elementIds) {
  const maleCount = gender?.male || 0;
  const femaleCount = gender?.female || 0;
  const totalGender = maleCount + femaleCount;

  const maleBar = document.getElementById(elementIds.maleBar);
  const femaleBar = document.getElementById(elementIds.femaleBar);
  const malePercentEl = document.getElementById(elementIds.malePercent);
  const femalePercentEl = document.getElementById(elementIds.femalePercent);

  if (totalGender > 0) {
    const malePercent = Math.round((maleCount / totalGender) * 100);
    const femalePercent = 100 - malePercent;

    if (maleBar) maleBar.style.width = `${malePercent}%`;
    if (femaleBar) femaleBar.style.width = `${femalePercent}%`;
    if (malePercentEl) malePercentEl.textContent = `${malePercent}%`;
    if (femalePercentEl) femalePercentEl.textContent = `${femalePercent}%`;
  } else {
    if (malePercentEl) malePercentEl.textContent = '-';
    if (femalePercentEl) femalePercentEl.textContent = '-';
  }
}

/**
 * 年齢分布グラフを描画
 * @param {Object} age - { '18-24': number, '25-34': number, ... }
 * @param {string} containerId - コンテナのDOM要素ID
 */
export function renderAgeChart(age, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const ageGroups = Object.entries(age || {});
  if (ageGroups.length > 0) {
    const maxAge = Math.max(...ageGroups.map(([, count]) => count));
    container.innerHTML = ageGroups.map(([group, count]) => {
      const height = maxAge > 0 ? Math.max(10, (count / maxAge) * 80) : 10;
      return `
        <div class="age-bar-wrapper">
          <span class="age-bar-value">${count}</span>
          <div class="age-bar" style="height: ${height}px;"></div>
          <span class="age-bar-label">${escapeHtml(group)}</span>
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = '<p style="color: #94a3b8; font-size: 13px; text-align: center;">データがありません</p>';
  }
}

/**
 * ユーザー属性（男女比・年齢分布）を描画
 * @param {Object} gender - { male: number, female: number }
 * @param {Object} age - { '18-24': number, '25-34': number, ... }
 * @param {Object} config - DOM要素ID設定
 */
export function renderDemographics(gender, age, config) {
  // 男女比
  renderGenderChart(gender, {
    maleBar: config.maleBarId,
    femaleBar: config.femaleBarId,
    malePercent: config.malePercentId,
    femalePercent: config.femalePercentId
  });

  // 年齢分布
  renderAgeChart(age, config.ageContainerId);
}

/**
 * パーセンテージを計算
 * @param {number} value - 値
 * @param {number} total - 合計
 * @returns {number} パーセンテージ（整数）
 */
export function calcPercentage(value, total) {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * アナリティクステーブル行を生成
 * @param {Array} columns - 列データの配列
 * @returns {string} HTML文字列
 */
export function createTableRow(columns) {
  return `<tr>${columns.map(col => `<td>${escapeHtml(String(col))}</td>`).join('')}</tr>`;
}

/**
 * 空のテーブル行を生成
 * @param {number} colspan - 列数
 * @param {string} message - メッセージ
 * @returns {string} HTML文字列
 */
export function createEmptyTableRow(colspan, message = 'データがありません') {
  return `<tr><td colspan="${colspan}" class="loading-cell">${escapeHtml(message)}</td></tr>`;
}

/**
 * Chart.js の共通オプション
 */
export const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 12,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: '#64748b',
        font: { size: 11 }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      },
      ticks: {
        color: '#64748b',
        font: { size: 11 }
      }
    }
  }
};

/**
 * 棒グラフ用のChart.jsオプションを生成
 * @param {Object} overrides - 上書きするオプション
 * @returns {Object} Chart.jsオプション
 */
export function getBarChartOptions(overrides = {}) {
  return {
    ...chartDefaults,
    ...overrides,
    plugins: {
      ...chartDefaults.plugins,
      ...(overrides.plugins || {})
    },
    scales: {
      ...chartDefaults.scales,
      ...(overrides.scales || {})
    }
  };
}

/**
 * 折れ線グラフ用のChart.jsオプションを生成
 * @param {Object} overrides - 上書きするオプション
 * @returns {Object} Chart.jsオプション
 */
export function getLineChartOptions(overrides = {}) {
  return getBarChartOptions(overrides);
}

/**
 * 横棒グラフ用のChart.jsオプションを生成
 * @param {Object} overrides - 上書きするオプション
 * @returns {Object} Chart.jsオプション
 */
export function getHorizontalBarChartOptions(overrides = {}) {
  return {
    ...chartDefaults,
    indexAxis: 'y',
    ...overrides,
    plugins: {
      ...chartDefaults.plugins,
      ...(overrides.plugins || {})
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: '#64748b', font: { size: 11 } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } }
      },
      ...(overrides.scales || {})
    }
  };
}

// デフォルトエクスポート
const AnalyticsUtils = {
  // API
  GA_API_ENDPOINT,
  fetchAnalyticsData,
  fetchOverviewData,
  fetchTrafficData,
  fetchCompanyDetailData,
  // フォーマット
  formatDuration,
  getDeviceName,
  getSourceName,
  // 描画
  renderGenderChart,
  renderAgeChart,
  renderDemographics,
  // ユーティリティ
  calcPercentage,
  createTableRow,
  createEmptyTableRow,
  // Chart.js
  chartDefaults,
  getBarChartOptions,
  getLineChartOptions,
  getHorizontalBarChartOptions
};

export default AnalyticsUtils;
