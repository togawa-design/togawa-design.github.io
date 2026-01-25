/**
 * FAQセクションコンポーネント
 */
import { escapeHtml } from '@shared/utils.js';

export function renderFAQSection(faqData) {
  if (!faqData) return '';

  // FAQ データをパース（形式: Q:質問|A:回答\nQ:質問2|A:回答2）
  const faqs = parseFAQData(faqData);
  if (faqs.length === 0) return '';

  return `
    <section class="lp-faq">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">よくある質問</h2>
        <div class="lp-faq-list">
          ${faqs.map((faq, idx) => `
            <div class="lp-faq-item">
              <button class="lp-faq-question" aria-expanded="false" aria-controls="faq-answer-${idx}">
                <span class="lp-faq-q">Q</span>
                <span class="lp-faq-q-text">${escapeHtml(faq.question)}</span>
                <span class="lp-faq-toggle">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                </span>
              </button>
              <div class="lp-faq-answer" id="faq-answer-${idx}">
                <span class="lp-faq-a">A</span>
                <span class="lp-faq-a-text">${escapeHtml(faq.answer)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

function parseFAQData(faqData) {
  const faqs = [];

  if (typeof faqData === 'string') {
    // 改行で分割して各QAペアを処理
    const lines = faqData.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Q:質問|A:回答 形式
      const match = line.match(/Q[:：](.+?)\|A[:：](.+)/i);
      if (match) {
        faqs.push({
          question: match[1].trim(),
          answer: match[2].trim()
        });
      }
    }
  } else if (Array.isArray(faqData)) {
    // 配列形式の場合
    faqData.forEach(item => {
      if (item.question && item.answer) {
        faqs.push(item);
      }
    });
  }

  return faqs;
}

export default renderFAQSection;
