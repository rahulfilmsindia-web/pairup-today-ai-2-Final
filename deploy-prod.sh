#!/usr/bin/env bash
set -e

PROJECT_ID="nifty-cat-7cjpc"
REGION="asia-south1"
SERVICE_NAME="pairuptoday-api"
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/pairuptoday/api:v1.0.0"

echo "============================================="
echo "  PairUpToday Production Deployment"
echo "  Project: ${PROJECT_ID}"
echo "  Region:  ${REGION}"
echo "============================================="

# 1. Configure gcloud project
gcloud config set project ${PROJECT_ID}

# 2. Enable APIs
echo "Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

# 3. Create Artifact Registry if not exists
echo "Verifying Artifact Registry repository..."
gcloud artifacts repositories create pairuptoday \
  --repository-format=docker \
  --location=${REGION} \
  --description="PairUpToday production containers" 2>/dev/null || true

# 4. Helper to ensure secret exists
create_secret_if_missing() {
  local secret_name="$1"
  if ! gcloud secrets describe "${secret_name}" >/dev/null 2>&1; then
    echo "Creating secret: ${secret_name}..."
    gcloud secrets create "${secret_name}" --replication-policy="automatic"
  else
    echo "Secret already exists: ${secret_name}"
  fi
}

echo "Ensuring Secret Manager secrets exist..."
for s in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY OTP_HMAC_SECRET SESSION_SECRET \
         BANK_ACCOUNT_ENCRYPTION_KEY APITXT_API_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET \
         RAZORPAY_WEBHOOK_SECRET FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL \
         FIREBASE_PRIVATE_KEY FIREBASE_DATABASE_URL GOOGLE_MAPS_API_KEY; do
  create_secret_if_missing "$s"
done

# If service-account.json exists in directory, auto-populate firebase secrets
if [ -f "service-account.json" ]; then
  echo "Found service-account.json. Populating Firebase secrets..."
  python3 -c "import json; d=json.load(open('service-account.json')); open('/tmp/pk.txt','w').write(d['private_key'])"
  gcloud secrets versions add FIREBASE_PRIVATE_KEY --data-file=/tmp/pk.txt --quiet || true
  rm -f /tmp/pk.txt
  python3 -c "import json; d=json.load(open('service-account.json')); open('/tmp/email.txt','w').write(d['client_email'])"
  gcloud secrets versions add FIREBASE_CLIENT_EMAIL --data-file=/tmp/email.txt --quiet || true
  rm -f /tmp/email.txt
  echo -n "${PROJECT_ID}" | gcloud secrets versions add FIREBASE_PROJECT_ID --data-file=- --quiet || true
fi

# Set fixed SUPABASE_URL
echo -n "https://gegchjmuroabnejuqjpa.supabase.co" | gcloud secrets versions add SUPABASE_URL --data-file=- --quiet || true

# Set FIREBASE_DATABASE_URL if not set
echo -n "https://nifty-cat-7cjpc-default-rtdb.asia-southeast1.firebasedatabase.app" | gcloud secrets versions add FIREBASE_DATABASE_URL --data-file=- --quiet || true

# Auto-generate secure random secrets if empty
ensure_random_secret() {
  local secret_name="$1"
  local val
  val=$(gcloud secrets versions access latest --secret="${secret_name}" 2>/dev/null || true)
  if [ -z "$val" ]; then
    echo "Generating secure random key for ${secret_name}..."
    openssl rand -hex 32 | gcloud secrets versions add "${secret_name}" --data-file=- --quiet
  fi
}

ensure_random_secret "OTP_HMAC_SECRET"
ensure_random_secret "SESSION_SECRET"
ensure_random_secret "BANK_ACCOUNT_ENCRYPTION_KEY"

# 5. Build Container Image via Cloud Build
echo "Building container image via Cloud Build..."
cp Dockerfile.api Dockerfile
gcloud builds submit \
  --tag "${IMAGE_TAG}" \
  --timeout=1200s .

# 6. Grant Cloud Run Service Account access to Secret Manager
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Granting Secret Accessor role to ${COMPUTE_SA}..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None --quiet || true

# 7. Deploy Cloud Run Service
echo "Deploying Cloud Run service ${SERVICE_NAME}..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,CLIENT_ORIGIN=https://pairuptoday.com,ADMIN_ORIGIN=https://admin.pairuptoday.com,APITXT_BASE_URL=https://apitxt.com" \
  --set-secrets "\
SUPABASE_URL=SUPABASE_URL:latest,\
SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,\
OTP_HMAC_SECRET=OTP_HMAC_SECRET:latest,\
SESSION_SECRET=SESSION_SECRET:latest,\
BANK_ACCOUNT_ENCRYPTION_KEY=BANK_ACCOUNT_ENCRYPTION_KEY:latest,\
APITXT_API_KEY=APITXT_API_KEY:latest,\
RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,\
RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,\
RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest,\
FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,\
FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,\
FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,\
FIREBASE_DATABASE_URL=FIREBASE_DATABASE_URL:latest,\
GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest"

echo "============================================="
echo "  Cloud Run Service Deployed Successfully!"
echo "============================================="
gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format="value(status.url)"
