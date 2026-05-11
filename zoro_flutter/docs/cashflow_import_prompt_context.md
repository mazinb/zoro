# Cashflow import — prompt iteration notes

Context for tuning **Import monthly cashflow** (`InternalAppAgentIds.ledgerAddActualExpenses`). Prompts live in:

- `lib/core/state/internal_app_agent_definition.dart` — default system instructions
- `lib/features/ledger/ledger_import_page.dart` — JSON schema + **Rules (cashflow)** appended to the system prompt

User-editable copy can override defaults in **Settings → internal app agents**.

## Failure mode we addressed

- **Symptom:** `monthlyEarned` was **0** while debits, invested outflow, and spending looked correct.
- **Typical cause:** The model waited for an explicit “salary” label and ignored **statement-level totals** and **incoming / credit column** amounts.

## Model behavior we want (any bank / locale)

1. Find the **period summary** for **money in** vs **money out** (wording and column names vary; use layout and arithmetic, not one language).
2. **monthlyEarned** = income-like incoming amounts; when lines are hard to classify, use **total incoming for the period minus** amounts explicitly treated as non-earned in **assumptions**.
3. **Do not** zero earned when total incoming > 0 unless every such line is documented as non-earned in **assumptions**.
4. Optional sanity: opening + credits − debits ≈ closing (within rounding).

## When retesting

- Custom agent text in Settings overrides defaults until updated or cleared.
- Watch for **over-counting**: credits that are **transfers from the user’s own other accounts** should be excluded and noted in **assumptions**.
