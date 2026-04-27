import 'ledger_rows.dart';

/// One row of annual income with its own currency (like ledger assets).
class CashflowIncomeLine {
  CashflowIncomeLine({
    required this.id,
    required this.label,
    required this.annualAmount,
    required this.currencyCountry,
  });

  final String id;
  String label;
  double annualAmount;
  String currencyCountry;

  CashflowIncomeLine clone() => CashflowIncomeLine(
        id: id,
        label: label,
        annualAmount: annualAmount,
        currencyCountry: currencyCountry,
      );

  factory CashflowIncomeLine.blank({required String defaultCurrencyCountry}) {
    return CashflowIncomeLine(
      id: newLedgerRowId('i'),
      label: '',
      annualAmount: 0,
      currencyCountry: defaultCurrencyCountry,
    );
  }
}
