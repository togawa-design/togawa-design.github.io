/**
 * 求人一覧機能
 * 会社ごとにわかりやすく求人一覧を表示
 */
import { escapeHtml } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { getJobStatus } from '@shared/job-service.js';
import { isAdmin, getUserCompanyDomain } from './auth.js';

// 状態管理
let allJobs = [];
let allCompanies = [];
let filteredJobs = [];
let pendingCompanyFilter = null; // 遷移時に適用するフィルター値

/**
 * 求人一覧を初期化
 * @param {string} [companyDomain] - 初期フィルターとして適用する会社ドメイン
 */
export async function initJobListings(companyDomain = null) {
  // 引数で渡された場合のみ設定（事前にsetCompanyFilterで設定されている場合は上書きしない）
  if (companyDomain) {
    pendingCompanyFilter = companyDomain;
  }
  await loadJobListingsData();
  setupEventListeners();
}

/**
 * 会社フィルターを設定（外部から呼び出し用）
 * @param {string} companyDomain - 会社ドメイン
 */
export function setCompanyFilter(companyDomain) {
  pendingCompanyFilter = companyDomain;
  // すでにデータが読み込まれている場合は即座に適用
  if (allJobs.length > 0) {
    const companyFilter = document.getElementById('job-company-filter');
    if (companyFilter) {
      companyFilter.value = companyDomain || '';
      filterAndRenderJobs();
    }
  }
}

/**
 * データを読み込み
 */
async function loadJobListingsData() {
  const container = document.getElementById('job-listings-container');
  if (!container) return;

  try {
    // 会社一覧と求人一覧を取得
    allCompanies = await JobsLoader.fetchCompanies();
    allJobs = await JobsLoader.fetchAllJobs();

    // 会社ユーザーの場合は自社の求人のみフィルタ
    if (!isAdmin()) {
      const userCompanyDomain = getUserCompanyDomain();
      if (userCompanyDomain) {
        allJobs = allJobs.filter(job => job.companyDomain === userCompanyDomain);
      }
    }

    // 会社フィルターのオプションを生成
    populateCompanyFilter();

    // 保留中のフィルターがあれば適用
    if (pendingCompanyFilter) {
      const companyFilter = document.getElementById('job-company-filter');
      if (companyFilter) {
        companyFilter.value = pendingCompanyFilter;
      }
      pendingCompanyFilter = null; // 適用後はクリア
    }

    // サマリーを更新
    updateSummary();

    // 求人一覧を表示
    filterAndRenderJobs();
  } catch (error) {
    console.error('求人一覧の読み込みエラー:', error);
    container.innerHTML = '<div class="error-message">データの読み込みに失敗しました</div>';
  }
}

/**
 * サマリーを更新
 */
function updateSummary() {
  const totalEl = document.getElementById('summary-total-jobs');
  const activeEl = document.getElementById('summary-active-jobs');
  const draftEl = document.getElementById('summary-draft-jobs');
  const companiesEl = document.getElementById('summary-companies');

  if (totalEl) totalEl.textContent = allJobs.length.toString();

  // ステータス別にカウント
  let activeCount = 0;
  let draftCount = 0;
  allJobs.forEach(job => {
    const status = getJobStatus(job);
    if (status === 'active') activeCount++;
    if (status === 'draft') draftCount++;
  });

  if (activeEl) activeEl.textContent = activeCount.toString();
  if (draftEl) draftEl.textContent = draftCount.toString();

  // 会社数（求人がある会社のみ）
  const companiesWithJobs = new Set(allJobs.map(j => j.companyDomain));
  if (companiesEl) companiesEl.textContent = companiesWithJobs.size.toString();
}

/**
 * 会社フィルターのオプションを生成
 */
function populateCompanyFilter() {
  const select = document.getElementById('job-company-filter');
  if (!select) return;

  // 会社ユーザーの場合はフィルターを非表示
  if (!isAdmin()) {
    const filterGroup = select.closest('.filter-group') || select.parentElement;
    if (filterGroup) {
      filterGroup.style.display = 'none';
    }
    return;
  }

  // 表示可能な会社のみフィルタリング
  const visibleCompanies = allCompanies.filter(c => JobsLoader.isCompanyVisible(c));

  select.innerHTML = '<option value="">すべての会社</option>';
  visibleCompanies.forEach(company => {
    const option = document.createElement('option');
    option.value = company.companyDomain || '';
    option.textContent = company.company || '会社名未設定';
    select.appendChild(option);
  });
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 会社フィルター
  const companyFilter = document.getElementById('job-company-filter');
  if (companyFilter) {
    companyFilter.addEventListener('change', filterAndRenderJobs);
  }

  // ステータスフィルター
  const statusFilter = document.getElementById('job-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', filterAndRenderJobs);
  }

  // 検索
  const searchInput = document.getElementById('job-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(filterAndRenderJobs, 300));
  }

  // ソート
  const sortSelect = document.getElementById('job-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', filterAndRenderJobs);
  }
}

/**
 * フィルタリングして求人を表示
 */
function filterAndRenderJobs() {
  const companyFilter = document.getElementById('job-company-filter')?.value || '';
  const statusFilter = document.getElementById('job-status-filter')?.value || '';
  const searchQuery = document.getElementById('job-search-input')?.value?.toLowerCase() || '';
  const sortBy = document.getElementById('job-sort-select')?.value || 'id';

  // フィルタリング
  filteredJobs = allJobs.filter(job => {
    // 会社フィルター
    if (companyFilter && job.companyDomain !== companyFilter) {
      return false;
    }

    // ステータスフィルター
    if (statusFilter) {
      const status = getJobStatus(job);
      if (status !== statusFilter) {
        return false;
      }
    }

    // 検索
    if (searchQuery) {
      const searchFields = [
        job.title || '',
        job.company || '',
        job.location || '',
        job.area || ''
      ].join(' ').toLowerCase();
      if (!searchFields.includes(searchQuery)) {
        return false;
      }
    }

    return true;
  });

  // ソート
  sortJobs(filteredJobs, sortBy);

  // 表示
  renderJobListings(filteredJobs);

  // カウント更新
  const countEl = document.getElementById('job-listings-total');
  if (countEl) {
    countEl.textContent = filteredJobs.length.toString();
  }
}

/**
 * ソート
 */
function sortJobs(jobs, sortBy) {
  jobs.sort((a, b) => {
    switch (sortBy) {
      case 'id':
        // IDの昇順（数値として比較、数値でない場合は文字列比較）
        const aId = parseInt(a.id, 10);
        const bId = parseInt(b.id, 10);
        if (!isNaN(aId) && !isNaN(bId)) {
          return aId - bId;
        }
        return (a.id || '').localeCompare(b.id || '');
      case 'company':
        return (a.company || '').localeCompare(b.company || '');
      case 'title':
        return (a.title || '').localeCompare(b.title || '');
      case 'updated':
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      case 'applications':
        return (b.applicationCount || 0) - (a.applicationCount || 0);
      default:
        return 0;
    }
  });
}

/**
 * 求人一覧を描画（会社ごとにグループ化）
 */
function renderJobListings(jobs) {
  const container = document.getElementById('job-listings-container');
  if (!container) return;

  if (jobs.length === 0) {
    container.innerHTML = '<div class="no-data">条件に一致する求人がありません</div>';
    return;
  }

  // 会社ごとにグループ化
  const groupedJobs = {};
  jobs.forEach(job => {
    const companyDomain = job.companyDomain || 'unknown';
    if (!groupedJobs[companyDomain]) {
      groupedJobs[companyDomain] = {
        company: job.company || '会社名未設定',
        companyDomain: companyDomain,
        jobs: []
      };
    }
    groupedJobs[companyDomain].jobs.push(job);
  });

  // HTML生成
  let html = '';
  Object.values(groupedJobs).forEach(group => {
    html += renderCompanyGroup(group);
  });

  container.innerHTML = html;

  // クリックイベントを設定
  setupJobCardEvents();
}

/**
 * 会社グループを描画
 */
function renderCompanyGroup(group) {
  const companyInfo = allCompanies.find(c => c.companyDomain === group.companyDomain);
  const logoUrl = companyInfo?.logoUrl || companyInfo?.imageUrl || '';

  return `
    <div class="job-listings-company-group">
      <div class="job-listings-company-header">
        <div class="company-logo-small">
          ${logoUrl
            ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(group.company)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="logo-fallback" style="display:none">🏢</span>`
            : '<span class="logo-fallback">🏢</span>'
          }
        </div>
        <div class="company-info">
          <h4 class="company-name">${escapeHtml(group.company)}</h4>
          <span class="company-job-count">${group.jobs.length}件の求人</span>
        </div>
        <button class="btn-view-company" data-domain="${escapeHtml(group.companyDomain)}" title="会社詳細を見る">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
        </button>
      </div>
      <div class="job-listings-cards">
        ${group.jobs.map(job => renderJobCard(job)).join('')}
      </div>
    </div>
  `;
}

/**
 * 求人カードを描画
 */
function renderJobCard(job) {
  const status = getJobStatus(job);
  const statusLabel = {
    active: '掲載中',
    draft: '下書き',
    expired: '期限切れ'
  }[status];

  const statusClass = {
    active: 'status-active',
    draft: 'status-draft',
    expired: 'status-expired'
  }[status];

  const imageUrl = job.jobLogo || job.imageUrl || '';

  return `
    <div class="job-listing-card" data-job-id="${escapeHtml(job.id || '')}" data-company-domain="${escapeHtml(job.companyDomain || '')}">
      <div class="job-card-image">
        ${imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(job.title || '')}" onerror="this.style.display='none';this.parentElement.classList.add('no-image')">`
          : '<span class="no-image-icon">📄</span>'
        }
      </div>
      <div class="job-card-content">
        <div class="job-card-header">
          <h5 class="job-card-title">${escapeHtml(job.title || '求人タイトル未設定')}</h5>
          <span class="job-card-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="job-card-meta">
          ${job.location ? `<span class="job-meta-item"><span class="meta-icon">📍</span>${escapeHtml(job.location)}</span>` : ''}
          ${job.monthlySalary ? `<span class="job-meta-item"><span class="meta-icon">💰</span>${escapeHtml(job.monthlySalary)}</span>` : ''}
        </div>
        <div class="job-card-stats">
          <span class="stat-item" title="応募数">📝 ${job.applicationCount || 0}</span>
          <span class="stat-item" title="閲覧数">👁 ${job.viewCount || 0}</span>
        </div>
      </div>
      <div class="job-card-actions">
        <button class="btn-job-action btn-edit-job" title="編集">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="btn-job-action btn-preview-job" title="プレビュー">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * 求人カードのイベントを設定
 */
function setupJobCardEvents() {
  // 求人カードクリック（編集へ遷移）
  document.querySelectorAll('.job-listing-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // ボタン類のクリックは除外
      if (e.target.closest('.btn-job-action') || e.target.closest('.btn-view-company')) {
        return;
      }
      const jobId = card.dataset.jobId;
      const companyDomain = card.dataset.companyDomain;
      if (jobId && companyDomain) {
        navigateToJobEdit(companyDomain, jobId);
      }
    });
  });

  // 編集ボタン
  document.querySelectorAll('.btn-edit-job').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.job-listing-card');
      const jobId = card?.dataset.jobId;
      const companyDomain = card?.dataset.companyDomain;
      if (jobId && companyDomain) {
        navigateToJobEdit(companyDomain, jobId);
      }
    });
  });

  // プレビューボタン
  document.querySelectorAll('.btn-preview-job').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.job-listing-card');
      const jobId = card?.dataset.jobId;
      const companyDomain = card?.dataset.companyDomain;
      if (jobId && companyDomain) {
        const lpUrl = `lp.html?j=${companyDomain}_${jobId}`;
        window.open(lpUrl, '_blank');
      }
    });
  });

  // 会社詳細ボタン
  document.querySelectorAll('.btn-view-company').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const companyDomain = btn.dataset.domain;
      if (companyDomain) {
        // 会社管理セクションへ遷移
        navigateToCompanyManage(companyDomain);
      }
    });
  });
}

/**
 * 求人編集画面へ遷移
 */
function navigateToJobEdit(companyDomain, jobId) {
  // 埋め込みナビゲーションを使用（SPA内遷移）
  const company = allCompanies.find(c => c.companyDomain === companyDomain);
  if (window.AdminDashboard?.navigateToJobManage) {
    window.AdminDashboard.navigateToJobManage(
      companyDomain,
      company?.company || companyDomain,
      'job-listings',
      jobId  // 求人IDを渡して編集画面を直接開く
    );
  } else {
    // フォールバック: ページ遷移
    window.location.href = `job-manage.html?domain=${encodeURIComponent(companyDomain)}&job=${encodeURIComponent(jobId)}`;
  }
}

/**
 * 会社管理画面へ遷移
 */
function navigateToCompanyManage(companyDomain) {
  // 埋め込みナビゲーションを使用（SPA内遷移）
  const company = allCompanies.find(c => c.companyDomain === companyDomain);
  if (window.AdminDashboard?.navigateToJobManage) {
    window.AdminDashboard.navigateToJobManage(
      companyDomain,
      company?.company || companyDomain,
      'job-listings'
    );
  } else {
    // フォールバック: 会社管理セクションに切り替え
    const navLink = document.querySelector('[data-section="company-manage"]');
    if (navLink) {
      navLink.click();
    }
    // 少し遅延して会社の求人エリアを開く
    setTimeout(() => {
      const event = new CustomEvent('openCompanyJobs', { detail: { companyDomain } });
      document.dispatchEvent(event);
    }, 100);
  }
}

/**
 * デバウンス
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default {
  initJobListings,
  setCompanyFilter
};
