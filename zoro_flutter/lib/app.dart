import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import 'core/agent/mailbox_client.dart';
import 'core/state/app_model.dart';
import 'features/shell/app_shell.dart';

class ZoroApp extends StatefulWidget {
  const ZoroApp({super.key});

  @override
  State<ZoroApp> createState() => _ZoroAppState();
}

class _ZoroAppState extends State<ZoroApp> with WidgetsBindingObserver {
  final _model = AppModel();
  final _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_model.bootstrap());
      unawaited(_listenMailboxLinks());
    });
  }

  Future<void> _listenMailboxLinks() async {
    _model.addListener(_flushPendingMailboxLink);
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) await _handleLink(initial);
    } catch (_) {}
    _linkSub = _appLinks.uriLinkStream.listen(_handleLink);
  }

  Uri? _pendingMailboxLink;

  void _flushPendingMailboxLink() {
    final pending = _pendingMailboxLink;
    if (pending == null) return;
    if (!_model.bootstrapped || (_model.deviceId ?? '').isEmpty) return;
    _pendingMailboxLink = null;
    unawaited(_handleLink(pending));
  }

  Future<void> _handleLink(Uri uri) async {
    if (!isMailboxClaimUri(uri)) return;
    if (!_model.bootstrapped || (_model.deviceId ?? '').isEmpty) {
      _pendingMailboxLink = uri;
      return;
    }
    try {
      await _model.handleMailboxClaimUri(uri);
    } catch (_) {}
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    _model.removeListener(_flushPendingMailboxLink);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_model.refreshMobileEntitlements());
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _model,
      builder: (context, _) {
        return MaterialApp(
          title: 'Zoro',
          theme: _model.themedLight(),
          darkTheme: _model.themedDark(),
          themeMode: _model.themeModePreference,
          home: AppShell(model: _model),
        );
      },
    );
  }
}
