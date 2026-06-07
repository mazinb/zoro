import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'iap_product_ids.dart';

/// iOS StoreKit 2 [SubscriptionStoreView] bridge for App Store subscription compliance.
class AppleSubscriptionStore {
  AppleSubscriptionStore._();

  static const _channel = MethodChannel('zoro/apple_subscription_store');
  static const _events = EventChannel('zoro/apple_subscription_store/events');

  static bool? _cachedAvailable;

  static Future<bool> isAvailable() async {
    if (!Platform.isIOS) return false;
    _cachedAvailable ??= await _channel.invokeMethod<bool>('isAvailable') ?? false;
    return _cachedAvailable!;
  }

  static Future<void> showManageSubscriptions() async {
    if (!Platform.isIOS) return;
    await _channel.invokeMethod<void>('showManageSubscriptions');
  }

  static Stream<void> purchaseUpdates() {
    if (!Platform.isIOS) return const Stream.empty();
    return _events.receiveBroadcastStream().map((_) {});
  }
}

/// Embeds Apple's SubscriptionStoreView (title, term, price, Terms, Privacy).
class AppleProSubscriptionStoreView extends StatelessWidget {
  const AppleProSubscriptionStoreView({
    super.key,
    this.productId = IapProductIds.proMonthly,
    this.height = 300,
  });

  final String productId;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (kIsWeb || !Platform.isIOS) return const SizedBox.shrink();
    return SizedBox(
      height: height,
      width: double.infinity,
      child: UiKitView(
        viewType: 'zoro/subscription_store_view',
        creationParams: <String, dynamic>{'productId': productId},
        creationParamsCodec: const StandardMessageCodec(),
      ),
    );
  }
}
