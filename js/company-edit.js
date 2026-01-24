/**
 * 会社編集ページ - JavaScript
 *
 * URLパラメータ:
 * - domain: 会社ドメイン（編集時に必須）
 * - 指定なし: 新規作成モード
 */

const CompanyEditor = {
  // 設定
  config: {
    gasApiUrl: localStorage.getItem('gas_api_url') || ''
  },

  // 状態
  isNewMode: true,
  companyDomain: null,
  originalData: null,

  // 初期化
  async init() {
    // URLパラメータから会社ドメインを取得
    const params = new URLSearchParams(window.location.search);
    this.companyDomain = params.get('domain');
    this.isNewMode = !this.companyDomain;

    // UI更新
    this.updateUIForMode();

    // イベントリスナーの設定
    this.setupEventListeners();

    // リッチエディタの初期化
    this.initRichEditors();

    // 編集モードの場合、既存データを読み込み
    if (!this.isNewMode) {
      await this.loadCompanyData();
    }
  },

  // モードに応じたUI更新
  updateUIForMode() {
    const pageTitle = document.getElementById('page-title');
    const editModeBadge = document.getElementById('edit-mode-badge');
    const deleteBtn = document.getElementById('btn-delete');
    const domainInput = document.getElementById('company-domain');

    if (this.isNewMode) {
      pageTitle.textContent = '新規会社登録';
      editModeBadge.textContent = '新規作成';
      editModeBadge.classList.remove('edit');
      deleteBtn.style.display = 'none';
    } else {
      pageTitle.textContent = '会社情報の編集';
      editModeBadge.textContent = '編集中';
      editModeBadge.classList.add('edit');
      deleteBtn.style.display = '';
      domainInput.readOnly = true;
      domainInput.classList.add('readonly');
    }
  },

  // イベントリスナーの設定
  setupEventListeners() {
    // フォーム送信
    document.getElementById('company-edit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCompany();
    });

    // 削除ボタン
    document.getElementById('btn-delete')?.addEventListener('click', () => {
      this.showDeleteConfirm();
    });

    // 削除確認モーダル
    document.getElementById('delete-modal-close')?.addEventListener('click', () => {
      this.hideDeleteConfirm();
    });
    document.getElementById('delete-cancel')?.addEventListener('click', () => {
      this.hideDeleteConfirm();
    });
    document.getElementById('delete-confirm')?.addEventListener('click', () => {
      this.deleteCompany();
    });

    // モーダルオーバーレイクリック
    document.getElementById('delete-confirm-modal')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.hideDeleteConfirm();
      }
    });

    // ドメイン入力の自動変換（小文字化）
    document.getElementById('company-domain')?.addEventListener('input', (e) => {
      if (this.isNewMode) {
        e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      }
    });
  },

  // リッチエディタの初期化
  initRichEditors() {
    const editors = document.querySelectorAll('.rich-editor');

    editors.forEach(editor => {
      const container = editor.closest('.rich-editor-container');
      const toolbar = container.querySelector('.rich-editor-toolbar');
      const hiddenInput = container.querySelector('input[type="hidden"]');

      // ツールバーボタンのイベント
      toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const command = btn.dataset.command;
          document.execCommand(command, false, null);
          editor.focus();
          this.updateHiddenInput(editor, hiddenInput);
        });
      });

      // エディタの入力イベント
      editor.addEventListener('input', () => {
        this.updateHiddenInput(editor, hiddenInput);
      });

      // ペースト時にプレーンテキストのみにする（セキュリティ対策）
      editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      });

      // キーボードショートカット
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
          this.updateHiddenInput(editor, hiddenInput);
        }
      });
    });
  },

  // リッチエディタの内容を隠しフィールドに反映
  updateHiddenInput(editor, hiddenInput) {
    if (hiddenInput) {
      // 内容を取得してサニタイズ
      const html = this.sanitizeHtml(editor.innerHTML);
      hiddenInput.value = html;
    }
  },

  // HTMLサニタイズ（許可するタグのみ残す）
  sanitizeHtml(html) {
    // 空の場合は空文字を返す
    if (!html || html === '<br>' || html === '<div><br></div>') {
      return '';
    }

    // 許可するタグ
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'p'];

    // 一時的なDOM要素を作成
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // 許可されていないタグを削除
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        // タグを削除してテキストのみ残す
        el.replaceWith(...el.childNodes);
      } else {
        // 許可されたタグでも属性は全て削除
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name);
        }
      }
    });

    return temp.innerHTML;
  },

  // リッチエディタにHTMLを設定
  setEditorContent(editorId, html) {
    const editor = document.getElementById(editorId);
    const container = editor?.closest('.rich-editor-container');
    const hiddenInput = container?.querySelector('input[type="hidden"]');

    if (editor) {
      editor.innerHTML = html || '';
      if (hiddenInput) {
        hiddenInput.value = html || '';
      }
    }
  },

  // 会社データを読み込み
  async loadCompanyData() {
    const gasApiUrl = this.config.gasApiUrl;

    if (!gasApiUrl) {
      // GAS APIがない場合はlocalStorageから取得
      const localData = localStorage.getItem(`company_data_${this.companyDomain}`);
      if (localData) {
        this.populateForm(JSON.parse(localData));
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
        c.companyDomain === this.companyDomain ||
        c.company_domain === this.companyDomain
      );

      if (!company) {
        // GASにない場合はlocalStorageを確認
        const localData = localStorage.getItem(`company_data_${this.companyDomain}`);
        if (localData) {
          this.populateForm(JSON.parse(localData));
        } else {
          alert('会社データが見つかりません');
          window.location.href = 'admin.html';
        }
        return;
      }

      this.originalData = company;
      this.populateForm(company);

    } catch (error) {
      console.error('会社データ読み込みエラー:', error);
      // エラー時はlocalStorageを試す
      const localData = localStorage.getItem(`company_data_${this.companyDomain}`);
      if (localData) {
        this.populateForm(JSON.parse(localData));
      } else {
        alert('データの読み込みに失敗しました: ' + error.message);
      }
    }
  },

  // フォームにデータを設定
  populateForm(data) {
    document.getElementById('company-name').value = data.company || '';
    document.getElementById('company-domain').value = data.companyDomain || data.company_domain || '';
    document.getElementById('design-pattern').value = data.designPattern || 'standard';
    document.getElementById('image-url').value = data.imageUrl || '';
    document.getElementById('order').value = data.order || '';
    document.getElementById('company-address').value = data.companyAddress || data.location || '';
    document.getElementById('show-company').checked =
      data.showCompany === '○' || data.showCompany === true || data.showCompany === 'true' || data.visible === true;

    // リッチエディタにコンテンツを設定
    this.setEditorContent('description-editor', data.description || '');
    this.setEditorContent('job-content-editor', data.jobDescription || data.jobContent || '');
    this.setEditorContent('working-hours-editor', data.workingHours || '');
    this.setEditorContent('work-location-editor', data.workLocation || '');

    // ページタイトルに会社名を表示
    if (data.company) {
      document.getElementById('page-title').textContent = `${data.company} の編集`;
    }
  },

  // 会社データを保存
  async saveCompany() {
    // リッチエディタの内容を同期
    this.syncRichEditors();

    // フォームデータを収集
    const companyData = {
      company: document.getElementById('company-name').value.trim(),
      companyDomain: document.getElementById('company-domain').value.trim(),
      designPattern: document.getElementById('design-pattern').value,
      imageUrl: document.getElementById('image-url').value.trim(),
      order: document.getElementById('order').value,
      companyAddress: document.getElementById('company-address').value.trim(),
      description: document.getElementById('description').value,
      jobDescription: document.getElementById('job-content').value,
      workingHours: document.getElementById('working-hours').value,
      workLocation: document.getElementById('work-location').value,
      showCompany: document.getElementById('show-company').checked ? '○' : '',
      visible: document.getElementById('show-company').checked
    };

    // バリデーション
    if (!companyData.company || !companyData.companyDomain) {
      alert('会社名と会社ドメインは必須です');
      return;
    }

    // ドメインの形式チェック
    if (!/^[a-z0-9-]+$/.test(companyData.companyDomain)) {
      alert('会社ドメインは半角英小文字・数字・ハイフンのみ使用できます');
      return;
    }

    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="loading-spinner-small"></span> 保存中...';
    }

    const gasApiUrl = this.config.gasApiUrl;

    try {
      if (gasApiUrl) {
        // GAS APIで保存
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

      // localStorageにも保存（バックアップ）
      localStorage.setItem(`company_data_${companyData.companyDomain}`, JSON.stringify(companyData));

      alert(this.isNewMode ? '会社を登録しました' : '会社情報を更新しました');
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
  },

  // リッチエディタの内容を同期
  syncRichEditors() {
    const editors = document.querySelectorAll('.rich-editor');
    editors.forEach(editor => {
      const container = editor.closest('.rich-editor-container');
      const hiddenInput = container?.querySelector('input[type="hidden"]');
      if (hiddenInput) {
        hiddenInput.value = this.sanitizeHtml(editor.innerHTML);
      }
    });
  },

  // 削除確認モーダルを表示
  showDeleteConfirm() {
    const modal = document.getElementById('delete-confirm-modal');
    const companyName = document.getElementById('company-name').value;
    document.getElementById('delete-company-name').textContent = companyName;
    modal.style.display = 'flex';
  },

  // 削除確認モーダルを非表示
  hideDeleteConfirm() {
    document.getElementById('delete-confirm-modal').style.display = 'none';
  },

  // 会社を削除
  async deleteCompany() {
    const gasApiUrl = this.config.gasApiUrl;

    const deleteBtn = document.getElementById('delete-confirm');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = '削除中...';
    }

    try {
      if (gasApiUrl) {
        const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
          action: 'deleteCompany',
          domain: this.companyDomain
        }))));

        const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '削除に失敗しました');
        }
      }

      // localStorageからも削除
      localStorage.removeItem(`company_data_${this.companyDomain}`);

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
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  CompanyEditor.init();
});
