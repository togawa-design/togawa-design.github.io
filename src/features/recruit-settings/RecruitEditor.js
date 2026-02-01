/**
 * 採用ページ編集機能
 * LP同様のビジュアルエディタ
 */
import { escapeHtml, showToast } from '@shared/utils.js';
import { uploadRecruitLogo, selectImageFile } from '@features/admin/image-uploader.js';
import {
  loadRecruitSettings,
  saveRecruitSettings,
  heroImagePresets
} from './core.js';

// デザインパターン定義（カラーテーマ）
const DESIGN_PATTERNS = [
  { id: 'standard', name: 'スタンダード', description: 'バランスの取れた標準デザイン' },
  { id: 'modern', name: 'モダン', description: 'グリーン系のフレッシュなデザイン' },
  { id: 'classic', name: 'クラシック', description: 'ブラウン系の落ち着いたデザイン' },
  { id: 'minimal', name: 'ミニマル', description: 'モノトーンのシンプルなデザイン' },
  { id: 'colorful', name: 'カラフル', description: 'ピンク〜パープルの華やかなデザイン' },
  { id: 'blue', name: 'ブルー', description: '信頼感のあるブルー系デザイン' },
  { id: 'orange', name: 'オレンジ', description: '活気のあるオレンジ系デザイン' }
];

// レイアウトスタイル定義
const LAYOUT_STYLES = [
  { id: 'default', name: 'デフォルト', description: '標準的なレイアウト' },
  { id: 'yellow', name: 'イエロー', description: '親しみやすい明るいデザイン' },
  { id: 'impact', name: 'インパクト', description: '黒背景の強烈なデザイン' },
  { id: 'trust', name: '信頼', description: 'ビジネス向けの信頼感' },
  { id: 'bold', name: 'ボールド', description: '大きな文字で印象的に' },
  { id: 'elegant', name: 'エレガント', description: '洗練された上品なデザイン' },
  { id: 'playful', name: 'ポップ', description: '明るく楽しい雰囲気' },
  { id: 'corporate', name: 'コーポレート', description: 'ビジネス向けの信頼感' },
  { id: 'athome', name: 'アットホーム', description: '丸みのあるフレンドリーなデザイン' },
  { id: 'local', name: '地域密着', description: '和風モダンの落ち着いたデザイン' }
];

/**
 * 採用ページエディタクラス
 */
export class RecruitEditor {
  constructor() {
    this.settings = {};
    this.companyDomain = null;
    this.company = null;
    this.isEnabled = false;
    this.hasChanges = false;
    this.onSettingsChange = null; // 設定変更時のコールバック
  }

  /**
   * 編集モードを有効化
   */
  async enable(companyDomain, company, settings, onSettingsChange) {
    this.companyDomain = companyDomain;
    this.company = company;
    this.settings = settings || {};
    this.onSettingsChange = onSettingsChange;
    this.isEnabled = true;

    // 編集パネルを作成
    this.createEditorPanel();

    // フォームに値を反映
    this.populateForm();

    // イベントリスナーを設定
    this.setupEventListeners();

    // bodyに編集モードクラスを追加
    document.body.classList.add('recruit-edit-mode');

    console.log('[RecruitEditor] 編集モード有効化');
  }

  /**
   * 編集パネルを作成
   */
  createEditorPanel() {
    // 既存のパネルがあれば削除
    const existingPanel = document.getElementById('recruit-editor-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'recruit-editor-panel';
    panel.className = 'recruit-editor-panel';
    panel.innerHTML = `
      <div class="recruit-editor-header">
        <h2 class="recruit-editor-title">採用ページ編集</h2>
        <div class="recruit-editor-actions">
          <button type="button" class="btn-preview-recruit" id="btn-preview-recruit" title="プレビュー">
            <span>👁</span>
          </button>
          <button type="button" class="btn-close-editor" id="btn-close-editor" title="閉じる">
            <span>✕</span>
          </button>
        </div>
      </div>

      <div class="recruit-editor-body">
        <!-- タブナビゲーション -->
        <div class="recruit-editor-tabs">
          <button type="button" class="recruit-editor-tab active" data-tab="design">デザイン</button>
          <button type="button" class="recruit-editor-tab" data-tab="content">コンテンツ</button>
          <button type="button" class="recruit-editor-tab" data-tab="header">ヘッダー</button>
          <button type="button" class="recruit-editor-tab" data-tab="seo">SEO</button>
        </div>

        <!-- デザインタブ -->
        <div class="recruit-editor-tab-content active" data-tab-content="design">
          <div class="editor-section">
            <h3 class="editor-section-title">レイアウトスタイル</h3>
            <div class="layout-style-grid" id="layout-style-grid">
              ${LAYOUT_STYLES.map(style => `
                <label class="layout-style-item" data-style="${style.id}">
                  <input type="radio" name="layoutStyle" value="${style.id}" ${this.settings.layoutStyle === style.id ? 'checked' : ''}>
                  <span class="layout-style-name">${escapeHtml(style.name)}</span>
                  <span class="layout-style-desc">${escapeHtml(style.description)}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">カラーテーマ</h3>
            <div class="design-pattern-grid" id="design-pattern-grid">
              ${DESIGN_PATTERNS.map(pattern => `
                <label class="design-pattern-item" data-pattern="${pattern.id}">
                  <input type="radio" name="designPattern" value="${pattern.id}" ${this.settings.designPattern === pattern.id ? 'checked' : ''}>
                  <span class="design-pattern-preview pattern-${pattern.id}"></span>
                  <span class="design-pattern-name">${escapeHtml(pattern.name)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- コンテンツタブ -->
        <div class="recruit-editor-tab-content" data-tab-content="content">
          <div class="editor-section">
            <h3 class="editor-section-title">ファーストビュー</h3>
            <div class="form-group">
              <label for="edit-hero-title">タイトル</label>
              <input type="text" id="edit-hero-title" placeholder="〇〇で働こう">
            </div>
            <div class="form-group">
              <label for="edit-hero-subtitle">サブタイトル</label>
              <input type="text" id="edit-hero-subtitle" placeholder="私たちと一緒に働きませんか？">
            </div>
            <div class="form-group">
              <label>ヒーロー画像</label>
              <div class="hero-image-presets" id="hero-image-presets">
                ${heroImagePresets.map(preset => `
                  <div class="hero-preset-item" data-url="${escapeHtml(preset.url)}">
                    <img src="${escapeHtml(preset.thumbnail)}" alt="${escapeHtml(preset.name)}" loading="lazy">
                  </div>
                `).join('')}
              </div>
              <input type="text" id="edit-hero-image" placeholder="または画像URLを入力" class="mt-2">
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">求人セクション</h3>
            <div class="form-group">
              <label for="edit-jobs-title">セクションタイトル</label>
              <input type="text" id="edit-jobs-title" placeholder="募集中の求人">
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">CTAセクション</h3>
            <div class="form-group">
              <label for="edit-cta-title">タイトル</label>
              <input type="text" id="edit-cta-title" placeholder="あなたの応募をお待ちしています">
            </div>
            <div class="form-group">
              <label for="edit-cta-text">説明文</label>
              <textarea id="edit-cta-text" rows="2" placeholder="気になる求人があれば、ぜひお気軽にご応募ください。"></textarea>
            </div>
          </div>
        </div>

        <!-- ヘッダータブ -->
        <div class="recruit-editor-tab-content" data-tab-content="header">
          <div class="editor-section">
            <h3 class="editor-section-title">ロゴ設定</h3>
            <div class="form-group">
              <label for="edit-logo-url">ロゴ画像</label>
              <div class="logo-preview-small" id="edit-logo-preview">
                <span class="logo-placeholder">ロゴ未設定</span>
              </div>
              <div class="input-with-button">
                <input type="text" id="edit-logo-url" placeholder="https://example.com/logo.png">
                <button type="button" id="btn-upload-logo-edit" class="btn-upload-small">📷</button>
              </div>
            </div>
            <div class="form-group">
              <label for="edit-company-name-display">表示会社名</label>
              <input type="text" id="edit-company-name-display" placeholder="株式会社〇〇">
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">CTAバー設定</h3>
            <div class="form-group">
              <label for="edit-phone-number">電話番号</label>
              <input type="text" id="edit-phone-number" placeholder="0120-XXX-XXX">
            </div>
            <div class="form-group">
              <label for="edit-cta-button-text">ボタンテキスト</label>
              <input type="text" id="edit-cta-button-text" placeholder="今すぐ応募する">
            </div>
          </div>
        </div>

        <!-- SEOタブ -->
        <div class="recruit-editor-tab-content" data-tab-content="seo">
          <div class="editor-section">
            <h3 class="editor-section-title">OGP設定</h3>
            <div class="form-group">
              <label for="edit-ogp-title">OGPタイトル</label>
              <input type="text" id="edit-ogp-title" placeholder="〇〇採用情報">
            </div>
            <div class="form-group">
              <label for="edit-ogp-description">OGP説明文</label>
              <textarea id="edit-ogp-description" rows="2" placeholder="採用情報ページの説明"></textarea>
            </div>
            <div class="form-group">
              <label for="edit-ogp-image">OGP画像URL</label>
              <input type="text" id="edit-ogp-image" placeholder="https://example.com/ogp.jpg">
            </div>
          </div>
        </div>
      </div>

      <div class="recruit-editor-footer">
        <button type="button" class="btn-save-recruit" id="btn-save-recruit">
          <span>💾</span> 保存
        </button>
      </div>
    `;

    document.body.appendChild(panel);
  }

  /**
   * フォームに設定値を反映
   */
  populateForm() {
    const s = this.settings;
    const companyName = this.company?.company || '';

    // デザイン設定
    this.setRadioValue('layoutStyle', s.layoutStyle || 'default');
    this.setRadioValue('designPattern', s.designPattern || 'standard');

    // コンテンツ
    this.setInputValue('edit-hero-title', s.heroTitle || `${companyName}で働こう`);
    this.setInputValue('edit-hero-subtitle', s.heroSubtitle || '私たちと一緒に働きませんか？');
    this.setInputValue('edit-hero-image', s.heroImage || '');
    this.setInputValue('edit-jobs-title', s.jobsTitle || '募集中の求人');
    this.setInputValue('edit-cta-title', s.ctaTitle || 'あなたの応募をお待ちしています');
    this.setInputValue('edit-cta-text', s.ctaText || '気になる求人があれば、ぜひお気軽にご応募ください。');

    // ヘッダー
    this.setInputValue('edit-logo-url', s.logoUrl || '');
    this.setInputValue('edit-company-name-display', s.companyNameDisplay || companyName);
    this.setInputValue('edit-phone-number', s.phoneNumber || '');
    this.setInputValue('edit-cta-button-text', s.ctaButtonText || '今すぐ応募する');

    // SEO
    this.setInputValue('edit-ogp-title', s.ogpTitle || '');
    this.setInputValue('edit-ogp-description', s.ogpDescription || '');
    this.setInputValue('edit-ogp-image', s.ogpImage || '');

    // ロゴプレビュー
    this.updateLogoPreview(s.logoUrl || '');

    // ヒーロー画像プリセット選択状態
    this.updateHeroPresetSelection(s.heroImage || '');
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // タブ切り替え
    document.querySelectorAll('.recruit-editor-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // 閉じるボタン
    document.getElementById('btn-close-editor')?.addEventListener('click', () => {
      this.close();
    });

    // プレビューボタン
    document.getElementById('btn-preview-recruit')?.addEventListener('click', () => {
      this.applyPreview();
    });

    // 保存ボタン
    document.getElementById('btn-save-recruit')?.addEventListener('click', () => {
      this.save();
    });

    // レイアウトスタイル変更
    document.querySelectorAll('input[name="layoutStyle"]').forEach(input => {
      input.addEventListener('change', () => {
        this.settings.layoutStyle = input.value;
        this.hasChanges = true;
        this.applyPreview();
      });
    });

    // デザインパターン変更
    document.querySelectorAll('input[name="designPattern"]').forEach(input => {
      input.addEventListener('change', () => {
        this.settings.designPattern = input.value;
        this.hasChanges = true;
        this.applyPreview();
      });
    });

    // テキスト入力変更
    const textInputs = [
      'edit-hero-title', 'edit-hero-subtitle', 'edit-hero-image',
      'edit-jobs-title', 'edit-cta-title', 'edit-cta-text',
      'edit-logo-url', 'edit-company-name-display', 'edit-phone-number', 'edit-cta-button-text',
      'edit-ogp-title', 'edit-ogp-description', 'edit-ogp-image'
    ];

    textInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.hasChanges = true;
          this.updateSettingsFromForm();
        });
      }
    });

    // ヒーロー画像プリセット
    document.querySelectorAll('#hero-image-presets .hero-preset-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        this.setInputValue('edit-hero-image', url);
        this.updateHeroPresetSelection(url);
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.applyPreview();
      });
    });

    // ロゴアップロード
    document.getElementById('btn-upload-logo-edit')?.addEventListener('click', async () => {
      await this.uploadLogo();
    });

    // ロゴURL入力時のプレビュー更新
    document.getElementById('edit-logo-url')?.addEventListener('input', (e) => {
      this.updateLogoPreview(e.target.value);
    });
  }

  /**
   * タブ切り替え
   */
  switchTab(tabId) {
    document.querySelectorAll('.recruit-editor-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    document.querySelectorAll('.recruit-editor-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabId);
    });
  }

  /**
   * フォームから設定値を取得
   */
  updateSettingsFromForm() {
    this.settings = {
      ...this.settings,
      companyDomain: this.companyDomain,
      layoutStyle: this.getRadioValue('layoutStyle') || 'default',
      designPattern: this.getRadioValue('designPattern') || 'standard',
      heroTitle: document.getElementById('edit-hero-title')?.value || '',
      heroSubtitle: document.getElementById('edit-hero-subtitle')?.value || '',
      heroImage: document.getElementById('edit-hero-image')?.value || '',
      jobsTitle: document.getElementById('edit-jobs-title')?.value || '',
      ctaTitle: document.getElementById('edit-cta-title')?.value || '',
      ctaText: document.getElementById('edit-cta-text')?.value || '',
      logoUrl: document.getElementById('edit-logo-url')?.value || '',
      companyNameDisplay: document.getElementById('edit-company-name-display')?.value || '',
      phoneNumber: document.getElementById('edit-phone-number')?.value || '',
      ctaButtonText: document.getElementById('edit-cta-button-text')?.value || '',
      ogpTitle: document.getElementById('edit-ogp-title')?.value || '',
      ogpDescription: document.getElementById('edit-ogp-description')?.value || '',
      ogpImage: document.getElementById('edit-ogp-image')?.value || ''
    };
  }

  /**
   * プレビューを適用
   */
  applyPreview() {
    this.updateSettingsFromForm();

    // コールバックで親コンポーネントに通知
    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings);
    }
  }

  /**
   * 保存
   */
  async save() {
    const saveBtn = document.getElementById('btn-save-recruit');
    if (!saveBtn) return;

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="loading-spinner-small"></span> 保存中...';

      this.updateSettingsFromForm();
      await saveRecruitSettings(this.settings);

      this.hasChanges = false;
      showToast('設定を保存しました', 'success');
    } catch (error) {
      console.error('[RecruitEditor] 保存エラー:', error);
      showToast('保存に失敗しました: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾</span> 保存';
    }
  }

  /**
   * ロゴをアップロード
   */
  async uploadLogo() {
    const uploadBtn = document.getElementById('btn-upload-logo-edit');
    if (!uploadBtn || !this.companyDomain) return;

    try {
      const file = await selectImageFile({ accept: 'image/png,image/jpeg,image/webp,image/svg+xml' });

      uploadBtn.disabled = true;
      uploadBtn.textContent = '...';

      const url = await uploadRecruitLogo(file, this.companyDomain);

      this.setInputValue('edit-logo-url', url);
      this.updateLogoPreview(url);
      this.hasChanges = true;
      this.updateSettingsFromForm();

      showToast('ロゴをアップロードしました', 'success');
    } catch (error) {
      if (error.message !== 'ファイルが選択されませんでした') {
        showToast('アップロードに失敗しました: ' + error.message, 'error');
      }
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📷';
      }
    }
  }

  /**
   * ロゴプレビューを更新
   */
  updateLogoPreview(url) {
    const previewEl = document.getElementById('edit-logo-preview');
    if (!previewEl) return;

    if (url) {
      previewEl.innerHTML = `<img src="${escapeHtml(url)}" alt="ロゴプレビュー">`;
    } else {
      previewEl.innerHTML = '<span class="logo-placeholder">ロゴ未設定</span>';
    }
  }

  /**
   * ヒーロー画像プリセット選択状態を更新
   */
  updateHeroPresetSelection(selectedUrl) {
    document.querySelectorAll('#hero-image-presets .hero-preset-item').forEach(item => {
      const itemUrl = item.dataset.url;
      // URLの基本部分で比較（パラメータを除く）
      const baseSelectedUrl = selectedUrl?.split('?')[0];
      const baseItemUrl = itemUrl?.split('?')[0];
      item.classList.toggle('selected', baseSelectedUrl && baseItemUrl && baseSelectedUrl === baseItemUrl);
    });
  }

  /**
   * エディタを閉じる
   */
  close() {
    if (this.hasChanges) {
      if (!confirm('保存されていない変更があります。閉じますか？')) {
        return;
      }
    }

    // 編集モードを終了（通常モードに戻る）
    window.location.href = `company-recruit.html?id=${encodeURIComponent(this.companyDomain)}`;
  }

  // ユーティリティ関数
  setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  setRadioValue(name, value) {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  }

  getRadioValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
  }
}

export default RecruitEditor;
