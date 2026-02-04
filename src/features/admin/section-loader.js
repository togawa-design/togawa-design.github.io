/**
 * Admin Section Loader
 * HTMLセクションを動的に読み込み・キャッシュするモジュール
 */

// セクションHTMLのキャッシュ
const sectionCache = new Map();

// 読み込み中のPromiseを管理（重複リクエスト防止）
const loadingPromises = new Map();

// ベースパス（Viteのbase設定に対応）
const BASE_PATH = import.meta.env.BASE_URL || '/';

/**
 * セクションHTMLを読み込む
 * @param {string} sectionName - セクション名（例: 'overview', 'job-manage'）
 * @returns {Promise<string>} セクションのHTML文字列
 */
export async function loadSectionHTML(sectionName) {
  // キャッシュにあればそれを返す
  if (sectionCache.has(sectionName)) {
    return sectionCache.get(sectionName);
  }

  // 読み込み中なら既存のPromiseを返す
  if (loadingPromises.has(sectionName)) {
    return loadingPromises.get(sectionName);
  }

  // 新規読み込み
  const loadPromise = fetchSectionHTML(sectionName);
  loadingPromises.set(sectionName, loadPromise);

  try {
    const html = await loadPromise;
    sectionCache.set(sectionName, html);
    return html;
  } finally {
    loadingPromises.delete(sectionName);
  }
}

/**
 * セクションHTMLをfetchする
 * @param {string} sectionName
 * @returns {Promise<string>}
 */
async function fetchSectionHTML(sectionName) {
  const url = `${BASE_PATH}admin/sections/${sectionName}.html`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load section: ${sectionName} (${response.status})`);
    }

    return await response.text();
  } catch (error) {
    console.error(`[SectionLoader] Error loading ${sectionName}:`, error);
    return `<div class="section-error">セクションの読み込みに失敗しました: ${sectionName}</div>`;
  }
}

/**
 * セクションをDOMに挿入する
 * @param {string} sectionName - セクション名
 * @param {HTMLElement} container - 挿入先のコンテナ要素
 * @returns {Promise<HTMLElement|null>} 挿入されたセクション要素
 */
export async function insertSection(sectionName, container) {
  const html = await loadSectionHTML(sectionName);

  // 一時的なコンテナでパース
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const section = temp.firstElementChild;
  if (section) {
    container.appendChild(section);
    return section;
  }

  return null;
}

/**
 * セクションが読み込み済みかチェック
 * @param {string} sectionName
 * @returns {boolean}
 */
export function isSectionLoaded(sectionName) {
  return sectionCache.has(sectionName);
}

/**
 * 特定のセクションのキャッシュをクリア
 * @param {string} sectionName
 */
export function clearSectionCache(sectionName) {
  sectionCache.delete(sectionName);
}

/**
 * 全キャッシュをクリア
 */
export function clearAllCache() {
  sectionCache.clear();
}

/**
 * 複数セクションを事前読み込み（プリロード）
 * @param {string[]} sectionNames
 */
export async function preloadSections(sectionNames) {
  await Promise.all(sectionNames.map(name => loadSectionHTML(name)));
}

/**
 * インラインセクション（admin.html内に既存）かどうかを判定
 * 段階的移行のため、まだ分離していないセクションはインラインとして扱う
 */
const inlineSections = new Set([
  // すべて外部ファイルに移行済み
]);

/**
 * セクションがインライン（HTML内に存在）かどうか
 * @param {string} sectionName
 * @returns {boolean}
 */
export function isInlineSection(sectionName) {
  return inlineSections.has(sectionName);
}

/**
 * セクションを外部ファイルに移行済みとしてマーク
 * @param {string} sectionName
 */
export function markAsExternal(sectionName) {
  inlineSections.delete(sectionName);
}

export default {
  loadSectionHTML,
  insertSection,
  isSectionLoaded,
  clearSectionCache,
  clearAllCache,
  preloadSections,
  isInlineSection,
  markAsExternal
};
