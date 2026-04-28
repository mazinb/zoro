import 'package:flutter/material.dart';

import '../../core/llm/llm_client.dart';
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
                        MaterialPageRoute(
                          builder: (ctx) => _ChatThreadPage(
                            model: m,
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
      },
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
  bool _sending = false;
  final _llm = LlmClient();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    if (_sending) return;
    final provider = widget.model.activeLlmProvider;
    final key = widget.model.apiKeyFor(provider);
    if (key == null) {
      widget.onNoKey();
      return;
    }
    final t = widget.model.chats.where((x) => x.id == widget.threadId).cast<AgentChatThread?>().firstOrNull;
    if (t == null) return;
    final agent = widget.model.agents.firstWhere((a) => a.id == t.agentId);

    setState(() {
      _sending = true;
      _messages.add((fromUser: true, text: text));
      _messages.add((fromUser: false, text: 'Thinking…'));
    });
    _ctrl.clear();

    final contextBundle = _buildContextBundle();
    final system = [
      agent.systemPrompt.trim(),
      if (agent.contextMarkdown.trim().isNotEmpty) '\n\n### Agent context\n${agent.contextMarkdown.trim()}',
      if (contextBundle.trim().isNotEmpty) '\n\n### Attached context\n$contextBundle',
      '\n\nReturn concise, actionable guidance.',
    ].join('\n').trim();

    try {
      final reply = await _llm.complete(
        provider: provider,
        apiKey: key,
        model: widget.model.modelFor(provider),
        system: system,
        user: text,
      );
      if (!mounted) return;
      setState(() {
        // Replace the last "Thinking…" message.
        _messages.removeLast();
        _messages.add((fromUser: false, text: reply));
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages.removeLast();
        _messages.add((fromUser: false, text: 'Request failed: $e'));
      });
    } finally {
      if (mounted) setState(() => _sending = false);
    }

    final idx = widget.model.chats.indexWhere((t) => t.id == widget.threadId);
    if (idx >= 0) {
      final t = widget.model.chats[idx].clone();
      t.updatedAt = DateTime.now();
      t.messageCount += 2;
      t.tokensUsed += 600; // placeholder
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
    final t = widget.model.chats.where((x) => x.id == widget.threadId).cast<AgentChatThread?>().firstOrNull;
    if (t == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        Navigator.of(context).maybePop();
      });
      return const Scaffold(body: SizedBox.shrink());
    }
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
                Navigator.of(context).pop();
                // Delete after this route is gone to avoid a brief "missing thread" build.
                Future.microtask(() => widget.model.removeChatById(widget.threadId));
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
                  FilledButton(
                    onPressed: _sending ? null : _send,
                    child: Text(_sending ? 'Sending…' : 'Send'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

