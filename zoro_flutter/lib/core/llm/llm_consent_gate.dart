import 'package:flutter/material.dart';

import '../legal/open_legal_url.dart';
import '../state/app_model.dart';
import '../../shared/widgets/cloud_import_consent_sheet.dart';
import '../../shared/widgets/llm_provider_consent_sheet.dart';

/// Ensures the user has granted in-app permission before data is sent to an AI provider.
class LlmConsentGate {
  LlmConsentGate._();

  static Future<bool> ensure(
    BuildContext context,
    AppModel model,
    LlmProvider provider,
  ) async {
    // On-device model — no third-party transmission; no consent sheet.
    if (provider == LlmProvider.appleFoundation) {
      if (model.appleFoundationRuntimeAvailable && !model.appleFoundationEnabled) {
        model.setAppleFoundationEnabled(true);
      }
      return model.appleFoundationRuntimeAvailable;
    }
    if (provider == LlmProvider.zoroCloud) {
      return CloudImportConsentGate.ensure(context, model);
    }
    if (model.hasLlmProviderConsent(provider)) return true;
    if (!context.mounted) return false;
    final granted = await LlmProviderConsentSheet.show(context, provider);
    if (!granted || !context.mounted) return false;
    await model.grantLlmProviderConsent(provider);
    return true;
  }

  static Future<bool> Function(LlmProvider provider) requester(
    BuildContext context,
    AppModel model,
  ) =>
      (provider) => ensure(context, model, provider);

  static Future<void> openUrl(BuildContext context, String url) async {
    await openExternalUrl(url, context: context);
  }
}
