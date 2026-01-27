/**
 * FAQセクションコンポーネント
 * LINE風チャットUI
 */
import { escapeHtml } from '@shared/utils.js';

export function renderFAQSection(faqData) {
  if (!faqData) return '';

  // FAQ データをパース（形式: Q:質問|A:回答\nQ:質問2|A:回答2）
  const faqs = parseFAQData(faqData);
  if (faqs.length === 0) return '';

  return `
    <section class="lp-faq lp-faq-chat">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">よくある質問</h2>
        <div class="lp-faq-chat-container">
          ${faqs.map((faq, idx) => `
            <div class="lp-faq-chat-pair">
              <!-- 質問（左側・サポート） -->
              <div class="lp-faq-chat-row lp-faq-chat-question">
                <div class="lp-faq-chat-avatar lp-faq-chat-avatar-support">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>
                </div>
                <div class="lp-faq-chat-bubble lp-faq-chat-bubble-support">
                  <span class="lp-faq-chat-text">${escapeHtml(faq.question)}</span>
                </div>
              </div>
              <!-- 回答（右側・ユーザー） -->
              <div class="lp-faq-chat-row lp-faq-chat-answer">
                <div class="lp-faq-chat-bubble lp-faq-chat-bubble-user">
                  <span class="lp-faq-chat-text">${escapeHtml(faq.answer)}</span>
                </div>
                <div class="lp-faq-chat-avatar lp-faq-chat-avatar-user">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
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
    // リテラルな\nを実際の改行に変換してから分割
    const normalizedString = faqData.replace(/\\n/g, '\n');
    // || または改行で分割して各QAペアを処理
    const lines = normalizedString.split(/\|\||[\n\r]+/).filter(line => line.trim());

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
