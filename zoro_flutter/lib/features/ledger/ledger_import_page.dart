import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/import/document_ingest.dart';
import '../../core/llm/llm_error_helpers.dart';
import '../../core/llm/llm_json.dart';
import '../../core/llm/llm_client.dart';
import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
import '../../core/state/monthly_cashflow_entry.dart';
enum LedgerImportKind { asset, liability, cashflow }

enum _LedgerImportPickerKind { photos, files }

enum _LedgerImportStage {
  needPick,
  extractingLocal,
  localReady,
  runningLlm,
  llmComplete,
}

class LedgerImportPage extends StatefulWidget {
  const LedgerImportPage({
    super.key,
    required this.model,
    required this.kind,
    this.editAssetId,
    this.editLiabilityId,
    /// Weak tie-break only — cashflow `monthKey` must come from the document.
    this.cashflowEditorHintMonthKey,
  });

  final AppModel model;
  final LedgerImportKind kind;

  /// When set, user opened import while editing this asset — preview merges into this row on save.
  final String? editAssetId;

  /// When set, user opened import while editing this liability.
  final String? editLiabilityId;

  /// Month the user had selected when opening cashflow import (optional hint for ambiguous statements).
  final String? cashflowEditorHintMonthKey;

  @override
  State<LedgerImportPage> createState() => _LedgerImportPageState();
}

class _LedgerImportPageState extends State<LedgerImportPage> {
  bool _busy = false;
  /// True while the PDF password [AlertDialog] is showing — hide the indeterminate bar behind it.
  bool _pdfPasswordDialogOpen = false;
  String? _error;

  /// When null, use [AppModel.activeLlmProvider].
  LlmProvider? _importProviderOverride;

  List<PlatformFile> _pickedFiles = const [];

  /// Filled after local PDF/file ingest (before any LLM call).
  IngestBundle? _ingestBundle;
  String? _savedExtractFilePath;

  List<LedgerAssetRow>? _assetsPreview;
  List<LedgerLiabilityRow>? _liabilitiesPreview;
  MonthlyCashflowEntry? _cashflowPreview;
  String? _contextPreviewMarkdown;

  LedgerAssetRow? _beforeAsset;
  LedgerLiabilityRow? _beforeLiability;

  /// Non-fatal notice when e.g. the model returned multiple rows in edit mode.
  String? _importWarning;

  _LedgerImportStage _stage = _LedgerImportStage.needPick;

  bool get _editingAsset => widget.editAssetId != null;

  bool get _editingLiability => widget.editLiabilityId != null;

  bool get _isRowEditMode => _editingAsset || _editingLiability;

  String get _title => switch (widget.kind) {
    LedgerImportKind.asset => _editingAsset
        ? 'Update asset from import'
        : 'Import asset(s)',
    LedgerImportKind.liability => _editingLiability
        ? 'Update liability from import'
        : 'Import liability(s)',
    LedgerImportKind.cashflow => 'Import cashflow',
  };

  LlmProvider get _effectiveImportProvider =>
      _importProviderOverride ?? widget.model.activeLlmProvider;

  String get _internalAgentId => switch (widget.kind) {
    LedgerImportKind.asset => InternalAppAgentIds.ledgerAddAssets,
    LedgerImportKind.liability => InternalAppAgentIds.ledgerAddLiabilities,
    LedgerImportKind.cashflow => InternalAppAgentIds.ledgerAddActualExpenses,
  };

  /// JSON output contract — kept in app code (NOT user-editable).
  String get _jsonContract => switch (widget.kind) {
    LedgerImportKind.asset =>
      '''
Return ONE JSON object only. No prose. Schema:
{
  "assets":[
    {
      "type":"savings"|"brokerage"|"property"|"crypto"|"other",
      "currencyCountry":"US"|"Thailand"|"India"|...,
      "name":"Broker short name + account label (e.g. Fidelity Brokerage, Schwab IRA)",
      "total": 12345.67,
      "comment":"Ledger card: import source, statement or screenshot date if known, one line",
      "contextMarkdown":"What is in the account: holdings breakdown, major positions, notes (markdown ok)"
    }
  ],
  "contextMarkdown":"(optional) overall import note only"
}
Rules:
- **One row per brokerage/bank account** (account total in `total`; positions go in `contextMarkdown`).
- Include institution/broker short name in `name` when visible.
- `comment` ≠ `contextMarkdown`: comment = import meta + dates; context = what the account contains.
- Valid complete JSON only; escape quotes in strings.
''',
    LedgerImportKind.liability =>
      '''
Return ONE JSON object only. No prose. Schema:
{
  "liabilities":[
    {
      "type":"personal_loan"|"car_loan"|"credit_card"|"mortgage"|"other",
      "currencyCountry":"US"|"Thailand"|"India"|...,
      "name":"Institution + product (e.g. Citi Double Cash, HDFC home loan)",
      "total": 12345.67,
      "comment":"Ledger card: import source, statement date if known, one line",
      "contextMarkdown":"Terms, rate, min payment, or other details (markdown ok)"
    }
  ],
  "contextMarkdown":"(optional) overall import note only"
}
Rules: `comment` = import meta + dates; `contextMarkdown` = account/debt details. Valid JSON only.
''',
    LedgerImportKind.cashflow =>
      '''
Return ONE JSON object only. No prose. Schema:
{
  "monthKey":"YYYY-MM",
  "openingBalance": 0,
  "closingBalance": 0,
  "monthlyEarned": 0,
  "outflowToCashFd": 0,
  "outflowToInvested": 0,
  "monthlySpending": 0,
  "comment":"One line: document type (PDF/screenshot/export), institution/bank if known, statement period; keep short",
  "contextMarkdown":"Bullets: largest expenses & outbound transfers only — do NOT narrate income here",
  "assumptions":[ "(optional) bullets when you inferred or split amounts" ]
}
Rules (cashflow):
- Infer **monthKey** from the statement header / period / filename — **never** assume the app UI month.
- Prioritize extracting **openingBalance**, **closingBalance**, **monthlyEarned**, **outflowToInvested** (brokerage/investment transfers only when explicitly labeled or clearly investment).
- **Credits → monthlyEarned:** Use the statement’s **period summary for money in** (total credits, deposits, or equivalent — wording varies) and each **incoming** line. monthlyEarned = sum of **income-like credits** (payroll, wages, benefits, business or freelance receipts, customer payments, etc.). Exclude only credits clearly not earned (own-account transfers, loan principal to this account, paired reversals) and note them in **assumptions**. If the incoming total is stated but lines are ambiguous, set monthlyEarned to **that total minus** explicitly non-earned credits (do **not** default to 0 when total incoming > 0).
- **Classification (debits):** Treat generic transfers, bill pays, card payments, and unspecified outflows as **spending path**, i.e. affect **monthlySpending** or cash savings (**outflowToCashFd**) as appropriate. Only put flows in **outflowToInvested** when the document clearly indicates investment/brokerage funding (not generic transfers).
- **monthlySpending**: match **total debits** / spending subtotals from the statement when present; otherwise discretionary/total spend or residual after known splits.
- **comment** = provenance (PDF vs screenshot, bank name). **contextMarkdown** = notable large debits/transfers/expenses only; terse bullets; **exclude** income storylines.
- Valid JSON only.
''',
  };

  /// Combined system prompt = user-editable instructions (from Settings → Ledger)
  /// followed by the app-owned JSON contract.
  String _systemPrompt() {
    final user = widget.model
        .internalAgentSystemPrompt(_internalAgentId)
        .trim();
    final base = user.isEmpty
        ? (internalAppAgentDefinitionById(
                _internalAgentId,
              )?.defaultSystemPrompt ??
              '')
        : user;
    return '${base.trim()}\n\n---\n\n${_jsonContract.trim()}\n';
  }

  /// Existing rows are sent to the model so it can avoid duplicates / reconcile.
  Map<String, Object?> _existingPayload() {
    final m = widget.model;
    return switch (widget.kind) {
      LedgerImportKind.asset => {
        'displayCurrency': m.displayCurrency.name,
        'currencyNote':
            'displayCurrency is only for how amounts are formatted in the app UI. '
            'Set each asset currencyCountry from the statement or institution (e.g. India fund → India); '
            'do not copy displayCurrency into currencyCountry unless the document is actually in that currency.',
        if (widget.editAssetId != null) ...{
          'mode': 'updateExistingRow',
          'targetAssetId': widget.editAssetId,
          'existingTargetRow': () {
            final a = m.assetById(widget.editAssetId!);
            if (a == null) return null;
            return {
              'id': a.id,
              'name': a.name,
              'type': a.type.apiValue,
              'currencyCountry': a.currencyCountry,
              'total': m.assetDisplayValue(a),
              'comment': a.comment,
              'contextMarkdown': a.contextMarkdown ?? '',
            };
          }(),
        } else ...{
          'mode': 'addNewRows',
        },
        'existingAssets': [
          for (final a in m.assets)
            {
              'id': a.id,
              'name': a.name,
              'type': a.type.apiValue,
              'currencyCountry': a.currencyCountry,
              'total': m.assetDisplayValue(a),
            },
        ],
      },
      LedgerImportKind.liability => {
        'displayCurrency': m.displayCurrency.name,
        if (widget.editLiabilityId != null) ...{
          'mode': 'updateExistingRow',
          'targetLiabilityId': widget.editLiabilityId,
          'existingTargetRow': () {
            final l = m.liabilityById(widget.editLiabilityId!);
            if (l == null) return null;
            return {
              'id': l.id,
              'name': l.name,
              'type': l.type.apiValue,
              'currencyCountry': l.currencyCountry,
              'total': l.total,
              'comment': l.comment,
              'contextMarkdown': l.contextMarkdown ?? '',
            };
          }(),
        } else ...{
          'mode': 'addNewRows',
        },
        'existingLiabilities': [
          for (final l in m.liabilities)
            {
              'id': l.id,
              'name': l.name,
              'type': l.type.apiValue,
              'currencyCountry': l.currencyCountry,
              'total': l.total,
            },
        ],
      },
      LedgerImportKind.cashflow => {
        'displayCurrency': m.displayCurrency.name,
        'mode': 'inferMonthFromDocument',
        if ((widget.cashflowEditorHintMonthKey ?? '').trim().isNotEmpty)
          'optionalUiHintMonth': widget.cashflowEditorHintMonthKey,
        'recentMonths': [
          for (final mk in AppModel.recentMonthKeys(count: 6))
            {
              'monthKey': mk,
              'opening': m.monthlyEntryFor(mk)?.openingBalance,
              'closing': m.monthlyEntryFor(mk)?.closingBalance,
              'spending': m.monthlyEntryFor(mk)?.monthlySpending,
            },
        ],
      },
    };
  }

  @override
  void initState() {
    super.initState();
    _snapshotBeforeRows();
  }

  void _snapshotBeforeRows() {
    final m = widget.model;
    if (widget.editAssetId != null) {
      final a = m.assetById(widget.editAssetId!);
      if (a != null) _beforeAsset = a.clone();
    }
    if (widget.editLiabilityId != null) {
      final l = m.liabilityById(widget.editLiabilityId!);
      if (l != null) _beforeLiability = l.clone();
    }
  }

  /// Extra instructions when updating an existing ledger row (not add-new).
  String _editModeInstructions() {
    if (widget.editAssetId != null) {
      return '''

---
IMPORTANT — UPDATE EXISTING ASSET ROW
The user is editing saved asset id "${widget.editAssetId}" (same real-world account).
Return exactly ONE object in "assets" with the updated account-level total and refreshed fields.
The app will keep id "${widget.editAssetId}". Use "total" for the full account value; put holdings/positions breakdown in "contextMarkdown".
"comment" = import provenance + statement or screenshot date when known. "contextMarkdown" = what is actually in that account.
Preserve the existing row currencyCountry unless the document clearly shows a different legal/statement currency.''';
    }
    if (widget.editLiabilityId != null) {
      return '''

---
IMPORTANT — UPDATE EXISTING LIABILITY ROW
The user is editing saved liability id "${widget.editLiabilityId}".
Return exactly ONE object in "liabilities". The app will keep id "${widget.editLiabilityId}".
"comment" = import meta + dates; "contextMarkdown" = loan/card terms and details.''';
    }
    return '';
  }

  /// Cashflow: optional UI month selection — never overrides statement-derived monthKey.
  String _cashflowImportHints() {
    if (widget.kind != LedgerImportKind.cashflow) return '';
    final hint = (widget.cashflowEditorHintMonthKey ?? '').trim();
    if (hint.isEmpty) return '';
    return '''

---
Optional UI hint (tie-break ONLY): the user had "$hint" selected before opening import.
Infer **monthKey** from the document or statement period; use this hint only if the covered month is ambiguous.''';
  }

  Future<void> _pickAndExtract() async {
    setState(() {
      _error = null;
      _importWarning = null;
      _assetsPreview = null;
      _liabilitiesPreview = null;
      _cashflowPreview = null;
      _contextPreviewMarkdown = null;
      _ingestBundle = null;
      _savedExtractFilePath = null;
      _stage = _LedgerImportStage.needPick;
    });

    final allowMultipleImages = widget.kind == LedgerImportKind.asset;

    final pickerKind = await showLiquidGlassModalBottomSheet<_LedgerImportPickerKind>(
      context: context,
      showDragHandle: true,
      sizesToContent: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Choose input',
                  style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                ListTile(
                  leading: const Icon(Icons.image_outlined),
                  title: Text(
                    allowMultipleImages
                        ? 'Photos / images (multiple)'
                        : 'Photo / image',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text('Sent directly to the LLM as images.'),
                  onTap: () =>
                      Navigator.of(ctx).pop(_LedgerImportPickerKind.photos),
                ),
                ListTile(
                  leading: const Icon(Icons.attach_file),
                  title: const Text(
                    'File',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text(
                    'Any file. PDFs are parsed locally before the LLM sees them.',
                  ),
                  onTap: () =>
                      Navigator.of(ctx).pop(_LedgerImportPickerKind.files),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (!mounted) return;
    if (pickerKind == null) {
      Navigator.of(context).maybePop();
      return;
    }

    final r = await FilePicker.pickFiles(
      withData: true,
      allowMultiple:
          pickerKind == _LedgerImportPickerKind.photos && allowMultipleImages,
      type: pickerKind == _LedgerImportPickerKind.photos
          ? FileType.image
          : FileType.any,
    );
    if (!mounted) return;
    if (r == null || r.files.isEmpty) {
      Navigator.of(context).maybePop();
      return;
    }
    final picked = List<PlatformFile>.from(r.files);

    setState(() {
      _pickedFiles = picked;
    });

    await _runLocalExtractAfterPick();
  }

  Future<void> _runLocalExtractAfterPick() async {
    if (_pickedFiles.isEmpty) return;
    setState(() {
      _stage = _LedgerImportStage.extractingLocal;
      _busy = true;
      _error = null;
    });
    try {
      final bundle = await ingestPlatformFiles(
        files: _pickedFiles,
        requestPdfPassword: _requestPdfPassword,
      );
      String? path;
      final extractText = bundle.promptText;
      if (extractText.trim().isNotEmpty) {
        final dir = await getTemporaryDirectory();
        final f = File(
          '${dir.path}/zoro_ledger_import_${DateTime.now().millisecondsSinceEpoch}.txt',
        );
        await f.writeAsString(extractText, flush: true);
        path = f.path;
      }
      if (!mounted) return;
      setState(() {
        _ingestBundle = bundle;
        _savedExtractFilePath = path;
        _stage = _LedgerImportStage.localReady;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _ingestBundle = null;
        _savedExtractFilePath = null;
        _stage = _LedgerImportStage.needPick;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runLlmFromSavedBundle() async {
    final bundle = _ingestBundle;
    if (bundle == null) {
      setState(() => _error = 'Nothing imported on-device yet. Pick a file first.');
      return;
    }

    final m = widget.model;
    final provider = _effectiveImportProvider;
    final key = m.apiKeyFor(provider);
    if (key == null) {
      setState(() => _error = 'Add an API key in Settings → API keys first.');
      return;
    }

    if (provider == LlmProvider.appleFoundation && bundle.attachments.isNotEmpty) {
      setState(() {
        _error = _importErrorWithSuggestions(
          m,
          provider,
          'Apple on-device cannot use images or raw PDF bytes for this import. '
          'Pick OpenAI or Gemini (or turn off Apple and use Anthropic text-only after local PDF extract).',
        );
      });
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _stage = _LedgerImportStage.runningLlm;
    });

    try {
      final userPrompt = [
        'Files: ${_pickedFiles.map((f) => f.name).join(', ')}',
        '',
        '---',
        'Existing context (so you can avoid duplicates):',
        const JsonEncoder.withIndent('  ').convert(_existingPayload()),
        _editModeInstructions(),
        _cashflowImportHints(),
        if (bundle.promptText.trim().isNotEmpty) ...[
          '',
          '---',
          'Local file extraction / direct image notes:',
          bundle.promptText,
        ],
      ].join('\n').trim();

      Future<String> runComplete(String system, String user, {bool? preferJson}) async {
        return LlmClient().complete(
          provider: provider,
          apiKey: key,
          model: m.modelFor(provider),
          system: system,
          user: user,
          attachments: bundle.attachments,
          maxOutputTokens: 8192,
          preferJsonObjectOutput:
              preferJson ?? (provider == LlmProvider.openai || provider == LlmProvider.gemini),
        );
      }

      final raw = await runComplete(_systemPrompt(), userPrompt);
      final obj = await decodeLlmJsonObjectWithRepair(
        raw,
        repairWith: (broken) => runComplete(
          'You fix JSON only. Return a single valid JSON object with the same schema and meaning as the broken output. '
              'No markdown fences, no commentary, no prose outside the JSON.',
          broken,
          preferJson: provider == LlmProvider.openai || provider == LlmProvider.gemini,
        ),
      );

      if (widget.kind == LedgerImportKind.asset) {
        final list = obj['assets'];
        if (list is! List) throw const FormatException('Missing "assets" list');
        final assets = <LedgerAssetRow>[];
        for (final it in list) {
          if (it is! Map) continue;
          final mm = Map<String, dynamic>.from(it);
          final name = (mm['name']?.toString() ?? '').trim();
          final total = _toMoney(mm['total']);
          if (name.isEmpty && total == 0) continue;
          final type = LedgerAssetTypeUi.fromApi(_normaliseType(mm['type']));
          final currencyCountry = _cleanCountry(mm['currencyCountry']);
          final comment = (mm['comment']?.toString() ?? '').trim();
          final ctx = mm['contextMarkdown']?.toString();
          assets.add(
            LedgerAssetRow(
              id: newLedgerRowId('a'),
              type: type,
              currencyCountry: currencyCountry,
              name: name.isEmpty ? type.label : name,
              total: total,
              label: '',
              comment: comment,
              contextMarkdown: ctx,
            ),
          );
        }

        String? warn;
        var out = assets;
        if (widget.editAssetId != null) {
          if (out.isEmpty) {
            // Keep empty + error below.
          } else {
            if (out.length > 1) {
              warn =
                  'The model returned ${out.length} asset rows; only the first is used to update the selected account.';
            }
            out = [_finalizeAssetPreview(out.first)];
          }
        }

        setState(() {
          _assetsPreview = out;
          _importWarning = warn;
          _contextPreviewMarkdown = obj['contextMarkdown']?.toString();
          if (out.isEmpty) {
            _error = 'No asset rows could be extracted from this file.';
          }
        });
        m.recordInternalAgentRun(_internalAgentId, {
          'kind': 'asset_import',
          'previewRowCount': out.length,
          'files': _pickedFiles.map((f) => f.name).join(', '),
          if (widget.editAssetId != null) 'editAssetId': widget.editAssetId,
        });
      } else if (widget.kind == LedgerImportKind.liability) {
        final list = obj['liabilities'];
        if (list is! List) {
          throw const FormatException('Missing "liabilities" list');
        }
        final liabs = <LedgerLiabilityRow>[];
        for (final it in list) {
          if (it is! Map) continue;
          final mm = Map<String, dynamic>.from(it);
          final name = (mm['name']?.toString() ?? '').trim();
          final total = _toMoney(mm['total']);
          if (name.isEmpty && total == 0) continue;
          final type = LedgerLiabilityTypeUi.fromApi(
            _normaliseType(mm['type']),
          );
          final currencyCountry = _cleanCountry(mm['currencyCountry']);
          final comment = (mm['comment']?.toString() ?? '').trim();
          final ctx = mm['contextMarkdown']?.toString();
          liabs.add(
            LedgerLiabilityRow(
              id: newLedgerRowId('l'),
              type: type,
              currencyCountry: currencyCountry,
              name: name.isEmpty ? type.label : name,
              total: total,
              comment: comment,
              contextMarkdown: ctx,
            ),
          );
        }

        String? warn;
        var outLiabs = liabs;
        if (widget.editLiabilityId != null) {
          if (outLiabs.isEmpty) {
            // error below
          } else {
            if (outLiabs.length > 1) {
              warn =
                  'The model returned ${outLiabs.length} liability rows; only the first is used to update the selected row.';
            }
            outLiabs = [_finalizeLiabilityPreview(outLiabs.first)];
          }
        }

        setState(() {
          _liabilitiesPreview = outLiabs;
          _importWarning = warn;
          _contextPreviewMarkdown = obj['contextMarkdown']?.toString();
          if (outLiabs.isEmpty) {
            _error = 'No liability rows could be extracted from this file.';
          }
        });
        m.recordInternalAgentRun(_internalAgentId, {
          'kind': 'liability_import',
          'previewRowCount': outLiabs.length,
          'files': _pickedFiles.map((f) => f.name).join(', '),
          if (widget.editLiabilityId != null)
            'editLiabilityId': widget.editLiabilityId,
        });
      } else {
        final parsedMonth = _normaliseMonthKey(obj['monthKey']);
        if (parsedMonth == null) {
          throw const FormatException(
            'Could not detect a month (YYYY-MM) in the file.',
          );
        }

        final rawComment = (obj['comment']?.toString() ?? '').trim();
        final rawCtx = obj['contextMarkdown']?.toString();
        final existingEntry = m.monthlyEntryFor(parsedMonth);
        final mergedEntry = _finalizeCashflowPreview(
          targetMonthKey: parsedMonth,
          openingBalance: _toMoney(obj['openingBalance']),
          closingBalance: _toMoney(obj['closingBalance']),
          monthlyEarned: _toMoney(obj['monthlyEarned']),
          outflowToCashFd: _toMoney(obj['outflowToCashFd']),
          outflowToInvested: _toMoney(obj['outflowToInvested']),
          monthlySpending: _toMoney(obj['monthlySpending']),
          comment: rawComment,
          contextMarkdown: rawCtx,
          preserveInvestmentLines: existingEntry?.investmentLines,
        );

        setState(() {
          _cashflowPreview = mergedEntry;
          _contextPreviewMarkdown = (obj['assumptions'] is List)
              ? '### Import assumptions\n${(obj['assumptions'] as List).map((e) => '- ${e.toString()}').join('\n')}'
              : null;
        });
        m.recordInternalAgentRun(_internalAgentId, {
          'kind': 'cashflow_import',
          'monthKey': mergedEntry.monthKey,
          'files': _pickedFiles.map((f) => f.name).join(', '),
          if ((widget.cashflowEditorHintMonthKey ?? '').trim().isNotEmpty)
            'cashflowEditorHintMonthKey': widget.cashflowEditorHintMonthKey,
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _importErrorWithSuggestions(m, _effectiveImportProvider, e.toString());
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          if (_error == null) {
            _stage = _LedgerImportStage.llmComplete;
          } else if (_ingestBundle != null) {
            _stage = _LedgerImportStage.localReady;
          }
        });
      }
    }
  }

  Future<String?> _requestPdfPassword(String fileName) async {
    final ctrl = TextEditingController();
    try {
      if (mounted) {
        setState(() => _pdfPasswordDialogOpen = true);
      }
      return await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) {
          return AlertDialog(
            title: const Text('PDF password'),
            content: TextField(
              controller: ctrl,
              autofocus: true,
              obscureText: true,
              textInputAction: TextInputAction.done,
              decoration: InputDecoration(
                labelText: 'Password for $fileName',
                helperText: 'The PDF is decrypted locally on this device.',
              ),
              onSubmitted: (v) => Navigator.of(ctx).pop(v.trim()),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
                child: const Text('Continue'),
              ),
            ],
          );
        },
      );
    } finally {
      if (mounted) {
        setState(() => _pdfPasswordDialogOpen = false);
      }
      ctrl.dispose();
    }
  }

  /// Robust money parser: accepts numbers, JSON strings, and human strings like
  /// "$1,234.56", "₹1.2L", "12 345,67". Returns 0 on failure.
  static double _toMoney(Object? v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    var s = v.toString().trim();
    if (s.isEmpty) return 0;
    // Strip currency symbols and letters except digits / sep / sign.
    s = s.replaceAll(RegExp(r'[^\d.,\-]'), '');
    if (s.isEmpty) return 0;
    final hasComma = s.contains(',');
    final hasDot = s.contains('.');
    if (hasComma && hasDot) {
      // Last separator wins as decimal mark.
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replaceAll('.', '').replaceAll(',', '.');
      } else {
        s = s.replaceAll(',', '');
      }
    } else if (hasComma) {
      // 1,234 vs 1,23 — treat last group as thousands when length == 3.
      final parts = s.split(',');
      final tail = parts.last;
      if (parts.length > 1 && tail.length == 3) {
        s = s.replaceAll(',', '');
      } else {
        s = s.replaceAll(',', '.');
      }
    }
    return double.tryParse(s) ?? 0;
  }

  static String _normaliseType(Object? raw) {
    final s = raw?.toString().trim().toLowerCase().replaceAll(' ', '_') ?? '';
    return s;
  }

  static String _cleanCountry(Object? raw) {
    final s = raw?.toString().trim() ?? '';
    if (s.isEmpty) return 'US';
    return s;
  }

  /// Accepts "2025-04", "2025/4", "April 2025", "2025-04-15".
  static String? _normaliseMonthKey(Object? raw) {
    final s = raw?.toString().trim() ?? '';
    if (s.isEmpty) return null;
    final iso = RegExp(r'(\d{4})[-/](\d{1,2})').firstMatch(s);
    if (iso != null) {
      final y = int.tryParse(iso.group(1)!);
      final m = int.tryParse(iso.group(2)!);
      if (y != null && m != null && m >= 1 && m <= 12) {
        return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}';
      }
    }
    const months = {
      'jan': 1,
      'january': 1,
      'feb': 2,
      'february': 2,
      'mar': 3,
      'march': 3,
      'apr': 4,
      'april': 4,
      'may': 5,
      'jun': 6,
      'june': 6,
      'jul': 7,
      'july': 7,
      'aug': 8,
      'august': 8,
      'sep': 9,
      'sept': 9,
      'september': 9,
      'oct': 10,
      'october': 10,
      'nov': 11,
      'november': 11,
      'dec': 12,
      'december': 12,
    };
    final word = RegExp(r'([a-zA-Z]+)[\s,\-_/]+(\d{4})').firstMatch(s);
    if (word != null) {
      final m = months[word.group(1)!.toLowerCase()];
      final y = int.tryParse(word.group(2)!);
      if (m != null && y != null) {
        return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}';
      }
    }
    return null;
  }

  String _fmtMoney(double v) => formatGroupedInteger(
        v.round(),
        currency: widget.model.displayCurrency,
      );

  static String _truncate(String? s, [int max = 360]) {
    final t = (s ?? '').trim();
    if (t.length <= max) return t;
    return '${t.substring(0, max)}…';
  }

  LedgerAssetRow _finalizeAssetPreview(LedgerAssetRow parsed) {
    final bid = widget.editAssetId;
    if (bid == null) return parsed;
    final before = _beforeAsset;
    return LedgerAssetRow(
      id: bid,
      type: parsed.type,
      currencyCountry: parsed.currencyCountry,
      name: parsed.name,
      total: parsed.total,
      label: before?.label ?? parsed.label,
      comment: parsed.comment,
      contextMarkdown: parsed.contextMarkdown,
    );
  }

  LedgerLiabilityRow _finalizeLiabilityPreview(LedgerLiabilityRow parsed) {
    final bid = widget.editLiabilityId;
    if (bid == null) return parsed;
    return LedgerLiabilityRow(
      id: bid,
      type: parsed.type,
      name: parsed.name,
      currencyCountry: parsed.currencyCountry,
      total: parsed.total,
      comment: parsed.comment,
      contextMarkdown: parsed.contextMarkdown,
    );
  }

  MonthlyCashflowEntry _finalizeCashflowPreview({
    required String targetMonthKey,
    required double openingBalance,
    required double closingBalance,
    required double monthlyEarned,
    required double outflowToCashFd,
    required double outflowToInvested,
    required double monthlySpending,
    required String comment,
    String? contextMarkdown,
    List<MonthlyInvestmentLine>? preserveInvestmentLines,
  }) {
    final c = comment.trim();
    final ctx = contextMarkdown?.trim();
    final preserved = preserveInvestmentLines != null
        ? preserveInvestmentLines.map((e) => e.clone()).toList()
        : <MonthlyInvestmentLine>[];
    return MonthlyCashflowEntry(
      monthKey: targetMonthKey,
      openingBalance: openingBalance,
      closingBalance: closingBalance,
      monthlyEarned: monthlyEarned,
      outflowToCashFd: outflowToCashFd,
      outflowToInvested: outflowToInvested,
      monthlySpending: monthlySpending,
      comment: c,
      contextMarkdown: (ctx ?? '').isEmpty ? null : ctx,
      investmentLines: preserved,
    );
  }

  bool _canApplySave() {
    if (_busy || _error != null) return false;
    switch (widget.kind) {
      case LedgerImportKind.asset:
        return (_assetsPreview ?? const []).isNotEmpty;
      case LedgerImportKind.liability:
        return (_liabilitiesPreview ?? const []).isNotEmpty;
      case LedgerImportKind.cashflow:
        return _cashflowPreview != null;
    }
  }

  bool _sameStr(String? a, String? b) =>
      (a ?? '').trim() == (b ?? '').trim();

  Widget _diffRow(
    BuildContext ctx,
    String label,
    String? before,
    String after, {
    bool truncate = false,
  }) {
    final beforeDisp =
        truncate ? _truncate(before) : (before ?? '').trim();
    final afterDisp = truncate ? _truncate(after) : after.trim();
    final changed = !_sameStr(beforeDisp, afterDisp);
    final scheme = Theme.of(ctx).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
          ),
          const SizedBox(height: 2),
          if (!changed)
            Text(
              afterDisp.isEmpty ? '—' : afterDisp,
              style: const TextStyle(fontSize: 13),
            )
          else ...[
            Text(
              'Was: ${beforeDisp.isEmpty ? '—' : beforeDisp}',
              style: TextStyle(
                fontSize: 12,
                color: scheme.onSurfaceVariant,
                decoration: TextDecoration.lineThrough,
              ),
            ),
            Text(
              'Now: ${afterDisp.isEmpty ? '—' : afterDisp}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: scheme.primary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  List<Widget> _confirmDiffWidgets(BuildContext ctx) {
    switch (widget.kind) {
      case LedgerImportKind.asset:
        final after = _assetsPreview!.first;
        final before = _beforeAsset;
        return [
          _diffRow(ctx, 'Name', before?.name, after.name),
          _diffRow(ctx, 'Type', before?.type.label, after.type.label),
          _diffRow(ctx, 'Currency', before?.currencyCountry, after.currencyCountry),
          _diffRow(
            ctx,
            'Total',
            before == null ? null : _fmtMoney(before.total),
            _fmtMoney(after.total),
          ),
          _diffRow(
            ctx,
            'Comment',
            before?.comment,
            after.comment,
            truncate: true,
          ),
          _diffRow(
            ctx,
            'Context',
            before?.contextMarkdown,
            after.contextMarkdown ?? '',
            truncate: true,
          ),
        ];
      case LedgerImportKind.liability:
        final after = _liabilitiesPreview!.first;
        final before = _beforeLiability;
        return [
          _diffRow(ctx, 'Name', before?.name, after.name),
          _diffRow(ctx, 'Type', before?.type.label, after.type.label),
          _diffRow(ctx, 'Currency', before?.currencyCountry, after.currencyCountry),
          _diffRow(
            ctx,
            'Total',
            before == null ? null : _fmtMoney(before.total),
            _fmtMoney(after.total),
          ),
          _diffRow(
            ctx,
            'Comment',
            before?.comment,
            after.comment,
            truncate: true,
          ),
          _diffRow(
            ctx,
            'Context',
            before?.contextMarkdown,
            after.contextMarkdown ?? '',
            truncate: true,
          ),
        ];
      case LedgerImportKind.cashflow:
        return const [];
    }
  }

  String _saveTargetLabel() => switch (widget.kind) {
        LedgerImportKind.asset => 'asset',
        LedgerImportKind.liability => 'liability',
        LedgerImportKind.cashflow => 'row',
      };

  Future<void> _save() async {
    if (!_canApplySave()) return;
    if (_isRowEditMode) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Apply imported changes?'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Review changes to your saved ${_saveTargetLabel()} before applying.',
                  style: TextStyle(
                    color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 14),
                ..._confirmDiffWidgets(ctx),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Apply'),
            ),
          ],
        ),
      );
      if (ok != true) return;
      if (!mounted) return;
    }
    _applyImportedSave();
  }

  void _applyImportedSave() {
    final m = widget.model;
    if (widget.kind == LedgerImportKind.asset) {
      final rows = _assetsPreview ?? const [];
      if (rows.isEmpty) return;
      if (widget.editAssetId != null) {
        final a = rows.first;
        final idx = m.assets.indexWhere((x) => x.id == widget.editAssetId);
        if (idx >= 0) {
          m.replaceAsset(idx, a);
          final md = (a.contextMarkdown ?? '').trim();
          if (md.isNotEmpty) {
            m.setAssetContextMarkdown(assetId: a.id, markdown: md);
          }
        }
      } else {
        for (final a in rows) {
          m.addAsset(a);
          final md = (a.contextMarkdown ?? '').trim();
          if (md.isNotEmpty) {
            m.setAssetContextMarkdown(assetId: a.id, markdown: md);
          }
        }
      }
    } else if (widget.kind == LedgerImportKind.liability) {
      final rows = _liabilitiesPreview ?? const [];
      if (rows.isEmpty) return;
      if (widget.editLiabilityId != null) {
        final l = rows.first;
        final idx =
            m.liabilities.indexWhere((x) => x.id == widget.editLiabilityId);
        if (idx >= 0) {
          m.replaceLiability(idx, l);
          final md = (l.contextMarkdown ?? '').trim();
          if (md.isNotEmpty) {
            m.setLiabilityContextMarkdown(liabilityId: l.id, markdown: md);
          }
        }
      } else {
        for (final l in rows) {
          m.addLiability(l);
          final md = (l.contextMarkdown ?? '').trim();
          if (md.isNotEmpty) {
            m.setLiabilityContextMarkdown(liabilityId: l.id, markdown: md);
          }
        }
      }
    } else {
      final entry = _cashflowPreview;
      if (entry == null) return;
      m.upsertMonthlyCashflow(entry);
      if ((entry.contextMarkdown ?? '').trim().isNotEmpty) {
        m.markContextNoteSaved(AppModel.contextKeyMonth(entry.monthKey));
      }
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(_isRowEditMode ? 'Changes applied' : 'Imported'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    final poppedMonth = widget.kind == LedgerImportKind.cashflow
        ? _cashflowPreview?.monthKey
        : null;
    Navigator.of(context).pop<String?>(poppedMonth);
  }

  Widget _previewCard({required String title, required Widget child}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }

  List<Widget> _comparisonPreviewBlocks(BuildContext context) {
    if (!_isRowEditMode) return const [];
    final hasPreview = switch (widget.kind) {
      LedgerImportKind.asset => (_assetsPreview ?? const []).isNotEmpty,
      LedgerImportKind.liability =>
        (_liabilitiesPreview ?? const []).isNotEmpty,
      LedgerImportKind.cashflow => false,
    };
    if (!hasPreview) return const [];
    return [
      _previewCard(
        title: 'Saved vs imported',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: _confirmDiffWidgets(context),
        ),
      ),
      const SizedBox(height: 12),
    ];
  }

  /// Short labels for the import model row (fits one line; differs from [shortLlmLabel] in settings).
  String _importModelChipLabel(LlmProvider p) => switch (p) {
        LlmProvider.appleFoundation => 'Apple',
        LlmProvider.openai => 'OpenAI',
        LlmProvider.anthropic => 'Claude',
        LlmProvider.gemini => 'Gemini',
      };

  String _importErrorWithSuggestions(AppModel m, LlmProvider current, String base) {
    final hint = otherLlmSuggestionLine(m, current: current);
    final ctx = messageLooksLikeContextOrTokenLimit(base)
        ? 'Large PDFs / long extracts need a bigger on-device or cloud context. Try Gemini or OpenAI if you have a key.'
        : '';
    if (ctx.isEmpty && hint == null) return base;
    return '$base${ctx.isEmpty ? '' : '\n\n$ctx'}${hint == null ? '' : '\n\n$hint'}';
  }

  Widget _buildImportModelSwitcher(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.model,
      builder: (context, _) {
        final m = widget.model;
        final ready = llmProvidersReady(m);
        if (ready.isEmpty) return const SizedBox.shrink();
        final cs = Theme.of(context).colorScheme;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Model',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: cs.onSurfaceVariant,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ChoiceChip(
                    label: const Text('Default'),
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    selected: _importProviderOverride == null,
                    onSelected: (v) {
                      if (v) setState(() => _importProviderOverride = null);
                    },
                  ),
                  const SizedBox(width: 6),
                  for (final p in ready) ...[
                    ChoiceChip(
                      label: Text(_importModelChipLabel(p)),
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      selected: _importProviderOverride == p,
                      onSelected: (v) {
                        if (v) setState(() => _importProviderOverride = p);
                      },
                    ),
                    const SizedBox(width: 6),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
        );
      },
    );
  }

  Future<void> _openExtractedTextViewer() async {
    var full = _ingestBundle?.promptText ?? '';
    final path = _savedExtractFilePath;
    if (full.isEmpty && path != null) {
      try {
        full = await File(path).readAsString();
      } catch (_) {}
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('On-device extract'),
          content: SizedBox(
            width: double.maxFinite,
            height: MediaQuery.sizeOf(ctx).height * 0.55,
            child: SingleChildScrollView(
              child: SelectableText(
                full.trim().isEmpty
                    ? 'No text was extracted (e.g. images only). The AI step still receives image attachments when you run it.'
                    : full,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.35,
                  color: Theme.of(ctx).colorScheme.onSurface,
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  String _basename(String p) {
    final norm = p.replaceAll('\\', '/');
    final i = norm.lastIndexOf('/');
    return i < 0 ? p : norm.substring(i + 1);
  }

  Widget _buildImportStepsCard(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final stageLabel = switch (_stage) {
      _LedgerImportStage.needPick => '1 Choose a file',
      _LedgerImportStage.extractingLocal => '2 Reading file…',
      _LedgerImportStage.localReady => '2 Ready for AI',
      _LedgerImportStage.runningLlm => '3 Running AI…',
      _LedgerImportStage.llmComplete => '3 Done. Review below.',
    };
    final hasBundle = _ingestBundle != null;
    final canRunAi = hasBundle && !_busy;

    return _previewCard(
      title: 'Progress',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            stageLabel,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
          ),
          if (_stage == _LedgerImportStage.needPick && _pickedFiles.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Choose a file to start. Large PDFs read in the background.',
                style: TextStyle(fontSize: 12, color: muted, height: 1.35),
              ),
            ),
          if (hasBundle) ...[
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _openExtractedTextViewer,
                    icon: const Icon(Icons.article_outlined, size: 16),
                    label: const Text('Extract'),
                    style: OutlinedButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.tonalIcon(
                    onPressed: canRunAi ? _runLlmFromSavedBundle : null,
                    icon: const Icon(Icons.auto_awesome, size: 16),
                    label: const Text('Run AI'),
                    style: FilledButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _pickAndExtract,
                    icon: const Icon(Icons.edit_document, size: 16),
                    label: const Text('Replace'),
                    style: OutlinedButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  if (_stage == _LedgerImportStage.llmComplete ||
                      (_error != null && _ingestBundle != null)) ...[
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      onPressed: canRunAi ? _runLlmFromSavedBundle : null,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Retry'),
                      style: OutlinedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (_savedExtractFilePath != null) ...[
            const SizedBox(height: 8),
            Text(
              'Extract saved: ${_basename(_savedExtractFilePath!)}',
              style: TextStyle(fontSize: 11, color: muted),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final fileName = _pickedFiles.isEmpty
        ? ''
        : _pickedFiles.map((f) => f.name).join(', ');

    final canSave = _canApplySave();

    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          TextButton(
            onPressed: canSave ? () => _save() : null,
            child: const Text('Save'),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    fileName.isEmpty
                        ? 'Pick a file to import'
                        : 'File: $fileName',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 10),
                OutlinedButton(
                  onPressed: _busy ? null : _pickAndExtract,
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    widget.kind == LedgerImportKind.asset ? 'Files' : 'Browse',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildImportModelSwitcher(context),
            const SizedBox(height: 12),
            _buildImportStepsCard(context),
            const SizedBox(height: 12),
            if (_busy && !_pdfPasswordDialogOpen)
              const LinearProgressIndicator(minHeight: 3)
            else if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            if ((_importWarning ?? '').trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _importWarning!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.tertiary,
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
              ),
            const SizedBox(height: 12),
            if (_contextPreviewMarkdown != null &&
                _contextPreviewMarkdown!.trim().isNotEmpty)
              _previewCard(
                title: 'Context / assumptions',
                child: Text(
                  _contextPreviewMarkdown!.trim(),
                  style: TextStyle(
                    fontSize: 12,
                    color: muted,
                    height: 1.3,
                  ),
                ),
              ),
            ..._comparisonPreviewBlocks(context),
            if (_assetsPreview != null)
              _previewCard(
                title: 'Extracted assets',
                child: Column(
                  children: [
                    for (final a in _assetsPreview!)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          a.name.isEmpty ? a.type.label : a.name,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${a.currencyCountry} · ${a.type.label}',
                              style: TextStyle(
                                color: muted,
                                fontSize: 12,
                              ),
                            ),
                            if (a.comment.trim().isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  'Comment: ${_truncate(a.comment, 280)}',
                                  style: TextStyle(
                                    color: muted,
                                    fontSize: 12,
                                    height: 1.3,
                                  ),
                                ),
                              ),
                            if ((a.contextMarkdown ?? '').trim().isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  'Context: ${_truncate(a.contextMarkdown, 360)}',
                                  style: TextStyle(
                                    color: muted,
                                    fontSize: 12,
                                    height: 1.3,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        trailing: Text(
                          _fmtMoney(a.total),
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                  ],
                ),
              ),
            if (_liabilitiesPreview != null)
              _previewCard(
                title: 'Extracted liabilities',
                child: Column(
                  children: [
                    for (final l in _liabilitiesPreview!)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          l.name.isEmpty ? l.type.label : l.name,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${l.currencyCountry} · ${l.type.label}',
                              style: TextStyle(
                                color: muted,
                                fontSize: 12,
                              ),
                            ),
                            if (l.comment.trim().isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  'Comment: ${_truncate(l.comment, 280)}',
                                  style: TextStyle(
                                    color: muted,
                                    fontSize: 12,
                                    height: 1.3,
                                  ),
                                ),
                              ),
                            if ((l.contextMarkdown ?? '').trim().isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  'Context: ${_truncate(l.contextMarkdown, 360)}',
                                  style: TextStyle(
                                    color: muted,
                                    fontSize: 12,
                                    height: 1.3,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        trailing: Text(
                          _fmtMoney(l.total),
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                  ],
                ),
              ),
            if (_cashflowPreview != null)
              _previewCard(
                title: 'Extracted cashflow',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Month: ${_cashflowPreview!.monthKey}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    _kv(context, 'Opening', _cashflowPreview!.openingBalance),
                    _kv(context, 'Closing', _cashflowPreview!.closingBalance),
                    _kv(context, 'Earned', _cashflowPreview!.monthlyEarned),
                    _kv(context, 'Saved', _cashflowPreview!.outflowToCashFd),
                    _kv(context, 'Invested', _cashflowPreview!.outflowToInvested),
                    _kv(context, 'Spending', _cashflowPreview!.monthlySpending),
                    if (_cashflowPreview!.comment.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Comment: ${_truncate(_cashflowPreview!.comment, 360)}',
                        style: TextStyle(
                          color: muted,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                    if ((_cashflowPreview!.contextMarkdown ?? '')
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Context: ${_truncate(_cashflowPreview!.contextMarkdown, 420)}',
                        style: TextStyle(
                          color: muted,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: canSave ? () => _save() : null,
              child: const Text('Save imported data'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _kv(BuildContext context, String label, double v) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: muted),
            ),
          ),
          Text(
            v.toStringAsFixed(0),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
