import '../../core/state/app_model.dart';

/// Applies structured `goalUpdates` from the goals guide synthesizer.
void applyGoalsGuideStructured(AppModel model, Map<String, Object?> structured, {String? focusGoalId}) {
  final updatesRaw = structured['goalUpdates'];
  if (updatesRaw == null) return;

  final updates = <Map<String, Object?>>[];
  if (updatesRaw is List) {
    for (final e in updatesRaw) {
      if (e is Map) updates.add(Map<String, Object?>.from(e));
    }
  } else if (updatesRaw is Map) {
    updates.add(Map<String, Object?>.from(updatesRaw));
  }

  if (updates.isEmpty && focusGoalId != null) {
    final single = <String, Object?>{'goalId': focusGoalId};
    for (final k in ['name', 'targetAmount', 'targetDate', 'linkedAssetIds', 'fundsProjects', 'corpusAdjustment']) {
      if (structured.containsKey(k)) single[k] = structured[k];
    }
    if (single.length > 1) updates.add(single);
  }

  for (final u in updates) {
    final id = u['goalId']?.toString();
    if (id == null || id.isEmpty) continue;
    final existing = model.financialGoalById(id);
    if (existing == null) continue;

    var next = existing;
    final name = u['name']?.toString();
    if (name != null && name.trim().isNotEmpty) {
      next = next.copyWith(name: name.trim());
    }

    final target = u['targetAmount'];
    if (target is num) {
      next = next.copyWith(targetAmount: target.toDouble());
    }

    final td = u['targetDate'];
    if (td == null) {
      // omit
    } else if (td is String && td.trim().isEmpty) {
      next = next.copyWith(clearTargetDate: true);
    } else {
      final parsed = DateTime.tryParse(td.toString());
      if (parsed != null) next = next.copyWith(targetDate: parsed);
    }

    final linked = u['linkedAssetIds'];
    if (linked is List) {
      final ids = <String>[];
      for (final e in linked) {
        final s = e.toString().trim();
        if (s.isNotEmpty && model.assetById(s) != null) ids.add(s);
      }
      next = next.copyWith(linkedAssetIds: ids);
    }

    if (u['fundsProjects'] is bool) {
      next = next.copyWith(fundsProjects: u['fundsProjects'] as bool);
    }

    if (existing.isRetirement) {
      final ca = u['corpusAdjustment'];
      if (ca is num) next = next.copyWith(corpusAdjustment: ca.toDouble());
    }

    model.upsertFinancialGoal(next);
  }
}

void applyGoalsGuideContext(
  AppModel model, {
  required String contextMarkdown,
  required Map<String, Object?> structured,
  String? focusGoalId,
}) {
  applyGoalsGuideStructured(model, structured, focusGoalId: focusGoalId);

  final md = contextMarkdown.trim();
  if (md.isEmpty) return;

  final ctxGoalId = structured['contextGoalId']?.toString() ?? focusGoalId;
  if (ctxGoalId != null && ctxGoalId.isNotEmpty) {
    final g = model.financialGoalById(ctxGoalId);
    if (g != null) {
      model.upsertFinancialGoal(g.copyWith(contextMarkdown: md));
      return;
    }
  }

  if (focusGoalId != null) {
    final g = model.financialGoalById(focusGoalId);
    if (g != null) {
      model.upsertFinancialGoal(g.copyWith(contextMarkdown: md));
    }
  }
}
