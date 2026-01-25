/**
 * Job Detail ページ機能（ランディングページ風）
 */

import { escapeHtml, nl2br, getUrlParam, trackEvent, showLoading, showError, waitForJobsLoader } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { JobCard, PointCard, DetailRow } from '@components/molecules/index.js';
import { Icons, TagList } from '@components/atoms/index.js';

// 求人詳細を描画
export function renderJobDetail(job) {
  const container = document.getElementById('job-detail-container');
  if (!container) return;

  const features = Array.isArray(job.features) ? job.features : [];

  container.innerHTML = `
    <div class="lp-container">
      <!-- ヒーローセクション -->
      <section class="lp-hero-section">
        <div class="lp-hero-bg"></div>
        <div class="lp-hero-inner">
          <p class="lp-hero-label">${escapeHtml(job.company)}</p>
          <h1 class="lp-hero-title">${escapeHtml(job.title)}</h1>
          <div class="lp-hero-meta">
            <span class="lp-hero-location">
              ${Icons.location}
              ${escapeHtml(job.location)}
            </span>
          </div>
          <a href="#apply-section" class="lp-hero-cta" data-apply-btn data-job-id="${escapeHtml(String(job.id))}" data-company-domain="${escapeHtml(job.companyDomain)}" data-company-name="${escapeHtml(job.company)}" data-job-title="${escapeHtml(job.title)}">今すぐ応募する</a>
        </div>
      </section>

      <!-- ポイントセクション -->
      <section class="lp-points-section">
        <div class="lp-section-inner">
          <h2 class="lp-section-heading">この求人のポイント</h2>
          <div class="lp-points-grid">
            ${job.totalBonus ? PointCard({
              icon: Icons.money,
              label: '特典総額',
              value: job.totalBonus,
              isHighlight: true
            }) : ''}
            ${job.monthlySalary ? PointCard({
              icon: Icons.wallet,
              label: '月収例',
              value: job.monthlySalary
            }) : ''}
            ${job.employmentType ? PointCard({
              icon: Icons.briefcase,
              label: '雇用形態',
              value: job.employmentType
            }) : ''}
          </div>
          ${features.length > 0 ? `
          <div class="lp-tags">
            ${features.map(f => `<span class="lp-tag">${escapeHtml(f)}</span>`).join('')}
          </div>
          ` : ''}
        </div>
      </section>

      <!-- 募集要項セクション -->
      <section class="lp-details-section">
        <div class="lp-section-inner">
          <h2 class="lp-section-heading">募集要項</h2>
          <div class="lp-details-table">
            ${DetailRow({ label: '仕事内容', value: job.jobDescription })}
            ${DetailRow({ label: '給与', value: job.salary })}
            ${DetailRow({ label: '応募資格', value: job.requirements })}
            ${DetailRow({ label: '勤務時間', value: job.workingHours })}
            ${DetailRow({ label: '休日・休暇', value: job.holidays })}
            ${DetailRow({ label: '待遇・福利厚生', value: job.benefits })}
            <div class="lp-detail-row">
              <div class="lp-detail-label">勤務地</div>
              <div class="lp-detail-value">${escapeHtml(job.location)}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 応募セクション -->
      <section class="lp-apply-section" id="apply-section">
        <div class="lp-section-inner">
          <h2 class="lp-apply-heading">まずはお気軽にご応募ください</h2>
          <p class="lp-apply-text">経験・学歴不問！あなたのご応募をお待ちしています。</p>
          <div class="lp-apply-buttons">
            <a href="#" class="lp-apply-btn primary" data-apply-btn data-job-id="${escapeHtml(String(job.id))}" data-company-domain="${escapeHtml(job.companyDomain)}" data-company-name="${escapeHtml(job.company)}" data-job-title="${escapeHtml(job.title)}">この求人に応募する</a>
            <a href="company.html?id=${escapeHtml(job.companyDomain)}" class="lp-apply-btn secondary">${escapeHtml(job.company)}の企業情報を見る</a>
          </div>
        </div>
      </section>
    </div>
  `;
}

// パンくずリストを更新
export function updateBreadcrumb(job) {
  const companyLink = document.getElementById('breadcrumb-company');
  if (companyLink) {
    companyLink.innerHTML = `<a href="company.html?id=${encodeURIComponent(job.companyDomain)}">${escapeHtml(job.company)}</a>`;
  }
  const current = document.getElementById('breadcrumb-current');
  if (current) {
    current.textContent = job.title;
  }
}

// SEOを更新
export function updateSEO(job) {
  document.title = `${job.title} | ${job.company} | リクエコ求人ナビ`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.content = `${job.company}の${job.title}。${job.location}勤務。${job.totalBonus ? '特典総額' + job.totalBonus + '。' : ''}`;
  }
}

// 関連求人を描画
export function renderRelatedJobs(relatedJobs, currentCompanyDomain, currentJobId) {
  const container = document.getElementById('related-jobs-container');
  if (!container) return;

  const filteredJobs = relatedJobs
    .filter(job => !(job.companyDomain === currentCompanyDomain && String(job.id) === String(currentJobId)))
    .slice(0, 6);

  if (filteredJobs.length === 0) {
    container.innerHTML = '<p class="no-data">関連する求人がありません。</p>';
    return;
  }

  container.innerHTML = filteredJobs.map(job => JobCard({ job })).join('');
}

// 関連求人を非同期で取得して描画
export async function renderRelatedJobsAsync(companies, currentCompanyDomain, currentJobId) {
  try {
    const relatedJobs = [];
    for (const company of companies) {
      if (!JobsLoader.isCompanyVisible(company)) continue;
      if (company.companyDomain === currentCompanyDomain) continue;

      if (company.jobsSheet && company.jobsSheet.trim()) {
        const jobs = await JobsLoader.fetchCompanyJobs(company.jobsSheet.trim());
        if (jobs && jobs.length > 0) {
          jobs.forEach(j => {
            j.company = company.company;
            j.companyDomain = company.companyDomain;
          });
          relatedJobs.push(...jobs.slice(0, 2));
        }
      }

      if (relatedJobs.length >= 6) break;
    }

    renderRelatedJobs(relatedJobs.slice(0, 6), currentCompanyDomain, currentJobId);
  } catch (error) {
    console.error('関連求人の取得エラー:', error);
  }
}

// Firestoreに応募データを保存
async function saveApplicationToFirestore(data) {
  try {
    if (!window.firebaseDb) {
      console.warn('[Application] Firestore not initialized');
      return;
    }

    await window.firebaseDb.collection('applications').add({
      companyDomain: data.company_domain,
      companyName: data.company_name,
      jobId: data.job_id,
      jobTitle: data.job_title,
      type: 'apply', // apply, line, consult
      source: document.referrer || 'direct',
      userAgent: navigator.userAgent,
      timestamp: new Date(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('[Application] Saved to Firestore');
  } catch (error) {
    console.error('[Application] Failed to save:', error);
  }
}

// 応募ボタンのクリックトラッキングを設定
function setupApplyButtonTracking() {
  document.querySelectorAll('[data-apply-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const data = {
        company_domain: btn.dataset.companyDomain,
        company_name: btn.dataset.companyName,
        job_id: btn.dataset.jobId,
        job_title: btn.dataset.jobTitle
      };

      // GA4にイベント送信
      trackEvent('click_apply', data);

      // Firestoreに保存
      saveApplicationToFirestore(data);
    });
  });
}

// ページ初期化
export async function initJobDetailPage() {
  const companyDomain = getUrlParam('company');
  const jobId = getUrlParam('job');

  if (!companyDomain || !jobId) {
    showError('job-detail-container', '求人が見つかりませんでした。');
    return;
  }

  showLoading('job-detail-container', '求人情報を読み込んでいます...');

  try {
    await waitForJobsLoader();

    const companies = await JobsLoader.fetchCompanies();
    if (!companies) {
      showError('job-detail-container', 'データの取得に失敗しました。');
      return;
    }

    const companyInfo = companies.find(
      c => c.companyDomain && c.companyDomain.trim() === companyDomain
    );

    if (!companyInfo) {
      showError('job-detail-container', '会社が見つかりませんでした。');
      return;
    }

    let job = null;
    if (companyInfo.jobsSheet && companyInfo.jobsSheet.trim()) {
      const companyJobs = await JobsLoader.fetchCompanyJobs(companyInfo.jobsSheet.trim());
      if (companyJobs) {
        job = companyJobs.find(j => String(j.id) === String(jobId));
        if (job) {
          job.company = companyInfo.company;
          job.companyDomain = companyInfo.companyDomain;
        }
      }
    }

    if (!job) {
      showError('job-detail-container', '求人が見つかりませんでした。');
      return;
    }

    renderJobDetail(job);
    updateBreadcrumb(job);
    updateSEO(job);

    renderRelatedJobsAsync(companies, companyDomain, jobId);

    trackEvent('view_job_detail', {
      company_domain: job.companyDomain,
      company_name: job.company,
      job_id: String(job.id),
      job_title: job.title,
      location: job.location
    });

    // 応募ボタンのクリックイベントを設定
    setupApplyButtonTracking();

  } catch (error) {
    console.error('求人詳細の取得エラー:', error);
    showError('job-detail-container', 'データの取得に失敗しました。しばらくしてから再度お試しください。');
  }
}

export default {
  initJobDetailPage,
  renderJobDetail,
  updateBreadcrumb,
  updateSEO,
  renderRelatedJobs,
  renderRelatedJobsAsync
};
