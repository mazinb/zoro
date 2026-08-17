import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_exception.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';

/// Multi-step email claim: enter address → wait for magic link → private mailbox.
class MailboxClaimPage extends StatefulWidget {
  const MailboxClaimPage({super.key, required this.model});

  final AppModel model;

  @override
  State<MailboxClaimPage> createState() => _MailboxClaimPageState();
}

class _MailboxClaimPageState extends State<MailboxClaimPage> {
  final _email = TextEditingController();
  int _step = 0;
  bool _busy = false;
  String? _error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    widget.model.agentWorkspace.addListener(_onWorkspace);
  }

  void _onWorkspace() {
    if (!mounted) return;
    if (widget.model.agentWorkspace.hasMailbox && _step != 2) {
      _poll?.cancel();
      setState(() => _step = 2);
    }
  }

  @override
  void dispose() {
    widget.model.agentWorkspace.removeListener(_onWorkspace);
    _poll?.cancel();
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim().toLowerCase();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter the email you will forward PDFs from.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.model.requestMailboxClaim(email);
      if (!mounted) return;
      setState(() {
        _step = 1;
        _busy = false;
      });
      _startPoll();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  void _startPoll() {
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => unawaited(_tryFinish()));
  }

  Future<void> _tryFinish({String? nonce}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.model.finishMailboxClaim(nonce: nonce);
      if (!mounted) return;
      _poll?.cancel();
      setState(() {
        _step = 2;
        _busy = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (nonce != null) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> handleInboundNonce(String nonce) => _tryFinish(nonce: nonce);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final address = widget.model.agentWorkspace.identity.mailboxAddress ?? '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Claim private mailbox'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          LiquidGlassPanel(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _step == 0
                      ? 'Verify the email you send statements from. Zoro assigns a private forwarding address. Hermes only sees PDFs that land on this phone.'
                      : _step == 1
                          ? 'Open the link we emailed. It returns here and finishes the claim. Server copies are deleted after this phone downloads them.'
                          : 'Forward PDFs to this address from ${_email.text.trim().isEmpty ? 'your claimed email' : _email.text.trim()}.',
                  style: TextStyle(color: cs.onSurfaceVariant, height: 1.4),
                ),
                const SizedBox(height: 16),
                if (_step == 0) ...[
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(
                      labelText: 'Your email',
                      hintText: 'you@example.com',
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _send,
                    child: Text(_busy ? 'Sending…' : 'Send confirmation link'),
                  ),
                ] else if (_step == 1) ...[
                  Text(
                    'Waiting for confirmation of ${_email.text.trim()}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 12),
                  if (_busy) const LinearProgressIndicator(),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _busy ? null : () => _tryFinish(),
                    child: const Text('I opened the link'),
                  ),
                ] else ...[
                  SelectableText(
                    address,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(true),
                    child: const Text('Done'),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(color: cs.error, fontSize: 13)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
