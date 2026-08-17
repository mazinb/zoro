import 'skill_pack.dart';

/// Indexes bundled/installed packs. Phase 3 matcher: at most [maxSkills] per run.
abstract final class SkillMatcher {
  static const maxSkills = 3;

  static List<SkillPack> match({
    required List<SkillPack> packs,
    String prompt = '',
    String? cronJobId,
    bool hasInboxPdf = false,
  }) {
    final p = prompt.toLowerCase();
    final scored = <(SkillPack, int)>[];
    for (final pack in packs) {
      var score = 0;
      if (hasInboxPdf &&
          pack.triggers.any((t) => t.contains('inbox') || t.contains('pdf'))) {
        score += 3;
      }
      if (cronJobId != null && cronJobId.isNotEmpty) {
        if (pack.triggers.any(
          (t) => t.contains('cron') || cronJobId.contains(pack.name),
        )) {
          score += 4;
        }
      }
      for (final token in _tokens(p)) {
        if (pack.name.contains(token) ||
            pack.description.toLowerCase().contains(token)) {
          score += 2;
        }
        if (pack.tags.any((t) => t.contains(token))) score += 1;
      }
      if (score > 0) scored.add((pack, score));
    }
    scored.sort((a, b) => b.$2.compareTo(a.$2));
    return [for (final s in scored.take(maxSkills)) s.$1];
  }

  static Iterable<String> _tokens(String prompt) {
    return prompt.split(RegExp(r'[^a-z0-9]+')).where((t) => t.length >= 4);
  }
}
