import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../state/app_model.dart';

class LlmKeyStore {
  LlmKeyStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static String _keyName(LlmProvider p) => switch (p) {
        LlmProvider.appleFoundation => throw StateError('No API key slot for Apple on-device model'),
        LlmProvider.openai => 'llm_openai_api_key',
        LlmProvider.anthropic => 'llm_anthropic_api_key',
        LlmProvider.gemini => 'llm_gemini_api_key',
      };

  Future<String?> readKey(LlmProvider provider) async {
    if (provider == LlmProvider.appleFoundation) return null;
    final v = await _storage.read(key: _keyName(provider));
    final trimmed = (v ?? '').trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  Future<void> writeKey({required LlmProvider provider, String? value}) async {
    if (provider == LlmProvider.appleFoundation) return;
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) {
      await _storage.delete(key: _keyName(provider));
      return;
    }
    await _storage.write(key: _keyName(provider), value: trimmed);
  }

  Future<Map<LlmProvider, String>> readAll() async {
    final out = <LlmProvider, String>{};
    for (final p in LlmProvider.values) {
      if (p == LlmProvider.appleFoundation) continue;
      final v = await readKey(p);
      if (v != null) out[p] = v;
    }
    return out;
  }
}

