import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';
import '../settings/scheduled_task_editor_page.dart';
import 'agent_chat_thread_page.dart';

class ChatTab extends StatefulWidget {
  const ChatTab({
    super.key,
    required this.model,
    required this.onGoToSettingsPermissions,
    required this.toastGoToSettingsPermissions,
  });

  final AppModel model;
  final VoidCallback onGoToSettingsPermissions;
  final VoidCallback toastGoToSettingsPermissions;

  @override
  State<ChatTab> createState() => _ChatTabState();
}

class _ChatTabState extends State<ChatTab> {
  static String _providerShortLabel(LlmProvider p) => switch (p) {
        LlmProvider.openai => 'GPT',
        LlmProvider.anthropic => 'Claude',
        LlmProvider.gemini => 'Gemini',
      };

  Widget _addKeyButton(VoidCallback onTap) {
    return OutlinedButton.icon(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.slate900,
        side: const BorderSide(color: AppTheme.slate100),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
      icon: const Icon(Icons.key_outlined, size: 18),
      label: const Text('Add key', style: TextStyle(fontWeight: FontWeight.w800)),
    );
  }

  Widget _providerPicker(AppModel m, List<LlmProvider> withKeys, LlmProvider selectedProvider) {
    if (withKeys.length <= 1) {
      return Text(
        _providerShortLabel(withKeys.single),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.slate600),
      );
    }
    // DropdownButton aligns the selected row with the field and can flip/shift
    // upward; PopupMenuPosition.under always opens below the control.
    return LayoutBuilder(
      builder: (context, constraints) {
        final cap = constraints.maxWidth;
        final maxW = (cap.isFinite && cap > 0) ? cap : 160.0;
        return PopupMenuButton<LlmProvider>(
          position: PopupMenuPosition.under,
          offset: const Offset(0, 6),
          initialValue: selectedProvider,
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          onSelected: m.setActiveLlmProvider,
          itemBuilder: (ctx) => [
            for (final p in withKeys)
              PopupMenuItem<LlmProvider>(
                value: p,
                child: Text(
                  _providerShortLabel(p),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
          ],
          child: Container(
            constraints: BoxConstraints(maxWidth: maxW),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.slate100),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _providerShortLabel(selectedProvider),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.slate900, fontSize: 14),
                  ),
                ),
                const SizedBox(width: 2),
                const Icon(Icons.expand_more, color: AppTheme.slate600, size: 20),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.model,
      builder: (context, _) {
        final m = widget.model;
        final hasAnyKey = m.hasAnyApiKey;
        final withKeys = LlmProvider.values.where((p) => m.apiKeyFor(p) != null).toList();
        if (hasAnyKey && withKeys.isNotEmpty && m.apiKeyFor(m.activeLlmProvider) == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!context.mounted) return;
            if (m.apiKeyFor(m.activeLlmProvider) == null) {
              m.setActiveLlmProvider(withKeys.first);
            }
          });
        }
        final selectedProvider =
            withKeys.contains(m.activeLlmProvider) ? m.activeLlmProvider : (withKeys.isNotEmpty ? withKeys.first : m.activeLlmProvider);

        final chats = [...m.chats]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    'Chat',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const Spacer(),
                  if (!hasAnyKey)
                    _addKeyButton(widget.onGoToSettingsPermissions)
                  else ...[
                    Flexible(
                      fit: FlexFit.loose,
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: _providerPicker(m, withKeys, selectedProvider),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  const SizedBox(width: 10),
                  FilledButton.icon(
                    onPressed: () async {
                      final agentId = await _pickAgent(context, m);
                      if (agentId == null) return;
                      final agent = m.agents.firstWhere((a) => a.id == agentId);
                      final now = DateTime.now();
                      final thread = AgentChatThread(
                        id: 'chat-${now.microsecondsSinceEpoch}',
                        agentId: agentId,
                        title: agent.name,
                        createdAt: now,
                        updatedAt: now,
                        messageCount: 0,
                        tokensUsed: 0,
                        lastLine: '',
                      );
                      m.addChat(thread);
                      if (!context.mounted) return;
                      Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (ctx) => AgentChatThreadPage(
                            model: m,
                            threadId: thread.id,
                            onNoKey: widget.toastGoToSettingsPermissions,
                            onScheduleBriefing: (agentId, suggested) {
                              Navigator.of(ctx).push<void>(
                                MaterialPageRoute<void>(
                                  builder: (ctx2) => ScheduledTaskEditorPage(
                                    model: m,
                                    initialAgentId: agentId,
                                    initialRunMessage: suggested,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.add_comment),
                    label: const Text('New'),
                  ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            children: [
              if (chats.isEmpty)
                Card(
                  elevation: 0,
                  color: AppTheme.slate50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: const [
                        Text('No chats yet', style: TextStyle(fontWeight: FontWeight.w900)),
                        SizedBox(height: 6),
                        Text('Create a new chat and pick an agent.', style: TextStyle(color: AppTheme.slate600)),
                      ],
                    ),
                  ),
                )
              else
                ...chats.map((t) {
                  final agent = widget.model.agents.where((a) => a.id == t.agentId).cast<AppAgent?>().firstOrNull;
                  final agentName = agent?.name ?? 'Unknown agent';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          Navigator.of(context).push<void>(
                            MaterialPageRoute<void>(
                              builder: (ctx) => AgentChatThreadPage(
                                model: widget.model,
                                threadId: t.id,
                                onNoKey: widget.toastGoToSettingsPermissions,
                                onScheduleBriefing: (agentId, suggested) {
                                  Navigator.of(ctx).push<void>(
                                    MaterialPageRoute<void>(
                                      builder: (ctx2) => ScheduledTaskEditorPage(
                                        model: widget.model,
                                        initialAgentId: agentId,
                                        initialRunMessage: suggested,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      t.title,
                                      style: const TextStyle(fontWeight: FontWeight.w900),
                                    ),
                                    Text(
                                      (t.lastLine.trim().isEmpty ? agentName : t.lastLine),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ),
                              PopupMenuButton<String>(
                                onSelected: (v) {
                                  if (v == 'delete') {
                                    widget.model.removeChatById(t.id);
                                  }
                                },
                                itemBuilder: (ctx) => const [
                                  PopupMenuItem(value: 'delete', child: Text('Delete')),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ],
    );
      },
    );
  }
}

extension _FirstOrNullExt<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

String _agentKindLabel(AppAgentKind k) => switch (k) {
      AppAgentKind.helper => 'Helper',
      AppAgentKind.analyst => 'Analyst',
      AppAgentKind.researcher => 'Researcher',
    };

Future<String?> _pickAgent(BuildContext context, AppModel model) async {
  if (model.agents.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('No agents found. Create one in Settings → Agents.'), behavior: SnackBarBehavior.floating),
    );
    return null;
  }
  return showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (ctx) {
      return ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(8, 6, 8, 12),
            child: Text('Start a chat with…', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          ),
          ...model.agents.map(
            (a) => ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: model.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.smart_toy, color: model.accent),
              ),
              title: Text(a.name, style: const TextStyle(fontWeight: FontWeight.w900)),
              subtitle: Text(
                '${_agentKindLabel(a.kind)} · ${a.description}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => Navigator.of(ctx).pop(a.id),
            ),
          ),
        ],
      );
    },
  );
}
