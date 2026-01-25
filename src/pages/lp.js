/**
 * LPページ エントリーポイント
 */
import { LPRenderer, LPEditor } from '@features/lp/index.js';
import { trackEvent, hasUrlParam, getUrlParam } from '@shared/utils.js';
import '@shared/jobs-loader.js';

// UTMパラメータのキー一覧
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

class CompanyLPPage {
  constructor() {
    this.renderer = new LPRenderer();
    this.editor = new LPEditor();
    this.isEditMode = hasUrlParam('edit');
    this.companyDomain = null;
    this.utmParams = {};
    this.lpSettings = null;
  }

  async init() {
    this.companyDomain = this.getCompanyDomain();

    if (!this.companyDomain) {
      this.showError('会社が指定されていません。');
      return;
    }

    // UTMパラメータを取得・保存
    this.captureUTMParams();

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
      this.lpSettings = await this.fetchLPSettings(this.companyDomain) || {};

      // 広告タグを設置
      this.setupAdTracking(this.lpSettings);

      // LPを描画
      this.hideLoading();
      const contentEl = document.getElementById('lp-content');
      if (contentEl) {
        this.renderer.render(company, jobs, this.lpSettings, contentEl);
        this.setupEventListeners(company);
      }

      // 編集モードの場合
      if (this.isEditMode) {
        this.editor.enable(this.lpSettings, this.companyDomain);
      }

      // SEO/OGPを更新
      this.updateSEO(company, jobs, this.lpSettings);

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
            pointTitle4: rowData.pointTitle4 || rowData['ポイント4タイトル'] || '',
            pointDesc4: rowData.pointDesc4 || rowData['ポイント4説明'] || '',
            pointTitle5: rowData.pointTitle5 || rowData['ポイント5タイトル'] || '',
            pointDesc5: rowData.pointDesc5 || rowData['ポイント5説明'] || '',
            pointTitle6: rowData.pointTitle6 || rowData['ポイント6タイトル'] || '',
            pointDesc6: rowData.pointDesc6 || rowData['ポイント6説明'] || '',
            faq: rowData.faq || rowData['FAQ'] || '',
            designPattern: rowData.designPattern || rowData['デザインパターン'] || 'standard',
            sectionOrder: rowData.sectionOrder || rowData['セクション順序'] || '',
            sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || '',
            // 広告トラッキング設定
            tiktokPixelId: rowData.tiktokPixelId || rowData['TikTok Pixel ID'] || '',
            googleAdsId: rowData.googleAdsId || rowData['Google Ads ID'] || '',
            googleAdsLabel: rowData.googleAdsLabel || rowData['Google Ads ラベル'] || '',
            // OGP設定
            ogpTitle: rowData.ogpTitle || rowData['OGPタイトル'] || '',
            ogpDescription: rowData.ogpDescription || rowData['OGP説明文'] || '',
            ogpImage: rowData.ogpImage || rowData['OGP画像'] || ''
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
    document.querySelectorAll('.lp-btn-apply-hero, .lp-btn-apply-main, .lp-btn-apply-footer, .lp-btn-apply-header').forEach(btn => {
      btn.addEventListener('click', () => {
        const buttonLocation = btn.classList.contains('lp-btn-apply-hero') ? 'hero' :
                              btn.classList.contains('lp-btn-apply-main') ? 'main' :
                              btn.classList.contains('lp-btn-apply-header') ? 'header' : 'footer';

        // GA4トラッキング
        trackEvent('lp_apply_click', {
          company_domain: company.companyDomain,
          company_name: company.company,
          button_location: buttonLocation,
          ...this.utmParams
        });

        // 広告コンバージョントラッキング
        this.trackConversion('SubmitForm', {
          content_name: company.company,
          content_category: 'job_application',
          button_location: buttonLocation,
          ...this.utmParams
        });
      });
    });

    // 電話ボタントラッキング
    document.querySelectorAll('.lp-btn-tel-header, .lp-btn-tel-footer').forEach(btn => {
      btn.addEventListener('click', () => {
        const buttonLocation = btn.classList.contains('lp-btn-tel-header') ? 'header' : 'footer';

        // GA4トラッキング
        trackEvent('lp_tel_click', {
          company_domain: company.companyDomain,
          company_name: company.company,
          button_location: buttonLocation,
          ...this.utmParams
        });

        // 広告コンバージョントラッキング（電話コンバージョン）
        this.trackConversion('Contact', {
          content_name: company.company,
          content_category: 'phone_call',
          button_location: buttonLocation,
          ...this.utmParams
        });
      });
    });
  }

  updateSEO(company, jobs, lpSettings = {}) {
    // OGP設定があればそちらを優先
    const ogpTitle = lpSettings.ogpTitle || lpSettings.heroTitle || '';
    const ogpDescription = lpSettings.ogpDescription || '';
    const ogpImage = lpSettings.ogpImage || lpSettings.heroImage || '';

    const title = ogpTitle
      ? `${ogpTitle} | ${company.company}`
      : `${company.company} 求人情報 | リクエコ求人ナビ`;
    const description = ogpDescription
      ? ogpDescription
      : (jobs.length > 0
          ? `${company.company}の求人情報。${jobs[0].title}など${jobs.length}件の募集中。`
          : `${company.company}の求人情報ページです。`);

    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = description;

    const ogTitleMeta = document.querySelector('meta[property="og:title"]');
    if (ogTitleMeta) ogTitleMeta.content = title;

    const ogDescMeta = document.querySelector('meta[property="og:description"]');
    if (ogDescMeta) ogDescMeta.content = description;

    // OGP画像を設定
    if (ogpImage) {
      let ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (!ogImageMeta) {
        ogImageMeta = document.createElement('meta');
        ogImageMeta.setAttribute('property', 'og:image');
        document.head.appendChild(ogImageMeta);
      }
      ogImageMeta.content = ogpImage;

      // Twitter Card用
      let twitterImageMeta = document.querySelector('meta[name="twitter:image"]');
      if (!twitterImageMeta) {
        twitterImageMeta = document.createElement('meta');
        twitterImageMeta.setAttribute('name', 'twitter:image');
        document.head.appendChild(twitterImageMeta);
      }
      twitterImageMeta.content = ogpImage;
    }

    // og:urlを設定
    let ogUrlMeta = document.querySelector('meta[property="og:url"]');
    if (!ogUrlMeta) {
      ogUrlMeta = document.createElement('meta');
      ogUrlMeta.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrlMeta);
    }
    // UTMパラメータを除いたURLを設定
    ogUrlMeta.content = `${window.location.origin}${window.location.pathname}?c=${this.companyDomain}`;

    // Twitter Cardの設定
    let twitterCardMeta = document.querySelector('meta[name="twitter:card"]');
    if (!twitterCardMeta) {
      twitterCardMeta = document.createElement('meta');
      twitterCardMeta.setAttribute('name', 'twitter:card');
      document.head.appendChild(twitterCardMeta);
    }
    twitterCardMeta.content = 'summary_large_image';
  }

  // UTMパラメータを取得・保存
  captureUTMParams() {
    const urlParams = new URLSearchParams(window.location.search);

    UTM_PARAMS.forEach(param => {
      const value = urlParams.get(param);
      if (value) {
        this.utmParams[param] = value;
      }
    });

    // セッションストレージに保存（応募時に参照するため）
    if (Object.keys(this.utmParams).length > 0) {
      sessionStorage.setItem(`utm_params_${this.companyDomain}`, JSON.stringify(this.utmParams));
      console.log('[LP] UTM params captured:', this.utmParams);
    } else {
      // 保存済みのUTMパラメータがあれば復元
      const saved = sessionStorage.getItem(`utm_params_${this.companyDomain}`);
      if (saved) {
        try {
          this.utmParams = JSON.parse(saved);
        } catch (e) {
          // パースエラーは無視
        }
      }
    }
  }

  // 広告トラッキングを設定
  setupAdTracking(lpSettings) {
    // TikTok Pixel
    if (lpSettings.tiktokPixelId) {
      this.initTikTokPixel(lpSettings.tiktokPixelId);
    }

    // Google Ads
    if (lpSettings.googleAdsId) {
      this.initGoogleAds(lpSettings.googleAdsId);
    }
  }

  // TikTok Pixelを初期化
  initTikTokPixel(pixelId) {
    if (!pixelId || window.ttq) return;

    // TikTok Pixel Base Code
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
      ttq.load(pixelId);
      ttq.page();
    }(window, document, 'ttq');

    console.log('[LP] TikTok Pixel initialized:', pixelId);
  }

  // Google Adsを初期化
  initGoogleAds(adsId) {
    if (!adsId) return;

    // Google Ads gtagが既に存在する場合は設定のみ追加
    if (typeof gtag === 'function') {
      gtag('config', adsId);
      console.log('[LP] Google Ads configured:', adsId);
      return;
    }

    // gtagがない場合はスクリプトを読み込む
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${adsId}`;
    document.head.appendChild(script);

    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', adsId);
      console.log('[LP] Google Ads initialized:', adsId);
    };
  }

  // コンバージョンをトラッキング
  trackConversion(eventType, eventData = {}) {
    // TikTok Pixel
    if (window.ttq) {
      window.ttq.track(eventType, eventData);
      console.log('[LP] TikTok event tracked:', eventType, eventData);
    }

    // Google Ads コンバージョン
    if (this.lpSettings?.googleAdsId && this.lpSettings?.googleAdsLabel && typeof gtag === 'function') {
      gtag('event', 'conversion', {
        'send_to': `${this.lpSettings.googleAdsId}/${this.lpSettings.googleAdsLabel}`,
        ...eventData
      });
      console.log('[LP] Google Ads conversion tracked:', this.lpSettings.googleAdsId);
    }
  }

  trackPageView(company) {
    trackEvent('lp_view', {
      company_domain: company.companyDomain,
      company_name: company.company,
      ...this.utmParams
    });

    // TikTok Pixel PageView（初期化時に既にpage()が呼ばれているが、追加情報付きで再送信）
    if (window.ttq) {
      window.ttq.track('ViewContent', {
        content_name: company.company,
        content_category: 'company_lp'
      });
    }
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  const page = new CompanyLPPage();
  page.init();
});

export default CompanyLPPage;
