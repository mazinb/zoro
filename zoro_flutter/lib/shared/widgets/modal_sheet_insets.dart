import 'package:flutter/material.dart';

/// Bottom inset for modal sheets: Android nav bar, home indicator, and keyboard.
double modalSheetBottomPadding(BuildContext context) {
  final mq = MediaQuery.of(context);
  return mq.padding.bottom + mq.viewInsets.bottom;
}

/// Wraps [child] for use inside a bottom sheet with correct Android safe area.
Widget modalSheetSafeChild(BuildContext context, {required Widget child}) {
  return Padding(
    padding: EdgeInsets.only(bottom: modalSheetBottomPadding(context)),
    child: SizedBox(width: double.infinity, child: child),
  );
}

/// Standard modal bottom sheet with explicit bottom safe area (Android 3-button nav, etc.).
Future<T?> showAppModalBottomSheet<T extends Object?>({
  required BuildContext context,
  required WidgetBuilder builder,
  Color? backgroundColor,
  bool showDragHandle = false,
  bool enableDrag = true,
  bool isDismissible = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    showDragHandle: showDragHandle,
    enableDrag: enableDrag,
    isDismissible: isDismissible,
    useSafeArea: false,
    backgroundColor: backgroundColor,
    builder: (ctx) => modalSheetSafeChild(ctx, child: builder(ctx)),
  );
}
