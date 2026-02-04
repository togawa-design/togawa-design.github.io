/**
 * Admin ページ エントリーポイント
 */
console.log('admin.js loaded');
import { initAdminDashboard } from '@features/admin/index.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired');
  initAdminDashboard();
});
