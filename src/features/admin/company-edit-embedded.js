/**
 * Company-Edit Embedded
 * admin.html内でcompany-edit機能を動作させるためのアダプターモジュール
 */

import { escapeHtml, showToast } from '@shared/utils.js';
import { uploadCompanyLogo, uploadCompanyImage } from './image-uploader.js';
import * as FirestoreService from '@shared/firestore-service.js';

// 状態
let isNewMode = true;
let editingCompanyDomain = null;
let originalData = null;
let eventListenersSetup = false;

/**
 * company-edit埋め込みセクションを初期化
 */
export async function initCompanyEditEmbedded(domain) {
  editingCompanyDomain = domain;
  isNewMode = !domain;
  originalData = null;

  // フォームをリセット
  resetForm();

  // モードに応じたUI更新
  updateUIForMode();

  // イベントリスナー設定（初回のみ）
  if (!eventListenersSetup) {
    setupEventListeners();
    initRichEditors();
    eventListenersSetup = true;
  }

  // 編集モードの場合はデータを読み込み
  if (!isNewMode) {
    await loadCompanyData();
  }
}

/**
 * フォームをリセット
 */
function resetForm() {
  const form = document.getElementById('ce-company-edit-form');
  if (form) form.reset();

  // リッチエディタをクリア
  ['ce-description-editor', 'ce-job-content-editor', 'ce-working-hours-editor', 'ce-work-location-editor'].forEach(id => {
    const editor = document.getElementById(id);
    if (editor) editor.innerHTML = '';
  });

  // hidden inputsをクリア
  ['ce-description', 'ce-job-content', 'ce-working-hours', 'ce-work-location', 'ce-logo-url'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });

  // ロゴプレビューをリセット
  updateLogoPreview('');

  // ドメイン入力フィールドを編集可能に
  const domainInput = document.getElementById('ce-company-domain');
  if (domainInput) {
    domainInput.readOnly = false;
    domainInput.classList.remove('readonly');
  }
}

/**
 * モードに応じたUI更新
 */
function updateUIForMode() {
  const pageTitle = document.getElementById('ce-page-title');
  const editModeBadge = document.getElementById('ce-edit-badge');
  const deleteBtn = document.getElementById('ce-delete-btn');
  const domainInput = document.getElementById('ce-company-domain');

  if (isNewMode) {
    if (pageTitle) pageTitle.textContent = '新規会社登録';
    if (editModeBadge) {
      editModeBadge.textContent = '新規作成';
      editModeBadge.classList.remove('edit');
    }
    if (deleteBtn) deleteBtn.style.display = 'none';
  } else {
    if (pageTitle) pageTitle.textContent = '会社情報の編集';
    if (editModeBadge) {
      editModeBadge.textContent = '編集中';
      editModeBadge.classList.add('edit');
    }
    if (deleteBtn) deleteBtn.style.display = '';
    if (domainInput) {
      domainInput.readOnly = true;
      domainInput.classList.add('readonly');
    }
  }
}

/**
 * HTMLサニタイズ（許可するタグのみ残す）
 */
function sanitizeHtml(html) {
  if (!html || html === '<br>' || html === '<div><br></div>') {
    return '';
  }

  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'p', 'img'];
  const allowedAttributes = ['src', 'alt', 'style'];
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
    } else {
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        if (!allowedAttributes.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
      if (el.tagName.toLowerCase() === 'img' && !el.style.maxWidth) {
        el.style.maxWidth = '100%';
      }
    }
  });

  return temp.innerHTML;
}

/**
 * リッチエディタの内容を隠しフィールドに反映
 */
function updateHiddenInput(editor, hiddenInput) {
  if (hiddenInput) {
    const html = sanitizeHtml(editor.innerHTML);
    hiddenInput.value = html;
  }
}

/**
 * リッチエディタにHTMLを設定
 */
function setEditorContent(editorId, html) {
  const editor = document.getElementById(editorId);
  const container = editor?.closest('.rich-editor-container');
  const hiddenInput = container?.querySelector('input[type="hidden"]');

  if (editor) {
    editor.innerHTML = html || '';
    if (hiddenInput) {
      hiddenInput.value = html || '';
    }
  }
}

/**
 * リッチエディタの初期化
 */
function initRichEditors() {
  const section = document.getElementById('section-company-edit');
  if (!section) return;

  const editors = section.querySelectorAll('.rich-editor');

  editors.forEach(editor => {
    const container = editor.closest('.rich-editor-container');
    const toolbar = container.querySelector('.rich-editor-toolbar');
    const hiddenInput = container.querySelector('input[type="hidden"]');

    toolbar?.querySelectorAll('.toolbar-btn:not([id])').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        if (command) {
          document.execCommand(command, false, null);
          editor.focus();
          updateHiddenInput(editor, hiddenInput);
        }
      });
    });

    editor.addEventListener('input', () => {
      updateHiddenInput(editor, hiddenInput);
    });

    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            document.execCommand('bold', false, null);
            break;
          case 'i':
            e.preventDefault();
            document.execCommand('italic', false, null);
            break;
          case 'u':
            e.preventDefault();
            document.execCommand('underline', false, null);
            break;
        }
        updateHiddenInput(editor, hiddenInput);
      }
    });
  });
}

/**
 * フォームにデータを設定
 */
function populateForm(data) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('ce-company-name', data.company);
  setVal('ce-company-domain', data.companyDomain || data.company_domain);
  setVal('ce-design-pattern', data.designPattern || 'modern');
  setVal('ce-order', data.order);
  setVal('ce-company-address', data.companyAddress || data.location);

  // ロゴURL設定
  const logoUrl = data.logoUrl || data.imageUrl || '';
  setVal('ce-logo-url', logoUrl);
  updateLogoPreview(logoUrl);

  const showCompanyEl = document.getElementById('ce-show-company');
  if (showCompanyEl) {
    showCompanyEl.checked =
      data.showCompany === '○' || data.showCompany === true || data.showCompany === 'true' || data.visible === true;
  }

  setEditorContent('ce-description-editor', data.description || '');
  setEditorContent('ce-job-content-editor', data.jobDescription || data.jobContent || '');
  setEditorContent('ce-working-hours-editor', data.workingHours || '');
  setEditorContent('ce-work-location-editor', data.workLocation || '');

  if (data.company) {
    const pageTitle = document.getElementById('ce-page-title');
    if (pageTitle) pageTitle.textContent = `${data.company} の編集`;
  }
}

/**
 * ロゴプレビューを更新
 */
function updateLogoPreview(url) {
  const preview = document.getElementById('ce-logo-preview');
  const removeBtn = document.getElementById('ce-logo-remove-btn');

  if (!preview) return;

  if (url) {
    preview.innerHTML = `<img src="${escapeHtml(url)}" alt="会社ロゴ">`;
    if (removeBtn) removeBtn.style.display = '';
  } else {
    preview.innerHTML = '<span class="upload-placeholder">ロゴをアップロード</span>';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

/**
 * 会社データを読み込み
 */
async function loadCompanyData() {
  // 1. sessionStorageから取得（admin.htmlからの遷移時に高速化）
  const sessionData = sessionStorage.getItem('editing_company_data');
  if (sessionData) {
    try {
      const company = JSON.parse(sessionData);
      if (company.companyDomain === editingCompanyDomain || company.company_domain === editingCompanyDomain) {
        originalData = company;
        populateForm(company);
        sessionStorage.removeItem('editing_company_data');
        return;
      }
    } catch (e) {
      console.error('sessionStorageデータのパースエラー:', e);
    }
    sessionStorage.removeItem('editing_company_data');
  }

  // 2. localStorageから取得（更新データがある場合）
  const localData = localStorage.getItem(`company_data_${editingCompanyDomain}`);
  if (localData) {
    try {
      const company = JSON.parse(localData);
      originalData = company;
      populateForm(company);
      return;
    } catch (e) {
      console.error('localStorageデータのパースエラー:', e);
    }
  }

  // 3. Firestoreから取得
  try {
    FirestoreService.initFirestore();
    const result = await FirestoreService.getCompany(editingCompanyDomain);

    if (!result.success || !result.company) {
      showToast('会社データが見つかりません', 'error');
      navigateBack();
      return;
    }

    originalData = result.company;
    populateForm(result.company);

  } catch (error) {
    console.error('Firestore読み込みエラー:', error);
    showToast('データの読み込みに失敗しました: ' + error.message, 'error');
  }
}

/**
 * リッチエディタの内容を同期
 */
function syncRichEditors() {
  const section = document.getElementById('section-company-edit');
  if (!section) return;

  const editors = section.querySelectorAll('.rich-editor');
  editors.forEach(editor => {
    const container = editor.closest('.rich-editor-container');
    const hiddenInput = container?.querySelector('input[type="hidden"]');
    if (hiddenInput) {
      hiddenInput.value = sanitizeHtml(editor.innerHTML);
    }
  });
}

/**
 * 会社データを保存
 */
async function saveCompany() {
  syncRichEditors();

  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

  const logoUrl = getVal('ce-logo-url');

  const companyData = {
    company: getVal('ce-company-name'),
    companyDomain: getVal('ce-company-domain'),
    designPattern: document.getElementById('ce-design-pattern')?.value || 'modern',
    logoUrl: logoUrl,
    imageUrl: logoUrl,
    order: getVal('ce-order'),
    companyAddress: getVal('ce-company-address'),
    description: document.getElementById('ce-description')?.value || '',
    jobDescription: document.getElementById('ce-job-content')?.value || '',
    workingHours: document.getElementById('ce-working-hours')?.value || '',
    workLocation: document.getElementById('ce-work-location')?.value || '',
    showCompany: document.getElementById('ce-show-company')?.checked ? '○' : '',
    visible: document.getElementById('ce-show-company')?.checked || false
  };

  if (!companyData.company || !companyData.companyDomain) {
    showToast('会社名と会社ドメインは必須です', 'error');
    return;
  }

  if (!/^[a-z0-9-]+$/.test(companyData.companyDomain)) {
    showToast('会社ドメインは半角英小文字・数字・ハイフンのみ使用できます', 'error');
    return;
  }

  const saveBtn = document.getElementById('ce-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading-spinner-small"></span> 保存中...';
  }

  try {
    // Firestoreに保存
    FirestoreService.initFirestore();
    const result = await FirestoreService.saveCompany(companyData.companyDomain, companyData);

    if (!result.success) {
      throw new Error(result.error || '保存に失敗しました');
    }

    localStorage.setItem(`company_data_${companyData.companyDomain}`, JSON.stringify(companyData));
    showToast(isNewMode ? '会社を登録しました' : '会社情報を更新しました');
    navigateBack();

  } catch (error) {
    console.error('保存エラー:', error);
    showToast('保存中にエラーが発生しました: ' + error.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> 保存';
    }
  }
}

/**
 * 削除確認モーダルを表示
 */
function showDeleteConfirm() {
  const modal = document.getElementById('ce-delete-confirm-modal');
  const companyName = document.getElementById('ce-company-name')?.value || '';
  const deleteCompanyNameEl = document.getElementById('ce-delete-company-name');
  if (deleteCompanyNameEl) deleteCompanyNameEl.textContent = companyName;
  if (modal) modal.style.display = 'flex';
}

/**
 * 削除確認モーダルを非表示
 */
function hideDeleteConfirm() {
  const modal = document.getElementById('ce-delete-confirm-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * 会社を削除
 */
async function deleteCompany() {
  const deleteBtn = document.getElementById('ce-delete-confirm');

  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '削除中...';
  }

  try {
    // Firestoreから削除
    FirestoreService.initFirestore();
    const result = await FirestoreService.deleteCompany(editingCompanyDomain);

    if (!result.success) {
      throw new Error(result.error || '削除に失敗しました');
    }

    localStorage.removeItem(`company_data_${editingCompanyDomain}`);
    showToast('会社を削除しました');
    hideDeleteConfirm();
    navigateBack();

  } catch (error) {
    console.error('削除エラー:', error);
    showToast('削除中にエラーが発生しました: ' + error.message, 'error');
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = '削除する';
    }
  }
}

/**
 * 戻る処理
 */
function navigateBack() {
  if (window.AdminDashboard?.navigateBack) {
    window.AdminDashboard.navigateBack();
  } else {
    // フォールバック
    window.AdminDashboard?.switchSection?.('company-manage');
  }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // フォーム送信
  document.getElementById('ce-company-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveCompany();
  });

  // 戻るボタン
  document.getElementById('ce-back-btn')?.addEventListener('click', navigateBack);

  // キャンセルボタン
  document.getElementById('ce-cancel-btn')?.addEventListener('click', navigateBack);

  // 削除ボタン
  document.getElementById('ce-delete-btn')?.addEventListener('click', showDeleteConfirm);

  // 削除モーダル
  document.getElementById('ce-delete-modal-close')?.addEventListener('click', hideDeleteConfirm);
  document.getElementById('ce-delete-cancel')?.addEventListener('click', hideDeleteConfirm);
  document.getElementById('ce-delete-confirm')?.addEventListener('click', deleteCompany);

  document.getElementById('ce-delete-confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      hideDeleteConfirm();
    }
  });

  // ドメイン入力の正規化
  document.getElementById('ce-company-domain')?.addEventListener('input', (e) => {
    if (isNewMode) {
      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }
  });

  // ロゴアップロード
  setupLogoUpload();

  // エディタ内画像挿入
  setupEditorImageInsert('ce-description-insert-image', 'ce-description-image-input', 'ce-description-editor');
  setupEditorImageInsert('ce-job-content-insert-image', 'ce-job-content-image-input', 'ce-job-content-editor');
}

/**
 * ロゴアップロードの設定
 */
function setupLogoUpload() {
  const uploadBtn = document.getElementById('ce-logo-upload-btn');
  const fileInput = document.getElementById('ce-logo-file-input');
  const removeBtn = document.getElementById('ce-logo-remove-btn');
  const preview = document.getElementById('ce-logo-preview');
  const logoUrlInput = document.getElementById('ce-logo-url');

  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  preview?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const domain = document.getElementById('ce-company-domain')?.value?.trim();
    if (!domain) {
      showToast('先に会社ドメインを入力してください', 'error');
      return;
    }

    try {
      preview.classList.add('uploading');
      preview.innerHTML = '<span class="upload-placeholder">アップロード中...</span>';

      const url = await uploadCompanyLogo(file, domain);

      logoUrlInput.value = url;
      updateLogoPreview(url);

    } catch (error) {
      console.error('ロゴアップロードエラー:', error);
      showToast('ロゴのアップロードに失敗しました: ' + error.message, 'error');
      updateLogoPreview(logoUrlInput.value);
    } finally {
      preview.classList.remove('uploading');
      fileInput.value = '';
    }
  });

  removeBtn?.addEventListener('click', () => {
    logoUrlInput.value = '';
    updateLogoPreview('');
  });

  // ドラッグ&ドロップ
  preview?.addEventListener('dragover', (e) => {
    e.preventDefault();
    preview.classList.add('drag-over');
  });

  preview?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    preview.classList.remove('drag-over');
  });

  preview?.addEventListener('drop', async (e) => {
    e.preventDefault();
    preview.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const domain = document.getElementById('ce-company-domain')?.value?.trim();
    if (!domain) {
      showToast('先に会社ドメインを入力してください', 'error');
      return;
    }

    try {
      preview.classList.add('uploading');
      preview.innerHTML = '<span class="upload-placeholder">アップロード中...</span>';

      const url = await uploadCompanyLogo(files[0], domain);

      logoUrlInput.value = url;
      updateLogoPreview(url);

    } catch (error) {
      console.error('ロゴアップロードエラー:', error);
      showToast('ロゴのアップロードに失敗しました: ' + error.message, 'error');
      updateLogoPreview(logoUrlInput.value);
    } finally {
      preview.classList.remove('uploading');
    }
  });
}

/**
 * エディタ内画像挿入の設定
 */
function setupEditorImageInsert(buttonId, inputId, editorId) {
  const button = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  const editor = document.getElementById(editorId);

  if (!button || !input || !editor) return;

  button.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const domain = document.getElementById('ce-company-domain')?.value?.trim();
    if (!domain) {
      showToast('先に会社ドメインを入力してください', 'error');
      return;
    }

    try {
      const placeholderId = `img-placeholder-${Date.now()}`;
      const placeholder = document.createElement('img');
      placeholder.id = placeholderId;
      placeholder.src = URL.createObjectURL(file);
      placeholder.alt = 'アップロード中...';
      placeholder.className = 'uploading';
      placeholder.style.maxWidth = '100%';
      placeholder.style.opacity = '0.5';

      editor.focus();
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(placeholder);
        range.setStartAfter(placeholder);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.appendChild(placeholder);
      }

      const url = await uploadCompanyImage(file, domain);

      const placeholderEl = document.getElementById(placeholderId);
      if (placeholderEl) {
        placeholderEl.src = url;
        placeholderEl.alt = '';
        placeholderEl.className = '';
        placeholderEl.style.opacity = '1';
        placeholderEl.removeAttribute('id');
      }

      const container = editor.closest('.rich-editor-container');
      const hiddenInput = container?.querySelector('input[type="hidden"]');
      if (hiddenInput) {
        hiddenInput.value = sanitizeHtml(editor.innerHTML);
      }

    } catch (error) {
      console.error('画像アップロードエラー:', error);
      showToast('画像のアップロードに失敗しました: ' + error.message, 'error');

      const placeholderEl = editor.querySelector('img.uploading');
      if (placeholderEl) {
        placeholderEl.remove();
      }
    } finally {
      input.value = '';
    }
  });
}

export default {
  initCompanyEditEmbedded
};
