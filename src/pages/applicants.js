/**
 * Applicants ページ エントリーポイント
 */
import { initApplicantsManager } from '@features/applicants/index.js';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
  authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
  projectId: "generated-area-484613-e3-90bd4"
};

// DOMが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', () => {
  // Firebase初期化
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // 認証状態を待ってから初期化
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('[Applicants] User authenticated:', user.email);
      initApplicantsManager();
    } else {
      console.log('[Applicants] User not authenticated, redirecting to login');
      // 未認証の場合は管理画面へリダイレクト
      window.location.href = '/admin.html';
    }
  });
});
