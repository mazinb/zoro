import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/api/zoro_api.dart';
import 'package:zoro_flutter/core/session/session_controller.dart';
import 'package:zoro_flutter/features/onboarding/onboarding_page.dart';

void main() {
  testWidgets('Onboarding shows sign-in copy', (tester) async {
    final session = SessionController(api: ZoroApi());
    await tester.pumpWidget(
      MaterialApp(home: OnboardingPage(session: session)),
    );
    expect(
      find.textContaining('Enter the email you use for Zoro'),
      findsOneWidget,
    );
  });
}
