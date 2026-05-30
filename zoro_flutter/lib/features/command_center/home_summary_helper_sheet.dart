import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/home/home_summary_focus_domain.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';

void showHomeSummaryHelperSheet(BuildContext context, AppModel model) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (ctx) => _HomeSummaryHelperSheet(model: model),
  );
}

class _HomeSummaryHelperSheet extends StatefulWidget {
  const _HomeSummaryHelperSheet({required this.model});

  final AppModel model;

  @override
  State<_HomeSummaryHelperSheet> createState() => _HomeSummaryHelperSheetState();
}

class _HomeSummaryHelperSheetState extends State<_HomeSummaryHelperSheet> {
  late Set<HomeSummaryFocusDomain> _selected;

  List<HomeSummaryFocusDomain> get _orderedSelected =>
      homeSummaryDomainsInCanonicalOrder(_selected);

  int get _previewRotationIndex {
    final saved = widget.model.homeSummaryHelperIncludedDomains;
    if (listEquals(_orderedSelected, saved)) {
      return widget.model.homeSummaryHelperRotationIndex;
    }
    return remapHomeSummaryRotationIndex(
      oldEnabled: saved,
      newEnabled: _orderedSelected,
      rotationIndex: widget.model.homeSummaryHelperRotationIndex,
    );
  }

  @override
  void initState() {
    super.initState();
    _selected = widget.model.homeSummaryHelperIncludedDomains.toSet();
  }

  String _lastRunLine(DateTime now) {
    final at = widget.model.homeSummaryHelperLastRunAt;
    if (at == null) return 'Last run: never';
    final today = DateTime(now.year, now.month, now.day);
    final runDay = DateTime(at.year, at.month, at.day);
    if (runDay == today) return 'Last run: today';
    final rel = formatAgentLastRunRelative(at, now: now);
    if (rel != null) return 'Last run: $rel';
    return 'Last run: ${at.toLocal().toString().split(' ').first}';
  }

  void _save() {
    if (_orderedSelected.isEmpty) return;
    widget.model.setHomeSummaryHelperIncludedDomains(_orderedSelected);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final now = DateTime.now();
    final nextFocus = _orderedSelected.isEmpty
        ? null
        : homeSummaryDomainAtRotationIndex(_orderedSelected, _previewRotationIndex);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          bottom: MediaQuery.paddingOf(context).bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Home summary helper',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              _lastRunLine(now),
              style: TextStyle(color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
            ),
            if (nextFocus != null) ...[
              const SizedBox(height: 4),
              Text(
                'Next up: ${nextFocus.label}',
                style: TextStyle(color: cs.outline, fontSize: 13),
              ),
            ],
            const SizedBox(height: 4),
            Text(
              'Runs once per day when you open the app. Pick which topics stay in rotation.',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
            ),
            const SizedBox(height: 12),
            for (final d in HomeSummaryFocusDomain.values)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: Text(d.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                value: _selected.contains(d),
                onChanged: (on) {
                  setState(() {
                    if (on == true) {
                      _selected.add(d);
                    } else if (_selected.length > 1) {
                      _selected.remove(d);
                    }
                  });
                },
              ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _selected.isEmpty ? null : _save,
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }
}
