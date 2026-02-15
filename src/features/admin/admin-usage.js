/**
 * 管理画面利用状況 - 表示モジュール
 * admin権限のみアクセス可能
 */

import { getUsageSummary, getCompanyUsageDetail, getSectionUsageStats, getUserUsageStats } from '@shared/activity-tracker.js';
import { escapeHtml, showToast } from '@shared/utils.js';

let currentTab = 'summary';
let currentPeriod = 30; // 日数

/**
 * 利用状況セクションを初期化
 */
export async function initAdminUsageSection() {
  setupTabs();
  setupPeriodSelector();
  await loadCurrentTab();
}

/**
 * タブ切り替えのセットアップ
 */
function setupTabs() {
  const tabs = document.querySelectorAll('#section-admin-usage .usage-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      await loadCurrentTab();
    });
  });
}

/**
 * 期間セレクターのセットアップ
 */
function setupPeriodSelector() {
  const selector = document.getElementById('usage-period-select');
  if (selector) {
    selector.addEventListener('change', async () => {
      currentPeriod = parseInt(selector.value, 10);
      await loadCurrentTab();
    });
  }
}

/**
 * 現在のタブをロード
 */
async function loadCurrentTab() {
  const contentArea = document.getElementById('usage-content');
  if (!contentArea) return;

  contentArea.innerHTML = '<div class="loading-spinner">読み込み中...</div>';

  try {
    switch (currentTab) {
      case 'summary':
        await renderSummaryTab(contentArea);
        break;
      case 'companies':
        await renderCompaniesTab(contentArea);
        break;
      case 'users':
        await renderUsersTab(contentArea);
        break;
      case 'sections':
        await renderSectionsTab(contentArea);
        break;
    }
  } catch (error) {
    console.error('[AdminUsage] Failed to load tab:', error);
    contentArea.innerHTML = '<div class="error-message">データの読み込みに失敗しました</div>';
  }
}

/**
 * サマリータブをレンダリング
 */
async function renderSummaryTab(container) {
  const data = await getUsageSummary(currentPeriod);
  if (!data) {
    container.innerHTML = '<div class="no-data">データがありません</div>';
    return;
  }

  const inactiveCompanies = data.totalCompanies - data.activeCompanies - data.dormantCompanies;

  container.innerHTML = `
    <div class="usage-stats-grid">
      <div class="usage-stat-card">
        <div class="usage-stat-value">${data.activeCompanies}</div>
        <div class="usage-stat-label">アクティブ企業</div>
        <div class="usage-stat-sub">過去7日以内にログイン</div>
      </div>
      <div class="usage-stat-card warning">
        <div class="usage-stat-value">${inactiveCompanies}</div>
        <div class="usage-stat-label">非アクティブ</div>
        <div class="usage-stat-sub">7-30日間ログインなし</div>
      </div>
      <div class="usage-stat-card danger">
        <div class="usage-stat-value">${data.dormantCompanies}</div>
        <div class="usage-stat-label">休眠企業</div>
        <div class="usage-stat-sub">30日以上ログインなし</div>
      </div>
      <div class="usage-stat-card">
        <div class="usage-stat-value">${data.totalLogins}</div>
        <div class="usage-stat-label">総ログイン数</div>
        <div class="usage-stat-sub">過去${currentPeriod}日間</div>
      </div>
    </div>

    <div class="usage-section">
      <h3>機能別利用回数</h3>
      <div class="usage-bar-chart">
        ${renderSectionBars(data.sectionStats)}
      </div>
    </div>
  `;
}

/**
 * 会社別タブをレンダリング
 */
async function renderCompaniesTab(container) {
  const data = await getUsageSummary(currentPeriod);
  if (!data || !data.companyStats.length) {
    container.innerHTML = '<div class="no-data">データがありません</div>';
    return;
  }

  // ログイン数でソート
  const sorted = [...data.companyStats].sort((a, b) => b.logins - a.logins);

  container.innerHTML = `
    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>会社名</th>
            <th>ログイン数</th>
            <th>アクション数</th>
            <th>よく使う機能</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(company => {
            const topSection = getTopSection(company.sections);
            const displayName = company.companyName || '管理者';
            return `
              <tr>
                <td>${escapeHtml(displayName)}</td>
                <td>${company.logins}</td>
                <td>${company.actions}</td>
                <td>${topSection ? getSectionLabel(topSection) : '-'}</td>
                <td>
                  <button class="btn-small btn-outline" data-domain="${escapeHtml(company.companyDomain)}" onclick="window.AdminUsage.showCompanyDetail('${escapeHtml(company.companyDomain)}')">
                    詳細
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * ユーザー別タブをレンダリング
 */
async function renderUsersTab(container) {
  const data = await getUserUsageStats(currentPeriod);
  if (!data || !data.length) {
    container.innerHTML = '<div class="no-data">データがありません</div>';
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ユーザー名</th>
            <th>会社名</th>
            <th>最終ログイン</th>
            <th>操作数</th>
          </tr>
        </thead>
        <tbody>
          ${data.slice(0, 50).map(user => {
            const lastLogin = user.lastLoginAt ? formatDate(user.lastLoginAt) : '-';
            const companyDisplayName = user.companyName || '管理者';
            return `
              <tr>
                <td>${escapeHtml(user.userName || '-')}</td>
                <td>${escapeHtml(companyDisplayName)}</td>
                <td>${lastLogin}</td>
                <td>${user.actions}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * 機能別タブをレンダリング
 */
async function renderSectionsTab(container) {
  const data = await getSectionUsageStats(currentPeriod);
  if (!data || !data.length) {
    container.innerHTML = '<div class="no-data">データがありません</div>';
    return;
  }

  const total = data.reduce((sum, s) => sum + s.total, 0);

  container.innerHTML = `
    <div class="usage-section-stats">
      ${data.map(section => {
        const percent = total > 0 ? Math.round((section.total / total) * 100) : 0;
        return `
          <div class="usage-section-item">
            <div class="usage-section-info">
              <span class="usage-section-name">${getSectionLabel(section.section)}</span>
              <span class="usage-section-count">${section.total}回 (${percent}%)</span>
            </div>
            <div class="usage-bar-bg">
              <div class="usage-bar-fill" style="width: ${percent}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 会社詳細モーダルを表示
 */
export async function showCompanyDetail(companyDomain) {
  const data = await getCompanyUsageDetail(companyDomain, currentPeriod);
  if (!data) {
    showToast('データの取得に失敗しました', 'error');
    return;
  }

  const modal = document.getElementById('company-usage-modal');
  if (!modal) return;

  const content = modal.querySelector('.modal-body');
  const modalTitle = companyDomain || '管理者';
  if (content) {
    content.innerHTML = `
      <h3>${escapeHtml(modalTitle)} の利用状況</h3>

      <div class="usage-detail-summary">
        <div class="usage-detail-item">
          <span class="label">総ログイン数:</span>
          <span class="value">${data.totalLogins}</span>
        </div>
        <div class="usage-detail-item">
          <span class="label">総アクション数:</span>
          <span class="value">${data.totalActions}</span>
        </div>
      </div>

      <h4>ユーザー別</h4>
      <div class="table-container">
        <table class="admin-table compact">
          <thead>
            <tr>
              <th>ユーザー名</th>
              <th>役割</th>
              <th>最終ログイン</th>
              <th>操作数</th>
            </tr>
          </thead>
          <tbody>
            ${data.userStats.length ? data.userStats.map(user => `
              <tr>
                <td>${escapeHtml(user.userName || '-')}</td>
                <td>${user.role || '-'}</td>
                <td>${user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}</td>
                <td>${user.actions}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">データがありません</td></tr>'}
          </tbody>
        </table>
      </div>

      <h4>機能別利用回数</h4>
      <div class="usage-bar-chart">
        ${Object.keys(data.sectionStats || {}).length ? renderSectionBars(data.sectionStats) : '<div class="no-data-inline">データがありません</div>'}
      </div>

      <h4>直近のアクティビティ</h4>
      <div class="activity-list">
        ${data.recentActivities && data.recentActivities.length ? data.recentActivities.slice(0, 20).map(act => `
          <div class="activity-item">
            <span class="activity-time">${act.timestamp ? formatDateTime(act.timestamp) : '-'}</span>
            <span class="activity-user">${escapeHtml(act.userName || '-')}</span>
            <span class="activity-action">${getActionLabel(act.action)}</span>
            <span class="activity-section">${getSectionLabel(act.section)}</span>
          </div>
        `).join('') : '<div class="no-data-inline">データがありません</div>'}
      </div>
    `;
  }

  modal.classList.add('active');

  // 閉じるボタン
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }
}

// ============================================
// ヘルパー関数
// ============================================

function renderSectionBars(sectionStats) {
  const entries = Object.entries(sectionStats).sort((a, b) => b[1] - a[1]);
  const max = entries.length > 0 ? entries[0][1] : 1;

  return entries.map(([section, count]) => {
    const percent = Math.round((count / max) * 100);
    return `
      <div class="usage-bar-item">
        <span class="usage-bar-label">${getSectionLabel(section)}</span>
        <div class="usage-bar-bg">
          <div class="usage-bar-fill" style="width: ${percent}%"></div>
        </div>
        <span class="usage-bar-count">${count}回</span>
      </div>
    `;
  }).join('');
}

function getTopSection(sections) {
  const entries = Object.entries(sections);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function getSectionLabel(section) {
  const labels = {
    'overview': '概要',
    'analytics-detail': '詳細分析',
    'company-manage': '会社管理',
    'job-listings': '求人一覧',
    'job-manage': '求人管理',
    'lp-settings': 'LP設定',
    'recruit-settings': '採用ページ設定',
    'applicant-select': '応募者管理',
    'company-users': '会社ユーザー管理',
    'announcements': 'お知らせ管理',
    'settings': '設定',
    'auth': '認証'
  };
  return labels[section] || section;
}

function getActionLabel(action) {
  const labels = {
    'login': 'ログイン',
    'view': '表示',
    'create': '作成',
    'update': '更新',
    'delete': '削除'
  };
  return labels[action] || action;
}

function formatDate(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now - d;

  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins}分前`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}時間前`;
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}日前`;
  }

  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateTime(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.AdminUsage = {
    showCompanyDetail
  };
}

export default {
  initAdminUsageSection,
  showCompanyDetail
};
