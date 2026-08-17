import 'dart:convert';
import 'dart:io';

/// agentskills.io-shaped pack parsed from SKILL.md frontmatter.
class SkillPack {
  const SkillPack({
    required this.id,
    required this.name,
    required this.description,
    this.version = '1.0.0',
    this.triggers = const [],
    this.fileTypes = const [],
    this.allowedDocs = const [],
    this.allowedTools = const [],
    this.tags = const [],
    this.body = '',
    this.assetPath = '',
  });

  /// Folder id like `finance/retirement-plan`.
  final String id;
  final String name;
  final String description;
  final String version;
  final List<String> triggers;
  final List<String> fileTypes;
  final List<String> allowedDocs;
  final List<String> allowedTools;
  final List<String> tags;
  final String body;
  final String assetPath;

  static const bundledIds = <String>[
    'finance/mailbox-triage',
    'finance/ingest-pdf',
    'finance/retirement-plan',
    'finance/update-context',
    'finance/ledger-from-statement',
    'finance/ledger-review',
    'finance/expense-calibration',
    'finance/corpus-backtest',
    'finance/savings-goals',
    'finance/home-briefing',
    'finance/notify-schedule',
  ];

  static String assetFor(String id) => 'assets/skills/$id/SKILL.md';

  static SkillPack parse(
    String raw, {
    required String id,
    String assetPath = '',
  }) {
    var name = id.split('/').last;
    var description = '';
    var version = '1.0.0';
    var triggers = <String>[];
    var fileTypes = <String>[];
    var allowedDocs = <String>[];
    var allowedTools = <String>[];
    var tags = <String>[];
    var body = raw;
    if (raw.startsWith('---')) {
      final end = raw.indexOf('\n---', 3);
      if (end > 0) {
        final fm = raw.substring(4, end);
        body = raw.substring(end + 4).trimLeft();
        for (final line in fm.split('\n')) {
          final i = line.indexOf(':');
          if (i <= 0) continue;
          final key = line.substring(0, i).trim();
          final val = line.substring(i + 1).trim().replaceAll('"', '');
          switch (key) {
            case 'name':
              name = val;
            case 'description':
              description = val;
            case 'version':
              version = val;
          }
        }
        triggers = _metaList(fm, 'triggers');
        fileTypes = _metaList(fm, 'file_types');
        allowedDocs = _metaList(fm, 'allowed_docs');
        allowedTools = _metaList(fm, 'allowed_tools');
        tags = _metaList(fm, 'tags');
      }
    }
    return SkillPack(
      id: id,
      name: name,
      description: description,
      version: version,
      triggers: triggers,
      fileTypes: fileTypes,
      allowedDocs: allowedDocs,
      allowedTools: allowedTools,
      tags: tags,
      body: body,
      assetPath: assetPath,
    );
  }

  static List<String> _metaList(String fm, String key) {
    final match = RegExp('$key:\\s*\\[([^\\]]*)\\]').firstMatch(fm);
    if (match == null) return const [];
    return [
      for (final p in match.group(1)!.split(','))
        p.trim().replaceAll('"', '').replaceAll("'", ''),
    ].where((s) => s.isNotEmpty).toList();
  }

  static SkillPack? tryFile(File file, {required String id}) {
    try {
      return parse(file.readAsStringSync(), id: id);
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic> toManifestEntry() => {
    'id': id,
    'name': name,
    'version': version,
    'source': 'bundled',
  };
}

String skillPackJson(SkillPack p) => jsonEncode(p.toManifestEntry());
