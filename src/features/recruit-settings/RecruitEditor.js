/**
 * 採用ページ編集機能
 * LP同様のビジュアルエディタ
 */
import { escapeHtml, showToast } from '@shared/utils.js';
import { showConfirmDialog } from '@shared/modal.js';
import { uploadRecruitLogo, uploadRecruitHeroImage, selectImageFile } from '@features/admin/image-uploader.js';
import {
  loadRecruitSettings,
  saveRecruitSettings,
  heroImagePresets,
  sectionTemplates,
  designTemplates
} from './core.js';

// TEMPLATES は core.js からインポートした designTemplates を使用
const TEMPLATES = designTemplates;

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
    this.previewDebounceTimer = null; // プレビュー更新のデバウンス用
    this.draggedSection = null; // ドラッグ中のセクション

    // UX改善用
    this.tabChanges = {}; // タブ別の変更追跡
    this.undoStack = []; // Undo履歴
    this.redoStack = []; // Redo履歴
    this.maxUndoStackSize = 50;
    this.autosaveTimer = null;
    this.autosaveInterval = 30000; // 30秒
    this.lastSavedTime = null;
    this.isCollapsed = false;
    this.initialSettings = null; // 初期設定（変更検知用）
    this.sectionVisibility = {}; // セクション表示/非表示状態
    this.currentTab = 'settings'; // 現在のタブ
  }

  /**
   * デバウンス付きでプレビューを更新
   */
  debouncedPreview() {
    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
    }
    this.previewDebounceTimer = setTimeout(() => {
      this.applyPreview();
    }, 300);
  }

  /**
   * 編集モードを有効化
   */
  async enable(companyDomain, company, settings, onSettingsChange) {
    this.companyDomain = companyDomain;
    this.company = company;
    this.settings = settings || {};
    this.initialSettings = JSON.stringify(this.settings); // 初期状態を保存
    this.onSettingsChange = onSettingsChange;
    this.isEnabled = true;

    // 下書きの復元チェック
    await this.checkDraftRestore();

    // 編集パネルを作成
    this.createEditorPanel();

    // フォームに値を反映
    this.populateForm();

    // イベントリスナーを設定
    this.setupEventListeners();

    // キーボードショートカットを設定
    this.setupKeyboardShortcuts();

    // 自動保存を開始
    this.startAutosave();

    // bodyに編集モードクラスを追加
    document.body.classList.add('recruit-edit-mode');

    // プレビューのセクション並び替えを設定
    requestAnimationFrame(() => {
      this.setupPreviewSortable();
    });

    // 画像ホバープレビューを設定
    this.setupImageHoverPreview();

    // ヘルプツールチップを追加
    this.addHelpTooltips();

    // フォームバリデーションを設定
    this.setupFormValidation();

    // クイック追加ボタンを追加
    this.addQuickAddButtons();
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
          <!-- Undo/Redo -->
          <div class="undo-redo-buttons">
            <button type="button" class="btn-undo" id="btn-undo" title="元に戻す (Ctrl+Z)" disabled>↶</button>
            <button type="button" class="btn-redo" id="btn-redo" title="やり直す (Ctrl+Y)" disabled>↷</button>
          </div>
          <!-- プレビューモード切替 -->
          <div class="preview-mode-toggle" id="preview-mode-toggle">
            <button type="button" class="btn-preview-mode active" data-mode="pc" title="PC表示">
              🖥️
            </button>
            <button type="button" class="btn-preview-mode" data-mode="mobile" title="モバイル表示">
              📱
            </button>
          </div>
          <!-- 別タブでプレビュー -->
          <button type="button" class="btn-preview-new-tab" id="btn-preview-new-tab" title="別タブでプレビュー">
            ↗️
          </button>
          <!-- パネル折りたたみ -->
          <button type="button" class="btn-collapse-panel" id="btn-collapse-panel" title="パネルを折りたたむ">
            ◀
          </button>
          <!-- 閉じる -->
          <button type="button" class="btn-close-editor" id="btn-close-editor" title="閉じる">
            ✕
          </button>
        </div>
      </div>

      <div class="recruit-editor-body">
        <!-- タブナビゲーション -->
        <div class="recruit-editor-tabs">
          <button type="button" class="recruit-editor-tab active" data-tab="settings">設定</button>
          <button type="button" class="recruit-editor-tab" data-tab="design">デザイン</button>
          <button type="button" class="recruit-editor-tab" data-tab="content">コンテンツ</button>
          <button type="button" class="recruit-editor-tab" data-tab="header">ヘッダー</button>
          <button type="button" class="recruit-editor-tab" data-tab="sns">SNS</button>
          <button type="button" class="recruit-editor-tab" data-tab="seo">SEO</button>
          <button type="button" class="recruit-editor-tab" data-tab="embed">埋込</button>
        </div>

        <!-- 設定タブ -->
        <div class="recruit-editor-tab-content active" data-tab-content="settings">
          <div class="editor-section">
            <h3 class="editor-section-title">公開設定</h3>
            <div class="form-group">
              <label class="toggle-switch">
                <input type="checkbox" id="edit-is-published" ${this.settings.isPublished ? 'checked' : ''}>
                <span class="toggle-slider"></span>
                <span class="toggle-label-text">採用ページを公開する</span>
              </label>
              <p class="form-hint">非公開にすると、URLにアクセスしても採用ページが表示されません</p>
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">URL設定</h3>
            <div class="form-group">
              <label for="edit-custom-slug">カスタムURL（オプション）</label>
              <div class="input-with-prefix">
                <span class="input-prefix">${window.location.origin}/r/</span>
                <input type="text" id="edit-custom-slug" placeholder="company-name" pattern="[a-z0-9-]+" title="小文字英数字とハイフンのみ使用可">
              </div>
              <p class="form-hint">空欄の場合は会社IDがURLになります</p>
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">求人一覧の設定</h3>
            <div class="form-group">
              <label for="edit-jobs-limit">求人の表示件数</label>
              <select id="edit-jobs-limit">
                <option value="0">すべて表示</option>
                <option value="3">3件</option>
                <option value="5">5件</option>
                <option value="10">10件</option>
                <option value="20">20件</option>
              </select>
              <p class="form-hint">採用ページに表示する求人の最大件数</p>
            </div>
            <div class="form-group">
              <label for="edit-jobs-sort">求人の並び順</label>
              <select id="edit-jobs-sort">
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
                <option value="salary-high">給与高い順</option>
                <option value="salary-low">給与低い順</option>
              </select>
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">リンク・バナー設定</h3>
            <div class="custom-links-list" id="edit-custom-links">
              <!-- 動的に追加 -->
            </div>
            <button type="button" class="btn-add-link" id="btn-add-custom-link">+ リンクを追加</button>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">セクション表示設定</h3>
            <p class="section-description">各セクションの表示/非表示を切り替えられます</p>
            <div class="section-visibility-list" id="section-visibility-list">
              <div class="section-visibility-toggle" data-section="hero">
                <span class="section-name">ヒーロー</span>
                <div class="toggle-mini active" data-section="hero"></div>
              </div>
              <div class="section-visibility-toggle" data-section="company-intro">
                <span class="section-name">会社紹介</span>
                <div class="toggle-mini active" data-section="company-intro"></div>
              </div>
              <div class="section-visibility-toggle" data-section="jobs">
                <span class="section-name">求人一覧</span>
                <div class="toggle-mini active" data-section="jobs"></div>
              </div>
              <div class="section-visibility-toggle" data-section="cta">
                <span class="section-name">CTA</span>
                <div class="toggle-mini active" data-section="cta"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- デザインタブ -->
        <div class="recruit-editor-tab-content" data-tab-content="design">
          <div class="editor-section">
            <h3 class="editor-section-title">テンプレートを選択</h3>
            <p class="section-description">業種やイメージに合わせて最適なデザインを選べます</p>
            <div class="template-grid" id="template-grid">
              ${TEMPLATES.map(tpl => `
                <label class="template-item ${this.settings.template === tpl.id ? 'selected' : ''}" data-template="${tpl.id}">
                  <input type="radio" name="template" value="${tpl.id}" ${this.settings.template === tpl.id ? 'checked' : ''}>
                  <div class="template-preview" style="background: ${tpl.color}"></div>
                  <div class="template-info">
                    <span class="template-name">${escapeHtml(tpl.name)}</span>
                    <span class="template-desc">${escapeHtml(tpl.description)}</span>
                    <span class="template-industries">${tpl.industries.join(' / ')}</span>
                  </div>
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
              <textarea id="edit-hero-subtitle" rows="3" placeholder="私たちと一緒に働きませんか？&#10;（3行まで表示されます）"></textarea>
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
              <div class="input-with-button mt-2">
                <input type="text" id="edit-hero-image" placeholder="または画像URLを入力">
                <button type="button" id="btn-upload-hero-edit" class="btn-upload-small">📷</button>
              </div>
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

          <div class="editor-section">
            <h3 class="editor-section-title">カスタムセクション</h3>
            <p class="section-description">ページに独自のセクションを追加できます</p>
            <div class="custom-sections-list" id="edit-custom-sections">
              <!-- 動的に追加 -->
            </div>
            <div class="add-section-buttons">
              <button type="button" class="btn-open-template-selector" id="btn-open-template-selector-edit">+ コンテンツを追加</button>
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

        <!-- SNSタブ -->
        <div class="recruit-editor-tab-content" data-tab-content="sns">
          <div class="editor-section">
            <h3 class="editor-section-title">SNSリンク設定</h3>
            <p class="section-description">入力したSNSはフッターに表示されます</p>
            <div class="form-group">
              <label for="edit-sns-twitter">
                <span class="sns-icon">𝕏</span> X (Twitter)
              </label>
              <input type="url" id="edit-sns-twitter" placeholder="https://x.com/yourcompany">
            </div>
            <div class="form-group">
              <label for="edit-sns-instagram">
                <span class="sns-icon">📷</span> Instagram
              </label>
              <input type="url" id="edit-sns-instagram" placeholder="https://instagram.com/yourcompany">
            </div>
            <div class="form-group">
              <label for="edit-sns-facebook">
                <span class="sns-icon">f</span> Facebook
              </label>
              <input type="url" id="edit-sns-facebook" placeholder="https://facebook.com/yourcompany">
            </div>
            <div class="form-group">
              <label for="edit-sns-youtube">
                <span class="sns-icon">▶</span> YouTube
              </label>
              <input type="url" id="edit-sns-youtube" placeholder="https://youtube.com/@yourcompany">
            </div>
            <div class="form-group">
              <label for="edit-sns-line">
                <span class="sns-icon">💬</span> LINE
              </label>
              <input type="url" id="edit-sns-line" placeholder="https://line.me/yourcompany">
            </div>
            <div class="form-group">
              <label for="edit-sns-tiktok">
                <span class="sns-icon">♪</span> TikTok
              </label>
              <input type="url" id="edit-sns-tiktok" placeholder="https://tiktok.com/@yourcompany">
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

        <!-- 埋込タブ -->
        <div class="recruit-editor-tab-content" data-tab-content="embed">
          <div class="editor-section">
            <h3 class="editor-section-title">採用ページリンク</h3>
            <p class="section-description">採用ページのURLをコピーして使用できます</p>
            <div class="embed-link-box">
              <input type="text" id="embed-page-url" readonly class="embed-url-input">
              <button type="button" class="btn-copy-embed" data-target="embed-page-url" title="コピー">📋</button>
            </div>
          </div>

          <div class="editor-section">
            <h3 class="editor-section-title">バナー取得</h3>
            <p class="section-description">自社サイトに貼り付けて採用ページへ誘導できます</p>
            <div class="embed-banners-list" id="embed-banners-list">
              <!-- バナー1: シンプルボタン -->
              <div class="embed-banner-item">
                <div class="embed-banner-preview banner-style-button">
                  <a href="#">採用情報はこちら</a>
                </div>
                <div class="embed-banner-actions">
                  <button type="button" class="btn-copy-banner" data-banner="button">コードをコピー</button>
                </div>
              </div>

              <!-- バナー2: 大きめボタン -->
              <div class="embed-banner-item">
                <div class="embed-banner-preview banner-style-button-large">
                  <a href="#">採用情報はこちら →</a>
                </div>
                <div class="embed-banner-actions">
                  <button type="button" class="btn-copy-banner" data-banner="button-large">コードをコピー</button>
                </div>
              </div>

              <!-- バナー3: カード型 -->
              <div class="embed-banner-item">
                <div class="embed-banner-preview banner-style-card">
                  <div class="banner-card-inner">
                    <span class="banner-card-label">採用情報</span>
                    <span class="banner-card-title">採用情報はこちら</span>
                    <span class="banner-card-arrow">→</span>
                  </div>
                </div>
                <div class="embed-banner-actions">
                  <button type="button" class="btn-copy-banner" data-banner="card">コードをコピー</button>
                </div>
              </div>

              <!-- バナー4: 求人募集中 -->
              <div class="embed-banner-item">
                <div class="embed-banner-preview banner-style-recruiting">
                  <div class="banner-recruiting-inner">
                    <span class="banner-recruiting-badge">ただいま</span>
                    <span class="banner-recruiting-title">求人募集中！</span>
                  </div>
                </div>
                <div class="embed-banner-actions">
                  <button type="button" class="btn-copy-banner" data-banner="recruiting">コードをコピー</button>
                </div>
              </div>

              <!-- バナー5: 特設ページ公開中 -->
              <div class="embed-banner-item">
                <div class="embed-banner-preview banner-style-special">
                  <div class="banner-special-inner">
                    <span class="banner-special-title">採用特設ページ</span>
                    <span class="banner-special-subtitle">公開中！！</span>
                  </div>
                </div>
                <div class="embed-banner-actions">
                  <button type="button" class="btn-copy-banner" data-banner="special">コードをコピー</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="recruit-editor-footer">
        <button type="button" class="btn-save-recruit" id="btn-save-recruit">
          <span>💾</span> 保存 <span class="shortcut-hint">Ctrl+S</span>
        </button>
        <div class="save-status" id="save-status">
          <span class="autosave-indicator-editor" id="autosave-indicator">
            <span class="autosave-dot"></span>
            <span class="autosave-text">自動保存: オン</span>
          </span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // 変更状態を更新
    this.updateChangesIndicator();
  }

  /**
   * フォームに設定値を反映
   */
  populateForm() {
    const s = this.settings;
    const companyName = this.company?.company || '';

    // 設定タブ
    this.setCheckboxValue('edit-is-published', s.isPublished !== false); // デフォルトは公開
    this.setInputValue('edit-custom-slug', s.customSlug || '');
    this.setSelectValue('edit-jobs-limit', s.jobsLimit || '0');
    this.setSelectValue('edit-jobs-sort', s.jobsSort || 'newest');
    // カスタムリンク（JSON文字列の場合はパース）
    let customLinks = s.customLinks || [];
    if (typeof customLinks === 'string') {
      try { customLinks = JSON.parse(customLinks); } catch { customLinks = []; }
    }
    this.renderCustomLinks(customLinks);

    // デザイン設定（統合テンプレート）
    const validTemplates = ['modern', 'athome', 'cute', 'trust'];
    let template = s.template || s.designPattern || 'modern';
    // 古いテンプレート名は'modern'にフォールバック
    if (!validTemplates.includes(template)) {
      template = 'modern';
    }
    this.setRadioValue('template', template);
    this.updateTemplateSelection(template);

    // コンテンツ
    this.setInputValue('edit-hero-title', s.heroTitle || `${companyName}で働こう`);
    this.setInputValue('edit-hero-subtitle', s.heroSubtitle || '私たちと一緒に働きませんか？');
    this.setInputValue('edit-hero-image', s.heroImage || '');
    this.setInputValue('edit-jobs-title', s.jobsTitle || '募集中の求人');
    this.setInputValue('edit-cta-title', s.ctaTitle || 'あなたの応募をお待ちしています');
    this.setInputValue('edit-cta-text', s.ctaText || '気になる求人があれば、ぜひお気軽にご応募ください。');
    // カスタムセクション（JSON文字列の場合はパース）
    let customSections = s.customSections || [];
    if (typeof customSections === 'string') {
      try { customSections = JSON.parse(customSections); } catch { customSections = []; }
    }
    this.renderCustomSections(customSections);

    // ヘッダー
    this.setInputValue('edit-logo-url', s.logoUrl || '');
    this.setInputValue('edit-company-name-display', s.companyNameDisplay || companyName);
    this.setInputValue('edit-phone-number', s.phoneNumber || '');
    this.setInputValue('edit-cta-button-text', s.ctaButtonText || '今すぐ応募する');

    // SNS
    this.setInputValue('edit-sns-twitter', s.snsTwitter || '');
    this.setInputValue('edit-sns-instagram', s.snsInstagram || '');
    this.setInputValue('edit-sns-facebook', s.snsFacebook || '');
    this.setInputValue('edit-sns-youtube', s.snsYoutube || '');
    this.setInputValue('edit-sns-line', s.snsLine || '');
    this.setInputValue('edit-sns-tiktok', s.snsTiktok || '');

    // SEO
    this.setInputValue('edit-ogp-title', s.ogpTitle || '');
    this.setInputValue('edit-ogp-description', s.ogpDescription || '');
    this.setInputValue('edit-ogp-image', s.ogpImage || '');

    // ロゴプレビュー
    this.updateLogoPreview(s.logoUrl || '');

    // ヒーロー画像プリセット選択状態
    this.updateHeroPresetSelection(s.heroImage || '');

    // セクション表示設定を反映
    this.updateSectionVisibilityUI();

    // 埋込タブ: URLを設定
    this.updateEmbedUrl();

    // 初期状態をUndo履歴に追加
    this.pushToUndoStack();
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

    // プレビューモード切り替えボタン
    document.querySelectorAll('.btn-preview-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setPreviewMode(mode);
      });
    });

    // 保存ボタン
    document.getElementById('btn-save-recruit')?.addEventListener('click', () => {
      this.save();
    });

    // Undo/Redo ボタン
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      this.undo();
    });
    document.getElementById('btn-redo')?.addEventListener('click', () => {
      this.redo();
    });

    // 別タブでプレビュー
    document.getElementById('btn-preview-new-tab')?.addEventListener('click', () => {
      this.openPreviewInNewTab();
    });

    // パネル折りたたみ
    document.getElementById('btn-collapse-panel')?.addEventListener('click', () => {
      this.togglePanelCollapse();
    });

    // テンプレート変更
    document.querySelectorAll('input[name="template"]').forEach(input => {
      input.addEventListener('change', () => {
        this.settings.template = input.value;
        this.markAsChanged();
        this.updateTemplateSelection(input.value);
        this.applyPreview();
      });
    });

    // テキスト入力変更
    const textInputs = [
      'edit-hero-title', 'edit-hero-subtitle', 'edit-hero-image',
      'edit-jobs-title', 'edit-cta-title', 'edit-cta-text',
      'edit-logo-url', 'edit-company-name-display', 'edit-phone-number', 'edit-cta-button-text',
      'edit-ogp-title', 'edit-ogp-description', 'edit-ogp-image',
      // 設定タブ
      'edit-custom-slug',
      // SNS
      'edit-sns-twitter', 'edit-sns-instagram', 'edit-sns-facebook',
      'edit-sns-youtube', 'edit-sns-line', 'edit-sns-tiktok'
    ];

    textInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.markAsChanged();
          this.updateSettingsFromForm();
          this.debouncedPreview();
        });
      }
    });

    // 公開設定チェックボックス
    document.getElementById('edit-is-published')?.addEventListener('change', () => {
      this.markAsChanged();
      this.updateSettingsFromForm();
      this.applyPreview();
    });

    // 募集の設定 (select)
    ['edit-jobs-limit', 'edit-jobs-sort'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.markAsChanged();
        this.updateSettingsFromForm();
        this.applyPreview();
      });
    });

    // カスタムリンク追加ボタン
    document.getElementById('btn-add-custom-link')?.addEventListener('click', () => {
      this.addCustomLink();
    });

    // セクション表示/非表示トグル
    document.querySelectorAll('.section-visibility-toggle .toggle-mini').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const section = toggle.dataset.section;
        toggle.classList.toggle('active');
        const isVisible = toggle.classList.contains('active');
        this.setSectionVisibility(section, isVisible);
      });
    });

    // カスタムセクション追加ボタン（テンプレートセレクター）
    document.getElementById('btn-open-template-selector-edit')?.addEventListener('click', () => {
      this.showTemplateSelectorModal();
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

    // ヒーロー画像アップロード
    document.getElementById('btn-upload-hero-edit')?.addEventListener('click', async () => {
      await this.uploadHeroImage();
    });

    // ロゴURL入力時のプレビュー更新
    document.getElementById('edit-logo-url')?.addEventListener('input', (e) => {
      this.updateLogoPreview(e.target.value);
    });

    // 埋込タブ: URLコピーボタン
    document.querySelectorAll('.btn-copy-embed').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          this.copyToClipboard(input.value);
        }
      });
    });

    // 埋込タブ: バナーコードコピーボタン
    document.querySelectorAll('.btn-copy-banner').forEach(btn => {
      btn.addEventListener('click', () => {
        const bannerType = btn.dataset.banner;
        const code = this.generateBannerCode(bannerType);
        this.copyToClipboard(code);
      });
    });
  }

  /**
   * タブ切り替え
   */
  switchTab(tabId) {
    this.currentTab = tabId;
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
      // 設定タブ
      isPublished: document.getElementById('edit-is-published')?.checked ?? true,
      customSlug: document.getElementById('edit-custom-slug')?.value || '',
      jobsLimit: document.getElementById('edit-jobs-limit')?.value || '0',
      jobsSort: document.getElementById('edit-jobs-sort')?.value || 'newest',
      customLinks: JSON.stringify(this.getCustomLinks()),
      // デザインテンプレート
      template: this.getRadioValue('template') || 'modern',
      // コンテンツ
      heroTitle: document.getElementById('edit-hero-title')?.value || '',
      heroSubtitle: document.getElementById('edit-hero-subtitle')?.value || '',
      heroImage: document.getElementById('edit-hero-image')?.value || '',
      jobsTitle: document.getElementById('edit-jobs-title')?.value || '',
      ctaTitle: document.getElementById('edit-cta-title')?.value || '',
      ctaText: document.getElementById('edit-cta-text')?.value || '',
      customSections: JSON.stringify(this.getCustomSections()),
      // ヘッダー
      logoUrl: document.getElementById('edit-logo-url')?.value || '',
      companyNameDisplay: document.getElementById('edit-company-name-display')?.value || '',
      phoneNumber: document.getElementById('edit-phone-number')?.value || '',
      ctaButtonText: document.getElementById('edit-cta-button-text')?.value || '',
      // SNS
      snsTwitter: document.getElementById('edit-sns-twitter')?.value || '',
      snsInstagram: document.getElementById('edit-sns-instagram')?.value || '',
      snsFacebook: document.getElementById('edit-sns-facebook')?.value || '',
      snsYoutube: document.getElementById('edit-sns-youtube')?.value || '',
      snsLine: document.getElementById('edit-sns-line')?.value || '',
      snsTiktok: document.getElementById('edit-sns-tiktok')?.value || '',
      // SEO
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

    // プレビューのセクション並び替えを設定（DOM更新後）
    requestAnimationFrame(() => {
      this.setupPreviewSortable();
    });
  }

  /**
   * プレビューモードを切り替え（PC/モバイル）
   */
  setPreviewMode(mode) {
    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.btn-preview-mode').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // bodyにクラスを設定
    if (mode === 'mobile') {
      document.body.classList.add('preview-mode-mobile');
      document.body.classList.remove('preview-mode-pc');
    } else {
      document.body.classList.add('preview-mode-pc');
      document.body.classList.remove('preview-mode-mobile');
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

      // 保存成功
      this.hasChanges = false;
      this.lastSavedTime = new Date();
      this.initialSettings = JSON.stringify(this.settings);

      // 下書きをクリア
      this.clearDraft();

      // タブの変更状態をクリア
      this.clearTabChanges();

      // インジケーターを更新
      this.updateChangesIndicator();

      showToast('設定を保存しました', 'success');
    } catch (error) {
      console.error('[RecruitEditor] 保存エラー:', error);
      showToast('保存に失敗しました: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾</span> 保存 <span class="shortcut-hint">Ctrl+S</span>';
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
   * ヒーロー画像をアップロード
   */
  async uploadHeroImage() {
    const uploadBtn = document.getElementById('btn-upload-hero-edit');
    if (!uploadBtn || !this.companyDomain) return;

    try {
      const file = await selectImageFile({ accept: 'image/png,image/jpeg,image/webp' });

      uploadBtn.disabled = true;
      uploadBtn.textContent = '...';

      const url = await uploadRecruitHeroImage(file, this.companyDomain);

      this.setInputValue('edit-hero-image', url);
      this.updateHeroPresetSelection(url);
      this.hasChanges = true;
      this.updateSettingsFromForm();
      this.applyPreview();

      showToast('ヒーロー画像をアップロードしました', 'success');
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
   * テンプレート選択状態を更新
   */
  updateTemplateSelection(selectedTemplate) {
    document.querySelectorAll('.template-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.template === selectedTemplate);
    });
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
  async close() {
    if (this.hasChanges) {
      const confirmed = await showConfirmDialog({
        title: '変更の破棄',
        message: '保存されていない変更があります。閉じますか？',
        confirmText: '閉じる',
        cancelText: '編集を続ける',
        danger: true
      });
      if (!confirmed) return;
    }

    // クリーンアップ
    this.cleanup();

    // 編集モードを終了（通常モードに戻る）
    window.location.href = `company-recruit.html?id=${encodeURIComponent(this.companyDomain)}`;
  }

  // ユーティリティ関数
  setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  setCheckboxValue(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = !!checked;
  }

  setSelectValue(id, value) {
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

  /**
   * カスタムリンクをレンダリング
   */
  renderCustomLinks(links) {
    const container = document.getElementById('edit-custom-links');
    if (!container) return;

    container.innerHTML = links.map((link, index) => `
      <div class="custom-link-item" data-index="${index}">
        <div class="custom-link-inputs">
          <input type="text" class="custom-link-label" placeholder="リンクテキスト" value="${escapeHtml(link.label || '')}">
          <input type="url" class="custom-link-url" placeholder="https://..." value="${escapeHtml(link.url || '')}">
        </div>
        <button type="button" class="btn-remove-link" data-index="${index}">✕</button>
      </div>
    `).join('');

    // 削除ボタンのイベントリスナー
    container.querySelectorAll('.btn-remove-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const currentLinks = this.getCustomLinks();
        currentLinks.splice(idx, 1);
        this.renderCustomLinks(currentLinks);
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.applyPreview();
      });
    });

    // 入力変更時のイベントリスナー
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.debouncedPreview();
      });
    });
  }

  /**
   * カスタムリンクを取得
   */
  getCustomLinks() {
    const container = document.getElementById('edit-custom-links');
    if (!container) return [];

    const links = [];
    container.querySelectorAll('.custom-link-item').forEach(item => {
      const label = item.querySelector('.custom-link-label')?.value || '';
      const url = item.querySelector('.custom-link-url')?.value || '';
      if (label || url) {
        links.push({ label, url });
      }
    });
    return links;
  }

  /**
   * カスタムリンクを追加
   */
  addCustomLink() {
    const currentLinks = this.getCustomLinks();
    currentLinks.push({ label: '', url: '' });
    this.renderCustomLinks(currentLinks);
    this.hasChanges = true;
    this.updateSettingsFromForm();
    this.applyPreview();
  }

  /**
   * カスタムセクションをレンダリング
   */
  renderCustomSections(sections) {
    const container = document.getElementById('edit-custom-sections');
    if (!container) return;

    container.innerHTML = (sections || []).map((section, index) => {
      const template = sectionTemplates.find(t => t.id === section.type);
      const typeLabel = template ? `${template.name}（${template.label}）` : section.type;

      return `
        <div class="custom-section-item" data-index="${index}" data-type="${section.type}" draggable="true">
          <div class="section-item-header">
            <span class="section-drag-handle" style="display:flex;width:24px;height:24px;background:#e5e7eb;border-radius:4px;align-items:center;justify-content:center;cursor:grab;" title="ドラッグで並び替え">☰</span>
            <span class="section-type-badge ${template ? 'template-badge' : ''}">${escapeHtml(typeLabel)}</span>
            <div class="section-item-actions">
              <button type="button" class="btn-move-section" data-direction="up" data-index="${index}" ${index === 0 ? 'disabled' : ''} title="上へ移動">↑</button>
              <button type="button" class="btn-move-section" data-direction="down" data-index="${index}" ${index === sections.length - 1 ? 'disabled' : ''} title="下へ移動">↓</button>
              <button type="button" class="btn-remove-section" data-index="${index}" title="削除">✕</button>
            </div>
          </div>
          <div class="section-item-content">
            ${this.renderSectionFields(template, section, index)}
          </div>
        </div>
      `;
    }).join('');

    this.bindCustomSectionEvents(container);
    this.bindDragAndDropEvents(container);
  }

  /**
   * セクションのフィールドをレンダリング
   */
  renderSectionFields(template, section, index) {
    if (!template || !template.fields) {
      // 後方互換: 古いtext/heading/image形式
      if (section.type === 'text') {
        return `<textarea class="section-content" rows="3" placeholder="テキストを入力">${escapeHtml(section.content || '')}</textarea>`;
      } else if (section.type === 'heading') {
        return `<input type="text" class="section-content" placeholder="見出しテキスト" value="${escapeHtml(section.content || '')}">`;
      } else if (section.type === 'image') {
        return `<input type="url" class="section-content" placeholder="画像URL（https://...）" value="${escapeHtml(section.content || '')}">`;
      }
      return '';
    }

    return template.fields.map(field => {
      const value = section[field.key] || '';

      if (field.type === 'text') {
        return `
          <div class="section-field">
            <label>${escapeHtml(field.label)}</label>
            <input type="text" class="section-field-input" data-field="${field.key}"
                   placeholder="${escapeHtml(field.placeholder || '')}" value="${escapeHtml(value)}">
          </div>
        `;
      } else if (field.type === 'textarea') {
        return `
          <div class="section-field">
            <label>${escapeHtml(field.label)}</label>
            <textarea class="section-field-input" data-field="${field.key}" rows="3"
                      placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(value)}</textarea>
          </div>
        `;
      } else if (field.type === 'image') {
        return `
          <div class="section-field">
            <label>${escapeHtml(field.label)}</label>
            ${value ? `<img src="${escapeHtml(value)}" class="section-image-preview" alt="">` : ''}
            <div class="input-with-button">
              <input type="url" class="section-field-input section-image-url" data-field="${field.key}"
                     placeholder="画像URL" value="${escapeHtml(value)}">
              <button type="button" class="btn-upload-small btn-upload-section-image" data-index="${index}" data-field="${field.key}">📷</button>
            </div>
          </div>
        `;
      } else if (field.type === 'items') {
        const items = Array.isArray(section[field.key]) ? section[field.key] : [];
        const maxItems = field.maxItems || 4;
        return `
          <div class="section-field section-items-field" data-field="${field.key}" data-max-items="${maxItems}">
            <label>${escapeHtml(field.label)}</label>
            <div class="section-items-list">
              ${items.map((item, itemIndex) => `
                <div class="section-item-entry" data-item-index="${itemIndex}">
                  ${field.itemFields.map(itemField => `
                    <div class="item-field">
                      <label>${escapeHtml(itemField.label)}</label>
                      ${itemField.type === 'textarea'
                        ? `<textarea class="item-field-input" data-field="${itemField.key}" rows="2"
                                     placeholder="${escapeHtml(itemField.placeholder || '')}">${escapeHtml(item[itemField.key] || '')}</textarea>`
                        : `<input type="text" class="item-field-input" data-field="${itemField.key}"
                                  placeholder="${escapeHtml(itemField.placeholder || '')}" value="${escapeHtml(item[itemField.key] || '')}">`
                      }
                    </div>
                  `).join('')}
                  <button type="button" class="btn-remove-item" data-item-index="${itemIndex}">✕</button>
                </div>
              `).join('')}
            </div>
            ${items.length < maxItems ? `<button type="button" class="btn-add-item">+ 項目を追加</button>` : ''}
          </div>
        `;
      } else if (field.type === 'gallery') {
        const images = Array.isArray(section[field.key]) ? section[field.key] : [];
        const maxImages = field.maxImages || 6;
        return `
          <div class="section-field section-gallery-field" data-field="${field.key}" data-max-images="${maxImages}">
            <label>${escapeHtml(field.label)}</label>
            <div class="section-gallery-grid">
              ${images.map((url, imgIndex) => `
                <div class="gallery-image-item">
                  <img src="${escapeHtml(url)}" alt="">
                  <button type="button" class="btn-remove-gallery-image" data-image-index="${imgIndex}">✕</button>
                </div>
              `).join('')}
              ${images.length < maxImages ? `
                <button type="button" class="btn-add-gallery-image" data-index="${index}" data-field="${field.key}">+ 画像追加</button>
              ` : ''}
            </div>
          </div>
        `;
      }
      return '';
    }).join('');
  }

  /**
   * カスタムセクションのイベントをバインド
   */
  bindCustomSectionEvents(container) {
    // 削除ボタン
    container.querySelectorAll('.btn-remove-section').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const currentSections = this.getCustomSections();
        currentSections.splice(idx, 1);
        this.renderCustomSections(currentSections);
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.applyPreview();
      });
    });

    // 移動ボタン
    container.querySelectorAll('.btn-move-section').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const direction = btn.dataset.direction;
        const currentSections = this.getCustomSections();

        if (direction === 'up' && idx > 0) {
          [currentSections[idx - 1], currentSections[idx]] = [currentSections[idx], currentSections[idx - 1]];
        } else if (direction === 'down' && idx < currentSections.length - 1) {
          [currentSections[idx], currentSections[idx + 1]] = [currentSections[idx + 1], currentSections[idx]];
        }

        this.renderCustomSections(currentSections);
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.applyPreview();
      });
    });

    // フィールド入力変更
    container.querySelectorAll('.section-field-input, .section-content').forEach(input => {
      input.addEventListener('input', () => {
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.debouncedPreview();
      });
    });

    // 項目フィールド入力変更
    container.querySelectorAll('.item-field-input').forEach(input => {
      input.addEventListener('input', () => {
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.debouncedPreview();
      });
    });

    // 画像アップロードボタン
    container.querySelectorAll('.btn-upload-section-image').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.uploadSectionImage(btn);
      });
    });

    // 項目追加ボタン
    container.querySelectorAll('.btn-add-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const sectionItem = btn.closest('.custom-section-item');
        const sectionIndex = parseInt(sectionItem.dataset.index, 10);
        const itemsField = btn.closest('.section-items-field');
        const fieldName = itemsField.dataset.field;
        const maxItems = parseInt(itemsField.dataset.maxItems, 10) || 4;

        const currentSections = this.getCustomSections();
        if (currentSections[sectionIndex]) {
          if (!Array.isArray(currentSections[sectionIndex][fieldName])) {
            currentSections[sectionIndex][fieldName] = [];
          }
          if (currentSections[sectionIndex][fieldName].length < maxItems) {
            currentSections[sectionIndex][fieldName].push({});
            this.renderCustomSections(currentSections);
            this.hasChanges = true;
            this.updateSettingsFromForm();
            this.applyPreview();
          }
        }
      });
    });

    // 項目削除ボタン
    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemIndex = parseInt(btn.dataset.itemIndex, 10);
        const sectionItem = btn.closest('.custom-section-item');
        const sectionIndex = parseInt(sectionItem.dataset.index, 10);
        const currentSections = this.getCustomSections();
        if (currentSections[sectionIndex] && Array.isArray(currentSections[sectionIndex].items)) {
          currentSections[sectionIndex].items.splice(itemIndex, 1);
          this.renderCustomSections(currentSections);
          this.hasChanges = true;
          this.updateSettingsFromForm();
          this.applyPreview();
        }
      });
    });

    // ギャラリー画像追加ボタン
    container.querySelectorAll('.btn-add-gallery-image').forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = parseInt(btn.dataset.index, 10);
        const field = btn.dataset.field;
        try {
          const file = await selectImageFile();
          if (file) {
            const url = await uploadRecruitHeroImage(file, this.companyDomain);
            const currentSections = this.getCustomSections();
            if (!currentSections[index][field]) {
              currentSections[index][field] = [];
            }
            currentSections[index][field].push(url);
            this.renderCustomSections(currentSections);
            this.hasChanges = true;
            this.updateSettingsFromForm();
            this.applyPreview();
            showToast('画像をアップロードしました', 'success');
          }
        } catch (error) {
          if (error.message !== 'ファイルが選択されませんでした') {
            showToast('画像のアップロードに失敗しました', 'error');
          }
        }
      });
    });

    // ギャラリー画像削除ボタン
    container.querySelectorAll('.btn-remove-gallery-image').forEach(btn => {
      btn.addEventListener('click', () => {
        const imageIndex = parseInt(btn.dataset.imageIndex, 10);
        const sectionItem = btn.closest('.custom-section-item');
        const sectionIndex = parseInt(sectionItem.dataset.index, 10);
        const galleryField = btn.closest('.section-gallery-field');
        const fieldName = galleryField.dataset.field;
        const currentSections = this.getCustomSections();
        if (currentSections[sectionIndex] && Array.isArray(currentSections[sectionIndex][fieldName])) {
          currentSections[sectionIndex][fieldName].splice(imageIndex, 1);
          this.renderCustomSections(currentSections);
          this.hasChanges = true;
          this.updateSettingsFromForm();
          this.applyPreview();
        }
      });
    });
  }

  /**
   * ドラッグ&ドロップイベントをバインド
   */
  bindDragAndDropEvents(container) {
    let draggedItem = null;
    let draggedIndex = -1;

    container.querySelectorAll('.custom-section-item').forEach(item => {
      // ドラッグ開始
      item.addEventListener('dragstart', (e) => {
        // ドラッグハンドル以外からのドラッグを防止
        const handle = e.target.closest('.section-drag-handle');
        if (!handle && e.target !== item) {
          // ドラッグハンドルからでない場合は入力フィールドの操作かもしれない
          const isInput = e.target.closest('input, textarea, select, button');
          if (isInput) {
            e.preventDefault();
            return;
          }
        }

        draggedItem = item;
        draggedIndex = parseInt(item.dataset.index, 10);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedIndex.toString());
      });

      // ドラッグ終了
      item.addEventListener('dragend', () => {
        if (draggedItem) {
          draggedItem.classList.remove('dragging');
        }
        draggedItem = null;
        draggedIndex = -1;
        container.querySelectorAll('.custom-section-item').forEach(el => {
          el.classList.remove('drag-over');
        });
      });

      // ドラッグ中（他の要素上）
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedItem && item !== draggedItem) {
          item.classList.add('drag-over');
        }
      });

      // ドラッグ離脱
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      // ドロップ
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');

        if (!draggedItem || item === draggedItem) return;

        const targetIndex = parseInt(item.dataset.index, 10);
        if (draggedIndex === targetIndex) return;

        // セクションの並び替え
        const currentSections = this.getCustomSections();
        const [movedSection] = currentSections.splice(draggedIndex, 1);
        currentSections.splice(targetIndex, 0, movedSection);

        this.renderCustomSections(currentSections);
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.applyPreview();

        showToast('セクションを移動しました', 'success');
      });
    });
  }

  /**
   * セクション画像をアップロード
   */
  async uploadSectionImage(btn) {
    try {
      const file = await selectImageFile();
      if (file) {
        btn.disabled = true;
        btn.textContent = '...';
        const url = await uploadRecruitHeroImage(file, this.companyDomain);
        const input = btn.parentElement.querySelector('.section-image-url');
        if (input) {
          input.value = url;
          // プレビュー更新
          let preview = btn.closest('.section-field').querySelector('.section-image-preview');
          if (!preview) {
            preview = document.createElement('img');
            preview.className = 'section-image-preview';
            btn.closest('.section-field').insertBefore(preview, btn.parentElement);
          }
          preview.src = url;
        }
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.applyPreview();
        showToast('画像をアップロードしました', 'success');
      }
    } catch (error) {
      if (error.message !== 'ファイルが選択されませんでした') {
        showToast('画像のアップロードに失敗しました', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '📷';
    }
  }

  /**
   * テンプレート選択モーダルを表示
   */
  showTemplateSelectorModal() {
    // 既存のモーダルがあれば削除
    const existingModal = document.getElementById('template-selector-modal-edit');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHtml = `
      <div id="template-selector-modal-edit" class="template-modal-overlay">
        <div class="template-modal">
          <div class="template-modal-header">
            <h3>コンテンツを追加する</h3>
            <button type="button" class="template-modal-close">&times;</button>
          </div>
          <div class="template-modal-body">
            <p class="template-modal-description">追加するコンテンツを選択してください。</p>
            <div class="template-list">
              ${sectionTemplates.map(template => `
                <div class="template-item" data-template-id="${template.id}">
                  <div class="template-thumbnail">
                    <img src='${template.thumbnail}' alt="${escapeHtml(template.name)}">
                  </div>
                  <div class="template-info">
                    <h4 class="template-name">${escapeHtml(template.name)}（${escapeHtml(template.label)}）</h4>
                    <p class="template-description">${escapeHtml(template.description)}</p>
                  </div>
                  <button type="button" class="btn-add-template" data-template-id="${template.id}">追加する</button>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="template-modal-footer">
            <button type="button" class="btn-template-cancel">キャンセル</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('template-selector-modal-edit');

    // 閉じるボタン
    modal.querySelector('.template-modal-close').addEventListener('click', () => {
      modal.remove();
    });

    // キャンセルボタン
    modal.querySelector('.btn-template-cancel').addEventListener('click', () => {
      modal.remove();
    });

    // オーバーレイクリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // テンプレート追加ボタン
    modal.querySelectorAll('.btn-add-template').forEach(btn => {
      btn.addEventListener('click', () => {
        const templateId = btn.dataset.templateId;
        this.addCustomSection(templateId);
        modal.remove();
      });
    });
  }

  /**
   * カスタムセクションを取得
   */
  getCustomSections() {
    const container = document.getElementById('edit-custom-sections');
    if (!container) return [];

    const sections = [];
    container.querySelectorAll('.custom-section-item').forEach(item => {
      const type = item.dataset.type;
      const template = sectionTemplates.find(t => t.id === type);
      const section = { type };

      if (template && template.fields) {
        // テンプレートベースのフィールドを取得
        template.fields.forEach(field => {
          if (field.type === 'items') {
            // 項目配列を取得
            const items = [];
            item.querySelectorAll('.section-item-entry').forEach(entry => {
              const itemData = {};
              entry.querySelectorAll('.item-field-input').forEach(input => {
                itemData[input.dataset.field] = input.value || '';
              });
              items.push(itemData);
            });
            section[field.key] = items;
          } else if (field.type === 'gallery') {
            // ギャラリー画像URLを取得
            const images = [];
            item.querySelectorAll('.gallery-image-item img').forEach(img => {
              if (img.src) images.push(img.src);
            });
            section[field.key] = images;
          } else {
            // 通常のフィールド
            const input = item.querySelector(`.section-field-input[data-field="${field.key}"]`);
            section[field.key] = input?.value || '';
          }
        });
      } else {
        // 後方互換: 古いtext/heading/image形式
        const content = item.querySelector('.section-content')?.value || '';
        section.content = content;
      }

      sections.push(section);
    });
    return sections;
  }

  /**
   * カスタムセクションを追加
   */
  addCustomSection(templateId) {
    const template = sectionTemplates.find(t => t.id === templateId);
    const currentSections = this.getCustomSections();

    // テンプレートの初期値を設定
    const newSection = { type: templateId };
    if (template && template.fields) {
      template.fields.forEach(field => {
        if (field.type === 'items') {
          newSection[field.key] = [];
        } else if (field.type === 'gallery') {
          newSection[field.key] = [];
        } else {
          newSection[field.key] = '';
        }
      });
    } else {
      newSection.content = '';
    }

    currentSections.push(newSection);
    this.renderCustomSections(currentSections);
    this.hasChanges = true;
    this.updateSettingsFromForm();
    this.applyPreview();
  }

  /**
   * 埋込タブのURLを更新
   */
  updateEmbedUrl() {
    const urlInput = document.getElementById('embed-page-url');
    if (urlInput && this.companyDomain) {
      const baseUrl = window.location.origin;
      urlInput.value = `${baseUrl}/company-recruit.html?id=${encodeURIComponent(this.companyDomain)}`;
    }
  }

  /**
   * バナーのHTMLコードを生成
   */
  generateBannerCode(bannerType) {
    const baseUrl = window.location.origin;
    const recruitUrl = `${baseUrl}/company-recruit.html?id=${encodeURIComponent(this.companyDomain)}`;
    const companyName = this.company?.company || '';

    switch (bannerType) {
      case 'button':
        return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">採用情報はこちら</a>`;

      case 'button-large':
        return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;box-shadow:0 4px 14px rgba(14,165,233,0.4);">採用情報はこちら →</a>`;

      case 'card':
        return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:block;max-width:300px;padding:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><span style="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;">採用情報</span><span style="display:block;font-size:16px;font-weight:bold;color:#1f2937;">${escapeHtml(companyName)} 採用情報はこちら</span><span style="display:block;margin-top:8px;color:#0ea5e9;font-size:14px;">詳しく見る →</span></a>`;

      case 'recruiting':
        return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 28px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;border-radius:8px;text-align:center;box-shadow:0 4px 14px rgba(249,115,22,0.4);"><span style="display:block;font-size:12px;font-weight:500;">ただいま</span><span style="display:block;font-size:18px;font-weight:bold;">求人募集中！</span></a>`;

      case 'special':
        return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:20px 32px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;text-decoration:none;border-radius:12px;text-align:center;box-shadow:0 4px 20px rgba(99,102,241,0.4);"><span style="display:block;font-size:14px;font-weight:500;">採用特設ページ</span><span style="display:block;font-size:20px;font-weight:bold;margin-top:4px;">公開中！！</span></a>`;

      default:
        return '';
    }
  }

  /**
   * クリップボードにコピー
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('コピーしました', 'success');
    } catch (error) {
      console.error('クリップボードへのコピーに失敗:', error);
      showToast('コピーに失敗しました', 'error');
    }
  }

  /**
   * プレビューのセクション並び替えを設定
   */
  setupPreviewSortable() {
    const contentEl = document.getElementById('recruit-content');
    if (!contentEl) return;

    const sections = contentEl.querySelectorAll('section');
    if (sections.length === 0) return;

    sections.forEach((section) => {
      // 既にドラッグハンドルがある場合はスキップ
      if (section.querySelector('.recruit-section-drag-handle')) return;

      const sectionType = this.detectRecruitSectionType(section);
      section.dataset.section = sectionType;
      section.classList.add('recruit-sortable-section');

      // ドラッグハンドルを追加
      const handle = document.createElement('div');
      handle.className = 'recruit-section-drag-handle';
      handle.innerHTML = `
        <span class="recruit-section-label">${this.getRecruitSectionLabel(sectionType)}</span>
        <span class="recruit-section-drag-icon">☰</span>
      `;
      section.insertBefore(handle, section.firstChild);

      section.setAttribute('draggable', 'true');

      section.addEventListener('dragstart', (e) => {
        this.draggedSection = section;
        section.classList.add('recruit-section-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setDragImage(section, 50, 30);
      });

      section.addEventListener('dragend', () => {
        section.classList.remove('recruit-section-dragging');
        this.draggedSection = null;
        this.saveRecruitSectionOrder();
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

  /**
   * セクションの種類を検出
   */
  detectRecruitSectionType(section) {
    if (section.classList.contains('recruit-hero')) return 'hero';
    if (section.classList.contains('recruit-about')) return 'company-intro';
    if (section.classList.contains('recruit-jobs')) return 'jobs';
    if (section.classList.contains('recruit-cta')) return 'cta';
    if (section.id && section.id.startsWith('custom-section-')) {
      const index = section.id.replace('custom-section-', '');
      return `custom-${index}`;
    }
    return 'unknown';
  }

  /**
   * セクションのラベルを取得
   */
  getRecruitSectionLabel(type) {
    const labels = {
      'hero': 'ヒーロー',
      'company-intro': '会社紹介',
      'jobs': '求人一覧',
      'cta': 'CTA'
    };
    if (type.startsWith('custom-')) {
      return 'カスタム';
    }
    return labels[type] || 'セクション';
  }

  /**
   * セクション順序を保存
   */
  saveRecruitSectionOrder() {
    const contentEl = document.getElementById('recruit-content');
    if (!contentEl) return;

    const sections = contentEl.querySelectorAll('section');
    const order = Array.from(sections)
      .map(s => s.dataset.section)
      .filter(s => s && s !== 'unknown');

    this.settings.sectionOrder = order.join(',');
    this.hasChanges = true;

    // 編集パネルのフォームも更新（セクション管理タブ）
    this.updateSectionOrderInPanel(order);

    showToast('セクション順序を変更しました', 'success');
  }

  /**
   * 編集パネルのセクション順序を更新
   */
  updateSectionOrderInPanel(order) {
    // セクション管理タブがある場合は同期
    const sectionList = document.getElementById('edit-section-order');
    if (sectionList) {
      // 必要に応じてセクション管理UIを更新
      // 現在は簡易実装のため、保存時に反映される
    }
  }

  // ========================================
  // UX改善メソッド
  // ========================================

  /**
   * 3. キーボードショートカットを設定
   */
  setupKeyboardShortcuts() {
    this.keyboardHandler = (e) => {
      // Ctrl+S / Cmd+S: 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.save();
      }
      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }
      // Ctrl+Y / Cmd+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.redo();
      }
      // Escape: パネル折りたたみ
      if (e.key === 'Escape' && this.isEnabled) {
        this.togglePanelCollapse();
      }
    };
    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * 4. 自動保存を開始
   */
  startAutosave() {
    this.autosaveTimer = setInterval(() => {
      if (this.hasChanges) {
        this.saveDraft();
      }
    }, this.autosaveInterval);
  }

  /**
   * 自動保存を停止
   */
  stopAutosave() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /**
   * 下書きを保存（localStorage）
   */
  saveDraft() {
    if (!this.companyDomain) return;

    const draftKey = `recruit_draft_${this.companyDomain}`;
    this.updateSettingsFromForm();

    const draft = {
      settings: this.settings,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      this.updateAutosaveIndicator('saved');
    } catch (e) {
      console.warn('[RecruitEditor] 下書き保存に失敗:', e);
    }
  }

  /**
   * 下書きを削除
   */
  clearDraft() {
    if (!this.companyDomain) return;
    const draftKey = `recruit_draft_${this.companyDomain}`;
    localStorage.removeItem(draftKey);
  }

  /**
   * 下書きの復元チェック
   */
  async checkDraftRestore() {
    if (!this.companyDomain) return;

    const draftKey = `recruit_draft_${this.companyDomain}`;
    const draftJson = localStorage.getItem(draftKey);

    if (!draftJson) return;

    try {
      const draft = JSON.parse(draftJson);
      const draftTime = new Date(draft.timestamp);
      const now = new Date();
      const diffHours = (now - draftTime) / (1000 * 60 * 60);

      // 24時間以内の下書きのみ復元対象
      if (diffHours > 24) {
        this.clearDraft();
        return;
      }

      const timeStr = draftTime.toLocaleString('ja-JP');
      const confirmed = await showConfirmDialog({
        title: '下書きの復元',
        message: `${timeStr} に保存された下書きがあります。復元しますか？`,
        confirmText: '復元する',
        cancelText: '破棄する'
      });

      if (confirmed) {
        this.settings = draft.settings;
        showToast('下書きを復元しました', 'success');
      } else {
        this.clearDraft();
      }
    } catch (e) {
      console.warn('[RecruitEditor] 下書き復元に失敗:', e);
      this.clearDraft();
    }
  }

  /**
   * 自動保存インジケーターを更新
   */
  updateAutosaveIndicator(status) {
    const indicator = document.getElementById('autosave-indicator');
    if (!indicator) return;

    const textEl = indicator.querySelector('.autosave-text');
    indicator.classList.remove('saving', 'saved');

    if (status === 'saving') {
      indicator.classList.add('saving');
      if (textEl) textEl.textContent = '保存中...';
    } else if (status === 'saved') {
      indicator.classList.add('saved');
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      if (textEl) textEl.textContent = `下書き保存: ${timeStr}`;
    }
  }

  /**
   * 5. パネル折りたたみ切り替え
   */
  togglePanelCollapse() {
    const panel = document.getElementById('recruit-editor-panel');
    if (!panel) return;

    this.isCollapsed = !this.isCollapsed;
    panel.classList.toggle('collapsed', this.isCollapsed);

    const btn = document.getElementById('btn-collapse-panel');
    if (btn) {
      btn.textContent = this.isCollapsed ? '▶' : '◀';
      btn.title = this.isCollapsed ? 'パネルを展開' : 'パネルを折りたたむ';
    }
  }

  /**
   * 1. 変更状態インジケーターを更新
   */
  updateChangesIndicator() {
    const panel = document.getElementById('recruit-editor-panel');
    const saveBtn = document.getElementById('btn-save-recruit');

    if (panel) {
      panel.classList.toggle('has-changes', this.hasChanges);
    }

    if (saveBtn) {
      // 未保存バッジ
      let badge = saveBtn.querySelector('.unsaved-badge');
      if (this.hasChanges && !badge) {
        badge = document.createElement('span');
        badge.className = 'unsaved-badge';
        saveBtn.style.position = 'relative';
        saveBtn.appendChild(badge);
      } else if (!this.hasChanges && badge) {
        badge.remove();
      }
    }
  }

  /**
   * 6. タブの変更状態を追跡
   */
  markTabAsChanged(tabId) {
    this.tabChanges[tabId] = true;
    const tab = document.querySelector(`.recruit-editor-tab[data-tab="${tabId}"]`);
    if (tab) {
      tab.classList.add('has-changes');
    }
  }

  /**
   * タブの変更状態をクリア
   */
  clearTabChanges() {
    this.tabChanges = {};
    document.querySelectorAll('.recruit-editor-tab.has-changes').forEach(tab => {
      tab.classList.remove('has-changes');
    });
  }

  /**
   * 11. Undo履歴に追加
   */
  pushToUndoStack() {
    this.updateSettingsFromForm();
    const state = JSON.stringify(this.settings);

    // 同じ状態は追加しない
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === state) {
      return;
    }

    this.undoStack.push(state);

    // スタックサイズ制限
    if (this.undoStack.length > this.maxUndoStackSize) {
      this.undoStack.shift();
    }

    // Redoスタックをクリア
    this.redoStack = [];

    this.updateUndoRedoButtons();
  }

  /**
   * Undo実行
   */
  undo() {
    if (this.undoStack.length <= 1) return;

    // 現在の状態をRedoスタックに保存
    const current = this.undoStack.pop();
    this.redoStack.push(current);

    // 前の状態を復元
    const previous = this.undoStack[this.undoStack.length - 1];
    if (previous) {
      this.settings = JSON.parse(previous);
      this.populateForm();
      this.applyPreview();
      showToast('元に戻しました', 'success');
    }

    this.updateUndoRedoButtons();
  }

  /**
   * Redo実行
   */
  redo() {
    if (this.redoStack.length === 0) return;

    const next = this.redoStack.pop();
    this.undoStack.push(next);

    this.settings = JSON.parse(next);
    this.populateForm();
    this.applyPreview();
    showToast('やり直しました', 'success');

    this.updateUndoRedoButtons();
  }

  /**
   * Undo/Redoボタンの状態を更新
   */
  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    if (undoBtn) {
      undoBtn.disabled = this.undoStack.length <= 1;
    }
    if (redoBtn) {
      redoBtn.disabled = this.redoStack.length === 0;
    }
  }

  /**
   * 9. 別タブでプレビューを開く
   */
  openPreviewInNewTab() {
    const url = `${window.location.origin}/company-recruit.html?id=${encodeURIComponent(this.companyDomain)}`;
    window.open(url, '_blank');
  }

  /**
   * 10. 画像ホバープレビューを設定
   */
  setupImageHoverPreview() {
    // プレビュー要素を作成
    let previewEl = document.getElementById('image-hover-preview');
    if (!previewEl) {
      previewEl = document.createElement('img');
      previewEl.id = 'image-hover-preview';
      previewEl.className = 'image-hover-preview';
      document.body.appendChild(previewEl);
    }

    // 画像入力フィールドにホバーイベントを設定
    document.addEventListener('mouseover', (e) => {
      const input = e.target.closest('input[type="text"], input[type="url"]');
      if (!input) return;

      const value = input.value?.trim();
      if (!value || !this.isImageUrl(value)) return;

      previewEl.src = value;
      previewEl.classList.add('visible');
      this.positionHoverPreview(e, previewEl);
    });

    document.addEventListener('mouseout', (e) => {
      const input = e.target.closest('input[type="text"], input[type="url"]');
      if (input) {
        previewEl.classList.remove('visible');
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (previewEl.classList.contains('visible')) {
        this.positionHoverPreview(e, previewEl);
      }
    });
  }

  /**
   * 画像URLかどうか判定
   */
  isImageUrl(url) {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
           lowerUrl.includes('storage.googleapis.com') ||
           lowerUrl.includes('firebasestorage');
  }

  /**
   * ホバープレビューの位置を設定
   */
  positionHoverPreview(e, previewEl) {
    const offset = 15;
    let x = e.clientX + offset;
    let y = e.clientY + offset;

    // 画面外にはみ出さないように調整
    const rect = previewEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      x = e.clientX - rect.width - offset;
    }
    if (y + rect.height > window.innerHeight) {
      y = e.clientY - rect.height - offset;
    }

    previewEl.style.left = `${x}px`;
    previewEl.style.top = `${y}px`;
  }

  /**
   * 変更をマーク（hasChanges + タブ変更 + Undo履歴）
   */
  markAsChanged() {
    if (!this.hasChanges) {
      this.pushToUndoStack(); // 変更前の状態を保存
    }
    this.hasChanges = true;
    this.markTabAsChanged(this.currentTab);
    this.updateChangesIndicator();
  }

  /**
   * 7. セクションの表示/非表示を設定
   */
  setSectionVisibility(sectionId, isVisible) {
    this.sectionVisibility[sectionId] = isVisible;

    // 設定に反映
    this.settings.sectionVisibility = JSON.stringify(this.sectionVisibility);

    this.markAsChanged();
    this.applyPreview();

    showToast(`${this.getSectionLabel(sectionId)}を${isVisible ? '表示' : '非表示'}にしました`, 'success');
  }

  /**
   * セクションラベルを取得
   */
  getSectionLabel(sectionId) {
    const labels = {
      'hero': 'ヒーロー',
      'company-intro': '会社紹介',
      'jobs': '求人一覧',
      'cta': 'CTA'
    };
    return labels[sectionId] || sectionId;
  }

  /**
   * セクション表示設定をUIに反映
   */
  updateSectionVisibilityUI() {
    // 設定からsectionVisibilityを読み込み
    if (this.settings.sectionVisibility) {
      try {
        this.sectionVisibility = JSON.parse(this.settings.sectionVisibility);
      } catch (e) {
        this.sectionVisibility = {};
      }
    }

    // トグルUIを更新
    document.querySelectorAll('.section-visibility-toggle .toggle-mini').forEach(toggle => {
      const section = toggle.dataset.section;
      const isVisible = this.sectionVisibility[section] !== false;
      toggle.classList.toggle('active', isVisible);
    });
  }

  /**
   * クリーンアップ（編集モード終了時）
   */
  cleanup() {
    this.stopAutosave();
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }

    const hoverPreview = document.getElementById('image-hover-preview');
    if (hoverPreview) {
      hoverPreview.remove();
    }
  }

  /**
   * 12. ヘルプツールチップを追加
   */
  addHelpTooltips() {
    const tooltips = {
      'edit-hero-title': '採用ページのメインタイトル。会社の魅力を一言で伝えましょう',
      'edit-hero-subtitle': 'タイトルの補足説明。求職者への呼びかけに効果的',
      'edit-hero-image': '背景画像。職場の雰囲気が伝わる写真がおすすめ',
      'edit-logo-url': 'ヘッダーに表示されるロゴ画像',
      'edit-phone-number': '画面下部のCTAバーに表示される電話番号',
      'edit-ogp-title': 'SNSでシェアされたときのタイトル',
      'edit-ogp-description': 'SNSでシェアされたときの説明文',
      'edit-custom-slug': 'カスタムURLを設定すると短いURLでアクセス可能'
    };

    Object.entries(tooltips).forEach(([id, text]) => {
      const input = document.getElementById(id);
      if (!input) return;

      const label = input.closest('.form-group')?.querySelector('label');
      if (!label || label.querySelector('.help-tooltip')) return;

      const tooltip = document.createElement('span');
      tooltip.className = 'help-tooltip';
      tooltip.textContent = '?';
      tooltip.setAttribute('data-tooltip', text);
      label.appendChild(tooltip);
    });
  }

  /**
   * 8. フォームバリデーション（URL、電話番号）
   */
  validateField(input) {
    const value = input.value?.trim();
    if (!value) {
      input.classList.remove('field-error');
      const hint = input.parentElement?.querySelector('.validation-hint');
      if (hint) hint.remove();
      return true;
    }

    let isValid = true;
    let errorMessage = '';

    // URL検証
    if (input.type === 'url' || input.id?.includes('url') || input.id?.includes('image')) {
      try {
        new URL(value);
      } catch {
        isValid = false;
        errorMessage = 'URLの形式が正しくありません';
      }
    }

    // 電話番号検証
    if (input.id === 'edit-phone-number' && value) {
      const phoneRegex = /^[0-9\-\s\(\)]+$/;
      if (!phoneRegex.test(value)) {
        isValid = false;
        errorMessage = '電話番号の形式が正しくありません';
      }
    }

    // エラー表示
    input.classList.toggle('field-error', !isValid);
    let hint = input.parentElement?.querySelector('.validation-hint');
    if (!isValid) {
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'validation-hint';
        input.parentElement?.appendChild(hint);
      }
      hint.textContent = errorMessage;
    } else if (hint) {
      hint.remove();
    }

    return isValid;
  }

  /**
   * フォームバリデーションを設定
   */
  setupFormValidation() {
    const urlInputs = document.querySelectorAll(
      '#recruit-editor-panel input[type="url"], ' +
      '#recruit-editor-panel input[id*="url"], ' +
      '#recruit-editor-panel input[id*="image"], ' +
      '#recruit-editor-panel #edit-phone-number'
    );

    urlInputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
    });
  }

  /**
   * 13. クイック追加セクション
   */
  addQuickAddButtons() {
    const container = document.getElementById('edit-custom-sections');
    if (!container) return;

    // 既存のクイック追加ボタンがあれば削除
    const existing = container.previousElementSibling;
    if (existing?.classList.contains('quick-add-buttons')) {
      existing.remove();
    }

    // よく使うセクションテンプレート
    const quickTemplates = [
      { id: 'message', label: '代表メッセージ', icon: '💬' },
      { id: 'about', label: '会社概要', icon: '🏢' },
      { id: 'photos', label: '写真ギャラリー', icon: '📷' }
    ];

    const buttonsHtml = `
      <div class="quick-add-buttons">
        ${quickTemplates.map(t => `
          <button type="button" class="btn-quick-add" data-template="${t.id}">
            ${t.icon} ${t.label}
          </button>
        `).join('')}
      </div>
    `;

    container.insertAdjacentHTML('beforebegin', buttonsHtml);

    // イベントリスナー
    document.querySelectorAll('.btn-quick-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const templateId = btn.dataset.template;
        this.addCustomSection(templateId);
      });
    });
  }
}

export default RecruitEditor;
