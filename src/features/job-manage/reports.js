/**
 * 求人管理 - レポート生成モジュール
 */
import { escapeHtml } from '@shared/utils.js';
import {
  companyDomain,
  companyName,
  jobsCache,
  applicationsCache,
  setApplicationsCache,
  reportData,
  setReportData
} from './state.js';

/**
 * レポート期間を計算
 */
export function getReportPeriod(type) {
  const now = new Date();
  let start, end;

  switch (type) {
    case 'week': {
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last-week': {
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
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last-month': {
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
export async function loadApplicationsData(startDate, endDate) {
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
export function aggregateByStatus(applications) {
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
export function aggregateByJob(applications) {
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
export function aggregateBySource(applications) {
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
export function aggregateByAssignee(applications) {
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

  const statusData = aggregateByStatus(applications);
  const statusTbody = document.getElementById('status-breakdown');
  statusTbody.innerHTML = statusData.map(item => `
    <tr>
      <td>${escapeHtml(item.status)}</td>
      <td>${item.count}</td>
      <td>${item.percentage}%</td>
    </tr>
  `).join('');

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

  document.getElementById('report-empty').style.display = 'none';
  document.getElementById('report-content').style.display = 'block';
  document.getElementById('report-actions').style.display = 'flex';
}

/**
 * レポート生成
 */
export async function generateReport() {
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

  document.getElementById('report-loading').style.display = 'flex';
  document.getElementById('report-empty').style.display = 'none';
  document.getElementById('report-content').style.display = 'none';
  document.getElementById('report-actions').style.display = 'none';

  try {
    const [applications, comparison] = await Promise.all([
      loadApplicationsData(start, end),
      loadComparisonData(start, end)
    ]);

    setApplicationsCache(applications);
    setReportData({
      applications,
      comparison,
      period: { start, end }
    });

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
export function downloadReportCsv() {
  if (!reportData || !reportData.applications.length) {
    alert('レポートデータがありません');
    return;
  }

  const { applications, period } = reportData;

  const headers = ['応募日時', '求人タイトル', '氏名', 'ステータス', '流入元', '担当者'];

  const rows = applications.map(app => [
    app.createdAt ? new Date(app.createdAt).toLocaleString('ja-JP') : '',
    app.jobTitle || '',
    app.name || '',
    app.status || 'new',
    app.source || app.utmSource || '',
    app.assignee || ''
  ]);

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
export function downloadReportExcel() {
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

  const statusData = aggregateByStatus(applications);
  const statusHeaders = ['ステータス', '件数', '割合'];
  const statusRows = statusData.map(item => [item.status, item.count, `${item.percentage}%`]);
  const wsStatus = XLSX.utils.aoa_to_sheet([statusHeaders, ...statusRows]);
  XLSX.utils.book_append_sheet(wb, wsStatus, 'ステータス別');

  const sourceData = aggregateBySource(applications);
  const sourceHeaders = ['流入元', '件数', '割合'];
  const sourceRows = sourceData.map(item => [item.source, item.count, `${item.percentage}%`]);
  const wsSource = XLSX.utils.aoa_to_sheet([sourceHeaders, ...sourceRows]);
  XLSX.utils.book_append_sheet(wb, wsSource, '流入元別');

  const assigneeData = aggregateByAssignee(applications);
  const assigneeHeaders = ['担当者', '対応済', '未対応'];
  const assigneeRows = assigneeData.map(item => [item.assignee, item.handled, item.pending]);
  const wsAssignee = XLSX.utils.aoa_to_sheet([assigneeHeaders, ...assigneeRows]);
  XLSX.utils.book_append_sheet(wb, wsAssignee, '担当者別');

  const startStr = period.start.toISOString().split('T')[0];
  const endStr = period.end.toISOString().split('T')[0];
  XLSX.writeFile(wb, `report-${companyDomain}-${startStr}-${endStr}.xlsx`);
}
