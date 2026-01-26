/**
 * Applicants ページ エントリーポイント
 * job-manage.htmlの応募者管理セクションにリダイレクト
 */

// URLパラメータを引き継いでリダイレクト
const params = new URLSearchParams(window.location.search);
params.set('section', 'applicants');
window.location.replace(`job-manage.html?${params.toString()}`);
