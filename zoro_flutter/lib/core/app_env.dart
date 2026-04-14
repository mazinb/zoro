/// Compile-time API origin. Override for local Next dev:
/// `flutter run --dart-define=API_BASE_URL=http://localhost:3000`
class AppEnv {
  AppEnv._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://www.getzoro.com',
  );

  static Uri apiUri(String path) {
    final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$p');
  }
}
