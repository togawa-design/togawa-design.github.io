/**
 * 求人管理 - アカウント設定モジュール
 */
import { escapeHtml } from '@shared/utils.js';
import { handleLogout } from './auth.js';
import {
  companyDomain,
  companyName
} from './state.js';
import { initCompanyLPSettings } from './lp-settings.js';

/**
 * パスワード変更フォームのセットアップ
 */
export function setupPasswordChangeForm() {
  const form = document.getElementById('password-change-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorEl = document.getElementById('password-change-error');
    const successEl = document.getElementById('password-change-success');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (newPassword !== confirmPassword) {
      errorEl.textContent = '新しいパスワードが一致しません';
      errorEl.style.display = 'block';
      return;
    }

    if (newPassword.length < 8) {
      errorEl.textContent = 'パスワードは8文字以上で設定してください';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const result = await changeCompanyUserPassword(currentPassword, newPassword);

      if (result.success) {
        successEl.textContent = 'パスワードを変更しました';
        successEl.style.display = 'block';
        form.reset();
      } else {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
      }
    } catch (error) {
      console.error('Password change error:', error);
      errorEl.textContent = 'パスワードの変更に失敗しました';
      errorEl.style.display = 'block';
    }
  });
}

/**
 * 会社ユーザーのパスワードを変更
 */
async function changeCompanyUserPassword(currentPassword, newPassword) {
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  const db = firebase.firestore();
  const username = sessionStorage.getItem('company_user_id');

  if (!username) {
    try {
      const userQuery = await db.collection('company_users')
        .where('companyDomain', '==', companyDomain)
        .limit(1)
        .get();

      if (userQuery.empty) {
        return { success: false, error: 'ユーザー情報が見つかりません' };
      }

      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();

      if (userData.password !== currentPassword) {
        return { success: false, error: '現在のパスワードが正しくありません' };
      }

      await db.collection('company_users').doc(userDoc.id).update({
        password: newPassword,
        passwordChangedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: error.message };
    }
  }

  try {
    const userQuery = await db.collection('company_users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return { success: false, error: 'ユーザー情報が見つかりません' };
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    if (userData.password !== currentPassword) {
      return { success: false, error: '現在のパスワードが正しくありません' };
    }

    await db.collection('company_users').doc(userDoc.id).update({
      password: newPassword,
      passwordChangedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Password change error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社ユーザー向けの機能制限を適用
 */
export function applyCompanyUserRestrictions() {
  const feedSection = document.querySelector('.feed-section');
  if (feedSection) {
    feedSection.style.display = 'none';
  }

  const backLink = document.querySelector('.sidebar-nav a[data-section="back"]');
  if (backLink) {
    backLink.style.display = 'none';
  }

  const backAdminBtn = document.getElementById('btn-back-admin');
  if (backAdminBtn) {
    backAdminBtn.style.display = 'none';
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.style.display = 'block';
    logoutBtn.addEventListener('click', () => {
      handleLogout();
      window.location.href = 'admin.html';
    });
  }

  const settingsNavItem = document.getElementById('nav-settings-item');
  if (settingsNavItem) {
    settingsNavItem.style.display = 'block';
  }

  const lpSettingsNavItem = document.getElementById('nav-lp-settings-item');
  if (lpSettingsNavItem) {
    lpSettingsNavItem.style.display = 'block';
  }

  initCompanyLPSettings();
  setupPasswordChangeForm();

  const companyNameEl = document.getElementById('company-name');
  if (companyNameEl) {
    companyNameEl.innerHTML = `${escapeHtml(companyName)} <span class="badge info">会社ユーザー</span>`;
  }
}
