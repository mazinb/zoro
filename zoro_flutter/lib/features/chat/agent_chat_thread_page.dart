import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/chat/agent_action_executor.dart';
import '../../core/chat/agent_chat_prompts.dart';
import '../../core/chat/chat_message.dart';
import '../../core/llm/llm_client.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';

extension _FirstOrNullExt<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

/// Single chat thread for a user [AppAgent].
class AgentChatThreadPage extends StatefulWidget {
  const AgentChatThreadPage({
    super.key,
    required this.model,
    required this.threadId,
    required this.onNoKey,
    this.initialUserMessage,
  });

  final AppModel model;
  final String threadId;
  final VoidCallback onNoKey;
  final String? initialUserMessage;

  @override
  State<AgentChatThreadPage> createState() => _AgentChatThreadPageState();
}

class _AgentChatThreadPageState extends State<AgentChatThreadPage> {
  final _ctrl = TextEditingController();
  final _playgroundModelCtrl = TextEditingController();
  final _playgroundSuffixCtrl = TextEditingController();
  final _playgroundToolsCtrl = TextEditingController();
  final _messages = <ChatMessage>[];
  final _pendingAttachments = <ChatAttachment>[];
  var _includeAssets = true;
  var _includeLiabilities = true;
  var _includeExpenseBuckets = true;
  var _includeMonths = true;
  bool _sending = false;
  var _sentInitial = false;
  AgentChatLlmOverride _sheetOverride = AgentChatLlmOverride.useDefault;

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
    _playgroundModelCtrl.dispose();
    _playgroundSuffixCtrl.dispose();
    _playgroundToolsCtrl.dispose();
    super.dispose();
  }

  int _threadIndex() => widget.model.chats.indexWhere((x) => x.id == widget.threadId);

  void _persistThread(AgentChatThread t) {
    final idx = _threadIndex();
    if (idx >= 0) widget.model.updateChat(idx, t);
  }

  Future<void> _pickFile() async {
    final r = await FilePicker.pickFiles(withData: true);
    if (r == null || r.files.isEmpty) return;
    final f = r.files.first;
    final bytes = f.bytes;
    if (bytes == null) return;
    var excerpt = utf8.decode(bytes, allowMalformed: true);
    if (excerpt.length > 120000) {
      excerpt = '${excerpt.substring(0, 120000)}\n… (truncated)';
    }
    setState(() {
      _pendingAttachments.add(ChatAttachment(fileName: f.name, textExcerpt: excerpt));
    });
  }

  Future<void> _openPlayground(AgentChatThread t) async {
    _sheetOverride = t.llmOverride;
    _playgroundModelCtrl.text = t.modelOverride ?? '';
    _playgroundSuffixCtrl.text = t.systemPromptSuffix ?? '';
    _playgroundToolsCtrl.text = t.enabledToolIds?.join(', ') ?? '';

    await showLiquidGlassModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.of(ctx).viewInsets.bottom),
          child: StatefulBuilder(
            builder: (ctx, setModal) {
              return SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Playground', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<AgentChatLlmOverride>(
                      key: ValueKey(_sheetOverride),
                      initialValue: _sheetOverride,
                      decoration: const InputDecoration(labelText: 'LLM route', border: OutlineInputBorder()),
                      items: const [
                        DropdownMenuItem(value: AgentChatLlmOverride.useDefault, child: Text('Default (agent + global)')),
                        DropdownMenuItem(value: AgentChatLlmOverride.appleFoundation, child: Text('Apple on-device')),
                        DropdownMenuItem(value: AgentChatLlmOverride.openai, child: Text('OpenAI')),
                        DropdownMenuItem(value: AgentChatLlmOverride.anthropic, child: Text('Anthropic')),
                        DropdownMenuItem(value: AgentChatLlmOverride.gemini, child: Text('Gemini')),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        setModal(() => _sheetOverride = v);
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _playgroundModelCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Model override (optional)',
                        border: OutlineInputBorder(),
                        hintText: 'e.g. gpt-4.1-mini',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _playgroundSuffixCtrl,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Extra system instructions (this thread)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _playgroundToolsCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Allowed zoro_actions ops (optional, comma-separated)',
                        border: OutlineInputBorder(),
                        hintText: 'e.g. upsert_monthly_cashflow, set_month_context_markdown',
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        final nt = t.clone();
                        nt.llmOverride = _sheetOverride;
                        final mo = _playgroundModelCtrl.text.trim();
                        nt.modelOverride = mo.isEmpty ? null : mo;
                        final sx = _playgroundSuffixCtrl.text.trim();
                        nt.systemPromptSuffix = sx.isEmpty ? null : sx;
                        final rawTools = _playgroundToolsCtrl.text.trim();
                        if (rawTools.isEmpty) {
                          nt.enabledToolIds = null;
                        } else {
                          nt.enabledToolIds = rawTools
                              .split(',')
                              .map((s) => s.trim())
                              .where((s) => s.isNotEmpty)
                              .toList();
                        }
                        _persistThread(nt);
                        if (mounted) Navigator.of(ctx).pop();
                        setState(() {});
                      },
                      child: const Text('Save'),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Future<void> _pickAgentForThread(AgentChatThread t) async {
    final picked = await showLiquidGlassModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(8, 6, 8, 12),
              child: Text('Chat as…', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            ),
            ...widget.model.agents.map(
              (a) => ListTile(
                title: Text(a.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                subtitle: Text(a.description, maxLines: 2, overflow: TextOverflow.ellipsis),
                onTap: () => Navigator.of(ctx).pop(a.id),
              ),
            ),
          ],
        );
      },
    );
    if (picked == null || !mounted) return;
    final agent = widget.model.agents.firstWhere((a) => a.id == picked);
    final nt = t.clone();
    nt.agentId = picked;
    nt.title = agent.name;
    _persistThread(nt);
    setState(() {});
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty && _pendingAttachments.isEmpty) return;
    if (_sending) return;
    final t = widget.model.chats.where((x) => x.id == widget.threadId).cast<AgentChatThread?>().firstOrNull;
    if (t == null) return;
    final agent = widget.model.agents.firstWhere((a) => a.id == t.agentId);

    final provider = _resolveChatProvider(agent: agent, model: widget.model, thread: t);
    final key = widget.model.apiKeyFor(provider);
    if (key == null) {
      if (!mounted) return;
      if (agent.kind == AppAgentKind.researcher && provider == LlmProvider.gemini) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Researcher needs a Gemini API key. Add it under Settings → API keys.'),
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(label: 'Open', onPressed: widget.onNoKey),
          ),
        );
      } else {
        widget.onNoKey();
      }
      return;
    }

    final attachments = List<ChatAttachment>.from(_pendingAttachments);
    _pendingAttachments.clear();
    final userBubbleText = text.isEmpty
        ? (attachments.isEmpty ? '' : 'Attached: ${attachments.map((a) => a.fileName).join(', ')}')
        : text;

    final buf = StringBuffer();
    for (final a in attachments) {
      buf.writeln('### File: ${a.fileName}\n${a.textExcerpt}\n');
    }
    if (text.isNotEmpty) {
      buf.writeln(text);
    }
    final userMessageForLlm = buf.toString().trim();
    if (userMessageForLlm.isEmpty) return;

    setState(() {
      _sending = true;
      _messages.add(ChatMessage(fromUser: true, text: userBubbleText, attachments: attachments));
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
    final enabledTools =
        t.enabledToolIds == null ? null : Set<String>.from(t.enabledToolIds!);
    final system = buildAgentChatSystem(
      agent: agent,
      contextBundle: contextBundle,
      systemPromptSuffix: t.systemPromptSuffix,
      enabledToolIds: enabledTools,
    );

    try {
      final modelName = widget.model.modelFor(provider);
      final reply = await LlmClient().complete(
        provider: provider,
        apiKey: key,
        model: modelName,
        system: system,
        user: userMessageForLlm,
        preferJsonObjectOutput: provider == LlmProvider.openai,
      );
      widget.model.recordLlmRequest(provider: provider, model: modelName);
      if (!mounted) return;
      final processed = processAgentActions(
        rawReply: reply.text,
        agent: agent,
        model: widget.model,
        enabledToolIds: enabledTools,
      );
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

    final idx = _threadIndex();
    if (idx >= 0) {
      final nt = widget.model.chats[idx].clone();
      nt.updatedAt = DateTime.now();
      nt.messageCount += 2;
      nt.tokensUsed += 600;
      nt.lastLine = userBubbleText;
      widget.model.updateChat(idx, nt);
    }
  }

  LlmProvider _resolveChatProvider({
    required AppAgent agent,
    required AppModel model,
    required AgentChatThread thread,
  }) {
    final override = thread.llmOverride;
    if (override == AgentChatLlmOverride.appleFoundation) return LlmProvider.appleFoundation;
    if (override == AgentChatLlmOverride.openai) return LlmProvider.openai;
    if (override == AgentChatLlmOverride.anthropic) return LlmProvider.anthropic;
    if (override == AgentChatLlmOverride.gemini) return LlmProvider.gemini;
    return llmProviderForUserAgent(agent, model);
  }

  Future<void> _attachContext() async {
    final t = widget.model.chats.where((x) => x.id == widget.threadId).cast<AgentChatThread?>().firstOrNull;
    final agent = t == null ? null : widget.model.agents.where((a) => a.id == t.agentId).cast<AppAgent?>().firstOrNull;
    final sheetTitle = agent?.kind == AppAgentKind.helper ? 'Attach context (helper)' : 'Attach context';
    await showLiquidGlassModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        final sheetCs = Theme.of(ctx).colorScheme;
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(sheetTitle, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              if (agent?.kind == AppAgentKind.helper)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Helpers focus on guidance—monthly detail is off by default.',
                    style: TextStyle(color: sheetCs.onSurfaceVariant, fontSize: 13),
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

  static String _routeSubtitle({required AppModel model, required AppAgent agent, required AgentChatThread thread}) {
    final provider = (() {
      final override = thread.llmOverride;
      if (override == AgentChatLlmOverride.appleFoundation) return LlmProvider.appleFoundation;
      if (override == AgentChatLlmOverride.openai) return LlmProvider.openai;
      if (override == AgentChatLlmOverride.anthropic) return LlmProvider.anthropic;
      if (override == AgentChatLlmOverride.gemini) return LlmProvider.gemini;
      return llmProviderForUserAgent(agent, model);
    })();
    final label = switch (provider) {
      LlmProvider.appleFoundation => 'Apple',
      LlmProvider.openai => 'GPT',
      LlmProvider.anthropic => 'Claude',
      LlmProvider.gemini => 'Gemini',
    };
    final modelStr = (thread.modelOverride != null && thread.modelOverride!.trim().isNotEmpty)
        ? thread.modelOverride!.trim()
        : model.modelFor(provider);
    return '$label · $modelStr';
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
    final geminiMissing = agent.kind == AppAgentKind.researcher &&
        widget.model.apiKeyFor(LlmProvider.gemini) == null;
    final provider = _resolveChatProvider(agent: agent, model: widget.model, thread: t);
    final llmBlocked = widget.model.apiKeyFor(provider) == null;

    final cs = Theme.of(context).colorScheme;
    final menuItems = <PopupMenuEntry<String>>[
      const PopupMenuItem(value: 'attach_file', child: Text('Attach file')),
      const PopupMenuItem(value: 'attach_context', child: Text('Attach context')),
      const PopupMenuItem(value: 'playground', child: Text('Playground')),
      const PopupMenuDivider(),
      const PopupMenuItem(value: 'clear', child: Text('Clear chat')),
      const PopupMenuItem(value: 'delete', child: Text('Delete chat')),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(t.title),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'attach_file') _pickFile();
              if (v == 'attach_context') _attachContext();
              if (v == 'playground') _openPlayground(t);
              if (v == 'clear') {
                setState(() => _messages.clear());
                widget.model.clearChatById(widget.threadId);
              }
              if (v == 'delete') {
                Navigator.of(context).pop();
                Future.microtask(() => widget.model.removeChatById(widget.threadId));
              }
            },
            itemBuilder: (ctx) => menuItems,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 14),
              child: Text('More', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(
              children: [
                InkWell(
                  onTap: () => _pickAgentForThread(t),
                  child: Text(
                    agent.name,
                    style: TextStyle(color: cs.onSurface, fontWeight: FontWeight.w900),
                  ),
                ),
                Text(
                  '${_kindLabel(agent.kind)} · ${_routeSubtitle(model: widget.model, agent: agent, thread: t)}',
                  style: TextStyle(color: cs.onSurfaceVariant, fontWeight: FontWeight.w700, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_pendingAttachments.isNotEmpty)
            Material(
              color: cs.surfaceContainerHighest,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 4),
                child: Text(
                  'Staged: ${_pendingAttachments.map((a) => a.fileName).join(', ')}',
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          if (geminiMissing)
            Material(
              color: cs.surfaceContainerHighest,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Add a Gemini API key in Settings → API keys to send messages with this researcher on Gemini.',
                        style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.3),
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
                final bg = msg.fromUser ? widget.model.accent.withValues(alpha: 0.10) : cs.surfaceContainerHighest;
                final border = msg.fromUser ? widget.model.accent.withValues(alpha: 0.25) : cs.outlineVariant;
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (msg.attachments.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              msg.attachments.map((a) => a.fileName).join('\n'),
                              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w700),
                            ),
                          ),
                        Text(msg.text, style: TextStyle(color: cs.onSurface)),
                      ],
                    ),
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
                    onPressed: (_sending || llmBlocked) ? null : _send,
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
