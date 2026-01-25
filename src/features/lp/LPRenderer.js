/**
 * LP描画機能
 */
import {
  renderHeroSection,
  renderPointsSection,
  renderJobsSection,
  renderDetailsSection,
  renderFAQSection,
  renderApplySection
} from '@components/organisms/index.js';

export class LPRenderer {
  constructor() {
    this.sections = {
      hero: renderHeroSection,
      points: renderPointsSection,
      jobs: renderJobsSection,
      details: renderDetailsSection,
      faq: renderFAQSection,
      apply: renderApplySection
    };

    this.defaultOrder = ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
  }

  render(company, jobs, lpSettings, contentEl) {
    const pattern = lpSettings.designPattern || company.designPattern || 'standard';
    const patternClass = `lp-pattern-${pattern}`;

    // ボディにパターンクラスを追加
    document.body.classList.add(patternClass);

    // メインの求人情報
    const mainJob = jobs.length > 0 ? jobs[0] : company;

    // セクション表示設定を解析
    const sectionVisibility = this.parseSectionVisibility(lpSettings.sectionVisibility);

    // セクション順序を取得
    const sectionOrder = this.parseSectionOrder(lpSettings.sectionOrder);

    // セクションを順序に従って描画
    contentEl.innerHTML = sectionOrder
      .map(sectionName => this.renderSection(sectionName, company, mainJob, jobs, lpSettings, sectionVisibility))
      .join('');
  }

  renderSection(sectionName, company, mainJob, jobs, lpSettings, sectionVisibility) {
    switch (sectionName) {
      case 'hero':
        return this.sections.hero(company, mainJob, lpSettings);
      case 'points':
        return sectionVisibility.points ? this.sections.points(company, mainJob, lpSettings) : '';
      case 'jobs':
        return sectionVisibility.jobs ? this.sections.jobs(company, jobs) : '';
      case 'details':
        return sectionVisibility.details ? this.sections.details(company, mainJob) : '';
      case 'faq':
        return (sectionVisibility.faq && lpSettings.faq) ? this.sections.faq(lpSettings.faq) : '';
      case 'apply':
        return this.sections.apply(company, lpSettings);
      default:
        return '';
    }
  }

  parseSectionVisibility(visibilityString) {
    const defaults = { points: true, jobs: true, details: true, faq: true };

    if (!visibilityString) return defaults;

    try {
      return { ...defaults, ...JSON.parse(visibilityString) };
    } catch (e) {
      console.error('セクション表示設定のパースエラー:', e);
      return defaults;
    }
  }

  parseSectionOrder(orderString) {
    if (!orderString) return this.defaultOrder;

    const customOrder = orderString.split(',').map(s => s.trim()).filter(s => s);
    if (customOrder.length === 0) return this.defaultOrder;

    // カスタム順序に含まれていないセクションを追加
    const missingSections = this.defaultOrder.filter(s => !customOrder.includes(s));
    return [...customOrder, ...missingSections];
  }
}

export default LPRenderer;
