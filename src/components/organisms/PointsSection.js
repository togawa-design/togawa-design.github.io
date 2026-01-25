/**
 * ポイントセクションコンポーネント
 */
import { escapeHtml } from '@shared/utils.js';

export function renderPointsSection(company, mainJob, lpSettings) {
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

export default renderPointsSection;
