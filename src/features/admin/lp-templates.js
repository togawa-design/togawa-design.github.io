/**
 * LP テンプレート定義
 * Wixライクなテンプレート選択システム
 */

import { SECTION_TYPES, generateSectionId } from '../lp/sectionTypes.js';

// テンプレートカテゴリ
export const TEMPLATE_CATEGORIES = {
  manufacturing: { id: 'manufacturing', name: 'ベーシック', icon: '📋' },
  logistics: { id: 'logistics', name: '物流・倉庫', icon: '📦' },
  construction: { id: 'construction', name: '建設・土木', icon: '🏗️' },
  general: { id: 'general', name: '汎用', icon: '📋' }
};

// LPテンプレート定義
export const LP_TEMPLATES = {
  'manufacturing-basic': {
    id: 'manufacturing-basic',
    name: 'ベーシック',
    description: 'シンプルな求人向けレイアウト',
    category: 'manufacturing',
    thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60',
    sections: [
      {
        type: 'hero',
        data: {
          title: '月収30万円以上可！未経験歓迎',
          subtitle: '充実の研修制度で安心スタート',
          image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80'
        },
        layout: {}
      },
      {
        type: 'points',
        data: {
          sectionTitle: 'この求人のポイント',
          points: [
            { id: 'p1', title: '高収入', description: '月収30万円以上可能' },
            { id: 'p2', title: '未経験OK', description: '丁寧な研修あり' },
            { id: 'p3', title: '寮完備', description: '即入寮可能' }
          ]
        },
        layout: { columns: 3, style: 'cards' }
      },
      {
        type: 'jobs',
        data: { sectionTitle: '募集中の求人' },
        layout: {}
      },
      {
        type: 'details',
        data: { sectionTitle: '募集要項' },
        layout: {}
      },
      {
        type: 'faq',
        data: {
          sectionTitle: 'よくある質問',
          items: [
            { id: 'faq-1', question: '未経験でも大丈夫ですか？', answer: 'はい、未経験の方も大歓迎です。入社後に丁寧な研修がありますのでご安心ください。' },
            { id: 'faq-2', question: '寮はありますか？', answer: 'はい、寮を完備しております。即入寮も可能です。' }
          ]
        },
        layout: { style: 'accordion' }
      },
      {
        type: 'apply',
        data: {},
        layout: {}
      }
    ]
  },

  'manufacturing-premium': {
    id: 'manufacturing-premium',
    name: 'プレミアム',
    description: '画像ギャラリーと社員の声付き',
    category: 'manufacturing',
    thumbnail: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400&q=60',
    sections: [
      {
        type: 'hero',
        data: {
          title: '大手メーカーで安定収入',
          subtitle: '入社祝い金20万円支給',
          image: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200&q=80'
        },
        layout: {}
      },
      {
        type: 'points',
        data: {
          sectionTitle: 'この求人のポイント',
          points: [
            { id: 'p1', title: '入社祝い金', description: '入社祝い金20万円支給' },
            { id: 'p2', title: '社会保険完備', description: '各種保険完備で安心' },
            { id: 'p3', title: '交通費支給', description: '交通費全額支給' },
            { id: 'p4', title: '有給休暇', description: '入社6ヶ月後に付与' }
          ]
        },
        layout: { columns: 4, style: 'cards' }
      },
      {
        type: 'gallery',
        data: {
          sectionTitle: '職場の様子',
          images: [
            { url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=70', caption: '職場風景' },
            { url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=70', caption: '最新設備' },
            { url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=70', caption: 'チームワーク' }
          ]
        },
        layout: { columns: 3, style: 'grid' }
      },
      {
        type: 'testimonial',
        data: {
          sectionTitle: '先輩社員の声',
          testimonials: [
            {
              name: '田中さん',
              role: '製造スタッフ',
              department: '組立課',
              quote: '未経験で入社しましたが、先輩が丁寧に教えてくれるので安心して働けています。',
              yearsWorked: '2年'
            },
            {
              name: '鈴木さん',
              role: 'リーダー',
              department: '検査課',
              quote: '福利厚生がしっかりしているので、長く働き続けられる環境だと思います。',
              yearsWorked: '5年'
            }
          ]
        },
        layout: { style: 'cards' }
      },
      {
        type: 'jobs',
        data: { sectionTitle: '募集中の求人' },
        layout: {}
      },
      {
        type: 'details',
        data: { sectionTitle: '募集要項' },
        layout: {}
      },
      {
        type: 'faq',
        data: {
          sectionTitle: 'よくある質問',
          items: [
            { id: 'faq-1', question: '残業はどのくらいありますか？', answer: '月平均20時間程度です。繁忙期は多少増えることがあります。' },
            { id: 'faq-2', question: '車通勤は可能ですか？', answer: 'はい、無料駐車場を完備しております。' },
            { id: 'faq-3', question: '食堂はありますか？', answer: 'はい、社員食堂があり、1食300円〜でご利用いただけます。' }
          ]
        },
        layout: { style: 'accordion' }
      },
      {
        type: 'apply',
        data: {},
        layout: {}
      }
    ]
  },

  'logistics-basic': {
    id: 'logistics-basic',
    name: '物流・倉庫ベーシック',
    description: '倉庫作業・物流センター向け',
    category: 'logistics',
    thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=60',
    sections: [
      {
        type: 'hero',
        data: {
          title: '倉庫スタッフ大募集',
          subtitle: '日払いOK・週3日〜勤務可能',
          image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80'
        },
        layout: {}
      },
      {
        type: 'points',
        data: {
          sectionTitle: 'この求人のポイント',
          points: [
            { id: 'p1', title: '日払いOK', description: '急な出費にも対応' },
            { id: 'p2', title: 'シフト自由', description: '週3日〜OK' },
            { id: 'p3', title: '未経験歓迎', description: '簡単作業からスタート' }
          ]
        },
        layout: { columns: 3, style: 'cards' }
      },
      {
        type: 'jobs',
        data: { sectionTitle: '募集中の求人' },
        layout: {}
      },
      {
        type: 'details',
        data: { sectionTitle: '募集要項' },
        layout: {}
      },
      {
        type: 'apply',
        data: {},
        layout: {}
      }
    ]
  },

  'construction-basic': {
    id: 'construction-basic',
    name: '建設業ベーシック',
    description: '建設・土木作業員向け',
    category: 'construction',
    thumbnail: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=60',
    sections: [
      {
        type: 'hero',
        data: {
          title: '建設スタッフ急募',
          subtitle: '日給15,000円〜・経験者優遇',
          image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80'
        },
        layout: {}
      },
      {
        type: 'points',
        data: {
          sectionTitle: 'この求人のポイント',
          points: [
            { id: 'p1', title: '高日給', description: '日給15,000円〜' },
            { id: 'p2', title: '資格取得支援', description: '資格取得費用全額負担' },
            { id: 'p3', title: '社会保険完備', description: '長期で安心' }
          ]
        },
        layout: { columns: 3, style: 'cards' }
      },
      {
        type: 'jobs',
        data: { sectionTitle: '募集中の求人' },
        layout: {}
      },
      {
        type: 'details',
        data: { sectionTitle: '募集要項' },
        layout: {}
      },
      {
        type: 'faq',
        data: {
          sectionTitle: 'よくある質問',
          items: [
            { id: 'faq-1', question: '未経験でも応募できますか？', answer: 'はい、未経験の方も歓迎です。経験者の方は優遇いたします。' },
            { id: 'faq-2', question: '資格は必要ですか？', answer: '資格がなくても応募可能です。入社後に資格取得のサポートを行っています。' }
          ]
        },
        layout: { style: 'accordion' }
      },
      {
        type: 'apply',
        data: {},
        layout: {}
      }
    ]
  },

  'general-simple': {
    id: 'general-simple',
    name: 'シンプル',
    description: '最小限のセクション構成',
    category: 'general',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=60',
    sections: [
      {
        type: 'hero',
        data: {
          title: 'スタッフ募集中',
          subtitle: '',
          image: ''
        },
        layout: {}
      },
      {
        type: 'jobs',
        data: { sectionTitle: '募集中の求人' },
        layout: {}
      },
      {
        type: 'details',
        data: { sectionTitle: '募集要項' },
        layout: {}
      },
      {
        type: 'apply',
        data: {},
        layout: {}
      }
    ]
  },

  'general-full': {
    id: 'general-full',
    name: 'フル装備',
    description: '全セクションを含むフルセット',
    category: 'general',
    thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60',
    sections: [
      {
        type: 'hero',
        data: {
          title: '一緒に働く仲間を募集しています',
          subtitle: 'あなたの力を活かせる職場です',
          image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80'
        },
        layout: {}
      },
      {
        type: 'points',
        data: {
          sectionTitle: 'この求人のポイント',
          points: [
            { id: 'p1', title: 'ポイント1', description: '説明文を入力してください' },
            { id: 'p2', title: 'ポイント2', description: '説明文を入力してください' },
            { id: 'p3', title: 'ポイント3', description: '説明文を入力してください' }
          ]
        },
        layout: { columns: 3, style: 'cards' }
      },
      {
        type: 'custom',
        data: {
          title: '私たちについて',
          content: '<p>会社の紹介文を入力してください。</p>',
          image: '',
          button: null
        },
        layout: { variant: 'text-only' }
      },
      {
        type: 'gallery',
        data: {
          sectionTitle: '職場の様子',
          images: []
        },
        layout: { columns: 3, style: 'grid' }
      },
      {
        type: 'testimonial',
        data: {
          sectionTitle: '社員の声',
          testimonials: []
        },
        layout: { style: 'cards' }
      },
      {
        type: 'jobs',
        data: { sectionTitle: '募集中の求人' },
        layout: {}
      },
      {
        type: 'details',
        data: { sectionTitle: '募集要項' },
        layout: {}
      },
      {
        type: 'faq',
        data: {
          sectionTitle: 'よくある質問',
          items: []
        },
        layout: { style: 'accordion' }
      },
      {
        type: 'apply',
        data: {},
        layout: {}
      }
    ]
  }
};

/**
 * カテゴリ別にテンプレートを取得
 * @param {string} categoryId - カテゴリID
 * @returns {Array} テンプレート配列
 */
export function getTemplatesByCategory(categoryId) {
  return Object.values(LP_TEMPLATES).filter(t => t.category === categoryId);
}

/**
 * テンプレートをIDで取得
 * @param {string} templateId - テンプレートID
 * @returns {Object|null} テンプレート
 */
export function getTemplateById(templateId) {
  return LP_TEMPLATES[templateId] || null;
}

/**
 * テンプレートからセクションを生成
 * @param {string} templateId - テンプレートID
 * @returns {Array} セクション配列（新しいIDを付与）
 */
export function generateSectionsFromTemplate(templateId) {
  const template = getTemplateById(templateId);
  if (!template) return [];

  return template.sections.map((section, index) => ({
    id: generateSectionId(section.type),
    type: section.type,
    order: index,
    visible: true,
    data: JSON.parse(JSON.stringify(section.data)),
    layout: JSON.parse(JSON.stringify(section.layout || {}))
  }));
}

/**
 * テンプレート選択UIをレンダリング
 * @returns {string} HTML文字列
 */
export function renderTemplateSelector() {
  const categoryTabs = Object.values(TEMPLATE_CATEGORIES)
    .map((cat, index) => `
      <button type="button"
              class="template-category-tab ${index === 0 ? 'active' : ''}"
              data-category="${cat.id}">
        <span class="template-category-icon">${cat.icon}</span>
        <span class="template-category-name">${cat.name}</span>
      </button>
    `).join('');

  const templateGrids = Object.entries(TEMPLATE_CATEGORIES)
    .map(([catId, cat], index) => {
      const templates = getTemplatesByCategory(catId);
      return `
        <div class="template-grid ${index === 0 ? 'active' : ''}" data-category="${catId}">
          ${templates.map(t => `
            <div class="template-card" data-template-id="${t.id}">
              <div class="template-thumbnail">
                <img src="${t.thumbnail}" alt="${t.name}" loading="lazy">
              </div>
              <div class="template-info">
                <h4 class="template-name">${t.name}</h4>
                <p class="template-description">${t.description}</p>
              </div>
              <button type="button" class="template-apply-btn">
                このテンプレートを使用
              </button>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');

  return `
    <div class="template-selector">
      <div class="template-category-tabs">
        ${categoryTabs}
      </div>
      <div class="template-grids">
        ${templateGrids}
      </div>
    </div>
  `;
}

/**
 * テンプレート選択UIのイベントをセットアップ
 * @param {HTMLElement} container - コンテナ要素
 * @param {Function} onSelect - テンプレート選択時のコールバック
 */
export function setupTemplateSelectorEvents(container, onSelect) {
  // カテゴリタブ切り替え
  container.querySelectorAll('.template-category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const category = tab.dataset.category;

      // タブのactive切り替え
      container.querySelectorAll('.template-category-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
      });

      // グリッドのactive切り替え
      container.querySelectorAll('.template-grid').forEach(grid => {
        grid.classList.toggle('active', grid.dataset.category === category);
      });
    });
  });

  // テンプレート選択
  container.querySelectorAll('.template-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.template-card');
      const templateId = card.dataset.templateId;
      const template = getTemplateById(templateId);

      if (template && onSelect) {
        onSelect(template);
      }
    });
  });
}

export default {
  TEMPLATE_CATEGORIES,
  LP_TEMPLATES,
  getTemplatesByCategory,
  getTemplateById,
  generateSectionsFromTemplate,
  renderTemplateSelector,
  setupTemplateSelectorEvents
};
