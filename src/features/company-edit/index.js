/**
 * 会社編集機能モジュール
 */
import { escapeHtml } from '@shared/utils.js';
import { uploadCompanyLogo, uploadCompanyImage, compressContentImage } from '@features/admin/image-uploader.js';
import { useFirestore } from '@features/admin/config.js';
import * as FirestoreService from '@shared/firestore-service.js';

// 設定
const config = {
  gasApiUrl: 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec'
};

// 状態
let isNewMode = true;
let companyDomain = null;
let originalData = null;

/**
 * モードに応じたUI更新
 */
function updateUIForMode() {
  const pageTitle = document.getElementById('page-title');
  const editModeBadge = document.getElementById('edit-mode-badge');
  const deleteBtn = document.getElementById('btn-delete');
  const domainInput = document.getElementById('company-domain');

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
      // 許可された属性以外を削除
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        if (!allowedAttributes.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
      // img要素の場合、スタイル属性を追加（最大幅設定）
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
  const editors = document.querySelectorAll('.rich-editor');

  editors.forEach(editor => {
    const container = editor.closest('.rich-editor-container');
    const toolbar = container.querySelector('.rich-editor-toolbar');
    const hiddenInput = container.querySelector('input[type="hidden"]');

    toolbar?.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        document.execCommand(command, false, null);
        editor.focus();
        updateHiddenInput(editor, hiddenInput);
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

  setVal('company-name', data.company);
  setVal('company-domain', data.companyDomain || data.company_domain);
  setVal('design-pattern', data.designPattern || 'standard');
  setVal('order', data.order);
  setVal('company-address', data.companyAddress || data.location);

  // ロゴURL設定
  const logoUrl = data.logoUrl || data.imageUrl || '';
  setVal('logo-url', logoUrl);
  updateLogoPreview(logoUrl);

  const showCompanyEl = document.getElementById('show-company');
  if (showCompanyEl) {
    showCompanyEl.checked =
      data.showCompany === '○' || data.showCompany === true || data.showCompany === 'true' || data.visible === true;
  }

  setEditorContent('description-editor', data.description || '');
  setEditorContent('job-content-editor', data.jobDescription || data.jobContent || '');
  setEditorContent('working-hours-editor', data.workingHours || '');
  setEditorContent('work-location-editor', data.workLocation || '');

  if (data.company) {
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `${data.company} の編集`;
  }
}

/**
 * ロゴプレビューを更新
 */
function updateLogoPreview(url) {
  const preview = document.getElementById('logo-preview');
  const removeBtn = document.getElementById('logo-remove-btn');

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
      if (company.companyDomain === companyDomain || company.company_domain === companyDomain) {
        originalData = company;
        populateForm(company);
        sessionStorage.removeItem('editing_company_data'); // 使用後は削除
        return;
      }
    } catch (e) {
      console.error('sessionStorageデータのパースエラー:', e);
    }
    sessionStorage.removeItem('editing_company_data');
  }

  // 2. localStorageから取得（更新データがある場合）- Firestoreモード以外
  if (!useFirestore) {
    const localData = localStorage.getItem(`company_data_${companyDomain}`);
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
  }

  // 3. Firestoreから取得
  if (useFirestore) {
    try {
      FirestoreService.initFirestore();
      const result = await FirestoreService.getCompany(companyDomain);

      if (!result.success || !result.company) {
        alert('会社データが見つかりません');
        window.location.href = 'admin.html';
        return;
      }

      originalData = result.company;
      populateForm(result.company);
      return;
    } catch (error) {
      console.error('Firestore読み込みエラー:', error);
      alert('データの読み込みに失敗しました: ' + error.message);
      return;
    }
  }

  // 4. GAS APIから取得（フォールバック）
  const gasApiUrl = config.gasApiUrl;
  if (!gasApiUrl) {
    alert('会社データが見つかりません');
    window.location.href = 'admin.html';
    return;
  }

  try {
    // getCompany APIで単一会社を直接取得（高速）
    const url = `${gasApiUrl}?action=getCompany&domain=${encodeURIComponent(companyDomain)}`;
    const response = await fetch(url);
    const result = await response.json();

    if (!result.success || !result.company) {
      alert('会社データが見つかりません');
      window.location.href = 'admin.html';
      return;
    }

    originalData = result.company;
    populateForm(result.company);

  } catch (error) {
    console.error('会社データ読み込みエラー:', error);
    alert('データの読み込みに失敗しました: ' + error.message);
  }
}

/**
 * リッチエディタの内容を同期
 */
function syncRichEditors() {
  const editors = document.querySelectorAll('.rich-editor');
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

  const logoUrl = getVal('logo-url');

  const companyData = {
    company: getVal('company-name'),
    companyDomain: getVal('company-domain'),
    designPattern: document.getElementById('design-pattern')?.value || 'standard',
    logoUrl: logoUrl,
    imageUrl: logoUrl, // 後方互換性のため
    order: getVal('order'),
    companyAddress: getVal('company-address'),
    description: document.getElementById('description')?.value || '',
    jobDescription: document.getElementById('job-content')?.value || '',
    workingHours: document.getElementById('working-hours')?.value || '',
    workLocation: document.getElementById('work-location')?.value || '',
    showCompany: document.getElementById('show-company')?.checked ? '○' : '',
    visible: document.getElementById('show-company')?.checked || false
  };

  if (!companyData.company || !companyData.companyDomain) {
    alert('会社名と会社ドメインは必須です');
    return;
  }

  if (!/^[a-z0-9-]+$/.test(companyData.companyDomain)) {
    alert('会社ドメインは半角英小文字・数字・ハイフンのみ使用できます');
    return;
  }

  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading-spinner-small"></span> 保存中...';
  }

  try {
    // Firestoreに保存
    if (useFirestore) {
      FirestoreService.initFirestore();

      // Firestore用にデータを整形
      const firestoreData = {
        company: companyData.company,
        companyAddress: companyData.companyAddress || '',
        description: companyData.description,
        jobDescription: companyData.jobDescription,
        workingHours: companyData.workingHours,
        workLocation: companyData.workLocation,
        logoUrl: companyData.logoUrl,
        imageUrl: companyData.imageUrl,
        designPattern: companyData.designPattern,
        order: parseInt(companyData.order) || 0,
        showCompany: companyData.showCompany === '○' || companyData.showCompany === '◯'
      };

      const result = await FirestoreService.saveCompany(companyData.companyDomain, firestoreData);

      if (!result.success) {
        throw new Error(result.error || '保存に失敗しました');
      }

      alert(isNewMode ? '会社を登録しました' : '会社情報を更新しました');
      window.location.href = 'admin.html';
      return;
    }

    // GAS APIに保存（フォールバック）
    const gasApiUrl = config.gasApiUrl;
    if (gasApiUrl) {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveCompany',
        company: companyData
      }))));

      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '保存に失敗しました');
      }
    }

    localStorage.setItem(`company_data_${companyData.companyDomain}`, JSON.stringify(companyData));

    alert(isNewMode ? '会社を登録しました' : '会社情報を更新しました');
    window.location.href = 'admin.html';

  } catch (error) {
    console.error('保存エラー:', error);
    alert('保存中にエラーが発生しました: ' + error.message);
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
  const modal = document.getElementById('delete-confirm-modal');
  const companyName = document.getElementById('company-name')?.value || '';
  const deleteCompanyNameEl = document.getElementById('delete-company-name');
  if (deleteCompanyNameEl) deleteCompanyNameEl.textContent = companyName;
  if (modal) modal.style.display = 'flex';
}

/**
 * 削除確認モーダルを非表示
 */
function hideDeleteConfirm() {
  const modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * 会社を削除
 */
async function deleteCompany() {
  const deleteBtn = document.getElementById('delete-confirm');

  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '削除中...';
  }

  try {
    // Firestoreから削除
    if (useFirestore) {
      FirestoreService.initFirestore();
      const result = await FirestoreService.deleteCompany(companyDomain);

      if (!result.success) {
        throw new Error(result.error || '削除に失敗しました');
      }

      alert('会社を削除しました');
      window.location.href = 'admin.html';
      return;
    }

    // GAS APIで削除（フォールバック）
    const gasApiUrl = config.gasApiUrl;
    if (gasApiUrl) {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'deleteCompany',
        domain: companyDomain
      }))));

      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '削除に失敗しました');
      }
    }

    localStorage.removeItem(`company_data_${companyDomain}`);

    alert('会社を削除しました');
    window.location.href = 'admin.html';

  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除中にエラーが発生しました: ' + error.message);
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = '削除する';
    }
  }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  document.getElementById('company-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveCompany();
  });

  document.getElementById('btn-delete')?.addEventListener('click', () => {
    showDeleteConfirm();
  });

  document.getElementById('delete-modal-close')?.addEventListener('click', hideDeleteConfirm);
  document.getElementById('delete-cancel')?.addEventListener('click', hideDeleteConfirm);
  document.getElementById('delete-confirm')?.addEventListener('click', deleteCompany);

  document.getElementById('delete-confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      hideDeleteConfirm();
    }
  });

  document.getElementById('company-domain')?.addEventListener('input', (e) => {
    if (isNewMode) {
      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }
  });

  // ロゴアップロード
  setupLogoUpload();

  // エディタ内画像挿入
  setupEditorImageInsert('description-insert-image', 'description-image-input', 'description-editor');
  setupEditorImageInsert('job-content-insert-image', 'job-content-image-input', 'job-content-editor');
}

/**
 * ロゴアップロードの設定
 */
function setupLogoUpload() {
  const uploadBtn = document.getElementById('logo-upload-btn');
  const fileInput = document.getElementById('logo-file-input');
  const removeBtn = document.getElementById('logo-remove-btn');
  const preview = document.getElementById('logo-preview');
  const logoUrlInput = document.getElementById('logo-url');

  if (!uploadBtn || !fileInput) return;

  // アップロードボタンクリック
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // プレビュークリック
  preview?.addEventListener('click', () => {
    fileInput.click();
  });

  // ファイル選択時
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const domain = document.getElementById('company-domain')?.value?.trim();
    if (!domain) {
      alert('先に会社ドメインを入力してください');
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
      alert('ロゴのアップロードに失敗しました: ' + error.message);
      updateLogoPreview(logoUrlInput.value);
    } finally {
      preview.classList.remove('uploading');
      fileInput.value = '';
    }
  });

  // 削除ボタン
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

    const domain = document.getElementById('company-domain')?.value?.trim();
    if (!domain) {
      alert('先に会社ドメインを入力してください');
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
      alert('ロゴのアップロードに失敗しました: ' + error.message);
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

    const domain = document.getElementById('company-domain')?.value?.trim();
    if (!domain) {
      alert('先に会社ドメインを入力してください');
      return;
    }

    try {
      // プレースホルダー画像を挿入
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

      // アップロード
      const url = await uploadCompanyImage(file, domain);

      // プレースホルダーを実際の画像に置き換え
      const placeholderEl = document.getElementById(placeholderId);
      if (placeholderEl) {
        placeholderEl.src = url;
        placeholderEl.alt = '';
        placeholderEl.className = '';
        placeholderEl.style.opacity = '1';
        placeholderEl.removeAttribute('id');
      }

      // hidden inputを更新
      const container = editor.closest('.rich-editor-container');
      const hiddenInput = container?.querySelector('input[type="hidden"]');
      if (hiddenInput) {
        hiddenInput.value = sanitizeHtml(editor.innerHTML);
      }

    } catch (error) {
      console.error('画像アップロードエラー:', error);
      alert('画像のアップロードに失敗しました: ' + error.message);

      // プレースホルダーを削除
      const placeholderEl = editor.querySelector('img.uploading');
      if (placeholderEl) {
        placeholderEl.remove();
      }
    } finally {
      input.value = '';
    }
  });
}

/**
 * 初期化
 */
export async function initCompanyEditor() {
  const params = new URLSearchParams(window.location.search);
  companyDomain = params.get('domain');
  isNewMode = !companyDomain;

  updateUIForMode();
  setupEventListeners();
  initRichEditors();

  if (!isNewMode) {
    await loadCompanyData();
  }
}

// グローバルにエクスポート（後方互換）
if (typeof window !== 'undefined') {
  window.CompanyEditor = {
    init: initCompanyEditor,
    saveCompany,
    deleteCompany,
    showDeleteConfirm,
    hideDeleteConfirm
  };
}

export default {
  initCompanyEditor
};
