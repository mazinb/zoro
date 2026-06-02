import 'dart:async';

import 'package:flutter/material.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/state/app_model.dart';

/// Home-message notification prefs on Settings → General.
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
  bool _busy = false;

  Future<void> _onEnableChanged(bool enabled) async {
    final model = widget.model;
    if (!enabled) {
      model.setHomeMessagesNotifications(false);
      return;
    }

    setState(() => _busy = true);
    try {
      final svc = NotificationService.instance;
      if (await svc.isAuthorized()) {
        model.setNotificationsEnabled(true);
        model.setHomeMessagesNotifications(true);
        return;
      }
      final granted = await svc.requestPermission();
      if (!granted) return;
      model.setNotificationsEnabled(true);
      model.setHomeMessagesNotifications(true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
              title: const Text('New Home note alerts', style: TextStyle(fontWeight: FontWeight.w800)),
              value: model.homeMessagesNotifications,
              onChanged: _busy ? null : _onEnableChanged,
            ),
            if (model.homeMessagesNotifications) ...[
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: widget.onOpenHomeSettings,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'Configure in Helpers → Home',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      decoration: TextDecoration.underline,
                      decorationColor: scheme.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<HomeMessageCadence>(
                initialValue: model.homeMessagesCadence,
                decoration: const InputDecoration(
                  labelText: 'Cadence',
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final v in HomeMessageCadence.values)
                    DropdownMenuItem<HomeMessageCadence>(
                      value: v,
                      child: Text(v.label),
                    ),
                ],
                onChanged: (v) {
                  if (v == null) return;
                  model.setHomeMessagesCadence(v);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
