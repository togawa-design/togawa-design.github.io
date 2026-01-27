/**
 * LP編集機能
 * Wixライクなビジュアルエディタ
 */
import { escapeHtml } from '@shared/utils.js';
import { SECTION_TYPES, generateSectionId, canAddSection } from './sectionTypes.js';
import { renderPointsSection } from '@components/organisms/PointsSection.js';
import { renderHeroSection } from '@components/organisms/HeroSection.js';

// GAS API URL（スプレッドシートに保存用）
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec';

// デザインパターン定義（カラーテーマ）
const DESIGN_PATTERNS = [
  {
    id: 'standard',
    name: 'スタンダード',
    description: 'バランスの取れた標準デザイン',
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#ff6b35',
      text: '#333333'
    }
  },
  {
    id: 'modern',
    name: 'モダン',
    description: 'グリーン系のフレッシュなデザイン',
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#10b981',
      text: '#1f2937'
    }
  },
  {
    id: 'classic',
    name: 'クラシック',
    description: 'ブラウン系の落ち着いたデザイン',
    colors: {
      primary: '#92400e',
      secondary: '#78350f',
      accent: '#b45309',
      text: '#44403c'
    }
  },
  {
    id: 'minimal',
    name: 'ミニマル',
    description: 'モノトーンのシンプルなデザイン',
    colors: {
      primary: '#374151',
      secondary: '#1f2937',
      accent: '#111827',
      text: '#111827'
    }
  },
  {
    id: 'colorful',
    name: 'カラフル',
    description: 'ピンク〜パープルの華やかなデザイン',
    colors: {
      primary: '#ec4899',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      text: '#581c87'
    }
  },
  {
    id: 'blue',
    name: 'ブルー',
    description: '信頼感のあるブルー系デザイン',
    colors: {
      primary: '#3b82f6',
      secondary: '#1d4ed8',
      accent: '#0ea5e9',
      text: '#1e3a8a'
    }
  },
  {
    id: 'orange',
    name: 'オレンジ',
    description: '活気のあるオレンジ系デザイン',
    colors: {
      primary: '#f97316',
      secondary: '#ea580c',
      accent: '#fb923c',
      text: '#9a3412'
    }
  }
];

// テンプレートデザイン定義（レイアウト・構造・雰囲気）
const LAYOUT_STYLES = [
  {
    id: 'default',
    name: 'デフォルト',
    description: '標準的なレイアウト',
    preview: '中央揃え・シンプル',
    features: ['title-center', 'card-shadow', 'rounded-md']
  },
  {
    id: 'yellow',
    name: 'イエロー',
    description: '親しみやすい明るいデザイン',
    preview: 'グラデーション・角丸',
    features: ['hero-gradient', 'rounded-lg', 'card-border-bottom', 'friendly']
  },
  {
    id: 'impact',
    name: 'インパクト',
    description: '黒背景の強烈なデザイン',
    preview: '大文字・斜めボタン',
    features: ['dark-bg', 'uppercase', 'skew-btn', 'neon']
  },
  {
    id: 'trust',
    name: '信頼',
    description: 'ビジネス向けの信頼感',
    preview: '左ボーダー・シンプル',
    features: ['left-border', 'minimal', 'corporate']
  },
  {
    id: 'bold',
    name: 'ボールド',
    description: '大きな文字で印象的に',
    preview: '大文字・インパクト重視',
    features: ['title-large', 'title-center', 'hero-overlay-dark', 'text-bold']
  },
  {
    id: 'elegant',
    name: 'エレガント',
    description: '洗練された上品なデザイン',
    preview: '左揃え・下線装飾',
    features: ['title-left', 'title-underline', 'card-border', 'section-wide-padding']
  },
  {
    id: 'playful',
    name: 'ポップ',
    description: '明るく楽しい雰囲気',
    preview: '角丸・カラフル',
    features: ['title-center', 'rounded-lg', 'card-colorful', 'section-wave']
  },
  {
    id: 'corporate',
    name: 'コーポレート',
    description: 'ビジネス向けの信頼感',
    preview: '左揃え・直線的',
    features: ['title-left', 'title-badge', 'card-flat', 'section-striped']
  },
  {
    id: 'magazine',
    name: 'マガジン',
    description: '雑誌風のレイアウト',
    preview: '大きな画像・重なり',
    features: ['title-overlap', 'hero-full', 'card-overlap', 'section-overlap']
  },
  {
    id: 'athome',
    name: 'アットホーム',
    description: '丸みのあるフレンドリーなデザイン',
    preview: '角丸・吹き出し風',
    features: ['rounded-xl', 'bubble-card', 'friendly', 'soft-colors']
  },
  {
    id: 'local',
    name: '地域密着',
    description: '和風モダンの落ち着いたデザイン',
    preview: '創業○年・安定感',
    features: ['japanese-modern', 'stable', 'earth-tone', 'traditional']
  }
];

// プリセット画像一覧
const PRESET_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80',
    label: '工場・製造ライン'
  },
  {
    url: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200&q=80',
    label: '自動車工場'
  },
  {
    url: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1200&q=80',
    label: '溶接作業'
  },
  {
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&q=80',
    label: '産業ロボット'
  },
  {
    url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
    label: '倉庫・物流'
  },
  {
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80',
    label: '製造業チーム'
  },
  {
    url: 'https://images.unsplash.com/photo-1567789884554-0b844b597180?w=1200&q=80',
    label: '電子部品組立'
  },
  {
    url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80',
    label: '建設・インフラ'
  }
];

export class LPEditor {
  constructor() {
    this.editedData = {};
    this.currentCompanyDomain = null;
    this.draggedSection = null;
    this.isActive = false;
    this.presetImages = PRESET_IMAGES;
    this.selectedSection = null;
    this.sections = [];
    this.sidebarCollapsed = false;
    this.currentJobId = null;
    this.currentJobInfo = null;
    this.lpSettings = null;
    this.currentDesignPattern = 'standard';
    this.currentLayoutStyle = 'default';
    this.company = null;
    this.mainJob = null;
  }

  enable(lpSettings, companyDomain, jobInfo = null, company = null, mainJob = null) {
    this.isActive = true;
    this.currentCompanyDomain = companyDomain;
    this.editedData = {};  // 編集データは空から開始（lpSettingsと混同しない）
    this.sections = lpSettings.sections || [];
    this.lpSettings = lpSettings;
    this.currentJobInfo = jobInfo;
    this.company = company;
    this.mainJob = mainJob;
    this.currentDesignPattern = lpSettings.designPattern || 'standard';
    this.currentLayoutStyle = lpSettings.layoutStyle || 'default';

    // URLからjobIdを取得
    const urlParams = new URLSearchParams(window.location.search);
    this.currentJobId = urlParams.get('j') || '';

    document.body.classList.add('lp-edit-mode');

    this.renderToolbar();
    this.renderSidebar();
    this.setupEditableElements();
    this.setupSectionSortable();
    this.setupSectionSelection();
    this.addSectionEditButtons();
  }

  /**
   * セクションに編集ボタンを追加
   */
  addSectionEditButtons() {
    // ポイントセクションに編集ボタンを追加
    const pointsSection = document.querySelector('.lp-points');
    if (pointsSection) {
      // 既存のボタンを削除
      const existingBtn = pointsSection.querySelector('.lp-section-quick-edit-btn');
      if (existingBtn) existingBtn.remove();

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'lp-section-quick-edit-btn';
      editBtn.innerHTML = '✏️ ポイントを編集・追加';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPointsEditor();
      });

      const inner = pointsSection.querySelector('.lp-section-inner') || pointsSection;
      inner.appendChild(editBtn);
    }

    // FAQセクションに編集ボタンを追加
    const faqSection = document.querySelector('.lp-faq');
    if (faqSection) {
      // 既存のボタンを削除
      const existingBtn = faqSection.querySelector('.lp-section-quick-edit-btn');
      if (existingBtn) existingBtn.remove();

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'lp-section-quick-edit-btn';
      editBtn.innerHTML = '✏️ FAQを編集・追加';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openFAQEditor();
      });

      const inner = faqSection.querySelector('.lp-section-inner') || faqSection;
      inner.appendChild(editBtn);
    }
  }

  /**
   * サイドバーをレンダリング
   */
  renderSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'lp-editor-sidebar';
    sidebar.id = 'lp-editor-sidebar';
    sidebar.innerHTML = `
      <div class="lp-sidebar-header">
        <span class="lp-sidebar-title">編集</span>
        <button type="button" class="lp-sidebar-toggle" title="サイドバーを閉じる">
          <span class="lp-sidebar-toggle-icon">◀</span>
        </button>
      </div>
      <div class="lp-sidebar-content">
        <!-- テンプレートデザイン選択 -->
        <div class="lp-sidebar-section">
          <div class="lp-sidebar-section-header">
            <span class="lp-sidebar-section-title">📐 テンプレート</span>
          </div>
          <div class="lp-layout-selector" id="lp-layout-selector">
            ${this.renderLayoutStyleOptions()}
          </div>
        </div>

        <!-- カラーテーマ選択 -->
        <div class="lp-sidebar-section">
          <div class="lp-sidebar-section-header">
            <span class="lp-sidebar-section-title">🎨 カラーテーマ</span>
          </div>
          <div class="lp-design-selector" id="lp-design-selector">
            ${this.renderDesignPatternOptions()}
          </div>
        </div>

        <!-- セクション一覧 -->
        <div class="lp-sidebar-section">
          <div class="lp-sidebar-section-header">
            <span class="lp-sidebar-section-title">📄 セクション</span>
          </div>
          <div class="lp-sidebar-sections" id="lp-sidebar-sections">
            ${this.renderSidebarSectionList()}
          </div>
          <button type="button" class="lp-btn-add-section" id="lp-btn-add-section">
            <span class="lp-btn-add-icon">+</span>
            セクションを追加
          </button>
        </div>
      </div>
      <div class="lp-sidebar-footer">
        <button type="button" class="lp-sidebar-btn lp-sidebar-btn-preview" id="lp-sidebar-preview">
          プレビュー
        </button>
        <button type="button" class="lp-sidebar-btn lp-sidebar-btn-save" id="lp-sidebar-save">
          保存
        </button>
      </div>
    `;

    document.body.appendChild(sidebar);

    // サイドバートグル
    sidebar.querySelector('.lp-sidebar-toggle').addEventListener('click', () => {
      this.toggleSidebar();
    });

    // セクション追加ボタン
    sidebar.querySelector('#lp-btn-add-section').addEventListener('click', () => {
      this.openAddSectionPanel();
    });

    // 保存・プレビューボタン
    sidebar.querySelector('#lp-sidebar-save').addEventListener('click', () => this.saveChanges());
    sidebar.querySelector('#lp-sidebar-preview').addEventListener('click', () => this.previewChanges());

    // レイアウトスタイル選択イベント
    this.setupLayoutStyleEvents();

    // デザインパターン選択イベント
    this.setupDesignPatternEvents();

    // 初期レイアウトスタイルを適用
    this.applyLayoutStyle(this.currentLayoutStyle);

    // コンテンツエリアを調整
    const content = document.getElementById('lp-content');
    if (content) {
      content.classList.add('lp-content-with-sidebar');
    }
  }

  /**
   * レイアウトスタイルオプションをレンダリング
   */
  renderLayoutStyleOptions() {
    return LAYOUT_STYLES.map(style => {
      const isSelected = this.currentLayoutStyle === style.id;
      return `
        <div class="lp-layout-option ${isSelected ? 'selected' : ''}"
             data-layout="${style.id}"
             title="${style.description}">
          <div class="lp-layout-option-preview">
            <span class="lp-layout-preview-text">${style.preview}</span>
          </div>
          <span class="lp-layout-option-name">${style.name}</span>
          ${isSelected ? '<span class="lp-layout-option-check">✓</span>' : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * レイアウトスタイル選択イベントをセットアップ
   */
  setupLayoutStyleEvents() {
    const container = document.getElementById('lp-layout-selector');
    if (!container) return;

    container.querySelectorAll('.lp-layout-option').forEach(option => {
      option.addEventListener('click', () => {
        const layoutId = option.dataset.layout;
        this.changeLayoutStyle(layoutId);
      });
    });
  }

  /**
   * レイアウトスタイルを変更
   */
  changeLayoutStyle(layoutId) {
    const style = LAYOUT_STYLES.find(s => s.id === layoutId);
    if (!style) return;

    this.currentLayoutStyle = layoutId;
    this.editedData.layoutStyle = layoutId;

    // UIを更新
    const container = document.getElementById('lp-layout-selector');
    if (container) {
      container.innerHTML = this.renderLayoutStyleOptions();
      this.setupLayoutStyleEvents();
    }

    // ページにレイアウトスタイルを適用
    this.applyLayoutStyle(layoutId);

    // セクションを再レンダリング（HTML構造が変わるため）
    this.rerenderSections();
  }

  /**
   * レイアウト変更時にセクションを再レンダリング
   */
  rerenderSections() {
    if (!this.company || !this.mainJob) {
      console.log('[LPEditor] company/mainJob がないため再レンダリングをスキップ');
      return;
    }

    // 編集データをマージした設定を作成
    const mergedSettings = this.getMergedSettings();

    // ヒーローセクションを再レンダリング
    this.rerenderHeroSection(mergedSettings);

    // ポイントセクションを再レンダリング
    this.updatePointsDisplay();

    console.log('[LPEditor] セクションを再レンダリングしました');
  }

  /**
   * ヒーローセクションを再レンダリング
   */
  rerenderHeroSection(mergedSettings) {
    const heroSection = document.querySelector('.lp-hero');
    if (!heroSection) return;

    const newHtml = renderHeroSection(this.company, this.mainJob, mergedSettings, this.currentLayoutStyle);

    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newSection = temp.querySelector('.lp-hero');

    if (newSection) {
      heroSection.replaceWith(newSection);
      this.setupEditableElements();
      this.setupSectionSelection();
    }
  }

  /**
   * 編集データをマージした設定を取得
   */
  getMergedSettings() {
    const mergedSettings = { ...this.lpSettings };

    // 編集データをマージ
    Object.keys(this.editedData).forEach(key => {
      if (this.editedData[key] !== undefined) {
        mergedSettings[key] = this.editedData[key];
      }
    });

    return mergedSettings;
  }

  /**
   * レイアウトスタイルをページに適用
   */
  applyLayoutStyle(layoutId) {
    const body = document.body;
    const lpContent = document.getElementById('lp-content');

    // 既存のレイアウトクラスを削除
    LAYOUT_STYLES.forEach(s => {
      body.classList.remove(`lp-layout-${s.id}`);
      if (lpContent) lpContent.classList.remove(`lp-layout-${s.id}`);
    });

    // 新しいレイアウトクラスを追加
    body.classList.add(`lp-layout-${layoutId}`);
    if (lpContent) lpContent.classList.add(`lp-layout-${layoutId}`);
  }

  /**
   * デザインパターンオプションをレンダリング
   */
  renderDesignPatternOptions() {
    return DESIGN_PATTERNS.map(pattern => {
      const isSelected = this.currentDesignPattern === pattern.id;
      return `
        <div class="lp-design-option ${isSelected ? 'selected' : ''}"
             data-pattern="${pattern.id}"
             title="${pattern.description}">
          <div class="lp-design-option-colors">
            <span class="lp-design-color" style="background: ${pattern.colors.primary}"></span>
            <span class="lp-design-color" style="background: ${pattern.colors.secondary}"></span>
            <span class="lp-design-color" style="background: ${pattern.colors.accent}"></span>
          </div>
          <span class="lp-design-option-name">${pattern.name}</span>
          ${isSelected ? '<span class="lp-design-option-check">✓</span>' : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * デザインパターン選択イベントをセットアップ
   */
  setupDesignPatternEvents() {
    const container = document.getElementById('lp-design-selector');
    if (!container) return;

    container.querySelectorAll('.lp-design-option').forEach(option => {
      option.addEventListener('click', () => {
        const pattern = option.dataset.pattern;
        this.changeDesignPattern(pattern);
      });
    });
  }

  /**
   * デザインパターンを変更
   */
  changeDesignPattern(patternId) {
    const pattern = DESIGN_PATTERNS.find(p => p.id === patternId);
    if (!pattern) return;

    this.currentDesignPattern = patternId;
    this.editedData.designPattern = patternId;

    // UIを更新
    const container = document.getElementById('lp-design-selector');
    if (container) {
      container.innerHTML = this.renderDesignPatternOptions();
      this.setupDesignPatternEvents();
    }

    // ページにデザインパターンを適用
    this.applyDesignPattern(patternId);
  }

  /**
   * デザインパターンをページに適用
   */
  applyDesignPattern(patternId) {
    const body = document.body;
    const lpContent = document.getElementById('lp-content');

    // 既存のパターンクラスを削除
    DESIGN_PATTERNS.forEach(p => {
      body.classList.remove(`lp-pattern-${p.id}`);
      if (lpContent) lpContent.classList.remove(`lp-pattern-${p.id}`);
    });

    // 新しいパターンクラスを追加
    body.classList.add(`lp-pattern-${patternId}`);
    if (lpContent) lpContent.classList.add(`lp-pattern-${patternId}`);
  }

  /**
   * サイドバーのセクションリストをレンダリング
   */
  renderSidebarSectionList() {
    const contentEl = document.getElementById('lp-content');
    if (!contentEl) return '<p class="lp-sidebar-empty">セクションがありません</p>';

    const sections = contentEl.querySelectorAll('section');
    if (sections.length === 0) return '<p class="lp-sidebar-empty">セクションがありません</p>';

    return Array.from(sections).map((section, index) => {
      const sectionId = section.dataset.sectionId || `section-${index}`;
      const sectionType = this.detectSectionType(section);
      const typeConfig = SECTION_TYPES[sectionType] || { name: 'セクション', icon: '📄' };
      const isSelected = this.selectedSection === section;

      return `
        <div class="lp-sidebar-section-item ${isSelected ? 'selected' : ''}"
             data-section-id="${sectionId}"
             data-section-type="${sectionType}">
          <span class="lp-sidebar-section-handle">⋮⋮</span>
          <span class="lp-sidebar-section-icon">${typeConfig.icon}</span>
          <span class="lp-sidebar-section-name">${typeConfig.name}</span>
          <div class="lp-sidebar-section-actions">
            <button type="button" class="lp-sidebar-section-btn lp-btn-visibility" title="表示/非表示">
              👁️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * サイドバーリストを更新
   */
  updateSidebarList() {
    const listEl = document.getElementById('lp-sidebar-sections');
    if (listEl) {
      listEl.innerHTML = this.renderSidebarSectionList();
      this.setupSidebarSectionEvents();
    }
  }

  /**
   * サイドバーセクションのイベントを設定
   */
  setupSidebarSectionEvents() {
    const listEl = document.getElementById('lp-sidebar-sections');
    if (!listEl) return;

    listEl.querySelectorAll('.lp-sidebar-section-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.lp-sidebar-section-actions')) return;
        const sectionId = item.dataset.sectionId;
        this.selectSectionById(sectionId);
      });
    });
  }

  /**
   * サイドバーを開閉
   */
  toggleSidebar() {
    const sidebar = document.getElementById('lp-editor-sidebar');
    const content = document.getElementById('lp-content');

    if (sidebar) {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      sidebar.classList.toggle('collapsed', this.sidebarCollapsed);

      const toggleIcon = sidebar.querySelector('.lp-sidebar-toggle-icon');
      if (toggleIcon) {
        toggleIcon.textContent = this.sidebarCollapsed ? '▶' : '◀';
      }
    }

    if (content) {
      content.classList.toggle('lp-content-sidebar-collapsed', this.sidebarCollapsed);
    }
  }

  /**
   * セクション追加パネルを開く
   */
  openAddSectionPanel() {
    // 既存のパネルを閉じる
    this.closeAddSectionPanel();

    const panel = document.createElement('div');
    panel.className = 'lp-add-section-panel';
    panel.id = 'lp-add-section-panel';
    panel.innerHTML = `
      <div class="lp-add-section-header">
        <span>セクションを追加</span>
        <button type="button" class="lp-add-section-close">×</button>
      </div>
      <div class="lp-add-section-grid">
        ${Object.entries(SECTION_TYPES).map(([type, config]) => `
          <div class="lp-add-section-card" data-type="${type}">
            <span class="lp-add-section-icon">${config.icon}</span>
            <span class="lp-add-section-name">${config.name}</span>
          </div>
        `).join('')}
      </div>
    `;

    document.body.appendChild(panel);

    // 閉じるボタン
    panel.querySelector('.lp-add-section-close').addEventListener('click', () => {
      this.closeAddSectionPanel();
    });

    // セクションタイプ選択
    panel.querySelectorAll('.lp-add-section-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        this.addNewSection(type);
        this.closeAddSectionPanel();
      });
    });

    // 外側クリックで閉じる
    setTimeout(() => {
      document.addEventListener('click', this.handleAddPanelOutsideClick);
    }, 100);
  }

  handleAddPanelOutsideClick = (e) => {
    const panel = document.getElementById('lp-add-section-panel');
    if (panel && !panel.contains(e.target) && !e.target.closest('#lp-btn-add-section')) {
      this.closeAddSectionPanel();
    }
  }

  closeAddSectionPanel() {
    const panel = document.getElementById('lp-add-section-panel');
    if (panel) panel.remove();
    document.removeEventListener('click', this.handleAddPanelOutsideClick);
  }

  /**
   * 新しいセクションを追加
   */
  addNewSection(type) {
    const typeConfig = SECTION_TYPES[type];
    if (!typeConfig) return;

    // 実際の追加処理はサーバーサイドで行う必要があるため、
    // ここではユーザーに管理画面での追加を促す
    alert(`「${typeConfig.name}」セクションを追加するには、管理画面のLP設定から行ってください。`);
  }

  /**
   * セクション選択機能をセットアップ
   */
  setupSectionSelection() {
    const contentEl = document.getElementById('lp-content');
    if (!contentEl) return;

    contentEl.querySelectorAll('section').forEach((section, index) => {
      section.dataset.sectionId = section.dataset.sectionId || `section-${index}`;

      section.addEventListener('click', (e) => {
        // 編集中の要素やアクションボタンをクリックした場合はスキップ
        if (e.target.closest('.lp-editable, .lp-editable-image, .lp-section-action-menu, .lp-inline-editor')) {
          return;
        }
        this.selectSection(section);
      });
    });

    // サイドバーのセクションアイテムにもイベントを設定
    this.setupSidebarSectionEvents();
  }

  /**
   * セクションを選択
   */
  selectSection(section) {
    // 既存の選択を解除
    document.querySelectorAll('section.lp-section-selected').forEach(s => {
      s.classList.remove('lp-section-selected');
    });
    document.querySelectorAll('.lp-sidebar-section-item.selected').forEach(item => {
      item.classList.remove('selected');
    });

    // フローティングメニューを削除
    this.removeFloatingMenu();

    if (section === this.selectedSection) {
      // 同じセクションをクリックした場合は選択解除
      this.selectedSection = null;
      return;
    }

    this.selectedSection = section;
    section.classList.add('lp-section-selected');

    // サイドバーのアイテムも選択
    const sectionId = section.dataset.sectionId;
    const sidebarItem = document.querySelector(`.lp-sidebar-section-item[data-section-id="${sectionId}"]`);
    if (sidebarItem) {
      sidebarItem.classList.add('selected');
    }

    // フローティングアクションメニューを表示
    this.showFloatingMenu(section);

    // セクションまでスクロール
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * IDでセクションを選択
   */
  selectSectionById(sectionId) {
    const section = document.querySelector(`section[data-section-id="${sectionId}"]`);
    if (section) {
      this.selectSection(section);
    }
  }

  /**
   * フローティングアクションメニューを表示
   */
  showFloatingMenu(section) {
    this.removeFloatingMenu();

    const sectionType = this.detectSectionType(section);
    const typeConfig = SECTION_TYPES[sectionType] || { name: 'セクション', required: false };

    const menu = document.createElement('div');
    menu.className = 'lp-section-action-menu';
    menu.id = 'lp-section-action-menu';
    menu.innerHTML = `
      <button type="button" class="lp-action-btn lp-action-edit" title="編集">
        ✏️
      </button>
      <button type="button" class="lp-action-btn lp-action-move-up" title="上に移動">
        ⬆️
      </button>
      <button type="button" class="lp-action-btn lp-action-move-down" title="下に移動">
        ⬇️
      </button>
      ${!typeConfig.required ? `
        <button type="button" class="lp-action-btn lp-action-duplicate" title="複製">
          📋
        </button>
        <button type="button" class="lp-action-btn lp-action-delete" title="削除">
          🗑️
        </button>
      ` : ''}
    `;

    section.appendChild(menu);

    // アクションボタンのイベント
    menu.querySelector('.lp-action-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editSection(section);
    });

    menu.querySelector('.lp-action-move-up')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.moveSectionUp(section);
    });

    menu.querySelector('.lp-action-move-down')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.moveSectionDown(section);
    });

    menu.querySelector('.lp-action-duplicate')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.duplicateSection(section);
    });

    menu.querySelector('.lp-action-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteSection(section);
    });
  }

  /**
   * フローティングメニューを削除
   */
  removeFloatingMenu() {
    const existing = document.getElementById('lp-section-action-menu');
    if (existing) existing.remove();
  }

  /**
   * セクションを編集
   */
  editSection(section) {
    const sectionType = this.detectSectionType(section);

    // ポイントセクションの場合は専用エディタを開く
    if (sectionType === 'points') {
      this.openPointsEditor();
      return;
    }

    // FAQセクションの場合は専用エディタを開く
    if (sectionType === 'faq') {
      this.openFAQEditor();
      return;
    }

    alert(`「${this.getSectionLabel(sectionType)}」セクションを編集するには、管理画面のLP設定から行ってください。`);
  }

  /**
   * ポイントエディタを開く
   */
  openPointsEditor() {
    this.closePointsEditor();

    // 現在のポイントデータを取得
    const points = [];
    for (let i = 1; i <= 6; i++) {
      const title = this.editedData[`pointTitle${i}`] ?? this.lpSettings?.[`pointTitle${i}`] ?? '';
      const desc = this.editedData[`pointDesc${i}`] ?? this.lpSettings?.[`pointDesc${i}`] ?? '';
      points.push({ idx: i, title, desc });
    }

    const editor = document.createElement('div');
    editor.className = 'lp-points-editor-overlay';
    editor.id = 'lp-points-editor';
    editor.innerHTML = `
      <div class="lp-points-editor">
        <div class="lp-points-editor-header">
          <h3>ポイントセクションを編集</h3>
          <button type="button" class="lp-points-editor-close">&times;</button>
        </div>
        <div class="lp-points-editor-body">
          <p class="lp-points-editor-hint">最大6つのポイントを設定できます。空のポイントは表示されません。</p>
          <div class="lp-points-editor-list" id="lp-points-editor-list">
            ${points.map(p => this.renderPointEditorItem(p)).join('')}
          </div>
        </div>
        <div class="lp-points-editor-footer">
          <button type="button" class="lp-points-editor-btn lp-points-editor-btn-secondary" id="lp-points-editor-cancel">キャンセル</button>
          <button type="button" class="lp-points-editor-btn lp-points-editor-btn-primary" id="lp-points-editor-apply">適用</button>
        </div>
      </div>
    `;

    document.body.appendChild(editor);

    // イベントリスナー
    editor.querySelector('.lp-points-editor-close').addEventListener('click', () => this.closePointsEditor());
    editor.querySelector('#lp-points-editor-cancel').addEventListener('click', () => this.closePointsEditor());
    editor.querySelector('#lp-points-editor-apply').addEventListener('click', () => this.applyPointsChanges());

    // オーバーレイクリックで閉じる
    editor.addEventListener('click', (e) => {
      if (e.target === editor) this.closePointsEditor();
    });

    // 各ポイントのクリアボタン
    editor.querySelectorAll('.lp-point-editor-clear').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = btn.dataset.idx;
        const item = editor.querySelector(`.lp-point-editor-item[data-idx="${idx}"]`);
        if (item) {
          item.querySelector('.lp-point-editor-title').value = '';
          item.querySelector('.lp-point-editor-desc').value = '';
        }
      });
    });
  }

  /**
   * ポイントエディタアイテムをレンダリング
   */
  renderPointEditorItem(point) {
    const hasContent = point.title || point.desc;
    return `
      <div class="lp-point-editor-item ${hasContent ? 'has-content' : ''}" data-idx="${point.idx}">
        <div class="lp-point-editor-header">
          <span class="lp-point-editor-number">ポイント ${point.idx}</span>
          <button type="button" class="lp-point-editor-clear" data-idx="${point.idx}" title="クリア">
            <span>クリア</span>
          </button>
        </div>
        <div class="lp-point-editor-fields">
          <div class="lp-point-editor-field">
            <label>タイトル</label>
            <input type="text" class="lp-point-editor-title" value="${escapeHtml(point.title)}" placeholder="例: 入社特典充実">
          </div>
          <div class="lp-point-editor-field">
            <label>説明</label>
            <textarea class="lp-point-editor-desc" rows="2" placeholder="例: 特典総額50万円！入社祝い金やその他特典が充実。">${escapeHtml(point.desc)}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ポイントエディタを閉じる
   */
  closePointsEditor() {
    const editor = document.getElementById('lp-points-editor');
    if (editor) editor.remove();
  }

  /**
   * FAQエディタを開く
   */
  openFAQEditor() {
    this.closeFAQEditor();

    // 現在のFAQデータを取得
    const faqString = this.editedData.faq ?? this.lpSettings?.faq ?? '';
    const faqs = this.parseFAQString(faqString);

    // 最低1つのFAQ入力欄を表示
    if (faqs.length === 0) {
      faqs.push({ question: '', answer: '' });
    }

    const editor = document.createElement('div');
    editor.className = 'lp-faq-editor-overlay';
    editor.id = 'lp-faq-editor';
    editor.innerHTML = `
      <div class="lp-faq-editor">
        <div class="lp-faq-editor-header">
          <h3>FAQセクションを編集</h3>
          <button type="button" class="lp-faq-editor-close">&times;</button>
        </div>
        <div class="lp-faq-editor-body">
          <p class="lp-faq-editor-hint">よくある質問と回答を追加・編集できます。空の項目は表示されません。</p>
          <div class="lp-faq-editor-list" id="lp-faq-editor-list">
            ${faqs.map((faq, idx) => this.renderFAQEditorItem(faq, idx)).join('')}
          </div>
          <button type="button" class="lp-faq-editor-add-btn" id="lp-faq-editor-add">
            + 質問を追加
          </button>
        </div>
        <div class="lp-faq-editor-footer">
          <button type="button" class="lp-faq-editor-btn lp-faq-editor-btn-secondary" id="lp-faq-editor-cancel">キャンセル</button>
          <button type="button" class="lp-faq-editor-btn lp-faq-editor-btn-primary" id="lp-faq-editor-apply">適用</button>
        </div>
      </div>
    `;

    document.body.appendChild(editor);

    // イベントリスナー
    editor.querySelector('.lp-faq-editor-close').addEventListener('click', () => this.closeFAQEditor());
    editor.querySelector('#lp-faq-editor-cancel').addEventListener('click', () => this.closeFAQEditor());
    editor.querySelector('#lp-faq-editor-apply').addEventListener('click', () => this.applyFAQChanges());
    editor.querySelector('#lp-faq-editor-add').addEventListener('click', () => this.addFAQItem());

    // オーバーレイクリックで閉じる
    editor.addEventListener('click', (e) => {
      if (e.target === editor) this.closeFAQEditor();
    });

    // 削除ボタンのイベントを設定
    this.setupFAQDeleteButtons();
  }

  /**
   * FAQエディタアイテムをレンダリング
   */
  renderFAQEditorItem(faq, idx) {
    const hasContent = faq.question || faq.answer;
    return `
      <div class="lp-faq-editor-item ${hasContent ? 'has-content' : ''}" data-idx="${idx}">
        <div class="lp-faq-editor-item-header">
          <span class="lp-faq-editor-number">Q${idx + 1}</span>
          <button type="button" class="lp-faq-editor-delete" data-idx="${idx}" title="削除">
            🗑️
          </button>
        </div>
        <div class="lp-faq-editor-fields">
          <div class="lp-faq-editor-field">
            <label>質問</label>
            <input type="text" class="lp-faq-editor-question" value="${escapeHtml(faq.question)}" placeholder="例: 未経験でも大丈夫ですか？">
          </div>
          <div class="lp-faq-editor-field">
            <label>回答</label>
            <textarea class="lp-faq-editor-answer" rows="3" placeholder="例: はい、未経験の方も大歓迎です。研修制度が充実しているので安心してスタートできます。">${escapeHtml(faq.answer)}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * FAQ削除ボタンのイベントを設定
   */
  setupFAQDeleteButtons() {
    const editor = document.getElementById('lp-faq-editor');
    if (!editor) return;

    editor.querySelectorAll('.lp-faq-editor-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        this.deleteFAQItem(idx);
      });
    });
  }

  /**
   * FAQアイテムを追加
   */
  addFAQItem() {
    const list = document.getElementById('lp-faq-editor-list');
    if (!list) return;

    const items = list.querySelectorAll('.lp-faq-editor-item');
    const newIdx = items.length;

    const temp = document.createElement('div');
    temp.innerHTML = this.renderFAQEditorItem({ question: '', answer: '' }, newIdx);
    const newItem = temp.firstElementChild;
    list.appendChild(newItem);

    // 削除ボタンのイベントを設定
    this.setupFAQDeleteButtons();

    // 新しいアイテムにフォーカス
    const questionInput = newItem.querySelector('.lp-faq-editor-question');
    if (questionInput) questionInput.focus();
  }

  /**
   * FAQアイテムを削除
   */
  deleteFAQItem(idx) {
    const list = document.getElementById('lp-faq-editor-list');
    if (!list) return;

    const items = list.querySelectorAll('.lp-faq-editor-item');
    if (items.length <= 1) {
      // 最後の1つは削除せず、クリアする
      const item = items[0];
      item.querySelector('.lp-faq-editor-question').value = '';
      item.querySelector('.lp-faq-editor-answer').value = '';
      return;
    }

    // 削除して番号を振り直す
    items[idx].remove();
    this.renumberFAQItems();
  }

  /**
   * FAQ番号を振り直す
   */
  renumberFAQItems() {
    const list = document.getElementById('lp-faq-editor-list');
    if (!list) return;

    list.querySelectorAll('.lp-faq-editor-item').forEach((item, idx) => {
      item.dataset.idx = idx;
      item.querySelector('.lp-faq-editor-number').textContent = `Q${idx + 1}`;
      item.querySelector('.lp-faq-editor-delete').dataset.idx = idx;
    });

    // 削除ボタンのイベントを再設定
    this.setupFAQDeleteButtons();
  }

  /**
   * FAQエディタを閉じる
   */
  closeFAQEditor() {
    const editor = document.getElementById('lp-faq-editor');
    if (editor) editor.remove();
  }

  /**
   * FAQの変更を適用
   */
  applyFAQChanges() {
    const editor = document.getElementById('lp-faq-editor');
    if (!editor) return;

    const items = editor.querySelectorAll('.lp-faq-editor-item');
    const faqs = [];

    items.forEach(item => {
      const question = item.querySelector('.lp-faq-editor-question').value.trim();
      const answer = item.querySelector('.lp-faq-editor-answer').value.trim();

      if (question && answer) {
        faqs.push({ question, answer });
      }
    });

    // FAQを文字列形式に変換（Q:質問|A:回答\nQ:質問2|A:回答2）
    const faqString = faqs.map(faq => `Q:${faq.question}|A:${faq.answer}`).join('\n');
    this.editedData.faq = faqString;

    console.log('[LPEditor] FAQを更新:', faqString);

    // DOM上のFAQも更新
    this.updateFAQDisplay();

    this.closeFAQEditor();
    this.showSuccessMessage('FAQを更新しました');
  }

  /**
   * FAQ文字列をパース
   */
  parseFAQString(faqString) {
    if (!faqString) return [];

    const faqs = [];
    // リテラルな\nを実際の改行に変換してから分割
    const normalizedString = faqString.replace(/\\n/g, '\n');
    const lines = normalizedString.split(/\|\||[\n\r]+/).filter(line => line.trim());

    for (const line of lines) {
      // Q:質問|A:回答 形式
      const match = line.match(/Q[:：](.+?)\|A[:：](.+)/i);
      if (match) {
        faqs.push({
          question: match[1].trim(),
          answer: match[2].trim()
        });
      }
    }

    return faqs;
  }

  /**
   * FAQ表示を更新
   */
  updateFAQDisplay() {
    const faqSection = document.querySelector('.lp-faq');
    if (!faqSection) return;

    const faqString = this.editedData.faq ?? this.lpSettings?.faq ?? '';
    const faqs = this.parseFAQString(faqString);

    // FAQコンテナを更新
    const container = faqSection.querySelector('.lp-faq-chat-container') || faqSection.querySelector('.lp-faq-list');
    if (!container) return;

    if (faqs.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #666;">FAQが登録されていません</p>';
      return;
    }

    // LINE風チャット形式でレンダリング
    container.innerHTML = faqs.map((faq, idx) => `
      <div class="lp-faq-chat-pair">
        <!-- 質問（左側・サポート） -->
        <div class="lp-faq-chat-row lp-faq-chat-question">
          <div class="lp-faq-chat-avatar lp-faq-chat-avatar-support">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>
          </div>
          <div class="lp-faq-chat-bubble lp-faq-chat-bubble-support">
            <span class="lp-faq-chat-text">${escapeHtml(faq.question)}</span>
          </div>
        </div>
        <!-- 回答（右側・ユーザー） -->
        <div class="lp-faq-chat-row lp-faq-chat-answer">
          <div class="lp-faq-chat-bubble lp-faq-chat-bubble-user">
            <span class="lp-faq-chat-text">${escapeHtml(faq.answer)}</span>
          </div>
          <div class="lp-faq-chat-avatar lp-faq-chat-avatar-user">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
        </div>
      </div>
    `).join('');

    // 編集ボタンを再追加
    this.addSectionEditButtons();
  }

  /**
   * ポイントの変更を適用
   */
  applyPointsChanges() {
    const editor = document.getElementById('lp-points-editor');
    if (!editor) return;

    const items = editor.querySelectorAll('.lp-point-editor-item');
    items.forEach(item => {
      const idx = item.dataset.idx;
      const title = item.querySelector('.lp-point-editor-title').value.trim();
      const desc = item.querySelector('.lp-point-editor-desc').value.trim();

      this.editedData[`pointTitle${idx}`] = title;
      this.editedData[`pointDesc${idx}`] = desc;
    });

    console.log('[LPEditor] ポイントを更新:', this.editedData);

    // DOM上のポイントも更新（セクション全体を再レンダリング）
    this.updatePointsDisplay();

    this.closePointsEditor();
    this.showSuccessMessage('ポイントを更新しました');
  }

  /**
   * ポイント表示を更新（セクション全体を再レンダリング）
   */
  updatePointsDisplay() {
    const pointsSection = document.querySelector('.lp-points');
    if (!pointsSection || !this.company || !this.mainJob) {
      // フォールバック: 既存の要素のテキストのみ更新
      for (let i = 1; i <= 6; i++) {
        const title = this.editedData[`pointTitle${i}`] ?? '';
        const desc = this.editedData[`pointDesc${i}`] ?? '';

        const titleEl = document.querySelector(`[data-field="pointTitle${i}"]`);
        const descEl = document.querySelector(`[data-field="pointDesc${i}"]`);

        if (titleEl) {
          titleEl.textContent = title || `ポイント${i}タイトルを追加`;
          titleEl.classList.toggle('lp-placeholder', !title);
        }
        if (descEl) {
          descEl.textContent = desc || `ポイント${i}説明を追加`;
          descEl.classList.toggle('lp-placeholder', !desc);
        }
      }
      return;
    }

    // 編集データをマージしたLP設定を作成
    const mergedSettings = this.getMergedSettings();

    // ポイントセクションを再レンダリング
    const newHtml = renderPointsSection(this.company, this.mainJob, mergedSettings, this.currentLayoutStyle);

    // 一時的なコンテナで新しいHTMLをパース
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newSection = temp.querySelector('.lp-points');

    if (newSection) {
      // 既存のセクションを新しいもので置き換え
      pointsSection.replaceWith(newSection);

      // 編集モードの設定を再適用
      this.setupEditableElements();
      this.setupSectionSelection();
      this.addSectionEditButtons();
    }
  }

  /**
   * セクションを上に移動
   */
  moveSectionUp(section) {
    const prev = section.previousElementSibling;
    if (prev && prev.tagName === 'SECTION') {
      section.parentNode.insertBefore(section, prev);
      this.saveSectionOrder();
      this.updateSidebarList();
    }
  }

  /**
   * セクションを下に移動
   */
  moveSectionDown(section) {
    const next = section.nextElementSibling;
    if (next && next.tagName === 'SECTION') {
      section.parentNode.insertBefore(next, section);
      this.saveSectionOrder();
      this.updateSidebarList();
    }
  }

  /**
   * セクションを複製
   */
  duplicateSection(section) {
    const sectionType = this.detectSectionType(section);
    alert(`「${this.getSectionLabel(sectionType)}」セクションを複製するには、管理画面のLP設定から行ってください。`);
  }

  /**
   * セクションを削除
   */
  deleteSection(section) {
    const sectionType = this.detectSectionType(section);
    if (confirm(`「${this.getSectionLabel(sectionType)}」セクションを削除しますか？\n\n実際の削除は管理画面から行ってください。`)) {
      // プレビュー用に一時的に非表示
      section.style.display = 'none';
      this.removeFloatingMenu();
      this.selectedSection = null;
      this.updateSidebarList();
    }
  }

  renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'lp-edit-toolbar';
    toolbar.innerHTML = `
      <div class="lp-edit-toolbar-inner">
        <span class="lp-edit-toolbar-title">編集モード</span>
        <div class="lp-edit-toolbar-actions">
          <button type="button" class="lp-edit-btn-preview" id="btn-preview-changes">プレビュー</button>
          <button type="button" class="lp-edit-btn-save" id="btn-save-changes">保存</button>
          <button type="button" class="lp-edit-btn-cancel" id="btn-cancel-edit">キャンセル</button>
        </div>
      </div>
    `;

    document.body.insertBefore(toolbar, document.body.firstChild);

    toolbar.querySelector('#btn-save-changes').addEventListener('click', () => this.saveChanges());
    toolbar.querySelector('#btn-cancel-edit').addEventListener('click', () => this.cancelEdit());
    toolbar.querySelector('#btn-preview-changes').addEventListener('click', () => this.previewChanges());
  }

  setupEditableElements() {
    // テキスト編集可能要素
    document.querySelectorAll('.lp-editable').forEach(el => {
      const field = el.dataset.field;
      const label = el.dataset.label || field;

      el.addEventListener('mouseenter', () => this.showEditLabel(el, label));
      el.addEventListener('mouseleave', () => this.hideEditLabel());
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startTextEditing(el, field, label);
      });
    });

    // 画像編集可能要素
    document.querySelectorAll('.lp-editable-image').forEach(el => {
      const field = el.dataset.field;
      const label = el.dataset.label || field;

      el.addEventListener('mouseenter', () => this.showEditLabel(el, label));
      el.addEventListener('mouseleave', () => this.hideEditLabel());
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startImageEditing(el, field, label);
      });
    });
  }

  setupSectionSortable() {
    const contentEl = document.getElementById('lp-content');
    if (!contentEl) return;

    const sections = contentEl.querySelectorAll('section');
    if (sections.length === 0) return;

    sections.forEach((section) => {
      const sectionType = this.detectSectionType(section);
      section.dataset.section = sectionType;
      section.classList.add('lp-sortable-section');

      // ドラッグハンドルを追加
      const handle = document.createElement('div');
      handle.className = 'lp-section-drag-handle';
      handle.innerHTML = `
        <span class="lp-section-label">${this.getSectionLabel(sectionType)}</span>
        <span class="lp-section-drag-icon">⋮⋮</span>
      `;
      section.insertBefore(handle, section.firstChild);

      section.setAttribute('draggable', 'true');

      section.addEventListener('dragstart', (e) => {
        this.draggedSection = section;
        section.classList.add('lp-section-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setDragImage(section, 50, 30);
      });

      section.addEventListener('dragend', () => {
        section.classList.remove('lp-section-dragging');
        this.draggedSection = null;
        this.saveSectionOrder();
      });

      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (this.draggedSection && this.draggedSection !== section) {
          const allSections = [...contentEl.querySelectorAll('section')];
          const draggedIdx = allSections.indexOf(this.draggedSection);
          const targetIdx = allSections.indexOf(section);

          if (draggedIdx < targetIdx) {
            section.parentNode.insertBefore(this.draggedSection, section.nextSibling);
          } else {
            section.parentNode.insertBefore(this.draggedSection, section);
          }
        }
      });
    });
  }

  detectSectionType(section) {
    if (section.classList.contains('lp-hero')) return 'hero';
    if (section.classList.contains('lp-points')) return 'points';
    if (section.classList.contains('lp-jobs')) return 'jobs';
    if (section.classList.contains('lp-details')) return 'details';
    if (section.classList.contains('lp-faq')) return 'faq';
    if (section.classList.contains('lp-apply')) return 'apply';
    return 'unknown';
  }

  getSectionLabel(type) {
    const labels = {
      hero: 'ヒーロー',
      points: 'ポイント',
      jobs: '求人一覧',
      details: '募集要項',
      faq: 'FAQ',
      apply: '応募'
    };
    return labels[type] || 'セクション';
  }

  saveSectionOrder() {
    const contentEl = document.getElementById('lp-content');
    if (!contentEl) return;

    const sections = contentEl.querySelectorAll('section');
    const order = Array.from(sections).map(s => s.dataset.section);
    this.editedData.sectionOrder = order.join(',');
  }

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
  }

  hideEditLabel() {
    const existing = document.getElementById('lp-edit-label-tooltip');
    if (existing) existing.remove();
  }

  startTextEditing(el, field, label) {
    // 既存のエディタを閉じる
    this.closeInlineEditor();

    const currentValue = this.editedData[field] || el.textContent.trim();

    const editor = document.createElement('div');
    editor.className = 'lp-inline-editor';
    editor.id = 'lp-active-editor';
    editor.innerHTML = `
      <label class="lp-inline-editor-label">${escapeHtml(label)}</label>
      <textarea class="lp-inline-editor-textarea" rows="3">${escapeHtml(currentValue)}</textarea>
      <div class="lp-inline-editor-actions">
        <button type="button" class="lp-inline-editor-cancel">キャンセル</button>
        <button type="button" class="lp-inline-editor-apply">適用</button>
      </div>
    `;

    // 要素の位置にエディタを配置
    const rect = el.getBoundingClientRect();
    editor.style.position = 'fixed';
    editor.style.top = `${Math.min(rect.bottom + 10, window.innerHeight - 250)}px`;
    editor.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 320))}px`;

    document.body.appendChild(editor);
    const input = editor.querySelector('textarea');
    input.focus();
    input.select();

    const close = () => this.closeInlineEditor();

    editor.querySelector('.lp-inline-editor-cancel').addEventListener('click', close);
    editor.querySelector('.lp-inline-editor-apply').addEventListener('click', () => {
      const newValue = input.value.trim();
      this.editedData[field] = newValue;
      el.textContent = newValue || `${label}を追加`;
      el.classList.toggle('lp-placeholder', !newValue);
      close();
    });

    // 外側クリックで閉じる
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 100);
  }

  closeInlineEditor() {
    const existing = document.getElementById('lp-active-editor');
    if (existing) existing.remove();
    document.removeEventListener('click', this.handleOutsideClick);
  }

  handleOutsideClick = (e) => {
    const editor = document.getElementById('lp-active-editor');
    if (editor && !editor.contains(e.target) && !e.target.closest('.lp-editable')) {
      this.closeInlineEditor();
    }
  }

  startImageEditing(el, field, label) {
    // 既存のエディタを閉じる
    this.closeInlineEditor();

    const currentValue = this.editedData[field] || '';

    // プリセット画像のHTMLを生成
    const presetsHtml = this.presetImages.map((img, idx) => `
      <div class="lp-preset-image" data-url="${escapeHtml(img.url)}" title="${escapeHtml(img.label)}">
        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.label)}" loading="lazy">
        <span class="lp-preset-label">${escapeHtml(img.label)}</span>
      </div>
    `).join('');

    const editor = document.createElement('div');
    editor.className = 'lp-inline-editor lp-image-editor';
    editor.id = 'lp-active-editor';
    editor.innerHTML = `
      <label class="lp-inline-editor-label">${escapeHtml(label)}</label>

      <div class="lp-image-tabs">
        <button type="button" class="lp-image-tab active" data-tab="preset">プリセット</button>
        <button type="button" class="lp-image-tab" data-tab="url">URL入力</button>
      </div>

      <div class="lp-image-tab-content" data-content="preset">
        <div class="lp-preset-grid">
          ${presetsHtml}
        </div>
      </div>

      <div class="lp-image-tab-content" data-content="url" style="display: none;">
        <div class="lp-image-url-input">
          <input type="url" class="lp-inline-editor-input" placeholder="画像URLを入力" value="${escapeHtml(currentValue)}">
        </div>
      </div>

      <div class="lp-image-preview">
        ${currentValue ? `<img src="${escapeHtml(currentValue)}" alt="プレビュー">` : '<p>プレビューなし</p>'}
      </div>

      <div class="lp-inline-editor-actions">
        <button type="button" class="lp-inline-editor-clear">クリア</button>
        <button type="button" class="lp-inline-editor-cancel">キャンセル</button>
        <button type="button" class="lp-inline-editor-apply">適用</button>
      </div>
    `;

    // 画面中央に配置
    editor.style.position = 'fixed';
    editor.style.top = '50%';
    editor.style.left = '50%';
    editor.style.transform = 'translate(-50%, -50%)';
    editor.style.maxWidth = '500px';
    editor.style.width = '90%';
    editor.style.maxHeight = '80vh';
    editor.style.overflowY = 'auto';

    document.body.appendChild(editor);

    const input = editor.querySelector('input');
    const preview = editor.querySelector('.lp-image-preview');
    const tabs = editor.querySelectorAll('.lp-image-tab');
    const tabContents = editor.querySelectorAll('.lp-image-tab-content');
    let selectedUrl = currentValue;

    // タブ切り替え
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        tabContents.forEach(content => {
          content.style.display = content.dataset.content === tabName ? 'block' : 'none';
        });
      });
    });

    // プリセット画像クリック
    editor.querySelectorAll('.lp-preset-image').forEach(preset => {
      preset.addEventListener('click', () => {
        editor.querySelectorAll('.lp-preset-image').forEach(p => p.classList.remove('selected'));
        preset.classList.add('selected');
        selectedUrl = preset.dataset.url;
        input.value = selectedUrl;
        preview.innerHTML = `<img src="${escapeHtml(selectedUrl)}" alt="プレビュー">`;
      });
    });

    // URL入力
    input.addEventListener('input', () => {
      selectedUrl = input.value.trim();
      editor.querySelectorAll('.lp-preset-image').forEach(p => p.classList.remove('selected'));
      preview.innerHTML = selectedUrl ? `<img src="${escapeHtml(selectedUrl)}" alt="プレビュー">` : '<p>プレビューなし</p>';
    });

    const close = () => this.closeInlineEditor();

    // クリアボタン
    editor.querySelector('.lp-inline-editor-clear').addEventListener('click', () => {
      selectedUrl = '';
      input.value = '';
      editor.querySelectorAll('.lp-preset-image').forEach(p => p.classList.remove('selected'));
      preview.innerHTML = '<p>プレビューなし</p>';
    });

    editor.querySelector('.lp-inline-editor-cancel').addEventListener('click', close);
    editor.querySelector('.lp-inline-editor-apply').addEventListener('click', () => {
      this.editedData[field] = selectedUrl;
      console.log(`[LPEditor] 画像を設定: ${field} = ${selectedUrl}`);
      el.style.backgroundImage = selectedUrl ? `url('${selectedUrl}')` : '';
      close();
    });

    // 外側クリックで閉じる
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 100);
  }

  async saveChanges() {
    // 保存モーダルを表示
    this.showSaveModal();
  }

  showSaveModal() {
    // 既存のモーダルを削除
    const existing = document.getElementById('lp-save-modal');
    if (existing) existing.remove();

    const hasChanges = Object.keys(this.editedData).length > 0;
    const changesHtml = hasChanges
      ? `<div class="lp-save-modal-changes">
          <p class="lp-save-modal-hint">編集した内容：</p>
          <ul class="lp-save-modal-list">
            ${Object.entries(this.editedData).map(([key, value]) => {
              const displayValue = typeof value === 'string' && value.length > 50
                ? value.substring(0, 50) + '...'
                : value;
              return `<li><strong>${key}:</strong> ${displayValue}</li>`;
            }).join('')}
          </ul>
        </div>`
      : '<p class="lp-save-modal-empty">変更はありません</p>';

    const modal = document.createElement('div');
    modal.className = 'lp-save-modal-overlay';
    modal.id = 'lp-save-modal';
    modal.innerHTML = `
      <div class="lp-save-modal">
        <div class="lp-save-modal-header">
          <h3>変更を保存</h3>
          <button type="button" class="lp-save-modal-close">&times;</button>
        </div>
        <div class="lp-save-modal-body">
          ${changesHtml}
          <p class="lp-save-modal-message" style="margin-top: 16px; font-size: 13px; color: #666;">
            ※ 直接保存するとスプレッドシートに変更が反映されます
          </p>
        </div>
        <div class="lp-save-modal-footer">
          <button type="button" class="lp-save-modal-btn lp-save-modal-btn-secondary" id="lp-save-modal-close">閉じる</button>
          <a href="/admin.html#lp-settings" class="lp-save-modal-btn lp-save-modal-btn-secondary" target="_blank" style="text-decoration: none;">
            管理画面を開く
          </a>
          <button type="button" class="lp-save-modal-btn lp-save-modal-btn-primary" id="lp-save-modal-save" ${!hasChanges ? 'disabled' : ''}>
            直接保存
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 閉じるボタンのイベント
    modal.querySelector('.lp-save-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#lp-save-modal-close').addEventListener('click', () => modal.remove());

    // 直接保存ボタンのイベント
    modal.querySelector('#lp-save-modal-save').addEventListener('click', async () => {
      await this.saveToSpreadsheet(modal);
    });

    // オーバーレイクリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * スプレッドシートに直接保存
   */
  async saveToSpreadsheet(modal) {
    if (!this.currentJobId) {
      alert('求人IDが見つかりません');
      return;
    }

    const saveBtn = modal.querySelector('#lp-save-modal-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    try {
      // 現在のLP設定と編集内容をマージ
      const settings = this.buildSaveSettings();

      // デバッグ: 送信するデータをログ
      console.log('[LPEditor] 保存する設定:', settings);
      console.log('[LPEditor] 編集データ:', this.editedData);

      // GAS APIに送信
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveLPSettings',
        settings: settings
      }))));

      const url = `${GAS_API_URL}?action=post&data=${encodeURIComponent(payload)}`;
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`GASからの応答が不正です: ${responseText.substring(0, 200)}`);
      }

      if (!result.success) {
        throw new Error(result.error || '不明なエラー');
      }

      // 成功
      modal.remove();
      this.showSuccessMessage('保存しました！変更がスプレッドシートに反映されました。');

      // 編集データをクリア
      this.editedData = {};

    } catch (error) {
      console.error('保存エラー:', error);

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '直接保存';
      }

      // ローカルストレージにフォールバック
      const useLocal = confirm(`スプレッドシートへの保存に失敗しました。\n\nエラー: ${error.message}\n\nローカルに保存しますか？`);
      if (useLocal) {
        this.saveToLocalStorage();
        modal.remove();
      }
    }
  }

  /**
   * 保存用の設定オブジェクトを構築
   */
  buildSaveSettings() {
    // URLからcompanyDomainとjobIdを抽出
    const parts = this.currentJobId.split('_');
    const companyDomain = parts.length > 1 ? parts[0] : this.currentCompanyDomain;
    const jobIdPart = parts.length > 1 ? parts.slice(1).join('_') : this.currentJobId;

    // 既存の設定をベースにする
    const baseSettings = this.lpSettings || {};

    // 編集内容をマージ
    const settings = {
      jobId: this.currentJobId,
      companyDomain: companyDomain,
      company: this.currentJobInfo?.company || baseSettings.company || '',
      jobTitle: this.currentJobInfo?.title || baseSettings.jobTitle || '',
      designPattern: this.currentDesignPattern || baseSettings.designPattern || 'standard',
      layoutStyle: this.currentLayoutStyle || baseSettings.layoutStyle || 'default',
      heroTitle: this.editedData.heroTitle ?? baseSettings.heroTitle ?? '',
      heroSubtitle: this.editedData.heroSubtitle ?? baseSettings.heroSubtitle ?? '',
      heroImage: this.editedData.heroImage ?? baseSettings.heroImage ?? '',
      ctaText: this.editedData.ctaText ?? baseSettings.ctaText ?? '今すぐ応募する',
      faq: this.editedData.faq ?? baseSettings.faq ?? '',
      sectionOrder: this.editedData.sectionOrder ?? baseSettings.sectionOrder ?? '',
      sectionVisibility: baseSettings.sectionVisibility ?? ''
    };

    // ポイント1〜6
    for (let i = 1; i <= 6; i++) {
      settings[`pointTitle${i}`] = this.editedData[`pointTitle${i}`] ?? baseSettings[`pointTitle${i}`] ?? '';
      settings[`pointDesc${i}`] = this.editedData[`pointDesc${i}`] ?? baseSettings[`pointDesc${i}`] ?? '';
    }

    // 広告トラッキング設定
    settings.tiktokPixelId = baseSettings.tiktokPixelId ?? '';
    settings.googleAdsId = baseSettings.googleAdsId ?? '';
    settings.googleAdsLabel = baseSettings.googleAdsLabel ?? '';

    // OGP設定
    settings.ogpTitle = baseSettings.ogpTitle ?? '';
    settings.ogpDescription = baseSettings.ogpDescription ?? '';
    settings.ogpImage = baseSettings.ogpImage ?? '';

    // LP構成データ
    if (baseSettings.lpContent) {
      settings.lpContent = typeof baseSettings.lpContent === 'string'
        ? baseSettings.lpContent
        : JSON.stringify(baseSettings.lpContent);
    }

    return settings;
  }

  /**
   * ローカルストレージに保存
   */
  saveToLocalStorage() {
    const settings = this.buildSaveSettings();
    const key = `lp_settings_${this.currentJobId}`;
    localStorage.setItem(key, JSON.stringify(settings));
    this.showSuccessMessage('ローカルに保存しました。次回アクセス時に反映されます。');
    this.editedData = {};
  }

  /**
   * 成功メッセージを表示
   */
  showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'lp-save-toast';
    toast.innerHTML = `
      <span class="lp-save-toast-icon">✓</span>
      <span class="lp-save-toast-message">${escapeHtml(message)}</span>
    `;
    document.body.appendChild(toast);

    // アニメーション後に削除
    setTimeout(() => {
      toast.classList.add('lp-save-toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  cancelEdit() {
    if (confirm('編集内容を破棄してよろしいですか？')) {
      // editパラメータを除いてリロード
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.location.href = url.toString();
    }
  }

  previewChanges() {
    // 編集中のデータをsessionStorageに保存
    const previewData = {
      lpSettings: this.getMergedSettings(),
      timestamp: Date.now()
    };
    const previewKey = `lp_preview_${this.currentJobId}`;
    sessionStorage.setItem(previewKey, JSON.stringify(previewData));

    console.log('[LPEditor] プレビューデータを保存:', previewData);

    // editパラメータを除いてpreviewパラメータを追加
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    url.searchParams.set('preview', '1');
    window.open(url.toString(), '_blank');
  }
}

export { LAYOUT_STYLES, DESIGN_PATTERNS };
export default LPEditor;
