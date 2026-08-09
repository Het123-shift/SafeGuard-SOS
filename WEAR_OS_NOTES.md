# Wear OS Integration Strategy & Trade-off Analysis

## Current Project Status
- **Managed Expo Workflow:** Active (`expo start --web`, Expo Go / EAS Build managed).
- **Native Folders (`ios/`, `android/`):** None present in repo root.
- **Apple Watch:** Supported via `react-native-watch-connectivity` plugin in `app.json` + `eas.json` without ejecting.

---

## Comparison of Wear OS Paths

### Path (a): Build Wear OS Gradle Module Now (Eject / Bare Workflow)
- **Execution:** Run `npx expo prebuild` to generate native `android/` and `ios/` project directories. Create a Gradle submodule `android/wear` containing the native Kotlin Wear OS app using Wearable `MessageClient`.
- **Trade-offs:**
  - ❌ Permanent ejection from managed Expo workflow.
  - ❌ High maintenance overhead: Native Gradle build configs, Kotlin codebase, custom dev client binaries required for all developer environments.
  - ❌ Prevents rapid web & Expo Go iteration.

### Path (b): Defer Wear OS for v1 (Recommended)
- **Execution:** Ship v1 with **Phone App (iOS & Android) + Apple Watch companion extension + Web Dashboard Realtime Sync**. Revisit native Wear OS module post-launch when dedicated Wear OS app binary is needed.
- **Trade-offs:**
  - ✅ Preserves clean Managed Expo Workflow and instant web/mobile iteration.
  - ✅ Zero native Android maintenance friction for initial app release.
  - ✅ Apple Watch and Web Realtime watch sync remain 100% operational.
