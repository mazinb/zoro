import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';

/// Home summary helper prefs on Settings → General.
class HomeMessagesSettingsCard extends StatefulWidget {
  const HomeMessagesSettingsCard({
    super.key,
    required this.model,
    required this.onOpenHomeSettings,
  });

  final AppModel model;
  final VoidCallback onOpenHomeSettings;

  @override
  State<HomeMessagesSettingsCard> createState() => _HomeMessagesSettingsCardState();
}

class _HomeMessagesSettingsCardState extends State<HomeMessagesSettingsCard> {
  late final TapGestureRecognizer _homeLinkRecognizer;

  @override
  void initState() {
    super.initState();
    _homeLinkRecognizer = TapGestureRecognizer()..onTap = widget.onOpenHomeSettings;
  }

  @override
  void didUpdateWidget(covariant HomeMessagesSettingsCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.onOpenHomeSettings != widget.onOpenHomeSettings) {
      _homeLinkRecognizer.onTap = widget.onOpenHomeSettings;
    }
  }

  @override
  void dispose() {
    _homeLinkRecognizer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final model = widget.model;

    return Material(
      color: scheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Home messages', style: TextStyle(fontWeight: FontWeight.w800)),
              value: model.homeMessagesEnabled,
              onChanged: model.setHomeMessagesEnabled,
            ),
            if (model.homeMessagesEnabled) ...[
              const SizedBox(height: 6),
              _HomeMessageCadenceRow(
                value: model.homeMessagesCadence,
                onChanged: model.setHomeMessagesCadence,
              ),
              const SizedBox(height: 8),
              Text.rich(
                TextSpan(
                  style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13, height: 1.35),
                  children: [
                    const TextSpan(text: 'Configure in '),
                    TextSpan(
                      text: 'Helpers → Home',
                      style: TextStyle(
                        color: scheme.primary,
                        fontWeight: FontWeight.w800,
                        decoration: TextDecoration.underline,
                        decorationColor: scheme.primary,
                      ),
                      recognizer: _homeLinkRecognizer,
                    ),
                    const TextSpan(text: '.'),
                  ],
                ),
              ),
              if (model.notificationsEnabled) ...[
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Notify when ready', style: TextStyle(fontWeight: FontWeight.w800)),
                  value: model.homeMessagesNotifications,
                  onChanged: model.setHomeMessagesNotifications,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _HomeMessageCadenceRow extends StatelessWidget {
  const _HomeMessageCadenceRow({
    required this.value,
    required this.onChanged,
  });

  final HomeMessageCadence value;
  final ValueChanged<HomeMessageCadence> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Text('Schedule', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
        DropdownButton<HomeMessageCadence>(
          value: value,
          isDense: true,
          items: [
            for (final c in HomeMessageCadence.values)
              DropdownMenuItem(
                value: c,
                child: Text(c.label),
              ),
          ],
          onChanged: (v) {
            if (v == null) return;
            onChanged(v);
          },
        ),
      ],
    );
  }
}
