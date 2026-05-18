import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:zoro_flutter/core/persistence/app_state_transfer.dart';
import 'package:zoro_flutter/core/state/app_model.dart';
class _FakePathProvider extends PathProviderPlatform {
  _FakePathProvider(this.root);

  final Directory root;

  @override
  Future<String?> getApplicationSupportPath() async => root.path;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tmp;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('zoro_transfer_test_');
    PathProviderPlatform.instance = _FakePathProvider(tmp);
  });

  tearDown(() async {
    await Future<void>.delayed(const Duration(milliseconds: 100));
    if (await tmp.exists()) {
      try {
        await tmp.delete(recursive: true);
      } catch (_) {}
    }
  });

  group('AppStateTransfer', () {
    test('ledger export contains ledger only', () {
      final model = AppModel();
      model.setHomeSummaryText('not in export');

      final json = AppStateTransfer.encodeLedgerExportJson(model);
      final root = AppStateTransfer.parseImportJson(json);
      expect(root['exportKind'], AppStateTransfer.ledgerExportKind);
      expect(root['ledger'], isA<Map>());
      expect(root.containsKey('settings'), isFalse);
      expect(root.containsKey('chats'), isFalse);
    });

    test('ledger import replace does not change home summary', () async {
      final model = AppModel();
      model.setHomeSummaryText('keep me');
      final export = AppStateTransfer.buildLedgerExportMap(model);

      model.setHomeSummaryText('changed before import');
      await AppStateTransfer.applyImport(model, export, mode: ImportApplyMode.replace);

      expect(model.homeSummaryText, 'changed before import');
    });

    test('ledger merge updates asset by id', () async {
      final model = AppModel();
      final id = model.assets.first.id;
      final originalName = model.assets.first.name;

      final export = AppStateTransfer.buildLedgerExportMap(model);
      final ledger = Map<String, dynamic>.from(export['ledger'] as Map);
      final assets = List<Map<String, dynamic>>.from(ledger['assets'] as List);
      assets[0] = Map<String, dynamic>.from(assets[0])..['name'] = 'Redacted Bank';
      ledger['assets'] = assets;
      final sanitized = Map<String, dynamic>.from(export)..['ledger'] = ledger;

      await AppStateTransfer.applyImport(model, sanitized, mode: ImportApplyMode.merge);

      expect(model.assets.first.id, id);
      expect(model.assets.first.name, 'Redacted Bank');
      expect(originalName, isNot('Redacted Bank'));
    });

    test('ledger part export only includes chosen asset', () {
      final model = AppModel();
      final assetId = model.assets.first.id;
      final map = AppStateTransfer.buildLedgerExportMap(
        model,
        scope: LedgerExportScope.part,
        partGroup: LedgerPartGroup.assets,
        partPickId: assetId,
      );
      final ledger = map['ledger'] as Map;
      final assets = ledger['assets'] as List;
      expect(assets.length, 1);
      expect((assets.first as Map)['id'], assetId);
      expect(ledger.containsKey('liabilities'), isFalse);
    });

    test('context export round-trips markdown', () {
      final model = AppModel();
      final assetId = model.assets.first.id;
      model.setAssetContextMarkdown(assetId: assetId, markdown: '## Notes\nSecret bank');

      final key = AppModel.contextKeyAsset(assetId);
      final json = AppStateTransfer.encodeExportJson(
        model,
        exportKind: DataExportKind.context,
        pickId: key,
      );
      final root = AppStateTransfer.parseImportJson(json);
      final analysis = AppStateTransfer.analyzeImport(model, root);
      expect(analysis.exportKind, DataExportKind.context);
      expect(analysis.lines.any((l) => l.label.contains('Update context')), isTrue);
    });

    test('rejects unsupported format version', () {
      final err = AppStateTransfer.validateImportRoot({'formatVersion': 99, 'exportKind': 'ledger', 'ledger': {}});
      expect(err, isNotNull);
      expect(err, contains('Unsupported'));
    });

    test('rejects missing ledger key', () {
      final err = AppStateTransfer.validateImportRoot({'formatVersion': 3, 'exportKind': 'ledger'});
      expect(err, isNotNull);
      expect(err, contains('ledger'));
    });
  });
}
