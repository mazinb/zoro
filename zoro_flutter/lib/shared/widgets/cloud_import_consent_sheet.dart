import 'package:flutter/material.dart';

import '../../core/legal/legal_urls.dart';
import '../../core/llm/cloud_import_consent_info.dart';
import '../../core/llm/llm_consent_gate.dart';
import '../../core/state/app_model.dart';

/// In-app disclosure before cloud import sends data off-device.
class CloudImportConsentSheet extends StatelessWidget {
  const CloudImportConsentSheet({super.key});

  static Future<bool> show(BuildContext context) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (ctx) => const CloudImportConsentSheet(),
    );
    return result == true;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Use Cloud AI for imports?',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            Text(
              'Imports work best with Cloud AI — especially photos. '
              'You can turn this off anytime in Settings. '
              'Without it, only PDF and text files use on-device AI.',
              style: TextStyle(color: cs.onSurfaceVariant, height: 1.4),
            ),
            const SizedBox(height: 16),
            Text(
              'What may be sent',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            for (final item in CloudImportConsentInfo.dataSent)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('• ', style: TextStyle(color: cs.onSurfaceVariant, height: 1.35)),
                    Expanded(
                      child: Text(item, style: TextStyle(color: cs.onSurfaceVariant, height: 1.35)),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 10),
            Text(
              CloudImportConsentInfo.processingLocation,
              style: TextStyle(color: cs.onSurfaceVariant, height: 1.35, fontSize: 12),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                TextButton(
                  onPressed: () => LlmConsentGate.openUrl(context, CloudImportConsentInfo.recipientTermsUrl),
                  child: const Text('Google terms'),
                ),
                TextButton(
                  onPressed: () => LlmConsentGate.openUrl(context, CloudImportConsentInfo.recipientPrivacyUrl),
                  child: const Text('Google privacy'),
                ),
                TextButton(
                  onPressed: () => LlmConsentGate.openUrl(context, LegalUrls.termsOfUse),
                  child: const Text('Zoro legal'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Allow Cloud AI'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Not now'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Ensures cloud import consent before sending data off-device.
class CloudImportConsentGate {
  CloudImportConsentGate._();

  static Future<bool> ensure(BuildContext context, AppModel model) async {
    if (model.canUseCloudImport) return true;
    if (!context.mounted) return false;
    final granted = await CloudImportConsentSheet.show(context);
    if (!granted || !context.mounted) return false;
    await model.grantCloudImportConsent();
    return true;
  }
}
