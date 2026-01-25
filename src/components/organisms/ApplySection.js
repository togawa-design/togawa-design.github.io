/**
 * 応募セクションコンポーネント
 */
import { escapeHtml } from '@shared/utils.js';

export function renderApplySection(company, lpSettings) {
  const ctaText = lpSettings.ctaText || 'この求人に応募する';
  const phoneNumber = company.phoneNumber || '0120-000-000';

  return `
    <section class="lp-apply" id="lp-apply">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">応募する</h2>
        <div class="lp-apply-content">
          <p class="lp-apply-lead">ご応募・お問い合わせはお気軽にどうぞ</p>

          <div class="lp-apply-methods">
            <div class="lp-apply-method lp-apply-web">
              <h3>WEBで応募</h3>
              <p>24時間受付中</p>
              <a href="#" class="lp-btn-apply-main lp-editable" data-field="ctaText" data-label="CTAテキスト">${escapeHtml(ctaText)}</a>
            </div>

            <div class="lp-apply-divider">
              <span>または</span>
            </div>

            <div class="lp-apply-method lp-apply-tel">
              <h3>電話で応募</h3>
              <p>受付時間 9:00〜18:00（土日祝除く）</p>
              <a href="tel:${escapeHtml(phoneNumber.replace(/-/g, ''))}" class="lp-btn-tel-main">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                ${escapeHtml(phoneNumber)}
              </a>
            </div>
          </div>

          <p class="lp-apply-note">※ 面接は随時実施しております。お気軽にお問い合わせください。</p>
        </div>
      </div>
    </section>
  `;
}

export default renderApplySection;
