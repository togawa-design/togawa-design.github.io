/**
 * 広告費用管理モジュール
 * admin が各社の広告費用を入力・管理する
 * CPA計算、レポート表示機能を含む
 */

import { showToast, escapeHtml, formatNumber } from '@shared/utils.js';

// チャンネル定義
const CHANNELS = {
  google: { name: 'Google Ads', icon: '🔵', color: '#4285f4' },
  tiktok: { name: 'TikTok Ads', icon: '🎵', color: '#000000' },
  x: { name: 'X (Twitter) Ads', icon: '✖️', color: '#1da1f2' },
  meta: { name: 'Meta Ads', icon: '🔷', color: '#1877f2' },
  yahoo: { name: 'Yahoo! Ads', icon: '🟣', color: '#720e9e' },
  line: { name: 'LINE Ads', icon: '🟢', color: '#06c755' }
};

// 優先表示チャンネル
const PRIORITY_CHANNELS = ['google', 'tiktok', 'x'];

// UTMソースとチャンネルのマッピング
const UTM_SOURCE_TO_CHANNEL = {
  google: 'google',
  gdn: 'google',
  google_ads: 'google',
  googleads: 'google',
  tiktok: 'tiktok',
  tiktok_ads: 'tiktok',
  twitter: 'x',
  x: 'x',
  xads: 'x',
  meta: 'meta',
  facebook: 'meta',
  instagram: 'meta',
  fb: 'meta',
  ig: 'meta',
  yahoo: 'yahoo',
  yahooads: 'yahoo',
  yda: 'yahoo',
  line: 'line',
  lineads: 'line'
};

// 各プラットフォームのエクスポートURL
const PLATFORM_EXPORT_URLS = {
  google: {
    name: 'Google Ads',
    exportUrl: 'https://ads.google.com/aw/reporting/reporteditor',
    helpUrl: 'https://support.google.com/google-ads/answer/2454069',
    icon: '🔵',
    note: 'レポート → カスタムレポート → CSVダウンロード'
  },
  tiktok: {
    name: 'TikTok Ads',
    exportUrl: 'https://ads.tiktok.com/i18n/dashboard',
    helpUrl: 'https://ads.tiktok.com/help/article/export-data',
    icon: '🎵',
    note: 'レポート → エクスポート → CSV'
  },
  x: {
    name: 'X (Twitter) Ads',
    exportUrl: 'https://ads.twitter.com/analytics',
    helpUrl: 'https://business.twitter.com/ja/help/campaign-analytics.html',
    icon: '✖️',
    note: 'アナリティクス → データをエクスポート'
  }
};

// CSVインポートフォーマット
const IMPORT_FORMATS = {
  google: {
    name: 'Google Ads',
    columns: {
      date: ['日', 'Day', 'Date', '日付'],
      campaign: ['キャンペーン', 'Campaign'],
      cost: ['費用', 'Cost', '費用（円）']
    }
  },
  tiktok: {
    name: 'TikTok Ads',
    columns: {
      date: ['Date', '日付', 'Time'],
      campaign: ['Campaign name', 'キャンペーン名', 'Campaign'],
      cost: ['Cost', '費用', 'Total Cost', 'Spend']
    }
  },
  x: {
    name: 'X (Twitter) Ads',
    columns: {
      date: ['日付', 'Date', 'Day'],
      campaign: ['キャンペーン名', 'Campaign name', 'Campaign'],
      cost: ['請求額', 'Spend', 'Amount spent', '費用']
    }
  }
};

let firebaseDb = null;
let currentTab = 'input';
let selectedCompany = null;
let selectedYearMonth = null;
let companies = [];
let csvPreviewData = null;
let selectedCsvFormat = 'google';

/**
 * 初期化
 */
export function initAdCosts(db) {
  firebaseDb = db;
  selectedYearMonth = getCurrentYearMonth();
}

/**
 * セクション読み込み時に呼ばれる（index.js から呼ばれる）
 */
export async function initAdCostsSection() {
  // Firebase 初期化
  if (!firebaseDb && window.firebase && window.firebase.firestore) {
    firebaseDb = window.firebase.firestore();
  }
  selectedYearMonth = getCurrentYearMonth();

  // 会社リストを取得
  try {
    const companiesSnapshot = await firebaseDb.collection('companies').get();
    companies = companiesSnapshot.docs.map(doc => ({
      domain: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('会社リストの取得に失敗:', error);
    companies = [];
  }

  setupEventListeners();
  await renderCurrentTab();
}

/**
 * セクション読み込み時に呼ばれる（従来の方式）
 */
export async function onSectionLoad(companiesList) {
  companies = companiesList || [];
  setupEventListeners();
  await renderCurrentTab();
}

/**
 * 現在の年月を取得（YYYY-MM形式）
 */
function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  // タブ切り替え（広告費用管理セクション内のみ）
  const section = document.getElementById('section-ad-costs');
  if (!section) return;

  section.querySelectorAll('.analytics-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      section.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentTab = e.target.dataset.tab;
      renderCurrentTab();
    });
  });
}

/**
 * 現在のタブを描画
 */
async function renderCurrentTab() {
  const container = document.getElementById('ad-costs-content');
  if (!container) return;

  container.innerHTML = '<div class="loading-cell">読み込み中...</div>';

  switch (currentTab) {
    case 'input':
      await renderInputTab(container);
      break;
    case 'list':
      await renderListTab(container);
      break;
    case 'report':
      await renderReportTab(container);
      break;
    case 'import':
      renderImportTab(container);
      break;
  }
}

/**
 * 入力タブを描画
 */
async function renderInputTab(container) {
  // フィルターとチャンネル入力フォーム
  container.innerHTML = `
    <div class="ad-costs-filters">
      <div class="filter-group">
        <span class="filter-label">対象会社</span>
        <select id="company-select" class="filter-select">
          <option value="">会社を選択</option>
          ${companies.map(c => `
            <option value="${escapeHtml(c.domain)}" ${selectedCompany === c.domain ? 'selected' : ''}>
              ${escapeHtml(c.name || c.domain)}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">対象月</span>
        <input type="month" id="month-select" class="filter-select" value="${selectedYearMonth}">
      </div>
    </div>

    <div id="channel-input-area">
      ${selectedCompany ? '' : '<div class="no-data">会社を選択してください</div>'}
    </div>
  `;

  // 会社選択イベント
  document.getElementById('company-select').addEventListener('change', async (e) => {
    selectedCompany = e.target.value;
    await renderChannelInputs();
  });

  // 月選択イベント
  document.getElementById('month-select').addEventListener('change', async (e) => {
    selectedYearMonth = e.target.value;
    await renderChannelInputs();
  });

  if (selectedCompany) {
    await renderChannelInputs();
  }
}

/**
 * チャンネル入力フォームを描画
 */
async function renderChannelInputs() {
  const area = document.getElementById('channel-input-area');
  if (!area || !selectedCompany) return;

  area.innerHTML = '<div class="loading-cell">データを取得中...</div>';

  // 既存データを取得
  const existingData = await getAdCostsForMonth(selectedCompany, selectedYearMonth);

  area.innerHTML = `
    <div class="ad-costs-input-grid">
      ${PRIORITY_CHANNELS.map(channelKey => {
        const channel = CHANNELS[channelKey];
        const data = existingData[channelKey] || { budget: '', spend: '' };
        return `
          <div class="ad-cost-channel-card" data-channel="${channelKey}">
            <div class="channel-name">
              <span class="channel-icon">${channel.icon}</span>
              <span>${channel.name}</span>
            </div>
            <div class="input-group">
              <label>予算（円）</label>
              <input type="text" class="budget-input" value="${data.budget ? formatNumber(data.budget) : ''}" placeholder="0" data-doc-id="${data.docId || ''}">
            </div>
            <div class="input-group">
              <label>実績（円）</label>
              <input type="text" class="spend-input" value="${data.spend ? formatNumber(data.spend) : ''}" placeholder="0">
            </div>
            <button class="btn-save" onclick="window.AdCosts.saveChannel('${channelKey}')">保存</button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // 金額入力フォーマット
  area.querySelectorAll('.budget-input, .spend-input').forEach(input => {
    input.addEventListener('blur', (e) => {
      const value = parseMoneyInput(e.target.value);
      if (!isNaN(value) && value > 0) {
        e.target.value = formatNumber(value);
      }
    });
  });
}

/**
 * 金額入力をパース
 */
function parseMoneyInput(value) {
  if (!value) return 0;
  // カンマ、通貨記号を除去
  const cleaned = String(value).replace(/[,¥￥$\s]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * 特定会社・月のデータを取得
 */
async function getAdCostsForMonth(companyDomain, yearMonth) {
  if (!firebaseDb) return {};

  try {
    const snapshot = await firebaseDb.collection('ad_costs')
      .where('companyDomain', '==', companyDomain)
      .where('yearMonth', '==', yearMonth)
      .get();

    const result = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      result[data.channel] = {
        ...data,
        docId: doc.id
      };
    });
    return result;
  } catch (error) {
    console.error('[AdCosts] Failed to get data:', error);
    return {};
  }
}

/**
 * チャンネルデータを保存
 */
async function saveChannel(channelKey) {
  if (!firebaseDb || !selectedCompany || !selectedYearMonth) {
    showToast('会社と月を選択してください', 'warning');
    return;
  }

  const card = document.querySelector(`.ad-cost-channel-card[data-channel="${channelKey}"]`);
  if (!card) return;

  const budgetInput = card.querySelector('.budget-input');
  const spendInput = card.querySelector('.spend-input');
  const saveBtn = card.querySelector('.btn-save');
  const docId = budgetInput.dataset.docId;

  const budget = parseMoneyInput(budgetInput.value);
  const spend = parseMoneyInput(spendInput.value);

  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  try {
    const data = {
      companyDomain: selectedCompany,
      yearMonth: selectedYearMonth,
      channel: channelKey,
      budget,
      spend,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };

    if (docId) {
      // 更新
      await firebaseDb.collection('ad_costs').doc(docId).update(data);
    } else {
      // 新規作成
      data.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = 'admin';
      const docRef = await firebaseDb.collection('ad_costs').add(data);
      budgetInput.dataset.docId = docRef.id;
    }

    showToast('保存しました', 'success');
    saveBtn.textContent = '保存済み';
        setTimeout(() => {
      saveBtn.textContent = '保存';
      saveBtn.disabled = false;
    }, 1500);
  } catch (error) {
    console.error('[AdCosts] Failed to save:', error);
    showToast('保存に失敗しました', 'error');
    saveBtn.textContent = '保存';
    saveBtn.disabled = false;
  }
}

/**
 * 一覧タブを描画
 */
async function renderListTab(container) {
  container.innerHTML = `
    <div class="ad-costs-filters">
      <div class="filter-group">
        <span class="filter-label">会社</span>
        <select id="list-company-filter" class="filter-select">
          <option value="">すべて</option>
          ${companies.map(c => `
            <option value="${escapeHtml(c.domain)}">${escapeHtml(c.name || c.domain)}</option>
          `).join('')}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">期間</span>
        <select id="list-period-filter" class="filter-select">
          <option value="3">過去3ヶ月</option>
          <option value="6">過去6ヶ月</option>
          <option value="12">過去12ヶ月</option>
        </select>
      </div>
    </div>
    <div id="ad-costs-list-area" class="ad-costs-list-container">
      <div class="loading-cell">データを読み込み中...</div>
    </div>
  `;

  document.getElementById('list-company-filter').addEventListener('change', loadAdCostsList);
  document.getElementById('list-period-filter').addEventListener('change', loadAdCostsList);

  await loadAdCostsList();
}

/**
 * 一覧データを読み込み
 */
async function loadAdCostsList() {
  const area = document.getElementById('ad-costs-list-area');
  if (!area || !firebaseDb) return;

  const companyFilter = document.getElementById('list-company-filter')?.value || '';
  const periodFilter = parseInt(document.getElementById('list-period-filter')?.value || '3', 10);

  area.innerHTML = '<div class="loading-cell">読み込み中...</div>';

  try {
    // 期間の計算
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - periodFilter + 1, 1);
    const startYearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    let query = firebaseDb.collection('ad_costs')
      .where('yearMonth', '>=', startYearMonth)
      .orderBy('yearMonth', 'desc');

    if (companyFilter) {
      query = query.where('companyDomain', '==', companyFilter);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      area.innerHTML = '<div class="no-data">データがありません</div>';
      return;
    }

    // 会社・月ごとにグループ化
    const grouped = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.companyDomain}_${data.yearMonth}`;
      if (!grouped[key]) {
        grouped[key] = {
          companyDomain: data.companyDomain,
          yearMonth: data.yearMonth,
          channels: {}
        };
      }
      grouped[key].channels[data.channel] = {
        budget: data.budget || 0,
        spend: data.spend || 0
      };
    });

    // テーブル描画
    const rows = Object.values(grouped).sort((a, b) => {
      if (a.yearMonth !== b.yearMonth) return b.yearMonth.localeCompare(a.yearMonth);
      return a.companyDomain.localeCompare(b.companyDomain);
    });

    const companyNames = {};
    companies.forEach(c => { companyNames[c.domain] = c.name || c.domain; });

    area.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>年月</th>
            <th>会社</th>
            ${PRIORITY_CHANNELS.map(ch => `<th>${CHANNELS[ch].icon} ${CHANNELS[ch].name}</th>`).join('')}
            <th>合計</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => {
            let totalBudget = 0;
            let totalSpend = 0;
            PRIORITY_CHANNELS.forEach(ch => {
              const d = row.channels[ch] || { budget: 0, spend: 0 };
              totalBudget += d.budget;
              totalSpend += d.spend;
            });
            return `
              <tr>
                <td>${row.yearMonth}</td>
                <td>${escapeHtml(companyNames[row.companyDomain] || row.companyDomain)}</td>
                ${PRIORITY_CHANNELS.map(ch => {
                  const d = row.channels[ch] || { budget: 0, spend: 0 };
                  return `<td>¥${formatNumber(d.spend)} / ¥${formatNumber(d.budget)}</td>`;
                }).join('')}
                <td><strong>¥${formatNumber(totalSpend)} / ¥${formatNumber(totalBudget)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('[AdCosts] Failed to load list:', error);
    area.innerHTML = '<div class="error-message">データの取得に失敗しました</div>';
  }
}

// ============================================
// レポートタブ
// ============================================

/**
 * レポートタブを描画
 */
async function renderReportTab(container) {
  container.innerHTML = `
    <div class="ad-costs-filters">
      <div class="filter-group">
        <span class="filter-label">会社</span>
        <select id="report-company-filter" class="filter-select">
          <option value="">すべて</option>
          ${companies.map(c => `
            <option value="${escapeHtml(c.domain)}">${escapeHtml(c.name || c.domain)}</option>
          `).join('')}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">期間</span>
        <select id="report-period-filter" class="filter-select">
          <option value="1">当月</option>
          <option value="3" selected>過去3ヶ月</option>
          <option value="6">過去6ヶ月</option>
          <option value="12">過去12ヶ月</option>
        </select>
      </div>
    </div>
    <div id="report-content">
      <div class="loading-cell">レポートを生成中...</div>
    </div>
  `;

  document.getElementById('report-company-filter').addEventListener('change', loadReport);
  document.getElementById('report-period-filter').addEventListener('change', loadReport);

  await loadReport();
}

/**
 * レポートデータを読み込み
 */
async function loadReport() {
  const contentArea = document.getElementById('report-content');
  if (!contentArea || !firebaseDb) return;

  const companyFilter = document.getElementById('report-company-filter')?.value || '';
  const periodFilter = parseInt(document.getElementById('report-period-filter')?.value || '3', 10);

  contentArea.innerHTML = '<div class="loading-cell">レポートを生成中...</div>';

  try {
    // 期間の計算
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - periodFilter + 1, 1);
    const startYearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    // 広告費用データを取得
    let adCostsQuery = firebaseDb.collection('ad_costs')
      .where('yearMonth', '>=', startYearMonth);

    if (companyFilter) {
      adCostsQuery = adCostsQuery.where('companyDomain', '==', companyFilter);
    }

    const adCostsSnapshot = await adCostsQuery.get();

    // 応募データを取得（CPA計算用）
    let applicationsQuery = firebaseDb.collection('applications')
      .where('createdAt', '>=', startDate);

    if (companyFilter) {
      applicationsQuery = applicationsQuery.where('companyDomain', '==', companyFilter);
    }

    const applicationsSnapshot = await applicationsQuery.get();

    // データ集計
    const reportData = calculateReportData(adCostsSnapshot.docs, applicationsSnapshot.docs);

    // レポート描画
    renderReportContent(contentArea, reportData);
  } catch (error) {
    console.error('[AdCosts] Failed to load report:', error);
    contentArea.innerHTML = '<div class="error-message">レポートの生成に失敗しました</div>';
  }
}

/**
 * レポートデータを計算
 */
function calculateReportData(adCostDocs, applicationDocs) {
  // 広告費用の集計
  const channelTotals = {};
  let totalBudget = 0;
  let totalSpend = 0;

  adCostDocs.forEach(doc => {
    const data = doc.data();
    const channel = data.channel;

    if (!channelTotals[channel]) {
      channelTotals[channel] = { budget: 0, spend: 0, applications: 0 };
    }
    channelTotals[channel].budget += data.budget || 0;
    channelTotals[channel].spend += data.spend || 0;
    totalBudget += data.budget || 0;
    totalSpend += data.spend || 0;
  });

  // 応募をチャンネル別にカウント（UTMベース）
  let totalApplications = 0;
  const channelApplications = {};

  applicationDocs.forEach(doc => {
    const data = doc.data();
    totalApplications++;

    // UTMソースからチャンネルを特定
    const utmSource = (data.utm_source || '').toLowerCase();
    const utmMedium = (data.utm_medium || '').toLowerCase();

    let channel = null;

    // UTMソースでマッチング
    if (utmSource) {
      channel = UTM_SOURCE_TO_CHANNEL[utmSource];
    }

    // UTMメディアがcpcやpaidの場合は広告経由
    if (!channel && (utmMedium === 'cpc' || utmMedium === 'paid' || utmMedium === 'ppc')) {
      // ソースから推測
      if (utmSource.includes('google')) channel = 'google';
      else if (utmSource.includes('tiktok')) channel = 'tiktok';
      else if (utmSource.includes('twitter') || utmSource.includes('x')) channel = 'x';
      else if (utmSource.includes('facebook') || utmSource.includes('instagram') || utmSource.includes('meta')) channel = 'meta';
      else if (utmSource.includes('yahoo')) channel = 'yahoo';
      else if (utmSource.includes('line')) channel = 'line';
    }

    if (channel) {
      channelApplications[channel] = (channelApplications[channel] || 0) + 1;
      if (channelTotals[channel]) {
        channelTotals[channel].applications++;
      }
    }
  });

  // チャンネル別CPA計算
  Object.keys(channelTotals).forEach(channel => {
    const ct = channelTotals[channel];
    ct.cpa = ct.applications > 0 ? Math.round(ct.spend / ct.applications) : null;
  });

  // 全体CPA
  const paidApplications = Object.values(channelApplications).reduce((sum, v) => sum + v, 0);
  const overallCpa = paidApplications > 0 ? Math.round(totalSpend / paidApplications) : null;

  return {
    totalBudget,
    totalSpend,
    totalApplications,
    paidApplications,
    overallCpa,
    channelTotals,
    budgetUsageRate: totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0
  };
}

/**
 * レポートコンテンツを描画
 */
function renderReportContent(container, data) {
  const cpaStatus = getCpaStatus(data.overallCpa);

  container.innerHTML = `
    <!-- サマリーカード -->
    <div class="report-summary-grid">
      <div class="report-summary-card">
        <div class="summary-icon">💰</div>
        <div class="summary-label">総広告費</div>
        <div class="summary-value">¥${formatNumber(data.totalSpend)}</div>
        <div class="summary-sub">予算: ¥${formatNumber(data.totalBudget)} (${data.budgetUsageRate}%消化)</div>
      </div>
      <div class="report-summary-card">
        <div class="summary-icon">📝</div>
        <div class="summary-label">総応募数</div>
        <div class="summary-value">${data.totalApplications}</div>
        <div class="summary-sub">広告経由: ${data.paidApplications}件</div>
      </div>
      <div class="report-summary-card cpa-card ${cpaStatus}">
        <div class="summary-icon">🎯</div>
        <div class="summary-label">CPA（応募単価）</div>
        <div class="summary-value">${data.overallCpa ? '¥' + formatNumber(data.overallCpa) : '-'}</div>
        <div class="summary-sub">広告経由応募ベース</div>
      </div>
      <div class="report-summary-card">
        <div class="summary-icon">📊</div>
        <div class="summary-label">予算消化率</div>
        <div class="summary-value">${data.budgetUsageRate}%</div>
        <div class="summary-sub">残予算: ¥${formatNumber(data.totalBudget - data.totalSpend)}</div>
      </div>
    </div>

    <!-- チャンネル別内訳 -->
    <div class="report-section">
      <h4>チャンネル別内訳</h4>
      <div class="report-chart-container">
        <h5>広告費用比較</h5>
        <div class="bar-chart-css">
          ${renderChannelBarChart(data.channelTotals)}
        </div>
      </div>

      <table class="channel-breakdown-table">
        <thead>
          <tr>
            <th>チャンネル</th>
            <th style="text-align: right;">予算</th>
            <th style="text-align: right;">実績</th>
            <th style="text-align: right;">消化率</th>
            <th style="text-align: center;">応募数</th>
            <th style="text-align: right;">CPA</th>
          </tr>
        </thead>
        <tbody>
          ${renderChannelTableRows(data.channelTotals)}
        </tbody>
      </table>
    </div>

    <!-- CPA分析 -->
    <div class="report-section">
      <h4>CPA分析・投資判断サポート</h4>
      <div class="report-chart-container">
        ${renderCpaAnalysis(data)}
      </div>
    </div>
  `;
}

/**
 * チャンネル棒グラフを描画
 */
function renderChannelBarChart(channelTotals) {
  const maxSpend = Math.max(...Object.values(channelTotals).map(ct => ct.spend), 1);

  return PRIORITY_CHANNELS.map(channelKey => {
    const channel = CHANNELS[channelKey];
    const ct = channelTotals[channelKey] || { spend: 0 };
    const percentage = maxSpend > 0 ? (ct.spend / maxSpend) * 100 : 0;

    return `
      <div class="bar-chart-row">
        <div class="bar-chart-label">
          <span>${channel.icon}</span>
          <span>${channel.name}</span>
        </div>
        <div class="bar-chart-bar">
          <div class="bar-chart-fill ${channelKey}" style="width: ${percentage}%"></div>
        </div>
        <div class="bar-chart-value">¥${formatNumber(ct.spend)}</div>
      </div>
    `;
  }).join('');
}

/**
 * チャンネルテーブル行を描画
 */
function renderChannelTableRows(channelTotals) {
  return PRIORITY_CHANNELS.map(channelKey => {
    const channel = CHANNELS[channelKey];
    const ct = channelTotals[channelKey] || { budget: 0, spend: 0, applications: 0, cpa: null };
    const usageRate = ct.budget > 0 ? Math.round((ct.spend / ct.budget) * 100) : 0;
    const cpaStatus = getCpaStatus(ct.cpa);

    return `
      <tr>
        <td>
          <div class="channel-cell">
            <span>${channel.icon}</span>
            <span>${channel.name}</span>
          </div>
        </td>
        <td class="money">¥${formatNumber(ct.budget)}</td>
        <td class="money">¥${formatNumber(ct.spend)}</td>
        <td style="text-align: right;">${usageRate}%</td>
        <td style="text-align: center;">${ct.applications}</td>
        <td class="cpa-value ${cpaStatus}" style="text-align: right;">
          ${ct.cpa ? '¥' + formatNumber(ct.cpa) : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * CPA状態を判定
 */
function getCpaStatus(cpa) {
  if (!cpa) return '';
  if (cpa < 10000) return 'good';
  if (cpa < 30000) return 'warning';
  return 'danger';
}

/**
 * CPA分析を描画
 */
function renderCpaAnalysis(data) {
  const recommendations = [];

  // チャンネル別の推奨
  PRIORITY_CHANNELS.forEach(channelKey => {
    const ct = data.channelTotals[channelKey];
    if (!ct) return;

    const channel = CHANNELS[channelKey];

    if (ct.cpa && ct.cpa < 10000) {
      recommendations.push({
        type: 'success',
        icon: '✅',
        message: `${channel.name}: CPA ¥${formatNumber(ct.cpa)} - 効率良好。予算増額を検討`
      });
    } else if (ct.cpa && ct.cpa > 30000) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        message: `${channel.name}: CPA ¥${formatNumber(ct.cpa)} - 効率低下。クリエイティブ改善やターゲティング見直しを検討`
      });
    } else if (ct.spend > 0 && ct.applications === 0) {
      recommendations.push({
        type: 'danger',
        icon: '🚨',
        message: `${channel.name}: 広告費 ¥${formatNumber(ct.spend)} で応募0件。運用停止または大幅な見直しを検討`
      });
    }
  });

  // 全体の推奨
  if (data.budgetUsageRate < 50) {
    recommendations.push({
      type: 'info',
      icon: '💡',
      message: `予算消化率が${data.budgetUsageRate}%と低め。配信強化またはターゲット拡大を検討`
    });
  } else if (data.budgetUsageRate > 90) {
    recommendations.push({
      type: 'info',
      icon: '💡',
      message: `予算消化率が${data.budgetUsageRate}%と高め。追加予算の確保を検討`
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'info',
      icon: '📊',
      message: 'データが十分に蓄積されると、投資判断の推奨が表示されます'
    });
  }

  return `
    <div class="cpa-recommendations">
      ${recommendations.map(rec => `
        <div class="cpa-recommendation ${rec.type}">
          <span class="rec-icon">${rec.icon}</span>
          <span class="rec-message">${rec.message}</span>
        </div>
      `).join('')}
    </div>
    <style>
      .cpa-recommendations {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .cpa-recommendation {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        font-size: 0.875rem;
      }
      .cpa-recommendation.success {
        background: rgba(34, 197, 94, 0.1);
        border-left: 3px solid #22c55e;
      }
      .cpa-recommendation.warning {
        background: rgba(245, 158, 11, 0.1);
        border-left: 3px solid #f59e0b;
      }
      .cpa-recommendation.danger {
        background: rgba(239, 68, 68, 0.1);
        border-left: 3px solid #ef4444;
      }
      .cpa-recommendation.info {
        background: rgba(59, 130, 246, 0.1);
        border-left: 3px solid #3b82f6;
      }
      .rec-icon {
        flex-shrink: 0;
      }
      .rec-message {
        color: var(--text-primary);
      }
    </style>
  `;
}

// ============================================
// インポートタブ
// ============================================

/**
 * インポートタブを描画
 */
function renderImportTab(container) {
  container.innerHTML = `
    <div class="import-section">
      <h4>各媒体からデータをエクスポート</h4>
      <div class="platform-links">
        ${Object.entries(PLATFORM_EXPORT_URLS).map(([key, platform]) => `
          <div class="platform-link-card">
            <div class="platform-icon">${platform.icon}</div>
            <div class="platform-info">
              <div class="platform-name">${platform.name}</div>
              <div class="platform-note">${platform.note}</div>
              <a href="${platform.exportUrl}" target="_blank" rel="noopener" class="btn-link">
                管理画面を開く ↗
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="import-section">
      <h4>CSVインポート</h4>
      <div class="ad-costs-filters" style="margin-bottom: 1rem;">
        <div class="filter-group">
          <span class="filter-label">対象会社</span>
          <select id="import-company-select" class="filter-select">
            <option value="">会社を選択</option>
            ${companies.map(c => `
              <option value="${escapeHtml(c.domain)}">${escapeHtml(c.name || c.domain)}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="csv-import-area" id="csv-drop-area">
        <div class="csv-format-select">
          ${Object.entries(IMPORT_FORMATS).map(([key, format]) => `
            <label>
              <input type="radio" name="csv-format" value="${key}" ${key === selectedCsvFormat ? 'checked' : ''}>
              ${CHANNELS[key]?.icon || ''} ${format.name}
            </label>
          `).join('')}
        </div>

        <div class="file-input-wrapper">
          <label class="btn-file-select" for="csv-file-input">
            ファイルを選択
          </label>
          <input type="file" id="csv-file-input" accept=".csv,.tsv,.txt">
          <div class="selected-file-name" id="selected-file-name"></div>
        </div>

        <div id="csv-preview-area"></div>
      </div>
    </div>
  `;

  // イベント設定
  document.querySelectorAll('input[name="csv-format"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      selectedCsvFormat = e.target.value;
    });
  });

  document.getElementById('csv-file-input').addEventListener('change', handleFileSelect);

  // ドラッグ&ドロップ
  const dropArea = document.getElementById('csv-drop-area');
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('dragover');
  });
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      processCSVFile(file);
    }
  });
}

/**
 * ファイル選択処理
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    document.getElementById('selected-file-name').textContent = file.name;
    processCSVFile(file);
  }
}

/**
 * CSVファイル処理
 */
async function processCSVFile(file) {
  const previewArea = document.getElementById('csv-preview-area');
  if (!previewArea) return;

  previewArea.innerHTML = '<div class="loading-cell">ファイルを解析中...</div>';

  try {
    const text = await readFileAsText(file);
    const rows = parseCSV(text);

    if (rows.length < 2) {
      previewArea.innerHTML = '<div class="error-message">有効なデータがありません</div>';
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1, 6); // プレビューは5行まで

    // 日付と費用の列を特定
    const format = IMPORT_FORMATS[selectedCsvFormat];
    const dateColIndex = findColumnIndex(headers, format.columns.date);
    const costColIndex = findColumnIndex(headers, format.columns.cost);

    csvPreviewData = {
      headers,
      allRows: rows.slice(1),
      dateColIndex,
      costColIndex
    };

    previewArea.innerHTML = `
      <div class="csv-preview">
        <h5>プレビュー（${rows.length - 1}行）</h5>
        ${dateColIndex === -1 ? '<div class="error-message">日付列が見つかりません</div>' : ''}
        ${costColIndex === -1 ? '<div class="error-message">費用列が見つかりません</div>' : ''}
        <div style="overflow-x: auto;">
          <table class="csv-preview-table">
            <thead>
              <tr>
                ${headers.map((h, i) => `<th class="${i === dateColIndex ? 'highlight-col' : ''} ${i === costColIndex ? 'highlight-col' : ''}">${escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${dataRows.map(row => `
                <tr>
                  ${row.map((cell, i) => `<td class="${i === dateColIndex ? 'highlight-col' : ''} ${i === costColIndex ? 'highlight-col' : ''}">${escapeHtml(cell)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="import-actions">
          <button class="btn-import" onclick="window.AdCosts.executeImport()" ${dateColIndex === -1 || costColIndex === -1 ? 'disabled' : ''}>
            インポート実行
          </button>
        </div>
      </div>
      <style>
        .highlight-col { background: rgba(59, 130, 246, 0.1); }
      </style>
    `;
  } catch (error) {
    console.error('[AdCosts] Failed to process CSV:', error);
    previewArea.innerHTML = '<div class="error-message">ファイルの解析に失敗しました</div>';
  }
}

/**
 * ファイルをテキストとして読み込み
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * CSVパース
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    // 簡易パース（ダブルクォート対応）
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

/**
 * インポート実行
 */
async function executeImport() {
  const companyDomain = document.getElementById('import-company-select')?.value;
  if (!companyDomain) {
    showToast('会社を選択してください', 'warning');
    return;
  }

  if (!csvPreviewData || !csvPreviewData.allRows.length) {
    showToast('インポートするデータがありません', 'warning');
    return;
  }

  const { allRows, dateColIndex, costColIndex } = csvPreviewData;

  if (dateColIndex === -1 || costColIndex === -1) {
    showToast('日付または費用列が見つかりません', 'error');
    return;
  }

  // 月別に集計
  const monthlyTotals = {};

  allRows.forEach(row => {
    const dateStr = row[dateColIndex];
    const cost = parseMoneyInput(row[costColIndex]);

    if (cost > 0 && dateStr) {
      const yearMonth = parseYearMonth(dateStr);
      if (yearMonth) {
        monthlyTotals[yearMonth] = (monthlyTotals[yearMonth] || 0) + cost;
      }
    }
  });

  if (Object.keys(monthlyTotals).length === 0) {
    showToast('有効なデータがありません', 'warning');
    return;
  }

  // Firestoreに保存
  try {
    for (const [yearMonth, totalSpend] of Object.entries(monthlyTotals)) {
      const existing = await getAdCostsForMonth(companyDomain, yearMonth);
      const existingData = existing[selectedCsvFormat];

      const data = {
        companyDomain,
        yearMonth,
        channel: selectedCsvFormat,
        spend: totalSpend,
        budget: existingData?.budget || 0,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      };

      if (existingData?.docId) {
        await firebaseDb.collection('ad_costs').doc(existingData.docId).update(data);
      } else {
        data.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy = 'admin';
        await firebaseDb.collection('ad_costs').add(data);
      }
    }

    const monthCount = Object.keys(monthlyTotals).length;
    showToast(`${monthCount}ヶ月分のデータをインポートしました`, 'success');
    csvPreviewData = null;
    document.getElementById('csv-preview-area').innerHTML = '';
    document.getElementById('csv-file-input').value = '';
    document.getElementById('selected-file-name').textContent = '';
  } catch (error) {
    console.error('[AdCosts] Import failed:', error);
    showToast('インポートに失敗しました', 'error');
  }
}

/**
 * 日付文字列から年月を抽出（YYYY-MM形式）
 */
function parseYearMonth(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DD, YYYY/MM/DD 形式
  let match = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/]\d{1,2}/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`;
  }

  // YYYY年M月D日 形式
  match = dateStr.match(/(\d{4})年(\d{1,2})月/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`;
  }

  // MM/DD/YYYY 形式（US）
  match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, '0')}`;
  }

  // DD/MM/YYYY 形式（EU）※曖昧なので注意
  // デフォルトで今月を返す
  return getCurrentYearMonth();
}

/**
 * 列インデックスを検索
 */
function findColumnIndex(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    for (const name of possibleNames) {
      if (header === name.toLowerCase() || header.includes(name.toLowerCase())) {
        return i;
      }
    }
  }
  return -1;
}

// グローバル公開
window.AdCosts = {
  saveChannel,
  executeImport
};

export default {
  initAdCosts,
  initAdCostsSection,
  onSectionLoad,
  CHANNELS,
  PRIORITY_CHANNELS
};
