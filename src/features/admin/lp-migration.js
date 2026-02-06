/**
 * LP設定 旧形式→新形式 移行機能
 */

import { SECTION_TYPES, DEFAULT_SECTION_ORDER } from '../lp/sectionTypes.js';

/**
 * 旧形式のLP設定を新形式（v2）に変換
 * @param {Object} legacySettings - 旧形式のLP設定
 * @returns {Object} 新形式のLP設定
 */
export function migrateToV2Format(legacySettings) {
  if (!legacySettings) {
    return createEmptyV2Content();
  }

  // 既にv2形式の場合でも、faqカラムの最新データを同期
  if (legacySettings.lpContent) {
    console.log('[migrateToV2Format] lpContent found, length:', legacySettings.lpContent.length);
    try {
      const parsed = JSON.parse(legacySettings.lpContent);
      console.log('[migrateToV2Format] Parsed lpContent, version:', parsed.version, 'sections:', parsed.sections?.length);
      if (parsed.version === '2.0') {
        // faqカラムがあれば、FAQセクションを最新データで更新
        if (legacySettings.faq) {
          const faqItems = parseLegacyFAQ(legacySettings.faq);
          const faqSection = parsed.sections.find(s => s.type === 'faq');
          if (faqSection) {
            faqSection.data = faqSection.data || {};
            faqSection.data.items = faqItems;
            faqSection.visible = faqItems.length > 0;
          }
        }
        console.log('[migrateToV2Format] Returning parsed v2 content with sections:', parsed.sections.map(s => s.type));
        return parsed;
      }
    } catch (e) {
      // パース失敗時は移行処理を続行
      console.error('[migrateToV2Format] JSON parse error:', e.message);
      console.log('[migrateToV2Format] lpContent value:', legacySettings.lpContent.substring(0, 200));
    }
  } else {
    console.log('[migrateToV2Format] No lpContent found, migrating from legacy format');
  }

  const sections = [];

  // セクション表示設定を解析
  let visibility = { points: true, jobs: true, details: true, faq: true };
  try {
    if (legacySettings.sectionVisibility) {
      visibility = { ...visibility, ...JSON.parse(legacySettings.sectionVisibility) };
    }
  } catch (e) {
    console.warn('sectionVisibility parse error:', e);
  }

  // セクション順序を解析
  let sectionOrder = DEFAULT_SECTION_ORDER;
  if (legacySettings.sectionOrder) {
    const customOrder = legacySettings.sectionOrder.split(',').map(s => s.trim()).filter(s => s);
    if (customOrder.length > 0) {
      const missingSections = DEFAULT_SECTION_ORDER.filter(s => !customOrder.includes(s));
      sectionOrder = [...customOrder, ...missingSections];
    }
  }

  // ヒーローセクション（常に存在）
  sections.push({
    id: 'hero-1',
    type: 'hero',
    order: sectionOrder.indexOf('hero'),
    visible: true,
    data: {
      title: legacySettings.heroTitle || '',
      subtitle: legacySettings.heroSubtitle || '',
      image: legacySettings.heroImage || ''
    },
    layout: {}
  });

  // ポイントセクション
  const points = [];
  for (let i = 1; i <= 6; i++) {
    const title = legacySettings[`pointTitle${i}`];
    const desc = legacySettings[`pointDesc${i}`];
    if (title) {
      points.push({
        id: `p${i}`,
        title: title,
        description: desc || ''
      });
    }
  }

  sections.push({
    id: 'points-1',
    type: 'points',
    order: sectionOrder.indexOf('points'),
    visible: visibility.points,
    data: {
      sectionTitle: 'この求人のポイント',
      points: points
    },
    layout: {
      columns: 3,
      style: 'cards'
    }
  });

  // 求人一覧セクション
  sections.push({
    id: 'jobs-1',
    type: 'jobs',
    order: sectionOrder.indexOf('jobs'),
    visible: visibility.jobs,
    data: {
      sectionTitle: '募集中の求人'
    },
    layout: {}
  });

  // 募集要項セクション
  sections.push({
    id: 'details-1',
    type: 'details',
    order: sectionOrder.indexOf('details'),
    visible: visibility.details,
    data: {
      sectionTitle: '募集要項'
    },
    layout: {}
  });

  // FAQセクション
  const faqItems = parseLegacyFAQ(legacySettings.faq);
  sections.push({
    id: 'faq-1',
    type: 'faq',
    order: sectionOrder.indexOf('faq'),
    visible: visibility.faq && faqItems.length > 0,
    data: {
      sectionTitle: 'よくある質問',
      items: faqItems
    },
    layout: {
      style: 'accordion'
    }
  });

  // 応募セクション（常に存在）
  sections.push({
    id: 'apply-1',
    type: 'apply',
    order: sectionOrder.indexOf('apply'),
    visible: true,
    data: {},
    layout: {}
  });

  // 順序でソート
  sections.sort((a, b) => a.order - b.order);

  return {
    version: '2.0',
    sections: sections,
    globalSettings: {
      designPattern: legacySettings.designPattern || 'modern',
      layoutStyle: legacySettings.layoutStyle || 'modern',
      ctaText: legacySettings.ctaText || '今すぐ応募する',
      tiktokPixelId: legacySettings.tiktokPixelId || '',
      googleAdsId: legacySettings.googleAdsId || '',
      googleAdsLabel: legacySettings.googleAdsLabel || '',
      ogpTitle: legacySettings.ogpTitle || '',
      ogpDescription: legacySettings.ogpDescription || '',
      ogpImage: legacySettings.ogpImage || ''
    }
  };
}

/**
 * 旧形式のFAQテキストを解析
 * @param {string} faqString - 旧形式のFAQ文字列
 * @returns {Array} FAQアイテム配列
 */
function parseLegacyFAQ(faqString) {
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
 * 新形式から旧形式に変換（後方互換性用）
 * @param {Object} v2Content - 新形式のLP設定
 * @returns {Object} 旧形式のLP設定
 */
export function convertToLegacyFormat(v2Content) {
  if (!v2Content || v2Content.version !== '2.0') {
    return {};
  }

  const legacySettings = {};
  const { sections, globalSettings } = v2Content;

  // グローバル設定
  if (globalSettings) {
    legacySettings.designPattern = globalSettings.designPattern || 'modern';
    legacySettings.layoutStyle = globalSettings.layoutStyle || 'modern';
    legacySettings.ctaText = globalSettings.ctaText || '今すぐ応募する';
    legacySettings.tiktokPixelId = globalSettings.tiktokPixelId || '';
    legacySettings.googleAdsId = globalSettings.googleAdsId || '';
    legacySettings.googleAdsLabel = globalSettings.googleAdsLabel || '';
    legacySettings.ogpTitle = globalSettings.ogpTitle || '';
    legacySettings.ogpDescription = globalSettings.ogpDescription || '';
    legacySettings.ogpImage = globalSettings.ogpImage || '';
  }

  // ヒーローセクション
  const heroSection = sections.find(s => s.type === 'hero');
  if (heroSection) {
    legacySettings.heroTitle = heroSection.data?.title || '';
    legacySettings.heroSubtitle = heroSection.data?.subtitle || '';
    legacySettings.heroImage = heroSection.data?.image || '';
  }

  // ポイントセクション（最初の1つのみ）
  const pointsSection = sections.find(s => s.type === 'points');
  if (pointsSection && pointsSection.data?.points) {
    pointsSection.data.points.slice(0, 6).forEach((point, idx) => {
      legacySettings[`pointTitle${idx + 1}`] = point.title || '';
      legacySettings[`pointDesc${idx + 1}`] = point.description || '';
    });
  }

  // FAQセクション（最初の1つのみ）
  const faqSection = sections.find(s => s.type === 'faq');
  if (faqSection && faqSection.data?.items) {
    legacySettings.faq = faqSection.data.items
      .map(item => `Q:${item.question}|A:${item.answer}`)
      .join('||');
  }

  // セクション順序
  const visibleSections = sections
    .filter(s => s.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(s => s.type);

  // 重複を除去（同じタイプが複数ある場合）
  const uniqueOrder = [...new Set(visibleSections)];
  legacySettings.sectionOrder = uniqueOrder.join(',');

  // セクション表示設定
  const visibility = {};
  const checkTypes = ['points', 'jobs', 'details', 'faq'];
  for (const type of checkTypes) {
    const section = sections.find(s => s.type === type);
    visibility[type] = section ? section.visible !== false : true;
  }
  legacySettings.sectionVisibility = JSON.stringify(visibility);

  return legacySettings;
}

/**
 * 空のv2コンテンツを作成
 * @returns {Object} 空のv2コンテンツ
 */
export function createEmptyV2Content() {
  return {
    version: '2.0',
    sections: [
      {
        id: 'hero-1',
        type: 'hero',
        order: 0,
        visible: true,
        data: { title: '', subtitle: '', image: '' },
        layout: {}
      },
      {
        id: 'points-1',
        type: 'points',
        order: 1,
        visible: true,
        data: { sectionTitle: 'この求人のポイント', points: [] },
        layout: { columns: 3, style: 'cards' }
      },
      {
        id: 'jobs-1',
        type: 'jobs',
        order: 2,
        visible: true,
        data: { sectionTitle: '募集中の求人' },
        layout: {}
      },
      {
        id: 'details-1',
        type: 'details',
        order: 3,
        visible: true,
        data: { sectionTitle: '募集要項' },
        layout: {}
      },
      {
        id: 'faq-1',
        type: 'faq',
        order: 4,
        visible: true,
        data: { sectionTitle: 'よくある質問', items: [] },
        layout: { style: 'accordion' }
      },
      {
        id: 'apply-1',
        type: 'apply',
        order: 5,
        visible: true,
        data: {},
        layout: {}
      }
    ],
    globalSettings: {
      designPattern: 'modern',
      layoutStyle: 'modern',
      ctaText: '今すぐ応募する'
    }
  };
}

export default {
  migrateToV2Format,
  convertToLegacyFormat,
  createEmptyV2Content
};
