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
    if (await tmp.exists()) {
      await tmp.delete(recursive: true);
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

    test('ledger import does not change home summary', () async {
      final model = AppModel();
      model.setHomeSummaryText('keep me');
      final export = AppStateTransfer.buildLedgerExportMap(model);

      model.setHomeSummaryText('changed before import');
      await AppStateTransfer.applyImport(model, export);

      expect(model.homeSummaryText, 'changed before import');
    });

    test('rejects unsupported format version', () {
      final err = AppStateTransfer.validateImportRoot({'formatVersion': 99, 'ledger': {}});
      expect(err, isNotNull);
      expect(err, contains('Unsupported'));
    });

    test('rejects missing ledger key', () {
      final err = AppStateTransfer.validateImportRoot({'formatVersion': 1});
      expect(err, isNotNull);
      expect(err, contains('ledger'));
    });
  });
}
