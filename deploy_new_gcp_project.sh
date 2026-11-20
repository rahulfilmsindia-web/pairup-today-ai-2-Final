#!/usr/bin/env bash
set -e

# ==============================================================================
# PAIRUPTODAY UNIVERSAL GOOGLE CLOUD RUN DEPLOYMENT SCRIPT
# Supports: Any Google Cloud Project (including new Free Trial projects)
# Auto-enables: Cloud Run, Cloud Build, Secret Manager, Container Registry
# Auto-provisions: Supabase secrets, dual-region Cloud Run services
# ==============================================================================

PROJECT_ID="$1"
if [ -z "${PROJECT_ID}" ]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
fi

if [ -z "${PROJECT_ID}" ]; then
  echo "❌ Error: Project ID not found."
  echo "Usage: ./deploy_new_gcp_project.sh <YOUR_NEW_PROJECT_ID>"
  exit 1
fi

SERVICE_NAME="pairuptoday-api"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"
PRIMARY_REGION="asia-south1"
FAILOVER_REGION="asia-southeast1"

echo "=============================================================================="
echo "  🚀 Starting PairUpToday Cloud Run Deployment"
echo "  Target Project:  ${PROJECT_ID}"
echo "  Primary Region:  ${PRIMARY_REGION} (Mumbai)"
echo "  Failover Region: ${FAILOVER_REGION} (Singapore)"
echo "=============================================================================="

# 1. Set project
echo "Setting gcloud project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}" --quiet

# 2. Enable Required Google Cloud APIs
echo "Enabling required APIs (Cloud Run, Cloud Build, Secret Manager)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  --project "${PROJECT_ID}" --quiet || true

# 3. Setup Secret Manager for Supabase
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

echo "Configuring Supabase credentials in Secret Manager..."
create_or_update_secret "SUPABASE_URL" "${SUPABASE_URL_VAL}"
create_or_update_secret "SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_KEY_VAL}"

# 4. Build and Push Container Image
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

# 5. Deploy to Primary Region (Mumbai: asia-south1)
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

# 6. Deploy to Failover Region (Singapore: asia-southeast1)
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
echo "  🎉 PairUpToday Cloud Run Dual-Region Deployment Completed!"
echo "  Primary   (asia-south1):     ${PRIMARY_URL}"
echo "  Failover  (asia-southeast1): ${FAILOVER_URL}"
echo "=============================================================================="
