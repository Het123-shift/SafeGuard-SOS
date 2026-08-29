package com.safeguard.sos
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.KeyEvent

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

import android.content.Intent
import android.view.WindowManager
import com.safeguard.sos.native.SOSNativeModule

class MainActivity : ReactActivity() {
  private val inAppVolumeTimestamps = mutableListOf<Long>()

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }

    super.onCreate(null)
    handleSOSTriggerIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleSOSTriggerIntent(intent)
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.action == KeyEvent.ACTION_DOWN) {
      val keyCode = event.keyCode
      if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
        val now = SystemClock.elapsedRealtime()
        inAppVolumeTimestamps.add(now)
        inAppVolumeTimestamps.removeAll { now - it > 3500L }

        if (inAppVolumeTimestamps.size >= 3) {
          inAppVolumeTimestamps.clear()
          SOSNativeModule.notifyHardwareTrigger(this, "volume_button_triple_press")
        }
      }
    }
    return super.dispatchKeyEvent(event)
  }

  private fun handleSOSTriggerIntent(intent: Intent?) {
    if (intent == null) return
    val action = intent.action
    val source = intent.getStringExtra("source") ?: when (action) {
      "TRIGGER_SOS_WIDGET" -> "widget"
      "TRIGGER_SOS_HARDWARE" -> "volume_button_triple_press"
      else -> null
    }

    if (source != null) {
      SOSNativeModule.notifyHardwareTrigger(this, source)
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the delimiter for compatibility with Nexus 5 devices.
    * @author Gabriel Shaalo <gshaalo@gmail.com>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
