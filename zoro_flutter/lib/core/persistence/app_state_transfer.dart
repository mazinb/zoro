import 'dart:convert';

import '../state/app_model.dart';
import 'app_state_codec.dart';
/// Ledger-only portable export/import (inline JSON — no context sidecar `.md` refs).
class AppStateTransfer {
  static const String ledgerExportKind = 'ledger';

  /// Ledger envelope: assets, liabilities, income, expenses, cashflow, FX, projections.
  static Map<String, dynamic> buildLedgerExportMap(AppModel model) {
    final ledger = model.buildLedgerPersistedMap();
    return {
      'formatVersion': kAppStateFormatVersion,
      'exportKind': ledgerExportKind,
      'savedAtMs': DateTime.now().toUtc().millisecondsSinceEpoch,
      'ledger': ledger,
    };
  }

  static String encodeLedgerExportJson(AppModel model, {bool pretty = true}) {
    final map = buildLedgerExportMap(model);
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(map);
    }
    return jsonEncode(map);
  }

  static bool isLedgerOnlyExport(Map<String, dynamic> root) =>
      root['exportKind']?.toString() == ledgerExportKind;

  /// Returns a human-readable error, or `null` when [root] can be applied.
  static String? validateImportRoot(Object? decoded) {
    if (decoded is! Map) return 'File is not a JSON object.';
    final root = Map<String, dynamic>.from(decoded);
    final ver = root['formatVersion'];
    if (ver is! int || ver != kAppStateFormatVersion) {
      return 'Unsupported format version (expected $kAppStateFormatVersion).';
    }
    final ledger = root['ledger'];
    if (ledger is! Map) {
      return 'Missing "ledger" object.';
    }
    return null;
  }

  /// Parses JSON text and returns the root map, or throws [FormatException].
  static Map<String, dynamic> parseImportJson(String text) {
    final decoded = jsonDecode(text.trim());
    final err = validateImportRoot(decoded);
    if (err != null) throw FormatException(err);
    return Map<String, dynamic>.from(decoded as Map);
  }

  /// Merges [root] into the model. Ledger-only exports update ledger fields only.
  static Future<void> applyImport(AppModel model, Map<String, dynamic> root) async {
    if (isLedgerOnlyExport(root)) {
      await model.applyImportedLedger(Map<String, dynamic>.from(root['ledger'] as Map));
      return;
    }
    await model.applyImportedSnapshot(root);
  }

  static String suggestedExportFileName() {
    final n = DateTime.now();
    final stamp =
        '${n.year}${n.month.toString().padLeft(2, '0')}${n.day.toString().padLeft(2, '0')}_'
        '${n.hour.toString().padLeft(2, '0')}${n.minute.toString().padLeft(2, '0')}';
    return 'zoro_ledger_$stamp.json';
  }
}
