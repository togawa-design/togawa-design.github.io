/**
 * リクエコ求人ナビ - 管理画面：設定モジュール
 * システム設定・パスワード変更・API設定を担当
 */

const AdminSettings = {
  // 設定保存
  saveSettings() {
    const apiEndpoint = document.getElementById('api-endpoint')?.value.trim();

    if (apiEndpoint) {
      localStorage.setItem('api_endpoint', apiEndpoint);
    } else {
      localStorage.removeItem('api_endpoint');
    }

    alert('設定を保存しました');
    AdminAnalytics.loadDashboardData();
  },

  // GAS設定保存
  saveGasSettings() {
    const gasApiUrl = document.getElementById('gas-api-url')?.value.trim();

    if (gasApiUrl) {
      localStorage.setItem('gas_api_url', gasApiUrl);
      AdminDashboard.spreadsheetConfig.gasApiUrl = gasApiUrl;
    } else {
      localStorage.removeItem('gas_api_url');
      AdminDashboard.spreadsheetConfig.gasApiUrl = '';
    }

    alert('GAS設定を保存しました。\n\n' + (gasApiUrl ? '会社情報・LP設定はスプレッドシートに直接保存されます。' : 'GAS APIが未設定のため、データはローカルストレージに保存されます。'));
  },

  // パスワード変更
  changePassword() {
    const newPass = document.getElementById('new-password')?.value;
    const confirmPass = document.getElementById('confirm-password')?.value;

    if (!newPass || !confirmPass) {
      alert('パスワードを入力してください');
      return;
    }

    if (newPass !== confirmPass) {
      alert('パスワードが一致しません');
      return;
    }

    if (newPass.length < 8) {
      alert('パスワードは8文字以上で設定してください');
      return;
    }

    // 注意: 実際の本番環境ではサーバーサイドでパスワードを管理してください
    localStorage.setItem('admin_password', newPass);
    AdminDashboard.config.credentials.password = newPass;
    alert('パスワードを変更しました');

    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  },

  // イベントバインド
  bindEvents() {
    // 設定保存
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }

    // GAS設定保存
    const saveGasSettingsBtn = document.getElementById('save-gas-settings');
    if (saveGasSettingsBtn) {
      saveGasSettingsBtn.addEventListener('click', () => this.saveGasSettings());
    }

    // パスワード変更
    const changePasswordBtn = document.getElementById('change-password');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.changePassword());
    }
  }
};

// グローバルにエクスポート
window.AdminSettings = AdminSettings;
