import 'package:flutter/material.dart';

import '../../core/llm/prompt_context_budget.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/widgets/liquid_glass.dart';
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
  final _budgetService = PromptContextBudgetService();
  String? _tokenBudgetLine;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.model.internalAgentSystemPrompt(widget.definition.id));
    _ctrl.addListener(_refreshTokenBudget);
    _refreshTokenBudget();
  }

  Future<void> _refreshTokenBudget() async {
    final m = widget.model;
    if (!m.appleFoundationRuntimeAvailable || !m.appleFoundationEnabled) {
      if (mounted) setState(() => _tokenBudgetLine = null);
      return;
    }
    final def = widget.definition;
    final system = [
      'Planner context (estimate)',
      m.internalAgentSystemPrompt(def.id),
      def.modelDomainHints,
    ].join('\n');
    final budget = await _budgetService.measure(system: system, user: '{}');
    if (!mounted) return;
    if (budget.contextSize <= 0) {
      setState(() => _tokenBudgetLine = null);
      return;
    }
    final pct = (budget.usageFraction * 100).round();
    setState(
      () => _tokenBudgetLine =
          'On-device context: ~${budget.tokenCount} / ${budget.usableInput} tokens ($pct%)',
    );
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
    showLiquidGlassModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      sizesToContent: true,
      builder: (ctx) {
        final bottom = MediaQuery.viewInsetsOf(ctx).bottom;
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + bottom),
          child: ListenableBuilder(
            listenable: widget.model,
            builder: (context, _) {
              final m = widget.model;
              final lastAt = m.internalAgentLastRunById[def.id];
              final lastModel = m.internalAgentLastModelById[def.id];
              final lastTokens = m.internalAgentLastTokensById[def.id];

              String? lastRunWhenLine() {
                if (lastAt == null) return null;
                final ago = DateTime.now().difference(lastAt);
                if (ago.inMinutes < 2) return 'just now';
                if (ago.inHours < 1) return '${ago.inMinutes} min ago';
                if (ago.inHours < 48) return '${ago.inHours} h ago';
                return lastAt.toLocal().toString().split('.').first;
              }

              final muted = TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.85),
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.4,
              );

              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                    Row(
                      children: [
                        Icon(def.icon, color: Theme.of(context).colorScheme.primary),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            def.title,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text('What it does', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text(
                      def.infoWhatItDoes,
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    Text('Context sent to the model', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text(
                      def.infoContextSent,
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    Text('Output format', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text(
                      'The structured JSON the model returns is fixed by the app — you don\'t need to edit it. Your prompt above only controls the instructions.',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
                    ),
                    const SizedBox(height: 20),
                    Text('Last run', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    if (lastAt == null)
                      Text('No run recorded yet.', style: muted)
                    else ...[
                      Text('When: ${lastRunWhenLine()}', style: muted),
                      if (lastModel != null) ...[
                        const SizedBox(height: 4),
                        Text('Model: $lastModel', style: muted),
                      ],
                      if (lastTokens != null) ...[
                        const SizedBox(height: 4),
                        Text('Tokens: $lastTokens', style: muted),
                      ],
                    ],
                  ],
                );
            },
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_tokenBudgetLine != null) ...[
                    Text(
                      _tokenBudgetLine!,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Expanded(
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
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
