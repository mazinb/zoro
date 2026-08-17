import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/agent/cron_bridge.dart';

void main() {
  test('Hermes notification ids stay in 1000–1999', () {
    expect(HermesNotificationIds.minId, 1000);
    expect(HermesNotificationIds.maxId, 1999);
    expect(
      HermesNotificationIds.notificationIdFor('plan_review'),
      inInclusiveRange(1000, 1999),
    );
    expect(HermesNotificationIds.isHermesTask('hermes:abc'), isTrue);
    expect(HermesNotificationIds.jobIdFromTask('hermes:abc'), 'abc');
    expect(kReminderSummaryNotificationId, 900);
  });

  test('upsert and list cron job defs', () async {
    final dir = await Directory.systemTemp.createTemp('zoro-cron-');
    addTearDown(() async {
      if (await dir.exists()) await dir.delete(recursive: true);
    });
    final cron = CronBridge(dir);
    await cron.upsert(
      CronJobDef(
        id: 'plan_review',
        title: 'Review plan',
        nextAt: DateTime.utc(2030, 1, 1),
      ),
    );
    final jobs = await cron.listJobs();
    expect(jobs.single.id, 'plan_review');
    expect(jobs.single.nextAt, DateTime.utc(2030, 1, 1));
  });
}
