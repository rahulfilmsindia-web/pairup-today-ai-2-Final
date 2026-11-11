# External Integration Checklist

## 1. Provider readiness by category
| Provider / environment | Local code status | External configuration status | Live verification status |
|---|---|---|---|
| Supabase | PARTIAL | REQUIRED | BLOCKED |
| Firebase | PARTIAL | REQUIRED | BLOCKED |
| Google Cloud Run / GCP | PARTIAL | REQUIRED | BLOCKED |
| Google Maps | PARTIAL | REQUIRED | BLOCKED |
| APITXT | PARTIAL | REQUIRED | BLOCKED |
| Razorpay | PARTIAL | REQUIRED | BLOCKED |
| Hosting + DNS + SSL | PARTIAL | REQUIRED | BLOCKED |
| Android signing | PARTIAL | REQUIRED | BLOCKED |
| iOS signing | PARTIAL | REQUIRED | BLOCKED |

## 2. Required external data
- Supabase URL, anon key, service role key
- Firebase project ID, service account key, DB URL, FCM config
- Google Cloud project ID, IAM permissions, Cloud Run config
- Google Maps keys
- APITXT API key and production config
- Razorpay key ID, key secret, webhook secret
- domain/DNS ownership and SSL certificates
- Android/iOS app signing assets and credentials

## 3. Actual implementation evidence
- Supabase wrapper: [server/services/supabase.ts](../../server/services/supabase.ts)
- Firebase wrapper: [server/services/firebase.ts](../../server/services/firebase.ts)
- FCM wrapper: [server/services/fcm.ts](../../server/services/fcm.ts)
- Maps service: [server/services/googlemaps.ts](../../server/services/googlemaps.ts)
- APITXT service: [server/services/apitxt.ts](../../server/services/apitxt.ts)
- Razorpay service: [server/services/razorpay.ts](../../server/services/razorpay.ts)
- Docker config: [Dockerfile.web](../../Dockerfile.web), [Dockerfile.admin](../../Dockerfile.admin)
- Env template: [.env.example](../../.env.example)

## 4. Required next external actions
1. Create the real Supabase project and execute the SQL migrations.
2. Configure Firebase project, RTDB rules, and FCM settings.
3. Create the real GCP project and deploy Cloud Run services.
4. Generate Maps API keys and enable required APIs.
5. Activate APITXT credentials.
6. Activate Razorpay production credentials and webhook endpoint.
7. Set up domain records and TLS.
8. Complete Android Play and iOS App Store release credentials.

## 5. Audit conclusion
The integration code is prepared. The actual live provider connections are not complete and must remain external tasks beyond the repository itself.
