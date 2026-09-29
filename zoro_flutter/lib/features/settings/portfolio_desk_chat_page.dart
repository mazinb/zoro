import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/portfolio_chat_service.dart';
import '../../core/api/portfolio_link_store.dart';

/// In-app Qwen desk chat (Covered Call Assistant tools via share token).
class PortfolioDeskChatPage extends StatefulWidget {
  const PortfolioDeskChatPage({super.key});

  @override
  State<PortfolioDeskChatPage> createState() => _PortfolioDeskChatPageState();
}

class _PortfolioDeskChatPageState extends State<PortfolioDeskChatPage> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  final _store = PortfolioLinkStore();
  final _service = PortfolioChatService();
  final _messages = <_Bubble>[];
  final _history = <PortfolioChatMessage>[];
  String? _token;
  bool _sending = false;
  String? _status;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
  }

  Future<void> _boot() async {
    final token = await _store.readToken();
    if (!mounted) return;
    setState(() {
      _token = token;
      if (token == null) {
        _error = 'Link Covered Call Assistant in Settings first.';
      } else {
        _messages.add(
          const _Bubble(
            fromUser: false,
            text:
                'Qwen desk chat with live IBKR tools (snapshot, trades, memory, search).',
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final token = _token;
    final q = _composer.text.trim();
    if (token == null || q.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
      _status = null;
      _messages.add(_Bubble(fromUser: true, text: q));
      _messages.add(const _Bubble(fromUser: false, text: '', streaming: true));
      _composer.clear();
    });
    _scrollToEnd();
    final pendingIx = _messages.length - 1;
    final hist = List<PortfolioChatMessage>.from(_history);
    _history.add(PortfolioChatMessage(role: 'user', content: q));
    var answer = '';
    try {
      await for (final ev in _service.stream(token: token, message: q, history: hist)) {
        if (!mounted) return;
        if (ev.type == 'tool') {
          setState(() {
            _status =
                '${ev.name ?? 'tool'}${ev.state == 'done' ? ' ✓' : ev.state == 'error' ? ' ✗' : '…'}'
                '${ev.detail != null ? ' — ${ev.detail}' : ''}';
          });
        } else if (ev.type == 'queue') {
          setState(() => _status = 'GPU queue · pos ${ev.position ?? '?'}');
        } else if (ev.type == 'delta' && (ev.text ?? '').isNotEmpty) {
          answer += ev.text!;
          setState(() {
            _messages[pendingIx] = _Bubble(fromUser: false, text: answer, streaming: true);
          });
          _scrollToEnd();
        } else if (ev.type == 'final') {
          answer = (ev.text ?? answer).trim();
          final meta = <String>[
            if (ev.tools != null && ev.tools!.isNotEmpty) 'tools ${ev.tools!.join(', ')}',
            if (ev.elapsedMs != null) '${ev.elapsedMs!.round()} ms',
          ].join(' · ');
          setState(() {
            _status = null;
            _messages[pendingIx] = _Bubble(fromUser: false, text: answer, meta: meta.isEmpty ? null : meta);
          });
        } else if (ev.type == 'error') {
          throw Exception(ev.detail ?? 'chat failed');
        }
      }
      if (answer.isNotEmpty) {
        _history.add(PortfolioChatMessage(role: 'assistant', content: answer.length > 2000 ? answer.substring(0, 2000) : answer));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _messages[pendingIx] = _Bubble(
          fromUser: false,
          text: answer.isEmpty ? '(failed)' : answer,
          meta: _error,
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
          _status = null;
        });
        _scrollToEnd();
      }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Desk chat'),
        actions: [
          if (_token != null)
            IconButton(
              tooltip: 'Open web chat',
              onPressed: () async {
                final uri = _service.chatPageWithToken(_token!);
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              },
              icon: const Icon(Icons.open_in_browser),
            ),
        ],
      ),
      body: Column(
        children: [
          if (_status != null)
            Material(
              color: theme.colorScheme.surfaceContainerHighest,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(_status!, style: theme.textTheme.labelMedium),
                ),
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ),
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final m = _messages[i];
                final align = m.fromUser ? Alignment.centerRight : Alignment.centerLeft;
                final bg = m.fromUser
                    ? theme.colorScheme.secondaryContainer
                    : theme.colorScheme.surfaceContainerHighest;
                return Align(
                  alignment: align,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.88),
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.text.isEmpty && m.streaming ? '…' : m.text),
                        if (m.meta != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            m.meta!,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
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
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _composer,
                      enabled: _token != null && !_sending,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'Ask about positions, rolls, premium…',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _token == null || _sending ? null : _send,
                    child: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Ask'),
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

class _Bubble {
  const _Bubble({
    required this.fromUser,
    required this.text,
    this.meta,
    this.streaming = false,
  });

  final bool fromUser;
  final String text;
  final String? meta;
  final bool streaming;
}
