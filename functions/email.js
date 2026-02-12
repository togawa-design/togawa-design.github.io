/**
 * メール送受信サービス（Cloud Functions用）
 * SendGridを使用して企業と応募者間のメール送受信を管理
 *
 * 使用方法:
 * const EmailService = require('./email');
 * EmailService.register(functions); // Cloud Functionsに登録
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

// SendGrid（環境構築後にコメント解除）
// const sgMail = require('@sendgrid/mail');

/**
 * メールサービスクラス
 */
class EmailService {
  constructor() {
    this.initialized = false;
    this.encryptionKey = null;
    this.parseEmailDomain = null;
  }

  /**
   * 初期化
   */
  init() {
    if (this.initialized) return;

    // 環境変数から設定を読み込み
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key-for-development-only';
    this.parseEmailDomain = process.env.PARSE_EMAIL_DOMAIN || 'parse.example.com';

    // Firebase Admin初期化（未初期化の場合）
    if (!admin.apps.length) {
      admin.initializeApp();
    }

    this.initialized = true;
  }

  /**
   * Cloud Functionsに登録
   * @param {object} functions - @google-cloud/functions-framework
   * @param {object} corsHandler - CORSハンドラー
   */
  register(functions, corsHandler) {
    // メール送信エンドポイント
    functions.http('sendEmail', (req, res) => {
      corsHandler(req, res, () => this.handleSendEmail(req, res));
    });

    // メール受信Webhook（SendGrid Inbound Parse）
    functions.http('inboundParse', (req, res) => {
      this.handleInboundParse(req, res);
    });

    // メール一覧取得エンドポイント
    functions.http('getEmails', (req, res) => {
      corsHandler(req, res, () => this.handleGetEmails(req, res));
    });
  }

  /**
   * メール送信ハンドラー
   */
  async handleSendEmail(req, res) {
    this.init();

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    try {
      // Firebase認証チェック
      const user = await this.verifyAuth(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const {
        companyDomain,
        applicationId,
        to,
        subject,
        bodyText,
        bodyHtml
      } = req.body;

      // 必須パラメータチェック
      if (!companyDomain || !applicationId || !to || !subject || !bodyText) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      // 権限チェック（ユーザーが該当企業に所属しているか）
      const hasPermission = await this.checkCompanyPermission(user.uid, companyDomain);
      if (!hasPermission) {
        res.status(403).json({ success: false, error: 'Permission denied' });
        return;
      }

      // 会社情報を取得（送信元名に使用）
      const companyInfo = await this.getCompanyInfo(companyDomain);
      const fromName = companyInfo?.company || companyDomain;
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';

      // Reply-Toトークン生成（返信メールの紐付け用）
      const replyToToken = this.generateReplyToken(companyDomain, applicationId);
      const replyToEmail = `reply-${replyToToken}@${this.parseEmailDomain}`;

      // メール送信（SendGrid）
      // const msg = {
      //   to: to,
      //   from: { email: fromEmail, name: fromName },
      //   replyTo: replyToEmail,
      //   subject: subject,
      //   text: bodyText,
      //   html: bodyHtml || bodyText.replace(/\n/g, '<br>')
      // };
      // await sgMail.send(msg);

      // Firestoreに保存
      const db = admin.firestore();
      const emailDoc = {
        companyDomain,
        applicationId,
        direction: 'outbound',
        from: { email: fromEmail, name: fromName },
        to: { email: to, name: '' },
        replyTo: replyToEmail,
        subject,
        bodyText,
        bodyHtml: bodyHtml || bodyText.replace(/\n/g, '<br>'),
        status: 'sent', // 本番では 'pending' にしてSendGrid Webhookで更新
        readByCompany: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentBy: user.uid
      };

      const docRef = await db.collection('emails').add(emailDoc);

      console.log(`[EmailService] Email sent: ${docRef.id} to ${to}`);

      res.status(200).json({
        success: true,
        emailId: docRef.id,
        message: 'Email sent successfully'
      });

    } catch (error) {
      console.error('[EmailService] sendEmail error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * メール受信ハンドラー（SendGrid Inbound Parse Webhook）
   */
  async handleInboundParse(req, res) {
    this.init();

    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      // multipart/form-dataをパース
      const fields = await this.parseMultipartForm(req);

      const {
        from,
        to,
        subject,
        text,
        html
      } = fields;

      console.log('[EmailService] Inbound email received:', { from, to, subject });

      // Reply-Toアドレスからトークンを抽出
      const tokenMatch = to.match(/reply-([a-zA-Z0-9_-]+)@/);
      if (!tokenMatch) {
        console.warn('[EmailService] Invalid reply-to address:', to);
        res.status(200).send('OK'); // SendGridには常に200を返す
        return;
      }

      // トークンを復号
      const tokenData = this.decryptReplyToken(tokenMatch[1]);
      if (!tokenData) {
        console.warn('[EmailService] Failed to decrypt token');
        res.status(200).send('OK');
        return;
      }

      const { companyDomain, applicationId } = tokenData;

      // 送信者情報をパース
      const fromMatch = from.match(/^(?:"?([^"]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
      const fromName = fromMatch?.[1] || '';
      const fromEmail = fromMatch?.[2] || from;

      // Firestoreに保存
      const db = admin.firestore();
      const emailDoc = {
        companyDomain,
        applicationId,
        direction: 'inbound',
        from: { email: fromEmail, name: fromName },
        to: { email: to, name: '' },
        subject: subject || '(件名なし)',
        bodyText: text || '',
        bodyHtml: html || '',
        status: 'received',
        readByCompany: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        receivedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('emails').add(emailDoc);

      console.log(`[EmailService] Inbound email saved: ${docRef.id}`);

      // TODO: 通知を送信（Firestoreトリガーまたはここで実装）

      res.status(200).send('OK');

    } catch (error) {
      console.error('[EmailService] inboundParse error:', error);
      res.status(200).send('OK'); // SendGridには常に200を返す
    }
  }

  /**
   * メール一覧取得ハンドラー
   */
  async handleGetEmails(req, res) {
    this.init();

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      // Firebase認証チェック
      const user = await this.verifyAuth(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { companyDomain, applicationId, limit = 50 } = req.query;

      if (!companyDomain) {
        res.status(400).json({ success: false, error: 'companyDomain is required' });
        return;
      }

      // 権限チェック
      const hasPermission = await this.checkCompanyPermission(user.uid, companyDomain);
      if (!hasPermission) {
        res.status(403).json({ success: false, error: 'Permission denied' });
        return;
      }

      // メール一覧を取得
      const db = admin.firestore();
      let query = db.collection('emails')
        .where('companyDomain', '==', companyDomain)
        .orderBy('createdAt', 'desc')
        .limit(parseInt(limit));

      // applicationIdが指定されている場合はフィルター
      if (applicationId) {
        query = db.collection('emails')
          .where('companyDomain', '==', companyDomain)
          .where('applicationId', '==', applicationId)
          .orderBy('createdAt', 'desc')
          .limit(parseInt(limit));
      }

      const snapshot = await query.get();

      const emails = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate()?.toISOString() || null,
          sentAt: data.sentAt?.toDate()?.toISOString() || null,
          receivedAt: data.receivedAt?.toDate()?.toISOString() || null
        };
      });

      res.status(200).json({
        success: true,
        emails,
        total: emails.length
      });

    } catch (error) {
      console.error('[EmailService] getEmails error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Firebase IDトークンを検証
   */
  async verifyAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.warn('[EmailService] Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * 企業への所属権限をチェック
   */
  async checkCompanyPermission(uid, companyDomain) {
    try {
      const db = admin.firestore();
      const userDoc = await db.collection('company_users').doc(uid).get();

      if (!userDoc.exists) {
        return false;
      }

      const userData = userDoc.data();
      return userData.companyDomain === companyDomain;
    } catch (error) {
      console.error('[EmailService] Permission check error:', error);
      return false;
    }
  }

  /**
   * 会社情報を取得
   */
  async getCompanyInfo(companyDomain) {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection('companies')
        .where('companyDomain', '==', companyDomain)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data();
    } catch (error) {
      console.error('[EmailService] Get company info error:', error);
      return null;
    }
  }

  /**
   * Reply-Toトークンを生成（暗号化）
   */
  generateReplyToken(companyDomain, applicationId) {
    const data = JSON.stringify({ companyDomain, applicationId, ts: Date.now() });

    // AES-256-GCM暗号化
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // iv + authTag + encrypted をBase64URLエンコード
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);
    return combined.toString('base64url');
  }

  /**
   * Reply-Toトークンを復号
   */
  decryptReplyToken(token) {
    try {
      const combined = Buffer.from(token, 'base64url');

      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(12, 28);
      const encrypted = combined.subarray(28);

      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[EmailService] Token decryption error:', error);
      return null;
    }
  }

  /**
   * multipart/form-dataをパース
   */
  async parseMultipartForm(req) {
    return new Promise((resolve, reject) => {
      // 本番ではbusboyを使用
      // const Busboy = require('busboy');
      // const busboy = Busboy({ headers: req.headers });
      // ...

      // 開発用：シンプルなパース（SendGridのフォーマット）
      const fields = {};

      // bodyがすでにパースされている場合
      if (req.body && typeof req.body === 'object') {
        resolve(req.body);
        return;
      }

      // 生のbodyをパース
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        // URLエンコードされたフォームデータとして処理
        const params = new URLSearchParams(body);
        for (const [key, value] of params) {
          fields[key] = value;
        }
        resolve(fields);
      });
      req.on('error', reject);
    });
  }
}

// シングルトンインスタンス
const emailService = new EmailService();

module.exports = emailService;
