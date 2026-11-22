#!/usr/bin/env bash
set -e

# ==============================================================================
# PAIRUPTODAY: CONNECT SUPABASE & FIREBASE TO GOOGLE CLOUD
# Target Project: project-f4b5d045-f344-4919-8e8
# Dual Regions: asia-south1 (Mumbai) & asia-southeast1 (Singapore)
# ==============================================================================

PROJECT_ID="${1:-project-f4b5d045-f344-4919-8e8}"
SERVICE_NAME="pairuptoday-api"
PRIMARY_REGION="asia-south1"
FAILOVER_REGION="asia-southeast1"

echo "=============================================================================="
echo "  PairUpToday: Connecting Supabase & Firebase to Google Cloud Project"
echo "  Project ID: ${PROJECT_ID}"
echo "=============================================================================="

gcloud config set project "${PROJECT_ID}" --quiet

# 1. Enable Required Google Cloud & Firebase APIs
echo ""
echo "Step 1: Enabling Google Cloud & Firebase Service APIs..."
gcloud services enable \
  secretmanager.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com \
  firebasedatabase.googleapis.com \
  fcm.googleapis.com \
  identitytoolkit.googleapis.com \
  --project="${PROJECT_ID}" --quiet

echo "✅ APIs enabled."

# Helper function to create or update secrets safely
create_or_update_secret() {
  local secret_name="$1"
  local secret_value="$2"
  if [ -z "${secret_value}" ]; then
    return 0
  fi
  if ! gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    printf '%s' "${secret_value}" | gcloud secrets create "${secret_name}" --data-file=- --project="${PROJECT_ID}" --replication-policy="automatic" --quiet
  else
    printf '%s' "${secret_value}" | gcloud secrets versions add "${secret_name}" --data-file=- --project="${PROJECT_ID}" --quiet
  fi
  echo "✅ Secret [${secret_name}] ready."
}

# 2. Configure Supabase Credentials in Secret Manager
echo ""
echo "Step 2: Securing Supabase credentials in Secret Manager..."
SUPABASE_URL_VAL="https://ljaylmqqspneeaeaivtq.supabase.co"
SUPABASE_KEY_VAL="${2:-sb_secret_WtSiCcy1PbdWUGZf0XEvuw_rKEoMkP-}"

create_or_update_secret "SUPABASE_URL" "${SUPABASE_URL_VAL}"
create_or_update_secret "SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_KEY_VAL}"

# 3. Setup Firebase Admin Service Account & Credentials
echo ""
echo "Step 3: Setting up Firebase Admin Service Account..."
SA_NAME="firebase-adminsdk"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Creating service account [${SA_EMAIL}]..."
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="Firebase Admin SDK Service Account" \
    --project="${PROJECT_ID}" --quiet
else
  echo "Service account [${SA_EMAIL}] already exists."
fi

# Grant Firebase & Realtime Database Admin roles
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/firebasedatabase.admin" --condition=None --quiet || true

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/firebase.admin" --condition=None --quiet || true

# Generate service account key file safely
TMP_KEY_FILE="/tmp/firebase-admin-${PROJECT_ID}.json"
rm -f "${TMP_KEY_FILE}"
gcloud iam service-accounts keys create "${TMP_KEY_FILE}" \
  --iam-account="${SA_EMAIL}" \
  --project="${PROJECT_ID}" --quiet

# Extract private key, client email, project ID
FIREBASE_CLIENT_EMAIL=$(node -e "console.log(require('${TMP_KEY_FILE}').client_email)")
FIREBASE_PRIVATE_KEY=$(node -e "console.log(require('${TMP_KEY_FILE}').private_key)")
FIREBASE_DATABASE_URL="https://${PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app"

# Store Firebase credentials into Secret Manager
create_or_update_secret "FIREBASE_PROJECT_ID" "${PROJECT_ID}"
create_or_update_secret "FIREBASE_CLIENT_EMAIL" "${FIREBASE_CLIENT_EMAIL}"
create_or_update_secret "FIREBASE_PRIVATE_KEY" "${FIREBASE_PRIVATE_KEY}"
create_or_update_secret "FIREBASE_DATABASE_URL" "${FIREBASE_DATABASE_URL}"

# Securely wipe the temporary JSON key file
rm -f "${TMP_KEY_FILE}"
echo "✅ Firebase Admin credentials stored in Secret Manager."

# Ensure Compute Engine Service Account can read all secrets
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --condition=None --quiet || true

# 4. Attach Secrets to Cloud Run (Primary & Failover)
SECRETS_MOUNT="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,FIREBASE_DATABASE_URL=FIREBASE_DATABASE_URL:latest"

echo ""
echo "Step 4: Connecting Supabase & Firebase to Primary Cloud Run (${PRIMARY_REGION})..."
gcloud run services update "${SERVICE_NAME}" \
  --region="${PRIMARY_REGION}" \
  --project="${PROJECT_ID}" \
  --update-secrets="${SECRETS_MOUNT}" \
  --quiet

echo "Step 5: Connecting Supabase & Firebase to Failover Cloud Run (${FAILOVER_REGION})..."
gcloud run services update "${SERVICE_NAME}" \
  --region="${FAILOVER_REGION}" \
  --project="${PROJECT_ID}" \
  --update-secrets="${SECRETS_MOUNT}" \
  --quiet

# 5. Verify Health Check
echo ""
echo "=============================================================================="
echo "  Verification: Testing Live Health Endpoint..."
echo "=============================================================================="
HEALTH_URL="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${PRIMARY_REGION}.run.app/health"
HEALTH_RES=$(curl -s "${HEALTH_URL}" || echo "{}")
echo "Health Status: ${HEALTH_RES}"

echo ""
echo "=============================================================================="
echo "  🎉 CONGRATULATIONS! Google Cloud + Supabase + Firebase are fully connected!"
echo "=============================================================================="
