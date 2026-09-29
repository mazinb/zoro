import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the Covered Call Assistant (portfolio.getzoro.com) share token.
class PortfolioLinkStore {
  PortfolioLinkStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const tokenKey = 'portfolio_zoro_share_token';
  static const assetIdKey = 'portfolio_zoro_asset_id';
  static const lastNavKey = 'portfolio_zoro_last_nav';
  static const lastAsOfKey = 'portfolio_zoro_last_as_of';
  static const lastSourceKey = 'portfolio_zoro_last_source';

  Future<String?> readToken() async {
    final v = (await _storage.read(key: tokenKey) ?? '').trim();
    return v.isEmpty ? null : v;
  }

  Future<void> writeToken(String? token) async {
    final t = (token ?? '').trim();
    if (t.isEmpty) {
      await _storage.delete(key: tokenKey);
      return;
    }
    await _storage.write(key: tokenKey, value: t);
  }

  Future<String?> readAssetId() async {
    final v = (await _storage.read(key: assetIdKey) ?? '').trim();
    return v.isEmpty ? null : v;
  }

  Future<void> writeAssetId(String? id) async {
    final v = (id ?? '').trim();
    if (v.isEmpty) {
      await _storage.delete(key: assetIdKey);
      return;
    }
    await _storage.write(key: assetIdKey, value: v);
  }

  Future<void> writeLastValuation({
    required double? nav,
    required String? asOf,
    required String? source,
  }) async {
    if (nav == null) {
      await _storage.delete(key: lastNavKey);
    } else {
      await _storage.write(key: lastNavKey, value: nav.toString());
    }
    if (asOf == null || asOf.isEmpty) {
      await _storage.delete(key: lastAsOfKey);
    } else {
      await _storage.write(key: lastAsOfKey, value: asOf);
    }
    if (source == null || source.isEmpty) {
      await _storage.delete(key: lastSourceKey);
    } else {
      await _storage.write(key: lastSourceKey, value: source);
    }
  }

  Future<({double? nav, String? asOf, String? source})> readLastValuation() async {
    final navRaw = await _storage.read(key: lastNavKey);
    final asOf = await _storage.read(key: lastAsOfKey);
    final source = await _storage.read(key: lastSourceKey);
    final nav = double.tryParse((navRaw ?? '').trim());
    return (nav: nav, asOf: asOf, source: source);
  }

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: tokenKey),
      _storage.delete(key: assetIdKey),
      _storage.delete(key: lastNavKey),
      _storage.delete(key: lastAsOfKey),
      _storage.delete(key: lastSourceKey),
    ]);
  }
}
