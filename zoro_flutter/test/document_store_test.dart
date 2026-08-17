import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/agent/document_store.dart';
import 'package:zoro_flutter/core/agent/hermes_home_paths.dart';

void main() {
  late Directory dir;
  late DocumentStore store;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('zoro-docs-');
    store = DocumentStore(dir);
    await store.ensureLayout();
  });

  tearDown(() async {
    if (await dir.exists()) await dir.delete(recursive: true);
  });

  test('commit copies previous HEAD into revisions', () async {
    await store.commit(
      id: HermesHomePaths.retirementDocId,
      markdown: 'one',
      reason: 'first',
    );
    final second = await store.commit(
      id: HermesHomePaths.retirementDocId,
      markdown: 'two',
      reason: 'second',
    );
    expect(second.headRev, 2);
    expect(await store.readHead(HermesHomePaths.retirementDocId), 'two');
    expect(await store.readRev(HermesHomePaths.retirementDocId, 1), 'one');
    final revs = await store.listRevs(HermesHomePaths.retirementDocId);
    expect(revs.first.rev, 2);
  });

  test('unifiedDiff marks changed lines', () {
    final diff = DocumentStore.unifiedDiff('a\nb\n', 'a\nc\n', path: 'x.md');
    expect(diff, contains('-b'));
    expect(diff, contains('+c'));
  });
}
