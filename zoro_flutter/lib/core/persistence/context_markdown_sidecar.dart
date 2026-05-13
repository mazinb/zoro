import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Persists long `contextMarkdown` fields as `.md` files under app support so
/// `app_state.json` stays small and decode/encode is less likely to OOM.
class ContextMarkdownSidecar {
  static const _subDir = 'context_markdown';

  static Future<Directory> _rootDir() async {
    final sup = await getApplicationSupportDirectory();
    final d = Directory('${sup.path}/$_subDir');
    if (!await d.exists()) {
      await d.create(recursive: true);
    }
    return d;
  }

  static String _safeName(String ref) =>
      ref.replaceAll(RegExp(r'[^a-zA-Z0-9_.\-]'), '_');

  static Future<File> _fileForRef(String ref) async {
    final dir = await _rootDir();
    return File('${dir.path}/${_safeName(ref)}.md');
  }

  static Future<void> writeRef(String ref, String markdown) async {
    final f = await _fileForRef(ref);
    await f.writeAsString(markdown, flush: true);
  }

  static Future<String?> readRef(String ref) async {
    try {
      final f = await _fileForRef(ref);
      if (!await f.exists()) return null;
      return f.readAsString();
    } catch (_) {
      return null;
    }
  }

  /// Before JSON decode into [AppModel], merge sidecar markdown into [root].
  static Future<void> hydrate(Map<String, dynamic> root) async {
    final ledger = root['ledger'];
    if (ledger is! Map) return;
    final L = Map<String, dynamic>.from(ledger);

    Future<void> patchAssets() async {
      final raw = L['assets'];
      if (raw is! List) return;
      for (var i = 0; i < raw.length; i++) {
        final item = raw[i];
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        final ref = m['contextMarkdownRef']?.toString();
        if (ref != null && ref.isNotEmpty) {
          final body = await readRef(ref);
          if (body != null && body.trim().isNotEmpty) {
            m['contextMarkdown'] = body;
          }
          m.remove('contextMarkdownRef');
        }
        raw[i] = m;
      }
    }

    Future<void> patchLiabilities() async {
      final raw = L['liabilities'];
      if (raw is! List) return;
      for (var i = 0; i < raw.length; i++) {
        final item = raw[i];
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        final ref = m['contextMarkdownRef']?.toString();
        if (ref != null && ref.isNotEmpty) {
          final body = await readRef(ref);
          if (body != null && body.trim().isNotEmpty) {
            m['contextMarkdown'] = body;
          }
          m.remove('contextMarkdownRef');
        }
        raw[i] = m;
      }
    }

    Future<void> patchMonthly() async {
      final mc = L['monthlyCashflowByMonth'];
      if (mc is! Map) return;
      for (final e in mc.entries.toList()) {
        final v = e.value;
        if (v is! Map) continue;
        final m = Map<String, dynamic>.from(v);
        final refM = m['contextMarkdownRef']?.toString();
        if (refM != null && refM.isNotEmpty) {
          final body = await readRef(refM);
          if (body != null && body.trim().isNotEmpty) {
            m['contextMarkdown'] = body;
          }
          m.remove('contextMarkdownRef');
        }
        final linesRaw = m['investmentLines'];
        if (linesRaw is List) {
          for (var j = 0; j < linesRaw.length; j++) {
            final line = linesRaw[j];
            if (line is! Map) continue;
            final lm = Map<String, dynamic>.from(line);
            final refL = lm['contextMarkdownRef']?.toString();
            if (refL != null && refL.isNotEmpty) {
              final body = await readRef(refL);
              if (body != null && body.trim().isNotEmpty) {
                lm['contextMarkdown'] = body;
              }
              lm.remove('contextMarkdownRef');
            }
            linesRaw[j] = lm;
          }
          m['investmentLines'] = linesRaw;
        }
        mc[e.key] = m;
      }
    }

    await patchAssets();
    await patchLiabilities();
    await patchMonthly();
    root['ledger'] = L;
  }

  /// Strip large markdown out of [root] before writing JSON; writes `.md` files.
  static Future<void> dehydrate(Map<String, dynamic> root) async {
    final ledger = root['ledger'];
    if (ledger is! Map) return;
    final L = Map<String, dynamic>.from(ledger);

    Future<void> stripAssets() async {
      final raw = L['assets'];
      if (raw is! List) return;
      for (var i = 0; i < raw.length; i++) {
        final item = raw[i];
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        final id = m['id']?.toString();
        final md = m['contextMarkdown']?.toString() ?? '';
        if (id != null && md.trim().isNotEmpty) {
          final ref = 'asset:$id';
          await writeRef(ref, md);
          m.remove('contextMarkdown');
          m['contextMarkdownRef'] = ref;
        }
        raw[i] = m;
      }
    }

    Future<void> stripLiabilities() async {
      final raw = L['liabilities'];
      if (raw is! List) return;
      for (var i = 0; i < raw.length; i++) {
        final item = raw[i];
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        final id = m['id']?.toString();
        final md = m['contextMarkdown']?.toString() ?? '';
        if (id != null && md.trim().isNotEmpty) {
          final ref = 'liability:$id';
          await writeRef(ref, md);
          m.remove('contextMarkdown');
          m['contextMarkdownRef'] = ref;
        }
        raw[i] = m;
      }
    }

    Future<void> stripMonthly() async {
      final mc = L['monthlyCashflowByMonth'];
      if (mc is! Map) return;
      for (final e in mc.entries.toList()) {
        final v = e.value;
        if (v is! Map) continue;
        final m = Map<String, dynamic>.from(v);
        final mk = m['monthKey']?.toString() ?? e.key.toString();
        final md = m['contextMarkdown']?.toString() ?? '';
        if (md.trim().isNotEmpty) {
          final ref = 'month:$mk';
          await writeRef(ref, md);
          m.remove('contextMarkdown');
          m['contextMarkdownRef'] = ref;
        }
        final linesRaw = m['investmentLines'];
        if (linesRaw is List) {
          for (var j = 0; j < linesRaw.length; j++) {
            final line = linesRaw[j];
            if (line is! Map) continue;
            final lm = Map<String, dynamic>.from(line);
            final lid = lm['id']?.toString();
            final lmd = lm['contextMarkdown']?.toString() ?? '';
            if (lid != null && lmd.trim().isNotEmpty) {
              final ref = 'invline:$lid';
              await writeRef(ref, lmd);
              lm.remove('contextMarkdown');
              lm['contextMarkdownRef'] = ref;
            }
            linesRaw[j] = lm;
          }
          m['investmentLines'] = linesRaw;
        }
        mc[e.key] = m;
      }
    }

    await stripAssets();
    await stripLiabilities();
    await stripMonthly();
    root['ledger'] = L;
  }
}
