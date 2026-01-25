/**
 * リクエコ求人ナビ - 管理画面：会社管理モジュール
 * 会社一覧・LP設定・求人管理を担当
 */

const AdminCompany = {
  // 背景画像プリセット
  heroImagePresets: [
    { id: 'teamwork-1', name: 'チームミーティング', url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60' },
    { id: 'teamwork-2', name: 'オフィスワーク', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60' },
    { id: 'teamwork-3', name: 'コラボレーション', url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60' },
    { id: 'teamwork-4', name: 'ビジネス握手', url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=60' },
    { id: 'teamwork-5', name: 'ワークショップ', url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=60' },
    { id: 'work-1', name: '製造ライン', url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60' },
    { id: 'work-2', name: '倉庫作業', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=60' },
    { id: 'work-3', name: '建設現場', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60' },
    { id: 'work-4', name: '工場作業', url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=60' },
    { id: 'work-5', name: 'チームワーク', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60' }
  ],

  // 会社データキャッシュ
  companiesCache: [],
  currentEditingCompany: null,
  isNewCompany: false,

  // 求人管理用
  currentJobCompanyDomain: null,
  currentJobSheetUrl: null,
  jobsCache: [],
  currentEditingJob: null,
  isNewJob: false,

  // プレビュー更新タイマー
  previewUpdateTimer: null,

  // パターンラベル取得
  getPatternLabel(pattern) {
    const labels = {
      standard: 'スタンダード',
      modern: 'モダン',
      classic: 'クラシック',
      minimal: 'ミニマル',
      colorful: 'カラフル'
    };
    return labels[pattern] || 'スタンダード';
  },

  // ========================================
  // 会社管理機能
  // ========================================

  // 会社一覧データを読み込み
  async loadCompanyManageData() {
    const tbody = document.getElementById('company-manage-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${AdminDashboard.spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(AdminDashboard.spreadsheetConfig.companySheetName)}`;
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error('データの取得に失敗しました');

      const csvText = await response.text();
      let companies = this.parseCompanyCSV(csvText);

      // ローカルストレージの更新データをマージ
      companies = companies.map(company => {
        if (company.companyDomain) {
          const storedData = localStorage.getItem(`company_data_${company.companyDomain}`);
          if (storedData) {
            try {
              const updatedData = JSON.parse(storedData);
              return { ...company, ...updatedData };
            } catch (e) {
              console.error('ローカルストレージのパースエラー:', e);
            }
          }
        }
        return company;
      });

      if (companies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">会社データがありません</td></tr>';
        return;
      }

      this.companiesCache = companies;
      this.renderCompanyTable();

    } catch (error) {
      console.error('会社データの読み込みエラー:', error);
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データの読み込みに失敗しました</td></tr>';
    }
  },

  // 会社CSVをパース
  parseCompanyCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = this.parseCSVLine(lines[0] || '');
    const companies = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const company = {};

      headers.forEach((header, index) => {
        const key = this.normalizeHeader(header);
        company[key] = values[index] || '';
      });

      companies.push(company);
    }

    return companies;
  },

  // CSVの1行をパース
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  // ヘッダー名を正規化
  normalizeHeader(header) {
    const mapping = {
      '会社名': 'company',
      'company': 'company',
      '会社ドメイン': 'companyDomain',
      'companyDomain': 'companyDomain',
      'company_domain': 'companyDomain',
      'デザインパターン': 'designPattern',
      'designPattern': 'designPattern',
      'design_pattern': 'designPattern',
      '表示する': 'showCompany',
      'showCompany': 'showCompany',
      'visible': 'showCompany',
      '画像URL': 'imageUrl',
      'imageUrl': 'imageUrl',
      'image_url': 'imageUrl',
      '説明': 'description',
      'description': 'description',
      '並び順': 'order',
      'order': 'order',
      '管理シート': 'manageSheetUrl',
      '管理シートURL': 'manageSheetUrl',
      'manageSheetUrl': 'manageSheetUrl'
    };
    const cleanHeader = header.replace(/"/g, '').trim();
    return mapping[cleanHeader] || cleanHeader;
  },

  // 会社編集ページへ遷移
  editCompany(domain) {
    window.location.href = `company-edit.html?domain=${encodeURIComponent(domain)}`;
  },

  // 新規会社登録ページへ遷移
  showCompanyModal() {
    window.location.href = 'company-edit.html';
  },

  // 会社編集モーダルを閉じる（後方互換性のために残す）
  closeCompanyModal() {
    const modal = document.getElementById('company-modal');
    if (modal) modal.style.display = 'none';
    this.currentEditingCompany = null;
    this.isNewCompany = false;
  },

  // 会社データを保存
  async saveCompanyData() {
    const companyDomain = document.getElementById('edit-company-domain').value.trim().toLowerCase();

    const companyData = {
      company: document.getElementById('edit-company-name').value.trim(),
      company_domain: companyDomain,
      companyDomain: companyDomain,
      designPattern: document.getElementById('edit-design-pattern').value,
      imageUrl: document.getElementById('edit-image-url').value.trim(),
      order: document.getElementById('edit-order').value || '',
      description: document.getElementById('edit-description').value.trim(),
      showCompany: document.getElementById('edit-show-company').checked ? '○' : '',
      visible: document.getElementById('edit-show-company').checked ? '○' : ''
    };

    if (!companyData.company || !companyData.companyDomain) {
      alert('会社名と会社ドメインは必須です');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(companyData.companyDomain)) {
      alert('会社ドメインは半角英数字とハイフンのみ使用できます');
      return;
    }

    if (this.isNewCompany) {
      const existing = this.companiesCache?.find(c => c.companyDomain === companyData.companyDomain);
      if (existing) {
        alert('このドメインは既に使用されています');
        return;
      }
    }

    const gasApiUrl = AdminDashboard.spreadsheetConfig.gasApiUrl;
    if (gasApiUrl) {
      try {
        const saveBtn = document.getElementById('company-modal-save');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = '保存中...';
        }

        const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
          action: 'saveCompany',
          company: companyData
        }))));
        const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        const result = await response.json();

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
        }

        if (!result.success) {
          alert('スプレッドシートへの保存に失敗しました: ' + (result.error || '不明なエラー'));
          return;
        }

        localStorage.removeItem(`company_data_${companyData.companyDomain}`);

        if (this.isNewCompany) {
          if (!this.companiesCache) this.companiesCache = [];
          this.companiesCache.push(companyData);
        } else {
          const idx = this.companiesCache?.findIndex(c => c.companyDomain === companyData.companyDomain);
          if (idx !== -1) {
            this.companiesCache[idx] = companyData;
          }
        }

        this.closeCompanyModal();
        this.renderCompanyTable();

        alert(`会社情報をスプレッドシートに保存しました。\n\n会社名: ${companyData.company}\nドメイン: ${companyData.companyDomain}`);

      } catch (error) {
        console.error('GAS API呼び出しエラー:', error);
        alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
        this.saveCompanyDataLocal(companyData);
      }
    } else {
      this.saveCompanyDataLocal(companyData);
    }
  },

  // ローカルストレージに会社データを保存
  saveCompanyDataLocal(companyData) {
    const companyStorageKey = `company_data_${companyData.companyDomain}`;
    localStorage.setItem(companyStorageKey, JSON.stringify(companyData));

    if (this.isNewCompany) {
      if (!this.companiesCache) this.companiesCache = [];
      this.companiesCache.push(companyData);
    } else {
      const idx = this.companiesCache?.findIndex(c => c.companyDomain === companyData.companyDomain);
      if (idx !== -1) {
        this.companiesCache[idx] = companyData;
      }
    }

    this.closeCompanyModal();
    this.renderCompanyTable();

    alert(`会社情報をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n会社名: ${companyData.company}\nドメイン: ${companyData.companyDomain}`);
  },

  // 会社テーブルを再描画
  renderCompanyTable() {
    const tbody = document.getElementById('company-manage-tbody');
    if (!tbody) return;

    const companies = this.companiesCache || [];

    if (companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">会社データがありません</td></tr>';
      return;
    }

    tbody.innerHTML = companies.map(company => `
      <tr data-domain="${Utils.escapeHtml(company.companyDomain || '')}">
        <td>${Utils.escapeHtml(company.company || '')}</td>
        <td><code>${Utils.escapeHtml(company.companyDomain || '')}</code></td>
        <td><span class="badge ${company.designPattern || 'standard'}">${this.getPatternLabel(company.designPattern || 'standard')}</span></td>
        <td>${company.showCompany === '○' || company.showCompany === '◯' ? '<span class="badge success">表示</span>' : '<span class="badge">非表示</span>'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit" onclick="AdminCompany.editCompany('${Utils.escapeHtml(company.companyDomain || '')}')">編集</button>
            <button class="btn-small btn-primary" onclick="AdminCompany.openJobsArea('${Utils.escapeHtml(company.companyDomain || '')}')">求人管理</button>
            <a href="lp.html?c=${Utils.escapeHtml(company.companyDomain || '')}" target="_blank" class="btn-small btn-view">LP確認</a>
          </div>
        </td>
      </tr>
    `).join('');
  },

  // ========================================
  // LP設定機能
  // ========================================

  // LP設定用の会社リストを読み込み
  async loadCompanyListForLP() {
    const select = document.getElementById('lp-company-select');
    if (!select) return;

    if (!this.companiesCache || this.companiesCache.length === 0) {
      await this.loadCompanyManageData();
    }

    const companies = this.companiesCache || [];
    const visibleCompanies = companies.filter(c =>
      c.companyDomain && (c.showCompany === '○' || c.showCompany === '◯')
    );

    select.innerHTML = '<option value="">-- 会社を選択 --</option>' +
      visibleCompanies.map(c =>
        `<option value="${Utils.escapeHtml(c.companyDomain)}">${Utils.escapeHtml(c.company)}</option>`
      ).join('');
  },

  // LP設定を読み込み
  async loadLPSettings(companyDomain) {
    const editor = document.getElementById('lp-editor');
    const previewBtn = document.getElementById('lp-preview-btn');
    const editModeBtn = document.getElementById('lp-edit-mode-btn');

    if (!companyDomain) {
      if (editor) editor.style.display = 'none';
      return;
    }

    if (editor) editor.style.display = 'block';
    if (previewBtn) previewBtn.href = `lp.html?c=${encodeURIComponent(companyDomain)}`;
    if (editModeBtn) editModeBtn.href = `lp.html?c=${encodeURIComponent(companyDomain)}&edit`;

    this.renderHeroImagePresets();

    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain);
    if (company) {
      const patternRadio = document.querySelector(`input[name="design-pattern"][value="${company.designPattern || 'standard'}"]`);
      if (patternRadio) patternRadio.checked = true;
    }

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${AdminDashboard.spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(AdminDashboard.spreadsheetConfig.lpSettingsSheetName)}`;
      const response = await fetch(csvUrl);

      if (response.ok) {
        const csvText = await response.text();
        const settings = this.parseLPSettingsCSV(csvText, companyDomain);

        if (settings) {
          document.getElementById('lp-hero-title').value = settings.heroTitle || '';
          document.getElementById('lp-hero-subtitle').value = settings.heroSubtitle || '';
          document.getElementById('lp-hero-image').value = settings.heroImage || '';
          document.getElementById('lp-point-title-1').value = settings.pointTitle1 || '';
          document.getElementById('lp-point-desc-1').value = settings.pointDesc1 || '';
          document.getElementById('lp-point-title-2').value = settings.pointTitle2 || '';
          document.getElementById('lp-point-desc-2').value = settings.pointDesc2 || '';
          document.getElementById('lp-point-title-3').value = settings.pointTitle3 || '';
          document.getElementById('lp-point-desc-3').value = settings.pointDesc3 || '';
          document.getElementById('lp-cta-text').value = settings.ctaText || '今すぐ応募する';
          document.getElementById('lp-faq').value = settings.faq || '';

          if (settings.designPattern) {
            const patternRadio = document.querySelector(`input[name="design-pattern"][value="${settings.designPattern}"]`);
            if (patternRadio) patternRadio.checked = true;
          }

          this.updateHeroImagePresetSelection(settings.heroImage || '');
          return;
        }
      }
    } catch (e) {
      console.log('LP設定シートが見つかりません');
    }

    this.clearLPForm();
  },

  // LP設定CSVをパース
  parseLPSettingsCSV(csvText, companyDomain) {
    const lines = csvText.split('\n');
    const headers = this.parseCSVLine(lines[0] || '');

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const rowData = {};

      headers.forEach((header, idx) => {
        const key = header.replace(/"/g, '').trim();
        rowData[key] = values[idx] || '';
      });

      if (rowData.companyDomain === companyDomain || rowData['会社ドメイン'] === companyDomain) {
        return {
          heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
          heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
          heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
          pointTitle1: rowData.pointTitle1 || rowData['ポイント1タイトル'] || '',
          pointDesc1: rowData.pointDesc1 || rowData['ポイント1説明'] || '',
          pointTitle2: rowData.pointTitle2 || rowData['ポイント2タイトル'] || '',
          pointDesc2: rowData.pointDesc2 || rowData['ポイント2説明'] || '',
          pointTitle3: rowData.pointTitle3 || rowData['ポイント3タイトル'] || '',
          pointDesc3: rowData.pointDesc3 || rowData['ポイント3説明'] || '',
          ctaText: rowData.ctaText || rowData['CTAテキスト'] || '',
          faq: rowData.faq || rowData['FAQ'] || '',
          designPattern: rowData.designPattern || rowData['デザインパターン'] || ''
        };
      }
    }
    return null;
  },

  // LP設定フォームをクリア
  clearLPForm() {
    const fields = [
      'lp-hero-title', 'lp-hero-subtitle', 'lp-hero-image',
      'lp-point-title-1', 'lp-point-desc-1',
      'lp-point-title-2', 'lp-point-desc-2',
      'lp-point-title-3', 'lp-point-desc-3',
      'lp-faq'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const ctaText = document.getElementById('lp-cta-text');
    if (ctaText) ctaText.value = '今すぐ応募する';

    const standardRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
    if (standardRadio) standardRadio.checked = true;

    this.updateHeroImagePresetSelection('');
  },

  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresets() {
    const container = document.getElementById('hero-image-presets');
    if (!container) return;

    container.innerHTML = this.heroImagePresets.map(preset => `
      <div class="hero-image-preset" data-url="${Utils.escapeHtml(preset.url)}" title="${Utils.escapeHtml(preset.name)}">
        <img src="${Utils.escapeHtml(preset.thumbnail)}" alt="${Utils.escapeHtml(preset.name)}" loading="lazy">
        <span class="preset-name">${Utils.escapeHtml(preset.name)}</span>
        <span class="preset-check">✓</span>
      </div>
    `).join('');

    container.querySelectorAll('.hero-image-preset').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        this.selectHeroImagePreset(url);
      });
    });
  },

  // ヒーロー画像プリセットを選択
  selectHeroImagePreset(url) {
    const input = document.getElementById('lp-hero-image');
    if (input) {
      input.value = url;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    this.updateHeroImagePresetSelection(url);
  },

  // ヒーロー画像プリセットの選択状態を更新
  updateHeroImagePresetSelection(selectedUrl) {
    const container = document.getElementById('hero-image-presets');
    if (!container) return;

    container.querySelectorAll('.hero-image-preset').forEach(item => {
      const itemUrl = item.dataset.url;
      const baseSelectedUrl = selectedUrl?.split('?')[0] || '';
      const baseItemUrl = itemUrl?.split('?')[0] || '';
      if (baseSelectedUrl && baseItemUrl && baseSelectedUrl === baseItemUrl) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  },

  // LP設定を保存
  async saveLPSettings() {
    const companyDomain = document.getElementById('lp-company-select').value;
    if (!companyDomain) {
      alert('会社を選択してください');
      return;
    }

    const settings = {
      companyDomain: companyDomain,
      designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'standard',
      heroTitle: document.getElementById('lp-hero-title').value,
      heroSubtitle: document.getElementById('lp-hero-subtitle').value,
      heroImage: document.getElementById('lp-hero-image').value,
      pointTitle1: document.getElementById('lp-point-title-1').value,
      pointDesc1: document.getElementById('lp-point-desc-1').value,
      pointTitle2: document.getElementById('lp-point-title-2').value,
      pointDesc2: document.getElementById('lp-point-desc-2').value,
      pointTitle3: document.getElementById('lp-point-title-3').value,
      pointDesc3: document.getElementById('lp-point-desc-3').value,
      ctaText: document.getElementById('lp-cta-text').value,
      faq: document.getElementById('lp-faq').value
    };

    const gasApiUrl = AdminDashboard.spreadsheetConfig.gasApiUrl;
    if (gasApiUrl) {
      try {
        const saveBtn = document.getElementById('btn-save-lp-settings');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = '保存中...';
        }

        const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
          action: 'saveLPSettings',
          settings: settings
        }))));
        const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        const responseText = await response.text();

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[LP Save] JSON parse error:', parseError);
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'LP設定を保存';
          }
          throw new Error(`GASからの応答が不正です: ${responseText.substring(0, 200)}`);
        }

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'LP設定を保存';
        }

        if (!result.success) {
          alert('スプレッドシートへの保存に失敗しました: ' + (result.error || '不明なエラー'));
          return;
        }

        localStorage.removeItem(`lp_settings_${companyDomain}`);
        alert(`LP設定をスプレッドシートに保存しました。\n\n会社: ${companyDomain}\nデザインパターン: ${settings.designPattern}`);

      } catch (error) {
        console.error('GAS API呼び出しエラー:', error);
        alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
        this.saveLPSettingsLocal(settings, companyDomain);
      }
    } else {
      this.saveLPSettingsLocal(settings, companyDomain);
    }
  },

  // ローカルストレージにLP設定を保存
  saveLPSettingsLocal(settings, companyDomain) {
    const lpSettingsKey = `lp_settings_${companyDomain}`;
    localStorage.setItem(lpSettingsKey, JSON.stringify(settings));
    alert(`LP設定をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n会社: ${companyDomain}\nデザインパターン: ${settings.designPattern}`);
  },

  // ========================================
  // LPプレビュー機能
  // ========================================

  // デバウンス付きプレビュー更新
  debouncedUpdatePreview() {
    if (this.previewUpdateTimer) {
      clearTimeout(this.previewUpdateTimer);
    }
    this.previewUpdateTimer = setTimeout(() => {
      this.updateLPPreview();
    }, 300);
  },

  // プレビュー表示/非表示切り替え
  toggleLPPreview() {
    const container = document.getElementById('lp-preview-container');
    const btn = document.getElementById('btn-toggle-preview');

    if (!container) return;

    if (container.style.display === 'none') {
      container.style.display = 'flex';
      if (btn) btn.textContent = 'プレビューを隠す';
      this.updateLPPreview();
    } else {
      container.style.display = 'none';
      if (btn) btn.textContent = 'プレビュー表示';
    }
  },

  // プレビューを閉じる
  closeLPPreview() {
    const container = document.getElementById('lp-preview-container');
    const btn = document.getElementById('btn-toggle-preview');

    if (container) container.style.display = 'none';
    if (btn) btn.textContent = 'プレビュー表示';
  },

  // デバイス切り替え
  switchPreviewDevice(device) {
    const wrapper = document.querySelector('.lp-preview-frame-wrapper');
    const buttons = document.querySelectorAll('.preview-device-btn');

    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.device === device);
    });

    if (wrapper) {
      wrapper.setAttribute('data-device', device);
    }
  },

  // LPプレビューを更新
  updateLPPreview() {
    const container = document.getElementById('lp-preview-container');
    const iframe = document.getElementById('lp-preview-frame');
    const companyDomain = document.getElementById('lp-company-select')?.value;

    if (!container || container.style.display === 'none' || !iframe || !companyDomain) {
      return;
    }

    const settings = this.getCurrentLPSettings();
    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain) || {
      company: companyDomain,
      companyDomain: companyDomain
    };

    const previewHtml = this.generatePreviewHTML(company, settings);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(previewHtml);
    iframeDoc.close();
  },

  // 現在のLP設定フォーム値を取得
  getCurrentLPSettings() {
    return {
      designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'standard',
      heroTitle: document.getElementById('lp-hero-title')?.value || '',
      heroSubtitle: document.getElementById('lp-hero-subtitle')?.value || '',
      heroImage: document.getElementById('lp-hero-image')?.value || '',
      pointTitle1: document.getElementById('lp-point-title-1')?.value || '',
      pointDesc1: document.getElementById('lp-point-desc-1')?.value || '',
      pointTitle2: document.getElementById('lp-point-title-2')?.value || '',
      pointDesc2: document.getElementById('lp-point-desc-2')?.value || '',
      pointTitle3: document.getElementById('lp-point-title-3')?.value || '',
      pointDesc3: document.getElementById('lp-point-desc-3')?.value || '',
      ctaText: document.getElementById('lp-cta-text')?.value || '今すぐ応募する',
      faq: document.getElementById('lp-faq')?.value || ''
    };
  },

  // プレビュー用HTMLを生成
  generatePreviewHTML(company, settings) {
    const pattern = settings.designPattern || 'standard';
    const heroTitle = settings.heroTitle || `${company.company}で働こう`;
    const heroSubtitle = settings.heroSubtitle || '';
    const heroImage = settings.heroImage || '';
    const ctaText = settings.ctaText || '今すぐ応募する';
    const isEditMode = document.getElementById('preview-edit-mode')?.checked || false;

    const points = [];
    if (settings.pointTitle1) points.push({ title: settings.pointTitle1, desc: settings.pointDesc1 || '' });
    if (settings.pointTitle2) points.push({ title: settings.pointTitle2, desc: settings.pointDesc2 || '' });
    if (settings.pointTitle3) points.push({ title: settings.pointTitle3, desc: settings.pointDesc3 || '' });

    const faqs = settings.faq ? settings.faq.split('||').map(item => {
      const parts = item.split('|');
      const q = parts.find(p => p.startsWith('Q:'))?.replace('Q:', '').trim() || '';
      const a = parts.find(p => p.startsWith('A:'))?.replace('A:', '').trim() || '';
      return { q, a };
    }).filter(f => f.q && f.a) : [];

    const sectionOrder = this.getSectionOrder();
    const sectionVisibility = this.getSectionVisibility();

    const sections = {
      hero: `
        <section class="lp-hero preview-section" data-section="hero">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">ヒーロー</span></div>' : ''}
          ${heroImage ? `<div class="lp-hero-bg" style="background-image: url('${Utils.escapeHtml(heroImage)}')"></div>` : '<div class="lp-hero-bg"></div>'}
          <div class="lp-hero-overlay"></div>
          <div class="lp-hero-content">
            <p class="lp-hero-company">${Utils.escapeHtml(company.company)}</p>
            <h1 class="lp-hero-title">${Utils.escapeHtml(heroTitle)}</h1>
            ${heroSubtitle ? `<p class="lp-hero-subtitle">${Utils.escapeHtml(heroSubtitle)}</p>` : ''}
            <div class="lp-hero-cta">
              <a href="#" class="lp-btn-apply-hero">${Utils.escapeHtml(ctaText)}</a>
            </div>
          </div>
        </section>`,

      points: points.length > 0 && sectionVisibility.points ? `
        <section class="lp-points preview-section" data-section="points">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">ポイント</span></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">この求人のポイント</h2>
            <div class="lp-points-grid">
              ${points.map((point, idx) => `
                <div class="lp-point-card">
                  <div class="lp-point-number">${idx + 1}</div>
                  <h3 class="lp-point-title">${Utils.escapeHtml(point.title)}</h3>
                  <p class="lp-point-desc">${Utils.escapeHtml(point.desc)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </section>` : '',

      jobs: sectionVisibility.jobs ? `
        <section class="lp-jobs preview-section" data-section="jobs">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">求人一覧</span></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">募集中の求人</h2>
            <div class="lp-jobs-list">
              <div class="lp-job-card" style="opacity: 0.5;">
                <p>求人データはスプレッドシートから読み込まれます</p>
              </div>
            </div>
          </div>
        </section>` : '',

      details: sectionVisibility.details ? `
        <section class="lp-details preview-section" data-section="details">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">募集要項</span></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">募集要項</h2>
            <div class="lp-details-table">
              <div class="lp-detail-row"><div class="lp-detail-label">仕事内容</div><div class="lp-detail-value" style="opacity: 0.5;">スプレッドシートから読み込み</div></div>
            </div>
          </div>
        </section>` : '',

      faq: faqs.length > 0 && sectionVisibility.faq ? `
        <section class="lp-faq preview-section" data-section="faq">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">FAQ</span></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">よくある質問</h2>
            <div class="lp-faq-list">
              ${faqs.map(faq => `
                <div class="lp-faq-item">
                  <div class="lp-faq-question"><span class="lp-faq-icon">Q</span><span>${Utils.escapeHtml(faq.q)}</span></div>
                  <div class="lp-faq-answer"><span class="lp-faq-icon">A</span><span>${Utils.escapeHtml(faq.a)}</span></div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>` : '',

      apply: `
        <section class="lp-apply preview-section" id="lp-apply" data-section="apply">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">応募</span></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-apply-title">まずはお気軽にご応募ください</h2>
            <p class="lp-apply-text">経験・学歴不問！${Utils.escapeHtml(company.company)}であなたのご応募をお待ちしています。</p>
            <div class="lp-apply-buttons">
              <a href="#" class="lp-btn-apply-main">${Utils.escapeHtml(ctaText)}</a>
            </div>
          </div>
        </section>`
    };

    const orderedSections = sectionOrder.map(s => sections[s] || '').join('');

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>プレビュー</title>
  <link rel="stylesheet" href="css/style.min.css">
  <link rel="stylesheet" href="css/lp.css">
  <style>
    body { margin: 0; padding: 0; }
    .lp-hero { min-height: 50vh; }
    .preview-note { background: #fef3c7; color: #92400e; padding: 8px 16px; text-align: center; font-size: 12px; position: sticky; top: 0; z-index: 1000; }
  </style>
</head>
<body class="lp-body lp-pattern-${Utils.escapeHtml(pattern)}${isEditMode ? ' edit-mode' : ''}">
  <div class="preview-note">${isEditMode ? '編集モード' : 'プレビューモード'}</div>
  ${orderedSections}
</body>
</html>`;
  },

  // セクションの順番を取得
  getSectionOrder() {
    const orderList = document.getElementById('lp-section-order');
    if (!orderList) {
      return ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
    }
    return Array.from(orderList.querySelectorAll('li')).map(li => li.dataset.section);
  },

  // セクションの表示状態を取得
  getSectionVisibility() {
    return {
      points: document.getElementById('section-points-visible')?.checked ?? true,
      jobs: document.getElementById('section-jobs-visible')?.checked ?? true,
      details: document.getElementById('section-details-visible')?.checked ?? true,
      faq: document.getElementById('section-faq-visible')?.checked ?? true
    };
  },

  // セクション並び替え初期化
  initSectionSortable() {
    const list = document.getElementById('lp-section-order');
    if (!list) return;

    let draggedItem = null;

    list.querySelectorAll('.section-order-item').forEach(item => {
      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        this.updateLPPreview();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const afterElement = this.getDragAfterElement(list, e.clientY);
        if (afterElement == null) {
          list.appendChild(draggedItem);
        } else {
          list.insertBefore(draggedItem, afterElement);
        }
      });
    });
  },

  // ドラッグ位置から挿入先を取得
  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.section-order-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  // 編集モード切り替え
  togglePreviewEditMode(enabled) {
    this.updateLPPreview();
  },

  // セクションにフォーカス
  focusSection(sectionType) {
    const elementMap = {
      'points': 'lp-point-title-1',
      'faq': 'lp-faq',
      'cta': 'lp-cta-text',
      'hero': 'lp-hero-title'
    };
    const elementId = elementMap[sectionType];
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }
  },

  // ========================================
  // 求人管理機能
  // ========================================

  // 求人管理画面を開く
  openJobsArea(companyDomain) {
    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain);
    if (!company) {
      alert('会社情報が見つかりません');
      return;
    }

    const params = new URLSearchParams();
    params.set('domain', companyDomain);
    params.set('company', company.company || companyDomain);
    if (company.manageSheetUrl) {
      params.set('sheetUrl', company.manageSheetUrl);
    }

    window.location.href = `job-manage.html?${params.toString()}`;
  },

  // 求人管理エリアを閉じる
  closeJobsArea() {
    const area = document.getElementById('jobs-manage-area');
    if (area) {
      area.style.display = 'none';
    }
    this.currentJobCompanyDomain = null;
    this.currentJobSheetUrl = null;
    this.jobsCache = [];
  },

  // 求人データを読み込み
  async loadJobsData(companyDomain) {
    const tbody = document.getElementById('jobs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';

    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain);
    if (!company || !company.manageSheetUrl) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">管理シートが設定されていません</td></tr>';
      return;
    }

    try {
      const gasApiUrl = AdminDashboard.spreadsheetConfig.gasApiUrl;
      if (!gasApiUrl) {
        throw new Error('GAS API URLが設定されていません');
      }

      const url = `${gasApiUrl}?action=getJobs&domain=${encodeURIComponent(companyDomain)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '求人データの取得に失敗しました');
      }

      this.jobsCache = result.jobs || [];

      if (this.jobsCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">求人データがありません</td></tr>';
        return;
      }

      this.renderJobsTable();

    } catch (error) {
      console.error('求人データの読み込みエラー:', error);
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">データの読み込みに失敗しました: ${Utils.escapeHtml(error.message)}</td></tr>`;
    }
  },

  // 求人テーブルを描画
  renderJobsTable() {
    const tbody = document.getElementById('jobs-tbody');
    if (!tbody) return;

    const jobs = this.jobsCache || [];

    if (jobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">求人データがありません</td></tr>';
      return;
    }

    tbody.innerHTML = jobs.map(job => {
      const salary = job.monthlySalary ? `¥${Number(job.monthlySalary).toLocaleString()}` : '-';
      const isVisible = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;

      return `
        <tr data-row="${job._rowIndex}">
          <td>${Utils.escapeHtml(job.id || '-')}</td>
          <td>${Utils.escapeHtml(job.title || '-')}</td>
          <td>${Utils.escapeHtml(job.location || '-')}</td>
          <td>${salary}</td>
          <td>${isVisible ? '<span class="badge success">公開</span>' : '<span class="badge">非公開</span>'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-small btn-edit" onclick="AdminCompany.editJob(${job._rowIndex})">編集</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 求人編集モーダルを表示（新規）
  showJobModal() {
    this.currentEditingJob = null;
    this.isNewJob = true;

    document.getElementById('job-modal-title').textContent = '新規求人作成';
    const fields = ['edit-job-title', 'edit-job-location', 'edit-job-salary', 'edit-job-bonus', 'edit-job-order', 'edit-job-features', 'edit-job-badges', 'edit-job-description', 'edit-job-requirements', 'edit-job-benefits', 'edit-job-hours', 'edit-job-holidays', 'edit-job-start-date', 'edit-job-end-date'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('edit-job-visible').checked = true;
    document.getElementById('job-modal-delete').style.display = 'none';
    document.getElementById('job-modal').style.display = 'flex';
  },

  // 求人編集モーダルを表示（編集）
  editJob(rowIndex) {
    const job = this.jobsCache?.find(j => j._rowIndex === rowIndex);
    if (!job) {
      alert('求人データが見つかりません');
      return;
    }

    this.currentEditingJob = job;
    this.isNewJob = false;

    document.getElementById('job-modal-title').textContent = '求人情報の編集';
    document.getElementById('edit-job-title').value = job.title || '';
    document.getElementById('edit-job-location').value = job.location || '';
    document.getElementById('edit-job-salary').value = job.monthlySalary || '';
    document.getElementById('edit-job-bonus').value = job.totalBonus || '';
    document.getElementById('edit-job-order').value = job.order || '';
    document.getElementById('edit-job-features').value = job.features || '';
    document.getElementById('edit-job-badges').value = job.badges || '';
    document.getElementById('edit-job-description').value = job.jobDescription || '';
    document.getElementById('edit-job-requirements').value = job.requirements || '';
    document.getElementById('edit-job-benefits').value = job.benefits || '';
    document.getElementById('edit-job-hours').value = job.workingHours || '';
    document.getElementById('edit-job-holidays').value = job.holidays || '';

    if (job.publishStartDate) {
      document.getElementById('edit-job-start-date').value = this.formatDateForInput(job.publishStartDate);
    } else {
      document.getElementById('edit-job-start-date').value = '';
    }
    if (job.publishEndDate) {
      document.getElementById('edit-job-end-date').value = this.formatDateForInput(job.publishEndDate);
    } else {
      document.getElementById('edit-job-end-date').value = '';
    }

    document.getElementById('edit-job-visible').checked = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;
    document.getElementById('job-modal-delete').style.display = '';
    document.getElementById('job-modal').style.display = 'flex';
  },

  // 日付をinput[type="date"]用にフォーマット
  formatDateForInput(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 求人編集モーダルを閉じる
  closeJobModal() {
    document.getElementById('job-modal').style.display = 'none';
    this.currentEditingJob = null;
    this.isNewJob = false;
  },

  // 求人データを保存
  async saveJobData() {
    if (!this.currentJobCompanyDomain) {
      alert('会社が選択されていません');
      return;
    }

    const jobData = {
      title: document.getElementById('edit-job-title').value.trim(),
      location: document.getElementById('edit-job-location').value.trim(),
      monthlySalary: document.getElementById('edit-job-salary').value || '',
      totalBonus: document.getElementById('edit-job-bonus').value || '',
      order: document.getElementById('edit-job-order').value || '',
      features: document.getElementById('edit-job-features').value.trim(),
      badges: document.getElementById('edit-job-badges').value.trim(),
      jobDescription: document.getElementById('edit-job-description').value.trim(),
      requirements: document.getElementById('edit-job-requirements').value.trim(),
      benefits: document.getElementById('edit-job-benefits').value.trim(),
      workingHours: document.getElementById('edit-job-hours').value.trim(),
      holidays: document.getElementById('edit-job-holidays').value.trim(),
      publishStartDate: document.getElementById('edit-job-start-date').value || '',
      publishEndDate: document.getElementById('edit-job-end-date').value || '',
      visible: document.getElementById('edit-job-visible').checked ? 'true' : 'false'
    };

    if (!jobData.title || !jobData.location) {
      alert('募集タイトルと勤務地は必須です');
      return;
    }

    const gasApiUrl = AdminDashboard.spreadsheetConfig.gasApiUrl;
    if (!gasApiUrl) {
      alert('GAS API URLが設定されていません。設定画面でURLを設定してください。');
      return;
    }

    try {
      const saveBtn = document.getElementById('job-modal-save');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveJob',
        companyDomain: this.currentJobCompanyDomain,
        job: jobData,
        rowIndex: this.isNewJob ? null : this.currentEditingJob._rowIndex
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
        }
        throw new Error(`GASからの応答が不正です`);
      }

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }

      if (!result.success) {
        alert('保存に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      this.closeJobModal();
      await this.loadJobsData(this.currentJobCompanyDomain);
      alert(this.isNewJob ? '求人を作成しました' : '求人情報を更新しました');

    } catch (error) {
      console.error('求人保存エラー:', error);
      alert('保存中にエラーが発生しました: ' + error.message);
    }
  },

  // 求人を削除
  async deleteJob() {
    if (!this.currentEditingJob || !this.currentJobCompanyDomain) {
      alert('削除対象が選択されていません');
      return;
    }

    if (!confirm('この求人を削除してもよろしいですか？')) {
      return;
    }

    const gasApiUrl = AdminDashboard.spreadsheetConfig.gasApiUrl;
    if (!gasApiUrl) {
      alert('GAS API URLが設定されていません');
      return;
    }

    try {
      const deleteBtn = document.getElementById('job-modal-delete');
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '削除中...';
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'deleteJob',
        companyDomain: this.currentJobCompanyDomain,
        rowIndex: this.currentEditingJob._rowIndex
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.textContent = '削除';
        }
        throw new Error(`GASからの応答が不正です`);
      }

      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = '削除';
      }

      if (!result.success) {
        alert('削除に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      this.closeJobModal();
      await this.loadJobsData(this.currentJobCompanyDomain);
      alert('求人を削除しました');

    } catch (error) {
      console.error('求人削除エラー:', error);
      alert('削除中にエラーが発生しました: ' + error.message);
    }
  },

  // イベントバインド
  bindEvents() {
    // 会社管理: 新規登録ボタン
    const btnAddCompany = document.getElementById('btn-add-company');
    if (btnAddCompany) {
      btnAddCompany.addEventListener('click', () => {
        window.location.href = 'company-edit.html';
      });
    }

    // LP設定: 会社選択
    const lpCompanySelect = document.getElementById('lp-company-select');
    if (lpCompanySelect) {
      lpCompanySelect.addEventListener('change', (e) => {
        this.loadLPSettings(e.target.value);
      });
    }

    // LP設定: 保存ボタン
    const btnSaveLPSettings = document.getElementById('btn-save-lp-settings');
    if (btnSaveLPSettings) {
      btnSaveLPSettings.addEventListener('click', () => this.saveLPSettings());
    }

    // LP設定: リセットボタン
    const btnResetLPSettings = document.getElementById('btn-reset-lp-settings');
    if (btnResetLPSettings) {
      btnResetLPSettings.addEventListener('click', () => {
        const companyDomain = document.getElementById('lp-company-select').value;
        if (companyDomain) {
          this.loadLPSettings(companyDomain);
        }
      });
    }

    // LP設定: プレビューボタン
    const btnTogglePreview = document.getElementById('btn-toggle-preview');
    if (btnTogglePreview) {
      btnTogglePreview.addEventListener('click', () => this.toggleLPPreview());
    }

    // LP設定: プレビューを閉じる
    const btnClosePreview = document.getElementById('btn-close-preview');
    if (btnClosePreview) {
      btnClosePreview.addEventListener('click', () => this.closeLPPreview());
    }

    // LP設定: デバイス切り替え
    document.querySelectorAll('.preview-device-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const device = e.target.dataset.device;
        this.switchPreviewDevice(device);
      });
    });

    // LP設定: フォーム入力時にプレビュー更新
    const lpFormInputs = document.querySelectorAll('#lp-editor input, #lp-editor textarea');
    lpFormInputs.forEach(input => {
      input.addEventListener('input', () => this.debouncedUpdatePreview());
    });

    // LP設定: デザインパターン変更時にプレビュー更新
    document.querySelectorAll('input[name="design-pattern"]').forEach(radio => {
      radio.addEventListener('change', () => this.updateLPPreview());
    });

    // LP設定: セクション並び替え
    this.initSectionSortable();

    // LP設定: セクション表示/非表示切り替え
    document.querySelectorAll('#lp-section-order input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateLPPreview());
    });

    // LP設定: 編集モード切り替え
    const editModeToggle = document.getElementById('preview-edit-mode');
    if (editModeToggle) {
      editModeToggle.addEventListener('change', (e) => this.togglePreviewEditMode(e.target.checked));
    }

    // 会社編集モーダル
    const companyModalClose = document.getElementById('company-modal-close');
    if (companyModalClose) {
      companyModalClose.addEventListener('click', () => this.closeCompanyModal());
    }

    const companyModalCancel = document.getElementById('company-modal-cancel');
    if (companyModalCancel) {
      companyModalCancel.addEventListener('click', () => this.closeCompanyModal());
    }

    const companyEditForm = document.getElementById('company-edit-form');
    if (companyEditForm) {
      companyEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCompanyData();
      });
    }

    const companyModal = document.getElementById('company-modal');
    if (companyModal) {
      companyModal.addEventListener('click', (e) => {
        if (e.target === companyModal) {
          this.closeCompanyModal();
        }
      });
    }

    // 求人管理
    const btnAddJob = document.getElementById('btn-add-job');
    if (btnAddJob) {
      btnAddJob.addEventListener('click', () => this.showJobModal());
    }

    const btnCloseJobs = document.getElementById('btn-close-jobs');
    if (btnCloseJobs) {
      btnCloseJobs.addEventListener('click', () => this.closeJobsArea());
    }

    const jobModalClose = document.getElementById('job-modal-close');
    if (jobModalClose) {
      jobModalClose.addEventListener('click', () => this.closeJobModal());
    }

    const jobModalCancel = document.getElementById('job-modal-cancel');
    if (jobModalCancel) {
      jobModalCancel.addEventListener('click', () => this.closeJobModal());
    }

    const jobModalDelete = document.getElementById('job-modal-delete');
    if (jobModalDelete) {
      jobModalDelete.addEventListener('click', () => this.deleteJob());
    }

    const jobEditForm = document.getElementById('job-edit-form');
    if (jobEditForm) {
      jobEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveJobData();
      });
    }

    const jobModal = document.getElementById('job-modal');
    if (jobModal) {
      jobModal.addEventListener('click', (e) => {
        if (e.target === jobModal) {
          this.closeJobModal();
        }
      });
    }
  }
};

// グローバルにエクスポート
window.AdminCompany = AdminCompany;
