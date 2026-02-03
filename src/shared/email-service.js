/**
 * メールサービス（フロントエンド用）
 * Cloud Functionsのメール送受信APIを呼び出すサービスクラス
 *
 * 使用方法:
 * import EmailService from '@shared/email-service.js';
 *
 * // 初期化（Firebase Auth必須）
 * await EmailService.init();
 *
 * // メール送信
 * await EmailService.sendEmail({
 *   companyDomain: 'example',
 *   applicationId: 'app123',
 *   to: 'applicant@example.com',
 *   subject: '選考のご案内',
 *   bodyText: 'メール本文...'
 * });
 *
 * // メール一覧取得
 * const emails = await EmailService.getEmails('example', 'app123');
 */

// Cloud Functions エンドポイント
const FUNCTIONS_BASE_URL = 'https://asia-northeast1-generated-area-484613-e3-90bd4.cloudfunctions.net';

/**
 * メールサービスクラス
 */
class EmailServiceClass {
  constructor() {
    this.initialized = false;
    this.auth = null;
  }

  /**
   * 初期化
   * @param {object} firebaseAuth - Firebase Authインスタンス（省略時はwindow.firebaseから取得）
   */
  async init(firebaseAuth = null) {
    if (this.initialized) return;

    // Firebase Authを取得
    this.auth = firebaseAuth || window.firebase?.auth?.();

    if (!this.auth) {
      console.warn('[EmailService] Firebase Auth not available');
    }

    this.initialized = true;
  }

  /**
   * 認証トークンを取得
   */
  async getAuthToken() {
    if (!this.auth) {
      throw new Error('Firebase Auth not initialized');
    }

    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    return await user.getIdToken();
  }

  /**
   * APIリクエストを送信
   */
  async apiRequest(endpoint, method = 'GET', body = null) {
    const token = await this.getAuthToken();

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const url = method === 'GET' && body
      ? `${FUNCTIONS_BASE_URL}/${endpoint}?${new URLSearchParams(body)}`
      : `${FUNCTIONS_BASE_URL}/${endpoint}`;

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  /**
   * メール送信
   * @param {object} params - 送信パラメータ
   * @param {string} params.companyDomain - 会社ドメイン
   * @param {string} params.applicationId - 応募ID
   * @param {string} params.to - 送信先メールアドレス
   * @param {string} params.subject - 件名
   * @param {string} params.bodyText - 本文（テキスト）
   * @param {string} [params.bodyHtml] - 本文（HTML、省略時はテキストを変換）
   * @returns {Promise<{emailId: string}>}
   */
  async sendEmail({ companyDomain, applicationId, to, subject, bodyText, bodyHtml }) {
    if (!companyDomain || !applicationId || !to || !subject || !bodyText) {
      throw new Error('Missing required fields');
    }

    return await this.apiRequest('sendEmail', 'POST', {
      companyDomain,
      applicationId,
      to,
      subject,
      bodyText,
      bodyHtml
    });
  }

  /**
   * メール一覧取得
   * @param {string} companyDomain - 会社ドメイン
   * @param {string} [applicationId] - 応募ID（省略時は全メール）
   * @param {number} [limit=50] - 取得件数
   * @returns {Promise<{emails: Array}>}
   */
  async getEmails(companyDomain, applicationId = null, limit = 50) {
    if (!companyDomain) {
      throw new Error('companyDomain is required');
    }

    const params = { companyDomain, limit: String(limit) };
    if (applicationId) {
      params.applicationId = applicationId;
    }

    return await this.apiRequest('getEmails', 'GET', params);
  }

  /**
   * 応募者とのメールスレッドを取得
   * @param {string} companyDomain - 会社ドメイン
   * @param {string} applicationId - 応募ID
   * @returns {Promise<Array>} - メールの配列（時系列順）
   */
  async getEmailThread(companyDomain, applicationId) {
    const result = await this.getEmails(companyDomain, applicationId);
    return result.emails || [];
  }

  /**
   * 未読メール数を取得
   * @param {string} companyDomain - 会社ドメイン
   * @returns {Promise<number>}
   */
  async getUnreadCount(companyDomain) {
    // TODO: 専用のエンドポイントを作成するか、クライアント側でフィルター
    const result = await this.getEmails(companyDomain, null, 100);
    const unread = (result.emails || []).filter(e =>
      e.direction === 'inbound' && !e.readByCompany
    );
    return unread.length;
  }

  /**
   * メールを既読にする
   * @param {string} emailId - メールID
   * @returns {Promise<void>}
   */
  async markAsRead(emailId) {
    // TODO: Cloud Functions側にエンドポイントを追加
    // 現時点ではFirestoreを直接更新（セキュリティルールで制限）
    console.warn('[EmailService] markAsRead not implemented yet');
  }

  /**
   * メールテンプレート一覧を取得
   * @param {string} companyDomain - 会社ドメイン
   * @returns {Promise<Array>}
   */
  async getTemplates(companyDomain) {
    // TODO: テンプレート機能を実装
    // 現時点ではデフォルトテンプレートを返す
    return [
      {
        id: 'interview-invite',
        name: '面接案内',
        subject: '【面接のご案内】{{companyName}}',
        bodyText: `{{applicantName}} 様

この度は{{companyName}}の求人にご応募いただき、誠にありがとうございます。

書類選考の結果、ぜひ面接にお越しいただきたく、ご連絡差し上げました。

つきましては、下記の日程よりご都合の良い日時をお知らせください。

【面接候補日】
・
・
・

【面接場所】
{{companyAddress}}

ご不明な点がございましたら、お気軽にお問い合わせください。

何卒よろしくお願いいたします。

{{companyName}}
採用担当`
      },
      {
        id: 'document-request',
        name: '書類依頼',
        subject: '【書類ご提出のお願い】{{companyName}}',
        bodyText: `{{applicantName}} 様

この度は{{companyName}}の求人にご応募いただき、誠にありがとうございます。

選考を進めるにあたり、下記書類のご提出をお願いいたします。

【提出書類】
・履歴書
・職務経歴書

【提出方法】
本メールへの返信にて、添付ファイルでお送りください。

【提出期限】
○月○日（○）まで

ご不明な点がございましたら、お気軽にお問い合わせください。

何卒よろしくお願いいたします。

{{companyName}}
採用担当`
      },
      {
        id: 'offer',
        name: '内定通知',
        subject: '【内定のご連絡】{{companyName}}',
        bodyText: `{{applicantName}} 様

この度は{{companyName}}の採用選考にご参加いただき、誠にありがとうございました。

厳正なる選考の結果、{{applicantName}}様を採用内定とさせていただきたくご連絡いたしました。

つきましては、入社に関する詳細について、後日改めてご連絡させていただきます。

ご不明な点がございましたら、お気軽にお問い合わせください。

今後とも何卒よろしくお願いいたします。

{{companyName}}
採用担当`
      },
      {
        id: 'rejection',
        name: '不採用通知',
        subject: '【選考結果のご連絡】{{companyName}}',
        bodyText: `{{applicantName}} 様

この度は{{companyName}}の求人にご応募いただき、誠にありがとうございました。

慎重に選考を重ねました結果、誠に残念ながら今回はご期待に沿えない結果となりました。

ご応募いただいたにもかかわらず、このようなご連絡となりましたこと、心よりお詫び申し上げます。

{{applicantName}}様の今後のご活躍をお祈り申し上げます。

{{companyName}}
採用担当`
      }
    ];
  }

  /**
   * テンプレートを適用
   * @param {string} template - テンプレート文字列
   * @param {object} variables - 置換変数
   * @returns {string}
   */
  applyTemplate(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
  }
}

// シングルトンインスタンス
const EmailService = new EmailServiceClass();

export default EmailService;

export {
  EmailService,
  EmailServiceClass
};
