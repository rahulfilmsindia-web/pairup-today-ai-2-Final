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
- Project shell and permissions are present.
- Native signing and app deployment are not completed.

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
- xCode project file structures and plist placeholders exist.
- app signing, provisioning, and release setup are not live-configured.

## 3. Architecture intent
The project appears designed to work as a web app wrapped in mobile container capabilities, with camera and location permissions matching the KYC and companion discovery requirements.

## 4. Implementation status
| Platform | Status | Evidence |
|---|---|---|
| Android manifest | PARTIAL | [android/app/src/main/AndroidManifest.xml](../../android/app/src/main/AndroidManifest.xml) |
| iOS plist | PARTIAL | [ios/App/App/Info.plist](../../ios/App/App/Info.plist) |
| Native mobile release pipeline | EXTERNAL BLOCKED | signing and store credentials missing |

## 5. Conclusion
The mobile apps are prepared at the project-configuration level, but not completed as release-ready, provider-connected mobile applications.
