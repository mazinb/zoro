import 'dart:convert';
import 'dart:io';

import 'hermes_home_paths.dart';

class VaultFileType {
  VaultFileType({
    required this.id,
    required this.label,
    this.mime = 'application/pdf',
    List<String>? filenameContains,
    List<String>? fromContains,
    this.lastUsedAt,
  }) : filenameContains = filenameContains ?? [],
       fromContains = fromContains ?? [];

  final String id;
  String label;
  String mime;
  List<String> filenameContains;
  List<String> fromContains;
  DateTime? lastUsedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'mime': mime,
    'match': {
      'filenameContains': filenameContains,
      'fromContains': fromContains,
    },
    if (lastUsedAt != null) 'lastUsedAt': lastUsedAt!.toUtc().toIso8601String(),
  };

  static VaultFileType fromJson(Map<String, dynamic> m) {
    final match = m['match'];
    final matchMap = match is Map
        ? Map<String, dynamic>.from(match)
        : <String, dynamic>{};
    return VaultFileType(
      id: m['id']?.toString() ?? '',
      label: m['label']?.toString() ?? '',
      mime: m['mime']?.toString() ?? 'application/pdf',
      filenameContains: _stringList(matchMap['filenameContains']),
      fromContains: _stringList(matchMap['fromContains']),
      lastUsedAt: DateTime.tryParse(m['lastUsedAt']?.toString() ?? ''),
    );
  }

  static List<String> _stringList(Object? v) {
    if (v is! List) return [];
    return [
      for (final e in v) e.toString(),
    ].where((s) => s.trim().isNotEmpty).toList();
  }
}

class VaultIndex {
  VaultIndex(this.file);

  final File file;
  List<VaultFileType> types = [];

  static List<VaultFileType> presets() => [
    VaultFileType(
      id: 'brokerage',
      label: 'Brokerage statement',
      filenameContains: [
        'IBKR',
        'Interactive',
        'brokerage',
        'Fidelity',
        'Schwab',
      ],
    ),
    VaultFileType(
      id: 'bank',
      label: 'Bank statement',
      filenameContains: ['statement', 'checking', 'savings'],
    ),
    VaultFileType(
      id: 'tax',
      label: 'Tax document',
      filenameContains: ['W-2', 'W2', '1099', 'ITR', 'tax'],
    ),
    VaultFileType(
      id: 'insurance',
      label: 'Insurance',
      filenameContains: ['policy', 'insurance', 'premium'],
    ),
    VaultFileType(id: 'other', label: 'Other PDF'),
  ];

  Future<void> load() async {
    if (!await file.exists()) {
      types = presets();
      await save();
      return;
    }
    try {
      final raw = jsonDecode(await file.readAsString());
      if (raw is Map && raw['fileTypes'] is List) {
        types = [
          for (final e in raw['fileTypes'] as List)
            if (e is Map) VaultFileType.fromJson(Map<String, dynamic>.from(e)),
        ];
      }
    } catch (_) {
      types = presets();
    }
    if (types.isEmpty) types = presets();
  }

  Future<void> save() async {
    await file.parent.create(recursive: true);
    await file.writeAsString(
      const JsonEncoder.withIndent(
        '  ',
      ).convert({'fileTypes': types.map((t) => t.toJson()).toList()}),
      flush: true,
    );
  }

  VaultFileType? byId(String id) {
    for (final t in types) {
      if (t.id == id) return t;
    }
    return null;
  }

  VaultFileType? match({String? filename, String? from, String? mime}) {
    final name = (filename ?? '').toLowerCase();
    final sender = (from ?? '').toLowerCase();
    final m = (mime ?? '').toLowerCase();
    VaultFileType? best;
    var bestScore = 0;
    for (final t in types) {
      var score = 0;
      if (m.isNotEmpty && t.mime.toLowerCase() == m) score += 1;
      for (final token in t.filenameContains) {
        if (token.trim().isEmpty) continue;
        if (name.contains(token.toLowerCase())) score += 3;
      }
      for (final token in t.fromContains) {
        if (token.trim().isEmpty) continue;
        if (sender.contains(token.toLowerCase())) score += 4;
      }
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (bestScore < 3) return null;
    return best;
  }

  Future<void> touch(String id) async {
    final t = byId(id);
    if (t == null) return;
    t.lastUsedAt = DateTime.now().toUtc();
    await save();
  }

  Future<void> upsert(VaultFileType type) async {
    types = [...types.where((t) => t.id != type.id), type];
    await save();
  }

  Future<void> remove(String id) async {
    types = types.where((t) => t.id != id).toList();
    await save();
  }
}

String vaultIndexPath(Directory support) =>
    '${support.path}/${HermesHomePaths.vaultIndexFile}';
