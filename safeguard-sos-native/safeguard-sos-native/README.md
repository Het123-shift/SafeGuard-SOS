# SafeGuard SOS — native lock-screen / power-button / widget implementation

## Files
- `android/.../SOSAccessibilityService.kt` — counts screen on/off cycles to detect triple power-button press (screen-off/locked state, **not** truly powered off — no app can intercept a genuinely powered-down device).
- `android/.../SOSForegroundService.kt` — the single source of truth for SOS: builds the lock-screen notification, fires call+SMS per contact, starts/stops voice recording. All trigger paths call into this.
- `android/.../SOSWidgetProvider.kt` + `widget_sos.xml` + `sos_widget_info.xml` — home-screen widget, one-tap SOS, bypasses the app UI entirely.
- `android/.../SOSNativeModule.kt` + `SOSPackage.kt` — React Native bridge exposing the same trigger to your existing in-app SOS button.
- `plugin/withSOSNative.js` — Expo config plugin, injects permissions + manifest entries without ejecting from managed workflow.
- `src/useSOSTrigger.ts` — JS-side calls, one function (`triggerSOS`) regardless of entry point.

## Setup steps
1. Copy `android/app/src/main/java/com/safeguardsos/native/*` into your project at the matching package path — update `com.safeguardsos` to your actual applicationId if different.
2. Copy `layout/` and `xml/` resource files into `android/app/src/main/res/`.
3. Register `SOSPackage` in your `MainApplication` — if using Expo autolinking this may need a manual entry since it's not a published npm package.
4. Add `"./plugin/withSOSNative"` to the `plugins` array in `app.json`.
5. Add `<string name="sos_accessibility_description">SafeGuard SOS needs this to detect power-button SOS triggers while your screen is locked.</string>` to `strings.xml`.
6. Rebuild dev client: `eas build --profile development --platform android` — new native permissions and services mean Expo Go won't work anymore.
7. Call `ensureSOSServiceRunning()` once in your root component on app start.
8. **Accessibility Service requires manual user opt-in** — Android doesn't allow apps to silently enable this for security reasons. You must deep-link the user to Settings (`Settings.ACTION_ACCESSIBILITY_SETTINGS`) with clear in-app instructions to toggle it on. Budget time in your demo to show this step, or pre-enable it on the demo device beforehand.

## Recording now fires for every trigger source
`startVoiceRecording()` is called from inside `SOSForegroundService.triggerSOS()` itself — the one place every trigger source lands — instead of each caller separately remembering to also start it. This covers power button, lock-screen notification, home-screen widget, and in-app button automatically since they're already in this zip.

**Your existing fall-detection, impact-detection, and smartwatch (watchOS/Wear OS) code is NOT in this zip** — that was built in an earlier round. To get recording on those triggers too, find wherever that code currently fires the SOS event and point it at the same entry, one of:
- From Kotlin/Java: send an `Intent(ACTION_TRIGGER_SOS)` to `SOSForegroundService`, same pattern as `SOSAccessibilityService` does
- From JS/RN (if fall detection or watch relay logic lives on the JS side): call `triggerSOS('fall_detection')` / `triggerSOS('impact_detection')` / `triggerSOS('smartwatch')` from `useSOSTrigger.ts` — already exported, just needs those call sites added where your sensor threshold / watch message handler currently is
Do **not** duplicate a separate recording call at those sites — recording is automatic once they route through `triggerSOS`.

## Known gaps to fill in before demo
- `getPriorityContacts()` and `getLastKnownLocationLink()` in `SOSForegroundService.kt` are stubs — wire to your existing Supabase/OnSpace contacts table and GPS cache.
- SMS retry-on-failure queue not implemented here (see earlier offline-retry plan) — add if time allows, mention as roadmap if not.
- Recording upload-to-Evidence-Vault step is a TODO — hook into your existing AES-256 vault pipeline after `stopVoiceRecording()`.
- Play Console will flag `SEND_SMS`, `CALL_PHONE`, `BIND_ACCESSIBILITY_SERVICE` as sensitive/restricted — declaration + justification needed before any public release (not blocking for hackathon demo via internal testing track).

## Platform limitation (be upfront about this to judges)
Everything here is **Android-only**. iOS blocks programmatic SMS and call sending, and has no equivalent to AccessibilityService power-button interception. Frame this as a known, disclosed limitation rather than something to hide.
