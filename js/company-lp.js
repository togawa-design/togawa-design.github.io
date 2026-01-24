/**
 * 会社専用LP（ランディングページ）
 * URLパターン: /lp.html?c=aisin または /aisin (要htaccess設定)
 */

const CompanyLP = {
  // 設定
  config: {
    // デザインパターン定義
    patterns: {
      standard: {
        name: 'スタンダード',
        heroStyle: 'gradient',
        accentColor: '#6366f1'
      },
      modern: {
        name: 'モダン',
        heroStyle: 'image-overlay',
        accentColor: '#3b82f6'
      },
      classic: {
        name: 'クラシック',
        heroStyle: 'solid',
        accentColor: '#dc2626'
      },
      minimal: {
        name: 'ミニマル',
        heroStyle: 'white',
        accentColor: '#1f2937'
      },
      colorful: {
        name: 'カラフル',
        heroStyle: 'gradient-multi',
        accentColor: '#f59e0b'
      }
    }
  },

  // 編集モードの状態
  isEditMode: false,
  editedData: {},
  currentCompanyDomain: null,

  // 初期化
  async init() {
    const companyDomain = this.getCompanyDomain();
    this.currentCompanyDomain = companyDomain;

    // 編集モードの確認
    const params = new URLSearchParams(window.location.search);
    this.isEditMode = params.has('edit');

    if (!companyDomain) {
      this.showError('会社が指定されていません。');
      return;
    }

    try {
      // 会社情報を取得
      const companies = await JobsLoader.fetchCompanies();
      const company = companies?.find(c =>
        c.companyDomain?.trim() === companyDomain &&
        JobsLoader.isCompanyVisible(c)
      );

      if (!company) {
        this.showError('指定された会社は見つかりませんでした。');
        return;
      }

      // 求人データを取得
      let jobs = [];
      if (company.jobsSheet?.trim()) {
        const companyJobs = await JobsLoader.fetchCompanyJobs(company.jobsSheet.trim());
        if (companyJobs?.length > 0) {
          jobs = companyJobs
            .filter(j => j.visible !== 'false' && j.visible !== 'FALSE')
            .filter(j => JobsLoader.isJobInPublishPeriod(j))
            .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
            .map(j => ({
              ...j,
              company: company.company,
              companyDomain: company.companyDomain
            }));
        }
      }

      // LP設定を取得（スプレッドシートまたはFirestoreから）
      const lpSettings = await this.fetchLPSettings(companyDomain) || {};

      // LPを描画
      this.renderLP(company, jobs, lpSettings);

      // 編集モードの場合、編集機能を有効化
      if (this.isEditMode) {
        this.enableEditMode(lpSettings);
      }

      // SEOを更新
      this.updateSEO(company, jobs);

      // アナリティクスを送信（編集モードでない場合のみ）
      if (!this.isEditMode) {
        this.trackPageView(company);
      }

    } catch (error) {
      console.error('LP読み込みエラー:', error);
      this.showError('ページの読み込みに失敗しました。');
    }
  },

  // URLから会社ドメインを取得
  getCompanyDomain() {
    const params = new URLSearchParams(window.location.search);
    // ?c=aisin または ?id=aisin の形式をサポート
    return params.get('c') || params.get('id') || null;
  },

  // LP設定を取得（将来的にはFirestoreから取得）
  async fetchLPSettings(companyDomain) {
    // 現時点ではスプレッドシートのLP設定シートから取得を試みる
    // または会社データのlpSettingsカラムから取得
    try {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${JobsLoader.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=LP設定`;
      const response = await fetch(sheetUrl);
      if (!response.ok) return null;

      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = JobsLoader.parseCSVLine(lines[0] || '');

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = JobsLoader.parseCSVLine(lines[i]);
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
            designPattern: rowData.designPattern || rowData['デザインパターン'] || 'standard'
          };
        }
      }
    } catch (e) {
      console.log('LP設定シートが見つかりません（デフォルト設定を使用）');
    }
    return null;
  },

  // LPを描画
  renderLP(company, jobs, lpSettings) {
    const loadingEl = document.getElementById('lp-loading');
    const contentEl = document.getElementById('lp-content');

    if (loadingEl) loadingEl.style.display = 'none';
    if (!contentEl) return;

    const pattern = lpSettings.designPattern || company.designPattern || 'standard';
    const patternClass = `lp-pattern-${pattern}`;

    // ボディにパターンクラスを追加
    document.body.classList.add(patternClass);

    // メインの求人情報（最初の求人または会社情報）
    const mainJob = jobs.length > 0 ? jobs[0] : company;

    contentEl.innerHTML = `
      ${this.renderHeroSection(company, mainJob, lpSettings)}
      ${this.renderPointsSection(company, mainJob, lpSettings)}
      ${this.renderJobsSection(company, jobs)}
      ${this.renderDetailsSection(company, mainJob)}
      ${lpSettings.faq ? this.renderFAQSection(lpSettings.faq) : ''}
      ${this.renderApplySection(company, lpSettings)}
    `;

    // イベントリスナーを設定
    this.setupEventListeners(company);
  },

  // ヒーローセクション
  renderHeroSection(company, mainJob, lpSettings) {
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
        <div class="lp-hero-bg lp-editable-image" data-field="heroImage" data-label="ヒーロー画像" style="${heroImage ? `background-image: url('${this.escapeHtml(heroImage)}')` : ''}"></div>
        <div class="lp-hero-overlay"></div>
        <div class="lp-hero-content">
          <p class="lp-hero-company">${this.escapeHtml(company.company)}</p>
          <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${this.escapeHtml(heroTitle)}</h1>
          ${heroSubtitle ? `<p class="lp-hero-subtitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${this.escapeHtml(heroSubtitle)}</p>` : `<p class="lp-hero-subtitle lp-editable lp-placeholder" data-field="heroSubtitle" data-label="サブタイトル">サブタイトルを追加</p>`}

          ${highlights.length > 0 ? `
          <div class="lp-hero-highlights">
            ${highlights.map(h => `
              <div class="lp-highlight-item ${h.icon}">
                <span class="lp-highlight-label">${this.escapeHtml(h.label)}</span>
                <span class="lp-highlight-value">${this.escapeHtml(h.value)}</span>
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
  },

  // ポイントセクション
  renderPointsSection(company, mainJob, lpSettings) {
    const points = [];

    // LP設定からポイントを取得
    if (lpSettings.pointTitle1) {
      points.push({ title: lpSettings.pointTitle1, desc: lpSettings.pointDesc1 || '', idx: 1 });
    }
    if (lpSettings.pointTitle2) {
      points.push({ title: lpSettings.pointTitle2, desc: lpSettings.pointDesc2 || '', idx: 2 });
    }
    if (lpSettings.pointTitle3) {
      points.push({ title: lpSettings.pointTitle3, desc: lpSettings.pointDesc3 || '', idx: 3 });
    }

    // ポイントがない場合はデフォルトを生成
    if (points.length === 0) {
      if (mainJob.totalBonus) {
        points.push({ title: '入社特典', desc: `特典総額${mainJob.totalBonus}！入社祝い金やその他特典が充実。`, idx: 1 });
      }
      if (mainJob.monthlySalary) {
        points.push({ title: '高収入', desc: `月収例${mainJob.monthlySalary}可能！安定した収入を実現。`, idx: 2 });
      }
      if (mainJob.benefits) {
        points.push({ title: '充実の待遇', desc: '社会保険完備、寮完備など福利厚生が充実。', idx: 3 });
      }
    }

    if (points.length === 0) return '';

    return `
      <section class="lp-points">
        <div class="lp-section-inner">
          <h2 class="lp-section-title">この求人のポイント</h2>
          <div class="lp-points-grid">
            ${points.map((point, displayIdx) => `
              <div class="lp-point-card">
                <div class="lp-point-number">${displayIdx + 1}</div>
                <h3 class="lp-point-title lp-editable" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">${this.escapeHtml(point.title)}</h3>
                <p class="lp-point-desc lp-editable" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${this.escapeHtml(point.desc)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  },

  // 求人一覧セクション
  renderJobsSection(company, jobs) {
    if (jobs.length === 0) return '';

    return `
      <section class="lp-jobs">
        <div class="lp-section-inner">
          <h2 class="lp-section-title">募集中の求人</h2>
          <div class="lp-jobs-list">
            ${jobs.map(job => `
              <div class="lp-job-card">
                <div class="lp-job-card-header">
                  <h3 class="lp-job-title">${this.escapeHtml(job.title)}</h3>
                  ${job.employmentType ? `<span class="lp-job-type">${this.escapeHtml(job.employmentType)}</span>` : ''}
                </div>
                <div class="lp-job-card-body">
                  <ul class="lp-job-info">
                    <li>
                      <span class="lp-info-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      </span>
                      ${this.escapeHtml(job.location)}
                    </li>
                    ${job.monthlySalary ? `
                    <li>
                      <span class="lp-info-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                      </span>
                      ${this.escapeHtml(job.monthlySalary)}
                    </li>
                    ` : ''}
                    ${job.totalBonus ? `
                    <li class="highlight">
                      <span class="lp-info-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>
                      </span>
                      特典総額 ${this.escapeHtml(job.totalBonus)}
                    </li>
                    ` : ''}
                  </ul>
                  ${job.features?.length > 0 ? `
                  <div class="lp-job-tags">
                    ${(Array.isArray(job.features) ? job.features : job.features.split(',')).slice(0, 5).map(f =>
                      `<span class="lp-job-tag">${this.escapeHtml(f.trim())}</span>`
                    ).join('')}
                  </div>
                  ` : ''}
                </div>
                <div class="lp-job-card-footer">
                  <a href="job-detail.html?company=${this.escapeHtml(job.companyDomain || company.companyDomain)}&job=${this.escapeHtml(job.id || '')}" class="lp-btn-detail">詳細を見る</a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  },

  // 詳細セクション（募集要項）
  // 会社一覧シートの「説明」「お仕事内容」「勤務時間」を優先して表示
  renderDetailsSection(company, mainJob) {
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

    // 会社一覧シートの「勤務地」（workLocation）- 実際に働く場所
    if (company.workLocation) {
      details.push({ label: '勤務地', value: company.workLocation, isHtml: true });
    }

    // 求人データからの補足情報（会社データにない場合のみ）
    if (!company.jobDescription && mainJob.jobDescription) {
      details.push({ label: '仕事内容', value: mainJob.jobDescription, isHtml: false });
    }
    if (mainJob.salary) {
      details.push({ label: '給与', value: mainJob.salary, isHtml: false });
    }
    if (!company.workingHours && mainJob.workingHours) {
      details.push({ label: '勤務時間', value: mainJob.workingHours, isHtml: false });
    }
    if (mainJob.holidays) {
      details.push({ label: '休日・休暇', value: mainJob.holidays, isHtml: false });
    }
    if (mainJob.benefits) {
      details.push({ label: '待遇・福利厚生', value: mainJob.benefits, isHtml: false });
    }
    // 会社データに勤務地がない場合のみ求人データの勤務地を表示
    if (!company.workLocation && mainJob.location) {
      details.push({ label: '勤務地', value: mainJob.location, isHtml: false });
    }

    if (details.length === 0) return '';

    return `
      <section class="lp-details">
        <div class="lp-section-inner">
          <h2 class="lp-section-title">募集要項</h2>
          <div class="lp-details-table">
            ${details.map(d => `
              <div class="lp-detail-row">
                <div class="lp-detail-label">${this.escapeHtml(d.label)}</div>
                <div class="lp-detail-value">${d.isHtml ? this.sanitizeHtml(d.value) : this.escapeHtml(d.value).replace(/\n/g, '<br>')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  },

  // FAQセクション
  renderFAQSection(faqText) {
    // FAQ形式: Q:質問1|A:回答1||Q:質問2|A:回答2
    const faqs = faqText.split('||').map(item => {
      const parts = item.split('|');
      const q = parts.find(p => p.startsWith('Q:'))?.replace('Q:', '').trim() || '';
      const a = parts.find(p => p.startsWith('A:'))?.replace('A:', '').trim() || '';
      return { q, a };
    }).filter(f => f.q && f.a);

    if (faqs.length === 0) return '';

    return `
      <section class="lp-faq">
        <div class="lp-section-inner">
          <h2 class="lp-section-title">よくある質問</h2>
          <div class="lp-faq-list">
            ${faqs.map(faq => `
              <div class="lp-faq-item">
                <div class="lp-faq-question">
                  <span class="lp-faq-icon">Q</span>
                  <span>${this.escapeHtml(faq.q)}</span>
                </div>
                <div class="lp-faq-answer">
                  <span class="lp-faq-icon">A</span>
                  <span>${this.escapeHtml(faq.a)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  },

  // 応募セクション
  renderApplySection(company, lpSettings) {
    const ctaText = lpSettings.ctaText || '今すぐ応募する';

    return `
      <section class="lp-apply" id="lp-apply">
        <div class="lp-section-inner">
          <h2 class="lp-apply-title">まずはお気軽にご応募ください</h2>
          <p class="lp-apply-text">経験・学歴不問！${company.company}であなたのご応募をお待ちしています。</p>
          <div class="lp-apply-buttons">
            <a href="#" class="lp-btn-apply-main lp-editable-btn" data-company="${this.escapeHtml(company.companyDomain)}" data-field="ctaText" data-label="応募ボタンテキスト">${this.escapeHtml(ctaText)}</a>
            <a href="tel:0120-000-000" class="lp-btn-tel-main">
              <span class="tel-number">0120-000-000</span>
              <span class="tel-note">（平日9:00〜18:00）</span>
            </a>
          </div>
          <div class="lp-apply-line">
            <p>LINEでも相談受付中！</p>
            <a href="#" class="lp-btn-line">LINEで相談する</a>
          </div>
        </div>
      </section>
    `;
  },

  // SEOを更新
  updateSEO(company, jobs) {
    const mainJob = jobs.length > 0 ? jobs[0] : company;

    document.title = `${company.company}の求人 | リクエコ求人ナビ`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const desc = mainJob.totalBonus
        ? `${company.company}の期間工・期間従業員募集。特典総額${mainJob.totalBonus}。${jobs.length}件の求人を掲載中。`
        : `${company.company}の期間工・期間従業員募集。${jobs.length}件の求人を掲載中。`;
      metaDesc.content = desc;
    }

    // OGP更新
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `${company.company}の求人 | リクエコ求人ナビ`;

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = metaDesc?.content || '';
  },

  // イベントリスナーを設定
  setupEventListeners(company) {
    // 応募ボタンのクリックトラッキング
    document.querySelectorAll('.lp-btn-apply-main, .lp-btn-apply-hero, .lp-btn-apply-header, .lp-btn-apply-footer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.trackApplyClick(company, 'apply');
        // TODO: 応募フォームへの遷移またはモーダル表示
        alert('応募フォームは準備中です。お電話またはLINEからお問い合わせください。');
      });
    });

    // 電話ボタンのクリックトラッキング
    document.querySelectorAll('.lp-btn-tel-main, .lp-btn-tel-header, .lp-btn-tel-footer').forEach(btn => {
      btn.addEventListener('click', () => {
        this.trackApplyClick(company, 'tel');
      });
    });

    // LINEボタンのクリックトラッキング
    document.querySelectorAll('.lp-btn-line').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.trackApplyClick(company, 'line');
        // TODO: LINE友だち追加へ
        alert('LINE相談は準備中です。お電話からお問い合わせください。');
      });
    });

    // スムーススクロール
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#' || targetId === '#lp-apply') {
          e.preventDefault();
          const target = document.getElementById('lp-apply');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  },

  // ページビュートラッキング
  trackPageView(company) {
    if (typeof JobsLoader !== 'undefined' && JobsLoader.trackEvent) {
      JobsLoader.trackEvent('view_company_lp', {
        company_domain: company.companyDomain || '',
        company_name: company.company || '',
        design_pattern: company.designPattern || 'standard',
        page_location: window.location.href
      });
    }
  },

  // 応募クリックトラッキング
  trackApplyClick(company, buttonType) {
    if (typeof JobsLoader !== 'undefined' && JobsLoader.trackEvent) {
      JobsLoader.trackEvent('click_apply_lp', {
        company_domain: company.companyDomain || '',
        company_name: company.company || '',
        button_type: buttonType,
        page_location: window.location.href
      });
    }
  },

  // エラー表示
  showError(message) {
    const loadingEl = document.getElementById('lp-loading');
    const contentEl = document.getElementById('lp-content');

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="lp-error">
          <h2>エラー</h2>
          <p>${this.escapeHtml(message)}</p>
          <a href="/" class="lp-btn-back">トップページへ戻る</a>
        </div>
      `;
    }
  },

  // 編集モードを有効化
  enableEditMode(lpSettings) {
    // 編集データを初期化
    this.editedData = { ...lpSettings };

    // bodyに編集モードクラスを追加
    document.body.classList.add('lp-edit-mode');

    // 編集ツールバーを追加
    this.renderEditToolbar();

    // 編集可能要素にイベントを設定
    this.setupEditableElements();
  },

  // 編集ツールバーを描画
  renderEditToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'lp-edit-toolbar';
    toolbar.innerHTML = `
      <div class="lp-edit-toolbar-inner">
        <div class="lp-edit-toolbar-left">
          <span class="lp-edit-mode-badge">編集モード</span>
          <span class="lp-edit-hint">クリックして文字を編集できます</span>
        </div>
        <div class="lp-edit-toolbar-right">
          <button class="lp-edit-btn-cancel" id="lp-edit-cancel">キャンセル</button>
          <button class="lp-edit-btn-save" id="lp-edit-save">変更を保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(toolbar);

    // ツールバーのイベント
    document.getElementById('lp-edit-cancel')?.addEventListener('click', () => {
      if (confirm('変更を破棄してプレビューモードに戻りますか？')) {
        // editパラメータを削除してリロード
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');
        window.location.href = url.toString();
      }
    });

    document.getElementById('lp-edit-save')?.addEventListener('click', () => {
      this.saveEditedData();
    });
  },

  // 編集可能要素にイベントを設定
  setupEditableElements() {
    // テキスト編集可能要素
    const editables = document.querySelectorAll('.lp-editable, .lp-editable-btn');

    editables.forEach(el => {
      const field = el.dataset.field;
      const label = el.dataset.label || field;

      // ホバー時にラベルを表示
      el.addEventListener('mouseenter', () => {
        this.showEditLabel(el, label);
      });

      el.addEventListener('mouseleave', () => {
        this.hideEditLabel();
      });

      // クリックで編集モードに
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startEditing(el, field, label);
      });
    });

    // 画像編集可能要素
    const imageEditables = document.querySelectorAll('.lp-editable-image');

    imageEditables.forEach(el => {
      const field = el.dataset.field;
      const label = el.dataset.label || field;

      // ホバー時にラベルを表示
      el.addEventListener('mouseenter', () => {
        this.showEditLabel(el, label);
      });

      el.addEventListener('mouseleave', () => {
        this.hideEditLabel();
      });

      // クリックで画像編集モードに
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startImageEditing(el, field, label);
      });
    });
  },

  // 編集ラベルを表示
  showEditLabel(el, label) {
    this.hideEditLabel();

    const labelEl = document.createElement('div');
    labelEl.className = 'lp-edit-label';
    labelEl.textContent = `${label}を編集`;
    labelEl.id = 'lp-edit-label-tooltip';

    const rect = el.getBoundingClientRect();
    labelEl.style.position = 'fixed';
    labelEl.style.top = `${rect.top - 30}px`;
    labelEl.style.left = `${rect.left}px`;

    document.body.appendChild(labelEl);
  },

  // 編集ラベルを非表示
  hideEditLabel() {
    const existing = document.getElementById('lp-edit-label-tooltip');
    if (existing) existing.remove();
  },

  // 編集を開始
  startEditing(el, field, label) {
    // 既存の編集状態をクリア
    const existingEditor = document.querySelector('.lp-inline-editor');
    if (existingEditor) existingEditor.remove();

    // プレースホルダーの場合は空に
    const currentText = el.classList.contains('lp-placeholder') ? '' : el.textContent;

    // インライン編集UIを作成
    const editor = document.createElement('div');
    editor.className = 'lp-inline-editor';

    const isMultiline = field.includes('Desc');

    if (isMultiline) {
      editor.innerHTML = `
        <label class="lp-inline-editor-label">${this.escapeHtml(label)}</label>
        <textarea class="lp-inline-editor-textarea" rows="3">${this.escapeHtml(currentText)}</textarea>
        <div class="lp-inline-editor-actions">
          <button class="lp-inline-editor-cancel">キャンセル</button>
          <button class="lp-inline-editor-apply">適用</button>
        </div>
      `;
    } else {
      editor.innerHTML = `
        <label class="lp-inline-editor-label">${this.escapeHtml(label)}</label>
        <input type="text" class="lp-inline-editor-input" value="${this.escapeHtml(currentText)}">
        <div class="lp-inline-editor-actions">
          <button class="lp-inline-editor-cancel">キャンセル</button>
          <button class="lp-inline-editor-apply">適用</button>
        </div>
      `;
    }

    // 位置を設定
    const rect = el.getBoundingClientRect();
    editor.style.position = 'fixed';
    editor.style.top = `${Math.max(60, rect.top - 10)}px`;
    editor.style.left = `${Math.max(10, rect.left)}px`;
    editor.style.minWidth = `${Math.min(400, rect.width + 40)}px`;

    document.body.appendChild(editor);

    // フォーカス
    const input = editor.querySelector('input, textarea');
    input?.focus();
    input?.select();

    // イベント
    editor.querySelector('.lp-inline-editor-cancel')?.addEventListener('click', () => {
      editor.remove();
    });

    editor.querySelector('.lp-inline-editor-apply')?.addEventListener('click', () => {
      const newValue = input?.value || '';
      this.applyEdit(el, field, newValue);
      editor.remove();
    });

    // Enterで適用（input only）、Escapeでキャンセル
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !isMultiline) {
        const newValue = input?.value || '';
        this.applyEdit(el, field, newValue);
        editor.remove();
      } else if (e.key === 'Escape') {
        editor.remove();
      }
    });
  },

  // 画像編集を開始
  startImageEditing(el, field, label) {
    // 既存の編集状態をクリア
    const existingEditor = document.querySelector('.lp-inline-editor');
    if (existingEditor) existingEditor.remove();

    // 現在の画像URLを取得
    const bgImage = el.style.backgroundImage;
    const currentUrl = bgImage ? bgImage.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '') : '';

    // プリセット画像の定義
    const presetImages = [
      { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200', name: '工場1' },
      { url: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200', name: '工場2' },
      { url: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1200', name: '製造業' },
      { url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1200', name: '自動車' },
      { url: 'https://images.unsplash.com/photo-1567789884554-0b844b597180?w=1200', name: '倉庫' },
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200', name: 'ビル' }
    ];

    // インライン編集UIを作成
    const editor = document.createElement('div');
    editor.className = 'lp-inline-editor lp-image-editor';

    editor.innerHTML = `
      <label class="lp-inline-editor-label">${this.escapeHtml(label)}</label>
      <div class="lp-image-url-input">
        <input type="text" class="lp-inline-editor-input" placeholder="画像URLを入力..." value="${this.escapeHtml(currentUrl)}">
      </div>
      <div class="lp-image-presets">
        <p class="lp-image-presets-label">プリセット画像:</p>
        <div class="lp-image-presets-grid">
          ${presetImages.map(img => `
            <div class="lp-image-preset-item" data-url="${this.escapeHtml(img.url)}">
              <img src="${this.escapeHtml(img.url)}&h=80" alt="${this.escapeHtml(img.name)}">
              <span>${this.escapeHtml(img.name)}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="lp-inline-editor-actions">
        <button class="lp-inline-editor-cancel">キャンセル</button>
        <button class="lp-inline-editor-clear">画像を削除</button>
        <button class="lp-inline-editor-apply">適用</button>
      </div>
    `;

    // 位置を設定（画面中央）
    editor.style.position = 'fixed';
    editor.style.top = '50%';
    editor.style.left = '50%';
    editor.style.transform = 'translate(-50%, -50%)';
    editor.style.minWidth = '400px';
    editor.style.maxWidth = '500px';
    editor.style.zIndex = '10001';

    document.body.appendChild(editor);

    const input = editor.querySelector('input');

    // プリセット画像クリックイベント
    editor.querySelectorAll('.lp-image-preset-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        input.value = url;
        // プレビュー更新
        el.style.backgroundImage = `url('${url}')`;
      });
    });

    // イベント
    editor.querySelector('.lp-inline-editor-cancel')?.addEventListener('click', () => {
      // 元に戻す
      el.style.backgroundImage = currentUrl ? `url('${currentUrl}')` : '';
      editor.remove();
    });

    editor.querySelector('.lp-inline-editor-clear')?.addEventListener('click', () => {
      input.value = '';
      el.style.backgroundImage = '';
    });

    editor.querySelector('.lp-inline-editor-apply')?.addEventListener('click', () => {
      const newUrl = input?.value || '';
      this.applyImageEdit(el, field, newUrl);
      editor.remove();
    });

    // 入力時にプレビュー更新
    input?.addEventListener('input', () => {
      const url = input.value;
      if (url) {
        el.style.backgroundImage = `url('${url}')`;
      } else {
        el.style.backgroundImage = '';
      }
    });

    // Escapeでキャンセル
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const newUrl = input?.value || '';
        this.applyImageEdit(el, field, newUrl);
        editor.remove();
      } else if (e.key === 'Escape') {
        el.style.backgroundImage = currentUrl ? `url('${currentUrl}')` : '';
        editor.remove();
      }
    });

    input?.focus();
  },

  // 画像編集を適用
  applyImageEdit(el, field, url) {
    // 表示を更新
    if (url) {
      el.style.backgroundImage = `url('${url}')`;
    } else {
      el.style.backgroundImage = '';
    }

    // 編集データに保存
    this.editedData[field] = url;

    // 変更マークを追加
    el.classList.add('lp-edited');
  },

  // 編集を適用
  applyEdit(el, field, value) {
    // 表示を更新
    if (value) {
      el.textContent = value;
      el.classList.remove('lp-placeholder');
    } else {
      el.textContent = el.dataset.label + 'を追加';
      el.classList.add('lp-placeholder');
    }

    // 編集データに保存
    this.editedData[field] = value;

    // 変更マークを追加
    el.classList.add('lp-edited');
  },

  // 編集データを保存
  async saveEditedData() {
    const saveBtn = document.getElementById('lp-edit-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    try {
      const gasApiUrl = localStorage.getItem('gas_api_url');
      if (!gasApiUrl) {
        alert('GAS API URLが設定されていません。管理画面で設定してください。');
        return;
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveLPSettings',
        companyDomain: this.currentCompanyDomain,
        settings: this.editedData
      }))));

      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        alert('保存しました！');
        // editパラメータを削除してリロード
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('edit');
        window.location.href = newUrl.toString();
      } else {
        throw new Error(result.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました: ' + error.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '変更を保存';
      }
    }
  },

  // HTMLエスケープ
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // HTMLサニタイズ（許可するタグのみ残す）
  sanitizeHtml(html) {
    if (!html) return '';
    if (html === '<br>' || html === '<div><br></div>') return '';

    // 許可するタグ
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'p'];

    // 一時的なDOM要素を作成
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // 許可されていないタグを削除
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        // タグを削除してテキストのみ残す
        el.replaceWith(...el.childNodes);
      } else {
        // 許可されたタグでも属性は全て削除
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name);
        }
      }
    });

    return temp.innerHTML;
  }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  CompanyLP.init();
});
