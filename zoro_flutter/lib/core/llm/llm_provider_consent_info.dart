import '../state/app_model.dart';

/// Disclosure copy shown before the user enables or first uses an AI provider.
class LlmProviderConsentInfo {
  const LlmProviderConsentInfo({
    required this.provider,
    required this.displayName,
    required this.recipientName,
    required this.recipientDescription,
    required this.processingLocation,
    required this.dataSent,
    required this.recipientPrivacyUrl,
  });

  final LlmProvider provider;
  final String displayName;
  final String recipientName;
  final String recipientDescription;
  final String processingLocation;
  final List<String> dataSent;
  final String recipientPrivacyUrl;

  static LlmProviderConsentInfo forProvider(LlmProvider provider) => switch (provider) {
        LlmProvider.appleFoundation => const LlmProviderConsentInfo(
              provider: LlmProvider.appleFoundation,
              displayName: 'Apple on-device model',
              recipientName: 'Apple Inc.',
              recipientDescription:
                  'Apple Intelligence Foundation Models on your iPhone (Apple Inc., apple.com)',
              processingLocation:
                  'Processed on your device using Apple\'s on-device model. Apple may apply its own on-device privacy protections; see Apple\'s privacy policy for details.',
              dataSent: [
                'Text you type or paste into helpers',
                'Summarized ledger data included in prompts (asset/liability names, balances, types)',
                'Cash flow, expense bucket estimates, and goals context when a helper includes them',
                'Context notes and markdown you wrote in the app',
                'File text extracted from PDFs or images you choose to attach',
              ],
              recipientPrivacyUrl: 'https://www.apple.com/legal/privacy/',
            ),
        LlmProvider.openai => const LlmProviderConsentInfo(
              provider: LlmProvider.openai,
              displayName: 'OpenAI',
              recipientName: 'OpenAI, L.L.C.',
              recipientDescription: 'OpenAI API (OpenAI, L.L.C., openai.com)',
              processingLocation:
                  'Sent over the internet to OpenAI\'s servers in regions where OpenAI operates.',
              dataSent: [
                'Text you type or paste into helpers',
                'Summarized ledger data included in prompts (asset/liability names, balances, types)',
                'Cash flow, expense bucket estimates, and goals context when a helper includes them',
                'Context notes and markdown you wrote in the app',
                'File text extracted from PDFs or images you choose to attach',
                'Your OpenAI API key (stored only on this device; sent with each request)',
              ],
              recipientPrivacyUrl: 'https://openai.com/policies/privacy-policy/',
            ),
        LlmProvider.anthropic => const LlmProviderConsentInfo(
              provider: LlmProvider.anthropic,
              displayName: 'Anthropic',
              recipientName: 'Anthropic PBC',
              recipientDescription: 'Anthropic API (Anthropic PBC, anthropic.com)',
              processingLocation:
                  'Sent over the internet to Anthropic\'s servers in regions where Anthropic operates.',
              dataSent: [
                'Text you type or paste into helpers',
                'Summarized ledger data included in prompts (asset/liability names, balances, types)',
                'Cash flow, expense bucket estimates, and goals context when a helper includes them',
                'Context notes and markdown you wrote in the app',
                'File text extracted from PDFs or images you choose to attach',
                'Your Anthropic API key (stored only on this device; sent with each request)',
              ],
              recipientPrivacyUrl: 'https://www.anthropic.com/legal/privacy',
            ),
        LlmProvider.gemini => const LlmProviderConsentInfo(
              provider: LlmProvider.gemini,
              displayName: 'Google Gemini',
              recipientName: 'Google LLC',
              recipientDescription: 'Google Gemini API (Google LLC, google.com)',
              processingLocation:
                  'Sent over the internet to Google\'s servers in regions where Google operates.',
              dataSent: [
                'Text you type or paste into helpers',
                'Summarized ledger data included in prompts (asset/liability names, balances, types)',
                'Cash flow, expense bucket estimates, and goals context when a helper includes them',
                'Context notes and markdown you wrote in the app',
                'File text extracted from PDFs or images you choose to attach',
                'Your Google Gemini API key (stored only on this device; sent with each request)',
              ],
              recipientPrivacyUrl: 'https://policies.google.com/privacy',
            ),
      };
}
