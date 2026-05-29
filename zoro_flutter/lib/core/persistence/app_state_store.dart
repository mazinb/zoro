import 'dart:io';

import 'package:flutter/foundation.dart';

import 'app_state_split_store.dart';

bool get _shouldLogPersistErrors =>
    kDebugMode && !Platform.environment.containsKey('FLUTTER_TEST');

/// Persists app state as a manifest plus linked JSON files under application support.
class AppStateStore {
  /// Loads a monolithic map for [AppModel.applyPersistedSnapshot].
  static Future<Map<String, dynamic>?> load() => AppStateSplitStore.loadAsMonolithic();

  /// Saves from the in-memory monolithic snapshot produced by [AppModel.buildPersistedSnapshot].
  static Future<void> save(Map<String, dynamic> root) async {
    try {
      await AppStateSplitStore.saveMonolithic(root);
    } catch (e, st) {
      if (_shouldLogPersistErrors) {
        debugPrint('[AppStateStore] save failed: $e\n$st');
      }
    }
  }

  /// Writes ledger payload only (used after ledger import).
  static Future<void> saveLedger(Map<String, dynamic> ledger) =>
      AppStateSplitStore.saveLedgerOnly(ledger);
}
