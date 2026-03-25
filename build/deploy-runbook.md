# Symph CRM — Cloud Run Deploy Runbook

## One-Time Setup (do once after billing is linked)

### 1. Enable APIs
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project=symph-crm
```

### 2. Create Artifact Registry repo
```bash
gcloud artifacts repositories create symph-crm \
  --repository-format=docker \
  --location=asia \
  --project=symph-crm
```

### 3. Store secrets in Secret Manager
Run this script once. Replace ANTHROPIC_API_KEY with the real value.

```bash
PROJECT=symph-crm

echo -n "postgresql://postgres.juiwzbfvuvrtjizedtio:SymphCrm2026!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  | gcloud secrets create symph-crm-db-url --data-file=- --project=$PROJECT

echo -n "symph-crm-dev-secret-2026-local" \
  | gcloud secrets create symph-crm-nextauth-secret --data-file=- --project=$PROJECT

echo -n "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" \
  | gcloud secrets create symph-crm-google-client-secret --data-file=- --project=$PROJECT

echo -n "symph-crm-cron-secret-2026" \
  | gcloud secrets create symph-crm-cron-secret --data-file=- --project=$PROJECT

echo -n "YOUR_ANTHROPIC_API_KEY" \
  | gcloud secrets create symph-crm-anthropic-key --data-file=- --project=$PROJECT
```

### 4. Grant Cloud Build SA access to secrets + Cloud Run
```bash
PROJECT_NUMBER=$(gcloud projects describe symph-crm --format="value(projectNumber)")
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for role in roles/secretmanager.secretAccessor roles/run.admin roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding symph-crm \
    --member="serviceAccount:${CB_SA}" --role="$role"
done
```

---

## Deploy (every time)

### First Deploy (no API URL yet)
```bash
cd /share/agency/products/symph-crm/apps/main

gcloud builds submit --config cloudbuild.yaml --project=symph-crm .
```

After first deploy, grab the API URL:
```bash
API_URL=$(gcloud run services describe symph-crm-api \
  --region=asia-southeast1 --project=symph-crm \
  --format="value(status.url)")
echo $API_URL
```

Then redeploy with API URL so the web proxy rewrite works:
```bash
gcloud builds submit --config cloudbuild.yaml --project=symph-crm \
  --substitutions=_API_URL=$API_URL .
```

### Subsequent Deploys
```bash
API_URL=$(gcloud run services describe symph-crm-api \
  --region=asia-southeast1 --project=symph-crm --format="value(status.url)")

gcloud builds submit --config cloudbuild.yaml --project=symph-crm \
  --substitutions=_API_URL=$API_URL .
```

---

## Custom Domain
```bash
gcloud run domain-mappings create \
  --service=symph-crm-web \
  --domain=crm.symph.co \
  --region=asia-southeast1 \
  --project=symph-crm
```
Add the DNS records shown to GCP Cloud DNS. Update NEXTAUTH_URL and NEXT_PUBLIC_APP_URL in cloudbuild.yaml to match.

---

## Update a Secret
```bash
echo -n "NEW_VALUE" | gcloud secrets versions add symph-crm-db-url \
  --data-file=- --project=symph-crm
# Then redeploy to pick up new secret version
```
