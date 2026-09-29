import '../state/app_model.dart';
import '../state/ledger_rows.dart';
import 'portfolio_link_store.dart';
import 'portfolio_valuation_service.dart';

/// Applies Covered Call Assistant NAV onto one USD investments ledger row.
class PortfolioLinkSync {
  PortfolioLinkSync({
    PortfolioLinkStore? store,
    PortfolioValuationService? service,
  })  : _store = store ?? PortfolioLinkStore(),
        _service = service ?? PortfolioValuationService();

  final PortfolioLinkStore _store;
  final PortfolioValuationService _service;

  static const defaultAssetName = 'IBKR (Covered Call Assistant)';

  PortfolioLinkStore get store => _store;

  Future<bool> isLinked() async => (await _store.readToken()) != null;

  Future<PortfolioValuation?> refresh(AppModel model) async {
    final token = await _store.readToken();
    if (token == null) return null;
    final val = await _service.fetch(token);
    if (!val.ok || val.nav == null) return val;
    await _store.writeLastValuation(nav: val.nav, asOf: val.asOf, source: val.source);
    await _applyNav(model, val);
    return val;
  }

  Future<PortfolioValuation> linkToken(AppModel model, String token) async {
    final cleaned = token.trim();
    final val = await _service.fetch(cleaned);
    if (!val.ok || val.nav == null) return val;
    await _store.writeToken(cleaned);
    await _store.writeLastValuation(nav: val.nav, asOf: val.asOf, source: val.source);
    await _applyNav(model, val);
    return val;
  }

  Future<void> unlink() => _store.clear();

  Future<void> _applyNav(AppModel model, PortfolioValuation val) async {
    final nav = val.nav;
    if (nav == null) return;
    final id = await _store.readAssetId();
    final idx = id == null ? -1 : model.assets.indexWhere((a) => a.id == id);
    if (idx >= 0) {
      final old = model.assets[idx];
      model.replaceAsset(
        idx,
        LedgerAssetRow(
          id: old.id,
          type: LedgerAssetType.investments,
          currencyCountry: 'US',
          name: old.name.trim().isEmpty ? defaultAssetName : old.name,
          total: nav,
          label: old.label,
          comment: _comment(val),
          contextMarkdown: _context(val, old.contextMarkdown),
          returnRatePct: old.returnRatePct,
        ),
      );
      return;
    }
    final seedIx = model.assets.indexWhere((a) => a.id == SeedLedgerIds.assetUsBrokerage);
    if (seedIx >= 0) {
      final old = model.assets[seedIx];
      model.replaceAsset(
        seedIx,
        LedgerAssetRow(
          id: old.id,
          type: LedgerAssetType.investments,
          currencyCountry: 'US',
          name: defaultAssetName,
          total: nav,
          label: old.label,
          comment: _comment(val),
          contextMarkdown: _context(val, old.contextMarkdown),
          returnRatePct: old.returnRatePct,
        ),
      );
      await _store.writeAssetId(old.id);
      return;
    }
    final row = LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.investments,
      currencyCountry: 'US',
      name: defaultAssetName,
      total: nav,
      label: '',
      comment: _comment(val),
      contextMarkdown: _context(val, null),
    );
    if (model.addAsset(row)) {
      await _store.writeAssetId(row.id);
    }
  }

  String _comment(PortfolioValuation val) {
    final bits = <String>[
      'Live from Covered Call Assistant',
      if (val.source != null) 'source ${val.source}',
      if (val.asOf != null && val.asOf!.isNotEmpty) 'as of ${val.asOf}',
    ];
    return bits.join(' · ');
  }

  String _context(PortfolioValuation val, String? previous) {
    final lines = <String>[
      '**IBKR net liquidation** synced from [portfolio.getzoro.com](${val.portfolioUrl}).',
      if (val.nav != null) '- NAV: \$${val.nav!.toStringAsFixed(2)} ${val.currency}',
      if (val.cash != null) '- Cash: \$${val.cash!.toStringAsFixed(2)}',
      if (val.asOf != null) '- As of: ${val.asOf}',
      if (val.source != null) '- Feed: ${val.source}',
      '',
      'Open the desk for rolls, screener, and chat. Zoro only stores this valuation total.',
    ];
    final built = lines.join('\n');
    if (previous == null || previous.trim().isEmpty) return built;
    if (previous.contains('IBKR net liquidation')) return built;
    return '$built\n\n---\n\n$previous';
  }
}
