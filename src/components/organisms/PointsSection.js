/**
 * ポイントセクションコンポーネント
 * レイアウトスタイルに応じて異なるHTMLを出力
 */
import { escapeHtml } from '@shared/utils.js';

export function renderPointsSection(company, mainJob, lpSettings, layoutStyle = 'modern') {
  const points = [];

  // LP設定からポイントを取得
  if (lpSettings.pointTitle1) {
    points.push({ title: lpSettings.pointTitle1, desc: lpSettings.pointDesc1 || '', idx: 1 });
  }
  if (lpSettings.pointTitle2) {
    points.push({ title: lpSettings.pointTitle2, desc: lpSettings.pointDesc2 || '', idx: 2 });
  }
  if (lpSettings.pointTitle3) {
    points.push({ title: lpSettings.pointTitle3, desc: lpSettings.pointDesc3 || '', idx: 3 });
  }

  // ポイントがない場合はデフォルトを生成
  if (points.length === 0) {
    if (mainJob.totalBonus) {
      points.push({ title: '入社特典', desc: `特典総額${mainJob.totalBonus}！入社祝い金やその他特典が充実。`, idx: 1 });
    }
    if (mainJob.monthlySalary) {
      points.push({ title: '高収入', desc: `月収例${mainJob.monthlySalary}可能！安定した収入を実現。`, idx: 2 });
    }
    if (mainJob.benefits) {
      points.push({ title: '充実の待遇', desc: '社会保険完備、寮完備など福利厚生が充実。', idx: 3 });
    }
  }

  if (points.length === 0) return '';

  // レイアウトスタイルに応じたレンダリング
  switch (layoutStyle) {
    case 'yellow':
      return renderYellowPoints(points);
    case 'impact':
      return renderImpactPoints(points);
    case 'trust':
      return renderTrustPoints(points);
    case 'athome':
      return renderAthomePoints(points);
    case 'local':
      return renderLocalPoints(points);
    default:
      return renderDefaultPoints(points);
  }
}

// デフォルトポイント
function renderDefaultPoints(points) {
  return `
    <section class="lp-points">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">この求人のポイント</h2>
        <div class="lp-points-grid">
          ${points.map((point, displayIdx) => `
            <div class="lp-point-card">
              <div class="lp-point-number">${displayIdx + 1}</div>
              <h3 class="lp-point-title lp-editable" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc lp-editable" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// イエロー: カードに下ボーダー、番号付き (01., 02., 03.)
function renderYellowPoints(points) {
  return `
    <section class="lp-points lp-points--yellow">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">働く魅力ポイント</h2>
        <div class="lp-points-grid">
          ${points.map((point, displayIdx) => `
            <div class="lp-point-card">
              <h3 class="lp-point-title lp-editable" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">
                <span class="lp-point-number">${String(displayIdx + 1).padStart(2, '0')}.</span>
                ${escapeHtml(point.title)}
              </h3>
              <p class="lp-point-desc lp-editable" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// インパクト: ダークボックス、左ボーダー、ホバーエフェクト
function renderImpactPoints(points) {
  return `
    <section class="lp-points lp-points--impact">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">WHY JOIN US?</h2>
        <div class="lp-points-list">
          ${points.map((point) => `
            <div class="lp-point-box">
              <h3 class="lp-point-title lp-editable" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc lp-editable" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// 信頼: トップボーダー、番号付きグリッド
function renderTrustPoints(points) {
  return `
    <section class="lp-points lp-points--trust">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">加わる価値</h2>
        <div class="lp-points-grid">
          ${points.map((point, displayIdx) => `
            <div class="lp-point-item">
              <span class="lp-point-number">${String(displayIdx + 1).padStart(2, '0')}</span>
              <h3 class="lp-point-title lp-editable" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc lp-editable" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// アットホーム: 吹き出し風カード、星アイコン
function renderAthomePoints(points) {
  return `
    <section class="lp-points lp-points--athome">
      <div class="lp-section-inner">
        <div class="lp-points-grid">
          ${points.map((point) => `
            <div class="lp-point-card">
              <h3 class="lp-point-title lp-editable" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc lp-editable" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// 地域密着: アクセントボーダー、和風モダン
function renderLocalPoints(points) {
  return `
    <section class="lp-points lp-points--local">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">
          <span class="lp-section-title-label">OUR VALUES</span>
          私たちが大切にしていること
        </h2>
        <div class="lp-points-grid">
          ${points.map((point) => `
            <div class="lp-point-box">
              <h3 class="lp-point-title lp-editable" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc lp-editable" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

export default renderPointsSection;
