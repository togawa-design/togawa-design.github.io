/**
 * ポイントセクションコンポーネント
 * レイアウトスタイルに応じて異なるHTMLを出力
 * カスタムレイアウト設定に対応
 */
import { escapeHtml } from '@shared/utils.js';

// デフォルトのレイアウト設定
const DEFAULT_LAYOUT = {
  direction: 'vertical',
  columns: 3,
  gap: 24,
  padding: 32,
  cardBorderRadius: 16,
  cardBackgroundColor: '#ffffff',
  cardBorderWidth: 1,
  cardBorderColor: '#e5e7eb',
  cardShadow: 'md',
  sectionTitleSize: 'lg',
  titleColor: '#1f2937',
  titleSize: 'md',
  descSize: 'sm',
  titleAlign: 'left',
  accentColor: '#6366f1'
};

// 影のスタイルマップ
const SHADOW_MAP = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'
};

// セクションタイトルサイズマップ
const SECTION_TITLE_SIZE_MAP = {
  sm: '1.25rem',
  md: '1.5rem',
  lg: '1.875rem',
  xl: '2.25rem'
};

// カードタイトルサイズマップ
const TITLE_SIZE_MAP = {
  sm: '0.875rem',
  md: '1rem',
  lg: '1.25rem',
  xl: '1.5rem'
};

// 説明文サイズマップ
const DESC_SIZE_MAP = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem'
};

export function renderPointsSection(company, mainJob, lpSettings, layoutStyle = 'modern', customLayout = null) {
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

  // カスタムレイアウトがある場合はカスタムレンダリング
  if (customLayout && Object.keys(customLayout).length > 0) {
    return renderCustomPoints(points, customLayout, lpSettings.sectionTitle || 'この求人のポイント');
  }

  // レイアウトスタイルに応じたレンダリング（従来の方式）
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

/**
 * カスタムレイアウトでポイントをレンダリング
 */
function renderCustomPoints(points, customLayout, sectionTitle) {
  const layout = { ...DEFAULT_LAYOUT, ...customLayout };

  // コンテナスタイル
  const containerStyle = `
    padding: ${layout.padding}px;
  `.trim();

  // グリッドスタイル
  const isHorizontal = layout.direction === 'horizontal';
  const gridStyle = isHorizontal
    ? `
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: ${layout.gap}px;
      overflow-x: auto;
    `
    : `
      display: grid;
      grid-template-columns: repeat(${layout.columns}, 1fr);
      gap: ${layout.gap}px;
    `;

  // カードスタイル
  const shadow = SHADOW_MAP[layout.cardShadow] || SHADOW_MAP.md;
  const cardStyle = `
    background-color: ${layout.cardBackgroundColor};
    border-radius: ${layout.cardBorderRadius}px;
    border: ${layout.cardBorderWidth}px solid ${layout.cardBorderColor};
    box-shadow: ${shadow};
    padding: 24px;
    ${isHorizontal ? 'flex: 0 0 280px; min-width: 280px;' : ''}
  `.trim();

  // カードタイトルスタイル
  const titleFontSize = TITLE_SIZE_MAP[layout.titleSize] || TITLE_SIZE_MAP.md;
  const titleStyle = `
    color: ${layout.titleColor};
    font-size: ${titleFontSize};
    font-weight: 700;
    text-align: ${layout.titleAlign};
    margin-bottom: 8px;
    white-space: nowrap;
  `.trim();

  // 説明文スタイル
  const descFontSize = DESC_SIZE_MAP[layout.descSize] || DESC_SIZE_MAP.sm;
  const descStyle = `
    font-size: ${descFontSize};
    line-height: 1.6;
  `.trim();

  // 番号スタイル
  const numberStyle = `
    background-color: ${layout.accentColor};
    color: #ffffff;
  `.trim();

  // セクションタイトルスタイル
  const sectionTitleFontSize = SECTION_TITLE_SIZE_MAP[layout.sectionTitleSize] || SECTION_TITLE_SIZE_MAP.lg;
  const sectionTitleStyle = `
    text-align: ${layout.titleAlign};
    font-size: ${sectionTitleFontSize};
  `.trim();

  return `
    <section class="lp-points lp-points--custom" data-section-type="points">
      <div class="lp-section-inner" style="${escapeHtml(containerStyle)}">
        <h2 class="lp-section-title" style="${escapeHtml(sectionTitleStyle)}">${escapeHtml(sectionTitle)}</h2>
        <div class="lp-points-grid lp-points-grid--custom" style="${escapeHtml(gridStyle)}">
          ${points.map((point, displayIdx) => `
            <div class="lp-point-card lp-point-card--custom" style="${escapeHtml(cardStyle)}">
              <div class="lp-point-number" style="${escapeHtml(numberStyle)}">${displayIdx + 1}</div>
              <h3 class="lp-point-title lp-editable" style="${escapeHtml(titleStyle)}" data-field="pointTitle${point.idx}" data-label="ポイント${point.idx}タイトル">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc lp-editable" style="${escapeHtml(descStyle)}" data-field="pointDesc${point.idx}" data-label="ポイント${point.idx}説明">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// デフォルトポイント
function renderDefaultPoints(points) {
  return `
    <section class="lp-points" data-section-type="points">
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
    <section class="lp-points lp-points--yellow" data-section-type="points">
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
    <section class="lp-points lp-points--impact" data-section-type="points">
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
    <section class="lp-points lp-points--trust" data-section-type="points">
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
    <section class="lp-points lp-points--athome" data-section-type="points">
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
    <section class="lp-points lp-points--local" data-section-type="points">
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
