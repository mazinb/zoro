import '../persistence/app_state_store.dart';

typedef SnapshotBuilder = Map<String, dynamic> Function();

/// Owns persistence scheduling + disk writes for [AppModel].
///
/// Keeping this separate makes it easier to split [AppModel] into smaller
/// controllers while preserving current behavior.
class AppModelPersistenceController {
  AppModelPersistenceController({required SnapshotBuilder buildSnapshot})
      : _buildSnapshot = buildSnapshot;

  final SnapshotBuilder _buildSnapshot;

  int _revision = 0;

  void schedulePersist() {
    _revision++;
    final rev = _revision;
    Future<void> run() async {
      if (rev != _revision) return;
      try {
        await AppStateStore.save(_buildSnapshot());
      } catch (_) {
        // Intentionally swallow: current behavior (will improve once logging policy is decided).
      }
    }

    Future.microtask(run);
  }

  Future<void> persistNow() async {
    try {
      await AppStateStore.save(_buildSnapshot());
    } catch (_) {
      // Intentionally swallow: current behavior (will improve once logging policy is decided).
    }
  }
}

