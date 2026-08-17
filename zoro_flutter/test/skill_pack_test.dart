import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/agent/skill_matcher.dart';
import 'package:zoro_flutter/core/agent/skill_pack.dart';

void main() {
  test('parses SKILL.md frontmatter', () {
    const raw = '''
---
name: retirement-plan
description: Living plan
version: 1.0.0
metadata:
  hermes:
    tags: [finance, retirement]
  zoro:
    triggers: [user.plan, cron.plan_review]
    allowed_tools: [commit_doc, read_doc]
---

Body here.
''';
    final pack = SkillPack.parse(raw, id: 'finance/retirement-plan');
    expect(pack.name, 'retirement-plan');
    expect(pack.triggers, contains('user.plan'));
    expect(pack.allowedTools, contains('commit_doc'));
    expect(pack.body.trim(), 'Body here.');
  });

  test('matcher returns at most 3 skills', () {
    final packs = [
      for (final id in SkillPack.bundledIds)
        SkillPack(
          id: id,
          name: id.split('/').last,
          description: id,
          triggers: ['user.${id.split('/').last}', 'inbox.pdf'],
          tags: ['finance'],
        ),
    ];
    final hit = SkillMatcher.match(
      packs: packs,
      prompt: 'update my retirement plan from the pdf statement',
      hasInboxPdf: true,
    );
    expect(hit.length, lessThanOrEqualTo(SkillMatcher.maxSkills));
    expect(
      hit.any(
        (p) => p.name.contains('retirement') || p.id.contains('retirement'),
      ),
      isTrue,
    );
  });
}
