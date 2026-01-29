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
  fetchCompanyDetailData
} from '@shared/analytics-utils.js';
import {
  companyDomain,
  analyticsCache,
  setAnalyticsCache
} from './state.js';

/**
 * アクセス解析の期間を計算
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
  const periodSelect = document.getElementById('analytics-period');
  const periodType = periodSelect?.value || '7days';

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
