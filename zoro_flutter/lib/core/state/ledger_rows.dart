import 'package:flutter/material.dart';

/// Mirrors `zoro-app/src/app/assets/page.tsx` account + liability row shapes (UI-only).

String newLedgerRowId(String prefix) => '$prefix-${DateTime.now().microsecondsSinceEpoch}';

enum LedgerAssetType {
  savings,
  brokerage,
  property,
  crypto,
  other,
}

enum LedgerLiabilityType {
  personalLoan,
  carLoan,
  creditCard,
  mortgage,
  other,
}

extension LedgerAssetTypeUi on LedgerAssetType {
  String get label => switch (this) {
        LedgerAssetType.savings => 'Savings',
        LedgerAssetType.brokerage => 'Brokerage',
        LedgerAssetType.property => 'Property',
        LedgerAssetType.crypto => 'Crypto',
        LedgerAssetType.other => 'Other',
      };

  /// Web/API `type` string (`formType: assets`).
  String get apiValue => switch (this) {
        LedgerAssetType.savings => 'savings',
        LedgerAssetType.brokerage => 'brokerage',
        LedgerAssetType.property => 'property',
        LedgerAssetType.crypto => 'crypto',
        LedgerAssetType.other => 'other',
      };

  IconData get icon => switch (this) {
        LedgerAssetType.savings => Icons.savings_outlined,
        LedgerAssetType.brokerage => Icons.trending_up,
        LedgerAssetType.property => Icons.apartment,
        LedgerAssetType.crypto => Icons.currency_bitcoin,
        LedgerAssetType.other => Icons.category_outlined,
      };

  static LedgerAssetType fromApi(String? raw) {
    switch (raw) {
      case 'brokerage':
        return LedgerAssetType.brokerage;
      case 'property':
        return LedgerAssetType.property;
      case 'crypto':
        return LedgerAssetType.crypto;
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

class LedgerAssetRow {
  LedgerAssetRow({
    required this.id,
    required this.type,
    required this.currencyCountry,
    required this.name,
    required this.total,
    required this.label,
    required this.comment,
    this.contextMarkdown = '',
  });

  final String id;
  LedgerAssetType type;

  /// Web field `currency`: country key (`India`, `Thailand`, `US`, …).
  String currencyCountry;
  String name;
  double total;
  String label;
  String comment;
  String contextMarkdown;

  LedgerAssetRow clone() => LedgerAssetRow(
        id: id,
        type: type,
        currencyCountry: currencyCountry,
        name: name,
        total: total,
        label: label,
        comment: comment,
        contextMarkdown: contextMarkdown,
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
    this.contextMarkdown = '',
  });

  final String id;
  LedgerLiabilityType type;
  String name;

  /// Web field `currency`: country key.
  String currencyCountry;
  double total;
  String comment;
  String contextMarkdown;

  LedgerLiabilityRow clone() => LedgerLiabilityRow(
        id: id,
        type: type,
        name: name,
        currencyCountry: currencyCountry,
        total: total,
        comment: comment,
        contextMarkdown: contextMarkdown,
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
