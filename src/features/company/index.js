/**
 * Company ページ機能
 */

import { escapeHtml, trackEvent } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { JobCard, CompanyJobCard } from '@components/molecules/index.js';
import { LoadingSpinner, Image } from '@components/atoms/index.js';
import { initFooterContent } from '@shared/layout.js';

// 会社ページのHTMLを生成
export function renderCompanyPageContent(companyInfo, companyJobs) {
  const imageSrc = companyInfo.imageUrl?.trim() || JobsLoader.DEFAULT_IMAGE;
  const patternClass = JobsLoader.getDesignPatternClass(companyInfo.designPattern);
  const sanitizedDesc = companyInfo.description ? JobsLoader.default.sanitizeHtml(companyInfo.description) : '';

  return `
    <div class="company-page ${patternClass}">
      <div class="company-header">
        <div class="company-header-image">
          ${Image({ src: imageSrc, alt: companyInfo.company, className: '' })}
        </div>
        <div class="company-header-info">
          <h1 class="company-name">${escapeHtml(companyInfo.company)}</h1>
          <p class="company-job-count">${companyJobs.length}件の求人を掲載中</p>
        </div>
      </div>

      ${sanitizedDesc ? `
      <div class="company-description">
        <h2>会社について</h2>
        <div class="company-description-content">${sanitizedDesc}</div>
      </div>
      ` : ''}

      <div class="company-jobs">
        <h2>募集中の求人</h2>
        <div class="company-jobs-list">
          ${companyJobs.map(job => CompanyJobCard({ job })).join('')}
        </div>
      </div>

      <div class="company-cta">
        <p>お仕事選びでお困りですか？</p>
        <div class="company-cta-buttons">
          <a href="#" class="btn-apply-large">無料で相談する</a>
          <a href="#" class="btn-line-large">LINEで相談する</a>
        </div>
      </div>
    </div>
  `;
}

// 関連求人を描画
export async function renderRelatedJobs(jobs, currentDomain) {
  const container = document.getElementById('related-jobs-container');
  if (!container) return;

  const relatedJobs = jobs
    .filter(job => job.companyDomain !== currentDomain && JobsLoader.isCompanyVisible(job))
    .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
    .slice(0, 3);

  if (relatedJobs.length === 0) {
    container.innerHTML = '<p>他の求人がありません。</p>';
    return;
  }

  container.innerHTML = relatedJobs.map(job => JobCard({ job })).join('');
}

// 応募ボタンにイベントリスナーを設定
export function setupApplyTracking(companyDomain) {
  document.querySelectorAll('.btn-apply-job, .btn-apply-large').forEach(btn => {
    btn.addEventListener('click', () => {
      trackEvent('click_apply', { company_domain: companyDomain, button_type: 'apply' });
    });
  });

  document.querySelectorAll('.btn-line-large').forEach(btn => {
    btn.addEventListener('click', () => {
      trackEvent('click_apply', { company_domain: companyDomain, button_type: 'line' });
    });
  });
}

// 会社ページを描画
export async function renderCompanyPage() {
  const container = document.getElementById('job-detail-container');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const companyDomain = params.get('id');

  if (!companyDomain) {
    container.innerHTML = `
      <div class="jobs-error">
        <p>求人が見つかりませんでした。</p>
        <a href="/" class="btn-more">トップページに戻る</a>
      </div>
    `;
    return;
  }

  container.innerHTML = LoadingSpinner({ message: '会社情報を読み込んでいます...' });

  const companies = await JobsLoader.fetchCompanies();
  if (!companies) {
    container.innerHTML = `
      <div class="jobs-error">
        <p>会社情報を取得できませんでした。</p>
        <button onclick="location.reload()">再読み込み</button>
      </div>
    `;
    return;
  }

  const companyInfo = companies.find(
    c => c.companyDomain?.trim() === companyDomain && JobsLoader.isCompanyVisible(c)
  );

  if (!companyInfo) {
    container.innerHTML = `
      <div class="jobs-error">
        <p>会社が見つかりませんでした。</p>
        <a href="/" class="btn-more">トップページに戻る</a>
      </div>
    `;
    return;
  }

  let companyJobs = [];
  if (companyInfo.jobsSheet?.trim()) {
    const jobs = await JobsLoader.fetchCompanyJobs(companyInfo.jobsSheet.trim());
    if (jobs && jobs.length > 0) {
      companyJobs = jobs
        .filter(j => j.visible !== 'false' && j.visible !== 'FALSE')
        .filter(j => JobsLoader.isJobInPublishPeriod(j))
        .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
        .map(j => ({
          ...j,
          company: companyInfo.company,
          companyDomain: companyInfo.companyDomain
        }));
    }
  }

  if (companyJobs.length === 0) {
    companyJobs = [companyInfo];
  }

  document.title = `${companyInfo.company}の求人一覧 | L-SET`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.content = `${companyInfo.company}の期間工・期間従業員求人一覧。${companyJobs.length}件の求人を掲載中。`;
  }

  const breadcrumbCurrent = document.getElementById('breadcrumb-current');
  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = companyInfo.company;
  }

  container.innerHTML = renderCompanyPageContent(companyInfo, companyJobs);

  trackEvent('view_company_page', {
    company_domain: companyInfo.companyDomain || '',
    company_name: companyInfo.company || '',
    design_pattern: companyInfo.designPattern || 'standard',
    page_location: window.location.href,
    page_title: document.title
  });

  setupApplyTracking(companyInfo.companyDomain);
  renderRelatedJobs(companies, companyDomain);
  initFooterContent();
}

export default {
  renderCompanyPage,
  renderCompanyPageContent,
  renderRelatedJobs,
  setupApplyTracking
};
