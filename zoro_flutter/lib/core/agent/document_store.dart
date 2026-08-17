import 'dart:convert';
import 'dart:io';

import 'hermes_home_paths.dart';

class DocIndexEntry {
  const DocIndexEntry({
    required this.id,
    required this.title,
    required this.headRev,
    required this.updatedAt,
    this.skill = '',
  });

  final String id;
  final String title;
  final int headRev;
  final DateTime updatedAt;
  final String skill;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'headRev': headRev,
    'updatedAt': updatedAt.toUtc().toIso8601String(),
    if (skill.isNotEmpty) 'skill': skill,
  };

  static DocIndexEntry fromJson(Map<String, dynamic> m) {
    return DocIndexEntry(
      id: m['id']?.toString() ?? '',
      title: m['title']?.toString() ?? '',
      headRev: (m['headRev'] as num?)?.toInt() ?? 0,
      updatedAt:
          DateTime.tryParse(m['updatedAt']?.toString() ?? '')?.toUtc() ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      skill: m['skill']?.toString() ?? '',
    );
  }
}

class DocRevisionMeta {
  const DocRevisionMeta({
    required this.rev,
    required this.utc,
    required this.author,
    required this.reason,
  });

  final int rev;
  final DateTime utc;
  final String author;
  final String reason;
}

/// Versioned markdown store. [commit] never overwrites HEAD in place.
class DocumentStore {
  DocumentStore(this.home);

  /// Application support directory (parent of `hermes_home/`).
  final Directory home;

  Directory get _root => Directory('${home.path}/${HermesHomePaths.rootDir}');
  Directory get _docs => Directory('${home.path}/${HermesHomePaths.docsDir}');
  Directory get _revs =>
      Directory('${home.path}/${HermesHomePaths.revisionsDir}');
  File get _indexFile => File('${home.path}/${HermesHomePaths.docsIndexFile}');
  File get _logFile => File('${home.path}/${HermesHomePaths.logFile}');

  Future<void> ensureLayout() async {
    await _docs.create(recursive: true);
    await _revs.create(recursive: true);
    await _logFile.parent.create(recursive: true);
    if (!await _indexFile.exists()) {
      await _writeJson(_indexFile, {'docs': <Map<String, dynamic>>[]});
    }
  }

  File _headFile(String id) => File('${_docs.path}/${_safe(id)}.md');

  Directory _revDir(String id) => Directory('${_revs.path}/${_safe(id)}');

  File _revFile(String id, int rev) => File('${_revDir(id).path}/$rev.md');

  static String _safe(String id) =>
      id.replaceAll(RegExp(r'[^a-zA-Z0-9_.\-]'), '_');

  Future<List<DocIndexEntry>> listDocs() async {
    await ensureLayout();
    final idx = await _readIndex();
    return idx;
  }

  Future<DocIndexEntry?> entryFor(String id) async {
    final all = await listDocs();
    for (final e in all) {
      if (e.id == id) return e;
    }
    return null;
  }

  Future<String?> readHead(String id) async {
    await ensureLayout();
    final f = _headFile(id);
    if (!await f.exists()) return null;
    return f.readAsString();
  }

  Future<String?> readRev(String id, int rev) async {
    final f = _revFile(id, rev);
    if (!await f.exists()) return null;
    return f.readAsString();
  }

  DateTime? lastCommitAt(List<DocIndexEntry> docs) {
    DateTime? maxAt;
    for (final d in docs) {
      if (maxAt == null || d.updatedAt.isAfter(maxAt)) maxAt = d.updatedAt;
    }
    return maxAt;
  }

  /// Copies current HEAD to `revisions/`, writes new HEAD, appends a log line.
  Future<DocIndexEntry> commit({
    required String id,
    required String markdown,
    required String reason,
    String author = 'user',
    String title = '',
    String skill = '',
  }) async {
    await ensureLayout();
    final existing = await entryFor(id);
    final prevRev = existing?.headRev ?? 0;
    final nextRev = prevRev + 1;
    final now = DateTime.now().toUtc();

    final head = _headFile(id);
    if (await head.exists() && prevRev > 0) {
      final dir = _revDir(id);
      await dir.create(recursive: true);
      await head.copy(_revFile(id, prevRev).path);
    }

    await head.parent.create(recursive: true);
    final tmp = File('${head.path}.${now.microsecondsSinceEpoch}.tmp');
    await tmp.writeAsString(markdown, flush: true);
    await tmp.rename(head.path);

    final entry = DocIndexEntry(
      id: id,
      title: title.isNotEmpty
          ? title
          : (existing?.title.isNotEmpty == true ? existing!.title : id),
      headRev: nextRev,
      updatedAt: now,
      skill: skill.isNotEmpty ? skill : (existing?.skill ?? ''),
    );
    await _upsertIndex(entry);
    await _appendLog({
      'id': id,
      'rev': nextRev,
      'utc': now.toIso8601String(),
      'author': author,
      'reason': reason,
    });
    await _prune(id, keep: HermesHomePaths.maxRevisionsKept);
    return entry;
  }

  Future<List<DocRevisionMeta>> listRevs(String id) async {
    final logs = await _readLog();
    final out = <DocRevisionMeta>[];
    for (final row in logs) {
      if (row['id']?.toString() != id) continue;
      final rev = (row['rev'] as num?)?.toInt();
      if (rev == null) continue;
      out.add(
        DocRevisionMeta(
          rev: rev,
          utc:
              DateTime.tryParse(row['utc']?.toString() ?? '')?.toUtc() ??
              DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
          author: row['author']?.toString() ?? '',
          reason: row['reason']?.toString() ?? '',
        ),
      );
    }
    out.sort((a, b) => b.rev.compareTo(a.rev));
    return out;
  }

  Future<void> _prune(String id, {required int keep}) async {
    final dir = _revDir(id);
    if (!await dir.exists()) return;
    final files = await dir
        .list()
        .where((e) => e is File && e.path.endsWith('.md'))
        .cast<File>()
        .toList();
    final revs = <int, File>{};
    for (final f in files) {
      final n = int.tryParse(f.uri.pathSegments.last.replaceAll('.md', ''));
      if (n != null) revs[n] = f;
    }
    final keys = revs.keys.toList()..sort();
    if (keys.length <= keep) return;
    final drop = keys.take(keys.length - keep);
    for (final r in drop) {
      await revs[r]?.delete();
    }
  }

  Future<List<DocIndexEntry>> _readIndex() async {
    if (!await _indexFile.exists()) return [];
    try {
      final raw = jsonDecode(await _indexFile.readAsString());
      if (raw is! Map) return [];
      final docs = raw['docs'];
      if (docs is! List) return [];
      return [
        for (final d in docs)
          if (d is Map) DocIndexEntry.fromJson(Map<String, dynamic>.from(d)),
      ];
    } catch (_) {
      return [];
    }
  }

  Future<void> _upsertIndex(DocIndexEntry entry) async {
    final all = await _readIndex();
    final next = [...all.where((e) => e.id != entry.id), entry];
    await _writeJson(_indexFile, {
      'docs': next.map((e) => e.toJson()).toList(),
    });
  }

  Future<void> _appendLog(Map<String, dynamic> row) async {
    await _logFile.parent.create(recursive: true);
    await _logFile.writeAsString(
      '${jsonEncode(row)}\n',
      mode: FileMode.append,
      flush: true,
    );
  }

  Future<List<Map<String, dynamic>>> _readLog() async {
    if (!await _logFile.exists()) return [];
    final lines = (await _logFile.readAsString()).split('\n');
    final out = <Map<String, dynamic>>[];
    for (final line in lines) {
      final t = line.trim();
      if (t.isEmpty) continue;
      try {
        final v = jsonDecode(t);
        if (v is Map) out.add(Map<String, dynamic>.from(v));
      } catch (_) {}
    }
    return out;
  }

  Future<void> _writeJson(File f, Object value) async {
    await f.parent.create(recursive: true);
    final tmp = File('${f.path}.${DateTime.now().microsecondsSinceEpoch}.tmp');
    await tmp.writeAsString(
      const JsonEncoder.withIndent('  ').convert(value),
      flush: true,
    );
    await tmp.rename(f.path);
  }

  /// Minimal unified diff of [from] → [to]. Enough for the Agent UI.
  static String unifiedDiff(String from, String to, {String path = 'doc.md'}) {
    final a = from.split('\n');
    final b = to.split('\n');
    final buf = StringBuffer('--- a/$path\n+++ b/$path\n');
    final max = a.length > b.length ? a.length : b.length;
    for (var i = 0; i < max; i++) {
      final left = i < a.length ? a[i] : null;
      final right = i < b.length ? b[i] : null;
      if (left == right) {
        if (left != null) buf.writeln(' $left');
      } else {
        if (left != null) buf.writeln('-$left');
        if (right != null) buf.writeln('+$right');
      }
    }
    return buf.toString();
  }
}
