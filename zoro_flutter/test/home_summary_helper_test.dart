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

    test('markHomeSummaryHelperRan advances rotation', () {
      final model = AppModel();
      model.homeSummaryHelperRotationIndex = 0;
      model.markHomeSummaryHelperRan('2026-05-29');
      expect(model.homeSummaryHelperLastRunDayKey, '2026-05-29');
      expect(model.homeSummaryHelperRotationIndex, 1);
    });
  });
}
