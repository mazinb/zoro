import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/home/home_summary_focus_domain.dart';
import 'package:zoro_flutter/core/state/app_model.dart';

void main() {
  group('homeSummaryCalendarDayKey', () {
    test('formats local calendar day', () {
      expect(
        homeSummaryCalendarDayKey(DateTime(2026, 5, 29)),
        '2026-05-29',
      );
    });
  });

  group('homeSummaryDomainAtRotationIndex', () {
    test('rotates only through enabled domains', () {
      const enabled = [
        HomeSummaryFocusDomain.assets,
        HomeSummaryFocusDomain.goals,
      ];
      expect(homeSummaryDomainAtRotationIndex(enabled, 0), HomeSummaryFocusDomain.assets);
      expect(homeSummaryDomainAtRotationIndex(enabled, 1), HomeSummaryFocusDomain.goals);
      expect(homeSummaryDomainAtRotationIndex(enabled, 2), HomeSummaryFocusDomain.assets);
    });
  });

  group('AppModel home summary helper prefs', () {
    test('parseIncludedIds falls back when empty', () {
      expect(homeSummaryParseIncludedIds([]).length, 5);
    });

    test('setHomeSummaryHelperIncludedDomains persists subset', () {
      final model = AppModel();
      model.setHomeSummaryHelperIncludedDomains([
        HomeSummaryFocusDomain.cashflow,
        HomeSummaryFocusDomain.context,
      ]);
      expect(model.homeSummaryHelperIncludedDomainIds, ['cashflow', 'context']);
      expect(model.homeSummaryHelperIncludedDomains.length, 2);
    });

    test('shouldRunHomeSummaryHelperNow respects enabled and cadence', () {
      final model = AppModel();
      expect(model.shouldRunHomeSummaryHelperNow(DateTime(2026, 6, 2)), isFalse);

      model.homeMessagesEnabled = true;
      expect(model.shouldRunHomeSummaryHelperNow(DateTime(2026, 6, 2)), isTrue);

      model.markHomeSummaryHelperRan('2026-06-02');
      expect(model.shouldRunHomeSummaryHelperNow(DateTime(2026, 6, 2)), isFalse);
      expect(model.shouldRunHomeSummaryHelperNow(DateTime(2026, 6, 3)), isTrue);

      model.homeMessagesCadence = HomeMessageCadence.weekly;
      model.markHomeSummaryHelperRan('2026-06-03');
      expect(model.shouldRunHomeSummaryHelperNow(DateTime(2026, 6, 4)), isFalse);
      expect(model.shouldRunHomeSummaryHelperNow(DateTime(2026, 6, 9)), isTrue);
    });

    test('markHomeSummaryHelperRan advances rotation', () {
      final model = AppModel();
      model.homeSummaryHelperRotationIndex = 0;
      model.markHomeSummaryHelperRan('2026-05-29');
      expect(model.homeSummaryHelperLastRunDayKey, '2026-05-29');
      expect(model.homeSummaryHelperRotationIndex, 1);
    });

    test('removing a focus domain keeps the upcoming topic', () {
      const all = HomeSummaryFocusDomain.values;
      expect(
        remapHomeSummaryRotationIndex(
          oldEnabled: all,
          newEnabled: [
            HomeSummaryFocusDomain.assets,
            HomeSummaryFocusDomain.liabilities,
            HomeSummaryFocusDomain.context,
            HomeSummaryFocusDomain.goals,
          ],
          rotationIndex: 4,
        ),
        3,
      );
      expect(
        homeSummaryDomainAtRotationIndex(
          [
            HomeSummaryFocusDomain.assets,
            HomeSummaryFocusDomain.liabilities,
            HomeSummaryFocusDomain.context,
            HomeSummaryFocusDomain.goals,
          ],
          remapHomeSummaryRotationIndex(
            oldEnabled: all,
            newEnabled: [
              HomeSummaryFocusDomain.assets,
              HomeSummaryFocusDomain.liabilities,
              HomeSummaryFocusDomain.context,
              HomeSummaryFocusDomain.goals,
            ],
            rotationIndex: 4,
          ),
        ),
        HomeSummaryFocusDomain.goals,
      );
    });

    test('setHomeSummaryHelperIncludedDomains preserves goals as next up', () {
      final model = AppModel();
      model.homeSummaryHelperRotationIndex = 4;
      model.setHomeSummaryHelperIncludedDomains([
        HomeSummaryFocusDomain.assets,
        HomeSummaryFocusDomain.liabilities,
        HomeSummaryFocusDomain.context,
        HomeSummaryFocusDomain.goals,
      ]);
      expect(
        homeSummaryDomainAtRotationIndex(
          model.homeSummaryHelperIncludedDomains,
          model.homeSummaryHelperRotationIndex,
        ),
        HomeSummaryFocusDomain.goals,
      );
    });
  });
}
