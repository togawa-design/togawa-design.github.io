/**
 * LP描画機能
 * 旧形式（固定カラム）と新形式（v2.0 JSON）の両方に対応
 */
import {
  renderHeroSection,
  renderHeroCTASection,
  initVideoModal,
  renderPointsSection,
  renderJobsSection,
  renderDetailsSection,
  renderFAQSection,
  renderApplySection,
  renderCustomSection,
  renderGallerySection,
  renderTestimonialSection,
  renderCarouselSection,
  renderVideoSection,
  initCarousels
} from '@components/organisms/index.js';

export class LPRenderer {
  constructor() {
    // セクションレンダラーの登録
    this.sectionRenderers = {
      hero: renderHeroSection,
      heroCta: renderHeroCTASection,
      points: renderPointsSection,
      jobs: renderJobsSection,
      details: renderDetailsSection,
      faq: renderFAQSection,
      apply: renderApplySection,
      custom: renderCustomSection,
      gallery: renderGallerySection,
      testimonial: renderTestimonialSection,
      carousel: renderCarouselSection,
      video: renderVideoSection
    };

    this.defaultOrder = ['hero', 'heroCta', 'points', 'jobs', 'details', 'faq', 'apply'];
  }

  /**
   * LPを描画
   * @param {Object} company - 会社情報
   * @param {Array} jobs - 求人情報配列
   * @param {Object} lpSettings - LP設定
   * @param {HTMLElement} contentEl - 描画先要素
   */
  render(company, jobs, lpSettings, contentEl) {
    // レイアウトスタイルを適用（designPatternも同期）
    const layoutStyle = lpSettings.layoutStyle || 'modern';
    const layoutClass = `lp-layout-${layoutStyle}`;
    const patternClass = `lp-pattern-${layoutStyle}`;
    document.body.classList.add(patternClass);
    document.body.classList.add(layoutClass);
    if (contentEl) contentEl.classList.add(layoutClass);

    // メインの求人情報
    const mainJob = jobs.length > 0 ? jobs[0] : company;

    // v2形式をチェック
    const lpContent = this.parseLPContent(lpSettings);

    if (lpContent && lpContent.version === '2.0' && lpContent.sections?.length > 0) {
      // 新形式（v2）で描画（セクションがある場合のみ）
      this.renderV2Sections(lpContent, company, mainJob, jobs, lpSettings, contentEl);
    } else {
      // 旧形式で描画（後方互換性、またはv2でセクションが空の場合）
      this.renderLegacySections(company, mainJob, jobs, lpSettings, contentEl);
    }
  }

  /**
   * lpContentをパース
   * @param {Object} lpSettings - LP設定
   * @returns {Object|null} パースしたlpContent
   */
  parseLPContent(lpSettings) {
    if (!lpSettings.lpContent) return null;

    try {
      const parsed = typeof lpSettings.lpContent === 'string'
        ? JSON.parse(lpSettings.lpContent)
        : lpSettings.lpContent;

      // faqカラムがあれば、FAQセクションを最新データで同期
      if (parsed.version === '2.0' && lpSettings.faq) {
        const faqItems = this.parseLegacyFAQ(lpSettings.faq);
        const faqSection = parsed.sections?.find(s => s.type === 'faq');
        if (faqSection) {
          faqSection.data = faqSection.data || {};
          faqSection.data.items = faqItems;
          faqSection.visible = faqItems.length > 0;
        }
      }

      return parsed;
    } catch (e) {
      console.error('lpContent parse error:', e);
      return null;
    }
  }

  /**
   * FAQテキストを配列に変換
   * @param {string} faqString - FAQ文字列
   * @returns {Array} FAQアイテム配列
   */
  parseLegacyFAQ(faqString) {
    if (!faqString) return [];

    const items = [];

    // リテラルな\nを実際の改行に変換
    const normalizedString = faqString.replace(/\\n/g, '\n');

    // ||または改行で区切られた複数のQ&A
    const pairs = normalizedString.split(/\|\||[\n\r]+/).filter(p => p.trim());

    for (const pair of pairs) {
      // Q:とA:で分割
      const qMatch = pair.match(/Q[:：](.+?)(?=\|A[:：]|$)/i);
      const aMatch = pair.match(/A[:：](.+)/i);

      if (qMatch && aMatch) {
        items.push({
          id: `faq-${items.length + 1}`,
          question: qMatch[1].trim(),
          answer: aMatch[1].trim()
        });
      }
    }

    return items;
  }

  /**
   * v2形式でセクションを描画
   */
  renderV2Sections(lpContent, company, mainJob, jobs, lpSettings, contentEl) {
    let { sections, globalSettings } = lpContent;

    // heroCTAセクションが存在しない場合、heroの直後に追加
    const hasHeroCta = sections.some(s => s.type === 'heroCta');
    if (!hasHeroCta) {
      const heroIndex = sections.findIndex(s => s.type === 'hero');
      const heroCtaSection = {
        id: 'heroCta-auto',
        type: 'heroCta',
        order: heroIndex >= 0 ? sections[heroIndex].order + 0.5 : 0.5,
        visible: true,
        data: {}
      };
      sections = [...sections, heroCtaSection];
    }

    // 表示するセクションをフィルタリング＆ソート
    const visibleSections = sections
      .filter(s => s.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // コンテキストオブジェクト
    const context = {
      company,
      mainJob,
      jobs,
      globalSettings: globalSettings || {},
      lpSettings: lpSettings || {}
    };

    // 各セクションを描画
    contentEl.innerHTML = visibleSections
      .map(section => this.renderV2Section(section, context))
      .join('');

    // カルーセルの初期化
    initCarousels();

    // 動画モーダルの初期化
    initVideoModal();
  }

  /**
   * v2形式の単一セクションを描画
   */
  renderV2Section(section, context) {
    const renderer = this.sectionRenderers[section.type];

    if (!renderer) {
      console.warn(`Unknown section type: ${section.type}`);
      return '';
    }

    try {
      switch (section.type) {
        case 'hero':
          return renderer(context.company, context.mainJob, {
            heroTitle: section.data?.title,
            heroSubtitle: section.data?.subtitle,
            heroImage: section.data?.image,
            ...context.globalSettings
          });

        case 'heroCta':
          // section.dataとlpSettingsの両方から動画ボタン設定を取得
          const showVideo = section.data?.showVideoButton ||
            String(context.lpSettings?.showVideoButton).toLowerCase() === 'true' ||
            context.lpSettings?.showVideoButton === true;
          const heroCtaData = {
            showVideoButton: showVideo,
            videoUrl: section.data?.videoUrl || context.lpSettings?.videoUrl || '',
            applyButtonText: section.data?.applyButtonText || context.lpSettings?.ctaText || '今すぐ応募する',
            videoButtonText: section.data?.videoButtonText || '求人内容を動画で見る'
          };
          return renderer(heroCtaData, context.globalSettings?.layoutStyle || 'modern');

        case 'points':
          const pointsLpSettings = this.convertPointsToLegacy(section.data, context.globalSettings);
          return renderer(context.company, context.mainJob, pointsLpSettings);

        case 'jobs':
          return renderer(context.company, context.jobs);

        case 'details':
          return renderer(context.company, context.mainJob);

        case 'faq':
          const faqString = this.convertFAQToLegacy(section.data?.items);
          return faqString ? renderer(faqString) : '';

        case 'apply':
          return renderer(context.company, context.globalSettings);

        case 'custom':
        case 'gallery':
        case 'testimonial':
        case 'carousel':
        case 'video':
          return renderer(section, context);

        default:
          return '';
      }
    } catch (e) {
      console.error(`Error rendering section ${section.type}:`, e);
      return '';
    }
  }

  /**
   * v2形式のポイントデータを旧形式に変換
   */
  convertPointsToLegacy(pointsData, globalSettings) {
    const lpSettings = { ...globalSettings };

    if (pointsData?.points) {
      pointsData.points.forEach((point, idx) => {
        lpSettings[`pointTitle${idx + 1}`] = point.title || '';
        lpSettings[`pointDesc${idx + 1}`] = point.description || '';
      });
    }

    return lpSettings;
  }

  /**
   * v2形式のFAQデータを旧形式に変換
   */
  convertFAQToLegacy(faqItems) {
    if (!faqItems || faqItems.length === 0) return '';

    return faqItems
      .map(item => `Q:${item.question}|A:${item.answer}`)
      .join('||');
  }

  /**
   * 旧形式でセクションを描画（後方互換性）
   */
  renderLegacySections(company, mainJob, jobs, lpSettings, contentEl) {
    const sectionVisibility = this.parseSectionVisibility(lpSettings.sectionVisibility);
    const sectionOrder = this.parseSectionOrder(lpSettings.sectionOrder);
    const layoutStyle = lpSettings.layoutStyle || 'modern';

    contentEl.innerHTML = sectionOrder
      .map(sectionName => this.renderLegacySection(sectionName, company, mainJob, jobs, lpSettings, sectionVisibility, layoutStyle))
      .join('');

    // 動画モーダルの初期化
    initVideoModal();
  }

  /**
   * 旧形式の単一セクションを描画
   */
  renderLegacySection(sectionName, company, mainJob, jobs, lpSettings, sectionVisibility, layoutStyle) {
    switch (sectionName) {
      case 'hero':
        return this.sectionRenderers.hero(company, mainJob, lpSettings, layoutStyle);
      case 'heroCta':
        return this.sectionRenderers.heroCta({
          showVideoButton: String(lpSettings.showVideoButton).toLowerCase() === 'true' || lpSettings.showVideoButton === true,
          videoUrl: lpSettings.videoUrl || '',
          applyButtonText: lpSettings.ctaText || '今すぐ応募する',
          videoButtonText: lpSettings.videoButtonText || '求人内容を動画で見る'
        }, layoutStyle);
      case 'points': {
        if (!sectionVisibility.points) return '';
        // カスタムレイアウトを取得
        let pointsLayout = null;
        if (lpSettings.pointsLayout) {
          try {
            pointsLayout = typeof lpSettings.pointsLayout === 'string'
              ? JSON.parse(lpSettings.pointsLayout)
              : lpSettings.pointsLayout;
          } catch (e) {
            console.error('pointsLayout parse error:', e);
          }
        }
        return this.sectionRenderers.points(company, mainJob, lpSettings, layoutStyle, pointsLayout);
      }
      case 'jobs':
        return sectionVisibility.jobs ? this.sectionRenderers.jobs(company, jobs, layoutStyle) : '';
      case 'details':
        return sectionVisibility.details ? this.sectionRenderers.details(company, mainJob, layoutStyle) : '';
      case 'faq':
        return (sectionVisibility.faq && lpSettings.faq) ? this.sectionRenderers.faq(lpSettings.faq, layoutStyle) : '';
      case 'apply':
        return this.sectionRenderers.apply(company, lpSettings, layoutStyle);
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

    // heroCta が含まれていない場合、hero の直後に挿入
    if (!customOrder.includes('heroCta')) {
      const heroIndex = customOrder.indexOf('hero');
      if (heroIndex !== -1) {
        customOrder.splice(heroIndex + 1, 0, 'heroCta');
      } else {
        customOrder.unshift('heroCta');
      }
    }

    const missingSections = this.defaultOrder.filter(s => !customOrder.includes(s));
    return [...customOrder, ...missingSections];
  }

  /**
   * LPをHTML文字列として返す（プレビュー用）
   * @param {Object} company - 会社情報
   * @param {Array} jobs - 求人情報配列
   * @param {Object} lpSettings - LP設定
   * @returns {Object} { html, patternClass, layoutClass }
   */
  renderToHtml(company, jobs, lpSettings) {
    // レイアウトスタイルを適用（designPatternも同期）
    const layoutStyle = lpSettings.layoutStyle || 'modern';
    const layoutClass = `lp-layout-${layoutStyle}`;
    const patternClass = `lp-pattern-${layoutStyle}`;

    // メインの求人情報
    const mainJob = jobs.length > 0 ? jobs[0] : company;

    // v2形式をチェック
    const lpContent = this.parseLPContent(lpSettings);

    let html = '';
    if (lpContent && lpContent.version === '2.0') {
      // 新形式（v2）で描画
      html = this.renderV2SectionsToHtml(lpContent, company, mainJob, jobs, lpSettings);
    } else {
      // 旧形式で描画（後方互換性）
      html = this.renderLegacySectionsToHtml(company, mainJob, jobs, lpSettings);
    }

    return { html, patternClass, layoutClass };
  }

  /**
   * v2形式でセクションをHTML文字列として返す
   */
  renderV2SectionsToHtml(lpContent, company, mainJob, jobs, lpSettings) {
    let { sections, globalSettings } = lpContent;

    // heroCTAセクションが存在しない場合、heroの直後に追加
    const hasHeroCta = sections.some(s => s.type === 'heroCta');
    if (!hasHeroCta) {
      const heroIndex = sections.findIndex(s => s.type === 'hero');
      const heroCtaSection = {
        id: 'heroCta-auto',
        type: 'heroCta',
        order: heroIndex >= 0 ? sections[heroIndex].order + 0.5 : 0.5,
        visible: true,
        data: {}
      };
      sections = [...sections, heroCtaSection];
    }

    // 表示するセクションをフィルタリング＆ソート
    const visibleSections = sections
      .filter(s => s.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // コンテキストオブジェクト
    const context = {
      company,
      mainJob,
      jobs,
      globalSettings: globalSettings || {},
      lpSettings: lpSettings || {}
    };

    // 各セクションを描画
    return visibleSections
      .map(section => this.renderV2Section(section, context))
      .join('');
  }

  /**
   * 旧形式でセクションをHTML文字列として返す
   */
  renderLegacySectionsToHtml(company, mainJob, jobs, lpSettings) {
    const sectionVisibility = this.parseSectionVisibility(lpSettings.sectionVisibility);
    const sectionOrder = this.parseSectionOrder(lpSettings.sectionOrder);
    const layoutStyle = lpSettings.layoutStyle || 'modern';

    return sectionOrder
      .map(sectionName => this.renderLegacySection(sectionName, company, mainJob, jobs, lpSettings, sectionVisibility, layoutStyle))
      .join('');
  }
}

export default LPRenderer;
