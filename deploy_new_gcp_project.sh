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

# 2. Enable Required Google Cloud APIs & IAM Permissions
echo "Enabling required APIs (Cloud Run, Cloud Build, Secret Manager)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  --project "${PROJECT_ID}" --quiet || true

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)" 2>/dev/null || echo "690852867738")
echo "Configuring Cloud Build permissions for ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin" --condition=None --quiet || true
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder" --condition=None --quiet || true
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/storage.admin" --condition=None --quiet || true
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --condition=None --quiet || true

sleep 2

# 3. Setup Secret Manager for Supabase
SUPABASE_URL_VAL="https://ljaylmqqspneeaeaivtq.supabase.co"
SUPABASE_KEY_VAL="${2:-}"

create_or_update_secret() {
  local secret_name="$1"
  local secret_value="$2"
  if [ -z "${secret_value}" ]; then
    echo "Secret [${secret_name}] already configured in Secret Manager (skipping overwrite)."
    return 0
  fi
  if ! gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Creating secret [${secret_name}]..."
    printf '%s' "${secret_value}" | gcloud secrets create "${secret_name}" --data-file=- --project="${PROJECT_ID}" --replication-policy="automatic" --quiet
  else
    echo "Adding new version to secret [${secret_name}]..."
    printf '%s' "${secret_value}" | gcloud secrets versions add "${secret_name}" --data-file=- --project="${PROJECT_ID}" --quiet
  fi
  echo "✅ Secret [${secret_name}] is ready."
}

create_or_update_secret "SUPABASE_URL" "${SUPABASE_URL_VAL}"
create_or_update_secret "SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_KEY_VAL}"

# 4. Build and Push Container Image
echo "Building container image ${IMAGE_TAG} via Google Cloud Build..."
echo "This takes about 2-3 minutes to compile frontend, admin panel and backend container..."
BUILD_SUCCESS=0

if gcloud builds submit --tag "${IMAGE_TAG}" . --project "${PROJECT_ID}" --quiet; then
  echo "✅ Cloud Build completed successfully!"
  BUILD_SUCCESS=1
else
  echo "⚠️ Cloud Build failed. Falling back to local docker build & push..."
  gcloud auth configure-docker --quiet || true
  docker build -t "${IMAGE_TAG}" .
  docker push "${IMAGE_TAG}"
  BUILD_SUCCESS=1
fi

if [ ${BUILD_SUCCESS} -ne 1 ]; then
  echo "❌ Error: Failed to build and push container image."
  exit 1
fi

# Check if Firebase secrets are available in Secret Manager
SECRETS_LIST="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"
if gcloud secrets describe FIREBASE_PROJECT_ID --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Attaching Firebase credentials from Secret Manager..."
  SECRETS_LIST="${SECRETS_LIST},FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,FIREBASE_DATABASE_URL=FIREBASE_DATABASE_URL:latest"
fi

# 5. Deploy to Primary Region (Mumbai: asia-south1) - High Performance Turbo
echo "------------------------------------------------------------------------------"
echo "  Deploying High-Performance Turbo to Primary Region: ${PRIMARY_REGION}..."
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
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --cpu-throttling \
  --set-secrets="${SECRETS_LIST}" \
  --set-env-vars="NODE_ENV=production,SESSION_SECRET=pairuptoday_prod_session_secret_2026_super_secure_key_99,OTP_HMAC_SECRET=pairuptoday_prod_otp_hmac_secret_2026_super_secure_key_88,APITXT_BASE_URL=https://apitxt.com"

PRIMARY_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${PRIMARY_REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "✅ Primary Region deployment successful: ${PRIMARY_URL}"

# 6. Deploy to Failover Region (Singapore: asia-southeast1) - High Performance Turbo
echo "------------------------------------------------------------------------------"
echo "  Deploying High-Performance Turbo to Failover Region: ${FAILOVER_REGION}..."
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
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --cpu-throttling \
  --set-secrets="${SECRETS_LIST}" \
  --set-env-vars="NODE_ENV=production,SESSION_SECRET=pairuptoday_prod_session_secret_2026_super_secure_key_99,OTP_HMAC_SECRET=pairuptoday_prod_otp_hmac_secret_2026_super_secure_key_88,APITXT_BASE_URL=https://apitxt.com"

FAILOVER_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${FAILOVER_REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "✅ Failover Region deployment successful: ${FAILOVER_URL}"

echo "=============================================================================="
echo "  🎉 PairUpToday Cloud Run Dual-Region Deployment Completed!"
echo "  Primary   (asia-south1):     ${PRIMARY_URL}"
echo "  Failover  (asia-southeast1): ${FAILOVER_URL}"
echo "=============================================================================="
