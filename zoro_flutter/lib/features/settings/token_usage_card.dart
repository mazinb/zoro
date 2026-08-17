import 'package:flutter/material.dart';

import '../../core/entitlements/token_billing.dart';
import '../../core/platform/platform_ai.dart';
import '../../core/state/app_model.dart';

/// Overall token usage. On-device and BYO keys are tracked locally and not billed.
class TokenUsageCard extends StatelessWidget {
  const TokenUsageCard({
    super.key,
    required this.model,
    this.showTitle = true,
  });

  final AppModel model;
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        final cs = Theme.of(context).colorScheme;
        final muted = TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35);
        final billed = model.serverTokensUsedTotal;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showTitle) ...[
              Text(
                'Token usage',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
            ],
            _row(context, 'Overall', model.overallTokensUsed),
            const SizedBox(height: 6),
            _row(context, PlatformAi.onDeviceSettingsTitle, model.onDeviceTokensUsed),
            const SizedBox(height: 6),
            _row(context, 'Cloud AI', model.cloudTokensUsed),
            if (model.byoKeyTokensUsed > 0) ...[
              const SizedBox(height: 6),
              _row(context, 'Your API keys', model.byoKeyTokensUsed),
            ],
            if (billed > 0) ...[
              const SizedBox(height: 6),
              _row(context, 'Cloud billed (account)', billed),
            ],
            const SizedBox(height: 8),
            Text(
              'On-device AI and your own API keys are not deducted from your Zoro balance.',
              style: muted.copyWith(fontSize: 12),
            ),
          ],
        );
      },
    );
  }

  Widget _row(BuildContext context, String label, int tokens) {
    return Row(
      children: [
        Expanded(
          child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        ),
        Text(
          '${TokenBilling.formatCount(tokens)} tokens',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}
