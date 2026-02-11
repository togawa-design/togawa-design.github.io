/**
 * Admin Dashboard - ページアナリティクスモジュール
 * LP・採用ページの独立した計測データを表示
 */

import { escapeHtml, formatNumber } from '@shared/utils.js';
import { isAdmin, getUserCompanyDomain } from './auth.js';
import { getDateRange } from './date-picker.js';
import { apiEndpoints } from '@shared/env-config.js';

// ページアナリティクスAPIエンドポイント
const PAGE_ANALYTICS_API = apiEndpoints.pageAnalytics;

// 現在のページタイプ設定
let currentPageType = 'all';

/**
 * ページアナリティクスタブを初期化
 */
export function initPageAnalyticsTab() {
  // ページタイプ切り替えボタンのイベント設定
  const pageTypeBtns = document.querySelectorAll('.page-type-btn');
  pageTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pageTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPageType = btn.dataset.type;
      loadPageAnalyticsData();
    });
  });
}

/**
 * ページアナリティクスデータを読み込み
 */
export async function loadPageAnalyticsData() {
  try {
    // 会社ユーザーの場合は自社のみ
    const companyDomain = isAdmin() ? null : getUserCompanyDomain();
    const { days } = getDateRange();

    // フィルター付き概要データを取得（PV, UU, CTA, 滞在時間, 流入元, デバイス用）
    const overviewParams = new URLSearchParams({
      type: 'overview',
      days
    });
    if (companyDomain) overviewParams.set('company_domain', companyDomain);
    if (currentPageType !== 'all') overviewParams.set('page_type', currentPageType);

    // フィルターなし概要データを取得（LP/採用ページ比較用 - 常に両方表示）
    const comparisonParams = new URLSearchParams({
      type: 'overview',
      days
    });
    if (companyDomain) comparisonParams.set('company_domain', companyDomain);

    const [overviewRes, comparisonRes] = await Promise.all([
      fetch(`${PAGE_ANALYTICS_API}?${overviewParams}`),
      fetch(`${PAGE_ANALYTICS_API}?${comparisonParams}`)
    ]);

    const overviewData = await overviewRes.json();
    const comparisonData = await comparisonRes.json();

    if (overviewData.success) {
      renderFilteredOverview(overviewData.data);
    }

    if (comparisonData.success) {
      renderComparison(comparisonData.data);
    }

    // LP別データを取得
    const lpParams = new URLSearchParams({ type: 'lp', days });
    if (companyDomain) lpParams.set('company_domain', companyDomain);

    const lpRes = await fetch(`${PAGE_ANALYTICS_API}?${lpParams}`);
    const lpData = await lpRes.json();

    if (lpData.success) {
      renderLPTable(lpData.data);
    }

    // 採用ページ別データを取得
    const recruitParams = new URLSearchParams({ type: 'recruit', days });
    if (companyDomain) recruitParams.set('company_domain', companyDomain);

    const recruitRes = await fetch(`${PAGE_ANALYTICS_API}?${recruitParams}`);
    const recruitData = await recruitRes.json();

    if (recruitData.success) {
      renderRecruitTable(recruitData.data);
    }

  } catch (error) {
    console.error('[PageAnalytics] データ読み込みエラー:', error);
    renderEmptyState();
  }
}

/**
 * フィルター付き概要データを描画（PV, UU, CTA, 滞在時間, 流入元, デバイス）
 */
function renderFilteredOverview(data) {
  // 概要カード
  updateElement('pa-total-views', formatNumber(data.totalPageViews || 0));
  updateElement('pa-unique-visitors', formatNumber(data.totalUniqueVisitors || 0));
  updateElement('pa-cta-clicks', formatNumber(data.totalCtaClicks || 0));
  updateElement('pa-avg-time', formatDuration(data.avgTimeOnPage || 0));

  // 流入元チャート
  renderReferrerChart(data.byReferrer || {});

  // デバイスチャート
  renderDeviceChart(data.byDevice || {});
}

/**
 * LP/採用ページ比較データを描画（常にフィルターなし）
 */
function renderComparison(data) {
  // LP統計
  const lpViews = data.byPageType?.lp?.views || 0;
  const lpClicks = data.byPageType?.lp?.clicks || 0;
  const lpCvr = lpViews > 0 ? ((lpClicks / lpViews) * 100).toFixed(1) : '0.0';
  updateElement('pa-lp-views', formatNumber(lpViews));
  updateElement('pa-lp-clicks', formatNumber(lpClicks));
  updateElement('pa-lp-cvr', `${lpCvr}%`);

  // 採用ページ統計
  const recruitViews = data.byPageType?.recruit?.views || 0;
  const recruitClicks = data.byPageType?.recruit?.clicks || 0;
  const recruitCvr = recruitViews > 0 ? ((recruitClicks / recruitViews) * 100).toFixed(1) : '0.0';
  updateElement('pa-recruit-views', formatNumber(recruitViews));
  updateElement('pa-recruit-clicks', formatNumber(recruitClicks));
  updateElement('pa-recruit-cvr', `${recruitCvr}%`);
}

/**
 * 流入元チャートを描画
 */
function renderReferrerChart(referrerData) {
  const container = document.getElementById('pa-referrer-chart');
  if (!container) return;

  const total = Object.values(referrerData).reduce((sum, v) => sum + v, 0);

  if (total === 0) {
    container.innerHTML = '<div class="no-data">データがありません</div>';
    return;
  }

  const referrerLabels = {
    'google': 'Google検索',
    'yahoo': 'Yahoo検索',
    'direct': '直接流入',
    'indeed': 'Indeed',
    'jobbox': '求人ボックス',
    'internal': 'サイト内',
    'twitter': 'Twitter/X',
    'facebook': 'Facebook',
    'line': 'LINE',
    'other': 'その他'
  };

  const sortedReferrers = Object.entries(referrerData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const html = sortedReferrers.map(([key, count]) => {
    const percent = ((count / total) * 100).toFixed(1);
    const label = referrerLabels[key] || key;
    return `
      <div class="referrer-bar-row">
        <span class="referrer-label">${escapeHtml(label)}</span>
        <div class="referrer-bar-container">
          <div class="referrer-bar" style="width: ${percent}%"></div>
        </div>
        <span class="referrer-value">${formatNumber(count)} (${percent}%)</span>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

/**
 * デバイスチャートを描画
 */
function renderDeviceChart(deviceData) {
  const container = document.getElementById('pa-device-chart');
  if (!container) return;

  const total = Object.values(deviceData).reduce((sum, v) => sum + v, 0);

  if (total === 0) {
    container.innerHTML = '<div class="no-data">データがありません</div>';
    return;
  }

  const deviceLabels = {
    'mobile': 'モバイル',
    'desktop': 'デスクトップ',
    'tablet': 'タブレット'
  };

  const deviceColors = {
    'mobile': '#6366f1',
    'desktop': '#22c55e',
    'tablet': '#f59e0b'
  };

  const sortedDevices = Object.entries(deviceData)
    .sort((a, b) => b[1] - a[1]);

  const html = `
    <div class="device-pie-chart">
      ${sortedDevices.map(([key, count]) => {
        const percent = ((count / total) * 100).toFixed(1);
        const label = deviceLabels[key] || key;
        const color = deviceColors[key] || '#94a3b8';
        return `
          <div class="device-item">
            <div class="device-color" style="background: ${color}"></div>
            <span class="device-label">${escapeHtml(label)}</span>
            <span class="device-value">${formatNumber(count)} (${percent}%)</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = html;
}

/**
 * LP別テーブルを描画
 */
function renderLPTable(data) {
  const tbody = document.querySelector('#pa-lp-table tbody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(lp => `
    <tr>
      <td>${escapeHtml(lp.companyName || lp.companyDomain)}</td>
      <td>${escapeHtml(lp.jobTitle || '-')}</td>
      <td>${formatNumber(lp.pageViews || 0)}</td>
      <td>${formatNumber(lp.uniqueVisitors || 0)}</td>
      <td>${formatNumber(lp.ctaClicks || 0)}</td>
      <td>${lp.cvr || '0.0'}%</td>
    </tr>
  `).join('');
}

/**
 * 採用ページ別テーブルを描画
 */
function renderRecruitTable(data) {
  const tbody = document.querySelector('#pa-recruit-table tbody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${escapeHtml(r.companyName || r.companyDomain)}</td>
      <td>${formatNumber(r.pageViews || 0)}</td>
      <td>${formatNumber(r.uniqueVisitors || 0)}</td>
      <td>${formatNumber(r.ctaClicks || 0)}</td>
      <td>${r.cvr || '0.0'}%</td>
    </tr>
  `).join('');
}

/**
 * 空の状態を描画
 */
function renderEmptyState() {
  updateElement('pa-total-views', '-');
  updateElement('pa-unique-visitors', '-');
  updateElement('pa-cta-clicks', '-');
  updateElement('pa-avg-time', '-');
  updateElement('pa-lp-views', '-');
  updateElement('pa-lp-clicks', '-');
  updateElement('pa-lp-cvr', '-');
  updateElement('pa-recruit-views', '-');
  updateElement('pa-recruit-clicks', '-');
  updateElement('pa-recruit-cvr', '-');

  const referrerContainer = document.getElementById('pa-referrer-chart');
  if (referrerContainer) {
    referrerContainer.innerHTML = '<div class="no-data">データがありません</div>';
  }

  const deviceContainer = document.getElementById('pa-device-chart');
  if (deviceContainer) {
    deviceContainer.innerHTML = '<div class="no-data">データがありません</div>';
  }

  const lpTbody = document.querySelector('#pa-lp-table tbody');
  if (lpTbody) {
    lpTbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データがありません</td></tr>';
  }

  const recruitTbody = document.querySelector('#pa-recruit-table tbody');
  if (recruitTbody) {
    recruitTbody.innerHTML = '<tr><td colspan="5" class="loading-cell">データがありません</td></tr>';
  }
}

/**
 * 要素のテキストを更新
 */
function updateElement(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * 秒数を読みやすい形式にフォーマット
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const secs = Math.round(seconds);
  if (secs >= 60) {
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}分${remainSecs}秒`;
  }
  return `${secs}秒`;
}

// デフォルトエクスポート
const PageAnalyticsModule = {
  initPageAnalyticsTab,
  loadPageAnalyticsData
};

export default PageAnalyticsModule;
