import 'dart:async';

import 'package:in_app_purchase/in_app_purchase.dart';

import '../api/zoro_api.dart';
import '../entitlements/mobile_entitlements.dart';

class IapCatalog {
  const IapCatalog({
    required this.proMonthly,
    required this.credit1,
  });

  final ProductDetails? proMonthly;
  final ProductDetails? credit1;

  bool get ready => proMonthly != null && credit1 != null;
}

class IapService {
  IapService({
    required ZoroApi api,
    InAppPurchase? iap,
  })  : _api = api,
        _iap = iap ?? InAppPurchase.instance;

  final ZoroApi _api;
  final InAppPurchase _iap;

  StreamSubscription<List<PurchaseDetails>>? _sub;

  IapCatalog? _catalog;
  IapCatalog? get catalog => _catalog;

  String? _lastError;
  String? get lastError => _lastError;

  bool _available = false;
  bool get available => _available;

  bool _busy = false;
  bool get busy => _busy;

  Future<void> init({required Set<String> productIds}) async {
    _lastError = null;
    _available = await _iap.isAvailable();
    if (!_available) return;

    // Query products.
    final resp = await _iap.queryProductDetails(productIds);
    if (resp.error != null) {
      _lastError = resp.error!.message;
      return;
    }

    ProductDetails? pro;
    ProductDetails? credit;
    for (final p in resp.productDetails) {
      if (p.id.contains('pro_monthly') || p.id.endsWith('.pro_monthly')) pro = p;
      if (p.id.contains('credit_1') || p.id.endsWith('.credit_1')) credit = p;
    }
    _catalog = IapCatalog(proMonthly: pro, credit1: credit);

    // Listen to purchase updates once.
    _sub ??= _iap.purchaseStream.listen(_onPurchaseUpdate, onError: (e) {
      _lastError = e.toString();
    });
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
  }

  Future<void> buyProduct(ProductDetails product) async {
    if (!_available) return;
    _busy = true;
    _lastError = null;
    try {
      final purchaseParam = PurchaseParam(productDetails: product);
      // credit_1 is consumable; pro_monthly is subscription.
      if (product.id.contains('credit')) {
        await _iap.buyConsumable(purchaseParam: purchaseParam, autoConsume: true);
      } else {
        await _iap.buyNonConsumable(purchaseParam: purchaseParam);
      }
    } finally {
      _busy = false;
    }
  }

  Future<void> restore() async {
    if (!_available) return;
    _lastError = null;
    await _iap.restorePurchases();
  }

  Future<void> _onPurchaseUpdate(List<PurchaseDetails> purchases) async {
    for (final p in purchases) {
      if (p.status == PurchaseStatus.pending) {
        continue;
      }
      if (p.status == PurchaseStatus.error) {
        _lastError = p.error?.message ?? 'Purchase failed';
        if (p.pendingCompletePurchase) {
          await _iap.completePurchase(p);
        }
        continue;
      }

      // Purchased or restored.
      if (p.status == PurchaseStatus.purchased || p.status == PurchaseStatus.restored) {
        try {
          // Record purchase + let backend update entitlements (currently best-effort; receipt verification can be added).
          await _api.recordMobileIap(
            deviceId: _apiDeviceId,
            productId: p.productID,
            transactionId: p.purchaseID,
            verificationData: p.verificationData.serverVerificationData,
            source: p.verificationData.source,
          );
          final body = await _api.applyMobileIapEntitlement(
            deviceId: _apiDeviceId,
            productId: p.productID,
          );
          final next = MobileEntitlements.tryFromApi(body);
          if (next != null) {
            _publishEntitlements(next);
          }
        } catch (e) {
          _lastError = e.toString();
        }
      }

      if (p.pendingCompletePurchase) {
        await _iap.completePurchase(p);
      }
    }
  }

  // The app holds deviceId; we keep it set from outside before purchases.
  String _apiDeviceId = '';
  void setDeviceId(String deviceId) {
    _apiDeviceId = deviceId.trim();
  }

  MobileEntitlements? _latestEntitlements;

  /// Called when a purchase/restore updates entitlements from the backend.
  void Function(MobileEntitlements entitlements)? onEntitlementsUpdated;

  MobileEntitlements? takeLatestEntitlements() {
    final e = _latestEntitlements;
    _latestEntitlements = null;
    return e;
  }

  void _publishEntitlements(MobileEntitlements entitlements) {
    _latestEntitlements = entitlements;
    onEntitlementsUpdated?.call(entitlements);
  }
}

