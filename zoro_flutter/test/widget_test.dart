import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/app.dart';

void main() {
  testWidgets('App boots into UI shell', (tester) async {
    await tester.pumpWidget(const ZoroApp());
    expect(find.text('Home'), findsAtLeastNWidgets(1));
  });
}
