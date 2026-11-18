#!/usr/bin/env bash
set -e

# ==============================================================================
# PAIRUPTODAY DUAL-REGION DEPLOYMENT SCRIPT v1.7.0
# Target Project: nifty-cat-7cjpc
# Target Regions: asia-south1 (Mumbai) & asia-southeast1 (Singapore)
# Target Image:   gcr.io/nifty-cat-7cjpc/pairuptoday-api:v1.7.0
# ==============================================================================

PROJECT_ID="nifty-cat-7cjpc"
SERVICE_NAME="pairuptoday-api"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:v1.7.0"
PRIMARY_REGION="asia-south1"
FAILOVER_REGION="asia-southeast1"

echo "=============================================================================="
echo "  🚀 Starting PairUpToday Dual-Region Production Deployment v1.7.0"
echo "  Project:  ${PROJECT_ID}"
echo "  Image:    ${IMAGE_TAG}"
echo "  Regions:  ${PRIMARY_REGION} (Primary) & ${FAILOVER_REGION} (Failover)"
echo "=============================================================================="

# 1. Ensure project configuration
echo "Configuring gcloud default project..."
gcloud config set project ${PROJECT_ID} --quiet

# 2. Enable necessary GCP APIs
echo "Ensuring required GCP services are enabled..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  --project ${PROJECT_ID} --quiet || true

# 3. Setup Secret Manager for Supabase Credentials
SUPABASE_URL_VAL="https://ljaylmqqspneeaeaivtq.supabase.co"
SUPABASE_KEY_VAL="sb_secret_PfN3sGIPNAbcxJ793Kz_gw_h44VeAs4"

create_or_update_secret() {
  local secret_name="$1"
  local secret_value="$2"
  if ! gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Creating secret [${secret_name}]..."
    echo -n "${secret_value}" | gcloud secrets create "${secret_name}" --data-file=- --project="${PROJECT_ID}" --replication-policy="automatic"
  else
    echo "Adding new version to secret [${secret_name}]..."
    echo -n "${secret_value}" | gcloud secrets versions add "${secret_name}" --data-file=- --project="${PROJECT_ID}"
  fi
}

echo "Configuring Secret Manager..."
create_or_update_secret "SUPABASE_URL" "${SUPABASE_URL_VAL}"
create_or_update_secret "SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_KEY_VAL}"

# 4. Build and Push Container Image
echo "Building container image ${IMAGE_TAG}..."
BUILD_SUCCESS=0

if gcloud builds submit --tag "${IMAGE_TAG}" . --project "${PROJECT_ID}"; then
  echo "✅ Cloud Build completed successfully!"
  BUILD_SUCCESS=1
else
  echo "⚠️ Cloud Build encountered an error. Falling back to local Docker build in Cloud Shell..."
  gcloud auth configure-docker --quiet
  docker build -t "${IMAGE_TAG}" -f Dockerfile .
  docker push "${IMAGE_TAG}"
  BUILD_SUCCESS=1
  echo "✅ Docker build & push completed successfully!"
fi

if [ $BUILD_SUCCESS -ne 1 ]; then
  echo "❌ Container build failed. Aborting deployment."
  exit 1
fi

# 5. Deploy to Primary Region (asia-south1)
echo "Deploying to Primary Region (${PRIMARY_REGION})..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${PRIMARY_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-env-vars="NODE_ENV=production,SESSION_SECRET=pairuptoday_prod_session_secret_2026_super_secure_key_99,OTP_HMAC_SECRET=pairuptoday_prod_otp_hmac_secret_2026_super_secure_key_88" \
  --project "${PROJECT_ID}"

PRIMARY_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${PRIMARY_REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "✅ Primary Region (${PRIMARY_REGION}) Live at: ${PRIMARY_URL}"

# 6. Deploy to Failover Region (asia-southeast1)
echo "Deploying to Failover Region (${FAILOVER_REGION})..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${FAILOVER_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-env-vars="NODE_ENV=production,SESSION_SECRET=pairuptoday_prod_session_secret_2026_super_secure_key_99,OTP_HMAC_SECRET=pairuptoday_prod_otp_hmac_secret_2026_super_secure_key_88" \
  --project "${PROJECT_ID}"

FAILOVER_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${FAILOVER_REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "✅ Failover Region (${FAILOVER_REGION}) Live at: ${FAILOVER_URL}"

# 7. Verification Health Check
echo "Running health checks..."
curl -s "${PRIMARY_URL}/api/health" || true
echo ""
curl -s "${FAILOVER_URL}/api/health" || true
echo ""

echo "=============================================================================="
echo "🎉 Dual-Region Deployment v1.7.0 Completed Successfully!"
echo "Primary Service (Mumbai):    ${PRIMARY_URL}"
echo "Failover Service (SG):       ${FAILOVER_URL}"
echo "=============================================================================="
