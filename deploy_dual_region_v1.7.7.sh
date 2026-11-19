#!/usr/bin/env bash
set -e

# ==============================================================================
# PAIRUPTODAY DUAL-REGION DEPLOYMENT SCRIPT v1.7.7
# Target Project: nifty-cat-7cjpc
# Target Regions: asia-south1 (Mumbai) & asia-southeast1 (Singapore)
# Target Image:   gcr.io/nifty-cat-7cjpc/pairuptoday-api:v1.7.7
# Features:
#   - Companion Instant Alert Modal on Client Payment Confirmation
#   - Direct "💬 Chat with Client" Drawer open for Companion
#   - Direct "📍 Get Booking Location" (Google Maps) for Companion
#   - Supabase clientName & clientPhoto populated in /api/bookings/my/:userId
#   - Sandbox / Test Mode 1-click payment guarantee without Razorpay errors
# ==============================================================================

PROJECT_ID="nifty-cat-7cjpc"
SERVICE_NAME="pairuptoday-api"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:v1.7.7"
PRIMARY_REGION="asia-south1"
FAILOVER_REGION="asia-southeast1"

echo "=============================================================================="
echo "  🚀 Starting PairUpToday Dual-Region Production Deployment v1.7.7"
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

# 3. Build and Push Container Image
echo "Building container image ${IMAGE_TAG}..."
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

# Secret references
SECRET_VARS="SUPABASE_URL=SUPABASE_URL:latest,\
SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest,\
SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,\
SESSION_SECRET=SESSION_SECRET:latest,\
OTP_HMAC_SECRET=OTP_HMAC_SECRET:latest,\
BANK_ACCOUNT_ENCRYPTION_KEY=BANK_ACCOUNT_ENCRYPTION_KEY:latest,\
APITXT_API_KEY=APITXT_API_KEY:latest,\
RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,\
RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,\
RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest"

# 4. Deploy to Primary Region (Mumbai: asia-south1)
echo "------------------------------------------------------------------------------"
echo "  Deploying to Primary Region: ${PRIMARY_REGION}..."
echo "------------------------------------------------------------------------------"
gcloud run deploy ${SERVICE_NAME} \
  --image "${IMAGE_TAG}" \
  --region "${PRIMARY_REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="${SECRET_VARS}" \
  --update-env-vars="NODE_ENV=production,PORT=8080" \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80

PRIMARY_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${PRIMARY_REGION} --project ${PROJECT_ID} --format="value(status.url)")
echo "✅ Primary Region deployment successful: ${PRIMARY_URL}"

# 5. Deploy to Failover Region (Singapore: asia-southeast1)
echo "------------------------------------------------------------------------------"
echo "  Deploying to Failover Region: ${FAILOVER_REGION}..."
echo "------------------------------------------------------------------------------"
gcloud run deploy ${SERVICE_NAME} \
  --image "${IMAGE_TAG}" \
  --region "${FAILOVER_REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="${SECRET_VARS}" \
  --update-env-vars="NODE_ENV=production,PORT=8080" \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80

FAILOVER_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${FAILOVER_REGION} --project ${PROJECT_ID} --format="value(status.url)")
echo "✅ Failover Region deployment successful: ${FAILOVER_URL}"

echo "=============================================================================="
echo "  🎉 PairUpToday Dual-Region Deployment v1.7.7 Completed!"
echo "  Primary   (asia-south1):     ${PRIMARY_URL}"
echo "  Failover  (asia-southeast1): ${FAILOVER_URL}"
echo "=============================================================================="
