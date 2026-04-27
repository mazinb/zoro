import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import 'agent_runner_page.dart';
import '../../shared/theme/app_theme.dart';

class AgentsTab extends StatelessWidget {
  const AgentsTab({
    super.key,
    required this.model,
  });

  final AppModel model;

  String _contextHint(String md) {
    final t = md.trim();
    if (t.isEmpty) return 'No context note';
    final firstLine = t.split('\n').first.trim();
    return firstLine.isEmpty ? 'Context note added' : firstLine;
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Text(
              'Agents',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppTheme.slate50,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppTheme.slate100),
              ),
              child: const Text(
                'UI-only',
                style: TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w900, fontSize: 12),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Run an agent', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 6),
                const Text(
                  'Pick a target (asset, liability, or month) and build context. Agents will write to your data.',
                  style: TextStyle(color: AppTheme.slate600),
                ),
                const SizedBox(height: 12),
                ...builtInAgentTemplates.map(
                  (t) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      elevation: 0,
                      color: AppTheme.slate50,
                      child: ListTile(
                        title: Text(t.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                        subtitle: Text(t.description, style: const TextStyle(color: AppTheme.slate600)),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.of(context).push<void>(
                            MaterialPageRoute(
                              builder: (ctx) => AgentRunnerPage(model: model, template: t),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Agent library', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 6),
                const Text(
                  'Reusable agents (prompts + tool permissions).',
                  style: TextStyle(color: AppTheme.slate600),
                ),
                const SizedBox(height: 12),
                ...model.agents.map((a) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.slate50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.slate100),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: model.accent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(Icons.smart_toy, color: model.accent),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(a.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                                const SizedBox(height: 2),
                                Text(a.description, style: const TextStyle(color: AppTheme.slate600)),
                                const SizedBox(height: 8),
                                Text(
                                  _contextHint(a.contextMarkdown),
                                  style: const TextStyle(color: AppTheme.slate500, fontSize: 12, fontWeight: FontWeight.w700),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

