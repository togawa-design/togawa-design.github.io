/**
 * 求人管理画面 - JavaScript
 *
 * URLパラメータ:
 * - domain: 会社ドメイン（必須）
 * - company: 会社名（オプション）
 * - sheetUrl: 管理シートURL（オプション）
 */

const JobManager = {
  // 設定
  config: {
    gasApiUrl: localStorage.getItem('gas_api_url') || ''
  },

  // 状態
  companyDomain: null,
  companyName: null,
  sheetUrl: null,
  jobsCache: [],
  currentEditingJob: null,
  isNewJob: false,

  // 初期化
  async init() {
    // URLパラメータから情報を取得
    const params = new URLSearchParams(window.location.search);
    this.companyDomain = params.get('domain');
    this.companyName = params.get('company') || this.companyDomain;
    this.sheetUrl = params.get('sheetUrl');

    if (!this.companyDomain) {
      alert('会社ドメインが指定されていません');
      window.location.href = 'admin.html';
      return;
    }

    // UI更新
    document.getElementById('page-title').textContent = `${this.companyName} の求人一覧`;
    document.getElementById('company-name').textContent = this.companyName;

    // 管理シートボタンの設定
    const sheetBtn = document.getElementById('btn-open-sheet');
    if (this.sheetUrl && sheetBtn) {
      sheetBtn.href = this.sheetUrl;
      sheetBtn.style.display = '';
    } else if (sheetBtn) {
      sheetBtn.style.display = 'none';
    }

    // イベントリスナーの設定
    this.setupEventListeners();

    // 求人データを読み込み
    await this.loadJobsData();
  },

  // イベントリスナーの設定
  setupEventListeners() {
    // 新規求人作成ボタン
    document.getElementById('btn-add-job')?.addEventListener('click', () => {
      this.showJobModal();
    });

    // 更新ボタン
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.loadJobsData();
    });

    // モーダル: 閉じるボタン
    document.getElementById('job-modal-close')?.addEventListener('click', () => {
      this.closeJobModal();
    });

    // モーダル: キャンセルボタン
    document.getElementById('job-modal-cancel')?.addEventListener('click', () => {
      this.closeJobModal();
    });

    // モーダル: 削除ボタン
    document.getElementById('job-modal-delete')?.addEventListener('click', () => {
      this.deleteJob();
    });

    // モーダル: フォーム送信
    document.getElementById('job-edit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveJobData();
    });

    // オーバーレイクリックで閉じる
    document.getElementById('job-modal')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeJobModal();
      }
    });
  },

  // 求人データを読み込み
  async loadJobsData() {
    const tbody = document.getElementById('jobs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';

    const gasApiUrl = this.config.gasApiUrl;
    if (!gasApiUrl) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">GAS API URLが設定されていません。<a href="admin.html">管理画面</a>の設定から設定してください。</td></tr>';
      return;
    }

    try {
      const url = `${gasApiUrl}?action=getJobs&domain=${encodeURIComponent(this.companyDomain)}`;
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
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">データの読み込みに失敗しました: ${this.escapeHtml(error.message)}</td></tr>`;
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
          <td>${this.escapeHtml(job.id || '-')}</td>
          <td>${this.escapeHtml(job.title || '-')}</td>
          <td>${this.escapeHtml(job.location || '-')}</td>
          <td>${salary}</td>
          <td>${isVisible ? '<span class="badge success">公開</span>' : '<span class="badge">非公開</span>'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-small btn-edit" onclick="JobManager.editJob(${job._rowIndex})">編集</button>
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

    // フォームをクリア
    document.getElementById('job-modal-title').textContent = '新規求人作成';
    document.getElementById('edit-job-title').value = '';
    document.getElementById('edit-job-location').value = '';
    document.getElementById('edit-job-salary').value = '';
    document.getElementById('edit-job-bonus').value = '';
    document.getElementById('edit-job-order').value = '';
    document.getElementById('edit-job-features').value = '';
    document.getElementById('edit-job-badges').value = '';
    document.getElementById('edit-job-description').value = '';
    document.getElementById('edit-job-requirements').value = '';
    document.getElementById('edit-job-benefits').value = '';
    document.getElementById('edit-job-hours').value = '';
    document.getElementById('edit-job-holidays').value = '';
    document.getElementById('edit-job-start-date').value = '';
    document.getElementById('edit-job-end-date').value = '';
    document.getElementById('edit-job-visible').checked = true;

    // 削除ボタンを非表示
    document.getElementById('job-modal-delete').style.display = 'none';

    // モーダルを表示
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

    // フォームに既存データを設定
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

    // 日付
    if (job.publishStartDate) {
      const startDate = this.formatDateForInput(job.publishStartDate);
      document.getElementById('edit-job-start-date').value = startDate;
    } else {
      document.getElementById('edit-job-start-date').value = '';
    }
    if (job.publishEndDate) {
      const endDate = this.formatDateForInput(job.publishEndDate);
      document.getElementById('edit-job-end-date').value = endDate;
    } else {
      document.getElementById('edit-job-end-date').value = '';
    }

    document.getElementById('edit-job-visible').checked = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;

    // 削除ボタンを表示
    document.getElementById('job-modal-delete').style.display = '';

    // モーダルを表示
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
    if (!this.companyDomain) {
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

    // バリデーション
    if (!jobData.title || !jobData.location) {
      alert('募集タイトルと勤務地は必須です');
      return;
    }

    const gasApiUrl = this.config.gasApiUrl;
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
        companyDomain: this.companyDomain,
        job: jobData,
        rowIndex: this.isNewJob ? null : this.currentEditingJob._rowIndex
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
        }
        throw new Error(`GASからの応答が不正です: ${responseText.substring(0, 200)}`);
      }

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }

      if (!result.success) {
        alert('保存に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      // モーダルを閉じる
      this.closeJobModal();

      // 求人データを再読み込み
      await this.loadJobsData();

      alert(this.isNewJob ? '求人を作成しました' : '求人情報を更新しました');

    } catch (error) {
      console.error('求人保存エラー:', error);
      alert('保存中にエラーが発生しました: ' + error.message);
    }
  },

  // 求人を削除
  async deleteJob() {
    if (!this.currentEditingJob || !this.companyDomain) {
      alert('削除対象が選択されていません');
      return;
    }

    if (!confirm('この求人を削除してもよろしいですか？')) {
      return;
    }

    const gasApiUrl = this.config.gasApiUrl;
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
        companyDomain: this.companyDomain,
        rowIndex: this.currentEditingJob._rowIndex
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
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

      // モーダルを閉じる
      this.closeJobModal();

      // 求人データを再読み込み
      await this.loadJobsData();

      alert('求人を削除しました');

    } catch (error) {
      console.error('求人削除エラー:', error);
      alert('削除中にエラーが発生しました: ' + error.message);
    }
  },

  // HTMLエスケープ
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  JobManager.init();
});
