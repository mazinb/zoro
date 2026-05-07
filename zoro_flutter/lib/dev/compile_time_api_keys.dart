/// Optional debug prefills from compile-time defines only (never store secrets in source).
///
/// Local: `flutter run --dart-define-from-file=../zoro-app/.env.local`
/// or `./scripts/flutter_with_zoro_env.sh run ...`.
/// App Store / CI: omit that flag so these stay empty.
class CompileTimeApiKeys {
  /// True only when we *intentionally* compile local keys into the app (e.g. Xcode Run on device).
  /// This is separate from `kDebugMode` so Release-on-device can still autofill/persist keys.
  static const bool allowLocalKeyAutofill = bool.fromEnvironment(
    'ZORO_LOCAL_KEYS',
    defaultValue: false,
  );

  static const String openAiApiKey = String.fromEnvironment(
    'OPENAI_API_KEY',
    defaultValue: '',
  );
  static const String anthropicApiKey = String.fromEnvironment(
    'ANTHROPIC_API_KEY',
    defaultValue: '',
  );
  static const String geminiApiKey = String.fromEnvironment(
    'GEMINI_API_KEY',
    defaultValue: '',
  );
}
