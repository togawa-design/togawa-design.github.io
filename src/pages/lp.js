/**
 * LPページ エントリーポイント
 */
import { LPRenderer, LPEditor } from '@features/lp/index.js';
import { trackEvent, hasUrlParam, getUrlParam } from '@shared/utils.js';
import '@shared/jobs-loader.js';

class CompanyLPPage {
  constructor() {
    this.renderer = new LPRenderer();
    this.editor = new LPEditor();
    this.isEditMode = hasUrlParam('edit');
    this.companyDomain = null;
  }

  async init() {
    this.companyDomain = this.getCompanyDomain();

    if (!this.companyDomain) {
      this.showError('会社が指定されていません。');
      return;
    }

    try {
      // JobsLoaderの読み込みを待機
      await this.waitForJobsLoader();

      // 会社情報を取得
      const companies = await window.JobsLoader.fetchCompanies();
      const company = companies?.find(c =>
        c.companyDomain?.trim() === this.companyDomain &&
        window.JobsLoader.isCompanyVisible(c)
      );

      if (!company) {
        this.showError('指定された会社は見つかりませんでした。');
        return;
      }

      // 求人データを取得
      const jobs = await this.fetchJobs(company);

      // LP設定を取得
      const lpSettings = await this.fetchLPSettings(this.companyDomain) || {};

      // LPを描画
      this.hideLoading();
      const contentEl = document.getElementById('lp-content');
      if (contentEl) {
        this.renderer.render(company, jobs, lpSettings, contentEl);
        this.setupEventListeners(company);
      }

      // 編集モードの場合
      if (this.isEditMode) {
        this.editor.enable(lpSettings, this.companyDomain);
      }

      // SEOを更新
      this.updateSEO(company, jobs);

      // アナリティクス
      if (!this.isEditMode) {
        this.trackPageView(company);
      }

    } catch (error) {
      console.error('LP読み込みエラー:', error);
      this.showError('ページの読み込みに失敗しました。');
    }
  }

  getCompanyDomain() {
    return getUrlParam('c') || getUrlParam('id') || null;
  }

  async waitForJobsLoader(timeout = 10000) {
    if (typeof window.JobsLoader !== 'undefined') {
      return window.JobsLoader;
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (typeof window.JobsLoader !== 'undefined') {
          clearInterval(checkInterval);
          resolve(window.JobsLoader);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('JobsLoader timeout'));
        }
      }, 100);
    });
  }

  async fetchJobs(company) {
    if (!company.jobsSheet?.trim()) return [];

    const companyJobs = await window.JobsLoader.fetchCompanyJobs(company.jobsSheet.trim());
    if (!companyJobs?.length) return [];

    return companyJobs
      .filter(j => j.visible !== 'false' && j.visible !== 'FALSE')
      .filter(j => window.JobsLoader.isJobInPublishPeriod(j))
      .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
      .map(j => ({
        ...j,
        company: company.company,
        companyDomain: company.companyDomain
      }));
  }

  async fetchLPSettings(companyDomain) {
    try {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${window.JobsLoader.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=LP設定`;
      const response = await fetch(sheetUrl);
      if (!response.ok) return null;

      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = window.JobsLoader.parseCSVLine(lines[0] || '');

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = window.JobsLoader.parseCSVLine(lines[i]);
        const rowData = {};
        headers.forEach((header, idx) => {
          rowData[header.replace(/"/g, '').trim()] = values[idx] || '';
        });

        if (rowData.companyDomain === companyDomain || rowData['会社ドメイン'] === companyDomain) {
          return {
            heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
            heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
            heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
            ctaText: rowData.ctaText || rowData['CTAテキスト'] || 'この求人に応募する',
            pointTitle1: rowData.pointTitle1 || rowData['ポイント1タイトル'] || '',
            pointDesc1: rowData.pointDesc1 || rowData['ポイント1説明'] || '',
            pointTitle2: rowData.pointTitle2 || rowData['ポイント2タイトル'] || '',
            pointDesc2: rowData.pointDesc2 || rowData['ポイント2説明'] || '',
            pointTitle3: rowData.pointTitle3 || rowData['ポイント3タイトル'] || '',
            pointDesc3: rowData.pointDesc3 || rowData['ポイント3説明'] || '',
            faq: rowData.faq || rowData['FAQ'] || '',
            designPattern: rowData.designPattern || rowData['デザインパターン'] || 'standard',
            sectionOrder: rowData.sectionOrder || rowData['セクション順序'] || '',
            sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || ''
          };
        }
      }
    } catch (e) {
      console.log('LP設定シートが見つかりません（デフォルト設定を使用）');
    }
    return null;
  }

  hideLoading() {
    const loadingEl = document.getElementById('lp-loading');
    if (loadingEl) loadingEl.style.display = 'none';
  }

  showError(message) {
    this.hideLoading();
    const contentEl = document.getElementById('lp-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="lp-error">
          <p>${message}</p>
          <a href="/" class="lp-btn-back">トップページへ戻る</a>
        </div>
      `;
    }
  }

  setupEventListeners(company) {
    // FAQアコーディオン
    document.querySelectorAll('.lp-faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', !expanded);
        const answerId = btn.getAttribute('aria-controls');
        const answer = document.getElementById(answerId);
        if (answer) {
          answer.classList.toggle('open', !expanded);
        }
      });
    });

    // スムーススクロール
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // 応募ボタントラッキング
    document.querySelectorAll('.lp-btn-apply-hero, .lp-btn-apply-main, .lp-btn-apply-footer').forEach(btn => {
      btn.addEventListener('click', () => {
        trackEvent('lp_apply_click', {
          company_domain: company.companyDomain,
          company_name: company.company,
          button_location: btn.classList.contains('lp-btn-apply-hero') ? 'hero' :
                          btn.classList.contains('lp-btn-apply-main') ? 'main' : 'footer'
        });
      });
    });
  }

  updateSEO(company, jobs) {
    const title = `${company.company} 求人情報 | リクエコ求人ナビ`;
    const description = jobs.length > 0
      ? `${company.company}の求人情報。${jobs[0].title}など${jobs.length}件の募集中。`
      : `${company.company}の求人情報ページです。`;

    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = description;

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = title;

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = description;
  }

  trackPageView(company) {
    trackEvent('lp_view', {
      company_domain: company.companyDomain,
      company_name: company.company
    });
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  const page = new CompanyLPPage();
  page.init();
});

export default CompanyLPPage;
