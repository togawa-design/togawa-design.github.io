/**
 * 採用ページ編集機能
 * LP同様のビジュアルエディタ
 */
import { escapeHtml, showToast } from '@shared/utils.js';
import { showConfirmDialog } from '@shared/modal.js';
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
    this.previewDebounceTimer = null; // プレビュー更新のデバウンス用
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
          <div class="preview-mode-toggle" id="preview-mode-toggle">
            <button type="button" class="btn-preview-mode active" data-mode="pc" title="PC表示">
              🖥️
            </button>
            <button type="button" class="btn-preview-mode" data-mode="mobile" title="モバイル表示">
              📱
            </button>
          </div>
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
        </div>

        <!-- デザインタブ -->
        <div class="recruit-editor-tab-content" data-tab-content="design">
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

          <div class="editor-section">
            <h3 class="editor-section-title">カスタムセクション</h3>
            <p class="section-description">ページに独自のセクションを追加できます</p>
            <div class="custom-sections-list" id="edit-custom-sections">
              <!-- 動的に追加 -->
            </div>
            <div class="add-section-buttons">
              <button type="button" class="btn-add-section" data-type="text">+ テキスト</button>
              <button type="button" class="btn-add-section" data-type="heading">+ 見出し</button>
              <button type="button" class="btn-add-section" data-type="image">+ 画像</button>
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

    // 埋込タブ: URLを設定
    this.updateEmbedUrl();
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
          this.hasChanges = true;
          this.updateSettingsFromForm();
          this.debouncedPreview();
        });
      }
    });

    // 公開設定チェックボックス
    document.getElementById('edit-is-published')?.addEventListener('change', () => {
      this.hasChanges = true;
      this.updateSettingsFromForm();
      this.applyPreview();
    });

    // 募集の設定 (select)
    ['edit-jobs-limit', 'edit-jobs-sort'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.applyPreview();
      });
    });

    // カスタムリンク追加ボタン
    document.getElementById('btn-add-custom-link')?.addEventListener('click', () => {
      this.addCustomLink();
    });

    // カスタムセクション追加ボタン
    document.querySelectorAll('.btn-add-section').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        this.addCustomSection(type);
      });
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
      // デザイン
      layoutStyle: this.getRadioValue('layoutStyle') || 'default',
      designPattern: this.getRadioValue('designPattern') || 'standard',
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

    container.innerHTML = sections.map((section, index) => {
      const typeLabels = { text: 'テキスト', heading: '見出し', image: '画像' };
      const typeLabel = typeLabels[section.type] || section.type;

      let contentInput = '';
      if (section.type === 'text') {
        contentInput = `<textarea class="section-content" rows="3" placeholder="テキストを入力">${escapeHtml(section.content || '')}</textarea>`;
      } else if (section.type === 'heading') {
        contentInput = `<input type="text" class="section-content" placeholder="見出しテキスト" value="${escapeHtml(section.content || '')}">`;
      } else if (section.type === 'image') {
        contentInput = `<input type="url" class="section-content" placeholder="画像URL（https://...）" value="${escapeHtml(section.content || '')}">`;
      }

      return `
        <div class="custom-section-item" data-index="${index}" data-type="${section.type}">
          <div class="section-item-header">
            <span class="section-type-badge">${escapeHtml(typeLabel)}</span>
            <div class="section-item-actions">
              <button type="button" class="btn-move-section" data-direction="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="btn-move-section" data-direction="down" data-index="${index}" ${index === sections.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="btn-remove-section" data-index="${index}">✕</button>
            </div>
          </div>
          <div class="section-item-content">
            ${contentInput}
          </div>
        </div>
      `;
    }).join('');

    // 削除ボタンのイベントリスナー
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

    // 移動ボタンのイベントリスナー
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

    // 入力変更時のイベントリスナー
    container.querySelectorAll('.section-content').forEach(input => {
      input.addEventListener('input', () => {
        this.hasChanges = true;
        this.updateSettingsFromForm();
        this.debouncedPreview();
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
      const content = item.querySelector('.section-content')?.value || '';
      sections.push({ type, content });
    });
    return sections;
  }

  /**
   * カスタムセクションを追加
   */
  addCustomSection(type) {
    const currentSections = this.getCustomSections();
    currentSections.push({ type, content: '' });
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
}

export default RecruitEditor;
