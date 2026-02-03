/**
 * 求人管理 - アクセス解析モジュール
 */
import { escapeHtml } from '@shared/utils.js';
import {
  formatDuration,
  getDeviceName,
  getSourceName,
  renderDemographics,
  fetchOverviewData,
  fetchTrafficData,
  fetchCompanyDetailData,
  fetchAnalyticsData
} from '@shared/analytics-utils.js';
import {
  companyDomain,
  analyticsCache,
  setAnalyticsCache
} from './state.js';

/**
 * 日付範囲選択の初期化
 */
export function initDateRangePicker() {
  const startInput = document.getElementById('analytics-start-date');
  const endInput = document.getElementById('analytics-end-date');
  const presetBtns = document.querySelectorAll('.date-preset-btn');

  if (!startInput || !endInput) return;

  // デフォルト: 過去30日間
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);

  endInput.value = formatDateForInput(today);
  startInput.value = formatDateForInput(thirtyDaysAgo);

  // 最大値を今日に設定
  endInput.max = formatDateForInput(today);
  startInput.max = formatDateForInput(today);

  // プリセットボタンのイベント
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const { start, end } = getPresetDates(preset);

      startInput.value = formatDateForInput(start);
      endInput.value = formatDateForInput(end);

      // アクティブ状態を更新
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 日付変更時にプリセットのアクティブ状態をクリア
  startInput.addEventListener('change', () => {
    presetBtns.forEach(b => b.classList.remove('active'));
  });
  endInput.addEventListener('change', () => {
    presetBtns.forEach(b => b.classList.remove('active'));
  });
}

/**
 * プリセット期間の日付を取得
 */
function getPresetDates(preset) {
  const today = new Date();
  let start, end;

  switch (preset) {
    case '7days':
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 6);
      break;
    case '30days':
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 29);
      break;
    case '90days':
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 89);
      break;
    default:
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 29);
  }

  return { start, end };
}

/**
 * 日付をinput[type=date]用にフォーマット
 */
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 選択された日付範囲から日数を計算
 */
function getSelectedDays() {
  const startInput = document.getElementById('analytics-start-date');
  const endInput = document.getElementById('analytics-end-date');

  if (!startInput?.value || !endInput?.value) {
    return 30; // デフォルト30日
  }

  const start = new Date(startInput.value);
  const end = new Date(endInput.value);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays;
}

/**
 * アクセス解析の期間を計算（後方互換）
 */
export function getAnalyticsPeriod(type) {
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
 * Cloud Functions（GA4 API）からアクセス解析データを取得
 */
export async function loadAnalyticsData() {
  // 日付範囲入力から日数を取得
  const days = getSelectedDays();

  const jobTbody = document.getElementById('job-analytics-tbody');
  const sourceTbody = document.getElementById('source-analytics-tbody');
  const deviceTbody = document.getElementById('device-analytics-tbody');

  if (jobTbody) jobTbody.innerHTML = '<tr><td colspan="5" class="loading-cell">データを読み込み中...</td></tr>';
  if (sourceTbody) sourceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">読み込み中...</td></tr>';
  if (deviceTbody) deviceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">読み込み中...</td></tr>';

  try {
    const [overview, traffic] = await Promise.all([
      fetchOverviewData(days),
      fetchTrafficData(days)
    ]);

    let companyDetail = null;
    if (companyDomain) {
      companyDetail = await fetchCompanyDetailData(companyDomain, days);
    }

    const data = {
      overview,
      traffic,
      companyDetail
    };

    setAnalyticsCache(data);
    renderGA4AnalyticsData(data);

  } catch (error) {
    console.error('アクセス解析データ取得エラー:', error);
    renderAnalyticsDemo();
  }
}

/**
 * デモデータを表示（データがない場合）
 */
export function renderAnalyticsDemo() {
  document.getElementById('analytics-pv').textContent = '- (未連携)';
  document.getElementById('analytics-users').textContent = '-';
  document.getElementById('analytics-pages-per-session').textContent = '-';
  document.getElementById('analytics-avg-time').textContent = '-';

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

  const sourceTbody = document.getElementById('source-analytics-tbody');
  if (sourceTbody) {
    sourceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データなし</td></tr>';
  }

  const deviceTbody = document.getElementById('device-analytics-tbody');
  if (deviceTbody) {
    deviceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データなし</td></tr>';
  }
}

/**
 * アクセス解析データを描画（Firestore経由用）
 */
export function renderAnalyticsData(pageviews) {
  const totalPV = pageviews.length;
  const uniqueUsers = new Set(pageviews.map(pv => pv.userId || pv.sessionId)).size;
  const sessions = new Set(pageviews.map(pv => pv.sessionId)).size;
  const pagesPerSession = sessions > 0 ? (totalPV / sessions).toFixed(1) : '-';

  const avgTime = pageviews.reduce((acc, pv) => acc + (pv.duration || 0), 0) / totalPV;

  document.getElementById('analytics-pv').textContent = totalPV.toLocaleString();
  document.getElementById('analytics-users').textContent = uniqueUsers.toLocaleString();
  document.getElementById('analytics-pages-per-session').textContent = pagesPerSession;
  document.getElementById('analytics-avg-time').textContent = formatDuration(avgTime);

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

  const sourceStats = {};
  pageviews.forEach(pv => {
    const source = getSourceName(pv.source || pv.utmSource || pv.referrer || 'direct');
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

  const deviceStats = {};
  pageviews.forEach(pv => {
    const device = getDeviceName(pv.device || pv.deviceCategory || 'unknown');
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
export function renderGA4AnalyticsData(data) {
  const { overview, traffic, companyDetail } = data;

  if (companyDomain && companyDetail) {
    const summary = companyDetail.summary || {};
    document.getElementById('analytics-pv').textContent = (summary.totalViews || 0).toLocaleString();
    document.getElementById('analytics-users').textContent = (summary.totalUsers || 0).toLocaleString();
    document.getElementById('analytics-pages-per-session').textContent = summary.avgJobsViewed || '-';
    document.getElementById('analytics-avg-time').textContent = formatDuration(summary.avgSessionDuration || 0);
  } else {
    document.getElementById('analytics-pv').textContent = (overview?.pageViews || 0).toLocaleString();
    document.getElementById('analytics-users').textContent = (overview?.users || 0).toLocaleString();

    const sessions = overview?.sessions || 0;
    const pageViews = overview?.pageViews || 0;
    const pagesPerSession = sessions > 0 ? (pageViews / sessions).toFixed(1) : '-';
    document.getElementById('analytics-pages-per-session').textContent = pagesPerSession;
    document.getElementById('analytics-avg-time').textContent = '-';
  }

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

  const sourceTbody = document.getElementById('source-analytics-tbody');
  if (sourceTbody) {
    if (companyDomain && companyDetail?.traffic && companyDetail.traffic.length > 0) {
      const companyTraffic = companyDetail.traffic;
      const totalCount = companyTraffic.reduce((acc, t) => acc + (t.count || 0), 0);
      sourceTbody.innerHTML = companyTraffic.slice(0, 10).map(item => {
        const percentage = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
        return `
          <tr>
            <td>${escapeHtml(item.channel || '不明')}</td>
            <td>${item.count || 0}</td>
            <td>${percentage}%</td>
          </tr>
        `;
      }).join('');
    } else {
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
  }

  const deviceTbody = document.getElementById('device-analytics-tbody');
  if (deviceTbody) {
    const devices = (companyDomain && companyDetail?.devices) ? companyDetail.devices : (traffic?.devices || []);
    if (devices.length > 0) {
      const totalSessions = devices.reduce((acc, d) => acc + (d.sessions || 0), 0);
      deviceTbody.innerHTML = devices.map(item => {
        const percentage = totalSessions > 0 ? Math.round((item.sessions / totalSessions) * 100) : 0;
        return `
          <tr>
            <td>${escapeHtml(getDeviceName(item.device))}</td>
            <td>${item.sessions || 0}</td>
            <td>${percentage}%</td>
          </tr>
        `;
      }).join('');
    } else {
      deviceTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">データがありません</td></tr>';
    }
  }

  const demographicsSection = document.getElementById('analytics-demographics');
  if (demographicsSection) {
    if (companyDomain && companyDetail) {
      demographicsSection.style.display = 'block';
      renderDemographics(companyDetail.gender, companyDetail.age, {
        maleBarId: 'gender-bar-male',
        femaleBarId: 'gender-bar-female',
        malePercentId: 'gender-male-percent',
        femalePercentId: 'gender-female-percent',
        ageContainerId: 'age-bars'
      });
    } else {
      demographicsSection.style.display = 'none';
    }
  }
}

// ========================================
// タブ機能
// ========================================

// Chart.jsインスタンスを保持
let jmDailyChart = null;
let jmDayOfWeekChart = null;
let jmHourChart = null;
let jmChannelChart = null;
let jmActionChart = null;

/**
 * 分析タブの初期化
 */
export function initAnalyticsTabs() {
  const tabs = document.querySelectorAll('#jm-analytics-tabs .analytics-tab');
  const contents = document.querySelectorAll('#section-analytics .analytics-tab-content');

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

/**
 * タブごとのデータ読み込み
 */
async function loadTabData(tabId) {
  const days = getSelectedDays();

  switch (tabId) {
    case 'jm-conversion-tab':
      await loadConversionData(days);
      break;
    case 'jm-traffic-tab':
      await loadTrafficBehaviorData(days);
      break;
    case 'jm-trends-tab':
      await loadTrendsData(days);
      break;
  }
}

// ========================================
// 応募・CVRタブ
// ========================================

/**
 * 応募・CVRデータを読み込み
 */
async function loadConversionData(days) {
  if (!companyDomain) return;

  try {
    const data = await fetchAnalyticsData('funnel', { domain: companyDomain, days });
    renderConversionData(data);
  } catch (error) {
    console.error('応募・CVRデータ取得エラー:', error);
    renderMockConversionData();
  }
}

/**
 * 応募・CVRデータを描画
 */
function renderConversionData(data) {
  // ファネルチャート
  const funnelEl = document.getElementById('jm-funnel-chart');
  if (funnelEl && data.funnel && data.funnel.length > 0) {
    funnelEl.innerHTML = data.funnel.map(stage => `
      <div class="funnel-stage">
        <span class="funnel-stage-name">${escapeHtml(stage.stage)}</span>
        <span class="funnel-stage-count">${stage.count.toLocaleString()}</span>
        <span class="funnel-stage-rate">${stage.rate}%</span>
      </div>
    `).join('');
  } else if (funnelEl) {
    funnelEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
  }

  // アクション内訳チャート
  const actionEl = document.getElementById('jm-action-breakdown-chart');
  if (actionEl && data.actionBreakdown && data.actionBreakdown.length > 0) {
    if (jmActionChart) {
      jmActionChart.destroy();
      jmActionChart = null;
    }

    actionEl.innerHTML = '<canvas id="jm-action-canvas"></canvas>';
    const canvas = document.getElementById('jm-action-canvas');
    const ctx = canvas.getContext('2d');

    jmActionChart = new Chart(ctx, {
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
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.8)' } },
          y: { grid: { display: false } }
        }
      }
    });
  } else if (actionEl) {
    actionEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
  }

  // 求人別CVRテーブル
  const cvrTbody = document.getElementById('jm-job-cvr-tbody');
  if (cvrTbody && data.byJob && data.byJob.length > 0) {
    cvrTbody.innerHTML = data.byJob.map(job => `
      <tr>
        <td>${escapeHtml(job.title || job.jobId || '-')}</td>
        <td>${job.views.toLocaleString()}</td>
        <td>${job.clicks}</td>
        <td>${job.cvr}%</td>
      </tr>
    `).join('');
  } else if (cvrTbody) {
    cvrTbody.innerHTML = '<tr><td colspan="4" class="loading-cell">データがありません</td></tr>';
  }

  // 応募イベント一覧
  const appTbody = document.getElementById('jm-applications-tbody');
  const typeLabels = { apply: '応募ボタン', line: 'LINE相談', consult: '相談フォーム' };
  if (appTbody && data.applications && data.applications.length > 0) {
    appTbody.innerHTML = data.applications.map(app => `
      <tr>
        <td>${escapeHtml(app.date)}</td>
        <td>${escapeHtml(app.jobTitle || '-')}</td>
        <td><span class="type-badge ${escapeHtml(app.type)}">${typeLabels[app.type] || escapeHtml(app.type)}</span></td>
        <td>${escapeHtml(app.source)}</td>
      </tr>
    `).join('');
  } else if (appTbody) {
    appTbody.innerHTML = '<tr><td colspan="4" class="loading-cell">応募データがありません</td></tr>';
  }
}

/**
 * モック応募・CVRデータ
 */
function renderMockConversionData() {
  const mockData = {
    funnel: [
      { stage: 'ページ閲覧', count: 500, rate: '100' },
      { stage: 'スクロール', count: 350, rate: '70.0' },
      { stage: 'ボタンクリック', count: 25, rate: '5.0' }
    ],
    actionBreakdown: [
      { label: '応募ボタン', count: 15 },
      { label: 'LINE相談', count: 8 },
      { label: 'フォーム送信', count: 2 }
    ],
    byJob: [
      { title: '製造スタッフ', views: 200, clicks: 12, cvr: '6.0' },
      { title: '組立作業員', views: 150, clicks: 8, cvr: '5.3' },
      { title: '検査・検品', views: 100, clicks: 5, cvr: '5.0' }
    ],
    applications: []
  };
  renderConversionData(mockData);
}

// ========================================
// 流入・行動タブ
// ========================================

/**
 * 流入・行動データを読み込み
 */
async function loadTrafficBehaviorData(days) {
  if (!companyDomain) return;

  try {
    const [engagementData, trafficData] = await Promise.all([
      fetchAnalyticsData('engagement', { domain: companyDomain, days }),
      fetchAnalyticsData('traffic', { domain: companyDomain, days })
    ]);
    renderTrafficBehaviorData({ engagement: engagementData, traffic: trafficData });
  } catch (error) {
    console.error('流入・行動データ取得エラー:', error);
    renderMockTrafficBehaviorData();
  }
}

/**
 * 流入・行動データを描画
 */
function renderTrafficBehaviorData(data) {
  const { engagement, traffic } = data;

  // 行動サマリー
  const engOverall = engagement?.overall || {};
  document.getElementById('jm-avg-session-duration').textContent = `${engOverall.avgSessionDuration || 0}秒`;
  document.getElementById('jm-engagement-rate').textContent = `${engOverall.engagementRate || 0}%`;
  document.getElementById('jm-bounce-rate').textContent = `${engOverall.bounceRate || 0}%`;

  // チャネル別チャート
  const channelEl = document.getElementById('jm-channel-chart');
  if (channelEl && traffic?.channels && traffic.channels.length > 0) {
    if (jmChannelChart) {
      jmChannelChart.destroy();
      jmChannelChart = null;
    }

    channelEl.innerHTML = '<canvas id="jm-channel-canvas"></canvas>';
    const canvas = document.getElementById('jm-channel-canvas');
    const ctx = canvas.getContext('2d');

    jmChannelChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: traffic.channels.map(c => c.channel),
        datasets: [{
          label: 'セッション数',
          data: traffic.channels.map(c => c.sessions),
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
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.8)' } },
          y: { grid: { display: false } }
        }
      }
    });
  } else if (channelEl) {
    channelEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
  }

  // 参照元テーブル
  const sourceTbody = document.getElementById('jm-source-tbody');
  if (sourceTbody && traffic?.sources && traffic.sources.length > 0) {
    sourceTbody.innerHTML = traffic.sources.slice(0, 10).map(s => `
      <tr>
        <td>${escapeHtml(s.source || '(direct)')}</td>
        <td>${escapeHtml(s.medium || '(none)')}</td>
        <td>${s.sessions.toLocaleString()}</td>
        <td>${s.users.toLocaleString()}</td>
      </tr>
    `).join('');
  } else if (sourceTbody) {
    sourceTbody.innerHTML = '<tr><td colspan="4" class="loading-cell">データがありません</td></tr>';
  }

  // 求人別エンゲージメントテーブル
  const engTbody = document.getElementById('jm-engagement-tbody');
  if (engTbody && engagement?.byJob && engagement.byJob.length > 0) {
    engTbody.innerHTML = engagement.byJob.map(job => `
      <tr>
        <td>${escapeHtml(job.title || job.jobId || '-')}</td>
        <td>${job.views.toLocaleString()}</td>
        <td>${Math.round(job.engagementTime)}秒</td>
        <td>${job.avgTimePerView}秒</td>
      </tr>
    `).join('');
  } else if (engTbody) {
    engTbody.innerHTML = '<tr><td colspan="4" class="loading-cell">データがありません</td></tr>';
  }
}

/**
 * モック流入・行動データ
 */
function renderMockTrafficBehaviorData() {
  const mockData = {
    engagement: {
      overall: { avgSessionDuration: 45, engagementRate: 68, bounceRate: 32 },
      byJob: [
        { title: '製造スタッフ', views: 200, engagementTime: 900, avgTimePerView: '4.5' },
        { title: '組立作業員', views: 150, engagementTime: 600, avgTimePerView: '4.0' }
      ]
    },
    traffic: {
      channels: [
        { channel: 'Organic Search', sessions: 250 },
        { channel: 'Direct', sessions: 180 },
        { channel: 'Social', sessions: 50 },
        { channel: 'Referral', sessions: 20 }
      ],
      sources: [
        { source: 'google', medium: 'organic', sessions: 180, users: 150 },
        { source: '(direct)', medium: '(none)', sessions: 120, users: 100 },
        { source: 'yahoo', medium: 'organic', sessions: 50, users: 45 }
      ]
    }
  };
  renderTrafficBehaviorData(mockData);
}

// ========================================
// 時系列タブ
// ========================================

/**
 * 時系列データを読み込み
 */
async function loadTrendsData(days) {
  if (!companyDomain) return;

  try {
    const data = await fetchAnalyticsData('trends', { domain: companyDomain, days });
    renderTrendsData(data);
  } catch (error) {
    console.error('時系列データ取得エラー:', error);
    renderMockTrendsData();
  }
}

/**
 * 時系列データを描画
 */
function renderTrendsData(data) {
  // ピーク情報
  if (data.insights) {
    document.getElementById('jm-peak-day').textContent = data.insights.peakDay || '-';
    document.getElementById('jm-peak-hour').textContent = data.insights.peakHour || '-';
  }

  // 曜日別チャート
  const dayChartEl = document.getElementById('jm-day-of-week-chart');
  if (dayChartEl && data.byDayOfWeek && data.byDayOfWeek.length > 0) {
    if (jmDayOfWeekChart) {
      jmDayOfWeekChart.destroy();
      jmDayOfWeekChart = null;
    }

    dayChartEl.innerHTML = '<canvas id="jm-day-of-week-canvas"></canvas>';
    const canvas = document.getElementById('jm-day-of-week-canvas');
    const ctx = canvas.getContext('2d');

    jmDayOfWeekChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.byDayOfWeek.map(d => d.day),
        datasets: [{
          label: 'セッション数',
          data: data.byDayOfWeek.map(d => d.sessions),
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.8)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } else if (dayChartEl) {
    dayChartEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
  }

  // 時間帯別チャート
  const hourChartEl = document.getElementById('jm-hour-chart');
  if (hourChartEl && data.byHour && data.byHour.length > 0) {
    if (jmHourChart) {
      jmHourChart.destroy();
      jmHourChart = null;
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

    hourChartEl.innerHTML = '<canvas id="jm-hour-canvas"></canvas>';
    const canvas = document.getElementById('jm-hour-canvas');
    const ctx = canvas.getContext('2d');

    jmHourChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: groupedData.map(g => g.label),
        datasets: [{
          label: 'セッション数',
          data: groupedData.map(g => g.sessions),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.8)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } else if (hourChartEl) {
    hourChartEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
  }

  // 日別推移チャート
  const dailyChartEl = document.getElementById('jm-daily-chart');
  if (dailyChartEl && data.daily && data.daily.length > 0) {
    if (jmDailyChart) {
      jmDailyChart.destroy();
      jmDailyChart = null;
    }

    dailyChartEl.innerHTML = '<canvas id="jm-daily-canvas"></canvas>';
    const canvas = document.getElementById('jm-daily-canvas');
    const ctx = canvas.getContext('2d');

    jmDailyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.daily.map(d => d.date),
        datasets: [{
          label: 'PV',
          data: data.daily.map(d => d.views),
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
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.8)' } },
          x: { grid: { display: false }, ticks: { maxRotation: 45 } }
        }
      }
    });
  } else if (dailyChartEl) {
    dailyChartEl.innerHTML = '<div class="loading-placeholder">データがありません</div>';
  }
}

/**
 * モック時系列データ
 */
function renderMockTrendsData() {
  const mockData = {
    insights: { peakDay: '木', peakHour: '14時' },
    byDayOfWeek: [
      { day: '日', sessions: 38 },
      { day: '月', sessions: 52 },
      { day: '火', sessions: 48 },
      { day: '水', sessions: 55 },
      { day: '木', sessions: 60 },
      { day: '金', sessions: 50 },
      { day: '土', sessions: 42 }
    ],
    byHour: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      sessions: Math.floor(Math.random() * 20) + 5
    })),
    daily: Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        views: Math.floor(Math.random() * 30) + 10
      };
    })
  };
  renderTrendsData(mockData);
}
