import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keychain/Keystore vault. Never write secrets into hermes_home JSON.
class CredentialVault {
  CredentialVault({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const mailboxTokenKey = 'zoro.vault.mailbox_token';

  static String fileTypeKey(String typeId) => 'zoro.vault.fileType.$typeId';

  Future<String?> readMailboxToken() => _read(mailboxTokenKey);

  Future<void> writeMailboxToken(String? value) => _write(mailboxTokenKey, value);

  Future<String?> readFileTypePassword(String typeId) => _read(fileTypeKey(typeId));

  Future<void> writeFileTypePassword(String typeId, String? value) =>
      _write(fileTypeKey(typeId), value);

  Future<void> deleteFileTypePassword(String typeId) =>
      _storage.delete(key: fileTypeKey(typeId));

  Future<bool> hasFileTypePassword(String typeId) async {
    final v = await readFileTypePassword(typeId);
    return v != null && v.isNotEmpty;
  }

  Future<String?> _read(String key) async {
    final v = await _storage.read(key: key);
    final t = (v ?? '').trim();
    return t.isEmpty ? null : t;
  }

  Future<void> _write(String key, String? value) async {
    final t = (value ?? '').trim();
    if (t.isEmpty) {
      await _storage.delete(key: key);
      return;
    }
    await _storage.write(key: key, value: t);
  }
}
