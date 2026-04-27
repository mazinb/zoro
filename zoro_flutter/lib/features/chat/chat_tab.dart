import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/monthly_cashflow_entry.dart';
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
              FilledButton.icon(
                onPressed: hasKey ? null : widget.onGoToSettingsPermissions,
                icon: const Icon(Icons.key),
                label: const Text('Add key'),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                onPressed: () async {
                  final agentId = await _pickAgent(context, widget.model);
                  if (agentId == null) return;
                  final agent = widget.model.agents.firstWhere((a) => a.id == agentId);
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
  var _includeAssets = true;
  var _includeLiabilities = true;
  var _includeExpenseBuckets = true;
  var _includeMonths = true;

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
      _messages.add((fromUser: false, text: 'Not wired yet: AI response. (Next step)'));
    });
    _ctrl.clear();
    final idx = widget.model.chats.indexWhere((t) => t.id == widget.threadId);
    if (idx >= 0) {
      final t = widget.model.chats[idx].clone();
      t.updatedAt = DateTime.now();
      t.messageCount += 2;
      t.tokensUsed += 200; // placeholder
      t.lastLine = text;
      widget.model.updateChat(idx, t);
    }
  }

  String _buildContextBundle() {
    final m = widget.model;
    final buf = StringBuffer();
    buf.writeln('## Context bundle');

    if (_includeAssets) {
      final items = m.assets
          .map((a) => a.contextMarkdown ?? '')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();
      if (items.isNotEmpty) {
        buf.writeln('\n### Assets');
        for (final it in items) {
          buf.writeln('\n$it');
        }
      }
    }

    if (_includeLiabilities) {
      final items = m.liabilities
          .map((l) => l.contextMarkdown ?? '')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();
      if (items.isNotEmpty) {
        buf.writeln('\n### Liabilities');
        for (final it in items) {
          buf.writeln('\n$it');
        }
      }
    }

    if (_includeExpenseBuckets) {
      final items = m.expenseBucketContextMarkdown.entries
          .map((e) => e.value.trim())
          .where((s) => s.isNotEmpty)
          .toList();
      if (items.isNotEmpty) {
        buf.writeln('\n### Expense buckets');
        for (final it in items) {
          buf.writeln('\n$it');
        }
      }
    }

    if (_includeMonths) {
      final items = AppModel.recentMonthKeys()
          .map(m.monthlyEntryFor)
          .whereType<MonthlyCashflowEntry>()
          .map((e) => (e.contextMarkdown ?? '').trim())
          .where((s) => s.isNotEmpty)
          .toList();
      if (items.isNotEmpty) {
        buf.writeln('\n### Months');
        for (final it in items) {
          buf.writeln('\n$it');
        }
      }
    }

    return buf.toString().trim();
  }

  Future<void> _attachContext() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Attach context', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(height: 8),
              StatefulBuilder(
                builder: (ctx, setModal) {
                  return Column(
                    children: [
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Assets'),
                        value: _includeAssets,
                        onChanged: (v) => setModal(() => _includeAssets = v),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Liabilities'),
                        value: _includeLiabilities,
                        onChanged: (v) => setModal(() => _includeLiabilities = v),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Expense buckets'),
                        value: _includeExpenseBuckets,
                        onChanged: (v) => setModal(() => _includeExpenseBuckets = v),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Months'),
                        value: _includeMonths,
                        onChanged: (v) => setModal(() => _includeMonths = v),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: () {
                  final md = _buildContextBundle();
                  setState(() {
                    _messages.add((fromUser: false, text: md));
                  });
                  Navigator.of(ctx).pop();
                },
                child: const Text('Attach'),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.model.chats.firstWhere((x) => x.id == widget.threadId);
    final agent = widget.model.agents.firstWhere((a) => a.id == t.agentId);
    return Scaffold(
      appBar: AppBar(
        title: Text(t.title),
        actions: [
          IconButton(
            tooltip: 'Attach context',
            onPressed: _attachContext,
            icon: const Icon(Icons.library_add),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'clear') {
                setState(() => _messages.clear());
                final idx = widget.model.chats.indexWhere((x) => x.id == widget.threadId);
                if (idx >= 0) {
                  final next = widget.model.chats[idx].clone();
                  next.messageCount = 0;
                  next.tokensUsed = 0;
                  next.lastLine = '';
                  next.updatedAt = DateTime.now();
                  widget.model.updateChat(idx, next);
                }
              }
              if (v == 'delete') {
                final idx = widget.model.chats.indexWhere((x) => x.id == widget.threadId);
                if (idx >= 0) {
                  widget.model.removeChatById(widget.threadId);
                }
                Navigator.of(context).pop();
              }
            },
            itemBuilder: (ctx) => const [
              PopupMenuItem(value: 'clear', child: Text('Clear chat')),
              PopupMenuItem(value: 'delete', child: Text('Delete chat')),
            ],
          ),
        ],
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

