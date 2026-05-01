import 'package:flutter/material.dart';

import '../../core/chat/agent_action_executor.dart';
import '../../core/chat/agent_chat_prompts.dart';
import '../../core/chat/chat_message.dart';
import '../../core/llm/llm_client.dart';
import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';

extension _FirstOrNullExt<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

/// Single chat thread for a user [AppAgent] (used from Chat tab and Schedule preview).
class AgentChatThreadPage extends StatefulWidget {
  const AgentChatThreadPage({
    super.key,
    required this.model,
    required this.threadId,
    required this.onNoKey,
    this.initialUserMessage,
    this.onScheduleBriefing,
  });

  final AppModel model;
  final String threadId;
  final VoidCallback onNoKey;
  final String? initialUserMessage;
  final void Function(String agentId, String? suggestedRunMessage)? onScheduleBriefing;

  @override
  State<AgentChatThreadPage> createState() => _AgentChatThreadPageState();
}

class _AgentChatThreadPageState extends State<AgentChatThreadPage> {
  final _ctrl = TextEditingController();
  final _messages = <ChatMessage>[];
  var _includeAssets = true;
  var _includeLiabilities = true;
  var _includeExpenseBuckets = true;
  var _includeMonths = true;
  bool _sending = false;
  var _sentInitial = false;
  final _llm = LlmClient();

  void _persistTranscript() {
    final real = _messages.where((m) => m.text != 'Thinking…').toList();
    widget.model.setChatMessagesFor(widget.threadId, real);
  }

  void _maybeHydrateFromModel() {
    if (!mounted || _sending) return;
    final from = widget.model.chatMessagesFor(widget.threadId);
    if (from.isEmpty || _messages.isNotEmpty) return;
    setState(() => _messages.addAll(from));
  }

  @override
  void initState() {
    super.initState();
    _messages.addAll(widget.model.chatMessagesFor(widget.threadId));
    final t = widget.model.chats.where((x) => x.id == widget.threadId).cast<AgentChatThread?>().firstOrNull;
    final agent = t == null ? null : widget.model.agents.where((a) => a.id == t.agentId).cast<AppAgent?>().firstOrNull;
    if (agent?.kind == AppAgentKind.helper) {
      _includeMonths = false;
    }
    widget.model.addListener(_maybeHydrateFromModel);

    final im = widget.initialUserMessage;
    if (im != null && im.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _sentInitial) return;
        _sentInitial = true;
        _ctrl.text = im.trim();
        _send();
      });
    }
  }

  @override
  void dispose() {
    widget.model.removeListener(_maybeHydrateFromModel);
    _ctrl.dispose();
    super.dispose();
  }

  String? _lastAssistantMessage() {
    for (final m in _messages.reversed) {
      if (!m.fromUser && m.text != 'Thinking…') return m.text;
    }
    return null;
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    if (_sending) return;
    final t = widget.model.chats.where((x) => x.id == widget.threadId).cast<AgentChatThread?>().firstOrNull;
    if (t == null) return;
    final agent = widget.model.agents.firstWhere((a) => a.id == t.agentId);

    final provider = llmProviderForUserAgent(agent, widget.model);
    final key = widget.model.apiKeyFor(provider);
    if (key == null) {
      if (!mounted) return;
      if (agent.kind == AppAgentKind.researcher) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Researcher agents need a Gemini API key. Add it under Settings → API keys.'),
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(label: 'Open', onPressed: widget.onNoKey),
          ),
        );
      } else {
        widget.onNoKey();
      }
      return;
    }

    setState(() {
      _sending = true;
      _messages.add(ChatMessage(fromUser: true, text: text));
      _messages.add(ChatMessage(fromUser: false, text: 'Thinking…'));
    });
    _ctrl.clear();
    _persistTranscript();

    final contextBundle = buildPortfolioContextBundle(
      widget.model,
      includeAssets: _includeAssets,
      includeLiabilities: _includeLiabilities,
      includeExpenseBuckets: _includeExpenseBuckets,
      includeMonths: _includeMonths,
    );
    final system = buildAgentChatSystem(agent: agent, contextBundle: contextBundle);

    try {
      final reply = await _llm.complete(
        provider: provider,
        apiKey: key,
        model: widget.model.modelFor(provider),
        system: system,
        user: text,
      );
      if (!mounted) return;
      final processed = processAgentActions(rawReply: reply, agent: agent, model: widget.model);
      var assistantText = processed.visibleText;
      if (processed.applySummary != null && processed.applySummary!.trim().isNotEmpty) {
        assistantText = '${assistantText.trim()}\n\n${processed.applySummary!.trim()}';
      }
      setState(() {
        _messages.removeLast();
        _messages.add(ChatMessage(fromUser: false, text: assistantText));
      });
      _persistTranscript();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages.removeLast();
        _messages.add(ChatMessage(fromUser: false, text: 'Request failed: $e'));
      });
      _persistTranscript();
    } finally {
      if (mounted) setState(() => _sending = false);
    }

    final idx = widget.model.chats.indexWhere((x) => x.id == widget.threadId);
    if (idx >= 0) {
      final nt = widget.model.chats[idx].clone();
      nt.updatedAt = DateTime.now();
      nt.messageCount += 2;
      nt.tokensUsed += 600;
      nt.lastLine = text;
      widget.model.updateChat(idx, nt);
    }
  }

  Future<void> _attachContext() async {
    final t = widget.model.chats.where((x) => x.id == widget.threadId).cast<AgentChatThread?>().firstOrNull;
    final agent = t == null ? null : widget.model.agents.where((a) => a.id == t.agentId).cast<AppAgent?>().firstOrNull;
    final sheetTitle = agent?.kind == AppAgentKind.helper ? 'Attach context (helper)' : 'Attach context';
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
              Text(sheetTitle, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              if (agent?.kind == AppAgentKind.helper)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text(
                    'Helpers focus on guidance—monthly detail is off by default.',
                    style: TextStyle(color: AppTheme.slate600, fontSize: 13),
                  ),
                ),
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
                  final md = buildPortfolioContextBundle(
                    widget.model,
                    includeAssets: _includeAssets,
                    includeLiabilities: _includeLiabilities,
                    includeExpenseBuckets: _includeExpenseBuckets,
                    includeMonths: _includeMonths,
                  );
                  setState(() {
                    _messages.add(ChatMessage(fromUser: false, text: md));
                  });
                  _persistTranscript();
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

  static String _kindLabel(AppAgentKind k) => switch (k) {
        AppAgentKind.helper => 'Helper',
        AppAgentKind.analyst => 'Analyst',
        AppAgentKind.researcher => 'Researcher',
      };

  static String _providerShort(LlmProvider p) => switch (p) {
        LlmProvider.openai => 'GPT',
        LlmProvider.anthropic => 'Claude',
        LlmProvider.gemini => 'Gemini',
      };

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
    final chatProvider = llmProviderForUserAgent(agent, widget.model);
    final geminiMissing = agent.kind == AppAgentKind.researcher && widget.model.apiKeyFor(LlmProvider.gemini) == null;

    final menuItems = <PopupMenuEntry<String>>[
      const PopupMenuItem(value: 'clear', child: Text('Clear chat')),
      if (widget.onScheduleBriefing != null)
        const PopupMenuItem(value: 'schedule', child: Text('Schedule briefing…')),
      const PopupMenuItem(value: 'delete', child: Text('Delete chat')),
    ];

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
                widget.model.clearChatById(widget.threadId);
              }
              if (v == 'schedule') {
                widget.onScheduleBriefing?.call(agent.id, _lastAssistantMessage());
              }
              if (v == 'delete') {
                Navigator.of(context).pop();
                Future.microtask(() => widget.model.removeChatById(widget.threadId));
              }
            },
            itemBuilder: (ctx) => menuItems,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(
              children: [
                Text(
                  agent.name,
                  style: const TextStyle(color: AppTheme.slate900, fontWeight: FontWeight.w900),
                ),
                Text(
                  '${_kindLabel(agent.kind)} · ${_providerShort(chatProvider)}',
                  style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w700, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (geminiMissing)
            Material(
              color: AppTheme.slate50,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: AppTheme.slate600, size: 20),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Add a Gemini API key in Settings → API keys to send messages with this researcher.',
                        style: TextStyle(color: AppTheme.slate600, fontSize: 13, height: 1.3),
                      ),
                    ),
                    TextButton(onPressed: widget.onNoKey, child: const Text('Keys')),
                  ],
                ),
              ),
            ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final msg = _messages[i];
                final bg = msg.fromUser ? widget.model.accent.withValues(alpha: 0.10) : AppTheme.slate50;
                final border = msg.fromUser ? widget.model.accent.withValues(alpha: 0.25) : AppTheme.slate100;
                return Align(
                  alignment: msg.fromUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 340),
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: border),
                    ),
                    child: Text(msg.text, style: const TextStyle(color: AppTheme.slate900)),
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
                    onPressed: (_sending || geminiMissing) ? null : _send,
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
