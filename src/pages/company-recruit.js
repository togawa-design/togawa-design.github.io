/**
 * 会社専用採用ページ エントリーポイント
 */
import { escapeHtml, hasUrlParam, getUrlParam } from '@shared/utils.js';
import { loadRecruitSettings } from '@features/recruit-settings/api.js';
import {
  renderSiteHeader,
  renderSiteFooter,
  renderFixedCtaBar
} from '@components/organisms/LayoutComponents.js';
import '@shared/jobs-loader.js';

/**
 * 会社採用ページクラス
 */
class CompanyRecruitPage {
  constructor() {
    this.companyDomain = null;
    this.company = null;
    this.jobs = [];
    this.recruitSettings = null; // 採用ページ設定（ロゴ・ヘッダー情報用）
    this.isEditMode = hasUrlParam('edit'); // 編集モード判定
    this.editor = null;
  }

  async init() {
    // 会社ドメインを取得
    this.companyDomain = getUrlParam('id') || getUrlParam('c');

    if (!this.companyDomain) {
      this.showError('会社が指定されていません。');
      return;
    }

    try {
      // JobsLoaderの読み込みを待機
      await this.waitForJobsLoader();

      // 会社情報を取得
      const companies = await window.JobsLoader.fetchCompanies();

      this.company = companies?.find(c =>
        c.companyDomain?.trim() === this.companyDomain &&
        window.JobsLoader.isCompanyVisible(c)
      );

      if (!this.company) {
        this.showError('指定された会社は見つかりませんでした。');
        return;
      }

      // 求人データを取得
      this.jobs = await this.fetchJobs(this.company);

      // 採用ページ設定を取得
      this.recruitSettings = await loadRecruitSettings(this.companyDomain) || {};

      // ページを描画
      this.hideLoading();
      this.render();

      // ヘッダー・フッター・CTAバーを追加
      this.renderLayoutComponents();

      // SEO/OGPを更新
      this.updateSEO();

      // 編集モードの場合
      if (this.isEditMode) {
        this.enableEditMode();
      }

    } catch (error) {
      console.error('[RecruitPage] 初期化エラー:', error);
      this.showError('ページの読み込みに失敗しました。');
    }
  }

  /**
   * 編集モードを有効化
   */
  async enableEditMode() {
    try {
      // 編集モードの場合のみRecruitEditorを動的に読み込み
      const { RecruitEditor } = await import('@features/recruit-settings/RecruitEditor.js');

      this.editor = new RecruitEditor();
      this.editor.enable(
        this.companyDomain,
        this.company,
        this.recruitSettings,
        (newSettings) => this.onSettingsChange(newSettings)
      );

      console.log('[RecruitPage] 編集モード有効化');
    } catch (error) {
      console.error('[RecruitPage] 編集モードの読み込みエラー:', error);
    }
  }

  /**
   * 設定変更時のコールバック（プレビュー更新）
   */
  onSettingsChange(newSettings) {
    this.recruitSettings = newSettings;

    // 既存のレイアウトコンポーネントを削除
    this.removeLayoutComponents();

    // ページを再描画
    this.render();

    // レイアウトコンポーネントを再追加
    this.renderLayoutComponents();
  }

  /**
   * レイアウトコンポーネントを削除
   */
  removeLayoutComponents() {
    // 固定ヘッダーを削除
    document.querySelector('.site-header')?.remove();
    // 固定CTAバーを削除
    document.querySelector('.fixed-cta-bar')?.remove();
    // フッターを削除
    document.querySelector('.site-footer')?.remove();

    // bodyのクラスをリセット
    document.body.classList.remove('has-fixed-header', 'has-fixed-cta-bar');
    document.body.className = document.body.className.replace(/lp-pattern-\S+/g, '').trim();
    document.body.removeAttribute('data-layout-style');
  }

  /**
   * JobsLoaderの読み込み完了を待機
   */
  waitForJobsLoader() {
    return new Promise((resolve, reject) => {
      const maxWait = 10000;
      const startTime = Date.now();

      const check = () => {
        if (window.JobsLoader && typeof window.JobsLoader.fetchCompanies === 'function') {
          resolve();
        } else if (Date.now() - startTime > maxWait) {
          reject(new Error('JobsLoaderのロードがタイムアウトしました'));
        } else {
          setTimeout(check, 100);
        }
      };

      check();
    });
  }

  /**
   * 会社の求人を取得
   */
  async fetchJobs(company) {
    try {
      // jobsSheetから求人データソースを取得
      const jobsSource = company.jobsSheet?.trim();
      if (!jobsSource) {
        console.log('[RecruitPage] jobsSheetが設定されていません');
        return [];
      }

      const allJobs = await window.JobsLoader.fetchCompanyJobs(jobsSource);
      console.log('[RecruitPage] 取得した全求人:', allJobs?.length);

      if (!allJobs?.length) return [];

      // 公開中の求人のみフィルタリング
      const filtered = allJobs
        .filter(job => job.visible !== 'false' && job.visible !== 'FALSE')
        .filter(job => window.JobsLoader.isJobInPublishPeriod(job))
        .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
        .map(job => ({
          ...job,
          company: company.company,
          companyDomain: company.companyDomain
        }));

      console.log('[RecruitPage] フィルタ後の求人:', filtered.length);
      return filtered;
    } catch (error) {
      console.error('[RecruitPage] 求人取得エラー:', error);
      return [];
    }
  }

  /**
   * ページを描画
   */
  render() {
    const contentEl = document.getElementById('recruit-content');
    if (!contentEl) return;

    contentEl.innerHTML = `
      ${this.renderHeroSection()}
      ${this.renderCompanyIntroSection()}
      ${this.renderJobsSection()}
      ${this.renderCTASection()}
    `;

    // ヘッダーロゴに会社名を設定
    const logoEl = document.getElementById('header-logo');
    if (logoEl && this.company?.company) {
      logoEl.innerHTML = `<span class="logo-text">${escapeHtml(this.company.company)}</span>`;
    }
  }

  /**
   * ヒーローセクション
   */
  renderHeroSection() {
    const company = this.company;
    const rs = this.recruitSettings || {};

    // 採用ページ設定があればそちらを優先
    const heroImage = rs.heroImage || company.imageUrl || '';
    const heroTitle = rs.heroTitle || `${escapeHtml(company.company)}で働こう`;
    const heroSubtitle = rs.heroSubtitle || (company.description ? this.truncateText(company.description, 100) : '私たちと一緒に働きませんか？');

    return `
      <section class="recruit-hero" id="recruit-hero">
        <div class="recruit-hero-bg" style="${heroImage ? `background-image: url('${escapeHtml(heroImage)}')` : ''}"></div>
        <div class="recruit-hero-overlay"></div>
        <div class="recruit-hero-content">
          <h1 class="recruit-hero-title">${escapeHtml(heroTitle)}</h1>
          <p class="recruit-hero-subtitle">${escapeHtml(heroSubtitle)}</p>
          <div class="recruit-hero-stats">
            <div class="recruit-stat">
              <span class="recruit-stat-number">${this.jobs.length}</span>
              <span class="recruit-stat-label">募集中の求人</span>
            </div>
          </div>
          <a href="#recruit-jobs" class="recruit-hero-cta">求人を見る</a>
        </div>
      </section>
    `;
  }

  /**
   * 会社紹介セクション
   */
  renderCompanyIntroSection() {
    const company = this.company;
    if (!company.description && !company.jobContent) return '';

    return `
      <section class="recruit-section recruit-about" id="recruit-about">
        <div class="recruit-section-inner">
          <h2 class="recruit-section-title">私たちについて</h2>
          <div class="recruit-about-content">
            ${company.imageUrl ? `
              <div class="recruit-about-image">
                <img src="${escapeHtml(company.imageUrl)}" alt="${escapeHtml(company.company)}">
              </div>
            ` : ''}
            <div class="recruit-about-text">
              ${company.description ? `<p>${this.formatText(company.description)}</p>` : ''}
              ${company.jobContent ? `
                <h3>お仕事内容</h3>
                <p>${this.formatText(company.jobContent)}</p>
              ` : ''}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * 求人一覧セクション
   */
  renderJobsSection() {
    const rs = this.recruitSettings || {};
    const jobsTitle = rs.jobsTitle || '募集中の求人';

    if (this.jobs.length === 0) {
      return `
        <section class="recruit-section recruit-jobs" id="recruit-jobs">
          <div class="recruit-section-inner">
            <h2 class="recruit-section-title">${escapeHtml(jobsTitle)}</h2>
            <p class="recruit-no-jobs">現在募集中の求人はありません。</p>
          </div>
        </section>
      `;
    }

    return `
      <section class="recruit-section recruit-jobs" id="recruit-jobs">
        <div class="recruit-section-inner">
          <h2 class="recruit-section-title">${escapeHtml(jobsTitle)}</h2>
          <div class="recruit-jobs-grid">
            ${this.jobs.map(job => this.renderJobCard(job)).join('')}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * 求人カードを描画
   */
  renderJobCard(job) {
    const jobId = job.jobId || job['求人ID'] || job.id || '';
    const lpUrl = `lp.html?j=${this.companyDomain}_${jobId}`;
    const imageUrl = job.imageUrl || this.company?.imageUrl || '';

    return `
      <a href="${lpUrl}" class="recruit-job-card">
        <div class="recruit-job-card-image" style="${imageUrl ? `background-image: url('${escapeHtml(imageUrl)}')` : ''}">
          ${!imageUrl ? '<div class="recruit-job-card-placeholder"></div>' : ''}
        </div>
        <div class="recruit-job-card-content">
          <h3 class="recruit-job-card-title">${escapeHtml(job.title || '求人情報')}</h3>
          ${job.location ? `<p class="recruit-job-card-location">${escapeHtml(job.location)}</p>` : ''}
          <div class="recruit-job-card-highlights">
            ${job.monthlySalary ? `<span class="recruit-highlight salary">${escapeHtml(job.monthlySalary)}</span>` : ''}
            ${job.totalBonus ? `<span class="recruit-highlight bonus">${escapeHtml(job.totalBonus)}</span>` : ''}
          </div>
          ${job.features ? `
            <div class="recruit-job-card-features">
              ${this.renderFeatures(job.features)}
            </div>
          ` : ''}
          <span class="recruit-job-card-link">詳細を見る →</span>
        </div>
      </a>
    `;
  }

  /**
   * 特徴タグを描画
   */
  renderFeatures(features) {
    if (!features) return '';
    // 文字列でない場合は空を返す
    if (typeof features !== 'string') return '';
    const featureList = features.split(/[,、]/).map(f => f.trim()).filter(f => f).slice(0, 3);
    return featureList.map(f => `<span class="recruit-feature-tag">${escapeHtml(f)}</span>`).join('');
  }

  /**
   * CTAセクション
   */
  renderCTASection() {
    const rs = this.recruitSettings || {};
    const ctaTitle = rs.ctaTitle || 'あなたの応募をお待ちしています';
    const ctaText = rs.ctaText || '気になる求人があれば、ぜひお気軽にご応募ください。';

    return `
      <section class="recruit-section recruit-cta">
        <div class="recruit-section-inner">
          <h2 class="recruit-cta-title">${escapeHtml(ctaTitle)}</h2>
          <p class="recruit-cta-text">${escapeHtml(ctaText)}</p>
          <a href="#recruit-jobs" class="recruit-cta-button">求人一覧へ戻る</a>
        </div>
      </section>
    `;
  }

  /**
   * SEO/OGPを更新
   */
  updateSEO() {
    const company = this.company;
    const rs = this.recruitSettings || {};

    // OGP設定があればそちらを優先
    const ogpTitle = rs.ogpTitle || '';
    const ogpDescription = rs.ogpDescription || '';
    const ogpImage = rs.ogpImage || rs.heroImage || company.imageUrl || '';

    const title = ogpTitle
      ? `${ogpTitle} | ${company.company}`
      : `${company.company} 採用情報 | リクエコ求人ナビ`;
    const description = ogpDescription
      ? ogpDescription
      : (company.description
        ? this.truncateText(company.description, 150)
        : `${company.company}の採用情報ページ。募集中の求人をご覧ください。`);

    document.title = title;
    this.updateMetaTag('description', description);
    this.updateMetaTag('og:title', title, 'property');
    this.updateMetaTag('og:description', description, 'property');

    if (ogpImage) {
      this.updateMetaTag('og:image', ogpImage, 'property');
    }
  }

  /**
   * メタタグを更新
   */
  updateMetaTag(name, content, attrType = 'name') {
    let tag = document.querySelector(`meta[${attrType}="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attrType, name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  }

  /**
   * テキストを指定文字数で切り詰め
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    const plainText = text.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + '...';
  }

  /**
   * テキストをHTML形式にフォーマット
   */
  formatText(text) {
    if (!text) return '';
    // 既にHTMLタグがある場合はそのまま返す
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text;
    }
    // 改行をbrタグに変換
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  /**
   * 共通レイアウトコンポーネント（ヘッダー・フッター・CTAバー）を描画
   */
  renderLayoutComponents() {
    const rs = this.recruitSettings || {};
    const designPattern = rs.designPattern || 'standard';
    const layoutStyle = rs.layoutStyle || 'default';
    const contentEl = document.getElementById('recruit-content');

    // ロゴまたは会社名がある場合のみヘッダーを追加
    const hasHeader = !!(rs.logoUrl || rs.companyNameDisplay);
    const hasCtaBar = !!(rs.phoneNumber || rs.ctaButtonText);

    // bodyにクラスを追加（ヘッダー・CTAバーのスペース確保用）
    if (hasHeader) {
      document.body.classList.add('has-fixed-header');
    }
    if (hasCtaBar) {
      document.body.classList.add('has-fixed-cta-bar');
    }

    // レイアウトスタイルをbodyに設定
    document.body.setAttribute('data-layout-style', layoutStyle);
    document.body.classList.add(`lp-pattern-${designPattern}`);

    // ヘッダーを追加
    if (hasHeader) {
      const headerHtml = renderSiteHeader({
        logoUrl: rs.logoUrl || '',
        companyName: rs.companyNameDisplay || this.company?.company || '',
        recruitPageUrl: '', // 採用ページ自体なのでリンクなし
        showBackLink: false,
        designPattern: designPattern
      });
      document.body.insertAdjacentHTML('afterbegin', headerHtml);
    }

    // フッターを追加
    if (contentEl) {
      const footerHtml = renderSiteFooter({
        companyName: rs.companyNameDisplay || this.company?.company || '',
        designPattern: designPattern
      });
      contentEl.insertAdjacentHTML('afterend', footerHtml);
    }

    // CTAバーを追加
    if (hasCtaBar) {
      const ctaBarHtml = renderFixedCtaBar({
        phoneNumber: rs.phoneNumber || '',
        ctaButtonText: rs.ctaButtonText || '今すぐ応募する',
        ctaUrl: '#recruit-jobs',
        designPattern: designPattern
      });
      document.body.insertAdjacentHTML('beforeend', ctaBarHtml);
    }
  }

  /**
   * エラー表示
   */
  showError(message) {
    this.hideLoading();
    const contentEl = document.getElementById('recruit-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="recruit-error">
          <h2>エラー</h2>
          <p>${escapeHtml(message)}</p>
          <a href="./" class="recruit-error-link">トップページへ戻る</a>
        </div>
      `;
    }
  }

  /**
   * ローディング非表示
   */
  hideLoading() {
    const loadingEl = document.getElementById('recruit-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  const page = new CompanyRecruitPage();
  page.init();
});

export default CompanyRecruitPage;
