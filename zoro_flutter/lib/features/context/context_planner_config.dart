import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';

/// Targets the context assistant; [buildPayload] supplies the JSON sent to the model (plus [qaHistory]).
class ContextPlannerConfig {
  const ContextPlannerConfig({
    required this.internalAgentId,
    required this.title,
    required this.initialMarkdown,
    required this.buildPayload,
    required this.isTargetMissing,
    required this.missingTargetMessage,
  });

  final String internalAgentId;
  final String title;
  final String initialMarkdown;
  final Map<String, Object?> Function(AppModel model, List<Map<String, Object?>> qaHistory) buildPayload;
  final bool Function(AppModel model) isTargetMissing;
  final String missingTargetMessage;

  static ContextPlannerConfig forAsset({
    required AppModel model,
    required String assetId,
    required String initialMarkdown,
  }) {
    final a = model.assetById(assetId);
    final title = a == null
        ? 'Asset'
        : (a.name.trim().isEmpty ? a.type.label : a.name.trim());
    final key = AppModel.contextKeyAsset(assetId);
    return ContextPlannerConfig(
      internalAgentId: InternalAppAgentIds.assetContext,
      title: title,
      initialMarkdown: initialMarkdown,
      isTargetMissing: (_) => model.assetById(assetId) == null,
      missingTargetMessage: 'This asset is no longer in your ledger.',
      buildPayload: (m, qa) {
        final row = m.assetById(assetId);
        if (row == null) return {'qaHistory': qa};
        return {
          'asset': {
            'id': row.id,
            'type': row.type.apiValue,
            'name': row.name,
            'total': row.total,
            'currencyCountry': row.currencyCountry,
            'label': row.label,
            'comment': row.comment,
            'displayCurrency': m.displayCurrency.name,
            'valueFormatted': formatCurrencyDisplay(row.total, currency: m.displayCurrency),
          },
          'existingContextMarkdown': initialMarkdown,
          'contextLastUpdated': m.contextNoteLastUpdatedIso(key),
          'qaHistory': qa,
        };
      },
    );
  }

  static ContextPlannerConfig forLiability({
    required AppModel model,
    required String liabilityId,
    required String initialMarkdown,
  }) {
    final l = model.liabilityById(liabilityId);
    final title = l == null
        ? 'Liability'
        : (l.name.trim().isEmpty ? l.type.label : l.name.trim());
    final key = AppModel.contextKeyLiability(liabilityId);
    return ContextPlannerConfig(
      internalAgentId: InternalAppAgentIds.liabilityContext,
      title: title,
      initialMarkdown: initialMarkdown,
      isTargetMissing: (_) => model.liabilityById(liabilityId) == null,
      missingTargetMessage: 'This liability is no longer in your ledger.',
      buildPayload: (m, qa) {
        final row = m.liabilityById(liabilityId);
        if (row == null) return {'qaHistory': qa};
        return {
          'liability': {
            'id': row.id,
            'type': row.type.apiValue,
            'name': row.name,
            'total': row.total,
            'currencyCountry': row.currencyCountry,
            'comment': row.comment,
            'displayCurrency': m.displayCurrency.name,
            'balanceFormatted': formatCurrencyDisplay(row.total, currency: m.displayCurrency),
          },
          'existingContextMarkdown': initialMarkdown,
          'contextLastUpdated': m.contextNoteLastUpdatedIso(key),
          'qaHistory': qa,
        };
      },
    );
  }

  static ContextPlannerConfig forExpenseBucket({
    required AppModel model,
    required String bucketKey,
    required String initialMarkdown,
  }) {
    final label = presetForCountry(AppModel.expensePresetCountry).buckets[bucketKey]?.label ?? bucketKey;
    final monthly = model.expenseBuckets[bucketKey] ??
        presetForCountry(AppModel.expensePresetCountry).buckets[bucketKey]?.value ??
        0.0;
    final key = AppModel.contextKeyBucket(bucketKey);
    return ContextPlannerConfig(
      internalAgentId: InternalAppAgentIds.expenseBucketContext,
      title: label,
      initialMarkdown: initialMarkdown,
      isTargetMissing: (_) => false,
      missingTargetMessage: '',
      buildPayload: (m, qa) {
        return {
          'expenseBucket': {
            'key': bucketKey,
            'label': label,
            'monthlyEstimate': monthly,
            'currency': m.displayCurrency.name,
            'monthlyFormatted': formatCurrencyDisplay(monthly, currency: m.displayCurrency),
          },
          'existingContextMarkdown': initialMarkdown,
          'contextLastUpdated': m.contextNoteLastUpdatedIso(key),
          'qaHistory': qa,
        };
      },
    );
  }

  static ContextPlannerConfig forMonth({
    required AppModel model,
    required String monthKey,
    required String initialMarkdown,
  }) {
    final label = AppModel.formatMonthKeyLabel(monthKey);
    final key = AppModel.contextKeyMonth(monthKey);
    final entry = model.monthlyEntryFor(monthKey);
    return ContextPlannerConfig(
      internalAgentId: InternalAppAgentIds.monthCashflowContext,
      title: label,
      initialMarkdown: initialMarkdown,
      isTargetMissing: (_) => false,
      missingTargetMessage: '',
      buildPayload: (m, qa) {
        return {
          'month': {
            'monthKey': monthKey,
            'label': label,
            'monthlySpending': entry?.monthlySpending,
            'comment': entry?.comment ?? '',
          },
          'existingContextMarkdown': initialMarkdown,
          'contextLastUpdated': m.contextNoteLastUpdatedIso(key),
          'qaHistory': qa,
        };
      },
    );
  }
}
