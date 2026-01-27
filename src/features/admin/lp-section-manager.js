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
  const currentLayoutStyle = globalSettings.layoutStyle || 'default';

  // レイアウトスタイルセレクターをレンダリング
  container.innerHTML = renderLayoutStyleSelector(currentLayoutStyle);

  // イベントをセットアップ
  setupLayoutStyleEvents(container);
}

/**
 * レイアウトスタイルセレクターをレンダリング（LPエディタと同じUI）
 */
function renderLayoutStyleSelector(selectedLayout = 'default') {
  const options = LAYOUT_STYLES.map(style => {
    const isSelected = selectedLayout === style.id;
    return `
      <div class="lp-admin-layout-option ${isSelected ? 'selected' : ''}"
           data-layout="${style.id}"
           title="${style.description}">
        <div class="lp-admin-layout-preview">
          <span class="lp-admin-layout-preview-text">${style.preview}</span>
        </div>
        <div class="lp-admin-layout-info">
          <span class="lp-admin-layout-name">${style.name}</span>
          <span class="lp-admin-layout-desc">${style.description}</span>
        </div>
        ${isSelected ? '<span class="lp-admin-layout-check">✓</span>' : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="lp-admin-layout-selector">
      ${options}
    </div>
  `;
}

/**
 * レイアウトスタイル選択イベントをセットアップ
 */
function setupLayoutStyleEvents(container) {
  container.querySelectorAll('.lp-admin-layout-option').forEach(option => {
    option.addEventListener('click', () => {
      const layoutId = option.dataset.layout;

      // 選択状態を更新
      container.querySelectorAll('.lp-admin-layout-option').forEach(opt => {
        opt.classList.toggle('selected', opt === option);
        const check = opt.querySelector('.lp-admin-layout-check');
        if (opt === option) {
          if (!check) {
            const checkSpan = document.createElement('span');
            checkSpan.className = 'lp-admin-layout-check';
            checkSpan.textContent = '✓';
            opt.appendChild(checkSpan);
          }
        } else if (check) {
          check.remove();
        }
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
export function applyTemplate(template) {
  if (!template) return;

  // 確認ダイアログ
  if (currentSections.length > 0) {
    const confirmed = confirm(
      `テンプレート「${template.name}」を適用しますか？\n\n` +
      '現在のセクション構成は置き換えられます。\n' +
      'この操作は取り消せません。'
    );
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

  const currentLayoutStyle = globalSettings.layoutStyle || 'default';

  // 既存の選択をクリア
  container.querySelectorAll('.lp-admin-layout-option').forEach(opt => {
    const isSelected = opt.dataset.layout === currentLayoutStyle;
    opt.classList.toggle('selected', isSelected);

    // チェックマークを更新
    let check = opt.querySelector('.lp-admin-layout-check');
    if (isSelected) {
      if (!check) {
        const checkSpan = document.createElement('span');
        checkSpan.className = 'lp-admin-layout-check';
        checkSpan.textContent = '✓';
        opt.appendChild(checkSpan);
      }
    } else if (check) {
      check.remove();
    }
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
  if (!container) return;

  const sortedSections = [...currentSections].sort((a, b) => (a.order || 0) - (b.order || 0));

  container.innerHTML = sortedSections.map(section => renderSectionItem(section)).join('');

  // ドラッグ&ドロップを再設定
  setupDragAndDrop();
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

  // モーダル閉じるボタン
  const closeAddModal = document.getElementById('add-section-modal-close');
  if (closeAddModal) {
    closeAddModal.addEventListener('click', closeAddSectionModal);
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
 * セクション追加モーダルを開く
 */
function openAddSectionModal() {
  const modal = document.getElementById('add-section-modal');
  const grid = document.getElementById('section-type-grid');

  if (!modal || !grid) return;

  // セクションタイプグリッドを生成
  grid.innerHTML = Object.entries(SECTION_TYPES)
    .filter(([type]) => !SECTION_TYPES[type].required || canAddSection(type, currentSections))
    .map(([type, config]) => `
      <div class="section-type-card" data-type="${type}" ${!canAddSection(type, currentSections) ? 'disabled' : ''}>
        <span class="type-icon">${config.icon}</span>
        <span class="type-name">${config.name}</span>
        ${config.maxInstances === 1 && !canAddSection(type, currentSections) ? '<span class="type-limit">追加済み</span>' : ''}
      </div>
    `).join('');

  // クリックイベント
  grid.querySelectorAll('.section-type-card:not([disabled])').forEach(card => {
    card.addEventListener('click', () => {
      addSection(card.dataset.type);
      closeAddSectionModal();
    });
  });

  modal.style.display = 'flex';
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

  const newSection = {
    id: generateSectionId(type),
    type: type,
    order: currentSections.length,
    visible: true,
    data: JSON.parse(JSON.stringify(typeConfig.defaultData)),
    layout: JSON.parse(JSON.stringify(typeConfig.defaultLayout))
  };

  currentSections.push(newSection);
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
export function deleteSection(sectionId) {
  if (!canDeleteSection(sectionId, currentSections)) {
    alert('このセクションは削除できません');
    return;
  }

  const section = currentSections.find(s => s.id === sectionId);
  const typeName = SECTION_TYPES[section?.type]?.name || section?.type;

  if (!confirm(`「${typeName}」セクションを削除しますか？`)) return;

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
  if (!editingSection) return;

  const modal = document.getElementById('section-editor-modal');
  const title = document.getElementById('section-editor-title');
  const content = document.getElementById('section-editor-content');
  const deleteBtn = document.getElementById('section-delete-btn');

  const typeConfig = SECTION_TYPES[editingSection.type];
  title.textContent = `${typeConfig?.name || editingSection.type}を編集`;

  // 削除ボタンの表示制御
  if (deleteBtn) {
    deleteBtn.style.display = typeConfig?.required ? 'none' : 'inline-block';
  }

  content.innerHTML = renderSectionEditorContent(editingSection);
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
  }
}

/**
 * セクションエディターの内容をレンダリング
 * @param {Object} section - セクション設定
 * @returns {string} HTML文字列
 */
function renderSectionEditorContent(section) {
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
    case 'jobs':
    case 'details':
    case 'apply':
      return renderStaticSectionEditor(section);
    default:
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
