import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _kDeviceIdKey = 'zoro_device_id_v1';

/// Generates and persists a random device id (no PII).
///
/// Stored in secure storage so it survives reinstalls less often (iOS Keychain),
/// but we treat it as best-effort identity for entitlements.
class DeviceIdStore {
  DeviceIdStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  Future<String> getOrCreate() async {
    final existing = (await _storage.read(key: _kDeviceIdKey))?.trim();
    if (existing != null && existing.isNotEmpty) return existing;
    final next = _randomId();
    await _storage.write(key: _kDeviceIdKey, value: next);
    return next;
  }

  static String _randomId() {
    // 128-bit-ish URL-safe token, good enough for device identity.
    final rnd = Random.secure();
    final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    final out = StringBuffer();
    for (final b in bytes) {
      out.write(alphabet[b % alphabet.length]);
    }
    return out.toString();
  }
}

