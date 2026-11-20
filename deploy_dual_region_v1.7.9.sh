#!/usr/bin/env bash
set -e

# ==============================================================================
# PAIRUPTODAY DUAL-REGION DEPLOYMENT SCRIPT v1.7.9
# Target Project: nifty-cat-7cjpc
# Target Regions: asia-south1 (Mumbai) & asia-southeast1 (Singapore)
# Target Image:   gcr.io/nifty-cat-7cjpc/pairuptoday-api:v1.7.9
# Deliverables:
#   - Issue 1 Fix: Companion stays online when minimized (continuous background polling, unified online badge check)
#   - Issue 2 Fix: Booking request debounce & idempotency (single-click sync lock, 60s duplicate deduplication)
#   - Issue 3 Fix: Sub-second booking request arrival (immediate SSE alert, 2.5s high-frequency background polling)
#   - Issue 4 Fix: Post-payment auto-open active session page on companion dashboard (auto-transition to upcoming tab, chat & venue link)
# ==============================================================================

PROJECT_ID="nifty-cat-7cjpc"
SERVICE_NAME="pairuptoday-api"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:v1.7.9"
PRIMARY_REGION="asia-south1"
FAILOVER_REGION="asia-southeast1"

echo "=============================================================================="
echo "  🚀 Starting PairUpToday Dual-Region Production Deployment v1.7.9"
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
echo "  🎉 PairUpToday Dual-Region Deployment v1.7.9 Completed!"
echo "  Primary   (asia-south1):     ${PRIMARY_URL}"
echo "  Failover  (asia-southeast1): ${FAILOVER_URL}"
echo "=============================================================================="
