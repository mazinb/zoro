import 'dart:convert';
import 'dart:io';

import 'hermes_home_paths.dart';
import 'skill_pack.dart';

class SkillManifest {
  const SkillManifest({this.version = 1, this.skills = const []});

  final int version;
  final List<String> skills;

  bool has(String nameOrId) {
    final needle = nameOrId.split('/').last;
    return skills.any(
      (s) => s == nameOrId || s == needle || s.endsWith('/$needle'),
    );
  }

  Map<String, dynamic> toJson() => {'version': version, 'skills': skills};
}

/// Copies skill packs in Phase 3. Never clobbers a user-edited SKILL.md.
class SkillRegistry {
  SkillRegistry(this.home);

  final Directory home;

  File get _manifest =>
      File('${home.path}/${HermesHomePaths.skillsManifestFile}');
  Directory get _dir => Directory('${home.path}/${HermesHomePaths.skillsDir}');

  Future<SkillManifest> ensureEmpty() async {
    await _dir.create(recursive: true);
    if (!await _manifest.exists()) {
      const empty = SkillManifest();
      await _writeManifest(empty);
      return empty;
    }
    return load();
  }

  Future<SkillManifest> load() async {
    if (!await _manifest.exists()) return ensureEmpty();
    try {
      final raw = jsonDecode(await _manifest.readAsString());
      if (raw is! Map) return const SkillManifest();
      final skills = raw['skills'];
      return SkillManifest(
        version: (raw['version'] as num?)?.toInt() ?? 1,
        skills: skills is List
            ? [for (final s in skills) s.toString()]
            : const [],
      );
    } catch (_) {
      return const SkillManifest();
    }
  }

  File skillFile(String id) => File('${_dir.path}/$id/SKILL.md');

  Future<List<SkillPack>> installedPacks() async {
    final out = <SkillPack>[];
    for (final id in SkillPack.bundledIds) {
      final f = skillFile(id);
      if (!await f.exists()) continue;
      final pack = SkillPack.tryFile(f, id: id);
      if (pack != null) out.add(pack);
    }
    return out;
  }

  /// Copies bundled packs. Existing SKILL.md files are left untouched.
  Future<SkillManifest> installBundled({
    required Future<String> Function(String assetPath) loadAsset,
  }) async {
    await _dir.create(recursive: true);
    final ids = <String>[];
    for (final id in SkillPack.bundledIds) {
      final dest = skillFile(id);
      if (!await dest.exists()) {
        final raw = await loadAsset(SkillPack.assetFor(id));
        await dest.parent.create(recursive: true);
        await dest.writeAsString(raw, flush: true);
      }
      ids.add(id);
    }
    final manifest = SkillManifest(skills: ids);
    await _writeManifest(manifest);
    return manifest;
  }

  Future<void> _writeManifest(SkillManifest manifest) async {
    await _manifest.parent.create(recursive: true);
    await _manifest.writeAsString(
      const JsonEncoder.withIndent('  ').convert(manifest.toJson()),
      flush: true,
    );
  }
}
