/**
 * 採用ページ設定 - 共通コアモジュール
 * admin版とjob-manage版で共通のロジックを提供
 */
import { showToast, escapeHtml } from '@shared/utils.js';
import { uploadRecruitLogo, uploadRecruitHeroImage, selectImageFile } from '@features/admin/image-uploader.js';
// API関数をインポート（内部使用 & re-export）
import { loadRecruitSettings, saveRecruitSettings } from './api.js';
export { loadRecruitSettings, saveRecruitSettings };

/**
 * ヒーロー画像プリセット
 */
export const heroImagePresets = [
  { id: 'teamwork-1', name: 'チームミーティング', url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60' },
  { id: 'teamwork-2', name: 'オフィスワーク', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60' },
  { id: 'teamwork-3', name: 'コラボレーション', url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60' },
  { id: 'teamwork-4', name: 'ビジネス握手', url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=60' },
  { id: 'teamwork-5', name: 'ワークショップ', url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=60' },
  { id: 'work-1', name: '作業風景', url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60' },
  { id: 'work-2', name: '倉庫作業', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=60' },
  { id: 'work-3', name: '建設現場', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60' },
  { id: 'work-4', name: '技術職', url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=60' },
  { id: 'work-5', name: 'チームワーク', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60' }
];

/**
 * カスタムセクションテンプレート
 */
export const sectionTemplates = [
  {
    id: 'message',
    name: 'MESSAGE',
    label: '私たちの想い',
    description: '経営理念など、代表者や採用担当者からのメッセージを画像を添えて伝えることができます。',
    thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"%3E%3Cdefs%3E%3ClinearGradient id="msgBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" stop-color="%234AA7C0"/%3E%3Cstop offset="100%25" stop-color="%233a8fa6"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23msgBg)" width="120" height="80" rx="4"/%3E%3Crect fill="%23fff" opacity="0.2" x="8" y="12" width="40" height="56" rx="3"/%3E%3Ccircle fill="%23fff" opacity="0.3" cx="28" cy="32" r="12"/%3E%3Crect fill="%23fff" opacity="0.15" x="14" y="48" width="28" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.15" x="18" y="54" width="20" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.9" x="56" y="16" width="56" height="6" rx="2"/%3E%3Crect fill="%23fff" opacity="0.5" x="56" y="28" width="52" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="56" y="34" width="48" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="56" y="40" width="50" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="56" y="46" width="44" height="3" rx="1"/%3E%3Cpath fill="%23fff" opacity="0.8" d="M64 58 L72 58 L68 64 Z"/%3E%3C/svg%3E',
    fields: [
      { key: 'title', type: 'text', label: '見出し', placeholder: '私たちの想い' },
      { key: 'headline', type: 'text', label: 'キャッチコピー', placeholder: '例）求職希望者の人生を変える仕事に携わりませんか。' },
      { key: 'description', type: 'textarea', label: '本文', placeholder: '例）「仕事を通して、人生を豊かにする。」それが私たちのミッションです。' },
      { key: 'image', type: 'image', label: '画像' }
    ]
  },
  {
    id: 'about',
    name: 'ABOUT',
    label: '私たちについて',
    description: '写真やロゴと文章で、会社紹介などを記載することができます。',
    thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"%3E%3Cdefs%3E%3ClinearGradient id="abtBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" stop-color="%236366f1"/%3E%3Cstop offset="100%25" stop-color="%234f46e5"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23abtBg)" width="120" height="80" rx="4"/%3E%3Ccircle fill="%23fff" opacity="0.25" cx="32" cy="40" r="22"/%3E%3Crect fill="%23fff" opacity="0.9" x="22" y="32" width="20" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.6" x="22" y="38" width="20" height="16" rx="2"/%3E%3Crect fill="%23fff" opacity="0.4" x="26" y="42" width="5" height="8" rx="1"/%3E%3Crect fill="%23fff" opacity="0.4" x="33" y="42" width="5" height="8" rx="1"/%3E%3Crect fill="%23fff" opacity="0.9" x="62" y="18" width="48" height="5" rx="2"/%3E%3Crect fill="%23fff" opacity="0.5" x="62" y="28" width="50" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="62" y="34" width="46" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="62" y="40" width="48" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="62" y="46" width="42" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="62" y="52" width="44" height="3" rx="1"/%3E%3C/svg%3E',
    fields: [
      { key: 'title', type: 'text', label: '見出し', placeholder: '私たちについて' },
      { key: 'description', type: 'textarea', label: '本文', placeholder: '会社の紹介文を入力してください' },
      { key: 'image', type: 'image', label: '画像・ロゴ' }
    ]
  },
  {
    id: 'business',
    name: 'BUSINESS',
    label: '事業内容',
    description: '事業内容を紹介できます。項目は最大4つ追加できます。',
    thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"%3E%3Cdefs%3E%3ClinearGradient id="bizBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" stop-color="%2310b981"/%3E%3Cstop offset="100%25" stop-color="%23059669"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23bizBg)" width="120" height="80" rx="4"/%3E%3Crect fill="%23fff" opacity="0.2" x="6" y="10" width="50" height="28" rx="4"/%3E%3Ccircle fill="%23fff" opacity="0.8" cx="31" cy="20" r="6"/%3E%3Crect fill="%23fff" opacity="0.5" x="16" y="30" width="30" height="2" rx="1"/%3E%3Crect fill="%23fff" opacity="0.2" x="64" y="10" width="50" height="28" rx="4"/%3E%3Ccircle fill="%23fff" opacity="0.8" cx="89" cy="20" r="6"/%3E%3Crect fill="%23fff" opacity="0.5" x="74" y="30" width="30" height="2" rx="1"/%3E%3Crect fill="%23fff" opacity="0.2" x="6" y="42" width="50" height="28" rx="4"/%3E%3Ccircle fill="%23fff" opacity="0.8" cx="31" cy="52" r="6"/%3E%3Crect fill="%23fff" opacity="0.5" x="16" y="62" width="30" height="2" rx="1"/%3E%3Crect fill="%23fff" opacity="0.2" x="64" y="42" width="50" height="28" rx="4"/%3E%3Ccircle fill="%23fff" opacity="0.8" cx="89" cy="52" r="6"/%3E%3Crect fill="%23fff" opacity="0.5" x="74" y="62" width="30" height="2" rx="1"/%3E%3C/svg%3E',
    fields: [
      { key: 'title', type: 'text', label: '見出し', placeholder: '事業内容' },
      { key: 'items', type: 'items', label: '項目（最大4つ）', maxItems: 4, itemFields: [
        { key: 'name', type: 'text', label: '項目名', placeholder: '例）人材派遣事業' },
        { key: 'description', type: 'textarea', label: '説明', placeholder: '事業の説明を入力' }
      ]}
    ]
  },
  {
    id: 'photos',
    name: 'PHOTOS',
    label: '働く環境',
    description: '職場の写真を複数枚掲載して、働く環境をアピールできます。',
    thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"%3E%3Cdefs%3E%3ClinearGradient id="phtBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" stop-color="%23f59e0b"/%3E%3Cstop offset="100%25" stop-color="%23d97706"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23phtBg)" width="120" height="80" rx="4"/%3E%3Crect fill="%23fff" opacity="0.3" x="6" y="12" width="34" height="24" rx="3"/%3E%3Ccircle fill="%23fff" opacity="0.6" cx="14" cy="20" r="3"/%3E%3Cpath fill="%23fff" opacity="0.5" d="M10 32 L18 24 L26 30 L32 26 L36 32 L10 32 Z"/%3E%3Crect fill="%23fff" opacity="0.3" x="43" y="12" width="34" height="24" rx="3"/%3E%3Ccircle fill="%23fff" opacity="0.6" cx="51" cy="20" r="3"/%3E%3Cpath fill="%23fff" opacity="0.5" d="M47 32 L55 24 L63 30 L69 26 L73 32 L47 32 Z"/%3E%3Crect fill="%23fff" opacity="0.3" x="80" y="12" width="34" height="24" rx="3"/%3E%3Ccircle fill="%23fff" opacity="0.6" cx="88" cy="20" r="3"/%3E%3Cpath fill="%23fff" opacity="0.5" d="M84 32 L92 24 L100 30 L106 26 L110 32 L84 32 Z"/%3E%3Crect fill="%23fff" opacity="0.3" x="6" y="40" width="34" height="24" rx="3"/%3E%3Ccircle fill="%23fff" opacity="0.6" cx="14" cy="48" r="3"/%3E%3Cpath fill="%23fff" opacity="0.5" d="M10 60 L18 52 L26 58 L32 54 L36 60 L10 60 Z"/%3E%3Crect fill="%23fff" opacity="0.3" x="43" y="40" width="34" height="24" rx="3"/%3E%3Ccircle fill="%23fff" opacity="0.6" cx="51" cy="48" r="3"/%3E%3Cpath fill="%23fff" opacity="0.5" d="M47 60 L55 52 L63 58 L69 54 L73 60 L47 60 Z"/%3E%3Crect fill="%23fff" opacity="0.3" x="80" y="40" width="34" height="24" rx="3"/%3E%3Ccircle fill="%23fff" opacity="0.6" cx="88" cy="48" r="3"/%3E%3Cpath fill="%23fff" opacity="0.5" d="M84 60 L92 52 L100 58 L106 54 L110 60 L84 60 Z"/%3E%3C/svg%3E',
    fields: [
      { key: 'title', type: 'text', label: '見出し', placeholder: '働く環境' },
      { key: 'images', type: 'gallery', label: '写真（最大6枚）', maxImages: 6 }
    ]
  },
  {
    id: 'text',
    name: 'TEXT',
    label: 'テキスト',
    description: '自由なテキストを追加できます。',
    thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"%3E%3Cdefs%3E%3ClinearGradient id="txtBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" stop-color="%238b5cf6"/%3E%3Cstop offset="100%25" stop-color="%237c3aed"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23txtBg)" width="120" height="80" rx="4"/%3E%3Crect fill="%23fff" opacity="0.2" x="10" y="12" width="100" height="56" rx="4"/%3E%3Crect fill="%23fff" opacity="0.8" x="18" y="20" width="84" height="4" rx="2"/%3E%3Crect fill="%23fff" opacity="0.5" x="18" y="30" width="80" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="18" y="36" width="76" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="18" y="42" width="82" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="18" y="48" width="70" height="3" rx="1"/%3E%3Crect fill="%23fff" opacity="0.5" x="18" y="54" width="74" height="3" rx="1"/%3E%3C/svg%3E',
    fields: [
      { key: 'content', type: 'textarea', label: 'テキスト', placeholder: '自由にテキストを入力してください' }
    ]
  },
  {
    id: 'heading',
    name: 'HEADING',
    label: '見出し',
    description: 'セクションの区切りとなる見出しを追加できます。',
    thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"%3E%3Cdefs%3E%3ClinearGradient id="hdgBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" stop-color="%23ec4899"/%3E%3Cstop offset="100%25" stop-color="%23db2777"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23hdgBg)" width="120" height="80" rx="4"/%3E%3Crect fill="%23fff" opacity="0.3" x="20" y="28" width="80" height="24" rx="4"/%3E%3Crect fill="%23fff" opacity="0.9" x="30" y="36" width="60" height="8" rx="2"/%3E%3Crect fill="%23fff" opacity="0.4" x="40" y="56" width="40" height="2" rx="1"/%3E%3C/svg%3E',
    fields: [
      { key: 'content', type: 'text', label: '見出しテキスト', placeholder: '見出しを入力' }
    ]
  }
];

/**
 * デザインテンプレート定義（カラーテーマ・業界別）
 */
export const designTemplates = [
  {
    id: 'modern',
    name: 'モダン',
    description: '洗練されたダークグレー + 青。信頼感と先進性',
    color: 'linear-gradient(135deg, #2d3436, #0984e3)',
    industries: ['製造', 'IT', 'オフィスワーク']
  },
  {
    id: 'athome',
    name: 'アットホーム',
    description: '温かみのあるオレンジ系。親しみやすさ重視',
    color: 'linear-gradient(135deg, #e67e22, #f39c12)',
    industries: ['飲食', '介護', 'サービス']
  },
  {
    id: 'cute',
    name: 'キュート',
    description: 'ポップで可愛いパステル調。女性向けに最適',
    color: 'linear-gradient(135deg, #ff8fa3, #fab1a0)',
    industries: ['保育', '美容', 'アパレル']
  },
  {
    id: 'trust',
    name: '信頼',
    description: '誠実で堅実な印象。ビジネス・企業向け',
    color: 'linear-gradient(135deg, #1a2a3a, #0077c2)',
    industries: ['製造', '金融', 'コンサル']
  },
  {
    id: 'kenchiku',
    name: '建築',
    description: '力強いオレンジ + ダーク。建設・土木業界向け',
    color: 'linear-gradient(135deg, #2c3e50, #f39c12)',
    industries: ['建設', '土木', '施工管理']
  }
];

// loadRecruitSettings と saveRecruitSettings は api.js からre-export済み

// プレビュー用の求人データ
let previewJobs = [];

/**
 * プレビュー用の求人データを設定
 * @param {Array} jobs - 求人データ配列
 */
export function setPreviewJobs(jobs) {
  previewJobs = jobs || [];
  updateJobsPreview();
}

// 現在選択中の職種フィルター
let selectedJobType = 'all';

/**
 * プレビューの求人カードを更新
 */
function updateJobsPreview() {
  const container = document.querySelector('.preview-job-cards');
  if (!container) return;

  // 表示件数を取得
  const jobsLimit = parseInt(document.getElementById('recruit-jobs-limit')?.value) || 0;
  const jobsSort = document.getElementById('recruit-jobs-sort')?.value || 'newest';

  // ソート
  let displayJobs = [...previewJobs];
  if (jobsSort === 'newest') {
    displayJobs.sort((a, b) => new Date(b.publishStartDate || 0) - new Date(a.publishStartDate || 0));
  } else if (jobsSort === 'oldest') {
    displayJobs.sort((a, b) => new Date(a.publishStartDate || 0) - new Date(b.publishStartDate || 0));
  } else if (jobsSort === 'salary-high') {
    displayJobs.sort((a, b) => parseSalary(b.monthlySalary) - parseSalary(a.monthlySalary));
  } else if (jobsSort === 'salary-low') {
    displayJobs.sort((a, b) => parseSalary(a.monthlySalary) - parseSalary(b.monthlySalary));
  } else if (jobsSort === 'custom') {
    displayJobs.sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));
  }

  // 件数制限
  if (jobsLimit > 0) {
    displayJobs = displayJobs.slice(0, jobsLimit);
  }

  if (displayJobs.length === 0) {
    container.innerHTML = '<div class="preview-no-jobs">求人がありません</div>';
    return;
  }

  // 職種タブを生成
  const jobTypes = [...new Set(displayJobs.map(job => job.jobType).filter(Boolean))];
  let tabsHtml = '';
  if (jobTypes.length > 1) {
    const typeCounts = {};
    displayJobs.forEach(job => {
      const type = job.jobType || 'その他';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    tabsHtml = `
      <div class="preview-job-tabs">
        <button class="preview-job-tab ${selectedJobType === 'all' ? 'active' : ''}" data-type="all">
          <span class="tab-label">全て</span>
          <span class="tab-count">${displayJobs.length}</span>
        </button>
        ${jobTypes.map(type => `
          <button class="preview-job-tab ${selectedJobType === type ? 'active' : ''}" data-type="${escapeHtml(type)}">
            <span class="tab-label">${escapeHtml(type)}</span>
            <span class="tab-count">${typeCounts[type] || 0}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // 職種でフィルタリング
  let filteredJobs = displayJobs;
  if (selectedJobType !== 'all') {
    filteredJobs = displayJobs.filter(job => job.jobType === selectedJobType);
  }

  // 求人カードを生成（最大3件まで表示）
  const maxPreviewCards = Math.min(filteredJobs.length, 3);
  const cardsHtml = filteredJobs.slice(0, maxPreviewCards).map(job => `
    <div class="preview-job-card" data-job-type="${escapeHtml(job.jobType || '')}">
      <div class="preview-job-title">${escapeHtml(truncateText(job.title || '求人タイトル', 20))}</div>
      <div class="preview-job-info">${escapeHtml(job.jobType || '')} ${escapeHtml(job.location || '')}</div>
    </div>
  `).join('');

  // 残りの件数を表示
  const moreHtml = filteredJobs.length > maxPreviewCards
    ? `<div class="preview-job-more">他 ${filteredJobs.length - maxPreviewCards}件</div>`
    : '';

  container.innerHTML = tabsHtml + cardsHtml + moreHtml;

  // タブのクリックイベントを設定
  container.querySelectorAll('.preview-job-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      selectedJobType = tab.dataset.type;
      updateJobsPreview();
    });
  });
}

/**
 * カスタムセクションのプレビューを更新
 * 各カスタムセクションを個別のpreview-reorderable要素として追加
 */
function updateCustomSectionsPreview() {
  const mainContainer = document.getElementById('preview-sections-container');
  if (!mainContainer) return;

  // 既存のカスタムセクションプレビューを削除
  mainContainer.querySelectorAll('.preview-custom-section').forEach(el => el.remove());

  // 旧コンテナを削除（reorderableクラスを持っているため並び替えに干渉する）
  const oldContainer = document.getElementById('preview-custom-sections');
  if (oldContainer) {
    oldContainer.remove();
  }

  // 現在のカスタムセクションを取得
  const sections = getCustomSections();

  if (!sections || sections.length === 0) {
    return;
  }

  // 各カスタムセクションを個別の要素として作成
  sections.forEach((section, index) => {
    const template = sectionTemplates.find(t => t.id === section.type);
    let innerHtml = '';

    if (section.type === 'heading' || (template && template.id === 'heading')) {
      const content = section.content || '';
      if (content) {
        innerHtml = `
          <div class="preview-custom-heading">
            <h3>${escapeHtml(truncateText(content, 15))}</h3>
          </div>
        `;
      }
    } else if (section.type === 'text' || (template && template.id === 'text')) {
      const content = section.content || '';
      if (content) {
        innerHtml = `
          <div class="preview-custom-text">
            <p>${escapeHtml(truncateText(content, 40))}</p>
          </div>
        `;
      }
    } else if (template) {
      // テンプレート型セクション
      const title = section.title || template.label;
      const hasImage = section.image || (section.images && section.images.length > 0);

      innerHtml = `
        <div class="preview-custom-template" data-type="${template.id}">
          <div class="preview-custom-template-header">
            <span class="preview-custom-template-badge">${escapeHtml(template.name)}</span>
          </div>
          <h4>${escapeHtml(truncateText(title, 12))}</h4>
          ${hasImage ? '<div class="preview-custom-template-image">📷</div>' : ''}
          ${section.headline ? `<p class="preview-custom-headline">${escapeHtml(truncateText(section.headline, 20))}</p>` : ''}
        </div>
      `;
    }

    if (innerHtml) {
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-section preview-reorderable preview-custom-section';
      wrapper.dataset.section = `custom-${index}`;
      wrapper.innerHTML = innerHtml;
      mainContainer.appendChild(wrapper);
    }
  });
}

/**
 * 給与文字列から数値を抽出
 */
function parseSalary(salaryStr) {
  if (!salaryStr) return 0;
  const match = String(salaryStr).match(/(\d+(?:,\d{3})*)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return 0;
}

/**
 * フォームに設定値を反映
 */
export function populateForm(settings, companyName = '') {
  // 公開設定
  const isPublishedCheckbox = document.getElementById('recruit-is-published');
  if (isPublishedCheckbox) {
    isPublishedCheckbox.checked = settings.isPublished !== false;
  }
  setInputValue('recruit-custom-slug', settings.customSlug || '');

  // 募集の設定
  setSelectValue('recruit-jobs-limit', settings.jobsLimit || '0');
  setSelectValue('recruit-jobs-sort', settings.jobsSort || 'newest');

  // カスタムリンク（JSON文字列の場合はパース）
  let customLinks = settings.customLinks || [];
  if (typeof customLinks === 'string') {
    try { customLinks = JSON.parse(customLinks); } catch { customLinks = []; }
  }
  renderCustomLinks(customLinks);

  // カスタムセクション（JSON文字列の場合はパース）
  let customSections = settings.customSections || [];
  if (typeof customSections === 'string') {
    try { customSections = JSON.parse(customSections); } catch { customSections = []; }
  }
  renderCustomSections(customSections);

  // レイアウトスタイルを設定
  setLayoutStyle(settings.layoutStyle || 'default');

  // カスタムカラーを設定
  setCustomColors({
    primary: settings.customPrimary || '',
    accent: settings.customAccent || '',
    bg: settings.customBg || '',
    text: settings.customText || ''
  });

  // ロゴ・ヘッダー設定
  setInputValue('recruit-logo-url', settings.logoUrl || '');
  setInputValue('recruit-company-name-display', settings.companyNameDisplay || '');
  setInputValue('recruit-phone-number', settings.phoneNumber || '');
  setInputValue('recruit-cta-button-text', settings.ctaButtonText || '今すぐ応募する');

  setInputValue('recruit-hero-title', settings.heroTitle || (companyName ? `${companyName}で働こう` : ''));
  setInputValue('recruit-hero-subtitle', settings.heroSubtitle || '');
  setInputValue('recruit-hero-image', settings.heroImage || '');
  setInputValue('recruit-company-intro', settings.companyIntro || '');
  setInputValue('recruit-jobs-title', settings.jobsTitle || '募集中の求人');
  setInputValue('recruit-cta-title', settings.ctaTitle || 'あなたの応募をお待ちしています');
  setInputValue('recruit-cta-text', settings.ctaText || '');
  setInputValue('recruit-ogp-title', settings.ogpTitle || '');
  setInputValue('recruit-ogp-description', settings.ogpDescription || '');
  setInputValue('recruit-ogp-image', settings.ogpImage || '');

  // ヒーロー画像プリセットの選択状態を更新
  updateHeroImagePresetSelection(settings.heroImage || '');

  // ロゴプレビューを更新
  updateLogoPreview(settings.logoUrl || '');

  // ヒーロー画像プレビューを更新
  updateHeroPreview(settings.heroImage || '');

  // 動画ボタン設定
  const showVideoCheckbox = document.getElementById('recruit-show-video-button');
  const videoUrlGroup = document.getElementById('recruit-video-url-group');
  if (showVideoCheckbox) {
    showVideoCheckbox.checked = String(settings.showVideoButton).toLowerCase() === 'true';
    if (videoUrlGroup) {
      videoUrlGroup.style.display = showVideoCheckbox.checked ? 'block' : 'none';
    }
  }
  setInputValue('recruit-video-url', settings.videoUrl || '');

  // セクション並び替え設定
  if (settings.sectionOrder) {
    applySectionOrder(settings.sectionOrder);
  }
  if (settings.sectionVisibility) {
    applySectionVisibility(settings.sectionVisibility);
  }

  // SNS連携設定
  setInputValue('recruit-sns-twitter', settings.snsTwitter || '');
  setInputValue('recruit-sns-instagram', settings.snsInstagram || '');
  setInputValue('recruit-sns-facebook', settings.snsFacebook || '');
  setInputValue('recruit-sns-youtube', settings.snsYoutube || '');
  setInputValue('recruit-sns-line', settings.snsLine || '');
  setInputValue('recruit-sns-tiktok', settings.snsTiktok || '');
}

/**
 * フォームにデフォルト値を設定
 */
export function populateFormWithDefaults(companyName = '', companyDescription = '', companyImageUrl = '') {
  // 公開設定
  const isPublishedCheckbox = document.getElementById('recruit-is-published');
  if (isPublishedCheckbox) isPublishedCheckbox.checked = true;
  setInputValue('recruit-custom-slug', '');

  // 募集の設定
  setSelectValue('recruit-jobs-limit', '0');
  setSelectValue('recruit-jobs-sort', 'newest');

  // カスタムリンク・カスタムセクションをリセット
  renderCustomLinks([]);
  renderCustomSections([]);

  // レイアウトスタイルをデフォルトに設定
  setLayoutStyle('default');
  // カスタムカラーをリセット
  resetCustomColors();

  // ロゴ・ヘッダー設定
  setInputValue('recruit-logo-url', '');
  setInputValue('recruit-company-name-display', companyName || '');
  setInputValue('recruit-phone-number', '');
  setInputValue('recruit-cta-button-text', '今すぐ応募する');

  setInputValue('recruit-hero-title', companyName ? `${companyName}で働こう` : '');
  setInputValue('recruit-hero-subtitle', companyDescription ? truncateText(companyDescription, 100) : '私たちと一緒に働きませんか？');
  setInputValue('recruit-hero-image', companyImageUrl || '');
  setInputValue('recruit-company-intro', '');
  setInputValue('recruit-jobs-title', '募集中の求人');
  setInputValue('recruit-cta-title', 'あなたの応募をお待ちしています');
  setInputValue('recruit-cta-text', '気になる求人があれば、ぜひお気軽にご応募ください。');
  setInputValue('recruit-ogp-title', '');
  setInputValue('recruit-ogp-description', '');
  setInputValue('recruit-ogp-image', '');

  // ヒーロー画像プリセットの選択状態を更新
  updateHeroImagePresetSelection(companyImageUrl || '');

  // ロゴプレビューをクリア
  updateLogoPreview('');

  // ヒーロー画像プレビューを更新
  updateHeroPreview(companyImageUrl || '');

  // 動画ボタン設定をリセット
  const showVideoCheckbox = document.getElementById('recruit-show-video-button');
  const videoUrlGroup = document.getElementById('recruit-video-url-group');
  if (showVideoCheckbox) showVideoCheckbox.checked = false;
  if (videoUrlGroup) videoUrlGroup.style.display = 'none';
  setInputValue('recruit-video-url', '');

  // セクション設定をリセット
  renderRecruitSectionsList();

  // SNSをリセット
  setInputValue('recruit-sns-twitter', '');
  setInputValue('recruit-sns-instagram', '');
  setInputValue('recruit-sns-facebook', '');
  setInputValue('recruit-sns-youtube', '');
  setInputValue('recruit-sns-line', '');
  setInputValue('recruit-sns-tiktok', '');
}

/**
 * フォームから設定値を取得
 */
export function getFormValues(companyDomain) {
  return {
    companyDomain: companyDomain || '',
    // 公開設定
    isPublished: document.getElementById('recruit-is-published')?.checked ?? true,
    customSlug: document.getElementById('recruit-custom-slug')?.value || '',
    // 募集の設定
    jobsLimit: document.getElementById('recruit-jobs-limit')?.value || '0',
    jobsSort: document.getElementById('recruit-jobs-sort')?.value || 'newest',
    // カスタムリンク（JSON文字列として保存）
    customLinks: JSON.stringify(getCustomLinks()),
    // カスタムセクション（JSON文字列として保存）
    customSections: JSON.stringify(getCustomSections()),
    // レイアウト
    layoutStyle: getLayoutStyle(),
    // カスタムカラー
    customPrimary: document.getElementById('recruit-custom-primary')?.value || '',
    customAccent: document.getElementById('recruit-custom-accent')?.value || '',
    customBg: document.getElementById('recruit-custom-bg')?.value || '',
    customText: document.getElementById('recruit-custom-text')?.value || '',
    // ロゴ・ヘッダー設定
    logoUrl: document.getElementById('recruit-logo-url')?.value || '',
    companyNameDisplay: document.getElementById('recruit-company-name-display')?.value || '',
    phoneNumber: document.getElementById('recruit-phone-number')?.value || '',
    ctaButtonText: document.getElementById('recruit-cta-button-text')?.value || '今すぐ応募する',
    // ファーストビュー
    heroTitle: document.getElementById('recruit-hero-title')?.value || '',
    heroSubtitle: document.getElementById('recruit-hero-subtitle')?.value || '',
    heroImage: document.getElementById('recruit-hero-image')?.value || '',
    companyIntro: document.getElementById('recruit-company-intro')?.value || '',
    jobsTitle: document.getElementById('recruit-jobs-title')?.value || '',
    ctaTitle: document.getElementById('recruit-cta-title')?.value || '',
    ctaText: document.getElementById('recruit-cta-text')?.value || '',
    ogpTitle: document.getElementById('recruit-ogp-title')?.value || '',
    ogpDescription: document.getElementById('recruit-ogp-description')?.value || '',
    ogpImage: document.getElementById('recruit-ogp-image')?.value || '',
    // 動画ボタン設定
    showVideoButton: document.getElementById('recruit-show-video-button')?.checked ? 'true' : 'false',
    videoUrl: document.getElementById('recruit-video-url')?.value || '',
    // セクション並び替え設定
    sectionOrder: getRecruitSectionOrder().join(','),
    sectionVisibility: JSON.stringify(getRecruitSectionVisibility()),
    // SNS連携
    snsTwitter: document.getElementById('recruit-sns-twitter')?.value || '',
    snsInstagram: document.getElementById('recruit-sns-instagram')?.value || '',
    snsFacebook: document.getElementById('recruit-sns-facebook')?.value || '',
    snsYoutube: document.getElementById('recruit-sns-youtube')?.value || '',
    snsLine: document.getElementById('recruit-sns-line')?.value || '',
    snsTiktok: document.getElementById('recruit-sns-tiktok')?.value || ''
  };
}

/**
 * input要素に値を設定
 */
export function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value || '';
  }
}

/**
 * select要素に値を設定
 */
export function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value || '';
  }
}

/**
 * レイアウトスタイルを設定
 */
export function setLayoutStyle(style) {
  const radio = document.querySelector(`input[name="recruit-layout-style"][value="${style}"]`);
  if (radio) {
    radio.checked = true;
  }
}

/**
 * レイアウトスタイルを取得
 */
export function getLayoutStyle() {
  const radio = document.querySelector('input[name="recruit-layout-style"]:checked');
  return radio?.value || 'default';
}

/**
 * カスタムカラーを設定
 */
export function setCustomColors(colors) {
  const colorIds = ['primary', 'accent', 'bg', 'text'];
  colorIds.forEach(id => {
    const colorInput = document.getElementById(`recruit-custom-${id}`);
    const textInput = document.getElementById(`recruit-custom-${id}-text`);
    const value = colors[id] || '';
    if (colorInput) {
      colorInput.value = value || (id === 'bg' ? '#ffffff' : id === 'text' ? '#1f2937' : '#000000');
    }
    if (textInput) {
      textInput.value = value;
    }
  });
}

/**
 * カスタムカラーをリセット
 */
export function resetCustomColors() {
  const colorIds = ['primary', 'accent', 'bg', 'text'];
  const defaults = {
    primary: '',
    accent: '',
    bg: '#ffffff',
    text: '#1f2937'
  };
  colorIds.forEach(id => {
    const colorInput = document.getElementById(`recruit-custom-${id}`);
    const textInput = document.getElementById(`recruit-custom-${id}-text`);
    if (colorInput) colorInput.value = defaults[id] || '#000000';
    if (textInput) textInput.value = '';
  });
}

/**
 * カラーピッカーのイベントリスナーをセットアップ
 */
export function setupColorPickers() {
  const colorIds = ['primary', 'accent', 'bg', 'text'];

  colorIds.forEach(id => {
    const colorInput = document.getElementById(`recruit-custom-${id}`);
    const textInput = document.getElementById(`recruit-custom-${id}-text`);

    if (colorInput && textInput) {
      // カラーピッカー → テキスト入力
      colorInput.addEventListener('input', () => {
        textInput.value = colorInput.value;
        updateLivePreview();
      });

      // テキスト入力 → カラーピッカー
      textInput.addEventListener('input', () => {
        const val = textInput.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          colorInput.value = val;
        }
        updateLivePreview();
      });
    }
  });

  // リセットボタン
  const resetBtn = document.getElementById('recruit-reset-colors');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetCustomColors();
      updateLivePreview();
    });
  }
}

/**
 * テキストを指定文字数で切り詰め
 */
export function truncateText(text, maxLength) {
  if (!text) return '';
  const plainText = text.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
}

/**
 * 保存ボタンのUI操作
 */
export function setSaveButtonLoading(isLoading) {
  const saveBtn = document.getElementById('btn-save-recruit-settings');
  if (saveBtn) {
    saveBtn.disabled = isLoading;
    saveBtn.textContent = isLoading ? '保存中...' : '採用ページ設定を保存';
  }
}

/**
 * 保存処理の共通ラッパー
 */
export async function handleSave(companyDomain, onSuccess) {
  if (!companyDomain) {
    showToast('会社情報が設定されていません', 'error');
    return null;
  }

  const settings = getFormValues(companyDomain);
  setSaveButtonLoading(true);

  try {
    await saveRecruitSettings(settings);
    showToast('採用ページ設定を保存しました', 'success');
    if (onSuccess) onSuccess(settings);
    return settings;
  } catch (error) {
    console.error('[RecruitSettings] 保存エラー:', error);
    showToast('保存に失敗しました: ' + error.message, 'error');
    return null;
  } finally {
    setSaveButtonLoading(false);
  }
}

/**
 * リセットボタンの共通処理
 */
export function handleReset(savedSettings, companyName = '', companyDescription = '', companyImageUrl = '') {
  if (savedSettings && Object.keys(savedSettings).length > 0) {
    populateForm(savedSettings, companyName);
  } else {
    populateFormWithDefaults(companyName, companyDescription, companyImageUrl);
  }
  showToast('設定をリセットしました', 'info');
}

/**
 * プレビューリンクを更新
 */
export function updatePreviewLink(companyDomain) {
  const previewBtn = document.getElementById('recruit-preview-btn');
  if (previewBtn && companyDomain) {
    previewBtn.href = `company-recruit.html?id=${encodeURIComponent(companyDomain)}`;
  }

  // 編集モードボタンも更新
  const editBtn = document.getElementById('recruit-edit-btn');
  if (editBtn && companyDomain) {
    editBtn.href = `company-recruit.html?id=${encodeURIComponent(companyDomain)}&edit`;
  }
}

/**
 * ヒーロー画像プリセットをレンダリング
 */
export function renderHeroImagePresets() {
  const container = document.getElementById('recruit-hero-image-presets');
  if (!container) return;

  container.innerHTML = heroImagePresets.map(preset => `
    <div class="hero-image-preset" data-url="${escapeHtml(preset.url)}" title="${escapeHtml(preset.name)}">
      <img src="${escapeHtml(preset.thumbnail)}" alt="${escapeHtml(preset.name)}" loading="lazy">
      <span class="preset-name">${escapeHtml(preset.name)}</span>
      <span class="preset-check">✓</span>
    </div>
  `).join('');

  container.querySelectorAll('.hero-image-preset').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      selectHeroImagePreset(url);
    });
  });
}

/**
 * ヒーロー画像プリセットを選択
 */
export function selectHeroImagePreset(url) {
  const input = document.getElementById('recruit-hero-image');
  if (input) {
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  updateHeroImagePresetSelection(url);
}

/**
 * ヒーロー画像プリセットの選択状態を更新
 */
export function updateHeroImagePresetSelection(selectedUrl) {
  const container = document.getElementById('recruit-hero-image-presets');
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
}

/**
 * ロゴプレビューを更新
 */
export function updateLogoPreview(url) {
  const previewEl = document.getElementById('recruit-logo-preview');
  if (!previewEl) return;

  if (url) {
    previewEl.innerHTML = `<img src="${escapeHtml(url)}" alt="ロゴプレビュー">`;
  } else {
    previewEl.innerHTML = '<span class="logo-placeholder">ロゴ未設定</span>';
  }
}

/**
 * ロゴアップロードボタンを設定
 */
export function setupLogoUpload(companyDomain) {
  let uploadBtn = document.getElementById('btn-upload-logo');
  let urlInput = document.getElementById('recruit-logo-url');
  const previewEl = document.getElementById('recruit-logo-preview');

  if (!uploadBtn || !urlInput) return;

  // 既存のイベントリスナーを削除するために要素を複製して置き換え
  const newUploadBtn = uploadBtn.cloneNode(true);
  uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
  uploadBtn = newUploadBtn;

  const newUrlInput = urlInput.cloneNode(true);
  urlInput.parentNode.replaceChild(newUrlInput, urlInput);
  urlInput = newUrlInput;

  // URL入力時のプレビュー更新
  urlInput.addEventListener('input', () => {
    updateLogoPreview(urlInput.value);
  });

  // アップロードボタンクリック
  uploadBtn.addEventListener('click', async () => {
    if (!companyDomain) {
      showToast('会社情報が設定されていません', 'error');
      return;
    }

    try {
      // ファイル選択
      const file = await selectImageFile({ accept: 'image/png,image/jpeg,image/webp,image/svg+xml' });

      // アップロード中の表示
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="upload-spinner"></span> アップロード中...';
      if (previewEl) {
        previewEl.classList.add('uploading');
        previewEl.innerHTML = '<div class="upload-spinner"></div>';
      }

      // Cloudinaryにアップロード（採用ページ専用パス）
      const timestamp = Date.now();
      const url = await uploadRecruitLogo(file, companyDomain);

      // キャッシュ回避のためタイムスタンプを追加
      const urlWithCache = url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;

      // URLを入力欄に設定
      urlInput.value = urlWithCache;

      // プレビューを更新
      updateLogoPreview(urlWithCache);

      showToast('ロゴをアップロードしました', 'success');
    } catch (error) {
      console.error('[RecruitSettings] ロゴアップロードエラー:', error);
      if (error.message !== 'ファイルが選択されませんでした') {
        showToast('アップロードに失敗しました: ' + error.message, 'error');
      }
      // プレビューを元に戻す
      updateLogoPreview(urlInput.value);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<span class="upload-icon">📷</span> アップロード';
      if (previewEl) {
        previewEl.classList.remove('uploading');
      }
    }
  });
}

/**
 * ヒーロー画像プレビューを更新
 */
export function updateHeroPreview(url) {
  const previewEl = document.getElementById('recruit-hero-preview');
  if (!previewEl) return;

  if (url) {
    previewEl.innerHTML = `<img src="${escapeHtml(url)}" alt="ヒーロー画像プレビュー">`;
    previewEl.classList.add('has-image');
  } else {
    previewEl.innerHTML = '<span class="hero-placeholder">ヒーロー画像未設定</span>';
    previewEl.classList.remove('has-image');
  }
}

/**
 * ヒーロー画像アップロードボタンを設定
 */
export function setupHeroUpload(companyDomain) {
  let uploadBtn = document.getElementById('btn-upload-hero');
  let urlInput = document.getElementById('recruit-hero-image');
  const previewEl = document.getElementById('recruit-hero-preview');

  if (!uploadBtn || !urlInput) return;

  // 既存のイベントリスナーを削除するために要素を複製して置き換え
  const newUploadBtn = uploadBtn.cloneNode(true);
  uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
  uploadBtn = newUploadBtn;

  const newUrlInput = urlInput.cloneNode(true);
  urlInput.parentNode.replaceChild(newUrlInput, urlInput);
  urlInput = newUrlInput;

  // URL入力時のプレビュー更新
  urlInput.addEventListener('input', () => {
    updateHeroPreview(urlInput.value);
    updateHeroImagePresetSelection(urlInput.value);
  });

  // アップロードボタンクリック
  uploadBtn.addEventListener('click', async () => {
    if (!companyDomain) {
      showToast('会社情報が設定されていません', 'error');
      return;
    }

    try {
      // ファイル選択
      const file = await selectImageFile({ accept: 'image/png,image/jpeg,image/webp' });

      // アップロード中の表示
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="upload-spinner"></span> アップロード中...';
      if (previewEl) {
        previewEl.classList.add('uploading');
        previewEl.innerHTML = '<div class="upload-spinner"></div>';
      }

      // Cloudinaryにアップロード
      const url = await uploadRecruitHeroImage(file, companyDomain);

      // キャッシュ回避のためタイムスタンプを追加
      const timestamp = Date.now();
      const urlWithCache = url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;

      // URLを入力欄に設定
      urlInput.value = urlWithCache;

      // プレビューを更新
      updateHeroPreview(urlWithCache);

      // プリセット選択状態をクリア（カスタム画像なので）
      updateHeroImagePresetSelection('');

      // inputイベントを発火してリアルタイムプレビューに反映
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));

      showToast('ヒーロー画像をアップロードしました', 'success');
    } catch (error) {
      console.error('[RecruitSettings] ヒーロー画像アップロードエラー:', error);
      if (error.message !== 'ファイルが選択されませんでした') {
        showToast('アップロードに失敗しました: ' + error.message, 'error');
      }
      // プレビューを元に戻す
      updateHeroPreview(urlInput.value);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<span class="upload-icon">📷</span> アップロード';
      if (previewEl) {
        previewEl.classList.remove('uploading');
      }
    }
  });
}

/**
 * 採用ページ情報パネルを初期化
 */
export function setupRecruitInfoPanel(companyDomain) {
  const baseUrl = window.location.origin;
  const recruitUrl = `${baseUrl}/company-recruit.html?c=${encodeURIComponent(companyDomain)}`;

  // URL表示を更新
  const urlLink = document.getElementById('recruit-page-url-link');
  const previewLink = document.getElementById('recruit-preview-link');
  if (urlLink) {
    urlLink.href = recruitUrl;
    urlLink.textContent = recruitUrl;
  }
  if (previewLink) {
    previewLink.href = recruitUrl;
  }

  // URLコピーボタン
  const copyBtn = document.getElementById('btn-copy-recruit-url');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(recruitUrl);
        showToast('URLをコピーしました', 'success');
      } catch (e) {
        console.error('URLコピーに失敗:', e);
        showToast('コピーに失敗しました', 'error');
      }
    });
  }

  // 埋め込みリンクを更新
  updateEmbedLinks(recruitUrl);

  // 埋め込みリンクコピーボタン
  setupEmbedCopyButtons();

  // QRコード生成ボタン
  const qrBtn = document.getElementById('btn-generate-qr');
  if (qrBtn) {
    qrBtn.addEventListener('click', () => {
      generateQRCode(recruitUrl);
    });
  }
}

/**
 * 埋め込みリンクを更新
 */
function updateEmbedLinks(url) {
  const textLinkEl = document.getElementById('embed-text-link');
  const buttonLinkEl = document.getElementById('embed-button-link');

  if (textLinkEl) {
    textLinkEl.textContent = `<a href="${url}" target="_blank">採用情報を見る</a>`;
  }

  if (buttonLinkEl) {
    buttonLinkEl.textContent = `<a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">採用情報</a>`;
  }
}

/**
 * 埋め込みリンクのコピーボタンを設定
 */
function setupEmbedCopyButtons() {
  document.querySelectorAll('.btn-copy-embed').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        try {
          await navigator.clipboard.writeText(targetEl.textContent);
          showToast('コードをコピーしました', 'success');
        } catch (e) {
          console.error('コピーに失敗:', e);
          showToast('コピーに失敗しました', 'error');
        }
      }
    });
  });
}

/**
 * QRコードを生成（簡易版：Google Chart APIを使用）
 */
function generateQRCode(url) {
  const container = document.getElementById('recruit-qr-code');
  if (!container) return;

  // Google Chart API でQRコード生成
  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(url)}&choe=UTF-8`;

  container.innerHTML = `<img src="${qrUrl}" alt="QRコード" style="width:100%;height:100%;">`;
}

/**
 * 公開状態を更新
 */
export function updatePublishStatus(isPublished) {
  const badge = document.getElementById('recruit-status-badge');
  const toggleBtn = document.getElementById('btn-toggle-publish');

  if (badge) {
    badge.className = `status-badge ${isPublished ? 'status-published' : 'status-draft'}`;
    badge.textContent = isPublished ? '公開中' : '非公開';
  }

  if (toggleBtn) {
    toggleBtn.textContent = isPublished ? '非公開にする' : '公開する';
  }
}

/**
 * レイアウトスタイルごとのデフォルトカラー
 * designTemplatesと連携
 */
const layoutStyleColors = {
  // デフォルト（モダンと同じ）
  default: { primary: '#0984e3', accent: '#74b9ff', bg: '#f8fafc', text: '#2d3436' },
  // モダン: 洗練されたダークグレー + 青
  modern: { primary: '#0984e3', accent: '#74b9ff', bg: '#f8fafc', text: '#2d3436' },
  // アットホーム: 温かみのあるオレンジ系
  athome: { primary: '#e67e22', accent: '#f39c12', bg: '#fef9f3', text: '#5d4037' },
  // キュート: ポップで可愛いパステル調
  cute: { primary: '#ff8fa3', accent: '#fab1a0', bg: '#fff5f7', text: '#6d4c41' },
  // 信頼: 誠実で堅実な印象
  trust: { primary: '#0077c2', accent: '#4ea8de', bg: '#f0f8ff', text: '#1a2a3a' },
  // 建築: 力強いオレンジ + ダーク
  kenchiku: { primary: '#f39c12', accent: '#e67e22', bg: '#f5f5f5', text: '#2c3e50' }
};

/**
 * リアルタイムプレビューを更新
 */
export function updateLivePreview() {
  const previewContainer = document.getElementById('recruit-live-preview');
  if (!previewContainer) return;

  // ロゴ
  const logoUrl = document.getElementById('recruit-logo-url')?.value || '';
  const logoEl = document.getElementById('preview-logo');
  if (logoEl) {
    if (logoUrl) {
      logoEl.src = logoUrl;
      logoEl.style.display = 'block';
    } else {
      logoEl.style.display = 'none';
    }
  }

  // 会社名
  const companyName = document.getElementById('recruit-company-name-display')?.value || '';
  const companyNameEl = document.getElementById('preview-company-name');
  if (companyNameEl) {
    companyNameEl.textContent = companyName || '会社名';
  }

  // ヒーロータイトル
  const heroTitle = document.getElementById('recruit-hero-title')?.value || '';
  const heroTitleEl = document.getElementById('preview-hero-title');
  if (heroTitleEl) {
    heroTitleEl.textContent = heroTitle || 'キャッチコピー';
  }

  // ヒーローサブタイトル
  const heroSubtitle = document.getElementById('recruit-hero-subtitle')?.value || '';
  const heroSubtitleEl = document.getElementById('preview-hero-subtitle');
  if (heroSubtitleEl) {
    heroSubtitleEl.textContent = heroSubtitle || 'サブタイトル';
  }

  // ヒーロー背景画像
  const heroImage = document.getElementById('recruit-hero-image')?.value || '';
  const heroEl = document.getElementById('preview-hero');
  if (heroEl) {
    if (heroImage) {
      heroEl.style.backgroundImage = `url(${heroImage})`;
    } else {
      heroEl.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  }

  // 会社紹介
  const companyIntro = document.getElementById('recruit-company-intro')?.value || '';
  const introEl = document.getElementById('preview-intro-text');
  if (introEl) {
    introEl.textContent = companyIntro ? truncateText(companyIntro, 60) : '会社紹介文がここに表示されます';
  }

  // 求人セクションタイトル
  const jobsTitle = document.getElementById('recruit-jobs-title')?.value || '';
  const jobsTitleEl = document.getElementById('preview-jobs-title');
  if (jobsTitleEl) {
    jobsTitleEl.textContent = jobsTitle || '募集中の求人';
  }

  // CTAタイトル
  const ctaTitle = document.getElementById('recruit-cta-title')?.value || '';
  const ctaTitleEl = document.getElementById('preview-cta-title');
  if (ctaTitleEl) {
    ctaTitleEl.textContent = ctaTitle || 'ご応募お待ちしています';
  }

  // CTAボタンテキスト
  const ctaButtonText = document.getElementById('recruit-cta-button-text')?.value || '';
  const ctaButtonEl = document.getElementById('preview-cta-button');
  if (ctaButtonEl) {
    ctaButtonEl.textContent = ctaButtonText || '今すぐ応募する';
  }

  // デザインパターンの色を適用
  applyPreviewColorTheme();

  // 求人カードを更新
  updateJobsPreview();

  // カスタムセクションのプレビューを更新
  updateCustomSectionsPreview();

  // セクションの並び順と表示/非表示を反映
  updatePreviewSectionOrder();
}

/**
 * プレビューのセクション順序と表示/非表示を更新
 */
function updatePreviewSectionOrder() {
  const container = document.getElementById('preview-sections-container');
  if (!container) return;

  // セクションの順序を取得
  const order = getRecruitSectionOrder();
  // セクションの表示状態を取得
  const visibility = getRecruitSectionVisibility();

  // 各セクションを取得
  const sections = container.querySelectorAll('.preview-reorderable');
  const sectionMap = {};
  sections.forEach(section => {
    const sectionId = section.dataset.section;
    if (sectionId) {
      sectionMap[sectionId] = section;
    }
  });

  // 順序に従ってセクションを並び替え
  order.forEach(sectionId => {
    const section = sectionMap[sectionId];
    if (section) {
      // 表示/非表示を適用
      const isVisible = visibility[sectionId] !== false;
      section.style.display = isVisible ? '' : 'none';
      // DOMの順序を変更
      container.appendChild(section);
    }
  });
}

/**
 * プレビューにカラーテーマを適用
 */
export function applyPreviewColorTheme() {
  const layoutStyle = getLayoutStyle();
  const previewContainer = document.getElementById('recruit-live-preview');

  if (!previewContainer) return;

  // レイアウトスタイルをプレビューに適用
  previewContainer.setAttribute('data-layout-style', layoutStyle);

  // カスタムカラーを取得
  const customPrimaryInput = document.getElementById('recruit-custom-primary-text');
  const customAccentInput = document.getElementById('recruit-custom-accent-text');
  const customBgInput = document.getElementById('recruit-custom-bg-text');
  const customTextInput = document.getElementById('recruit-custom-text-text');

  // カスタムカラーの値（テキスト入力から取得、空欄の場合はレイアウトスタイルのデフォルトを使用）
  const baseColors = layoutStyleColors[layoutStyle] || layoutStyleColors.default;
  const colors = {
    primary: customPrimaryInput?.value || baseColors.primary,
    accent: customAccentInput?.value || baseColors.accent,
    bg: customBgInput?.value || baseColors.bg,
    text: customTextInput?.value || baseColors.text
  };

  // CSS変数でカラーを設定（previewContainer = .preview-phone-content）
  previewContainer.style.setProperty('--preview-primary', colors.primary);
  previewContainer.style.setProperty('--preview-accent', colors.accent);
  previewContainer.style.setProperty('--preview-bg', colors.bg);
  previewContainer.style.setProperty('--preview-text', colors.text);
}

/**
 * リアルタイムプレビューのイベントリスナーをセットアップ
 */
export function setupLivePreview() {
  const previewContainer = document.getElementById('recruit-live-preview');
  if (!previewContainer) return;

  // 監視するフォームフィールドのIDリスト
  const fieldIds = [
    'recruit-logo-url',
    'recruit-company-name-display',
    'recruit-hero-title',
    'recruit-hero-subtitle',
    'recruit-hero-image',
    'recruit-company-intro',
    'recruit-jobs-title',
    'recruit-cta-title',
    'recruit-cta-button-text'
  ];

  // 各フィールドにinputイベントリスナーを追加
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLivePreview);
    }
  });

  // レイアウトスタイルのradioボタンにchangeイベントリスナーを追加
  const layoutStyleRadios = document.querySelectorAll('input[name="recruit-layout-style"]');
  layoutStyleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateLivePreview();
    });
  });

  // カスタムカラーピッカーをセットアップ
  setupColorPickers();

  // 初期プレビューを更新
  updateLivePreview();
}

// ========================================
// セクション管理機能
// ========================================

/**
 * 採用ページの基本セクション
 */
export const RECRUIT_SECTIONS = [
  { id: 'hero', name: 'ヒーロー', icon: '🎯', required: true },
  { id: 'company-intro', name: '会社紹介', icon: '🏢', required: false },
  { id: 'jobs', name: '求人一覧', icon: '📋', required: true },
  { id: 'cta', name: 'CTA', icon: '📞', required: true }
];

/**
 * セクション順序を取得
 */
export function getRecruitSectionOrder() {
  const orderList = document.getElementById('recruit-sections-list');
  if (!orderList) {
    return RECRUIT_SECTIONS.map(s => s.id);
  }
  return Array.from(orderList.querySelectorAll('.recruit-section-item'))
    .map(li => li.dataset.section);
}

/**
 * セクション表示状態を取得
 */
export function getRecruitSectionVisibility() {
  const visibility = {};
  // 基本セクション
  RECRUIT_SECTIONS.forEach(section => {
    if (!section.required) {
      const checkbox = document.getElementById(`recruit-section-${section.id}-visible`);
      visibility[section.id] = checkbox?.checked ?? true;
    }
  });
  // カスタムセクション
  const customSections = getCustomSections();
  customSections.forEach((_, index) => {
    const checkbox = document.getElementById(`recruit-section-custom-${index}-visible`);
    visibility[`custom-${index}`] = checkbox?.checked ?? true;
  });
  return visibility;
}

/**
 * セクション順序を適用
 */
export function applySectionOrder(orderString) {
  const orderList = document.getElementById('recruit-sections-list');
  if (!orderList || !orderString) return;

  const order = orderString.split(',').map(s => s.trim()).filter(s => s);
  const items = Array.from(orderList.querySelectorAll('.recruit-section-item'));
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.dataset.section] = item;
  });

  order.forEach(sectionId => {
    const item = itemMap[sectionId];
    if (item) {
      orderList.appendChild(item);
    }
  });
}

/**
 * セクション表示状態を適用
 */
export function applySectionVisibility(visibilityString) {
  if (!visibilityString) return;

  try {
    const visibility = JSON.parse(visibilityString);
    Object.keys(visibility).forEach(sectionId => {
      // custom-0, custom-1 などは recruit-section-custom-0-visible の形式
      const checkboxId = sectionId.startsWith('custom-')
        ? `recruit-section-${sectionId}-visible`
        : `recruit-section-${sectionId}-visible`;
      const checkbox = document.getElementById(checkboxId);
      if (checkbox) {
        checkbox.checked = visibility[sectionId];
      }
    });
  } catch (e) {
    console.error('セクション表示状態のパースエラー:', e);
  }
}

/**
 * セクションリストをレンダリング
 */
export function renderRecruitSectionsList() {
  const container = document.getElementById('recruit-sections-list');
  if (!container) return;

  // カスタムセクションを取得
  const customSections = getCustomSections();

  // 基本セクションのHTML
  const baseSectionsHtml = RECRUIT_SECTIONS.map(section => {
    return `
      <li class="recruit-section-item" data-section="${section.id}" draggable="true">
        <span class="section-drag-handle">⋮⋮</span>
        <span class="section-icon">${section.icon}</span>
        <span class="section-name">${section.name}</span>
        ${!section.required ? `
          <label class="section-visibility-toggle">
            <input type="checkbox" id="recruit-section-${section.id}-visible" checked>
            <span class="toggle-label">表示</span>
          </label>
        ` : '<span class="section-required-badge">必須</span>'}
      </li>
    `;
  }).join('');

  // カスタムセクションのHTML（各セクションを個別のアイテムとして追加）
  const customSectionsHtml = customSections.map((section, index) => {
    const template = sectionTemplates.find(t => t.id === section.type);
    const sectionName = template ? template.label : section.type;
    const sectionIcon = getCustomSectionIcon(section.type);

    return `
      <li class="recruit-section-item custom-section-item" data-section="custom-${index}" data-custom-index="${index}" draggable="true">
        <span class="section-drag-handle">⋮⋮</span>
        <span class="section-icon">${sectionIcon}</span>
        <span class="section-name">${sectionName}</span>
        <label class="section-visibility-toggle">
          <input type="checkbox" id="recruit-section-custom-${index}-visible" checked>
          <span class="toggle-label">表示</span>
        </label>
      </li>
    `;
  }).join('');

  container.innerHTML = baseSectionsHtml + customSectionsHtml;

  setupRecruitSectionDragDrop();

  // 表示/非表示チェックボックスの変更イベント（基本セクション）
  RECRUIT_SECTIONS.forEach(section => {
    if (!section.required) {
      const checkbox = document.getElementById(`recruit-section-${section.id}-visible`);
      if (checkbox) {
        checkbox.addEventListener('change', updateLivePreview);
      }
    }
  });

  // 表示/非表示チェックボックスの変更イベント（カスタムセクション）
  customSections.forEach((_, index) => {
    const checkbox = document.getElementById(`recruit-section-custom-${index}-visible`);
    if (checkbox) {
      checkbox.addEventListener('change', updateLivePreview);
    }
  });
}

/**
 * カスタムセクションタイプに応じたアイコンを取得
 */
function getCustomSectionIcon(type) {
  const icons = {
    'message': '💬',
    'about': '🏢',
    'business': '💼',
    'photos': '📷',
    'text': '📝',
    'heading': '📌',
    'image': '🖼️'
  };
  return icons[type] || '✨';
}

/**
 * ドラッグ&ドロップを設定
 */
export function setupRecruitSectionDragDrop() {
  const list = document.getElementById('recruit-sections-list');
  if (!list) return;

  let draggedItem = null;

  list.querySelectorAll('.recruit-section-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.recruit-section-item').forEach(i => {
        i.classList.remove('drag-over');
      });
      draggedItem = null;
      updateLivePreview();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === item) return;

      list.querySelectorAll('.recruit-section-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      if (e.clientY < midY) {
        item.classList.add('drag-over');
        list.insertBefore(draggedItem, item);
      } else {
        list.insertBefore(draggedItem, item.nextSibling);
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
  });
}

/**
 * 動画ボタンセクションの初期化
 */
export function initVideoButtonSection() {
  const checkbox = document.getElementById('recruit-show-video-button');
  const videoUrlGroup = document.getElementById('recruit-video-url-group');

  if (checkbox && videoUrlGroup) {
    checkbox.addEventListener('change', () => {
      videoUrlGroup.style.display = checkbox.checked ? 'block' : 'none';
      updateLivePreview();
    });
  }

  // 動画URL入力のプレビュー更新
  const videoUrlInput = document.getElementById('recruit-video-url');
  if (videoUrlInput) {
    videoUrlInput.addEventListener('input', updateLivePreview);
  }
}

// ========================================
// カスタムリンク管理機能
// ========================================

/**
 * カスタムリンクをレンダリング
 */
export function renderCustomLinks(links) {
  const container = document.getElementById('recruit-custom-links');
  if (!container) return;

  container.innerHTML = (links || []).map((link, index) => `
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
      const currentLinks = getCustomLinks();
      currentLinks.splice(idx, 1);
      renderCustomLinks(currentLinks);
    });
  });
}

/**
 * カスタムリンクを取得
 */
export function getCustomLinks() {
  const container = document.getElementById('recruit-custom-links');
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
export function addCustomLink() {
  const currentLinks = getCustomLinks();
  currentLinks.push({ label: '', url: '' });
  renderCustomLinks(currentLinks);
}

// ========================================
// カスタムセクション管理機能
// ========================================

/**
 * テンプレートセクションのフィールドをレンダリング
 */
function renderSectionFields(template, section, index) {
  if (!template || !template.fields) {
    // 旧形式（text, heading, image）のフォールバック
    if (section.type === 'text') {
      return `<textarea class="section-content" data-field="content" rows="3" placeholder="テキストを入力">${escapeHtml(section.content || '')}</textarea>`;
    } else if (section.type === 'heading') {
      return `<input type="text" class="section-content" data-field="content" placeholder="見出しテキスト" value="${escapeHtml(section.content || '')}">`;
    } else if (section.type === 'image') {
      return `<input type="url" class="section-content" data-field="content" placeholder="画像URL（https://...）" value="${escapeHtml(section.content || '')}">`;
    }
    return '';
  }

  return template.fields.map(field => {
    const value = section[field.key] || '';

    if (field.type === 'text') {
      return `
        <div class="section-field">
          <label class="section-field-label">${escapeHtml(field.label)}</label>
          <input type="text" class="section-field-input" data-field="${field.key}"
                 placeholder="${escapeHtml(field.placeholder || '')}"
                 value="${escapeHtml(value)}">
        </div>
      `;
    } else if (field.type === 'textarea') {
      return `
        <div class="section-field">
          <label class="section-field-label">${escapeHtml(field.label)}</label>
          <textarea class="section-field-input" data-field="${field.key}" rows="3"
                    placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(value)}</textarea>
        </div>
      `;
    } else if (field.type === 'image') {
      return `
        <div class="section-field">
          <label class="section-field-label">${escapeHtml(field.label)}</label>
          <div class="section-image-field">
            <input type="url" class="section-field-input section-image-url" data-field="${field.key}"
                   placeholder="画像URL（https://...）" value="${escapeHtml(value)}">
            <button type="button" class="btn-upload-section-image" data-field="${field.key}" data-index="${index}">アップロード</button>
          </div>
          ${value ? `<img src="${escapeHtml(value)}" class="section-image-preview" alt="">` : ''}
        </div>
      `;
    } else if (field.type === 'items') {
      const items = Array.isArray(value) ? value : [];
      const maxItems = field.maxItems || 4;
      return `
        <div class="section-field section-items-field" data-field="${field.key}" data-max-items="${maxItems}">
          <label class="section-field-label">${escapeHtml(field.label)}</label>
          <div class="section-items-list">
            ${items.map((item, itemIdx) => `
              <div class="section-item-entry" data-item-index="${itemIdx}">
                ${field.itemFields.map(itemField => `
                  <div class="section-item-field">
                    <label>${escapeHtml(itemField.label)}</label>
                    ${itemField.type === 'textarea'
                      ? `<textarea data-item-field="${itemField.key}" placeholder="${escapeHtml(itemField.placeholder || '')}">${escapeHtml(item[itemField.key] || '')}</textarea>`
                      : `<input type="text" data-item-field="${itemField.key}" placeholder="${escapeHtml(itemField.placeholder || '')}" value="${escapeHtml(item[itemField.key] || '')}">`
                    }
                  </div>
                `).join('')}
                <button type="button" class="btn-remove-item" data-item-index="${itemIdx}">削除</button>
              </div>
            `).join('')}
          </div>
          ${items.length < maxItems ? `<button type="button" class="btn-add-item">+ 項目を追加</button>` : ''}
        </div>
      `;
    } else if (field.type === 'gallery') {
      const images = Array.isArray(value) ? value : [];
      const maxImages = field.maxImages || 6;
      return `
        <div class="section-field section-gallery-field" data-field="${field.key}" data-max-images="${maxImages}">
          <label class="section-field-label">${escapeHtml(field.label)}</label>
          ${images.length > 0 ? `
            <div class="section-gallery-grid">
              ${images.map((img, imgIdx) => `
                <div class="section-gallery-item" data-image-index="${imgIdx}">
                  <img src="${escapeHtml(img)}" alt="">
                  <button type="button" class="btn-remove-gallery-image" data-image-index="${imgIdx}">✕</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${images.length < maxImages ? `
            <button type="button" class="btn-add-gallery-image" data-index="${index}" data-field="${field.key}">
              <span class="gallery-add-icon">📷</span>
              <span class="gallery-add-text">画像をアップロード</span>
            </button>
          ` : ''}
        </div>
      `;
    }
    return '';
  }).join('');
}

/**
 * カスタムセクションをレンダリング
 */
export function renderCustomSections(sections) {
  const container = document.getElementById('recruit-custom-sections');
  if (!container) return;

  container.innerHTML = (sections || []).map((section, index) => {
    const template = sectionTemplates.find(t => t.id === section.type);
    const typeLabel = template ? `${template.name}（${template.label}）` : section.type;

    return `
      <div class="custom-section-item" data-index="${index}" data-type="${section.type}">
        <div class="section-item-header">
          <span class="section-type-badge ${template ? 'template-badge' : ''}">${escapeHtml(typeLabel)}</span>
          <div class="section-item-actions">
            <button type="button" class="btn-move-section" data-direction="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn-move-section" data-direction="down" data-index="${index}" ${index === sections.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn-remove-section" data-index="${index}">✕</button>
          </div>
        </div>
        <div class="section-item-content">
          ${renderSectionFields(template, section, index)}
        </div>
      </div>
    `;
  }).join('');

  // イベントリスナーをバインド
  bindCustomSectionEvents(container);

  // セクション管理リストを更新（現在の順序を保持しながら）
  updateSectionManagementList();

  // プレビューを更新
  updateLivePreview();
}

/**
 * セクション管理リストを更新（現在の順序を保持）
 */
function updateSectionManagementList() {
  const container = document.getElementById('recruit-sections-list');
  if (!container) return;

  // 現在の順序と表示状態を保存
  const currentOrder = getRecruitSectionOrder();
  const currentVisibility = getRecruitSectionVisibility();

  // リストを再レンダリング
  renderRecruitSectionsList();

  // 順序を復元（新しいカスタムセクションは末尾に追加される）
  const newOrder = getRecruitSectionOrder();
  const mergedOrder = [];
  const addedSections = new Set();

  // 既存の順序に従って並べ直す
  currentOrder.forEach(sectionId => {
    if (newOrder.includes(sectionId)) {
      mergedOrder.push(sectionId);
      addedSections.add(sectionId);
    }
  });

  // 新しいセクションを末尾に追加
  newOrder.forEach(sectionId => {
    if (!addedSections.has(sectionId)) {
      mergedOrder.push(sectionId);
    }
  });

  // 順序を適用
  applySectionOrder(mergedOrder.join(','));

  // 表示状態を復元
  Object.keys(currentVisibility).forEach(sectionId => {
    const checkbox = document.getElementById(`recruit-section-${sectionId}-visible`);
    if (checkbox && typeof currentVisibility[sectionId] === 'boolean') {
      checkbox.checked = currentVisibility[sectionId];
    }
  });
}

/**
 * カスタムセクションのイベントリスナーをバインド
 */
function bindCustomSectionEvents(container) {
  // 削除ボタン
  container.querySelectorAll('.btn-remove-section').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const currentSections = getCustomSections();
      currentSections.splice(idx, 1);
      renderCustomSections(currentSections);
    });
  });

  // 移動ボタン
  container.querySelectorAll('.btn-move-section').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const direction = btn.dataset.direction;
      const currentSections = getCustomSections();

      if (direction === 'up' && idx > 0) {
        [currentSections[idx - 1], currentSections[idx]] = [currentSections[idx], currentSections[idx - 1]];
      } else if (direction === 'down' && idx < currentSections.length - 1) {
        [currentSections[idx], currentSections[idx + 1]] = [currentSections[idx + 1], currentSections[idx]];
      }

      renderCustomSections(currentSections);
    });
  });

  // 画像アップロードボタン
  container.querySelectorAll('.btn-upload-section-image').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const file = await selectImageFile();
        if (file) {
          const url = await uploadRecruitLogo(file);
          const input = btn.parentElement.querySelector('.section-image-url');
          if (input) {
            input.value = url;
            // プレビュー更新
            let preview = btn.parentElement.parentElement.querySelector('.section-image-preview');
            if (!preview) {
              preview = document.createElement('img');
              preview.className = 'section-image-preview';
              btn.parentElement.parentElement.appendChild(preview);
            }
            preview.src = url;
          }
        }
      } catch (error) {
        showToast('画像のアップロードに失敗しました', 'error');
      }
    });
  });

  // 項目追加ボタン（business用）
  container.querySelectorAll('.btn-add-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionItem = btn.closest('.custom-section-item');
      const sectionIndex = parseInt(sectionItem.dataset.index, 10);
      const itemsField = btn.closest('.section-items-field');
      const fieldName = itemsField.dataset.field;
      const maxItems = parseInt(itemsField.dataset.maxItems, 10) || 4;

      const currentSections = getCustomSections();
      if (currentSections[sectionIndex]) {
        if (!Array.isArray(currentSections[sectionIndex][fieldName])) {
          currentSections[sectionIndex][fieldName] = [];
        }
        if (currentSections[sectionIndex][fieldName].length < maxItems) {
          currentSections[sectionIndex][fieldName].push({});
          renderCustomSections(currentSections);
        }
      }
    });
  });

  // 項目削除ボタン
  container.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemIndex = parseInt(btn.dataset.itemIndex, 10);
      const sectionItem = btn.closest('.custom-section-item');
      const sectionIndex = parseInt(sectionItem.dataset.index, 10);
      const currentSections = getCustomSections();
      if (currentSections[sectionIndex] && Array.isArray(currentSections[sectionIndex].items)) {
        currentSections[sectionIndex].items.splice(itemIndex, 1);
        renderCustomSections(currentSections);
      }
    });
  });

  // ギャラリー画像追加ボタン
  container.querySelectorAll('.btn-add-gallery-image').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index, 10);
      const field = btn.dataset.field;
      try {
        const file = await selectImageFile();
        if (file) {
          const url = await uploadRecruitLogo(file);
          const currentSections = getCustomSections();
          if (!currentSections[index][field]) {
            currentSections[index][field] = [];
          }
          currentSections[index][field].push(url);
          renderCustomSections(currentSections);
        }
      } catch (error) {
        showToast('画像のアップロードに失敗しました', 'error');
      }
    });
  });

  // ギャラリー画像削除ボタン
  container.querySelectorAll('.btn-remove-gallery-image').forEach(btn => {
    btn.addEventListener('click', () => {
      const imageIndex = parseInt(btn.dataset.imageIndex, 10);
      const sectionItem = btn.closest('.custom-section-item');
      const sectionIndex = parseInt(sectionItem.dataset.index, 10);
      const galleryField = btn.closest('.section-gallery-field');
      const fieldName = galleryField.dataset.field;

      const currentSections = getCustomSections();
      if (currentSections[sectionIndex] && Array.isArray(currentSections[sectionIndex][fieldName])) {
        currentSections[sectionIndex][fieldName].splice(imageIndex, 1);
        renderCustomSections(currentSections);
      }
    });
  });
}

/**
 * カスタムセクションを取得
 */
export function getCustomSections() {
  const container = document.getElementById('recruit-custom-sections');
  if (!container) return [];

  const sections = [];
  container.querySelectorAll('.custom-section-item').forEach(item => {
    const type = item.dataset.type;
    const template = sectionTemplates.find(t => t.id === type);

    if (template && template.fields) {
      // テンプレート型セクション
      const section = { type };
      template.fields.forEach(field => {
        if (field.type === 'items') {
          // 項目配列
          const items = [];
          item.querySelectorAll('.section-item-entry').forEach(entry => {
            const itemData = {};
            field.itemFields.forEach(itemField => {
              const input = entry.querySelector(`[data-item-field="${itemField.key}"]`);
              if (input) {
                itemData[itemField.key] = input.value || '';
              }
            });
            items.push(itemData);
          });
          section[field.key] = items;
        } else if (field.type === 'gallery') {
          // ギャラリー画像配列
          const images = [];
          item.querySelectorAll('.section-gallery-item img').forEach(img => {
            if (img.src) images.push(img.src);
          });
          section[field.key] = images;
        } else {
          // 通常フィールド
          const input = item.querySelector(`[data-field="${field.key}"]`);
          if (input) {
            section[field.key] = input.value || '';
          }
        }
      });
      sections.push(section);
    } else {
      // 旧形式（text, heading, image）
      const content = item.querySelector('.section-content')?.value ||
                     item.querySelector('[data-field="content"]')?.value || '';
      sections.push({ type, content });
    }
  });
  return sections;
}

/**
 * カスタムセクションを追加（テンプレート対応）
 */
export function addCustomSection(templateId) {
  const template = sectionTemplates.find(t => t.id === templateId);
  const currentSections = getCustomSections();

  if (template) {
    // テンプレートからデフォルト値を設定
    const newSection = { type: templateId };
    template.fields.forEach(field => {
      if (field.type === 'items') {
        newSection[field.key] = [{}]; // 空の項目を1つ
      } else if (field.type === 'gallery') {
        newSection[field.key] = [];
      } else {
        newSection[field.key] = '';
      }
    });
    currentSections.push(newSection);
  } else {
    // 旧形式
    currentSections.push({ type: templateId, content: '' });
  }

  renderCustomSections(currentSections);
}

/**
 * テンプレート選択モーダルを表示
 */
export function showTemplateSelectorModal() {
  // 既存のモーダルがあれば削除
  const existingModal = document.getElementById('template-selector-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div id="template-selector-modal" class="template-modal-overlay">
      <div class="template-modal">
        <div class="template-modal-header">
          <h3>コンテンツを追加する</h3>
          <button type="button" class="template-modal-close">&times;</button>
        </div>
        <div class="template-modal-body">
          <p class="template-modal-description">追加するコンテンツを選択してください。</p>
          <div class="template-list">
            ${sectionTemplates.map(template => `
              <div class="template-item" data-template-id="${template.id}">
                <div class="template-thumbnail">
                  <img src='${template.thumbnail}' alt="${escapeHtml(template.name)}">
                </div>
                <div class="template-info">
                  <h4 class="template-name">${escapeHtml(template.name)}（${escapeHtml(template.label)}）</h4>
                  <p class="template-description">${escapeHtml(template.description)}</p>
                </div>
                <button type="button" class="btn-add-template" data-template-id="${template.id}">追加する</button>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="template-modal-footer">
          <button type="button" class="btn-template-cancel">キャンセル</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('template-selector-modal');

  // 閉じるボタン
  modal.querySelector('.template-modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // キャンセルボタン
  modal.querySelector('.btn-template-cancel').addEventListener('click', () => {
    modal.remove();
  });

  // オーバーレイクリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // テンプレート追加ボタン
  modal.querySelectorAll('.btn-add-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateId = btn.dataset.templateId;
      addCustomSection(templateId);
      modal.remove();
    });
  });
}

export default {
  loadRecruitSettings,
  saveRecruitSettings,
  populateForm,
  populateFormWithDefaults,
  getFormValues,
  setInputValue,
  setSelectValue,
  setLayoutStyle,
  getLayoutStyle,
  setCustomColors,
  resetCustomColors,
  setupColorPickers,
  truncateText,
  setSaveButtonLoading,
  handleSave,
  handleReset,
  updatePreviewLink,
  heroImagePresets,
  renderHeroImagePresets,
  selectHeroImagePreset,
  updateHeroImagePresetSelection,
  updateLogoPreview,
  setupLogoUpload,
  updateHeroPreview,
  setupHeroUpload,
  setupLivePreview,
  updateLivePreview,
  applyPreviewColorTheme,
  // 求人プレビュー
  setPreviewJobs,
  // セクション管理
  RECRUIT_SECTIONS,
  getRecruitSectionOrder,
  getRecruitSectionVisibility,
  applySectionOrder,
  applySectionVisibility,
  renderRecruitSectionsList,
  setupRecruitSectionDragDrop,
  initVideoButtonSection,
  // カスタムリンク
  renderCustomLinks,
  getCustomLinks,
  addCustomLink,
  // カスタムセクション
  sectionTemplates,
  renderCustomSections,
  getCustomSections,
  addCustomSection,
  showTemplateSelectorModal
};
