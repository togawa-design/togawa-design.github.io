/**
 * 会社編集機能モジュール
 */
import { escapeHtml } from '@shared/utils.js';

// 設定
const config = {
  get gasApiUrl() {
    return localStorage.getItem('gas_api_url') || '';
  }
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

  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'p'];
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
    } else {
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
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
  setVal('image-url', data.imageUrl);
  setVal('order', data.order);
  setVal('company-address', data.companyAddress || data.location);

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
 * 会社データを読み込み
 */
async function loadCompanyData() {
  const gasApiUrl = config.gasApiUrl;

  if (!gasApiUrl) {
    const localData = localStorage.getItem(`company_data_${companyDomain}`);
    if (localData) {
      populateForm(JSON.parse(localData));
    } else {
      alert('会社データが見つかりません');
      window.location.href = 'admin.html';
    }
    return;
  }

  try {
    const url = `${gasApiUrl}?action=getCompanies`;
    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '会社データの取得に失敗しました');
    }

    const company = result.companies?.find(c =>
      c.companyDomain === companyDomain ||
      c.company_domain === companyDomain
    );

    if (!company) {
      const localData = localStorage.getItem(`company_data_${companyDomain}`);
      if (localData) {
        populateForm(JSON.parse(localData));
      } else {
        alert('会社データが見つかりません');
        window.location.href = 'admin.html';
      }
      return;
    }

    originalData = company;
    populateForm(company);

  } catch (error) {
    console.error('会社データ読み込みエラー:', error);
    const localData = localStorage.getItem(`company_data_${companyDomain}`);
    if (localData) {
      populateForm(JSON.parse(localData));
    } else {
      alert('データの読み込みに失敗しました: ' + error.message);
    }
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

  const companyData = {
    company: getVal('company-name'),
    companyDomain: getVal('company-domain'),
    designPattern: document.getElementById('design-pattern')?.value || 'standard',
    imageUrl: getVal('image-url'),
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

  const gasApiUrl = config.gasApiUrl;

  try {
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
  const gasApiUrl = config.gasApiUrl;
  const deleteBtn = document.getElementById('delete-confirm');

  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '削除中...';
  }

  try {
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
