/**
 * L-SET - Google Analytics Data API Cloud Function
 *
 * GA4のデータを取得して管理者ダッシュボードに提供するAPI
 */

const functions = require('@google-cloud/functions-framework');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const cors = require('cors');
const bcrypt = require('bcrypt');
const admin = require('firebase-admin');

// メールサービス
const emailService = require('./email');

// 給与相場同期サービス（e-Stat API連携）
const salarySyncService = require('./salary-sync');

// Firebase Admin初期化（環境変数でプロジェクトを切り替え）
// FIREBASE_PROJECT_ID: 本番=generated-area-484613-e3-90bd4, 開発=lset-dev
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'generated-area-484613-e3-90bd4';
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: FIREBASE_PROJECT_ID
  });
}
console.log(`[Cloud Functions] Firebase Project: ${FIREBASE_PROJECT_ID}`);

// CORS設定（許可するオリジンを本番環境に合わせて調整）
const corsHandler = cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:5500',
    'http://localhost:5502',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:3004',
    'http://127.0.0.1:3005',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5502',
    'https://togawa-design.github.io'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

// メールサービスのHTTPエンドポイントを登録
emailService.register(functions, corsHandler);

// 給与相場同期サービスのHTTPエンドポイントを登録
salarySyncService.register(functions, corsHandler);

// GA4プロパティID（数字のみ）
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '520379160'; // G-E1XC94EG05 の数字部分

// Analytics Data APIクライアント
let analyticsDataClient;

/**
 * Firebase IDトークンを検証
 */
async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.warn('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Analytics Data APIクライアントを初期化
 */
function getAnalyticsClient() {
  if (!analyticsDataClient) {
    // Cloud Functionsでは自動的にサービスアカウント認証が使用される
    analyticsDataClient = new BetaAnalyticsDataClient();
  }
  return analyticsDataClient;
}

/**
 * メインのCloud Function - アナリティクスデータを取得
 */
functions.http('getAnalyticsData', (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // OPTIONSリクエスト（プリフライト）の処理
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      // Firebase IDトークン検証（任意 - ログがあれば記録）
      const user = await verifyToken(req);
      if (user) {
        console.log(`Authenticated user: ${user.email || user.uid}`);
      } else {
        console.log('Anonymous access to analytics data');
      }

      const { type, days = 30, company_domain: companyDomain } = req.query;
      const client = getAnalyticsClient();

      let data;

      switch (type) {
        case 'overview':
          data = await getOverviewData(client, parseInt(days), companyDomain);
          break;
        case 'companies':
          data = await getCompanyData(client, parseInt(days));
          break;
        case 'daily':
          data = await getDailyData(client, parseInt(days), companyDomain);
          break;
        case 'applications':
          data = await getApplicationData(client, parseInt(days), companyDomain);
          break;
        case 'engagement':
          // domain パラメータも受け付ける
          const engagementDomain = req.query.domain || companyDomain;
          data = await getEngagementData(client, parseInt(days), engagementDomain);
          break;
        case 'traffic':
          // domain パラメータも受け付ける
          const trafficDomain = req.query.domain || companyDomain;
          data = await getTrafficSourceData(client, parseInt(days), trafficDomain);
          break;
        case 'funnel':
          // domain パラメータも受け付ける（フロントエンドの呼び出し方に対応）
          const funnelDomain = req.query.domain || companyDomain;
          data = await getFunnelData(client, parseInt(days), funnelDomain);
          break;
        case 'trends':
          // domain パラメータも受け付ける
          const trendsDomain = req.query.domain || companyDomain;
          data = await getTrendData(client, parseInt(days), trendsDomain);
          break;
        case 'company-detail':
          const { domain } = req.query;
          if (!domain) {
            throw new Error('domain parameter is required for company-detail');
          }
          data = await getCompanyDetailData(client, parseInt(days), domain);
          break;
        case 'job-performance':
          const { company_domain } = req.query;
          data = await getJobPerformanceData(client, parseInt(days), company_domain);
          break;
        case 'recent-applications':
          const { domain: appDomain, limit: appLimit } = req.query;
          data = await getRecentApplications(appDomain, parseInt(appLimit) || 20);
          break;
        default:
          // すべてのデータを取得
          data = {
            overview: await getOverviewData(client, parseInt(days), companyDomain),
            companies: await getCompanyData(client, parseInt(days)),
            daily: await getDailyData(client, parseInt(days), companyDomain),
            applications: await getApplicationData(client, parseInt(days), companyDomain)
          };
      }

      res.status(200).json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Analytics API Error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.details || '',
        code: error.code || '',
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * 概要データを取得
 * @param {object} client - Analytics Data APIクライアント
 * @param {number} days - 取得日数
 * @param {string|null} companyDomain - 会社ドメイン（指定時はその会社のみ）
 */
async function getOverviewData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  console.log(`Fetching overview data for property: ${GA4_PROPERTY_ID}, days: ${days}, company: ${companyDomain || 'all'}`);

  // 会社指定がない場合は従来の全体データ
  if (!companyDomain) {
    // 基本指標を取得
    const [response] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'sessions' }
      ]
    });

    const metrics = response.rows?.[0]?.metricValues || [];

    // カスタムイベントを取得（企業ページ閲覧、応募クリック）
    let companyViews = 0;
    let applyClicks = 0;

    try {
      const [eventResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          orGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: { value: 'view_company_page' }
                }
              },
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: { value: 'click_apply' }
                }
              }
            ]
          }
        }
      });

      eventResponse.rows?.forEach(row => {
        const eventName = row.dimensionValues[0].value;
        const count = parseInt(row.metricValues[0].value) || 0;

        if (eventName === 'view_company_page') {
          companyViews = count;
        } else if (eventName === 'click_apply') {
          applyClicks = count;
        }
      });
    } catch (eventError) {
      console.warn('Event data fetch failed:', eventError.message);
    }

    return {
      pageViews: parseInt(metrics[0]?.value) || 0,
      users: parseInt(metrics[1]?.value) || 0,
      sessions: parseInt(metrics[2]?.value) || 0,
      companyViews,
      applyClicks
    };
  }

  // 会社指定がある場合は、その会社のイベントのみでメトリクスを計算
  try {
    // 会社ページ閲覧数とユニークユーザー数を取得
    const [viewResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      }
    });

    const viewMetrics = viewResponse.rows?.[0]?.metricValues || [];
    const companyViews = parseInt(viewMetrics[0]?.value) || 0;
    const users = parseInt(viewMetrics[1]?.value) || 0;

    // 応募クリック数を取得
    const [clickResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'click_apply' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      }
    });

    const applyClicks = parseInt(clickResponse.rows?.[0]?.metricValues?.[0]?.value) || 0;

    // セッション数（会社ページを閲覧したセッション）
    const [sessionResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      }
    });

    const sessions = parseInt(sessionResponse.rows?.[0]?.metricValues?.[0]?.value) || 0;

    return {
      pageViews: companyViews, // 会社ページ閲覧数をPVとして返す
      users,
      sessions,
      companyViews,
      applyClicks
    };
  } catch (error) {
    console.error('Company-specific overview data error:', error.message);
    return {
      pageViews: 0,
      users: 0,
      sessions: 0,
      companyViews: 0,
      applyClicks: 0
    };
  }
}

/**
 * 企業別データを取得
 * 注意: カスタムディメンション（company_domain, company_name）がGA4で登録されていない場合は
 * ページパスベースのデータを返す
 */
async function getCompanyData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // カスタムディメンションを使用した企業ページ閲覧データ
    const [viewResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'customEvent:company_domain' },
        { name: 'customEvent:company_name' }
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'view_company_page' }
        }
      },
      orderBys: [
        { metric: { metricName: 'eventCount' }, desc: true }
      ],
      limit: 50
    });

    // 応募クリックデータ
    const [clickResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'customEvent:company_domain' }
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'click_apply' }
        }
      }
    });

    // クリック数をマップに変換
    const clicksMap = {};
    clickResponse.rows?.forEach(row => {
      const domain = row.dimensionValues[0].value;
      clicksMap[domain] = parseInt(row.metricValues[0].value) || 0;
    });

    // データを整形
    const companies = viewResponse.rows?.map(row => {
      const domain = row.dimensionValues[0].value;
      const name = row.dimensionValues[1].value;
      const views = parseInt(row.metricValues[0].value) || 0;
      const clicks = clicksMap[domain] || 0;
      const cvr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0';

      return {
        domain,
        name,
        views,
        clicks,
        cvr: parseFloat(cvr)
      };
    }) || [];

    return companies;
  } catch (error) {
    console.warn('Company data with custom dimensions failed, returning empty:', error.message);
    // カスタムディメンションが登録されていない場合は空配列を返す
    return [];
  }
}

/**
 * 日別データを取得
 * @param {object} client - Analytics Data APIクライアント
 * @param {number} days - 取得日数
 * @param {string|null} companyDomain - 会社ドメイン（指定時はその会社のみ）
 */
async function getDailyData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  // 会社指定がない場合は従来のサイト全体データ
  if (!companyDomain) {
    const [response] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' }
      ],
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: false }
      ]
    });

    return response.rows?.map(row => {
      const dateStr = row.dimensionValues[0].value;
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);

      return {
        date: `${month}/${day}`,
        fullDate: `${year}-${month}-${day}`,
        views: parseInt(row.metricValues[0].value) || 0,
        users: parseInt(row.metricValues[1].value) || 0
      };
    }) || [];
  }

  // 会社指定がある場合は、その会社のイベントで日別データを取得
  try {
    const [response] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      },
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: false }
      ]
    });

    return response.rows?.map(row => {
      const dateStr = row.dimensionValues[0].value;
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);

      return {
        date: `${month}/${day}`,
        fullDate: `${year}-${month}-${day}`,
        views: parseInt(row.metricValues[0].value) || 0,
        users: parseInt(row.metricValues[1].value) || 0
      };
    }) || [];
  } catch (error) {
    console.error('Company-specific daily data error:', error.message);
    return [];
  }
}

/**
 * 応募イベントデータを取得
 * 注意: カスタムディメンションが登録されていない場合はシンプルなデータを返す
 */
async function getApplicationData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // フィルター構築
    let dimensionFilter;
    if (companyDomain) {
      // 会社ドメイン指定がある場合はANDフィルター
      dimensionFilter = {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'click_apply' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      };
    } else {
      dimensionFilter = {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'click_apply' }
        }
      };
    }

    const [response] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'dateHourMinute' },
        { name: 'customEvent:company_name' },
        { name: 'customEvent:button_type' },
        { name: 'sessionDefaultChannelGroup' },
        { name: 'pagePath' }
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter,
      orderBys: [
        { dimension: { dimensionName: 'dateHourMinute' }, desc: true }
      ],
      limit: 100
    });

    return response.rows?.map(row => {
      const dateHourMinute = row.dimensionValues[0].value;
      const year = dateHourMinute.substring(0, 4);
      const month = dateHourMinute.substring(4, 6);
      const day = dateHourMinute.substring(6, 8);
      const hour = dateHourMinute.substring(8, 10);
      const minute = dateHourMinute.substring(10, 12);

      const buttonType = row.dimensionValues[2].value;
      const pagePath = row.dimensionValues[4].value || '';

      // ページパスから画面種別を判定
      let pageType = '不明';
      if (pagePath.includes('/lp.html') || pagePath.includes('/lp?')) {
        pageType = 'LP';
      } else if (pagePath.includes('/job-detail.html') || pagePath.includes('/job/')) {
        pageType = '求人詳細';
      } else if (pagePath.includes('/company.html') || pagePath.includes('/company/')) {
        pageType = '企業ページ';
      } else if (pagePath === '/' || pagePath.includes('/index.html')) {
        pageType = 'トップページ';
      } else if (pagePath) {
        pageType = pagePath;
      }

      return {
        date: `${year}/${month}/${day} ${hour}:${minute}`,
        company: row.dimensionValues[1].value || '不明',
        type: (buttonType && buttonType !== '(not set)') ? buttonType : 'apply',
        source: row.dimensionValues[3].value || '不明',
        pagePath,
        pageType
      };
    }) || [];
  } catch (error) {
    console.warn('Application data with custom dimensions failed:', error.message);

    // 会社ドメイン指定がある場合はフォールバックせず空配列を返す
    // （カスタムディメンションなしではフィルタリングできないため）
    if (companyDomain) {
      console.warn('Company domain specified but custom dimensions query failed, returning empty array');
      return [];
    }

    // カスタムディメンションなしでシンプルなクエリ（管理者全体表示用）
    try {
      const [simpleResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'dateHourMinute' },
          { name: 'sessionDefaultChannelGroup' },
          { name: 'pagePath' }
        ],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { value: 'click_apply' }
          }
        },
        orderBys: [
          { dimension: { dimensionName: 'dateHourMinute' }, desc: true }
        ],
        limit: 100
      });

      return simpleResponse.rows?.map(row => {
        const dateHourMinute = row.dimensionValues[0].value;
        const year = dateHourMinute.substring(0, 4);
        const month = dateHourMinute.substring(4, 6);
        const day = dateHourMinute.substring(6, 8);
        const hour = dateHourMinute.substring(8, 10);
        const minute = dateHourMinute.substring(10, 12);

        const pagePath = row.dimensionValues[2].value || '';

        // ページパスから画面種別を判定
        let pageType = '不明';
        if (pagePath.includes('/lp.html') || pagePath.includes('/lp?')) {
          pageType = 'LP';
        } else if (pagePath.includes('/job-detail.html') || pagePath.includes('/job/')) {
          pageType = '求人詳細';
        } else if (pagePath.includes('/company.html') || pagePath.includes('/company/')) {
          pageType = '企業ページ';
        } else if (pagePath === '/' || pagePath.includes('/index.html')) {
          pageType = 'トップページ';
        } else if (pagePath) {
          pageType = pagePath;
        }

        return {
          date: `${year}/${month}/${day} ${hour}:${minute}`,
          company: '不明',
          type: 'apply',
          source: row.dimensionValues[1].value || '不明',
          pagePath,
          pageType
        };
      }) || [];
    } catch (simpleError) {
      console.warn('Simple application data query also failed:', simpleError.message);
      return [];
    }
  }
}

/**
 * エンゲージメントデータを取得（滞在時間、スクロール深度、直帰率）
 * @param {object} client - Analytics Data APIクライアント
 * @param {number} days - 取得日数
 * @param {string|null} companyDomain - 会社ドメイン（指定時はその会社のみ）
 */
async function getEngagementData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // 会社指定がない場合はサイト全体のエンゲージメント
    if (!companyDomain) {
      // 基本エンゲージメント指標
      const [basicResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'engagedSessions' },
          { name: 'sessionsPerUser' }
        ]
      });

      const basicMetrics = basicResponse.rows?.[0]?.metricValues || [];

      // 企業別エンゲージメント
      let companyEngagement = [];
      try {
        const [companyResponse] = await client.runReport({
          property: `properties/${GA4_PROPERTY_ID}`,
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: 'customEvent:company_domain' },
            { name: 'customEvent:company_name' }
          ],
          metrics: [
            { name: 'eventCount' },
            { name: 'userEngagementDuration' }
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'view_company_page' }
            }
          },
          orderBys: [
            { metric: { metricName: 'userEngagementDuration' }, desc: true }
          ],
          limit: 20
        });

        companyEngagement = companyResponse.rows?.map(row => ({
          domain: row.dimensionValues[0].value,
          name: row.dimensionValues[1].value,
          views: parseInt(row.metricValues[0].value) || 0,
          engagementTime: parseFloat(row.metricValues[1].value) || 0,
          avgTimePerView: row.metricValues[0].value > 0
            ? (parseFloat(row.metricValues[1].value) / parseInt(row.metricValues[0].value)).toFixed(1)
            : 0
        })) || [];
      } catch (e) {
        console.warn('Company engagement data failed:', e.message);
      }

      return {
        overall: {
          avgSessionDuration: parseFloat(basicMetrics[0]?.value || 0).toFixed(1),
          bounceRate: (parseFloat(basicMetrics[1]?.value || 0) * 100).toFixed(1),
          engagementRate: (parseFloat(basicMetrics[2]?.value || 0) * 100).toFixed(1),
          engagedSessions: parseInt(basicMetrics[3]?.value || 0),
          sessionsPerUser: parseFloat(basicMetrics[4]?.value || 0).toFixed(2)
        },
        byCompany: companyEngagement
      };
    }

    // 会社指定がある場合は、その会社のエンゲージメントデータのみを取得
    const [companyResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      }
    });

    const metrics = companyResponse.rows?.[0]?.metricValues || [];
    const views = parseInt(metrics[0]?.value) || 0;
    const users = parseInt(metrics[1]?.value) || 0;
    const totalEngagementTime = parseFloat(metrics[2]?.value) || 0;
    const avgTimePerView = views > 0 ? (totalEngagementTime / views).toFixed(1) : '0';
    const avgSessionDuration = users > 0 ? (totalEngagementTime / users).toFixed(1) : '0';

    // 求人別エンゲージメントデータを取得
    let byJob = [];
    try {
      const jobPerformance = await getJobPerformanceData(client, days, companyDomain);
      byJob = (jobPerformance.jobs || []).map(job => ({
        jobId: job.jobId,
        title: job.jobTitle,
        views: job.views,
        engagementTime: job.views * 30, // 推定値（1閲覧あたり30秒と仮定）
        avgTimePerView: '30.0' // 推定値
      }));
    } catch (jobError) {
      console.warn('Failed to get job engagement:', jobError.message);
    }

    return {
      overall: {
        avgSessionDuration,
        bounceRate: '0', // 会社単位では計算不可
        engagementRate: '0', // 会社単位では計算不可
        engagedSessions: views,
        sessionsPerUser: users > 0 ? (views / users).toFixed(2) : '0'
      },
      byCompany: [{
        domain: companyDomain,
        name: companyDomain,
        views,
        engagementTime: totalEngagementTime,
        avgTimePerView
      }],
      byJob
    };
  } catch (error) {
    console.error('Engagement data error:', error.message);
    return { overall: {}, byCompany: [], byJob: [] };
  }
}

/**
 * 流入元データを取得
 * @param {object} client - Analytics Data APIクライアント
 * @param {number} days - 取得日数
 * @param {string|null} companyDomain - 会社ドメイン（指定時はその会社のみ）
 */
async function getTrafficSourceData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // 会社指定がない場合はサイト全体のトラフィックデータ
    if (!companyDomain) {
      // チャネル別データ
      const [channelResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'engagementRate' },
          { name: 'conversions' }
        ],
        orderBys: [
          { metric: { metricName: 'sessions' }, desc: true }
        ],
        limit: 10
      });

      const channels = channelResponse.rows?.map(row => ({
        channel: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value) || 0,
        users: parseInt(row.metricValues[1].value) || 0,
        engagementRate: (parseFloat(row.metricValues[2].value || 0) * 100).toFixed(1),
        conversions: parseInt(row.metricValues[3].value) || 0
      })) || [];

      // 参照元別データ
      const [sourceResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' }
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' }
        ],
        orderBys: [
          { metric: { metricName: 'sessions' }, desc: true }
        ],
        limit: 15
      });

      const sources = sourceResponse.rows?.map(row => ({
        source: row.dimensionValues[0].value,
        medium: row.dimensionValues[1].value,
        sessions: parseInt(row.metricValues[0].value) || 0,
        users: parseInt(row.metricValues[1].value) || 0
      })) || [];

      // 企業別の流入元
      let companyTraffic = [];
      try {
        const [companyTrafficResponse] = await client.runReport({
          property: `properties/${GA4_PROPERTY_ID}`,
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: 'customEvent:company_domain' },
            { name: 'sessionDefaultChannelGroup' }
          ],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'view_company_page' }
            }
          },
          orderBys: [
            { metric: { metricName: 'eventCount' }, desc: true }
          ],
          limit: 50
        });

        // 企業ごとにチャネルをまとめる
        const companyMap = {};
        companyTrafficResponse.rows?.forEach(row => {
          const domain = row.dimensionValues[0].value;
          const channel = row.dimensionValues[1].value;
          const count = parseInt(row.metricValues[0].value) || 0;

          if (!companyMap[domain]) {
            companyMap[domain] = { domain, channels: {} };
          }
          companyMap[domain].channels[channel] = count;
        });

        companyTraffic = Object.values(companyMap);
      } catch (e) {
        console.warn('Company traffic data failed:', e.message);
      }

      return {
        channels,
        sources,
        byCompany: companyTraffic
      };
    }

    // 会社指定がある場合は、その会社のトラフィックデータのみを取得
    // チャネル別データ
    const [channelResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      },
      orderBys: [
        { metric: { metricName: 'eventCount' }, desc: true }
      ],
      limit: 10
    });

    const channels = channelResponse.rows?.map(row => ({
      channel: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value) || 0,
      users: parseInt(row.metricValues[0].value) || 0, // sessionsと同じ値を使用
      engagementRate: '0',
      conversions: 0
    })) || [];

    // 参照元別データ
    const [sourceResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' }
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: companyDomain }
              }
            }
          ]
        }
      },
      orderBys: [
        { metric: { metricName: 'eventCount' }, desc: true }
      ],
      limit: 15
    });

    const sources = sourceResponse.rows?.map(row => ({
      source: row.dimensionValues[0].value,
      medium: row.dimensionValues[1].value,
      sessions: parseInt(row.metricValues[0].value) || 0,
      users: parseInt(row.metricValues[0].value) || 0
    })) || [];

    return {
      channels,
      sources,
      byCompany: [{ domain: companyDomain, channels: {} }]
    };
  } catch (error) {
    console.error('Traffic source data error:', error.message);
    return { channels: [], sources: [], byCompany: [] };
  }
}

/**
 * コンバージョンファネルデータを取得
 * @param {object} client - Analytics Data APIクライアント
 * @param {number} days - 取得日数
 * @param {string|null} companyDomain - 会社ドメイン（指定時はその会社のみ）
 */
async function getFunnelData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // 会社指定がない場合はサイト全体のファネルデータ
    if (!companyDomain) {
      // 各ステージのイベント数を取得
      const [funnelResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'totalUsers' }
        ],
        dimensionFilter: {
          orGroup: {
            expressions: [
              { filter: { fieldName: 'eventName', stringFilter: { value: 'page_view' } } },
              { filter: { fieldName: 'eventName', stringFilter: { value: 'view_company_page' } } },
              { filter: { fieldName: 'eventName', stringFilter: { value: 'scroll' } } },
              { filter: { fieldName: 'eventName', stringFilter: { value: 'click_apply' } } },
              { filter: { fieldName: 'eventName', stringFilter: { value: 'click_line' } } },
              { filter: { fieldName: 'eventName', stringFilter: { value: 'form_submit' } } }
            ]
          }
        }
      });

      const eventMap = {};
      funnelResponse.rows?.forEach(row => {
        const eventName = row.dimensionValues[0].value;
        eventMap[eventName] = {
          count: parseInt(row.metricValues[0].value) || 0,
          users: parseInt(row.metricValues[1].value) || 0
        };
      });

      // ファネルステージを構築
      const pageViews = eventMap['page_view']?.count || 0;
      const companyViews = eventMap['view_company_page']?.count || 0;
      const scrolls = eventMap['scroll']?.count || 0;
      const applyClicks = eventMap['click_apply']?.count || 0;
      const lineClicks = eventMap['click_line']?.count || 0;
      const formSubmits = eventMap['form_submit']?.count || 0;
      const totalConversions = applyClicks + lineClicks + formSubmits;

      const funnel = [
        {
          stage: 'サイト訪問',
          event: 'page_view',
          count: pageViews,
          rate: 100
        },
        {
          stage: '企業ページ閲覧',
          event: 'view_company_page',
          count: companyViews,
          rate: pageViews > 0 ? ((companyViews / pageViews) * 100).toFixed(1) : 0
        },
        {
          stage: 'ページスクロール',
          event: 'scroll',
          count: scrolls,
          rate: pageViews > 0 ? ((scrolls / pageViews) * 100).toFixed(1) : 0
        },
        {
          stage: 'アクション（応募・LINE・フォーム）',
          event: 'conversions',
          count: totalConversions,
          rate: companyViews > 0 ? ((totalConversions / companyViews) * 100).toFixed(1) : 0
        }
      ];

      // アクション種別の内訳
      const actionBreakdown = [
        { type: 'apply', label: '応募ボタン', count: applyClicks },
        { type: 'line', label: 'LINE相談', count: lineClicks },
        { type: 'form', label: 'フォーム送信', count: formSubmits }
      ];

      // 企業別ファネル
      let companyFunnels = [];
      try {
        // 企業別の閲覧数とクリック数を取得
        const [companyViewResponse] = await client.runReport({
          property: `properties/${GA4_PROPERTY_ID}`,
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'customEvent:company_domain' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'view_company_page' }
            }
          }
        });

        const [companyClickResponse] = await client.runReport({
          property: `properties/${GA4_PROPERTY_ID}`,
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'customEvent:company_domain' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'click_apply' }
            }
          }
        });

        const viewMap = {};
        companyViewResponse.rows?.forEach(row => {
          viewMap[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value) || 0;
        });

        const clickMap = {};
        companyClickResponse.rows?.forEach(row => {
          clickMap[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value) || 0;
        });

        // 全企業のファネルデータを構築
        for (const domain of Object.keys(viewMap)) {
          const views = viewMap[domain] || 0;
          const clicks = clickMap[domain] || 0;
          const cvr = views > 0 ? ((clicks / views) * 100).toFixed(1) : 0;

          companyFunnels.push({
            domain,
            views,
            clicks,
            cvr: parseFloat(cvr)
          });
        }

        companyFunnels.sort((a, b) => b.views - a.views);
        companyFunnels = companyFunnels.slice(0, 20);
      } catch (e) {
        console.warn('Company funnel data failed:', e.message);
      }

      return {
        funnel,
        actionBreakdown,
        byCompany: companyFunnels
      };
    }

    // 会社指定がある場合は、その会社のファネルデータのみを取得
    // ヘルパー関数：イベント数取得
    const getEventCount = async (eventName) => {
      try {
        const [response] = await client.runReport({
          property: `properties/${GA4_PROPERTY_ID}`,
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            andGroup: {
              expressions: [
                { filter: { fieldName: 'eventName', stringFilter: { value: eventName } } },
                { filter: { fieldName: 'customEvent:company_domain', stringFilter: { value: companyDomain } } }
              ]
            }
          }
        });
        return parseInt(response.rows?.[0]?.metricValues?.[0]?.value) || 0;
      } catch (e) {
        return 0;
      }
    };

    // 全てのAPI呼び出しを並列実行
    const [companyViews, applyClicks, lineClicks, formSubmits, recentAppsResult, jobPerformance] = await Promise.all([
      getEventCount('view_company_page'),
      getEventCount('click_apply'),
      getEventCount('click_line'),
      getEventCount('form_submit'),
      getRecentApplications(companyDomain, 50).catch(e => { console.warn('Failed to get recent applications:', e.message); return { applications: [] }; }),
      getJobPerformanceData(client, days, companyDomain).catch(e => { console.warn('Failed to get job performance:', e.message); return { jobs: [] }; })
    ]);

    const totalConversions = applyClicks + lineClicks + formSubmits;

    const funnel = [
      {
        stage: '企業ページ閲覧',
        event: 'view_company_page',
        count: companyViews,
        rate: 100
      },
      {
        stage: 'アクション（応募・LINE・フォーム）',
        event: 'conversions',
        count: totalConversions,
        rate: companyViews > 0 ? ((totalConversions / companyViews) * 100).toFixed(1) : 0
      }
    ];

    const actionBreakdown = [
      { type: 'apply', label: '応募ボタン', count: applyClicks },
      { type: 'line', label: 'LINE相談', count: lineClicks },
      { type: 'form', label: 'フォーム送信', count: formSubmits }
    ];

    const cvr = companyViews > 0 ? ((applyClicks / companyViews) * 100).toFixed(1) : 0;

    // 並列で取得済みのデータを使用
    const applications = recentAppsResult.applications || [];
    const byJob = (jobPerformance.jobs || []).map(job => ({
      jobId: job.jobId,
      title: job.jobTitle,
      views: job.views,
      clicks: job.applications,
      cvr: job.cvr
    }));

    return {
      funnel,
      actionBreakdown,
      byCompany: [{
        domain: companyDomain,
        views: companyViews,
        clicks: applyClicks,
        cvr: parseFloat(cvr)
      }],
      byJob,
      applications
    };
  } catch (error) {
    console.error('Funnel data error:', error.message);
    return { funnel: [], actionBreakdown: [], byCompany: [], byJob: [], applications: [] };
  }
}

/**
 * 時系列トレンドデータを取得（曜日・時間帯別）
 * @param {object} client - Analytics Data APIクライアント
 * @param {number} days - 取得日数
 * @param {string|null} companyDomain - 会社ドメイン（指定時はその会社のみ）
 */
async function getTrendData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // 会社指定がない場合はサイト全体のトレンドデータ
    if (!companyDomain) {
      // 曜日別データ
      const [dayOfWeekResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'dayOfWeek' }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'totalUsers' }
        ],
        orderBys: [
          { dimension: { dimensionName: 'dayOfWeek' }, desc: false }
        ]
      });

      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const byDayOfWeek = dayOfWeekResponse.rows?.map(row => ({
        dayIndex: parseInt(row.dimensionValues[0].value),
        day: dayNames[parseInt(row.dimensionValues[0].value)] || row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value) || 0,
        pageViews: parseInt(row.metricValues[1].value) || 0,
        users: parseInt(row.metricValues[2].value) || 0
      })).sort((a, b) => a.dayIndex - b.dayIndex) || [];

      // 時間帯別データ
      const [hourResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'hour' }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' }
        ],
        orderBys: [
          { dimension: { dimensionName: 'hour' }, desc: false }
        ]
      });

      const byHour = hourResponse.rows?.map(row => ({
        hour: parseInt(row.dimensionValues[0].value),
        hourLabel: `${row.dimensionValues[0].value}時`,
        sessions: parseInt(row.metricValues[0].value) || 0,
        pageViews: parseInt(row.metricValues[1].value) || 0
      })) || [];

      // 週次トレンド
      const [weeklyResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'week' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' }
        ],
        orderBys: [
          { dimension: { dimensionName: 'week' }, desc: false }
        ]
      });

      const weekly = weeklyResponse.rows?.map(row => ({
        week: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value) || 0,
        users: parseInt(row.metricValues[1].value) || 0,
        pageViews: parseInt(row.metricValues[2].value) || 0
      })) || [];

      // ピーク時間帯を特定
      let peakHour = byHour.reduce((max, h) => h.sessions > max.sessions ? h : max, { sessions: 0 });
      let peakDay = byDayOfWeek.reduce((max, d) => d.sessions > max.sessions ? d : max, { sessions: 0 });

      return {
        byDayOfWeek,
        byHour,
        weekly,
        insights: {
          peakHour: peakHour.hourLabel || 'データなし',
          peakDay: peakDay.day || 'データなし',
          peakHourSessions: peakHour.sessions,
          peakDaySessions: peakDay.sessions
        }
      };
    }

    // 会社指定がある場合は、その会社のトレンドデータのみを取得
    const companyFilter = {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'view_company_page' }
            }
          },
          {
            filter: {
              fieldName: 'customEvent:company_domain',
              stringFilter: { value: companyDomain }
            }
          }
        ]
      }
    };

    // 曜日別データ
    const [dayOfWeekResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'dayOfWeek' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: companyFilter,
      orderBys: [
        { dimension: { dimensionName: 'dayOfWeek' }, desc: false }
      ]
    });

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const byDayOfWeek = dayOfWeekResponse.rows?.map(row => ({
      dayIndex: parseInt(row.dimensionValues[0].value),
      day: dayNames[parseInt(row.dimensionValues[0].value)] || row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value) || 0,
      pageViews: parseInt(row.metricValues[0].value) || 0,
      users: 0
    })).sort((a, b) => a.dayIndex - b.dayIndex) || [];

    // 時間帯別データ
    const [hourResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'hour' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: companyFilter,
      orderBys: [
        { dimension: { dimensionName: 'hour' }, desc: false }
      ]
    });

    const byHour = hourResponse.rows?.map(row => ({
      hour: parseInt(row.dimensionValues[0].value),
      hourLabel: `${row.dimensionValues[0].value}時`,
      sessions: parseInt(row.metricValues[0].value) || 0,
      pageViews: parseInt(row.metricValues[0].value) || 0
    })) || [];

    // 週次トレンド
    const [weeklyResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'week' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: companyFilter,
      orderBys: [
        { dimension: { dimensionName: 'week' }, desc: false }
      ]
    });

    const weekly = weeklyResponse.rows?.map(row => ({
      week: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value) || 0,
      users: 0,
      pageViews: parseInt(row.metricValues[0].value) || 0
    })) || [];

    // 日別データを取得
    const [dailyResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: companyFilter,
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: false }
      ]
    });

    const daily = dailyResponse.rows?.map(row => {
      const dateStr = row.dimensionValues[0].value;
      return {
        date: `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`,
        fullDate: `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`,
        views: parseInt(row.metricValues[0].value) || 0
      };
    }) || [];

    // ピーク時間帯を特定
    let peakHour = byHour.reduce((max, h) => h.sessions > max.sessions ? h : max, { sessions: 0 });
    let peakDay = byDayOfWeek.reduce((max, d) => d.sessions > max.sessions ? d : max, { sessions: 0 });

    return {
      byDayOfWeek,
      byHour,
      weekly,
      daily,
      insights: {
        peakHour: peakHour.hourLabel || 'データなし',
        peakDay: peakDay.day || 'データなし',
        peakHourSessions: peakHour.sessions,
        peakDaySessions: peakDay.sessions
      }
    };
  } catch (error) {
    console.error('Trend data error:', error.message);
    return { byDayOfWeek: [], byHour: [], weekly: [], daily: [], insights: {} };
  }
}

/**
 * 企業詳細分析データを取得
 * Google Signalsが有効な場合、性別・年齢層データも取得
 */
async function getCompanyDetailData(client, days, domain) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // 日別データ
    const [dailyResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: domain }
              }
            }
          ]
        }
      },
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: false }
      ]
    });

    const daily = dailyResponse.rows?.map(row => {
      const dateStr = row.dimensionValues[0].value;
      return {
        date: `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`,
        fullDate: `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`,
        views: parseInt(row.metricValues[0].value) || 0
      };
    }) || [];

    // 流入元データ
    const [trafficResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { value: 'view_company_page' }
              }
            },
            {
              filter: {
                fieldName: 'customEvent:company_domain',
                stringFilter: { value: domain }
              }
            }
          ]
        }
      },
      orderBys: [
        { metric: { metricName: 'eventCount' }, desc: true }
      ]
    });

    const traffic = trafficResponse.rows?.map(row => ({
      channel: row.dimensionValues[0].value,
      count: parseInt(row.metricValues[0].value) || 0
    })) || [];

    // 性別データを取得（Google Signals有効時）
    let gender = { male: 0, female: 0, unknown: 0 };
    try {
      const [genderResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'userGender' }],
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: { value: 'view_company_page' }
                }
              },
              {
                filter: {
                  fieldName: 'customEvent:company_domain',
                  stringFilter: { value: domain }
                }
              }
            ]
          }
        }
      });

      genderResponse.rows?.forEach(row => {
        const genderValue = row.dimensionValues[0].value.toLowerCase();
        const count = parseInt(row.metricValues[0].value) || 0;
        if (genderValue === 'male') {
          gender.male = count;
        } else if (genderValue === 'female') {
          gender.female = count;
        } else {
          gender.unknown += count;
        }
      });
    } catch (genderError) {
      console.warn('Gender data not available (Google Signals may not be enabled):', genderError.message);
    }

    // 年齢層データを取得（Google Signals有効時）
    let age = {};
    try {
      const [ageResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'userAgeBracket' }],
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: { value: 'view_company_page' }
                }
              },
              {
                filter: {
                  fieldName: 'customEvent:company_domain',
                  stringFilter: { value: domain }
                }
              }
            ]
          }
        },
        orderBys: [
          { dimension: { dimensionName: 'userAgeBracket' }, desc: false }
        ]
      });

      ageResponse.rows?.forEach(row => {
        const ageGroup = row.dimensionValues[0].value;
        const count = parseInt(row.metricValues[0].value) || 0;
        // GA4の年齢層: 18-24, 25-34, 35-44, 45-54, 55-64, 65+
        if (ageGroup && ageGroup !== '(not set)') {
          age[ageGroup] = count;
        }
      });
    } catch (ageError) {
      console.warn('Age data not available (Google Signals may not be enabled):', ageError.message);
    }

    // デバイス別データを取得
    let devices = [];
    try {
      const [deviceResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: { value: 'view_company_page' }
                }
              },
              {
                filter: {
                  fieldName: 'customEvent:company_domain',
                  stringFilter: { value: domain }
                }
              }
            ]
          }
        },
        orderBys: [
          { metric: { metricName: 'totalUsers' }, desc: true }
        ]
      });

      devices = deviceResponse.rows?.map(row => {
        const count = parseInt(row.metricValues[0].value) || 0;
        return {
          device: row.dimensionValues[0].value,
          users: count,
          sessions: count  // フロントエンド互換性のため
        };
      }) || [];
    } catch (deviceError) {
      console.warn('Device data failed:', deviceError.message);
    }

    // サマリー計算
    const totalViews = daily.reduce((sum, d) => sum + d.views, 0);
    const avgDailyViews = daily.length > 0 ? (totalViews / daily.length).toFixed(1) : 0;

    // ユニークユーザー数と平均滞在時間を取得
    let totalUsers = 0;
    let avgSessionDuration = 0;
    try {
      const [userMetricsResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'userEngagementDuration' }
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: { value: 'view_company_page' }
                }
              },
              {
                filter: {
                  fieldName: 'customEvent:company_domain',
                  stringFilter: { value: domain }
                }
              }
            ]
          }
        }
      });

      const userMetrics = userMetricsResponse.rows?.[0]?.metricValues || [];
      totalUsers = parseInt(userMetrics[0]?.value) || 0;
      const totalEngagementTime = parseFloat(userMetrics[1]?.value) || 0;
      avgSessionDuration = totalUsers > 0 ? totalEngagementTime / totalUsers : 0;
    } catch (userMetricsError) {
      console.warn('User metrics data failed:', userMetricsError.message);
    }

    // 求人別パフォーマンスデータを取得
    const jobPerformance = await getJobPerformanceData(client, days, domain);

    // 平均閲覧求人数を計算（求人閲覧数 / ユニークユーザー数）
    const totalJobViews = jobPerformance.jobs?.reduce((sum, j) => sum + j.views, 0) || 0;
    const avgJobsViewed = totalUsers > 0 ? (totalJobViews / totalUsers).toFixed(1) : 0;

    return {
      domain,
      daily,
      traffic,
      devices,
      gender,
      age,
      jobs: jobPerformance.jobs || [],
      summary: {
        totalViews,
        totalUsers,
        avgDailyViews: parseFloat(avgDailyViews),
        avgSessionDuration: parseFloat(avgSessionDuration.toFixed(1)),
        avgJobsViewed: parseFloat(avgJobsViewed),
        topChannel: traffic[0]?.channel || 'データなし'
      }
    };
  } catch (error) {
    console.error('Company detail data error:', error.message);
    return { domain, daily: [], traffic: [], devices: [], gender: {}, age: {}, jobs: [], summary: {} };
  }
}

/**
 * 求人別パフォーマンスデータを取得
 * カスタムディメンション: job_id, job_title, company_domain が必要
 */
async function getJobPerformanceData(client, days, companyDomain = null) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // 求人詳細閲覧データ
    const viewFilter = {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'view_job_detail' }
      }
    };

    // 企業指定がある場合はフィルターを追加
    const dimensionFilter = companyDomain ? {
      andGroup: {
        expressions: [
          viewFilter,
          {
            filter: {
              fieldName: 'customEvent:company_domain',
              stringFilter: { value: companyDomain }
            }
          }
        ]
      }
    } : viewFilter;

    // 応募クリックデータ用フィルター
    const clickFilter = {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'click_apply' }
      }
    };
    const clickDimensionFilter = companyDomain ? {
      andGroup: {
        expressions: [
          clickFilter,
          { filter: { fieldName: 'customEvent:company_domain', stringFilter: { value: companyDomain } } }
        ]
      }
    } : clickFilter;

    // 3つのAPI呼び出しを並列実行
    const [viewResult, clickResult, dailyResult] = await Promise.all([
      // 求人詳細閲覧データ
      client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'customEvent:company_domain' },
          { name: 'customEvent:company_name' },
          { name: 'customEvent:job_id' },
          { name: 'customEvent:job_title' }
        ],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 100
      }),
      // 応募クリックデータ
      client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'customEvent:company_domain' },
          { name: 'customEvent:job_id' }
        ],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: clickDimensionFilter,
        limit: 100
      }),
      // 日別トレンド
      client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter,
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
      })
    ]);

    const [viewResponse] = viewResult;
    const [clickResponse] = clickResult;
    const [dailyResponse] = dailyResult;

    // クリック数をマップに変換
    const clicksMap = {};
    clickResponse.rows?.forEach(row => {
      const domain = row.dimensionValues[0].value;
      const jobId = row.dimensionValues[1].value;
      clicksMap[`${domain}:${jobId}`] = parseInt(row.metricValues[0].value) || 0;
    });

    // データを整形
    const jobs = viewResponse.rows?.map(row => {
      const domain = row.dimensionValues[0].value;
      const views = parseInt(row.metricValues[0].value) || 0;
      const key = `${domain}:${row.dimensionValues[2].value}`;
      const clicks = clicksMap[key] || 0;
      return {
        companyDomain: domain,
        companyName: row.dimensionValues[1].value,
        jobId: row.dimensionValues[2].value,
        jobTitle: row.dimensionValues[3].value,
        views,
        applications: clicks,
        cvr: parseFloat(views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0')
      };
    }) || [];

    const daily = dailyResponse.rows?.map(row => {
      const dateStr = row.dimensionValues[0].value;
      return {
        date: `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`,
        fullDate: `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`,
        views: parseInt(row.metricValues[0].value) || 0
      };
    }) || [];

    // サマリー
    const totalViews = jobs.reduce((sum, j) => sum + j.views, 0);
    const totalApplications = jobs.reduce((sum, j) => sum + j.applications, 0);
    const overallCvr = totalViews > 0 ? ((totalApplications / totalViews) * 100).toFixed(1) : '0.0';

    return {
      jobs,
      daily,
      summary: {
        totalJobs: jobs.length,
        totalViews,
        totalApplications,
        overallCvr: parseFloat(overallCvr),
        topJob: jobs[0] || null
      }
    };
  } catch (error) {
    console.warn('Job performance data failed:', error.message);
    return { jobs: [], daily: [], summary: {} };
  }
}

/**
 * Firestoreから最近の応募データを取得
 */
async function getRecentApplications(companyDomain = null, limit = 20) {
  try {
    const db = admin.firestore();
    let docs = [];

    if (companyDomain) {
      // まずFirestoreの直接クエリを試す（高速）
      try {
        const directSnapshot = await db.collection('applications')
          .where('companyDomain', '==', companyDomain)
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();

        if (directSnapshot.docs.length > 0) {
          docs = directSnapshot.docs;
        } else {
          // 直接クエリで見つからない場合のみ、フォールバック（100件に削減）
          const allDocsSnapshot = await db.collection('applications')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

          const normalizedTarget = companyDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
          docs = allDocsSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (!data.companyDomain) return false;
            const docDomain = data.companyDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
            return docDomain === normalizedTarget;
          });
        }
      } catch (queryError) {
        console.warn('[getRecentApplications] Query error:', queryError.message);
        docs = [];
      }
    } else {
      const snapshot = await db.collection('applications')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      docs = snapshot.docs;
    }

    const applications = docs.slice(0, limit).map(doc => {
      const data = doc.data();
      const timestamp = data.createdAt?.toDate() || data.timestamp || new Date();
      return {
        id: doc.id,
        companyDomain: data.companyDomain,
        companyName: data.companyName,
        jobId: data.jobId,
        jobTitle: data.jobTitle,
        type: data.type || 'apply',
        source: parseSource(data.source),
        date: formatApplicationDate(timestamp),
        timestamp: timestamp.toISOString()
      };
    });

    return { applications, total: applications.length };
  } catch (error) {
    console.warn('Recent applications error:', error.message);
    return { applications: [], total: 0 };
  }
}

/**
 * 応募日時をフォーマット
 */
function formatApplicationDate(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * 流入元を解析
 */
function parseSource(referrer) {
  if (!referrer || referrer === 'direct') return 'Direct';

  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();

    if (host.includes('google')) return 'Google';
    if (host.includes('yahoo')) return 'Yahoo';
    if (host.includes('twitter') || host.includes('x.com')) return 'Twitter/X';
    if (host.includes('facebook')) return 'Facebook';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('line')) return 'LINE';
    if (host.includes('indeed')) return 'Indeed';
    if (host.includes('doda')) return 'doda';
    if (host.includes('rikunabi')) return 'リクナビ';

    return host;
  } catch {
    return referrer.substring(0, 20);
  }
}

/**
 * ページアナリティクスイベントを受信・保存
 * LP・採用ページの独立した計測データをFirestoreに保存
 */
functions.http('trackPageAnalytics', (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // OPTIONSリクエスト（プリフライト）の処理
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
      }

      const eventData = req.body;

      // 必須フィールドのバリデーション
      if (!eventData.eventType || !eventData.pageType || !eventData.companyDomain) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: eventType, pageType, companyDomain'
        });
        return;
      }

      const db = admin.firestore();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // イベントデータを整形
      const event = {
        ...eventData,
        serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        receivedAt: now.toISOString()
      };

      // イベントをFirestoreに保存
      await db.collection('page_analytics_events').add(event);

      // 日次集計を更新
      const statsDocId = eventData.jobId
        ? `${eventData.pageType}_${eventData.companyDomain}_${eventData.jobId}`
        : `${eventData.pageType}_${eventData.companyDomain}`;

      const statsRef = db.collection('page_analytics_daily').doc(dateStr).collection('stats').doc(statsDocId);

      // トランザクションで集計を更新
      await db.runTransaction(async (transaction) => {
        const statsDoc = await transaction.get(statsRef);

        if (!statsDoc.exists) {
          // 新規作成
          const initialStats = {
            pageType: eventData.pageType,
            companyDomain: eventData.companyDomain,
            jobId: eventData.jobId || null,
            companyName: eventData.companyName || null,
            jobTitle: eventData.jobTitle || null,
            date: dateStr,
            pageViews: 0,
            uniqueVisitors: [],
            ctaClicks: 0,
            ctaClicksByType: {},
            scrollDepth: { '25': 0, '50': 0, '75': 0, '100': 0 },
            referrerTypes: {},
            devices: {},
            applications: 0,
            totalTimeOnPage: 0,
            timeOnPageCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          transaction.set(statsRef, initialStats);
        }

        const stats = statsDoc.exists ? statsDoc.data() : {};
        const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

        switch (eventData.eventType) {
          case 'page_view':
            updates.pageViews = (stats.pageViews || 0) + 1;
            const visitors = stats.uniqueVisitors || [];
            if (eventData.visitorId && !visitors.includes(eventData.visitorId) && visitors.length < 1000) {
              updates.uniqueVisitors = admin.firestore.FieldValue.arrayUnion(eventData.visitorId);
            }
            if (eventData.referrerType) {
              const refTypes = stats.referrerTypes || {};
              refTypes[eventData.referrerType] = (refTypes[eventData.referrerType] || 0) + 1;
              updates.referrerTypes = refTypes;
            }
            if (eventData.device) {
              const devices = stats.devices || {};
              devices[eventData.device] = (devices[eventData.device] || 0) + 1;
              updates.devices = devices;
            }
            if (eventData.companyName) updates.companyName = eventData.companyName;
            if (eventData.jobTitle) updates.jobTitle = eventData.jobTitle;
            break;

          case 'cta_click':
            updates.ctaClicks = (stats.ctaClicks || 0) + 1;
            if (eventData.buttonType) {
              const ctaTypes = stats.ctaClicksByType || {};
              ctaTypes[eventData.buttonType] = (ctaTypes[eventData.buttonType] || 0) + 1;
              updates.ctaClicksByType = ctaTypes;
            }
            break;

          case 'scroll_depth':
            if (eventData.depth) {
              const scrollDepth = stats.scrollDepth || { '25': 0, '50': 0, '75': 0, '100': 0 };
              scrollDepth[String(eventData.depth)] = (scrollDepth[String(eventData.depth)] || 0) + 1;
              updates.scrollDepth = scrollDepth;
            }
            break;

          case 'time_on_page':
            if (eventData.duration) {
              updates.totalTimeOnPage = (stats.totalTimeOnPage || 0) + eventData.duration;
              updates.timeOnPageCount = (stats.timeOnPageCount || 0) + 1;
            }
            break;

          case 'application_complete':
            updates.applications = (stats.applications || 0) + 1;
            break;
        }

        transaction.update(statsRef, updates);
      });

      res.status(200).json({ success: true, message: 'Event tracked' });

    } catch (error) {
      console.error('trackPageAnalytics error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * ページアナリティクスデータを取得
 */
functions.http('getPageAnalytics', (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      const { type = 'overview', days = 7, company_domain: companyDomain, page_type: pageType } = req.query;
      const db = admin.firestore();

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      let data;

      switch (type) {
        case 'overview':
          data = await getPageAnalyticsOverview(db, startDate, endDate, companyDomain, pageType);
          break;
        case 'daily':
          data = await getPageAnalyticsDaily(db, startDate, endDate, companyDomain, pageType);
          break;
        case 'companies':
          data = await getPageAnalyticsByCompany(db, startDate, endDate, pageType);
          break;
        case 'lp':
          data = await getPageAnalyticsByLP(db, startDate, endDate, companyDomain);
          break;
        case 'recruit':
          data = await getPageAnalyticsByRecruit(db, startDate, endDate, companyDomain);
          break;
        default:
          data = await getPageAnalyticsOverview(db, startDate, endDate, companyDomain, pageType);
      }

      res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });

    } catch (error) {
      console.error('getPageAnalytics error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// ページアナリティクス概要取得
async function getPageAnalyticsOverview(db, startDate, endDate, companyDomain = null, pageType = null) {
  const dateStr = d => d.toISOString().split('T')[0];
  const stats = {
    totalPageViews: 0,
    totalUniqueVisitors: new Set(),
    totalCtaClicks: 0,
    totalApplications: 0,
    avgTimeOnPage: 0,
    byPageType: { lp: { views: 0, clicks: 0 }, recruit: { views: 0, clicks: 0 } },
    byReferrer: {},
    byDevice: {}
  };

  let totalTime = 0, timeCount = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayStr = dateStr(currentDate);
    let query = db.collection('page_analytics_daily').doc(dayStr).collection('stats');

    const snapshot = await query.get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (companyDomain && data.companyDomain !== companyDomain) return;
      if (pageType && data.pageType !== pageType) return;

      stats.totalPageViews += data.pageViews || 0;
      stats.totalCtaClicks += data.ctaClicks || 0;
      stats.totalApplications += data.applications || 0;
      (data.uniqueVisitors || []).forEach(v => stats.totalUniqueVisitors.add(v));

      if (data.pageType === 'lp') {
        stats.byPageType.lp.views += data.pageViews || 0;
        stats.byPageType.lp.clicks += data.ctaClicks || 0;
      } else if (data.pageType === 'recruit') {
        stats.byPageType.recruit.views += data.pageViews || 0;
        stats.byPageType.recruit.clicks += data.ctaClicks || 0;
      }

      Object.entries(data.referrerTypes || {}).forEach(([ref, count]) => {
        stats.byReferrer[ref] = (stats.byReferrer[ref] || 0) + count;
      });

      Object.entries(data.devices || {}).forEach(([device, count]) => {
        stats.byDevice[device] = (stats.byDevice[device] || 0) + count;
      });

      totalTime += data.totalTimeOnPage || 0;
      timeCount += data.timeOnPageCount || 0;
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  stats.totalUniqueVisitors = stats.totalUniqueVisitors.size;
  stats.avgTimeOnPage = timeCount > 0 ? Math.round(totalTime / timeCount) : 0;

  return stats;
}

// ページアナリティクス日別データ取得
async function getPageAnalyticsDaily(db, startDate, endDate, companyDomain = null, pageType = null) {
  const dateStr = d => d.toISOString().split('T')[0];
  const daily = [];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayStr = dateStr(currentDate);
    const snapshot = await db.collection('page_analytics_daily').doc(dayStr).collection('stats').get();

    let dayStats = { date: dayStr, pageViews: 0, uniqueVisitors: new Set(), ctaClicks: 0, applications: 0 };

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (companyDomain && data.companyDomain !== companyDomain) return;
      if (pageType && data.pageType !== pageType) return;

      dayStats.pageViews += data.pageViews || 0;
      dayStats.ctaClicks += data.ctaClicks || 0;
      dayStats.applications += data.applications || 0;
      (data.uniqueVisitors || []).forEach(v => dayStats.uniqueVisitors.add(v));
    });

    dayStats.uniqueVisitors = dayStats.uniqueVisitors.size;
    daily.push(dayStats);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return daily;
}

// 会社別ページアナリティクス取得
async function getPageAnalyticsByCompany(db, startDate, endDate, pageType = null) {
  const dateStr = d => d.toISOString().split('T')[0];
  const companyStats = {};

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayStr = dateStr(currentDate);
    const snapshot = await db.collection('page_analytics_daily').doc(dayStr).collection('stats').get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (pageType && data.pageType !== pageType) return;

      const domain = data.companyDomain;
      if (!companyStats[domain]) {
        companyStats[domain] = {
          companyDomain: domain,
          companyName: data.companyName || domain,
          lpViews: 0, lpClicks: 0, recruitViews: 0, recruitClicks: 0,
          totalApplications: 0, uniqueVisitors: new Set()
        };
      }

      if (data.pageType === 'lp') {
        companyStats[domain].lpViews += data.pageViews || 0;
        companyStats[domain].lpClicks += data.ctaClicks || 0;
      } else if (data.pageType === 'recruit') {
        companyStats[domain].recruitViews += data.pageViews || 0;
        companyStats[domain].recruitClicks += data.ctaClicks || 0;
      }

      companyStats[domain].totalApplications += data.applications || 0;
      (data.uniqueVisitors || []).forEach(v => companyStats[domain].uniqueVisitors.add(v));
      if (data.companyName) companyStats[domain].companyName = data.companyName;
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return Object.values(companyStats)
    .map(c => ({
      ...c,
      uniqueVisitors: c.uniqueVisitors.size,
      totalViews: c.lpViews + c.recruitViews,
      totalClicks: c.lpClicks + c.recruitClicks
    }))
    .sort((a, b) => b.totalViews - a.totalViews);
}

// LP別アナリティクス取得
async function getPageAnalyticsByLP(db, startDate, endDate, companyDomain = null) {
  const dateStr = d => d.toISOString().split('T')[0];
  const lpStats = {};

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayStr = dateStr(currentDate);
    const snapshot = await db.collection('page_analytics_daily').doc(dayStr).collection('stats').get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.pageType !== 'lp') return;
      if (companyDomain && data.companyDomain !== companyDomain) return;

      const key = data.jobId ? `${data.companyDomain}_${data.jobId}` : data.companyDomain;
      if (!lpStats[key]) {
        lpStats[key] = {
          companyDomain: data.companyDomain,
          jobId: data.jobId || null,
          companyName: data.companyName || data.companyDomain,
          jobTitle: data.jobTitle || null,
          pageViews: 0, ctaClicks: 0, applications: 0,
          uniqueVisitors: new Set(), referrerTypes: {}, devices: {}
        };
      }

      lpStats[key].pageViews += data.pageViews || 0;
      lpStats[key].ctaClicks += data.ctaClicks || 0;
      lpStats[key].applications += data.applications || 0;
      (data.uniqueVisitors || []).forEach(v => lpStats[key].uniqueVisitors.add(v));

      Object.entries(data.referrerTypes || {}).forEach(([ref, count]) => {
        lpStats[key].referrerTypes[ref] = (lpStats[key].referrerTypes[ref] || 0) + count;
      });
      Object.entries(data.devices || {}).forEach(([device, count]) => {
        lpStats[key].devices[device] = (lpStats[key].devices[device] || 0) + count;
      });

      if (data.companyName) lpStats[key].companyName = data.companyName;
      if (data.jobTitle) lpStats[key].jobTitle = data.jobTitle;
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return Object.values(lpStats)
    .map(lp => ({
      ...lp,
      uniqueVisitors: lp.uniqueVisitors.size,
      cvr: lp.pageViews > 0 ? ((lp.ctaClicks / lp.pageViews) * 100).toFixed(1) : '0.0'
    }))
    .sort((a, b) => b.pageViews - a.pageViews);
}

// 採用ページ別アナリティクス取得
async function getPageAnalyticsByRecruit(db, startDate, endDate, companyDomain = null) {
  const dateStr = d => d.toISOString().split('T')[0];
  const recruitStats = {};

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayStr = dateStr(currentDate);
    const snapshot = await db.collection('page_analytics_daily').doc(dayStr).collection('stats').get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.pageType !== 'recruit') return;
      if (companyDomain && data.companyDomain !== companyDomain) return;

      const domain = data.companyDomain;
      if (!recruitStats[domain]) {
        recruitStats[domain] = {
          companyDomain: domain,
          companyName: data.companyName || domain,
          pageViews: 0, ctaClicks: 0, applications: 0,
          uniqueVisitors: new Set(), referrerTypes: {}, devices: {}
        };
      }

      recruitStats[domain].pageViews += data.pageViews || 0;
      recruitStats[domain].ctaClicks += data.ctaClicks || 0;
      recruitStats[domain].applications += data.applications || 0;
      (data.uniqueVisitors || []).forEach(v => recruitStats[domain].uniqueVisitors.add(v));

      Object.entries(data.referrerTypes || {}).forEach(([ref, count]) => {
        recruitStats[domain].referrerTypes[ref] = (recruitStats[domain].referrerTypes[ref] || 0) + count;
      });
      Object.entries(data.devices || {}).forEach(([device, count]) => {
        recruitStats[domain].devices[device] = (recruitStats[domain].devices[device] || 0) + count;
      });

      if (data.companyName) recruitStats[domain].companyName = data.companyName;
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return Object.values(recruitStats)
    .map(r => ({
      ...r,
      uniqueVisitors: r.uniqueVisitors.size,
      cvr: r.pageViews > 0 ? ((r.ctaClicks / r.pageViews) * 100).toFixed(1) : '0.0'
    }))
    .sort((a, b) => b.pageViews - a.pageViews);
}

/**
 * ヘルスチェック用エンドポイント
 */
functions.http('health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========================================
// Google Calendar連携機能
// ========================================

const { google } = require('googleapis');
const crypto = require('crypto');

// 環境変数からOAuth設定を取得
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://asia-northeast1-generated-area-484613-e3-90bd4.cloudfunctions.net/calendarOAuthCallback';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-for-development-32b';

// OAuth2クライアントを作成
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

// トークンを暗号化
function encryptToken(token) {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

// トークンを復号
function decryptToken(encryptedToken) {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// stateを生成（CSRF対策）
function generateState(data) {
  const stateData = JSON.stringify({
    ...data,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex')
  });
  return Buffer.from(stateData).toString('base64url');
}

// stateを検証
function verifyState(state) {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const data = JSON.parse(decoded);
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * カレンダーOAuth認証を開始
 */
functions.http('initiateCalendarAuth', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { companyDomain, companyUserId, staffName } = req.body;

      if (!companyDomain || !companyUserId) {
        return res.status(400).json({ error: 'companyDomain and companyUserId are required' });
      }

      // フロントエンドのコールバックURLを使用（GitHub Pages上）
      const frontendRedirectUri = process.env.FRONTEND_CALLBACK_URL || 'https://togawa-design.github.io/oauth-callback.html';
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        frontendRedirectUri
      );

      const state = generateState({ companyDomain, companyUserId, staffName });

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        state,
        prompt: 'consent'
      });

      res.json({ success: true, authUrl });

    } catch (error) {
      console.error('initiateCalendarAuth error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * OAuth コールバック処理
 */
functions.http('calendarOAuthCallback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send(`<html><body><h2>認証がキャンセルされました</h2><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    const stateData = verifyState(state);
    if (!stateData) {
      return res.status(400).send('Invalid or expired state');
    }

    const { companyDomain, companyUserId, staffName } = stateData;

    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email;

    const db = admin.firestore();
    const integrationData = {
      companyDomain,
      companyUserId,
      staffName: staffName || '',
      googleEmail,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      tokenExpiresAt: tokens.expiry_date ? admin.firestore.Timestamp.fromMillis(tokens.expiry_date) : null,
      calendarId: 'primary',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const existingQuery = await db.collection('calendar_integrations')
      .where('companyDomain', '==', companyDomain)
      .where('companyUserId', '==', companyUserId)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      await existingQuery.docs[0].ref.update({
        ...integrationData,
        createdAt: existingQuery.docs[0].data().createdAt
      });
    } else {
      await db.collection('calendar_integrations').add(integrationData);
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head><meta charset="UTF-8"><title>カレンダー連携完了</title>
      <style>body{font-family:sans-serif;text-align:center;padding:50px}.success{color:#10b981;font-size:48px}</style></head>
      <body>
        <div class="success">✓</div>
        <h2>カレンダー連携が完了しました</h2>
        <p>連携アカウント: ${googleEmail}</p>
        <script>setTimeout(() => { if(window.opener){window.opener.postMessage({type:'calendar_auth_success',email:'${googleEmail}'},'*');} window.close(); }, 2000);</script>
      </body></html>
    `);

  } catch (error) {
    console.error('calendarOAuthCallback error:', error);
    res.status(500).send(`<html><body><h2>エラーが発生しました</h2><p>${error.message}</p></body></html>`);
  }
});

/**
 * フロントエンドからのトークン交換リクエストを処理
 * フロントエンドのoauth-callback.htmlから呼び出される
 */
functions.http('exchangeCalendarToken', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // Firebase認証を確認（オプション - ログ用）
      const authUser = await verifyToken(req);
      if (authUser) {
        console.log(`Token exchange initiated by: ${authUser.email || authUser.uid}`);
      }

      const { code, companyDomain, companyUserId, staffName } = req.body;

      if (!code || !companyDomain || !companyUserId) {
        return res.status(400).json({ error: 'code, companyDomain, and companyUserId are required' });
      }

      // フロントエンドコールバック用のOAuth2クライアントを作成
      const frontendRedirectUri = process.env.FRONTEND_CALLBACK_URL || 'https://togawa-design.github.io/oauth-callback.html';
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        frontendRedirectUri
      );

      // 認可コードをトークンに交換
      const { tokens } = await oauth2Client.getToken(code);

      // Googleアカウント情報を取得
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email;

      // Firestoreに保存
      const db = admin.firestore();
      const integrationData = {
        companyDomain,
        companyUserId,
        staffName: staffName || '',
        googleEmail,
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokenExpiresAt: tokens.expiry_date ? admin.firestore.Timestamp.fromMillis(tokens.expiry_date) : null,
        calendarId: 'primary',
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // 既存の連携を確認
      const existingQuery = await db.collection('calendar_integrations')
        .where('companyDomain', '==', companyDomain)
        .where('companyUserId', '==', companyUserId)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        // 既存の連携を更新
        await existingQuery.docs[0].ref.update(integrationData);
      } else {
        // 新規作成
        integrationData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('calendar_integrations').add(integrationData);
      }

      console.log(`Calendar integration saved for ${companyUserId} (${googleEmail})`);
      res.json({ success: true, email: googleEmail });

    } catch (error) {
      console.error('exchangeCalendarToken error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * カレンダー連携を解除
 */
functions.http('revokeCalendarAuth', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const { companyDomain, companyUserId } = req.body;
      if (!companyDomain || !companyUserId) {
        return res.status(400).json({ error: 'companyDomain and companyUserId are required' });
      }

      const db = admin.firestore();
      const query = await db.collection('calendar_integrations')
        .where('companyDomain', '==', companyDomain)
        .where('companyUserId', '==', companyUserId)
        .limit(1)
        .get();

      if (query.empty) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      await query.docs[0].ref.delete();
      res.json({ success: true });

    } catch (error) {
      console.error('revokeCalendarAuth error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * カレンダーの空き時間を取得
 */
functions.http('getCalendarAvailability', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // GET または POST に対応
      const companyDomain = req.query.companyDomain || req.body?.companyDomain;
      const companyUserId = req.query.companyUserId || req.body?.companyUserId;
      const startDate = req.query.startDate || req.body?.startDate;
      const endDate = req.query.endDate || req.body?.endDate;
      const durationMinutes = parseInt(req.query.durationMinutes || req.body?.durationMinutes) || 60;
      if (!companyDomain || !companyUserId || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const db = admin.firestore();
      const query = await db.collection('calendar_integrations')
        .where('companyDomain', '==', companyDomain)
        .where('companyUserId', '==', companyUserId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (query.empty) {
        return res.status(404).json({ error: 'Calendar integration not found' });
      }

      const integration = query.docs[0].data();
      const accessToken = decryptToken(integration.accessToken);
      const refreshToken = integration.refreshToken ? decryptToken(integration.refreshToken) : null;

      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

      if (integration.tokenExpiresAt && integration.tokenExpiresAt.toDate() < new Date()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await query.docs[0].ref.update({
          accessToken: encryptToken(credentials.access_token),
          tokenExpiresAt: credentials.expiry_date ? admin.firestore.Timestamp.fromMillis(credentials.expiry_date) : null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        oauth2Client.setCredentials(credentials);
      }

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      // Convert date strings to JST midnight and end of day
      const JST_OFFSET = 9 * 60 * 60 * 1000;
      const startParts = startDate.split('-');
      const endParts = endDate.split('-');
      const timeMinJST = new Date(Date.UTC(
        parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]),
        0, 0, 0, 0
      ) - JST_OFFSET);
      const timeMaxJST = new Date(Date.UTC(
        parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]),
        23, 59, 59, 999
      ) - JST_OFFSET);

      const eventsResponse = await calendar.events.list({
        calendarId: integration.calendarId || 'primary',
        timeMin: timeMinJST.toISOString(),
        timeMax: timeMaxJST.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: 'Asia/Tokyo'
      });

      const busySlots = (eventsResponse.data.items || [])
        .filter(event => event.start && event.end)
        .map(event => ({ start: event.start.dateTime || event.start.date, end: event.end.dateTime || event.end.date }));

      const availableSlots = calculateAvailableSlots(new Date(startDate), new Date(endDate), busySlots, durationMinutes);

      res.json({ success: true, availableSlots, busySlots });

    } catch (error) {
      console.error('getCalendarAvailability error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

function calculateAvailableSlots(startDate, endDate, busySlots, durationMinutes) {
  const slots = [];
  const businessHourStart = 9;
  const businessHourEnd = 18;
  const slotInterval = 30;
  const JST_OFFSET = 9 * 60 * 60 * 1000; // JST is UTC+9

  // Parse dates as JST
  const startParts = startDate.toISOString().split('T')[0].split('-');
  const endParts = endDate.toISOString().split('T')[0].split('-');

  // Create date at midnight JST (which is 15:00 UTC previous day)
  let currentDateJST = new Date(Date.UTC(
    parseInt(startParts[0]),
    parseInt(startParts[1]) - 1,
    parseInt(startParts[2]),
    0, 0, 0, 0
  ) - JST_OFFSET);

  const lastDateJST = new Date(Date.UTC(
    parseInt(endParts[0]),
    parseInt(endParts[1]) - 1,
    parseInt(endParts[2]),
    23, 59, 59, 999
  ) - JST_OFFSET);

  while (currentDateJST <= lastDateJST) {
    // Get JST day of week
    const jstTime = new Date(currentDateJST.getTime() + JST_OFFSET);
    const dayOfWeek = jstTime.getUTCDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDateJST = new Date(currentDateJST.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }

    for (let hour = businessHourStart; hour < businessHourEnd; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        // Create slot in JST
        const slotStartJST = new Date(Date.UTC(
          jstTime.getUTCFullYear(),
          jstTime.getUTCMonth(),
          jstTime.getUTCDate(),
          hour, minute, 0, 0
        ) - JST_OFFSET);

        const slotEndJST = new Date(slotStartJST.getTime() + durationMinutes * 60 * 1000);

        // Check if slot end is within business hours (in JST)
        const slotEndHourJST = new Date(slotEndJST.getTime() + JST_OFFSET).getUTCHours();
        const slotEndMinuteJST = new Date(slotEndJST.getTime() + JST_OFFSET).getUTCMinutes();

        if (slotEndHourJST > businessHourEnd || (slotEndHourJST === businessHourEnd && slotEndMinuteJST > 0)) continue;
        if (slotStartJST <= new Date()) continue;

        const isOverlapping = busySlots.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStartJST < busyEnd && slotEndJST > busyStart;
        });

        if (!isOverlapping) {
          slots.push({ start: slotStartJST.toISOString(), end: slotEndJST.toISOString() });
        }
      }
    }
    currentDateJST = new Date(currentDateJST.getTime() + 24 * 60 * 60 * 1000);
  }
  return slots;
}

/**
 * カレンダーに予定を作成
 */
functions.http('createCalendarEvent', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const { companyDomain, companyUserId, applicationId, scheduledAt, durationMinutes = 60, location = '', meetingType = 'in_person', applicantName, applicantEmail, staffName, jobTitle, reminders = [] } = req.body;

      if (!companyDomain || !companyUserId || !applicationId || !scheduledAt) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const db = admin.firestore();
      const integrationQuery = await db.collection('calendar_integrations')
        .where('companyDomain', '==', companyDomain)
        .where('companyUserId', '==', companyUserId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (integrationQuery.empty) {
        return res.status(404).json({ error: 'Calendar integration not found' });
      }

      const integration = integrationQuery.docs[0].data();
      const accessToken = decryptToken(integration.accessToken);
      const refreshToken = integration.refreshToken ? decryptToken(integration.refreshToken) : null;

      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const startTime = new Date(scheduledAt);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      const event = {
        summary: `【面談】${applicantName}様`,
        description: `求人: ${jobTitle || '未設定'}\n応募者: ${applicantName}\nメール: ${applicantEmail || '未設定'}\n\n※ L-SET採用管理システムから自動登録`,
        start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Tokyo' },
        end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Tokyo' },
        location: meetingType === 'online' ? '' : location,
        attendees: applicantEmail ? [{ email: applicantEmail }] : [],
        reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 60 }] }
      };

      // オンライン面談の場合はGoogle Meetを自動生成
      console.log('[createCalendarEvent] meetingType:', meetingType);
      if (meetingType === 'online') {
        event.conferenceData = {
          createRequest: {
            requestId: `meet-${applicationId}-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        };
        console.log('[createCalendarEvent] Adding conferenceData to event');
      }

      const createdEvent = await calendar.events.insert({
        calendarId: integration.calendarId || 'primary',
        resource: event,
        sendUpdates: 'all',
        conferenceDataVersion: meetingType === 'online' ? 1 : 0
      });

      console.log('[createCalendarEvent] Event created, conferenceData:', JSON.stringify(createdEvent.data.conferenceData));

      // Meetリンクを取得
      const meetLink = createdEvent.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;
      console.log('[createCalendarEvent] meetLink:', meetLink);

      const interviewData = {
        companyDomain,
        applicationId,
        applicantName,
        applicantEmail: applicantEmail || '',
        staffUserId: companyUserId,
        staffName: staffName || integration.staffName || '',
        scheduledAt: admin.firestore.Timestamp.fromDate(startTime),
        durationMinutes,
        location: meetLink || location,
        meetLink: meetLink || null,
        meetingType,
        jobTitle: jobTitle || '',
        googleEventId: createdEvent.data.id,
        status: 'scheduled',
        reminders: reminders.map(r => ({
          ...r,
          status: 'pending',
          scheduledAt: admin.firestore.Timestamp.fromDate(new Date(startTime.getTime() - r.offsetMinutes * 60 * 1000)),
          sentAt: null
        })),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const interviewRef = await db.collection('interviews').add(interviewData);

      await db.collection('applications').doc(applicationId).update({
        interviewId: interviewRef.id,
        interviewStatus: 'scheduled',
        status: 'interviewing',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true, interviewId: interviewRef.id, googleEventId: createdEvent.data.id, meetLink });

    } catch (error) {
      console.error('createCalendarEvent error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * カレンダー連携状態を取得
 */
functions.http('getCalendarIntegration', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // GET または POST に対応
      const companyDomain = req.query.companyDomain || req.body?.companyDomain;
      const companyUserId = req.query.companyUserId || req.body?.companyUserId;
      if (!companyDomain || !companyUserId) {
        return res.status(400).json({ error: 'companyDomain and companyUserId are required' });
      }

      const db = admin.firestore();
      const query = await db.collection('calendar_integrations')
        .where('companyDomain', '==', companyDomain)
        .where('companyUserId', '==', companyUserId)
        .limit(1)
        .get();

      if (query.empty) {
        return res.json({ success: true, integration: null });
      }

      const integrationData = query.docs[0].data();
      res.json({
        success: true,
        integration: {
          isActive: integrationData.isActive === true,
          email: integrationData.googleEmail,
          staffName: integrationData.staffName
        }
      });

    } catch (error) {
      console.error('getCalendarIntegration error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// =====================================================
// 会社ユーザー管理 Cloud Functions
// =====================================================

/**
 * IDトークンを検証して管理者かどうかを確認するヘルパー関数
 */
async function verifyAdminToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: '認証トークンがありません' };
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // admin_users コレクションで管理者かどうかを確認
    const db = admin.firestore();
    const adminDoc = await db.collection('admin_users').doc(uid).get();

    if (!adminDoc.exists) {
      return { success: false, error: '管理者権限がありません' };
    }

    return { success: true, uid, email: decodedToken.email };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { success: false, error: '認証に失敗しました' };
  }
}

/**
 * 会社ユーザーを作成（管理者のみ）
 * Firebase Auth でアカウントを作成し、Firestore にメタ情報を保存
 *
 * 複数会社対応:
 * - 同じメール + 同じ会社 → エラー
 * - 同じメール + 別の会社 → Firebase Auth はスキップ、company_users に追加
 */
functions.http('createCompanyUser', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // 管理者認証チェック
      const authResult = await verifyAdminToken(req);
      if (!authResult.success) {
        return res.status(403).json({ success: false, error: authResult.error });
      }

      const { email, password, companyDomain, name, role, username } = req.body;

      // 必須パラメータチェック
      if (!email || !companyDomain) {
        return res.status(400).json({
          success: false,
          error: 'email と companyDomain は必須です'
        });
      }

      const db = admin.firestore();

      // 同じメール + 同じ会社の組み合わせが既に存在するかチェック
      const sameCompanyQuery = await db.collection('company_users')
        .where('email', '==', email)
        .where('companyDomain', '==', companyDomain)
        .limit(1)
        .get();

      if (!sameCompanyQuery.empty) {
        return res.status(400).json({
          success: false,
          error: 'このユーザーは既にこの会社に登録されています'
        });
      }

      // 同じメールアドレスが他の会社で既に存在するかチェック（company_users）
      const existingQuery = await db.collection('company_users')
        .where('email', '==', email)
        .limit(1)
        .get();

      let uid;
      let isExistingUser = false;

      if (!existingQuery.empty) {
        // company_users に既存ユーザーがいる場合
        const existingData = existingQuery.docs[0].data();
        uid = existingData.uid;
        isExistingUser = true;
        console.log(`[createCompanyUser] Adding existing user ${email} to company ${companyDomain}`);
      } else {
        // company_users にはないが、Firebase Auth に存在するかチェック
        let existingAuthUser = null;
        try {
          existingAuthUser = await admin.auth().getUserByEmail(email);
        } catch (authError) {
          // auth/user-not-found は無視（新規ユーザー）
          if (authError.code !== 'auth/user-not-found') {
            throw authError;
          }
        }

        if (existingAuthUser) {
          // Firebase Auth には存在するが company_users にはないケース
          uid = existingAuthUser.uid;
          isExistingUser = true;
          console.log(`[createCompanyUser] Found existing Firebase Auth user ${email} (uid: ${uid}), adding to company ${companyDomain}`);
        } else {
          // 完全な新規ユーザー: パスワード必須チェック
          if (!password) {
            return res.status(400).json({
              success: false,
              error: '新規ユーザーにはパスワードが必須です'
            });
          }

          // パスワード長チェック
          if (password.length < 8) {
            return res.status(400).json({
              success: false,
              error: 'パスワードは8文字以上で入力してください'
            });
          }

          // Firebase Auth でユーザー作成
          const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name || username || email.split('@')[0]
          });

          uid = userRecord.uid;
          console.log(`[createCompanyUser] Created new Firebase Auth user: ${uid}`);
        }
      }

      // ドキュメントID: 複数会社対応のため uid_companyDomain 形式
      // 最初の登録は uid のみ、追加の会社は uid_companyDomain
      const docId = isExistingUser ? `${uid}_${companyDomain}` : uid;

      // Firestore にユーザー情報を保存（パスワードは保存しない）
      await db.collection('company_users').doc(docId).set({
        uid: uid,
        email: email,
        username: username || email.split('@')[0],
        companyDomain: companyDomain,
        name: name || '',
        role: role || 'staff',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        uid: uid,
        docId: docId,
        email: email,
        isExistingUser: isExistingUser,
        message: isExistingUser
          ? `既存ユーザーを ${companyDomain} に追加しました`
          : 'ユーザーを作成しました'
      });

    } catch (error) {
      console.error('createCompanyUser error:', error);

      // Firebase Auth エラーを日本語化
      let errorMessage = error.message;
      if (error.code === 'auth/email-already-exists') {
        errorMessage = 'このメールアドレスは既にFirebase Authに登録されています。管理者にお問い合わせください。';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'パスワードが弱すぎます';
      }

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });
});

/**
 * 会社スタッフを作成（会社ユーザーが自社スタッフを追加）
 * Firebase Auth でアカウントを作成し、Firestore にメタ情報を保存
 */
functions.http('createCompanyStaff', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // 会社ユーザー認証チェック
      const decodedToken = await verifyToken(req);
      if (!decodedToken) {
        return res.status(401).json({ success: false, error: '認証が必要です' });
      }

      const callerUid = decodedToken.uid;
      const db = admin.firestore();

      // 呼び出し元ユーザーの会社情報を取得
      const callerDoc = await db.collection('company_users').doc(callerUid).get();
      let callerCompanyDomain = null;

      if (callerDoc.exists) {
        callerCompanyDomain = callerDoc.data().companyDomain;
      } else {
        // UID以外のドキュメントを検索（email で検索）
        const callerSnapshot = await db.collection('company_users')
          .where('email', '==', decodedToken.email)
          .limit(1)
          .get();

        if (!callerSnapshot.empty) {
          callerCompanyDomain = callerSnapshot.docs[0].data().companyDomain;
        }
      }

      if (!callerCompanyDomain) {
        return res.status(403).json({ success: false, error: '会社ユーザーのみがスタッフを追加できます' });
      }

      const { email, password, name, username } = req.body;

      // 必須パラメータチェック
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'email と password は必須です'
        });
      }

      // パスワード長チェック
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'パスワードは8文字以上で入力してください'
        });
      }

      // 同じメールアドレスが既に存在するかチェック
      const existingQuery = await db.collection('company_users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        return res.status(400).json({
          success: false,
          error: 'このメールアドレスは既に使用されています'
        });
      }

      // 会社名を取得
      let companyName = callerCompanyDomain;
      try {
        const companyDoc = await db.collection('companies').doc(callerCompanyDomain).get();
        if (companyDoc.exists) {
          companyName = companyDoc.data().name || callerCompanyDomain;
        }
      } catch (e) {
        console.warn('Failed to get company name:', e);
      }

      // Firebase Auth でユーザー作成
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: name || username || email.split('@')[0]
      });

      const uid = userRecord.uid;

      // Firestore にユーザー情報を保存（パスワードは保存しない）
      await db.collection('company_users').doc(uid).set({
        uid: uid,
        email: email,
        username: username || email.split('@')[0],
        companyDomain: callerCompanyDomain,
        companyName: companyName,
        name: name || '',
        role: 'staff',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        uid: uid,
        email: email,
        message: 'スタッフを作成しました'
      });

    } catch (error) {
      console.error('createCompanyStaff error:', error);

      // Firebase Auth エラーを日本語化
      let errorMessage = error.message;
      if (error.code === 'auth/email-already-exists') {
        errorMessage = 'このメールアドレスは既に使用されています';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'パスワードが弱すぎます';
      }

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });
});

/**
 * 会社ユーザーを削除（管理者のみ）
 * Firebase Auth と Firestore の両方から削除
 */
functions.http('deleteCompanyUser', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // 管理者認証チェック
      const authResult = await verifyAdminToken(req);
      if (!authResult.success) {
        return res.status(403).json({ success: false, error: authResult.error });
      }

      const { uid } = req.body;

      if (!uid) {
        return res.status(400).json({
          success: false,
          error: 'uid は必須です'
        });
      }

      // Firebase Auth からユーザーを削除
      try {
        await admin.auth().deleteUser(uid);
      } catch (authError) {
        console.warn('Firebase Auth からの削除に失敗:', authError.message);
        // Auth に存在しない場合でも Firestore からは削除を続行
      }

      // Firestore からユーザー情報を削除
      const db = admin.firestore();
      await db.collection('company_users').doc(uid).delete();

      res.json({
        success: true,
        message: 'ユーザーを削除しました'
      });

    } catch (error) {
      console.error('deleteCompanyUser error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * 既存の会社ユーザーを Firebase Auth に移行
 * Firestore の company_users から読み込み、Firebase Auth にアカウント作成
 */
functions.http('migrateCompanyUsersToFirebaseAuth', (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      // 一時的な移行キー（使用後は削除すること）
      const { migrationKey } = req.body;
      const TEMP_MIGRATION_KEY = 'rikueco_migrate_2026_temp';

      if (migrationKey !== TEMP_MIGRATION_KEY) {
        // 管理者認証チェック
        const authResult = await verifyAdminToken(req);
        if (!authResult.success) {
          return res.status(403).json({ success: false, error: authResult.error });
        }
      }

      const db = admin.firestore();

      // 既存のレガシーユーザーを取得（_legacyAuth フラグがあるもの）
      const snapshot = await db.collection('company_users').get();

      const results = {
        total: snapshot.size,
        migrated: 0,
        skipped: 0,
        errors: []
      };

      for (const doc of snapshot.docs) {
        const userData = doc.data();

        // 既に Firebase Auth UID を持っている場合はスキップ
        if (userData.uid && !userData._legacyAuth) {
          results.skipped++;
          continue;
        }

        // email と password が必要
        const email = userData.email;
        const password = userData.password;

        if (!email || !password) {
          results.errors.push({
            id: doc.id,
            error: 'email または password が見つかりません'
          });
          continue;
        }

        try {
          // Firebase Auth でユーザー作成
          const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: userData.name || userData.username || email.split('@')[0]
          });

          const newUid = userRecord.uid;

          // 新しいドキュメントを作成（UIDをドキュメントIDとして使用）
          const newUserData = {
            uid: newUid,
            email: email,
            username: userData.username || email.split('@')[0],
            companyDomain: userData.companyDomain,
            name: userData.name || '',
            role: userData.role || 'staff',
            isActive: userData.isActive !== false,
            createdAt: userData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFrom: doc.id
            // password フィールドは含めない
          };

          await db.collection('company_users').doc(newUid).set(newUserData);

          // 旧ドキュメントを削除
          if (doc.id !== newUid) {
            await db.collection('company_users').doc(doc.id).delete();
          }

          results.migrated++;

        } catch (userError) {
          // メールアドレスが既に存在する場合
          if (userError.code === 'auth/email-already-exists') {
            // 既存のユーザーを取得してリンク
            try {
              const existingUser = await admin.auth().getUserByEmail(email);
              const existingUid = existingUser.uid;

              // Firestore のドキュメントを更新
              await db.collection('company_users').doc(existingUid).set({
                ...userData,
                uid: existingUid,
                _legacyAuth: admin.firestore.FieldValue.delete(),
                password: admin.firestore.FieldValue.delete(),
                migratedAt: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });

              // 旧ドキュメントを削除
              if (doc.id !== existingUid) {
                await db.collection('company_users').doc(doc.id).delete();
              }

              results.migrated++;
            } catch (linkError) {
              results.errors.push({
                id: doc.id,
                email: email,
                error: linkError.message
              });
            }
          } else {
            results.errors.push({
              id: doc.id,
              email: email,
              error: userError.message
            });
          }
        }
      }

      res.json({
        success: true,
        results: results,
        message: `${results.migrated}件のユーザーを移行しました`
      });

    } catch (error) {
      console.error('migrateCompanyUsersToFirebaseAuth error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * legacyLogin - レガシー認証（Firebase Auth を使わない旧ユーザー用）
 * パスワードの照合をバックエンドで行い、セキュリティを確保
 */
functions.http('legacyLogin', async (req, res) => {
  // Gen2 Cloud Functions 用の CORS ヘッダー設定
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://127.0.0.1:3000',
    'https://togawa-design.github.io'
  ];

  const origin = req.headers.origin || '';

  // CORS ヘッダーを常に設定（preflight対応）
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    // 開発環境用: localhostからのリクエストを許可
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      res.set('Access-Control-Allow-Origin', origin);
    }
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '3600');

  // Preflight リクエストの処理
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

    try {
      const { usernameOrEmail, password } = req.body;

      if (!usernameOrEmail || !password) {
        res.status(400).json({ success: false, error: 'ユーザーIDとパスワードを入力してください' });
        return;
      }

      const db = admin.firestore();
      const isEmail = usernameOrEmail.includes('@');
      let matchingDocs = [];

      // パスワード検証ヘルパー（bcryptハッシュと平文の両方に対応）
      const verifyPassword = async (storedPassword, inputPassword) => {
        if (!storedPassword) return false;
        // bcryptハッシュは$2a$, $2b$, $2y$で始まる
        if (storedPassword.startsWith('$2')) {
          return await bcrypt.compare(inputPassword, storedPassword);
        }
        // 平文パスワード（レガシー）
        return storedPassword === inputPassword;
      };

      // パスワードをハッシュ化してマイグレーション
      const migratePasswordIfNeeded = async (docId, storedPassword) => {
        if (storedPassword && !storedPassword.startsWith('$2')) {
          const hashedPassword = await bcrypt.hash(storedPassword, 10);
          await db.collection('company_users').doc(docId).update({
            password: hashedPassword,
            passwordMigratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[legacyLogin] Password migrated to bcrypt for user: ${docId}`);
        }
      };

      if (isEmail) {
        // emailで検索
        const snapshot = await db.collection('company_users')
          .where('email', '==', usernameOrEmail)
          .get();

        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (data.isActive === false) continue;
          const isValid = await verifyPassword(data.password, password);
          if (isValid) {
            matchingDocs.push(doc);
            // 平文パスワードの場合はハッシュ化してマイグレーション
            migratePasswordIfNeeded(doc.id, data.password).catch(e => {
              console.error('Password migration failed:', e);
            });
          }
        }
      } else {
        // usernameで検索
        const snapshot = await db.collection('company_users')
          .where('username', '==', usernameOrEmail)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          if (data.isActive !== false) {
            const isValid = await verifyPassword(data.password, password);
            if (isValid) {
              matchingDocs = [doc];
              // 平文パスワードの場合はハッシュ化してマイグレーション
              migratePasswordIfNeeded(doc.id, data.password).catch(e => {
                console.error('Password migration failed:', e);
              });
            }
          }
        }
      }

      if (matchingDocs.length === 0) {
        res.status(401).json({ success: false, error: 'ユーザーIDまたはパスワードが正しくありません' });
        return;
      }

      // 複数会社に所属している場合
      if (matchingDocs.length > 1) {
        const companies = matchingDocs.map(doc => {
          const data = doc.data();
          return {
            docId: doc.id,
            companyDomain: data.companyDomain,
            companyName: data.companyName || data.companyDomain,
            userName: data.name || data.username || usernameOrEmail
          };
        });

        res.json({
          success: true,
          requiresCompanySelection: true,
          companies
        });
        return;
      }

      // 単一会社の場合
      const userDoc = matchingDocs[0];
      const userData = userDoc.data();

      // 最終ログイン日時を更新
      try {
        await db.collection('company_users').doc(userDoc.id).update({
          lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn('Failed to update last login:', e);
      }

      res.json({
        success: true,
        user: {
          docId: userDoc.id,
          companyDomain: userData.companyDomain,
          companyName: userData.companyName || userData.companyDomain,
          userName: userData.name || userData.username || usernameOrEmail,
          email: userData.email || null
        },
        companies: [{
          docId: userDoc.id,
          companyDomain: userData.companyDomain,
          companyName: userData.companyName || userData.companyDomain
        }]
      });

    } catch (error) {
      console.error('legacyLogin error:', error);
      res.status(500).json({
        success: false,
        error: 'ログインに失敗しました'
      });
    }
});

/**
 * レガシーユーザーのパスワードリセット
 * パスワードをbcryptでハッシュ化して保存
 */
functions.http('resetLegacyPassword', async (req, res) => {
  // CORS処理
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://togawa-design.github.io',
    'https://rikueco.jp'
  ];
  const origin = req.get('Origin');
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { userId, newPassword, adminUid } = req.body;

    if (!userId || !newPassword) {
      res.status(400).json({ success: false, error: 'userId と newPassword は必須です' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: 'パスワードは8文字以上で入力してください' });
      return;
    }

    const db = admin.firestore();

    // ユーザーが存在するか確認
    const userDoc = await db.collection('company_users').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'ユーザーが見つかりません' });
      return;
    }

    const userData = userDoc.data();

    // レガシーユーザーのみ対象（Firebase Auth ユーザーは sendPasswordResetEmail を使用）
    if (userData.uid && !userData._legacyAuth) {
      res.status(400).json({
        success: false,
        error: 'Firebase Authユーザーはメールでパスワードリセットしてください'
      });
      return;
    }

    // 管理者権限チェック（オプション）
    if (adminUid) {
      const adminDoc = await db.collection('company_users').doc(adminUid).get();
      if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        res.status(403).json({ success: false, error: '管理者権限が必要です' });
        return;
      }
      // 同じ会社のユーザーかチェック
      if (adminDoc.data().companyDomain !== userData.companyDomain) {
        res.status(403).json({ success: false, error: '異なる会社のユーザーです' });
        return;
      }
    }

    // パスワードをbcryptでハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Firestoreを更新
    await db.collection('company_users').doc(userId).update({
      password: hashedPassword,
      passwordResetAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[resetLegacyPassword] Password reset for user: ${userId}`);

    res.json({ success: true, message: 'パスワードをリセットしました' });

  } catch (error) {
    console.error('resetLegacyPassword error:', error);
    res.status(500).json({
      success: false,
      error: 'パスワードリセットに失敗しました'
    });
  }
});
