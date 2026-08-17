import 'dart:convert';
import 'dart:io';

import 'hermes_home_paths.dart';

class SkillManifest {
  const SkillManifest({this.version = 1, this.skills = const []});

  final int version;
  final List<String> skills;

  Map<String, dynamic> toJson() => {'version': version, 'skills': skills};
}

/// Copies skill packs in Phase 3. Phase 1 keeps an empty manifest.
class SkillRegistry {
  SkillRegistry(this.home);

  final Directory home;

  File get _manifest => File('${home.path}/${HermesHomePaths.skillsManifestFile}');
  Directory get _dir => Directory('${home.path}/${HermesHomePaths.skillsDir}');

  Future<SkillManifest> ensureEmpty() async {
    await _dir.create(recursive: true);
    if (!await _manifest.exists()) {
      const empty = SkillManifest();
      await _manifest.writeAsString(
        const JsonEncoder.withIndent('  ').convert(empty.toJson()),
        flush: true,
      );
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
        skills: skills is List ? [for (final s in skills) s.toString()] : const [],
      );
    } catch (_) {
      return const SkillManifest();
    }
  }
}
