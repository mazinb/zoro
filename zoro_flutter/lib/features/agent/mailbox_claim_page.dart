import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_exception.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';

/// Multi-step email claim: username + email → magic link → private mailbox.
class MailboxClaimPage extends StatefulWidget {
  const MailboxClaimPage({super.key, required this.model});

  final AppModel model;

  @override
  State<MailboxClaimPage> createState() => _MailboxClaimPageState();
}

class _MailboxClaimPageState extends State<MailboxClaimPage> {
  final _email = TextEditingController();
  final _username = TextEditingController();
  int _step = 0;
  bool _busy = false;
  String? _error;
  String? _usernameHint;
  bool? _usernameOk;
  Timer? _poll;
  Timer? _usernameDebounce;

  @override
  void initState() {
    super.initState();
    widget.model.agentWorkspace.addListener(_onWorkspace);
    _username.addListener(_onUsernameChanged);
  }

  void _onWorkspace() {
    if (!mounted) return;
    if (widget.model.agentWorkspace.hasMailbox && _step != 2) {
      _poll?.cancel();
      setState(() => _step = 2);
    }
  }

  void _onUsernameChanged() {
    _usernameDebounce?.cancel();
    final raw = _username.text.trim().toLowerCase();
    if (raw.isEmpty) {
      setState(() {
        _usernameHint = null;
        _usernameOk = null;
      });
      return;
    }
    _usernameDebounce = Timer(const Duration(milliseconds: 450), () {
      unawaited(_checkUsername(raw));
    });
  }

  Future<void> _checkUsername(String raw) async {
    final result = await widget.model.checkMailboxUsername(raw);
    if (!mounted || _username.text.trim().toLowerCase() != raw) return;
    setState(() {
      _usernameOk = result.available;
      _usernameHint = result.available
          ? (result.address ?? '$raw@getzoro.com')
          : (result.reason ?? 'Unavailable');
    });
  }

  @override
  void dispose() {
    widget.model.agentWorkspace.removeListener(_onWorkspace);
    _username.removeListener(_onUsernameChanged);
    _poll?.cancel();
    _usernameDebounce?.cancel();
    _email.dispose();
    _username.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim().toLowerCase();
    final username = _username.text.trim().toLowerCase();
    if (username.length < 3) {
      setState(() => _error = 'Pick a username (at least 3 characters).');
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter the email you will forward PDFs from.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.model.requestMailboxClaim(email, username: username);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
      return;
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
      return;
    }
    if (!mounted) return;
    setState(() {
      _step = 1;
      _busy = false;
    });
    _startPoll();
  }

  void _startPoll() {
    _poll?.cancel();
    _poll = Timer.periodic(
      const Duration(seconds: 3),
      (_) => unawaited(_tryFinish()),
    );
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
    final domainHint = _usernameHint;
    return Scaffold(
      appBar: AppBar(title: const Text('Claim private mailbox')),
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
                      ? 'Pick a unique Zoro email, then verify the address you send statements from. Your agent only sees PDFs that land on this phone.'
                      : _step == 1
                      ? 'Open the link we emailed. It returns here and finishes the claim. Server copies are deleted after this phone downloads them.'
                      : 'Forward PDFs to this address from ${_email.text.trim().isEmpty ? 'your claimed email' : _email.text.trim()}.',
                  style: TextStyle(color: cs.onSurfaceVariant, height: 1.4),
                ),
                const SizedBox(height: 16),
                if (_step == 0) ...[
                  TextField(
                    controller: _username,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: 'Username',
                      hintText: 'ada',
                      suffixText: '@getzoro.com',
                      helperText: _usernameOk == false ? null : domainHint,
                      helperMaxLines: 2,
                      errorText: _usernameOk == false ? domainHint : null,
                    ),
                  ),
                  const SizedBox(height: 12),
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
                  const SizedBox(height: 8),
                  Text(
                    'Mailbox: ${_username.text.trim().toLowerCase()}@getzoro.com',
                    style: TextStyle(color: cs.onSurfaceVariant),
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
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(true),
                    child: const Text('Done'),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: cs.error, fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
