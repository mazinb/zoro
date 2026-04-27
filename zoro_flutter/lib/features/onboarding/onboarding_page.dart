import 'package:flutter/material.dart';

import '../../core/api/api_exception.dart';
import '../../core/session/session_controller.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/animated_zoro_logo.dart';
import '../../util/auth_link.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key, required this.session});

  final SessionController session;

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _emailCtrl = TextEditingController();
  final _pasteCtrl = TextEditingController();

  bool _sending = false;
  bool _showAdvanced = false;
  String? _info;
  String? _error;

  @override
  void initState() {
    super.initState();
    final saved = widget.session.savedEmail;
    if (saved != null && saved.isNotEmpty) {
      _emailCtrl.text = saved;
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _pasteCtrl.dispose();
    super.dispose();
  }

  Future<void> _signInWithEmail() async {
    setState(() {
      _error = null;
      _info = null;
    });
    await widget.session.signInWithEmail(_emailCtrl.text);
    if (mounted && widget.session.lastError != null) {
      setState(() => _error = widget.session.lastError);
    }
  }

  Future<void> _sendMagicLink() async {
    setState(() {
      _sending = true;
      _error = null;
      _info = null;
    });
    try {
      await widget.session.api.sendMagicLink(
        email: _emailCtrl.text.trim(),
        redirectPath: '/expenses',
      );
      setState(() {
        _info = 'Check your email for a sign-in link. You can paste it below to continue here.';
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _signInWithPaste() async {
    final parsed = parseVerificationTokenFromInput(_pasteCtrl.text);
    if (parsed == null || parsed.isEmpty) {
      setState(() {
        _error = 'Paste the full link from your email, or the token only.';
      });
      return;
    }
    setState(() {
      _error = null;
      _info = null;
    });
    await widget.session.signInWithToken(parsed);
    if (mounted && widget.session.lastError != null) {
      setState(() => _error = widget.session.lastError);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          children: [
            const Center(
              child: AnimatedZoroLogo(height: 72, runIntro: false),
            ),
            const SizedBox(height: 8),
            Text(
              'Zoro',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppTheme.slate900,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Enter your email. We’ll keep you signed in on this device.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.slate600,
                  ),
            ),
            const SizedBox(height: 32),
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(
                labelText: 'Email',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => _signInWithEmail(),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: widget.session.loading ? null : _signInWithEmail,
              child: widget.session.loading
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Sign in'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _sending ? null : _sendMagicLink,
              child: _sending
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Email me a sign-in link'),
            ),
            const SizedBox(height: 8),
            Text(
              'New here? We’ll email a link to create or open your account.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.slate500,
                  ),
            ),
            if (_info != null) ...[
              const SizedBox(height: 20),
              Text(_info!, style: const TextStyle(color: AppTheme.slate600)),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 24),
            ExpansionTile(
              title: const Text('Having trouble?'),
              subtitle: const Text('Paste the link from your email'),
              initiallyExpanded: _showAdvanced,
              onExpansionChanged: (x) => setState(() => _showAdvanced = x),
              children: [
                TextField(
                  controller: _pasteCtrl,
                  autocorrect: false,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Sign-in link or token',
                    alignLabelWithHint: true,
                    hintText: 'https://www.getzoro.com/expenses?token=…',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonal(
                    onPressed: widget.session.loading ? null : _signInWithPaste,
                    child: const Text('Continue'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
