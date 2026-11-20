#!/usr/bin/env bash
set -e

# ==============================================================================
# PAIRUPTODAY DUAL-REGION DEPLOYMENT SCRIPT v1.8.2
# Target Project: nifty-cat-7cjpc
# Target Regions: asia-south1 (Mumbai) & asia-southeast1 (Singapore)
# Target Image:   gcr.io/nifty-cat-7cjpc/pairuptoday-api:v1.8.2
# Deliverables:
#   - Issue 1: Fix "Unexpected token '<', <html><hea... is not valid JSON" on Login/Auth Gateway
#   - Issue 2: Global Express error handler & API 404 JSON enforcement (never return HTML for /api)
#   - Issue 3: Auto-retry on booking request network glitch, credentials include & safeJsonParse
#   - Issue 4: Auto-select today's date & (now + 30 mins) start time with strict minimum floor
#   - Issue 5: Live tracking reverse-geocoded area & ETA polling updates, full DB column mapping
#   - Issue 6: Companion active session page auto-opens with meeting venue navigation link & client chat
#   - Issue 7: Silent background companion polling, eliminating DOM thrashing and page lag
# ==============================================================================

PROJECT_ID="nifty-cat-7cjpc"
SERVICE_NAME="pairuptoday-api"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:v1.8.2"
PRIMARY_REGION="asia-south1"
FAILOVER_REGION="asia-southeast1"

echo "=============================================================================="
echo "  🚀 Starting PairUpToday Dual-Region Production Deployment v1.8.2"
echo "  Project:  ${PROJECT_ID}"
echo "  Image:    ${IMAGE_TAG}"
echo "  Regions:  ${PRIMARY_REGION} (Primary) & ${FAILOVER_REGION} (Failover)"
echo "=============================================================================="

# 1. Ensure project configuration
echo "Configuring gcloud default project..."
gcloud config set project ${PROJECT_ID} --quiet

# 2. Build and Push Container Image
echo "Building container image ${IMAGE_TAG} via Google Cloud Build..."
BUILD_SUCCESS=0

if gcloud builds submit --tag "${IMAGE_TAG}" . --project "${PROJECT_ID}"; then
  echo "✅ Cloud Build completed successfully!"
  BUILD_SUCCESS=1
else
  echo "⚠️ Cloud Build failed. Falling back to local docker build & push..."
  docker build -t "${IMAGE_TAG}" .
  docker push "${IMAGE_TAG}"
  BUILD_SUCCESS=1
fi

if [ ${BUILD_SUCCESS} -ne 1 ]; then
  echo "❌ Error: Failed to build and push container image."
  exit 1
fi

# 3. Deploy to Primary Region (Mumbai: asia-south1)
echo "------------------------------------------------------------------------------"
echo "  Deploying to Primary Region: ${PRIMARY_REGION}..."
echo "------------------------------------------------------------------------------"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${PRIMARY_REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-env-vars="NODE_ENV=production,SESSION_SECRET=pairuptoday_prod_session_secret_2026_super_secure_key_99,OTP_HMAC_SECRET=pairuptoday_prod_otp_hmac_secret_2026_super_secure_key_88"

PRIMARY_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${PRIMARY_REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "✅ Primary Region deployment successful: ${PRIMARY_URL}"

# 4. Deploy to Failover Region (Singapore: asia-southeast1)
echo "------------------------------------------------------------------------------"
echo "  Deploying to Failover Region: ${FAILOVER_REGION}..."
echo "------------------------------------------------------------------------------"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${FAILOVER_REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-env-vars="NODE_ENV=production,SESSION_SECRET=pairuptoday_prod_session_secret_2026_super_secure_key_99,OTP_HMAC_SECRET=pairuptoday_prod_otp_hmac_secret_2026_super_secure_key_88"

FAILOVER_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${FAILOVER_REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "✅ Failover Region deployment successful: ${FAILOVER_URL}"

echo "=============================================================================="
echo "  🎉 PairUpToday Dual-Region Deployment v1.8.2 Completed!"
echo "  Primary   (asia-south1):     ${PRIMARY_URL}"
echo "  Failover  (asia-southeast1): ${FAILOVER_URL}"
echo "=============================================================================="
