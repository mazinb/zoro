import 'package:flutter/material.dart';

import '../../core/legal/legal_urls.dart';
import '../../core/legal/open_legal_url.dart';
import '../../core/llm/llm_provider_consent_info.dart';
import '../../core/state/app_model.dart';
import 'modal_sheet_insets.dart';

/// In-app disclosure + permission before sharing data with a third-party AI provider.
class LlmProviderConsentSheet extends StatelessWidget {
  const LlmProviderConsentSheet({super.key, required this.provider});

  final LlmProvider provider;

  static Future<bool> show(BuildContext context, LlmProvider provider) async {
    final result = await showAppModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => LlmProviderConsentSheet(provider: provider),
    );
    return result == true;
  }

  Future<void> _openUrl(BuildContext context, String url) async {
    await openExternalUrl(url, context: context);
  }

  @override
  Widget build(BuildContext context) {
    final info = LlmProviderConsentInfo.forProvider(provider);
    final cs = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Allow ${info.displayName}?',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            Text(
              'Before Zoro sends your data to an AI service, we need your permission. '
              'You can turn this off later by disabling the model in Settings.',
              style: TextStyle(color: cs.onSurfaceVariant, height: 1.4),
            ),
            const SizedBox(height: 16),
            Text('Who receives your data', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(info.recipientDescription, style: TextStyle(color: cs.onSurfaceVariant, height: 1.35)),
            const SizedBox(height: 14),
            Text('What may be sent', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            for (final item in info.dataSent)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('• ', style: TextStyle(color: cs.onSurfaceVariant, height: 1.35)),
                    Expanded(child: Text(item, style: TextStyle(color: cs.onSurfaceVariant, height: 1.35))),
                  ],
                ),
              ),
            const SizedBox(height: 10),
            Text('Where it is processed', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(info.processingLocation, style: TextStyle(color: cs.onSurfaceVariant, height: 1.35)),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                TextButton(
                  onPressed: () => _openUrl(context, info.recipientPrivacyUrl),
                  child: Text('${info.recipientName} privacy policy'),
                ),
                TextButton(
                  onPressed: () => _openUrl(context, LegalUrls.privacyPolicy),
                  child: const Text('Zoro privacy policy'),
                ),
                TextButton(
                  onPressed: () => _openUrl(context, LegalUrls.termsOfUse),
                  child: const Text('Terms of Use'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text('Allow ${info.displayName}'),
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
