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
        case 'engagement':
          data = await getEngagementData(client, parseInt(days));
          break;
        case 'traffic':
          data = await getTrafficSourceData(client, parseInt(days));
          break;
        case 'funnel':
          data = await getFunnelData(client, parseInt(days));
          break;
        case 'trends':
          data = await getTrendData(client, parseInt(days));
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
    console.warn('Application data with custom dimensions failed, trying simple query:', error.message);

    // カスタムディメンションなしでシンプルなクエリ
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
 */
async function getEngagementData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
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
  } catch (error) {
    console.error('Engagement data error:', error.message);
    return { overall: {}, byCompany: [] };
  }
}

/**
 * 流入元データを取得
 */
async function getTrafficSourceData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
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
  } catch (error) {
    console.error('Traffic source data error:', error.message);
    return { channels: [], sources: [], byCompany: [] };
  }
}

/**
 * コンバージョンファネルデータを取得
 */
async function getFunnelData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
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
  } catch (error) {
    console.error('Funnel data error:', error.message);
    return { funnel: [], actionBreakdown: [], byCompany: [] };
  }
}

/**
 * 時系列トレンドデータを取得（曜日・時間帯別）
 */
async function getTrendData(client, days) {
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
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
  } catch (error) {
    console.error('Trend data error:', error.message);
    return { byDayOfWeek: [], byHour: [], weekly: [], insights: {} };
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

    const [viewResponse] = await client.runReport({
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
      orderBys: [
        { metric: { metricName: 'eventCount' }, desc: true }
      ],
      limit: 100
    });

    // 応募クリックデータ
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
          {
            filter: {
              fieldName: 'customEvent:company_domain',
              stringFilter: { value: companyDomain }
            }
          }
        ]
      }
    } : clickFilter;

    const [clickResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'customEvent:company_domain' },
        { name: 'customEvent:job_id' }
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: clickDimensionFilter,
      limit: 100
    });

    // クリック数をマップに変換
    const clicksMap = {};
    clickResponse.rows?.forEach(row => {
      const domain = row.dimensionValues[0].value;
      const jobId = row.dimensionValues[1].value;
      const key = `${domain}:${jobId}`;
      clicksMap[key] = parseInt(row.metricValues[0].value) || 0;
    });

    // データを整形
    const jobs = viewResponse.rows?.map(row => {
      const domain = row.dimensionValues[0].value;
      const companyName = row.dimensionValues[1].value;
      const jobId = row.dimensionValues[2].value;
      const jobTitle = row.dimensionValues[3].value;
      const views = parseInt(row.metricValues[0].value) || 0;
      const key = `${domain}:${jobId}`;
      const clicks = clicksMap[key] || 0;
      const cvr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0';

      return {
        companyDomain: domain,
        companyName,
        jobId,
        jobTitle,
        views,
        applications: clicks,
        cvr: parseFloat(cvr)
      };
    }) || [];

    // 日別トレンドを取得（全体または企業指定）
    const [dailyResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter,
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
    let snapshot;

    console.log('[getRecentApplications] Query params:', { companyDomain, limit });

    // 企業ドメイン指定がある場合
    if (companyDomain) {
      try {
        // まずフィルタなしで全件取得してみる（デバッグ用）
        const allDocsSnapshot = await db.collection('applications').limit(5).get();
        console.log('[getRecentApplications] All docs count (without filter):', allDocsSnapshot.docs.length);
        allDocsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('[getRecentApplications] Sample doc:', { id: doc.id, companyDomain: data.companyDomain, type: typeof data.companyDomain });
        });

        // フィルター付きクエリ（インデックス不要版）
        const query = db.collection('applications')
          .where('companyDomain', '==', companyDomain)
          .limit(limit);
        snapshot = await query.get();
        console.log('[getRecentApplications] Filtered query result:', snapshot.docs.length);
      } catch (queryError) {
        console.error('[getRecentApplications] Query error:', queryError.message);
        console.error('[getRecentApplications] Full query error:', JSON.stringify(queryError, null, 2));
        snapshot = { docs: [] };
      }
    } else {
      const query = db.collection('applications')
        .orderBy('createdAt', 'desc')
        .limit(limit);
      snapshot = await query.get();
    }

    console.log('[getRecentApplications] Found docs:', snapshot.docs.length);

    let applications = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('[getRecentApplications] Doc data:', { id: doc.id, companyDomain: data.companyDomain, jobTitle: data.jobTitle });
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
        timestamp: timestamp.toISOString(),
        _sortTime: timestamp.getTime()
      };
    });

    // 手動ソート（フォールバック時用）
    applications.sort((a, b) => b._sortTime - a._sortTime);
    applications = applications.slice(0, limit);

    // _sortTimeを削除
    applications.forEach(app => delete app._sortTime);

    return {
      applications,
      total: applications.length
    };
  } catch (error) {
    console.error('Recent applications error:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
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
 * ヘルスチェック用エンドポイント
 */
functions.http('health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
