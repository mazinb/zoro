import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Platform helpers for AI feature availability and copy.
abstract final class PlatformAi {
  static bool get isAndroid => !kIsWeb && Platform.isAndroid;

  static bool get isIos => !kIsWeb && Platform.isIOS;

  /// True when a platform on-device model can run (iOS or Android).
  static bool get supportsPlatformOnDevice => isIos || isAndroid;

  /// Short label for Settings → Usage on-device row.
  static String get onDeviceSettingsTitle => 'On-device';

  /// Subtitle when on-device model is unavailable.
  static String onDeviceUnavailableNote({String? disabledReason}) {
    final reason = disabledReason?.trim();
    if (reason != null && reason.isNotEmpty) return reason;
    if (isAndroid) {
      return 'Requires a supported device with AICore and Gemini Nano enabled.';
    }
    if (isIos) {
      return 'Requires Apple Intelligence on a supported iPhone.';
    }
    return 'Not available on this device';
  }

  /// Message when helpers cannot run (no on-device, no API keys).
  static String helperUnavailableMessage({
    required bool appleFoundationRuntimeAvailable,
    required bool appleFoundationEnabled,
    required bool hasAnyApiKey,
    required bool canUseCloudImport,
    String? appleDisabledReason,
  }) {
    if (appleFoundationRuntimeAvailable && !appleFoundationEnabled) {
      return 'Turn on the on-device model in Settings → Usage.';
    }
    final reason = appleDisabledReason?.trim();
    if (reason != null && reason.isNotEmpty && !appleFoundationRuntimeAvailable) {
      return reason;
    }
    if (!hasAnyApiKey && !appleFoundationRuntimeAvailable) {
      if (isAndroid) {
        if (!canUseCloudImport) {
          return 'Cloud AI is needed on this device. Allow it when you use a helper or import.';
        }
        return 'Using Cloud AI for helpers on this device.';
      }
      return 'Apple on-device model is not available on this device.';
    }
    return 'No language model available. Check Settings → Usage.';
  }

  /// Import error when neither Cloud AI nor on-device fallback is available.
  static String importNeedsAiMessage() {
    if (isAndroid) {
      return 'Import needs Cloud AI or on-device AI. Turn on Cloud AI in Settings, or use a device with Gemini Nano.';
    }
    return 'Import needs Cloud AI or on-device AI. Turn on Cloud AI in Settings, or use a device with Apple Intelligence.';
  }

  /// Cloud import consent sheet body (platform-specific fallback note).
  static String cloudImportConsentBody() {
    if (isAndroid) {
      return 'Imports work best with Cloud AI — especially photos. '
          'You can turn this off anytime in Settings. '
          'Without Cloud AI, PDF and text files can use on-device Gemini Nano when available.';
    }
    return 'Imports work best with Cloud AI — especially photos. '
        'You can turn this off anytime in Settings. '
        'Without it, only PDF and text files use on-device AI.';
  }

  /// Tab help copy for ✨ helpers.
  static String helperTabHelpLine() {
    return 'The ✨ action runs on-device helpers when available.';
  }

  /// Prompt for Cloud AI after onboarding when on-device is also unavailable.
  static bool shouldPromptCloudConsentAfterOnboarding({
    required bool hasCloudImportConsent,
    required bool onDeviceRuntimeAvailable,
  }) =>
      !hasCloudImportConsent && !onDeviceRuntimeAvailable;
}
