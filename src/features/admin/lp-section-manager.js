/**
 * LP セクションマネージャー
 * セクションの追加・削除・並び替え・編集を管理
 */

import { SECTION_TYPES, CUSTOM_VARIANTS, generateSectionId, canAddSection, canDeleteSection } from '../lp/sectionTypes.js';
import { migrateToV2Format, createEmptyV2Content } from './lp-migration.js';
import { escapeHtml } from '@shared/utils.js';
import { createImageUploader, uploadLPImage } from './image-uploader.js';
import {
  renderTemplateSelector,
  setupTemplateSelectorEvents,
  generateSectionsFromTemplate,
  getTemplateById
} from './lp-templates.js';
import { LAYOUT_STYLES } from '../lp/LPEditor.js';
import { showSelectorModal, showConfirmDialog } from '@shared/modal.js';

// 現在のセクション配列
let currentSections = [];
// グローバル設定
let globalSettings = {};
// 編集中のセクション
let editingSection = null;
// プレビュー更新コールバック
let onPreviewUpdate = null;
// 会社ドメイン取得関数
let getCompanyDomain = null;
// アクティブな画像アップローダー
let activeImageUploaders = {};

/**
 * セクションマネージャーを初期化
 * @param {Function} previewCallback - プレビュー更新時に呼ばれるコールバック
 * @param {Object} context - コンテキストオブジェクト
 * @param {Function} context.getCompanyDomain - 現在の会社ドメインを取得する関数
 */
export function initSectionManager(previewCallback, context = {}) {
  onPreviewUpdate = previewCallback;
  getCompanyDomain = context.getCompanyDomain || (() => null);
  setupEventListeners();
  initTemplateSelector();
}

/**
 * テンプレートセレクターを初期化（LPエディタと同じUI）
 */
function initTemplateSelector() {
  const container = document.getElementById('template-selector-container');
  if (!container) return;

  // 現在選択されているレイアウトスタイルを取得
  const currentLayoutStyle = globalSettings.layoutStyle || 'modern';

  // レイアウトスタイルセレクターをレンダリング
  container.innerHTML = renderLayoutStyleSelector(currentLayoutStyle);

  // イベントをセットアップ
  setupLayoutStyleEvents(container);
}

/**
 * レイアウトスタイルセレクターをレンダリング（採用ページ設定と同じUI）
 */
function renderLayoutStyleSelector(selectedLayout = 'modern') {
  const options = LAYOUT_STYLES.map((style, index) => {
    const isSelected = selectedLayout === style.id;
    return `
      <label class="layout-option ${isSelected ? 'selected' : ''}">
        <input type="radio" name="lp-layout-style" value="${style.id}" ${isSelected ? 'checked' : ''} data-layout="${style.id}">
        <div class="layout-preview" style="position: relative;">
          <div class="template-color-preview" style="
            position: absolute;
            top: 8px;
            right: 8px;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            background: ${style.color};
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          "></div>
          <span class="layout-name">${style.name}</span>
          <span class="layout-desc">${style.description}</span>
          <span class="layout-industries" style="font-size: 11px; color: #6b7280; margin-top: 4px; display: block;">${style.industries.join(' / ')}</span>
        </div>
      </label>
    `;
  }).join('');

  return `
    <div class="layout-style-grid">
      ${options}
    </div>
  `;
}

/**
 * レイアウトスタイル選択イベントをセットアップ
 */
function setupLayoutStyleEvents(container) {
  container.querySelectorAll('input[name="lp-layout-style"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const layoutId = radio.value;

      // 選択状態を更新（label要素にselectedクラス）
      container.querySelectorAll('.layout-option').forEach(opt => {
        const optRadio = opt.querySelector('input[name="lp-layout-style"]');
        opt.classList.toggle('selected', optRadio?.value === layoutId);
      });

      // グローバル設定を更新
      globalSettings.layoutStyle = layoutId;

      // プレビュー更新
      if (onPreviewUpdate) {
        onPreviewUpdate();
      }
    });
  });
}

/**
 * テンプレートを適用
 * @param {Object} template - テンプレートオブジェクト
 */
export async function applyTemplate(template) {
  if (!template) return;

  // 確認ダイアログ
  if (currentSections.length > 0) {
    const confirmed = await showConfirmDialog({
      title: 'テンプレートの適用',
      message: `テンプレート「${template.name}」を適用しますか？\n\n現在のセクション構成は置き換えられます。\nこの操作は取り消せません。`,
      confirmText: '適用する',
      cancelText: 'キャンセル',
      danger: true
    });
    if (!confirmed) return;
  }

  // テンプレートからセクションを生成
  const newSections = generateSectionsFromTemplate(template.id);
  if (newSections.length === 0) {
    alert('テンプレートの読み込みに失敗しました');
    return;
  }

  // セクションを置き換え
  currentSections = newSections;

  // リストを再描画
  renderSectionsList();

  // プレビューを更新
  triggerPreviewUpdate();

  // 成功メッセージ
  alert(`テンプレート「${template.name}」を適用しました。\n\n各セクションの内容は編集ボタンから変更できます。`);
}

/**
 * LP設定からセクションを読み込む
 * @param {Object} lpSettings - LP設定オブジェクト
 */
export function loadSectionsFromSettings(lpSettings) {
  const v2Content = migrateToV2Format(lpSettings);
  currentSections = v2Content.sections || [];
  globalSettings = v2Content.globalSettings || {};

  // lpSettings.layoutStyleがあればglobalSettingsに反映
  if (lpSettings.layoutStyle) {
    globalSettings.layoutStyle = lpSettings.layoutStyle;
  }

  renderSectionsList();

  // テンプレートセレクターを更新
  updateTemplateSelectorUI();
}

/**
 * テンプレートセレクターのUIを更新
 */
function updateTemplateSelectorUI() {
  const container = document.getElementById('template-selector-container');
  if (!container) return;

  const currentLayoutStyle = globalSettings.layoutStyle || 'modern';

  // ラジオボタンの選択状態を更新
  container.querySelectorAll('input[name="lp-layout-style"]').forEach(radio => {
    radio.checked = radio.value === currentLayoutStyle;
  });

  // label要素のselectedクラスを更新
  container.querySelectorAll('.layout-option').forEach(opt => {
    const optRadio = opt.querySelector('input[name="lp-layout-style"]');
    opt.classList.toggle('selected', optRadio?.value === currentLayoutStyle);
  });
}

/**
 * 現在のセクションデータを取得
 * @returns {Object} v2形式のLP設定
 */
export function getCurrentLPContent() {
  return {
    version: '2.0',
    sections: currentSections,
    globalSettings: globalSettings
  };
}

/**
 * グローバル設定を更新
 * @param {string} key - 設定キー
 * @param {*} value - 設定値
 */
export function updateGlobalSetting(key, value) {
  globalSettings[key] = value;
  triggerPreviewUpdate();
}

/**
 * セクションリストをレンダリング
 */
export function renderSectionsList() {
  const container = document.getElementById('lp-sections-list');
  if (!container) {
    console.log('[renderSectionsList] Container not found');
    return;
  }

  const sortedSections = [...currentSections].sort((a, b) => (a.order || 0) - (b.order || 0));
  console.log('[renderSectionsList] Rendering sections:', sortedSections.length, sortedSections.map(s => s.type));

  container.innerHTML = sortedSections.map(section => renderSectionItem(section)).join('');

  // ドラッグ&ドロップを再設定
  setupDragAndDrop();

  // カスタムセクションパネルを更新
  renderCustomSectionsPanel();
}

/**
 * カスタムセクションパネルをレンダリング
 * 動画、カルーセル、ギャラリー等の追加コンテンツを表示
 */
function renderCustomSectionsPanel() {
  const panel = document.getElementById('custom-sections-panel');
  const list = document.getElementById('custom-sections-list');
  if (!panel || !list) return;

  // カスタムセクションタイプ（コアセクション以外）
  const coreTypes = ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
  const customSections = currentSections
    .filter(s => !coreTypes.includes(s.type))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // カスタムセクションがあれば表示
  if (customSections.length > 0) {
    panel.style.display = '';
    list.innerHTML = customSections.map(section => renderCustomSectionItem(section)).join('');
    setupCustomSectionsPanelEvents();
  } else {
    panel.style.display = 'none';
    list.innerHTML = '';
  }
}

/**
 * カスタムセクションアイテムをレンダリング
 * @param {Object} section - セクション設定
 * @returns {string} HTML文字列
 */
function renderCustomSectionItem(section) {
  const typeConfig = SECTION_TYPES[section.type];
  const isVisible = section.visible !== false;
  const title = section.data?.sectionTitle || section.data?.title || '';

  // セクションタイプ別のメタ情報を取得
  const meta = getCustomSectionMeta(section);

  return `
    <div class="custom-section-item ${isVisible ? '' : 'hidden'}" data-section-id="${section.id}" data-type="${section.type}">
      <span class="custom-section-icon">${typeConfig?.icon || '📄'}</span>
      <div class="custom-section-info">
        <span class="custom-section-type">${typeConfig?.name || section.type}</span>
        ${title ? `<span class="custom-section-title">${escapeHtml(title)}</span>` : ''}
        ${meta ? `<span class="custom-section-meta">${escapeHtml(meta)}</span>` : ''}
      </div>
      <div class="custom-section-actions">
        <button type="button" class="section-btn btn-edit" title="編集" data-section-id="${section.id}">✏️</button>
        <button type="button" class="section-btn btn-visibility ${isVisible ? '' : 'hidden'}" title="${isVisible ? '非表示にする' : '表示する'}" data-section-id="${section.id}">
          ${isVisible ? '👁️' : '👁️‍🗨️'}
        </button>
        <button type="button" class="section-btn btn-delete" title="削除" data-section-id="${section.id}">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * セクションタイプ別のメタ情報を取得
 * @param {Object} section - セクション設定
 * @returns {string} メタ情報文字列
 */
function getCustomSectionMeta(section) {
  switch (section.type) {
    case 'video':
      if (section.data?.videoUrl) {
        const url = section.data.videoUrl;
        if (url.includes('youtube') || url.includes('youtu.be')) {
          return 'YouTube動画';
        } else if (url.includes('vimeo')) {
          return 'Vimeo動画';
        } else if (url.includes('tiktok')) {
          return 'TikTok動画';
        }
        return '動画URL設定済み';
      }
      return '動画未設定';

    case 'carousel':
      const carouselImages = section.data?.images?.length || 0;
      return carouselImages > 0 ? `${carouselImages}枚の画像` : '画像未設定';

    case 'gallery':
      const galleryImages = section.data?.images?.length || 0;
      return galleryImages > 0 ? `${galleryImages}枚の画像` : '画像未設定';

    case 'testimonial':
      const testimonials = section.data?.testimonials?.length || 0;
      return testimonials > 0 ? `${testimonials}人の声` : '未設定';

    case 'custom':
      const variant = CUSTOM_VARIANTS[section.layout?.variant];
      return variant?.name || 'カスタムコンテンツ';

    default:
      return '';
  }
}

/**
 * カスタムセクションパネルのイベントを設定
 */
function setupCustomSectionsPanelEvents() {
  const list = document.getElementById('custom-sections-list');
  if (!list) return;

  // 既存のイベントを削除して再設定
  list.onclick = (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const sectionId = target.dataset.sectionId;
    if (!sectionId) return;

    if (target.classList.contains('btn-edit')) {
      openSectionEditor(sectionId);
    } else if (target.classList.contains('btn-visibility')) {
      toggleSectionVisibility(sectionId);
    } else if (target.classList.contains('btn-delete')) {
      deleteSection(sectionId);
    }
  };
}

/**
 * セクションアイテムをレンダリング
 * @param {Object} section - セクション設定
 * @returns {string} HTML文字列
 */
function renderSectionItem(section) {
  const typeConfig = SECTION_TYPES[section.type];
  const isRequired = typeConfig?.required;
  const isVisible = section.visible !== false;
  const variantName = section.type === 'custom' && section.layout?.variant
    ? CUSTOM_VARIANTS[section.layout.variant]?.name || ''
    : '';

  return `
    <li class="section-item ${isVisible ? '' : 'hidden'}"
        data-section-id="${section.id}"
        data-type="${section.type}"
        draggable="true">
      <span class="section-drag-handle">⋮⋮</span>
      <span class="section-icon">${typeConfig?.icon || '📄'}</span>
      <div class="section-info">
        <div class="section-name">${typeConfig?.name || section.type}</div>
        ${variantName ? `<div class="section-type-label">${variantName}</div>` : ''}
      </div>
      <div class="section-actions">
        <button type="button" class="section-btn btn-edit" title="編集" data-section-id="${section.id}">
          ✏️
        </button>
        ${!isRequired ? `
          <button type="button" class="section-btn btn-duplicate" title="複製" data-section-id="${section.id}">
            📋
          </button>
        ` : ''}
        <button type="button" class="section-btn btn-visibility ${isVisible ? '' : 'hidden'}" title="${isVisible ? '非表示にする' : '表示する'}" data-section-id="${section.id}">
          ${isVisible ? '👁️' : '👁️‍🗨️'}
        </button>
        ${!isRequired ? `
          <button type="button" class="section-btn btn-delete" title="削除" data-section-id="${section.id}">
            🗑️
          </button>
        ` : ''}
      </div>
    </li>
  `;
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // セクション追加ボタン
  const addBtn = document.getElementById('btn-add-section');
  if (addBtn) {
    addBtn.addEventListener('click', openAddSectionModal);
  }

  // カスタムセクション追加ボタン（FAQ下のパネル用）
  const addCustomBtn = document.getElementById('btn-add-custom-section');
  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', openAddCustomSectionModal);
  }

  // モーダル閉じるボタン
  const closeAddModal = document.getElementById('add-section-modal-close');
  if (closeAddModal) {
    closeAddModal.addEventListener('click', closeAddSectionModal);
  }

  // キャンセルボタン
  const cancelAddModal = document.getElementById('add-section-modal-cancel');
  if (cancelAddModal) {
    cancelAddModal.addEventListener('click', closeAddSectionModal);
  }

  const closeEditorModal = document.getElementById('section-editor-close');
  if (closeEditorModal) {
    closeEditorModal.addEventListener('click', closeSectionEditor);
  }

  const cancelEditorBtn = document.getElementById('section-editor-cancel');
  if (cancelEditorBtn) {
    cancelEditorBtn.addEventListener('click', closeSectionEditor);
  }

  const saveEditorBtn = document.getElementById('section-editor-save');
  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', saveSectionEditor);
  }

  const deleteEditorBtn = document.getElementById('section-delete-btn');
  if (deleteEditorBtn) {
    deleteEditorBtn.addEventListener('click', () => {
      if (editingSection) {
        deleteSection(editingSection.id);
        closeSectionEditor();
      }
    });
  }

  // セクションリストのイベント委譲
  const sectionsList = document.getElementById('lp-sections-list');
  if (sectionsList) {
    sectionsList.addEventListener('click', handleSectionListClick);
  }

  // モーダル背景クリックで閉じる
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
}

/**
 * セクションリストのクリックイベントを処理
 * @param {Event} e - クリックイベント
 */
function handleSectionListClick(e) {
  const target = e.target.closest('button');
  if (!target) return;

  const sectionId = target.dataset.sectionId;
  if (!sectionId) return;

  if (target.classList.contains('btn-edit')) {
    openSectionEditor(sectionId);
  } else if (target.classList.contains('btn-duplicate')) {
    duplicateSection(sectionId);
  } else if (target.classList.contains('btn-visibility')) {
    toggleSectionVisibility(sectionId);
  } else if (target.classList.contains('btn-delete')) {
    deleteSection(sectionId);
  }
}

/**
 * ドラッグ&ドロップを設定
 */
function setupDragAndDrop() {
  const list = document.getElementById('lp-sections-list');
  if (!list) return;

  let draggedItem = null;

  list.querySelectorAll('.section-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;

      list.querySelectorAll('.section-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      // 順序を更新
      updateSectionOrder();
      triggerPreviewUpdate();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!draggedItem || draggedItem === item) return;

      const afterElement = getDragAfterElement(list, e.clientY);

      list.querySelectorAll('.section-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      if (afterElement && afterElement !== draggedItem) {
        afterElement.classList.add('drag-over');
      }

      if (afterElement == null) {
        list.appendChild(draggedItem);
      } else {
        list.insertBefore(draggedItem, afterElement);
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
  });
}

/**
 * ドラッグ後の要素を取得
 * @param {HTMLElement} container - コンテナ要素
 * @param {number} y - マウスのY座標
 * @returns {HTMLElement|null}
 */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.section-item:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > (closest.offset || Number.NEGATIVE_INFINITY)) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element || null;
}

/**
 * セクション順序を更新
 */
function updateSectionOrder() {
  const list = document.getElementById('lp-sections-list');
  if (!list) return;

  const items = list.querySelectorAll('.section-item');
  items.forEach((item, index) => {
    const sectionId = item.dataset.sectionId;
    const section = currentSections.find(s => s.id === sectionId);
    if (section) {
      section.order = index;
    }
  });
}

/**
 * セクションタイプの説明マッピング
 */
const SECTION_TYPE_DESCRIPTIONS = {
  heroCta: 'ファーストビュー内にCTAボタン（応募ボタン・動画ボタン）を追加',
  hero: 'メインビジュアルとキャッチコピーを表示するセクション',
  points: '求人の特徴やポイントを箇条書きで表示',
  jobs: '求人一覧を表示するセクション',
  details: '給与・勤務地など募集要項の詳細を表示',
  faq: 'よくある質問と回答を表示',
  apply: '応募フォームや応募ボタンを表示',
  video: '動画（YouTube、Vimeo、TikTok）を埋め込み表示',
  carousel: '複数の画像をスライドショー形式で表示',
  gallery: '複数の画像をグリッド形式で表示',
  testimonial: '社員の声やインタビューを掲載',
  custom: '自由なテキストと画像でオリジナルセクションを作成'
};

/**
 * セクション追加モーダルを開く（共通モーダルコンポーネント使用）
 */
function openAddSectionModal() {
  // モーダル用のアイテムを生成
  const items = Object.entries(SECTION_TYPES)
    .filter(([type]) => !SECTION_TYPES[type].required || canAddSection(type, currentSections))
    .map(([type, config]) => {
      const isDisabled = !canAddSection(type, currentSections);
      const description = SECTION_TYPE_DESCRIPTIONS[type] || '';
      return {
        id: type,
        name: config.name,
        description: description,
        icon: config.icon,
        iconBgColor: '#4AA7C0',
        disabled: isDisabled,
        disabledText: '追加済み'
      };
    });

  // 共通リストモーダルコンポーネントを使用
  showSelectorModal({
    id: 'lp-add-section-modal',
    title: 'セクションを追加',
    description: '追加したいセクションタイプを選択してください',
    items: items,
    buttonText: '追加する',
    cancelText: 'キャンセル',
    onSelect: (type) => {
      addSection(type);
    }
  });
}

/**
 * セクション追加モーダルを閉じる
 */
function closeAddSectionModal() {
  const modal = document.getElementById('add-section-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * カスタムセクションの説明マッピング
 */
const SECTION_DESCRIPTIONS = {
  video: '動画（YouTube、Vimeo、TikTok）を埋め込んで、求人や会社の魅力を伝えることができます。',
  carousel: '複数の画像をスライドショー形式で表示できます。職場の様子や仕事風景をアピールできます。',
  gallery: '複数の画像をグリッド形式で表示できます。職場環境や仕事の様子を見せられます。',
  testimonial: '社員の声やインタビューを掲載できます。実際に働いている人の声を届けられます。',
  custom: '自由なテキストと画像でオリジナルのセクションを作成できます。',
  heroCta: 'ファーストビュー内にCTAボタン（応募ボタン・動画ボタン）を追加できます。'
};

/**
 * カスタムセクション追加モーダルを開く（共通モーダルコンポーネント使用）
 */
function openAddCustomSectionModal() {
  // カスタムセクションタイプのみ表示
  const coreTypes = ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
  const customTypes = Object.entries(SECTION_TYPES)
    .filter(([type]) => !coreTypes.includes(type));

  // モーダル用のアイテムを生成
  const items = customTypes.map(([type, config]) => {
    const isDisabled = !canAddSection(type, currentSections);
    const description = SECTION_DESCRIPTIONS[type] || '';
    return {
      id: type,
      name: config.name,
      description: description,
      icon: config.icon,
      iconBgColor: '#4AA7C0',
      disabled: isDisabled,
      disabledText: '追加済み'
    };
  });

  // 共通モーダルコンポーネントを使用
  showSelectorModal({
    id: 'lp-add-section-modal',
    title: 'コンテンツを追加する',
    description: '追加するコンテンツを選択してください。',
    items: items,
    buttonText: '追加する',
    cancelText: 'キャンセル',
    onSelect: (type) => {
      addSection(type);
    }
  });
}

/**
 * セクションを追加
 * @param {string} type - セクションタイプ
 */
export function addSection(type) {
  const typeConfig = SECTION_TYPES[type];
  if (!typeConfig) return;

  if (!canAddSection(type, currentSections)) {
    alert(`${typeConfig.name}はこれ以上追加できません`);
    return;
  }

  // デフォルトのコアセクションタイプ
  const coreTypes = ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
  const isCustomType = !coreTypes.includes(type);

  // カスタムセクションの場合、FAQとapplyの間に挿入
  let insertOrder;
  if (isCustomType) {
    // applyセクションを探す
    const applySection = currentSections.find(s => s.type === 'apply');
    if (applySection) {
      // applyの前に挿入（apply以降のorderを+1）
      insertOrder = applySection.order;
      currentSections.forEach(s => {
        if (s.order >= insertOrder) {
          s.order += 1;
        }
      });
    } else {
      insertOrder = currentSections.length;
    }
  } else {
    insertOrder = currentSections.length;
  }

  const newSection = {
    id: generateSectionId(type),
    type: type,
    order: insertOrder,
    visible: true,
    data: JSON.parse(JSON.stringify(typeConfig.defaultData)),
    layout: JSON.parse(JSON.stringify(typeConfig.defaultLayout))
  };

  currentSections.push(newSection);
  reorderSections();
  renderSectionsList();
  openSectionEditor(newSection.id);
  triggerPreviewUpdate();
}

/**
 * セクションを複製
 * @param {string} sectionId - セクションID
 */
export function duplicateSection(sectionId) {
  const original = currentSections.find(s => s.id === sectionId);
  if (!original) return;

  if (!canAddSection(original.type, currentSections)) {
    alert(`${SECTION_TYPES[original.type]?.name || original.type}はこれ以上追加できません`);
    return;
  }

  const newSection = {
    ...JSON.parse(JSON.stringify(original)),
    id: generateSectionId(original.type),
    order: original.order + 0.5
  };

  currentSections.push(newSection);
  reorderSections();
  renderSectionsList();
  triggerPreviewUpdate();
}

/**
 * セクションを削除
 * @param {string} sectionId - セクションID
 */
export async function deleteSection(sectionId) {
  if (!canDeleteSection(sectionId, currentSections)) {
    alert('このセクションは削除できません');
    return;
  }

  const section = currentSections.find(s => s.id === sectionId);
  const typeName = SECTION_TYPES[section?.type]?.name || section?.type;

  const confirmed = await showConfirmDialog({
    title: 'セクションの削除',
    message: `「${typeName}」セクションを削除しますか？`,
    confirmText: '削除する',
    cancelText: 'キャンセル',
    danger: true
  });
  if (!confirmed) return;

  currentSections = currentSections.filter(s => s.id !== sectionId);
  reorderSections();
  renderSectionsList();
  triggerPreviewUpdate();
}

/**
 * セクションの表示/非表示を切り替え
 * @param {string} sectionId - セクションID
 */
export function toggleSectionVisibility(sectionId) {
  const section = currentSections.find(s => s.id === sectionId);
  if (!section) return;

  section.visible = !section.visible;
  renderSectionsList();
  triggerPreviewUpdate();
}

/**
 * セクションを並び替え
 */
function reorderSections() {
  currentSections.sort((a, b) => (a.order || 0) - (b.order || 0));
  currentSections.forEach((section, index) => {
    section.order = index;
  });
}

/**
 * セクションエディターを開く
 * @param {string} sectionId - セクションID
 */
export function openSectionEditor(sectionId) {
  editingSection = currentSections.find(s => s.id === sectionId);
  if (!editingSection) {
    console.log('[openSectionEditor] Section not found:', sectionId);
    return;
  }

  console.log('[openSectionEditor] Opening editor for:', editingSection.type, editingSection);

  const modal = document.getElementById('section-editor-modal');
  const title = document.getElementById('section-editor-title');
  const content = document.getElementById('section-editor-content');
  const deleteBtn = document.getElementById('section-delete-btn');

  if (!modal || !content) {
    console.error('[openSectionEditor] Modal or content element not found');
    return;
  }

  const typeConfig = SECTION_TYPES[editingSection.type];
  console.log('[openSectionEditor] Type config:', typeConfig);
  title.textContent = `${typeConfig?.name || editingSection.type}を編集`;

  // 削除ボタンの表示制御
  if (deleteBtn) {
    deleteBtn.style.display = typeConfig?.required ? 'none' : 'inline-block';
  }

  const editorHtml = renderSectionEditorContent(editingSection);
  console.log('[openSectionEditor] Editor HTML length:', editorHtml?.length);
  content.innerHTML = editorHtml;
  setupEditorEvents();

  modal.style.display = 'flex';
}

/**
 * セクションエディターを閉じる
 */
export function closeSectionEditor() {
  const modal = document.getElementById('section-editor-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  editingSection = null;
}

/**
 * セクションエディターを保存
 */
function saveSectionEditor() {
  if (!editingSection) return;

  // 現在のフォームデータを取得してセクションに反映
  saveEditorData();

  renderSectionsList();
  triggerPreviewUpdate();
  closeSectionEditor();
}

/**
 * エディターデータを保存
 */
function saveEditorData() {
  if (!editingSection) return;

  switch (editingSection.type) {
    case 'hero':
      editingSection.data.title = document.getElementById('editor-hero-title')?.value || '';
      editingSection.data.subtitle = document.getElementById('editor-hero-subtitle')?.value || '';
      editingSection.data.image = document.getElementById('editor-hero-image')?.value || '';
      break;

    case 'points':
      editingSection.layout.columns = parseInt(document.getElementById('editor-points-columns')?.value || '3');
      editingSection.data.points = collectPointsData();
      break;

    case 'faq':
      editingSection.data.items = collectFAQData();
      break;

    case 'custom':
      editingSection.layout.variant = document.querySelector('input[name="custom-variant"]:checked')?.value || 'text-only';
      editingSection.data.title = document.getElementById('editor-custom-title')?.value || '';
      editingSection.data.content = document.getElementById('editor-custom-content')?.innerHTML || '';
      editingSection.data.image = document.getElementById('editor-custom-image')?.value || '';

      const hasButton = document.getElementById('editor-custom-has-button')?.checked;
      if (hasButton) {
        editingSection.data.button = {
          text: document.getElementById('editor-button-text')?.value || '',
          url: document.getElementById('editor-button-url')?.value || '#',
          style: 'primary'
        };
      } else {
        editingSection.data.button = null;
      }
      break;

    case 'gallery':
      editingSection.layout.columns = parseInt(document.getElementById('editor-gallery-columns')?.value || '3');
      editingSection.layout.style = document.getElementById('editor-gallery-style')?.value || 'grid';
      editingSection.data.sectionTitle = document.getElementById('editor-gallery-title')?.value || '';
      editingSection.data.images = collectGalleryImages();
      break;

    case 'testimonial':
      editingSection.layout.style = document.getElementById('editor-testimonial-style')?.value || 'cards';
      editingSection.data.sectionTitle = document.getElementById('editor-testimonial-title')?.value || '社員の声';
      editingSection.data.testimonials = collectTestimonials();
      break;

    case 'carousel':
      editingSection.data.sectionTitle = document.getElementById('editor-carousel-title')?.value || '';
      editingSection.data.autoPlay = document.getElementById('editor-carousel-autoplay')?.checked ?? true;
      editingSection.data.interval = parseInt(document.getElementById('editor-carousel-interval')?.value || '5000');
      editingSection.layout.showDots = document.getElementById('editor-carousel-dots')?.checked ?? true;
      editingSection.layout.showArrows = document.getElementById('editor-carousel-arrows')?.checked ?? true;
      editingSection.data.images = collectCarouselImages();
      break;

    case 'video':
      editingSection.data.sectionTitle = document.getElementById('editor-video-title')?.value || '';
      editingSection.data.videoUrl = document.getElementById('editor-video-url')?.value || '';
      editingSection.data.videoType = document.getElementById('editor-video-type')?.value || 'youtube';
      editingSection.data.description = document.getElementById('editor-video-description')?.value || '';
      editingSection.layout.aspectRatio = document.getElementById('editor-video-aspect')?.value || '16:9';
      editingSection.layout.fullWidth = document.getElementById('editor-video-fullwidth')?.checked || false;
      break;
  }
}

/**
 * セクションエディターの内容をレンダリング
 * @param {Object} section - セクション設定
 * @returns {string} HTML文字列
 */
function renderSectionEditorContent(section) {
  console.log('[renderSectionEditorContent] Rendering editor for type:', section.type);
  switch (section.type) {
    case 'hero':
      return renderHeroEditor(section);
    case 'points':
      return renderPointsEditor(section);
    case 'faq':
      return renderFAQEditor(section);
    case 'custom':
      return renderCustomEditor(section);
    case 'gallery':
      return renderGalleryEditor(section);
    case 'testimonial':
      return renderTestimonialEditor(section);
    case 'carousel':
      console.log('[renderSectionEditorContent] Rendering carousel editor');
      return renderCarouselEditor(section);
    case 'video':
      console.log('[renderSectionEditorContent] Rendering video editor');
      return renderVideoEditor(section);
    case 'jobs':
    case 'details':
    case 'apply':
      return renderStaticSectionEditor(section);
    default:
      console.log('[renderSectionEditorContent] Unknown type, returning default');
      return '<p>このセクションは編集できません</p>';
  }
}

/**
 * ヒーローエディター
 */
function renderHeroEditor(section) {
  return `
    <div class="editor-section">
      <div class="form-group">
        <label for="editor-hero-title">メインタイトル</label>
        <input type="text" id="editor-hero-title" value="${escapeHtml(section.data?.title || '')}" placeholder="例: 月収32万円以上可！入社特典あり">
      </div>
      <div class="form-group">
        <label for="editor-hero-subtitle">サブタイトル</label>
        <input type="text" id="editor-hero-subtitle" value="${escapeHtml(section.data?.subtitle || '')}" placeholder="例: 未経験者歓迎！充実の研修制度">
      </div>
      <div class="form-group">
        <label>背景画像</label>
        <div id="hero-image-uploader-container" data-current-url="${escapeHtml(section.data?.image || '')}"></div>
        <input type="hidden" id="editor-hero-image" value="${escapeHtml(section.data?.image || '')}">
      </div>
    </div>
  `;
}

/**
 * ポイントエディター
 */
function renderPointsEditor(section) {
  const points = section.data?.points || [];
  return `
    <div class="editor-section">
      <h4>レイアウト設定</h4>
      <div class="form-group">
        <label for="editor-points-columns">カラム数</label>
        <select id="editor-points-columns">
          <option value="2" ${section.layout?.columns === 2 ? 'selected' : ''}>2列</option>
          <option value="3" ${section.layout?.columns === 3 ? 'selected' : ''}>3列</option>
          <option value="4" ${section.layout?.columns === 4 ? 'selected' : ''}>4列</option>
        </select>
      </div>
    </div>

    <div class="editor-section">
      <h4>ポイント一覧</h4>
      <div id="editor-points-list" class="editor-items-list">
        ${points.map((p, i) => renderPointItem(p, i)).join('')}
      </div>
      <button type="button" id="editor-add-point" class="btn-add-item">
        <span>+</span> ポイントを追加
      </button>
    </div>
  `;
}

/**
 * ポイントアイテム
 */
function renderPointItem(point, index) {
  return `
    <div class="editor-item" data-index="${index}">
      <div class="editor-item-header">
        <span class="drag-handle">⋮⋮</span>
        <span>ポイント ${index + 1}</span>
        <button type="button" class="btn-remove-item" data-index="${index}">×</button>
      </div>
      <div class="form-group">
        <label>タイトル</label>
        <input type="text" class="point-title" value="${escapeHtml(point.title || '')}">
      </div>
      <div class="form-group">
        <label>説明</label>
        <textarea class="point-desc" rows="2">${escapeHtml(point.description || '')}</textarea>
      </div>
    </div>
  `;
}

/**
 * FAQエディター
 */
function renderFAQEditor(section) {
  const items = section.data?.items || [];
  return `
    <div class="editor-section">
      <h4>よくある質問</h4>
      <div id="editor-faq-list" class="editor-items-list">
        ${items.map((item, i) => renderFAQItem(item, i)).join('')}
      </div>
      <button type="button" id="editor-add-faq" class="btn-add-item">
        <span>+</span> Q&Aを追加
      </button>
    </div>
  `;
}

/**
 * FAQアイテム
 */
function renderFAQItem(item, index) {
  return `
    <div class="editor-item" data-index="${index}">
      <div class="editor-item-header">
        <span class="drag-handle">⋮⋮</span>
        <span>Q&A ${index + 1}</span>
        <button type="button" class="btn-remove-item" data-index="${index}">×</button>
      </div>
      <div class="form-group">
        <label>質問</label>
        <input type="text" class="faq-question" value="${escapeHtml(item.question || '')}">
      </div>
      <div class="form-group">
        <label>回答</label>
        <textarea class="faq-answer" rows="3">${escapeHtml(item.answer || '')}</textarea>
      </div>
    </div>
  `;
}

/**
 * カスタムセクションエディター
 */
function renderCustomEditor(section) {
  const variant = section.layout?.variant || 'text-only';
  const hasButton = !!section.data?.button;

  return `
    <div class="editor-section">
      <h4>レイアウト</h4>
      <div class="variant-selector">
        ${Object.entries(CUSTOM_VARIANTS).map(([key, config]) => `
          <label class="variant-option ${variant === key ? 'selected' : ''}">
            <input type="radio" name="custom-variant" value="${key}" ${variant === key ? 'checked' : ''}>
            <span class="variant-icon">${config.icon}</span>
            <span class="variant-name">${config.name}</span>
          </label>
        `).join('')}
      </div>
    </div>

    <div class="editor-section">
      <h4>コンテンツ</h4>
      <div class="form-group">
        <label for="editor-custom-title">タイトル</label>
        <input type="text" id="editor-custom-title" value="${escapeHtml(section.data?.title || '')}">
      </div>
      <div class="form-group">
        <label for="editor-custom-content">本文</label>
        <div id="editor-custom-content" class="rich-editor" contenteditable="true">${section.data?.content || ''}</div>
        <p class="form-hint">**太字** や *斜体* が使えます</p>
      </div>
      <div class="form-group" id="custom-image-field">
        <label>画像</label>
        <div id="custom-image-uploader-container" data-current-url="${escapeHtml(section.data?.image || '')}"></div>
        <input type="hidden" id="editor-custom-image" value="${escapeHtml(section.data?.image || '')}">
      </div>
    </div>

    <div class="editor-section">
      <h4>ボタン</h4>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="editor-custom-has-button" ${hasButton ? 'checked' : ''}>
          ボタンを追加
        </label>
      </div>
      <div id="button-fields" style="${hasButton ? '' : 'display:none'}">
        <div class="form-group">
          <label for="editor-button-text">ボタンテキスト</label>
          <input type="text" id="editor-button-text" value="${escapeHtml(section.data?.button?.text || '')}">
        </div>
        <div class="form-group">
          <label for="editor-button-url">リンク先URL</label>
          <input type="text" id="editor-button-url" value="${escapeHtml(section.data?.button?.url || '#')}">
        </div>
      </div>
    </div>
  `;
}

/**
 * ギャラリーエディター
 */
function renderGalleryEditor(section) {
  const images = section.data?.images || [];
  return `
    <div class="editor-section">
      <h4>設定</h4>
      <div class="form-row">
        <div class="form-group">
          <label for="editor-gallery-title">セクションタイトル</label>
          <input type="text" id="editor-gallery-title" value="${escapeHtml(section.data?.sectionTitle || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="editor-gallery-columns">カラム数</label>
          <select id="editor-gallery-columns">
            <option value="2" ${section.layout?.columns === 2 ? 'selected' : ''}>2列</option>
            <option value="3" ${section.layout?.columns === 3 ? 'selected' : ''}>3列</option>
            <option value="4" ${section.layout?.columns === 4 ? 'selected' : ''}>4列</option>
          </select>
        </div>
        <div class="form-group">
          <label for="editor-gallery-style">スタイル</label>
          <select id="editor-gallery-style">
            <option value="grid" ${section.layout?.style === 'grid' ? 'selected' : ''}>グリッド</option>
            <option value="masonry" ${section.layout?.style === 'masonry' ? 'selected' : ''}>メイソンリー</option>
            <option value="slider" ${section.layout?.style === 'slider' ? 'selected' : ''}>スライダー</option>
          </select>
        </div>
      </div>
    </div>

    <div class="editor-section">
      <h4>画像一覧</h4>
      <div id="editor-gallery-list" class="editor-items-list gallery-items">
        ${images.map((img, i) => renderGalleryItem(img, i)).join('')}
      </div>
      <button type="button" id="editor-add-gallery-image" class="btn-add-item">
        <span>+</span> 画像を追加
      </button>
    </div>
  `;
}

/**
 * ギャラリーアイテム
 */
function renderGalleryItem(image, index) {
  const url = typeof image === 'string' ? image : image.url;
  const caption = typeof image === 'object' ? image.caption : '';

  return `
    <div class="editor-item gallery-item" data-index="${index}">
      <div class="editor-item-header">
        <span class="drag-handle">⋮⋮</span>
        <span>画像 ${index + 1}</span>
        <button type="button" class="btn-remove-item" data-index="${index}">×</button>
      </div>
      <div class="form-group">
        <label>画像</label>
        <div class="gallery-image-uploader-container" data-current-url="${escapeHtml(url || '')}"></div>
        <input type="hidden" class="gallery-url" value="${escapeHtml(url || '')}">
      </div>
      <div class="form-group">
        <label>キャプション（任意）</label>
        <input type="text" class="gallery-caption" value="${escapeHtml(caption || '')}">
      </div>
    </div>
  `;
}

/**
 * 社員の声エディター
 */
function renderTestimonialEditor(section) {
  const testimonials = section.data?.testimonials || [];
  return `
    <div class="editor-section">
      <h4>設定</h4>
      <div class="form-row">
        <div class="form-group">
          <label for="editor-testimonial-title">セクションタイトル</label>
          <input type="text" id="editor-testimonial-title" value="${escapeHtml(section.data?.sectionTitle || '社員の声')}">
        </div>
        <div class="form-group">
          <label for="editor-testimonial-style">スタイル</label>
          <select id="editor-testimonial-style">
            <option value="cards" ${section.layout?.style === 'cards' ? 'selected' : ''}>カード</option>
            <option value="list" ${section.layout?.style === 'list' ? 'selected' : ''}>リスト</option>
            <option value="slider" ${section.layout?.style === 'slider' ? 'selected' : ''}>スライダー</option>
          </select>
        </div>
      </div>
    </div>

    <div class="editor-section">
      <h4>社員一覧</h4>
      <div id="editor-testimonial-list" class="editor-items-list">
        ${testimonials.map((t, i) => renderTestimonialItem(t, i)).join('')}
      </div>
      <button type="button" id="editor-add-testimonial" class="btn-add-item">
        <span>+</span> 社員を追加
      </button>
    </div>
  `;
}

/**
 * 社員の声アイテム
 */
function renderTestimonialItem(testimonial, index) {
  return `
    <div class="editor-item" data-index="${index}">
      <div class="editor-item-header">
        <span class="drag-handle">⋮⋮</span>
        <span>社員 ${index + 1}</span>
        <button type="button" class="btn-remove-item" data-index="${index}">×</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>名前</label>
          <input type="text" class="testimonial-name" value="${escapeHtml(testimonial.name || '')}">
        </div>
        <div class="form-group">
          <label>役職・部署</label>
          <input type="text" class="testimonial-role" value="${escapeHtml(testimonial.role || '')}">
        </div>
      </div>
      <div class="form-group">
        <label>コメント</label>
        <textarea class="testimonial-quote" rows="3">${escapeHtml(testimonial.quote || '')}</textarea>
      </div>
      <div class="form-group">
        <label>写真URL（任意）</label>
        <input type="text" class="testimonial-avatar" value="${escapeHtml(testimonial.avatar || '')}">
      </div>
    </div>
  `;
}

/**
 * カルーセルエディター
 */
function renderCarouselEditor(section) {
  const images = section.data?.images || [];
  const autoPlay = section.data?.autoPlay !== false;
  const interval = section.data?.interval || 5000;

  return `
    <div class="editor-section">
      <h4>設定</h4>
      <div class="form-row">
        <div class="form-group">
          <label for="editor-carousel-title">セクションタイトル</label>
          <input type="text" id="editor-carousel-title" value="${escapeHtml(section.data?.sectionTitle || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="editor-carousel-autoplay" ${autoPlay ? 'checked' : ''}>
            自動再生
          </label>
        </div>
        <div class="form-group">
          <label for="editor-carousel-interval">切替間隔（ミリ秒）</label>
          <input type="number" id="editor-carousel-interval" value="${interval}" min="1000" step="500">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="editor-carousel-dots" ${section.layout?.showDots !== false ? 'checked' : ''}>
            ドット表示
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="editor-carousel-arrows" ${section.layout?.showArrows !== false ? 'checked' : ''}>
            矢印表示
          </label>
        </div>
      </div>
    </div>

    <div class="editor-section">
      <h4>画像一覧</h4>
      <div id="editor-carousel-list" class="editor-items-list carousel-items">
        ${images.map((img, i) => renderCarouselItem(img, i)).join('')}
      </div>
      <button type="button" id="editor-add-carousel-image" class="btn-add-item">
        <span>+</span> 画像を追加
      </button>
    </div>
  `;
}

/**
 * カルーセルアイテム
 */
function renderCarouselItem(image, index) {
  const url = typeof image === 'string' ? image : image.url;
  const caption = typeof image === 'object' ? image.caption : '';
  const alt = typeof image === 'object' ? image.alt : '';

  return `
    <div class="editor-item carousel-item" data-index="${index}">
      <div class="editor-item-header">
        <span class="drag-handle">⋮⋮</span>
        <span>画像 ${index + 1}</span>
        <button type="button" class="btn-remove-item" data-index="${index}">×</button>
      </div>
      <div class="form-group">
        <label>画像</label>
        <div class="carousel-image-uploader-container" data-current-url="${escapeHtml(url || '')}"></div>
        <input type="hidden" class="carousel-url" value="${escapeHtml(url || '')}">
      </div>
      <div class="form-group">
        <label>キャプション（任意）</label>
        <input type="text" class="carousel-caption" value="${escapeHtml(caption || '')}" placeholder="画像の説明文">
      </div>
      <div class="form-group">
        <label>代替テキスト（任意）</label>
        <input type="text" class="carousel-alt" value="${escapeHtml(alt || '')}" placeholder="画像が表示されない場合のテキスト">
      </div>
    </div>
  `;
}

/**
 * 動画エディター
 */
function renderVideoEditor(section) {
  const videoUrl = section.data?.videoUrl || '';
  const videoType = section.data?.videoType || 'youtube';
  const description = section.data?.description || '';
  const aspectRatio = section.layout?.aspectRatio || '16:9';
  const fullWidth = section.layout?.fullWidth || false;

  return `
    <div class="editor-section">
      <h4>動画設定</h4>
      <div class="form-group">
        <label for="editor-video-title">セクションタイトル</label>
        <input type="text" id="editor-video-title" value="${escapeHtml(section.data?.sectionTitle || '')}">
      </div>
      <div class="form-group">
        <label for="editor-video-url">動画URL</label>
        <input type="url" id="editor-video-url" value="${escapeHtml(videoUrl)}" placeholder="https://www.youtube.com/watch?v=xxxxx">
        <p class="form-hint">YouTube, Vimeo, または直接動画ファイルのURLを入力</p>
      </div>
      <div class="form-group">
        <label for="editor-video-type">動画タイプ</label>
        <select id="editor-video-type">
          <option value="youtube" ${videoType === 'youtube' ? 'selected' : ''}>YouTube</option>
          <option value="vimeo" ${videoType === 'vimeo' ? 'selected' : ''}>Vimeo</option>
          <option value="tiktok" ${videoType === 'tiktok' ? 'selected' : ''}>TikTok</option>
          <option value="direct" ${videoType === 'direct' ? 'selected' : ''}>直接ファイル（MP4等）</option>
          <option value="iframe" ${videoType === 'iframe' ? 'selected' : ''}>その他（iframe）</option>
        </select>
      </div>
      <div class="form-group">
        <label for="editor-video-description">説明文（任意）</label>
        <textarea id="editor-video-description" rows="2" placeholder="動画の説明文">${escapeHtml(description)}</textarea>
      </div>
    </div>

    <div class="editor-section">
      <h4>表示設定</h4>
      <div class="form-row">
        <div class="form-group">
          <label for="editor-video-aspect">アスペクト比</label>
          <select id="editor-video-aspect">
            <option value="16:9" ${aspectRatio === '16:9' ? 'selected' : ''}>16:9（横長）</option>
            <option value="4:3" ${aspectRatio === '4:3' ? 'selected' : ''}>4:3（標準）</option>
            <option value="1:1" ${aspectRatio === '1:1' ? 'selected' : ''}>1:1（正方形）</option>
            <option value="9:16" ${aspectRatio === '9:16' ? 'selected' : ''}>9:16（縦長）</option>
          </select>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="editor-video-fullwidth" ${fullWidth ? 'checked' : ''}>
            全幅表示
          </label>
        </div>
      </div>
    </div>

    <div class="editor-section">
      <h4>プレビュー</h4>
      <div id="editor-video-preview" class="video-preview">
        ${videoUrl ? generateVideoPreview(videoUrl, videoType) : '<p class="preview-empty">URLを入力するとプレビューが表示されます</p>'}
      </div>
    </div>
  `;
}

/**
 * 動画プレビューを生成
 */
function generateVideoPreview(url, type) {
  if (!url) return '';

  // YouTubeの場合
  if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return `
        <div class="video-preview-card video-preview-youtube">
          <div class="video-preview-icon">▶️</div>
          <div class="video-preview-info">
            <span class="video-preview-type">YouTube</span>
            <span class="video-preview-id">ID: ${escapeHtml(videoId)}</span>
          </div>
        </div>
      `;
    }
  }

  // Vimeoの場合
  if (type === 'vimeo' || url.includes('vimeo.com')) {
    return `
      <div class="video-preview-card video-preview-vimeo">
        <div class="video-preview-icon">▶️</div>
        <div class="video-preview-info">
          <span class="video-preview-type">Vimeo</span>
          <span class="video-preview-url">${escapeHtml(url.substring(0, 50))}...</span>
        </div>
      </div>
    `;
  }

  // TikTokの場合
  if (type === 'tiktok' || url.includes('tiktok.com')) {
    return `
      <div class="video-preview-card video-preview-tiktok">
        <div class="video-preview-icon">🎵</div>
        <div class="video-preview-info">
          <span class="video-preview-type">TikTok</span>
          <span class="video-preview-url">${escapeHtml(url.substring(0, 50))}...</span>
        </div>
      </div>
    `;
  }

  // その他
  return `
    <div class="video-preview-card video-preview-other">
      <div class="video-preview-icon">🎬</div>
      <div class="video-preview-info">
        <span class="video-preview-type">動画</span>
        <span class="video-preview-url">${escapeHtml(url.substring(0, 50))}${url.length > 50 ? '...' : ''}</span>
      </div>
    </div>
  `;
}

/**
 * YouTubeのIDを抽出
 */
function extractYouTubeId(url) {
  let match = url.match(/[?&]v=([^&]+)/);
  if (match) return match[1];

  match = url.match(/youtu\.be\/([^?&]+)/);
  if (match) return match[1];

  match = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (match) return match[1];

  match = url.match(/youtube\.com\/shorts\/([^?&]+)/);
  if (match) return match[1];

  return null;
}

/**
 * 静的セクションエディター
 */
function renderStaticSectionEditor(section) {
  const typeConfig = SECTION_TYPES[section.type];
  return `
    <div class="editor-section">
      <p class="editor-info">
        「${typeConfig?.name || section.type}」セクションは、会社データや求人データから自動生成されます。<br>
        表示/非表示の切り替えと並び順の変更のみ可能です。
      </p>
    </div>
  `;
}

/**
 * エディターイベントを設定
 */
function setupEditorEvents() {
  // 画像アップローダーをクリア
  activeImageUploaders = {};

  // Hero画像アップローダーの設定
  setupHeroImageUploader();

  // Custom画像アップローダーの設定
  setupCustomImageUploader();

  // Gallery画像アップローダーの設定
  setupGalleryImageUploaders();

  // ポイント追加
  const addPointBtn = document.getElementById('editor-add-point');
  if (addPointBtn) {
    addPointBtn.addEventListener('click', () => {
      const list = document.getElementById('editor-points-list');
      const index = list.querySelectorAll('.editor-item').length;
      list.insertAdjacentHTML('beforeend', renderPointItem({ title: '', description: '' }, index));
      setupRemoveButtons();
    });
  }

  // FAQ追加
  const addFaqBtn = document.getElementById('editor-add-faq');
  if (addFaqBtn) {
    addFaqBtn.addEventListener('click', () => {
      const list = document.getElementById('editor-faq-list');
      const index = list.querySelectorAll('.editor-item').length;
      list.insertAdjacentHTML('beforeend', renderFAQItem({ question: '', answer: '' }, index));
      setupRemoveButtons();
    });
  }

  // ギャラリー画像追加
  const addGalleryBtn = document.getElementById('editor-add-gallery-image');
  if (addGalleryBtn) {
    addGalleryBtn.addEventListener('click', () => {
      const list = document.getElementById('editor-gallery-list');
      const index = list.querySelectorAll('.editor-item').length;
      list.insertAdjacentHTML('beforeend', renderGalleryItem('', index));
      setupRemoveButtons();
      // 新しく追加されたアイテムにアップローダーを設定
      setupSingleGalleryUploader(index);
    });
  }

  // 社員追加
  const addTestimonialBtn = document.getElementById('editor-add-testimonial');
  if (addTestimonialBtn) {
    addTestimonialBtn.addEventListener('click', () => {
      const list = document.getElementById('editor-testimonial-list');
      const index = list.querySelectorAll('.editor-item').length;
      list.insertAdjacentHTML('beforeend', renderTestimonialItem({ name: '', role: '', quote: '' }, index));
      setupRemoveButtons();
    });
  }

  // カルーセル画像追加
  const addCarouselBtn = document.getElementById('editor-add-carousel-image');
  if (addCarouselBtn) {
    addCarouselBtn.addEventListener('click', () => {
      const list = document.getElementById('editor-carousel-list');
      const index = list.querySelectorAll('.editor-item').length;
      list.insertAdjacentHTML('beforeend', renderCarouselItem('', index));
      setupRemoveButtons();
      setupSingleCarouselUploader(index);
    });
  }

  // カルーセル画像アップローダーの設定
  setupCarouselImageUploaders();

  // 動画URLプレビュー更新
  const videoUrlInput = document.getElementById('editor-video-url');
  const videoTypeSelect = document.getElementById('editor-video-type');
  if (videoUrlInput) {
    videoUrlInput.addEventListener('input', () => {
      updateVideoPreview();
    });
  }
  if (videoTypeSelect) {
    videoTypeSelect.addEventListener('change', () => {
      updateVideoPreview();
    });
  }

  // カスタムセクションのボタン表示切替
  const hasButtonCheckbox = document.getElementById('editor-custom-has-button');
  if (hasButtonCheckbox) {
    hasButtonCheckbox.addEventListener('change', () => {
      const buttonFields = document.getElementById('button-fields');
      if (buttonFields) {
        buttonFields.style.display = hasButtonCheckbox.checked ? '' : 'none';
      }
    });
  }

  // バリエーション選択
  document.querySelectorAll('input[name="custom-variant"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.variant-option').forEach(opt => {
        opt.classList.toggle('selected', opt.querySelector('input').checked);
      });
    });
  });

  // 削除ボタン設定
  setupRemoveButtons();
}

/**
 * 削除ボタンを設定
 */
function setupRemoveButtons() {
  document.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.onclick = (e) => {
      const item = e.target.closest('.editor-item');
      if (item) {
        item.remove();
        // インデックスを再設定
        const list = item.parentElement || document.querySelector('.editor-items-list');
        if (list) {
          list.querySelectorAll('.editor-item').forEach((el, i) => {
            el.dataset.index = i;
            const header = el.querySelector('.editor-item-header span:nth-child(2)');
            if (header) {
              header.textContent = header.textContent.replace(/\d+/, i + 1);
            }
          });
        }
      }
    };
  });
}

/**
 * ポイントデータを収集
 */
function collectPointsData() {
  const points = [];
  document.querySelectorAll('#editor-points-list .editor-item').forEach((item, i) => {
    const title = item.querySelector('.point-title')?.value || '';
    const description = item.querySelector('.point-desc')?.value || '';
    if (title || description) {
      points.push({ id: `p${i + 1}`, title, description });
    }
  });
  return points;
}

/**
 * FAQデータを収集
 */
function collectFAQData() {
  const items = [];
  document.querySelectorAll('#editor-faq-list .editor-item').forEach((item, i) => {
    const question = item.querySelector('.faq-question')?.value || '';
    const answer = item.querySelector('.faq-answer')?.value || '';
    if (question && answer) {
      items.push({ id: `faq-${i + 1}`, question, answer });
    }
  });
  return items;
}

/**
 * ギャラリー画像を収集
 */
function collectGalleryImages() {
  const images = [];
  document.querySelectorAll('#editor-gallery-list .editor-item').forEach(item => {
    const url = item.querySelector('.gallery-url')?.value || '';
    const caption = item.querySelector('.gallery-caption')?.value || '';
    if (url) {
      images.push({ url, caption });
    }
  });
  return images;
}

/**
 * カルーセル画像を収集
 */
function collectCarouselImages() {
  const images = [];
  document.querySelectorAll('#editor-carousel-list .editor-item').forEach(item => {
    const url = item.querySelector('.carousel-url')?.value || '';
    const caption = item.querySelector('.carousel-caption')?.value || '';
    const alt = item.querySelector('.carousel-alt')?.value || '';
    if (url) {
      images.push({ url, caption, alt });
    }
  });
  return images;
}

/**
 * 社員データを収集
 */
function collectTestimonials() {
  const testimonials = [];
  document.querySelectorAll('#editor-testimonial-list .editor-item').forEach(item => {
    const name = item.querySelector('.testimonial-name')?.value || '';
    const role = item.querySelector('.testimonial-role')?.value || '';
    const quote = item.querySelector('.testimonial-quote')?.value || '';
    const avatar = item.querySelector('.testimonial-avatar')?.value || '';
    if (name || quote) {
      testimonials.push({ name, role, quote, avatar });
    }
  });
  return testimonials;
}

/**
 * プレビュー更新をトリガー
 */
function triggerPreviewUpdate() {
  if (typeof onPreviewUpdate === 'function') {
    onPreviewUpdate();
  }
}

/**
 * Hero画像アップローダーをセットアップ
 */
function setupHeroImageUploader() {
  const container = document.getElementById('hero-image-uploader-container');
  if (!container) return;

  const currentUrl = container.dataset.currentUrl || '';
  const hiddenInput = document.getElementById('editor-hero-image');
  const companyDomain = getCompanyDomain?.() || 'default';

  const uploader = createImageUploader({
    id: 'hero-image-uploader',
    label: '',
    currentUrl: currentUrl,
    uploadFn: (file) => uploadLPImage(file, companyDomain),
    onUpload: (url) => {
      if (hiddenInput) hiddenInput.value = url;
      if (editingSection) editingSection.data.image = url;
      triggerPreviewUpdate();
    }
  });

  container.innerHTML = '';
  container.appendChild(uploader);
  activeImageUploaders.hero = uploader;
}

/**
 * Custom画像アップローダーをセットアップ
 */
function setupCustomImageUploader() {
  const container = document.getElementById('custom-image-uploader-container');
  if (!container) return;

  const currentUrl = container.dataset.currentUrl || '';
  const hiddenInput = document.getElementById('editor-custom-image');
  const companyDomain = getCompanyDomain?.() || 'default';

  const uploader = createImageUploader({
    id: 'custom-image-uploader',
    label: '',
    currentUrl: currentUrl,
    uploadFn: (file) => uploadLPImage(file, companyDomain),
    onUpload: (url) => {
      if (hiddenInput) hiddenInput.value = url;
      if (editingSection) editingSection.data.image = url;
      triggerPreviewUpdate();
    }
  });

  container.innerHTML = '';
  container.appendChild(uploader);
  activeImageUploaders.custom = uploader;
}

/**
 * Gallery画像アップローダーをセットアップ
 */
function setupGalleryImageUploaders() {
  const list = document.getElementById('editor-gallery-list');
  if (!list) return;

  const companyDomain = getCompanyDomain?.() || 'default';

  // 各ギャラリーアイテムにアップローダーを追加
  list.querySelectorAll('.gallery-item').forEach((item, index) => {
    const container = item.querySelector('.gallery-image-uploader-container');
    if (!container) return;

    const currentUrl = container.dataset.currentUrl || '';
    const urlInput = item.querySelector('.gallery-url');

    const uploader = createImageUploader({
      id: `gallery-image-uploader-${index}`,
      label: '',
      currentUrl: currentUrl,
      uploadFn: (file) => uploadLPImage(file, companyDomain),
      onUpload: (url) => {
        if (urlInput) urlInput.value = url;
        triggerPreviewUpdate();
      }
    });

    container.innerHTML = '';
    container.appendChild(uploader);
    activeImageUploaders[`gallery-${index}`] = uploader;
  });
}

/**
 * 単一のGallery画像アップローダーをセットアップ（動的追加用）
 * @param {number} index - ギャラリーアイテムのインデックス
 */
function setupSingleGalleryUploader(index) {
  const list = document.getElementById('editor-gallery-list');
  if (!list) return;

  const item = list.querySelectorAll('.gallery-item')[index];
  if (!item) return;

  const container = item.querySelector('.gallery-image-uploader-container');
  if (!container) return;

  const currentUrl = container.dataset.currentUrl || '';
  const urlInput = item.querySelector('.gallery-url');
  const companyDomain = getCompanyDomain?.() || 'default';

  const uploader = createImageUploader({
    id: `gallery-image-uploader-${index}`,
    label: '',
    currentUrl: currentUrl,
    uploadFn: (file) => uploadLPImage(file, companyDomain),
    onUpload: (url) => {
      if (urlInput) urlInput.value = url;
      triggerPreviewUpdate();
    }
  });

  container.innerHTML = '';
  container.appendChild(uploader);
  activeImageUploaders[`gallery-${index}`] = uploader;
}

/**
 * カルーセル画像アップローダーをセットアップ
 */
function setupCarouselImageUploaders() {
  const list = document.getElementById('editor-carousel-list');
  if (!list) return;

  const companyDomain = getCompanyDomain?.() || 'default';

  list.querySelectorAll('.carousel-item').forEach((item, index) => {
    const container = item.querySelector('.carousel-image-uploader-container');
    if (!container) return;

    const currentUrl = container.dataset.currentUrl || '';
    const urlInput = item.querySelector('.carousel-url');

    const uploader = createImageUploader({
      id: `carousel-image-uploader-${index}`,
      label: '',
      currentUrl: currentUrl,
      uploadFn: (file) => uploadLPImage(file, companyDomain),
      onUpload: (url) => {
        if (urlInput) urlInput.value = url;
        triggerPreviewUpdate();
      }
    });

    container.innerHTML = '';
    container.appendChild(uploader);
    activeImageUploaders[`carousel-${index}`] = uploader;
  });
}

/**
 * 単一のカルーセル画像アップローダーをセットアップ（動的追加用）
 * @param {number} index - カルーセルアイテムのインデックス
 */
function setupSingleCarouselUploader(index) {
  const list = document.getElementById('editor-carousel-list');
  if (!list) return;

  const item = list.querySelectorAll('.carousel-item')[index];
  if (!item) return;

  const container = item.querySelector('.carousel-image-uploader-container');
  if (!container) return;

  const currentUrl = container.dataset.currentUrl || '';
  const urlInput = item.querySelector('.carousel-url');
  const companyDomain = getCompanyDomain?.() || 'default';

  const uploader = createImageUploader({
    id: `carousel-image-uploader-${index}`,
    label: '',
    currentUrl: currentUrl,
    uploadFn: (file) => uploadLPImage(file, companyDomain),
    onUpload: (url) => {
      if (urlInput) urlInput.value = url;
      triggerPreviewUpdate();
    }
  });

  container.innerHTML = '';
  container.appendChild(uploader);
  activeImageUploaders[`carousel-${index}`] = uploader;
}

/**
 * 動画プレビューを更新
 */
function updateVideoPreview() {
  const previewEl = document.getElementById('editor-video-preview');
  const urlInput = document.getElementById('editor-video-url');
  const typeSelect = document.getElementById('editor-video-type');

  if (!previewEl || !urlInput) return;

  const url = urlInput.value.trim();
  const type = typeSelect?.value || 'youtube';

  if (!url) {
    previewEl.innerHTML = '<p class="preview-empty">URLを入力するとプレビューが表示されます</p>';
    return;
  }

  previewEl.innerHTML = generateVideoPreview(url, type);
}

export default {
  initSectionManager,
  loadSectionsFromSettings,
  getCurrentLPContent,
  updateGlobalSetting,
  renderSectionsList,
  addSection,
  duplicateSection,
  deleteSection,
  toggleSectionVisibility,
  openSectionEditor,
  closeSectionEditor,
  applyTemplate
};
