/**
 * LPページ エントリーポイント
 */
import { LPRenderer, LPEditor } from '@features/lp/index.js';
import { trackEvent, hasUrlParam, getUrlParam } from '@shared/utils.js';
import { loadRecruitSettings } from '@features/recruit-settings/api.js';
import {
  renderSiteHeader,
  renderFixedCtaBar
} from '@components/organisms/LayoutComponents.js';
import { initPageTracking, trackCTAClick } from '@shared/page-analytics.js';
import '@shared/jobs-loader.js';
import * as FirestoreService from '@shared/firestore-service.js';
import { createApplicationNotification } from '@features/notifications/notification-service.js';
import { initTracking, getTrackingDataForApplication } from '@shared/utm-tracking.js';

// UTMパラメータのキー一覧
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/**
 * CSVテキストを正しく行に分割（ダブルクォート内の改行を考慮）
 */
function splitCSVToRows(csvText) {
  const rows = [];
  let currentRow = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      if (csvText[i + 1] === '"') {
        // エスケープされたダブルクォート
        currentRow += '""';
        i++;
      } else {
        // クォートの開始/終了
        insideQuotes = !insideQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !insideQuotes) {
      // 行の終わり（クォート外）
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else if (char === '\r') {
      // キャリッジリターンは無視
      continue;
    } else {
      currentRow += char;
    }
  }

  // 最後の行を追加
  if (currentRow.trim()) {
    rows.push(currentRow);
  }

  return rows;
}

class CompanyLPPage {
  constructor() {
    this.renderer = new LPRenderer();
    this.editor = new LPEditor();
    this.isEditMode = hasUrlParam('edit');
    this.jobId = null;
    this.companyDomain = null;
    this.utmParams = {};
    this.lpSettings = null;
    this.company = null;
    this.mainJob = null;
    this.recruitSettings = null; // 会社の採用ページ設定（ロゴ・ヘッダー情報用）
  }

  async init() {
    // 求人ID（新形式）または会社ドメイン（旧形式）を取得
    this.jobId = this.getJobId();
    this.companyDomain = this.getCompanyDomain();

    if (!this.jobId && !this.companyDomain) {
      this.showError('求人または会社が指定されていません。');
      return;
    }

    // UTMパラメータを取得・保存
    this.captureUTMParams();

    try {
      // JobsLoaderの読み込みを待機
      await this.waitForJobsLoader();

      // Firestore初期化を待機
      await window.JobsLoader.initFirestoreLoader();

      // 会社情報を取得
      const companies = await window.JobsLoader.fetchCompanies();

      if (this.jobId) {
        // 求人ID形式（新形式）: companyDomain_jobId
        const [companyDomain, jobIdPart] = this.jobId.split('_');

        this.company = companies?.find(c =>
          c.companyDomain?.trim() === companyDomain &&
          window.JobsLoader.isCompanyVisible(c)
        );

        console.log('[LP] 会社データ:', this.company);
        console.log('[LP] 会社データのキー:', this.company ? Object.keys(this.company) : []);

        if (!this.company) {
          this.showError('指定された会社は見つかりませんでした。');
          return;
        }

        // 対象の求人を取得
        const allJobs = await this.fetchJobs(this.company);

        this.mainJob = allJobs.find(j => {
          // jobId, 求人ID, id のいずれかでマッチング
          const jid = j.jobId || j['求人ID'] || j.id || '';

          // 完全一致チェック
          if (jid === jobIdPart || `${companyDomain}_${jid}` === this.jobId) {
            return true;
          }

          // job-X フォーマットの場合、数字部分でもマッチング（例: job-1 → 1）
          if (jobIdPart.startsWith('job-')) {
            const numPart = jobIdPart.replace('job-', '');
            if (jid === numPart) {
              return true;
            }
          }

          return false;
        });

        if (!this.mainJob) {
          this.showError('指定された求人は見つかりませんでした。');
          return;
        }

        // LP設定を取得（求人ID単位）
        this.lpSettings = await this.fetchLPSettings(this.jobId) || {};

        // プレビューモードの場合、sessionStorageから編集中のデータを読み込む
        this.lpSettings = this.loadPreviewSettings(this.jobId, this.lpSettings);

      } else {
        // 会社ドメイン形式（旧形式・後方互換）
        this.company = companies?.find(c =>
          c.companyDomain?.trim() === this.companyDomain &&
          window.JobsLoader.isCompanyVisible(c)
        );

        if (!this.company) {
          this.showError('指定された会社は見つかりませんでした。');
          return;
        }

        // LP設定を取得（会社単位・旧形式）
        this.lpSettings = await this.fetchLPSettingsLegacy(this.companyDomain) || {};

        // プレビューモードの場合、sessionStorageから編集中のデータを読み込む
        this.lpSettings = this.loadPreviewSettings(this.companyDomain, this.lpSettings);
      }

      // 会社の採用ページ設定からデザインパターンを継承
      await this.inheritCompanyRecruitSettings();

      // URLパラメータでlayoutStyleをオーバーライド（テスト/プレビュー用）
      const urlLayoutStyle = getUrlParam('layoutStyle');
      if (urlLayoutStyle) {
        this.lpSettings.layoutStyle = urlLayoutStyle;
      }

      // 求人データを取得
      const jobs = await this.fetchJobs(this.company);

      // 広告タグを設置
      this.setupAdTracking(this.lpSettings);

      // LPを描画
      this.hideLoading();
      const contentEl = document.getElementById('lp-content');
      if (contentEl) {
        // 編集モードの場合は静的ヘッダー・フッターを非表示にして
        // リアルタイムプレビューと同じ構造にする（スマホ枠付き）
        if (this.isEditMode) {
          document.body.classList.add('lp-preview-mode-mobile');
          const staticHeader = document.querySelector('.lp-header');
          const staticFooter = document.querySelector('.lp-footer');
          if (staticHeader) staticHeader.style.display = 'none';
          if (staticFooter) staticFooter.style.display = 'none';
        }

        // 新形式の場合はメイン求人を先頭に（IDで比較して重複を防ぐ）
        const orderedJobs = this.mainJob
          ? [this.mainJob, ...jobs.filter(j => j.id !== this.mainJob.id)]
          : jobs;
        this.renderer.render(this.company, orderedJobs, this.lpSettings, contentEl);

        // ヘッダー・フッター・CTAバーを追加（編集モードではスキップ）
        if (!this.isEditMode) {
          this.renderLayoutComponents(contentEl);
        }

        this.setupEventListeners(this.company);

        // 応募モーダルのイベントを設定
        this.setupApplyModal();

        // フッターリンクを採用サイトへ更新
        this.updateFooterLinks();
      }

      // 編集モードの場合
      if (this.isEditMode) {
        // jobInfoを構築してエディタに渡す
        const jobInfo = {
          company: this.company?.company || '',
          companyDomain: this.company?.companyDomain || '',
          title: this.mainJob?.title || ''
        };
        this.editor.enable(this.lpSettings, this.jobId || this.companyDomain, jobInfo, this.company, this.mainJob);
      }

      // SEO/OGPを更新
      this.updateSEO(this.company, this.mainJob ? [this.mainJob] : jobs, this.lpSettings);

      // アナリティクス
      if (!this.isEditMode) {
        this.trackPageView(this.company);
      }

    } catch (error) {
      console.error('LP読み込みエラー:', error);
      this.showError('ページの読み込みに失敗しました。');
    }
  }

  getJobId() {
    return getUrlParam('j') || getUrlParam('job') || null;
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
    // jobsSheetから求人データソースを取得（'管理シート'カラムからマッピング）
    const jobsSource = company.jobsSheet?.trim();
    if (!jobsSource) return [];

    const companyJobs = await window.JobsLoader.fetchCompanyJobs(jobsSource);
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

  /**
   * 会社の採用ページ設定からテンプレート・カラーを継承
   * LP設定にlayoutStyle/designPatternがない場合、会社の採用ページ設定から継承する
   */
  async inheritCompanyRecruitSettings() {
    // LP固有の設定があるかチェック
    const hasCustomLayoutStyle = this.lpSettings?.layoutStyle && this.lpSettings.layoutStyle !== 'modern';
    const hasCustomDesignPattern = this.lpSettings?.designPattern && this.lpSettings.designPattern !== 'modern';

    const companyDomain = this.company?.companyDomain;
    if (!companyDomain) {
      console.log('[LP] 会社ドメインが見つかりません');
      return;
    }

    try {
      // 会社の採用ページ設定を取得
      const recruitSettings = await loadRecruitSettings(companyDomain);

      if (!recruitSettings) {
        console.log('[LP] 会社の採用ページ設定がありません');
        return;
      }

      // ロゴ・ヘッダー情報用に保存
      this.recruitSettings = recruitSettings;

      // 両方とも設定済みならテンプレート継承はスキップ
      if (hasCustomLayoutStyle && hasCustomDesignPattern) {
        console.log('[LP] LP固有のlayoutStyle/designPatternを使用');
        return;
      }

      const inheritedSettings = {};

      // layoutStyleを継承（LP固有設定がない場合）
      if (!hasCustomLayoutStyle && recruitSettings.layoutStyle) {
        console.log('[LP] 会社の採用ページ設定からlayoutStyleを継承:', recruitSettings.layoutStyle);
        inheritedSettings.layoutStyle = recruitSettings.layoutStyle;
      }

      // designPatternを継承（LP固有設定がない場合）
      if (!hasCustomDesignPattern && recruitSettings.designPattern) {
        console.log('[LP] 会社の採用ページ設定からdesignPatternを継承:', recruitSettings.designPattern);
        inheritedSettings.designPattern = recruitSettings.designPattern;
      }

      if (Object.keys(inheritedSettings).length > 0) {
        this.lpSettings = {
          ...this.lpSettings,
          ...inheritedSettings
        };
      }
    } catch (error) {
      console.log('[LP] 採用ページ設定の取得エラー:', error.message);
    }
  }

  // LP設定を取得（求人ID単位・新形式）
  // Firestoreから取得
  async fetchLPSettings(jobId) {
    try {
      FirestoreService.initFirestore();
      // jobIdは「companyDomain_actualJobId」形式
      const parts = jobId.split('_');
      const companyDomain = parts[0];

      // 管理画面はjobIdをそのまま保存しているため、フルIDで取得を試みる
      console.log('[LP] Firestore LP設定取得 (フルID):', companyDomain, jobId);
      let result = await FirestoreService.getLPSettings(companyDomain, jobId);

      if (result.success && result.settings && Object.keys(result.settings).length > 0) {
        console.log('[LP] Firestore LP設定を発見 (フルID):', result.settings);
        return result.settings;
      }

      // フォールバック: 旧形式（jobIdのみ）で試行
      const actualJobId = parts.slice(1).join('_');
      if (actualJobId && actualJobId !== jobId) {
        console.log('[LP] Firestore LP設定取得 (フォールバック):', companyDomain, actualJobId);
        result = await FirestoreService.getLPSettings(companyDomain, actualJobId);
        if (result.success && result.settings && Object.keys(result.settings).length > 0) {
          console.log('[LP] Firestore LP設定を発見 (フォールバック):', result.settings);
          return result.settings;
        }
      }

      console.log('[LP] Firestore LP設定が見つかりません（デフォルト設定を使用）');
      return null;
    } catch (e) {
      console.log('[LP] Firestore LP設定取得エラー:', e.message);
      return null;
    }
  }

  // LP設定を取得（会社ドメイン単位・旧形式・後方互換）
  // Firestoreから会社の最初の求人のLP設定を取得
  async fetchLPSettingsLegacy(companyDomain) {
    try {
      FirestoreService.initFirestore();
      // 会社の求人一覧を取得して最初の求人のLP設定を使用
      const jobsResult = await FirestoreService.getJobs(companyDomain);
      if (jobsResult.success && jobsResult.jobs && jobsResult.jobs.length > 0) {
        const firstJob = jobsResult.jobs[0];
        console.log('[LP Legacy] Firestore 最初の求人ID:', firstJob.id);
        const result = await FirestoreService.getLPSettings(companyDomain, firstJob.id);
        if (result.success && result.settings && Object.keys(result.settings).length > 0) {
          console.log('[LP Legacy] Firestore LP設定を発見:', result.settings);
          return result.settings;
        }
      }
      console.log('[LP Legacy] Firestore LP設定が見つかりません（デフォルト設定を使用）');
      return null;
    } catch (e) {
      console.log('[LP Legacy] Firestore LP設定取得エラー:', e.message);
      return null;
    }
  }

  // LP設定行をパース
  parseLPSettingsRow(rowData) {
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
      designPattern: rowData.designPattern || rowData['デザインパターン'] || 'modern',
      layoutStyle: rowData.layoutStyle || rowData['レイアウトスタイル'] || 'modern',
      sectionOrder: rowData.sectionOrder || rowData['セクション順序'] || '',
      sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || '',
      // 広告トラッキング設定
      tiktokPixelId: rowData.tiktokPixelId || rowData['TikTok Pixel ID'] || '',
      googleAdsId: rowData.googleAdsId || rowData['Google Ads ID'] || '',
      googleAdsLabel: rowData.googleAdsLabel || rowData['Google Ads ラベル'] || '',
      metaPixelId: rowData.metaPixelId || rowData['Meta Pixel ID'] || '',
      lineTagId: rowData.lineTagId || rowData['LINE Tag ID'] || '',
      clarityProjectId: rowData.clarityProjectId || rowData['Clarity Project ID'] || '',
      // OGP設定
      ogpTitle: rowData.ogpTitle || rowData['OGPタイトル'] || '',
      ogpDescription: rowData.ogpDescription || rowData['OGP説明文'] || '',
      ogpImage: rowData.ogpImage || rowData['OGP画像'] || '',
      // 動画ボタン設定
      showVideoButton: rowData.showVideoButton || rowData['動画ボタン表示'] || '',
      videoUrl: rowData.videoUrl || rowData['動画URL'] || '',
      // 新形式v2 LP構成データ
      lpContent: rowData.lpContent || rowData['LP構成'] || ''
    };
  }

  /**
   * プレビューモード時にsessionStorageから編集中のデータを読み込む
   */
  loadPreviewSettings(jobId, baseSettings) {
    // previewパラメータがない場合はそのまま返す
    if (!hasUrlParam('preview')) {
      return baseSettings;
    }

    const previewKey = `lp_preview_${jobId}`;
    const previewDataStr = sessionStorage.getItem(previewKey);

    if (!previewDataStr) {
      console.log('[LP] プレビューデータが見つかりません');
      return baseSettings;
    }

    try {
      const previewData = JSON.parse(previewDataStr);

      // 5分以上前のデータは無効とする
      const maxAge = 5 * 60 * 1000; // 5分
      if (Date.now() - previewData.timestamp > maxAge) {
        console.log('[LP] プレビューデータが古いため破棄');
        sessionStorage.removeItem(previewKey);
        return baseSettings;
      }

      console.log('[LP] プレビューモード: 編集中のデータを使用', previewData.lpSettings);

      // プレビューバナーを表示
      this.showPreviewBanner();

      // 使用後は削除しない（同じタブでリロードしても表示できるように）
      return previewData.lpSettings;
    } catch (e) {
      console.error('[LP] プレビューデータの読み込みエラー:', e);
      return baseSettings;
    }
  }

  /**
   * プレビューモードのバナーを表示
   */
  showPreviewBanner() {
    const banner = document.createElement('div');
    banner.className = 'lp-preview-banner';
    banner.innerHTML = `
      <span>プレビューモード - 保存されていない変更を表示中</span>
      <button type="button" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
  }

  /**
   * 共通レイアウトコンポーネント（ヘッダー・フッター・CTAバー）を描画
   */
  renderLayoutComponents(contentEl) {
    const rs = this.recruitSettings || {};
    // layoutStyleとdesignPatternを同期（layoutStyleを主として使用）
    const layoutStyle = this.lpSettings?.layoutStyle || 'modern';
    const designPattern = layoutStyle;
    const companyDomain = this.company?.companyDomain || '';

    // ロゴまたは会社名がある場合のみヘッダーを追加
    const hasHeader = !!(rs.logoUrl || rs.companyNameDisplay);
    const hasCtaBar = !!(rs.phoneNumber || rs.ctaButtonText);

    // bodyにクラスを追加（ヘッダー・CTAバーのスペース確保用）
    if (hasHeader) {
      document.body.classList.add('has-fixed-header');
      // 会社設定のヘッダーがある場合、動的ヘッダーを使用（デフォルトはCSS非表示のまま）
    } else {
      // 会社設定がない場合、デフォルトのLP静的ヘッダーを表示
      const defaultLpHeader = document.querySelector('.lp-header');
      if (defaultLpHeader) {
        defaultLpHeader.style.display = 'block';
      }
      document.body.classList.add('has-fixed-header');
    }
    if (hasCtaBar) {
      document.body.classList.add('has-fixed-cta-bar');
    }

    // レイアウトスタイルをbodyに設定
    document.body.setAttribute('data-layout-style', layoutStyle);

    // ヘッダーを追加（既存のヘッダーがない場合のみ）
    if (hasHeader && !document.querySelector('.site-header')) {
      const recruitPageUrl = `company-recruit.html?id=${encodeURIComponent(companyDomain)}`;
      const headerHtml = renderSiteHeader({
        logoUrl: rs.logoUrl || '',
        companyName: rs.companyNameDisplay || this.company?.company || '',
        recruitPageUrl: recruitPageUrl,
        showBackLink: true,
        designPattern: designPattern
      });
      document.body.insertAdjacentHTML('afterbegin', headerHtml);
    }

    // lp-footerの会社情報を更新（site-footerは使わない）
    const companyName = rs.companyNameDisplay || this.company?.company || '';
    const year = new Date().getFullYear();
    const lpFooter = document.querySelector('.lp-footer');
    if (lpFooter) {
      // コピーライトを会社名に更新
      const copyright = lpFooter.querySelector('.lp-footer-copyright');
      if (copyright && companyName) {
        copyright.innerHTML = `<small>&copy; ${year} ${companyName} All Rights Reserved.</small>`;
      }
      // layoutStyleクラスを追加
      lpFooter.classList.add(`lp-layout-${layoutStyle}`);
    }

    // CTAバーを追加
    if (hasCtaBar) {
      const ctaBarHtml = renderFixedCtaBar({
        phoneNumber: rs.phoneNumber || '',
        ctaButtonText: rs.ctaButtonText || '今すぐ応募する',
        ctaUrl: '#apply',
        designPattern: designPattern
      });
      document.body.insertAdjacentHTML('beforeend', ctaBarHtml);
    }
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

    // 応募ボタンクリック（モーダルを表示）
    document.querySelectorAll('.lp-btn-apply-hero, .lp-btn-apply-main, .lp-btn-apply-footer, .lp-btn-apply-header, .lp-hero-cta-btn--apply').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();

        const buttonLocation = btn.classList.contains('lp-btn-apply-hero') ? 'hero' :
                              btn.classList.contains('lp-hero-cta-btn--apply') ? 'hero_cta' :
                              btn.classList.contains('lp-btn-apply-main') ? 'main' :
                              btn.classList.contains('lp-btn-apply-header') ? 'header' : 'footer';

        // GA4トラッキング
        trackEvent('lp_apply_click', {
          company_domain: company.companyDomain,
          company_name: company.company,
          button_location: buttonLocation,
          ...this.utmParams
        });

        // 応募モーダルを表示
        const jobData = {
          company_domain: company.companyDomain,
          company_name: company.company,
          job_id: this.mainJob?.id || this.mainJob?.jobId || this.jobId || '',
          job_title: this.mainJob?.title || ''
        };
        this.showApplyModal(jobData);
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

  /**
   * フッターリンクを採用サイトへ更新
   */
  updateFooterLinks() {
    const footerLinks = document.querySelector('.lp-footer-links');
    const companyDomain = this.company?.companyDomain;
    if (!footerLinks || !companyDomain) return;

    const recruitUrl = `company-recruit.html?id=${encodeURIComponent(companyDomain)}`;

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

  updateSEO(company, jobs, lpSettings = {}) {
    // OGP設定があればそちらを優先
    const ogpTitle = lpSettings.ogpTitle || lpSettings.heroTitle || '';
    const ogpDescription = lpSettings.ogpDescription || '';
    const ogpImage = lpSettings.ogpImage || lpSettings.heroImage || '';

    const title = ogpTitle
      ? `${ogpTitle} | ${company.company}`
      : `${company.company} 求人情報 | L-SET`;
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
    // 初回訪問とUTMパラメータを永続化（First-touch attribution用）
    initTracking();

    const urlParams = new URLSearchParams(window.location.search);

    UTM_PARAMS.forEach(param => {
      const value = urlParams.get(param);
      if (value) {
        this.utmParams[param] = value;
      }
    });

    // セッションストレージのキー（jobId優先、なければcompanyDomain）
    const storageKey = this.jobId ? `utm_params_job_${this.jobId}` : `utm_params_${this.companyDomain}`;

    // セッションストレージに保存（応募時に参照するため）
    if (Object.keys(this.utmParams).length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(this.utmParams));
      console.log('[LP] UTM params captured:', this.utmParams);
    } else {
      // 保存済みのUTMパラメータがあれば復元
      const saved = sessionStorage.getItem(storageKey);
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

    // Meta Pixel (Facebook/Instagram)
    if (lpSettings.metaPixelId) {
      this.initMetaPixel(lpSettings.metaPixelId);
    }

    // LINE Tag
    if (lpSettings.lineTagId) {
      this.initLineTag(lpSettings.lineTagId);
    }

    // Microsoft Clarity
    if (lpSettings.clarityProjectId) {
      this.initClarity(lpSettings.clarityProjectId);
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

  // Meta Pixel (Facebook/Instagram)を初期化
  initMetaPixel(pixelId) {
    if (!pixelId || window.fbq) return;

    // Meta Pixel Base Code
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');

    console.log('[LP] Meta Pixel initialized:', pixelId);
  }

  // LINE Tagを初期化
  initLineTag(tagId) {
    if (!tagId || window._lt) return;

    // LINE Tag Base Code
    !function(g,d,o){
      g._ltq=g._ltq||[];g._lt=g._lt||function(){g._ltq.push(arguments)};
      var h=d.getElementsByTagName("head")[0],s=d.createElement("script");
      s.async=1;s.src=o;h.appendChild(s);
    }(window,document,"https://s.yjtag.jp/tag.js");

    window._lt('init', {
      customerType: 'lap',
      tagId: tagId
    });
    window._lt('send', 'pv', [tagId]);

    console.log('[LP] LINE Tag initialized:', tagId);
  }

  // Microsoft Clarityを初期化
  initClarity(projectId) {
    if (!projectId || window.clarity) return;

    // Microsoft Clarity Base Code
    !function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    }(window,document,"clarity","script",projectId);

    console.log('[LP] Microsoft Clarity initialized:', projectId);
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

    // Meta Pixel コンバージョン
    if (window.fbq) {
      // eventTypeに応じてMeta Pixelの標準イベントにマッピング
      const metaEventMap = {
        'SubmitForm': 'Lead',
        'Contact': 'Contact'
      };
      const metaEvent = metaEventMap[eventType] || eventType;
      window.fbq('track', metaEvent, eventData);
      console.log('[LP] Meta Pixel event tracked:', metaEvent, eventData);
    }

    // LINE Tag コンバージョン
    if (window._lt && this.lpSettings?.lineTagId) {
      window._lt('send', 'cv', {
        type: eventType === 'SubmitForm' ? 'Conversion' : eventType
      }, [this.lpSettings.lineTagId]);
      console.log('[LP] LINE Tag conversion tracked:', eventType);
    }
  }

  trackPageView(company) {
    trackEvent('lp_view', {
      company_domain: company.companyDomain,
      company_name: company.company,
      ...this.utmParams
    });

    // Firestoreへの独立したページアナリティクス
    initPageTracking({
      pageType: 'lp',
      companyDomain: company.companyDomain,
      jobId: this.mainJob?.id || this.mainJob?.jobId || null,
      companyName: company.company,
      jobTitle: this.mainJob?.title || null
    });

    // TikTok Pixel PageView（初期化時に既にpage()が呼ばれているが、追加情報付きで再送信）
    if (window.ttq) {
      window.ttq.track('ViewContent', {
        content_name: company.company,
        content_category: 'company_lp'
      });
    }

    // Meta Pixel ViewContent（初期化時にPageViewは送信済み、追加情報付きで再送信）
    if (window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: company.company,
        content_category: 'company_lp'
      });
    }
  }

  // CTAボタンクリックのトラッキング（外部から呼び出し可能）
  trackCTAButtonClick(buttonType, buttonText = null) {
    trackCTAClick({
      pageType: 'lp',
      companyDomain: this.company?.companyDomain,
      buttonType,
      jobId: this.mainJob?.id || this.mainJob?.jobId || null,
      buttonText
    });
  }

  // ========================================
  // 応募モーダル機能
  // ========================================

  // Firebase Firestoreを初期化
  initFirestore() {
    if (typeof firebase === 'undefined') {
      console.warn('[Firestore] Firebase not loaded');
      return false;
    }

    const firebaseConfig = {
      apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
      authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
      projectId: "generated-area-484613-e3-90bd4"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    window.firebaseDb = firebase.firestore();
    return true;
  }

  // 生年月日から年齢を計算
  calculateAge(birthdate) {
    if (!birthdate) return '';
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  // 応募モーダルを表示
  showApplyModal(jobData) {
    this.currentJobData = jobData;
    const modal = document.getElementById('apply-modal');
    if (!modal) return;

    // 求人情報を設定
    const jobInfo = document.getElementById('apply-job-info');
    if (jobInfo) {
      jobInfo.textContent = `${jobData.company_name} - ${jobData.job_title}`;
    }

    // フォームをリセット
    const form = document.getElementById('apply-form');
    if (form) {
      form.reset();
    }

    // 直接フォームを表示
    this.showApplyStep('form');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // 応募モーダルを閉じる
  hideApplyModal() {
    const modal = document.getElementById('apply-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    document.body.style.overflow = '';
    this.currentJobData = null;
  }

  // 応募ステップを表示
  showApplyStep(step) {
    const steps = ['form', 'complete'];
    steps.forEach(s => {
      const el = document.getElementById(`apply-step-${s}`);
      if (el) {
        el.style.display = s === step ? 'block' : 'none';
      }
    });
  }

  // エラーメッセージを表示
  showFormError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  // エラーメッセージを非表示
  hideFormError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.style.display = 'none';
    }
  }

  // 応募モーダルのイベントを設定
  setupApplyModal() {
    this.initFirestore();
    this.currentJobData = null;

    const modal = document.getElementById('apply-modal');
    if (!modal) return;

    // 閉じるボタン
    modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.hideApplyModal());
    });

    // 背景クリックで閉じる
    modal.querySelector('.modal-backdrop')?.addEventListener('click', () => this.hideApplyModal());

    // 応募フォーム送信
    document.getElementById('apply-form')?.addEventListener('submit', (e) => this.handleApplySubmit(e));
  }

  // Firestoreに応募データを保存
  async saveApplicationToFirestore(data) {
    try {
      if (!window.firebaseDb) {
        console.warn('[Application] Firestore not initialized');
        return null;
      }

      // トラッキングデータを取得（UTM、初回訪問日時、LPデザインパターン）
      const lpDesignPattern = this.lpSettings?.designPattern || 'standard';
      const trackingData = getTrackingDataForApplication(lpDesignPattern);

      const applicationData = {
        companyDomain: data.company_domain,
        companyName: data.company_name,
        jobId: data.job_id,
        jobTitle: data.job_title,
        applicantName: data.name,
        applicantNameKana: data.nameKana,
        applicantBirthdate: data.birthdate,
        applicantAge: data.age,
        applicantGender: data.gender || '',
        applicantPhone: data.phone,
        applicantEmail: data.email,
        applicantAddress: data.address,
        applicantMessage: data.message || '',
        userId: null,
        status: 'new',
        type: 'apply',
        source: document.referrer || 'direct',
        userAgent: navigator.userAgent,
        timestamp: new Date(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),

        // トラッキングデータ（広告効果測定用）
        utm_source: trackingData.utm_source,
        utm_medium: trackingData.utm_medium,
        utm_campaign: trackingData.utm_campaign,
        utm_content: trackingData.utm_content,
        utm_term: trackingData.utm_term,
        landingPage: trackingData.landingPage,
        lpDesignPattern: trackingData.lpDesignPattern,
        firstVisitAt: trackingData.firstVisitAt,
        daysToConversion: trackingData.daysToConversion
      };

      const docRef = await window.firebaseDb.collection('applications').add(applicationData);
      console.log('[Application] Saved to Firestore:', docRef.id);
      console.log('[Application] Tracking data:', {
        utm_source: trackingData.utm_source,
        utm_medium: trackingData.utm_medium,
        utm_campaign: trackingData.utm_campaign,
        daysToConversion: trackingData.daysToConversion
      });
      return docRef.id;
    } catch (error) {
      console.error('[Application] Failed to save:', error);
      return null;
    }
  }

  // 応募フォーム送信処理
  async handleApplySubmit(e) {
    e.preventDefault();

    const name = document.getElementById('apply-name')?.value?.trim();
    const nameKana = document.getElementById('apply-name-kana')?.value?.trim();
    const birthdate = document.getElementById('apply-birthdate')?.value;
    const gender = document.getElementById('apply-gender')?.value;
    const phone = document.getElementById('apply-phone')?.value?.trim();
    const email = document.getElementById('apply-email')?.value?.trim();
    const address = document.getElementById('apply-address')?.value?.trim();
    const message = document.getElementById('apply-message')?.value?.trim();

    this.hideFormError('apply-form-error');

    // 必須項目のバリデーション
    if (!name || !nameKana || !birthdate || !phone || !email || !address) {
      this.showFormError('apply-form-error', '必須項目を入力してください');
      return;
    }

    if (!this.currentJobData) {
      this.showFormError('apply-form-error', 'エラーが発生しました。再度お試しください');
      return;
    }

    // 年齢を計算
    const age = this.calculateAge(birthdate);

    try {
      // 応募データを保存
      const applicationId = await this.saveApplicationToFirestore({
        ...this.currentJobData,
        name,
        nameKana,
        birthdate,
        age,
        gender,
        phone,
        email,
        address,
        message
      });

      if (!applicationId) {
        throw new Error('Failed to save application');
      }

      // 会社ユーザー向け応募通知を作成
      try {
        await createApplicationNotification({
          companyDomain: this.currentJobData.company_domain,
          applicationId: applicationId,
          jobId: this.currentJobData.job_id,
          jobTitle: this.currentJobData.job_title,
          applicantName: name,
          applicantEmail: email
        });
        console.log('[Application] Notification created for company:', this.currentJobData.company_domain);
      } catch (notifError) {
        // 通知作成に失敗しても応募自体は成功とする
        console.warn('[Application] Failed to create notification:', notifError);
      }

      // GA4にイベント送信
      trackEvent('submit_application', this.currentJobData);

      // 広告コンバージョントラッキング
      this.trackConversion('SubmitForm', {
        content_name: this.currentJobData.company_name,
        content_category: 'job_application',
        ...this.utmParams
      });

      // 完了画面を表示
      this.showApplyStep('complete');

    } catch (error) {
      console.error('[Apply] Submit error:', error);
      this.showFormError('apply-form-error', '応募の送信に失敗しました。もう一度お試しください');
    }
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  const page = new CompanyLPPage();
  page.init();
});

export default CompanyLPPage;
