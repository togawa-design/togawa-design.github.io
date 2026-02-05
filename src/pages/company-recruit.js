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
import { initPageTracking, trackCTAClick } from '@shared/page-analytics.js';
import '@shared/jobs-loader.js';

// 掲載開始日から1週間以内かどうかをチェック
function isWithinOneWeek(publishStartDate) {
  if (!publishStartDate) return false;

  const startDate = new Date(publishStartDate);
  if (isNaN(startDate.getTime())) return false;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return startDate >= oneWeekAgo;
}

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
    this.selectedJobType = 'all'; // 現在選択中の職種タブ
    this.currentPage = 1; // 現在のページ
    this.jobsPerPage = 6; // 1ページあたりの求人数
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

      // 会社情報と採用ページ設定を並列で取得
      const [companies, recruitSettings] = await Promise.all([
        window.JobsLoader.fetchCompanies(),
        loadRecruitSettings(this.companyDomain)
      ]);

      this.recruitSettings = recruitSettings || {};

      this.company = companies?.find(c =>
        c.companyDomain?.trim() === this.companyDomain &&
        window.JobsLoader.isCompanyVisible(c)
      );

      if (!this.company) {
        this.showError('指定された会社は見つかりませんでした。');
        return;
      }

      // 非公開チェック（編集モード以外）
      if (!this.isEditMode && this.recruitSettings.isPublished === false) {
        this.showError('このページは現在非公開です。');
        return;
      }

      // 求人データを取得
      this.jobs = await this.fetchJobs(this.company);

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
      } else {
        // アナリティクス（編集モード以外）
        this.trackPageView();
      }

    } catch (error) {
      console.error('[RecruitPage] 初期化エラー:', error);
      this.showError('ページの読み込みに失敗しました。');
    }
  }

  /**
   * ページビューをトラッキング
   */
  trackPageView() {
    initPageTracking({
      pageType: 'recruit',
      companyDomain: this.companyDomain,
      companyName: this.company?.company || null
    });
  }

  /**
   * CTAボタンクリックのトラッキング
   */
  trackCTAButtonClick(buttonType, buttonText = null) {
    trackCTAClick({
      pageType: 'recruit',
      companyDomain: this.companyDomain,
      buttonType,
      buttonText
    });
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

    // セクション順序と表示設定を取得
    const sectionOrder = this.getSectionOrder();
    const sectionVisibility = this.getSectionVisibility();

    // カスタムセクションを取得
    const customSections = this.getCustomSectionsArray();

    // 順序に従ってセクションをレンダリング
    const sectionsHtml = sectionOrder.map(sectionId => {
      // 非表示の場合はスキップ（必須セクション以外）
      if (sectionVisibility[sectionId] === false) return '';

      // 個別カスタムセクション (custom-0, custom-1, ...)
      if (sectionId.startsWith('custom-')) {
        const index = parseInt(sectionId.replace('custom-', ''), 10);
        if (!isNaN(index) && customSections[index]) {
          return this.renderSingleCustomSection(customSections[index], index);
        }
        return '';
      }

      switch (sectionId) {
        case 'hero':
          return this.renderHeroSection();
        case 'company-intro':
          return this.renderCompanyIntroSection();
        case 'jobs':
          return this.renderJobsSection();
        case 'cta':
          return this.renderCTASection();
        default:
          return '';
      }
    }).join('');

    // セクション順序に含まれていないカスタムセクションを末尾に追加
    const renderedCustomIndices = new Set(
      sectionOrder
        .filter(id => id.startsWith('custom-'))
        .map(id => parseInt(id.replace('custom-', ''), 10))
    );
    const remainingCustomSections = customSections
      .map((section, index) => ({ section, index }))
      .filter(({ index }) => !renderedCustomIndices.has(index) && sectionVisibility[`custom-${index}`] !== false)
      .map(({ section, index }) => this.renderSingleCustomSection(section, index))
      .join('');

    contentEl.innerHTML = sectionsHtml + remainingCustomSections;

    // ヘッダーロゴに会社名を設定
    const logoEl = document.getElementById('header-logo');
    if (logoEl && this.company?.company) {
      logoEl.innerHTML = `<span class="logo-text">${escapeHtml(this.company.company)}</span>`;
    }

    // 職種タブのイベントリスナーを設定
    this.setupJobTypeTabs();

    // ページネーションのイベントリスナーを設定
    this.setupPagination();

    // 動画ボタンのイベントリスナーを設定
    this.setupVideoButton();

    // フッターリンクを更新
    this.updateFooterLinks();
  }

  /**
   * フッターリンクを採用サイトへ更新
   */
  updateFooterLinks() {
    const footerLinks = document.querySelector('.recruit-footer-links');
    if (!footerLinks || !this.companyDomain) return;

    const recruitUrl = `company-recruit.html?id=${encodeURIComponent(this.companyDomain)}`;

    // トップページリンクを採用サイトTOPに変更
    const topLink = footerLinks.querySelector('a[href="./"]');
    if (topLink) {
      topLink.href = recruitUrl;
      topLink.textContent = '採用サイトTOP';
    }

    // 求人一覧リンクを更新
    const jobsLink = footerLinks.querySelector('a[href="./#jobs"]');
    if (jobsLink) {
      jobsLink.href = `${recruitUrl}#jobs`;
    }
  }

  /**
   * セクション順序を取得
   */
  getSectionOrder() {
    const rs = this.recruitSettings || {};
    if (rs.sectionOrder) {
      return rs.sectionOrder.split(',').map(s => s.trim()).filter(s => s);
    }
    // デフォルトは基本セクションのみ（カスタムセクションは末尾に自動追加される）
    return ['hero', 'company-intro', 'jobs', 'cta'];
  }

  /**
   * カスタムセクション配列を取得
   */
  getCustomSectionsArray() {
    const rs = this.recruitSettings || {};
    let customSections = rs.customSections || [];

    // JSON文字列の場合はパース
    if (typeof customSections === 'string') {
      try {
        customSections = JSON.parse(customSections);
      } catch (e) {
        console.error('[RecruitPage] customSectionsのパースエラー:', e);
        customSections = [];
      }
    }

    return Array.isArray(customSections) ? customSections : [];
  }

  /**
   * セクション表示状態を取得
   */
  getSectionVisibility() {
    const rs = this.recruitSettings || {};
    if (rs.sectionVisibility) {
      try {
        return JSON.parse(rs.sectionVisibility);
      } catch (e) {
        console.error('[RecruitPage] セクション表示設定のパースエラー:', e);
      }
    }
    return { 'company-intro': true };
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
    const heroSubtitle = (rs.heroSubtitle || (company.description ? this.truncateText(company.description, 100) : '私たちと一緒に働きませんか？')).replace(/&nbsp;/g, ' ');

    // 動画ボタン設定
    const showVideoButton = String(rs.showVideoButton).toLowerCase() === 'true';
    const videoUrl = rs.videoUrl || '';

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
          <div class="recruit-hero-buttons">
            <a href="#recruit-jobs" class="recruit-hero-cta">求人を見る</a>
            ${showVideoButton && videoUrl ? `
              <button type="button" class="recruit-video-button" data-video-url="${escapeHtml(videoUrl)}">
                <span class="recruit-video-button-icon">▶</span>
                <span class="recruit-video-button-text">動画を見る</span>
              </button>
            ` : ''}
          </div>
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

    // ソートを適用
    let displayJobs = [...this.jobs];
    const jobsSort = rs.jobsSort || 'newest';
    displayJobs = this.sortJobs(displayJobs, jobsSort);

    // 件数制限を適用（全件表示の場合は制限なし）
    const jobsLimit = parseInt(rs.jobsLimit) || 0;
    if (jobsLimit > 0 && displayJobs.length > jobsLimit) {
      displayJobs = displayJobs.slice(0, jobsLimit);
    }

    // モバイル判定（768px以下またはモバイルプレビューモード）
    const isMobile = window.innerWidth < 768 || document.body.classList.contains('preview-mode-mobile');

    // ページネーション計算（モバイルでは全件表示）
    const totalJobs = displayJobs.length;
    let pageJobs = displayJobs;
    let paginationHtml = '';

    if (!isMobile && totalJobs > this.jobsPerPage) {
      const totalPages = Math.ceil(totalJobs / this.jobsPerPage);
      const startIndex = (this.currentPage - 1) * this.jobsPerPage;
      const endIndex = Math.min(startIndex + this.jobsPerPage, totalJobs);
      pageJobs = displayJobs.slice(startIndex, endIndex);
      paginationHtml = this.renderPagination(totalPages, totalJobs);
    }

    // 職種タブを生成
    const jobTypeTabs = this.renderJobTypeTabs();

    return `
      <section class="recruit-section recruit-jobs" id="recruit-jobs">
        <div class="recruit-section-inner">
          <h2 class="recruit-section-title">${escapeHtml(jobsTitle)}</h2>
          ${jobTypeTabs}
          <div class="recruit-jobs-grid" id="recruit-jobs-grid">
            ${pageJobs.map(job => this.renderJobCard(job)).join('')}
          </div>
          ${paginationHtml}
        </div>
      </section>
    `;
  }

  /**
   * ページネーションを描画
   */
  renderPagination(totalPages, totalJobs) {
    const pages = [];

    // ページ番号を生成
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= this.currentPage - 1 && i <= this.currentPage + 1)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return `
      <div class="recruit-pagination" id="recruit-pagination">
        <div class="recruit-pagination-info">
          全${totalJobs}件中 ${(this.currentPage - 1) * this.jobsPerPage + 1}〜${Math.min(this.currentPage * this.jobsPerPage, totalJobs)}件を表示
        </div>
        <div class="recruit-pagination-controls">
          <button class="recruit-pagination-btn prev" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
            ← 前へ
          </button>
          <div class="recruit-pagination-pages">
            ${pages.map(p => {
              if (p === '...') {
                return '<span class="recruit-pagination-ellipsis">...</span>';
              }
              return `<button class="recruit-pagination-page ${p === this.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
            }).join('')}
          </div>
          <button class="recruit-pagination-btn next" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
            次へ →
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 求人をソート
   */
  sortJobs(jobs, sortType) {
    switch (sortType) {
      case 'newest':
        return jobs.sort((a, b) => {
          const dateA = new Date(a.publishStartDate || 0);
          const dateB = new Date(b.publishStartDate || 0);
          return dateB - dateA;
        });
      case 'oldest':
        return jobs.sort((a, b) => {
          const dateA = new Date(a.publishStartDate || 0);
          const dateB = new Date(b.publishStartDate || 0);
          return dateA - dateB;
        });
      case 'salary-high':
        return jobs.sort((a, b) => {
          const salaryA = this.parseSalary(a.monthlySalary);
          const salaryB = this.parseSalary(b.monthlySalary);
          return salaryB - salaryA;
        });
      case 'salary-low':
        return jobs.sort((a, b) => {
          const salaryA = this.parseSalary(a.monthlySalary);
          const salaryB = this.parseSalary(b.monthlySalary);
          return salaryA - salaryB;
        });
      case 'custom':
        // orderフィールドで並び替え（手動設定順）
        return jobs.sort((a, b) => {
          const orderA = parseInt(a.order) || 999;
          const orderB = parseInt(b.order) || 999;
          return orderA - orderB;
        });
      default:
        return jobs;
    }
  }

  /**
   * 給与文字列から数値を抽出
   */
  parseSalary(salaryStr) {
    if (!salaryStr) return 0;
    const match = salaryStr.match(/(\d+(?:,\d{3})*)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return 0;
  }

  /**
   * 職種タブを生成
   */
  renderJobTypeTabs() {
    // 求人から職種を抽出（重複除去）
    const jobTypes = [...new Set(this.jobs.map(job => job.jobType).filter(Boolean))];

    // 職種が1種類以下ならタブを表示しない
    if (jobTypes.length <= 1) {
      return '';
    }

    // 各職種の件数をカウント
    const typeCounts = {};
    this.jobs.forEach(job => {
      const type = job.jobType || 'その他';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return `
      <div class="recruit-job-tabs" id="recruit-job-tabs">
        <button class="recruit-job-tab active" data-type="all">
          すべて<span class="tab-count">${this.jobs.length}</span>
        </button>
        ${jobTypes.map(type => `
          <button class="recruit-job-tab" data-type="${escapeHtml(type)}">
            ${escapeHtml(type)}<span class="tab-count">${typeCounts[type] || 0}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * 職種タブのイベントリスナーを設定
   */
  setupJobTypeTabs() {
    const tabsContainer = document.getElementById('recruit-job-tabs');
    if (!tabsContainer) return;

    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.recruit-job-tab');
      if (!tab) return;

      const type = tab.dataset.type;
      this.filterJobsByType(type);

      // タブのアクティブ状態を更新
      tabsContainer.querySelectorAll('.recruit-job-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  }

  /**
   * 職種で求人をフィルタリング
   */
  filterJobsByType(type) {
    this.selectedJobType = type;
    const jobCards = document.querySelectorAll('.recruit-job-card');

    jobCards.forEach(card => {
      const jobType = card.dataset.jobType || '';
      if (type === 'all' || jobType === type) {
        card.style.display = '';
        card.classList.remove('hidden');
      } else {
        card.style.display = 'none';
        card.classList.add('hidden');
      }
    });
  }

  /**
   * ページネーションのイベントリスナーを設定
   */
  setupPagination() {
    const paginationContainer = document.getElementById('recruit-pagination');
    if (!paginationContainer) return;

    paginationContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;

      const page = parseInt(btn.dataset.page);
      if (page && page !== this.currentPage) {
        this.goToPage(page);
      }
    });
  }

  /**
   * 指定ページに移動
   */
  goToPage(page) {
    this.currentPage = page;

    // 求人セクションを再描画
    const jobsSection = document.getElementById('recruit-jobs');
    if (jobsSection) {
      const newJobsSection = document.createElement('div');
      newJobsSection.innerHTML = this.renderJobsSection();
      jobsSection.replaceWith(newJobsSection.firstElementChild);

      // イベントリスナーを再設定
      this.setupJobTypeTabs();
      this.setupPagination();

      // 求人セクションまでスクロール
      const newSection = document.getElementById('recruit-jobs');
      if (newSection) {
        newSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  /**
   * 求人カードを描画（L-SET注目の求人と同じフォーマット）
   */
  renderJobCard(job) {
    const jobId = job.jobId || job['求人ID'] || job.id || '';
    const lpUrl = `lp.html?j=${this.companyDomain}_${jobId}`;
    const imageUrl = job.jobLogo || job.imageUrl || this.company?.imageUrl || '';
    const jobType = job.jobType || '';
    const isNew = isWithinOneWeek(job.publishStartDate);
    const totalBonus = job._displayTotalBonus || job.totalBonus || '';
    const monthlySalary = job._displayMonthlySalary || job.monthlySalary || '';
    const location = job.companyAddress || job.location || '';

    return `
      <article class="recruit-job-card${isNew ? ' is-new' : ''}" data-job-type="${escapeHtml(jobType)}">
        ${isNew ? '<span class="recruit-job-new-tag">✨ NEW</span>' : ''}
        <div class="recruit-job-card-image" style="${imageUrl ? `background-image: url('${escapeHtml(imageUrl)}')` : ''}">
          ${!imageUrl ? '<div class="recruit-job-card-placeholder"></div>' : ''}
        </div>
        <div class="recruit-job-card-body">
          <h3 class="recruit-job-card-title">${escapeHtml(job.title || '求人情報')}</h3>
          ${location ? `<p class="recruit-job-card-location">${escapeHtml(location)}</p>` : ''}
          ${job.access ? `<p class="recruit-job-card-access">${escapeHtml(job.access)}</p>` : ''}
          <div class="recruit-job-card-benefits">
            ${totalBonus ? `
              <div class="recruit-benefit-item highlight">
                <span class="recruit-benefit-label">特典総額</span>
                <span class="recruit-benefit-value">${escapeHtml(totalBonus)}</span>
              </div>
            ` : ''}
            ${monthlySalary ? `
              <div class="recruit-benefit-item">
                <span class="recruit-benefit-label">月収例</span>
                <span class="recruit-benefit-value">${escapeHtml(monthlySalary)}</span>
              </div>
            ` : ''}
          </div>
          ${job.features || job.displayedFeatures ? `
            <div class="recruit-job-card-features">
              ${this.renderFeatures(job.features, job.displayedFeatures)}
            </div>
          ` : ''}
          <a href="${lpUrl}" class="recruit-job-card-btn">詳細を見る</a>
        </div>
      </article>
    `;
  }

  /**
   * 特徴タグを描画
   * @param {string} features - カンマ区切りの特徴文字列
   * @param {string} displayedFeatures - 表示用にカンマ区切りの特徴文字列（オプション）
   */
  renderFeatures(features, displayedFeatures = '') {
    // displayedFeaturesが設定されている場合はそちらを優先
    if (displayedFeatures && typeof displayedFeatures === 'string') {
      const displayedList = displayedFeatures.split(/[,、]/).map(f => f.trim()).filter(f => f).slice(0, 3);
      if (displayedList.length > 0) {
        return displayedList.map(f => `<span class="recruit-feature-tag">${escapeHtml(f)}</span>`).join('');
      }
    }

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
   * 単一のカスタムセクションを描画
   */
  renderSingleCustomSection(section, index) {
    switch (section.type) {
      case 'heading':
        return `
          <section class="recruit-section recruit-custom-section recruit-custom-heading" id="custom-section-${index}">
            <div class="recruit-section-inner">
              <h2 class="recruit-section-title">${escapeHtml(section.content || '')}</h2>
            </div>
          </section>
        `;
      case 'text':
        return `
          <section class="recruit-section recruit-custom-section recruit-custom-text" id="custom-section-${index}">
            <div class="recruit-section-inner">
              <div class="recruit-custom-content">${this.formatText(section.content || '')}</div>
            </div>
          </section>
        `;
      case 'image':
        return section.content ? `
          <section class="recruit-section recruit-custom-section recruit-custom-image" id="custom-section-${index}">
            <div class="recruit-section-inner">
              <img src="${escapeHtml(section.content)}" alt="" class="recruit-custom-image-content" loading="lazy">
            </div>
          </section>
        ` : '';
      case 'message':
        return `
          <section class="recruit-section recruit-custom-section recruit-custom-message" id="custom-section-${index}">
            <div class="recruit-section-inner">
              ${section.title ? `<h2 class="recruit-section-title">${escapeHtml(section.title)}</h2>` : ''}
              <div class="recruit-message-content">
                ${section.image ? `<div class="recruit-message-image"><img src="${escapeHtml(section.image)}" alt="" loading="lazy"></div>` : ''}
                <div class="recruit-message-text">
                  ${section.headline ? `<p class="recruit-message-headline">${escapeHtml(section.headline)}</p>` : ''}
                  ${section.description ? `<div class="recruit-message-description">${this.formatText(section.description)}</div>` : ''}
                </div>
              </div>
            </div>
          </section>
        `;
      case 'about':
        return `
          <section class="recruit-section recruit-custom-section recruit-custom-about" id="custom-section-${index}">
            <div class="recruit-section-inner">
              ${section.title ? `<h2 class="recruit-section-title">${escapeHtml(section.title)}</h2>` : ''}
              <div class="recruit-about-content">
                ${section.image ? `<div class="recruit-about-image"><img src="${escapeHtml(section.image)}" alt="" loading="lazy"></div>` : ''}
                ${section.description ? `<div class="recruit-about-description">${this.formatText(section.description)}</div>` : ''}
              </div>
            </div>
          </section>
        `;
      case 'business':
        const items = Array.isArray(section.items) ? section.items : [];
        return `
          <section class="recruit-section recruit-custom-section recruit-custom-business" id="custom-section-${index}">
            <div class="recruit-section-inner">
              ${section.title ? `<h2 class="recruit-section-title">${escapeHtml(section.title)}</h2>` : ''}
              <div class="recruit-business-grid">
                ${items.map(item => `
                  <div class="recruit-business-item">
                    <h3 class="recruit-business-item-title">${escapeHtml(item.name || '')}</h3>
                    ${item.description ? `<p class="recruit-business-item-description">${escapeHtml(item.description)}</p>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          </section>
        `;
      case 'photos':
        const images = Array.isArray(section.images) ? section.images : [];
        return images.length > 0 ? `
          <section class="recruit-section recruit-custom-section recruit-custom-photos" id="custom-section-${index}">
            <div class="recruit-section-inner">
              ${section.title ? `<h2 class="recruit-section-title">${escapeHtml(section.title)}</h2>` : ''}
              <div class="recruit-photos-grid">
                ${images.map(img => `
                  <div class="recruit-photos-item">
                    <img src="${escapeHtml(img)}" alt="" loading="lazy">
                  </div>
                `).join('')}
              </div>
            </div>
          </section>
        ` : '';
      default:
        return '';
    }
  }

  /**
   * カスタムセクションを描画（後方互換性のため残す）
   */
  renderCustomSections() {
    const customSections = this.getCustomSectionsArray();
    if (!customSections.length) return '';
    return customSections.map((section, index) => this.renderSingleCustomSection(section, index)).join('');
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
      : `${company.company} 採用情報 | L-SET`;
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
      // 会社設定のヘッダーがある場合、動的ヘッダーを使用（デフォルトはCSS非表示のまま）
    } else {
      // 会社設定がない場合、デフォルトの静的ヘッダーを表示
      const defaultRecruitHeader = document.querySelector('.recruit-header');
      if (defaultRecruitHeader) {
        defaultRecruitHeader.style.display = 'block';
      }
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
      // customLinksがJSON文字列の場合はパース
      let customLinks = rs.customLinks || [];
      if (typeof customLinks === 'string') {
        try {
          customLinks = JSON.parse(customLinks);
        } catch (e) {
          console.error('[RecruitPage] customLinksのパースエラー:', e);
          customLinks = [];
        }
      }
      if (!Array.isArray(customLinks)) {
        customLinks = [];
      }

      const footerHtml = renderSiteFooter({
        companyName: rs.companyNameDisplay || this.company?.company || '',
        designPattern: designPattern,
        sns: {
          twitter: rs.snsTwitter || '',
          instagram: rs.snsInstagram || '',
          facebook: rs.snsFacebook || '',
          youtube: rs.snsYoutube || '',
          line: rs.snsLine || '',
          tiktok: rs.snsTiktok || ''
        },
        customLinks: customLinks
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

  /**
   * 動画ボタンのイベントリスナーを設定
   */
  setupVideoButton() {
    const videoButton = document.querySelector('.recruit-video-button');
    if (!videoButton) return;

    videoButton.addEventListener('click', (e) => {
      e.preventDefault();
      const videoUrl = videoButton.dataset.videoUrl;
      if (videoUrl) {
        this.showVideoModal(videoUrl);
      }
    });
  }

  /**
   * 動画モーダルを表示
   */
  showVideoModal(videoUrl) {
    const embedUrl = this.getYouTubeEmbedUrl(videoUrl);
    if (!embedUrl) {
      console.error('[RecruitPage] YouTube URLの解析に失敗:', videoUrl);
      return;
    }

    // モーダルHTML
    const modalHtml = `
      <div class="recruit-video-modal" id="recruit-video-modal">
        <div class="recruit-video-modal-backdrop"></div>
        <div class="recruit-video-modal-content">
          <button type="button" class="recruit-video-modal-close" aria-label="閉じる">&times;</button>
          <div class="recruit-video-modal-wrapper">
            <iframe
              src="${embedUrl}?autoplay=1&rel=0"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </div>
    `;

    // モーダルをbodyに追加
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('recruit-video-modal');
    const closeBtn = modal.querySelector('.recruit-video-modal-close');
    const backdrop = modal.querySelector('.recruit-video-modal-backdrop');

    // 閉じるボタンクリック
    closeBtn.addEventListener('click', () => this.closeVideoModal());

    // 背景クリックで閉じる
    backdrop.addEventListener('click', () => this.closeVideoModal());

    // ESCキーで閉じる
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.closeVideoModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // bodyスクロール無効化
    document.body.style.overflow = 'hidden';
  }

  /**
   * 動画モーダルを閉じる
   */
  closeVideoModal() {
    const modal = document.getElementById('recruit-video-modal');
    if (modal) {
      modal.remove();
    }
    document.body.style.overflow = '';
  }

  /**
   * YouTube URLを埋め込み用URLに変換
   */
  getYouTubeEmbedUrl(url) {
    if (!url) return null;

    // YouTube URLからvideo IDを抽出
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }

    return null;
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  const page = new CompanyRecruitPage();
  page.init();
});

export default CompanyRecruitPage;
