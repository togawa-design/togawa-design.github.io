/**
 * Applicants ページ エントリーポイント
 */
import { initApplicantsManager } from '@features/applicants/index.js';

// DOMが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', () => {
  initApplicantsManager();
});
