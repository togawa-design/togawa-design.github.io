/**
 * ヒーローセクションコンポーネント
 */
import { escapeHtml } from '@shared/utils.js';

export function renderHeroSection(company, mainJob, lpSettings) {
  const heroTitle = lpSettings.heroTitle || mainJob.title || `${company.company}で働こう`;
  const heroSubtitle = lpSettings.heroSubtitle || '';
  const heroImage = lpSettings.heroImage || company.imageUrl || '';

  // 特典情報を生成
  const highlights = [];
  if (mainJob.totalBonus) {
    highlights.push({ label: '特典総額', value: mainJob.totalBonus, icon: 'bonus' });
  }
  if (mainJob.monthlySalary) {
    highlights.push({ label: '月収例', value: mainJob.monthlySalary, icon: 'salary' });
  }

  return `
    <section class="lp-hero">
      <div class="lp-hero-bg lp-editable-image" data-field="heroImage" data-label="ヒーロー画像" style="${heroImage ? `background-image: url('${escapeHtml(heroImage)}')` : ''}"></div>
      <div class="lp-hero-overlay"></div>
      <div class="lp-hero-content">
        <p class="lp-hero-company">${escapeHtml(company.company)}</p>
        <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${escapeHtml(heroSubtitle)}</p>` : `<p class="lp-hero-subtitle lp-editable lp-placeholder" data-field="heroSubtitle" data-label="サブタイトル">サブタイトルを追加</p>`}

        ${highlights.length > 0 ? `
        <div class="lp-hero-highlights">
          ${highlights.map(h => `
            <div class="lp-highlight-item ${h.icon}">
              <span class="lp-highlight-label">${escapeHtml(h.label)}</span>
              <span class="lp-highlight-value">${escapeHtml(h.value)}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="lp-hero-cta">
          <a href="#lp-apply" class="lp-btn-apply-hero">今すぐ応募する</a>
        </div>
      </div>
    </section>
  `;
}

export default renderHeroSection;
