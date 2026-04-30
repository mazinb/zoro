import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/theme/app_theme.dart';

/// Full-screen system prompt editor for one built-in agent; info in a bottom sheet.
class InternalAgentPromptEditorPage extends StatefulWidget {
  const InternalAgentPromptEditorPage({
    super.key,
    required this.definition,
    required this.model,
  });

  final InternalAppAgentDefinition definition;
  final AppModel model;

  @override
  State<InternalAgentPromptEditorPage> createState() => _InternalAgentPromptEditorPageState();
}

class _InternalAgentPromptEditorPageState extends State<InternalAgentPromptEditorPage> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.model.internalAgentSystemPrompt(widget.definition.id));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _save() {
    widget.model.setInternalAgentSystemPrompt(widget.definition.id, _ctrl.text);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Saved'), behavior: SnackBarBehavior.floating),
    );
  }

  void _showInfoSheet() {
    final def = widget.definition;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) {
        final bottom = MediaQuery.viewInsetsOf(ctx).bottom;
        final lastAt = widget.model.internalAgentLastRunById[def.id];
        final structured = widget.model.internalAgentLastStructuredById[def.id] ?? const <String, Object?>{};
        final summary = structured['summary']?.toString().trim();
        final warnings = structured['warnings'];
        final buf = StringBuffer();
        if (summary != null && summary.isNotEmpty) {
          buf.writeln(summary);
        } else {
          buf.writeln('No short summary from the last run yet.');
        }
        if (warnings is List && warnings.isNotEmpty) {
          buf.writeln();
          buf.writeln('Heads-up:');
          for (final w in warnings) {
            buf.writeln('• ${w.toString()}');
          }
        }

        String lastRunLine() {
          if (lastAt == null) return 'No run recorded yet.';
          final ago = DateTime.now().difference(lastAt);
          if (ago.inMinutes < 2) return 'Last run: just now';
          if (ago.inHours < 1) return 'Last run: ${ago.inMinutes} min ago';
          if (ago.inHours < 48) return 'Last run: ${ago.inHours} h ago';
          return 'Last run: ${lastAt.toLocal().toString().split('.').first}';
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(20, 6, 20, 20 + bottom),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(def.icon, color: Theme.of(ctx).colorScheme.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        def.title,
                        style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text('What it does', style: Theme.of(ctx).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(def.infoWhatItDoes, style: const TextStyle(color: AppTheme.slate600, height: 1.4)),
                const SizedBox(height: 16),
                Text('What you need', style: Theme.of(ctx).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(def.infoDataYouProvide, style: const TextStyle(color: AppTheme.slate600, height: 1.4)),
                const SizedBox(height: 20),
                Text('Last run', style: Theme.of(ctx).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(lastRunLine(), style: const TextStyle(color: AppTheme.slate500, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppTheme.slate50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.slate100),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: SelectableText(
                      buf.toString().trim(),
                      style: const TextStyle(color: AppTheme.slate600, fontSize: 13, height: 1.35),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.model,
      builder: (context, _) {
        return Scaffold(
          resizeToAvoidBottomInset: true,
          appBar: AppBar(
            title: Text(widget.definition.title),
            actions: [
              IconButton(
                tooltip: 'About this agent',
                icon: const Icon(Icons.info_outline),
                onPressed: _showInfoSheet,
              ),
              TextButton(
                onPressed: _save,
                child: const Text('Save'),
              ),
            ],
          ),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: SizedBox.expand(
                child: TextField(
                  controller: _ctrl,
                  expands: true,
                  maxLines: null,
                  minLines: null,
                  keyboardType: TextInputType.multiline,
                  textAlignVertical: TextAlignVertical.top,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    hintText: 'System prompt…',
                    alignLabelWithHint: true,
                    contentPadding: EdgeInsets.all(12),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
