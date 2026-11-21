#!/usr/bin/env bash
set -e

# ==============================================================================
# PAIRUPTODAY LIVE SERVICES CONFIGURATION & UPDATE SCRIPT
# Configures: Supabase, Google Maps, APITXT OTP on Dual-Region Cloud Run
# Project: project-f4b5d045-f344-4919-8e8
# ==============================================================================

PROJECT_ID="project-f4b5d045-f344-4919-8e8"
SERVICE_NAME="pairuptoday-api"

echo "=============================================================================="
echo "  PairUpToday Production Keys Configuration"
echo "  Target Project: ${PROJECT_ID}"
echo "=============================================================================="

# Check arguments or prompt interactively
SUPABASE_URL="$1"
SUPABASE_KEY="$2"
GOOGLE_MAPS_KEY="$3"
APITXT_KEY="$4"

if [ -z "${SUPABASE_URL}" ]; then
  read -r -p "Enter Supabase Project URL (e.g. https://xxxx.supabase.co): " SUPABASE_URL
fi
if [ -z "${SUPABASE_KEY}" ]; then
  read -r -p "Enter Supabase Service Role Key (starts with eyJ...): " SUPABASE_KEY
fi
if [ -z "${GOOGLE_MAPS_KEY}" ]; then
  read -r -p "Enter Google Maps API Key (AIza...): " GOOGLE_MAPS_KEY
fi
if [ -z "${APITXT_KEY}" ]; then
  read -r -p "Enter APITXT API Key: " APITXT_KEY
fi

echo ""
echo "1. Updating Secret Manager with active Supabase credentials..."
printf '%s' "${SUPABASE_URL}" | gcloud secrets versions add SUPABASE_URL --data-file=- --project="${PROJECT_ID}" --quiet
printf '%s' "${SUPABASE_KEY}" | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=- --project="${PROJECT_ID}" --quiet
echo " Secret Manager updated successfully."

echo ""
echo "2. Updating Primary Cloud Run (Mumbai: asia-south1)..."
gcloud run services update "${SERVICE_NAME}" \
  --region asia-south1 \
  --project "${PROJECT_ID}" \
  --update-env-vars="GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_KEY},APITXT_API_KEY=${APITXT_KEY},APITXT_BASE_URL=https://apitxt.com" \
  --update-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --quiet

echo ""
echo "3. Updating Failover Cloud Run (Singapore: asia-southeast1)..."
gcloud run services update "${SERVICE_NAME}" \
  --region asia-southeast1 \
  --project "${PROJECT_ID}" \
  --update-env-vars="GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_KEY},APITXT_API_KEY=${APITXT_KEY},APITXT_BASE_URL=https://apitxt.com" \
  --update-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --quiet

echo ""
echo "=============================================================================="
echo " All services updated successfully!"
echo " PairUpToday is now fully connected with Supabase, Google Maps & APITXT!"
echo " Test login, location autocomplete & OTP at: https://pairuptoday.com"
echo "=============================================================================="
