import 'package:flutter/material.dart';

/// Mirrors `zoro-app` account + liability row shapes (UI-only).

/// Stable ids for bundled demo ledger rows (must remain unique).
abstract final class SeedLedgerIds {
  static const assetCondo = 'a-seed-condo';
  static const assetUsBrokerage = 'a-seed-us-brokerage';
  static const assetIndiaIndex = 'a-seed-india-index';
  static const assetThaiCash = 'a-seed-thai-cash';
  static const incomeSalary = 'i-seed-salary';
  static const incomeRsu = 'i-seed-rsu';
  static const incomeBonus = 'i-seed-bonus';
}

int _ledgerRowIdSeq = 0;

/// New row id; sequence suffix avoids duplicate ids when several rows are created in one tick.
String newLedgerRowId(String prefix) {
  final seq = _ledgerRowIdSeq++;
  return '$prefix-${DateTime.now().microsecondsSinceEpoch}-$seq';
}

enum LedgerAssetType {
  savings,
  investments,
  property,
  other,
}

/// How an asset balance counts toward goals (no double counting across buckets).
enum AssetGoalsBucket {
  /// Investment accounts — retirement corpus only.
  retirement,
  /// Cash / savings — target goals unless id is in [AssetsGoalsPolicy.retirementExtraAssetIds].
  savings,
  /// Real estate — retirement only when id is in [AssetsGoalsPolicy.retirementExtraAssetIds].
  property,
  /// Other — retirement only when id is in [AssetsGoalsPolicy.retirementExtraAssetIds].
  both,
}

/// Which property/other ledger assets count toward retirement (rest → savings).
class AssetsGoalsPolicy {
  const AssetsGoalsPolicy({this.retirementExtraAssetIds = const {}});

  final Set<String> retirementExtraAssetIds;
}

extension LedgerAssetTypeUi on LedgerAssetType {
  String get label => switch (this) {
        LedgerAssetType.savings => 'Savings',
        LedgerAssetType.investments => 'Investments',
        LedgerAssetType.property => 'Property',
        LedgerAssetType.other => 'Other',
      };

  String get apiValue => switch (this) {
        LedgerAssetType.savings => 'savings',
        LedgerAssetType.investments => 'investments',
        LedgerAssetType.property => 'property',
        LedgerAssetType.other => 'other',
      };

  AssetGoalsBucket get defaultGoalsBucket => switch (this) {
        LedgerAssetType.savings => AssetGoalsBucket.savings,
        LedgerAssetType.investments => AssetGoalsBucket.retirement,
        LedgerAssetType.property => AssetGoalsBucket.property,
        LedgerAssetType.other => AssetGoalsBucket.both,
      };

  IconData get icon => switch (this) {
        LedgerAssetType.savings => Icons.savings_outlined,
        LedgerAssetType.investments => Icons.trending_up,
        LedgerAssetType.property => Icons.apartment,
        LedgerAssetType.other => Icons.category_outlined,
      };

  static LedgerAssetType fromApi(String? raw) {
    switch (raw) {
      case 'investments':
      case 'brokerage':
      case 'crypto':
        return LedgerAssetType.investments;
      case 'property':
        return LedgerAssetType.property;
      case 'other':
        return LedgerAssetType.other;
      case 'savings':
      default:
        return LedgerAssetType.savings;
    }
  }
}

extension LedgerLiabilityTypeUi on LedgerLiabilityType {
  String get label => switch (this) {
        LedgerLiabilityType.personalLoan => 'Personal loan',
        LedgerLiabilityType.carLoan => 'Car loan',
        LedgerLiabilityType.creditCard => 'Credit card',
        LedgerLiabilityType.mortgage => 'Mortgage',
        LedgerLiabilityType.other => 'Other',
      };

  String get apiValue => switch (this) {
        LedgerLiabilityType.personalLoan => 'personal_loan',
        LedgerLiabilityType.carLoan => 'car_loan',
        LedgerLiabilityType.creditCard => 'credit_card',
        LedgerLiabilityType.mortgage => 'mortgage',
        LedgerLiabilityType.other => 'other',
      };

  IconData get icon => switch (this) {
        LedgerLiabilityType.personalLoan => Icons.person_outline,
        LedgerLiabilityType.carLoan => Icons.directions_car_outlined,
        LedgerLiabilityType.creditCard => Icons.credit_card,
        LedgerLiabilityType.mortgage => Icons.home_work_outlined,
        LedgerLiabilityType.other => Icons.receipt_long,
      };

  static LedgerLiabilityType fromApi(String? raw) {
    switch (raw) {
      case 'car_loan':
        return LedgerLiabilityType.carLoan;
      case 'credit_card':
        return LedgerLiabilityType.creditCard;
      case 'mortgage':
        return LedgerLiabilityType.mortgage;
      case 'other':
        return LedgerLiabilityType.other;
      case 'personal_loan':
      default:
        return LedgerLiabilityType.personalLoan;
    }
  }
}

enum LedgerLiabilityType {
  personalLoan,
  carLoan,
  creditCard,
  mortgage,
  other,
}

class LedgerAssetRow {
  LedgerAssetRow({
    required this.id,
    required this.type,
    required this.currencyCountry,
    required this.name,
    required this.total,
    required this.label,
    required this.comment,
    this.contextMarkdown,
    this.returnRatePct = 0,
  });

  final String id;
  LedgerAssetType type;

  String currencyCountry;
  String name;
  double total;
  String label;
  String comment;
  String? contextMarkdown;

  /// Annual return % (optional) — same role as [LedgerLiabilityRow.interestRatePct].
  double returnRatePct;

  LedgerAssetRow clone() => LedgerAssetRow(
        id: id,
        type: type,
        currencyCountry: currencyCountry,
        name: name,
        total: total,
        label: label,
        comment: comment,
        contextMarkdown: contextMarkdown,
        returnRatePct: returnRatePct,
      );

  factory LedgerAssetRow.blank({required String defaultCurrencyCountry}) {
    return LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.savings,
      currencyCountry: defaultCurrencyCountry,
      name: '',
      total: 0,
      label: '',
      comment: '',
      contextMarkdown: '',
    );
  }
}

class LedgerLiabilityRow {
  LedgerLiabilityRow({
    required this.id,
    required this.type,
    required this.name,
    required this.currencyCountry,
    required this.total,
    required this.comment,
    this.contextMarkdown,
    this.interestRatePct = 0,
    this.paydownWeight = 1,
    this.paydownMonthly = 0,
  });

  final String id;
  LedgerLiabilityType type;
  String name;
  String currencyCountry;
  double total;
  String comment;
  String? contextMarkdown;

  /// Annual interest % — edit in Ledger; used when auto-allocating paydown.
  double interestRatePct;

  /// Legacy weight for migration / auto-allocate; user edits use [paydownMonthly].
  double paydownWeight;

  /// Monthly savings allocated to this debt (display currency).
  double paydownMonthly;

  LedgerLiabilityRow clone() => LedgerLiabilityRow(
        id: id,
        type: type,
        name: name,
        currencyCountry: currencyCountry,
        total: total,
        comment: comment,
        contextMarkdown: contextMarkdown,
        interestRatePct: interestRatePct,
        paydownWeight: paydownWeight,
        paydownMonthly: paydownMonthly,
      );

  factory LedgerLiabilityRow.blank({required String defaultCurrencyCountry}) {
    return LedgerLiabilityRow(
      id: newLedgerRowId('l'),
      type: LedgerLiabilityType.personalLoan,
      currencyCountry: defaultCurrencyCountry,
      name: '',
      total: 0,
      comment: '',
      contextMarkdown: '',
    );
  }
}
