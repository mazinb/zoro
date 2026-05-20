import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';

Future<void> openGoalsAllocationSheet({
  required BuildContext context,
  required AppModel model,
}) {
  return showLiquidGlassModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    sizesToContent: true,
    builder: (ctx) => _GoalsAllocationNotesSheet(model: model),
  );
}

/// Context notes for the invest / save split (slider stays on Goals tab).
class _GoalsAllocationNotesSheet extends StatefulWidget {
  const _GoalsAllocationNotesSheet({required this.model});

  final AppModel model;

  @override
  State<_GoalsAllocationNotesSheet> createState() => _GoalsAllocationNotesSheetState();
}

class _GoalsAllocationNotesSheetState extends State<_GoalsAllocationNotesSheet> {
  late final TextEditingController _notesCtrl;
  final FocusNode _notesFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _notesCtrl = TextEditingController(text: widget.model.allocationContextMarkdown);
  }

  @override
  void dispose() {
    widget.model.setAllocationContextMarkdown(_notesCtrl.text);
    _notesFocus.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _saveAndClose() {
    widget.model.setAllocationContextMarkdown(_notesCtrl.text);
    _notesFocus.unfocus();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Allocation notes',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  visualDensity: VisualDensity.compact,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            Text(
              'Assumptions for your invest / save split',
              style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notesCtrl,
              focusNode: _notesFocus,
              minLines: 4,
              maxLines: 14,
              textInputAction: TextInputAction.newline,
              keyboardType: TextInputType.multiline,
              decoration: const InputDecoration(
                hintText: 'RSU plan, bonus timing, one-off changes…',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              onChanged: (_) => widget.model.setAllocationContextMarkdown(_notesCtrl.text),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saveAndClose,
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
