/**
 * リクエコ求人ナビ - Google Analytics Data API Cloud Function
 *
 * GA4のデータを取得して管理者ダッシュボードに提供するAPI
 */

const functions = require('@google-cloud/functions-framework');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const cors = require('cors');
const admin = require('firebase-admin');

// Firebase Admin初期化（クライアント側と同じFirebaseプロジェクトを使用）
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'generated-area-484613-e3-90bd4'
  });
}

// CORS設定（許可するオリジンを本番環境に合わせて調整）
const corsHandler = cors({
  origin: [
    'http://localhost:5500',
    'http://localhost:5502',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5502',
    'https://togawa-design.github.io'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

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

      // Firebase IDトークン検証（認証必須）
      const user = await verifyToken(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: Valid Firebase ID token required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log(`Authenticated user: ${user.email || user.uid}`);

      const { type, days = 30 } = req.query;
      const client = getAnalyticsClient();

      let data;

      switch (type) {
        case 'overview':
          data = await getOverviewData(client, parseInt(days));
          break;
        case 'companies':
          data = await getCompanyData(client, parseInt(days));
          break;
        case 'daily':
          data = await getDailyData(client, parseInt(days));
          break;
        case 'applications':
          data = await getApplicationData(client, parseInt(days));
          break;
        default:
          // すべてのデータを取得
          data = {
            overview: await getOverviewData(client, parseInt(days)),
            companies: await getCompanyData(client, parseInt(days)),
            daily: await getDailyData(client, parseInt(days)),
            applications: await getApplicationData(client, parseInt(days))
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
 */
async function getOverviewData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  console.log(`Fetching overview data for property: ${GA4_PROPERTY_ID}, days: ${days}`);

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

  console.log('Basic metrics response:', JSON.stringify(response, null, 2));

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
 */
async function getDailyData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

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

/**
 * 応募イベントデータを取得
 * 注意: カスタムディメンションが登録されていない場合はシンプルなデータを返す
 */
async function getApplicationData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    const [response] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'dateHourMinute' },
        { name: 'customEvent:company_name' },
        { name: 'customEvent:button_type' },
        { name: 'sessionDefaultChannelGroup' }
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

    return response.rows?.map(row => {
      const dateHourMinute = row.dimensionValues[0].value;
      const year = dateHourMinute.substring(0, 4);
      const month = dateHourMinute.substring(4, 6);
      const day = dateHourMinute.substring(6, 8);
      const hour = dateHourMinute.substring(8, 10);
      const minute = dateHourMinute.substring(10, 12);

      return {
        date: `${year}/${month}/${day} ${hour}:${minute}`,
        company: row.dimensionValues[1].value || '不明',
        type: row.dimensionValues[2].value || 'apply',
        source: row.dimensionValues[3].value || '不明'
      };
    }) || [];
  } catch (error) {
    console.warn('Application data with custom dimensions failed, trying simple query:', error.message);

    // カスタムディメンションなしでシンプルなクエリ
    try {
      const [simpleResponse] = await client.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'dateHourMinute' },
          { name: 'sessionDefaultChannelGroup' }
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

        return {
          date: `${year}/${month}/${day} ${hour}:${minute}`,
          company: '不明',
          type: 'apply',
          source: row.dimensionValues[1].value || '不明'
        };
      }) || [];
    } catch (simpleError) {
      console.warn('Simple application data query also failed:', simpleError.message);
      return [];
    }
  }
}

/**
 * ヘルスチェック用エンドポイント
 */
functions.http('health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
