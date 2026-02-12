#!/bin/bash
# 開発環境用 Cloud Functions デプロイスクリプト
#
# 使用方法:
#   cd functions && ./deploy-dev.sh [function-name]
#
# 例:
#   ./deploy-dev.sh              # 全関数をデプロイ
#   ./deploy-dev.sh legacyLogin  # 特定の関数のみ

set -e

# 開発環境設定
PROJECT_ID="lset-dev"
REGION="asia-northeast1"
FIREBASE_PROJECT_ID="lset-dev"

echo "=========================================="
echo "開発環境デプロイ: $PROJECT_ID"
echo "=========================================="

# 環境変数
GA4_PROPERTY_ID="524526933"
ENV_VARS="FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,GA4_PROPERTY_ID=$GA4_PROPERTY_ID"

# Gen2関数リスト
GEN2_FUNCTIONS=(
  "getAnalyticsData"
  "sendEmail"
  "inboundParse"
  "getEmails"
  "createCompanyUser"
  "createCompanyStaff"
  "deleteCompanyUser"
  "migrateCompanyUsersToFirebaseAuth"
  "getPageAnalytics"
  "trackPageAnalytics"
)

# Gen1関数リスト（カレンダー系など）
GEN1_FUNCTIONS=(
  "legacyLogin"
  "initiateCalendarAuth"
  "calendarOAuthCallback"
  "getCalendarAvailability"
  "createCalendarEvent"
  "getCalendarIntegration"
  "revokeCalendarAuth"
)

deploy_function() {
  local func=$1
  local gen2=$2

  echo ""
  echo ">>> デプロイ中: $func"

  if [ "$gen2" = "true" ]; then
    gcloud functions deploy "$func" \
      --gen2 \
      --runtime nodejs20 \
      --trigger-http \
      --allow-unauthenticated \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --set-env-vars "$ENV_VARS"
  else
    gcloud functions deploy "$func" \
      --no-gen2 \
      --runtime nodejs20 \
      --trigger-http \
      --allow-unauthenticated \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --set-env-vars "$ENV_VARS"
  fi
}

# 特定の関数のみデプロイ
if [ -n "$1" ]; then
  FUNC_NAME=$1

  # Gen2かGen1か判定
  IS_GEN2="false"
  for f in "${GEN2_FUNCTIONS[@]}"; do
    if [ "$f" = "$FUNC_NAME" ]; then
      IS_GEN2="true"
      break
    fi
  done

  deploy_function "$FUNC_NAME" "$IS_GEN2"
  echo ""
  echo "完了: $FUNC_NAME"
  exit 0
fi

# 全関数デプロイ
echo ""
echo "全関数をデプロイします..."

# Gen2関数
for func in "${GEN2_FUNCTIONS[@]}"; do
  deploy_function "$func" "true"
done

# Gen1関数
for func in "${GEN1_FUNCTIONS[@]}"; do
  deploy_function "$func" "false"
done

echo ""
echo "=========================================="
echo "デプロイ完了"
echo "URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/"
echo "=========================================="
