import 'package:flutter/material.dart';

import '../../core/persistence/app_state_transfer.dart';
import 'data_json_viewer.dart';

/// Import summary; returns merge, replace, or null (cancelled).
Future<ImportApplyMode?> showImportReviewSheet(
  BuildContext context, {
  required ImportAnalysis analysis,
  required String sourceLabel,
  required String jsonText,
}) {
  return showModalBottomSheet<ImportApplyMode>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) {
      var mode = analysis.supportsMerge ? ImportApplyMode.merge : ImportApplyMode.replace;
      return StatefulBuilder(
        builder: (context, setState) {
          final bottom = MediaQuery.paddingOf(context).bottom;
          return Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  analysis.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                Text(
                  sourceLabel,
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12),
                ),
                const SizedBox(height: 12),
                ...analysis.lines.map(
                  (line) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(line.label, style: const TextStyle(fontSize: 13, height: 1.35)),
                  ),
                ),
                if (analysis.supportsMerge && analysis.supportsReplace) ...[
                  const SizedBox(height: 12),
                  SegmentedButton<ImportApplyMode>(
                    segments: const [
                      ButtonSegment(value: ImportApplyMode.merge, label: Text('Add / update')),
                      ButtonSegment(value: ImportApplyMode.replace, label: Text('Replace all')),
                    ],
                    selected: {mode},
                    onSelectionChanged: (s) => setState(() => mode = s.first),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          showDataJsonViewer(
                            context,
                            title: 'Import',
                            jsonText: jsonText,
                            subtitle: sourceLabel,
                          );
                        },
                        child: const Text('View'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: analysis.supportsMerge
                            ? () => Navigator.pop(ctx, ImportApplyMode.merge)
                            : null,
                        child: const Text('Run'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton.tonal(
                        onPressed: analysis.supportsReplace
                            ? () => Navigator.pop(ctx, ImportApplyMode.replace)
                            : null,
                        child: const Text('Replace'),
                      ),
                    ),
                  ],
                ),
                if (!analysis.supportsMerge)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Run is not available for this file.',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 11,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      );
    },
  );
}
