import 'dart:convert';

import 'apple_foundation_channel.dart';

class PromptContextBudget {
  const PromptContextBudget({
    required this.contextSize,
    required this.reservedForOutput,
    required this.tokenCount,
  });

  final int contextSize;
  final int reservedForOutput;
  final int tokenCount;

  int get usableInput => (contextSize - reservedForOutput).clamp(0, contextSize);

  double get usageFraction => contextSize <= 0 ? 0 : tokenCount / contextSize;

  bool get isOverBudget => tokenCount > (usableInput * 0.85).round();
}

/// Measures and optionally trims MCQ payload for on-device Apple model.
class PromptContextBudgetService {
  PromptContextBudgetService({AppleFoundationChannel? channel})
      : _channel = channel ?? AppleFoundationChannel();

  final AppleFoundationChannel _channel;

  int _contextSize = 0;
  int _reserved = 2048;

  Future<void> refreshBudget() async {
    try {
      final raw = await _channel.getContextBudget();
      _contextSize = raw.contextSize;
      _reserved = raw.reservedForOutput;
    } catch (_) {
      _contextSize = 0;
      _reserved = 2048;
    }
  }

  Future<PromptContextBudget> measure({
    required String system,
    required String user,
  }) async {
    if (_contextSize <= 0) await refreshBudget();
    var tokens = 0;
    try {
      tokens = await _channel.countTokens(system: system, user: user);
    } catch (_) {
      tokens = ((system.length + user.length) / 4).ceil();
    }
    return PromptContextBudget(
      contextSize: _contextSize,
      reservedForOutput: _reserved,
      tokenCount: tokens,
    );
  }

  /// Trims [payload] for Apple on-device calls. Returns trimmed JSON string + whether trimming occurred.
  Future<({String userJson, bool trimmed})> prepareUserPayload({
    required String system,
    required Map<String, Object?> payload,
  }) async {
    if (_contextSize <= 0) await refreshBudget();
    // Without a real context window (e.g. iOS < 26.4 token counting), skip trim loop.
    if (_contextSize <= 0) {
      return (userJson: jsonEncode(payload), trimmed: false);
    }

    var working = Map<String, Object?>.from(payload);
    var userJson = jsonEncode(working);
    var budget = await measure(system: system, user: userJson);
    if (!budget.isOverBudget) return (userJson: userJson, trimmed: false);

    void truncateMarkdownFields() {
      for (final k in ['existingContextMarkdown', 'contextMarkdown']) {
        final v = working[k]?.toString();
        if (v != null && v.length > 400) {
          working[k] = '${v.substring(0, 400)}…';
        }
      }
      final focus = working['focusGoal'];
      if (focus is Map) {
        final m = Map<String, Object?>.from(focus);
        final cm = m['contextMarkdown']?.toString();
        if (cm != null && cm.length > 400) {
          m['contextMarkdown'] = '${cm.substring(0, 400)}…';
          working['focusGoal'] = m;
        }
      }
    }

    void dropQaFreeText() {
      final qa = working['qaHistory'];
      if (qa is! List) return;
      working['qaHistory'] = [
        for (final e in qa)
          if (e is Map)
            () {
              final m = Map<String, Object?>.from(e);
              m.remove('freeText');
              return m;
            }(),
      ];
    }

    void shrinkAssets() {
      final assets = working['assets'];
      if (assets is! List) return;
      working['assets'] = [
        for (final a in assets)
          if (a is Map)
            {
              'id': a['id'],
              'name': a['name'],
              'value': a['value'],
            },
      ];
    }

    void capGoals() {
      final goals = working['goals'];
      if (goals is! List || goals.length <= 6) return;
      working['goals'] = goals.take(6).toList();
    }

    var trimmed = false;
    for (final step in [truncateMarkdownFields, dropQaFreeText, shrinkAssets, capGoals]) {
      step();
      userJson = jsonEncode(working);
      budget = await measure(system: system, user: userJson);
      trimmed = true;
      if (!budget.isOverBudget) break;
    }

    return (userJson: userJson, trimmed: trimmed);
  }
}
