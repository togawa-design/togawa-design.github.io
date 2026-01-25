/**
 * 詳細（募集要項）セクションコンポーネント
 */
import { escapeHtml, sanitizeHtml } from '@shared/utils.js';

export function renderDetailsSection(company, mainJob) {
  const details = [];

  // 会社一覧シートの「説明」（description）
  if (company.description) {
    details.push({ label: '会社概要', value: company.description, isHtml: true });
  }

  // 会社一覧シートの「お仕事内容」（jobDescription）
  if (company.jobDescription) {
    details.push({ label: 'お仕事内容', value: company.jobDescription, isHtml: true });
  }

  // 会社一覧シートの「勤務時間」（workingHours）
  if (company.workingHours) {
    details.push({ label: '勤務時間', value: company.workingHours, isHtml: true });
  }

  // 会社一覧シートの「勤務地」（workLocation）
  if (company.workLocation) {
    details.push({ label: '勤務地', value: company.workLocation, isHtml: true });
  }

  // 求人データからも取得
  if (mainJob.benefits && mainJob.benefits !== company.benefits) {
    details.push({ label: '待遇・福利厚生', value: mainJob.benefits, isHtml: true });
  } else if (company.benefits) {
    details.push({ label: '待遇・福利厚生', value: company.benefits, isHtml: true });
  }

  if (mainJob.requirements) {
    details.push({ label: '応募資格', value: mainJob.requirements, isHtml: true });
  }

  if (details.length === 0) return '';

  return `
    <section class="lp-details">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">募集要項</h2>
        <div class="lp-details-table">
          ${details.map(d => `
            <div class="lp-detail-row">
              <dt class="lp-detail-label">${escapeHtml(d.label)}</dt>
              <dd class="lp-detail-value">${d.isHtml ? sanitizeHtml(d.value) : escapeHtml(d.value)}</dd>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

export default renderDetailsSection;
