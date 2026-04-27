# Currency + FX (UI mock)

This Flutter app currently supports displaying net worth and Ledger values in **USD / THB / INR**.

## Where exchange rates live (hard-coded for now)

- **Code**: `zoro_flutter/lib/core/finance/currency.dart`
- **Field**: `CurrencyCode.usdPerUnit`
- **Meaning**: `usdPerUnit` is the spot rate \(1 unit of the currency == X USD\).

Example:

- If `CurrencyCode.thb.usdPerUnit = 0.0277`, then \(1 THB = 0.0277 USD\) and \(1 USD ≈ 36.1 THB\).

## Next step (when we make it dynamic)

Replace the hard-coded `usdPerUnit` values with a persisted / fetched rate source (DB or API), then keep the conversion helper `convertCurrency(...)` as the single place that applies them.

## Ledger rows (web parity)

On web `/assets`, each account row stores `currency` as a **country preset key** (e.g. `India`, `Thailand`, `US`) — same as Flutter `LedgerAssetRow.currencyCountry` / `LedgerLiabilityRow.currencyCountry`. `currencyCodeForPresetCountry(...)` maps that key to `CurrencyCode` for FX conversion.

