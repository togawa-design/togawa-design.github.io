/**
 * LP編集機能
 */
import { escapeHtml } from '@shared/utils.js';

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
  }

  enable(lpSettings, companyDomain) {
    this.isActive = true;
    this.currentCompanyDomain = companyDomain;
    this.editedData = { ...lpSettings };

    document.body.classList.add('lp-edit-mode');

    this.renderToolbar();
    this.setupEditableElements();
    this.setupSectionSortable();
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
      el.style.backgroundImage = selectedUrl ? `url('${selectedUrl}')` : '';
      close();
    });

    // 外側クリックで閉じる
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 100);
  }

  async saveChanges() {
    // 保存処理（GASへのAPI呼び出し）
    console.log('保存データ:', this.editedData);
    alert('保存機能は管理画面から行ってください。\n編集内容:\n' + JSON.stringify(this.editedData, null, 2));
  }

  cancelEdit() {
    if (confirm('編集内容を破棄してよろしいですか？')) {
      window.location.href = window.location.pathname + '?c=' + this.currentCompanyDomain;
    }
  }

  previewChanges() {
    console.log('プレビュー:', this.editedData);
  }
}

export default LPEditor;
