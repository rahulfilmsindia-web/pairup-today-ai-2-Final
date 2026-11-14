# PairUpToday — Production Deployment Runbook

**Date:** 2026-11-13  
**Project Root:** `C:\Users\ADMIN\Downloads\pairup-today-ai-2ai`  
**Target Infrastructure:** Google Cloud Run (`asia-south1`), Supabase PostgreSQL (`ap-south-1`), Firebase RTDB (`asia-southeast1`), Cloud Scheduler  

---

## 1. Pre-Deployment Readiness Checklist

Before initiating production deployment, confirm all of the following:

- [x] Local code audit completed and passed ([`01_FULL_AUDIT_REPORT.md`](./01_FULL_AUDIT_REPORT.md)).
- [x] All 6 registered code issues resolved and verified ([`03_FIX_CHANGELOG.md`](./03_FIX_CHANGELOG.md)).
- [x] Full automated test suite passes (36/36 scenarios passed in [`04_TEST_RESULTS.md`](./04_TEST_RESULTS.md)).
- [x] TypeScript linting and production client/admin builds succeed without warnings.
- [ ] Production Supabase project created and migrations `001` through `008` applied.
- [ ] Production secrets provisioned in Google Cloud Secret Manager.
- [ ] APITXT, Razorpay Live, and Firebase service accounts verified.

---

## 2. Step-by-Step Deployment Procedure

### Step 1: Provision Google Cloud Secrets
Run the following Google Cloud CLI commands (or configure via GCP Console):
```bash
# Enable required services
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

# Create secrets in Secret Manager
gcloud secrets create SUPABASE_URL --replication-policy="automatic"
gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --replication-policy="automatic"
gcloud secrets create OTP_HMAC_SECRET --replication-policy="automatic"
gcloud secrets create SESSION_SECRET --replication-policy="automatic"
gcloud secrets create BANK_ACCOUNT_ENCRYPTION_KEY --replication-policy="automatic"
gcloud secrets create APITXT_API_KEY --replication-policy="automatic"
gcloud secrets create RAZORPAY_KEY_ID --replication-policy="automatic"
gcloud secrets create RAZORPAY_KEY_SECRET --replication-policy="automatic"
gcloud secrets create RAZORPAY_WEBHOOK_SECRET --replication-policy="automatic"
gcloud secrets create FIREBASE_PROJECT_ID --replication-policy="automatic"
gcloud secrets create FIREBASE_CLIENT_EMAIL --replication-policy="automatic"
gcloud secrets create FIREBASE_PRIVATE_KEY --replication-policy="automatic"
gcloud secrets create FIREBASE_DATABASE_URL --replication-policy="automatic"
gcloud secrets create GOOGLE_MAPS_API_KEY --replication-policy="automatic"
```

---

### Step 2: Build & Push Container Image
Build the container image using [`Dockerfile.api`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/Dockerfile.api) directly via Google Cloud Build (or Docker):

```bash
# Set environment variables
export PROJECT_ID="pairuptoday-prod"
export REGION="asia-south1"
export IMAGE_TAG="asia-south1-docker.pkg.dev/${PROJECT_ID}/pairuptoday/api:v1.0.0"

# Create Artifact Registry repository if not exists
gcloud artifacts repositories create pairuptoday \
  --repository-format=docker \
  --location=${REGION} \
  --description="PairUpToday production containers"

# Build and push container image using Cloud Build
gcloud builds submit \
  --tag ${IMAGE_TAG} \
  --timeout=1200s \
  --file=Dockerfile.api
```

---

### Step 3: Deploy Google Cloud Run Service
Deploy the service using the declarative configuration or gcloud command:

```bash
gcloud run deploy pairuptoday-api \
  --image ${IMAGE_TAG} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PORT=8080,CLIENT_ORIGIN=https://pairuptoday.com,ADMIN_ORIGIN=https://admin.pairuptoday.com,APITXT_BASE_URL=https://apitxt.com" \
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
```

---

### Step 4: Deploy Scheduled Maintenance Job (Cloud Run Job)
Deploy the scheduled task container and link to Cloud Scheduler:

```bash
# Create Cloud Run Job
gcloud run jobs deploy pairuptoday-maintenance \
  --image ${IMAGE_TAG} \
  --command "node" \
  --args "maintenance-job.js" \
  --region ${REGION} \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "\
SUPABASE_URL=SUPABASE_URL:latest,\
SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,\
FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,\
FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,\
FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,\
FIREBASE_DATABASE_URL=FIREBASE_DATABASE_URL:latest"

# Schedule Job to run every 15 minutes
gcloud scheduler jobs create http pairuptoday-maintenance-schedule \
  --location ${REGION} \
  --schedule "*/15 * * * *" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/pairuptoday-maintenance:run" \
  --http-method POST \
  --oauth-service-account-email "${PROJECT_ID}@appspot.gserviceaccount.com"
```

---

### Step 5: Domain Mapping & SSL Verification
Map the custom domains to Cloud Run:
```bash
# Map Main Website
gcloud beta run domain-mappings create \
  --service pairuptoday-api \
  --domain pairuptoday.com \
  --region ${REGION}

# Map Admin Subdomain
gcloud beta run domain-mappings create \
  --service pairuptoday-api \
  --domain admin.pairuptoday.com \
  --region ${REGION}
```
Add the returned DNS resource records (A / CNAME) to your DNS registrar.

---

## 3. Post-Deployment Smoke Verification

Immediately following deployment, perform the following verification calls:

1. **Health Check:**
   ```bash
   curl -i https://pairuptoday.com/health
   # Expected response: HTTP 200 {"status":"ok","timestamp":...}
   ```
2. **Admin Overview Authentication Guard:**
   ```bash
   curl -i https://admin.pairuptoday.com/api/admin/overview
   # Expected response: HTTP 401 Unauthorized (Confirms security guard is active)
   ```
3. **Public Companion Search:**
   ```bash
   curl -i "https://pairuptoday.com/api/companions/search"
   # Expected response: HTTP 200 with companion listing array
   ```
4. **Google Maps Proxy Rate Limit Guard:**
   ```bash
   curl -i "https://pairuptoday.com/api/maps/autocomplete?input=Mumbai"
   # Expected response: HTTP 200 with predictions
   ```

---

## 4. Rollback Procedure

If a critical issue occurs post-launch:

1. **Traffic Reversion to Prior Revision:**
   ```bash
   # List recent revisions
   gcloud run revisions list --service pairuptoday-api --region ${REGION}

   # Instantly route 100% traffic to previous stable revision
   gcloud run services update-traffic pairuptoday-api \
     --region ${REGION} \
     --to-revisions PREVIOUS_REVISION_NAME=100
   ```
2. **Immediate Incident Assessment:** Check Cloud Logging for error stack traces:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 50
   ```
