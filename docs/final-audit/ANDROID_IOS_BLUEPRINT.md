# Android and iOS Blueprint

## 1. Android configuration
Source: [android/app/src/main/AndroidManifest.xml](../../android/app/src/main/AndroidManifest.xml)

### Package and app identity
- package name: `com.pairuptoday.app`
- application label: `PairUpToday`

### Permissions included
- camera
- fine/coarse location
- internet
- network state
- external storage / media read access

### App intent and deep-linking
The app includes a secure HTTPS deep link target for `pairuptoday.com` and an exported main activity.

### Status
- The Android manifest, app module Gradle file, network/file-provider XML, and signing-property example are present.
- The root Gradle/settings/wrapper project, Capacitor `MainActivity`, and referenced string/theme/icon resources are missing.
- Capacitor 6.2.1 runtime/Android/iOS packages, CLI, keyboard, and splash-screen plugins are now pinned in npm. The existing app module targets SDK 34 and minimum SDK 22; the Capacitor version was selected to preserve that minimum SDK.
- The current `android/` directory is a partial stub, so the Capacitor CLI refuses `cap add android` rather than overwriting it. The Android SDK is not installed in this environment; the Android project has not been generated or built.
- Signing values and deployment are intentionally not configured.

## 2. iOS configuration
Source: [ios/App/App/Info.plist](../../ios/App/App/Info.plist)

### Basic identity
- bundle identifier: `com.pairuptoday.app`
- app display name: `PairUpToday`

### Usage descriptions
- camera access
- location access while in use
- photo library access

### Status
- `Info.plist`, the associated-domains entitlement, and a signing configuration example are present.
- The Xcode project/workspace, app delegate, storyboards, and asset catalog are missing.
- Capacitor 6.2.1 iOS dependencies are pinned in npm. The current `ios/` directory is a partial stub, so the Capacitor CLI refuses to add iOS without replacing it. The iOS project must be generated and validated on macOS with Xcode rather than hand-wiring an unverified Xcode project here.
- Signing, provisioning, and release setup are not configured.

## 3. Architecture intent
The project appears designed to work as a web app wrapped in mobile container capabilities, with camera and location permissions matching the KYC and companion discovery requirements.

## 4. Implementation status
| Platform | Status | Evidence |
|---|---|---|
| Android native project | BLOCKED | [android/app/build.gradle](../../android/app/build.gradle); Gradle root/wrapper/resources/MainActivity are missing; SDK is unavailable here |
| iOS native project | BLOCKED | [ios/App/App/Info.plist](../../ios/App/App/Info.plist); Xcode project is missing and requires macOS/Xcode generation |
| Native mobile release pipeline | EXTERNAL BLOCKED | signing and store credentials missing |

## 5. Conclusion
The repository contains partial Android/iOS metadata and pinned Capacitor dependencies but not complete native projects. Project generation must preserve the existing partial configuration; native builds, signing, and release readiness are unverified.
