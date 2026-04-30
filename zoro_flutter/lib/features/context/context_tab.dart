import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/theme/app_theme.dart';
import 'context_orchestrator_page.dart';
import 'context_editor_page.dart';

class ContextTab extends StatefulWidget {
  const ContextTab({super.key, required this.model});

  final AppModel model;

  @override
  State<ContextTab> createState() => _ContextTabState();
}

class _ContextTabState extends State<ContextTab> {
  bool _estimatesExpanded = false;
  bool _actualsExpanded = false;

  String _hint(String md) {
    final t = md.trim();
    if (t.isEmpty) return 'No context yet';
    final first = t.split('\n').first.trim();
    return first.isEmpty ? 'Context added' : first;
  }

  String _money(double v, AppModel model) => formatCurrencyDisplay(v, currency: model.displayCurrency);

  @override
  Widget build(BuildContext context) {
    final model = widget.model;
    final hide = model.privacyHideAmounts;
    final predictedMonthly = model.totalExpensesMonthly;
    final monthsWithData = model.monthKeysWithCashflowData();
    final months = monthsWithData.isEmpty ? AppModel.recentMonthKeys() : monthsWithData;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Text(
              'Context',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
            const Spacer(),
            IconButton.filledTonal(
              onPressed: () {
                Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    fullscreenDialog: true,
                    builder: (ctx) => ContextOrchestratorPage(model: model),
                  ),
                );
              },
              icon: const Icon(Icons.auto_awesome),
              tooltip: 'Context helper',
              style: IconButton.styleFrom(
                backgroundColor: model.accentSoft,
                foregroundColor: model.accent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        const Text('Assets', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 8),
        ...model.assets.map((a) {
          final name = a.name.trim().isEmpty ? a.type.label : a.name.trim();
          final valueText = hide ? null : _money(a.total, model);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: ListTile(
                leading: Icon(a.type.icon, color: model.accent),
                title: Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
                subtitle: Text(_hint(a.contextMarkdown ?? ''), maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (valueText != null)
                      Text(
                        valueText,
                        style: const TextStyle(color: AppTheme.slate900, fontWeight: FontWeight.w900, fontSize: 12),
                      ),
                    const SizedBox(width: 8),
                    const Icon(Icons.chevron_right),
                  ],
                ),
                onTap: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (ctx) => ContextEditorPage.asset(model: model, assetId: a.id),
                    ),
                  );
                },
              ),
            ),
          );
        }),

        const SizedBox(height: 6),
        const Text('Liabilities', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 8),
        ...model.liabilities.map((l) {
          final name = l.name.trim().isEmpty ? l.type.label : l.name.trim();
          final valueText = hide ? null : _money(l.total, model);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: ListTile(
                leading: Icon(l.type.icon, color: model.accent),
                title: Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
                subtitle: Text(_hint(l.contextMarkdown ?? ''), maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (valueText != null)
                      Text(
                        valueText,
                        style: const TextStyle(color: AppTheme.slate900, fontWeight: FontWeight.w900, fontSize: 12),
                      ),
                    const SizedBox(width: 8),
                    const Icon(Icons.chevron_right),
                  ],
                ),
                onTap: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (ctx) => ContextEditorPage.liability(model: model, liabilityId: l.id),
                    ),
                  );
                },
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
              style: const TextStyle(color: AppTheme.slate600, fontSize: 12),
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
                              style: const TextStyle(color: AppTheme.slate900, fontWeight: FontWeight.w900, fontSize: 12),
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
              style: const TextStyle(color: AppTheme.slate600, fontSize: 12),
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
                              style: const TextStyle(
                                color: AppTheme.slate900,
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
    );
  }
}

