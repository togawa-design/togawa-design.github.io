/**
 * LP セクションタイプ定義
 */

// セクションタイプ定義
export const SECTION_TYPES = {
  hero: {
    id: 'hero',
    name: 'ヒーローセクション',
    icon: '🎯',
    required: true,
    maxInstances: 1,
    defaultData: {
      title: '',
      subtitle: '',
      image: ''
    },
    defaultLayout: {}
  },
  points: {
    id: 'points',
    name: 'ポイント（特徴）',
    icon: '✨',
    required: false,
    maxInstances: null,
    defaultData: {
      sectionTitle: 'この求人のポイント',
      points: []
    },
    defaultLayout: {
      columns: 3,
      style: 'cards'
    }
  },
  jobs: {
    id: 'jobs',
    name: '求人一覧',
    icon: '💼',
    required: false,
    maxInstances: 1,
    defaultData: {
      sectionTitle: '募集中の求人'
    },
    defaultLayout: {}
  },
  details: {
    id: 'details',
    name: '募集要項',
    icon: '📋',
    required: false,
    maxInstances: 1,
    defaultData: {
      sectionTitle: '募集要項'
    },
    defaultLayout: {}
  },
  faq: {
    id: 'faq',
    name: 'よくある質問',
    icon: '❓',
    required: false,
    maxInstances: null,
    defaultData: {
      sectionTitle: 'よくある質問',
      items: []
    },
    defaultLayout: {
      style: 'accordion'
    }
  },
  apply: {
    id: 'apply',
    name: '応募セクション',
    icon: '📝',
    required: true,
    maxInstances: 1,
    defaultData: {},
    defaultLayout: {}
  },
  custom: {
    id: 'custom',
    name: 'カスタムセクション',
    icon: '🎨',
    required: false,
    maxInstances: null,
    defaultData: {
      title: '',
      content: '',
      image: '',
      button: null
    },
    defaultLayout: {
      variant: 'text-only'
    }
  },
  gallery: {
    id: 'gallery',
    name: '画像ギャラリー',
    icon: '🖼️',
    required: false,
    maxInstances: null,
    defaultData: {
      sectionTitle: '',
      images: []
    },
    defaultLayout: {
      columns: 3,
      style: 'grid'
    }
  },
  testimonial: {
    id: 'testimonial',
    name: '社員の声',
    icon: '💬',
    required: false,
    maxInstances: null,
    defaultData: {
      sectionTitle: '社員の声',
      testimonials: []
    },
    defaultLayout: {
      style: 'cards'
    }
  },
  carousel: {
    id: 'carousel',
    name: '画像カルーセル',
    icon: '🎠',
    required: false,
    maxInstances: null,
    defaultData: {
      sectionTitle: '',
      images: [],
      autoPlay: true,
      interval: 5000
    },
    defaultLayout: {
      style: 'standard',
      showDots: true,
      showArrows: true
    }
  },
  video: {
    id: 'video',
    name: '動画',
    icon: '🎬',
    required: false,
    maxInstances: null,
    defaultData: {
      sectionTitle: '',
      videoUrl: '',
      videoType: 'youtube',
      description: ''
    },
    defaultLayout: {
      aspectRatio: '16:9',
      fullWidth: false
    }
  }
};

// カスタムセクションのバリエーション
export const CUSTOM_VARIANTS = {
  'text-only': {
    name: 'テキストのみ',
    icon: '📝',
    description: 'テキストコンテンツのみを表示'
  },
  'image-only': {
    name: '画像のみ',
    icon: '🖼️',
    description: '画像を大きく表示'
  },
  'text-left-image-right': {
    name: 'テキスト左・画像右',
    icon: '◧',
    description: '左にテキスト、右に画像を配置'
  },
  'text-right-image-left': {
    name: 'テキスト右・画像左',
    icon: '◨',
    description: '左に画像、右にテキストを配置'
  },
  'centered-with-button': {
    name: '中央揃え（ボタン付き）',
    icon: '🔘',
    description: '中央揃えのテキストとボタン'
  },
  'full-width-banner': {
    name: 'フルワイドバナー',
    icon: '▬',
    description: '背景画像付きの全幅バナー'
  }
};

// ポイントのスタイルオプション
export const POINTS_STYLES = {
  cards: { name: 'カード', description: 'カード形式で表示' },
  list: { name: 'リスト', description: 'リスト形式で表示' },
  icons: { name: 'アイコン付き', description: 'アイコン付きで表示' }
};

// ギャラリーのスタイルオプション
export const GALLERY_STYLES = {
  grid: { name: 'グリッド', description: '等間隔のグリッド表示' },
  masonry: { name: 'メイソンリー', description: 'Pinterest風の不揃いレイアウト' },
  slider: { name: 'スライダー', description: '横スクロールスライダー' }
};

// デフォルトのセクション順序
export const DEFAULT_SECTION_ORDER = ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];

// ID生成ユーティリティ
export function generateSectionId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// デフォルトセクション構成を取得
export function getDefaultSections() {
  return [
    {
      id: 'hero-1',
      type: 'hero',
      order: 0,
      visible: true,
      data: { ...SECTION_TYPES.hero.defaultData },
      layout: { ...SECTION_TYPES.hero.defaultLayout }
    },
    {
      id: 'points-1',
      type: 'points',
      order: 1,
      visible: true,
      data: { ...SECTION_TYPES.points.defaultData },
      layout: { ...SECTION_TYPES.points.defaultLayout }
    },
    {
      id: 'jobs-1',
      type: 'jobs',
      order: 2,
      visible: true,
      data: { ...SECTION_TYPES.jobs.defaultData },
      layout: { ...SECTION_TYPES.jobs.defaultLayout }
    },
    {
      id: 'details-1',
      type: 'details',
      order: 3,
      visible: true,
      data: { ...SECTION_TYPES.details.defaultData },
      layout: { ...SECTION_TYPES.details.defaultLayout }
    },
    {
      id: 'faq-1',
      type: 'faq',
      order: 4,
      visible: true,
      data: { ...SECTION_TYPES.faq.defaultData },
      layout: { ...SECTION_TYPES.faq.defaultLayout }
    },
    {
      id: 'apply-1',
      type: 'apply',
      order: 5,
      visible: true,
      data: { ...SECTION_TYPES.apply.defaultData },
      layout: { ...SECTION_TYPES.apply.defaultLayout }
    }
  ];
}

// セクションを追加可能かチェック
export function canAddSection(type, currentSections) {
  const typeConfig = SECTION_TYPES[type];
  if (!typeConfig) return false;

  if (typeConfig.maxInstances === null) return true;

  const existingCount = currentSections.filter(s => s.type === type).length;
  return existingCount < typeConfig.maxInstances;
}

// セクションを削除可能かチェック
export function canDeleteSection(sectionId, currentSections) {
  const section = currentSections.find(s => s.id === sectionId);
  if (!section) return false;

  const typeConfig = SECTION_TYPES[section.type];
  return !typeConfig?.required;
}

export default {
  SECTION_TYPES,
  CUSTOM_VARIANTS,
  POINTS_STYLES,
  GALLERY_STYLES,
  DEFAULT_SECTION_ORDER,
  generateSectionId,
  getDefaultSections,
  canAddSection,
  canDeleteSection
};
