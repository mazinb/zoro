import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/theme/app_theme.dart';
import 'internal_agent_prompt_editor_page.dart';

/// Built-in assistants (list). Add entries in [kInternalAppAgentDefinitions].
class InternalAppAgentsPage extends StatelessWidget {
  const InternalAppAgentsPage({super.key, required this.model});

  final AppModel model;

  String _lastRunHint(String agentId) {
    final t = model.internalAgentLastRunById[agentId];
    if (t == null) return 'No run yet';
    final ago = DateTime.now().difference(t);
    if (ago.inMinutes < 2) return 'Last run: just now';
    if (ago.inHours < 1) return 'Last run: ${ago.inMinutes}m ago';
    if (ago.inHours < 48) return 'Last run: ${ago.inHours}h ago';
    return 'Last run: ${t.toLocal().toString().split('.').first}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('App agents'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Built-in assistants use your API keys. Tap an agent to edit its system prompt.',
            style: TextStyle(color: AppTheme.slate600.withValues(alpha: 0.95)),
          ),
          const SizedBox(height: 16),
          AnimatedBuilder(
            animation: model,
            builder: (context, _) {
              return Column(
                children: [
                  for (final def in kInternalAppAgentDefinitions)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: model.accentSoft,
                            child: Icon(def.icon, color: model.accent, size: 22),
                          ),
                          title: Text(def.title, style: const TextStyle(fontWeight: FontWeight.w900)),
                          subtitle: Text(
                            '${def.listSubtitle}\n${_lastRunHint(def.id)}',
                            style: const TextStyle(color: AppTheme.slate600, fontSize: 12, height: 1.3),
                          ),
                          isThreeLine: true,
                          trailing: const Icon(Icons.chevron_right, color: AppTheme.slate500),
                          onTap: () {
                            Navigator.of(context).push<void>(
                              MaterialPageRoute(
                                builder: (ctx) => InternalAgentPromptEditorPage(
                                  definition: def,
                                  model: model,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
