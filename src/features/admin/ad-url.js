/**
 * 広告URL発行モジュール
 * 求人LPのUTMパラメーター付きURLを生成
 */

import { showToast } from '@shared/utils.js';

// チャンネル定義（ad-costs.jsと共通）
const CHANNELS = {
  google: { name: 'Google Ads', icon: '🔵', color: '#4285f4' },
  tiktok: { name: 'TikTok Ads', icon: '🎵', color: '#000000' },
  x: { name: 'X (Twitter) Ads', icon: '✖️', color: '#1da1f2' },
  meta: { name: 'Meta Ads', icon: '🔷', color: '#1877f2' },
  yahoo: { name: 'Yahoo! Ads', icon: '🟣', color: '#720e9e' },
  line: { name: 'LINE Ads', icon: '🟢', color: '#06c755' }
};

// 優先表示チャンネル（上位に表示）
const PRIORITY_CHANNELS = ['google', 'tiktok', 'x'];

// 動的マクロ定義（プラットフォーム別）
const DYNAMIC_MACROS = {
  google: {
    campaign: '{campaignid}',
    adgroup: '{adgroupid}',
    creative: '{creative}',
    keyword: '{keyword}'
  },
  tiktok: {
    campaign: '__CAMPAIGN_NAME__',
    adgroup: '__AID__',
    creative: '__CID__'
  },
  x: {
    campaign: '{campaign_name}',
    adgroup: '{line_item_name}'
  }
};

// Firestore参照
let firebaseDb = null;
let companies = [];
let jobs = [];
let selectedCompany = null;
let selectedJob = null;
let selectedMedium = 'paid';

/**
 * セクション読み込み時に呼ばれる
 */
export async function initAdUrlSection() {
  // Firebase 初期化
  if (!firebaseDb && window.firebase && window.firebase.firestore) {
    firebaseDb = window.firebase.firestore();
  }

  // 会社リストを取得
  try {
    const companiesSnapshot = await firebaseDb.collection('companies').get();
    companies = companiesSnapshot.docs.map(doc => ({
      domain: doc.id,
      ...doc.data()
    })).sort((a, b) => (a.company || '').localeCompare(b.company || ''));
  } catch (error) {
    console.error('会社リストの取得に失敗:', error);
    companies = [];
  }

  setupEventListeners();
  renderCompanySelect();
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  const section = document.getElementById('section-ad-url');
  if (!section) return;

  // 会社選択
  const companySelect = section.querySelector('#ad-url-company-select');
  if (companySelect) {
    companySelect.addEventListener('change', async (e) => {
      selectedCompany = e.target.value;
      selectedJob = null;
      if (selectedCompany) {
        await loadJobsForCompany(selectedCompany);
      } else {
        jobs = [];
        renderJobSelect();
        hideUrlArea();
      }
    });
  }

  // 求人選択
  const jobSelect = section.querySelector('#ad-url-job-select');
  if (jobSelect) {
    jobSelect.addEventListener('change', (e) => {
      selectedJob = e.target.value;
      if (selectedJob) {
        renderUrlArea();
      } else {
        hideUrlArea();
      }
    });
  }

  // utm_medium選択
  const mediumSelect = section.querySelector('#ad-url-medium-select');
  if (mediumSelect) {
    mediumSelect.addEventListener('change', (e) => {
      selectedMedium = e.target.value;
      renderChannelUrls();
    });
  }
}

/**
 * 会社セレクトを描画
 */
function renderCompanySelect() {
  const select = document.getElementById('ad-url-company-select');
  if (!select) return;

  select.innerHTML = '<option value="">会社を選択...</option>';
  companies.forEach(company => {
    const option = document.createElement('option');
    option.value = company.domain;
    option.textContent = company.company || company.domain;
    select.appendChild(option);
  });
}

/**
 * 会社の求人を読み込む
 */
async function loadJobsForCompany(companyDomain) {
  const jobSelect = document.getElementById('ad-url-job-select');
  if (jobSelect) {
    jobSelect.disabled = true;
    jobSelect.innerHTML = '<option value="">読み込み中...</option>';
  }

  try {
    const jobsSnapshot = await firebaseDb
      .collection('companies')
      .doc(companyDomain)
      .collection('jobs')
      .get();

    jobs = jobsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).filter(job => job.status !== 'deleted');

    renderJobSelect();
  } catch (error) {
    console.error('求人の取得に失敗:', error);
    jobs = [];
    renderJobSelect();
  }
}

/**
 * 求人セレクトを描画
 */
function renderJobSelect() {
  const select = document.getElementById('ad-url-job-select');
  if (!select) return;

  select.disabled = jobs.length === 0;
  select.innerHTML = '<option value="">求人を選択...</option>';

  jobs.forEach(job => {
    const option = document.createElement('option');
    option.value = job.id;
    option.textContent = job.title || job.id;
    select.appendChild(option);
  });

  hideUrlArea();
}

/**
 * URL表示エリアを描画
 */
function renderUrlArea() {
  const lpInfo = document.getElementById('ad-url-lp-info');
  const channelsArea = document.getElementById('ad-url-channels');
  const emptyState = document.getElementById('ad-url-empty-state');

  if (lpInfo) lpInfo.style.display = 'block';
  if (channelsArea) channelsArea.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  // ベースURL表示
  const baseUrlEl = document.getElementById('ad-url-base-url');
  if (baseUrlEl) {
    const baseUrl = generateBaseUrl();
    baseUrlEl.textContent = baseUrl;
  }

  // コピーボタンイベント
  const copyBaseBtn = document.querySelector('[data-copy-target="base-url"]');
  if (copyBaseBtn) {
    copyBaseBtn.onclick = () => copyToClipboard(generateBaseUrl(), copyBaseBtn);
  }

  renderChannelUrls();
}

/**
 * URLエリアを非表示
 */
function hideUrlArea() {
  const lpInfo = document.getElementById('ad-url-lp-info');
  const channelsArea = document.getElementById('ad-url-channels');
  const emptyState = document.getElementById('ad-url-empty-state');

  if (lpInfo) lpInfo.style.display = 'none';
  if (channelsArea) channelsArea.style.display = 'none';
  if (emptyState) emptyState.style.display = 'block';
}

/**
 * ベースURLを生成
 */
function generateBaseUrl() {
  const origin = window.location.origin;
  return `${origin}/lp.html?id=${selectedJob}`;
}

/**
 * UTMパラメーター付きURLを生成
 */
function generateUtmUrl(channel, useMacro = false) {
  const baseUrl = generateBaseUrl();
  const params = new URLSearchParams();

  params.set('utm_source', channel);
  params.set('utm_medium', selectedMedium);

  // キャンペーン名
  if (useMacro && DYNAMIC_MACROS[channel]) {
    params.set('utm_campaign', DYNAMIC_MACROS[channel].campaign);
  } else {
    params.set('utm_campaign', `job_${selectedJob}`);
  }

  return `${baseUrl}&${params.toString()}`;
}

/**
 * チャンネル別URLを描画
 */
function renderChannelUrls() {
  const container = document.getElementById('ad-url-channel-list');
  if (!container) return;

  // 優先チャンネルを先に、その他を後に
  const sortedChannels = [
    ...PRIORITY_CHANNELS,
    ...Object.keys(CHANNELS).filter(c => !PRIORITY_CHANNELS.includes(c))
  ];

  container.innerHTML = sortedChannels.map(channelKey => {
    const channel = CHANNELS[channelKey];
    const simpleUrl = generateUtmUrl(channelKey, false);
    const hasMacro = !!DYNAMIC_MACROS[channelKey];
    const macroUrl = hasMacro ? generateUtmUrl(channelKey, true) : null;

    return `
      <div class="ad-url-channel-card" style="--channel-color: ${channel.color}">
        <div class="channel-header">
          <span class="channel-icon">${channel.icon}</span>
          <span class="channel-name">${channel.name}</span>
        </div>
        <div class="channel-url-box">
          <input type="text" class="channel-url-input" value="${simpleUrl}" readonly>
          <button type="button" class="btn-copy" data-url="${simpleUrl}">
            📋 コピー
          </button>
        </div>
        ${hasMacro ? `
          <div class="channel-advanced">
            <button type="button" class="channel-advanced-toggle" data-channel="${channelKey}">
              ▶ 詳細版（動的マクロ）
            </button>
            <div class="channel-advanced-content" id="advanced-${channelKey}">
              <div class="advanced-url-label">キャンペーン別追跡版</div>
              <div class="channel-url-box">
                <input type="text" class="channel-url-input" value="${macroUrl}" readonly>
                <button type="button" class="btn-copy" data-url="${macroUrl}">
                  📋 コピー
                </button>
              </div>
              <div class="advanced-url-note">
                ※ ${channelKey === 'google' ? '{campaignid}' : channelKey === 'tiktok' ? '__CAMPAIGN_NAME__' : '{campaign_name}'} はクリック時に自動で置換されます
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // コピーボタンイベント
  container.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      copyToClipboard(url, btn);
    });
  });

  // 詳細版トグル
  container.querySelectorAll('.channel-advanced-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const channel = toggle.dataset.channel;
      const content = document.getElementById(`advanced-${channel}`);
      if (content) {
        const isOpen = content.classList.contains('show');
        content.classList.toggle('show');
        toggle.textContent = isOpen ? `▶ 詳細版（動的マクロ）` : `▼ 詳細版（動的マクロ）`;
      }
    });
  });
}

/**
 * クリップボードにコピー
 */
async function copyToClipboard(text, buttonEl) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('URLをコピーしました', 'success');

    // ボタンの状態を一時的に変更
    if (buttonEl) {
      const originalText = buttonEl.innerHTML;
      buttonEl.classList.add('copied');
      buttonEl.innerHTML = '✓ コピー済';
      setTimeout(() => {
        buttonEl.classList.remove('copied');
        buttonEl.innerHTML = originalText;
      }, 2000);
    }
  } catch (error) {
    console.error('クリップボードへのコピーに失敗:', error);
    showToast('コピーに失敗しました', 'error');
  }
}

export default {
  initAdUrlSection,
  CHANNELS,
  PRIORITY_CHANNELS
};
