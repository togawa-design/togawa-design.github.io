/**
 * 求人一覧セクションコンポーネント
 */
import { escapeHtml } from '@shared/utils.js';

// 掲載開始日から1週間以内かどうかをチェック
function isWithinOneWeek(publishStartDate) {
  if (!publishStartDate) return false;

  const startDate = new Date(publishStartDate);
  if (isNaN(startDate.getTime())) return false;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return startDate >= oneWeekAgo;
}

export function renderJobsSection(company, jobs) {
  if (jobs.length === 0) return '';

  return `
    <section class="lp-jobs">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">募集中の求人</h2>
        <div class="lp-jobs-list">
          ${jobs.map(job => renderJobCard(job, company)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderJobCard(job, company) {
  // displayedFeaturesが設定されている場合はそれを優先表示
  const displayedFeaturesRaw = job.displayedFeatures || '';
  const displayedFeatures = displayedFeaturesRaw
    ? displayedFeaturesRaw.split(',').map(f => f.trim()).filter(f => f)
    : [];

  const allFeaturesRaw = job.features || '';
  const allFeatures = allFeaturesRaw
    ? (Array.isArray(allFeaturesRaw) ? allFeaturesRaw : allFeaturesRaw.split(',').map(f => f.trim()))
    : [];

  // displayedFeaturesがあればそれを使用、なければallFeaturesの最初の5つ
  const features = displayedFeatures.length > 0 ? displayedFeatures : allFeatures;

  const isNew = isWithinOneWeek(job.publishStartDate);

  return `
    <div class="lp-job-card${isNew ? ' is-new' : ''}">
      ${isNew ? '<span class="lp-job-new-tag">✨ NEW</span>' : ''}
      <div class="lp-job-card-header">
        <h3 class="lp-job-title">${escapeHtml(job.title)}</h3>
        ${job.employmentType ? `<span class="lp-job-type">${escapeHtml(job.employmentType)}</span>` : ''}
      </div>
      <div class="lp-job-card-body">
        <ul class="lp-job-info">
          <li>
            <span class="lp-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </span>
            ${escapeHtml(job.location)}
          </li>
          ${job.access ? `
          <li>
            <span class="lp-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            </span>
            ${escapeHtml(job.access)}
          </li>
          ` : ''}
          ${job.dailySalaryExample ? `
          <li>
            <span class="lp-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            </span>
            日収例 ${escapeHtml(job.dailySalaryExample)}
          </li>
          ` : ''}
          ${job.monthlySalaryExample || job.monthlySalary ? `
          <li>
            <span class="lp-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            </span>
            月収例 ${escapeHtml(job.monthlySalaryExample || job.monthlySalary)}
          </li>
          ` : ''}
          ${job.yearlySalaryExample ? `
          <li>
            <span class="lp-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            </span>
            年収例 ${escapeHtml(job.yearlySalaryExample)}
          </li>
          ` : ''}
          ${job.totalBonus ? `
          <li class="highlight">
            <span class="lp-info-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>
            </span>
            特典総額 ${escapeHtml(job.totalBonus)}
          </li>
          ` : ''}
        </ul>
        ${features.length > 0 ? `
        <div class="lp-job-tags">
          ${features.slice(0, 3).map(f =>
            `<span class="lp-job-tag">${escapeHtml(typeof f === 'string' ? f.trim() : f)}</span>`
          ).join('')}
        </div>
        ` : ''}
      </div>
      <div class="lp-job-card-footer">
        <a href="job-detail.html?company=${escapeHtml(job.companyDomain || company.companyDomain)}&job=${escapeHtml(job.id || '')}" class="lp-btn-detail">詳細を見る</a>
      </div>
    </div>
  `;
}

export default renderJobsSection;
