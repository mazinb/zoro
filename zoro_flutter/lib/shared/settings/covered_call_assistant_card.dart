import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/portfolio_chat_service.dart';
import '../../core/api/portfolio_link_store.dart';
import '../../core/api/portfolio_link_sync.dart';
import '../../core/api/portfolio_valuation_service.dart';
import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../features/settings/portfolio_desk_chat_page.dart';

/// Settings card: link one Covered Call Assistant account and pull live NAV.
class CoveredCallAssistantCard extends StatefulWidget {
  const CoveredCallAssistantCard({super.key, required this.model});

  final AppModel model;

  @override
  State<CoveredCallAssistantCard> createState() => _CoveredCallAssistantCardState();
}

class _CoveredCallAssistantCardState extends State<CoveredCallAssistantCard> {
  final _sync = PortfolioLinkSync();
  final _tokenCtrl = TextEditingController();
  bool _busy = false;
  bool _linked = false;
  double? _nav;
  String? _asOf;
  String? _source;
  String? _error;

  @override
  void initState() {
    super.initState();
    _hydrate();
  }

  @override
  void dispose() {
    _tokenCtrl.dispose();
    super.dispose();
  }

  Future<void> _hydrate() async {
    final store = PortfolioLinkStore();
    final linked = await store.readToken() != null;
    final last = await store.readLastValuation();
    if (!mounted) return;
    setState(() {
      _linked = linked;
      _nav = last.nav;
      _asOf = last.asOf;
      _source = last.source;
    });
  }

  Future<void> _link() async {
    final token = _tokenCtrl.text.trim();
    if (token.isEmpty) {
      setState(() => _error = 'Paste the share token from portfolio Account → Zoro');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final val = await _sync.linkToken(widget.model, token);
      if (!mounted) return;
      if (!val.ok || val.nav == null) {
        setState(() {
          _busy = false;
          _error = val.error ?? 'Could not read valuation';
        });
        return;
      }
      _tokenCtrl.clear();
      setState(() {
        _busy = false;
        _linked = true;
        _nav = val.nav;
        _asOf = val.asOf;
        _source = val.source;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Linked · NAV \$${val.nav!.toStringAsFixed(0)}')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '$e';
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final val = await _sync.refresh(widget.model);
      if (!mounted) return;
      if (val == null) {
        setState(() {
          _busy = false;
          _linked = false;
        });
        return;
      }
      if (!val.ok || val.nav == null) {
        setState(() {
          _busy = false;
          _error = val.error ?? 'Refresh failed';
        });
        return;
      }
      setState(() {
        _busy = false;
        _nav = val.nav;
        _asOf = val.asOf;
        _source = val.source;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '$e';
      });
    }
  }

  Future<void> _unlink() async {
    await _sync.unlink();
    if (!mounted) return;
    setState(() {
      _linked = false;
      _nav = null;
      _asOf = null;
      _source = null;
      _error = null;
    });
  }

  Future<void> _openDeskChat() async {
    final token = await PortfolioLinkStore().readToken();
    if (!mounted) return;
    if (token == null) {
      final uri = PortfolioChatService().chatPageUri;
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const PortfolioDeskChatPage()),
    );
  }

  Future<void> _openDesk() async {
    final uri = Uri.parse(PortfolioValuationService.defaultBase);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final navLabel = _nav == null
        ? null
                : formatCurrencyDisplay(_nav!, currency: CurrencyCode.usd);

    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Covered Call Assistant',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              'Pull live IBKR net liquidation from portfolio.getzoro.com into one investments row. '
              'Create the link on the web: Account → Zoro.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 12),
            if (_linked) ...[
              if (navLabel != null)
                Text(
                  navLabel,
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
                ),
              if (_asOf != null || _source != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    [
                      if (_source != null) _source!,
                      if (_asOf != null) 'as of $_asOf',
                    ].join(' · '),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.tonal(
                    onPressed: _busy ? null : _refresh,
                    child: _busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Refresh'),
                  ),
                  OutlinedButton(
                    onPressed: _busy ? null : _openDeskChat,
                    child: const Text('Desk chat'),
                  ),
                  OutlinedButton(
                    onPressed: _busy ? null : _openDesk,
                    child: const Text('Open desk'),
                  ),
                  TextButton(
                    onPressed: _busy ? null : _unlink,
                    child: const Text('Unlink'),
                  ),
                ],
              ),
            ] else ...[
              TextField(
                controller: _tokenCtrl,
                enabled: !_busy,
                decoration: const InputDecoration(
                  labelText: 'Share token',
                  hintText: 'zorolk_…',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                autocorrect: false,
                enableSuggestions: false,
                keyboardType: TextInputType.visiblePassword,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9_\-]')),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton(
                    onPressed: _busy ? null : _link,
                    child: _busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Link account'),
                  ),
                  OutlinedButton(
                    onPressed: _busy ? null : _openDesk,
                    child: const Text('Open portfolio'),
                  ),
                ],
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
