import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:zoro_flutter/core/persistence/app_state_paths.dart';
import 'package:zoro_flutter/core/persistence/app_state_split_store.dart';
import 'package:zoro_flutter/core/state/app_model.dart';

class _FakePathProvider extends PathProviderPlatform {
  _FakePathProvider(this.root);

  final Directory root;

  @override
  Future<String?> getApplicationSupportPath() async => root.path;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppStateSplitStore', () {
    late Directory tmp;
    late _FakePathProvider fake;

    setUp(() async {
      tmp = await Directory.systemTemp.createTemp('zoro_split_test_');
      fake = _FakePathProvider(tmp);
      PathProviderPlatform.instance = fake;
    });

    tearDown(() async {
      if (await tmp.exists()) {
        await tmp.delete(recursive: true);
      }
    });

    test('save and load split layout', () async {
      final model = AppModel();
      model.setHomeSummaryText('manifest test');
      await AppStateSplitStore.saveMonolithic(model.buildPersistedSnapshot());

      final manifestFile = File('${tmp.path}/${AppStatePaths.manifestFile}');
      expect(await manifestFile.exists(), isTrue);
      final manifestText = await manifestFile.readAsString();
      expect(manifestText.contains('"formatVersion": 2'), isTrue);
      expect(manifestText.contains('data/ledger.json'), isTrue);
      expect(manifestText.length < 800, isTrue);

      final ledgerFile = File('${tmp.path}/${AppStatePaths.ledgerFile}');
      expect(await ledgerFile.exists(), isTrue);

      final loaded = await AppStateSplitStore.loadAsMonolithic();
      expect(loaded, isNotNull);
      final settings = loaded!['settings'] as Map;
      expect(settings['homeSummaryText'], 'manifest test');
    });

    test('migrates monolithic v1 to split', () async {
      final model = AppModel();
      model.setHomeSummaryText('legacy');
      final monolithic = model.buildPersistedSnapshot();
      final legacyFile = File('${tmp.path}/${AppStatePaths.manifestFile}');
      await legacyFile.parent.create(recursive: true);
      await legacyFile.writeAsString(
        const JsonEncoder.withIndent('  ').convert(monolithic),
      );

      final loaded = await AppStateSplitStore.loadAsMonolithic();
      expect(loaded, isNotNull);
      expect((loaded!['settings'] as Map)['homeSummaryText'], 'legacy');

      final manifestText = await legacyFile.readAsString();
      expect(manifestText.contains('"formatVersion": 2'), isTrue);
      expect(await File('${tmp.path}/${AppStatePaths.ledgerFile}').exists(), isTrue);
    });
  });
}
