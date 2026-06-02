import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../shared/help/tab_help_content.dart';
import '../../shared/widgets/ledger_card_subtitle.dart';
import '../../shared/widgets/tab_header_actions.dart';
import '../../shared/widgets/row_review_leading.dart';
import '../../core/state/ledger_rows.dart';
import 'context_editor_page.dart';
import 'context_row_review_service.dart';

class ContextTab extends StatefulWidget {
  const ContextTab({super.key, required this.model});

  final AppModel model;

  @override
  State<ContextTab> createState() => _ContextTabState();
}

class _ContextTabState extends State<ContextTab> {
  bool _estimatesExpanded = false;
  bool _actualsExpanded = false;
  bool _contextReviewRunning = false;
  final _contextReviewService = ContextRowReviewService();

  String _hint(String md) {
    final t = md.trim();
    if (t.isEmpty) return 'No context yet';
    final first = t.split('\n').first.trim();
    return first.isEmpty ? 'Context added' : first;
  }

  String _money(double v, AppModel model) => formatCurrencyDisplay(v, currency: model.displayCurrency);

  /// Ledger row totals are stored in the row’s native currency — show that here (not converted to Home).
  /// Primary cash asset uses latest month closing in home/display currency.
  String _moneyNativeAsset(LedgerAssetRow a, {required bool hide}) {
    final m = widget.model;
    if (m.primaryCashBalanceIsMirrored(a)) {
      final v = m.latestCashClosingBalanceDisplay ?? 0;
      if (hide) {
        return maskSensitiveNumberString(
          formatCurrencyDisplay(v, currency: m.displayCurrency),
        );
      }
      return formatCurrencyDisplay(v, currency: m.displayCurrency);
    }
    if (hide) {
      return maskSensitiveNumberString(
        formatCurrencyDisplay(a.total, currency: currencyCodeForPresetCountry(a.currencyCountry)),
      );
    }
    return formatCurrencyDisplay(a.total, currency: currencyCodeForPresetCountry(a.currencyCountry));
  }

  String _moneyNativeLiability(LedgerLiabilityRow l, {required bool hide}) {
    if (hide) return maskSensitiveNumberString(formatCurrencyDisplay(l.total, currency: currencyCodeForPresetCountry(l.currencyCountry)));
    return formatCurrencyDisplay(l.total, currency: currencyCodeForPresetCountry(l.currencyCountry));
  }

  Future<void> _runContextHelper() async {
    if (_contextReviewRunning) return;
    final m = widget.model;
    if (!m.helperEnabledContext) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Context helper is off in Settings.'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    final ready = await m.prepareLlmForAssistant();
    if (!mounted) return;
    if (!ready) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(m.llmAssistantUnavailableMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _contextReviewRunning = true);
    try {
      final out = await _contextReviewService.reviewAssetsAndLiabilities(m);
      if (!mounted) return;
      final msg = StringBuffer('Context review complete');
      if (out.budgetLine != null) msg.write('\n${out.budgetLine}');
      if (out.trimmed) msg.write('\nSome notes were trimmed for on-device limits.');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg.toString()),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _contextReviewRunning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.model;
    final cs = Theme.of(context).colorScheme;
    final hide = model.privacyHideAmounts;
    final predictedMonthly = model.totalExpensesMonthly;
    final monthsWithData = model.monthKeysWithCashflowData();
    final months = monthsWithData.isEmpty ? AppModel.recentMonthKeys() : monthsWithData;

    return ListenableBuilder(
      listenable: model,
      builder: (context, _) => ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Text(
              'Context',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
            const Spacer(),
            TabHeaderActions(
              model: model,
              help: TabHelpContent.context,
              assistantRunning: _contextReviewRunning,
              assistantTooltip: 'Context assistant',
              assistantEnabled: model.helperEnabledContext,
              onAssistant: _runContextHelper,
            ),
          ],
        ),
        const SizedBox(height: 16),

        const Text('Assets', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 8),
        ...model.assets.map((a) {
          final name = a.name.trim().isEmpty ? a.type.label : a.name.trim();
          final valueText = hide ? _moneyNativeAsset(a, hide: true) : _moneyNativeAsset(a, hide: false);
          final slot = model.contextAssetReviewById[a.id];
          final r = slot?.result;
          final reviewing = slot?.reviewing ?? false;
          final subtitle = _hint(a.contextMarkdown ?? '');
          final useLeading = slot != null && (reviewing || r != null);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (ctx) => ContextEditorPage.asset(model: model, assetId: a.id),
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      useLeading
                          ? RowReviewLeadingIcon(
                              reviewing: reviewing,
                              result: r,
                              defaultIcon: a.type.icon,
                              accent: model.accent,
                              size: 40,
                              iconSize: 24,
                            )
                          : Icon(a.type.icon, color: model.accent),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
                            LedgerCardSubtitle(text: subtitle),
                          ],
                        ),
                      ),
                      Text(
                        valueText,
                        style: TextStyle(
                          color: cs.onSurface,
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),

        const SizedBox(height: 6),
        const Text('Liabilities', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 8),
        ...model.liabilities.map((l) {
          final name = l.name.trim().isEmpty ? l.type.label : l.name.trim();
          final valueText = hide ? _moneyNativeLiability(l, hide: true) : _moneyNativeLiability(l, hide: false);
          final slot = model.contextLiabilityReviewById[l.id];
          final r = slot?.result;
          final reviewing = slot?.reviewing ?? false;
          final subtitle = _hint(l.contextMarkdown ?? '');
          final useLeading = slot != null && (reviewing || r != null);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (ctx) => ContextEditorPage.liability(model: model, liabilityId: l.id),
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      useLeading
                          ? RowReviewLeadingIcon(
                              reviewing: reviewing,
                              result: r,
                              defaultIcon: l.type.icon,
                              accent: model.accent,
                              size: 40,
                              iconSize: 24,
                            )
                          : Icon(l.type.icon, color: model.accent),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
                            LedgerCardSubtitle(text: subtitle),
                          ],
                        ),
                      ),
                      Text(
                        valueText,
                        style: TextStyle(
                          color: cs.onSurface,
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),

        const SizedBox(height: 6),
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.only(top: 8),
            title: const Text('Estimates', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            subtitle: Text(
              _estimatesExpanded ? 'Tap to collapse' : 'Tap to expand',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
            ),
            initiallyExpanded: _estimatesExpanded,
            onExpansionChanged: (v) => setState(() => _estimatesExpanded = v),
            children: [
              for (final k in recurringExpenseBucketKeys)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      leading: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(color: bucketColorHighContrast(k), shape: BoxShape.circle),
                      ),
                      title: Text(
                        presetForCountry(AppModel.expensePresetCountry).buckets[k]?.label ?? k,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      subtitle: Text(
                        _hint(model.expenseBucketContextMarkdown[k] ?? ''),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!hide)
                            Text(
                              _money(
                                (model.expenseBuckets[k] ?? presetForCountry(AppModel.expensePresetCountry).buckets[k]?.value ?? 0).toDouble(),
                                model,
                              ),
                              style: TextStyle(color: cs.onSurface, fontWeight: FontWeight.w900, fontSize: 12),
                            ),
                          const SizedBox(width: 8),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                      onTap: () {
                        Navigator.of(context).push<void>(
                          MaterialPageRoute(
                            builder: (ctx) => ContextEditorPage.expenseBucket(model: model, bucketKey: k),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),

        const SizedBox(height: 6),
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.only(top: 8),
            title: const Text('Actuals', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            subtitle: Text(
              _actualsExpanded ? 'Tap to collapse' : 'Tap to expand',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
            ),
            initiallyExpanded: _actualsExpanded,
            onExpansionChanged: (v) => setState(() => _actualsExpanded = v),
            children: [
              for (final mk in months)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      leading: Icon(
                        Icons.calendar_month,
                        color: AppModel.spendVsPredictedColor(
                          actual: (model.monthlyEntryFor(mk)?.monthlySpending ?? 0).toDouble(),
                          predicted: predictedMonthly,
                          hasData: (model.monthlyEntryFor(mk)?.monthlySpending ?? 0) > 0,
                        ),
                      ),
                      title: Text(AppModel.formatMonthKeyLabel(mk), style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text(
                        _hint(model.monthlyEntryFor(mk)?.contextMarkdown ?? ''),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!hide)
                            Text(
                              _money((model.monthlyEntryFor(mk)?.monthlySpending ?? 0).toDouble(), model),
                              style: TextStyle(
                                color: cs.onSurface,
                                fontWeight: FontWeight.w900,
                                fontSize: 12,
                              ),
                            ),
                          const SizedBox(width: 8),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                      onTap: () {
                        Navigator.of(context).push<void>(
                          MaterialPageRoute(
                            builder: (ctx) => ContextEditorPage.month(model: model, monthKey: mk),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    ),
    );
  }
}

