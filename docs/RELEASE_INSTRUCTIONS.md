# PairUpToday — Multi-Platform Production Release Guide

This document outlines the step-by-step procedures for building, signing, and releasing PairUpToday across all supported production distribution targets:
- **Web App**: `https://pairuptoday.com`
- **Admin Portal**: `https://admin.pairuptoday.com`
- **Android App (Google Play)**: `com.pairuptoday.app`
- **iOS App (Apple App Store / TestFlight)**: `com.pairuptoday.app`

---

## 1. Production Web & Admin Release

### A. Environment Configuration
Ensure `.env` in the server environment contains production credentials:
```bash
PORT=3000
NODE_ENV=production
CLIENT_ORIGIN=https://pairuptoday.com
ADMIN_ORIGIN=https://admin.pairuptoday.com
APITXT_API_KEY=<LIVE_APITXT_KEY>
APITXT_BASE_URL=https://apitxt.com
RAZORPAY_KEY_ID=<LIVE_RAZORPAY_KEY_ID>
RAZORPAY_KEY_SECRET=<LIVE_RAZORPAY_KEY_SECRET>
RAZORPAY_WEBHOOK_SECRET=<LIVE_RAZORPAY_WEBHOOK_SECRET>
ADMIN_EMAIL=rahulfilmsindia@gmail.com
ADMIN_PHONE=+918640851337
```

### B. Building the Client Web Application
```bash
npm run build
# Outputs to /dist
# Deployed via Dockerfile.web or static CDN/reverse proxy to pairuptoday.com
```

### C. Building the Standalone Admin Portal
```bash
npm run build:admin
# Outputs to /dist-admin
# Deployed via Dockerfile.admin or dedicated Nginx container to admin.pairuptoday.com
```

### D. Running the Backend Service
```bash
npm run start
# Runs production Express service with unified API endpoints, subdomain routing, and SHA-256 hashed OTP validation
```

---

## 2. Android Release (Google Play Store)

Package identifier: `com.pairuptoday.app`  
Source root: `/android`

### A. Prerequisites
- Android Studio Iguana / Jellyfish or latest
- JDK 17+ installed and `JAVA_HOME` set
- Android SDK 34 installed
- Production Keystore (`pairuptoday-release-key.jks`)

### B. Generating Release Keystore (One-time)
```bash
keytool -genkeypair -v -keystore pairuptoday-release-key.jks \
  -alias pairuptoday-key-alias -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=PairUpToday, OU=Engineering, O=PairUpToday Inc, L=Kolkata, ST=WB, C=IN"
```
*Securely backup the keystore and record the alias and password in your secure vault.*

### C. Configuring `key.properties`
Create `android/key.properties` (never commit to public VCS):
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=pairuptoday-key-alias
storeFile=../pairuptoday-release-key.jks
```

### D. Syncing Web Assets with Capacitor
```bash
npm run build
npx cap sync android
```

### E. Generating Android App Bundle (AAB) for Google Play
```bash
cd android
./gradlew bundleRelease
```
The production `.aab` file will be generated at:
`android/app/build/outputs/bundle/release/app-release.aab`

### F. Generating Standalone Signed APK (for direct enterprise distribution)
```bash
cd android
./gradlew assembleRelease
```
The signed `.apk` file will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`

### G. Google Play Console Submission
1. Open Google Play Console -> PairUpToday (`com.pairuptoday.app`).
2. Navigate to **Production** -> **Create new release**.
3. Upload `app-release.aab`.
4. Fill in release notes in English, Bengali, and Hindi.
5. Review permissions: `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
6. Submit release for review.

---

## 3. iOS Release (Apple App Store & TestFlight)

Bundle identifier: `com.pairuptoday.app`  
Source root: `/ios`

### A. Prerequisites
- macOS Sonoma or Sequoia with Xcode 15+
- Active Apple Developer Account with PairUpToday Team membership
- Provisioning Profile for `com.pairuptoday.app`

### B. Syncing Web Assets to iOS
```bash
npm run build
npx cap sync ios
```

### C. Opening Project in Xcode
```bash
npx cap open ios
```
Or open `/ios/App/App.xcworkspace` in Xcode.

### D. Configuring Signing & Capabilities
1. In Xcode, select the **App** project target.
2. Select **Signing & Capabilities**.
3. Check **Automatically manage signing** and select your Team.
4. Verify Bundle Identifier is `com.pairuptoday.app`.
5. Verify Info.plist permission strings:
   - `NSCameraUsageDescription`: "PairUpToday requires camera access for identity verification and profile photos."
   - `NSLocationWhenInUseUsageDescription`: "PairUpToday uses your location to discover nearby companions and verify arrival at meeting locations."
   - `NSPhotoLibraryUsageDescription`: "PairUpToday requires photo library access to upload profile pictures and verification documents."

### E. Archiving and Uploading to TestFlight
1. In Xcode, set active scheme destination to **Any iOS Device (arm64)**.
2. Select menu **Product** -> **Archive**.
3. When Xcode Organizer opens, select the latest archive and click **Distribute App**.
4. Choose **App Store Connect** -> **Upload**.
5. Keep default strip symbols and upload options checked.
6. Click **Upload** to send the build to App Store Connect.
7. Wait 10-15 minutes for processing in App Store Connect.
8. Add internal/external testers in TestFlight or submit for App Store review.

---

## 4. Emergency Response & Hotlines Verification
- Indian Police: `100` (Direct Emergency Dispatcher)
- National Emergency SOS: `112` (Unified Pan-India Hotline)
- Dedicated Admin Escalation Contact: `+918640851337` (Admin Portal Supervisor)
- Dedicated Admin Email: `rahulfilmsindia@gmail.com`
