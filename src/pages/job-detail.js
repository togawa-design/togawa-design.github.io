/**
 * Job Detail ページ エントリーポイント
 */
import { initJobDetailPage } from '@features/job-detail/index.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => initJobDetailPage(), 0);
  });
} else {
  setTimeout(() => initJobDetailPage(), 0);
}
