import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// Google Play subscription management (Android).
abstract final class PlaySubscriptionStore {
  PlaySubscriptionStore._();

  static const packageName = 'com.getzoro.zoroFlutter';

  static bool get isAvailable => !kIsWeb && Platform.isAndroid;

  /// Opens Play Store subscription management for this app.
  static Future<void> showManageSubscriptions() async {
    if (!isAvailable) return;
    final uri = Uri.parse(
      'https://play.google.com/store/account/subscriptions?package=$packageName',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
