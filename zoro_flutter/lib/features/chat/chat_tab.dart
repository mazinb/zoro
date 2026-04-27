import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';

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
  @override
  Widget build(BuildContext context) {
    final hasKey = widget.model.hasAnyApiKey;
    final chats = [...widget.model.chats]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Row(
            children: [
              Text(
                'Chat',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
              ),
              const Spacer(),
              if (!hasKey)
                FilledButton.icon(
                  onPressed: widget.onGoToSettingsPermissions,
                  icon: const Icon(Icons.key),
                  label: const Text('Add key'),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.slate50,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppTheme.slate100),
                  ),
                  child: Text(
                    'Provider: ${widget.model.activeLlmProvider.name}',
                    style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        if (!hasKey)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Chat is disabled', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    const SizedBox(height: 6),
                    const Text(
                      'Add an OpenAI, Anthropic, or Gemini key in Settings → Permissions.',
                      style: TextStyle(color: AppTheme.slate600),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: widget.onGoToSettingsPermissions,
                      child: const Text('Open Permissions'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        const SizedBox(height: 8),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text('Chats', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                  ),
                  FilledButton.icon(
                    onPressed: () async {
                      final agentId = await _pickAgent(context, widget.model);
                      if (agentId == null) return;
                      final agent = widget.model.agents.firstWhere((a) => a.id == agentId);
                      final now = DateTime.now();
                      final thread = AgentChatThread(
                        id: 'chat-${now.microsecondsSinceEpoch}',
                        agentId: agentId,
                        title: 'New chat • ${agent.name}',
                        createdAt: now,
                        updatedAt: now,
                        messageCount: 0,
                        tokensUsed: 0,
                      );
                      widget.model.addChat(thread);
                      if (!context.mounted) return;
                      Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (ctx) => _ChatThreadPage(
                            model: widget.model,
                            threadId: thread.id,
                            onNoKey: widget.toastGoToSettingsPermissions,
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.add_comment),
                    label: const Text('New'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
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
                            MaterialPageRoute(
                              builder: (ctx) => _ChatThreadPage(
                                model: widget.model,
                                threadId: t.id,
                                onNoKey: widget.toastGoToSettingsPermissions,
                              ),
                            ),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: widget.model.accent.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(Icons.smart_toy, color: widget.model.accent),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(t.title, style: const TextStyle(fontWeight: FontWeight.w900)),
                                    const SizedBox(height: 2),
                                    Text(
                                      agentName,
                                      style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w700),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${t.messageCount} msgs • ${t.tokensUsed} tokens',
                                      style: const TextStyle(color: AppTheme.slate500, fontSize: 12, fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right, color: AppTheme.slate500),
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
  }
}

extension _FirstOrNullExt<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

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
              subtitle: Text(a.description, maxLines: 2, overflow: TextOverflow.ellipsis),
              onTap: () => Navigator.of(ctx).pop(a.id),
            ),
          ),
        ],
      );
    },
  );
}

class _ChatThreadPage extends StatefulWidget {
  const _ChatThreadPage({required this.model, required this.threadId, required this.onNoKey});

  final AppModel model;
  final String threadId;
  final VoidCallback onNoKey;

  @override
  State<_ChatThreadPage> createState() => _ChatThreadPageState();
}

class _ChatThreadPageState extends State<_ChatThreadPage> {
  final _ctrl = TextEditingController();
  final _messages = <({bool fromUser, String text})>[];

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _send() {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    if (!widget.model.hasAnyApiKey) {
      widget.onNoKey();
      return;
    }
    setState(() {
      _messages.add((fromUser: true, text: text));
      _messages.add((fromUser: false, text: 'UI-only: agent response will be wired later.'));
    });
    _ctrl.clear();
    final idx = widget.model.chats.indexWhere((t) => t.id == widget.threadId);
    if (idx >= 0) {
      final t = widget.model.chats[idx].clone();
      t.updatedAt = DateTime.now();
      t.messageCount += 2;
      t.tokensUsed += 200; // placeholder
      widget.model.updateChat(idx, t);
    }
  }

  bool _canUse(AppAgent agent, AgentDomain domain, AgentAccess access) {
    return agent.permissions.contains(AgentPermission(domain: domain, access: access));
  }

  void _toolDeniedToast() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Tool not enabled for this agent. Edit tools in Settings → Agents.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.model.chats.firstWhere((x) => x.id == widget.threadId);
    final agent = widget.model.agents.firstWhere((a) => a.id == t.agentId);
    return Scaffold(
      appBar: AppBar(
        title: Text(t.title),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(28),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              agent.name,
              style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ToolChip(
                  icon: Icons.pie_chart_outline,
                  label: 'Expenses',
                  onTap: () {
                    if (!_canUse(agent, AgentDomain.expenses, AgentAccess.read)) {
                      _toolDeniedToast();
                      Navigator.of(context).pop();
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('UI-only: would attach expense context.'), behavior: SnackBarBehavior.floating),
                    );
                  },
                ),
                _ToolChip(
                  icon: Icons.swap_vert,
                  label: 'Cash flow',
                  onTap: () {
                    if (!_canUse(agent, AgentDomain.cashflow, AgentAccess.read)) {
                      _toolDeniedToast();
                      Navigator.of(context).pop();
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('UI-only: would attach cash flow context.'), behavior: SnackBarBehavior.floating),
                    );
                  },
                ),
                _ToolChip(
                  icon: Icons.payments_outlined,
                  label: 'Income',
                  onTap: () {
                    if (!_canUse(agent, AgentDomain.income, AgentAccess.read)) {
                      _toolDeniedToast();
                      Navigator.of(context).pop();
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('UI-only: would attach income context.'), behavior: SnackBarBehavior.floating),
                    );
                  },
                ),
                _ToolChip(
                  icon: Icons.savings_outlined,
                  label: 'Assets',
                  onTap: () {
                    if (!_canUse(agent, AgentDomain.assets, AgentAccess.read)) {
                      _toolDeniedToast();
                      Navigator.of(context).pop();
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('UI-only: would attach assets context.'), behavior: SnackBarBehavior.floating),
                    );
                  },
                ),
                _ToolChip(
                  icon: Icons.credit_card,
                  label: 'Liabilities',
                  onTap: () {
                    if (!_canUse(agent, AgentDomain.liabilities, AgentAccess.read)) {
                      _toolDeniedToast();
                      Navigator.of(context).pop();
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('UI-only: would attach liabilities context.'), behavior: SnackBarBehavior.floating),
                    );
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final m = _messages[i];
                final bg = m.fromUser ? widget.model.accent.withValues(alpha: 0.10) : AppTheme.slate50;
                final border = m.fromUser ? widget.model.accent.withValues(alpha: 0.25) : AppTheme.slate100;
                return Align(
                  alignment: m.fromUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 340),
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: border),
                    ),
                    child: Text(m.text, style: const TextStyle(color: AppTheme.slate900)),
                  ),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      decoration: const InputDecoration(
                        hintText: 'Message…',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(onPressed: _send, child: const Text('Send')),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolChip extends StatelessWidget {
  const _ToolChip({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.slate50,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppTheme.slate100),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: AppTheme.slate600),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w900, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

